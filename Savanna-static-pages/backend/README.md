# Voice4All — Backend & AI Foundation (Phase 1)

This service provides the backend foundation and intelligent AI tutor for the Voice4All accessible learning platform. It powers conversational course guidance in English and Amharic, provides grounded citations from real course materials, and provides extension points for Support and Career services.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18+ (tested on Node v24)
- npm v9+

### 2. Installation
Navigate to the `backend` directory and install dependencies:
```bash
cd backend
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Review and adjust variables in `.env`:
```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*
DEFAULT_LANGUAGE=en
AI_PROVIDER=mock_demo
```

> **Security Note:** Never commit `.env` or expose private API keys in client-side code.

### 4. Running the Server

#### Development mode:
```bash
npm run dev
```

#### Production mode:
```bash
npm start
```

The server starts on `http://localhost:5000`.

### 5. Running Automated Tests
```bash
npm test
```
Executes automated endpoint verification tests covering health checks, bilingual Q&A, context-aware citations, FAQ matches, input validation, and mounted Member 3 route placeholders.

---

## 📡 API Endpoints

### 1. Health Check
- **Endpoint:** `GET /api/health`
- **Description:** Verifies service availability, uptime, active AI provider, and route mount statuses.
- **Example Response:**
```json
{
  "status": "ok",
  "service": "voice4all-backend",
  "version": "1.0.0",
  "environment": "development",
  "uptimeSeconds": 142,
  "timestamp": "2026-11-14T10:40:00.000Z",
  "aiProvider": "mock_demo",
  "mountedEndpoints": [
    { "path": "/api/health", "status": "ready" },
    { "path": "/api/tutor", "status": "ready" },
    { "path": "/api/support", "status": "mounted" },
    { "path": "/api/career", "status": "mounted" }
  ]
}
```

---

### 2. Tutor Q&A
- **Endpoint:** `POST /api/tutor/ask`
- **Description:** Ask a question in English or Amharic with optional active lesson context. Returns answers strictly cited from course materials.

#### Request Parameters:
| Field | Type | Required | Description |
|---|---|---|---|
| `question` | string | **Yes** | Question from learner |
| `language` | string | No | `'en'` (English) or `'am'` (Amharic). Auto-detected if omitted. |
| `context` | object | No | Active lesson metadata (`courseTitle`, `moduleTitle`, `lessonTitle`, `lessonText`) |

#### Sample Request (English without context):
```bash
curl -X POST http://localhost:5000/api/tutor/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the future of the virtual assistant industry?",
    "language": "en"
  }'
```

#### Sample Response:
```json
{
  "answer": "Hello! Regarding your question (\"What is the future of the virtual assistant industry?\"), here is the core explanation based on \"The Future of the VA Industry\" in VA-1: VA Foundations & Professional Identity:\n\n\"The Virtual Assistant (VA) industry has evolved from basic administrative support into specialized digital partnerships.\"\n\nKey Takeaway: Review this section in your course module to apply these principles directly to your learning activities. Let me know if you would like to explore this concept further!",
  "language": "en",
  "sources": [
    {
      "courseTitle": "VA-1: VA Foundations & Professional Identity",
      "moduleTitle": "Module 1: The Modern Virtual Assistant",
      "lessonTitle": "The Future of the VA Industry",
      "snippet": "The Virtual Assistant (VA) industry has evolved from basic administrative support into specialized digital partnerships.",
      "score": 14.5
    }
  ],
  "mode": "mock_demo"
}
```

#### Sample Request (Amharic):
```bash
curl -X POST http://localhost:5000/api/tutor/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "ንቁ ማዳመጥ በግንኙነት ውስጥ ምን ጥቅም አለው?",
    "language": "am"
  }'
```

#### Sample Response:
```json
{
  "answer": "ሰላም! ለጥያቄዎ (\"ንቁ ማዳመጥ በግንኙነት ውስጥ ምን ጥቅም አለው?\") በተመለከተ በWR 100: Fundamentals of Effective Communication ውስጥ በActive Listening and Empathetic Feedback ላይ የተጠቀሰው ዋና ነጥብ የሚከተለው ነው:\n\n\"ንቁ ማዳመጥ (Active listening) ተናጋሪው የሚናገረውን በዝምታ ከመስማት ይልቅ ሙሉ ትኩረትን መስጠት፣ መረዳት፣ መልስ መስጠት እና ማስታወስን ይጠይቃል።\"\n\nየጥናት ማሳሰቢያ: ይህንን ፅንሰ-ሀሳብ በሚገባ ለመረዳት በትምህርቱ ውስጥ የቀረቡትን ተግባራዊ ልምምዶች እና ምሳሌዎች ይከልሱ። ተጨማሪ እገዛ ከፈለጉ መጠየቅ ይችላሉ!",
  "language": "am",
  "sources": [
    {
      "courseTitle": "WR 100: Fundamentals of Effective Communication",
      "moduleTitle": "Module 1: Foundations of Communication",
      "lessonTitle": "Active Listening and Empathetic Feedback",
      "snippet": "ንቁ ማዳመጥ (Active listening) ተናጋሪው የሚናገረውን በዝምታ ከመስማት ይልቅ ሙሉ ትኩረትን መስጠት፣ መረዳት፣ መልስ መስጠት እና ማስታወስን ይጠይቃል።",
      "score": 8.0
    }
  ],
  "mode": "mock_demo"
}
```

