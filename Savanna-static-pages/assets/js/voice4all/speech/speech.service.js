/**
 * Voice4All Speech Service
 * Provides Speech-to-Text (STT) and Text-to-Speech (TTS) with English and Amharic support.
 * Designed for accessibility and browser independence with robust fallbacks.
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
     * @returns {boolean} whether recognition started
     */
    startListening(options = {}) {
      if (!this.isSTTSupported()) {
        const msg = 'Speech recognition is not supported in this browser. Please use keyboard text input.';
        console.warn('[Voice4All Speech]', msg);
        if (options.onError) options.onError(msg, 'unsupported');
        return false;
      }

      this.stopListening();

      try {
        const recognition = new SpeechRecognition();
        const locale = this.getLocale(options.language);

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

          switch (event.error) {
            case 'not-allowed':
            case 'service-not-allowed':
              userFriendlyMessage = 'Microphone access was denied. Please allow microphone permissions in your browser settings.';
              break;
            case 'no-speech':
              userFriendlyMessage = 'No speech detected. Please speak closer to your microphone.';
              break;
            case 'network':
              userFriendlyMessage = 'Speech network connectivity issue. Please check your internet connection.';
              break;
            case 'language-not-supported':
              userFriendlyMessage = `Speech input in ${locale} is not supported on this device. Switching to English or keyboard input.`;
              break;
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
          // ignore already stopped
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
     * @returns {boolean}
     */
    speak(text, options = {}) {
      if (!this.isTTSSupported()) {
        const msg = 'Text-to-speech is not supported in this browser.';
        console.warn('[Voice4All Speech]', msg);
        if (options.onError) options.onError(msg);
        return false;
      }

      this.stopSpeaking();

      const cleanedText = this.cleanTextForSpeech(text);
      if (!cleanedText) return false;

      try {
        const utterance = new window.SpeechSynthesisUtterance(cleanedText);
        const locale = this.getLocale(options.language);
        utterance.lang = locale;
        utterance.rate = options.rate || 0.95;
        utterance.pitch = options.pitch || 1.0;

        // Try to locate a matching voice in browser voice list
        const voices = speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const matchedVoice = voices.find((v) => v.lang === locale || v.lang.startsWith(locale.split('-')[0]));
          if (matchedVoice) {
            utterance.voice = matchedVoice;
          }
        }

        utterance.onstart = () => {
          if (options.onStart) options.onStart();
        };

        utterance.onend = () => {
          this.currentUtterance = null;
          if (options.onEnd) options.onEnd();
        };

        utterance.onerror = (e) => {
          this.currentUtterance = null;
          console.warn('[Voice4All Speech] Synthesis error:', e);
          if (options.onError) options.onError(e.error || 'Speech synthesis error');
        };

        this.currentUtterance = utterance;
        speechSynthesis.speak(utterance);
        return true;
      } catch (err) {
        console.error('[Voice4All Speech] TTS execution failed:', err);
        if (options.onError) options.onError(err.message);
        return false;
      }
    }

    /**
     * Stop active Text-to-Speech
     */
    stopSpeaking() {
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

