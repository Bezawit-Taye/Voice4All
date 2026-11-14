/**
 * Voice4All — Support Routes (Phase 2)
 * 
 * Endpoints:
 * - POST /api/support/requests                     (Learner creates support ticket)
 * - GET  /api/support/requests/:id                 (Track ticket status and queue position)
 * - GET  /api/support/queue                        (Support-person queue overview)
 * - GET  /api/support/requests                     (List all requests)
 * - POST /api/support/requests/:id/assign          (Support person connects to ticket)
 * - POST /api/support/requests/:id/resolve         (Mark ticket resolved)
 * - POST /api/support/requests/:id/cancel          (Learner cancels request)
 * - POST /api/support/requests/:id/messages        (Send message in ticket thread)
 * - POST /api/support/requests/:id/screen-share/consent (Learner grants screen share consent)
 * - POST /api/support/requests/:id/screen-share/stop    (Clear STOP-SHARING control)
 * - POST /api/support/screen-share/stop                 (Global stop sharing endpoint)
 * - GET  /api/support/faqs                         (FAQs)
 * - GET  /api/support/dashboard                    (Interactive Support-Person Portal)
 */

const express = require('express');
const supportService = require('../services/support.service');

const router = express.Router();

/**
 * POST /requests (also mounted as /support/requests)
 * Learner initiates a support request.
 */
