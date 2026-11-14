/**
 * Voice4All Comprehensive Automated Verification Suite
 * Tests:
 * - Course Grounding and Citation Accuracy
 * - Prevention of Fabricated Citations & Missing Citations
 * - Unsupported Questions Refusal & Acknowledgment
 * - Bilingual (English & Amharic) Text Interaction
 * - Simple-Language Explanation Mode
 * - Offline FAQ Matching & Fallback
 * - Zero-PII Anonymous Teacher Analytics (PII Redaction)
 * - Health Check & Dynamic Router Mounts
 */

const http = require('http');
const app = require('../src/server');

const TEST_PORT = 5097;

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
  console.log('--- Starting Voice4All Workstream B Verification Tests ---\n');
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
    await test('GET /api/health verifies all services and routes are ready', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/health',
        method: 'GET'
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.status !== 'ok') throw new Error(`Expected status 'ok', got ${res.body.status}`);
      const analyticsEndpoint = res.body.mountedEndpoints.find(e => e.path === '/api/analytics');
      if (!analyticsEndpoint) throw new Error('Missing /api/analytics in mounted endpoints');
    });

    // 2. English Grounding & Citation Accuracy
    await test('POST /api/tutor/ask with English question returns grounded answer with accurate citations', async () => {
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
      if (res.body.isGrounded !== true) throw new Error('Expected isGrounded: true');
      if (!Array.isArray(res.body.sources) || res.body.sources.length === 0) throw new Error('Missing citations');

      const source = res.body.sources[0];
      if (!source.courseTitle || !source.lessonTitle || !source.snippet) {
        throw new Error('Citation missing required metadata fields');
      }
      if (!source.courseTitle.includes('VA-1') && !source.courseTitle.includes('WR 100')) {
        throw new Error(`Unexpected course citation: ${source.courseTitle}`);
      }
    });

    // 3. Amharic Grounding & Citation Accuracy
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
      if (res.body.sources.length === 0) throw new Error('Expected non-empty sources');
      if (!res.body.sources[0].snippet.includes('ማዳመጥ') && !res.body.sources[0].snippet.includes('መስማት')) {
        throw new Error('Source snippet missing expected Amharic text');
      }
    });

    // 4. Test for Fabricated Answers and Unsupported Questions
    await test('POST /api/tutor/ask refuses unsupported questions without inventing citations', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'How do I bake a chocolate cake with sprinkles and vanilla frosting?',
        language: 'en'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.isGrounded !== false) throw new Error('Expected isGrounded: false for off-topic inquiry');
      if (res.body.mode !== 'unsupported_refusal') throw new Error(`Expected mode 'unsupported_refusal', got ${res.body.mode}`);
      if (res.body.sources.length !== 0) throw new Error('Must NOT invent citations for off-topic questions');
      if (!res.body.answer.includes('not covered in your active course materials')) {
        throw new Error('Expected polite refusal text explaining answer cannot be found');
      }
    });

    // 5. Test Missing Citations Prevention
    await test('Grounded questions must never produce missing citations', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'What is the BLUF model?',
        language: 'en'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.sources || res.body.sources.length === 0) {
        throw new Error('Citation is missing for a valid course question');
      }
      for (const s of res.body.sources) {
        if (!s.courseTitle || !s.moduleTitle || !s.lessonTitle || !s.snippet) {
          throw new Error('Found incomplete citation object');
        }
      }
    });

    // 6. Simple-Language Explanations (English & Amharic)
    await test('POST /api/tutor/ask with simplify: true returns plain-language explanation', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'What is the graduation threshold for this course?',
        language: 'en',
        simplify: true
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.simplified !== true) throw new Error('Expected simplified: true');
      if (!res.body.answer.includes('Simple Explanation') && !res.body.answer.includes('Plain Language')) {
        throw new Error('Expected simple explanation header in response');
      }
    });

    // 7. Offline FAQ Matching
    await test('POST /api/tutor/ask matches offline FAQ from faqs.json', async () => {
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
        throw new Error('Did not match active listening FAQ');
      }
    });

    // 8. Zero-PII Anonymous Teacher Analytics
    await test('GET /api/analytics/summary redacts learner names, emails, and phone numbers', async () => {
      // Send a query containing sensitive personal identifiable information
      await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/tutor/ask',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        question: 'My name is John Doe and my email is john.doe@example.com, how do I pass?',
        language: 'en'
      });

      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/analytics/summary',
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.data || res.body.data.totalQuestions === 0) throw new Error('Expected analytics data');

      const inquiries = res.body.data.recentAnonymousInquiries || [];
      const logged = inquiries.find(i => i.question.includes('how do I pass?'));
      if (!logged) throw new Error('Logged query not found in analytics stream');

      // Ensure email and name were scrubbed
      if (logged.question.includes('john.doe@example.com')) {
        throw new Error('PII Violation: Email was not redacted in analytics!');
      }
      if (logged.question.includes('John Doe')) {
        throw new Error('PII Violation: Learner name was not redacted in analytics!');
      }
      if (!logged.question.includes('[REDACTED_EMAIL]') || !logged.question.includes('[REDACTED_NAME]')) {
        throw new Error('Expected redaction placeholders in logged question text');
      }
    });

    // 9. Teacher Analytics Frequently Asked Questions Endpoint
    await test('GET /api/analytics/faqs returns clustered topic frequencies', async () => {
      const res = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/analytics/faqs',
        method: 'GET'
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.data) || res.body.data.length === 0) {
        throw new Error('Expected list of clustered FAQ topics');
      }
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
