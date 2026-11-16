# Voice4All — ALX Digital Bridge Accessibility Platform

> **ALX Digital Bridge Accessibility Hackathon**  
> An inclusive, multilingual, and honest learning companion built upon ALX Savanna to empower learners of all abilities with AI-assisted learning, accessible career opportunities, and direct human mentorship.

---

## 1. Project Overview & Purpose

**Voice4All** extends the ALX Savanna platform into a fully accessible educational ecosystem designed specifically for diverse learners, including those with visual impairments, motor disabilities, neurodivergent learning styles, low-bandwidth internet connectivity, and non-English language preferences (with full **Amharic** and **English** localization).

Traditional e-learning platforms often isolate learners when automated systems fail, or make false claims about live assistance. Voice4All solves these challenges through:
1. **Grounded Multilingual AI Tutoring:** Answers derived strictly from curriculum course content with exact citations, plain-language simplification, and offline fallback.
2. **Honest Human Support & Screen-Sharing:** A real-time queue system with full consent transparency, zero misleading "connecting..." states, and learner-controlled screen sharing.
3. **Inclusive Career Development Gateway:** Accessible job browsing with transparency disclosures, accommodations self-advocacy generators, and low-bandwidth SMS/Telegram notifications.

---

## 2. Architecture Overview

```
Voice4All System Architecture
┌────────────────────────────────────────────────────────────────────────┐
│                        ALX Savanna Frontend Layer                      │
│                                                                        │
│  Savanna Pages             Human Support Portal    Career Gateway      │
│  (Concept, Homepage)       (Learner & Agent Views) (Resources & Jobs)  │
│  pages/concept-...html     pages/human-support     pages/career-...    │
│  Savanna-static-pages/     pages/support-dashboard                     │
│                                                                        │
│  Accessibility Core        Voice & Speech Engines  Career Client       │
│  assets/js/voice4all/      assets/js/speech/       assets/js/career/   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST / JSON
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Express.js Backend Service (Node.js)                │
│                                                                        │
│  Middleware: support.middleware.js (Role-based Auth & Validation)      │
│                                                                        │
│  Controllers & Routes:                                                 │
│  ├─ /api/tutor       (Grounded AI course Q&A, citations, Amharic)      │
│  ├─ /api/support     (Queue, tickets, screen share, agent assignment)  │
│  ├─ /api/career      (Jobs, resources, accommodations, notifications)  │
│  └─ /api/analytics   (Teacher dashboard, privacy-preserving metrics)   │
│                                                                        │
│  Services & Data Stores:                                               │
│  ├─ ai.service.js / retrieval.service.js (course-content.json)         │
│  ├─ support.service.js (support-tickets.json, audit history)           │
│  ├─ career.service.js (career-resources.json, jobs dataset)            │
│  └─ notifications/ (Telegram bot & low-bandwidth SMS adapters)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Completed Features by Module

### Module 1: Human Support & Queue System (Member 1 & Member 2)
- **Learner Support Portal (`pages/human-support.html`):**
  - Intuitive assistance requests with course context auto-detection.
  - Multi-channel support options: Text Chat, Voice Guidance, and Consented Screen Sharing.
  - Live queue status monitor showing true queue position, estimated wait times, and honest connection status.
  - Interactive message thread between learner and assigned support specialist.
  - Instant one-click "Stop Screen Sharing" control giving learners complete privacy autonomy.
- **Support-Person Workspace (`pages/support-dashboard.html` & `/api/support/dashboard`):**
  - Triage console displaying queued learners, urgency levels, and requested assistance modes.
  - Agent ticket claiming, live connection confirmation, and resolution notes recording.
- **Backend API & Data Persistence (`backend/src/routes/support.routes.js`):**
  - Formatted ticket tracking (`REQ-YYYY-XXXX`), strict input validation, and role-based access control (`learner`, `agent`, `admin`).
  - Strict affirmative consent enforcement for screen sharing prior to agent connection.
  - Disk-backed JSON ticket store (`backend/data/support-tickets.json`) for local deployments. Render free filesystems are ephemeral, so production ticket persistence requires a managed database or persistent storage.

### Module 2: Grounded AI Tutor & Multilingual Speech (Workstream B)
- **Course-Grounded Retrieval:**
  - Semantic and lexical retrieval engine answering strictly from Savanna lesson content (`course-content.json`).
  - Refuses unsupported or out-of-scope questions without fabricating hallucinated citations.
  - Every grounded answer includes verified source citations with direct lesson references.
- **Multilingual Support:** Full English and Amharic question-answering with localized responses and speech synthesis.
- **Plain-Language Simplification:** Instant re-explanation of complex concepts into simple, readable summaries.
- **Offline FAQ Fallback:** Zero-latency answers served from curated FAQ caches when offline or disconnected.
- **Teacher Intelligence Dashboard (`pages/teacher-dashboard.html`):**
  - Aggregated analytics on student queries, confusion hot-spots, and topic trends.
  - Built with strict privacy protection: learner names, emails, and phone numbers are completely redacted.

### Module 3: Career Development Gateway & Low-Bandwidth Alerts (Member 3)
- **Accessible Career Portal (`pages/career-development.html`):**
  - Specialized job board featuring verified accessibility disclosures (screen reader friendliness, flexible hours, ergonomic equipment, remote readiness).
  - Multi-category professional skills modules (assistive technology mastery, workplace self-advocacy, interview readiness).
  - Grounded AI Career Advisor providing job recommendations and resume tips.
- **Interview Accommodation Request Generator:**
  - Interactive tool drafting formal, professional accommodation requests tailored to individual accessibility needs.
- **Low-Bandwidth Multi-Channel Notifications:**
  - **Telegram Bot Integration:** Markdown-formatted job alert broadcasts with clean screen-reader accessibility.
  - **Low-Bandwidth SMS Adapter:** Accurate 160-character segment calculator and automated simulation for low-connectivity regions.

---

## 4. Installation and Setup Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **Modern Web Browser**: Chrome, Edge, Firefox, or Safari

### Installation Steps
1. Clone the repository and navigate into the project root:
   ```bash
   git clone https://github.com/Bezawit-Taye/Voice4All.git
   cd Voice4All
   ```
2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   cd ..
   ```

