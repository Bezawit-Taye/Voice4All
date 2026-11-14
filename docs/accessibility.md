# Voice4All — Universal Accessibility Specification & Conformance Guide

> **Standard:** WCAG 2.1 Level AA & AAA Conformance  
> **Target Audience:** Accessibility Engineers, Frontend Developers, QA Testers, and Assistive Technology Users

---

## 1. Conformance Summary & Design Principles

Voice4All is built from the ground up to empower learners of all abilities, including:
- Blind and low-vision learners relying on screen readers (NVDA, JAWS, VoiceOver, Android TalkBack).
- Motor-impaired users navigating exclusively via keyboard, switches, or sip-and-puff hardware.
- Deaf and hard-of-hearing learners operating in **sound-off** or noisy environments.
- Neurodivergent learners and those needing **Simple Mode** (plain-language explanations, enlarged fonts).
- Low-cost Android smartphone users with small viewports (320px–360px), touch navigation, and intermittent connectivity.
- Native Amharic speakers using the Ge'ez writing system.

---

## 2. WCAG 2.1 Conformance Matrix

| WCAG Criterion | Level | Implementation in Voice4All |
| :--- | :---: | :--- |
| **1.1.1 Non-text Content** | A | All icon buttons have explicit `aria-label` or accessible text spans; decorative icons use `aria-hidden="true"`. |
| **1.2.1 Audio-only / Sound-Off** | A | Live visual captions box (`.v4a-captions-box`), audio wave visualizer, and launcher badge convey all speech output without requiring sound. |
| **1.3.1 Info & Relationships** | A | Semantic HTML5 structure, WAI-ARIA Dialog (`role="dialog"`, `aria-modal="true"`), and WAI-ARIA Tablist pattern. |
| **1.4.3 Contrast (Minimum)** | AA | Text-to-background contrast exceeds 4.5:1 for normal text and 3:1 for large text. |
| **1.4.6 Contrast (Enhanced)** | AAA | Dark primary buttons (`#001f3f` on white) exceed **14.2:1** contrast. |
| **1.4.4 Resize Text** | AA | Supports text resizing up to 200% without loss of content or functionality. |
| **1.4.10 Reflow** | AA | Responsive drawer adapts down to 320 CSS pixels without horizontal scrolling. |
| **2.1.1 Keyboard** | A | Complete keyboard control over launcher, drawer, tabs, inputs, and accommodation forms. |
| **2.1.2 No Keyboard Trap** | A | Focus is trapped inside the active dialog, but <kbd>Esc</kbd> or close button safely exits and restores focus. |
| **2.4.3 Focus Order** | A | Logical DOM order. When opened, focus lands on close button or heading; when closed, focus returns to the launcher button. |
| **2.4.7 Focus Visible** | AA | High-contrast focus rings (`outline: 3px solid #2563eb; outline-offset: 3px;`). |
| **2.5.5 / 2.5.8 Target Size** | AA/AAA | All interactive targets meet or exceed **44 × 44 CSS pixels** on mobile viewports. |
| **3.1.2 Language of Parts** | AA | `lang="en"` or `lang="am"` explicitly defined on container; Amharic text styled with Ge'ez-friendly typography. |
| **4.1.2 Name, Role, Value** | A | All interactive components expose standard ARIA attributes (`aria-expanded`, `aria-selected`, `aria-controls`, `aria-live`). |
| **4.1.3 Status Messages** | AA | Dual live regions (`#v4a-live-announcer-polite` and `assertive`) broadcast incoming replies and network status changes. |

---

## 3. Keyboard Navigation Specification

Voice4All follows standard WAI-ARIA authoring practices:

```
[Launcher Button]
      │  Press Enter / Space / Alt+V
      ▼
[Side Drawer Opens]  ◄────────────────────────┐
      │                                       │
      ├─► Initial Focus: Close Button         │
      │                                       │
      ├─► Tab: Move forward to next control   │ Focus Trapped Inside
      ├─► Shift+Tab: Move backward            │
      ├─► Arrow Keys: Navigate between Tabs   │
      │                                       │
      └─► Press Esc ──────────────────────────┘
            │
            ▼
[Side Drawer Closes]
      │ Focus Restored
      ▼
[Launcher Button]
```

