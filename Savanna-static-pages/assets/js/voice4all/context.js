/**
 * Voice4All — Course Context Extractor
 * 
 * Extracts structured educational context (courseTitle, moduleTitle, lessonTitle, lessonText)
 * from Savanna intranet lesson pages (e.g. pages/concept-with-navigation.html).
 * 
 * Designed for browser environments, accessible UI overlays, and automated testing.
 * Exposes a clean, safe, and consistent interface:
 * {
 *   courseTitle: string,
 *   moduleTitle: string,
 *   lessonTitle: string,
 *   lessonText: string
 * }
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    var exp = factory();
    root.Voice4AllContext = exp;
    // Also alias as SavannaContext for compatibility
    root.SavannaContext = exp;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Safe HTML entity decoder
   * @param {string} str
   * @returns {string}
   */
  function decodeHtmlEntities(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, function (_, dec) {
        return String.fromCharCode(dec);
      })
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      });
  }

  /**
   * Normalizes whitespace, collapses consecutive spaces while preserving clean line breaks
   * @param {string} text
   * @returns {string}
   */
  function cleanWhitespace(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s+\n/g, '\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * DOM-based extractor for browser and DOM-like environments
   * @param {Document|Element} doc
   * @returns {{courseTitle: string, moduleTitle: string, lessonTitle: string, lessonText: string}}
   */
  function extractFromDOM(doc) {
    var result = {
      courseTitle: '',
      moduleTitle: '',
      lessonTitle: '',
      lessonText: ''
    };

    if (!doc) return result;

    try {
      // 1. EXTRACT COURSE TITLE
      var courseEl =
        doc.querySelector('#student-current-curriculum .curriculum-switcher-label span.fs-4') ||
        doc.querySelector('.curriculum-switcher-tile-current span.fw-semibold') ||
        doc.querySelector('#student-switch-curriculum .curriculum-switcher-label .fs-4') ||
        doc.querySelector('.curriculum-switcher-label span.fw-semibold') ||
        doc.querySelector('[data-course-title]') ||
        doc.querySelector('.course-title');

      if (courseEl) {
        result.courseTitle = cleanWhitespace(courseEl.textContent || '');
      }

      // Fallback for course title: inspect congratulations modal badge or meta tag
      if (!result.courseTitle) {
        var modalBadge = doc.querySelector('#curriculum-validation-congrats-modal p.text-muted');
        if (modalBadge) {
          var match = (modalBadge.textContent || '').match(/badge for (.+)$/i);
          if (match && match[1]) {
            result.courseTitle = cleanWhitespace(match[1]);
          }
        }
      }

      // 2. EXTRACT MODULE TITLE
      var moduleToggleBtn = doc.querySelector('#curriculum_navigation_toggle button');
      var moduleMenuBtn = doc.querySelector('#curriculum_navigation_menu .btn-group button');
      var activeDropdownModule = doc.querySelector('#curriculum_navigation_menu .dropdown-menu .dropdown-item.active');
      var accordionHeader = doc.querySelector('#curriculum_navigation_menu .accordion-header button span');
      var dataModuleEl = doc.querySelector('[data-module-title]') || doc.querySelector('.module-title');

      var rawModule = '';
      if (moduleToggleBtn) {
        // Clone button to remove child icon tags before extracting text
        var clone = moduleToggleBtn.cloneNode(true);
        var icons = clone.querySelectorAll('i, svg, span.badge');
        for (var i = 0; i < icons.length; i++) {
          if (icons[i].parentNode) icons[i].parentNode.removeChild(icons[i]);
        }
        rawModule = clone.textContent || '';
      } else if (moduleMenuBtn) {
        rawModule = moduleMenuBtn.textContent || '';
      } else if (activeDropdownModule) {
        rawModule = activeDropdownModule.textContent || '';
      } else if (accordionHeader) {
        rawModule = accordionHeader.textContent || '';
      } else if (dataModuleEl) {
        rawModule = dataModuleEl.textContent || '';
      }

      result.moduleTitle = cleanWhitespace(rawModule);

      // 3. EXTRACT LESSON TITLE
      var lessonH1 = doc.querySelector('#curriculum_navigation_content h1');
      var activeLessonItem = doc.querySelector('#curriculum_navigation_menu .list-group-item.active span');
      var currentAriaItem = doc.querySelector('#curriculum_navigation_menu .list-group-item[aria-current="true"] span');
      var articleH1 = doc.querySelector('article h1');
      var dataLessonEl = doc.querySelector('[data-lesson-title]') || doc.querySelector('.lesson-title');

      var rawLesson = '';
      if (lessonH1) {
        rawLesson = lessonH1.textContent || '';
      } else if (activeLessonItem) {
        rawLesson = activeLessonItem.textContent || '';
      } else if (currentAriaItem) {
        rawLesson = currentAriaItem.textContent || '';
      } else if (articleH1) {
        rawLesson = articleH1.textContent || '';
      } else if (dataLessonEl) {
        rawLesson = dataLessonEl.textContent || '';
      }

      // Fallback from document title (e.g. "Concept page: The Future of the VA Industry | G-School Intranet")
      if (!rawLesson && doc.title) {
        var titleMatch = doc.title.match(/Concept page:\s*([^|]+)/i);
        if (titleMatch && titleMatch[1]) {
          rawLesson = titleMatch[1];
        }
      }

      result.lessonTitle = cleanWhitespace(rawLesson);

      // 4. EXTRACT LESSON TEXT
      var contentContainer =
        doc.querySelector('#curriculum_navigation_content .formatted-content') ||
        doc.querySelector('.formatted-content .savanna-styles') ||
        doc.querySelector('#curriculum_navigation_content') ||
        doc.querySelector('article .formatted-content') ||
        doc.querySelector('.lesson-content');

      if (contentContainer) {
        var contentClone = contentContainer.cloneNode(true);

        // Remove elements that are navigational, scripts, or non-educational clutter
        var removeSelectors = [
          'script',
          'style',
          'noscript',
          'iframe',
          'form',
          'button',
          'input',
          'nav',
          '.navigation',
          '.btn',
          '.dropdown-menu',
          '#curriculum_navigation_toggle',
          '#curriculum_navigation_menu',
          '.modal',
          '.copyright',
          'svg',
          '[aria-hidden="true"]',
          '.d-none'
        ];

        var unwanted = contentClone.querySelectorAll(removeSelectors.join(','));
        for (var u = 0; u < unwanted.length; u++) {
          if (unwanted[u].parentNode) {
            unwanted[u].parentNode.removeChild(unwanted[u]);
          }
        }

        // Format block elements to retain readable paragraph structure
        var text = '';
        if (typeof contentClone.innerText === 'string') {
          text = contentClone.innerText;
        } else {
          text = contentClone.textContent || '';
        }

        result.lessonText = cleanWhitespace(decodeHtmlEntities(text));
      }
    } catch (err) {
      // Safe fallback: never crash calling application
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Voice4All Context Extractor encountered non-fatal error:', err);
      }
    }

    return result;
  }

  /**
   * Regex-based fallback extractor for raw HTML strings or non-DOM server/test environments
   * @param {string} html
   * @returns {{courseTitle: string, moduleTitle: string, lessonTitle: string, lessonText: string}}
   */
  function extractFromHtmlString(html) {
    var result = {
      courseTitle: '',
      moduleTitle: '',
      lessonTitle: '',
      lessonText: ''
    };

    if (!html || typeof html !== 'string') return result;

    try {
      // 1. Course Title
      var courseRegexes = [
        /class="[^"]*curriculum-switcher-label[^"]*"[\s\S]*?<span class="fs-4[^"]*">([\s\S]*?)<\/span>/i,
        /class="[^"]*curriculum-switcher-tile-current[^"]*"[\s\S]*?<span class="[^"]*fw-semibold[^"]*">([\s\S]*?)<\/span>/i,
        /data-course-title="([^"]+)"/i
      ];

      for (var i = 0; i < courseRegexes.length; i++) {
        var cm = html.match(courseRegexes[i]);
        if (cm && cm[1]) {
          var stripped = cm[1].replace(/<[^>]+>/g, '');
          result.courseTitle = cleanWhitespace(decodeHtmlEntities(stripped));
          if (result.courseTitle) break;
        }
      }

      // 2. Module Title
      var moduleRegexes = [
        /id="curriculum_navigation_toggle"[\s\S]*?<button[^>]*>([\s\S]*?)<\/button>/i,
        /id="curriculum_navigation_menu"[\s\S]*?<button[^>]*class="[^"]*dropdown-toggle[^"]*"[^>]*>([\s\S]*?)<\/button>/i,
        /class="[^"]*dropdown-item active[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
        /class="accordion-button"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,
        /data-module-title="([^"]+)"/i
      ];

      for (var j = 0; j < moduleRegexes.length; j++) {
        var mm = html.match(moduleRegexes[j]);
        if (mm && mm[1]) {
          var cleanMod = mm[1].replace(/<i[^>]*>[\s\S]*?<\/i>/gi, '').replace(/<[^>]+>/g, '');
          result.moduleTitle = cleanWhitespace(decodeHtmlEntities(cleanMod));
          if (result.moduleTitle) break;
        }
      }

      // 3. Lesson Title
      var lessonRegexes = [
        /id="curriculum_navigation_content"[\s\S]*?<h1[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i,
        /id="curriculum_navigation_content"[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i,
        /class="[^"]*list-group-item[^"]*active[^"]*"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i,
        /<title>Concept page:\s*([^|<]+)/i,
        /data-lesson-title="([^"]+)"/i
      ];

      for (var k = 0; k < lessonRegexes.length; k++) {
        var lm = html.match(lessonRegexes[k]);
        if (lm && lm[1]) {
          var cleanLess = lm[1].replace(/<[^>]+>/g, '');
          result.lessonTitle = cleanWhitespace(decodeHtmlEntities(cleanLess));
          if (result.lessonTitle) break;
        }
      }

      // 4. Lesson Text
      var contentMatch =
        html.match(/class="[^"]*formatted-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="[^"]*container-xl[^"]*ms-0 d-flex justify-content-between/i) ||
        html.match(/class="[^"]*formatted-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/article>/i) ||
        html.match(/id="curriculum_navigation_content"[\s\S]*?<div class="[^"]*formatted-content[^"]*"[^>]*>([\s\S]*?)<\/article>/i);

      var rawContent = contentMatch ? contentMatch[1] : '';
      if (!rawContent) {
        var genericMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
        if (genericMatch) rawContent = genericMatch[1];
      }

      if (rawContent) {
        var cleanContent = rawContent
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<form[\s\S]*?<\/form>/gi, '')
          .replace(/<button[\s\S]*?<\/button>/gi, '')
          .replace(/<nav[\s\S]*?<\/nav>/gi, '')
          .replace(/<svg[\s\S]*?<\/svg>/gi, '')
          .replace(/<h[1-6][^>]*>/gi, '\n\n')
          .replace(/<\/h[1-6]>/gi, '\n')
          .replace(/<p[^>]*>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<li[^>]*>/gi, '\n• ')
          .replace(/<\/li>/gi, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<hr\s*\/?>/gi, '\n---\n')
          .replace(/<[^>]+>/g, ' ');

        result.lessonText = cleanWhitespace(decodeHtmlEntities(cleanContent));
      }
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Voice4All String Extractor encountered non-fatal error:', err);
      }
    }

    return result;
  }

  /**
   * Main context extraction function.
   * Safe against undefined, null, partial documents, and arbitrary strings.
   * 
   * @param {Document|Element|string} [target] - Optional target document, element, or HTML string.
   * Defaults to global `document` if available.
   * @returns {{courseTitle: string, moduleTitle: string, lessonTitle: string, lessonText: string}}
   */
  function extractContext(target) {
    var defaultObj = {
      courseTitle: '',
      moduleTitle: '',
      lessonTitle: '',
      lessonText: ''
    };

    if (typeof target === 'string') {
      return extractFromHtmlString(target);
    }

    var doc = target;
    if (!doc && typeof document !== 'undefined') {
      doc = document;
    }

    if (!doc) {
      return defaultObj;
    }

    // If target has querySelector (DOM Document or Element)
    if (typeof doc.querySelector === 'function') {
      return extractFromDOM(doc);
    }

    return defaultObj;
  }

  // Cache last extracted context for quick re-use
  var cachedContext = null;

  /**
   * Returns cached context or extracts live context from document.
   * @param {boolean} [forceRefresh=false]
   * @returns {{courseTitle: string, moduleTitle: string, lessonTitle: string, lessonText: string}}
   */
  function getContext(forceRefresh) {
    if (forceRefresh || !cachedContext) {
      cachedContext = extractContext();
    }
    // Return a shallow copy to prevent external mutation of cache
    return {
      courseTitle: cachedContext.courseTitle || '',
      moduleTitle: cachedContext.moduleTitle || '',
      lessonTitle: cachedContext.lessonTitle || '',
      lessonText: cachedContext.lessonText || ''
    };
  }

  /**
   * Converts context to an API-ready payload for support or AI tutor endpoints.
   * @param {Object} [overrides]
   * @returns {{courseTitle: string, moduleTitle: string, lessonTitle: string, lessonText: string, extractedAt: string}}
   */
  function toPayload(overrides) {
    var ctx = getContext(true);
    var result = {
      courseTitle: ctx.courseTitle,
      moduleTitle: ctx.moduleTitle,
      lessonTitle: ctx.lessonTitle,
      lessonText: ctx.lessonText,
      extractedAt: new Date().toISOString()
    };
    if (overrides && typeof overrides === 'object') {
      for (var key in overrides) {
        if (Object.prototype.hasOwnProperty.call(overrides, key)) {
          result[key] = overrides[key];
        }
      }
    }
    return result;
  }

  return {
    extractContext: extractContext,
    getContext: getContext,
    toPayload: toPayload,
    cleanWhitespace: cleanWhitespace,
    decodeHtmlEntities: decodeHtmlEntities
  };
});
