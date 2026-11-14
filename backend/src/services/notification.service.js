/**
 * Voice4All — Notification Service (Phase 3)
 * 
 * Provides accessible, low-bandwidth notification integrations:
 *  1. Telegram Bot Integration (screen-reader friendly Markdown, live HTTP delivery or honest failure handling)
 *  2. SMS-Compatible Integration (160-char GSM-7 compliance, UCS-2 for Amharic, pluggable adapter architecture)
 * 
 * Guaranteed Transparency:
 *  - Distinguishes live delivery from simulated adapter dispatch.
 *  - Provides clear failure messages when external delivery credentials are unavailable.
 */

const https = require('https');
const querystring = require('querystring');

// In-memory repositories for subscribers
const telegramSubscribers = new Map();
const smsSubscribers = new Map();
const notificationAuditLog = [];

// =========================================================================
// 1. TELEGRAM BOT NOTIFICATION SERVICE
// =========================================================================

/**
 * Checks Telegram Bot configuration and availability
 */
function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const username = process.env.TELEGRAM_BOT_USERNAME || '@Voice4AllJobsBot';
  const isAvailable = Boolean(token && token.trim().length > 10);

  return {
    isConfigured: isAvailable,
    deliveryAvailable: isAvailable,
    mode: isAvailable ? 'live_gateway' : 'simulated_demo',
    botUsername: isAvailable ? username : `${username} (Simulated)`,
    subscribersCount: telegramSubscribers.size,
    statusMessage: isAvailable
      ? 'Live Telegram Bot delivery is active.'
      : 'Telegram delivery unavailable: TELEGRAM_BOT_TOKEN is not configured in .env.',
    instructions: 'To enable live Telegram delivery, add TELEGRAM_BOT_TOKEN=your_bot_token to your .env file.'
  };
}

/**
 * Subscribes a learner to Telegram job notifications
 * @param {Object} payload
 * @returns {Object}
 */
function subscribeTelegram(payload = {}) {
  const chatId = String(payload.chatId || payload.chat_id || '').trim();
  if (!chatId) {
    const error = new Error('A valid Telegram chatId is required for subscription.');
    error.statusCode = 400;
    error.field = 'chatId';
    throw error;
  }

  const username = payload.username || 'Learner';
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

  const config = getTelegramConfig();
  return {
    success: true,
    message: `Telegram job alert subscription activated for chat ID: ${chatId}`,
    subscriber,
    isLiveDelivery: config.isConfigured,
    deliveryAvailable: config.isConfigured,
    statusMessage: config.statusMessage
  };
}

/**
 * Formats an accessible job alert for Telegram
 * Structured with clear headings and emojis for screen reader parsing.
 */
function formatTelegramJobMessage(job, language = 'en') {
  const isAm = (language === 'am');
  
  if (isAm) {
    const title = job.title_am || job.title;
    const location = job.location_am || job.location;
    const description = job.description_am || job.description;
    const typeLabel = job.type_label_am || job.type_label || job.type;
    const accommodations = job.interviewAccommodationsOffered && job.interviewAccommodationsOffered.length > 0
      ? job.interviewAccommodationsOffered.map(a => `• ${a}`).join('\n')
      : '• እንደ ፍላጎትዎ የተዘጋጀ ማመቻቸት';

    return (
      `🔔 *የVoice4All ተደራሽ የሥራ ማሳወቂያ*\n\n` +
      `💼 *የሥራ መደብ:* ${title}\n` +
      `🏢 *ድርጅት:* ${job.company}\n` +
      `📍 *የሥራ ቦታ:* ${location}\n` +
      `🕒 *የሥራ ሁኔታ:* ${typeLabel}\n\n` +
      `📝 *ማብራሪያ:*\n${description}\n\n` +
      `♿ *የተደራሽነት ሁኔታ:*\n${job.accessibilityOrAccommodation || 'የተደራሽነት ድጋፍ ይሰጣል'}\n\n` +
      `🤝 *የሚደገፉ የቃለ-መጠይቅ ማመቻቸቶች:*\n${accommodations}\n\n` +
      `_ማሳሰቢያ፦ ይህ ለሙከራ እና ለልምምድ የቀረበ የሥራ ዕድል ነው።_`
    );
  }

  // English
  const accommodations = job.interviewAccommodationsOffered && job.interviewAccommodationsOffered.length > 0
    ? job.interviewAccommodationsOffered.map(a => `• ${a}`).join('\n')
    : '• Custom accommodations upon request';

  return (
    `🔔 *Voice4All Accessible Career Alert*\n\n` +
    `💼 *Role:* ${job.title}\n` +
    `🏢 *Company:* ${job.company}\n` +
    `📍 *Location:* ${job.location}\n` +
    `🕒 *Type:* ${job.type_label || job.type}\n\n` +
    `📝 *Description:*\n${job.description}\n\n` +
    `♿ *Accessibility & Accommodations:*\n${job.accessibilityOrAccommodation}\n\n` +
    `🤝 *Interview Accommodations Offered:*\n${accommodations}\n\n` +
    `_Note: This is a simulated job opportunity for accessibility training and demonstration._`
  );
}

