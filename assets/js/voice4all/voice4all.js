/**
 * Voice4All — Main Coordinator & Accessible Controller (`assets/js/voice4all/voice4all.js`)
 *
 * Coordinates:
 *   - Floating launcher button
 *   - Accessible side drawer (dialog with focus trap, Esc-to-close, backdrop)
 *   - 3 Accessible Tabs (Tutor, Live Help, Career) with keyboard arrow navigation
 *   - English and Amharic language toggling
 *   - Voice input (SpeechRecognition) and Speech Synthesis (TTS)
 *   - Live Help request handling with honest screen sharing state
 *   - Career listings and workplace accommodation requests
 *   - Backend/Demo status tracking and screen-reader announcements
 */

((root) => {
  'use strict';

  const STORAGE_LANG_KEY = 'v4a_preferred_lang';
  const VOICE_SETTINGS_KEY = 'v4a_voice_assistant_settings';
  const SESSION_HISTORY_KEY = 'v4a_conversation_history';
  const SESSION_SIMPLE_MODE_KEY = 'v4a_simple_mode';
  const DEFAULT_VOICE_SETTINGS = {
    welcomeCompleted: false,
    enabled: false,
    language: 'en',
    voice: 'female',
    rate: 1,
    autoAnnouncePages: true,
    autoReadLearning: false
  };

  // State Management
  const state = {
    initialized: false,
    lang: 'en',
    drawerOpen: false,
    activeTab: 'tutor', // 'tutor' | 'help' | 'career'
    simpleMode: false,
    conversationHistory: [],
    lastUserMessage: '',
    isListening: false,
    speechRecognition: null,
    currentUtterance: null,
    currentAudio: null,
    currentAudioUrl: null,
    currentSpeechButton: null,
    speechStatus: 'idle',
    speechRequestId: 0,
    voiceSettings: { ...DEFAULT_VOICE_SETTINGS },
    welcomePromptOpen: false,
    welcomeSpeechAttempted: false,
    lastSpoken: null,
    lastPageAnnouncement: '',
    speechAudioCache: new Map(),
    activeFilter: 'all',
    searchQuery: '',
    activeTicket: null,
    lastActiveElement: null
  };

  // =========================================================================
  // Initialization
  // =========================================================================

  function init() {
    if (state.initialized) return;

    // 1. Determine language preference
    try {
      const saved = localStorage.getItem(STORAGE_LANG_KEY);
      if (saved === 'am' || saved === 'en') {
        state.lang = saved;
      }
    } catch (e) {
      /* private browsing or storage disabled */
    }

    state.voiceSettings = loadVoiceSettings(state.lang);

    // 2. Determine simple mode preference
    try {
      const savedSimple = sessionStorage.getItem(SESSION_SIMPLE_MODE_KEY);
      state.simpleMode = (savedSimple === 'true');
    } catch (e) {
      /* private browsing */
    }

    // 3. Restore session conversation history
    try {
      const savedHistory = sessionStorage.getItem(SESSION_HISTORY_KEY);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) state.conversationHistory = parsed;
      }
    } catch (e) {
      /* ignore */
    }

    // 4. Setup DOM Containers if not already injected
    setupDOM();

    // 5. Initialize Speech Recognition instance if supported
    setupSpeechRecognition();

    // 6. Attach event listeners
    bindEvents();

    // 7. Initial load for Career jobs
    loadJobs();

    // 8. Listen for API backend status changes
    if (root.Voice4AllAPI && typeof root.Voice4AllAPI.onStatusChange === 'function') {
      root.Voice4AllAPI.onStatusChange((isLive, aiProvider) => {
        updateStatusBanner(isLive, aiProvider);
      });
    }

    // 9. Listen for online/offline events
    window.addEventListener('online', () => updateNetworkBanner(true));
    window.addEventListener('offline', () => updateNetworkBanner(false));
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      updateNetworkBanner(false);
    }

    if (state.voiceSettings.enabled) {
      setTimeout(() => {
        if (!state.voiceSettings.enabled) return;
        if (state.voiceSettings.autoReadLearning && isLearningPage()) {
          readCurrentPage();
        } else if (state.voiceSettings.autoAnnouncePages) {
          announceCurrentPage();
        }
      }, 700);
    }

    state.initialized = true;
    console.log('[Voice4All] Initialized successfully. Language:', state.lang, 'Simple Mode:', state.simpleMode);
  }

  function loadVoiceSettings(language) {
    try {
      const saved = localStorage.getItem(VOICE_SETTINGS_KEY);
      if (!saved) return { ...DEFAULT_VOICE_SETTINGS, language };

      const parsed = JSON.parse(saved);
      const rate = Number(parsed.rate);
      return {
        welcomeCompleted: parsed.welcomeCompleted === true,
        enabled: parsed.enabled === true,
        language: parsed.language === 'am' || parsed.language === 'en' ? parsed.language : language,
        voice: parsed.voice === 'male' ? 'male' : 'female',
        rate: Number.isFinite(rate) ? Math.min(1.25, Math.max(0.75, rate)) : 1,
        autoAnnouncePages: parsed.autoAnnouncePages !== false,
        autoReadLearning: parsed.autoReadLearning === true
      };
    } catch (e) {
      return { ...DEFAULT_VOICE_SETTINGS, language };
    }
  }

  function saveVoiceSettings() {
    try {
      localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(state.voiceSettings));
    } catch (e) {
      /* storage may be disabled by the browser */
    }
  }

  function ensureSkipLink() {
    const main = document.querySelector('main, [role="main"], #content, #main-content');
    if (!main) return;

    if (!main.id) main.id = 'v4a-main-content';
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    if (main.tagName.toLowerCase() !== 'main' && !main.hasAttribute('role')) {
      main.setAttribute('role', 'main');
    }

    const existingSkipLink = Array.from(document.querySelectorAll('a[href]'))
      .find((link) => link.getAttribute('href') === `#${main.id}`);
    if (existingSkipLink && existingSkipLink.id !== 'v4a-skip-main-link') return;

    let skipLink = document.getElementById('v4a-skip-main-link');
    if (!skipLink) {
      skipLink = document.createElement('a');
      skipLink.id = 'v4a-skip-main-link';
      skipLink.className = 'v4a-skip-main-link';
      document.body.insertBefore(skipLink, document.body.firstChild);
    }

    skipLink.href = `#${main.id}`;
    skipLink.textContent = root.Voice4AllUI.t('skip_to_main', state.lang);
    skipLink.onclick = (event) => {
      event.preventDefault();
      main.focus();
      main.scrollIntoView({ block: 'start' });
    };
  }

  function updateVoiceSettingsControls() {
    const enabled = state.voiceSettings.enabled;
    const toggle = document.getElementById('v4a-voice-guidance-toggle');
    if (toggle) {
      const speaking = state.speechStatus === 'loading' || state.speechStatus === 'playing';
      const labelKey = speaking
        ? 'voice_toggle_speaking'
        : enabled
          ? 'voice_toggle_on'
          : 'voice_toggle_off';
      const label = root.Voice4AllUI.t(labelKey, state.lang);
      toggle.setAttribute('aria-pressed', String(enabled));
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('aria-busy', state.speechStatus === 'loading' ? 'true' : 'false');
      toggle.classList.toggle('v4a-voice-guidance-toggle--speaking', speaking);
      const toggleText = toggle.querySelector('span');
      if (toggleText) toggleText.textContent = label;
    }

    const enableInput = document.getElementById('v4a-voice-guidance-enabled');
    const languageInput = document.getElementById('v4a-voice-language');
    const voiceInput = document.getElementById('v4a-voice-selection');
    const rateInput = document.getElementById('v4a-voice-rate');
    const autoPagesInput = document.getElementById('v4a-auto-announcements');
    const autoReadInput = document.getElementById('v4a-auto-read-learning');

    if (enableInput) enableInput.checked = enabled;
    if (languageInput) languageInput.value = state.voiceSettings.language;
    if (voiceInput) voiceInput.value = state.voiceSettings.voice;
    if (rateInput) rateInput.value = String(state.voiceSettings.rate);
    if (autoPagesInput) autoPagesInput.checked = state.voiceSettings.autoAnnouncePages;
    if (autoReadInput) autoReadInput.checked = state.voiceSettings.autoReadLearning;

    const rateOutput = document.getElementById('v4a-voice-rate-value');
    if (rateOutput) rateOutput.textContent = `${state.voiceSettings.rate.toFixed(2)}×`;

    const statusKey = {
      idle: 'voice_status_ready',
      loading: 'voice_status_loading',
      playing: 'voice_status_speaking',
      paused: 'voice_status_paused',
      blocked: 'voice_status_blocked',
      error: 'speech_unavailable'
    }[state.speechStatus] || 'voice_status_ready';
    const settingsStatus = document.getElementById('v4a-voice-settings-status');
    if (settingsStatus) settingsStatus.textContent = root.Voice4AllUI.t(statusKey, state.lang);

    const pauseButton = document.getElementById('v4a-voice-pause');
    const resumeButton = document.getElementById('v4a-voice-resume');
    const stopButton = document.getElementById('v4a-voice-stop');
    const repeatButton = document.getElementById('v4a-voice-repeat');
    if (pauseButton) pauseButton.disabled = state.speechStatus !== 'playing';
    if (resumeButton) resumeButton.disabled = state.speechStatus !== 'paused' && state.speechStatus !== 'blocked';
    if (stopButton) stopButton.disabled = !['loading', 'playing', 'paused', 'blocked'].includes(state.speechStatus);
    if (repeatButton) repeatButton.disabled = !state.lastSpoken;
  }

  function updateVoiceSetting(key, value) {
    if (key === 'rate') {
      const rate = Number(value);
      if (!Number.isFinite(rate)) return;
      state.voiceSettings.rate = Math.min(1.25, Math.max(0.75, rate));
    } else if (key === 'language') {
      if (value !== 'am' && value !== 'en') return;
      state.voiceSettings.language = value;
    } else if (key === 'voice') {
      if (value !== 'female' && value !== 'male') return;
      state.voiceSettings.voice = value;
    } else if (key === 'autoAnnouncePages' || key === 'autoReadLearning') {
      state.voiceSettings[key] = Boolean(value);
    } else {
      return;
    }

    saveVoiceSettings();
    updateVoiceSettingsControls();
  }

  function setVoiceGuidance(enabled, options = {}) {
    state.voiceSettings.enabled = Boolean(enabled);
    saveVoiceSettings();
    updateVoiceSettingsControls();

    if (!state.voiceSettings.enabled) {
      stopSpeaking();
      if (!options.silent) {
        root.Voice4AllUI.announce(root.Voice4AllUI.t('voice_disabled_notice', state.lang));
      }
      return;
    }

    if (!options.silent) {
      root.Voice4AllUI.announce(root.Voice4AllUI.t('voice_enabled_notice', state.lang));
      if (state.voiceSettings.autoReadLearning && isLearningPage()) {
        readCurrentPage();
      } else if (state.voiceSettings.autoAnnouncePages) {
        state.lastPageAnnouncement = '';
        announceCurrentPage();
      } else {
        speakText(root.Voice4AllUI.t('voice_guidance_intro', state.voiceSettings.language));
      }
    }
  }

  function updateWelcomePromptStatus(messageKey, showPlayButton = false) {
    const status = document.getElementById('v4a-voice-welcome-status');
    const playButton = document.getElementById('v4a-voice-welcome-play');
    if (status) status.textContent = root.Voice4AllUI.t(messageKey, state.lang);
    if (playButton) playButton.hidden = !showPlayButton;
  }

  function showVoiceWelcome() {
    if (state.voiceSettings.welcomeCompleted || state.welcomePromptOpen) return;
    const host = document.getElementById('v4a-voice-welcome-host');
    if (!host) return;

    state.welcomePromptOpen = true;
    host.hidden = false;
    host.innerHTML = root.Voice4AllUI.renderVoiceWelcome(state.lang);
    root.Voice4AllUI.announce(root.Voice4AllUI.t('voice_welcome_message', state.lang));

    if (!state.welcomeSpeechAttempted) {
      state.welcomeSpeechAttempted = true;
      updateWelcomePromptStatus('voice_welcome_playing');
      speakText(root.Voice4AllUI.t('voice_welcome_message', state.voiceSettings.language), null, {
        language: state.voiceSettings.language,
        onEnd: () => updateWelcomePromptStatus('voice_welcome_finished'),
        onAutoplayBlocked: () => updateWelcomePromptStatus('voice_autoplay_blocked', true),
        onError: () => updateWelcomePromptStatus('voice_welcome_unavailable', true)
      });
    }
  }

  function completeVoiceWelcome(enabled) {
    state.voiceSettings.welcomeCompleted = true;
    state.welcomePromptOpen = false;
    saveVoiceSettings();
    stopSpeaking();

    const host = document.getElementById('v4a-voice-welcome-host');
    if (host) {
      host.hidden = true;
      host.innerHTML = '';
    }

    setVoiceGuidance(enabled, { silent: true });
    if (!enabled) {
      root.Voice4AllUI.announce(root.Voice4AllUI.t('voice_disabled_notice', state.lang));
      const launcher = document.getElementById('v4a-launcher-btn');
      if (launcher) launcher.focus();
      return;
    }

    openDrawer(true);
    setTimeout(() => {
      if (!state.voiceSettings.enabled) return;
      if (state.voiceSettings.autoReadLearning && isLearningPage()) {
        readCurrentPage();
      } else if (state.voiceSettings.autoAnnouncePages) {
        state.lastPageAnnouncement = '';
        announceCurrentPage();
      } else {
        speakText(root.Voice4AllUI.t('voice_guidance_intro', state.voiceSettings.language));
      }
    }, 350);
  }

  function pageGuidanceText() {
    const path = window.location.pathname.toLowerCase();
    let key = '';
    if (/homepage-v1-(paced|self-paced)\.html$/.test(path)) {
      key = 'voice_page_dashboard';
    } else if (path.includes('concept-with-navigation')) {
      key = 'voice_page_lesson';
    } else if (path.includes('career-development')) {
      key = 'voice_page_career';
    } else if (path.includes('human-support')) {
      key = 'voice_page_support';
    } else if (path.includes('support-dashboard')) {
      key = 'voice_page_support_agent';
    } else if (path.includes('teacher-dashboard')) {
      key = 'voice_page_teacher';
    } else if (path === '/' || path.endsWith('/index.html')) {
      key = 'voice_page_home';
    }

    if (!key) return '';
    let message = root.Voice4AllUI.t(key, state.voiceSettings.language);
    if (key === 'voice_page_lesson') {
      const heading = document.querySelector('#content h1:not(.modal-title), main h1:not(.modal-title)');
      const title = heading ? heading.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : document.title;
      message = message.replace('{title}', title || document.title);
    }
    return message;
  }

  function isLearningPage() {
    return window.location.pathname.toLowerCase().includes('concept-with-navigation');
  }

  function announceCurrentPage() {
    if (!state.voiceSettings.enabled || !state.voiceSettings.autoAnnouncePages) return;
    const message = pageGuidanceText();
    if (!message || message === state.lastPageAnnouncement) return;
    state.lastPageAnnouncement = message;
    speakText(message);
  }

  function getCurrentPageContent() {
    const main = document.querySelector('main, [role="main"]');
    if (!main) return pageGuidanceText();

    const heading = main.querySelector('h1:not(.modal-title)');
    const paragraphs = Array.from(main.querySelectorAll('p'))
      .filter((paragraph) => !paragraph.closest('[hidden], [aria-hidden="true"], .modal') && paragraph.getClientRects().length > 0)
      .map((paragraph) => paragraph.textContent.replace(/\s+/g, ' ').trim())
      .filter((text) => text.length > 30)
      .slice(0, 2);

    return [pageGuidanceText(), heading && heading.textContent.replace(/\s+/g, ' ').trim(), ...paragraphs]
      .filter(Boolean)
      .join('. ')
      .slice(0, 1800);
  }

  function readCurrentPage(button = null) {
    const text = getCurrentPageContent();
    if (text) speakText(text, button);
  }

  function updateNetworkBanner(isOnline) {
    const banner = document.getElementById('v4a-offline-banner');
    if (!banner) return;
    if (isOnline) {
      banner.classList.remove('v4a-offline-banner--visible');
    } else {
      banner.classList.add('v4a-offline-banner--visible');
    }
  }

  // =========================================================================
  // DOM Setup & Rendering
  // =========================================================================

  function setupDOM() {
    let launcherContainer = document.getElementById('v4a-launcher-host');
    if (!launcherContainer) {
      launcherContainer = document.createElement('div');
      launcherContainer.id = 'v4a-launcher-host';
      document.body.appendChild(launcherContainer);
    }
    launcherContainer.innerHTML = root.Voice4AllUI.renderLauncher(state.lang);

    let welcomeHost = document.getElementById('v4a-voice-welcome-host');
    if (!welcomeHost) {
      welcomeHost = document.createElement('div');
      welcomeHost.id = 'v4a-voice-welcome-host';
      welcomeHost.className = 'v4a-voice-welcome-host';
      launcherContainer.insertAdjacentElement('afterend', welcomeHost);
    }
    welcomeHost.hidden = !state.welcomePromptOpen;
    welcomeHost.innerHTML = state.welcomePromptOpen
      ? root.Voice4AllUI.renderVoiceWelcome(state.lang)
      : '';

    let drawerContainer = document.getElementById('v4a-drawer-host');
    if (!drawerContainer) {
      drawerContainer = document.createElement('div');
      drawerContainer.id = 'v4a-drawer-host';
      document.body.appendChild(drawerContainer);
    }
    const isLive = root.Voice4AllAPI ? root.Voice4AllAPI.isBackendAvailable() : false;
    drawerContainer.innerHTML = root.Voice4AllUI.renderDrawerShell(state.lang, isLive, state.voiceSettings);

    const drawer = document.getElementById('v4a-drawer');
    if (drawer && state.simpleMode) {
      drawer.classList.add('v4a-simple-mode');
    }

    // Render contents of panels
    renderAllPanels();
    ensureSkipLink();
    updateVoiceSettingsControls();
  }

  function renderAllPanels() {
    const tutorPanel = document.getElementById('v4a-panel-tutor');
    if (tutorPanel) tutorPanel.innerHTML = root.Voice4AllUI.renderTutorPanel(state.lang, state.simpleMode);

    // Restore prior session conversation history if present
    restoreChatHistory();

    const helpPanel = document.getElementById('v4a-panel-help');
    if (helpPanel) {
      helpPanel.innerHTML = root.Voice4AllUI.renderHelpPanel(state.lang);
      if (state.activeTicket) {
        const ticketContainer = document.getElementById('v4a-ticket-container');
        if (ticketContainer) {
          ticketContainer.innerHTML = root.Voice4AllUI.renderTicketCard(state.activeTicket, state.lang);
        }
      }
    }

    const careerPanel = document.getElementById('v4a-panel-career');
    if (careerPanel) careerPanel.innerHTML = root.Voice4AllUI.renderCareerPanel(state.lang);
  }

  function restoreChatHistory() {
    const chatLog = document.getElementById('v4a-chat-log');
    if (!chatLog) return;
    if (!Array.isArray(state.conversationHistory) || state.conversationHistory.length === 0) return;

    // Clear initial welcome message and rehydrate saved conversation
    chatLog.innerHTML = '';
    state.conversationHistory.forEach((item) => {
      if (item.role === 'user') {
        chatLog.insertAdjacentHTML('beforeend', root.Voice4AllUI.renderUserBubble(item.content));
      } else if (item.role === 'assistant') {
        chatLog.insertAdjacentHTML('beforeend', root.Voice4AllUI.renderTutorBubble({
          reply: item.content,
          citations: item.citations || [],
          isDemo: item.isDemo || false,
          demoNotice: item.demoNotice || ''
        }, state.lang));
      }
    });
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function clearChatHistory() {
    state.conversationHistory = [];
    try {
      sessionStorage.removeItem(SESSION_HISTORY_KEY);
    } catch (e) { }

    const chatLog = document.getElementById('v4a-chat-log');
    if (chatLog) {
      const isAm = (state.lang === 'am');
      const defaultCitation = isAm ? [
        {
          title: 'ሞጁል 2፡ ቨርቹዋል ረዳት ምንድን ነው',
          section: 'መግቢያ እና አጠቃላይ እይታ',
          source: 'የሳቫና ስርዓተ-ትምህርት',
          url: '#module-2-overview'
        }
      ] : [
        {
          title: 'Module 2: What is a VA',
          section: 'Overview & Foundation',
          source: 'Savanna Concept Materials',
          url: '#module-2-overview'
        }
      ];

      chatLog.innerHTML = `
        <div class="v4a-chat-item v4a-chat-item--tutor">
          <div class="v4a-bubble" dir="auto">${root.Voice4AllUI.t('tutor_welcome', state.lang)}</div>
          ${root.Voice4AllUI.renderCitations(defaultCitation, state.lang)}
          <div class="v4a-bubble-footer">
            <span>${root.Voice4AllUI.t('brand_title', state.lang)}</span>
            <button
              type="button"
              class="v4a-tts-btn"
              data-v4a-speech-text="${root.Voice4AllUI.escapeHTML(root.Voice4AllUI.t('tutor_welcome', state.lang))}"
              aria-label="${root.Voice4AllUI.t('listen_btn_aria', state.lang)}"
            >
              <i class="fa-solid fa-volume-high" aria-hidden="true"></i>
              <span>${root.Voice4AllUI.t('listen_btn', state.lang)}</span>
            </button>
          </div>
        </div>
      `;
    }

    root.Voice4AllUI.announce(root.Voice4AllUI.t('clear_chat', state.lang));
  }

  function updateStatusBanner(isBackendReady, aiProvider) {
    const banner = document.getElementById('v4a-status-banner');
    if (!banner) return;

    const isGeminiSelected = isBackendReady && (aiProvider === 'gemini' || aiProvider === 'cloud_ai');
    const statusClass = isGeminiSelected ? 'v4a-status-banner--live' : 'v4a-status-banner--demo';
    const icon = isGeminiSelected ? 'fa-circle-check' : 'fa-flask';
    const text = !isBackendReady
      ? root.Voice4AllUI.t('demo_status', state.lang)
      : root.Voice4AllUI.t(
        isGeminiSelected ? 'gemini_selected_status' : 'backend_demo_status',
        state.lang
      );
    const pill = !isBackendReady ? 'OFFLINE' : isGeminiSelected ? 'GEMINI' : 'DEMO';

    banner.className = `v4a-status-banner ${statusClass}`;
    banner.innerHTML = `
      <div class="v4a-status-banner-content">
        <i class="fa-solid ${icon}" aria-hidden="true"></i>
        <span>${text}</span>
      </div>
      <span class="v4a-status-pill">${pill}</span>
    `;
  }

  // =========================================================================
  // Drawer Lifecycle & Focus Management (WAI-ARIA Dialog)
  // =========================================================================

  function openDrawer(skipWelcome = false) {
    if (state.drawerOpen) return;
    if (!skipWelcome && !state.voiceSettings.welcomeCompleted) {
      showVoiceWelcome();
      return;
    }

    if (root.Voice4AllA11y && typeof root.Voice4AllA11y.setLauncherBadge === 'function') {
      root.Voice4AllA11y.setLauncherBadge(false);
    }

    state.lastActiveElement = document.activeElement;
    state.drawerOpen = true;

    const drawer = document.getElementById('v4a-drawer');
    const backdrop = document.getElementById('v4a-backdrop');
    const launcherBtn = document.getElementById('v4a-launcher-btn');

    if (drawer) drawer.classList.add('v4a-drawer--open');
    if (backdrop) backdrop.classList.add('v4a-backdrop--active');
    if (launcherBtn) launcherBtn.setAttribute('aria-expanded', 'true');

    // Announce to screen reader
    root.Voice4AllUI.announce(root.Voice4AllUI.t('announce_drawer_opened', state.lang));

    // Shift focus to close button or drawer heading for accessibility
    setTimeout(() => {
      const closeBtn = document.getElementById('v4a-close-btn');
      if (closeBtn) closeBtn.focus();
    }, 50);

    // Attach trap focus listener
    document.addEventListener('keydown', handleDrawerKeydown);
  }

  function closeDrawer() {
    if (!state.drawerOpen) return;

    state.drawerOpen = false;

    // Stop ongoing speech recognition or synthesis
    stopListening();
    stopSpeaking();

    const drawer = document.getElementById('v4a-drawer');
    const backdrop = document.getElementById('v4a-backdrop');
    const launcherBtn = document.getElementById('v4a-launcher-btn');

    if (drawer) drawer.classList.remove('v4a-drawer--open');
    if (backdrop) backdrop.classList.remove('v4a-backdrop--active');
    if (launcherBtn) launcherBtn.setAttribute('aria-expanded', 'false');

    // Announce to screen reader
    root.Voice4AllUI.announce(root.Voice4AllUI.t('announce_drawer_closed', state.lang));

    // Restore focus back to launcher
    document.removeEventListener('keydown', handleDrawerKeydown);
    if (state.lastActiveElement && typeof state.lastActiveElement.focus === 'function') {
      state.lastActiveElement.focus();
    } else if (launcherBtn) {
      launcherBtn.focus();
    }
  }

  function handleDrawerKeydown(event) {
    if (!state.drawerOpen) return;

    // ESC closes drawer
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }

    // TAB traps focus inside drawer
    if (event.key === 'Tab') {
      const drawer = document.getElementById('v4a-drawer');
      if (!drawer) return;

      const focusables = drawer.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  // =========================================================================
  // Tab Switching & Keyboard Navigation (WAI-ARIA Tabs)
  // =========================================================================

  const TABS = ['tutor', 'help', 'career'];

  function switchTab(tabName, shouldFocus = true) {
    if (!TABS.includes(tabName)) return;
    const changed = state.activeTab !== tabName;
    state.activeTab = tabName;

    TABS.forEach((name) => {
      const tabEl = document.getElementById(`v4a-tab-${name}`);
      const panelEl = document.getElementById(`v4a-panel-${name}`);
      const isSelected = (name === tabName);

      if (tabEl) {
        tabEl.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        tabEl.setAttribute('tabindex', isSelected ? '0' : '-1');
        if (isSelected && shouldFocus) tabEl.focus();
      }

      if (panelEl) {
        if (isSelected) {
          panelEl.classList.add('v4a-tabpanel--active');
        } else {
          panelEl.classList.remove('v4a-tabpanel--active');
        }
      }
    });

    if (changed) {
      const tabTitle = root.Voice4AllUI.t(`tab_${tabName}`, state.lang);
      root.Voice4AllUI.announce(`${root.Voice4AllUI.t('announce_tab_switched', state.lang)} ${tabTitle}`);
      if (state.voiceSettings.enabled && state.voiceSettings.autoAnnouncePages) {
        speakText(root.Voice4AllUI.t(`voice_tab_${tabName}`, state.voiceSettings.language));
      }
    }
  }

  function handleTabKeydown(event) {
    const currentTab = event.currentTarget.getAttribute('id').replace('v4a-tab-', '');
    const currentIndex = TABS.indexOf(currentTab);
    let targetIndex = -1;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        targetIndex = (currentIndex + 1) % TABS.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        targetIndex = (currentIndex - 1 + TABS.length) % TABS.length;
        break;
      case 'Home':
        event.preventDefault();
        targetIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        targetIndex = TABS.length - 1;
        break;
      default:
        return;
    }

    if (targetIndex >= 0) {
      switchTab(TABS[targetIndex], true);
    }
  }

  // =========================================================================
  // Language Switching (English / Amharic)
  // =========================================================================

  function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'am') return;
    stopSpeaking();
    state.lang = lang;
    state.voiceSettings.language = lang;
    saveVoiceSettings();

    try {
      localStorage.setItem(STORAGE_LANG_KEY, lang);
    } catch (e) {
      /* ignore */
    }

    // Re-render UI elements
    setupDOM();

    // Re-activate previously open tab
    switchTab(state.activeTab, false);

    // Re-open drawer if it was open
    if (state.drawerOpen) {
      const drawer = document.getElementById('v4a-drawer');
      const backdrop = document.getElementById('v4a-backdrop');
      const launcherBtn = document.getElementById('v4a-launcher-btn');
      if (drawer) drawer.classList.add('v4a-drawer--open');
      if (backdrop) backdrop.classList.add('v4a-backdrop--active');
      if (launcherBtn) launcherBtn.setAttribute('aria-expanded', 'true');
    }

    // Refresh jobs in new language
    loadJobs();

    // Announce language change
    root.Voice4AllUI.announce(root.Voice4AllUI.t('announce_lang_switched', state.lang));
    if (state.voiceSettings.enabled && state.voiceSettings.autoAnnouncePages) {
      state.lastPageAnnouncement = '';
      announceCurrentPage();
    }
  }

  // =========================================================================
  // Speech Recognition (Voice Input)
  // =========================================================================

  function setupSpeechRecognition() {
    const SpeechRecognition = root.SpeechRecognition || root.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      state.speechRecognition = null;
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        state.isListening = true;
        updateVoiceButtonState(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const inputEl = document.getElementById('v4a-tutor-input');
        if (inputEl) {
          inputEl.value = transcript;
          submitTutorMessage(transcript);
        }
      };

      recognition.onerror = (err) => {
        console.warn('[Voice4All Voice] Speech recognition error:', err.error);
        stopListening();
      };

      recognition.onend = () => {
        state.isListening = false;
        updateVoiceButtonState(false);
      };

      state.speechRecognition = recognition;
    } catch (err) {
      console.warn('[Voice4All Voice] Initialization failed:', err);
      state.speechRecognition = null;
    }
  }

  function toggleVoiceInput() {
    if (!state.speechRecognition) {
      alert(root.Voice4AllUI.t('voice_unsupported', state.lang));
      return;
    }

    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function startListening() {
    if (!state.speechRecognition) return;
    try {
      // Set language according to active preference
      state.speechRecognition.lang = state.lang === 'am' ? 'am-ET' : 'en-US';
      state.speechRecognition.start();
      state.isListening = true;
      updateVoiceButtonState(true);
      root.Voice4AllUI.announce(root.Voice4AllUI.t('voice_listening', state.lang), 'assertive');
    } catch (err) {
      console.warn('[Voice4All Voice] Error starting:', err);
    }
  }

  function stopListening() {
    if (!state.speechRecognition) return;
    try {
      state.speechRecognition.stop();
    } catch (e) {
      /* ignore */
    }
    state.isListening = false;
    updateVoiceButtonState(false);
  }

  function updateVoiceButtonState(listening) {
    const btn = document.getElementById('v4a-voice-toggle-btn');
    const banner = document.getElementById('v4a-voice-status');

    if (btn) {
      btn.classList.toggle('v4a-icon-btn--voice-active', listening);
      btn.setAttribute(
        'aria-label',
        listening ? root.Voice4AllUI.t('voice_btn_stop_aria', state.lang) : root.Voice4AllUI.t('voice_btn_start_aria', state.lang)
      );
    }

    if (banner) {
      banner.classList.toggle('v4a-voice-status--active', listening);
    }
  }

  // =========================================================================
  // Speech Synthesis (TTS Read Aloud)
  // =========================================================================

  function setSpeechButtonState(button, status) {
    state.speechStatus = status;
    if (button) {
      button.setAttribute('aria-busy', status === 'loading' ? 'true' : 'false');

      if (button.classList.contains('v4a-tts-btn')) {
        button.classList.toggle('v4a-tts-btn--active', status === 'loading' || status === 'playing');
        button.classList.toggle('v4a-tts-btn--error', status === 'error');

        const label = button.querySelector('span');
        if (label) {
          label.textContent = status === 'loading'
            ? root.Voice4AllUI.t('speech_loading', state.lang)
            : status === 'playing'
              ? root.Voice4AllUI.t('stop_speech_btn', state.lang)
              : status === 'error'
                ? root.Voice4AllUI.t('speech_error_label', state.lang)
                : root.Voice4AllUI.t('listen_btn', state.lang);
        }

        button.setAttribute(
          'aria-label',
          status === 'playing'
            ? root.Voice4AllUI.t('stop_speech_btn', state.lang)
            : status === 'loading'
              ? root.Voice4AllUI.t('speech_loading', state.lang)
              : status === 'error'
                ? root.Voice4AllUI.t('speech_error_label', state.lang)
                : root.Voice4AllUI.t('listen_btn_aria', state.lang)
        );
      }
    }

    updateVoiceSettingsControls();
  }

  async function getSpeechAudio(payload) {
    const cacheable = payload.text.length <= 300;
    const cacheKey = JSON.stringify([payload.language, payload.voice, payload.rate, payload.text]);
    if (cacheable && state.speechAudioCache.has(cacheKey)) {
      const cachedBlob = state.speechAudioCache.get(cacheKey);
      state.speechAudioCache.delete(cacheKey);
      state.speechAudioCache.set(cacheKey, cachedBlob);
      return cachedBlob;
    }

    const audioBlob = await root.Voice4AllAPI.synthesizeSpeech(payload);
    if (cacheable) {
      if (state.speechAudioCache.size >= 24) {
        state.speechAudioCache.delete(state.speechAudioCache.keys().next().value);
      }
      state.speechAudioCache.set(cacheKey, audioBlob);
    }
    return audioBlob;
  }

  async function speakText(text, triggerButton = null, options = {}) {
    const speechText = String(text || '').trim();
    if (!speechText) return;

    const language = options.language || state.voiceSettings.language || state.lang;
    const voice = options.voice || state.voiceSettings.voice;
    const rate = options.rate || state.voiceSettings.rate;
    const request = { text: speechText, language, voice, rate };
    state.lastSpoken = request;
    stopSpeaking();
    const requestId = ++state.speechRequestId;
    state.currentSpeechButton = triggerButton;
    setSpeechButtonState(triggerButton, 'loading');

    // Show visual captions for sound-off usability (WCAG 1.2)
    if (root.Voice4AllA11y && typeof root.Voice4AllA11y.showCaptions === 'function') {
      root.Voice4AllA11y.showCaptions(speechText, 10000);
    }

    if (root.Voice4AllAPI && typeof root.Voice4AllAPI.synthesizeSpeech === 'function') {
      try {
        const audioBlob = await getSpeechAudio(request);
        if (requestId !== state.speechRequestId) return;

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.className = 'v4a-generated-audio';
        audio.setAttribute('aria-label', language === 'am' ? 'የድምፅ መልስ' : 'Spoken response');
        audio.style.display = 'block';
        audio.style.maxWidth = '100%';
        audio.src = audioUrl;
        if (triggerButton) triggerButton.insertAdjacentElement('afterend', audio);

        state.currentAudio = audio;
        state.currentAudioUrl = audioUrl;
        audio.addEventListener('play', () => {
          if (requestId === state.speechRequestId) {
            setSpeechButtonState(triggerButton, 'playing');
            if (typeof options.onStart === 'function') options.onStart();
          }
        });
        audio.addEventListener('pause', () => {
          if (requestId === state.speechRequestId && !audio.ended) {
            setSpeechButtonState(triggerButton, 'paused');
          }
        });
        audio.addEventListener('ended', () => {
          if (requestId === state.speechRequestId) {
            setSpeechButtonState(triggerButton, 'idle');
            if (typeof options.onEnd === 'function') options.onEnd();
          }
          if (root.Voice4AllA11y && typeof root.Voice4AllA11y.hideCaptions === 'function') {
            root.Voice4AllA11y.hideCaptions();
          }
        }, { once: true });
        audio.addEventListener('error', () => {
          if (requestId !== state.speechRequestId) return;
          setSpeechButtonState(triggerButton, 'error');
          root.Voice4AllUI.announce(root.Voice4AllUI.t('speech_playback_failed', state.lang));
          if (typeof options.onError === 'function') options.onError();
        }, { once: true });

        try {
          await audio.play();
        } catch (err) {
          if (requestId !== state.speechRequestId) return;
          if (audio.paused && state.speechStatus === 'paused') return;
          if (!audio.paused && state.speechStatus === 'playing') return;
          setSpeechButtonState(triggerButton, 'blocked');
          if (typeof options.onAutoplayBlocked === 'function') {
            options.onAutoplayBlocked();
          } else {
            root.Voice4AllUI.announce(root.Voice4AllUI.t('speech_audio_ready', state.lang));
          }
        }
        return;
      } catch (err) {
        if (requestId !== state.speechRequestId) return;
        console.warn('[Voice4All TTS] Hosted speech service unavailable:', err.message);
        root.Voice4AllUI.announce(root.Voice4AllUI.t('speech_unavailable', state.lang));
      }
    }

    if (root.Voice4AllSpeech && typeof root.Voice4AllSpeech.speak === 'function') {
      const started = root.Voice4AllSpeech.speak(text, {
        language,
        rate,
        onStart: () => {
          if (requestId === state.speechRequestId) {
            setSpeechButtonState(triggerButton, 'playing');
            if (typeof options.onStart === 'function') options.onStart();
          }
        },
        onEnd: () => {
          if (requestId === state.speechRequestId) {
            setSpeechButtonState(triggerButton, 'idle');
            if (typeof options.onEnd === 'function') options.onEnd();
          }
          if (root.Voice4AllA11y && typeof root.Voice4AllA11y.hideCaptions === 'function') {
            root.Voice4AllA11y.hideCaptions();
          }
        },
        onFallbackToText: () => {
          if (requestId === state.speechRequestId) {
            setSpeechButtonState(triggerButton, 'error');
            root.Voice4AllUI.announce(root.Voice4AllUI.t('speech_unavailable', state.lang));
            if (typeof options.onError === 'function') options.onError();
          }
        },
        onError: () => {
          if (requestId === state.speechRequestId) {
            setSpeechButtonState(triggerButton, 'error');
            root.Voice4AllUI.announce(root.Voice4AllUI.t('speech_unavailable', state.lang));
            if (typeof options.onError === 'function') options.onError();
          }
        }
      });
      if (started) return;
    }

    setSpeechButtonState(triggerButton, 'error');
    if (typeof options.onError === 'function') options.onError();
    if (root.Voice4AllA11y && typeof root.Voice4AllA11y.showCaptions === 'function') {
      root.Voice4AllA11y.showCaptions(speechText, 12000);
    }
  }

  function stopSpeaking() {
    state.speechRequestId += 1;
    if (root.Voice4AllA11y && typeof root.Voice4AllA11y.hideCaptions === 'function') {
      root.Voice4AllA11y.hideCaptions();
    }
    if (root.Voice4AllSpeech && typeof root.Voice4AllSpeech.stopSpeaking === 'function') {
      root.Voice4AllSpeech.stopSpeaking();
    }
    if ('speechSynthesis' in root && root.speechSynthesis.speaking) {
      root.speechSynthesis.cancel();
    }
    state.currentUtterance = null;
    if (state.currentSpeechButton) {
      setSpeechButtonState(state.currentSpeechButton, 'idle');
      state.currentSpeechButton = null;
    }
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.remove();
      state.currentAudio = null;
    }
    if (state.currentAudioUrl) {
      URL.revokeObjectURL(state.currentAudioUrl);
      state.currentAudioUrl = null;
    }
    state.speechStatus = 'idle';
    updateVoiceSettingsControls();
  }

  function pauseSpeaking() {
    if (state.currentAudio && !state.currentAudio.paused) {
      state.currentAudio.pause();
    } else if ('speechSynthesis' in root && root.speechSynthesis.speaking) {
      root.speechSynthesis.pause();
      setSpeechButtonState(state.currentSpeechButton, 'paused');
    }
  }

  async function resumeSpeaking() {
    if (state.currentAudio && (state.currentAudio.paused || state.speechStatus === 'blocked')) {
      try {
        await state.currentAudio.play();
      } catch (error) {
        setSpeechButtonState(state.currentSpeechButton, 'blocked');
        root.Voice4AllUI.announce(root.Voice4AllUI.t('speech_audio_ready', state.lang));
      }
      return;
    }

    if ('speechSynthesis' in root && root.speechSynthesis.paused) {
      root.speechSynthesis.resume();
      setSpeechButtonState(state.currentSpeechButton, 'playing');
    }
  }

  function repeatSpeaking() {
    if (state.lastSpoken) {
      speakText(state.lastSpoken.text, null, state.lastSpoken);
    }
  }

  // =========================================================================
  // Tutor Logic & Chat Handling
  // =========================================================================

  async function submitTutorMessage(text) {
    const message = (text || '').trim();
    if (!message) return;

    state.lastUserMessage = message;

    const chatLog = document.getElementById('v4a-chat-log');
    const inputEl = document.getElementById('v4a-tutor-input');
    const sendBtn = document.getElementById('v4a-send-btn');
    const voiceBtn = document.getElementById('v4a-voice-toggle-btn');

    if (inputEl) inputEl.value = '';

    // Append user message bubble and record history
    if (chatLog) {
      chatLog.insertAdjacentHTML('beforeend', root.Voice4AllUI.renderUserBubble(message));
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    state.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    try {
      sessionStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(state.conversationHistory));
    } catch (e) { }

    // Append loading placeholder
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'v4a-chat-item v4a-chat-item--tutor';
    loadingBubble.setAttribute('aria-busy', 'true');
    loadingBubble.innerHTML = `
      <div class="v4a-bubble d-flex align-items-center gap-2">
        <div class="v4a-spinner mb-0" style="width:16px; height:16px;" aria-hidden="true"></div>
        <span>${root.Voice4AllUI.t('tutor_loading', state.lang)}</span>
      </div>
    `;
    if (chatLog) {
      chatLog.appendChild(loadingBubble);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    if (sendBtn) sendBtn.disabled = true;
    if (voiceBtn) voiceBtn.disabled = true;
    root.Voice4AllUI.announce(root.Voice4AllUI.t('announce_msg_sent', state.lang));

    try {
      const res = await root.Voice4AllAPI.askTutor({
        message,
        language: state.lang,
        simple_mode: state.simpleMode,
        conversation_history: state.conversationHistory,
        context: { page: 'The Future of the VA Industry' }
      });

      if (loadingBubble.parentNode) loadingBubble.remove();

      // Record assistant message in history
      state.conversationHistory.push({
        role: 'assistant',
        content: res.reply,
        citations: res.citations || [],
        isDemo: res.isDemo || false,
        demoNotice: res.demoNotice || '',
        timestamp: res.timestamp || new Date().toISOString()
      });
      try {
        sessionStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(state.conversationHistory));
      } catch (e) { }

      // Render tutor response with citations
      if (chatLog) {
        chatLog.insertAdjacentHTML('beforeend', root.Voice4AllUI.renderTutorBubble(res, state.lang));
        chatLog.scrollTop = chatLog.scrollHeight;
      }

      // Accessible announcement with text preview
      const preview = (res.reply || '').slice(0, 90).replace(/\n/g, ' ');
      root.Voice4AllUI.announce(`${root.Voice4AllUI.t('announce_incoming_msg', state.lang)} ${preview}`);

      // Sound-off visual notification badge on launcher if drawer was closed
      if (!state.drawerOpen && root.Voice4AllA11y && typeof root.Voice4AllA11y.setLauncherBadge === 'function') {
        root.Voice4AllA11y.setLauncherBadge(true, `${root.Voice4AllUI.t('announce_incoming_msg', state.lang)} ${preview}`);
      }

      // Update starter suggestions if provided
      if (Array.isArray(res.suggestions) && res.suggestions.length > 0) {
        updateStarterChips(res.suggestions);
      }
    } catch (err) {
      if (loadingBubble.parentNode) loadingBubble.remove();
      console.error('[Voice4All Tutor] Request failed:', err);

      if (chatLog) {
        chatLog.insertAdjacentHTML('beforeend', root.Voice4AllUI.renderErrorBubble(err.message, state.lang));
        chatLog.scrollTop = chatLog.scrollHeight;
      }
      root.Voice4AllUI.announce(root.Voice4AllUI.t('tutor_error', state.lang), 'assertive');
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      if (voiceBtn) voiceBtn.disabled = false;
    }
  }

  function updateStarterChips(suggestions) {
    const wrap = document.querySelector('.v4a-starters-wrap');
    if (!wrap) return;

    wrap.innerHTML = suggestions.map((s) => `
      <button type="button" class="v4a-starter-chip" data-v4a-prompt="${root.Voice4AllUI.escapeHTML(s)}">
        ${root.Voice4AllUI.escapeHTML(s)}
      </button>
    `).join(' ');
  }

