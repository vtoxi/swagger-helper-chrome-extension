/**
 * UI Enhancer Content Script
 * Provides UI improvements for Swagger UI
 */

// State management for UI enhancements
const uiEnhancerState = {
  darkMode: false,
  autoCollapse: false,
  copyButtons: true,
  enhancementsApplied: false
};

// Swagger UI selectors for UI elements
const UI_ENHANCER_SELECTORS = {
  SWAGGER_CONTAINER: [
    '.swagger-ui',
    '#swagger-ui',
    '.swagger-wrapper'
  ],
  OPERATIONS: [
    '.opblock',
    '.operation-tag-content .opblock'
  ],
  OPERATION_TAGS: [
    '.opblock-tag-section',
    '.operation-tag',
    '[class*="opblock-tag"]'
  ],
  COLLAPSE_BUTTONS: [
    '.expand-operation',
    '[class*="expand"]',
    '.opblock-summary'
  ]
};

/**
 * Check if chrome.runtime is available
 */
function isChromeRuntimeAvailable() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
}

/**
 * Load UI settings from storage
 */
async function loadUISettings() {
  try {
    if (!isChromeRuntimeAvailable()) {

      uiEnhancerState.darkMode = false;
      uiEnhancerState.autoCollapse = false;
      uiEnhancerState.copyButtons = true;
      return;
    }

    const response = await chrome.runtime.sendMessage({ action: 'GET_SETTINGS' });
    
    if (response && response.success && response.settings) {
      const settings = response.settings;
      uiEnhancerState.darkMode = settings.darkMode || false;
      uiEnhancerState.autoCollapse = settings.autoCollapse || false;
      uiEnhancerState.copyButtons = settings.copyButtons !== false; // default true
    }
  } catch (error) {

  }
}

/**
 * Apply dark mode styles
 */
function applyDarkMode() {
  // Remove existing dark mode styles
  const existingStyles = document.querySelector('#swagger-helper-dark-mode');
  if (existingStyles) {
    existingStyles.remove();
  }
  
  if (!uiEnhancerState.darkMode) return;
  
  const darkModeCSS = `
    /* Dark Mode Styles for Swagger UI */
    .swagger-ui {
      filter: invert(1) hue-rotate(180deg);
      background: #1a1a1a !important;
    }
    
    .swagger-ui .info {
      filter: invert(1) hue-rotate(180deg);
    }
    
    .swagger-ui .opblock {
      filter: invert(1) hue-rotate(180deg);
      background: #2d2d2d !important;
      border: 1px solid #404040 !important;
    }
    
    .swagger-ui .opblock .opblock-summary {
      border-bottom: 1px solid #404040 !important;
    }
    
    .swagger-ui .opblock.opblock-get {
      background: #1a2332 !important;
      border-color: #4a90e2 !important;
    }
    
    .swagger-ui .opblock.opblock-post {
      background: #1a3222 !important;
      border-color: #5cb85c !important;
    }
    
    .swagger-ui .opblock.opblock-put {
      background: #322a1a !important;
      border-color: #f0ad4e !important;
    }
    
    .swagger-ui .opblock.opblock-delete {
      background: #321a1a !important;
      border-color: #d9534f !important;
    }
    
    .swagger-ui .parameters,
    .swagger-ui .responses-wrapper {
      filter: invert(1) hue-rotate(180deg);
      background: #2d2d2d !important;
    }
    
    .swagger-ui input,
    .swagger-ui textarea,
    .swagger-ui select {
      background: #404040 !important;
      color: #ffffff !important;
      border: 1px solid #666666 !important;
    }
    
    .swagger-ui .btn {
      filter: invert(1) hue-rotate(180deg);
    }
    
    /* Environment banner removed - using FAB instead */
    
    /* Copy button dark mode adjustment */
    .copy-curl-btn {
      filter: none !important;
    }
  `;
  
  const styleElement = document.createElement('style');
  styleElement.id = 'swagger-helper-dark-mode';
  styleElement.textContent = darkModeCSS;
  document.head.appendChild(styleElement);
}

/**
 * Remove dark mode styles
 */
function removeDarkMode() {
  const existingStyles = document.querySelector('#swagger-helper-dark-mode');
  if (existingStyles) {
    existingStyles.remove();
  }
}

/**
 * Collapse all operations
 */
function collapseAllOperations() {
  const operations = document.querySelectorAll('.opblock:not(.is-open)');
  
  operations.forEach(operation => {
    // Find collapse button and click it if operation is expanded
    const isExpanded = operation.classList.contains('is-open');
    if (isExpanded) {
      const collapseButton = operation.querySelector('.opblock-summary, .expand-operation');
      if (collapseButton) {
        collapseButton.click();
      }
    }
  });
}

/**
 * Expand all operations
 */
function expandAllOperations() {
  const operations = document.querySelectorAll('.opblock:not(.is-open)');
  
  operations.forEach(operation => {
    // Find expand button and click it if operation is collapsed
    const isExpanded = operation.classList.contains('is-open');
    if (!isExpanded) {
      const expandButton = operation.querySelector('.opblock-summary, .expand-operation');
      if (expandButton) {
        expandButton.click();
      }
    }
  });
}

/**
 * Add keyboard shortcuts
 */
