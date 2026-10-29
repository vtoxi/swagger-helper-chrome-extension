/**
 * Token Manager Content Script
 * Handles role-based token management and injection
 */

// State management for token manager
const tokenManagerState = {
  settings: {},
  roleTokens: [],
  activeToken: null,
  tokenFormatSettings: {
    tokenFormat: 'value',
    tokenPrefix: '',
    tokenHeader: 'Authorization'
  },
  autoInject: true
};

// Swagger UI selectors for finding authorization components
const TOKEN_MANAGER_SELECTORS = {
  AUTHORIZE_BUTTON: [
    'button[class*="authorize"]',
    '.authorize-wrapper button',
    '.auth-wrapper button',
    'button:contains("Authorize")',
    '.btn-authorize',
    '.authorization__btn'
  ],
  AUTH_MODAL: [
    '.auth-container',
    '.auth-wrapper',
    '.modal-ux',
    '[class*="auth"][class*="modal"]',
    '.swagger-ui .auth-container',
    '.auth-popup-wrapper'
  ],
  TOKEN_INPUT: [
    'input[name*="token"]',
    'input[placeholder*="token"]',
    'input[type="text"][placeholder*="Bearer"]',
    'input[data-name*="token"]',
    '.auth-container input[type="text"]',
    '.token-input',
    'input[placeholder*="api"]',
    'input[placeholder*="key"]'
  ]
};

/**
 * Check if chrome.runtime is available
 */
// Track if extension context has been invalidated
let extensionContextInvalidated = false;

function isChromeRuntimeAvailable() {
  try {
    // If we know the context is invalidated, don't even try
    if (extensionContextInvalidated) {
      return false;
    }
    
    return typeof chrome !== 'undefined' && 
           chrome.runtime && 
           chrome.runtime.id && // Check if runtime.id exists (context valid)
           typeof chrome.runtime.sendMessage === 'function' &&
           !chrome.runtime.lastError;
  } catch (error) {
    // If we get an error accessing chrome.runtime.id, context is likely invalidated
    if (error.message && error.message.includes('Extension context invalidated')) {
      extensionContextInvalidated = true;
    }
    return false;
  }
}

/**
 * Safe chrome runtime message sender with retry and context invalidation handling
 */
async function safeSendMessage(message, retries = 3) {
  // Don't even try if extension context is invalidated
  if (extensionContextInvalidated) {
    throw new Error('Extension context has been invalidated - extension was likely reloaded');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!isChromeRuntimeAvailable()) {
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 100));
          continue;
        }
        throw new Error('Chrome runtime not available after retries');
      }
      
      // Double-check runtime availability right before the call
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Chrome runtime APIs not available at call time');
      }
      
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      // Check for extension context invalidation
      if (error.message && (
          error.message.includes('Extension context invalidated') ||
          error.message.includes('context invalidated') ||
          error.message.includes('Could not establish connection')
        )) {
        extensionContextInvalidated = true;
        throw new Error('Extension context invalidated - extension was likely reloaded');
      }
      
      if (attempt === retries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 100));
    }
  }
}

/**
 * Load token format settings from storage
 */
async function loadTokenFormatSettings() {
  try {
    const response = await safeSendMessage({
      action: 'GET_SETTINGS'
    });
    
    if (response && response.success && response.settings) {
      const settings = response.settings;
      tokenManagerState.tokenFormatSettings = {
        tokenFormat: settings.tokenFormat || 'value',
        tokenPrefix: settings.tokenPrefix || '',
        tokenHeader: settings.tokenHeader || 'Authorization'
      };
      tokenManagerState.autoInject = settings.autoInject !== false;
    } else {
      // Use defaults if no valid response
      setDefaultTokenFormatSettings();
    }
  } catch (error) {
    setDefaultTokenFormatSettings();
  }
}

/**
 * Set default token format settings
 */
function setDefaultTokenFormatSettings() {
  tokenManagerState.tokenFormatSettings = {
    tokenFormat: 'value',
    tokenPrefix: '',
    tokenHeader: 'Authorization'
  };
  tokenManagerState.autoInject = true;
}

/**
 * Load role tokens from storage
 */
async function loadRoleTokens() {
  try {
    const response = await safeSendMessage({
      action: 'GET_ROLE_TOKENS'
    });
    
    if (response && response.success) {
      tokenManagerState.roleTokens = response.tokens || [];
      tokenManagerState.activeToken = response.activeToken || null;
      tokenManagerState.autoInject = response.autoInject !== false;
    } else {
      // Use defaults if no valid response
      setDefaultRoleTokens();
    }
  } catch (error) {
    setDefaultRoleTokens();
  }
}

/**
 * Set default role tokens
 */