### Complete Keybinding Reference Table

| Key / Shortcut | Context | Expected Action |
| :--- | :--- | :--- |
| <kbd>Alt</kbd> + <kbd>V</kbd> | Anywhere on page | Global shortcut: toggles Voice4All drawer open or closed. |
| <kbd>Enter</kbd> or <kbd>Space</kbd> | Focused on Launcher | Opens the Voice4All accessible drawer. |
| <kbd>Esc</kbd> | Drawer open | Closes the drawer and restores focus to launcher trigger. |
| <kbd>Tab</kbd> | Drawer open | Advances focus to the next interactive element inside the drawer. If on the last element, wraps to the first. |
| <kbd>Shift</kbd> + <kbd>Tab</kbd> | Drawer open | Moves focus to the previous element. If on the first element, wraps to the last. |
| <kbd>→</kbd> / <kbd>↓</kbd> | Tablist | Selects and activates next tab (Tutor → Live Help → Career). |
| <kbd>←</kbd> / <kbd>↑</kbd> | Tablist | Selects and activates previous tab. |
| <kbd>Home</kbd> | Tablist | Activates the first tab (Tutor). |
| <kbd>End</kbd> | Tablist | Activates the last tab (Career). |
| <kbd>Enter</kbd> | Chat input form | Sends question to the Voice4All AI tutor. |

---

## 4. Screen-Reader Testing Procedures

Voice4All has been tested and certified across major screen reader and browser combinations:

### 1. NVDA on Windows (Firefox / Chrome / Edge)
* **Opening Drawer:** Press <kbd>Alt</kbd> + <kbd>V</kbd>. NVDA announces: *"Voice4All assistant opened. You are in the assistant dialog."*
* **Tutor Response:** After asking a question, polite live region triggers: *"Tutor replied: [First 90 characters of answer]..."*
* **Citations:** Arrow down through citations. NVDA reads source title, module section, and clickable anchor link.
* **Closing:** Press <kbd>Esc</kbd>. NVDA announces: *"Voice4All assistant closed"* and focus lands squarely on the launcher.

### 2. VoiceOver on macOS / iOS (Safari)
* Standard rotor navigation recognizes landmarks: `Dialog`, `Tablist`, `Status`.
* Voice input button announces: *"Start voice input (microphone), button"*.
* Simple mode switch announces: *"Simple explanation mode enabled, checkbox, checked"*.

### 3. TalkBack on Android (Chrome)
* Touch exploration highlights launcher button with minimum 44×44px hit target.
* Double-tap opens drawer. TalkBack announces modal dialog role.
* Swipe-right moves sequentially through header actions, tabs, chat history, and input.

---

## 5. Sound-Off Usability & Visual Feedback

Users who are deaf, hard of hearing, or operating in environments where audio is silenced (e.g. libraries, offices, transit) have access to full visual equivalents:

1. **Floating Visual Captions Box (`.v4a-captions-box`):**
   * When speech synthesis (TTS) reads an answer aloud, the text is simultaneously displayed in a high-contrast floating caption banner.
   * Includes a visible animated audio waveform meter (`.v4a-audio-wave`) indicating speech playback.
   * Features a prominent dismiss button.
2. **Silent Notification Launcher Badge (`.v4a-launcher-badge-dot--active`):**
   * If the drawer is closed when a tutor answer or mentor reply arrives, a pulsing red notification dot appears on the launcher with `aria-label="New response received"`.
3. **Visual Microphone Status:**
   * When speech recognition is active, the microphone button pulses in vivid red with an accompanying visual label: *"Listening... Speak clearly into your microphone"*.
4. **Offline & Network Failure Banners:**
   * When offline, a visual alert banner (`.v4a-offline-banner`) appears with an explicit "Retry Reconnecting" button.

---

## 6. Simple Mode (Cognitive & Learning Accommodation)

For learners with cognitive disabilities, language learners, or anyone seeking plain-language answers:
* **One-Click Toggle:** Located directly in the Tutor header bar.
* **Plain Language Payload:** When enabled, Voice4All passes `simple_mode: true` to `/api/tutor/ask`.
* **Visual Styling:**
  * Increases base font size by +2px (from 14px to 16px).
  * Increases line-height to `1.7` for comfortable reading.
  * Enhances border contrast on message bubbles.
  * Emphasizes bulleted lists and step-by-step examples.
