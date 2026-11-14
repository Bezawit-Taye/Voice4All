/**
 * Teacher Analytics Routes (Zero-PII)
 * Exposes anonymous curriculum insights and frequently asked questions for educators.
 */

const express = require('express');
const router = express.Router();
const {
  getAnalyticsSummary,
  getFrequentlyAskedQuestions,
  resetAnalytics
} = require('../services/analytics.service');

/**
 * GET /api/analytics/summary
 * Returns anonymous aggregate metrics for the teacher dashboard.
 */
router.get('/summary', (req, res, next) => {
  try {
    const summary = getAnalyticsSummary();
    res.status(200).json({
      status: 'success',
      privacyStandard: 'Zero-PII: No personal names, emails, IPs, or learner IDs are recorded.',
      data: summary
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/faqs
 * Returns frequently asked questions grouped by course topic.
 */
router.get('/faqs', (req, res, next) => {
  try {
    const faqs = getFrequentlyAskedQuestions();
    res.status(200).json({
      status: 'success',
      count: faqs.length,
      data: faqs
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/analytics/reset
 * Testing endpoint to reset analytics log.
 */
router.post('/reset', (req, res, next) => {
  try {
    resetAnalytics();
    res.status(200).json({ status: 'success', message: 'Analytics reset successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