function setDefaultRoleTokens() {
  tokenManagerState.roleTokens = [];
  tokenManagerState.activeToken = null;
  tokenManagerState.autoInject = true;
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
 * Find token input field using multiple strategies
 */
function findTokenInput() {
  // Try multiple selectors in order of preference
  for (const selector of TOKEN_MANAGER_SELECTORS.TOKEN_INPUT) {
    const inputs = document.querySelectorAll(selector);
    for (const input of inputs) {
      if (looksLikeTokenInput(input)) {
        return input;
      }
    }
  }
  
  // Fallback: Look for any visible text input in auth containers
  const authContainers = document.querySelectorAll('.auth-container, .auth-wrapper, [class*="auth"]');
  for (const container of authContainers) {
    const textInputs = container.querySelectorAll('input[type="text"], input:not([type])');
    for (const input of textInputs) {
      if (looksLikeTokenInput(input) && isVisible(input)) {
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
  const id = (input.id || '').toLowerCase();
  
  // Check for token-related keywords
  const tokenKeywords = ['token', 'bearer', 'api', 'auth', 'key', 'jwt'];
  
  return tokenKeywords.some(keyword => 
    placeholder.includes(keyword) ||
    name.includes(keyword) ||
    value.includes(keyword) ||
    id.includes(keyword)
  );
}

/**
 * Check if element is visible
 */
function isVisible(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetWidth > 0 && 
         element.offsetHeight > 0;
}

/**
 * Inject token into input field with format-aware logic
 */
function injectToken(input, token, settings = null) {
  if (!input || !token) return false;
  
  const formatSettings = settings || tokenManagerState.tokenFormatSettings;
  
  // Clear existing value
  input.value = '';
  
  // Clean token - remove any existing prefixes first
  let cleanToken = token.trim();
  cleanToken = cleanToken.replace(/^(Bearer|Token|ApiKey|bearer|token|apikey)\s+/i, '');
  
  // Apply formatting based on current settings
  let formattedToken;
  if (formatSettings.tokenFormat === 'prefix' && 
      formatSettings.tokenPrefix && 
      formatSettings.tokenPrefix.trim() !== '') {
    const prefix = formatSettings.tokenPrefix.trim();
    formattedToken = `${prefix} ${cleanToken}`;
  } else {
    // Plain token (no prefix)
    formattedToken = cleanToken;
  }
  
  // Set the formatted token
  input.value = formattedToken;
  input.setAttribute('value', formattedToken);
  
  // Trigger events to notify Swagger UI
  const events = ['input', 'change', 'keyup', 'blur'];
  events.forEach(eventType => {
    input.dispatchEvent(new Event(eventType, { bubbles: true }));
  });
  
  // Also try dispatching as InputEvent for modern frameworks
  try {
    input.dispatchEvent(new InputEvent('input', { 
      bubbles: true, 
      cancelable: true, 
      data: formattedToken 
    }));
  } catch (e) {
    // Fallback if InputEvent is not supported
  }
  
  return true;
}

/**
 * Main token injection logic
 */
async function attemptTokenInjection() {
  try {
    // Force reload settings and tokens before injection (only if context is valid)
    if (!extensionContextInvalidated) {
      await loadTokenFormatSettings();
      await loadRoleTokens();
    }
    
    if (!tokenManagerState.activeToken || !tokenManagerState.activeToken.token) {
      const message = extensionContextInvalidated 
        ? 'Extension was reloaded - please refresh page and configure tokens again'
        : 'No active token selected';
      return { success: false, message };
    }
    
    // Find token input
    const tokenInput = findTokenInput();
    if (!tokenInput) {
      return { success: false, message: 'Could not find token input field in authorization modal' };
    }
    
    // Inject token
    const injected = injectToken(tokenInput, tokenManagerState.activeToken.token);
    
    if (injected) {
      return { success: true, message: 'Token injected successfully' };
    } else {
      return { success: false, message: 'Failed to inject token' };
    }
  } catch (error) {
    return { success: false, message: `Token injection failed: ${error.message}` };
  }
}

/**
 * Auto inject token without submitting
 */
async function attemptAutoInjectToken() {
  const result = await attemptTokenInjection();
  return result;
}

/**
 * Wait for authorization modal to appear and inject token
 */
function waitForAuthModalAndInject() {
  const checkForModal = () => {
    const modal = document.querySelector('.auth-container, .auth-wrapper, [class*="auth"][class*="modal"]');
    if (modal && isVisible(modal)) {
      setTimeout(() => attemptTokenInjection(), 500); // Small delay to ensure modal is fully loaded
      return true;
    }
    return false;
  };
  
  // Check immediately
  if (checkForModal()) return;
  
  // Watch for modal appearance
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (isAuthModal(node) || node.querySelector && node.querySelector('.auth-container, .auth-wrapper')) {
            setTimeout(() => {
              if (checkForModal()) {
                observer.disconnect();
              }
            }, 100);
          }
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Auto-disconnect after 30 seconds to prevent memory leaks
  setTimeout(() => observer.disconnect(), 30000);
}

/**
 * Watch for authorize button clicks
 */
function watchForAuthorizeButtons() {
  // Add click listeners to existing authorize buttons
  const addListenersToButtons = () => {
    const buttons = document.querySelectorAll('button');
    
    buttons.forEach(button => {
      if (isAuthorizeButton(button) && !button.hasAttribute('data-token-manager-listener')) {
        button.addEventListener('click', () => {
          if (tokenManagerState.autoInject && tokenManagerState.activeToken) {
            waitForAuthModalAndInject();
          }
        });
        button.setAttribute('data-token-manager-listener', 'true');
      }
    });
  };
  
  // Check immediately
  addListenersToButtons();
  
  // Watch for new buttons
  const observer = new MutationObserver(() => {
    addListenersToButtons();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Initialize token manager with safe loading
 */
async function initializeTokenManager() {
  try {
    // Load initial data with retries
    await loadTokenFormatSettings();
    await loadRoleTokens();
  } catch (error) {
    // Ensure we have defaults even if loading fails
    setDefaultTokenFormatSettings();
    setDefaultRoleTokens();
  }
  
  // Set up auto-injection behavior
  if (tokenManagerState.autoInject) {
    watchForAuthorizeButtons();
  }
  
  // Try immediate injection if modal is already open
  setTimeout(() => {
    const modal = document.querySelector('.auth-container, .auth-wrapper');
    if (modal && isVisible(modal)) {
      attemptTokenInjection();
    }
  }, 1000);
}

/**
 * Show user-friendly message about extension state
 */
function showExtensionStatusMessage() {
  if (extensionContextInvalidated) {
    // Show a subtle notification if we can
    try {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fef3c7;
        color: #92400e;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid #f59e0b;
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        max-width: 300px;
      `;
      notification.innerHTML = '🔄 Swagger Helper was updated - refresh page for full functionality';
      document.body.appendChild(notification);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 5000);
    } catch (e) {
      // Ignore if we can't show the notification
    }
  }
}

/**
 * Safe initialization with extended delay and retries
 */
async function safeInitialize() {
  const maxAttempts = 5;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Progressive delay: 200ms, 400ms, 600ms, 800ms, 1000ms
      const delay = attempt * 200;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Check if extension context was invalidated
      if (extensionContextInvalidated) {
        showExtensionStatusMessage();
        // Still set up fallback functionality
        setDefaultTokenFormatSettings();
        setDefaultRoleTokens();
        return;
      }
      
      // Check if Chrome runtime is available before proceeding
      if (isChromeRuntimeAvailable()) {
        await initializeTokenManager();
        return; // Success, exit the retry loop
      } else {
        if (attempt === maxAttempts) {
          throw new Error('Chrome runtime never became available');
        }
      }
    } catch (error) {
      // Check if this is a context invalidation error
      if (error.message && error.message.includes('Extension context invalidated')) {
        showExtensionStatusMessage();
        setDefaultTokenFormatSettings();
        setDefaultRoleTokens();
        return;
      }
      
      if (attempt === maxAttempts) {
        // Fallback to defaults
        setDefaultTokenFormatSettings();
        setDefaultRoleTokens();
        
        // Still try to set up watching
        if (tokenManagerState.autoInject) {
          watchForAuthorizeButtons();
        }
        return;
      }
    }
  }
}

// Safe message listener setup
function setupMessageListener() {
  try {
    if (!isChromeRuntimeAvailable()) {
      return;
    }
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      const handleMessage = async () => {
        try {
          switch (request.action) {
            
            case 'UPDATE_SETTINGS':
              await loadTokenFormatSettings();
              await loadRoleTokens();
              sendResponse({ success: true });
              break;
              
            case 'RELOAD_TOKENS':
              await loadRoleTokens();
              sendResponse({ success: true });
              break;
              
            default:
              sendResponse({ success: false, message: 'Unknown action' });
          }
        } catch (error) {
          sendResponse({ success: false, message: error.message });
        }
      };
      
      handleMessage();
      return true; // Will respond asynchronously
    });
  } catch (error) {
    // Failed to setup message listener
  }
}

// Setup message listener with delay
setTimeout(setupMessageListener, 100);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInitialize);
} else {
  safeInitialize();
}

// Also initialize when page is fully loaded with additional delay
window.addEventListener('load', () => {
  setTimeout(safeInitialize, 2000);
});

// Backup initialization with even longer delay
setTimeout(safeInitialize, 3000);

// Export for debugging
window.TokenManager = {
  attemptTokenInjection,
  attemptAutoInjectToken,
  loadTokenFormatSettings,
  loadRoleTokens,
  findTokenInput,
  state: tokenManagerState,
  extensionContextInvalidated: () => extensionContextInvalidated,
  isChromeRuntimeAvailable,
  showExtensionStatusMessage
};