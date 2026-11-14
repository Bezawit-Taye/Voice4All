/**
 * Voice4All — Embeddable Public API & Host Integration Bridge (`assets/js/voice4all/embed.js`)
 *
 * Provides a clean, developer-friendly interface allowing any host learning platform
 * to control Voice4All programmatically and listen to lifecycle events.
 *
 * Usage:
 *   Voice4All.open();
 *   Voice4All.setLanguage('am');
 *   Voice4All.setSimpleMode(true);
 *   Voice4All.askTutor('What is a virtual assistant?');
 *   Voice4All.on('open', () => console.log('Widget opened'));
 */

((root) => {
  'use strict';

  // Event bus storage
  const eventListeners = {
    open: [],
    close: [],
    tabchange: [],
    languagechange: [],
    simplemodechange: [],
    message: [],
    statuschange: [],
    offline: [],
    online: [],
    error: []
  };

  // Preserve existing Voice4All instance if already defined by voice4all.js
  const existingV4A = root.Voice4All || {};

  const Voice4AllEmbed = {
    version: '2.2.0',
    _isReady: false,
    _config: {
      apiBase: '',
      lang: 'en',
      simpleMode: false,
      position: 'bottom-right',
      theme: 'default',
      autoInit: true
    },

    /**
     * Initialize Voice4All with custom configuration
     * @param {Object} options
     */
    init(options = {}) {
      this._config = Object.assign({}, this._config, options);

      // 1. Configure API Base URL if provided
      if (this._config.apiBase && root.Voice4AllAPI && typeof root.Voice4AllAPI.setApiBase === 'function') {
        root.Voice4AllAPI.setApiBase(this._config.apiBase);
      }

      // 2. Configure initial language if provided
      if (this._config.lang && (this._config.lang === 'am' || this._config.lang === 'en')) {
        try {
          localStorage.setItem('v4a_preferred_lang', this._config.lang);
        } catch (e) {}
      }

      // 3. Configure simple mode
      if (typeof this._config.simpleMode === 'boolean') {
        try {
          sessionStorage.setItem('v4a_simple_mode', String(this._config.simpleMode));
        } catch (e) {}
      }

      // 4. Configure launcher position
      if (this._config.position === 'bottom-left') {
        document.documentElement.classList.add('v4a-pos-bottom-left');
      } else {
        document.documentElement.classList.remove('v4a-pos-bottom-left');
      }

      // 5. Initialize or re-render core widget
      if (typeof existingV4A.init === 'function') {
        existingV4A.init();
      } else if (typeof root.Voice4All === 'object' && typeof root.Voice4All.init === 'function') {
        root.Voice4All.init();
      }

      // 6. Listen to network events
      window.addEventListener('offline', () => this.trigger('offline', {}));
      window.addEventListener('online', () => this.trigger('online', {}));

      this._isReady = true;
      this.trigger('ready', { config: this._config });
      console.log('[Voice4All Embed] Ready with config:', this._config);
      return this;
    },

    isReady() {
      return this._isReady;
    },

    // =========================================================================
    // Widget Visibility & Control
    // =========================================================================

    /**
     * Open the Voice4All accessible drawer
     */
    open() {
      if (root.Voice4AllA11y) {
        root.Voice4AllA11y.saveFocus();
      }

      if (typeof existingV4A.openDrawer === 'function') {
        existingV4A.openDrawer();
      } else {
        const btn = document.getElementById('v4a-launcher-btn');
        if (btn) btn.click();
      }

      const drawer = document.getElementById('v4a-drawer');
      if (drawer && root.Voice4AllA11y) {
        root.Voice4AllA11y.trapFocus(drawer);
        root.Voice4AllA11y.focusFirst(drawer);
      }

      this.trigger('open', {});
      return this;
    },

    /**
     * Close the Voice4All drawer
     */
    close() {
      if (typeof existingV4A.closeDrawer === 'function') {
        existingV4A.closeDrawer();
      } else {
        const closeBtn = document.getElementById('v4a-close-btn');
        if (closeBtn) closeBtn.click();
      }

      if (root.Voice4AllA11y) {
        root.Voice4AllA11y.releaseFocus();
        root.Voice4AllA11y.restoreFocus();
      }

      this.trigger('close', {});
      return this;
    },

    /**
     * Toggle drawer visibility
     */
    toggle() {
      if (this.isOpen()) {
        this.close();
      } else {
        this.open();
      }
      return this;
    },

    /**
     * Check if drawer is currently open
     * @returns {boolean}
     */
    isOpen() {
      if (root.Voice4All && root.Voice4All.state) {
        return !!root.Voice4All.state.drawerOpen;
      }
      const drawer = document.getElementById('v4a-drawer');
      return drawer ? drawer.classList.contains('v4a-drawer--open') : false;
    },

    // =========================================================================
    // Language & Simple Mode Management
    // =========================================================================

    /**
     * Set widget language ('en' | 'am')
     * @param {'en'|'am'} lang
     */
    setLanguage(lang) {
      if (lang !== 'en' && lang !== 'am') {
        console.warn(`[Voice4All] Invalid language "${lang}". Expected "en" or "am".`);
        return this;
      }

      if (typeof existingV4A.setLanguage === 'function') {
        existingV4A.setLanguage(lang);
      } else {
        try {
          localStorage.setItem('v4a_preferred_lang', lang);
          if (root.Voice4All && root.Voice4All.state) {
            root.Voice4All.state.lang = lang;
          }
        } catch (e) {}
      }

      this.trigger('languagechange', { lang });
      return this;
    },

    /**
     * Get current widget language
     * @returns {'en'|'am'}
     */
    getLanguage() {
      if (root.Voice4All && root.Voice4All.state) {
        return root.Voice4All.state.lang || 'en';
      }
      try {
        return localStorage.getItem('v4a_preferred_lang') || 'en';
      } catch (e) {
        return 'en';
      }
    },

    /**
     * Toggle or set simple explanation mode
     * @param {boolean} [enabled]
     */
    setSimpleMode(enabled) {
      const currentState = this.isSimpleMode();
      const targetState = (typeof enabled === 'boolean') ? enabled : !currentState;

      try {
        sessionStorage.setItem('v4a_simple_mode', String(targetState));
      } catch (e) {}

      if (root.Voice4All && root.Voice4All.state) {
        root.Voice4All.state.simpleMode = targetState;
      }

      const drawer = document.getElementById('v4a-drawer');
      if (drawer) {
        if (targetState) {
          drawer.classList.add('v4a-simple-mode');
        } else {
          drawer.classList.remove('v4a-simple-mode');
        }
      }

      const simpleToggle = document.getElementById('v4a-simple-mode-toggle');
      if (simpleToggle) {
        simpleToggle.checked = targetState;
        simpleToggle.setAttribute('aria-checked', targetState ? 'true' : 'false');
      }

      const isAm = (this.getLanguage() === 'am');
      const msg = targetState
        ? (isAm ? 'ቀላል የማብራሪያ ሁነታ በርቷል።' : 'Simple explanation mode enabled.')
        : (isAm ? 'ቀላል የማብራሪያ ሁነታ ጠፍቷል።' : 'Simple explanation mode disabled.');

      this.announce(msg, 'polite');
      this.trigger('simplemodechange', { simpleMode: targetState });
      return this;
    },

    /**
     * Check if simple mode is enabled
     * @returns {boolean}
     */
    isSimpleMode() {
      if (root.Voice4All && root.Voice4All.state) {
        return !!root.Voice4All.state.simpleMode;
      }
      try {
        return sessionStorage.getItem('v4a_simple_mode') === 'true';
      } catch (e) {
        return false;
      }
    },

    // =========================================================================
    // Navigation & Interaction
    // =========================================================================

    /**
     * Switch active tab in drawer
     * @param {'tutor'|'help'|'career'} tabName
     */
    switchTab(tabName) {
      if (!['tutor', 'help', 'career'].includes(tabName)) {
        console.warn(`[Voice4All] Unknown tab "${tabName}". Expected tutor, help, or career.`);
        return this;
      }

      if (typeof existingV4A.switchTab === 'function') {
        existingV4A.switchTab(tabName, true);
      } else {
        const tabEl = document.getElementById(`v4a-tab-${tabName}`);
        if (tabEl) tabEl.click();
      }

      this.trigger('tabchange', { tab: tabName });
      return this;
    },

    /**
     * Get active tab name
     * @returns {'tutor'|'help'|'career'}
     */
    getActiveTab() {
      if (root.Voice4All && root.Voice4All.state) {
        return root.Voice4All.state.activeTab || 'tutor';
      }
      const activePanel = document.querySelector('.v4a-tabpanel--active');
      if (activePanel && activePanel.id) {
        return activePanel.id.replace('v4a-panel-', '');
      }
      return 'tutor';
    },

    /**
     * Ask a question to the Voice4All AI tutor programmatically
     * @param {string} questionText
     */
    askTutor(questionText) {
      if (!questionText || typeof questionText !== 'string') return this;

      this.open();
      this.switchTab('tutor');

      const input = document.getElementById('v4a-chat-input');
      if (input) {
        input.value = questionText;
        if (typeof existingV4A.submitTutorMessage === 'function') {
          existingV4A.submitTutorMessage();
        } else {
          const form = document.getElementById('v4a-tutor-form');
          if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      }

      this.trigger('message', { type: 'user_ask', question: questionText });
      return this;
    },

    // =========================================================================
    // Accessibility, Announcements & Sound-Off Cues
    // =========================================================================

    /**
     * Make an accessible screen-reader announcement
     * @param {string} message
     * @param {'polite'|'assertive'} priority
     */
    announce(message, priority = 'polite') {
      if (root.Voice4AllA11y && typeof root.Voice4AllA11y.announce === 'function') {
        root.Voice4AllA11y.announce(message, priority);
      } else if (root.Voice4AllUI && typeof root.Voice4AllUI.announce === 'function') {
        root.Voice4AllUI.announce(message, priority);
      }
      return this;
    },

    /**
     * Display live visual captions for sound-off usability
     * @param {string} text
     * @param {number} durationMs
     */
    showCaption(text, durationMs = 0) {
      if (root.Voice4AllA11y && typeof root.Voice4AllA11y.showCaptions === 'function') {
        root.Voice4AllA11y.showCaptions(text, durationMs);
      }
      return this;
    },

    hideCaption() {
      if (root.Voice4AllA11y && typeof root.Voice4AllA11y.hideCaptions === 'function') {
        root.Voice4AllA11y.hideCaptions();
      }
      return this;
    },

    // =========================================================================
    // API Configuration
    // =========================================================================

    setApiBase(url) {
      if (root.Voice4AllAPI && typeof root.Voice4AllAPI.setApiBase === 'function') {
        root.Voice4AllAPI.setApiBase(url);
      }
      this._config.apiBase = url;
      return this;
    },

    getApiBase() {
      if (root.Voice4AllAPI && typeof root.Voice4AllAPI.getApiBase === 'function') {
        return root.Voice4AllAPI.getApiBase();
      }
      return this._config.apiBase || '';
    },

    // =========================================================================
    // Event System
    // =========================================================================

    /**
     * Register an event listener
     * @param {string} event
     * @param {Function} handler
     */
    on(event, handler) {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push(handler);
      return this;
    },

    /**
     * Remove an event listener
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
      if (!eventListeners[event]) return this;
      eventListeners[event] = eventListeners[event].filter(fn => fn !== handler);
      return this;
    },

    /**
     * Trigger an internal event and dispatch a DOM CustomEvent
     * @param {string} event
     * @param {Object} data
     */
    trigger(event, data = {}) {
      if (eventListeners[event]) {
        eventListeners[event].forEach((fn) => {
          try {
            fn(data);
          } catch (e) {
            console.error(`[Voice4All Event Error on "${event}"]:`, e);
          }
        });
      }

      // Also dispatch DOM CustomEvent for host page convenience
      try {
        const domEvent = new CustomEvent(`voice4all:${event}`, {
          bubbles: true,
          cancelable: true,
          detail: data
        });
        window.dispatchEvent(domEvent);
      } catch (e) {}
    },

    // =========================================================================
    // Destruction / SPA Teardown
    // =========================================================================

    destroy() {
      this.close();

      const launcher = document.getElementById('v4a-launcher-host');
      if (launcher) launcher.remove();

      const drawer = document.getElementById('v4a-drawer-host');
      if (drawer) drawer.remove();

      const announcerPolite = document.getElementById('v4a-live-announcer-polite');
      if (announcerPolite) announcerPolite.remove();

      const announcerAssertive = document.getElementById('v4a-live-announcer-assertive');
      if (announcerAssertive) announcerAssertive.remove();

      const captions = document.getElementById('v4a-captions-box');
      if (captions) captions.remove();

      this._isReady = false;
      this.trigger('destroy', {});
      console.log('[Voice4All Embed] Destroyed and cleaned up.');
    }
  };

  // Merge existing core widget functions into the Embed object so full API is available
  Object.assign(Voice4AllEmbed, existingV4A);

  root.Voice4All = Voice4AllEmbed;
})(typeof window !== 'undefined' ? window : this);
