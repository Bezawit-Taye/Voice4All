/**
 * Voice4All — Career Service (Phase 2)
 * 
 * Implements:
 *  - Job browsing & filtering (keyword, type, location, language, accessibility)
 *  - Bilingual job records (English & Amharic)
 *  - Career Opportunity Q&A (intelligent answering about available roles & accommodations)
 *  - Interview Accommodation Request Drafting (with explicit "not sent to employer" guarantee)
 *  - Telegram Job Notification Integration (screen-reader friendly alerts, subscription, broadcast)
 *  - SMS-Compatible Notification Interface (concise 160-char SMS segmentation, low-bandwidth delivery)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// In-memory repositories for session state
const accommodationDrafts = new Map();
const telegramSubscribers = new Map();
const smsSubscribers = new Map();

/**
 * Safely resolves the path to jobs.json
 */
function getJobsPath() {
  const directPath = path.resolve(__dirname, '../../data/jobs.json');
  if (fs.existsSync(directPath)) return directPath;
  const fallback = path.resolve(process.cwd(), 'backend/data/jobs.json');
  if (fs.existsSync(fallback)) return fallback;
  return path.resolve(process.cwd(), 'Savanna-static-pages/backend/data/jobs.json');
}

/**
 * Loads all jobs from jobs.json
 * @returns {Array<Object>}
 */