function addKeyboardShortcuts() {
  // Remove existing listener
  document.removeEventListener('keydown', handleKeyboardShortcuts);
  
  // Add new listener
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(event) {
  // Only handle shortcuts when not in input fields
  const activeElement = document.activeElement;
  const isInputField = activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.contentEditable === 'true'
  );
  
  if (isInputField) return;
  
  // Check for modifier keys (Ctrl/Cmd + Shift + key)
  const isModifierPressed = (event.ctrlKey || event.metaKey) && event.shiftKey;
  
  if (!isModifierPressed) return;
  
  switch (event.key.toLowerCase()) {
    case 'c': // Ctrl/Cmd + Shift + C: Collapse all
      event.preventDefault();
      collapseAllOperations();
      showNotification('All operations collapsed', 'info');
      break;
      
    case 'e': // Ctrl/Cmd + Shift + E: Expand all
      event.preventDefault();
      expandAllOperations();
      showNotification('All operations expanded', 'info');
      break;
      
    case 'd': // Ctrl/Cmd + Shift + D: Toggle dark mode
      event.preventDefault();
      toggleDarkMode();
      break;
      
    case 'f': // Ctrl/Cmd + Shift + F: Focus search
      event.preventDefault();
      focusSearchField();
      break;
  }
}

/**
 * Toggle dark mode
 */
async function toggleDarkMode() {
  uiEnhancerState.darkMode = !uiEnhancerState.darkMode;
  
  if (uiEnhancerState.darkMode) {
    applyDarkMode();
    showNotification('Dark mode enabled', 'info');
  } else {
    removeDarkMode();
    showNotification('Dark mode disabled', 'info');
  }
  
  // Save setting
  await saveUISettings();
}

/**
 * Focus search field
 */
function focusSearchField() {
  // Try different search field selectors
  const searchSelectors = [
    '.swagger-ui .filter input',
    'input[placeholder*="filter"]',
    'input[placeholder*="search"]',
    '.filter-container input'
  ];
  
  for (const selector of searchSelectors) {
    const searchField = document.querySelector(selector);
    if (searchField) {
      searchField.focus();
      searchField.select();
      showNotification('Search field focused', 'info');
      return;
    }
  }
  
  showNotification('Search field not found', 'warning');
}

/**
 * Save UI settings
 */
async function saveUISettings() {
  try {
    if (!isChromeRuntimeAvailable()) {

      return;
    }

    const response = await chrome.runtime.sendMessage({ action: 'GET_SETTINGS' });
    if (response && response.success) {
      const updatedSettings = {
        ...response.settings,
        darkMode: uiEnhancerState.darkMode,
        autoCollapse: uiEnhancerState.autoCollapse,
        copyButtons: uiEnhancerState.copyButtons
      };
      
      await chrome.runtime.sendMessage({
        action: 'SAVE_SETTINGS',
        settings: updatedSettings
      });
    }
  } catch (error) {

  }
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
  // Create or update notification element
  let notification = document.querySelector('.ui-enhancer-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.className = 'ui-enhancer-notification';
    notification.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      padding: 8px 12px;
      border-radius: 4px;
      color: white;
      font-size: 13px;
      z-index: 10001;
      transition: opacity 0.3s;
      font-family: sans-serif;
    `;
    document.body.appendChild(notification);
  }
  
  // Set message and style based on type
  notification.textContent = message;
  notification.style.backgroundColor = type === 'info' ? '#2196F3' : 
                                       type === 'warning' ? '#FF9800' : '#4CAF50';
  notification.style.opacity = '1';
  
  // Auto hide after 2 seconds
  setTimeout(() => {
    if (notification) {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 2000);
}

/**
 * Apply auto-collapse on page load
 */
function applyAutoCollapse() {
  if (!uiEnhancerState.autoCollapse) return;
  
  // Wait for operations to load, then collapse them
  setTimeout(() => {
    const operations = document.querySelectorAll('.opblock');
    if (operations.length > 0) {
      collapseAllOperations();
    }
  }, 2000);
  
  // Also watch for dynamically loaded operations
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE &&
            node.matches && node.matches('.opblock')) {
          // New operation added, collapse it if auto-collapse is enabled
          if (uiEnhancerState.autoCollapse) {
            setTimeout(() => {
              const isExpanded = node.classList.contains('is-open');
              if (isExpanded) {
                const collapseButton = node.querySelector('.opblock-summary');
                if (collapseButton) {
                  collapseButton.click();
                }
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
}

/**
 * Apply all UI enhancements
 */
function applyUIEnhancements() {
  if (uiEnhancerState.enhancementsApplied) return;
  
  // Apply dark mode if enabled
  if (uiEnhancerState.darkMode) {
    applyDarkMode();
  }
  
  // Apply auto-collapse if enabled
  if (uiEnhancerState.autoCollapse) {
    applyAutoCollapse();
  }
  
  // Add keyboard shortcuts
  addKeyboardShortcuts();
  
  uiEnhancerState.enhancementsApplied = true;
}

/**
 * Initialize UI enhancer
 */
async function initializeUIEnhancer() {
  // Load settings
  await loadUISettings();
  
  // Apply enhancements
  applyUIEnhancements();
}

// Message listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleMessage = async () => {
    try {
      switch (request.action) {
        case 'UPDATE_SETTINGS':
          await loadUISettings();
          
          // Reapply enhancements
          if (uiEnhancerState.darkMode) {
            applyDarkMode();
          } else {
            removeDarkMode();
          }
          
          sendResponse({ success: true });
          break;
          
        case 'TOGGLE_DARK_MODE':
          await toggleDarkMode();
          sendResponse({ success: true, darkMode: uiEnhancerState.darkMode });
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
  document.addEventListener('DOMContentLoaded', initializeUIEnhancer);
} else {
  initializeUIEnhancer();
}

// Also initialize when page is fully loaded
window.addEventListener('load', () => {
  setTimeout(initializeUIEnhancer, 1000);
});

// Export for debugging
window.UIEnhancer = {
  applyDarkMode,
  removeDarkMode,
  collapseAllOperations,
  expandAllOperations,
  toggleDarkMode,
  state: uiEnhancerState
};