// =========================================================================
// Live Help Logic & Support Requests
// =========================================================================

async function handleSupportSubmit() {
  const topicEl = document.getElementById('v4a-help-topic');
  const urgencyEl = document.getElementById('v4a-help-urgency');
  const descEl = document.getElementById('v4a-help-desc');
  const modeEl = document.querySelector('input[name="v4a-help-mode"]:checked');
  const submitBtn = document.getElementById('v4a-submit-help-btn');

  if (!descEl || !descEl.value.trim()) {
    alert(root.Voice4AllUI.t('help_desc_placeholder', state.lang));
    if (descEl) descEl.focus();
    return;
  }

  const payload = {
    topic: topicEl ? topicEl.value : 'concept_clarification',
    urgency: urgencyEl ? urgencyEl.value : 'medium',
    preferred_mode: modeEl ? modeEl.value : 'chat',
    message: descEl.value.trim(),
    language: state.lang,
    context: { page: 'The Future of the VA Industry' }
  };

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <div class="v4a-spinner mb-0 me-2" style="width:14px; height:14px;" aria-hidden="true"></div>
        <span>${root.Voice4AllUI.t('submitting_btn', state.lang)}</span>
      `;
  }

  try {
    const res = await root.Voice4AllAPI.submitSupportRequest(payload);
    state.activeTicket = res;

    const ticketContainer = document.getElementById('v4a-ticket-container');
    if (ticketContainer) {
      ticketContainer.innerHTML = root.Voice4AllUI.renderTicketCard(res, state.lang);
    }

    // Reset form
    descEl.value = '';
    root.Voice4AllUI.announce(root.Voice4AllUI.t('announce_help_submitted', state.lang));
  } catch (err) {
    console.error('[Voice4All Help] Support request failed:', err);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
          <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
          <span>${root.Voice4AllUI.t('submit_help_btn', state.lang)}</span>
        `;
    }
  }
}

