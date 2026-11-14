/**
 * Retrieval Service (Phase 2 Enhanced)
 * Searches actual course materials from Savanna knowledge base and active learner context.
 * Computes relevance confidence and prevents fabricated or hallucinated citations.
 */

const fs = require('fs');
const path = require('path');

const COURSE_DATA_PATH = path.join(__dirname, '..', '..', 'data', 'course-content.json');

// Common stopwords to filter for higher signal-to-noise ratio in search
const STOPWORDS = new Set([
  'what', 'is', 'are', 'the', 'a', 'an', 'in', 'on', 'of', 'for', 'and', 'or',
  'to', 'this', 'that', 'with', 'from', 'by', 'at', 'it', 'its', 'as', 'do',
  'does', 'how', 'why', 'who', 'when', 'where', 'which', 'be', 'been', 'can',
  'could', 'would', 'should', 'about', 'my', 'your', 'tell', 'me', 'please',
  'explain', 'give', 'like'
]);

// Minimum score threshold to consider a question relevant to the course
const RELEVANCE_THRESHOLD = 3.0;

/**
 * Loads course content from disk safely
 */
function loadCourseContent() {
  try {
    const rawData = fs.readFileSync(COURSE_DATA_PATH, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('[Retrieval] Error loading course content:', error.message);
    return [];
  }
}

/**
 * Tokenize text into search terms (English & Ethiopic characters)
 * @param {string} text
 * @param {boolean} [filterStopwords=true]
 * @returns {string[]}
 */
function tokenize(text, filterStopwords = true) {
  if (!text || typeof text !== 'string') return [];
  const raw = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'፡።፣፤]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (!filterStopwords) return raw;
  const filtered = raw.filter((w) => !STOPWORDS.has(w));
  return filtered.length > 0 ? filtered : raw;
}

/**
 * Computes detailed relevance score between query tokens and candidate text
 * @param {string[]} queryTokens
 * @param {string} targetText
 * @param {string} fullQuery
 * @returns {number}
 */
function computeScore(queryTokens, targetText, fullQuery = '') {
  if (!targetText || queryTokens.length === 0) return 0;
  const targetLower = targetText.toLowerCase();
  let score = 0;

  // Exact full phrase bonus
  if (fullQuery && fullQuery.length > 4 && targetLower.includes(fullQuery.toLowerCase())) {
    score += 8.0;
  }

  // Token matches
  for (const token of queryTokens) {
    if (targetLower.includes(token)) {
      score += 2.0;
    }
  }

  return score;
}

/**
 * Extracts a concise snippet surrounding the matched keywords
 * @param {string} fullText
 * @param {string[]} queryTokens
 * @param {number} maxWords
 * @returns {string}
 */
function extractSnippet(fullText, queryTokens, maxWords = 50) {
  if (!fullText) return '';
  const sentences = fullText.split(/(?<=[.!?።])\s+/);
  
  let bestSentence = sentences[0] || fullText;
  let maxHits = -1;

  for (const sentence of sentences) {
    const sLower = sentence.toLowerCase();
    let hits = 0;
    for (const token of queryTokens) {
      if (sLower.includes(token)) hits++;
    }
    if (hits > maxHits) {
      maxHits = hits;
      bestSentence = sentence;
    }
  }

  const words = bestSentence.split(/\s+/);
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ') + '...';
  }
  return bestSentence.trim();
}

/**
 * Search the course catalog and optional user-provided context
 * Returns retrieved sources along with relevance confidence.
 * @param {string} question
 * @param {object} options
 * @param {string} [options.language='en']
 * @param {object} [options.context]
 * @param {number} [options.limit=3]
 * @returns {{ sources: Array<object>, isRelevant: boolean, topScore: number }}
 */
