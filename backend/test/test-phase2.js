/**
 * Voice4All Phase 2 Comprehensive Test Suite
 * Tests all Human Support & Career endpoints and requirements.
 */

const http = require('http');
const app = require('../src/server');

const TEST_PORT = 5088;

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runPhase2Tests() {
  console.log('================================================================');
  console.log('   VOICE4ALL — PHASE 2 VERIFICATION SUITE                       ');
  console.log('   Human Support & Career Modules Integration Tests             ');
  console.log('================================================================\n');

  const server = app.listen(TEST_PORT);
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error('         Error:', err.message);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // PART 1: HUMAN SUPPORT QUEUE & HONEST CONNECTIVITY
    // -------------------------------------------------------------
    console.log('>>> 1. Human Support Queue & Honest Connectivity:');

    let ticketId1 = null;
    let ticketId2 = null;

    // 1.1 Create Ticket with chat mode
    await test('POST /api/support/requests creates ticket with REQ-YYYY-XXXX format', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        topic: 'Lesson Clarification',
        message: 'Could you explain the difference between human VAs and AI assistants in Module 2?',
        preferred_mode: 'chat',
        urgency: 'medium',
        language: 'en',
        context: {
          courseTitle: 'VA-1: VA Foundations & Professional Identity',
          moduleTitle: 'Module 2: What is a VA',
          lessonTitle: 'The Future of the VA Industry'
        }
      });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      if (!res.body.requestId || !res.body.requestId.startsWith('REQ-')) {
        throw new Error(`Expected requestId starting with REQ-, got ${res.body.requestId}`);
      }
      if (res.body.status !== 'queued') throw new Error(`Expected status 'queued', got ${res.body.status}`);
      
      // HONESTY ASSERTION: No human should be claimed connected while queued
      if (res.body.humanConnected !== false) {
        throw new Error('VIOLATION: humanConnected must be FALSE while in queue!');
      }
      if (res.body.screen_share_active !== false) {
        throw new Error('VIOLATION: screen_share_active must be FALSE!');
      }
      if (!res.body.connectionNotice.includes('No human agent is currently connected')) {
        throw new Error('Missing honest connectivity notice');
      }

      ticketId1 = res.body.requestId;
    });

    // 1.2 Reject empty message
    await test('POST /api/support/requests with empty message returns 400 Bad Request', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { message: '   ' });

      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (!res.body.error) throw new Error('Expected error message');
    });

    // 1.3 Create Ticket with Screen Share (Consented)
    await test('POST /api/support/requests with explicit screen share consent queues honestly', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        topic: 'Screen Navigation Help',
        message: 'I cannot locate the recap quiz button on my screen.',
        preferred_mode: 'screen_share',
        urgency: 'high',
        consent: {
          screenShareRequested: true,
          screenShareConsent: true
        }
      });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      // Still false because NO agent has joined yet!
      if (res.body.screen_share_active !== false) {
        throw new Error('Screen sharing must NOT be active until human agent joins!');
      }
      if (res.body.ticket.screenShareStatus !== 'consent_granted_pending_agent') {
        throw new Error(`Expected 'consent_granted_pending_agent', got ${res.body.ticket.screenShareStatus}`);
      }
      ticketId2 = res.body.requestId;
    });

    // 1.4 Get Full Support Queue
    await test('GET /api/support/queue returns active queue items and summary metrics', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/queue',
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.queue)) throw new Error('Expected queue array');
      if (res.body.stats.queued < 2) throw new Error(`Expected at least 2 queued tickets, got ${res.body.stats.queued}`);
      if (res.body.isSimulated !== true) throw new Error('Queue must be flagged isSimulated: true');
    });

    // 1.5 Support Person Claims Ticket (Assign Agent)
    await test('POST /api/support/requests/:id/assign establishes real human connection', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/support/requests/${ticketId2}/assign`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        agentName: 'Mentor Grace (Support Specialist)',
        agentId: 'agent-grace'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.humanConnected !== true) throw new Error('humanConnected should now be TRUE');
      // Because learner had previously consented to screen sharing, agent joining activates session
      if (res.body.screen_share_active !== true) throw new Error('screen_share_active should now be TRUE');
      if (res.body.ticket.agentName !== 'Mentor Grace (Support Specialist)') throw new Error('Agent name not recorded');
    });

    // 1.6 Clear Stop-Sharing Control
    await test('POST /api/support/requests/:id/screen-share/stop immediately terminates sharing', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/support/requests/${ticketId2}/screen-share/stop`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        stoppedBy: 'learner'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.screen_share_active !== false) throw new Error('screen_share_active must be FALSE after stop');
      if (res.body.screenShareStatus !== 'stopped') throw new Error(`Expected screenShareStatus 'stopped', got ${res.body.screenShareStatus}`);
      if (!res.body.message.includes('successfully stopped')) throw new Error('Missing stop confirmation message');
    });

    // 1.7 Global Stop Screen Sharing Control
    await test('POST /api/support/screen-share/stop global stop control works', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/screen-share/stop',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        requestId: ticketId1,
        stoppedBy: 'learner'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.screen_share_active !== false) throw new Error('Must confirm stopped');
    });

    // 1.8 Support Person Dashboard UI
    await test('GET /api/support/dashboard serves accessible HTML support portal', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/dashboard',
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (typeof res.body !== 'string' || !res.body.includes('Voice4All Support-Person Workspace')) {
        throw new Error('Dashboard did not return expected HTML content');
      }
      if (!res.body.includes('SIMULATED WORKSPACE')) throw new Error('Dashboard must include simulation banner');
    });

    // 1.9 Resolve Ticket
    await test('POST /api/support/requests/:id/resolve marks ticket resolved', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/support/requests/${ticketId2}/resolve`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        resolutionNotes: 'Guided learner to recap quiz button; quiz successfully submitted.'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.ticket.status !== 'resolved') throw new Error(`Expected status 'resolved', got ${res.body.ticket.status}`);
    });

    // -------------------------------------------------------------
    // PART 2: CAREER MODULE
    // -------------------------------------------------------------
    console.log('\n>>> 2. Career Opportunities, Q&A, and Accommodations:');

    // 2.1 Job Browsing
    await test('GET /api/career/jobs returns sample jobs with full accessibility disclosures', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/jobs',
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.jobs) || res.body.jobs.length < 4) throw new Error('Expected at least 4 jobs');
      
      const job = res.body.jobs[0];
      if (!job.id || !job.title || !job.accessibilityOrAccommodation) {
        throw new Error('Job missing required accessibility disclosures');
      }
      if (!Array.isArray(job.interviewAccommodationsOffered)) {
        throw new Error('Missing interviewAccommodationsOffered array');
      }
    });

    // 2.2 Filter by Keyword
    await test('GET /api/career/jobs?q=screen+reader filters accessible roles', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/jobs?q=screen+reader',
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.jobs.length === 0) throw new Error('Expected matches for screen reader filter');
    });

    // 2.3 Filter by Language (Amharic)
    await test('GET /api/career/jobs?lang=am returns Amharic localized job listings', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/jobs?lang=am',
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const amJob = res.body.jobs[0];
      if (!amJob.title_am || !amJob.description_am) {
        throw new Error('Missing Amharic localization in job response');
      }
      if (!amJob.title.includes('ረዳት') && !amJob.title.includes('ቪኤ')) {
        throw new Error(`Expected Amharic title text, got: ${amJob.title}`);
      }
    });

    // 2.4 Career Opportunity Q&A (English)
    await test('POST /api/career/questions provides intelligent career guidance with job matches', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/questions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'Which jobs are remote and provide screen reader accommodations?',
        language: 'en'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.answer || typeof res.body.answer !== 'string') throw new Error('Missing answer string');
      if (res.body.matchedJobsCount === 0) throw new Error('Expected matched jobs count > 0');
      if (!Array.isArray(res.body.suggestions) || res.body.suggestions.length === 0) throw new Error('Expected suggested follow-up prompts');
    });

    // 2.5 Career Opportunity Q&A (Amharic)
    await test('POST /api/career/questions handles Amharic queries with localized citations', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/questions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'ስክሪን አንባቢ የሚደግፉ የሥራ ዕድሎች የትኞቹ ናቸው?'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.language !== 'am') throw new Error(`Expected language 'am', got ${res.body.language}`);
      if (!res.body.answer.includes('ስክሪን') && !res.body.answer.includes('ተገኝተዋል')) {
        throw new Error('Expected Amharic answer text');
      }
    });

    // 2.6 Interview Accommodation Request (Member 1 format compatibility)
    await test('POST /api/career/accommodation-requests drafts interview accommodations honestly', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/accommodation-requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        job_id: 'v4a-job-001',
        job_title: 'Executive Virtual Assistant',
        accommodations: [
          'Advance interview questions provided in writing (24 hours prior)',
          'Live human captions and transcript during video calls',
          'Camera-optional conversation format'
        ],
        details: 'Allows cognitive decompression and optimal verbal participation.',
        contact_email: 'amara.learner@example.org',
        language: 'en'
      });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      if (!res.body.draftId || !res.body.draftId.startsWith('ACC-')) {
        throw new Error(`Expected draftId starting with ACC-, got ${res.body.draftId}`);
      }
      if (res.body.isDelivered !== false) {
        throw new Error('STRICT VIOLATION: isDelivered must be FALSE for drafts!');
      }
      if (res.body.deliveryStatus !== 'NOT_SENT_DRAFT_ONLY') {
        throw new Error(`Expected NOT_SENT_DRAFT_ONLY, got ${res.body.deliveryStatus}`);
      }
      if (!res.body.deliveryNotice.includes('NOT been sent to the employer')) {
        throw new Error('Missing clear delivery disclaimer in notice');
      }
      if (!Array.isArray(res.body.interviewChecklist)) {
        throw new Error('Expected interview self-advocacy checklist');
      }
    });

    // -------------------------------------------------------------
    // PART 3: TELEGRAM & SMS INTEGRATIONS
    // -------------------------------------------------------------
    console.log('\n>>> 3. Telegram & Low-Bandwidth SMS Integrations:');

    // 3.1 Telegram Subscription
    await test('POST /api/career/notifications/telegram/subscribe registers learner', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/notifications/telegram/subscribe',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        chatId: '987654321',
        username: 'AmaraVA',
        language: 'en'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.subscriber || res.body.subscriber.chatId !== '987654321') {
        throw new Error('Subscription chatId mismatch');
      }
    });

    // 3.2 Telegram Broadcast
    await test('POST /api/career/notifications/telegram/broadcast formats screen-reader accessible Markdown', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/notifications/telegram/broadcast',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        jobId: 'v4a-job-001',
        chatId: '987654321'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.formattedMessage.includes('Voice4All Accessible Career Alert')) {
        throw new Error('Missing formatted alert header');
      }
      if (!res.body.formattedMessage.includes('Executive Virtual Assistant')) {
        throw new Error('Missing job title in broadcast message');
      }
    });

    // 3.3 Telegram Status Check
    await test('GET /api/career/notifications/telegram/status returns integration telemetry', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/notifications/telegram/status',
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (typeof res.body.subscribersCount !== 'number') throw new Error('Expected subscribersCount');
      if (!res.body.mode) throw new Error('Expected mode description');
    });

    // 3.4 SMS Preview & 160-Character Segment Calculator
    await test('POST /api/career/notifications/sms/preview calculates SMS segments accurately', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/notifications/sms/preview',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        jobId: 'v4a-job-001',
        lang: 'en'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.text || typeof res.body.text !== 'string') throw new Error('Missing SMS text');
      if (res.body.charCount > 160) {
        throw new Error(`SMS exceeded 160 chars (${res.body.charCount})`);
      }
      if (res.body.isSingleSegment !== true) {
        throw new Error('Expected single segment SMS compliance');
      }
    });

    // 3.5 SMS Subscribe & Dispatch
    await test('POST /api/career/notifications/sms/send logs simulated SMS alert', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/notifications/sms/send',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        jobId: 'v4a-job-001',
        phoneNumber: '+251911223344',
        lang: 'en'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.status !== 'simulated_delivered') throw new Error(`Expected simulated_delivered, got ${res.body.status}`);
      if (!res.body.deliveryNotice.includes('SIMULATED SMS DISPATCH')) throw new Error('Missing simulation delivery disclaimer');
    });

    console.log('\n================================================================');
    console.log(` PHASE 2 SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

  } finally {
    server.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
