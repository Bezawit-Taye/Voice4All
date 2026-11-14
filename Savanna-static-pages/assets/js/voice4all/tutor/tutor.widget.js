/**
 * Voice4All Tutor Interactive Widget (Phase 2)
 * Embeddable, accessible chat widget with:
 * - Speech input (STT) and read-aloud (TTS)
 * - English and Amharic language switching
 * - Simple-language explanation toggle
 * - Grounded course citations and mode indicators
 * - DOM context auto-extraction from Savanna lesson pages
 */

(function () {
  'use strict';

  // Ensure dependencies exist or gracefully fallback
  const tutorService = window.Voice4AllTutorService || null;
  const speechService = window.Voice4AllSpeech || null;

  class Voice4AllTutorWidget {
    constructor() {
      this.currentLanguage = 'en'; // 'en' | 'am'
      this.isSimpleMode = false;
      this.isOpen = false;
      this.isListening = false;
      this.messages = [];
      this.activeUtteranceIndex = null;

      this.init();
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.render());
      } else {
        this.render();
      }
    }

    /**
     * Inspect active Savanna page DOM to extract lesson context
     */
    extractPageContext() {
      try {
        const titleEl = document.querySelector('h1, .concept-title, .course-header h1, title');
        const courseEl = document.querySelector('.course-dropdown, .breadcrumb, [data-course-title]');
        const moduleEl = document.querySelector('.module-title, .accordion-button, .activity-module-title');
        const bodyEl = document.querySelector('article, .concept-body, main, #main-content');

        return {
          courseTitle: (courseEl ? courseEl.innerText : document.title || 'Savanna Learning').trim().slice(0, 100),
          moduleTitle: (moduleEl ? moduleEl.innerText : 'Active Module').trim().slice(0, 100),
          lessonTitle: (titleEl ? titleEl.innerText : 'Active Lesson').trim().slice(0, 100),
          lessonText: (bodyEl ? bodyEl.innerText : '').trim().slice(0, 1500)
        };
      } catch (e) {
        return null;
      }
    }

    render() {
      if (document.getElementById('voice4all-tutor-container')) return;

      const container = document.createElement('div');
      container.id = 'voice4all-tutor-container';
      container.innerHTML = `
        <style>
          #voice4all-tutor-container {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 999999;
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .v4a-launcher-btn {
            width: 58px;
            height: 58px;
            border-radius: 50%;
            background: #0452F0;
            color: #ffffff;
            border: none;
            box-shadow: 0 4px 18px rgba(4, 82, 240, 0.35);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            transition: all 0.2s ease;
          }
          .v4a-launcher-btn:hover {
            transform: scale(1.06);
            background: #033fc2;
          }
          .v4a-modal {
            position: fixed;
            bottom: 94px;
            right: 24px;
            width: 390px;
            max-width: calc(100vw - 32px);
            height: 560px;
            max-height: calc(100vh - 120px);
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 12px 36px rgba(3, 19, 79, 0.18);
            display: none;
            flex-direction: column;
            overflow: hidden;
            border: 1px solid #E5E7EB;
          }
          .v4a-modal.active {
            display: flex;
          }
          .v4a-header {
            background: #03134F;
            color: #ffffff;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .v4a-header-title {
            font-size: 15px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .v4a-header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .v4a-pill-btn {
            background: rgba(255, 255, 255, 0.16);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 12px;
            padding: 3px 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          }
          .v4a-pill-btn.active {
            background: #EAB308;
            color: #03134F;
            border-color: #EAB308;
          }
          .v4a-close-btn {
            background: transparent;
            color: #ffffff;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 2px 6px;
          }
          .v4a-controls-bar {
            background: #F9FAFB;
            border-bottom: 1px solid #E5E7EB;
            padding: 8px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            color: #4B5563;
          }
          .v4a-switch-label {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            font-weight: 500;
          }
          .v4a-chat-body {
            flex: 1;
            padding: 14px;
            overflow-y: auto;
            background: #F8FAFC;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .v4a-msg {
            max-width: 88%;
            padding: 10px 14px;
            border-radius: 14px;
            font-size: 13px;
            line-height: 1.45;
            position: relative;
          }
          .v4a-msg-user {
            align-self: flex-end;
            background: #0452F0;
            color: #ffffff;
            border-bottom-right-radius: 4px;
          }
          .v4a-msg-tutor {
            align-self: flex-start;
            background: #ffffff;
            color: #1F2937;
            border: 1px solid #E5E7EB;
            border-bottom-left-radius: 4px;
          }
          .v4a-mode-badge {
            display: inline-block;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 2px 6px;
            border-radius: 6px;
            background: #EFF6FF;
            color: #1D4ED8;
            margin-bottom: 6px;
          }
          .v4a-sources {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed #E5E7EB;
            font-size: 11px;
            color: #4B5563;
          }
          .v4a-source-card {
            background: #F3F4F6;
            border-radius: 6px;
            padding: 6px 8px;
            margin-top: 4px;
          }
          .v4a-source-title {
            font-weight: 600;
            color: #111827;
          }
          .v4a-source-snippet {
            font-style: italic;
            color: #4B5563;
            margin-top: 2px;
          }
          .v4a-msg-actions {
            margin-top: 6px;
            display: flex;
            gap: 6px;
          }
          .v4a-action-btn {
            background: #F3F4F6;
            border: 1px solid #D1D5DB;
            border-radius: 6px;
            font-size: 11px;
            padding: 2px 6px;
            cursor: pointer;
            color: #374151;
          }
          .v4a-action-btn:hover {
            background: #E5E7EB;
          }
          .v4a-footer {
            padding: 10px 12px;
            background: #ffffff;
            border-top: 1px solid #E5E7EB;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .v4a-input {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #D1D5DB;
            border-radius: 20px;
            font-size: 13px;
            outline: none;
          }
          .v4a-input:focus {
            border-color: #0452F0;
          }
          .v4a-mic-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #F3F4F6;
            border: 1px solid #D1D5DB;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            transition: all 0.2s;
          }
          .v4a-mic-btn.listening {
            background: #EF4444;
            color: #ffffff;
            border-color: #DC2626;
            animation: v4a-pulse 1.2s infinite;
          }
          @keyframes v4a-pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            70% { transform: scale(1.08); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
          .v4a-send-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #0452F0;
            color: #ffffff;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 15px;
          }
        </style>

        <button class="v4a-launcher-btn" id="v4a-toggle-btn" title="Open Voice4All AI Tutor">
          💬
        </button>

        <div class="v4a-modal" id="v4a-modal">
          <div class="v4a-header">
            <div class="v4a-header-title">
              <span>🎓</span>
              <span id="v4a-title-text">Course AI Tutor</span>
            </div>
            <div class="v4a-header-actions">
              <button class="v4a-pill-btn active" id="v4a-lang-en">EN</button>
              <button class="v4a-pill-btn" id="v4a-lang-am">አማ</button>
              <button class="v4a-close-btn" id="v4a-close-btn">&times;</button>
            </div>
          </div>

          <div class="v4a-controls-bar">
            <label class="v4a-switch-label" title="Simplify explanations into plain language">
              <input type="checkbox" id="v4a-simplify-toggle" />
              <span id="v4a-simplify-label">Plain Language Mode</span>
            </label>
            <span id="v4a-stt-badge" style="font-size: 10px; color: #10B981;">● Speech Ready</span>
          </div>

          <div class="v4a-chat-body" id="v4a-chat-body">
            <!-- Messages stream here -->
          </div>

          <div class="v4a-footer">
            <button class="v4a-mic-btn" id="v4a-mic-btn" title="Voice Input (Speech-to-Text)">
              🎤
            </button>
            <input type="text" class="v4a-input" id="v4a-input" placeholder="Ask a question about this course..." />
            <button class="v4a-send-btn" id="v4a-send-btn" title="Send Question">
              ➤
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(container);
      this.attachEvents();
      this.addWelcomeMessage();
    }

    addWelcomeMessage() {
      const isAm = this.currentLanguage === 'am';
      const welcome = isAm
        ? 'ሰላም! እኔ የ Voice4All የኮርስ ረዳት ነኝ። ስለ ቨርቹዋል ረዳትነት (VA-1)፣ ውጤታማ ግንኙነት (WR 100) ወይም ስለ አሁኑ የትምህርት ገጽዎ በድምፅ ወይም በጽሑፍ መጠየቅ ይችላሉ።'
        : 'Hello! I am your Voice4All Course Tutor. You can ask me questions about your curriculum (VA-1, WR 100) or your active lesson using voice or text.';

      this.addMessage({
        sender: 'tutor',
        text: welcome,
        mode: 'ready',
        sources: []
      });
    }

    attachEvents() {
      const toggleBtn = document.getElementById('v4a-toggle-btn');
      const closeBtn = document.getElementById('v4a-close-btn');
      const modal = document.getElementById('v4a-modal');
      const sendBtn = document.getElementById('v4a-send-btn');
      const input = document.getElementById('v4a-input');
      const micBtn = document.getElementById('v4a-mic-btn');
      const langEn = document.getElementById('v4a-lang-en');
      const langAm = document.getElementById('v4a-lang-am');
      const simplifyToggle = document.getElementById('v4a-simplify-toggle');

      toggleBtn.onclick = () => {
        this.isOpen = !this.isOpen;
        modal.classList.toggle('active', this.isOpen);
        if (this.isOpen) input.focus();
      };

      closeBtn.onclick = () => {
        this.isOpen = false;
        modal.classList.remove('active');
        if (speechService) {
          speechService.stopSpeaking();
          speechService.stopListening();
        }
      };

      langEn.onclick = () => {
        this.currentLanguage = 'en';
        langEn.classList.add('active');
        langAm.classList.remove('active');
        document.getElementById('v4a-title-text').innerText = 'Course AI Tutor';
        document.getElementById('v4a-simplify-label').innerText = 'Plain Language Mode';
        input.placeholder = 'Ask a question about this course...';
      };

      langAm.onclick = () => {
        this.currentLanguage = 'am';
        langAm.classList.add('active');
        langEn.classList.remove('active');
        document.getElementById('v4a-title-text').innerText = 'የኮርስ AI ረዳት';
        document.getElementById('v4a-simplify-label').innerText = 'ቀላል ማብራሪያ ሁነታ';
        input.placeholder = 'ስለዚህ ኮርስ ጥያቄ ይጠይቁ...';
      };

      simplifyToggle.onchange = (e) => {
        this.isSimpleMode = e.target.checked;
      };

      sendBtn.onclick = () => this.handleSend();
      input.onkeydown = (e) => {
        if (e.key === 'Enter') this.handleSend();
      };

      // Speech Recognition Integration
      if (micBtn && speechService) {
        micBtn.onclick = () => {
          if (this.isListening) {
            speechService.stopListening();
            this.setListeningState(false);
          } else {
            speechService.setLanguage(this.currentLanguage);
            const started = speechService.startListening({
              language: this.currentLanguage,
              onStart: () => this.setListeningState(true),
              onResult: (res) => {
                input.value = res.combined;
                if (res.final && res.final.length > 3) {
                  this.setListeningState(false);
                  this.handleSend();
                }
              },
              onError: (err) => {
                this.setListeningState(false);
                alert(err);
              },
              onEnd: () => this.setListeningState(false)
            });

            if (!started) {
              this.setListeningState(false);
            }
          }
        };
      }
    }

    setListeningState(active) {
      this.isListening = active;
      const micBtn = document.getElementById('v4a-mic-btn');
      if (micBtn) {
        micBtn.classList.toggle('listening', active);
      }
    }

    async handleSend() {
      const input = document.getElementById('v4a-input');
      const text = (input.value || '').trim();
      if (!text) return;

      input.value = '';
      this.addMessage({ sender: 'user', text });

      const loadingMsgId = this.addMessage({
        sender: 'tutor',
        text: this.currentLanguage === 'am' ? 'ማብራሪያ በመዘጋጀት ላይ ነው...' : 'Searching course content...',
        isLoading: true
      });

      const pageContext = this.extractPageContext();
      const tutor = tutorService || window.Voice4AllTutorService;

      if (!tutor) {
        this.updateMessage(loadingMsgId, {
          text: 'Error: Voice4All Tutor Service is not loaded.',
          isLoading: false
        });
        return;
      }

      try {
        const result = await tutor.ask({
          question: text,
          language: this.currentLanguage,
          simplify: this.isSimpleMode,
          context: pageContext
        });

        this.updateMessage(loadingMsgId, {
          text: result.answer,
          sources: result.sources || [],
          mode: result.mode || 'mock_demo',
          isGrounded: result.isGrounded,
          simplified: result.simplified,
          isLoading: false
        });
      } catch (err) {
        this.updateMessage(loadingMsgId, {
          text: 'Error fetching response: ' + err.message,
          isLoading: false
        });
      }
    }

    addMessage(msgData) {
      const id = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
      const chatBody = document.getElementById('v4a-chat-body');

      const msgEl = document.createElement('div');
      msgEl.id = id;
      msgEl.className = `v4a-msg v4a-msg-${msgData.sender}`;
      msgEl.innerHTML = this.renderMessageContent(msgData);

      chatBody.appendChild(msgEl);
      chatBody.scrollTop = chatBody.scrollHeight;

      this.messages.push({ id, ...msgData });
      return id;
    }

    updateMessage(id, newData) {
      const msgEl = document.getElementById(id);
      if (!msgEl) return;

      const idx = this.messages.findIndex((m) => m.id === id);
      if (idx !== -1) {
        this.messages[idx] = { ...this.messages[idx], ...newData };
        msgEl.innerHTML = this.renderMessageContent(this.messages[idx]);
        const chatBody = document.getElementById('v4a-chat-body');
        if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
      }
    }

    renderMessageContent(msg) {
      if (msg.isLoading) {
        return `<div style="font-style: italic; color: #6B7280;">⏳ ${msg.text}</div>`;
      }

      let html = '';

      if (msg.mode && msg.sender === 'tutor') {
        const modeLabel = {
          mock_demo: 'Demo Mode (Course Grounded)',
          offline_faq: 'Offline FAQ',
          cloud_ai: 'Cloud AI',
          local_ai: 'Local AI',
          unsupported_refusal: 'Curriculum Guardrail'
        }[msg.mode] || msg.mode;

        html += `<span class="v4a-mode-badge">${modeLabel}</span>`;
      }

      html += `<div style="white-space: pre-wrap;">${msg.text}</div>`;

      if (msg.sources && msg.sources.length > 0) {
        html += `<div class="v4a-sources">`;
        html += `<strong>📚 Verified Course Sources:</strong>`;
        msg.sources.forEach((s) => {
          html += `
            <div class="v4a-source-card">
              <div class="v4a-source-title">${s.courseTitle} > ${s.lessonTitle}</div>
              <div class="v4a-source-snippet">"${s.snippet}"</div>
            </div>
          `;
        });
        html += `</div>`;
      }

      if (msg.sender === 'tutor' && speechService) {
        html += `
          <div class="v4a-msg-actions">
            <button class="v4a-action-btn" onclick="Voice4AllSpeech.speak(${JSON.stringify(msg.text).replace(/"/g, '&quot;')}, { language: '${this.currentLanguage}' })">
              🔊 Read Aloud
            </button>
            <button class="v4a-action-btn" onclick="Voice4AllSpeech.stopSpeaking()">
              ⏹ Stop
            </button>
          </div>
        `;
      }

      return html;
    }
  }

  // Initialize widget
  window.Voice4AllTutorWidget = new Voice4AllTutorWidget();
})();

