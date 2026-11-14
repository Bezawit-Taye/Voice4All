/**
 * Voice4All — Support Routes (Phase 4)
 * Connected with Controllers & Middleware
 * 
 * Endpoints:
 * - POST   /api/support/requests                     (Learner creates support ticket)
 * - GET    /api/support/requests                     (Retrieve support requests list with privacy filtering)
 * - GET    /api/support/requests/:id                 (Retrieve individual ticket by ID)
 * - PATCH  /api/support/requests/:id/status          (Update ticket status where authorized)
 * - POST   /api/support/requests/:id/assign          (Support person connects to ticket)
 * - POST   /api/support/requests/:id/resolve         (Mark ticket resolved)
 * - POST   /api/support/requests/:id/cancel          (Learner cancels request)
 * - POST   /api/support/requests/:id/messages        (Send message in ticket thread)
 * - POST   /api/support/requests/:id/screen-share/consent (Learner grants screen share consent)
 * - POST   /api/support/requests/:id/screen-share/stop    (Clear STOP-SHARING control)
 * - POST   /api/support/screen-share/stop                 (Global stop sharing endpoint)
 * - GET    /api/support/queue                        (Support-person queue overview)
 * - GET    /api/support/faqs                         (Support FAQs)
 * - GET    /api/support/dashboard                    (Interactive Support-Person Portal)
 */

const express = require('express');
const supportController = require('../controllers/support.controller');
const {
  validateCreateRequest,
  validateStatusUpdate,
  validateMessagePayload,
  authorize
} = require('../middleware/support.middleware');

const router = express.Router();

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

// 1. Submit Support Request
router.post('/requests', validateCreateRequest, supportController.createRequest);
router.post('/support/requests', validateCreateRequest, supportController.createRequest);

// 2. Retrieve Support Requests (List)
router.get('/requests', authorize('any'), supportController.getRequests);
router.get('/support/requests', authorize('any'), supportController.getRequests);

// 3. Support Queue Overview
router.get('/queue', authorize('any'), supportController.getQueue);
router.get('/support/queue', authorize('any'), supportController.getQueue);

// 4. Retrieve Individual Support Request by ID
router.get('/requests/:id', supportController.getRequestById);
router.get('/support/requests/:id', supportController.getRequestById);

// 5. Update Request Status (Requires agent/admin authorization)
router.patch('/requests/:id/status', authorize(['agent', 'admin']), validateStatusUpdate, supportController.updateStatus);
router.patch('/support/requests/:id/status', authorize(['agent', 'admin']), validateStatusUpdate, supportController.updateStatus);
router.put('/requests/:id/status', authorize(['agent', 'admin']), validateStatusUpdate, supportController.updateStatus);
router.put('/support/requests/:id/status', authorize(['agent', 'admin']), validateStatusUpdate, supportController.updateStatus);

// 6. Connect / Assign Agent (Requires agent/admin authorization)
router.post('/requests/:id/assign', authorize(['agent', 'admin']), supportController.assignAgent);
router.post('/support/requests/:id/assign', authorize(['agent', 'admin']), supportController.assignAgent);

// 7. Screen Sharing Consent & Clear Stop-Sharing Control
router.post('/requests/:id/screen-share/consent', supportController.handleScreenShareConsent);
router.post('/support/requests/:id/screen-share/consent', supportController.handleScreenShareConsent);

router.post('/requests/:id/screen-share/stop', supportController.stopScreenShare);
router.post('/support/requests/:id/screen-share/stop', supportController.stopScreenShare);
router.post('/screen-share/stop', supportController.stopScreenShare);
router.post('/support/screen-share/stop', supportController.stopScreenShare);

// 8. Thread Messages
router.post('/requests/:id/messages', validateMessagePayload, supportController.addMessage);
router.post('/support/requests/:id/messages', validateMessagePayload, supportController.addMessage);

// 9. Resolve Request
router.post('/requests/:id/resolve', authorize(['agent', 'admin']), supportController.resolveRequest);
router.post('/support/requests/:id/resolve', authorize(['agent', 'admin']), supportController.resolveRequest);

// 10. Cancel Request (Learner or Agent)
router.post('/requests/:id/cancel', supportController.cancelRequest);
router.post('/support/requests/:id/cancel', supportController.cancelRequest);

// 11. Support FAQs
router.get('/faqs', supportController.getFaqs);
router.get('/support/faqs', supportController.getFaqs);

// 12. Support Person Portal Dashboard
router.get('/dashboard', handleGetDashboard);
router.get('/support/dashboard', handleGetDashboard);

// Base route fallback
router.get(['/', ''], (req, res) => {
  res.status(200).json({
    service: 'voice4all-support',
    version: '4.0.0',
    description: 'Human Support Module with Honest Human Connectivity and Persisted Tickets',
    endpoints: [
      { method: 'POST', path: '/api/support/requests', description: 'Submit a support request' },
      { method: 'GET', path: '/api/support/requests', description: 'Retrieve support requests' },
      { method: 'GET', path: '/api/support/requests/:id', description: 'Retrieve an individual support request' },
      { method: 'PATCH', path: '/api/support/requests/:id/status', description: 'Update request status (authorized)' },
      { method: 'POST', path: '/api/support/requests/:id/assign', description: 'Assign support agent' },
      { method: 'POST', path: '/api/support/requests/:id/resolve', description: 'Resolve request' },
      { method: 'POST', path: '/api/support/requests/:id/cancel', description: 'Cancel request' },
      { method: 'POST', path: '/api/support/requests/:id/screen-share/stop', description: 'Stop screen sharing' },
      { method: 'GET', path: '/api/support/queue', description: 'Queue metrics and active items' },
      { method: 'GET', path: '/api/support/dashboard', description: 'Support Person Web Portal' }
    ]
  });
});

module.exports = router;
module.exports.default = router;
