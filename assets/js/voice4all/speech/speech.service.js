/**
 * Voice4All Speech Service
 * Provides Speech-to-Text (STT) and Text-to-Speech (TTS) with English and Amharic support.
 * Checks actual browser speech engine support for Amharic and provides seamless text fallbacks.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Voice4AllSpeech = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition || null
      : null;

  const speechSynthesis =
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;

  class SpeechService {
    constructor() {
      this.recognition = null;
      this.isListening = false;
      this.currentUtterance = null;
      this.selectedLanguage = 'en'; // 'en' | 'am'
      this.cachedVoices = [];
      this.speechRequestId = 0;

      if (typeof window !== 'undefined' && speechSynthesis) {
        this.refreshVoices();
        if (typeof speechSynthesis.addEventListener === 'function') {
          speechSynthesis.addEventListener('voiceschanged', () => this.refreshVoices());
        } else if (speechSynthesis.onvoiceschanged !== undefined) {
          speechSynthesis.onvoiceschanged = () => this.refreshVoices();
        }
      }
    }

    refreshVoices() {
      if (!speechSynthesis) return this.cachedVoices;
      const voices = speechSynthesis.getVoices();
      if (voices.length) this.cachedVoices = voices;
      return this.cachedVoices;
    }

    waitForVoices(timeoutMs = 1500) {
      const voices = this.refreshVoices();
      if (voices.length || !speechSynthesis) return Promise.resolve(voices);

      return new Promise((resolve) => {
        let timer;
        const finish = () => {
          clearTimeout(timer);
          if (typeof speechSynthesis.removeEventListener === 'function') {
            speechSynthesis.removeEventListener('voiceschanged', finish);
          }
          resolve(this.refreshVoices());
        };

        if (typeof speechSynthesis.addEventListener === 'function') {
          speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
          timer = setTimeout(finish, timeoutMs);
          return;
        }

        const deadline = Date.now() + timeoutMs;
        const poll = () => {
          const currentVoices = this.refreshVoices();
          if (currentVoices.length || Date.now() >= deadline) {
            resolve(currentVoices);
            return;
          }
          timer = setTimeout(poll, 100);
        };
        poll();
      });
    }

    /**
     * Checks whether speech recognition (STT) is supported in current browser
     * @returns {boolean}
     */
    isSTTSupported() {
      return Boolean(SpeechRecognition);
    }

    /**
     * Checks whether speech synthesis (TTS) is supported in current browser
     * @returns {boolean}
     */
    isTTSSupported() {
      return Boolean(speechSynthesis && typeof window.SpeechSynthesisUtterance !== 'undefined');
    }

    /**
     * Inspect browser and system voices to check actual support for Amharic
     * @returns {{ sttSupported: boolean, ttsSupported: boolean, amharicSTTSupported: boolean, amharicTTSSupported: boolean, fallbackReason: string|null }}
     */
    checkAmharicSupport() {
      const stt = this.isSTTSupported();
      const tts = this.isTTSSupported();

      // Check if any installed voice matches 'am' or 'am-ET'
      const voices = this.refreshVoices();
      const amharicVoice = voices.find((v) => v.lang === 'am-ET' || v.lang === 'am' || v.lang.startsWith('am-'));

      // In Chromium browsers, SpeechRecognition generally delegates to Google speech services which support am-ET if online
      const amharicSTT = stt;
      const amharicTTS = Boolean(amharicVoice);

      let fallbackReason = null;
      if (!amharicTTS && !amharicSTT) {
        fallbackReason = 'የአማርኛ ድምፅ እና ንግግር በዚህ አሳሽ ውስጥ አልተደገፈም። እባክዎ የጽሑፍ ግቤትን ይጠቀሙ።';
      } else if (!amharicTTS) {
        fallbackReason = 'የአማርኛ ድምፅ ንባብ (TTS) በአሳሽዎ የድምፅ ዝርዝር ውስጥ አልተገኘም። መልሶችን በጽሑፍ ያንብቡ።';
      }

      return {
        sttSupported: stt,
        ttsSupported: tts,
        amharicSTTSupported: amharicSTT,
        amharicTTSSupported: amharicTTS,
        hasAmharicVoice: Boolean(amharicVoice),
        fallbackReason
      };
    }

    /**
     * Set active language for STT & TTS ('en' | 'am')
     * @param {string} lang
     */
    setLanguage(lang) {
      this.selectedLanguage = lang === 'am' ? 'am' : 'en';
    }

    /**
     * Map language code to BCP 47 locale
     * @param {string} [lang]
     * @returns {string}
     */
    getLocale(lang) {
      const code = lang || this.selectedLanguage;
      return code === 'am' ? 'am-ET' : 'en-US';
    }

    /**
     * Start Speech-to-Text recording
     * @param {object} options
     * @param {string} [options.language] 'en' | 'am'
     * @param {boolean} [options.continuous=false]
     * @param {function} options.onResult callback(transcript, isFinal)
     * @param {function} [options.onStart]
     * @param {function} [options.onEnd]
     * @param {function} [options.onError] callback(errorMsg, errorCode)
     * @param {function} [options.onFallbackToText] callback(reason)
     * @returns {boolean} whether recognition started
     */
    startListening(options = {}) {
      if (!this.isSTTSupported()) {
        const msg = 'Speech recognition is not supported in this browser. Please use text input.';
        console.warn('[Voice4All Speech]', msg);
        if (options.onFallbackToText) options.onFallbackToText(msg);
        if (options.onError) options.onError(msg, 'unsupported');
        return false;
      }

      this.stopListening();

      try {
        const recognition = new SpeechRecognition();
        const lang = options.language || this.selectedLanguage;
        const locale = this.getLocale(lang);

        recognition.lang = locale;
        recognition.continuous = Boolean(options.continuous);
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          this.isListening = true;
          if (options.onStart) options.onStart();
        };

        recognition.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (options.onResult) {
            options.onResult({
              final: finalTranscript.trim(),
              interim: interimTranscript.trim(),
              combined: (finalTranscript + ' ' + interimTranscript).trim()
            });
          }
        };

        recognition.onerror = (event) => {
          console.warn('[Voice4All Speech] Recognition error:', event.error);
          this.isListening = false;
          let userFriendlyMessage = 'Speech recognition error occurred.';
          let triggerFallback = false;

          switch (event.error) {
            case 'language-not-supported':
              triggerFallback = true;
              userFriendlyMessage = lang === 'am'
                ? 'የአማርኛ ድምፅ ግቤት (Speech Input) በዚህ አሳሽ ወይም መሣሪያ ውስጥ አልተደገፈም። እባክዎ የጽሑፍ ግቤትን ይጠቀሙ።'
                : `Speech input in ${locale} is not supported. Please use text input.`;
              break;
            case 'not-allowed':
            case 'service-not-allowed':
              triggerFallback = true;
              userFriendlyMessage = 'Microphone permission was denied. Please allow microphone access or use text input.';
              break;
            case 'no-speech':
              userFriendlyMessage = 'No speech detected. Please speak closer to your microphone or type your question.';
              break;
            case 'network':
              userFriendlyMessage = 'Speech network connectivity issue. Please check your internet connection.';
              break;
          }

          if (triggerFallback && options.onFallbackToText) {
            options.onFallbackToText(userFriendlyMessage);
          }

          if (options.onError) options.onError(userFriendlyMessage, event.error);
        };

        recognition.onend = () => {
          this.isListening = false;
          if (options.onEnd) options.onEnd();
        };

        this.recognition = recognition;
        recognition.start();
        return true;
      } catch (err) {
        console.error('[Voice4All Speech] Failed to start recognition:', err);
        this.isListening = false;
        if (options.onFallbackToText) options.onFallbackToText(err.message);
        if (options.onError) options.onError(err.message, 'start_failed');
        return false;
      }
    }

    /**
     * Stop active Speech-to-Text listening
     */
    stopListening() {
      if (this.recognition && this.isListening) {
        try {
          this.recognition.stop();
        } catch (e) {
          // ignore
        }
      }
      this.isListening = false;
      this.recognition = null;
    }

    /**
     * Clean markdown and technical tags from text prior to speech
     * @param {string} text
     * @returns {string}
     */
    cleanTextForSpeech(text) {
      if (!text) return '';
      return text
        .replace(/[*_#`~\[\]\(\)>]/g, ' ')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    /**
     * Read text aloud using Text-to-Speech (TTS)
     * @param {string} text
     * @param {object} options
     * @param {string} [options.language] 'en' | 'am'
     * @param {number} [options.rate=0.95] speech rate for accessibility
     * @param {number} [options.pitch=1.0]
     * @param {function} [options.onStart]
     * @param {function} [options.onEnd]
     * @param {function} [options.onError]
     * @param {function} [options.onFallbackToText]
     * @returns {boolean}
     */
    speak(text, options = {}) {
      if (!this.isTTSSupported()) {
        const msg = 'Text-to-speech is not supported in this browser. Please read the response on screen.';
        if (options.onFallbackToText) options.onFallbackToText(msg);
        if (options.onError) options.onError(msg);
        return false;
      }

      this.stopSpeaking();

      const lang = options.language || this.selectedLanguage;
      const locale = this.getLocale(lang);
      const cleanedText = this.cleanTextForSpeech(text);
      if (!cleanedText) return false;

      const requestId = this.speechRequestId;
      this.waitForVoices().then((voices) => {
        if (requestId !== this.speechRequestId) return;

        if (lang === 'am' && !voices.some((voice) => voice.lang === 'am-ET' || voice.lang === 'am' || voice.lang.startsWith('am-'))) {
          const warning = 'የአማርኛ ድምፅ ንባብ (TTS) በአሳሽዎ ውስጥ አልተገኘም። እባክዎ የበይነመረብ ግንኙነቱን ያረጋግጡ ወይም የድምጽ መቆጣጠሪያዎችን ይጠቀሙ።';
          if (options.onFallbackToText) options.onFallbackToText(warning);
          return;
        }

        try {
          const utterance = new window.SpeechSynthesisUtterance(cleanedText);
          utterance.lang = locale;
          utterance.rate = options.rate || 0.95;
          utterance.pitch = options.pitch || 1.0;

          const matchedVoice = voices.find((voice) =>
            voice.lang === locale || voice.lang.startsWith(locale.split('-')[0])
          );
          if (matchedVoice) utterance.voice = matchedVoice;

          utterance.onstart = () => {
            if (requestId === this.speechRequestId && options.onStart) options.onStart();
          };

          utterance.onend = () => {
            if (requestId !== this.speechRequestId) return;
            this.currentUtterance = null;
            if (options.onEnd) options.onEnd();
          };

          utterance.onerror = (event) => {
            if (requestId !== this.speechRequestId) return;
            this.currentUtterance = null;
            console.warn('[Voice4All Speech] Synthesis error:', event);
            if (options.onError) options.onError(event.error || 'Speech synthesis error');
          };

          this.currentUtterance = utterance;
          speechSynthesis.speak(utterance);
        } catch (error) {
          if (requestId !== this.speechRequestId) return;
          console.error('[Voice4All Speech] TTS execution failed:', error);
          if (options.onError) options.onError(error.message);
        }
      });
      return true;
    }

    /**
     * Stop active Text-to-Speech
     */
    stopSpeaking() {
      this.speechRequestId += 1;
      if (speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) {
        speechSynthesis.cancel();
      }
      this.currentUtterance = null;
    }

    /**
     * Check if currently speaking
     * @returns {boolean}
     */
    isSpeaking() {
      return Boolean(speechSynthesis && speechSynthesis.speaking);
    }
  }

  return new SpeechService();
});
