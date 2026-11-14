# Voice4All — Savanna Course Context Contract

## 1. Overview and Purpose

The **Savanna Context Extraction Module** (`assets/js/voice4all/context.js`) provides automated, resilient extraction of structured educational metadata from Savanna intranet lesson pages (specifically modelled after `pages/concept-with-navigation.html`).

Accurate course context is essential for Voice4All accessibility subsystems:
- **Human & Simulated Support:** Automatically attaches current course, module, and lesson details to support tickets, eliminating manual data entry for learners with motor or cognitive impairments.
- **AI Accessibility Assistant & Voice Tutors:** Grounds contextual explanations and answers in the exact content the learner is currently viewing.
- **Voice-Driven Navigation:** Powers spoken-word commands such as *"Read this section"*, *"Summarize this lesson"*, or *"Where am I in this course?"*.

---

## 2. Context Schema Contract

The module guarantees a consistent return object containing four non-null string fields:

```typescript
interface SavannaContext {
  /** The broad academic program or course title */
  courseTitle: string;

  /** The specific module within the curriculum */
  moduleTitle: string;

  /** The title of the currently active concept or lesson */
  lessonTitle: string;

  /** The cleaned educational body text of the active lesson */
  lessonText: string;
}
```

### Safety and Defaulting Guarantee
- **Never `null` or `undefined`:** If a field cannot be determined, it evaluates to an empty string (`""`).
- **Normalized whitespace:** Trailing, leading, and excessive internal whitespace are trimmed and collapsed while preserving paragraph separation.
- **Decoded entities:** HTML entities (e.g., `&amp;`, `&#39;`) are decoded to standard Unicode characters.
- **Exception immunity:** DOM queries and regex evaluations are wrapped in defensive handlers to ensure host application stability.

---

## 3. DOM Selector Hierarchy & Extraction Strategy

The module evaluates `pages/concept-with-navigation.html` using a prioritized selector strategy:

| Field | Priority 1 Selector | Priority 2 Selector | Fallback Selector / Strategy | Example Output (from sample page) |
| :--- | :--- | :--- | :--- | :--- |
| `courseTitle` | `#student-current-curriculum .curriculum-switcher-label span.fs-4` | `.curriculum-switcher-tile-current span.fw-semibold` | Congratulations modal badge text (`#curriculum-validation-congrats-modal p`), or `[data-course-title]` | `"VA-1: VA Foundations & Professional Identity"` |
| `moduleTitle` | `#curriculum_navigation_toggle button` (cloned to exclude icon elements) | `#curriculum_navigation_menu .btn-group button` | `#curriculum_navigation_menu .dropdown-menu .dropdown-item.active`, or `.accordion-button span` | `"Module 2: What is a VA"` |
| `lessonTitle` | `#curriculum_navigation_content h1` | `#curriculum_navigation_menu .list-group-item.active span` | `#curriculum_navigation_menu .list-group-item[aria-current="true"] span`, or `<title>` tag regex | `"The Future of the VA Industry"` |
| `lessonText` | `#curriculum_navigation_content .formatted-content` | `.formatted-content .savanna-styles` | `#curriculum_navigation_content`, or `article .formatted-content` | Cleaned text content (~7,200 chars) |

### Cleaning Rules for `lessonText`
To ensure clean text for speech synthesis and AI reasoning, non-instructional DOM nodes are stripped prior to extraction:
- `<script>`, `<style>`, `<noscript>` elements
- Inline navigation buttons, toggle bars, and dropdown menus (`#curriculum_navigation_toggle`, `#curriculum_navigation_menu`)
- Interactive forms (e.g., "Mark as complete" form and authenticity tokens)
- Decorator icons (`<i>`, `<svg>`, `[aria-hidden="true"]`)
- Modals, overlays, and footer copyright notices

---

## 4. Module Interface & Usage

The module is packaged as a Universal Module Definition (UMD), supporting browser `<script>` tags, ES Module bundlers, and Node.js testing frameworks.

### Browser (Script Tag)
```html
<script src="../assets/js/voice4all/context.js"></script>
<script>
  // Access global instance
  const context = window.Voice4AllContext.extractContext();
  console.log(context.courseTitle); // "VA-1: VA Foundations & Professional Identity"
  console.log(context.lessonTitle); // "The Future of the VA Industry"
</script>
```

### Module / Testing API Methods

#### `extractContext(target?)`
Extracts context from the target. If target is omitted, defaults to `window.document`. Can also accept an HTML string in headless/server environments.
```javascript
import { extractContext } from './assets/js/voice4all/context.js';
const context = extractContext(document);
```

#### `getContext(forceRefresh = false)`
Returns the cached context object or re-evaluates the active document if `forceRefresh` is `true`.
```javascript
const context = Voice4AllContext.getContext();
```

#### `toPayload(overrides = {})`
Generates a serialized payload with an ISO timestamp, ready for HTTP submission to `/api/support/requests`.
```javascript
const payload = Voice4AllContext.toPayload({ userAgent: navigator.userAgent });
```

---

## 5. Resilient Degradation & Edge Case Handling

1. **Partial / Unpopulated Pages:**
   If a user visits a page missing curriculum dropdowns or navigation toggles, the module falls back to standard semantic tags (`h1`, `article`, `<title>`). Any field not present returns `""`.
2. **Empty / Null Input:**
   Passing `null`, `undefined`, or `""` returns:
   ```json
   {
     "courseTitle": "",
     "moduleTitle": "",
     "lessonTitle": "",
     "lessonText": ""
   }
   ```
3. **Dynamic SPA Navigation:**
   Calling `extractContext()` or `getContext(true)` dynamically inspects the live DOM state at invocation time, ensuring context changes during client-side routing are captured accurately.

---

## 6. Verification and Test Results

Tested against `Savanna-static-pages/pages/concept-with-navigation.html`:
- **`courseTitle`:** `"VA-1: VA Foundations & Professional Identity"` (PASS)
- **`moduleTitle`:** `"Module 2: What is a VA"` (PASS)
- **`lessonTitle`:** `"The Future of the VA Industry"` (PASS)
- **`lessonText`:** Length 7,253 characters; successfully excludes navigation chrome and button text (PASS)
- **Missing / Empty inputs:** Evaluates safely to empty strings without throwing exceptions (PASS)
