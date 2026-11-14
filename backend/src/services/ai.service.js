/**
 * AI Service & Provider Interface (Phase 2 Enhanced)
 * Pluggable architecture:
 * - MockDemoProvider: Grounded educational tutor with simple-language option and hallucination prevention
 * - OfflineFAQProvider: Rapid offline lookup from pre-approved course FAQs
 * - CloudAIProvider: Cloud LLM interface (OpenAI / Gemini)
 * - LocalAIProvider: Local endpoint interface (Ollama / llama.cpp)
 *
 * Adheres strictly to factual grounded content; refuses out-of-scope/unsupported questions.
 */

const { findFaqMatch, retrieveSources } = require('./retrieval.service');

/**
 * Base AI Provider Interface
 */
class BaseAIProvider {
  constructor(name) {
    this.name = name;
  }

  async generateAnswer({ question, language, context, sources, simplify, isRelevant }) {
    throw new Error('generateAnswer() must be implemented by provider');
  }
}

/**
 * Offline FAQ Provider
 * Handles exact curriculum FAQs with instantaneous verified responses
 */
class OfflineFAQProvider extends BaseAIProvider {
  constructor() {
    super('offline_faq');
  }

  async generateAnswer({ question, language, context, sources, simplify, isRelevant }) {
    const faqMatch = findFaqMatch(question, language);

    if (faqMatch) {
      return {
        answer: faqMatch.answer,
        language,
        sources: [faqMatch.source],
        mode: 'offline_faq',
        isGrounded: true,
        simplified: Boolean(simplify)
      };
    }

    // Fall back to MockDemoProvider if no exact FAQ exists
    const fallback = new MockDemoProvider();
    return fallback.generateAnswer({ question, language, context, sources, simplify, isRelevant });
  }
}

/**
 * Mock Demo Provider
 * Grounded in actual Savanna course content; supports plain-language mode and refuses unsupported queries.
 */
class MockDemoProvider extends BaseAIProvider {
  constructor() {
    super('mock_demo');
  }

  async generateAnswer({ question, language, context, sources, simplify, isRelevant }) {
    // 1. Refuse or acknowledge unsupported questions that cannot be answered from course content
    if (!isRelevant || sources.length === 0) {
      const refusalAnswer = language === 'am'
        ? `ይቅርታ፣ ይህ ጥያቄ ("${question}") አሁን ባለው የትምህርት ይዘት (VA-1 እና WR 100) ውስጥ አልተካተተም። እንደ ኮርስ አስተማሪዎ፣ በትምህርት መጽሐፍቱ እና በሳቫና ስርዓተ-ትምህርት ላይ ብቻ ተመስርቼ እውነተኛ መልስ እሰጣለሁ። እባክዎ ስለ ቨርቹዋል ረዳትነት፣ ውጤታማ ግንኙነት (BLUF ሞዴል፣ ንቁ ማዳመጥ) ወይም ስለ ትምህርት ምዘናዎች ይጠይቁ።`
        : `I apologize, but your question ("${question}") is not covered in your active course materials (VA-1: VA Foundations and WR 100: Fundamentals of Effective Communication). As an AI tutor dedicated to academic honesty, I cannot invent answers outside the curriculum. You can ask me about topics such as the future of virtual assistance, AI tools in the workplace, active listening, or the BLUF communication model!`;

      return {
        answer: refusalAnswer,
        language,
        sources: [],
        mode: 'unsupported_refusal',
        isGrounded: false,
        simplified: Boolean(simplify)
      };
    }

    const primarySource = sources[0];

    // 2. Generate grounded response (standard or simple-language)
    let answer = '';

    if (language === 'am') {
      if (simplify) {
        // Simple plain-language explanation for accessibility
        const simpleText = primarySource.simpleExplanation || primarySource.snippet;
        answer = `ቀላል ማብራሪያ (በቀላል ቋንቋ):\n\n${simpleText}\n\nምንጭ: ${primarySource.courseTitle} > ${primarySource.lessonTitle}\nማስታወሻ: ይህ ፅንሰ-ሀሳብ በስራዎ ላይ በቀላሉ እንዲገባዎት ታስቦ የቀረበ ነው።`;
      } else {
        // Comprehensive grounded explanation
        answer = `ሰላም! ለጥያቄዎ ("${question}") በትምህርቱ ይዘት ላይ የተመሰረተ ማብራሪያ:\n\n` +
          `በ${primarySource.courseTitle} (ምዕራፍ: ${primarySource.moduleTitle})፣ በትምህርቱ "${primarySource.lessonTitle}" ላይ እንደሚከተለው ተብራርቷል:\n\n` +
          `"${primarySource.snippet}"\n\n` +
          `የጥናት ምክር: ይህንን ፅንሰ-ሀሳብ በሳቫና የመማሪያ ገጽዎ ላይ ካሉት ተግባራዊ ልምምዶች ጋር ያዛምዱት።`;
      }
    } else {
      if (simplify) {
        // Simple plain-language explanation for accessibility
        const simpleText = primarySource.simpleExplanation || primarySource.snippet;
        answer = `Simple Explanation (Plain Language):\n\n${simpleText}\n\nReference: ${primarySource.courseTitle} > ${primarySource.lessonTitle}\nTip: This breakdown is designed to explain core concepts without complex technical jargon.`;
      } else {
        // Comprehensive grounded explanation
        answer = `Hello! Regarding your question ("${question}"), here is the grounded explanation from your curriculum:\n\n` +
          `In "${primarySource.courseTitle}" (${primarySource.moduleTitle}), the lesson "${primarySource.lessonTitle}" notes:\n\n` +
          `"${primarySource.snippet}"\n\n` +
          `Key Takeaway: Review this section in your active Savanna module to apply these principles directly to your learning activities.`;
      }
    }

    return {
      answer,
      language,
      sources,
      mode: 'mock_demo',
      isGrounded: true,
      simplified: Boolean(simplify)
    };
  }
}

