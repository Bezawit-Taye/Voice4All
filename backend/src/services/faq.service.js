/**
 * FAQ Service
 * Manages verified offline course FAQs for rapid lookup and offline tutor fallback.
 */

const fs = require('fs');
const path = require('path');
const { tokenize } = require('./retrieval.service');

const FAQS_PATH = path.join(__dirname, '..', '..', 'data', 'faqs.json');

/**
 * Load FAQs from disk safely
 */
function loadFaqs() {
  try {
    const raw = fs.readFileSync(FAQS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[FAQ Service] Error loading faqs.json:', err.message);
    return [];
  }
}

/**
 * Find the closest matching FAQ for a question
 * @param {string} question
 * @param {string} [language='en'] 'en' | 'am'
 * @returns {object|null}
 */
function matchFaq(question, language = 'en') {
  const faqs = loadFaqs();
  const queryTokens = tokenize(question, true);
  if (!queryTokens || queryTokens.length === 0) return null;

  const lang = language === 'am' ? 'am' : 'en';
  let bestMatch = null;
  let highestScore = 0;

  for (const faq of faqs) {
    const targetQ = lang === 'am' ? faq.question_am : faq.question_en;
    const targetTokens = tokenize(targetQ, true);
    const keywords = faq.keywords || [];

    let tokenHits = 0;
    for (const t of queryTokens) {
      if (targetTokens.includes(t)) tokenHits += 2;
      else if (keywords.includes(t)) tokenHits += 1.5;
    }

    // Ratio relative to query length
    const score = tokenHits / Math.max(queryTokens.length, 1);

    if (score > highestScore && score >= 1.2) {
      highestScore = score;
      const answer = lang === 'am' ? faq.answer_am : faq.answer_en;
      bestMatch = {
        faqId: faq.id,
        category: faq.category,
        questionMatched: targetQ,
        answer,
        score: parseFloat(score.toFixed(2)),
        language: lang,
        source: {
          courseTitle: faq.courseTitle,
          moduleTitle: faq.moduleTitle,
          lessonTitle: faq.lessonTitle,
          snippet: answer,
          score: parseFloat((score * 10).toFixed(2))
        }
      };
    }
  }

  return bestMatch;
}

/**
 * Retrieve all FAQs optionally filtered by language and category
 * @param {string} [language='en']
 * @param {string} [category]
 * @returns {Array<object>}
 */
function getAllFaqs(language = 'en', category = null) {
  const faqs = loadFaqs();
  const lang = language === 'am' ? 'am' : 'en';

  return faqs
    .filter((f) => !category || f.category.toLowerCase() === category.toLowerCase())
    .map((f) => ({
      id: f.id,
      category: f.category,
      courseTitle: f.courseTitle,
      moduleTitle: f.moduleTitle,
      lessonTitle: f.lessonTitle,
      question: lang === 'am' ? f.question_am : f.question_en,
      answer: lang === 'am' ? f.answer_am : f.answer_en,
      keywords: f.keywords || []
    }));
}

module.exports = {
  loadFaqs,
  matchFaq,
  getAllFaqs
};