function loadAllJobs() {
  try {
    const filePath = getJobsPath();
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

/**
 * Retrieves all sample jobs with rich filtering and language adaptation.
 * 
 * @param {Object} [filters={}]
 * @param {string} [filters.q] - Keyword search
 * @param {string} [filters.query] - Alias for q
 * @param {string} [filters.type] - 'all' | 'fulltime' | 'parttime' | 'remote'
 * @param {string} [filters.filter] - Alias for type
 * @param {string} [filters.location] - Location filter
 * @param {string} [filters.lang='en'] - 'en' | 'am'
 * @param {string} [filters.language] - Alias for lang
 * @param {boolean} [filters.accessible_only] - Filter only verified accessible
 * @returns {Object} Filtered jobs list and metadata
 */
function getJobs(filters = {}) {
  const rawJobs = loadAllJobs();
  const lang = (filters.lang || filters.language || 'en').toLowerCase();
  const isAm = (lang === 'am');

  const q = (filters.q || filters.query || filters.search || '').toLowerCase().trim();
  const typeFilter = (filters.type || filters.filter || 'all').toLowerCase().trim();
  const locationFilter = (filters.location || '').toLowerCase().trim();

  const filtered = rawJobs.filter((job) => {
    // Type filter
    if (typeFilter && typeFilter !== 'all') {
      if (typeFilter === 'remote') {
        const isRemote = job.type === 'remote' ||
          job.location.toLowerCase().includes('remote') ||
          (job.location_am && job.location_am.includes('የርቀት'));
        if (!isRemote) return false;
      } else if (job.type !== typeFilter) {
        return false;
      }
    }

    // Location filter
    if (locationFilter) {
      const locMatch = job.location.toLowerCase().includes(locationFilter) ||
        (job.location_am && job.location_am.toLowerCase().includes(locationFilter));
      if (!locMatch) return false;
    }

    // Keyword search
    if (q) {
      const haystack = [
        job.title,
        job.title_am,
        job.company,
        job.organization,
        job.description,
        job.description_am,
        job.accessibilityOrAccommodation,
        ...(job.tags || []),
        ...(job.tags_am || [])
      ].filter(Boolean).join(' ').toLowerCase();

      if (!haystack.includes(q)) return false;
    }

    if (filters.accessible_only && !job.accessible_workplace) {
      return false;
    }

    return true;
  }).map((job) => ({
    id: job.id,
    title: isAm && job.title_am ? job.title_am : job.title,
    title_am: job.title_am,
    company: job.company || job.organization,
    organization: job.organization || job.company,
    location: isAm && job.location_am ? job.location_am : job.location,
    location_am: job.location_am,
    type: job.type,
    type_label: isAm && job.type_label_am ? job.type_label_am : (job.type_label || job.type),
    description: isAm && job.description_am ? job.description_am : job.description,
    description_am: job.description_am,
    tags: isAm && job.tags_am ? job.tags_am : job.tags,
    tags_am: job.tags_am,
    accessible_workplace: Boolean(job.accessible_workplace),
    accessibilityOrAccommodation: job.accessibilityOrAccommodation,
    interviewAccommodationsOffered: job.interviewAccommodationsOffered || [],
    isSample: true,
    sampleOpportunityNotice: job.sampleOpportunityNotice
  }));

  return {
    success: true,
    total: filtered.length,
    language: lang,
    isSampleDataset: true,
    datasetNotice: 'SIMULATED SAMPLE OPPORTUNITIES — For accessibility demonstration and accommodation drafting practice only.',
    jobs: filtered
  };
}

/**
 * Retrieves a single job by ID with language adaptation
 * @param {string} jobId
 * @param {string} [lang='en']
 * @returns {Object|null}
 */
function getJobById(jobId, lang = 'en') {
  if (!jobId) return null;
  const { jobs } = getJobs({ lang });
  return jobs.find(j => j.id === jobId) || null;
}

/**
 * Career Opportunity Q&A
 * Answers questions about available jobs, accommodations, and skills.
 * Supports both English and Amharic queries.
 * 
 * @param {Object} payload
 * @param {string} payload.question
 * @param {string} [payload.language='en']
 * @param {string} [payload.jobId]
 * @returns {Object} Structured career guidance response with matched jobs
 */
function askCareerQuestion(payload = {}) {
  const question = typeof payload.question === 'string' ? payload.question.trim() : '';
  if (!question) {
    const error = new Error('Question cannot be empty.');
    error.statusCode = 400;
    throw error;
  }

  const lang = (payload.language || payload.lang || 'en').toLowerCase();
  const isAm = (lang === 'am') || /[\u1200-\u137F]/.test(question);
  const qLower = question.toLowerCase();

  const allJobs = getJobs({ lang: isAm ? 'am' : 'en' }).jobs;
  let matchingJobs = [];
  let answer = '';
  let suggestions = [];

  if (isAm) {
    // Amharic Career Guidance
    if (qLower.includes('ስክሪን') || qLower.includes('አንባቢ') || qLower.includes('ማየት') || qLower.includes('ዓይነ') || qLower.includes('ተደራሽ')) {
      matchingJobs = allJobs.filter(j => j.tags && j.tags.some(t => t.includes('ስክሪን') || t.includes('ተደራሽ')));
      answer = `ለስክሪን አንባቢ (Screen Reader) ተጠቃሚዎች ተስማሚ የሆኑ ${matchingJobs.length} የሥራ ዕድሎች ተገኝተዋል፦\n` +
        matchingJobs.map(j => `• ${j.title} (${j.company}) — ${j.location}`).join('\n') +
        `\n\nእነዚህ ድርጅቶች በስራ ቃለ-መጠይቅ ወቅት የጽሑፍ ጥያቄዎችን አስቀድሞ መስጠት እና የተደራጁ የዲጂታል ሰነዶችን ያቀርባሉ።`;
      suggestions = ['የሥራ ቃለ-መጠይቅ ማመቻቸት እንዴት እጠይቃለሁ?', 'የርቀት ሥራዎች የትኞቹ ናቸው?', 'የተደራሽነት የጥራት ቁጥጥር ረዳት ሚና ምንድን ነው?'];
    } else if (qLower.includes('ርቀት') || qLower.includes('ቤት') || qLower.includes('remote')) {
      matchingJobs = allJobs.filter(j => j.location.includes('ርቀት') || j.location.toLowerCase().includes('remote'));
      answer = `በሙሉ የርቀት (Remote) አማራጭ የቀረቡ ${matchingJobs.length} የሥራ ዕድሎች አሉ፦\n` +
        matchingJobs.map(j => `• ${j.title} (${j.company}) — ${j.type_label}`).join('\n') +
        `\n\nሁሉም የርቀት ሥራዎች ተለዋዋጭ የሥራ ሰዓት እና በጽሑፍ የተደገፈ ግንኙነትን ያበረታታሉ።`;
      suggestions = ['ስክሪን አንባቢ የሚደግፉ የሥራ ዕድሎች የትኞቹ ናቸው?', 'ሙሉ ጊዜ የሆኑትን አሳየኝ', 'የሥራ ቃለ-መጠይቅ ማመቻቸት ጥያቄ አዘጋጅልኝ'];
    } else {
      matchingJobs = allJobs.slice(0, 3);
      answer = `በVoice4All ካሪየር መድረክ ውስጥ ለቨርቹዋል ረዳቶች የተዘጋጁ ተደራሽ የሥራ ዕድሎች ይገኛሉ።\n` +
        `ለምሳሌ፦ ${matchingJobs.map(j => j.title).join('፣ ')} ይገኙበታል። በእያንዳንዱ የሥራ መደብ ላይ የተደራሽነት ማመቻቸት ጥያቄ ረቂቅ ማዘጋጀት ይችላሉ።`;
      suggestions = ['ስክሪን አንባቢ የሚደግፉ የሥራ ዕድሎች የትኞቹ ናቸው?', 'የርቀት ሥራዎችን ብቻ አሳየኝ', 'የትርፍ ሰዓት የሥራ ዕድሎች አሉ?'];
    }
  } else {
    // English Career Guidance
    if (qLower.includes('screen reader') || qLower.includes('blind') || qLower.includes('visual') || qLower.includes('accessible')) {
      matchingJobs = allJobs.filter(j =>
        (j.tags && j.tags.some(t => t.toLowerCase().includes('screen-reader'))) ||
        (j.accessibilityOrAccommodation && j.accessibilityOrAccommodation.toLowerCase().includes('screen reader'))
      );
      answer = `We found ${matchingJobs.length} opportunities with verified screen reader compatibility and accessibility accommodations:\n\n` +
        matchingJobs.map(j => `• ${j.title} at ${j.company} (${j.location})\n  Accommodations: ${j.accessibilityOrAccommodation.substring(0, 120)}...`).join('\n\n') +
        `\n\nYou can prepare an Interview Accommodation Request draft for any of these roles directly on this platform.`;
      suggestions = ['How do I request interview accommodations?', 'Which jobs are 100% remote?', 'Tell me about the Accessibility QA role'];
    } else if (qLower.includes('remote') || qLower.includes('work from home') || qLower.includes('location')) {
      matchingJobs = allJobs.filter(j => j.location.toLowerCase().includes('remote'));
      answer = `There are ${matchingJobs.length} remote-friendly opportunities available across Africa and flexible time zones:\n\n` +
        matchingJobs.map(j => `• ${j.title} (${j.company}) — ${j.type_label || 'Flexible'}`).join('\n') +
        `\n\nThese roles emphasize asynchronous written updates (Slack, Notion) and flexible working hours.`;
      suggestions = ['Which jobs support screen readers?', 'Are there part-time opportunities?', 'Draft an accommodation request for Executive VA'];
    } else if (qLower.includes('part-time') || qLower.includes('part time') || qLower.includes('flexible')) {
      matchingJobs = allJobs.filter(j => j.type === 'parttime' || (j.tags && j.tags.some(t => t.toLowerCase().includes('flexible'))));
      answer = `We offer flexible and part-time positions designed for balanced workloads:\n\n` +
        matchingJobs.map(j => `• ${j.title} at ${j.company} (${j.type_label})`).join('\n') +
        `\n\nBoth positions include ergonomic allowances and customizable pacing.`;
      suggestions = ['Show all available jobs', 'How do I draft interview accommodations?', 'What skills does an Accessibility QA Assistant need?'];
    } else {
      matchingJobs = allJobs.slice(0, 3);
      answer = `Voice4All features ${allJobs.length} inclusive career opportunities for Virtual Assistants. Each job features transparent accessibility disclosures and supports customized interview accommodation requests:\n\n` +
        matchingJobs.map(j => `• ${j.title} (${j.company})`).join('\n') +
        `\n\nAsk about remote roles, assistive tech support, or how to draft an accommodation request!`;
      suggestions = ['Which jobs support screen readers?', 'Show 100% remote positions', 'How do I request interview accommodations?'];
    }
  }

  return {
    success: true,
    question,
    language: isAm ? 'am' : 'en',
    answer,
    matchedJobsCount: matchingJobs.length,
    matchingJobIds: matchingJobs.map(j => j.id),
    suggestions,
    isSample: true,
    timestamp: new Date().toISOString()
  };
}

/**
 * Prepares an Interview or Workplace Accommodation Request Draft
 * Supports both Phase 1 and Member 1 UI conventions.
 * 
 * STRICT POLICY:
 * Requests are saved as DRAFTS for learner preparation.
 * Never implies delivery has occurred when no employer transmission exists.
 * 
 * @param {Object} payload
 * @returns {Object} Draft record with explicit deliveryNotice
 */
function createAccommodationRequest(payload = {}) {
  // Support both job_id (Member 1) and jobId (Phase 1)
  const jobId = (payload.job_id || payload.jobId || '').trim();

  if (!jobId) {
    const error = new Error('A valid job_id is required to prepare an accommodation request draft.');
    error.statusCode = 400;
    error.field = 'job_id';
    throw error;
  }

  const job = getJobById(jobId, payload.language || 'en');
  if (!job) {
    const error = new Error(`Sample job not found for ID: ${jobId}`);
    error.statusCode = 404;
    error.field = 'job_id';
    throw error;
  }

  // Normalize requested accommodations list
  const rawAccommodations = payload.accommodations || payload.requestedAccommodations || [];
  let accommodationsList = [];
  if (Array.isArray(rawAccommodations)) {
    accommodationsList = rawAccommodations.map(a => String(a).trim()).filter(Boolean);
  } else if (typeof rawAccommodations === 'string' && rawAccommodations.trim()) {
    accommodationsList = [rawAccommodations.trim()];
  }

  if (accommodationsList.length === 0) {
    const error = new Error('At least one accommodation must be specified in the request draft.');
    error.statusCode = 400;
    error.field = 'accommodations';
    throw error;
  }

  const details = (payload.details || payload.justification || payload.notes || '').trim();
  const contactEmail = (payload.contact_email || payload.contactEmail || payload.learnerIdentifier || 'learner@voice4all.demo').trim();
  const language = payload.language || 'en';
  const requestType = payload.requestType || 'interview'; // 'interview' | 'workplace'

  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const draftId = `ACC-${year}-${randomNum}`;
  const now = new Date().toISOString();

  // Self-advocacy preparation checklist for the learner
  const interviewChecklist = [
    'Review your requested accommodations with your career mentor or peer coach.',
    'Send this written draft to your employer recruiter or interview coordinator at least 48 hours prior to the conversation.',
    'Test your assistive software (screen reader, captions, or speech-to-text) on the video platform before the interview.',
    'Prepare 2-3 examples of how you deliver excellent VA work using your accommodations.'
  ];

  const draftRecord = {
    draftId,
    request_id: draftId, // Member 1 compatibility
    status: 'draft_recorded',
    requestType,
    
    // STRICT HONEST DELIVERY POLICY:
    isDelivered: false,
    deliveryStatus: 'NOT_SENT_DRAFT_ONLY',
    deliveryNotice: 'DRAFT ONLY: This accommodation request is saved locally as an interview self-advocacy draft. It has NOT been sent to the employer. Voice4All provides preparation and drafting tools; actual submission requires external recruiter coordination.',
    
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      isSample: true
    },
    requestedAccommodations: accommodationsList,
    accommodations: accommodationsList,
    details,
    contact_email: contactEmail,
    language,
    interviewChecklist,
    createdAt: now,
    created_at: now,
    updatedAt: now
  };

  accommodationDrafts.set(draftId, draftRecord);

  return draftRecord;
}

/**
 * Retrieves an accommodation request draft by ID
 * @param {string} draftId
 * @returns {Object|null}
 */
function getAccommodationDraft(draftId) {
  if (!draftId) return null;
  return accommodationDrafts.get(draftId) || null;
}

/**
 * Lists all drafts
 */
function listAccommodationDrafts() {
  return Array.from(accommodationDrafts.values());
}

// =========================================================================
// Telegram Job Notification Integration
// =========================================================================

/**
 * Subscribes a learner to Telegram job notifications
 * @param {Object} payload
 * @returns {Object} Subscription result
 */
function subscribeTelegram(payload = {}) {
  const chatId = String(payload.chatId || payload.chat_id || '').trim();
  if (!chatId) {
    const error = new Error('A valid Telegram chatId is required for subscription.');
    error.statusCode = 400;
    error.field = 'chatId';
    throw error;
  }

  const username = payload.username || 'AnonymousLearner';
  const language = payload.language || 'en';
  const preferences = payload.preferences || {
    types: ['remote', 'fulltime', 'parttime'],
    accessibleOnly: true
  };

  const subscriber = {
    chatId,
    username,
    language,
    preferences,
    subscribedAt: new Date().toISOString(),
    status: 'active'
  };

  telegramSubscribers.set(chatId, subscriber);

  return {
    success: true,
    message: `Telegram job alert subscription activated for chat ID: ${chatId}`,
    subscriber,
    isSimulated: !Boolean(process.env.TELEGRAM_BOT_TOKEN),
    integrationNotice: process.env.TELEGRAM_BOT_TOKEN
      ? 'Live Telegram Bot dispatch configured.'
      : 'SIMULATED TELEGRAM DISPATCH — Demonstrating Telegram Bot integration for low-bandwidth mobile notifications.'
  };
}

/**
 * Formats and broadcasts a sample job notification via Telegram
 * Uses screen-reader friendly Markdown formatting.
 * 
 * @param {string} jobId
 * @param {string} [targetChatId]
 * @returns {Object} Broadcast result
 */
function broadcastJobTelegram(jobId, targetChatId = null) {
  const job = getJobById(jobId);
  if (!job) {
    const error = new Error(`Job not found for ID: ${jobId}`);
    error.statusCode = 404;
    throw error;
  }

  const messageText = 
    `🔔 *Voice4All Accessible Career Alert*\n\n` +
    `💼 *${job.title}*\n` +
    `🏢 *Company:* ${job.company}\n` +
    `📍 *Location:* ${job.location}\n` +
    `🕒 *Type:* ${job.type_label}\n\n` +
    `📝 *Description:*\n${job.description}\n\n` +
    `♿ *Accessibility & Accommodations:*\n${job.accessibilityOrAccommodation}\n\n` +
    `🤝 *Interview Accommodations Supported:*\n` +
    (job.interviewAccommodationsOffered.map(a => `• ${a}`).join('\n') || '• Custom accommodations on request') +
    `\n\n_Note: This is a simulated job opportunity for training & demonstration._`;

  const now = new Date().toISOString();
  const token = process.env.TELEGRAM_BOT_TOKEN;

  // If live bot token configured, dispatch to Telegram API
  if (token && targetChatId) {
    // Live dispatch logic (optional fallback to mock if API unreachable)
    try {
      const postData = JSON.stringify({
        chat_id: targetChatId,
        text: messageText,
        parse_mode: 'Markdown'
      });
      const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      });
      req.write(postData);
      req.end();
    } catch (e) {
      // Non-fatal fallback
    }
  }

  return {
    success: true,
    jobId: job.id,
    targetChatId: targetChatId || 'broadcast_all_subscribers',
    totalRecipients: targetChatId ? 1 : Math.max(1, telegramSubscribers.size),
    formattedMessage: messageText,
    isSimulated: !Boolean(token),
    status: 'dispatched_or_simulated',
    dispatchedAt: now
  };
}

