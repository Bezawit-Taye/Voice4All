/**
 * Retrieval Service
 * Responsible for searching course content and extracting relevant lesson sources.
 * Adheres strictly to factual citations from supplied course content and learner context.
 */

const fs = require('fs');
const path = require('path');

const COURSE_DATA_PATH = path.join(__dirname, '..', '..', 'data', 'course-content.json');

/**
 * Loads course content from disk
 */
function loadCourseContent() {
  try {
    const rawData = fs.readFileSync(COURSE_DATA_PATH, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Error loading course content from', COURSE_DATA_PATH, error.message);
    return [];
  }
}

const STOPWORDS = new Set([
  'what', 'is', 'are', 'the', 'a', 'an', 'in', 'on', 'of', 'for', 'and', 'or',
  'to', 'this', 'that', 'with', 'from', 'by', 'at', 'it', 'its', 'as', 'do',
  'does', 'how', 'why', 'who', 'when', 'where', 'which', 'be', 'been', 'can'
]);

/**
 * Tokenize text into normalized search terms (supporting English and Amharic)
 * @param {string} text
 * @param {boolean} [filterStopwords=true]
 * @returns {string[]}
 */
function tokenize(text, filterStopwords = true) {
  if (!text || typeof text !== 'string') return [];
  // Split on whitespace and common punctuation, retaining Ethiopic & Latin characters
  const rawTokens = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'፡።፣፤]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1);

  if (!filterStopwords) return rawTokens;
  const filtered = rawTokens.filter((token) => !STOPWORDS.has(token));
  return filtered.length > 0 ? filtered : rawTokens;
}

/**
 * Computes overlap score between query tokens and target text
 * @param {string[]} queryTokens
 * @param {string} targetText
 * @returns {number}
 */
function computeScore(queryTokens, targetText) {
  if (!targetText || queryTokens.length === 0) return 0;
  const targetLower = targetText.toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    // Exact word or substring match
    if (targetLower.includes(token)) {
      score += 2;
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
function extractSnippet(fullText, queryTokens, maxWords = 45) {
  if (!fullText) return '';
  const sentences = fullText.split(/(?<=[.!?።])\s+/);
  
  // Find sentence with highest token hit
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

  // Trim to max words if overly long
  const words = bestSentence.split(/\s+/);
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ') + '...';
  }
  return bestSentence.trim();
}

/**
 * Search the course catalog and optional user-provided context
 * @param {string} question
 * @param {object} options
 * @param {string} [options.language='en']
 * @param {object} [options.context]
 * @param {number} [options.limit=3]
 * @returns {Array<object>} list of retrieved sources
 */
function retrieveSources(question, options = {}) {
  const language = options.language === 'am' ? 'am' : 'en';
  const queryTokens = tokenize(question, true);
  const courseItems = loadCourseContent();
  const candidates = [];

  // 1. Evaluate supplied learner context if present
  // When the student is currently reading a lesson, their question is primarily in that context
  if (options.context && typeof options.context === 'object') {
    const ctx = options.context;
    const ctxText = ctx.lessonText || '';
    const ctxTitle = `${ctx.courseTitle || ''} ${ctx.moduleTitle || ''} ${ctx.lessonTitle || ''}`;
    const ctxScore = (computeScore(queryTokens, ctxTitle) * 2.5) + (computeScore(queryTokens, ctxText) * 2.0) + 10.0; // Strong priority for the learner's active context

    if (ctxText || ctx.lessonTitle) {
      candidates.push({
        id: 'provided-context',
        courseTitle: ctx.courseTitle || 'Current Course',
        moduleTitle: ctx.moduleTitle || 'Current Module',
        lessonTitle: ctx.lessonTitle || 'Current Lesson',
        snippet: extractSnippet(ctxText || ctxTitle, queryTokens),
        score: ctxScore,
        fullContent: ctxText,
        isContextSource: true
      });
    }
  }

  // 2. Search knowledge base
  for (const item of courseItems) {
    const textToSearch = language === 'am' ? (item.content_am || item.content) : item.content;
    const keywords = (item.keywords || []).join(' ');
    const titleText = `${item.courseTitle} ${item.moduleTitle} ${item.lessonTitle}`;

    // Token score
    const textScore = computeScore(queryTokens, textToSearch);
    const titleScore = computeScore(queryTokens, titleText) * 2;
    const keywordScore = computeScore(queryTokens, keywords) * 1.5;
    const totalScore = textScore + titleScore + keywordScore;

    if (totalScore > 0) {
      candidates.push({
        id: item.id,
        courseTitle: item.courseTitle,
        moduleTitle: item.moduleTitle,
        lessonTitle: item.lessonTitle,
        snippet: extractSnippet(textToSearch, queryTokens),
        score: totalScore,
        fullContent: textToSearch,
        isContextSource: false,
        faqs: item.faqs || []
      });
    }
  }

  // 3. Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // If no hits at all, fallback to the first course item or supplied context
  if (candidates.length === 0) {
    if (options.context && options.context.lessonTitle) {
      candidates.push({
        id: 'provided-context',
        courseTitle: options.context.courseTitle || 'Current Course',
        moduleTitle: options.context.moduleTitle || 'Current Module',
        lessonTitle: options.context.lessonTitle || 'Current Lesson',
        snippet: options.context.lessonText ? options.context.lessonText.slice(0, 150) + '...' : '',
        score: 0.1,
        fullContent: options.context.lessonText || '',
        isContextSource: true
      });
    } else if (courseItems.length > 0) {
      const fallback = courseItems[0];
      const text = language === 'am' ? (fallback.content_am || fallback.content) : fallback.content;
      candidates.push({
        id: fallback.id,
        courseTitle: fallback.courseTitle,
        moduleTitle: fallback.moduleTitle,
        lessonTitle: fallback.lessonTitle,
        snippet: text.slice(0, 150) + '...',
        score: 0.1,
        fullContent: text,
        isContextSource: false
      });
    }
  }

  // Return formatted sources respecting limit
  const limit = options.limit || 3;
  return candidates.slice(0, limit).map((cand) => ({
    courseTitle: cand.courseTitle,
    moduleTitle: cand.moduleTitle,
    lessonTitle: cand.lessonTitle,
    snippet: cand.snippet,
    score: parseFloat(cand.score.toFixed(2))
  }));
}

/**
 * Searches for an exact or high-confidence FAQ match in course-content.json
 * @param {string} question
 * @param {string} language 'en' | 'am'
 * @returns {object|null}
 */
function findFaqMatch(question, language = 'en') {
  const items = loadCourseContent();
  const qTokens = tokenize(question);
  if (qTokens.length === 0) return null;

  let bestMatch = null;
  let highestRatio = 0;

  for (const item of items) {
    if (!Array.isArray(item.faqs)) continue;

    for (const faq of item.faqs) {
      const faqQ = language === 'am' ? faq.question_am : faq.question_en;
      if (!faqQ) continue;

      const faqTokens = tokenize(faqQ);
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
            snippet: answer
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
  tokenize
};
