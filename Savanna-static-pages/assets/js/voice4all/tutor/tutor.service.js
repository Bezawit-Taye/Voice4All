/**
 * Voice4All Tutor Client Service
 * Handles API communication with the Voice4All Backend Tutor endpoints.
 * Never stores or transmits private API keys from the frontend.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Voice4AllTutorService = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class TutorService {
    constructor(apiBaseUrl = 'http://localhost:5000') {
      this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
    }

    setApiBaseUrl(url) {
      this.apiBaseUrl = url.replace(/\/+$/, '');
    }

    /**
     * Ask a question to the backend AI Tutor
     * @param {object} params
     * @param {string} params.question
     * @param {string} [params.language='en'] 'en' | 'am'
     * @param {boolean} [params.simplify=false]
     * @param {object} [params.context] { courseTitle, moduleTitle, lessonTitle, lessonText }
     * @returns {Promise<{ answer: string, language: string, sources: Array<object>, mode: string, isGrounded: boolean, simplified: boolean }>}
     */
    async ask({ question, language = 'en', simplify = false, context = null }) {
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        throw new Error('Please provide a valid question.');
      }

      const endpoint = `${this.apiBaseUrl}/api/tutor/ask`;

      const payload = {
        question: question.trim(),
        language: language === 'am' ? 'am' : 'en',
        simplify: Boolean(simplify),
        context
      };

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `Server responded with status ${response.status}`);
        }

        return await response.json();
      } catch (err) {
        console.error('[Voice4All TutorService] Error querying tutor:', err);
        // If backend server is unreachable, provide a clear offline notification
        return {
          answer: language === 'am'
            ? 'ይቅርታ፣ ከአስተማሪው አገልጋይ ጋር መገናኘት አልተቻለም። እባክዎ የበስተጀርባ አገልጋዩ (Backend) በ http://localhost:5000 ላይ መስራቱን ያረጋግጡ።'
            : 'Unable to connect to the Voice4All tutor service. Please ensure the backend server is running on http://localhost:5000.',
          language,
          sources: [],
          mode: 'connection_error',
          isGrounded: false,
          simplified: Boolean(simplify)
        };
      }
    }
  }

  return new TutorService();
});