/**
 * Returns Telegram integration configuration status
 */
function getTelegramStatus() {
  const hasToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  return {
    isConfigured: hasToken,
    botUsername: hasToken ? (process.env.TELEGRAM_BOT_USERNAME || '@Voice4AllBot') : '@Voice4AllJobsDemoBot (Simulated)',
    subscribersCount: telegramSubscribers.size,
    mode: hasToken ? 'live_gateway' : 'simulated_demo',
    channelNotice: 'Telegram notifications provide low-bandwidth accessible alerts for learners across Africa.'
  };
}

// =========================================================================
// SMS-Compatible Notification Interface (Low Bandwidth)
// =========================================================================

/**
 * Formats a job alert into a concise, standard 160-character SMS segment
 * @param {Object} job
 * @param {string} [lang='en']
 * @returns {{text: string, charCount: number, segments: number, isSingleSegment: boolean}}
 */
function formatJobSMS(job, lang = 'en') {
  const isAm = (lang === 'am');
  let smsText = '';

  if (isAm) {
    // Amharic SMS (UCS-2 encoding, 70 chars per single segment)
    const title = job.title_am || job.title;
    smsText = `[Voice4All] ${title} (${job.company})። የርቀት ሥራ። ስክሪን አንባቢ ይደገፋል። ዝርዝር: v4a.alx/j/${job.id} ማቆም: STOP`;
  } else {
    // Standard English GSM-7 (160 characters per segment)
    const shortTitle = job.title.length > 25 ? job.title.substring(0, 22) + '...' : job.title;
    const shortComp = job.company.replace(' (Sample)', '');
    smsText = `[Voice4All Job] ${shortTitle} at ${shortComp}. Screen-reader ok. Remote. Apply/Draft: v4a.alx/j/${job.id} Msg STOP to unsub`;
  }

  const charCount = smsText.length;
  const maxPerSegment = isAm ? 70 : 160;
  const segments = Math.ceil(charCount / maxPerSegment);

  return {
    text: smsText,
    charCount,
    maxPerSegment,
    segments,
    isSingleSegment: segments === 1
  };
}

