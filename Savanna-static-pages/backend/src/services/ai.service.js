/**
 * AI Service & Provider Interface
 * Supports pluggable AI backends:
 * - MockDemoProvider (deterministic, grounded in course content, tested)
 * - OfflineFAQProvider (fast exact Q&A lookup from course knowledge base)
 * - CloudAIProvider (interface for OpenAI / Gemini / Claude cloud models)
 * - LocalAIProvider (interface for local Ollama / llama.cpp servers)
 *
 * Clearly distinguishes demo modes ('mock_demo', 'offline_faq') from tested live AI ('cloud_ai', 'local_ai').
 */

const { findFaqMatch, retrieveSources } = require('./retrieval.service');

/**
 * Base AI Provider Interface
 */
class BaseAIProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Generates answer based on query, language, context, and retrieved sources
   * @param {object} params
   * @param {string} params.question
   * @param {string} params.language 'en' | 'am'
   * @param {object} [params.context]
   * @param {Array<object>} params.sources
   * @returns {Promise<{ answer: string, language: string, sources: Array<object>, mode: string }>}
   */
  async generateAnswer({ question, language, context, sources }) {
    throw new Error('generateAnswer() must be implemented by provider');
  }
}

/**
 * Offline FAQ Provider
 * Returns fast, pre-authored answers directly from course-content.json
 */
class OfflineFAQProvider extends BaseAIProvider {
  constructor() {
    super('offline_faq');
  }

  async generateAnswer({ question, language, context, sources }) {
    const faqMatch = findFaqMatch(question, language);

    if (faqMatch) {
      return {
        answer: faqMatch.answer,
        language,
        sources: [faqMatch.source],
        mode: 'offline_faq'
      };
    }

    // Fall back to MockDemoProvider if no exact FAQ matches
    const fallbackProvider = new MockDemoProvider();
    const fallbackResponse = await fallbackProvider.generateAnswer({
      question,
      language,
      context,
      sources
    });

    return fallbackResponse;
  }
}

/**
 * Mock Demo Provider
 * Grounded educational responses based strictly on retrieved course content
 */
class MockDemoProvider extends BaseAIProvider {
  constructor() {
    super('mock_demo');
  }

  async generateAnswer({ question, language, context, sources }) {
    const primarySource = sources[0] || {
      courseTitle: 'Savanna Learning Curriculum',
      moduleTitle: 'General Knowledge',
      lessonTitle: 'Core Concepts',
      snippet: 'Please consult your course syllabus for specific guidance on this topic.'
    };

    let answer = '';

    if (language === 'am') {
      // Natural Amharic educational response synthesizing factual source
      answer = `ሰላም! ለጥያቄዎ ("${question}") በተመለከተ በ${primarySource.courseTitle} ውስጥ በ${primarySource.lessonTitle} ላይ የተጠቀሰው ዋና ነጥብ የሚከተለው ነው:\n\n` +
        `"${primarySource.snippet}"\n\n` +
        `የጥናት ማሳሰቢያ: ይህንን ፅንሰ-ሀሳብ በሚገባ ለመረዳት በትምህርቱ ውስጥ የቀረቡትን ተግባራዊ ልምምዶች እና ምሳሌዎች ይከልሱ። ተጨማሪ እገዛ ከፈለጉ መጠየቅ ይችላሉ!`;
    } else {
      // English educational response synthesizing factual source
      answer = `Hello! Regarding your question ("${question}"), here is the core explanation based on "${primarySource.lessonTitle}" in ${primarySource.courseTitle}:\n\n` +
        `"${primarySource.snippet}"\n\n` +
        `Key Takeaway: Review this section in your course module to apply these principles directly to your learning activities. Let me know if you would like to explore this concept further!`;
    }

    return {
      answer,
      language,
      sources,
      mode: 'mock_demo'
    };
  }
}

/**
 * Cloud AI Provider (Interface for cloud LLMs like OpenAI / Gemini)
 * NOTE: Per policy, we only mark as active if credentials exist and have been tested.
 */
class CloudAIProvider extends BaseAIProvider {
  constructor() {
    super('cloud_ai');
    this.apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
    this.isTestedAndActive = Boolean(this.apiKey && process.env.ENABLE_LIVE_CLOUD_AI === 'true');
  }

  async generateAnswer({ question, language, context, sources }) {
    if (!this.isTestedAndActive) {
      console.warn('[AI Service] Cloud AI selected but live credentials have not been configured or tested. Falling back to grounded mock demo mode.');
      const demoFallback = new MockDemoProvider();
      return demoFallback.generateAnswer({ question, language, context, sources });
    }

    // Live tested cloud implementation would execute here
    // Currently fallback ensures strict policy compliance (do not claim integration works unless tested)
    const demoFallback = new MockDemoProvider();
    return demoFallback.generateAnswer({ question, language, context, sources });
  }
}

/**
 * Local AI Provider (Interface for Ollama or llama.cpp)
 */
class LocalAIProvider extends BaseAIProvider {
  constructor() {
    super('local_ai');
    this.endpoint = process.env.LOCAL_MODEL_URL || 'http://localhost:11434';
    this.isTestedAndActive = Boolean(process.env.ENABLE_LOCAL_AI === 'true');
  }

  async generateAnswer({ question, language, context, sources }) {
    if (!this.isTestedAndActive) {
      console.warn('[AI Service] Local AI selected but local model endpoint is not enabled/tested. Falling back to grounded mock demo mode.');
      const demoFallback = new MockDemoProvider();
      return demoFallback.generateAnswer({ question, language, context, sources });
    }

    const demoFallback = new MockDemoProvider();
    return demoFallback.generateAnswer({ question, language, context, sources });
  }
}

/**
 * Detect language based on query script if not explicitly provided
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
 * @param {object} [params.context]
 * @returns {Promise<{ answer: string, language: string, sources: Array<object>, mode: string }>}
 */
async function askTutor({ question, language, context }) {
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    throw new Error('A valid question string is required.');
  }

  const resolvedLang = resolveLanguage(question, language);
  
  // 1. Retrieve relevant sources from course content / context
  const sources = retrieveSources(question, {
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
    context,
    sources
  });

  return {
    answer: response.answer,
    language: response.language || resolvedLang,
    sources: response.sources || sources,
    mode: response.mode || 'mock_demo'
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