function retrieveSources(question, options = {}) {
  const language = options.language === 'am' ? 'am' : 'en';
  const queryTokens = tokenize(question, true);
  const courseItems = loadCourseContent();
  const candidates = [];

  // 1. Evaluate supplied learner context (e.g. learner is currently on a specific Savanna concept)
  if (options.context && typeof options.context === 'object') {
    const ctx = options.context;
    const ctxText = ctx.lessonText || '';
    const ctxTitle = `${ctx.courseTitle || ''} ${ctx.moduleTitle || ''} ${ctx.lessonTitle || ''}`;
    
    const titleScore = computeScore(queryTokens, ctxTitle, question) * 3.0;
    const textScore = computeScore(queryTokens, ctxText, question) * 2.0;
    const ctxTotal = titleScore + textScore;

    if (ctxText || ctx.lessonTitle) {
      // If the question actually overlaps with the learner's current page, give strong boost
      const activeBoost = ctxTotal > 0 ? 12.0 : 0.5;
      candidates.push({
        id: 'provided-context',
        courseTitle: ctx.courseTitle || 'Current Course',
        moduleTitle: ctx.moduleTitle || 'Current Module',
        lessonTitle: ctx.lessonTitle || 'Current Lesson',
        snippet: extractSnippet(ctxText || ctxTitle, queryTokens),
        score: ctxTotal + activeBoost,
        simpleExplanation: '',
        isContextSource: true
      });
    }
  }

  // 2. Search knowledge base
  for (const item of courseItems) {
    const textToSearch = language === 'am' ? (item.content_am || item.content) : item.content;
    const keywords = (item.keywords || []).join(' ');
    const titleText = `${item.courseTitle} ${item.moduleTitle} ${item.lessonTitle}`;

    const textScore = computeScore(queryTokens, textToSearch, question);
    const titleScore = computeScore(queryTokens, titleText, question) * 2.5;
    const keywordScore = computeScore(queryTokens, keywords, question) * 2.0;
    const totalScore = textScore + titleScore + keywordScore;

    if (totalScore > 0) {
      candidates.push({
        id: item.id,
        courseTitle: item.courseTitle,
        moduleTitle: item.moduleTitle,
        lessonTitle: item.lessonTitle,
        snippet: extractSnippet(textToSearch, queryTokens),
        score: totalScore,
        simpleExplanation: language === 'am' ? item.simple_explanation_am : item.simple_explanation_en,
        isContextSource: false
      });
    }
  }

  // 3. Sort candidates by relevance score descending
  candidates.sort((a, b) => b.score - a.score);

  const topScore = candidates.length > 0 ? candidates[0].score : 0;
  const isRelevant = topScore >= RELEVANCE_THRESHOLD;

  const limit = options.limit || 3;
  const sources = (isRelevant ? candidates.slice(0, limit) : []).map((cand) => ({
    courseTitle: cand.courseTitle,
    moduleTitle: cand.moduleTitle,
    lessonTitle: cand.lessonTitle,
    snippet: cand.snippet,
    score: parseFloat(cand.score.toFixed(2)),
    simpleExplanation: cand.simpleExplanation || ''
  }));

  return {
    sources,
    isRelevant,
    topScore
  };
}

/**
 * Searches for an exact or high-confidence FAQ match in course-content.json
 * @param {string} question
 * @param {string} language 'en' | 'am'
 * @returns {object|null}
 */
function findFaqMatch(question, language = 'en') {
  const items = loadCourseContent();
  const qTokens = tokenize(question, true);
  if (qTokens.length === 0) return null;

  let bestMatch = null;
  let highestRatio = 0;

  for (const item of items) {
    if (!Array.isArray(item.faqs)) continue;

    for (const faq of item.faqs) {
      const faqQ = language === 'am' ? faq.question_am : faq.question_en;
      if (!faqQ) continue;

      const faqTokens = tokenize(faqQ, true);
      let hits = 0;
      for (const t of qTokens) {
        if (faqTokens.includes(t)) hits++;
      }

      const ratio = hits / Math.max(qTokens.length, faqTokens.length);
      if (ratio > highestRatio && ratio >= 0.5) {
        highestRatio = ratio;
        const answer = language === 'am' ? (faq.answer_am || faq.answer_en) : (faq.answer_en || faq.answer_am);
        bestMatch = {
          answer,
          ratio,
          source: {
            courseTitle: item.courseTitle,
            moduleTitle: item.moduleTitle,
            lessonTitle: item.lessonTitle,
            snippet: answer,
            score: parseFloat((ratio * 10).toFixed(2))
          }
        };
      }
    }
  }

  return bestMatch;
}

module.exports = {
  loadCourseContent,
  retrieveSources,
  findFaqMatch,
  tokenize,
  RELEVANCE_THRESHOLD
};