/**
 * Previews SMS message and segment count for any sample job
 * @param {string} jobId
 * @param {string} [lang='en']
 * @returns {Object} SMS preview and technical metrics
 */
function previewJobSMS(jobId, lang = 'en') {
  const job = getJobById(jobId, lang);
  if (!job) {
    const error = new Error(`Job not found for ID: ${jobId}`);
    error.statusCode = 404;
    throw error;
  }

  const smsMetrics = formatJobSMS(job, lang);
  return {
    success: true,
    jobId: job.id,
    language: lang,
    encoding: lang === 'am' ? 'UCS-2 (Amharic / Unicode)' : 'GSM-7 (Standard)',
    ...smsMetrics,
    complianceNotice: smsMetrics.isSingleSegment
      ? 'Complies with single-segment 160-char carrier limit.'
      : `Splits across ${smsMetrics.segments} SMS segments.`
  };
}

/**
 * Subscribes a phone number for SMS job notifications
 * @param {Object} payload
 * @returns {Object} Subscription receipt
 */
function subscribeSMS(payload = {}) {
  const phoneNumber = String(payload.phoneNumber || payload.phone || '').trim();
  if (!phoneNumber || phoneNumber.length < 9) {
    const error = new Error('A valid phone number (minimum 9 digits) is required.');
    error.statusCode = 400;
    error.field = 'phoneNumber';
    throw error;
  }

  const language = payload.language || 'en';
  const subscriber = {
    phoneNumber,
    language,
    subscribedAt: new Date().toISOString(),
    status: 'active'
  };

  smsSubscribers.set(phoneNumber, subscriber);

  return {
    success: true,
    message: `SMS job notification subscription confirmed for ${phoneNumber}`,
    subscriber,
    isSimulated: true,
    gatewayNotice: 'SIMULATED SMS GATEWAY — Supports low-bandwidth feature-phone access via Africa\'s Talking or Twilio integration.'
  };
}

