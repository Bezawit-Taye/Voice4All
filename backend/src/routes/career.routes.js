/**
 * Voice4All — Career Routes (Phase 2)
 * 
 * Endpoints:
 * - GET  /api/career/jobs                           (Browse & filter sample jobs)
 * - GET  /api/career/jobs/:id                       (View individual job)
 * - POST /api/career/questions                      (Career guidance Q&A about opportunities)
 * - POST /api/career/accommodation-requests         (Draft interview or workplace accommodation request)
 * - GET  /api/career/accommodation-requests/:id     (Retrieve saved draft)
 * - GET  /api/career/accommodation-requests         (List all drafts)
 * - POST /api/career/notifications/telegram/subscribe (Telegram job alert subscription)
 * - POST /api/career/notifications/telegram/broadcast (Telegram job broadcast)
 * - GET  /api/career/notifications/telegram/status    (Telegram integration status)
 * - POST /api/career/notifications/sms/preview        (SMS 160-char preview and segment calculator)
 * - POST /api/career/notifications/sms/subscribe      (SMS phone subscription)
 * - POST /api/career/notifications/sms/send           (Simulated low-bandwidth SMS dispatch)
 */

const express = require('express');
const careerService = require('../services/career.service');

const router = express.Router();

/**
 * GET /jobs
 * Retrieves jobs with query filters (q, type, location, lang, accessible_only)
 */
function handleGetJobs(req, res) {
  try {
    const filters = req.query || {};
    const result = careerService.getJobs(filters);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sample jobs.'
    });
  }
}

/**
 * GET /jobs/:id
 */
function handleGetJobById(req, res) {
  const jobId = req.params?.id || (req.url && req.url.split('/').pop());
  const lang = req.query?.lang || req.query?.language || 'en';
  const job = careerService.getJobById(jobId, lang);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: `Sample job not found for ID: ${jobId}`
    });
  }

  res.status(200).json({
    success: true,
    job
  });
}

/**
 * POST /questions
 * Answers learner questions about available job opportunities and accommodations
 */
function handleCareerQuestion(req, res) {
  try {
    const result = careerService.askCareerQuestion(req.body || {});
    res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /accommodation-requests
 * Prepares an interview or workplace accommodation request draft.
 * STRICT HONESTY: Confirms that requests are drafts and have NOT been sent to employers.
 */
function handleCreateAccommodationRequest(req, res) {
  try {
    const payload = req.body || {};
    const draft = careerService.createAccommodationRequest(payload);

    res.status(201).json({
      success: true,
      draftId: draft.draftId,
      request_id: draft.draftId, // Member 1 compatibility
      status: draft.status,
      isDelivered: draft.isDelivered,
      deliveryStatus: draft.deliveryStatus,
      deliveryNotice: draft.deliveryNotice,
      interviewChecklist: draft.interviewChecklist,
      draft: {
        draftId: draft.draftId,
        job: draft.job,
        requestType: draft.requestType,
        requestedAccommodations: draft.requestedAccommodations,
        accommodations: draft.accommodations,
        details: draft.details,
        contact_email: draft.contact_email,
        createdAt: draft.createdAt
      }
    });
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({
      success: false,
      error: err.message,
      field: err.field || null,
      isDelivered: false,
      deliveryNotice: 'DRAFT ONLY: Requests are not transmitted to employers in this simulation.'
    });
  }
}

/**
 * GET /accommodation-requests/:id
 */
function handleGetAccommodationDraft(req, res) {
  const draftId = req.params?.id || (req.url && req.url.split('/').pop());
  const draft = careerService.getAccommodationDraft(draftId);

  if (!draft) {
    return res.status(404).json({
      success: false,
      error: `Accommodation draft not found for ID: ${draftId}`
    });
  }

  res.status(200).json({
    success: true,
    draft
  });
}

/**
 * GET /accommodation-requests
 */
function handleListAccommodationDrafts(req, res) {
  const drafts = careerService.listAccommodationDrafts();
  res.status(200).json({
    success: true,
    total: drafts.length,
    drafts
  });
}

// =========================================================================
// Telegram Notifications Endpoints
// =========================================================================

function handleTelegramSubscribe(req, res) {
  try {
    const result = careerService.subscribeTelegram(req.body || {});
    res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

function handleTelegramBroadcast(req, res) {
  try {
    const { jobId, chatId } = req.body || {};
    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId is required for broadcast.' });
    }
    const result = careerService.broadcastJobTelegram(jobId, chatId);
    res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

function handleTelegramStatus(req, res) {
  res.status(200).json({
    success: true,
    ...careerService.getTelegramStatus()
  });
}

// =========================================================================
// SMS Notification Interface Endpoints
// =========================================================================

function handleSMSPreview(req, res) {
  try {
    const { jobId, lang } = req.body || {};
    const targetId = jobId || req.query?.jobId || 'v4a-job-001';
    const result = careerService.previewJobSMS(targetId, lang || 'en');
    res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

function handleSMSSubscribe(req, res) {
  try {
    const result = careerService.subscribeSMS(req.body || {});
    res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

function handleSMSSend(req, res) {
  try {
    const { jobId, phoneNumber, lang } = req.body || {};
    if (!jobId || !phoneNumber) {
      return res.status(400).json({ success: false, error: 'Both jobId and phoneNumber are required.' });
    }
    const result = careerService.sendJobSMS(jobId, phoneNumber, lang || 'en');
    res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ success: false, error: err.message });
  }
}

// Router bindings (supports direct and prefixed mounts)
router.get(['/', ''], (req, res) => {
  res.status(501).json({
    status: 'pending_member_3',
    message: 'Career route is mounted at /api/career. Implementation attached by Member 3. Use /jobs, /questions, /accommodation-requests.',
    service: 'voice4all-career',
    endpoints: ['/jobs', '/questions', '/accommodation-requests', '/notifications/telegram', '/notifications/sms']
  });
});

router.get('/jobs', handleGetJobs);
router.get('/career/jobs', handleGetJobs);

router.get('/jobs/:id', handleGetJobById);
router.get('/career/jobs/:id', handleGetJobById);

router.post('/questions', handleCareerQuestion);
router.post('/career/questions', handleCareerQuestion);

router.post('/accommodation-requests', handleCreateAccommodationRequest);
router.post('/career/accommodation-requests', handleCreateAccommodationRequest);

router.get('/accommodation-requests/:id', handleGetAccommodationDraft);
router.get('/career/accommodation-requests/:id', handleGetAccommodationDraft);

router.get('/accommodation-requests', handleListAccommodationDrafts);
router.get('/career/accommodation-requests', handleListAccommodationDrafts);

router.post('/notifications/telegram/subscribe', handleTelegramSubscribe);
router.post('/career/notifications/telegram/subscribe', handleTelegramSubscribe);

router.post('/notifications/telegram/broadcast', handleTelegramBroadcast);
router.post('/career/notifications/telegram/broadcast', handleTelegramBroadcast);

router.get('/notifications/telegram/status', handleTelegramStatus);
router.get('/career/notifications/telegram/status', handleTelegramStatus);

router.post('/notifications/sms/preview', handleSMSPreview);
router.post('/career/notifications/sms/preview', handleSMSPreview);

router.post('/notifications/sms/subscribe', handleSMSSubscribe);
router.post('/career/notifications/sms/subscribe', handleSMSSubscribe);

router.post('/notifications/sms/send', handleSMSSend);
router.post('/career/notifications/sms/send', handleSMSSend);

module.exports = router;
module.exports.default = router;