function cancelActiveTicket() {
  state.activeTicket = null;
  const ticketContainer = document.getElementById('v4a-ticket-container');
  if (ticketContainer) {
    ticketContainer.innerHTML = `
        <div class="v4a-empty-state">
          <i class="fa-regular fa-clipboard v4a-empty-icon" aria-hidden="true"></i>
          <p class="mb-0 fs-sm">${root.Voice4AllUI.t('request_cancelled_msg', state.lang)}</p>
        </div>
      `;
  }
  root.Voice4AllUI.announce(root.Voice4AllUI.t('request_cancelled_msg', state.lang));
}

// =========================================================================
// Career Logic & Accommodations
// =========================================================================

async function loadJobs() {
  const listEl = document.getElementById('v4a-job-list');
  if (!listEl) return;

  listEl.innerHTML = `
      <div class="v4a-loading-state" aria-busy="true">
        <div class="v4a-spinner" aria-hidden="true"></div>
        <span>${root.Voice4AllUI.t('loading_jobs', state.lang)}</span>
      </div>
    `;

  try {
    const res = await root.Voice4AllAPI.getJobs({
      query: state.searchQuery,
      filter: state.activeFilter,
      language: state.lang
    });

    if (!res.jobs || res.jobs.length === 0) {
      listEl.innerHTML = `
          <div class="v4a-empty-state">
            <i class="fa-solid fa-magnifying-glass v4a-empty-icon" aria-hidden="true"></i>
            <p class="mb-0 fs-sm">${root.Voice4AllUI.t('no_jobs', state.lang)}</p>
          </div>
        `;
      return;
    }

    listEl.innerHTML = res.jobs.map((job) => root.Voice4AllUI.renderJobCard(job, state.lang)).join(' ');
  } catch (err) {
    console.error('[Voice4All Career] Failed to load jobs:', err);
    listEl.innerHTML = `
        <div class="v4a-error-state">
          <i class="fa-solid fa-triangle-exclamation v4a-error-icon" aria-hidden="true"></i>
          <p class="mb-0 fs-sm">${root.Voice4AllUI.t('jobs_error', state.lang)}</p>
        </div>
      `;
  }
}

