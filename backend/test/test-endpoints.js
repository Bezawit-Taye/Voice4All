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

const http = require("http");
const app = require("../src/server");

const TEST_PORT = 5097;

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on("error", (err) => reject(err));

    if (postData) {
      req.write(
        typeof postData === "string" ? postData : JSON.stringify(postData),
      );
    }
    req.end();
  });
}

async function runTests() {
  console.log("--- Starting Voice4All Workstream B Verification Tests ---\n");
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
      console.error("       Error:", err.message);
      failed++;
    }
  }

  try {
    // 1. Health Check
    await test("GET /api/health verifies all services and routes are ready", async () => {
      const res = await request({
        hostname: "localhost",
        port: TEST_PORT,
        path: "/api/health",
        method: "GET",
      });
      if (res.status !== 200)
        throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.status !== "ok")
        throw new Error(`Expected status 'ok', got ${res.body.status}`);
      const analyticsEndpoint = res.body.mountedEndpoints.find(
        (e) => e.path === "/api/analytics",
      );
      if (!analyticsEndpoint)
        throw new Error("Missing /api/analytics in mounted endpoints");
    });

    await test("Static frontend is served while backend source stays private", async () => {
      const page = await request({
        hostname: "localhost",
        port: TEST_PORT,
        path: "/",
        method: "GET",
      });
      if (
        page.status !== 200 ||
        typeof page.body !== "string" ||
        !page.body.toLowerCase().includes("<html")
      ) {
        throw new Error(`Expected frontend HTML, got HTTP ${page.status}`);
      }

      const source = await request({
        hostname: "localhost",
        port: TEST_PORT,
        path: "/backend/src/server.js",
        method: "GET",
      });
      if (source.status !== 404)
        throw new Error(
          `Expected backend source to be blocked, got HTTP ${source.status}`,
        );
    });

    // 2. English Grounding & Citation Accuracy
    await test("POST /api/tutor/ask with English question returns grounded answer with accurate citations", async () => {
      const res = await request(
        {
          hostname: "localhost",
          port: TEST_PORT,
          path: "/api/tutor/ask",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        {
          question:
            "What is the future of the virtual assistant industry and how do AI tools help?",
          language: "en",
        },
      );

      if (res.status !== 200)
        throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.isGrounded !== true)
        throw new Error("Expected isGrounded: true");
      if (!Array.isArray(res.body.sources) || res.body.sources.length === 0)
        throw new Error("Missing citations");

      const source = res.body.sources[0];
      if (!source.courseTitle || !source.lessonTitle || !source.snippet) {
        throw new Error("Citation missing required metadata fields");
      }
      if (
        !source.courseTitle.includes("VA-1") &&
        !source.courseTitle.includes("WR 100")
      ) {
        throw new Error(`Unexpected course citation: ${source.courseTitle}`);
      }
    });

    // 3. Amharic Grounding & Citation Accuracy
    await test("POST /api/tutor/ask with Amharic question returns grounded Amharic answer and citations", async () => {
      const res = await request(
        {
          hostname: "localhost",
          port: TEST_PORT,
          path: "/api/tutor/ask",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        {
          question: "ንቁ ማዳመጥ በስራ ቦታ ግንኙነት ውስጥ ምን ጥቅም አለው?",
          language: "am",
        },
      );

      if (res.status !== 200)
        throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.language !== "am")
        throw new Error(`Expected language 'am', got ${res.body.language}`);
      if (
        !res.body.answer.includes("ሰላም") &&
        !res.body.answer.includes("ንቁ ማዳመጥ")
      ) {
        throw new Error("Expected Amharic answer text");
      }
      if (res.body.sources.length === 0)
        throw new Error("Expected non-empty sources");
      if (
        !res.body.sources[0].snippet.includes("ማዳመጥ") &&
        !res.body.sources[0].snippet.includes("መስማት")
      ) {
        throw new Error("Source snippet missing expected Amharic text");
      }
    });

    await test("POST /api/tutor/ask accepts the frontend message and simple_mode fields", async () => {
      const previousProvider = process.env.AI_PROVIDER;
      process.env.AI_PROVIDER = "mock_demo";
      try {
        const res = await request(
          {
            hostname: "localhost",
            port: TEST_PORT,
            path: "/api/tutor/ask",
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
          {
            message: "What is active listening?",
            language: "en",
            simple_mode: true,
          },
        );

        if (res.status !== 200)
          throw new Error(`Expected 200, got ${res.status}`);
        if (res.body.simplified !== true)
          throw new Error("Expected simple_mode to enable simplified output");
        if (!res.body.sources || res.body.sources.length === 0)
          throw new Error("Expected curriculum citations");
      } finally {
        if (previousProvider === undefined) delete process.env.AI_PROVIDER;
        else process.env.AI_PROVIDER = previousProvider;
      }
    });

    await test("Gemini generates a grounded answer and receives redacted question text", async () => {
      const previousProvider = process.env.AI_PROVIDER;
      const previousKey = process.env.GEMINI_API_KEY;
      const previousModel = process.env.GEMINI_MODEL;
      const originalFetch = global.fetch;
      let geminiRequest;
      process.env.AI_PROVIDER = "gemini";
      process.env.GEMINI_API_KEY = "test-key-not-a-real-credential";
      process.env.GEMINI_MODEL = "gemini-test-model";
      global.fetch = async (url, options) => {
        geminiRequest = { url, options };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: "ይህ በትምህርቱ ይዘት ላይ የተመሠረተ መልስ ነው።" }] } }],
          }),
        };
      };

      try {
        const res = await request(
          {
            hostname: "localhost",
            port: TEST_PORT,
            path: "/api/tutor/ask",
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
          {
            question: "My name is John Doe, my email is john.doe@example.com. ንቁ ማዳመጥ ምንድን ነው?",
            language: "am",
          },
        );

        if (res.status !== 200)
          throw new Error(`Expected 200, got ${res.status}`);
        if (res.body.mode !== "gemini")
          throw new Error(`Expected Gemini mode, got ${res.body.mode}`);
        if (res.body.isGrounded !== true || res.body.sources.length === 0)
          throw new Error("Expected grounded answer with citations");
        if (!geminiRequest)
          throw new Error("Expected a request to the Gemini API");
        const sentPayload = JSON.parse(geminiRequest.options.body);
        const sentText = sentPayload.contents[0].parts[0].text;
        if (sentText.includes("john.doe@example.com") || sentText.includes("John Doe"))
          throw new Error("PII was not redacted before sending the Gemini request");
        if (geminiRequest.options.headers["x-goog-api-key"] !== process.env.GEMINI_API_KEY)
          throw new Error("Expected the Gemini API key to be sent in a request header");
      } finally {
        global.fetch = originalFetch;
        if (previousProvider === undefined) delete process.env.AI_PROVIDER;
        else process.env.AI_PROVIDER = previousProvider;
        if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = previousKey;
        if (previousModel === undefined) delete process.env.GEMINI_MODEL;
        else process.env.GEMINI_MODEL = previousModel;
      }
    });

    await test("Gemini configuration errors do not fall back to demo answers", async () => {
      const previousProvider = process.env.AI_PROVIDER;
      const previousKey = process.env.GEMINI_API_KEY;
      process.env.AI_PROVIDER = "gemini";
      delete process.env.GEMINI_API_KEY;
      try {
        const res = await request(
          {
            hostname: "localhost",
            port: TEST_PORT,
            path: "/api/tutor/ask",
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
          {
            question: "What is active listening?",
            language: "en",
          },
        );

        if (res.status !== 503)
          throw new Error(`Expected 503, got ${res.status}`);
        if (!res.body.error || !res.body.error.includes("GEMINI_API_KEY"))
          throw new Error("Expected an explicit missing Gemini key error");
      } finally {
        if (previousProvider === undefined) delete process.env.AI_PROVIDER;
        else process.env.AI_PROVIDER = previousProvider;
        if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = previousKey;
      }
    });

    await test("POST /api/tutor/speech proxies authenticated MP3 audio in Amharic and English", async () => {
      const previousUrl = process.env.TTS_SERVICE_URL;
      const previousToken = process.env.TTS_SERVICE_TOKEN;
      const originalFetch = global.fetch;
      const audioBytes = Buffer.from("ID3-test-mp3");
      process.env.TTS_SERVICE_URL = "http://edge-tts.test";
      process.env.TTS_SERVICE_TOKEN = "test-shared-secret";
      global.fetch = async (url, options) => {
        if (url !== "http://edge-tts.test/synthesize")
          throw new Error(`Unexpected TTS URL: ${url}`);
        if (options.headers.Authorization !== "Bearer test-shared-secret")
          throw new Error("Expected the shared TTS service token");
        const body = JSON.parse(options.body);
        if (
          !(
            (body.language === "am" && body.text === "ሰላም" && body.voice === "female" && body.rate === 1)
            || (body.language === "en" && body.text === "Welcome to Voice4All." && body.voice === "female" && body.rate === 1.15)
            || (body.language === "am" && body.text === "ሰላም" && body.voice === "male" && body.rate === 1)
          )
        ) {
          throw new Error("Expected valid Amharic or English speech input");
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => "audio/mpeg" },
          arrayBuffer: async () => audioBytes.buffer.slice(
            audioBytes.byteOffset,
            audioBytes.byteOffset + audioBytes.byteLength,
          ),
        };
      };

      try {
        const res = await request(
          {
            hostname: "localhost",
            port: TEST_PORT,
            path: "/api/tutor/speech",
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
          { text: "ሰላም", language: "am" },
        );
        if (res.status !== 200)
          throw new Error(`Expected 200, got ${res.status}`);
        if (!String(res.headers["content-type"]).startsWith("audio/mpeg"))
          throw new Error("Expected an audio/mpeg response");
        if (!String(res.body).startsWith("ID3"))
          throw new Error("Expected MP3 response bytes");

        const english = await request(
          {
            hostname: "localhost",
            port: TEST_PORT,
            path: "/api/tutor/speech",
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
          { text: "Welcome to Voice4All.", language: "en", rate: 1.15 },
        );
        if (english.status !== 200)
          throw new Error(`Expected English speech HTTP 200, got ${english.status}`);
        if (!String(english.headers["content-type"]).startsWith("audio/mpeg"))
          throw new Error("Expected English MP3 response");

        const male = await request(
          {
            hostname: "localhost",
            port: TEST_PORT,
            path: "/api/tutor/speech",
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
          { text: "ሰላም", language: "am", voice: "male" },
        );
        if (male.status !== 200)
          throw new Error(`Expected male Amharic speech HTTP 200, got ${male.status}`);
      } finally {
        global.fetch = originalFetch;
        if (previousUrl === undefined) delete process.env.TTS_SERVICE_URL;
        else process.env.TTS_SERVICE_URL = previousUrl;
        if (previousToken === undefined) delete process.env.TTS_SERVICE_TOKEN;
        else process.env.TTS_SERVICE_TOKEN = previousToken;
      }
    });

    await test("Production TTS proxy upgrades Render hostnames to HTTPS", async () => {
      const previousEnvironment = process.env.NODE_ENV;
      const previousUrl = process.env.TTS_SERVICE_URL;
      const previousToken = process.env.TTS_SERVICE_TOKEN;
      const originalFetch = global.fetch;
      let requestedUrl = "";
      let authorization = "";
      const audioBytes = Buffer.from("ID3-production-test");
      process.env.NODE_ENV = "production";
      process.env.TTS_SERVICE_URL = "voice4all-tts.onrender.com";
      process.env.TTS_SERVICE_TOKEN = "test-production-secret";
      global.fetch = async (url, options) => {
        requestedUrl = url;
        authorization = options.headers.Authorization;
        return {
          ok: true,
          status: 200,
          headers: { get: () => "audio/mpeg" },
          arrayBuffer: async () =>
            audioBytes.buffer.slice(
              audioBytes.byteOffset,
              audioBytes.byteOffset + audioBytes.byteLength,
            ),
        };
      };

      try {
        const res = await request(
          {
            hostname: "localhost",
            port: TEST_PORT,
            path: "/api/tutor/speech",
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
          { text: "Welcome", language: "en" },
        );
        if (res.status !== 200)
          throw new Error(`Expected 200, got ${res.status}`);
        if (requestedUrl !== "https://voice4all-tts.onrender.com/synthesize")
          throw new Error(`Expected HTTPS Render URL, got ${requestedUrl}`);
        if (authorization !== "Bearer test-production-secret")
          throw new Error("Expected the production TTS shared secret");
      } finally {
        global.fetch = originalFetch;
        if (previousEnvironment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousEnvironment;
        if (previousUrl === undefined) delete process.env.TTS_SERVICE_URL;
        else process.env.TTS_SERVICE_URL = previousUrl;
        if (previousToken === undefined) delete process.env.TTS_SERVICE_TOKEN;
        else process.env.TTS_SERVICE_TOKEN = previousToken;
      }
    });

    await test("Production TTS proxy reports missing service configuration", async () => {
      const previousEnvironment = process.env.NODE_ENV;
      const previousUrl = process.env.TTS_SERVICE_URL;
      const previousToken = process.env.TTS_SERVICE_TOKEN;
      const { synthesizeSpeech } = require("../src/services/tts.service");
      process.env.NODE_ENV = "production";

      try {
        process.env.TTS_SERVICE_URL = "voice4all-tts.onrender.com";
        process.env.TTS_SERVICE_TOKEN = "";
        try {
          await synthesizeSpeech({ text: "Hello", language: "en" });
          throw new Error("Expected missing TTS_SERVICE_TOKEN to fail");
        } catch (error) {
          if (
            error.statusCode !== 503 ||
            !error.message.includes("TTS_SERVICE_TOKEN")
          ) {
            throw error;
          }
        }

        process.env.TTS_SERVICE_TOKEN = "test-production-secret";
        process.env.TTS_SERVICE_URL = "";
        try {
          await synthesizeSpeech({ text: "Hello", language: "en" });
          throw new Error("Expected missing TTS_SERVICE_URL to fail");
        } catch (error) {
          if (
            error.statusCode !== 503 ||
            !error.message.includes("TTS_SERVICE_URL")
          ) {
            throw error;
          }
        }
      } finally {
        if (previousEnvironment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousEnvironment;
        if (previousUrl === undefined) delete process.env.TTS_SERVICE_URL;
        else process.env.TTS_SERVICE_URL = previousUrl;
        if (previousToken === undefined) delete process.env.TTS_SERVICE_TOKEN;
        else process.env.TTS_SERVICE_TOKEN = previousToken;
      }
    });

    await test("TTS proxy logs downstream auth failures without credentials", async () => {
      const previousEnvironment = process.env.NODE_ENV;
      const previousUrl = process.env.TTS_SERVICE_URL;
      const previousToken = process.env.TTS_SERVICE_TOKEN;
      const originalFetch = global.fetch;
      const originalConsoleError = console.error;
      const testToken = "test-tts-secret-not-for-logs";
      const diagnosticLogs = [];
      const { synthesizeSpeech } = require("../src/services/tts.service");
      process.env.NODE_ENV = "production";
      process.env.TTS_SERVICE_URL = "https://tts.example.test";
      process.env.TTS_SERVICE_TOKEN = testToken;
      global.fetch = async (url, options) => {
        if (url !== "https://tts.example.test/synthesize")
          throw new Error("Unexpected TTS URL");
        if (options.headers.Authorization !== `Bearer ${testToken}`)
          throw new Error("Expected bearer authentication");
        return {
          ok: false,
          status: 401,
          headers: { get: () => "application/json" },
          text: async () => JSON.stringify({
            detail: "Unauthorized.",
            TTS_SERVICE_TOKEN: testToken,
            extra: "x".repeat(1000),
          }),
        };
      };
      console.error = (...args) => diagnosticLogs.push(args);

      try {
        try {
          await synthesizeSpeech({ text: "Welcome", language: "en" });
          throw new Error("Expected the upstream auth failure to be rejected");
        } catch (error) {
          if (error.statusCode !== 502) throw error;
        }

        const log = diagnosticLogs.find((args) => args[0] === "[TTS proxy]");
        if (!log) throw new Error("Expected a TTS diagnostic log");
        const diagnostic = JSON.parse(log[1]);
        if (
          diagnostic.event !== "upstream_authentication_failure" ||
          diagnostic.status !== 401 ||
          !diagnostic.responseBody.includes("Unauthorized.") ||
          diagnostic.responseBody.length > 520 ||
          diagnostic.responseBody.includes(testToken)
        ) {
          throw new Error("Expected bounded, redacted HTTP auth diagnostics");
        }
      } finally {
        global.fetch = originalFetch;
        console.error = originalConsoleError;
        if (previousEnvironment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousEnvironment;
        if (previousUrl === undefined) delete process.env.TTS_SERVICE_URL;
        else process.env.TTS_SERVICE_URL = previousUrl;
        if (previousToken === undefined) delete process.env.TTS_SERVICE_TOKEN;
        else process.env.TTS_SERVICE_TOKEN = previousToken;
      }
    });

    await test("TTS proxy logs connection and timeout failures", async () => {
      const previousEnvironment = process.env.NODE_ENV;
      const previousUrl = process.env.TTS_SERVICE_URL;
      const previousToken = process.env.TTS_SERVICE_TOKEN;
      const originalFetch = global.fetch;
      const originalConsoleError = console.error;
      const testToken = "test-tts-secret-not-for-logs";
      const diagnosticLogs = [];
      const { synthesizeSpeech } = require("../src/services/tts.service");
      process.env.NODE_ENV = "production";
      process.env.TTS_SERVICE_URL = "https://tts.example.test";
      process.env.TTS_SERVICE_TOKEN = testToken;
      console.error = (...args) => diagnosticLogs.push(args);

      try {
        const networkError = new TypeError("fetch failed");
        networkError.cause = Object.assign(
          new Error("connect ECONNRESET tts.example.test"),
          { code: "ECONNRESET" },
        );
        global.fetch = async () => {
          throw networkError;
        };
        try {
          await synthesizeSpeech({ text: "Welcome", language: "en" });
          throw new Error("Expected the connection error to be rejected");
        } catch (error) {
          if (error.statusCode !== 503) throw error;
        }

        const timeoutError = new Error("request aborted");
        timeoutError.name = "AbortError";
        global.fetch = async () => {
          throw timeoutError;
        };
        try {
          await synthesizeSpeech({ text: "Welcome", language: "en" });
          throw new Error("Expected the timeout to be rejected");
        } catch (error) {
          if (error.statusCode !== 504) throw error;
        }

        const diagnostics = diagnosticLogs
          .filter((args) => args[0] === "[TTS proxy]")
          .map((args) => JSON.parse(args[1]));
        if (
          !diagnostics.some(
            (entry) =>
              entry.event === "upstream_connection_error" &&
              entry.errorCode === "ECONNRESET",
          ) ||
          !diagnostics.some((entry) => entry.event === "upstream_timeout") ||
          diagnostics.some((entry) => JSON.stringify(entry).includes(testToken))
        ) {
          throw new Error("Expected connection and timeout diagnostics without credentials");
        }
      } finally {
        global.fetch = originalFetch;
        console.error = originalConsoleError;
        if (previousEnvironment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousEnvironment;
        if (previousUrl === undefined) delete process.env.TTS_SERVICE_URL;
        else process.env.TTS_SERVICE_URL = previousUrl;
        if (previousToken === undefined) delete process.env.TTS_SERVICE_TOKEN;
        else process.env.TTS_SERVICE_TOKEN = previousToken;
      }
    });

    await test("TTS proxy logs invalid response formats safely", async () => {
      const previousEnvironment = process.env.NODE_ENV;
      const previousUrl = process.env.TTS_SERVICE_URL;
      const previousToken = process.env.TTS_SERVICE_TOKEN;
      const originalFetch = global.fetch;
      const originalConsoleError = console.error;
      const testToken = "test-tts-secret-not-for-logs";
      const diagnosticLogs = [];
      const { synthesizeSpeech } = require("../src/services/tts.service");
      process.env.NODE_ENV = "production";
      process.env.TTS_SERVICE_URL = "https://tts.example.test";
      process.env.TTS_SERVICE_TOKEN = testToken;
      global.fetch = async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: async () => JSON.stringify({
          detail: `Auth failed: Bearer ${testToken}`,
          authorization: `Bearer ${testToken}`,
        }),
      });
      console.error = (...args) => diagnosticLogs.push(args);

      try {
        try {
          await synthesizeSpeech({ text: "Welcome", language: "en" });
          throw new Error("Expected invalid response format to be rejected");
        } catch (error) {
          if (error.statusCode !== 502) throw error;
        }

        const log = diagnosticLogs.find((args) => args[0] === "[TTS proxy]");
        if (!log) throw new Error("Expected a TTS diagnostic log");
        const diagnostic = JSON.parse(log[1]);
        if (
          diagnostic.event !== "upstream_invalid_response_format" ||
          diagnostic.status !== 200 ||
          diagnostic.contentType !== "application/json" ||
          diagnostic.responseBody.includes(testToken)
        ) {
          throw new Error("Expected safe invalid-format diagnostics");
        }
      } finally {
        global.fetch = originalFetch;
        console.error = originalConsoleError;
        if (previousEnvironment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousEnvironment;
        if (previousUrl === undefined) delete process.env.TTS_SERVICE_URL;
        else process.env.TTS_SERVICE_URL = previousUrl;
        if (previousToken === undefined) delete process.env.TTS_SERVICE_TOKEN;
        else process.env.TTS_SERVICE_TOKEN = previousToken;
      }
    });

    await test("POST /api/tutor/speech rejects unsupported languages and long text", async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => {
        throw new Error("TTS service should not be called for invalid input");
      };
      try {
        for (const body of [
          { text: "Hello", language: "fr" },
          { text: "a".repeat(2001), language: "en" },
          { text: "Hello", language: "en", rate: 1.3 },
        ]) {
          const res = await request(
            {
              hostname: "localhost",
              port: TEST_PORT,
              path: "/api/tutor/speech",
              method: "POST",
              headers: { "Content-Type": "application/json" },
            },
            body,
          );
          if (res.status !== 400)
            throw new Error(`Expected 400 for invalid input, got ${res.status}`);
        }
      } finally {
        global.fetch = originalFetch;
      }
    });

    await test("POST /api/tutor/speech returns safe service-unavailable and timeout errors", async () => {
      const originalFetch = global.fetch;
      try {
        global.fetch = async () => {
          throw new Error("private upstream network detail");
        };
        const unavailable = await request(
          {
            hostname: "localhost",
            port: TEST_PORT,
            path: "/api/tutor/speech",
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
          { text: "Welcome", language: "en" },
        );
        if (unavailable.status !== 503 || unavailable.body.error.includes("private upstream"))
          throw new Error("Expected a generic HTTP 503 service error");

        global.fetch = async () => {
          const error = new Error("request aborted");
          error.name = "AbortError";
          throw error;
        };
        const timeout = await request(
          {
            hostname: "localhost",
            port: TEST_PORT,
            path: "/api/tutor/speech",
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
          { text: "Welcome", language: "en" },
        );
        if (timeout.status !== 504)
          throw new Error(`Expected 504, got ${timeout.status}`);
      } finally {
        global.fetch = originalFetch;
      }
    });

    await test("POST /api/tutor/speech rejects empty text without calling the TTS service", async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => {
        throw new Error("TTS service should not be called for invalid input");
      };
      try {
        const res = await request(
          {
            hostname: "localhost",
            port: TEST_PORT,
            path: "/api/tutor/speech",
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
          { text: "   ", language: "am" },
        );
        if (res.status !== 400)
          throw new Error(`Expected 400, got ${res.status}`);
      } finally {
        global.fetch = originalFetch;
      }
    });

    // 4. Test for Fabricated Answers and Unsupported Questions
    await test("POST /api/tutor/ask refuses unsupported questions without inventing citations", async () => {
      const res = await request(
        {
          hostname: "localhost",
          port: TEST_PORT,
          path: "/api/tutor/ask",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        {
          question:
            "How do I bake a chocolate cake with sprinkles and vanilla frosting?",
          language: "en",
        },
      );

      if (res.status !== 200)
        throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.isGrounded !== false)
        throw new Error("Expected isGrounded: false for off-topic inquiry");
      if (res.body.mode !== "unsupported_refusal")
        throw new Error(
          `Expected mode 'unsupported_refusal', got ${res.body.mode}`,
        );
      if (res.body.sources.length !== 0)
        throw new Error("Must NOT invent citations for off-topic questions");
      if (
        !res.body.answer.includes("not covered in your active course materials")
      ) {
        throw new Error(
          "Expected polite refusal text explaining answer cannot be found",
        );
      }
    });

    // 5. Test Missing Citations Prevention
    await test("Grounded questions must never produce missing citations", async () => {
      const res = await request(
        {
          hostname: "localhost",
          port: TEST_PORT,
          path: "/api/tutor/ask",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        {
          question: "What is the BLUF model?",
          language: "en",
        },
      );

      if (res.status !== 200)
        throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.sources || res.body.sources.length === 0) {
        throw new Error("Citation is missing for a valid course question");
      }
      for (const s of res.body.sources) {
        if (!s.courseTitle || !s.moduleTitle || !s.lessonTitle || !s.snippet) {
          throw new Error("Found incomplete citation object");
        }
      }
    });

    // 6. Simple-Language Explanations (English & Amharic)
    await test("POST /api/tutor/ask with simplify: true returns plain-language explanation", async () => {
      const previousProvider = process.env.AI_PROVIDER;
      process.env.AI_PROVIDER = "mock_demo";
      try {
        const res = await request(
          {
            hostname: "localhost",
            port: TEST_PORT,
            path: "/api/tutor/ask",
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
          {
            question: "What is the graduation threshold for this course?",
            language: "en",
            simplify: true,
          },
        );

        if (res.status !== 200)
          throw new Error(`Expected 200, got ${res.status}`);
        if (res.body.simplified !== true)
          throw new Error("Expected simplified: true");
        if (
          !res.body.answer.includes("Simple Explanation") &&
          !res.body.answer.includes("Plain Language")
        ) {
          throw new Error("Expected simple explanation header in response");
        }
      } finally {
        if (previousProvider === undefined) delete process.env.AI_PROVIDER;
        else process.env.AI_PROVIDER = previousProvider;
      }
    });

    // 7. Offline FAQ Matching
    await test("POST /api/tutor/ask matches offline FAQ from faqs.json", async () => {
      const res = await request(
        {
          hostname: "localhost",
          port: TEST_PORT,
          path: "/api/tutor/ask",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        {
          question: "What is active listening?",
          language: "en",
        },
      );

      if (res.status !== 200)
        throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.answer.toLowerCase().includes("active listening")) {
        throw new Error("Did not match active listening FAQ");
      }
    });

    // 8. Zero-PII Anonymous Teacher Analytics
    await test("GET /api/analytics/summary redacts learner names, emails, and phone numbers", async () => {
      // Send a query containing sensitive personal identifiable information
      await request(
        {
          hostname: "localhost",
          port: TEST_PORT,
          path: "/api/tutor/ask",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        {
          question:
            "My name is John Doe and my email is john.doe@example.com, how do I pass?",
          language: "en",
        },
      );

      const res = await request({
        hostname: "localhost",
        port: TEST_PORT,
        path: "/api/analytics/summary",
        method: "GET",
      });

      if (res.status !== 200)
        throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.data || res.body.data.totalQuestions === 0)
        throw new Error("Expected analytics data");

      const inquiries = res.body.data.recentAnonymousInquiries || [];
      const logged = inquiries.find((i) =>
        i.question.includes("how do I pass?"),
      );
      if (!logged)
        throw new Error("Logged query not found in analytics stream");

      // Ensure email and name were scrubbed
      if (logged.question.includes("john.doe@example.com")) {
        throw new Error("PII Violation: Email was not redacted in analytics!");
      }
      if (logged.question.includes("John Doe")) {
        throw new Error(
          "PII Violation: Learner name was not redacted in analytics!",
        );
      }
      if (
        !logged.question.includes("[REDACTED_EMAIL]") ||
        !logged.question.includes("[REDACTED_NAME]")
      ) {
        throw new Error(
          "Expected redaction placeholders in logged question text",
        );
      }
    });

    // 9. Teacher Analytics Frequently Asked Questions Endpoint
    await test("GET /api/analytics/faqs returns clustered topic frequencies", async () => {
      const res = await request({
        hostname: "localhost",
        port: TEST_PORT,
        path: "/api/analytics/faqs",
        method: "GET",
      });

      if (res.status !== 200)
        throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.data) || res.body.data.length === 0) {
        throw new Error("Expected list of clustered FAQ topics");
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
  console.error("Fatal test error:", err);
  process.exit(1);
});
