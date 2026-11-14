/**
 * Voice4All Phase 3 Master Verification Suite
 * Tests all Human Assistance, Career Gateway, Telegram & SMS Notification deliverables.
 */

const http = require('http');
const app = require('../src/server');
const notificationService = require('../src/services/notification.service');
const careerService = require('../src/services/career.service');
const supportService = require('../src/services/support.service');

require('../../assets/js/voice4all/support/support-client.js');
const supportClientModule = globalThis.Voice4AllSupportClient;

require('../../assets/js/voice4all/career/career-client.js');
const careerClientModule = globalThis.Voice4AllCareerClient;

const TEST_PORT = 5077;

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runPhase3Tests() {
  console.log('================================================================');
  console.log('   VOICE4ALL — PHASE 3 MASTER VERIFICATION SUITE                ');
  console.log('   Human Help Workflow, Career Gateway & Notifications          ');
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
    // PART 1: HUMAN ASSISTANCE WORKFLOW (Tasks 1-6)
    // -------------------------------------------------------------
    console.log('>>> 1. Human Assistance & Support Queue Workflow:');

    let ticketId = null;

    // 1.1 Support request submission
    await test('Task 1: Learner submits actual support request connected to course context', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        topic: 'Screen Navigation Help',
        message: 'I am struggling to find the quiz submission button.',
        preferred_mode: 'screen_share',
        urgency: 'high',
        language: 'en',
        context: {
          courseTitle: 'VA-1: VA Foundations & Professional Identity',
          moduleTitle: 'Module 2: What is a VA',
          lessonTitle: 'The Future of the VA Industry'
        },
        consent: {
          screenShareRequested: true,
          screenShareConsent: true
        }
      });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      if (!res.body.requestId || !res.body.requestId.startsWith('REQ-')) {
        throw new Error(`Expected REQ- format, got ${res.body.requestId}`);
      }
      ticketId = res.body.requestId;
    });

    // 1.2 Support Dashboard connection
    await test('Task 1: Support dashboard endpoint reflects actual learner request in queue', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/queue',
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const found = res.body.queue.find(t => t.requestId === ticketId);
      if (!found) throw new Error(`Ticket ${ticketId} was not found in the live queue!`);
      if (found.context.courseTitle !== 'VA-1: VA Foundations & Professional Identity') {
        throw new Error('Course context was not retained in queue');
      }
    });

    // 1.3 Reliable Status Updates
    await test('Task 2: GET /api/support/requests/:id tracks reliable status and queue position', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/support/requests/${ticketId}`,
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.status !== 'queued') throw new Error(`Expected status 'queued', got ${res.body.status}`);
      if (res.body.humanConnected !== false) throw new Error('Honest policy violated: humanConnected must be FALSE while queued');
      if (typeof res.body.queuePosition !== 'number') throw new Error('Missing numeric queuePosition');
    });

    // 1.4 Real Agent Assignment & Messaging
    await test('Task 3: Agent assigns ticket, connects live, and exchanges messages', async () => {
      // Agent claims ticket
      const assignRes = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/support/requests/${ticketId}/assign`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        agentName: 'Mentor Grace (Support Specialist)',
        agentId: 'agent-grace'
      });

      if (assignRes.status !== 200) throw new Error(`Expected 200, got ${assignRes.status}`);
      if (assignRes.body.humanConnected !== true) throw new Error('humanConnected should now be TRUE');
      if (assignRes.body.screen_share_active !== true) throw new Error('screen_share_active should now be TRUE (consented + agent connected)');

      // Learner sends follow-up message
      const msgRes = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/support/requests/${ticketId}/messages`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        sender: 'learner',
        senderName: 'Amara',
        text: 'Thank you Mentor Grace! Can you see the top navigation bar?'
      });

      if (msgRes.status !== 201) throw new Error(`Expected 201, got ${msgRes.status}`);
      if (msgRes.body.totalMessages < 3) throw new Error('Message thread should contain initial, greeting, and learner reply');
    });

    // 1.5 Immediate Stop-Sharing Control
    await test('Task 5: Learner can stop screen sharing immediately', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/support/requests/${ticketId}/screen-share/stop`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        stoppedBy: 'learner'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.screen_share_active !== false) throw new Error('screen_share_active must be FALSE immediately');
      if (res.body.screenShareStatus !== 'stopped') throw new Error('screenShareStatus must be stopped');
    });

    // 1.6 Verify Actual Media Transmission vs Signaling
    await test('Task 6: Distinguishes local MediaStream capture & signaling from peer transmission', async () => {
      // Test frontend SupportClient diagnostics
      const diagnostics = supportClientModule.verifyScreenShareStatus();
      if (diagnostics.isRemotePeerTransmitting !== false) {
        throw new Error('STRICT HONESTY VIOLATION: isRemotePeerTransmitting must be FALSE without an SFU/WebRTC peer connection!');
      }
      if (!diagnostics.diagnosticsNotice) {
        throw new Error('Missing diagnostics transparency notice');
      }
    });

    // -------------------------------------------------------------
    // PART 2: CAREER GATEWAY (Tasks 7-9)
    // -------------------------------------------------------------
    console.log('\n>>> 2. Career Gateway & Grounded Inquiries:');

    // 2.1 Improved Job Browsing & Filtering
    await test('Task 7: Multilingual job browsing and accessible criteria filtering', async () => {
      // Type and location filter
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/jobs?type=remote&location=Pan-Africa',
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.jobs.length === 0) throw new Error('Expected at least 1 remote Pan-Africa role');
      const job = res.body.jobs[0];
      if (!job.interviewAccommodationsOffered || job.interviewAccommodationsOffered.length === 0) {
        throw new Error('Missing interviewAccommodationsOffered list');
      }

      // Amharic localization check
      const amRes = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/jobs?lang=am',
        method: 'GET'
      });
      if (amRes.status !== 200) throw new Error(`Expected 200, got ${amRes.status}`);
      if (!amRes.body.jobs[0].title.includes('ረዳት') && !amRes.body.jobs[0].title.includes('ቪኤ')) {
        throw new Error('Expected Amharic job title');
      }
    });

    // 2.2 Grounded Career Q&A
    await test('Task 8: Career questions return answers grounded in the job dataset with citations', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/questions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'Which jobs offer screen reader accommodations and flexible hours?',
        language: 'en'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.answer.includes('Executive Virtual Assistant') && !res.body.answer.includes('AfriTech')) {
        throw new Error('Answer was not grounded in the jobs dataset');
      }
      if (res.body.matchedJobsCount === 0) throw new Error('Expected matchedJobsCount > 0');
      if (!Array.isArray(res.body.suggestions)) throw new Error('Expected follow-up suggestions');
    });

    // 2.3 Accommodation Request Preparation with Self-Advocacy Checklist
    await test('Task 9: Accommodation request preparation generates draft and self-advocacy guide', async () => {
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
          'Live human captions and transcript during video calls'
        ],
        details: 'Enables cognitive decompression and clear participation.',
        contact_email: 'amara@voice4all.demo',
        language: 'en'
      });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      if (res.body.isDelivered !== false) throw new Error('STRICT HONESTY VIOLATION: isDelivered must be FALSE!');
      if (res.body.deliveryStatus !== 'NOT_SENT_DRAFT_ONLY') throw new Error('deliveryStatus must be NOT_SENT_DRAFT_ONLY');
      if (!res.body.deliveryNotice.includes('NOT been sent to the employer')) throw new Error('Missing delivery notice');
      
      // Test copyable email formatter in career client
      const copyText = careerClientModule.formatSelfAdvocacyEmail(res.body.draft);
      if (!copyText.includes('Subject: Interview Accommodation Request')) {
        throw new Error('Self-advocacy email formatting failed');
      }
    });

    // -------------------------------------------------------------
    // PART 3: TELEGRAM & SMS NOTIFICATIONS (Tasks 10-15)
    // -------------------------------------------------------------
    console.log('\n>>> 3. Telegram & SMS Notifications Integration:');

    // 3.1 Telegram Subscription
    await test('Task 10 & 13: Configure bot status and test learner subscription', async () => {
      const statusRes = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/notifications/telegram/status',
        method: 'GET'
      });
      if (statusRes.status !== 200) throw new Error(`Expected 200, got ${statusRes.status}`);

      const subRes = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/notifications/telegram/subscribe',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        chatId: '123456789',
        username: 'AmaraVA',
        language: 'en'
      });

      if (subRes.status !== 200) throw new Error(`Expected 200, got ${subRes.status}`);
      if (subRes.body.subscriber.chatId !== '123456789') throw new Error('chatId mismatch');
    });

    // 3.2 Telegram Delivery & Honest Failure Message Handling (Task 14 & 15)
    await test('Task 14 & 15: Telegram alert delivery and clear failure message when token is missing', async () => {
      const alertRes = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/notifications/telegram/broadcast',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        jobId: 'v4a-job-001',
        chatId: '123456789'
      });

      if (alertRes.status !== 200) throw new Error(`Expected 200, got ${alertRes.status}`);
      // When TELEGRAM_BOT_TOKEN is not in .env:
      if (!process.env.TELEGRAM_BOT_TOKEN) {
        if (alertRes.body.deliveryStatus !== 'unavailable') {
          throw new Error(`Expected deliveryStatus 'unavailable', got ${alertRes.body.deliveryStatus}`);
        }
        if (!alertRes.body.message.includes('TELEGRAM_BOT_TOKEN is not configured')) {
          throw new Error('Missing clear failure message regarding missing bot token');
        }
        if (!alertRes.body.formattedMessage.includes('Voice4All Accessible Career Alert')) {
          throw new Error('Should provide formatted alert preview even on simulated failure');
        }
      }
    });

    // 3.3 SMS Provider Adapter & 160-Character Compliance (Task 11 & 12)
    await test('Task 11 & 12: Honest SMS integration adapter with 160-char segment calculator and labeled simulated delivery', async () => {
      // 1. Preview
      const prevRes = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career/notifications/sms/preview',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        jobId: 'v4a-job-001',
        lang: 'en'
      });

      if (prevRes.status !== 200) throw new Error(`Expected 200, got ${prevRes.status}`);
      if (prevRes.body.charCount > 160) {
        throw new Error(`English SMS exceeded 160 chars (${prevRes.body.charCount})`);
      }
      if (prevRes.body.isSingleSegment !== true) throw new Error('Expected 1 segment for English SMS');

      // 2. Dispatch
      const sendRes = await request({
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

      if (sendRes.status !== 200) throw new Error(`Expected 200, got ${sendRes.status}`);
      if (!sendRes.body.disclaimer.includes('SIMULATED DELIVERY')) {
        throw new Error('STRICT HONESTY VIOLATION: Must clearly label simulated delivery when cellular credentials are not in .env!');
      }
      if (sendRes.body.isLiveDelivery !== false) {
        throw new Error('isLiveDelivery must be FALSE without provider credentials');
      }
    });

    console.log('\n================================================================');
    console.log(` PHASE 3 MASTER SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

  } finally {
    server.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
