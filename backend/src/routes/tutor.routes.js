/**
 * Tutor Routes (Phase 2 Enhanced)
 * Handles /api/tutor/ask endpoints with simple-language mode, grounded sources, and refusal handling.
 */

const express = require('express');
const router = express.Router();
const { askTutor } = require('../services/ai.service');
const { synthesizeSpeech } = require('../services/tts.service');

/**
 * POST /api/tutor/ask
 * Body payload:
 * {
 *   "question": "string (required; legacy clients may send message)",
 *   "language": "en | am (optional)",
 *   "simplify": boolean (optional; simple_mode and simplified are also accepted),
 *   "context": {
 *     "courseTitle": "string",
 *     "moduleTitle": "string",
 *     "lessonTitle": "string",
 *     "lessonText": "string"
 *   } (optional)
 * }
 * Response:
 * {
 *   "answer": "string",
 *   "language": "en | am",
 *   "sources": [ { "courseTitle", "moduleTitle", "lessonTitle", "snippet", "score" } ],
 *   "mode": "mock_demo | offline_faq | gemini | local_ai | unsupported_refusal",
 *   "isGrounded": boolean,
 *   "simplified": boolean
 * }
 */
router.post('/ask', async (req, res, next) => {
  try {
    const body = req.body || {};
    const question = body.question || body.message;
    const language = body.language;
    const context = body.context;
    const simplify = body.simplify || body.simple_mode || body.simplified;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation failed: "question" is required and must be a non-empty string.',
        received: { question, language }
      });
    }

    // Normalize context object if provided with snake_case or camelCase
    let normalizedContext = null;
    if (context && typeof context === 'object') {
      normalizedContext = {
        courseTitle: context.courseTitle || context.course_title || context.course || '',
        moduleTitle: context.moduleTitle || context.module_title || context.module || '',
        lessonTitle: context.lessonTitle || context.lesson_title || context.lesson || '',
        lessonText: context.lessonText || context.lesson_text || ''
      };
    }

    const shouldSimplify = Boolean(simplify || req.query.simplify === 'true');

    const result = await askTutor({
      question: question.trim(),
      language,
      simplify: shouldSimplify,
      context: normalizedContext
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/speech', async (req, res, next) => {
  try {
    const { text, language = 'am' } = req.body || {};
    if (typeof text !== 'string' || !text.trim() || text.length > 2000) {
      return res.status(400).json({
        error: 'text is required and must be no more than 2000 characters.'
      });
    }
    if (language !== 'am' && language !== 'en') {
      return res.status(400).json({ error: 'language must be "am" or "en".' });
    }

    const audio = await synthesizeSpeech({ text: text.trim(), language });
    res.set('Cache-Control', 'no-store');
    res.type('audio/wav').send(audio);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
