/**
 * Swagger Helper - lightweight page detector.
 *
 * Runs on every page but does almost nothing: it looks for Swagger UI / ReDoc /
 * RapiDoc markers in the DOM. It does not read page text, cookies or storage and
 * sends nothing anywhere. Only when a marker is found does it ask the background
 * worker to load the full helper (floating bubble, token tools, etc.) into this tab.
 */
(() => {
  if (window.__swaggerHelperDetector) return;
  window.__swaggerHelperDetector = true;

  const MARKER_SELECTORS = [
    '.swagger-ui',
    '#swagger-ui',
    '.redoc-wrap',
    'redoc',
    'rapi-doc',
    'elements-api'
  ].join(',');

  const ASSET_SELECTORS = [
    'script[src*="swagger-ui"]',
    'link[href*="swagger-ui"]',
    'script[src*="redoc"]',
    'script[src*="rapidoc"]'
  ].join(',');

  const WATCH_MS = 20000;
  let done = false;
  let observer = null;
  let timer = null;

  function looksLikeSwagger() {
    if (document.querySelector(MARKER_SELECTORS)) return true;
    if (document.querySelector(ASSET_SELECTORS)) return true;
    return /swagger ui/i.test(document.title || '');
  }

  function finish() {
    done = true;
    if (observer) observer.disconnect();
    if (timer) clearTimeout(timer);
  }

  function check() {
    if (done) return;
    if (!looksLikeSwagger()) return;
    finish();
    try {
      chrome.runtime.sendMessage({ action: 'SWAGGER_DETECTED' });
    } catch (e) {
      // Extension was reloaded or updated; nothing to do.
    }
  }

  let scheduled = false;
  function scheduleCheck() {
    if (scheduled || done) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      check();
    }, 300);
  }

  check();
  if (done) return;

  // Swagger UI is usually rendered by JavaScript after load, so keep watching briefly.
  observer = new MutationObserver(scheduleCheck);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  timer = setTimeout(finish, WATCH_MS);
})();
