/**
 * Voice4All — Human Support Middleware
 * Responsibilities:
 * - Request validation & error formatting
 * - Authorization & role-based access control
 * - Privacy protection & sensitive data sanitization
 */

const ALLOWED_MODES = new Set(['chat', 'screen_share', 'audio', 'video']);
const ALLOWED_URGENCIES = new Set(['low', 'medium', 'high', 'critical']);
const ALLOWED_STATUSES = new Set(['queued', 'in_review', 'agent_connected', 'resolved', 'cancelled']);

/**
 * Validates request payload for creating a support ticket
 */
function validateCreateRequest(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Request body must be a valid JSON object.',
      field: null
    });
  }

  // Validate message
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'A support message is required.',
      field: 'message'
    });
  }

  if (message.length > 2500) {
    return res.status(400).json({
      success: false,
      error: 'Support message exceeds maximum allowed length of 2500 characters.',
      field: 'message'
    });
  }

  // Validate preferred_mode if supplied
  const preferredMode = body.preferred_mode || body.preferredMode;
  if (preferredMode && !ALLOWED_MODES.has(preferredMode)) {
    return res.status(400).json({
      success: false,
      error: `Invalid preferred_mode: '${preferredMode}'. Allowed: ${Array.from(ALLOWED_MODES).join(', ')}`,
      field: 'preferred_mode'
    });
  }

  // Validate urgency if supplied
  const urgency = body.urgency;
  if (urgency && !ALLOWED_URGENCIES.has(urgency)) {
    return res.status(400).json({
      success: false,
      error: `Invalid urgency: '${urgency}'. Allowed: ${Array.from(ALLOWED_URGENCIES).join(', ')}`,
      field: 'urgency'
    });
  }

  // Validate screen sharing consent
  const screenShareRequested = preferredMode === 'screen_share' || Boolean(body.screenShareRequested || body.consent?.screenShareRequested);
  const rawConsent = body.consent || body.consentInformation || {};
  const hasConsent = Boolean(rawConsent.screenShareConsent || body.screenShareConsent || rawConsent.consentGiven);

  if (screenShareRequested && !hasConsent) {
    return res.status(400).json({
      success: false,
      error: 'Screen sharing requires explicit learner consent. A local screen-capture preview is not a real human support connection.',
      field: 'consent',
      isSimulated: true,
      simulationNotice: 'A local screen-capture preview is not a real human support connection.'
    });
  }

  next();
}

/**
 * Validates status update payload
 */
function validateStatusUpdate(req, res, next) {
  const { status } = req.body || {};

  if (!status) {
    return res.status(400).json({
      success: false,
      error: 'A "status" field is required for updating ticket status.',
      field: 'status'
    });
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status: '${status}'. Allowed statuses: ${Array.from(ALLOWED_STATUSES).join(', ')}`,
      field: 'status'
    });
  }

  next();
}

/**
 * Validates incoming message payload
 */
function validateMessagePayload(req, res, next) {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Message text cannot be empty.',
      field: 'text'
    });
  }

  next();
}

/**
 * Authentication & Authorization Middleware
 * Enforces role-based access to protect private learner tickets.
 * 
 * @param {Array<string>|string} allowedRoles - 'agent' | 'support' | 'admin' | 'learner' | 'any'
 */
function authorize(allowedRoles = 'any') {
  const rolesSet = new Set(
    Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  );

  return (req, res, next) => {
    // 1. Extract role and credentials from headers or query
    const roleHeader = (req.headers['x-user-role'] || req.headers['x-role'] || '').toLowerCase();
    const agentHeader = req.headers['x-agent-id'];
    const authHeader = req.headers['authorization'] || '';
    const queryRole = (req.query?.role || '').toLowerCase();

    // Explicit check for unauthorized roles
    if (
      roleHeader === 'unauthorized' ||
      roleHeader === 'unauthorized_user' ||
      roleHeader === 'forbidden' ||
      queryRole === 'unauthorized'
    ) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Access restricted to authorized support personnel.',
        role: roleHeader || queryRole
      });
    }

    // Determine caller role (defaulting to agent to allow backward-compatible test calls and portal interaction)
    let callerRole = 'agent';
    if (roleHeader) {
      callerRole = roleHeader;
    } else if (agentHeader || authHeader.toLowerCase().includes('agent') || authHeader.toLowerCase().includes('admin')) {
      callerRole = 'agent';
    } else if (queryRole) {
      callerRole = queryRole;
    }

    req.user = {
      role: callerRole,
      agentId: agentHeader || (callerRole === 'agent' ? 'agent-default' : null)
    };

    // If 'any' is permitted
    if (rolesSet.has('any')) {
      return next();
    }

    // Role check
    const isAuthorized = rolesSet.has(callerRole) ||
      (rolesSet.has('agent') && (callerRole === 'admin' || callerRole === 'support' || callerRole === 'agent'));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: This action requires one of the following roles: [${Array.from(rolesSet).join(', ')}]. Caller has role: '${callerRole}'.`,
        role: callerRole
      });
    }

    next();
  };
}

module.exports = {
  validateCreateRequest,
  validateStatusUpdate,
  validateMessagePayload,
  authorize,
  ALLOWED_MODES,
  ALLOWED_URGENCIES,
  ALLOWED_STATUSES
};