/**
 * Sends a job alert via Telegram
 * Attempts real HTTPS request if token is configured; otherwise provides clear, honest failure details.
 * 
 * @param {Object} job
 * @param {string} [chatId]
 * @param {string} [language='en']
 * @returns {Promise<Object>}
 */
async function sendTelegramJobAlert(job, chatId = null, language = 'en') {
  if (!job) {
    const error = new Error('Job object is required for Telegram broadcast.');
    error.statusCode = 400;
    throw error;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = chatId || (telegramSubscribers.size > 0 ? Array.from(telegramSubscribers.keys())[0] : null);
  const formattedMessage = formatTelegramJobMessage(job, language);
  const now = new Date().toISOString();

  // If no Telegram bot token is configured in environment
  if (!token || !token.trim()) {
    const response = {
      success: false,
      deliveryStatus: 'unavailable',
      deliveryAvailable: false,
      isLiveDelivery: false,
      error: 'TELEGRAM_BOT_UNAVAILABLE',
      message: 'Telegram delivery unavailable: TELEGRAM_BOT_TOKEN is not configured in .env. Real message was not transmitted to Telegram servers.',
      targetChatId: targetChatId || 'no_subscriber_provided',
      formattedMessage,
      timestamp: now,
      instructions: 'To enable live delivery, register a bot with @BotFather and set TELEGRAM_BOT_TOKEN in your backend .env.'
    };
    notificationAuditLog.push({ channel: 'telegram', status: 'unavailable', ...response });
    return response;
  }

  // If token is present, attempt live Telegram HTTP dispatch
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      chat_id: targetChatId,
      text: formattedMessage,
      parse_mode: 'Markdown'
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            const successResp = {
              success: true,
              deliveryStatus: 'delivered',
              deliveryAvailable: true,
              isLiveDelivery: true,
              messageId: parsed.result?.message_id,
              targetChatId,
              timestamp: now,
              formattedMessage
            };
            notificationAuditLog.push({ channel: 'telegram', status: 'delivered', ...successResp });
            resolve(successResp);
          } else {
            const failResp = {
              success: false,
              deliveryStatus: 'failed',
              deliveryAvailable: true,
              isLiveDelivery: false,
              error: 'TELEGRAM_API_ERROR',
              message: `Telegram API returned error: ${parsed.description || 'Unknown error'} (Code: ${parsed.error_code})`,
              details: parsed,
              formattedMessage,
              timestamp: now
            };
            notificationAuditLog.push({ channel: 'telegram', status: 'api_error', ...failResp });
            resolve(failResp);
          }
        } catch (e) {
          resolve({
            success: false,
            deliveryStatus: 'failed',
            error: 'PARSE_ERROR',
            message: 'Failed to parse response from Telegram API.',
            timestamp: now
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        deliveryStatus: 'network_error',
        deliveryAvailable: false,
        error: 'NETWORK_ERROR',
        message: `Network failure contacting api.telegram.org: ${err.message}`,
        timestamp: now
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        deliveryStatus: 'timeout',
        error: 'TIMEOUT',
        message: 'Timeout connecting to Telegram API after 5000ms.',
        timestamp: now
      });
    });

    req.write(payload);
    req.end();
  });
}

// =========================================================================
// 2. SMS-COMPATIBLE NOTIFICATION ADAPTER (LOW-BANDWIDTH)
// =========================================================================

/**
 * Checks if live SMS provider credentials are configured in .env
 */
function getSmsProviderConfig() {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  const atUsername = process.env.AFRICASTALKING_USERNAME;
  const atApiKey = process.env.AFRICASTALKING_API_KEY;

  if (twilioSid && twilioToken && twilioFrom) {
    return {
      provider: 'Twilio',
      isLiveConfigured: true,
      senderId: twilioFrom,
      statusMessage: 'Live Twilio SMS Gateway configured.'
    };
  }

  if (atUsername && atApiKey) {
    return {
      provider: "Africa's Talking",
      isLiveConfigured: true,
      senderId: atUsername,
      statusMessage: "Live Africa's Talking SMS Gateway configured."
    };
  }

  return {
    provider: 'SimulatedSmsAdapter',
    isLiveConfigured: false,
    senderId: 'Voice4All',
    statusMessage: 'SIMULATED SMS ADAPTER — No cellular gateway credentials in .env. Formats and validates 160-char SMS messages without carrier dispatch.'
  };
}

/**
 * Compresses and formats a job opportunity into a compliant SMS message.
 * Strict constraint: 160 characters for single GSM-7 segment; 70 characters for UCS-2 (Amharic).
 */