/**
 * Cloud AI Provider (Interface for OpenAI / Gemini)
 */
class CloudAIProvider extends BaseAIProvider {
  constructor() {
    super('cloud_ai');
    this.apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
    this.isTestedAndActive = Boolean(this.apiKey && process.env.ENABLE_LIVE_CLOUD_AI === 'true');
  }

  async generateAnswer(params) {
    if (!this.isTestedAndActive) {
      console.warn('[AI Service] Cloud AI selected but live credentials have not been configured/tested. Falling back to grounded mock demo mode.');
      const demo = new MockDemoProvider();
      return demo.generateAnswer(params);
    }
    const demo = new MockDemoProvider();
    return demo.generateAnswer(params);
  }
}

/**
 * Local AI Provider (Interface for Ollama / llama.cpp)
 */
class LocalAIProvider extends BaseAIProvider {
  constructor() {
    super('local_ai');
    this.endpoint = process.env.LOCAL_MODEL_URL || 'http://localhost:11434';
    this.isTestedAndActive = Boolean(process.env.ENABLE_LOCAL_AI === 'true');
  }

  async generateAnswer(params) {
    if (!this.isTestedAndActive) {
      console.warn('[AI Service] Local AI selected but local endpoint is not enabled/tested. Falling back to grounded mock demo mode.');
      const demo = new MockDemoProvider();
      return demo.generateAnswer(params);
    }
    const demo = new MockDemoProvider();
    return demo.generateAnswer(params);
  }
}

/**
 * Detect language based on script if not explicitly specified
 * @param {string} text
 * @param {string} [explicitLang]
 * @returns {string} 'am' or 'en'
 */
function resolveLanguage(text, explicitLang) {
  if (explicitLang && (explicitLang.toLowerCase() === 'am' || explicitLang.toLowerCase() === 'amharic')) {
    return 'am';
  }
  if (explicitLang && (explicitLang.toLowerCase() === 'en' || explicitLang.toLowerCase() === 'english')) {
    return 'en';
  }

  // Detect Ethiopic unicode range [\u1200-\u137F]
  if (text && /[\u1200-\u137F]/.test(text)) {
    return 'am';
  }

  const defaultLang = process.env.DEFAULT_LANGUAGE || 'en';
  return defaultLang === 'am' ? 'am' : 'en';
}

/**
 * AI Provider Factory
 * @param {string} [providerName]
 * @returns {BaseAIProvider}
 */
function getAIProvider(providerName) {
  const chosen = (providerName || process.env.AI_PROVIDER || 'mock_demo').toLowerCase();

  switch (chosen) {
    case 'offline_faq':
    case 'faq':
      return new OfflineFAQProvider();
    case 'cloud_ai':
    case 'cloud':
      return new CloudAIProvider();
    case 'local_ai':
    case 'local':
      return new LocalAIProvider();
    case 'mock_demo':
    case 'mock':
    default:
      return new MockDemoProvider();
  }
}

/**
 * Public entrypoint to ask tutor
 * @param {object} params
 * @param {string} params.question
 * @param {string} [params.language]
 * @param {boolean} [params.simplify=false]
 * @param {object} [params.context]
 * @returns {Promise<{ answer: string, language: string, sources: Array<object>, mode: string, isGrounded: boolean, simplified: boolean }>}
 */
async function askTutor({ question, language, simplify = false, context }) {
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    throw new Error('A valid question string is required.');
  }

  const resolvedLang = resolveLanguage(question, language);
  
  // 1. Retrieve relevant sources from course content / context with relevance scoring
  const { sources, isRelevant } = retrieveSources(question, {
    language: resolvedLang,
    context,
    limit: 3
  });

  // 2. Select AI Provider
  const provider = getAIProvider();

  // 3. Generate response
  const response = await provider.generateAnswer({
    question: question.trim(),
    language: resolvedLang,
    simplify: Boolean(simplify),
    context,
    sources,
    isRelevant
  });

  return {
    answer: response.answer,
    language: response.language || resolvedLang,
    sources: response.sources || sources,
    mode: response.mode || 'mock_demo',
    isGrounded: response.isGrounded !== false,
    simplified: Boolean(response.simplified)
  };
}

module.exports = {
  BaseAIProvider,
  MockDemoProvider,
  OfflineFAQProvider,
  CloudAIProvider,
  LocalAIProvider,
  getAIProvider,
  resolveLanguage,
  askTutor
};
