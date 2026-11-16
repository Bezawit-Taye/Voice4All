/**
 * Voice4All — Universal Standalone Loader (`assets/js/voice4all/loader.js`)
 *
 * Enables single-script-tag installation on ANY website:
 *
 * <script src="https://your-site.com/assets/js/voice4all/loader.js"
 *         data-api-base="https://your-api.com"
 *         data-lang="en"
 *         data-position="bottom-right"
 *         data-simple-mode="false"
 *         async></script>
 *
 * Responsibilities:
 *   - Auto-detects own script location to dynamically resolve assets/ CSS and JS paths
 *   - Injects Voice4All scoped stylesheet (voice4all.css)
 *   - Safely loads FontAwesome or self-contained SVG icon fallbacks
 *   - Injects DOM mount points (#v4a-launcher-host, #v4a-drawer-host, live regions)
 *   - Loads modular scripts in dependency order:
 *       1. accessibility.js
 *       2. api.js
 *       3. ui.js
 *       4. voice4all.js
 *       5. embed.js
 *   - Boots the widget with host configuration and exposes `window.Voice4All`
 *   - Dispatches `voice4all:ready` event and fulfills `window.Voice4AllReady` Promise
 */

((window, document) => {
  'use strict';

  // Guard against duplicate inclusion
  if (window.__VOICE4ALL_LOADED__) {
    console.warn('[Voice4All Loader] Voice4All script has already been loaded on this page.');
    return;
  }
  window.__VOICE4ALL_LOADED__ = true;

  // 1. Detect own script element & configuration
  const currentScript = document.currentScript || (() => {
    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('voice4all/loader.js') !== -1) {
        return scripts[i];
      }
    }
    return scripts[scripts.length - 1];
  })();

  // 2. Parse configuration from script attributes or global object
  const globalConfig = window.VOICE4ALL_CONFIG || {};
  const dataset = currentScript ? (currentScript.dataset || {}) : {};

  const config = {
    apiBase: dataset.apiBase || globalConfig.apiBase || '',
    lang: dataset.lang || globalConfig.lang || null,
    position: dataset.position || globalConfig.position || 'bottom-right',
    simpleMode: dataset.simpleMode === 'true' || globalConfig.simpleMode === true,
    theme: dataset.theme || globalConfig.theme || 'default',
    autoInit: dataset.autoInit !== 'false' && globalConfig.autoInit !== false,
    cssUrl: dataset.cssUrl || globalConfig.cssUrl || null
  };

  // 3. Compute base URLs for assets
  let scriptUrl = (currentScript && currentScript.src) ? currentScript.src : window.location.href;
  // Strip trailing query or hash
  scriptUrl = scriptUrl.split('?')[0].split('#')[0];
  // Determine directory of loader.js: e.g. /path/to/assets/js/voice4all/
  const loaderDir = scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);
  // Assets directory: e.g. /path/to/assets/ (two levels up from js/voice4all/)
  const assetsDir = loaderDir.replace(/js\/voice4all\/$/, '');
  const cssDir = `${assetsDir}css/`;

  const resolvedCssUrl = config.cssUrl || `${cssDir}voice4all.css`;

  // Promise hook for developers
  let resolveReady, rejectReady;
  window.Voice4AllReady = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  // =========================================================================
  // Asset Loading Helpers
  // =========================================================================

  /**
   * Inject stylesheet into <head> if not already present
   */
  function loadStylesheet(href) {
    return new Promise((resolve, reject) => {
      // Check if already present
      const existing = document.querySelector(`link[href*="voice4all.css"]`);
      if (existing) {
        resolve();
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.media = 'all';
      link.onload = () => resolve();
      link.onerror = () => {
        console.warn(`[Voice4All Loader] Failed to load primary stylesheet at ${href}. Using embedded fallback.`);
        resolve(); // Continue gracefully
      };

      const head = document.head || document.getElementsByTagName('head')[0];
      head.appendChild(link);
    });
  }

  /**
   * Ensure FontAwesome icon font is available or provide SVG fallback
   */
  function ensureIconFont() {
    return new Promise((resolve) => {
      // Check if host page already has FontAwesome loaded
      const hasFontAwesome = document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]') ||
        window.FontAwesome;
      if (hasFontAwesome) {
        resolve();
        return;
      }

      // Check if fontawesome is already injected
      if (document.getElementById('v4a-fontawesome-cdn')) {
        resolve();
        return;
      }

      const link = document.createElement('link');
      link.id = 'v4a-fontawesome-cdn';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
      link.crossOrigin = 'anonymous';
      link.referrerPolicy = 'no-referrer';
      link.onload = () => resolve();
      link.onerror = () => {
        // Fallback: CSS SVG masks in voice4all.css will handle icons
        resolve();
      };
      (document.head || document.documentElement).appendChild(link);
    });
  }

  /**
   * Load an external JavaScript file
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false; // Maintain sequential execution
      script.onload = () => resolve();
      script.onerror = (err) => {
        console.error(`[Voice4All Loader] Error loading script: ${src}`, err);
        reject(new Error(`Failed to load script: ${src}`));
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  // =========================================================================
  // DOM Mounting Points
  // =========================================================================

  function ensureMountPoints() {
    if (!document.getElementById('v4a-launcher-host')) {
      const launcherHost = document.createElement('div');
      launcherHost.id = 'v4a-launcher-host';
      document.body.appendChild(launcherHost);
    }

    if (!document.getElementById('v4a-drawer-host')) {
      const drawerHost = document.createElement('div');
      drawerHost.id = 'v4a-drawer-host';
      document.body.appendChild(drawerHost);
    }
  }

  // =========================================================================
  // Master Orchestration Sequence
  // =========================================================================

  async function start() {
    try {
      // 1. Wait for DOM ready before attaching elements
      if (document.readyState === 'loading') {
        await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
      }

      // 2. Load stylesheet & FontAwesome icons concurrently
      await Promise.all([
        loadStylesheet(resolvedCssUrl),
        ensureIconFont()
      ]);

      // 3. Ensure mount points exist in DOM
      ensureMountPoints();

      // 4. Set global configuration overrides before scripts execute
      if (config.apiBase) {
        window.VOICE4ALL_API_BASE = config.apiBase;
      }
      if (config.lang) {
        try { localStorage.setItem('v4a_preferred_lang', config.lang); } catch (e) {}
      }
      if (config.simpleMode) {
        try { sessionStorage.setItem('v4a_simple_mode', 'true'); } catch (e) {}
      }

      // 5. Sequentially load modular dependencies:
      // accessibility -> api -> ui -> voice4all -> embed
      const scriptsToLoad = [
        `${loaderDir}accessibility.js`,
        `${loaderDir}api.js`,
        `${loaderDir}ui.js`,
        `${loaderDir}voice4all.js`,
        `${loaderDir}embed.js`
      ];

      for (const scriptSrc of scriptsToLoad) {
        await loadScript(scriptSrc);
      }

      // 6. Initialize Voice4All with parsed config
      if (window.Voice4All && typeof window.Voice4All.init === 'function') {
        window.Voice4All.init({
          apiBase: config.apiBase,
          lang: config.lang,
          position: config.position,
          simpleMode: config.simpleMode,
          theme: config.theme
        });
      }

      // 7. Dispatch events and resolve ready promise
      const readyEvent = new CustomEvent('voice4all:ready', {
        bubbles: true,
        detail: {
          version: window.Voice4All ? window.Voice4All.version : '2.2.0',
          config
        }
      });
      window.dispatchEvent(readyEvent);
      document.dispatchEvent(readyEvent);

      resolveReady(window.Voice4All);
      console.log('[Voice4All Loader] Plugin installed and operational on host page.');
    } catch (err) {
      console.error('[Voice4All Loader] Initialization failed:', err);
      rejectReady(err);
    }
  }

  // Execute loader sequence
  start();

})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