### Production Deployment

For Vercel frontend and Render Node.js/FastAPI deployment settings, see the [production deployment guide](docs/deployment.md). Deployment remains a manual action in the Vercel and Render dashboards.

---

## 5. How to Run the Application

### 1. Start the Backend API Server
From the `backend` directory or project root:
```bash
# In the backend directory:
npm start

# Or from project root:
node backend/src/server.js
```
The server will start on port `5000` (or the next available port, e.g. `5099`):
```
[Server] Voice4All API server listening on http://localhost:5000
[Router] Support router successfully loaded from routes/support.routes.js
[Router] Career router successfully loaded from routes/career.routes.js
```

### 2. Open the Frontend Application
The Express backend serves the frontend on the same origin. Open:
- **Project Landing Page:** `http://localhost:5000/`
- **Savanna Learning Page and Tutor:** `http://localhost:5000/pages/concept-with-navigation.html`
- **Career Development Hub:** `http://localhost:5000/pages/career-development.html`
- **Human Support Portal (Learner):** `http://localhost:5000/pages/human-support.html`
- **Support-Person Workspace (Agent):** `http://localhost:5000/pages/support-dashboard.html`
- **Teacher Analytics Dashboard:** `http://localhost:5000/pages/teacher-dashboard.html`

### Configure the live Gemini tutor
Set these values in `backend/.env` (do not put API keys in frontend files or commit them):
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```
When Gemini is selected, missing credentials or API errors are shown as errors rather than silently replaced with a demo answer. Course excerpts are retrieved locally and sent with the question; common email, phone, and name patterns are redacted before the Gemini request. Check your Google AI Studio account's current quota and billing terms.

### Enable English and Amharic speech
The tutor requests MP3 audio from the backend's Edge TTS service. Learners only communicate with the Node.js API; they do not install Python or run a speech service themselves. Edge TTS uses Microsoft's online speech service, requires an internet connection, and is an unofficial client that may change or become unavailable. It requires no API key and is not guaranteed to remain free or available indefinitely.

From the repository root, install the Python service dependencies in the existing virtual environment, then run the service in one terminal:
```powershell
backend\tts\.venv\Scripts\python.exe -m pip install -r backend\tts\requirements.txt
backend\tts\.venv\Scripts\python.exe -m uvicorn edge_tts_server:app --app-dir backend\tts --host 127.0.0.1 --port 8001
```

In another terminal, start the Node.js backend:
```powershell
cd backend
npm run dev
```

Keep `TTS_SERVICE_URL=http://127.0.0.1:8001` in `backend/.env`. The same service URL works when Node and Python run on the same host; for separate hosts, set it to the private internal URL reachable by Node. Verify the Python service at `http://127.0.0.1:8001/health`. Amharic uses the `am-ET-MekdesNeural` voice and English uses `en-US-AriaNeural`. If Edge TTS or the internet is unavailable, the UI reports the error and may fall back to a voice installed in the browser.

### Voice navigation assistant
The Voice4All launcher is available on the learner dashboard, learning materials, career, and support pages. On first use, opening the launcher shows a bilingual, keyboard-accessible choice to enable or decline voice guidance. The choice and voice settings are saved in browser `localStorage`; learners can change them from **Voice settings** in the assistant. Settings include spoken language, female/male voice, speaking rate (0.75×–1.25×), automatic page announcements, learning-content reading, and speech controls. A skip-to-main-content link is added when the page does not already provide one. Voice guidance is optional and complements, rather than replaces, keyboard navigation and screen readers.

