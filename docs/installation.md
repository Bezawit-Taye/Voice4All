# Voice4All — Universal Installation & Integration Guide

> **Definition of Done:** A developer unfamiliar with this codebase can follow this guide and have the Voice4All learning assistant widget fully working on their website in **under one hour**.

---

## 1. Overview & Architecture

**Voice4All** is an embeddable, accessible assistive widget designed for digital learning environments. It provides:
1. **Interactive AI Tutor** with conversational speech synthesis (TTS), speech-to-text input, and lesson source citations.
2. **Live Mentor Support** with honest screen-sharing status indication.
3. **Inclusive Career Hub** with job listings and workplace accommodation requests.
4. **Bilingual Support** (English & Amharic with full Ge'ez typography support).
5. **Universal Accessibility** (Keyboard navigation, screen reader live announcements, sound-off visual captions, 200% zoom reflow, and low-cost mobile optimizations).

Voice4All operates as a **zero-dependency plugin**: it bundles its own scoped styles (`v4a-` namespace), provides fallback SVG icons if icon fonts are absent, and does not interfere with the host website's CSS or JavaScript.

---

## 2. Quickstart: 1-Line Script Installation

To install Voice4All on any web page, paste the following `<script>` tag before the closing `</body>` tag:

```html
<!-- Voice4All Standalone Plugin -->
<script
  src="https://your-domain.com/assets/js/voice4all/loader.js"
  data-api-base="https://your-api-domain.com"
  data-lang="en"
  data-position="bottom-right"
  data-simple-mode="false"
  async
></script>
```

### Local / Relative Path Example:
If you are hosting the assets locally in your project:
```html
<script src="/assets/js/voice4all/loader.js" async></script>
```

---

## 3. Configuration Attributes (`data-*`)

You can customize Voice4All directly via HTML attributes on the `<script>` tag:

| Attribute | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `data-api-base` | `string` | `""` (relative) | Base URL for Voice4All backend API (e.g. `http://localhost:5000` or `https://api.domain.com`). |
| `data-lang` | `'en' \| 'am'` | `'en'` | Initial interface language. Supported: English (`en`) and Amharic (`am`). |
| `data-position` | `'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Screen corner placement of the floating launcher button. |
| `data-simple-mode` | `'true' \| 'false'` | `'false'` | When `true`, enables simplified language explanations and larger text by default. |
| `data-theme` | `'default' \| 'high-contrast'` | `'default'` | Visual theme mode. |
| `data-auto-init` | `'true' \| 'false'` | `'true'` | Automatically render launcher and drawer on DOM load. |
| `data-css-url` | `string` | *(auto-detected)* | Custom URL to override the location of `voice4all.css`. |

### Alternative: JavaScript Global Configuration
You can also set options via `window.VOICE4ALL_CONFIG` before the script executes:
```html
<script>
  window.VOICE4ALL_CONFIG = {
    apiBase: 'https://api.myplatform.org',
    lang: 'am',
    simpleMode: false,
    position: 'bottom-right'
  };
</script>
<script src="/assets/js/voice4all/loader.js" async></script>
```

---

## 4. Programmatic JavaScript API (`window.Voice4All`)

Once loaded, Voice4All exposes a global controller object: `window.Voice4All`.

### Awaiting Initialization
```javascript
window.addEventListener('voice4all:ready', (event) => {
  console.log('Voice4All version:', event.detail.version);
});

// Or using the Promise API:
window.Voice4AllReady.then((v4a) => {
  v4a.open();
});
```

### Core Methods Reference

#### Widget Visibility
```javascript
// Open the side drawer (shifts focus inside dialog)
Voice4All.open();

// Close the side drawer (restores focus to trigger)
Voice4All.close();

// Toggle between open and closed
Voice4All.toggle();

// Check if currently open
const isOpen = Voice4All.isOpen(); // returns true / false
```

#### Language & Simple Mode
```javascript
// Switch language ('en' for English, 'am' for Amharic)
Voice4All.setLanguage('am');

// Get current language
const currentLang = Voice4All.getLanguage(); // 'en' or 'am'

// Toggle or set simple explanation mode
Voice4All.setSimpleMode(true);

// Check if simple mode is active
const isSimple = Voice4All.isSimpleMode();
```

#### Section Navigation
```javascript
// Switch to a specific tab: 'tutor' | 'help' | 'career'
Voice4All.switchTab('tutor');

// Get currently active tab
const activeTab = Voice4All.getActiveTab();
```

#### Programmatic AI Tutor Question
```javascript
// Opens widget and submits a question to the tutor
Voice4All.askTutor('What is a Virtual Assistant?');
```

#### Sound-Off Visual Captions & Accessibility
```javascript
// Display live visual speech captions (for sound-off usability)
Voice4All.showCaption('Welcome to the lesson! Voice4All is ready.', 6000);

// Hide visual captions
Voice4All.hideCaption();

// Make an accessible screen-reader announcement
Voice4All.announce('Career listings updated.', 'polite');
```

---

## 5. Lifecycle Event System

Voice4All emits events both on its internal bus and as standard DOM `CustomEvent`s on `window`:

```javascript
// Listen via DOM CustomEvents:
window.addEventListener('voice4all:open', () => {
  console.log('Drawer was opened');
});

window.addEventListener('voice4all:tabchange', (e) => {
  console.log('Active tab changed to:', e.detail.tab);
});

window.addEventListener('voice4all:languagechange', (e) => {
  console.log('Language changed to:', e.detail.lang);
});

window.addEventListener('voice4all:simplemodechange', (e) => {
  console.log('Simple mode state:', e.detail.simpleMode);
});

window.addEventListener('voice4all:offline', () => {
  console.warn('Host detected offline mode');
});

// Or listen via Voice4All API:
Voice4All.on('open', () => { /* ... */ });
Voice4All.on('close', () => { /* ... */ });
```

---

## 6. Backend API Contracts & Endpoints

Voice4All connects to the following endpoints. If your backend is offline, Voice4All **automatically falls back to clearly labeled Demo UI data** so learners are never blocked.

### 1. Tutor Conversation: `POST /api/tutor/ask`
* **Request:**
  ```json
  {
    "message": "What is a virtual assistant?",
    "language": "en",
    "simple_mode": false,
    "conversation_history": [
      { "role": "user", "content": "Hello" },
      { "role": "assistant", "content": "Welcome!" }
    ],
    "context": { "page": "The Future of the VA Industry" }
  }
  ```
* **Response:**
  ```json
  {
    "reply": "A Virtual Assistant is a remote professional...",
    "citations": [
      {
        "title": "Module 2: What is a VA",
        "section": "Overview & Foundation",
        "source": "Savanna Concept Materials",
        "url": "#module-2-overview"
      }
    ],
    "suggestions": ["What skills does a modern VA need?", "Give me a quiz"],
    "audio_url": null,
    "timestamp": "2026-11-14T16:00:00Z"
  }
  ```

### 2. Live Support Ticket: `POST /api/support/requests`
* **Request:**
  ```json
  {
    "topic": "concept",
    "urgency": "normal",
    "mode": "chat",
    "description": "I need help with Module 2 quiz question 3.",
    "language": "en"
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "ticket_id": "REQ-7291",
    "status": "queued",
    "estimated_wait_minutes": 2,
    "message": "Support request submitted. A mentor will connect shortly."
  }
  ```

### 3. Career Job Listings: `GET /api/career/jobs?language=en&type=all`
* **Response:**
  ```json
  {
    "success": true,
    "jobs": [
      {
        "id": "job-001",
        "title": "Executive Virtual Assistant",
        "company": "AfriTech Global",
        "location": "Remote",
        "type": "fulltime",
        "type_label": "Full-Time",
        "description": "Bilingual calendar and communications support.",
        "tags": ["Remote", "Screen-reader verified"],
        "accessible_workplace": true
      }
    ]
  }
  ```

### 4. Workplace Accommodations: `POST /api/career/accommodation-requests`
* **Request:**
  ```json
  {
    "job_id": "job-001",
    "job_title": "Executive Virtual Assistant",
    "accommodations": ["screen_reader", "flexible_hours"],
    "details": "Requires NVDA compatibility for platform portals.",
    "contact_email": "learner@example.com",
    "language": "en"
  }
  ```

---

## 7. Self-Hosting Asset Structure

To host Voice4All assets within your own CDN or static web server, maintain the following directory layout:

```
public/assets/
├── css/
│   └── voice4all.css              # Scoped CSS styles & icon fallbacks
└── js/
    └── voice4all/
        ├── loader.js              # Standalone 1-line script tag loader
        ├── embed.js               # window.Voice4All public API & bridge
        ├── accessibility.js       # Focus trap, live regions, A11y engine
        ├── api.js                 # API client & offline demo fallback
        ├── ui.js                  # Accessible templates & i18n dictionary
        └── voice4all.js           # Core widget lifecycle controller
```

When you point `<script src="/assets/js/voice4all/loader.js">`, the loader **automatically resolves** all sister files relative to its location.

---

## 8. Keyboard Shortcuts for Users

| Shortcut | Action |
| :--- | :--- |
| <kbd>Alt</kbd> + <kbd>V</kbd> | Toggle Voice4All open / closed |
| <kbd>Esc</kbd> | Close drawer (restores focus to launcher) |
| <kbd>Tab</kbd> / <kbd>Shift</kbd> + <kbd>Tab</kbd> | Navigate interactive elements (focus is trapped in dialog) |
| <kbd>→</kbd> / <kbd>←</kbd> | Switch between Tutor, Live Help, and Career tabs |
| <kbd>Home</kbd> / <kbd>End</kbd> | Jump to first / last tab |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | Activate focused button or tab |

---

## 9. Troubleshooting & FAQ

### Q: Does Voice4All conflict with Bootstrap, Tailwind, or WordPress?
**A:** No. All Voice4All elements are wrapped under strict CSS reset rules and prefixed with `v4a-`. Host styles cannot bleed into the widget.

### Q: What if my website does not load FontAwesome?
**A:** The loader will attempt to fetch FontAwesome from CDN. If blocked by Content Security Policy (CSP), `voice4all.css` contains **built-in SVG mask fallbacks**, ensuring all icons render crisply with zero external font dependencies.

### Q: How do I handle CORS with my backend?
**A:** Ensure your backend sends standard CORS headers:
```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept
```

---

## 10. 15-Minute Verification Checklist

- [ ] Place `<script src=".../loader.js"></script>` on your page.
- [ ] Verify the floating launcher appears in the bottom-right corner.
- [ ] Click the launcher or press <kbd>Alt</kbd> + <kbd>V</kbd>: verify the accessible drawer slides out smoothly.
- [ ] Press <kbd>Tab</kbd>: verify focus is trapped within the drawer.
- [ ] Press <kbd>Esc</kbd>: verify drawer closes and focus returns to the launcher button.
- [ ] Click "EN / AM": verify interface switches instantly to Amharic with correct Ge'ez font rendering.
- [ ] Ask a practice question in the Tutor tab: verify response displays source citations.
- [ ] Disconnect Wi-Fi / simulate offline: verify Voice4All continues to operate in clearly labeled Demo mode.
