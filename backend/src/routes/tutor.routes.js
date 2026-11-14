/**
 * Tutor Routes (Phase 2 Enhanced)
 * Handles /api/tutor/ask endpoints with simple-language mode, grounded sources, and refusal handling.
 */

const express = require('express');
const router = express.Router();
const { askTutor } = require('../services/ai.service');

/**
 * POST /api/tutor/ask
 * Body payload:
 * {
 *   "question": "string (required)",
 *   "language": "en | am (optional)",
 *   "simplify": boolean (optional - default false),
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
 *   "mode": "mock_demo | offline_faq | cloud_ai | local_ai | unsupported_refusal",
 *   "isGrounded": boolean,
 *   "simplified": boolean
 * }
 */
router.post('/ask', async (req, res, next) => {
  try {
    const { question, language, context, simplify } = req.body;

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
        courseTitle: context.courseTitle || context.course_title || '',
        moduleTitle: context.moduleTitle || context.module_title || '',
        lessonTitle: context.lessonTitle || context.lesson_title || '',
        lessonText: context.lessonText || context.lesson_text || ''
      };
    }

    const shouldSimplify = Boolean(simplify || req.body.simplified || req.query.simplify === 'true');

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

module.exports = router;
