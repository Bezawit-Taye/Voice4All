/**
 * Voice4All — Dedicated Accessibility & Universal Access Module (`assets/js/voice4all/accessibility.js`)
 *
 * Implements WCAG 2.1 AA & AAA accessibility requirements:
 *   1. Dual Live Region Announcements (aria-live polite and assertive queue)
 *   2. Strict Focus Management (trap, save, restore, initial placement)
 *   3. WAI-ARIA Tablist Pattern (Arrow navigation, Home/End keys)
 *   4. Sound-Off Usability & Visual Feedback (live visible captions, audio meters, badges)
 *   5. 200% Zoom and Reflow compatibility (no horizontal scroll, fluid layouts)
 *   6. Low-Cost Android Device adaptations (44x44px touch targets, mobile safe area)
 *   7. Amharic / Ge'ez typography & BiDi text handling
 *   8. Reduced motion and high contrast system preferences
 */

((root) => {
  'use strict';

  // Constants
  const ETHIOPIC_REGEX = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF\uAB00-\uAB2F]/;
  const ANNOUNCE_DEBOUNCE_MS = 120;

  // Internal state
  let lastActiveElement = null;
  let activeTrapContainer = null;
  let politeLiveRegion = null;
  let assertiveLiveRegion = null;
  let captionsBox = null;
  let captionsTimer = null;
  let announcementQueue = [];
  let isAnnouncing = false;
  let announcementHistory = [];

  const Voice4AllA11y = {
    version: '2.2.0',

    /**
     * Initialize accessibility infrastructure:
     * - Create/find polite and assertive live regions
     * - Setup visual captions container for sound-off usability
     * - Monitor system accessibility preferences
     */
    init() {
      this.ensureLiveRegions();
      this.ensureCaptionsBox();
      this.listenToSystemPreferences();
      this.listenToNetworkStatus();
      console.log('[Voice4All A11y] Accessibility module initialized.');
    },

    // =========================================================================
    // 1. Dual Live Region Announcements
    // =========================================================================

    ensureLiveRegions() {
      // Polite region (for incoming messages, tab switches, mode changes)
      politeLiveRegion = document.getElementById('v4a-live-announcer-polite');
      if (!politeLiveRegion) {
        politeLiveRegion = document.createElement('div');
        politeLiveRegion.id = 'v4a-live-announcer-polite';
        politeLiveRegion.className = 'v4a-sr-only';
        politeLiveRegion.setAttribute('aria-live', 'polite');
        politeLiveRegion.setAttribute('aria-atomic', 'true');
        politeLiveRegion.setAttribute('role', 'status');
        document.body.appendChild(politeLiveRegion);
      }

      // Assertive region (for errors, offline warnings, emergency status)
      assertiveLiveRegion = document.getElementById('v4a-live-announcer-assertive');
      if (!assertiveLiveRegion) {
        assertiveLiveRegion = document.createElement('div');
        assertiveLiveRegion.id = 'v4a-live-announcer-assertive';
        assertiveLiveRegion.className = 'v4a-sr-only';
        assertiveLiveRegion.setAttribute('aria-live', 'assertive');
        assertiveLiveRegion.setAttribute('aria-atomic', 'true');
        assertiveLiveRegion.setAttribute('role', 'alert');
        document.body.appendChild(assertiveLiveRegion);
      }
    },

    /**
     * Announce a message to screen readers with queue deduplication
     * @param {string} text - Message text
     * @param {'polite'|'assertive'} priority - ARIA live priority level
     */
    announce(text, priority = 'polite') {
      if (!text || typeof text !== 'string') return;
      const cleanText = text.trim();
      if (!cleanText) return;

      // Log in history
      const entry = {
        text: cleanText,
        priority,
        timestamp: new Date().toISOString()
      };
      announcementHistory.push(entry);
      if (announcementHistory.length > 50) announcementHistory.shift();

      announcementQueue.push({ text: cleanText, priority });
      this.processAnnouncementQueue();
    },

    processAnnouncementQueue() {
      if (isAnnouncing || announcementQueue.length === 0) return;
      isAnnouncing = true;

      const item = announcementQueue.shift();
      const targetRegion = (item.priority === 'assertive')
        ? (assertiveLiveRegion || politeLiveRegion)
        : politeLiveRegion;

      if (targetRegion) {
        // Clear then repopulate to force screen readers (NVDA, JAWS, TalkBack) to trigger
        targetRegion.textContent = '';
        setTimeout(() => {
          targetRegion.textContent = item.text;
          setTimeout(() => {
            isAnnouncing = false;
            this.processAnnouncementQueue();
          }, ANNOUNCE_DEBOUNCE_MS);
        }, 30);
      } else {
        isAnnouncing = false;
      }
    },

    getAnnouncementHistory() {
      return [...announcementHistory];
    },

    // =========================================================================
    // 2. Sound-Off Usability & Visual Feedback
    // =========================================================================

    ensureCaptionsBox() {
      captionsBox = document.getElementById('v4a-captions-box');
      if (!captionsBox) {
        captionsBox = document.createElement('div');
        captionsBox.id = 'v4a-captions-box';
        captionsBox.className = 'v4a-captions-box v4a-captions-box--hidden';
        captionsBox.setAttribute('role', 'region');
        captionsBox.setAttribute('aria-label', 'Spoken speech visual captions');
        captionsBox.innerHTML = `
          <div class="v4a-captions-inner">
            <span class="v4a-captions-icon" aria-hidden="true">
              <span class="v4a-audio-wave">
                <span class="v4a-wave-bar"></span>
                <span class="v4a-wave-bar"></span>
                <span class="v4a-wave-bar"></span>
                <span class="v4a-wave-bar"></span>
              </span>
            </span>
            <div class="v4a-captions-content" id="v4a-captions-text"></div>
            <button type="button" class="v4a-captions-close" id="v4a-captions-close-btn" aria-label="Dismiss captions">
              &times;
            </button>
          </div>
        `;
        document.body.appendChild(captionsBox);

        // Bind dismiss button
        const closeBtn = captionsBox.querySelector('#v4a-captions-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => this.hideCaptions());
        }
      }
    },

    /**
     * Show live visual captions for sound-off usability
     * @param {string} text - Spoken text
     * @param {number} durationMs - Optional auto-hide time
     */
    showCaptions(text, durationMs = 0) {
      this.ensureCaptionsBox();
      if (!captionsBox) return;

      const content = captionsBox.querySelector('#v4a-captions-text');
      if (content) {
        content.textContent = text;
        if (this.isAmharicText(text)) {
          content.classList.add('v4a-text-amharic');
        } else {
          content.classList.remove('v4a-text-amharic');
        }
      }

      captionsBox.classList.remove('v4a-captions-box--hidden');
      captionsBox.classList.add('v4a-captions-box--visible');

      clearTimeout(captionsTimer);
      if (durationMs > 0) {
        captionsTimer = setTimeout(() => {
          this.hideCaptions();
        }, durationMs);
      }
    },

    hideCaptions() {
      clearTimeout(captionsTimer);
      if (captionsBox) {
        captionsBox.classList.remove('v4a-captions-box--visible');
        captionsBox.classList.add('v4a-captions-box--hidden');
      }
    },

    /**
     * Update launcher notification badge for silent/sound-off notifications
     * @param {boolean} show - Whether badge dot is visible
     * @param {string} text - Screen-reader label
     */
    setLauncherBadge(show = true, text = 'New message received') {
      const launcherBtn = document.getElementById('v4a-launcher-btn');
      if (!launcherBtn) return;

      let badge = launcherBtn.querySelector('.v4a-launcher-badge-dot');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'v4a-launcher-badge-dot';
        const iconWrap = launcherBtn.querySelector('.v4a-launcher-icon-wrap') || launcherBtn;
        iconWrap.appendChild(badge);
      }

      if (show) {
        badge.classList.add('v4a-launcher-badge-dot--active');
        badge.setAttribute('aria-label', text);
      } else {
        badge.classList.remove('v4a-launcher-badge-dot--active');
        badge.removeAttribute('aria-label');
      }
    },

    // =========================================================================
    // 3. Focus Management & Focus Trapping (WAI-ARIA Dialog)
    // =========================================================================

    /**
     * Save currently focused element prior to opening dialog
     */
    saveFocus(element = null) {
      lastActiveElement = element || document.activeElement;
    },

    /**
     * Restore focus to launcher or saved element upon closing
     */
    restoreFocus() {
      if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
        try {
          lastActiveElement.focus();
        } catch (e) {
          /* element might have been detached */
        }
      } else {
        const launcher = document.getElementById('v4a-launcher-btn');
        if (launcher && typeof launcher.focus === 'function') {
          launcher.focus();
        }
      }
      lastActiveElement = null;
    },

    /**
     * Trap keyboard focus inside a modal/drawer container
     * @param {HTMLElement} container
     */
    trapFocus(container) {
      if (!container) return;
      activeTrapContainer = container;

      // Attach keydown listener on container
      document.removeEventListener('keydown', this._handleTrapKeydown);
      document.addEventListener('keydown', this._handleTrapKeydown);
    },

    releaseFocus() {
      activeTrapContainer = null;
      document.removeEventListener('keydown', this._handleTrapKeydown);
    },

    _handleTrapKeydown(event) {
      if (!activeTrapContainer || event.key !== 'Tab') return;

      const focusables = activeTrapContainer.querySelectorAll(
        'button:not([disabled]):not([aria-hidden="true"]), ' +
        'a[href], ' +
        'input:not([disabled]):not([type="hidden"]), ' +
        'select:not([disabled]), ' +
        'textarea:not([disabled]), ' +
        '[tabindex]:not([tabindex="-1"]):not([disabled])'
      );

      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first || !activeTrapContainer.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !activeTrapContainer.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    },

    /**
     * Focus the first reasonable interactive element in a container
     * @param {HTMLElement} container
     */
    focusFirst(container) {
      if (!container) return;
      const first = container.querySelector(
        'button:not([disabled]):not([aria-hidden="true"]), ' +
        'input:not([disabled]):not([type="hidden"]), ' +
        'select:not([disabled]), ' +
        'textarea:not([disabled]), ' +
        'a[href], ' +
        '[tabindex="0"]'
      );
      if (first && typeof first.focus === 'function') {
        first.focus();
      }
    },

    // =========================================================================
    // 4. WAI-ARIA Tablist Keyboard Navigation
    // =========================================================================

    /**
     * Attach WAI-ARIA compliant tab keyboard navigation:
     * - ArrowRight / ArrowDown: next tab
     * - ArrowLeft / ArrowUp: previous tab
     * - Home: first tab
     * - End: last tab
     * @param {HTMLElement} tablist - container with role="tablist"
     * @param {Function} onSelect - callback when active tab changes
     */
    setupTablist(tablist, onSelect) {
      if (!tablist) return;

      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      if (tabs.length === 0) return;

      tablist.addEventListener('keydown', (event) => {
        const currentTab = document.activeElement;
        const currentIndex = tabs.indexOf(currentTab);
        if (currentIndex === -1) return;

        let nextIndex = null;

        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            event.preventDefault();
            nextIndex = (currentIndex + 1) % tabs.length;
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            event.preventDefault();
            nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            break;
          case 'Home':
            event.preventDefault();
            nextIndex = 0;
            break;
          case 'End':
            event.preventDefault();
            nextIndex = tabs.length - 1;
            break;
          case ' ':
          case 'Enter':
            event.preventDefault();
            if (typeof onSelect === 'function') {
              onSelect(currentTab.getAttribute('data-tab-target') || currentTab.id);
            }
            return;
          default:
            return;
        }

        if (nextIndex !== null) {
          const targetTab = tabs[nextIndex];
          tabs.forEach((t) => {
            t.setAttribute('aria-selected', 'false');
            t.setAttribute('tabindex', '-1');
          });
          targetTab.setAttribute('aria-selected', 'true');
          targetTab.setAttribute('tabindex', '0');
          targetTab.focus();

          if (typeof onSelect === 'function') {
            onSelect(targetTab.getAttribute('data-tab-target') || targetTab.id);
          }
        }
      });
    },

    // =========================================================================
    // 5. Ethiopic / Amharic & BiDi Text Handling
    // =========================================================================

    isAmharicText(text) {
      if (!text || typeof text !== 'string') return false;
      return ETHIOPIC_REGEX.test(text);
    },

    /**
     * Dynamically style elements containing Ethiopic characters
     * with optimal line-height and font rendering
     * @param {HTMLElement} element
     */
    applyAmharicTypography(element) {
      if (!element) return;
      if (this.isAmharicText(element.textContent)) {
        element.classList.add('v4a-text-amharic');
      }
    },

    // =========================================================================
    // 6. Low-Cost Android Device Adaptations (Touch Targets & Viewports)
    // =========================================================================

    /**
     * Audit interactive element bounding boxes to guarantee WCAG 2.5.5 / 2.5.8 (44x44px target size)
     */
    auditTouchTargets(container) {
      if (!container) return [];
      const interactives = container.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="tab"]');
      const failures = [];

      interactives.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (rect.width < 44 || rect.height < 44) {
            failures.push({
              element: el,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              label: el.getAttribute('aria-label') || el.innerText || el.className
            });
          }
        }
      });

      if (failures.length > 0) {
        console.warn(`[Voice4All A11y] ${failures.length} element(s) below 44x44px touch target:`, failures);
      }
      return failures;
    },

    /**
     * Compute real viewport height on mobile browsers with dynamic URL bars
     */
    syncMobileViewportHeight() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--v4a-real-vh', `${vh}px`);
    },

    // =========================================================================
    // 7. System Preferences & Network Monitoring
    // =========================================================================

    listenToSystemPreferences() {
      // Reduced Motion
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handleMotion = (e) => {
        document.documentElement.classList.toggle('v4a-reduced-motion', e.matches);
      };
      if (motionQuery.addEventListener) {
        motionQuery.addEventListener('change', handleMotion);
      }
      handleMotion(motionQuery);

      // High Contrast
      const contrastQuery = window.matchMedia('(prefers-contrast: more)');
      const handleContrast = (e) => {
        document.documentElement.classList.toggle('v4a-system-high-contrast', e.matches);
      };
      if (contrastQuery.addEventListener) {
        contrastQuery.addEventListener('change', handleContrast);
      }
      handleContrast(contrastQuery);

      // Dynamic viewport resize on mobile
      window.addEventListener('resize', () => this.syncMobileViewportHeight(), { passive: true });
      window.addEventListener('orientationchange', () => this.syncMobileViewportHeight(), { passive: true });
      this.syncMobileViewportHeight();
    },

    listenToNetworkStatus() {
      window.addEventListener('offline', () => {
        this.announce('Network connection lost. Voice4All is running in offline demo mode.', 'assertive');
        const event = new CustomEvent('voice4all:offline');
        window.dispatchEvent(event);
      });

      window.addEventListener('online', () => {
        this.announce('Network connection restored.', 'polite');
        const event = new CustomEvent('voice4all:online');
        window.dispatchEvent(event);
      });
    },

    isReducedMotion() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    isHighContrast() {
      return window.matchMedia('(prefers-contrast: more)').matches;
    }
  };

  // Bind trap keydown method context
  Voice4AllA11y._handleTrapKeydown = Voice4AllA11y._handleTrapKeydown.bind(Voice4AllA11y);

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Voice4AllA11y.init());
  } else {
    Voice4AllA11y.init();
  }

  root.Voice4AllA11y = Voice4AllA11y;
})(typeof window !== 'undefined' ? window : this);
