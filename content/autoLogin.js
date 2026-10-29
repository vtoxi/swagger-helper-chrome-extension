/**
 * Auto Login Content Script
 * Handles automatic token injection into Swagger UI
 */

// Configuration for token injection
let tokenFormatSettings = {
  tokenFormat: 'value',  // Default to plain token
  tokenPrefix: '',       // No prefix by default  
  tokenHeader: 'Authorization'
};

// Swagger UI selectors for finding authorization components
const SWAGGER_SELECTORS = {
  AUTHORIZE_BUTTON: [
    'button[class*="authorize"]',
    '.authorize-wrapper button',
    '.auth-wrapper button',
    'button:contains("Authorize")',
    '.btn-authorize'
  ],
  AUTH_MODAL: [
    '.auth-container',
    '.auth-wrapper',
    '.modal-ux',
    '[class*="auth"][class*="modal"]',
    '.swagger-ui .auth-container'
  ],
  TOKEN_INPUT: [
    'input[name*="token"]',
    'input[placeholder*="token"]',
    'input[type="text"][placeholder*="Bearer"]',
    'input[data-name*="token"]',
    '.auth-container input[type="text"]',
    '.token-input'
  ]
};

/**
 * Check if chrome.runtime is available
 */
function isChromeRuntimeAvailable() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
}

/**
 * Load token format settings from storage
 */
async function loadTokenFormatSettings() {
  try {
    if (!isChromeRuntimeAvailable()) {
  
      tokenFormatSettings.tokenFormat = 'value';
      tokenFormatSettings.tokenPrefix = '';
      tokenFormatSettings.tokenHeader = 'Authorization';
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'GET_SETTINGS'
    });
    
    if (response && response.success && response.settings) {
      const settings = response.settings;
      tokenFormatSettings.tokenFormat = settings.tokenFormat || 'value';
      tokenFormatSettings.tokenPrefix = settings.tokenPrefix || '';
      tokenFormatSettings.tokenHeader = settings.tokenHeader || 'Authorization';
    }
  } catch (error) {

    // Use defaults if loading fails
    tokenFormatSettings.tokenFormat = 'value';
    tokenFormatSettings.tokenPrefix = '';
    tokenFormatSettings.tokenHeader = 'Authorization';
  }
}

/**
 * Get element class name safely
 */
function getElementClassName(element) {
  if (!element) return '';
  if (typeof element.className === 'string') {
    return element.className.toLowerCase();
  }
  if (element.className && element.className.toString) {
    return element.className.toString().toLowerCase();
  }
  return '';
}

/**
 * Check if element is an authorization modal
 */
function isAuthModal(element) {
  if (!element) return false;
  
  const className = getElementClassName(element);
  const id = (element.id || '').toLowerCase();
  
  return className.includes('auth') || 
         className.includes('modal') ||
         id.includes('auth') ||
         element.querySelector && 
         (element.querySelector('input[placeholder*="token"]') ||
          element.querySelector('input[name*="token"]'));
}

/**
 * Check if element is an authorize button
 */
function isAuthorizeButton(element) {
  if (!element) return false;
  
  const className = getElementClassName(element);
  const text = (element.textContent || '').toLowerCase();
  
  return className.includes('authorize') || 
         text.includes('authorize') ||
         text.includes('auth');
}

/**
 * Find token input field
 */
function findTokenInput() {
  // Try multiple selectors
  for (const selector of SWAGGER_SELECTORS.TOKEN_INPUT) {
    const inputs = document.querySelectorAll(selector);
    for (const input of inputs) {
      if (looksLikeTokenInput(input)) {
        return input;
      }
    }
  }
  return null;
}

/**
 * Check if input looks like a token input
 */
function looksLikeTokenInput(input) {
  if (!input) return false;
  
  const placeholder = (input.placeholder || '').toLowerCase();
  const name = (input.name || '').toLowerCase();
  const value = (input.value || '').toLowerCase();
  
  return placeholder.includes('token') ||
         placeholder.includes('bearer') ||
         placeholder.includes('api') ||
         name.includes('token') ||
         name.includes('bearer') ||
         value.includes('bearer');
}

/**
 * Inject token into input field with format-aware logic
 */
function injectToken(input, token) {
  if (!input || !token) return;
  
  // Clear existing value
  input.value = '';
  
  // Clean token - remove any existing prefixes first
  let cleanToken = token.trim();
  cleanToken = cleanToken.replace(/^(Bearer|Token|ApiKey|bearer|token|apikey)\s+/i, '');
  
  // Apply formatting based on current settings
  let formattedToken;
  if (tokenFormatSettings.tokenFormat === 'prefix' && 
      tokenFormatSettings.tokenPrefix && 
      tokenFormatSettings.tokenPrefix.trim() !== '') {
    const prefix = tokenFormatSettings.tokenPrefix.trim();
    formattedToken = `${prefix} ${cleanToken}`;
  } else {
    // Plain token (no prefix)
    formattedToken = cleanToken;
  }
  
  // Set the formatted token
  input.value = formattedToken;
  input.setAttribute('value', formattedToken);
  
  // Trigger events to notify Swagger UI
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('keyup', { bubbles: true }));
}

/**
 * Main token injection logic
 */
async function attemptTokenInjection() {
  try {
    // Force reload settings before injection
    await loadTokenFormatSettings();
    
    if (!isChromeRuntimeAvailable()) {

      return false;
    }
    
    // Get active token
    const response = await chrome.runtime.sendMessage({
      action: 'GET_ROLE_TOKENS'
    });
    
    if (!response || !response.success) {
      return false;
    }
    
    const activeToken = response.activeToken;
    if (!activeToken || !activeToken.token) {
      return false;
    }
    
    // Find token input
    const tokenInput = findTokenInput();
    if (!tokenInput) {
      return false;
    }
    
    // Inject token
    injectToken(tokenInput, activeToken.token);
    
    return true;
  } catch (error) {

    return false;
  }
}

/**
 * Auto inject without submitting
 */
async function attemptAutoInjectToken() {
  await attemptTokenInjection();
}

// Initialize
loadTokenFormatSettings();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'UPDATE_SETTINGS') {
    loadTokenFormatSettings().then(() => {
      sendResponse({ success: true });
    });
  }
  
  return true; // Will respond asynchronously
});

// Auto-injection on page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(attemptTokenInjection, 1000);
});

// Also try when page is fully loaded
window.addEventListener('load', () => {
  setTimeout(attemptTokenInjection, 2000);
});