function openAccommodationPanel(jobId, jobTitle) {
  const container = document.getElementById('v4a-acc-container');
  if (!container) return;

  container.innerHTML = root.Voice4AllUI.renderAccommodationPanel(jobId, jobTitle, state.lang);
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const notesInput = document.getElementById('v4a-acc-notes');
  if (notesInput) notesInput.focus();
}

function closeAccommodationPanel() {
  const container = document.getElementById('v4a-acc-container');
  if (container) {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

async function handleAccommodationSubmit() {
  const jobId = document.getElementById('v4a-acc-job-id')?.value || 'general';
  const jobTitle = document.getElementById('v4a-acc-job-title')?.value || 'General Position';
  const notes = document.getElementById('v4a-acc-notes')?.value || '';
  const email = document.getElementById('v4a-acc-email')?.value || '';
  const submitBtn = document.getElementById('v4a-acc-submit-btn');

  const checkboxes = document.querySelectorAll('input[name="v4a-acc-types"]:checked');
  const selectedAccommodations = Array.from(checkboxes).map((c) => c.value);

  if (!email.trim()) {
    alert(root.Voice4AllUI.t('acc_email_label', state.lang));
    document.getElementById('v4a-acc-email')?.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <div class="v4a-spinner mb-0 me-2" style="width:14px; height:14px;" aria-hidden="true"></div>
        <span>${root.Voice4AllUI.t('acc_submitting', state.lang)}</span>
      `;
  }

  try {
    const res = await root.Voice4AllAPI.submitAccommodationRequest({
      job_id: jobId,
      job_title: jobTitle,
      accommodations: selectedAccommodations,
      details: notes,
      contact_email: email,
      language: state.lang
    });

    const container = document.getElementById('v4a-acc-container');
    if (container) {
      container.innerHTML = `
          <div class="v4a-acc-panel" style="border-color:#10b981; background:#ecfdf5;">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <strong class="text-success fs-sm">
                <i class="fa-solid fa-circle-check me-1" aria-hidden="true"></i>
                ${root.Voice4AllUI.t('acc_success_msg', state.lang)} ${root.Voice4AllUI.escapeHTML(res.request_id)}
              </strong>
              <button type="button" class="v4a-btn-close" id="v4a-close-acc-btn" aria-label="Close">
                <i class="fa-solid fa-xmark text-dark" aria-hidden="true"></i>
              </button>
            </div>
            <p class="mb-0 fs-xs text-muted">${root.Voice4AllUI.escapeHTML(res.message)}</p>
          </div>
        `;
    }

    root.Voice4AllUI.announce(root.Voice4AllUI.t('announce_acc_submitted', state.lang));
  } catch (err) {
    console.error('[Voice4All Accommodation] Submission failed:', err);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// =========================================================================
// Global Event Delegation & Bindings
// =========================================================================

function bindEvents() {
  // Delegated click handlers
  document.addEventListener('click', (event) => {
  const welcomeEnable = event.target.closest('#v4a-voice-welcome-enable');
  if (welcomeEnable) {
    event.preventDefault();
    completeVoiceWelcome(true);
    return;
  }

  const welcomeDecline = event.target.closest('#v4a-voice-welcome-decline');
  if (welcomeDecline) {
    event.preventDefault();
    completeVoiceWelcome(false);
    return;
  }

  const playWelcome = event.target.closest('#v4a-voice-welcome-play');
  if (playWelcome) {
    event.preventDefault();
    updateWelcomePromptStatus('voice_welcome_playing');
    speakText(root.Voice4AllUI.t('voice_welcome_message', state.voiceSettings.language), null, {
      language: state.voiceSettings.language,
      onEnd: () => updateWelcomePromptStatus('voice_welcome_finished'),
      onAutoplayBlocked: () => updateWelcomePromptStatus('voice_autoplay_blocked', true),
      onError: () => updateWelcomePromptStatus('voice_welcome_unavailable', true)
    });
    return;
  }

  const voiceToggle = event.target.closest('#v4a-voice-guidance-toggle');
  if (voiceToggle) {
    event.preventDefault();
    setVoiceGuidance(!state.voiceSettings.enabled);
    return;
  }

  const testVoice = event.target.closest('#v4a-voice-test');
  if (testVoice) {
    event.preventDefault();
    speakText(root.Voice4AllUI.t('voice_test_text', state.voiceSettings.language), testVoice);
    return;
  }

  const readPage = event.target.closest('#v4a-read-current-page');
  if (readPage) {
    event.preventDefault();
    readCurrentPage(readPage);
    return;
  }

  if (event.target.closest('#v4a-voice-pause')) {
    event.preventDefault();
    pauseSpeaking();
    return;
  }

  if (event.target.closest('#v4a-voice-resume')) {
    event.preventDefault();
    resumeSpeaking();
    return;
  }

  if (event.target.closest('#v4a-voice-stop')) {
    event.preventDefault();
    stopSpeaking();
    return;
  }

  if (event.target.closest('#v4a-voice-repeat')) {
    event.preventDefault();
    repeatSpeaking();
    return;
  }

  const resetVoiceSettings = event.target.closest('#v4a-voice-reset');
  if (resetVoiceSettings) {
    event.preventDefault();
    stopSpeaking();
    state.voiceSettings = {
      ...DEFAULT_VOICE_SETTINGS,
      welcomeCompleted: state.voiceSettings.welcomeCompleted,
      language: state.lang
    };
    saveVoiceSettings();
    updateVoiceSettingsControls();
    root.Voice4AllUI.announce(root.Voice4AllUI.t('voice_settings_reset', state.lang));
    return;
  }

    // 1. Open drawer from floating launcher
    const launcher = event.target.closest('#v4a-launcher-btn');
    if (launcher) {
      event.preventDefault();
      openDrawer();
      return;
    }

    // 2. Close drawer
    const closeBtn = event.target.closest('#v4a-close-btn');
    const backdrop = event.target.closest('#v4a-backdrop');
    if (closeBtn || backdrop) {
      event.preventDefault();
      closeDrawer();
      return;
    }

    // 3. Tab switching
    const tab = event.target.closest('.v4a-tab');
    if (tab) {
      event.preventDefault();
      const tabName = tab.getAttribute('id').replace('v4a-tab-', '');
      switchTab(tabName, true);
      return;
    }

    // 4. Language switcher
    const langBtn = event.target.closest('.v4a-lang-btn');
    if (langBtn) {
      event.preventDefault();
      const lang = langBtn.getAttribute('data-v4a-lang');
      setLanguage(lang);
      return;
    }

    // 5. Voice Input Toggle
    const voiceBtn = event.target.closest('#v4a-voice-toggle-btn');
    if (voiceBtn) {
      event.preventDefault();
      toggleVoiceInput();
      return;
    }

    // 6. Starter prompt clicks
    const starter = event.target.closest('.v4a-starter-chip');
    if (starter) {
      event.preventDefault();
      const prompt = starter.getAttribute('data-v4a-prompt');
      submitTutorMessage(prompt);
      return;
    }

    // 7. TTS read aloud button
    const ttsBtn = event.target.closest('.v4a-tts-btn');
    if (ttsBtn) {
      event.preventDefault();
      if (
        state.currentSpeechButton === ttsBtn
          && (state.speechStatus === 'loading' || state.speechStatus === 'playing' || state.speechStatus === 'paused')
      ) {
        stopSpeaking();
        return;
      }
      const text = ttsBtn.getAttribute('data-v4a-speech-text');
      speakText(text, ttsBtn);
      return;
    }

    // 8. Career Filter buttons
    const filterBtn = event.target.closest('.v4a-filter-btn');
    if (filterBtn) {
      event.preventDefault();
      document.querySelectorAll('.v4a-filter-btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      filterBtn.setAttribute('aria-pressed', 'true');
      state.activeFilter = filterBtn.getAttribute('data-v4a-filter');
      loadJobs();
      return;
    }

    // 9. Career "Request Accommodation" button on job card
    const accBtn = event.target.closest('.v4a-btn-acc');
    if (accBtn) {
      event.preventDefault();
      const jobId = accBtn.getAttribute('data-job-id');
      const jobTitle = accBtn.getAttribute('data-job-title');
      openAccommodationPanel(jobId, jobTitle);
      return;
    }

    // 10. Close Accommodation Panel
    const closeAccBtn = event.target.closest('#v4a-close-acc-btn') || event.target.closest('#v4a-acc-cancel-btn');
    if (closeAccBtn) {
      event.preventDefault();
      closeAccommodationPanel();
      return;
    }

    // 11. Career Apply button
    const applyBtn = event.target.closest('.v4a-btn-apply');
    if (applyBtn) {
      event.preventDefault();
      const title = applyBtn.getAttribute('data-job-title');
      alert(`${root.Voice4AllUI.t('apply_btn', state.lang)}: ${title}\n\n${state.lang === 'am' ? 'የማመልከቻ ቅጹ በአዲስ መስኮት ይከፈታል።' : 'Application workflow opened for inclusive review.'}`);
      return;
    }

    // 12. Cancel active support ticket
    const cancelTicketBtn = event.target.closest('#v4a-cancel-ticket-btn');
    if (cancelTicketBtn) {
      event.preventDefault();
      cancelActiveTicket();
      return;
    }

    // 13. Clear Tutor Conversation History
    const clearBtn = event.target.closest('#v4a-clear-chat-btn');
    if (clearBtn) {
      event.preventDefault();
      if (confirm(root.Voice4AllUI.t('clear_confirm', state.lang))) {
        clearChatHistory();
      }
      return;
    }

    // 14. Retry Failed Tutor Request
    const retryBtn = event.target.closest('.v4a-btn-retry');
    if (retryBtn) {
      event.preventDefault();
      if (state.lastUserMessage) {
        submitTutorMessage(state.lastUserMessage);
      }
      return;
    }

    // 15. Retry Network / Offline Reconnection
    const retryNetBtn = event.target.closest('#v4a-retry-network-btn');
    if (retryNetBtn) {
      event.preventDefault();
      const isAm = (state.lang === 'am');
      root.Voice4AllUI.announce(isAm ? 'ግንኙነትን እንደገና በመሞከር ላይ...' : 'Retrying network connection...');
      loadJobs();
      return;
    }
  });

  // Delegated change handlers
  document.addEventListener('change', (event) => {
    if (event.target.id === 'v4a-voice-guidance-enabled') {
      setVoiceGuidance(event.target.checked);
      return;
    }
    if (event.target.id === 'v4a-voice-language') {
      updateVoiceSetting('language', event.target.value);
      return;
    }
    if (event.target.id === 'v4a-voice-selection') {
      updateVoiceSetting('voice', event.target.value);
      return;
    }
    if (event.target.id === 'v4a-auto-announcements') {
      updateVoiceSetting('autoAnnouncePages', event.target.checked);
      if (event.target.checked && state.voiceSettings.enabled) {
        state.lastPageAnnouncement = '';
        announceCurrentPage();
      }
      return;
    }
    if (event.target.id === 'v4a-auto-read-learning') {
      updateVoiceSetting('autoReadLearning', event.target.checked);
      if (event.target.checked && state.voiceSettings.enabled && isLearningPage()) {
        readCurrentPage();
      }
      return;
    }
    if (event.target.id === 'v4a-voice-rate') {
      updateVoiceSetting('rate', event.target.value);
      return;
    }

    if (event.target.id === 'v4a-simple-mode-toggle') {
      state.simpleMode = event.target.checked;
      try {
        sessionStorage.setItem(SESSION_SIMPLE_MODE_KEY, String(state.simpleMode));
      } catch (e) { }

      const drawer = document.getElementById('v4a-drawer');
      if (drawer) {
        if (state.simpleMode) {
          drawer.classList.add('v4a-simple-mode');
        } else {
          drawer.classList.remove('v4a-simple-mode');
        }
      }

      const msg = state.simpleMode
        ? root.Voice4AllUI.t('announce_simple_mode_on', state.lang)
        : root.Voice4AllUI.t('announce_simple_mode_off', state.lang);
      root.Voice4AllUI.announce(msg);
    }
  });

  // Global Accesskey / Shortcut: Alt + V to toggle Voice4All
  document.addEventListener('keydown', (event) => {
    if (event.altKey && (event.key === 'v' || event.key === 'V')) {
      event.preventDefault();
      if (state.drawerOpen) closeDrawer();
      else openDrawer();
    }
  });

  // Delegated submit handlers
  document.addEventListener('submit', (event) => {
    // Tutor Form Submit
    if (event.target.id === 'v4a-tutor-form') {
      event.preventDefault();
      const input = document.getElementById('v4a-tutor-input');
      if (input && input.value.trim()) {
        submitTutorMessage(input.value.trim());
      }
      return;
    }

    // Support Help Form Submit
    if (event.target.id === 'v4a-help-form') {
      event.preventDefault();
      handleSupportSubmit();
      return;
    }

    // Accommodation Form Submit
    if (event.target.id === 'v4a-acc-form') {
      event.preventDefault();
      handleAccommodationSubmit();
      return;
    }
  });

  // Tab keyboard navigation listeners
  ['tutor', 'help', 'career'].forEach((name) => {
    const tabEl = document.getElementById(`v4a-tab-${name}`);
    if (tabEl) tabEl.addEventListener('keydown', handleTabKeydown);
  });

  // Job search input debounced handler
  let searchTimer = null;
  document.addEventListener('input', (event) => {
    if (event.target.id === 'v4a-voice-rate') {
      updateVoiceSetting('rate', event.target.value);
      return;
    }
    if (event.target.id === 'v4a-job-search') {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.searchQuery = event.target.value.trim();
        loadJobs();
      }, 300);
    }
  });
}

// Auto-boot on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose for inspection and programmatic testing
root.Voice4All = {
  state,
  init,
  openDrawer,
  closeDrawer,
  switchTab,
  setLanguage,
  submitTutorMessage,
  clearChatHistory,
  handleSupportSubmit,
  handleAccommodationSubmit,
  loadJobs
};
}) (typeof window !== 'undefined' ? window : this);
