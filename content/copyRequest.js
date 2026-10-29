/**
 * Copy Request Content Script
 * Adds copy as cURL functionality to Swagger UI
 */

// State management for copy request functionality
const copyRequestState = {
  enabled: true,
  tokenFormatSettings: {
    tokenFormat: 'value',
    tokenPrefix: '',
    tokenHeader: 'Authorization'
  },
  activeToken: null
};

// Swagger UI selectors for operations
const COPY_REQUEST_SELECTORS = {
  OPERATIONS: [
    '.opblock',
    '.operation-tag-content .opblock',
    '[class*="opblock"]'
  ],
  OPERATION_HEADER: [
    '.opblock-summary',
    '.opblock-summary-description',
    '.operation-summary'
  ],
  TRY_IT_BUTTON: [
    '.try-out__btn',
    'button[class*="try"]',
    '.btn.try-out'
  ],
  EXECUTE_BUTTON: [
    '.execute-wrapper .btn',
    'button.execute',
    '[class*="execute"]'
  ]
};

/**
 * Check if chrome.runtime is available
 */
function isChromeRuntimeAvailable() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  try {
    if (!isChromeRuntimeAvailable()) {

      copyRequestState.enabled = true;
      copyRequestState.tokenFormatSettings = {
        tokenFormat: 'value',
        tokenPrefix: '',
        tokenHeader: 'Authorization'
      };
      copyRequestState.activeToken = null;
      return;
    }

    const [settingsResponse, tokensResponse] = await Promise.all([
      chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }),
      chrome.runtime.sendMessage({ action: 'GET_ROLE_TOKENS' })
    ]);
    
    if (settingsResponse && settingsResponse.success && settingsResponse.settings) {
      const settings = settingsResponse.settings;
      copyRequestState.enabled = settings.copyButtons !== false;
      copyRequestState.tokenFormatSettings = {
        tokenFormat: settings.tokenFormat || 'value',
        tokenPrefix: settings.tokenPrefix || '',
        tokenHeader: settings.tokenHeader || 'Authorization'
      };
    }
    
    if (tokensResponse && tokensResponse.success) {
      copyRequestState.activeToken = tokensResponse.activeToken || null;
    }
  } catch (error) {

  }
}

/**
 * Extract request details from Swagger UI operation
 */
function extractRequestDetails(operationElement) {
  try {
    // Get method and path
    const method = getOperationMethod(operationElement);
    const path = getOperationPath(operationElement);
    
    if (!method || !path) {
      return null;
    }
    
    // Get base URL
    const baseUrl = getBaseUrl();
    const fullUrl = `${baseUrl}${path}`;
    
    // Extract parameters and body
    const parameters = extractParameters(operationElement);
    const body = extractRequestBody(operationElement);
    
    // Build headers
    const headers = buildHeaders();
    
    return {
      method: method.toUpperCase(),
      url: fullUrl,
      headers,
      body,
      parameters
    };
  } catch (error) {

    return null;
  }
}

/**
 * Get operation method (GET, POST, etc.)
 */
function getOperationMethod(operationElement) {
  // Try to find method from class names
  const classList = operationElement.classList;
  for (const className of classList) {
    const lowerClass = className.toLowerCase();
    if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(lowerClass)) {
      return lowerClass.toUpperCase();
    }
  }
  
  // Try to find from method label
  const methodLabel = operationElement.querySelector('.opblock-summary-method, [class*="method"]');
  if (methodLabel) {
    return methodLabel.textContent.trim().toUpperCase();
  }
  
  return null;
}

/**
 * Get operation path
 */
function getOperationPath(operationElement) {
  const pathElement = operationElement.querySelector('.opblock-summary-path, [class*="path"], .opblock-summary-path-description-wrapper');
  if (pathElement) {
    return pathElement.textContent.trim();
  }
  
  return null;
}

/**
 * Get base URL for the API
 */
function getBaseUrl() {
  // Try to get from servers dropdown
  const serverSelect = document.querySelector('select[class*="servers"], .servers select');
  if (serverSelect && serverSelect.value) {
    return serverSelect.value;
  }
  
  // Try to get from servers section
  const serverUrl = document.querySelector('.servers .url, [class*="server"] .url');
  if (serverUrl) {
    return serverUrl.textContent.trim();
  }
  
  // Fallback to current origin
  return window.location.origin;
}