function handleCreateSupportRequest(req, res) {
  try {
    const payload = req.body || {};
    const ticket = supportService.createSupportRequest(payload);

    res.status(201).json({
      success: true,
      requestId: ticket.requestId,
      request_id: ticket.requestId, // Member 1 compatibility
      status: ticket.status,
      // Honest reporting:
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
    res.status(status).json({
      success: false,
      error: err.message,
      field: err.field || null,
      isSimulated: true,
      simulationNotice: 'A local screen-capture preview is not a real human support connection.'
    });
  }
}

/**
 * GET /requests/:id (and /support/requests/:id)
 * Fetches status of an existing ticket.
 */
function handleGetSupportRequest(req, res) {
  const requestId = req.params?.id || req.params?.requestId || (req.url && req.url.split('/').pop());
  const ticket = supportService.getSupportRequest(requestId);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: `Support request not found for ID: ${requestId}`
    });
  }

  res.status(200).json({
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
}

/**
 * GET /queue (and /requests)
 * Support-person interface endpoint for viewing the full queue
 */
function handleGetQueue(req, res) {
  const filters = req.query || {};
  const queueData = supportService.getQueue(filters);
  res.status(200).json({
    success: true,
    ...queueData
  });
}

/**
 * POST /requests/:id/assign
 * Support agent connects to a ticket. Sets humanConnected = true.
 */
function handleAssignAgent(req, res) {
  try {
    const requestId = req.params?.id;
    const { agentName, agentId } = req.body || {};
    const updated = supportService.assignAgent(requestId, agentName, agentId);

    res.status(200).json({
      success: true,
      message: `Support agent ${updated.agentName} successfully connected to ticket.`,
      humanConnected: updated.humanConnected,
      screen_share_active: updated.screen_share_active,
      ticket: updated
    });
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /requests/:id/screen-share/consent
 * Learner grants explicit screen-sharing consent.
 */
function handleScreenShareConsent(req, res) {
  try {
    const requestId = req.params?.id;
    const updated = supportService.handleScreenShareConsent(requestId, req.body);
    res.status(200).json({
      success: true,
      message: 'Screen sharing consent recorded.',
      screenShareStatus: updated.screenShareStatus,
      screen_share_active: updated.screen_share_active,
      ticket: updated
    });
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /requests/:id/screen-share/stop & POST /screen-share/stop
 * CLEAR STOP-SHARING CONTROL
 */
function handleStopScreenShare(req, res) {
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
 * POST /requests/:id/messages
 * Sends message between learner and support person
 */
function handleAddMessage(req, res) {
  try {
    const requestId = req.params?.id;
    const result = supportService.addMessage(requestId, req.body);
    res.status(201).json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /requests/:id/resolve
 * Marks ticket resolved
 */
function handleResolveTicket(req, res) {
  try {
    const requestId = req.params?.id;
    const { resolutionNotes } = req.body || {};
    const updated = supportService.resolveTicket(requestId, resolutionNotes);
    res.status(200).json({
      success: true,
      message: 'Ticket has been marked as resolved.',
      ticket: updated
    });
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /requests/:id/cancel
 * Learner cancels request
 */
function handleCancelTicket(req, res) {
  try {
    const requestId = req.params?.id;
    const { reason } = req.body || {};
    const updated = supportService.cancelTicket(requestId, reason);
    res.status(200).json({
      success: true,
      message: 'Ticket cancelled successfully.',
      ticket: updated
    });
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * GET /faqs
 */
function handleGetFaqs(req, res) {
  const query = req.query || {};
  const faqs = supportService.getFaqs(query);
  res.status(200).json({
    success: true,
    total: faqs.length,
    faqs
  });
}

/**
 * GET /dashboard
 * Serves the accessible Support-Person Portal (HTML UI)
 */
function handleGetDashboard(req, res) {
  const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Voice4All — Support Person Queue Portal</title>
  <link rel="stylesheet" href="/assets/css/app.css" media="all">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 24px; }
    .header { background: #0f172a; color: #fff; padding: 18px 24px; border-radius: 8px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .badge-simulated { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-high { background: #fee2e2; color: #991b1b; }
    .badge-normal { background: #e0f2fe; color: #075985; }
    .badge-connected { background: #dcfce7; color: #166534; }
    .card { background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .btn { cursor: pointer; padding: 8px 16px; border-radius: 6px; font-weight: 600; border: none; font-size: 14px; }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-danger { background: #dc2626; color: #fff; }
    .btn-success { background: #16a34a; color: #fff; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .stats-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #fff; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; text-align: center; }
    .stat-num { font-size: 28px; font-weight: 700; color: #0f172a; }
    .stat-label { font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin: 0; font-size: 22px;">Voice4All Support-Person Workspace</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">Learner Queue Triage, Consented Screen Sharing & Honest Connectivity Portal</p>
    </div>
    <div>
      <span class="badge badge-simulated">SIMULATED WORKSPACE</span>
    </div>
  </div>

  <div id="stats" class="stats-bar">
    <div class="stat-card"><div id="stat-queued" class="stat-num">0</div><div class="stat-label">Waiting in Queue</div></div>
    <div class="stat-card"><div id="stat-connected" class="stat-num">0</div><div class="stat-label">Human Connected</div></div>
    <div class="stat-card"><div id="stat-screen" class="stat-num">0</div><div class="stat-label">Screen Share Sessions</div></div>
    <div class="stat-card"><div id="stat-resolved" class="stat-num">0</div><div class="stat-label">Resolved Today</div></div>
  </div>

  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
    <h2 style="margin: 0; font-size: 18px;">Active Learner Support Queue</h2>
    <button class="btn btn-primary" onclick="loadQueue()">Refresh Queue</button>
  </div>

  <div id="queue-container">
    <p>Loading active tickets...</p>
  </div>

  <script>
    async function loadQueue() {
      try {
        const res = await fetch('/api/support/queue');
        const data = await res.json();
        
        document.getElementById('stat-queued').innerText = data.stats.queued;
        document.getElementById('stat-connected').innerText = data.stats.agentConnected;
        document.getElementById('stat-screen').innerText = data.stats.screenShareActive;
        document.getElementById('stat-resolved').innerText = data.stats.resolved;

        const container = document.getElementById('queue-container');
        if (data.queue.length === 0) {
          container.innerHTML = '<div class="card"><p style="margin: 0; color: #64748b;">No active support tickets in queue. Great job!</p></div>';
          return;
        }

        container.innerHTML = data.queue.map(t => {
          const isConnected = t.humanConnected;
          const isScreenActive = t.screen_share_active;
          return \`
            <div class="card" id="ticket-\${t.requestId}">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
                <div>
                  <strong style="font-size: 16px;">\${t.requestId}</strong> — \${t.topic}
                  <span class="badge \${t.urgency === 'high' ? 'badge-high' : 'badge-normal'}" style="margin-left: 8px;">\${t.urgency.toUpperCase()}</span>
                  <span class="badge" style="background: #f1f5f9; color: #475569; margin-left: 4px;">\${t.preferred_mode}</span>
                </div>
                <div>
                  <span class="badge \${isConnected ? 'badge-connected' : 'badge-normal'}">\${isConnected ? 'HUMAN CONNECTED' : 'IN QUEUE (NO HUMAN)'}</span>
                </div>
              </div>
              <p style="margin: 8px 0; font-size: 15px;"><strong>Learner (\${t.learnerId}):</strong> "\${t.message}"</p>
              <div style="background: #f8fafc; padding: 10px; border-radius: 6px; font-size: 13px; color: #475569; margin: 10px 0;">
                <div><strong>Course:</strong> \${t.context.courseTitle} | <strong>Module:</strong> \${t.context.moduleTitle}</div>
                <div><strong>Lesson:</strong> \${t.context.lessonTitle}</div>
                <div style="margin-top: 4px;">
                  <strong>Screen Share Consent:</strong> \${t.consent?.screenShareConsent ? '✅ Explicitly Granted by Learner' : '❌ Not Consented'}
                  | <strong>Screen Share State:</strong> \${t.screenShareStatus}
                </div>
              </div>
              <div style="display: flex; gap: 10px; margin-top: 14px;">
                \${!isConnected ? \`<button class="btn btn-primary" onclick="claimTicket('\${t.requestId}')">Claim & Connect Live</button>\` : ''}
                \${isScreenActive ? \`<button class="btn btn-danger" onclick="stopScreenShare('\${t.requestId}')">Stop Screen Share</button>\` : ''}
                \${isConnected ? \`<button class="btn btn-success" onclick="resolveTicket('\${t.requestId}')">Mark Resolved</button>\` : ''}
              </div>
            </div>
          \`;
        }).join('');
      } catch (err) {
        document.getElementById('queue-container').innerHTML = '<p style="color: red;">Error loading queue: ' + err.message + '</p>';
      }
    }

    async function claimTicket(id) {
      await fetch('/api/support/requests/' + id + '/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: 'Mentor Grace (Support Specialist)', agentId: 'agent-grace' })
      });
      loadQueue();
    }

    async function stopScreenShare(id) {
      await fetch('/api/support/requests/' + id + '/screen-share/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stoppedBy: 'agent' })
      });
      alert('Screen sharing session terminated.');
      loadQueue();
    }

    async function resolveTicket(id) {
      const notes = prompt('Enter resolution notes:', 'Assisted learner with lesson concept clarification.');
      if (notes) {
        await fetch('/api/support/requests/' + id + '/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolutionNotes: notes })
        });
        loadQueue();
      }
    }

    loadQueue();
    setInterval(loadQueue, 5000);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(dashboardHtml);
}

// Router bindings (supports both direct and prefixed mounting)
router.get(['/', ''], (req, res) => {
  res.status(501).json({
    status: 'pending_member_3',
    message: 'Support route is mounted at /api/support. Implementation attached by Member 3. Use /requests, /queue, or /dashboard.',
    service: 'voice4all-support',
    endpoints: ['/requests', '/queue', '/dashboard', '/faqs']
  });
});

router.post('/requests', handleCreateSupportRequest);
router.post('/support/requests', handleCreateSupportRequest);

router.get('/requests', handleGetQueue);
router.get('/support/requests', handleGetQueue);

router.get('/queue', handleGetQueue);
router.get('/support/queue', handleGetQueue);

router.get('/requests/:id', handleGetSupportRequest);
router.get('/support/requests/:id', handleGetSupportRequest);

router.post('/requests/:id/assign', handleAssignAgent);
router.post('/support/requests/:id/assign', handleAssignAgent);

router.post('/requests/:id/screen-share/consent', handleScreenShareConsent);
router.post('/support/requests/:id/screen-share/consent', handleScreenShareConsent);

router.post('/requests/:id/screen-share/stop', handleStopScreenShare);
router.post('/support/requests/:id/screen-share/stop', handleStopScreenShare);
router.post('/screen-share/stop', handleStopScreenShare);
router.post('/support/screen-share/stop', handleStopScreenShare);

router.post('/requests/:id/messages', handleAddMessage);
router.post('/support/requests/:id/messages', handleAddMessage);

router.post('/requests/:id/resolve', handleResolveTicket);
router.post('/support/requests/:id/resolve', handleResolveTicket);

router.post('/requests/:id/cancel', handleCancelTicket);
router.post('/support/requests/:id/cancel', handleCancelTicket);

router.get('/faqs', handleGetFaqs);
router.get('/support/faqs', handleGetFaqs);

router.get('/dashboard', handleGetDashboard);
router.get('/support/dashboard', handleGetDashboard);

module.exports = router;
module.exports.default = router;