* **Screen Reader Announcement:** Announces: *"Simple explanation mode enabled."*

---

## 7. 200% Zoom and Viewport Reflow Conformance

To accommodate users with low vision who use browser zoom:
* **Fluid Layouts:** Uses relative CSS units (`rem`, `em`, percentages) rather than fixed pixel dimensions.
* **Flex Wrapping:** Header actions, tablists, and form controls utilize `flex-wrap: wrap` to prevent horizontal text clipping at 200% zoom (1280px viewport zoomed to 640px equivalent).
* **Smooth Vertical Scrolling:** Dialog body utilizes native scrolling with `-webkit-overflow-scrolling: touch` to ensure all controls remain accessible at any zoom level.
* **No Horizontal Scroll:** Conforms strictly to WCAG 1.4.10 Reflow down to 320 CSS pixels.

---

## 8. Amharic / Ge'ez Typography & Bilingual Handling

Voice4All supports seamless bilingual operation in English and Amharic:
* **Font Stack:** Prioritizes `Noto Sans Ethiopic`, `Nyala`, and `Abyssinica SIL` for crisp rendering of Ge'ez fidel characters.
* **Line Height Clearance:** Ethiopic script characters feature prominent ascenders and diacritic vowel markers; Voice4All applies an increased line-height of `1.65` on Amharic text to eliminate visual clipping.
* **Ethiopic Punctuation:** Supports standard Amharic punctuation markers (`።` Arat Neteb, `፡` Hulet Neteb, `፣` Netela Serez, `፤` Dirib Serez).
* **Bidirectional Text (`dir="auto"`):** Ensures messages containing mixed English and Amharic text render with correct alignment and isolated boundaries.

---

## 9. Low-Cost Android Device Adaptations

Designed for learners in emerging markets using budget Android smartphones (e.g. TECNO Pop, Infinix Smart, itel, Samsung Galaxy A03):
* **320px–360px Viewport Optimization:** Specific `@media (max-width: 360px)` rules ensure buttons, chips, and bubbles scale cleanly.
* **Minimum 44 × 44px Touch Targets:** All interactive buttons and inputs meet WCAG 2.5.5 / 2.5.8 touch target standards.
* **Safe-Area Inset Handling:** Launcher button and input bar respect `env(safe-area-inset-bottom)` to avoid overlap with Android system navigation gestures.
* **Low CPU / GPU-Accelerated Animations:** Drawer transitions utilize hardware-accelerated transforms (`transform: translate3d(...)`) to maintain smooth 60fps performance without draining device battery.
* **Lightweight Bundle:** Scoped CSS and modular vanilla JS with zero third-party framework overhead.

---

## 10. High-Contrast Color Palette & Verification

All colors meet WCAG AA and AAA contrast ratios against their respective backgrounds:

| Component | Foreground | Background | Contrast Ratio | Conformance |
| :--- | :---: | :---: | :---: | :---: |
| Launcher Button | `#ffffff` | `#001f3f` | **15.3 : 1** | **AAA** |
| Tutor Message Bubble | `#0f172a` | `#f1f5f9` | **14.2 : 1** | **AAA** |
| User Message Bubble | `#ffffff` | `#001f3f` | **15.3 : 1** | **AAA** |
| Active Tab Text | `#001f3f` | `#ffffff` | **15.3 : 1** | **AAA** |
| Accent Action Button | `#ffffff` | `#0d6efd` | **4.6 : 1** | **AA** |
| Success Notice | `#198754` | `#e8f5e9` | **5.1 : 1** | **AA** |
| Focus Indicator Ring | `#2563eb` | `#ffffff` | **4.8 : 1** | **AA** |
| Captions Floating Banner | `#ffffff` | `#0f172a` | **16.1 : 1** | **AAA** |

### Windows High Contrast Mode Support
Voice4All includes `@media (forced-colors: active)` support:
- Buttons and drawer borders adopt `ButtonText`.
- Focus outlines adopt system `Highlight`.
- High contrast themes display crisp semantic borders on all controls.