/**
 * Extract parameters from operation
 */
function extractParameters(operationElement) {
  const parameters = {};
  
  // Query parameters
  const queryParams = operationElement.querySelectorAll('.parameters input[placeholder*="query"], .parameter-item input');
  queryParams.forEach(input => {
    const name = getParameterName(input);
    if (name && input.value) {
      parameters[name] = input.value;
    }
  });
  
  return parameters;
}

/**
 * Get parameter name from input element
 */
function getParameterName(input) {
  // Try data attributes
  if (input.dataset.paramName) {
    return input.dataset.paramName;
  }
  
  // Try name attribute
  if (input.name) {
    return input.name;
  }
  
  // Try to find from label or parent
  const parameterRow = input.closest('.parameter-item, .parameter, tr');
  if (parameterRow) {
    const label = parameterRow.querySelector('label, .parameter-item-name, .parameter-name');
    if (label) {
      return label.textContent.trim();
    }
  }
  
  return null;
}

/**
 * Extract request body
 */
function extractRequestBody(operationElement) {
  const bodyTextarea = operationElement.querySelector('.body-param textarea, [class*="body"] textarea');
  if (bodyTextarea && bodyTextarea.value.trim()) {
    try {
      return JSON.parse(bodyTextarea.value);
    } catch (e) {
      return bodyTextarea.value; // Return as string if not valid JSON
    }
  }
  
  return null;
}

/**
 * Build headers including authentication
 */
function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  // Add authentication header if active token exists
  if (copyRequestState.activeToken && copyRequestState.activeToken.token) {
    const token = copyRequestState.activeToken.token;
    const settings = copyRequestState.tokenFormatSettings;
    
    // Clean token - remove any existing prefixes first
    let cleanToken = token.trim();
    cleanToken = cleanToken.replace(/^(Bearer|Token|ApiKey|bearer|token|apikey)\s+/i, '');
    
    // Apply formatting based on current settings
    let formattedToken;
    if (settings.tokenFormat === 'prefix' && 
        settings.tokenPrefix && 
        settings.tokenPrefix.trim() !== '') {
      const prefix = settings.tokenPrefix.trim();
      formattedToken = `${prefix} ${cleanToken}`;
    } else {
      // Plain token (no prefix)
      formattedToken = cleanToken;
    }
    
    const headerName = settings.tokenHeader || 'Authorization';
    headers[headerName] = formattedToken;
  }
  
  return headers;
}

/**
 * Generate cURL command from request details
 */
function generateCurlCommand(requestDetails) {
  if (!requestDetails) return null;
  
  let curl = `curl -X ${requestDetails.method}`;
  
  // Add URL
  let url = requestDetails.url;
  
  // Add query parameters to URL
  if (requestDetails.parameters && Object.keys(requestDetails.parameters).length > 0) {
    const params = new URLSearchParams(requestDetails.parameters);
    url += (url.includes('?') ? '&' : '?') + params.toString();
  }
  
  curl += ` "${url}"`;
  
  // Add headers
  if (requestDetails.headers) {
    Object.entries(requestDetails.headers).forEach(([key, value]) => {
      curl += ` \\\n  -H "${key}: ${value}"`;
    });
  }
  
  // Add body
  if (requestDetails.body) {
    const bodyString = typeof requestDetails.body === 'string' 
      ? requestDetails.body 
      : JSON.stringify(requestDetails.body);
    
    curl += ` \\\n  -d '${bodyString}'`;
  }
  
  return curl;
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (error) {

    return false;
  }
}

/**
 * Create copy cURL button
 */
