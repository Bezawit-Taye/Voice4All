/**
 * Voice4All — Phase 4 Member 2 Human Support Test Suite
 * 
 * Verifies:
 *  1. Successful support request submission (POST /api/support/requests)
 *  2. Missing fields validation (missing message -> 400 Bad Request)
 *  3. Invalid request payloads (invalid preferred_mode -> 400 Bad Request)
 *  4. Missing screen share consent (screen share requested without affirmative consent -> 400 Bad Request)
 *  5. Retrieval of support requests list (GET /api/support/requests)
 *  6. Retrieval of an individual support request (GET /api/support/requests/:id)
 *  7. Nonexistent resources handling (GET /api/support/requests/REQ-INVALID -> 404 Not Found)
 *  8. Update request status where authorized (PATCH /api/support/requests/:id/status -> 200 OK)
 *  9. Unauthorized access rejection (role: unauthorized_user trying to update status -> 403 Forbidden)
 * 10. Database persistence check (tickets persist and are reloaded from backend/data/support-tickets.json)
 * 11. Clear stop-sharing control (POST /api/support/requests/:id/screen-share/stop -> 200 OK)
 * 12. Support queue overview and statistics (GET /api/support/queue)
 */

const http = require('http');
const app = require('../src/server');
const supportService = require('../src/services/support.service');

const TEST_PORT = 5096;

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

async function runTests() {
  console.log('================================================================');
  console.log('   VOICE4ALL — PHASE 4: MEMBER 2 HUMAN SUPPORT BACKEND TESTS    ');
  console.log('================================================================\n');

  const server = app.listen(TEST_PORT);
  let createdTicketId = null;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error('       Error:', err.message);
      failed++;
    }
  }

  try {
    // 1. Submit a valid support request
    await test('POST /api/support/requests creates ticket with REQ-YYYY-XXXX format', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        topic: 'Concept Clarification',
        message: 'Could a mentor explain the difference between BLUF and standard executive memos?',
        preferred_mode: 'chat',
        urgency: 'medium',
        language: 'en',
        context: {
          courseTitle: 'WR 100: Fundamentals of Effective Communication',
          moduleTitle: 'Module 2: Professional Written Communication',
          lessonTitle: 'Structuring Clear Workplace Messages & The BLUF Model'
        }
      });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      if (!res.body.success) throw new Error('Expected success: true');
      if (!res.body.requestId || !res.body.requestId.startsWith('REQ-')) {
        throw new Error(`Invalid requestId format: ${res.body.requestId}`);
      }
      if (res.body.humanConnected !== false) {
        throw new Error('Honest Connectivity Violation: humanConnected must be false on submission');
      }
      createdTicketId = res.body.requestId;
    });

    // 2. Missing message field
    await test('POST /api/support/requests rejects missing message with 400 Bad Request', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        topic: 'Screen Reader Question'
      });

      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (res.body.success !== false) throw new Error('Expected success: false');
      if (res.body.field !== 'message') throw new Error(`Expected field: 'message', got ${res.body.field}`);
    });

    // 3. Invalid preferred_mode payload
    await test('POST /api/support/requests rejects invalid preferred_mode with 400 Bad Request', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        message: 'Need help with quiz',
        preferred_mode: 'telepathy_mode'
      });

      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (!res.body.error.includes('Invalid preferred_mode')) {
        throw new Error(`Expected preferred_mode validation error, got: ${res.body.error}`);
      }
    });

    // 4. Missing Screen Share Consent
    await test('POST /api/support/requests rejects screen_share mode without explicit consent', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/requests',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        message: 'I want to share my screen but have not checked consent box',
        preferred_mode: 'screen_share',
        consent: { screenShareConsent: false }
      });

      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (!res.body.error.includes('explicit learner consent')) {
        throw new Error(`Expected consent error message, got: ${res.body.error}`);
      }
    });

    // 5. Retrieve support requests list
    await test('GET /api/support/requests returns list of support requests', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/requests',
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.data) && !Array.isArray(res.body.requests)) {
        throw new Error('Expected array of requests');
      }
      const list = res.body.data || res.body.requests;
      if (list.length === 0) throw new Error('Expected at least one request');
    });

    // 6. Retrieve an individual support request by ID
    await test('GET /api/support/requests/:id returns single ticket details', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/support/requests/${createdTicketId}`,
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.requestId !== createdTicketId) {
        throw new Error(`Expected requestId ${createdTicketId}, got ${res.body.requestId}`);
      }
      if (res.body.status !== 'queued') {
        throw new Error(`Expected status 'queued', got ${res.body.status}`);
      }
    });

    // 7. Nonexistent resources handling
    await test('GET /api/support/requests/REQ-NONEXISTENT returns 404 Not Found', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/requests/REQ-9999-0000-NONEXISTENT',
        method: 'GET'
      });

      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      if (res.body.success !== false) throw new Error('Expected success: false');
    });

    // 8. Update request status where authorized
    await test('PATCH /api/support/requests/:id/status updates status when authorized', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/support/requests/${createdTicketId}/status`,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'agent',
          'x-agent-id': 'agent-mentor-sarah'
        }
      }, {
        status: 'agent_connected',
        agentName: 'Mentor Sarah (Communication Coach)',
        agentId: 'agent-mentor-sarah'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.status !== 'agent_connected') {
        throw new Error(`Expected status 'agent_connected', got ${res.body.status}`);
      }
      if (res.body.humanConnected !== true) {
        throw new Error('Expected humanConnected: true after agent connection');
      }
    });

    // 9. Unauthorized access rejection
    await test('PATCH /api/support/requests/:id/status rejects unauthorized roles with 403 Forbidden', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/support/requests/${createdTicketId}/status`,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'unauthorized_user'
        }
      }, {
        status: 'resolved'
      });

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.success !== false) throw new Error('Expected success: false');
    });

    // 10. Database persistence verification
    await test('Database persistence: Ticket reloads correctly from disk store', async () => {
      // Force reload from backend/data/support-tickets.json
      supportService.loadTicketsFromDisk();
      const ticket = supportService.getSupportRequest(createdTicketId);

      if (!ticket) throw new Error('Persisted ticket was not found after disk reload');
      if (ticket.status !== 'agent_connected') {
        throw new Error(`Expected persisted status 'agent_connected', got ${ticket.status}`);
      }
    });

    // 11. Clear stop-sharing control
    await test('POST /api/support/requests/:id/screen-share/stop terminates screen share', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/support/requests/${createdTicketId}/screen-share/stop`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        stoppedBy: 'learner'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.screen_share_active !== false) {
        throw new Error('Expected screen_share_active to be false after stop');
      }
      if (res.body.screenShareStatus !== 'stopped') {
        throw new Error(`Expected screenShareStatus 'stopped', got ${res.body.screenShareStatus}`);
      }
    });

    // 12. Support Queue Overview
    await test('GET /api/support/queue returns metrics and active items', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support/queue',
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.stats || typeof res.body.stats.totalTickets !== 'number') {
        throw new Error('Expected queue stats object');
      }
    });

    console.log(`\n================================================================`);
    console.log(` PHASE 4 MEMBER 2 SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log(`================================================================\n`);
  } finally {
    server.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

