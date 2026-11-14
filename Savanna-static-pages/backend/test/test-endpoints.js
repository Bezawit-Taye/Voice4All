/**
 * Automated Test Suite for Voice4All Backend & Tutor Endpoint
 */

const http = require('http');
const app = require('../src/server');

const TEST_PORT = 5099;

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
  console.log('--- Starting Voice4All Backend Verification Tests ---\n');
  const server = app.listen(TEST_PORT);

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
    // 1. Health Check
    await test('GET /api/health returns status 200 and health info', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/health',
        method: 'GET'
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.status !== 'ok') throw new Error(`Expected status 'ok', got ${res.body.status}`);
      if (!Array.isArray(res.body.mountedEndpoints)) throw new Error('Expected mountedEndpoints list');
    });

    // 2. English Tutor Question
    await test('POST /api/tutor/ask with English question returns structured answer with sources', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'What is the future of the virtual assistant industry and what skills are needed?',
        language: 'en'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.answer || typeof res.body.answer !== 'string') throw new Error('Missing answer string');
      if (res.body.language !== 'en') throw new Error(`Expected language 'en', got ${res.body.language}`);
      if (!Array.isArray(res.body.sources) || res.body.sources.length === 0) throw new Error('Expected non-empty sources array');
      if (!res.body.mode) throw new Error('Missing mode field');
      if (!res.body.sources[0].courseTitle) throw new Error('Source missing courseTitle');
    });

    // 3. Amharic Tutor Question
    await test('POST /api/tutor/ask with Amharic question returns Amharic answer and sources', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'ንቁ ማዳመጥ በግንኙነት ውስጥ ምን ጥቅም አለው?',
        language: 'am'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.language !== 'am') throw new Error(`Expected language 'am', got ${res.body.language}`);
      if (!res.body.answer || typeof res.body.answer !== 'string') throw new Error('Missing answer');
      if (!Array.isArray(res.body.sources) || res.body.sources.length === 0) throw new Error('Expected sources');
      // Verify source is from actual course content
      const source = res.body.sources[0];
      if (!source.courseTitle.includes('WR 100') && !source.courseTitle.includes('VA-1')) {
        throw new Error(`Unexpected course citation: ${source.courseTitle}`);
      }
    });

    // 4. Supplied Learner Context
    await test('POST /api/tutor/ask with supplied context cites user context', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'What is the graduation threshold for this course?',
        language: 'en',
        context: {
          courseTitle: 'VA-1: VA Foundations & Professional Identity',
          moduleTitle: 'Module 1: Orientation',
          lessonTitle: 'Course Progression & Grading',
          lessonText: 'To graduate from this programme, learners must achieve an overall course score of at least 70% across all milestone evaluations.'
        }
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const matchedContext = res.body.sources.find(s => s.lessonTitle === 'Course Progression & Grading');
      if (!matchedContext) throw new Error('Supplied context was not found in returned sources');
      if (!matchedContext.snippet.includes('70%')) throw new Error('Snippet did not capture key sentence from supplied context');
    });

    // 5. Offline FAQ Matching (when AI_PROVIDER=offline_faq or direct question match)
    await test('POST /api/tutor/ask returns direct FAQ answer when matching offline FAQ', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'What is active listening?',
        language: 'en'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.answer.includes('active listening') && !res.body.answer.includes('concentrating')) {
        throw new Error('Did not return relevant explanation of active listening');
      }
      if (res.body.sources[0].courseTitle !== 'WR 100: Fundamentals of Effective Communication') {
        throw new Error(`Expected WR 100 citation, got: ${res.body.sources[0].courseTitle}`);
      }
    });

    // 6. Auto-detect Amharic when language parameter is omitted
    await test('POST /api/tutor/ask auto-detects Amharic script', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'የቨርቹዋል ረዳት ኢንዱስትሪ የወደፊት ሁኔታ ምን ይመስላል?'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.language !== 'am') throw new Error(`Expected auto-detected 'am', got ${res.body.language}`);
      if (!res.body.answer.includes('ሰላም') && !res.body.answer.includes('ቨርቹዋል')) {
        throw new Error('Expected Amharic answer text');
      }
    });

    // 7. Validation Check
    await test('POST /api/tutor/ask without question returns 400 Bad Request', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        language: 'en'
      });

      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (!res.body.error) throw new Error('Expected error message in response');
    });

    // 8. 404 Not Found check
    await test('GET /api/nonexistent returns 404 structured JSON', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/nonexistent',
        method: 'GET'
      });

      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      if (res.body.status !== 'error') throw new Error(`Expected status 'error', got ${res.body.status}`);
    });

    // 9. Support Router Mount Check
    await test('GET /api/support is mounted and returns 501 pending Member 3', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/support',
        method: 'GET'
      });

      if (res.status !== 501) throw new Error(`Expected 501, got ${res.status}`);
      if (res.body.status !== 'pending_member_3') throw new Error(`Expected pending_member_3, got ${res.body.status}`);
    });

    // 10. Career Router Mount Check
    await test('GET /api/career is mounted and returns 501 pending Member 3', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/career',
        method: 'GET'
      });

      if (res.status !== 501) throw new Error(`Expected 501, got ${res.status}`);
      if (res.body.status !== 'pending_member_3') throw new Error(`Expected pending_member_3, got ${res.body.status}`);
    });

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
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