function createCopyButton(operationElement) {
  const button = document.createElement('button');
  button.className = 'btn btn-sm copy-curl-btn';
  button.innerHTML = '📋 Copy cURL';
  button.title = 'Copy as cURL command';
  button.style.cssText = `
    background: #4CAF50;
    color: white;
    border: none;
    padding: 4px 8px;
    margin: 0 4px;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.2s;
  `;
  
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // Ensure we have latest settings
      await loadSettings();
      
      const requestDetails = extractRequestDetails(operationElement);
      if (!requestDetails) {
        showNotification('Failed to extract request details', 'error');
        return;
      }
      
      const curlCommand = generateCurlCommand(requestDetails);
      if (!curlCommand) {
        showNotification('Failed to generate cURL command', 'error');
        return;
      }
      
      const copied = await copyToClipboard(curlCommand);
      if (copied) {
        showNotification('cURL command copied to clipboard!', 'success');
        
        // Visual feedback
        const originalText = button.innerHTML;
        button.innerHTML = '✅ Copied!';
        button.style.background = '#2196F3';
        
        setTimeout(() => {
          button.innerHTML = originalText;
          button.style.background = '#4CAF50';
        }, 2000);
      } else {
        showNotification('Failed to copy to clipboard', 'error');
      }
    } catch (error) {

      showNotification('Error copying cURL command', 'error');
    }
  });
  
  button.addEventListener('mouseenter', () => {
    button.style.background = '#45a049';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.background = '#4CAF50';
  });
  
  return button;
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
  // Create or update notification element
  let notification = document.querySelector('.copy-curl-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.className = 'copy-curl-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 15px;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      z-index: 10000;
      transition: opacity 0.3s;
    `;
    document.body.appendChild(notification);
  }
  
  // Set message and style based on type
  notification.textContent = message;
  notification.style.backgroundColor = type === 'success' ? '#4CAF50' : 
                                       type === 'error' ? '#f44336' : '#2196F3';
  notification.style.opacity = '1';
  
  // Auto hide after 3 seconds
  setTimeout(() => {
    if (notification) {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 3000);
}

/**
 * Add copy buttons to operations
 */
function addCopyButtonsToOperations() {
  if (!copyRequestState.enabled) return;
  
  const operations = document.querySelectorAll('.opblock:not([data-copy-button-added])');
  
  operations.forEach(operation => {
    // Mark as processed
    operation.setAttribute('data-copy-button-added', 'true');
    
    // Find a good place to insert the button
    const summary = operation.querySelector('.opblock-summary, .opblock-summary-description');
    if (summary) {
      // Create button container
      let buttonContainer = summary.querySelector('.copy-button-container');
      if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = 'copy-button-container';
        buttonContainer.style.cssText = 'display: inline-block; margin-left: 10px;';
        summary.appendChild(buttonContainer);
      }
      
      // Add copy button
      const copyButton = createCopyButton(operation);
      buttonContainer.appendChild(copyButton);
    }
  });
}

/**
 * Remove copy buttons from operations
 */
function removeCopyButtons() {
  const buttons = document.querySelectorAll('.copy-curl-btn');
  const containers = document.querySelectorAll('.copy-button-container');
  
  buttons.forEach(button => button.remove());
  containers.forEach(container => container.remove());
  
  // Remove markers
  document.querySelectorAll('[data-copy-button-added]').forEach(el => {
    el.removeAttribute('data-copy-button-added');
  });
}

/**
 * Watch for new operations and add buttons
 */
function watchForNewOperations() {
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches && node.matches('.opblock, [class*="opblock"]')) {
            shouldCheck = true;
          } else if (node.querySelector && node.querySelector('.opblock, [class*="opblock"]')) {
            shouldCheck = true;
          }
        }
      });
    });
    
    if (shouldCheck) {
      setTimeout(addCopyButtonsToOperations, 100);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  return observer;
}

/**
 * Initialize copy request functionality
 */
async function initializeCopyRequest() {

  
  // Load settings
  await loadSettings();
  

  
  if (copyRequestState.enabled) {

    // Add buttons to existing operations
    addCopyButtonsToOperations();
    
    // Watch for new operations
    watchForNewOperations();
  } else {

  }
}

// Message listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleMessage = async () => {
    try {
      switch (request.action) {
        case 'UPDATE_SETTINGS':

          await loadSettings();
          

          
          if (copyRequestState.enabled) {
            addCopyButtonsToOperations();
          } else {
            removeCopyButtons();
          }
          
          sendResponse({ success: true });
          break;
          
        case 'RELOAD_TOKENS':
          await loadSettings();
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCopyRequest);
} else {
  initializeCopyRequest();
}

// Also initialize when page is fully loaded
window.addEventListener('load', () => {
  setTimeout(initializeCopyRequest, 1000);
});

// Export for debugging
window.CopyRequest = {
  extractRequestDetails,
  generateCurlCommand,
  addCopyButtonsToOperations,
  removeCopyButtons,
  state: copyRequestState
};