/**
 * Simulates sending an SMS job alert
 * @param {string} jobId
 * @param {string} phoneNumber
 * @param {string} [lang='en']
 * @returns {Object} Dispatch receipt
 */
function sendJobSMS(jobId, phoneNumber, lang = 'en') {
  const job = getJobById(jobId, lang);
  if (!job) {
    const error = new Error(`Job not found for ID: ${jobId}`);
    error.statusCode = 404;
    throw error;
  }

  const sms = formatJobSMS(job, lang);
  const now = new Date().toISOString();

  return {
    success: true,
    phoneNumber,
    messageId: `SMS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    status: 'simulated_delivered',
    segmentCount: sms.segments,
    messageText: sms.text,
    deliveredAt: now,
    isSimulated: true,
    deliveryNotice: 'SIMULATED SMS DISPATCH: Low-bandwidth SMS alert formatted and logged. No real carrier fees charged.'
  };
}

module.exports = {
  getJobs,
  getJobById,
  askCareerQuestion,
  createAccommodationRequest,
  getAccommodationDraft,
  listAccommodationDrafts,
  subscribeTelegram,
  broadcastJobTelegram,
  getTelegramStatus,
  formatJobSMS,
  previewJobSMS,
  subscribeSMS,
  sendJobSMS,
  getJobsPath
};
module.exports.default = module.exports;
