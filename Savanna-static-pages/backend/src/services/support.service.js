/**
 * Voice4All — Human Support Service (Phase 2)
 * 
 * Implements:
 *  - Active Support Request Queue with state transitions (queued -> in_review -> agent_connected -> resolved / cancelled)
 *  - Request ID generation (REQ-YYYY-XXXX) and status timeline tracking
 *  - Learner-consented screen sharing with session state management
 *  - Clear STOP-SHARING control
 *  - Honest Human Connectivity Policy: Never claims a human is connected unless an agent has actively claimed/joined
 *  - Support-person queue triage and message exchange
 */

const fs = require('fs');
const path = require('path');

// In-memory queue repository for support tickets
const supportQueue = new Map();

// Helper to locate faqs.json safely across working directories
function getFaqsPath() {
  const directPath = path.resolve(__dirname, '../../data/faqs.json');
  if (fs.existsSync(directPath)) return directPath;
  const fallback = path.resolve(process.cwd(), 'backend/data/faqs.json');
  if (fs.existsSync(fallback)) return fallback;
  return path.resolve(process.cwd(), 'Savanna-static-pages/backend/data/faqs.json');
}

/**
 * Generates an accessible, standardized Request ID (e.g. REQ-2026-4821)
 */
function generateRequestId() {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${year}-${randomNum}`;
}

/**
 * Validates and normalizes consent information.
 * Enforces explicit affirmative consent for screen sharing.
 * 
 * @param {Object} consentInput
 * @param {boolean} screenShareRequested
 * @returns {{isValid: boolean, error?: string, consent: Object}}
 */
function validateConsent(consentInput = {}, screenShareRequested = false) {
  const isRequested = Boolean(
    screenShareRequested ||
    consentInput.screenShareRequested ||
    consentInput.preferred_mode === 'screen_share'
  );

  const consent = {
    screenShareRequested: isRequested,
    screenShareConsent: Boolean(consentInput.screenShareConsent || consentInput.consentGiven),
    contextSharingConsent: consentInput.contextSharingConsent !== false,
    diagnosticsConsent: Boolean(consentInput.diagnosticsConsent),
    consentedAt: consentInput.consentedAt || (consentInput.screenShareConsent ? new Date().toISOString() : null)
  };

  // If screen sharing was requested but consent not explicitly affirmed
  if (isRequested && !consent.screenShareConsent) {
    return {
      isValid: false,
      error: 'Screen sharing requires explicit learner consent. A local screen-capture preview is not a real human support connection.',
      consent
    };
  }

  return { isValid: true, consent };
}

/**
 * Creates a new support request and places it into the active queue.
 * Supports both Phase 1 and Member 1's UI payload conventions.
 * 
 * @param {Object} payload
 * @returns {Object} Newly created support request ticket
 */
function createSupportRequest(payload = {}) {
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';

  if (!message) {
    const error = new Error('A support message is required.');
    error.statusCode = 400;
    error.field = 'message';
    throw error;
  }

  const preferredMode = payload.preferred_mode || payload.preferredMode || (payload.screenShareRequested ? 'screen_share' : 'chat');
  const screenShareRequested = preferredMode === 'screen_share' || Boolean(payload.screenShareRequested || payload.consent?.screenShareRequested);

  const rawConsent = payload.consent || payload.consentInformation || {};
  if (payload.screenShareConsent) rawConsent.screenShareConsent = true;

  const consentValidation = validateConsent(rawConsent, screenShareRequested);
  if (!consentValidation.isValid) {
    const error = new Error(consentValidation.error);
    error.statusCode = 400;
    error.field = 'consent';
    throw error;
  }

  const requestId = generateRequestId();
  const now = new Date().toISOString();

  // Extract / sanitize course context
  const rawContext = payload.context || {};
  const context = {
    courseTitle: rawContext.courseTitle || rawContext.course || 'VA-1: VA Foundations & Professional Identity',
    moduleTitle: rawContext.moduleTitle || rawContext.module || 'Module 2: What is a VA',
    lessonTitle: rawContext.lessonTitle || rawContext.page || 'The Future of the VA Industry',
    lessonText: typeof rawContext.lessonText === 'string' ? rawContext.lessonText.substring(0, 1000) : ''
  };

  const topic = payload.topic || 'General Course Assistance';
  const urgency = payload.urgency || 'medium';
  const language = payload.language || 'en';
  const learnerId = payload.learnerId || payload.learnerIdentifier || 'Learner-Amara';

  // Screen sharing state machine:
  // - not_requested: learner did not ask for screen share
  // - consent_granted_pending_agent: learner consented, but NO agent is connected yet
  // - session_active: agent joined AND screen sharing is actively running
  // - stopped: screen sharing was terminated by learner or agent
  let screenShareStatus = 'not_requested';
  if (screenShareRequested) {
    screenShareStatus = consentValidation.consent.screenShareConsent
      ? 'consent_granted_pending_agent'
      : 'not_requested';
  }

  const ticket = {
    requestId,
    request_id: requestId, // Member 1 compatibility alias
    topic,
    message,
    preferred_mode: preferredMode,
    urgency,
    language,
    context,
    learnerId,
    consent: consentValidation.consent,
    
    // Queue lifecycle:
    status: 'queued', // 'queued' | 'in_review' | 'agent_connected' | 'resolved' | 'cancelled'
    
    // HONEST HUMAN CONNECTIVITY POLICY:
    // Strictly FALSE until an actual support person claims/joins this request
    humanConnected: false,
    agentName: null,
    agentId: null,
    connectionState: 'waiting_in_queue',
    connectionNotice: 'You are currently in the queue. No human agent is currently connected.',
    
    // Screen sharing state:
    screenShareStatus,
    screen_share_active: false, // strictly false while no agent is connected
    screenShareStartedAt: null,
    screenShareStoppedAt: null,
    
    // Simulation Transparency:
    isSimulated: true,
    simulationNotice: 'SIMULATED SUPPORT WORKFLOW: This ticket is managed by the Voice4All demonstration support queue. A local screen-capture preview does not establish a live human connection.',
    
    // Messages thread between learner and support staff
    messages: [
      {
        id: 'msg-1',
        sender: 'learner',
        senderName: learnerId,
        text: message,
        timestamp: now
      }
    ],
    
    // Audit timeline
    history: [
      {
        status: 'queued',
        timestamp: now,
        note: `Ticket created by learner. Urgency: ${urgency}, Preferred Mode: ${preferredMode}`
      }
    ],

    estimatedWaitMinutes: calculateEstimatedWait(urgency),
    createdAt: now,
    created_at: now,
    updatedAt: now
  };

  supportQueue.set(requestId, ticket);

  return ticket;
}

/**
 * Calculates estimated wait time based on queue length and urgency
 */
function calculateEstimatedWait(urgency = 'medium') {
  let activeQueuedCount = 0;
  for (const t of supportQueue.values()) {
    if (t.status === 'queued') activeQueuedCount++;
  }
  const baseMinutes = urgency === 'high' ? 1 : urgency === 'low' ? 5 : 3;
  return Math.max(1, baseMinutes + Math.floor(activeQueuedCount * 1.5));
}

/**
 * Retrieves a ticket by its Request ID (supports REQ-XXXX or supp_XXXX)
 * @param {string} requestId
 * @returns {Object|null}
 */
function getSupportRequest(requestId) {
  if (!requestId) return null;
  const ticket = supportQueue.get(requestId);
  if (!ticket) return null;

  // Dynamically compute current queue position
  let position = 0;
  if (ticket.status === 'queued') {
    let index = 1;
    for (const [id, t] of supportQueue.entries()) {
      if (t.status === 'queued') {
        if (id === requestId) {
          position = index;
          break;
        }
        index++;
      }
    }
  }

  return {
    ...ticket,
    queuePosition: position,
    // Honest connectivity check: screen sharing is active ONLY if an agent is actually connected
    screen_share_active: Boolean(ticket.humanConnected && ticket.screenShareStatus === 'session_active')
  };
}

/**
 * Retrieves the full queue for the support-person dashboard
 * @param {Object} [filters={}]
 * @returns {Object} Queue items and summary statistics
 */
function getQueue(filters = {}) {
  const allTickets = Array.from(supportQueue.values()).map(t => getSupportRequest(t.requestId));

  let filtered = allTickets;
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(t => t.status === filters.status);
  }
  if (filters.urgency && filters.urgency !== 'all') {
    filtered = filtered.filter(t => t.urgency === filters.urgency);
  }
  if (filters.preferred_mode && filters.preferred_mode !== 'all') {
    filtered = filtered.filter(t => t.preferred_mode === filters.preferred_mode);
  }

  // Calculate summary metrics
  const stats = {
    totalTickets: allTickets.length,
    queued: allTickets.filter(t => t.status === 'queued').length,
    inReview: allTickets.filter(t => t.status === 'in_review').length,
    agentConnected: allTickets.filter(t => t.status === 'agent_connected').length,
    resolved: allTickets.filter(t => t.status === 'resolved').length,
    cancelled: allTickets.filter(t => t.status === 'cancelled').length,
    screenSharePending: allTickets.filter(t => t.screenShareStatus === 'consent_granted_pending_agent').length,
    screenShareActive: allTickets.filter(t => t.screenShareStatus === 'session_active').length
  };

  return {
    isSimulated: true,
    simulationNotice: 'SIMULATED SUPPORT QUEUE — Voice4All Support Person Portal',
    stats,
    queue: filtered
  };
}

/**
 * Support agent claims/connects to a ticket
 * Transitions ticket from 'queued' to 'agent_connected'
 * Enforces HONEST HUMAN CONNECTIVITY: only now is humanConnected set to true!
 * 
 * @param {string} requestId
 * @param {string} agentName
 * @param {string} [agentId]
 * @returns {Object} Updated ticket
 */
function assignAgent(requestId, agentName = 'Mentor Grace (Support Specialist)', agentId = 'agent-01') {
  const ticket = supportQueue.get(requestId);
  if (!ticket) {
    const error = new Error(`Support ticket not found for ID: ${requestId}`);
    error.statusCode = 404;
    throw error;
  }

  const now = new Date().toISOString();
  ticket.status = 'agent_connected';
  ticket.humanConnected = true;
  ticket.agentName = agentName;
  ticket.agentId = agentId;
  ticket.connectionState = 'human_connected';
  ticket.connectionNotice = `Connected to human support specialist: ${agentName}`;
  ticket.updatedAt = now;

  ticket.history.push({
    status: 'agent_connected',
    timestamp: now,
    note: `Support specialist ${agentName} claimed and joined the session.`
  });

  ticket.messages.push({
    id: `msg-${ticket.messages.length + 1}`,
    sender: 'agent',
    senderName: agentName,
    text: `Hello! I am ${agentName}. I have reviewed your course context for "${ticket.context.lessonTitle}". How can I help you?`,
    timestamp: now
  });

  // If learner had already consented to screen sharing, agent joining activates the session!
  if (ticket.screenShareStatus === 'consent_granted_pending_agent') {
    ticket.screenShareStatus = 'session_active';
    ticket.screen_share_active = true;
    ticket.screenShareStartedAt = now;
    ticket.history.push({
      status: 'screen_share_active',
      timestamp: now,
      note: 'Screen sharing session activated with agent authorization and prior learner consent.'
    });
  }

  return getSupportRequest(requestId);
}

/**
 * Learner or agent explicitly starts/consents to screen sharing
 * @param {string} requestId
 * @param {Object} consentPayload
 * @returns {Object} Updated ticket
 */
function handleScreenShareConsent(requestId, consentPayload = {}) {
  const ticket = supportQueue.get(requestId);
  if (!ticket) {
    const error = new Error(`Support ticket not found for ID: ${requestId}`);
    error.statusCode = 404;
    throw error;
  }

  const consentGiven = Boolean(consentPayload.consentGiven || consentPayload.screenShareConsent);
  if (!consentGiven) {
    const error = new Error('Screen sharing requires explicit affirmative learner consent.');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date().toISOString();
  ticket.consent.screenShareRequested = true;
  ticket.consent.screenShareConsent = true;
  ticket.consent.consentedAt = now;

  // If an agent is ALREADY connected, start screen share immediately
  if (ticket.humanConnected) {
    ticket.screenShareStatus = 'session_active';
    ticket.screen_share_active = true;
    ticket.screenShareStartedAt = now;
    ticket.history.push({
      status: 'screen_share_active',
      timestamp: now,
      note: 'Learner granted screen sharing consent. Session is now active with connected agent.'
    });
  } else {
    // No agent connected yet: queue it honestly
    ticket.screenShareStatus = 'consent_granted_pending_agent';
    ticket.screen_share_active = false;
    ticket.history.push({
      status: 'consent_granted_pending_agent',
      timestamp: now,
      note: 'Learner granted screen sharing consent. Waiting for human agent to connect before screen data is transmitted.'
    });
  }

  ticket.updatedAt = now;
  return getSupportRequest(requestId);
}

/**
 * CLEAR STOP-SHARING CONTROL
 * Terminates any active or pending screen sharing immediately.
 * 
 * @param {string} requestId
 * @param {string} [stoppedBy='learner'] - 'learner' | 'agent'
 * @returns {Object} Updated ticket and confirmation
 */
function stopScreenShare(requestId, stoppedBy = 'learner') {
  const ticket = supportQueue.get(requestId);
  if (!ticket) {
    const error = new Error(`Support ticket not found for ID: ${requestId}`);
    error.statusCode = 404;
    throw error;
  }

  const now = new Date().toISOString();
  const previousStatus = ticket.screenShareStatus;
  
  ticket.screenShareStatus = 'stopped';
  ticket.screen_share_active = false;
  ticket.screenShareStoppedAt = now;
  ticket.updatedAt = now;

  ticket.history.push({
    status: 'screen_share_stopped',
    timestamp: now,
    note: `Screen sharing explicitly stopped by ${stoppedBy}. Previous status: ${previousStatus}`
  });

  ticket.messages.push({
    id: `msg-${ticket.messages.length + 1}`,
    sender: 'system',
    senderName: 'System Notice',
    text: `Screen sharing has been stopped by the ${stoppedBy}. No screen content is being shared.`,
    timestamp: now
  });

  return {
    success: true,
    requestId,
    screenShareStatus: 'stopped',
    screen_share_active: false,
    stoppedBy,
    stoppedAt: now,
    message: 'Screen sharing has been successfully stopped. No screen content is being transmitted.',
    ticket: getSupportRequest(requestId)
  };
}

/**
 * Appends a message between learner and agent
 * @param {string} requestId
 * @param {Object} messageData
 * @returns {Object} Updated ticket
 */
function addMessage(requestId, messageData = {}) {
  const ticket = supportQueue.get(requestId);
  if (!ticket) {
    const error = new Error(`Support ticket not found for ID: ${requestId}`);
    error.statusCode = 404;
    throw error;
  }

  const text = typeof messageData.text === 'string' ? messageData.text.trim() : '';
  if (!text) {
    const error = new Error('Message text cannot be empty.');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date().toISOString();
  const sender = messageData.sender || 'learner';
  const senderName = messageData.senderName || (sender === 'agent' ? (ticket.agentName || 'Support Agent') : ticket.learnerId);

  const newMsg = {
    id: `msg-${ticket.messages.length + 1}`,
    sender,
    senderName,
    text,
    timestamp: now
  };

  ticket.messages.push(newMsg);
  ticket.updatedAt = now;

  return {
    success: true,
    message: newMsg,
    totalMessages: ticket.messages.length
  };
}

/**
 * Marks a ticket as resolved
 * @param {string} requestId
 * @param {string} [resolutionNotes]
 * @returns {Object} Updated ticket
 */
function resolveTicket(requestId, resolutionNotes = 'Resolved with learner confirmation.') {
  const ticket = supportQueue.get(requestId);
  if (!ticket) {
    const error = new Error(`Support ticket not found for ID: ${requestId}`);
    error.statusCode = 404;
    throw error;
  }

  const now = new Date().toISOString();
  ticket.status = 'resolved';
  ticket.resolutionNotes = resolutionNotes;
  ticket.resolvedAt = now;
  ticket.updatedAt = now;

  // Stop screen sharing if it was running
  if (ticket.screen_share_active || ticket.screenShareStatus === 'session_active') {
    ticket.screenShareStatus = 'stopped';
    ticket.screen_share_active = false;
    ticket.screenShareStoppedAt = now;
  }

  ticket.history.push({
    status: 'resolved',
    timestamp: now,
    note: `Ticket resolved. Notes: ${resolutionNotes}`
  });

  return getSupportRequest(requestId);
}

/**
 * Learner cancels their own request
 * @param {string} requestId
 * @param {string} [reason='Cancelled by learner']
 * @returns {Object} Updated ticket
 */
function cancelTicket(requestId, reason = 'Cancelled by learner') {
  const ticket = supportQueue.get(requestId);
  if (!ticket) {
    const error = new Error(`Support ticket not found for ID: ${requestId}`);
    error.statusCode = 404;
    throw error;
  }

  const now = new Date().toISOString();
  ticket.status = 'cancelled';
  ticket.cancellationReason = reason;
  ticket.updatedAt = now;

  // Stop screen sharing if it was running
  ticket.screenShareStatus = 'stopped';
  ticket.screen_share_active = false;

  ticket.history.push({
    status: 'cancelled',
    timestamp: now,
    note: `Request cancelled by learner. Reason: ${reason}`
  });

  return getSupportRequest(requestId);
}

/**
 * Loads FAQ items with optional search and category filters
 */
function getFaqs(query = {}) {
  try {
    const filePath = getFaqsPath();
    const data = fs.readFileSync(filePath, 'utf8');
    let faqs = JSON.parse(data);

    if (query.category) {
      const cat = query.category.toLowerCase();
      faqs = faqs.filter(f => f.category && f.category.toLowerCase().includes(cat));
    }

    if (query.search) {
      const term = query.search.toLowerCase();
      faqs = faqs.filter(f =>
        (f.question && f.question.toLowerCase().includes(term)) ||
        (f.answer && f.answer.toLowerCase().includes(term)) ||
        (f.tags && f.tags.some(t => t.toLowerCase().includes(term)))
      );
    }

    return faqs;
  } catch (err) {
    return [];
  }
}

module.exports = {
  createSupportRequest,
  getSupportRequest,
  getQueue,
  assignAgent,
  handleScreenShareConsent,
  stopScreenShare,
  addMessage,
  resolveTicket,
  cancelTicket,
  validateConsent,
  getFaqs,
  getFaqsPath
};
module.exports.default = module.exports;