#### Sample Request with Active Learner Context:
```bash
curl -X POST http://localhost:5000/api/tutor/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the passing grade for graduation?",
    "language": "en",
    "context": {
      "courseTitle": "VA-1: VA Foundations & Professional Identity",
      "moduleTitle": "Module 1: Orientation",
      "lessonTitle": "Course Progression & Grading",
      "lessonText": "To graduate from this programme, learners must achieve an overall course score of at least 70% across all milestone evaluations."
    }
  }'
```

#### Sample Response:
```json
{
  "answer": "Hello! Regarding your question (\"What is the passing grade for graduation?\"), here is the core explanation based on \"Course Progression & Grading\" in VA-1: VA Foundations & Professional Identity:\n\n\"To graduate from this programme, learners must achieve an overall course score of at least 70% across all milestone evaluations.\"\n\nKey Takeaway: Review this section in your course module to apply these principles directly to your learning activities. Let me know if you would like to explore this concept further!",
  "language": "en",
  "sources": [
    {
      "courseTitle": "VA-1: VA Foundations & Professional Identity",
      "moduleTitle": "Module 1: Orientation",
      "lessonTitle": "Course Progression & Grading",
      "snippet": "To graduate from this programme, learners must achieve an overall course score of at least 70% across all milestone evaluations.",
      "score": 14.0
    }
  ],
  "mode": "mock_demo"
}
```

---

### 3. Support & Career Routes (Member 3 Mounts)
- **Support Route:** `ALL /api/support`
- **Career Route:** `ALL /api/career`
- **Behavior:** The backend automatically checks if Member 3's route handlers exist at:
  - `backend/src/routes/support.routes.js`
  - `backend/src/routes/career.routes.js`
- When Member 3 adds these files, they mount dynamically on startup without modifying `server.js`.
- Until Member 3 creates them, requests return `501 Not Implemented` with `{ status: "pending_member_3" }`.

---

## 🏛️ AI Provider Architecture

The AI subsystem (`src/services/ai.service.js`) uses a pluggable Provider pattern inheriting from `BaseAIProvider`:

```
          ┌───────────────────────────────────┐
          │      POST /api/tutor/ask          │
          └─────────────────┬─────────────────┘
                            │
               ┌────────────▼───────────┐
               │   retrieval.service    │
               │ (Course & Context RAG) │
               └────────────┬───────────┘
                            │
           ┌────────────────▼────────────────┐
           │      AI Provider Dispatcher     │
           └────────────────┬────────────────┘
                            │
      ┌──────────────┬──────┴───────┬──────────────┐
      │              │              │              │
┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
│  MockDemo  │ │ OfflineFAQ │ │  CloudAI   │ │  LocalAI   │
│ (mode:     │ │ (mode:     │ │ (mode:     │ │ (mode:     │
│ mock_demo) │ │ offline_   │ │ cloud_ai)  │ │ local_ai)  │
│ [Tested]   │ │ faq)       │ │ [Untested] │ │ [Untested] │
│            │ │ [Tested]   │ │            │ │            │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

### Modes & Grounded Factual Integrity:
1. **`mock_demo` (Active by default):**
   - Synthesizes educational explanations based *strictly* on retrieved course materials or passed context.
   - Never fabricates facts or non-existent course modules.
   - Fully supports English and Amharic.
2. **`offline_faq`:**
   - Performs rapid token-overlap lookup on pre-approved FAQs in `course-content.json`.
3. **`cloud_ai`:**
   - Architecture ready for Gemini / OpenAI integration via environment variable `OPENAI_API_KEY` / `GEMINI_API_KEY`.
   - Per policy, strictly marked as demo-fallback until live API keys are provided and tested.
4. **`local_ai`:**
   - Architecture ready for local offline inference (Ollama / llama.cpp) via `LOCAL_MODEL_URL`.

---

## 📂 File Ownership & Project Structure

```
backend/
├── .env.example                   # Environment configuration template
├── .env                           # Local environment file (git-ignored)
├── .gitignore                     # Git ignore rules
├── package.json                   # Dependencies and scripts
├── README.md                      # Backend setup and documentation
├── data/
│   └── course-content.json        # Structured course knowledge base (Savanna curriculum)
├── src/
│   ├── server.js                  # Express setup, CORS, error handling, route mounting
│   ├── routes/
│   │   ├── tutor.routes.js        # /api/tutor/ask route handler
│   │   ├── support.routes.js      # (Owned by Member 3 - mounted automatically when created)
│   │   └── career.routes.js       # (Owned by Member 3 - mounted automatically when created)
│   └── services/
│       ├── ai.service.js          # AI provider interface, Amharic/English handling, modes
│       └── retrieval.service.js   # Keyword search, context RAG, factual source extraction
└── test/
    └── test-endpoints.js          # Automated end-to-end endpoint test suite
```

---

## 📋 Integration Contract for Member 3

Member 3 should create the following files:
1. `backend/src/routes/support.routes.js`
   - Must export an Express `Router` (either `module.exports = router` or `export default router`).
   - Will automatically handle requests to `/api/support/*`.
2. `backend/src/routes/career.routes.js`
   - Must export an Express `Router`.
   - Will automatically handle requests to `/api/career/*`.

No changes to `server.js` are required when Member 3 adds these files.

