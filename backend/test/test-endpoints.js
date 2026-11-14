/**
 * Automated Test Suite for Voice4All Backend & Tutor Endpoint (Phase 2)
 */

const http = require('http');
const app = require('../src/server');

const TEST_PORT = 5098;

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
  console.log('--- Starting Voice4All Phase 2 Backend Verification Tests ---\n');
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
    });

    // 2. English Grounded Retrieval & Citations
    await test('POST /api/tutor/ask with English question returns grounded answer and real citations', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'What is the future of the virtual assistant industry and how do AI tools help?',
        language: 'en'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.answer || typeof res.body.answer !== 'string') throw new Error('Missing answer string');
      if (res.body.language !== 'en') throw new Error(`Expected language 'en', got ${res.body.language}`);
      if (!Array.isArray(res.body.sources) || res.body.sources.length === 0) throw new Error('Expected non-empty sources array');
      if (res.body.isGrounded !== true) throw new Error('Expected isGrounded: true');

      const primary = res.body.sources[0];
      if (!primary.courseTitle || !primary.lessonTitle || !primary.snippet) {
        throw new Error('Citation missing required fields');
      }
    });

    // 3. Amharic Grounded Retrieval & Citations
    await test('POST /api/tutor/ask with Amharic question returns grounded Amharic answer and citations', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'ንቁ ማዳመጥ በስራ ቦታ ግንኙነት ውስጥ ምን ጥቅም አለው?',
        language: 'am'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.language !== 'am') throw new Error(`Expected language 'am', got ${res.body.language}`);
      if (!res.body.answer.includes('ሰላም') && !res.body.answer.includes('ንቁ ማዳመጥ')) {
        throw new Error('Expected Amharic answer text');
      }
      if (res.body.sources.length === 0) throw new Error('Expected sources');
      if (!res.body.sources[0].courseTitle.includes('WR 100')) {
        throw new Error('Expected citation from WR 100 course');
      }
    });

    // 4. Simple-Language Mode (Accessibility) - English
    await test('POST /api/tutor/ask with simplify: true returns plain-language explanation', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'What is the BLUF model in communication?',
        language: 'en',
        simplify: true
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.simplified !== true) throw new Error('Expected simplified: true');
      if (!res.body.answer.includes('Simple Explanation') && !res.body.answer.includes('Plain Language')) {
        throw new Error('Expected simple explanation header');
      }
    });

    // 5. Simple-Language Mode - Amharic
    await test('POST /api/tutor/ask with simplify: true in Amharic returns plain Amharic explanation', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'የ BLUF ሞዴል ምንድን ነው?',
        language: 'am',
        simplify: true
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.simplified !== true) throw new Error('Expected simplified: true');
      if (!res.body.answer.includes('ቀላል ማብራሪያ')) {
        throw new Error('Expected Amharic simple explanation header');
      }
    });

    // 6. Refuse / Acknowledge Unsupported Questions (Prevent Hallucinations)
    await test('POST /api/tutor/ask refuses unsupported questions without fabricating citations', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'How do I bake a chocolate cake with frosting and sprinkles?',
        language: 'en'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.isGrounded !== false) throw new Error('Expected isGrounded: false for off-topic query');
      if (res.body.mode !== 'unsupported_refusal') throw new Error(`Expected unsupported_refusal mode, got ${res.body.mode}`);
      if (res.body.sources.length !== 0) throw new Error('Must not invent citations for unsupported queries');
      if (!res.body.answer.includes('not covered in your active course materials')) {
        throw new Error('Expected polite refusal message');
      }
    });

    // 7. Active Learner Context Prioritization
    await test('POST /api/tutor/ask prioritizes active learner context', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'What score is needed to pass and graduate?',
        language: 'en',
        context: {
          courseTitle: 'VA-1: VA Foundations & Professional Identity',
          moduleTitle: 'Module 1: Orientation',
          lessonTitle: 'Course Progression & Grading',
          lessonText: 'To graduate from this programme, learners must achieve an overall course score of at least 70% across all milestone evaluations.'
        }
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const matched = res.body.sources.find(s => s.lessonTitle.includes('Grading'));
      if (!matched) throw new Error('Supplied context was not matched');
      if (!matched.snippet.includes('70%')) throw new Error('Snippet missing 70% milestone details');
    });

    // 8. Offline FAQ lookup
    await test('POST /api/tutor/ask matches offline FAQ', async () => {
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
      if (!res.body.answer.toLowerCase().includes('active listening')) {
        throw new Error('Did not find active listening explanation');
      }
    });

    // 9. Input Validation
    await test('POST /api/tutor/ask returns 400 when question is empty', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: '   '
      });

      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
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
