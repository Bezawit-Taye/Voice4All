/**
 * Voice4All — Human Support Service (Phase 4)
 * 
 * Implements:
 *  - Persistent JSON Database storage (`backend/data/support-tickets.json`)
 *  - Active Support Request Queue with state transitions (queued -> in_review -> agent_connected -> resolved / cancelled)
 *  - Request ID generation (REQ-YYYY-XXXX) and status timeline tracking
 *  - Learner-consented screen sharing with session state management
 *  - Clear STOP-SHARING control
 *  - Honest Human Connectivity Policy: Never claims a human is connected unless an agent has actively claimed/joined
 *  - Support-person queue triage and message exchange
 *  - Privacy protection for sensitive learner information
 */

const fs = require('fs');
const path = require('path');

// Primary database file for persisting support tickets
const DB_PATH = path.resolve(__dirname, '../../data/support-tickets.json');

// In-memory queue repository for support tickets (hydrated from disk)
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
 * Hydrates in-memory map from persistent disk database
 */
function loadTicketsFromDisk() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const tickets = JSON.parse(raw);
      if (Array.isArray(tickets)) {
        supportQueue.clear();
        for (const t of tickets) {
          if (t && t.requestId) {
            supportQueue.set(t.requestId, t);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Support Service] Error loading support-tickets.json:', err.message);
  }
}

/**
 * Persists current tickets map to disk database
 */
function saveTicketsToDisk() {
  try {
    const list = Array.from(supportQueue.values());
    fs.writeFileSync(DB_PATH, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Support Service] Error persisting to support-tickets.json:', err.message);
  }
}

// Initial hydration from disk
loadTicketsFromDisk();

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
 * Persists record to disk database.
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
    humanConnected: false,
    agentName: null,
    agentId: null,
    connectionState: 'waiting_in_queue',
    connectionNotice: 'You are currently in the queue. No human agent is currently connected.',
    
    // Screen sharing state:
    screenShareStatus,
    screen_share_active: false,
    screenShareStartedAt: null,
    screenShareStoppedAt: null,
    
    // Simulation Transparency:
    isSimulated: true,
    simulationNotice: 'SIMULATED SUPPORT WORKFLOW: This ticket is managed by the Voice4All demonstration support queue. A local screen-capture preview does not establish a live human connection.',
    
    // Messages thread
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
  saveTicketsToDisk();

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
 * Retrieves a ticket by its Request ID
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
    screen_share_active: Boolean(ticket.humanConnected && ticket.screenShareStatus === 'session_active')
  };
}

/**
 * Retrieves support requests with filtering and privacy protection
 */
function getRequests(filters = {}, userRole = 'agent') {
  const allTickets = Array.from(supportQueue.values()).map(t => getSupportRequest(t.requestId));

  let filtered = allTickets;

  // Filter by learnerId for privacy if requested by a learner
  if (filters.learnerId) {
    filtered = filtered.filter(t => t.learnerId === filters.learnerId);
  }

  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(t => t.status === filters.status);
  }
  if (filters.urgency && filters.urgency !== 'all') {
    filtered = filtered.filter(t => t.urgency === filters.urgency);
  }
  if (filters.preferred_mode && filters.preferred_mode !== 'all') {
    filtered = filtered.filter(t => t.preferred_mode === filters.preferred_mode);
  }

  return filtered;
}

/**
 * Retrieves full queue overview for support personnel
 */
