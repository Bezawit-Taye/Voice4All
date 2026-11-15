/**
 * Voice4All — Learner Career Client (`assets/js/voice4all/career/career-client.js`)
 *
 * Implements:
 *  - Multilingual job browsing and accessible filtering
 *  - Grounded Career Opportunity Q&A with job citations
 *  - Complete Interview Accommodation Request drafting with copyable self-advocacy letters
 *  - Telegram job alert subscription and test delivery
 *  - SMS 160-character segment preview and feature-phone notification subscription
 */

(function (root, factory) {
  var exp = factory();
  if (typeof module === "object" && module && module.exports) {
    module.exports = exp;
    module.exports.default = exp;
  }
  if (typeof root !== "undefined" && root) {
    root.Voice4AllCareerClient = exp;
  }
  if (typeof globalThis !== "undefined" && globalThis) {
    globalThis.Voice4AllCareerClient = exp;
  }
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof window !== "undefined"
      ? window
      : this,
  function () {
    "use strict";

    async function apiFetch(url, options = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(options.headers || {}),
          },
        });
        clearTimeout(timeout);
        const data = await res.json();
        if (!res.ok) {
          const error = new Error(data.error || `HTTP ${res.status}`);
          error.status = res.status;
          error.data = data;
          throw error;
        }
        return data;
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    }

    const CareerClient = {
      /**
       * Browses and filters sample jobs
       *
       * @param {Object} [filters={}]
       * @param {string} [filters.q] - Keyword
       * @param {string} [filters.type] - 'all' | 'remote' | 'fulltime' | 'parttime'
       * @param {string} [filters.location] - Substring
       * @param {string} [filters.lang='en'] - 'en' | 'am'
       * @param {boolean} [filters.accessible_only]
       * @returns {Promise<Object>}
       */
      async searchJobs(filters = {}) {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (filters.type && filters.type !== "all")
          params.set("type", filters.type);
        if (filters.location) params.set("location", filters.location);
        if (filters.lang) params.set("lang", filters.lang);
        if (filters.accessible_only) params.set("accessible_only", "true");

        const url = `/api/career/jobs${params.toString() ? "?" + params.toString() : ""}`;
        return await apiFetch(url, { method: "GET" });
      },

      /**
       * Retrieves single job details by ID
       */
      async getJobDetails(jobId, lang = "en") {
        return await apiFetch(`/api/career/jobs/${jobId}?lang=${lang}`, {
          method: "GET",
        });
      },

      /**
       * Browses learning and professional development resources
       *
       * @param {Object} [filters={}]
       * @param {string} [filters.category] - 'all' | 'assistive_tech' | 'va_skills' | 'self_advocacy' | 'certifications'
       * @param {string} [filters.q] - Keyword search
       * @param {string} [filters.lang='en'] - 'en' | 'am'
       * @returns {Promise<Object>}
       */
      async getResources(filters = {}) {
        const params = new URLSearchParams();
        if (filters.category && filters.category !== "all")
          params.set("category", filters.category);
        if (filters.q) params.set("q", filters.q);
        if (filters.lang) params.set("lang", filters.lang);

        const url = `/api/career/resources${params.toString() ? "?" + params.toString() : ""}`;
        return await apiFetch(url, { method: "GET" });
      },

      /**
       * Retrieves single learning resource details by ID
       */
      async getResourceDetails(resourceId, lang = "en") {
        return await apiFetch(
          `/api/career/resources/${resourceId}?lang=${lang}`,
          { method: "GET" },
        );
      },

      /**
       * Asks career questions grounded in the job dataset
       *
       * @param {string} question
       * @param {string} [language='en']
       * @returns {Promise<Object>}
       */
      async askCareerQuestion(question, language = "en") {
        if (!question || !question.trim()) {
          throw new Error("Question cannot be empty.");
        }
        return await apiFetch("/api/career/questions", {
          method: "POST",
          body: JSON.stringify({
            question: question.trim(),
            language,
          }),
        });
      },

      /**
       * Drafts an interview accommodation request
       *
       * @param {Object} params
       * @param {string} params.job_id - Target job ID
       * @param {string} [params.job_title]
       * @param {string[]} params.accommodations - List of requested accommodations
       * @param {string} [params.details] - Personal justification / context
       * @param {string} [params.contact_email] - Recruiter or learner contact
       * @param {string} [params.language='en']
       * @returns {Promise<Object>}
       */
      async draftAccommodationRequest({
        job_id,
        job_title = "",
        accommodations = [],
        details = "",
        contact_email = "",
        language = "en",
      }) {
        if (!job_id) {
          throw new Error(
            "job_id is required to prepare an accommodation request draft.",
          );
        }
        if (!accommodations || accommodations.length === 0) {
          throw new Error("Please select at least one accommodation.");
        }

        return await apiFetch("/api/career/accommodation-requests", {
          method: "POST",
          body: JSON.stringify({
            job_id,
            job_title,
            accommodations,
            details,
            contact_email,
            language,
          }),
        });
      },

      /**
       * Formats a complete, copyable self-advocacy letter from a draft
       * For learners to review, customize, or send privately to recruiters.
       */
      formatSelfAdvocacyEmail(draft) {
        if (!draft || !draft.job) return "";
        const accommodationsList = (
          draft.requestedAccommodations ||
          draft.accommodations ||
          []
        )
          .map((a) => `  • ${a}`)
          .join("\n");

        return (
          `Subject: Interview Accommodation Request — ${draft.job.title} (Ref: ${draft.draftId})\n\n` +
          `Dear Hiring Team / Interview Coordinator,\n\n` +
          `I am writing to confirm my upcoming interview for the ${draft.job.title} position at ${draft.job.company}.\n\n` +
          `To ensure I can participate fully and demonstrate my best work, I am requesting the following interview accommodations:\n` +
          `${accommodationsList}\n\n` +
          (draft.details ? `Additional Context:\n${draft.details}\n\n` : "") +
          `Thank you for your commitment to an inclusive hiring process. Please let me know if you need any additional details prior to our conversation.\n\n` +
          `Sincerely,\n` +
          `[Your Name]\n` +
          `[Contact Information / ${draft.contact_email || "Email"}]\n\n` +
          `---\n` +
          `Notice: Prepared using Voice4All Self-Advocacy Tools (Draft ID: ${draft.draftId}).`
        );
      },

      /**
       * Subscribes to Telegram job alerts
       */
      async subscribeTelegram(chatId, username = "Learner", language = "en") {
        return await apiFetch("/api/career/notifications/telegram/subscribe", {
          method: "POST",
          body: JSON.stringify({
            chatId,
            username,
            language,
          }),
        });
      },

      /**
       * Broadcasts a test Telegram job alert
       */
      async testTelegramAlert(jobId, chatId = null) {
        return await apiFetch("/api/career/notifications/telegram/broadcast", {
          method: "POST",
          body: JSON.stringify({
            jobId,
            chatId,
          }),
        });
      },

      /**
       * Checks Telegram bot integration status
       */
      async getTelegramStatus() {
        return await apiFetch("/api/career/notifications/telegram/status", {
          method: "GET",
        });
      },

      /**
       * Previews SMS job alert with 160-char segment calculator
       */
      async previewSMSAlert(jobId, lang = "en") {
        return await apiFetch("/api/career/notifications/sms/preview", {
          method: "POST",
          body: JSON.stringify({ jobId, lang }),
        });
      },

      /**
       * Subscribes a phone number for low-bandwidth SMS job alerts
       */
      async subscribeSMS(phoneNumber, language = "en") {
        return await apiFetch("/api/career/notifications/sms/subscribe", {
          method: "POST",
          body: JSON.stringify({ phoneNumber, language }),
        });
      },

      /**
       * Sends a simulated SMS job alert
       */
      async sendTestSMS(jobId, phoneNumber, lang = "en") {
        return await apiFetch("/api/career/notifications/sms/send", {
          method: "POST",
          body: JSON.stringify({ jobId, phoneNumber, lang }),
        });
      },
    };

    return CareerClient;
  },
);
