/**
 * Voice4All — Phase 4 Verification Suite
 * Career Development Module Integration & Accessibility Tests
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');

const app = require('../src/server');
const careerService = require('../src/services/career.service');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, rawBody: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, rawBody: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

let server;
let port;

async function runTests() {
  console.log('================================================================');
  console.log('   VOICE4ALL — PHASE 4 VERIFICATION SUITE                       ');
  console.log('   Career Development Module, Resources & Accessibility Tests    ');
  console.log('================================================================\n');

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  function pass(msg) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  }

  function fail(msg, err) {
    failed++;
    console.error(`  [FAIL] ${msg}`, err);
  }

  try {
    console.log('>>> 1. Learning & Professional Development Resources API:');

    // Test 1: GET /api/career/resources
    {
      const res = await request({
        hostname: 'localhost',
        port,
        path: '/api/career/resources',
        method: 'GET'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.total >= 6, `Expected at least 6 resources, got ${res.body.total}`);
      pass(`GET /api/career/resources returns ${res.body.total} structured learning modules`);
    }

    // Test 2: Category filter: assistive_tech
    {
      const res = await request({
        hostname: 'localhost',
        port,
        path: '/api/career/resources?category=assistive_tech',
        method: 'GET'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.category, 'assistive_tech');
      assert.ok(res.body.resources.every(r => r.category === 'assistive_tech'));
      pass(`Category filter on assistive_tech returns ${res.body.resources.length} assistive technology modules`);
    }

    // Test 3: Category filter: self_advocacy
    {
      const res = await request({
        hostname: 'localhost',
        port,
        path: '/api/career/resources?category=self_advocacy',
        method: 'GET'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.category, 'self_advocacy');
      assert.ok(res.body.resources.some(r => r.id === 'res-sa-01'));
      pass(`Category filter on self_advocacy returns interview self-advocacy playbooks`);
    }

    // Test 4: Amharic localization of resources
    {
      const res = await request({
        hostname: 'localhost',
        port,
        path: '/api/career/resources?lang=am',
        method: 'GET'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.language, 'am');
      const sample = res.body.resources[0];
      assert.ok(sample.title.length > 0);
      assert.ok(sample.category_label.length > 0);
      pass(`GET /api/career/resources?lang=am returns Amharic localized career learning modules`);
    }

    // Test 5: Single resource retrieval by ID
    {
      const res = await request({
        hostname: 'localhost',
        port,
        path: '/api/career/resources/res-sa-01',
        method: 'GET'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.resource.id, 'res-sa-01');
      assert.ok(res.body.resource.guide_content.length > 50);
      assert.ok(Array.isArray(res.body.resource.key_takeaways));
      assert.ok(Array.isArray(res.body.resource.action_steps));
      pass(`GET /api/career/resources/:id returns full interactive study guide and action checklist`);
    }

    console.log('\n>>> 2. Frontend Assets & WCAG 2.1 AA Accessibility Verification:');

    // Test 6: Verify career-development.html file exists and has semantic landmarks
    {
      const pagePath = path.resolve(__dirname, '../../pages/career-development.html');
      assert.ok(fs.existsSync(pagePath), 'career-development.html must exist');
      const html = fs.readFileSync(pagePath, 'utf8');

      // Semantic HTML & ARIA assertions
      assert.ok(html.includes('class="career-skip-link"'), 'Page must contain skip link');
      assert.ok(html.includes('role="banner"'), 'Page must contain header banner');
      assert.ok(html.includes('role="main"'), 'Page must contain main landmark');
      assert.ok(html.includes('role="tablist"'), 'Page must contain ARIA tablist');
      assert.ok(html.includes('role="tab"'), 'Page must contain ARIA tabs');
      assert.ok(html.includes('role="tabpanel"'), 'Page must contain ARIA tabpanels');
      assert.ok(html.includes('aria-live="polite"'), 'Page must contain live region for dynamic announcements');
      assert.ok(html.includes('id="jobs-grid-container"'), 'Page must have jobs grid');
      assert.ok(html.includes('id="resources-grid-container"'), 'Page must have learning resources grid');
      assert.ok(html.includes('id="drafter-form"'), 'Page must have accommodation drafter form');
      assert.ok(html.includes('role="dialog"'), 'Page must have accessible modal dialogs with role="dialog"');
      pass(`career-development.html passes semantic structure, ARIA tab patterns, and accessible landmarks`);
    }

    // Test 7: Verify career.css styling rules
    {
      const cssPath = path.resolve(__dirname, '../../assets/css/career.css');
      assert.ok(fs.existsSync(cssPath), 'career.css must exist');
      const css = fs.readFileSync(cssPath, 'utf8');

      assert.ok(css.includes(':focus-visible'), 'CSS must specify visible focus rings');
      assert.ok(css.includes('--career-focus'), 'CSS must define focus ring variables');
      assert.ok(css.includes('.career-skip-link'), 'CSS must style skip link');
      assert.ok(css.includes('body.high-contrast'), 'CSS must support high-contrast mode');
      assert.ok(css.includes('body.large-text'), 'CSS must support large-text scaling');
      assert.ok(css.includes('@media print'), 'CSS must provide print styles for self-advocacy accommodation drafts');
      pass(`career.css provides visible focus rings, high contrast, large text, and print styling`);
    }

    // Test 8: Verify career-app.js client controller
    {
      const appJsPath = path.resolve(__dirname, '../../assets/js/voice4all/career/career-app.js');
      assert.ok(fs.existsSync(appJsPath), 'career-app.js must exist');
      const appJs = fs.readFileSync(appJsPath, 'utf8');

      assert.ok(appJs.includes('switchTab'), 'career-app.js must implement tab switching');
      assert.ok(appJs.includes('ArrowRight') && appJs.includes('ArrowLeft'), 'career-app.js must implement ARIA arrow-key navigation');
      assert.ok(appJs.includes('trapFocus'), 'career-app.js must implement accessible focus trapping in dialogs');
      assert.ok(appJs.includes('formatSelfAdvocacyEmail'), 'career-app.js must format self-advocacy letters');
      assert.ok(appJs.includes('localStorage'), 'career-app.js must persist saved roles and completed modules');
      pass(`career-app.js implements accessible tab keyboard navigation, focus trapping, and portfolio state`);
    }

    // Test 9: Verify career-client.js exports getResources and getResourceDetails
    {
      const clientJsPath = path.resolve(__dirname, '../../assets/js/voice4all/career/career-client.js');
      assert.ok(fs.existsSync(clientJsPath), 'career-client.js must exist');
      const clientModule = require(clientJsPath);
      const client = globalThis.Voice4AllCareerClient || clientModule.default || clientModule;
      assert.strictEqual(typeof client.getResources, 'function');
      assert.strictEqual(typeof client.getResourceDetails, 'function');
      pass(`career-client.js exports getResources and getResourceDetails client methods`);
    }

    // Test 10: Verify index.html links to career-development.html
    {
      const indexPath = path.resolve(__dirname, '../../index.html');
      const indexHtml = fs.readFileSync(indexPath, 'utf8');
      assert.ok(indexHtml.includes('pages/career-development.html'), 'index.html must link to career-development.html');
      pass(`index.html successfully links to pages/career-development.html`);
    }

    // Test 11: Universal loader includes browser speech fallback before the widget
    {
      const loaderPath = path.resolve(__dirname, '../../assets/js/voice4all/loader.js');
      const loader = fs.readFileSync(loaderPath, 'utf8');
      const speechServiceIndex = loader.indexOf('`${loaderDir}speech/speech.service.js`');
      const widgetIndex = loader.indexOf('`${loaderDir}voice4all.js`');
      assert.ok(speechServiceIndex >= 0, 'loader must include speech.service.js');
      assert.ok(speechServiceIndex < widgetIndex, 'speech service must load before the widget');

      const uiPath = path.resolve(__dirname, '../../assets/js/voice4all/ui.js');
      const ui = fs.readFileSync(uiPath, 'utf8');
      assert.ok(ui.includes('voice_page_options'), 'home-page voice guidance must announce its choices');
      assert.ok(!ui.includes('Backend Connected — Demo AI (not live Gemini)'), 'demo status banner copy must be removed');
      pass('loader registers speech fallback and the UI has spoken home-page choices without demo status text');
    }

    // Test 12: Browser speech waits for voices and cancels stale queued requests
    {
      const speechPath = path.resolve(__dirname, '../../assets/js/voice4all/speech/speech.service.js');
      const source = fs.readFileSync(speechPath, 'utf8');
      const listeners = new Set();
      const spoken = [];
      let voices = [];
      const synthesis = {
        speaking: false,
        pending: false,
        getVoices: () => voices,
        addEventListener: (name, listener) => {
          if (name === 'voiceschanged') listeners.add(listener);
        },
        removeEventListener: (name, listener) => {
          if (name === 'voiceschanged') listeners.delete(listener);
        },
        speak: (utterance) => spoken.push(utterance),
        cancel: () => {}
      };
      const sandbox = {
        module: { exports: {} },
        window: {
          speechSynthesis: synthesis,
          SpeechSynthesisUtterance: function (text) { this.text = text; }
        },
        setTimeout,
        clearTimeout,
        console
      };
      vm.runInNewContext(source, sandbox, { filename: speechPath });
      const speech = sandbox.module.exports;

      assert.strictEqual(speech.speak('Welcome', { language: 'en' }), true);
      voices = [{ lang: 'en-US', name: 'Test English' }];
      Array.from(listeners).forEach((listener) => listener());
      await new Promise((resolve) => setImmediate(resolve));
      assert.strictEqual(spoken.length, 1, 'speech should start after browser voices load');
      assert.strictEqual(spoken[0].voice.name, 'Test English');

      speech.cachedVoices = [];
      voices = [];
      speech.speak('Stale request', { language: 'en' });
      speech.stopSpeaking();
      voices = [{ lang: 'en-US', name: 'Test English' }];
      Array.from(listeners).forEach((listener) => listener());
      await new Promise((resolve) => setImmediate(resolve));
      assert.strictEqual(spoken.length, 1, 'stopped queued speech must not start');
      pass('browser voice loading and cancellation are reliable for queued speech');
    }

  } catch (err) {
    fail('Unexpected exception during Phase 4 verification', err);
  } finally {
    if (server) server.close();
  }

  console.log('\n================================================================');
  console.log(` PHASE 4 SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