function getQueue(filters = {}) {
  const allTickets = Array.from(supportQueue.values()).map(t => getSupportRequest(t.requestId));
  const filtered = getRequests(filters, 'agent');

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
 * Validates allowed state transitions in ticket lifecycle
 */
function validateStateTransition(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;

  const validTransitions = {
    queued: new Set(['in_review', 'agent_connected', 'cancelled']),
    in_review: new Set(['agent_connected', 'queued', 'cancelled']),
    agent_connected: new Set(['resolved', 'cancelled', 'in_review']),
    resolved: new Set([]), // Terminal
    cancelled: new Set([]) // Terminal
  };

  const allowed = validTransitions[currentStatus];
  return Boolean(allowed && allowed.has(newStatus));
}

/**
 * Update ticket status where authorized
 */
function updateTicketStatus(requestId, newStatus, metadata = {}) {
  const ticket = supportQueue.get(requestId);
  if (!ticket) {
    const error = new Error(`Support ticket not found for ID: ${requestId}`);
    error.statusCode = 404;
    throw error;
  }

  if (!validateStateTransition(ticket.status, newStatus)) {
    const error = new Error(`Invalid state transition from '${ticket.status}' to '${newStatus}'.`);
    error.statusCode = 400;
    throw error;
  }

  const now = new Date().toISOString();
  const previousStatus = ticket.status;
  ticket.status = newStatus;
  ticket.updatedAt = now;

  // Handle side-effects of status change
  if (newStatus === 'agent_connected') {
    ticket.humanConnected = true;
    ticket.agentName = metadata.agentName || ticket.agentName || 'Support Specialist';
    ticket.agentId = metadata.agentId || ticket.agentId || 'agent-01';
    ticket.connectionState = 'human_connected';
    ticket.connectionNotice = `Connected to human support specialist: ${ticket.agentName}`;

    if (ticket.screenShareStatus === 'consent_granted_pending_agent') {
      ticket.screenShareStatus = 'session_active';
      ticket.screen_share_active = true;
      ticket.screenShareStartedAt = now;
    }
  } else if (newStatus === 'resolved') {
    ticket.resolvedAt = now;
    ticket.resolutionNotes = metadata.resolutionNotes || 'Resolved with learner confirmation.';
    ticket.humanConnected = false;
    ticket.screenShareStatus = 'stopped';
    ticket.screen_share_active = false;
    ticket.screenShareStoppedAt = now;
  } else if (newStatus === 'cancelled') {
    ticket.cancelledAt = now;
    ticket.cancellationReason = metadata.reason || 'Cancelled by user.';
    ticket.humanConnected = false;
    ticket.screenShareStatus = 'stopped';
    ticket.screen_share_active = false;
  } else if (newStatus === 'in_review') {
    ticket.humanConnected = false;
    ticket.connectionState = 'in_review';
    ticket.connectionNotice = 'Your ticket is currently under review by a support specialist.';
  }

  ticket.history.push({
    status: newStatus,
    timestamp: now,
    note: metadata.note || `Status transitioned from '${previousStatus}' to '${newStatus}'.`
  });

  saveTicketsToDisk();
  return getSupportRequest(requestId);
}

/**
 * Support agent claims/connects to a ticket
 */
function assignAgent(requestId, agentName = 'Mentor Grace (Support Specialist)', agentId = 'agent-01') {
  return updateTicketStatus(requestId, 'agent_connected', {
    agentName,
    agentId,
    note: `Support specialist ${agentName} claimed and joined the session.`
  });
}

/**
 * Learner or agent explicitly starts/consents to screen sharing
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
    ticket.screenShareStatus = 'consent_granted_pending_agent';
    ticket.screen_share_active = false;
    ticket.history.push({
      status: 'consent_granted_pending_agent',
      timestamp: now,
      note: 'Learner granted screen sharing consent. Waiting for human agent to connect before screen data is transmitted.'
    });
  }

  ticket.updatedAt = now;
  saveTicketsToDisk();
  return getSupportRequest(requestId);
}

/**
 * CLEAR STOP-SHARING CONTROL
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

  saveTicketsToDisk();

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
  saveTicketsToDisk();

  return {
    success: true,
    message: newMsg,
    totalMessages: ticket.messages.length
  };
}

/**
 * Marks a ticket as resolved
 */
function resolveTicket(requestId, resolutionNotes = 'Resolved with learner confirmation.') {
  return updateTicketStatus(requestId, 'resolved', {
    resolutionNotes,
    note: `Ticket resolved. Notes: ${resolutionNotes}`
  });
}

/**
 * Learner cancels their own request
 */
function cancelTicket(requestId, reason = 'Cancelled by learner') {
  return updateTicketStatus(requestId, 'cancelled', {
    reason,
    note: `Request cancelled by learner. Reason: ${reason}`
  });
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
        (f.question_en && f.question_en.toLowerCase().includes(term)) ||
        (f.answer_en && f.answer_en.toLowerCase().includes(term)) ||
        (f.tags && f.tags.some(t => t.toLowerCase().includes(term))) ||
        (f.keywords && f.keywords.some(k => k.toLowerCase().includes(term)))
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
  getRequests,
  getQueue,
  updateTicketStatus,
  assignAgent,
  handleScreenShareConsent,
  stopScreenShare,
  addMessage,
  resolveTicket,
  cancelTicket,
  validateConsent,
  getFaqs,
  getFaqsPath,
  loadTicketsFromDisk,
  saveTicketsToDisk
};
module.exports.default = module.exports;
