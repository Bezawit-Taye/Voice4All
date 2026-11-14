/**
 * Analytics Service (Zero-PII Privacy Preserving)
 * Collects aggregated learning analytics and frequently asked questions for educators.
 * Strictly strips and scrub all personal identifiable information (PII) before storage.
 */

const fs = require('fs');
const path = require('path');

// Regex filters to redact any potential personally identifiable information
const PII_PATTERNS = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },
  { pattern: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[REDACTED_PHONE]' },
  { pattern: /@\w{2,30}\b/g, replacement: '[REDACTED_HANDLE]' },
  { pattern: /\b(?:my name is|i am|i'm|this is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi, replacement: '[REDACTED_NAME]' },
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[REDACTED_IP]' }
];

// In-memory analytics store with capacity cap to prevent memory bloat
const MAX_LOG_ENTRIES = 200;
let analyticsEvents = [];

/**
 * Scrub any personal or identifying details from text
 * @param {string} text
 * @returns {string}
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text.trim();
  for (const { pattern, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

/**
 * Identify general course topic from question text
 * @param {string} question
 * @returns {string}
 */
function categorizeTopic(question) {
  const lower = (question || '').toLowerCase();
  if (lower.includes('future') || lower.includes('industry') || lower.includes('shrinking') || lower.includes('የወደፊት')) {
    return 'Future of VA Industry';
  }
  if (lower.includes('ai') || lower.includes('robot') || lower.includes('tool') || lower.includes('chatgpt') || lower.includes('አርቴፊሻል')) {
    return 'AI Tools & Human Value';
  }
  if (lower.includes('listen') || lower.includes('empath') || lower.includes('feedback') || lower.includes('ንቁ ማዳመጥ')) {
    return 'Active Listening';
  }
  if (lower.includes('bluf') || lower.includes('email') || lower.includes('write') || lower.includes('ጽሁፍ')) {
    return 'BLUF Written Communication';
  }
  if (lower.includes('graduat') || lower.includes('score') || lower.includes('threshold') || lower.includes('pass') || lower.includes('70') || lower.includes('ምረቃ')) {
    return 'Graduation & Pacing';
  }
  if (lower.includes('confidential') || lower.includes('nda') || lower.includes('ethic') || lower.includes('ሚስጥራዊነት')) {
    return 'Ethics & Confidentiality';
  }
  return 'General Inquiry';
}

/**
 * Record an anonymized tutor query event
 * @param {object} params
 * @param {string} params.question
 * @param {string} params.language
 * @param {boolean} params.isGrounded
 * @param {boolean} params.simplified
 * @param {string} params.mode
 * @param {string} [params.courseTitle]
 */
function logTutorQuery({ question, language, isGrounded, simplified, mode, courseTitle }) {
  const cleanQuestion = sanitizeText(question);
  if (!cleanQuestion) return;

  const event = {
    id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toISOString(),
    question: cleanQuestion,
    language: language === 'am' ? 'am' : 'en',
    topic: categorizeTopic(cleanQuestion),
    courseTitle: courseTitle || 'Savanna Curriculum',
    isGrounded: Boolean(isGrounded),
    simplified: Boolean(simplified),
    mode: mode || 'mock_demo'
  };

  analyticsEvents.push(event);

  if (analyticsEvents.length > MAX_LOG_ENTRIES) {
    analyticsEvents.shift();
  }
}

/**
 * Pre-seed realistic curriculum demo queries so teacher view displays immediately
 */
function seedDemoDataIfEmpty() {
  if (analyticsEvents.length > 0) return;

  const seeds = [
    { question: 'What is the future of the VA industry with AI?', language: 'en', isGrounded: true, simplified: false, mode: 'mock_demo' },
    { question: 'ንቁ ማዳመጥ በግንኙነት ውስጥ ምን ጥቅም አለው?', language: 'am', isGrounded: true, simplified: false, mode: 'mock_demo' },
    { question: 'What score is needed to graduate?', language: 'en', isGrounded: true, simplified: true, mode: 'mock_demo' },
    { question: 'How can AI tools support virtual assistants?', language: 'en', isGrounded: true, simplified: false, mode: 'offline_faq' },
    { question: 'የ BLUF ሞዴል ምንድን ነው?', language: 'am', isGrounded: true, simplified: true, mode: 'mock_demo' },
    { question: 'Where do human VAs add more value than AI?', language: 'en', isGrounded: true, simplified: false, mode: 'mock_demo' },
    { question: 'How do I cook pasta with garlic sauce?', language: 'en', isGrounded: false, simplified: false, mode: 'unsupported_refusal' },
    { question: 'ስለ ኳስ ጨዋታ ደንብ ንገረኝ', language: 'am', isGrounded: false, simplified: false, mode: 'unsupported_refusal' }
  ];

  seeds.forEach(s => logTutorQuery(s));
}

seedDemoDataIfEmpty();

/**
 * Generate anonymous analytics summary for educators
 * @returns {object}
 */
function getAnalyticsSummary() {
  const total = analyticsEvents.length;
  if (total === 0) {
    return {
      totalQuestions: 0,
      groundedCount: 0,
      groundedPercentage: 100,
      unsupportedCount: 0,
      languageDistribution: { en: 0, am: 0 },
      simplifiedModeCount: 0,
      topicDistribution: {},
      curriculumGaps: [],
      recentAnonymousInquiries: []
    };
  }

  let groundedCount = 0;
  let simplifiedCount = 0;
  let enCount = 0;
  let amCount = 0;
  const topicMap = {};
  const gapList = [];

  for (const ev of analyticsEvents) {
    if (ev.isGrounded) groundedCount++;
    else gapList.push(ev.question);

    if (ev.simplified) simplifiedCount++;

    if (ev.language === 'am') amCount++;
    else enCount++;

    topicMap[ev.topic] = (topicMap[ev.topic] || 0) + 1;
  }

  // Calculate top topics sorted by count
  const sortedTopics = Object.entries(topicMap)
    .map(([topic, count]) => ({
      topic,
      count,
      percentage: Math.round((count / total) * 100)
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalQuestions: total,
    groundedCount,
    groundedPercentage: Math.round((groundedCount / total) * 100),
    unsupportedCount: total - groundedCount,
    languageDistribution: {
      en: enCount,
      am: amCount,
      enPercentage: Math.round((enCount / total) * 100),
      amPercentage: Math.round((amCount / total) * 100)
    },
    simplifiedModeCount: simplifiedCount,
    simplifiedPercentage: Math.round((simplifiedCount / total) * 100),
    topicDistribution: sortedTopics,
    curriculumGaps: Array.from(new Set(gapList)).slice(0, 10),
    recentAnonymousInquiries: analyticsEvents.slice(-20).reverse()
  };
}

/**
 * Get frequently asked questions clustered by similarity
 * @returns {Array<object>}
 */
function getFrequentlyAskedQuestions() {
  const frequencyMap = {};

  for (const ev of analyticsEvents) {
    const key = ev.topic + '::' + ev.language;
    if (!frequencyMap[key]) {
      frequencyMap[key] = {
        topic: ev.topic,
        language: ev.language,
        sampleQuestion: ev.question,
        count: 0,
        isGrounded: ev.isGrounded
      };
    }
    frequencyMap[key].count++;
  }

  return Object.values(frequencyMap).sort((a, b) => b.count - a.count);
}

/**
 * Reset analytics log (for testing)
 */
function resetAnalytics() {
  analyticsEvents = [];
}

module.exports = {
  sanitizeText,
  logTutorQuery,
  getAnalyticsSummary,
  getFrequentlyAskedQuestions,
  resetAnalytics
};