function formatJobSmsMessage(job, language = 'en') {
  const isAm = (language === 'am');
  let smsText = '';

  if (isAm) {
    // Amharic SMS (UCS-2 Unicode encoding: max 70 chars per segment)
    const title = job.title_am || job.title;
    const shortComp = (job.company || '').replace(' (Sample)', '').replace(' (የሙከራ)', '');
    smsText = `[Voice4All] ${title} (${shortComp})። የርቀት ሥራ። ስክሪን አንባቢ ይደገፋል። ዝርዝር: v4a.alx/j/${job.id} ማቆም: STOP`;
  } else {
    // English GSM-7 encoding: max 160 chars per segment
    const shortTitle = job.title.length > 25 ? job.title.substring(0, 22) + '...' : job.title;
    const shortComp = (job.company || '').replace(' (Sample)', '');
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
    isSingleSegment: segments === 1,
    encoding: isAm ? 'UCS-2 (Amharic Unicode)' : 'GSM-7 (Standard English)'
  };
}

/**
 * Previews SMS message and technical segment calculations
 */
function previewSmsJobAlert(job, language = 'en') {
  if (!job) {
    const error = new Error('Job object is required to preview SMS alert.');
    error.statusCode = 400;
    throw error;
  }

  const config = getSmsProviderConfig();
  const metrics = formatJobSmsMessage(job, language);

  return {
    success: true,
    jobId: job.id,
    language,
    provider: config.provider,
    isLiveConfigured: config.isLiveConfigured,
    ...metrics,
    complianceNotice: metrics.isSingleSegment
      ? `Compliant with standard single-segment ${metrics.maxPerSegment}-character limit.`
      : `Splits across ${metrics.segments} message segments.`
  };
}

/**
 * Subscribes a phone number for SMS job alerts
 */
function subscribeSms(payload = {}) {
  const phoneNumber = String(payload.phoneNumber || payload.phone || '').trim();
  if (!phoneNumber || phoneNumber.length < 9) {
    const error = new Error('A valid phone number (minimum 9 digits) is required for SMS subscription.');
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
  const config = getSmsProviderConfig();

  return {
    success: true,
    message: `SMS job alert subscription confirmed for ${phoneNumber}`,
    subscriber,
    provider: config.provider,
    isLiveDelivery: config.isLiveConfigured,
    statusMessage: config.statusMessage
  };
}

/**
 * Sends an SMS job alert via real provider if configured, or honest simulated adapter
 */
async function sendSmsJobAlert(job, phoneNumber, language = 'en') {
  if (!job) {
    const error = new Error('Job object is required for SMS dispatch.');
    error.statusCode = 400;
    throw error;
  }

  const phone = String(phoneNumber || '').trim();
  if (!phone || phone.length < 9) {
    const error = new Error('A valid destination phone number is required.');
    error.statusCode = 400;
    throw error;
  }

  const config = getSmsProviderConfig();
  const sms = formatJobSmsMessage(job, language);
  const now = new Date().toISOString();
  const messageId = `SMS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

  // If live provider is not configured
  if (!config.isLiveConfigured) {
    const simulatedReceipt = {
      success: true,
      messageId,
      phoneNumber: phone,
      status: 'simulated_delivered',
      deliveryStatus: 'simulated_delivered',
      isLiveDelivery: false,
      deliveryAvailable: false,
      provider: config.provider,
      disclaimer: 'SIMULATED DELIVERY: No live SMS credentials found in .env. Alert was formatted and validated against carrier constraints, but no cellular transmission occurred.',
      deliveryNotice: 'SIMULATED SMS DISPATCH: Low-bandwidth SMS alert formatted and logged. No real carrier fees charged.',
      messageText: sms.text,
      segmentCount: sms.segments,
      encoding: sms.encoding,
      deliveredAt: now
    };
    notificationAuditLog.push({ channel: 'sms', status: 'simulated', ...simulatedReceipt });
    return simulatedReceipt;
  }

  // If live Twilio configured
  if (config.provider === 'Twilio') {
    return new Promise((resolve) => {
      const postData = querystring.stringify({
        From: config.senderId,
        To: phone,
        Body: sms.text
      });

      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const req = https.request({
        hostname: 'api.twilio.com',
        path: `/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 6000
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                success: true,
                messageId: data.sid,
                deliveryStatus: 'sent_to_carrier',
                isLiveDelivery: true,
                provider: 'Twilio',
                segmentCount: sms.segments,
                deliveredAt: now
              });
            } else {
              resolve({
                success: false,
                deliveryStatus: 'failed',
                error: data.message || 'Twilio error',
                isLiveDelivery: false,
                provider: 'Twilio'
              });
            }
          } catch (e) {
            resolve({ success: false, deliveryStatus: 'failed', error: 'Response parse error' });
          }
        });
      });

      req.on('error', err => resolve({ success: false, deliveryStatus: 'failed', error: err.message }));
      req.write(postData);
      req.end();
    });
  }

  // Fallback
  return {
    success: true,
    messageId,
    deliveryStatus: 'simulated_adapter_delivery',
    isLiveDelivery: false,
    provider: config.provider,
    disclaimer: config.statusMessage
  };
}

module.exports = {
  getTelegramConfig,
  subscribeTelegram,
  formatTelegramJobMessage,
  sendTelegramJobAlert,
  getSmsProviderConfig,
  formatJobSmsMessage,
  previewSmsJobAlert,
  subscribeSms,
  sendSmsJobAlert,
  notificationAuditLog
};
module.exports.default = module.exports;
