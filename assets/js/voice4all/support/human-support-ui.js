/**
 * Voice4All — Human Support Page UI Controller
 * File: assets/js/voice4all/support/human-support-ui.js
 *
 * Uses the existing Voice4AllSupportClient (support-client.js) as the API service layer.
 * Does NOT invent or duplicate backend endpoints.
 *
 * Manages:
 *  - View states: landing → form → tracking → resolved
 *  - Form validation and submission
 *  - Live ticket status polling
 *  - Message thread updates
 *  - FAQ accordion with search
 *  - Cancel / stop sharing controls
 *  - Accessible announcements
 */

(function (root) {
  'use strict';

  // ── View State Constants ──
  var VIEW = {
    LANDING: 'landing',
    FORM: 'form',
    TRACKING: 'tracking',
    RESOLVED: 'resolved'
  };

  // ── i18n strings ──
  var STRINGS = {
    en: {
      page_title: 'Human Support',
      page_desc: 'Get help from a course mentor, peer coach, or accessibility specialist.',
      option_chat: 'Text Chat',
      option_chat_desc: 'Message a support specialist in real time.',
      option_screen: 'Screen Share',
      option_screen_desc: 'Share your screen with explicit consent for guided help.',
      option_faq: 'Browse FAQs',
      option_faq_desc: 'Find answers to common questions.',
      form_title: 'Submit a Support Request',
      label_topic: 'Assistance Topic',
      label_message: 'Describe Your Issue',
      label_urgency: 'Urgency Level',
      label_mode: 'Preferred Channel',
      label_consent: 'I consent to sharing my screen with the support specialist.',
      topic_concept: 'Lesson Concept Clarification',
      topic_quiz: 'Quiz or Assignment Assistance',
      topic_tech: 'Platform or Technical Issue',
      topic_accessibility: 'Accessibility Accommodation Need',
      topic_general: 'General Course Assistance',
      urgency_low: 'Low — Not time-sensitive',
      urgency_medium: 'Medium — Needs attention soon',
      urgency_high: 'High — Blocking my progress',
      mode_chat: 'Text Chat',
      mode_screen: 'Screen Share (requires consent)',
      btn_submit: 'Submit Support Request',
      btn_submitting: 'Submitting…',
      btn_cancel: 'Cancel Request',
      btn_new: 'New Support Request',
      btn_send: 'Send',
      err_message_required: 'Please describe your issue.',
      err_message_short: 'Please provide at least 10 characters.',
      err_consent_required: 'Screen share requires your explicit consent.',
      err_submit_failed: 'Could not submit your request. Please try again.',
      err_network: 'Network error. Please check your connection and try again.',
      success_submitted: 'Your support request has been submitted.',
      status_queued: 'Waiting in queue',
      status_agent_connected: 'Connected to a support specialist',
      status_resolved: 'Issue resolved',
      status_cancelled: 'Request cancelled',
      meta_ticket_id: 'Ticket ID',
      meta_position: 'Queue Position',
      meta_wait: 'Est. Wait',
      meta_agent: 'Support Agent',
      meta_minutes: 'min',
      msg_placeholder: 'Type your message…',
      faq_title: 'Frequently Asked Questions',
      faq_search: 'Search FAQs…',
      faq_empty: 'No FAQs match your search.',
      faq_loading: 'Loading FAQs…',
      cancelled_msg: 'Your support request has been cancelled.',
      resolved_msg: 'Your issue has been resolved. Thank you!',
      announce_submitted: 'Support request submitted. You are now in the queue.',
      announce_connected: 'A support specialist has connected.',
      announce_resolved: 'Your support ticket has been resolved.',
      announce_cancelled: 'Your support request has been cancelled.',
      announce_message: 'New message received.'
    },
    am: {
      page_title: 'የሰው ድጋፍ',
      page_desc: 'ከኮርስ አማካሪ፣ የእኩያ አሰልጣኝ ወይም የተደራሽነት ስፔሻሊስት እርዳታ ያግኙ።',
      option_chat: 'የጽሑፍ ውይይት',
      option_chat_desc: 'በእውነተኛ ጊዜ ከድጋፍ ስፔሻሊስት ጋር መልእክት ይላኩ።',
      option_screen: 'ስክሪን ማጋራት',
      option_screen_desc: 'ለመመሪያ እርዳታ በግልጽ ፈቃድ ስክሪንዎን ያጋሩ።',
      option_faq: 'ተዘውትረው የሚጠየቁ ጥያቄዎች',
      option_faq_desc: 'ለተለመዱ ጥያቄዎች መልሶችን ያግኙ።',
      form_title: 'የድጋፍ ጥያቄ ያስገቡ',
      label_topic: 'የእርዳታ ርዕስ',
      label_message: 'ችግርዎን ይግለጹ',
      label_urgency: 'የአስቸኳይነት ደረጃ',
      label_mode: 'የሚመርጡት ቻናል',
      label_consent: 'ስክሪኔን ከድጋፍ ስፔሻሊስቱ ጋር ለማጋራት እፈቅዳለሁ።',
      btn_submit: 'የድጋፍ ጥያቄ ያስገቡ',
      btn_submitting: 'በማስገባት ላይ…',
      btn_cancel: 'ጥያቄ ሰርዝ',
      btn_new: 'አዲስ የድጋፍ ጥያቄ',
      btn_send: 'ላክ',
      err_message_required: 'እባክዎ ችግርዎን ይግለጹ።',
      err_message_short: 'እባክዎ ቢያንስ 10 ቁምፊዎችን ያቅርቡ።',
      err_consent_required: 'ስክሪን ማጋራት ግልጽ ፈቃድዎን ይፈልጋል።',
      err_submit_failed: 'ጥያቄዎን ማስገባት አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
      success_submitted: 'የድጋፍ ጥያቄዎ ገብቷል።',
      status_queued: 'በወረፋ ውስጥ በመጠበቅ ላይ',
      status_agent_connected: 'ከድጋፍ ስፔሻሊስት ጋር ተገናኝቷል',
      status_resolved: 'ጉዳይ ተፈትቷል',
      status_cancelled: 'ጥያቄ ተሰርዟል',
      faq_title: 'ተዘውትረው የሚጠየቁ ጥያቄዎች',
      faq_search: 'ጥያቄዎችን ይፈልጉ…',
      announce_submitted: 'የድጋፍ ጥያቄ ገብቷል። አሁን በወረፋ ውስጥ ነዎት።',
      announce_connected: 'የድጋፍ ስፔሻሊስት ተገናኝቷል።',
      announce_resolved: 'የድጋፍ ቲኬትዎ ተፈትቷል።',
      announce_cancelled: 'የድጋፍ ጥያቄዎ ተሰርዟል።',
      announce_message: 'አዲስ መልእክት ተቀብሏል።'
    }
  };

  // ── State ──
  var state = {
    view: VIEW.LANDING,
    lang: 'en',
    ticket: null,
    requestId: null,
    isSubmitting: false,
    faqs: [],
    faqsLoaded: false,
    lastMessageCount: 0
  };

  // ── Helpers ──
  function t(key) {
    var dict = STRINGS[state.lang] || STRINGS.en;
    return dict[key] || STRINGS.en[key] || key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function announce(msg) {
    var el = $('v4a-hs-announcer');
    if (el) {
      el.textContent = '';
      // Force screen reader re-announce
      setTimeout(function () { el.textContent = msg; }, 100);
    }
  }

  function showAlert(type, msg) {
    var el = $('v4a-hs-alert');
    if (!el) return;
    el.className = 'v4a-hs-alert v4a-hs-alert-' + type + ' v4a-hs-visible';
    var icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    el.innerHTML =
      '<span class="v4a-hs-alert-icon" aria-hidden="true">' + (icons[type] || '') + '</span>' +
      '<span class="v4a-hs-alert-body">' + escapeHtml(msg) + '</span>';
    el.setAttribute('role', 'alert');
    el.focus();
  }

  function hideAlert() {
    var el = $('v4a-hs-alert');
    if (el) {
      el.className = 'v4a-hs-alert';
      el.removeAttribute('role');
      el.innerHTML = '';
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  // ── Client reference ──
  function getClient() {
    return root.Voice4AllSupportClient || null;
  }

  // ── View Management ──
  function showView(view) {
    state.view = view;
    var sections = ['v4a-hs-landing', 'v4a-hs-form-section', 'v4a-hs-tracker'];
    sections.forEach(function (id) {
      var el = $(id);
      if (el) el.style.display = 'none';
    });

    if (view === VIEW.LANDING) {
      var el = $('v4a-hs-landing');
      if (el) el.style.display = 'block';
    } else if (view === VIEW.FORM) {
      var el = $('v4a-hs-form-section');
      if (el) el.style.display = 'block';
      // Focus the first form field
      setTimeout(function () {
        var first = $('v4a-hs-topic');
        if (first) first.focus();
      }, 200);
    } else if (view === VIEW.TRACKING || view === VIEW.RESOLVED) {
      var el = $('v4a-hs-tracker');
      if (el) {
        el.style.display = 'block';
        el.classList.add('v4a-hs-visible');
      }
    }
  }

  // ── Form Validation ──
  function validateForm() {
    var valid = true;
    clearFieldErrors();

    var message = $('v4a-hs-message');
    if (!message) return false;
    var val = message.value.trim();

    if (!val) {
      showFieldError('v4a-hs-message', 'v4a-hs-message-error', t('err_message_required'));
      valid = false;
    } else if (val.length < 10) {
      showFieldError('v4a-hs-message', 'v4a-hs-message-error', t('err_message_short'));
      valid = false;
    }

    var mode = $('v4a-hs-mode');
    if (mode && mode.value === 'screen_share') {
      var consent = $('v4a-hs-consent');
      if (consent && !consent.checked) {
        showFieldError('v4a-hs-consent', 'v4a-hs-consent-error', t('err_consent_required'));
        valid = false;
      }
    }

    return valid;
  }

  function showFieldError(fieldId, errorId, msg) {
    var field = $(fieldId);
    var err = $(errorId);
    if (field) field.setAttribute('aria-invalid', 'true');
    if (err) {
      err.textContent = msg;
      err.setAttribute('aria-live', 'assertive');
    }
  }

  function clearFieldErrors() {
    var fields = document.querySelectorAll('[aria-invalid]');
    for (var i = 0; i < fields.length; i++) {
      fields[i].removeAttribute('aria-invalid');
    }
    var errs = document.querySelectorAll('.v4a-hs-error-msg');
    for (var j = 0; j < errs.length; j++) {
      errs[j].textContent = '';
      errs[j].removeAttribute('aria-live');
    }
  }

  // ── Submit ──
  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (state.isSubmitting) return;

    hideAlert();
    if (!validateForm()) return;

    var client = getClient();
    var topic = $('v4a-hs-topic');
    var message = $('v4a-hs-message');
    var urgency = $('v4a-hs-urgency');
    var mode = $('v4a-hs-mode');
    var consent = $('v4a-hs-consent');
    var submitBtn = $('v4a-hs-submit-btn');

    var isScreenShare = mode && mode.value === 'screen_share';
    var payload = {
      topic: topic ? topic.value : 'General Course Assistance',
      message: message ? message.value.trim() : '',
      urgency: urgency ? urgency.value : 'medium',
      preferred_mode: mode ? mode.value : 'chat',
      language: state.lang,
      consent: {
        screenShareRequested: isScreenShare,
        screenShareConsent: isScreenShare && consent ? consent.checked : false,
        contextSharingConsent: true
      }
    };

    state.isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="v4a-hs-spinner" aria-hidden="true"></span> ' + t('btn_submitting');
    }

    try {
      if (client) {
        var result = await client.submitRequest(payload);
        state.requestId = result.requestId || result.request_id;
        state.ticket = result.ticket || result;
        state.lastMessageCount = (state.ticket.messages || []).length;
      } else {
        // Fallback: direct API call
        var res = await fetch('/api/support/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Submission failed');
        state.requestId = data.requestId || data.request_id;
        state.ticket = data.ticket || data;
        state.lastMessageCount = (state.ticket.messages || []).length;
      }

      showAlert('success', t('success_submitted'));
      announce(t('announce_submitted'));
      renderTracker();
      showView(VIEW.TRACKING);
      startPolling();
    } catch (err) {
      var msg = err.message || t('err_submit_failed');
      if (err.name === 'AbortError' || err.message === 'Failed to fetch') {
        msg = t('err_network');
      }
      showAlert('error', msg);
      announce(msg);
    } finally {
      state.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = t('btn_submit');
      }
    }
  }

  // ── Polling ──
  function startPolling() {
    var client = getClient();
    if (!state.requestId) return;

    if (client) {
      client.startStatusPolling(state.requestId, function (ticket) {
        var prev = state.ticket;
        state.ticket = ticket;
        renderTracker();

        // Announce agent connection
        if (!prev.humanConnected && ticket.humanConnected) {
          announce(t('announce_connected'));
        }

        // Announce new messages
        var msgCount = (ticket.messages || []).length;
        if (msgCount > state.lastMessageCount) {
          announce(t('announce_message'));
          state.lastMessageCount = msgCount;
        }

        // Stop polling on resolved/cancelled
        if (ticket.status === 'resolved' || ticket.status === 'cancelled') {
          stopPolling();
          if (ticket.status === 'resolved') {
            showAlert('success', t('resolved_msg'));
            announce(t('announce_resolved'));
          }
        }
      }, 3000);
    } else {
      // Fallback manual polling
      state._pollId = setInterval(async function () {
        try {
          var res = await fetch('/api/support/requests/' + state.requestId);
          var data = await res.json();
          if (data.success) {
            var prev = state.ticket;
            state.ticket = data.ticket || data;
            renderTracker();
            if (!prev.humanConnected && state.ticket.humanConnected) {
              announce(t('announce_connected'));
            }
            if (state.ticket.status === 'resolved' || state.ticket.status === 'cancelled') {
              stopPolling();
            }
          }
        } catch (e) { /* silent */ }
      }, 3000);
    }
  }

  function stopPolling() {
    var client = getClient();
    if (client) client.stopStatusPolling();
    if (state._pollId) {
      clearInterval(state._pollId);
      state._pollId = null;
    }
  }

  // ── Render Tracker ──
  function renderTracker() {
    var ticket = state.ticket;
    if (!ticket) return;

    // Status bar
    var statusBar = $('v4a-hs-status-bar');
    var statusDot = $('v4a-hs-status-dot');
    var statusText = $('v4a-hs-status-text');

    if (statusBar && statusDot && statusText) {
      statusBar.className = 'v4a-hs-status-bar';
      statusDot.className = 'v4a-hs-status-dot';

      if (ticket.status === 'agent_connected' || ticket.humanConnected) {
        statusBar.classList.add('v4a-hs-connected');
        statusDot.classList.add('v4a-hs-status-dot-connected');
        statusText.textContent = t('status_agent_connected') +
          (ticket.agentName ? ' — ' + ticket.agentName : '');
      } else if (ticket.status === 'resolved') {
        statusBar.classList.add('v4a-hs-resolved');
        statusDot.classList.add('v4a-hs-status-dot-resolved');
        statusText.textContent = t('status_resolved');
      } else if (ticket.status === 'cancelled') {
        statusBar.classList.add('v4a-hs-resolved');
        statusDot.classList.add('v4a-hs-status-dot-resolved');
        statusText.textContent = t('status_cancelled');
      } else {
        statusDot.classList.add('v4a-hs-status-dot-waiting');
        statusText.textContent = t('status_queued');
      }
    }

    // Meta grid
    setMeta('v4a-hs-meta-id', ticket.requestId || ticket.request_id || '—');
    setMeta('v4a-hs-meta-position', ticket.queuePosition > 0 ? '#' + ticket.queuePosition : '—');
    setMeta('v4a-hs-meta-wait', ticket.estimatedWaitMinutes ? ticket.estimatedWaitMinutes + ' ' + t('meta_minutes') : '—');
    setMeta('v4a-hs-meta-agent', ticket.agentName || '—');

    // Messages
    renderMessages(ticket.messages || []);

    // Show/hide actions
    var cancelBtn = $('v4a-hs-cancel-btn');
    var newBtn = $('v4a-hs-new-btn');
    var msgRow = $('v4a-hs-msg-row');

    var isActive = ticket.status === 'queued' || ticket.status === 'in_review' || ticket.status === 'agent_connected';

    if (cancelBtn) cancelBtn.style.display = isActive ? 'inline-flex' : 'none';
    if (newBtn) newBtn.style.display = !isActive ? 'inline-flex' : 'none';
    if (msgRow) msgRow.style.display = ticket.humanConnected ? 'flex' : 'none';
  }

  function setMeta(id, val) {
    var el = $(id);
    if (el) el.textContent = val;
  }

  function renderMessages(messages) {
    var container = $('v4a-hs-messages');
    if (!container) return;

    var html = '';
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      var cls = 'v4a-hs-msg ';
      if (m.sender === 'agent') cls += 'v4a-hs-msg-agent';
      else if (m.sender === 'system') cls += 'v4a-hs-msg-system';
      else cls += 'v4a-hs-msg-learner';

      html += '<div class="' + cls + '" role="log">' +
        '<div class="v4a-hs-msg-sender">' + escapeHtml(m.senderName || m.sender) + '</div>' +
        '<div>' + escapeHtml(m.text) + '</div>' +
        '<div class="v4a-hs-msg-time">' + formatTime(m.timestamp) + '</div>' +
        '</div>';
    }
    container.innerHTML = html;

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  // ── Send Message ──
  async function handleSendMessage() {
    var input = $('v4a-hs-msg-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text || !state.requestId) return;

    var sendBtn = $('v4a-hs-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    try {
      var client = getClient();
      if (client) {
        await client.sendMessage(state.requestId, text);
      } else {
        await fetch('/api/support/requests/' + state.requestId + '/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: 'learner', senderName: 'Learner', text: text })
        });
      }
      input.value = '';
      input.focus();
    } catch (err) {
      showAlert('error', 'Could not send message. ' + (err.message || ''));
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  // ── Cancel Ticket ──
  async function handleCancel() {
    if (!state.requestId) return;

    var cancelBtn = $('v4a-hs-cancel-btn');
    if (cancelBtn) cancelBtn.disabled = true;

    try {
      var client = getClient();
      if (client) {
        await client.cancelRequest(state.requestId);
      } else {
        await fetch('/api/support/requests/' + state.requestId + '/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Cancelled by learner' })
        });
      }
      stopPolling();
      showAlert('info', t('cancelled_msg'));
      announce(t('announce_cancelled'));
      state.ticket.status = 'cancelled';
      renderTracker();
    } catch (err) {
      showAlert('error', 'Could not cancel: ' + (err.message || ''));
    } finally {
      if (cancelBtn) cancelBtn.disabled = false;
    }
  }

  // ── New Request ──
  function handleNewRequest() {
    state.ticket = null;
    state.requestId = null;
    state.lastMessageCount = 0;
    hideAlert();
    clearFieldErrors();

    var form = $('v4a-hs-form');
    if (form) form.reset();

    var tracker = $('v4a-hs-tracker');
    if (tracker) tracker.classList.remove('v4a-hs-visible');

    toggleConsentField();
    showView(VIEW.FORM);
  }

  // ── FAQ ──
  async function loadFaqs() {
    var container = $('v4a-hs-faq-list');
    if (!container) return;

    container.innerHTML = '<div class="v4a-hs-skeleton v4a-hs-skeleton-lg"></div>' +
      '<div class="v4a-hs-skeleton v4a-hs-skeleton-lg"></div>' +
      '<div class="v4a-hs-skeleton v4a-hs-skeleton-lg"></div>';

    try {
      var res = await fetch('/api/support/faqs');
      var data = await res.json();
      state.faqs = data.faqs || data || [];
      state.faqsLoaded = true;
      renderFaqs(state.faqs);
    } catch (err) {
      // FAQs are non-critical — show empty state
      state.faqs = [];
      state.faqsLoaded = true;
      container.innerHTML = '<p class="v4a-hs-card-desc" style="text-align:center;padding:16px;">' +
        'FAQs could not be loaded. You can still submit a support request.</p>';
    }
  }

  function renderFaqs(faqs) {
    var container = $('v4a-hs-faq-list');
    if (!container) return;

    if (!faqs || faqs.length === 0) {
      container.innerHTML = '<p class="v4a-hs-card-desc" style="text-align:center;padding:16px;">' + t('faq_empty') + '</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < faqs.length; i++) {
      var faq = faqs[i];
      var qId = 'v4a-hs-faq-q-' + i;
      var aId = 'v4a-hs-faq-a-' + i;
      html += '<div class="v4a-hs-faq-item">' +
        '<button class="v4a-hs-faq-btn" id="' + qId + '" ' +
        'aria-expanded="false" aria-controls="' + aId + '" ' +
        'type="button">' +
        '<span>' + escapeHtml(faq.question || faq.q || '') + '</span>' +
        '<span class="v4a-hs-faq-chevron" aria-hidden="true">▼</span>' +
        '</button>' +
        '<div class="v4a-hs-faq-answer" id="' + aId + '" role="region" aria-labelledby="' + qId + '">' +
        escapeHtml(faq.answer || faq.a || '') +
        '</div>' +
        '</div>';
    }
    container.innerHTML = html;

    // Bind accordion clicks
    var buttons = container.querySelectorAll('.v4a-hs-faq-btn');
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].addEventListener('click', toggleFaq);
    }
  }

  function toggleFaq(e) {
    var btn = e.currentTarget;
    var expanded = btn.getAttribute('aria-expanded') === 'true';
    var panelId = btn.getAttribute('aria-controls');
    var panel = $(panelId);

    btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    if (panel) {
      panel.classList.toggle('v4a-hs-visible', !expanded);
    }
  }

  function filterFaqs() {
    var input = $('v4a-hs-faq-search-input');
    if (!input || !state.faqsLoaded) return;

    var term = input.value.trim().toLowerCase();
    if (!term) {
      renderFaqs(state.faqs);
      return;
    }

    var filtered = state.faqs.filter(function (f) {
      var q = (f.question || f.q || '').toLowerCase();
      var a = (f.answer || f.a || '').toLowerCase();
      return q.indexOf(term) !== -1 || a.indexOf(term) !== -1;
    });
    renderFaqs(filtered);
  }

  // ── Consent field toggle ──
  function toggleConsentField() {
    var mode = $('v4a-hs-mode');
    var consentGroup = $('v4a-hs-consent-group');
    if (mode && consentGroup) {
      consentGroup.style.display = mode.value === 'screen_share' ? 'flex' : 'none';
    }
  }

  // ── Language Toggle ──
  function setLanguage(lang) {
    state.lang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'am' ? 'rtl' : 'ltr';

    // Update all elements with data-i18n attribute
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-i18n');
      var isPlaceholder = els[i].getAttribute('data-i18n-attr') === 'placeholder';
      if (isPlaceholder) {
        els[i].placeholder = t(key);
      } else {
        els[i].textContent = t(key);
      }
    }
  }

  // ── Init ──
  function init() {
    // Form submit
    var form = $('v4a-hs-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        handleSubmit(e);
      });
    }

    // Mode change → show/hide consent
    var mode = $('v4a-hs-mode');
    if (mode) {
      mode.addEventListener('change', toggleConsentField);
      toggleConsentField();
    }

    // "Request Help" button on landing
    var requestBtn = $('v4a-hs-request-btn');
    if (requestBtn) {
      requestBtn.addEventListener('click', function () {
        showView(VIEW.FORM);
      });
    }

    // Cancel button
    var cancelBtn = $('v4a-hs-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', handleCancel);
    }

    // New request button
    var newBtn = $('v4a-hs-new-btn');
    if (newBtn) {
      newBtn.addEventListener('click', handleNewRequest);
    }

    // Send message
    var sendBtn = $('v4a-hs-send-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', handleSendMessage);
    }

    // Enter to send message
    var msgInput = $('v4a-hs-msg-input');
    if (msgInput) {
      msgInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      });
    }

    // FAQ search with debounce
    var faqSearch = $('v4a-hs-faq-search-input');
    if (faqSearch) {
      var debounce = null;
      faqSearch.addEventListener('input', function () {
        clearTimeout(debounce);
        debounce = setTimeout(filterFaqs, 300);
      });
    }

    // Language toggle buttons
    var langBtns = document.querySelectorAll('[data-lang]');
    for (var i = 0; i < langBtns.length; i++) {
      langBtns[i].addEventListener('click', function (e) {
        var lang = e.currentTarget.getAttribute('data-lang');
        setLanguage(lang);
      });
    }

    // Back-to-form link from tracker
    var backForm = $('v4a-hs-back-form');
    if (backForm) {
      backForm.addEventListener('click', function (e) {
        e.preventDefault();
        showView(VIEW.LANDING);
      });
    }

    // Load FAQs
    loadFaqs();

    // Start on landing view
    showView(VIEW.LANDING);
  }

  // ── Expose ──
  root.Voice4AllHumanSupport = {
    init: init,
    setLanguage: setLanguage,
    VIEW: VIEW
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