Career cards include a **Chat on Telegram** link to [Voice4AllCareerBot](https://t.me/Voice4AllCareerBot). The bot account must exist on Telegram for the link to open a live chat.

---

## 6. API Documentation Summary

| Method | Endpoint | Description | Auth / Role |
|--------|----------|-------------|-------------|
| `GET` | `/api/health` | Service health status and active modules | Public |
| `POST` | `/api/tutor/ask` | Grounded multilingual AI course tutor | Public |
| `POST` | `/api/tutor/speech` | MP3 speech generated by the Edge TTS service | Public |
| `GET` | `/api/support/requests` | List active support tickets | Learner / Agent |
| `POST` | `/api/support/requests` | Create a support ticket with consent check | Learner |
| `GET` | `/api/support/requests/:id` | Get individual ticket status and queue position | Public / Learner |
| `PATCH` | `/api/support/requests/:id/status` | Update ticket status lifecycle | Agent / Admin |
| `POST` | `/api/support/requests/:id/assign` | Connect human agent to ticket | Agent / Admin |
| `POST` | `/api/support/requests/:id/screen-share/stop` | Immediately stop screen sharing | Learner / Agent |
| `POST` | `/api/support/requests/:id/messages` | Send message in support ticket thread | Learner / Agent |
| `POST` | `/api/support/requests/:id/resolve` | Resolve ticket with notes | Agent / Admin |
| `GET` | `/api/support/queue` | Support queue summary and active items | Agent / Admin |
| `GET` | `/api/career/jobs` | Browse accessible job opportunities | Public |
| `GET` | `/api/career/resources` | Fetch professional learning modules | Public |
| `POST` | `/api/career/questions` | Ask career advisory AI with job matching | Public |
| `POST` | `/api/career/accommodation-requests` | Draft interview accommodation requests | Public |
| `POST` | `/api/career/notifications/telegram/broadcast` | Broadcast job alert via Telegram | Agent / Admin |
| `POST` | `/api/career/notifications/sms/send` | Send low-bandwidth SMS alert simulation | Public |
| `GET` | `/api/analytics/summary` | Anonymous privacy-redacted tutor metrics | Teacher / Admin |

---

## 7. Testing Instructions

Voice4All includes a complete suite of automated integration, API, and accessibility test suites:

```bash
# Run all core backend endpoints tests
node backend/test/test-endpoints.js

# Run Phase 2 Human Support & Career Integration tests (20 tests)
node backend/test/test-phase2.js

# Run Phase 3 Support Workflow & Notifications tests (12 tests)
node backend/test/test-phase3.js

# Run Phase 4 Member 2 Support Backend tests (12 tests)
node backend/test/test-support-phase4.js

# Run Phase 4 Career Development & WCAG Accessibility tests (10 tests)
node backend/test/test-phase4.js
```

**Total Passing Test Count: 63 / 63 tests passing (100% pass rate).**

---

## 8. WCAG 2.1 AA Accessibility Conformance

- **Keyboard Navigability:** Full keyboard access (Tab, Shift+Tab, Arrow keys, Enter, Space, and Escape) across all interactive cards, modals, tabs, and forms with high-visibility `3px` focus indicators.
- **Screen Reader Support:** Semantic HTML5 elements (`<header>`, `<main>`, `<nav>`, `<section>`), ARIA landmark roles, `aria-live="polite"` dynamic notification regions, and accessible form labels.
- **Color & Contrast:** Exceeds WCAG 2.1 AA contrast ratios (4.5:1 for normal text, 3:1 for large text) across standard and High Contrast modes.
- **Motion & Preferences:** Fully respects `prefers-reduced-motion` to suppress transitions and animations for motion-sensitive learners.
- **Multilingual Readability:** Integrated font stack support for Ge'ez/Ethiopic script (Amharic) and Latin scripts.

---

## 9. Team Member Contributions

| Member | Primary Workstream & Responsibilities | Key Deliverables & Files |
|--------|---------------------------------------|--------------------------|
| **Member 1** | **Workstream A & Phase 4 Frontend Lead:** Human Support Frontend UI, Accessibility Engineering | `pages/human-support.html`, `assets/css/human-support.css`, `assets/js/voice4all/support/human-support-ui.js`, `loader.js`, `embed.js`, `accessibility.js` |
| **Member 2** | **Workstream B & Phase 4 Backend Lead:** AI Tutor APIs, Human Support Backend & Architecture | `backend/src/routes/support.routes.js`, `backend/src/controllers/support.controller.js`, `backend/src/services/support.service.js`, `backend/src/middleware/support.middleware.js`, `backend/src/services/ai.service.js`, `backend/data/support-tickets.json` |
| **Member 3** | **Workstream C & Phase 4 Career Lead:** Career Development Gateway & Notification Infrastructure | `pages/career-development.html`, `assets/css/career.css`, `assets/js/voice4all/career/career-app.js`, `assets/js/voice4all/career/career-client.js`, `backend/src/routes/career.routes.js`, `backend/src/services/career.service.js`, `backend/data/career-resources.json` |
| **Phase 5 Lead** | **Integration, Quality Assurance & Hackathon Coordination:** Repository Integration & Verification | Clean Git merge coordination, cross-navigation resolution, agent assignment auto-greeting, test suite unification (63 passing tests), WCAG audit, and final submission reports |

---

## 10. License

Built for the **ALX Digital Bridge Accessibility Hackathon (2026)**.
Distributed under the ISC License.
