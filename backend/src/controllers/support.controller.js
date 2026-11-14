/**
 * Voice4All — Human Support Controller (Phase 4)
 * Handles HTTP requests, responses, status codes, and error formatting for Support APIs.
 */

const supportService = require('../services/support.service');

/**
 * POST /api/support/requests
 * Submit a new support request
 */
function createRequest(req, res) {
  try {
    const payload = req.body || {};
    const ticket = supportService.createSupportRequest(payload);

    return res.status(201).json({
      success: true,
      requestId: ticket.requestId,
      request_id: ticket.requestId,
      status: ticket.status,
      humanConnected: ticket.humanConnected,
      screen_share_active: ticket.screen_share_active,
      connectionNotice: ticket.connectionNotice,
      isSimulated: ticket.isSimulated,
      simulationNotice: ticket.simulationNotice,
      estimated_wait_minutes: ticket.estimatedWaitMinutes,
      estimatedWaitMinutes: ticket.estimatedWaitMinutes,
      message: ticket.message,
      created_at: ticket.createdAt,
      ticket
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message,
      field: err.field || null,
      isSimulated: true,
      simulationNotice: 'A local screen-capture preview is not a real human support connection.'
    });
  }
}

/**
 * GET /api/support/requests
 * Retrieve support requests list with privacy protection
 */
function getRequests(req, res) {
  try {
    const filters = req.query || {};
    const userRole = req.user?.role || 'agent';

    // Privacy protection: If learner role, restrict to their learnerId
    if (userRole === 'learner' && !filters.learnerId) {
      filters.learnerId = req.headers['x-learner-id'] || 'Learner-Amara';
    }

    const requests = supportService.getRequests(filters, userRole);

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
      requests
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * GET /api/support/requests/:id
 * Retrieve an individual support request by ID
 */
function getRequestById(req, res) {
  try {
    const requestId = req.params?.id || req.params?.requestId || (req.url && req.url.split('/').pop());
    const ticket = supportService.getSupportRequest(requestId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: `Support request not found for ID: ${requestId}`
      });
    }

    return res.status(200).json({
      success: true,
      requestId: ticket.requestId,
      request_id: ticket.requestId,
      status: ticket.status,
      humanConnected: ticket.humanConnected,
      screen_share_active: ticket.screen_share_active,
      agentName: ticket.agentName,
      connectionNotice: ticket.connectionNotice,
      queuePosition: ticket.queuePosition,
      estimatedWaitMinutes: ticket.estimatedWaitMinutes,
      isSimulated: ticket.isSimulated,
      ticket
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * PATCH /api/support/requests/:id/status
 * Update request status where authorized
 */
function updateStatus(req, res) {
  try {
    const requestId = req.params?.id;
    const { status, agentName, agentId, resolutionNotes, reason } = req.body || {};

    const updated = supportService.updateTicketStatus(requestId, status, {
      agentName,
      agentId,
      resolutionNotes,
      reason
    });

    return res.status(200).json({
      success: true,
      message: `Support ticket status successfully updated to '${status}'.`,
      status: updated.status,
      humanConnected: updated.humanConnected,
      screen_share_active: updated.screen_share_active,
      ticket: updated
    });
  } catch (err) {
    const statusCode = err.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /api/support/requests/:id/assign
 * Support agent connects to ticket
 */
function assignAgent(req, res) {
  try {
    const requestId = req.params?.id;
    const { agentName, agentId } = req.body || {};
    const updated = supportService.assignAgent(requestId, agentName, agentId);

    return res.status(200).json({
      success: true,
      message: `Support agent ${updated.agentName} successfully connected to ticket.`,
      humanConnected: updated.humanConnected,
      screen_share_active: updated.screen_share_active,
      ticket: updated
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /api/support/requests/:id/screen-share/consent
 * Learner grants explicit affirmative consent
 */
function handleScreenShareConsent(req, res) {
  try {
    const requestId = req.params?.id;
    const updated = supportService.handleScreenShareConsent(requestId, req.body);

    return res.status(200).json({
      success: true,
      message: 'Screen sharing consent recorded.',
      screenShareStatus: updated.screenShareStatus,
      screen_share_active: updated.screen_share_active,
      ticket: updated
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /api/support/requests/:id/screen-share/stop and POST /api/support/screen-share/stop
 * CLEAR STOP-SHARING CONTROL
 */
function stopScreenShare(req, res) {
  try {
    const requestId = req.params?.id || req.body?.requestId || req.body?.request_id;
    const stoppedBy = req.body?.stoppedBy || 'learner';

    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: 'A requestId is required to stop screen sharing.'
      });
    }

    const result = supportService.stopScreenShare(requestId, stoppedBy);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /api/support/requests/:id/messages
 * Appends message to thread
 */
function addMessage(req, res) {
  try {
    const requestId = req.params?.id;
    const result = supportService.addMessage(requestId, req.body);
    return res.status(201).json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /api/support/requests/:id/resolve
 * Marks ticket resolved
 */
function resolveRequest(req, res) {
  try {
    const requestId = req.params?.id;
    const { resolutionNotes } = req.body || {};
    const updated = supportService.resolveTicket(requestId, resolutionNotes);

    return res.status(200).json({
      success: true,
      message: 'Ticket has been marked as resolved.',
      ticket: updated
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /api/support/requests/:id/cancel
 * Learner cancels ticket
 */
function cancelRequest(req, res) {
  try {
    const requestId = req.params?.id;
    const { reason } = req.body || {};
    const updated = supportService.cancelTicket(requestId, reason);

    return res.status(200).json({
      success: true,
      message: 'Ticket cancelled successfully.',
      ticket: updated
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * GET /api/support/queue
 * Support-person queue overview
 */
function getQueue(req, res) {
  try {
    const filters = req.query || {};
    const queueData = supportService.getQueue(filters);
    return res.status(200).json({
      success: true,
      ...queueData
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * GET /api/support/faqs
 */
function getFaqs(req, res) {
  try {
    const query = req.query || {};
    const faqs = supportService.getFaqs(query);
    return res.status(200).json({
      success: true,
      total: faqs.length,
      faqs
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

module.exports = {
  createRequest,
  getRequests,
  getRequestById,
  updateStatus,
  assignAgent,
  handleScreenShareConsent,
  stopScreenShare,
  addMessage,
  resolveRequest,
  cancelRequest,
  getQueue,
  getFaqs
};

