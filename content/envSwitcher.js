/**
 * Environment Switcher Content Script
 * Handles environment switching in Swagger UI
 */

// State management for environment switcher
const envSwitcherState = {
  currentEnvironment: 'local',
  environments: {},
  baseUrl: ''
};

// Swagger UI selectors for server/base URL elements
const ENV_SWITCHER_SELECTORS = {
  SERVERS_SECTION: [
    '.servers',
    '.servers-wrapper',
    '.scheme-container'
  ],
  SERVER_SELECT: [
    'select.servers',
    '.servers select',
    'select[class*="server"]'
  ],
  SERVER_URL: [
    '.servers .url',
    '.server-url',
    '[class*="server"] .url'
  ],
  INFO_SECTION: [
    '.info',
    '.api-info',
    '.swagger-ui .info'
  ]
};

/**
 * Check if chrome.runtime is available
 */
function isChromeRuntimeAvailable() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
}

/**
 * Load environment settings from storage
 */
async function loadEnvironmentSettings() {
  try {
    if (!isChromeRuntimeAvailable()) {

      envSwitcherState.environments = {};
      envSwitcherState.currentEnvironment = 'local';
      return;
    }

    const [envResponse, settingsResponse] = await Promise.all([
      chrome.runtime.sendMessage({ action: 'GET_ENVIRONMENTS' }),
      chrome.runtime.sendMessage({ action: 'GET_SETTINGS' })
    ]);
    
    if (envResponse && envResponse.success) {
      envSwitcherState.environments = envResponse.environments || {};
    }
    
    if (settingsResponse && settingsResponse.success && settingsResponse.settings) {
      envSwitcherState.currentEnvironment = settingsResponse.settings.currentEnvironment || 'local';
    }
  } catch (error) {

  }
}

/**
 * Get current base URL from Swagger UI
 */
function getCurrentBaseUrl() {
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
  
  // Try to get from spec URL or current location
  return window.location.origin;
}

/**
 * Update Swagger UI base URL
 */
function updateSwaggerBaseUrl(newBaseUrl) {
  try {
    // Update server dropdown if exists
    const serverSelect = document.querySelector('select[class*="servers"], .servers select');
    if (serverSelect) {
      // Check if the URL already exists as an option
      let optionExists = false;
      for (const option of serverSelect.options) {
        if (option.value === newBaseUrl) {
          option.selected = true;
          optionExists = true;
          break;
        }
      }
      
      // If option doesn't exist, add it and select it
      if (!optionExists) {
        const newOption = document.createElement('option');
        newOption.value = newBaseUrl;
        newOption.textContent = newBaseUrl;
        newOption.selected = true;
        serverSelect.appendChild(newOption);
      }
      
      // Trigger change event
      serverSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Update server URL display
    const serverUrlDisplay = document.querySelector('.servers .url, [class*="server"] .url');
    if (serverUrlDisplay) {
      serverUrlDisplay.textContent = newBaseUrl;
    }
    
    // Try to update through Swagger UI API if available
    if (window.ui && typeof window.ui.updateSpec === 'function') {
      const currentSpec = window.ui.getStore().getState().spec.json;
      if (currentSpec && currentSpec.servers) {
        currentSpec.servers[0] = { url: newBaseUrl };
        window.ui.updateSpec(currentSpec);
      }
    }
    
    envSwitcherState.baseUrl = newBaseUrl;
    return true;
  } catch (error) {

    return false;
  }
}

/**
 * Create floating FAB (Floating Action Button) with comprehensive status information
 */
function createFloatingFAB() {
  // Remove existing FAB
  const existingFAB = document.querySelector('.swagger-helper-fab');
  if (existingFAB) {
    existingFAB.remove();
  }
  
  // Get current environment info for initial display (use selected environment)
  const currentEnvName = envSwitcherState.currentEnvironment || 'unknown';
  let currentBaseUrl = envSwitcherState.baseUrl;
  
  // If we have a selected environment, use its URL
  if (currentEnvName && envSwitcherState.environments[currentEnvName]) {
    currentBaseUrl = envSwitcherState.environments[currentEnvName];
  } else {
    currentBaseUrl = getCurrentBaseUrl();
  }
  
  const fab = document.createElement('div');
  fab.className = 'swagger-helper-fab';
  fab.innerHTML = `
    <!-- FAB Main Button -->
    <div class="fab-main" id="fabMain">
      <div class="fab-icon">
        <span class="fab-logo">🚀</span>
        <span class="fab-status-dot" id="fabStatusDot">⚪</span>
      </div>
      <div class="fab-preview" id="fabPreview">
        <div class="fab-env-preview" id="fabEnvPreview">${currentEnvName.toUpperCase()}</div>
        <div class="fab-token-preview" id="fabTokenPreview">No Token</div>
      </div>
    </div>
    
    <!-- Expanded Panel -->
    <div class="fab-panel" id="fabPanel" style="display: none;">
      <div class="fab-panel-header">
        <div class="fab-panel-title">
          <span>${currentEnvName.toUpperCase()}</span>
        </div>
        <button class="fab-close-btn" id="fabCloseBtn">✕</button>
      </div>
      
      <div class="fab-panel-content">
        <!-- Environment Info -->
        <div class="fab-info-section">
          <div class="fab-info-header">
            <span class="fab-info-icon">🌍</span>
            <span class="fab-info-label">Server URL</span>
          </div>
          <div class="fab-info-content">
            <div class="fab-env-url" id="fabEnvUrl" title="${currentBaseUrl}">${currentBaseUrl}</div>
          </div>
        </div>
        
        <!-- Token Info -->
        <div class="fab-info-section" id="fabTokenSection" style="display: none;">
          <div class="fab-info-header">
            <span class="fab-info-icon">🔐</span>
            <span class="fab-info-label">Active Token</span>
            <button class="fab-copy-btn" id="fabCopyBtn" title="Copy token">📋</button>
          </div>
          <div class="fab-info-content">
            <div class="fab-token-name" id="fabTokenName">No Token</div>
            <div class="fab-token-validity" id="fabTokenValidity">
              <span class="fab-validity-indicator" id="fabValidityIndicator">⚪</span>
              <span class="fab-validity-text" id="fabValidityText">Unknown</span>
            </div>
          </div>
        </div>
        
        <!-- Expiry Info -->
        <div class="fab-info-section" id="fabExpirySection" style="display: none;">
          <div class="fab-info-header">
            <span class="fab-info-icon">⏰</span>
            <span class="fab-info-label">Token Expiry</span>
          </div>
          <div class="fab-info-content">
            <div class="fab-expiry-time" id="fabExpiryTime">-</div>
            <div class="fab-expiry-countdown" id="fabExpiryCountdown">-</div>
          </div>
        </div>
        
        <!-- Quick Actions -->
        <div class="fab-actions">
          <button class="fab-action-btn" id="fabRefreshBtn" title="Refresh token info">🔄</button>
          <button class="fab-action-btn" id="fabSettingsBtn" title="Open extension popup">⚙️</button>
        </div>
      </div>
    </div>
  `;
  
  // Apply FAB styles
  applyFABStyles(fab);
  
  // Set up event listeners
  setupFABEventListeners(fab);
  
  return fab;
}

/**
 * Apply modern FAB styles
 */
function applyFABStyles(fab) {
  // Main FAB container
  fab.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // FAB main button styles
  const fabMain = fab.querySelector('.fab-main');
  fabMain.style.cssText = `
    display: flex;
    align-items: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 50px;
    padding: 12px 16px;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    max-width: 280px;
    min-width: 60px;
  `;
  
  // FAB icon container
  const fabIcon = fab.querySelector('.fab-icon');
  fabIcon.style.cssText = `
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
    flex-shrink: 0;
  `;
  
  // FAB logo
  const fabLogo = fab.querySelector('.fab-logo');
  fabLogo.style.cssText = `
    font-size: 20px;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
  `;
  
  // Status dot
  const fabStatusDot = fab.querySelector('.fab-status-dot');
  fabStatusDot.style.cssText = `
    position: absolute;
    top: -2px;
    right: -2px;
    font-size: 8px;
    background: white;
    border-radius: 50%;
    width: 12px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // FAB preview
  const fabPreview = fab.querySelector('.fab-preview');
  fabPreview.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    flex: 1;
    min-width: 0;
  `;
  
  // Environment preview
  const fabEnvPreview = fab.querySelector('.fab-env-preview');
  fabEnvPreview.style.cssText = `
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;
  
  // Token preview
  const fabTokenPreview = fab.querySelector('.fab-token-preview');
  fabTokenPreview.style.cssText = `
    font-size: 10px;
    opacity: 0.8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;
  
  // FAB Panel
  const fabPanel = fab.querySelector('.fab-panel');
  fabPanel.style.cssText = `
    position: absolute;
    bottom: 80px;
    right: 0;
    width: 320px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    overflow: hidden;
    transform: scale(0.8) translateY(20px);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    max-height: 80vh;
    overflow-y: auto;
  `;
  
  // Panel header
  const fabPanelHeader = fab.querySelector('.fab-panel-header');
  fabPanelHeader.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  `;
  
  // Panel title
  const fabPanelTitle = fab.querySelector('.fab-panel-title');
  fabPanelTitle.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
  `;
  
  // Close button
  const fabCloseBtn = fab.querySelector('.fab-close-btn');
  fabCloseBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 14px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  `;
  
  // Panel content
  const fabPanelContent = fab.querySelector('.fab-panel-content');
  fabPanelContent.style.cssText = `
    padding: 0;
  `;
  
  // Info sections
  const infoSections = fab.querySelectorAll('.fab-info-section');
  infoSections.forEach(section => {
    section.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid #f0f0f0;
    `;
  });
  
  // Info headers
  const infoHeaders = fab.querySelectorAll('.fab-info-header');
  infoHeaders.forEach(header => {
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      justify-content: space-between;
    `;
  });
  
  // Info labels
  const infoLabels = fab.querySelectorAll('.fab-info-label');
  infoLabels.forEach(label => {
    label.style.cssText = `
      font-weight: 600;
      font-size: 13px;
      color: #333;
    `;
  });
  
  // Info content
  const infoContents = fab.querySelectorAll('.fab-info-content');
  infoContents.forEach(content => {
    content.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;
  });
  
  // Environment URL styling
  const envUrl = fab.querySelector('#fabEnvUrl');
  if (envUrl) {
    envUrl.style.cssText = `
      font-family: monospace;
      font-size: 12px;
      color: #666;
      background: #f8f9fa;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #e9ecef;
      word-break: break-all;
      white-space: normal;
      line-height: 1.4;
      max-width: 100%;
      overflow-wrap: anywhere;
    `;
  }
  
  // Environment name styling
  const envName = fab.querySelector('#fabEnvName');
  if (envName) {
    envName.style.cssText = `
      font-weight: 600;
      font-size: 14px;
      color: #333;
      margin-bottom: 4px;
    `;
  }
  
  // Copy button
  const fabCopyBtn = fab.querySelector('.fab-copy-btn');
  if (fabCopyBtn) {
    fabCopyBtn.style.cssText = `
      background: #667eea;
      border: none;
      color: white;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s ease;
    `;
  }
  
  // Actions section
  const fabActions = fab.querySelector('.fab-actions');
  fabActions.style.cssText = `
    display: flex;
    gap: 8px;
    padding: 16px 20px;
    background: #fafafa;
    border-top: 1px solid #f0f0f0;
  `;
  
  // Action buttons
  const actionBtns = fab.querySelectorAll('.fab-action-btn');
  actionBtns.forEach(btn => {
    btn.style.cssText = `
      flex: 1;
      background: white;
      border: 1px solid #e0e0e0;
      color: #333;
      padding: 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
  });
  
  // Specific element styles
  applyCSSToElements(fab);
}

/**
 * Apply additional CSS styles to specific elements
 */
function applyCSSToElements(fab) {
  // Add hover effects
  const fabMain = fab.querySelector('.fab-main');
  const fabPanel = fab.querySelector('.fab-panel');
  const fabCloseBtn = fab.querySelector('.fab-close-btn');
  const fabCopyBtn = fab.querySelector('.fab-copy-btn');
  const actionBtns = fab.querySelectorAll('.fab-action-btn');
  
  // FAB main hover effect
  fabMain.addEventListener('mouseenter', () => {
    fabMain.style.transform = 'translateY(-2px)';
    fabMain.style.boxShadow = '0 6px 25px rgba(102, 126, 234, 0.5)';
  });
  
  fabMain.addEventListener('mouseleave', () => {
    fabMain.style.transform = 'translateY(0)';
    fabMain.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.4)';
  });
  
  // Close button hover
  if (fabCloseBtn) {
    fabCloseBtn.addEventListener('mouseenter', () => {
      fabCloseBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    });
    
    fabCloseBtn.addEventListener('mouseleave', () => {
      fabCloseBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    });
  }
  
  // Copy button hover
  if (fabCopyBtn) {
    fabCopyBtn.addEventListener('mouseenter', () => {
      fabCopyBtn.style.background = '#5a67d8';
    });
    
    fabCopyBtn.addEventListener('mouseleave', () => {
      fabCopyBtn.style.background = '#667eea';
    });
  }
  
  // Action buttons hover
  actionBtns.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#f5f5f5';
      btn.style.transform = 'translateY(-1px)';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'white';
      btn.style.transform = 'translateY(0)';
    });
  });
}

/**
 * Set up event listeners for FAB actions
 */
function setupFABEventListeners(fab) {
  const fabMain = fab.querySelector('#fabMain');
  const fabPanel = fab.querySelector('#fabPanel');
  const fabCloseBtn = fab.querySelector('#fabCloseBtn');
  const fabCopyBtn = fab.querySelector('#fabCopyBtn');
  const fabRefreshBtn = fab.querySelector('#fabRefreshBtn');
  const fabSettingsBtn = fab.querySelector('#fabSettingsBtn');
  
  let isExpanded = false;
  
  // Toggle FAB expansion
  const toggleFAB = () => {
    isExpanded = !isExpanded;
    
    if (isExpanded) {
      // Expand
      fabPanel.style.display = 'block';
      setTimeout(() => {
        fabPanel.style.opacity = '1';
        fabPanel.style.transform = 'scale(1) translateY(0)';
      }, 10);
      
      // Update main button
      fabMain.style.borderRadius = '50px 50px 16px 16px';
    } else {
      // Collapse
      fabPanel.style.opacity = '0';
      fabPanel.style.transform = 'scale(0.8) translateY(20px)';
      setTimeout(() => {
        fabPanel.style.display = 'none';
      }, 300);
      
      // Update main button
      fabMain.style.borderRadius = '50px';
    }
  };
  
  // FAB main click
  if (fabMain) {
    fabMain.addEventListener('click', toggleFAB);
  }
  
  // Close button
  if (fabCloseBtn) {
    fabCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFAB();
    });
  }
  
  // Copy token button
  if (fabCopyBtn) {
    fabCopyBtn.addEventListener('click', handleFABCopyToken);
  }
  
  // Refresh button
  if (fabRefreshBtn) {
    fabRefreshBtn.addEventListener('click', () => {
      updateFABTokenInfo();
      showFABNotification('Token info refreshed', 'success');
    });
  }
  
  // Settings button
  if (fabSettingsBtn) {
    fabSettingsBtn.addEventListener('click', () => {
      // This would ideally open the extension popup, but we can't do that from content script
      showFABNotification('Open extension from browser toolbar', 'info');
    });
  }
  
  // Click outside to close
  document.addEventListener('click', (e) => {
    if (isExpanded && !fab.contains(e.target)) {
      toggleFAB();
    }
  });
}

/**
 * Insert floating FAB
 */
function insertFloatingFAB() {
  // Remove existing FAB first
  const existingFAB = document.querySelector('.swagger-helper-fab');
  if (existingFAB) {
    existingFAB.remove();
  }
  
  const fab = createFloatingFAB();
  
  // Insert FAB at the end of body for proper z-index layering
  document.body.appendChild(fab);
  
  // Initialize with current environment info
  updateFABEnvironmentInfo();
  
  // Initialize token information
  updateFABTokenInfo();
}

/**
 * Switch to environment
 */
async function switchToEnvironment(environmentName) {
  try {
    if (!envSwitcherState.environments[environmentName]) {
      throw new Error(`Environment '${environmentName}' not found`);
    }
    
    const newBaseUrl = envSwitcherState.environments[environmentName];
    
    // Update UI
    const success = updateSwaggerBaseUrl(newBaseUrl);
    if (!success) {
      throw new Error('Failed to update Swagger UI base URL');
    }
    
    // Update state
    envSwitcherState.currentEnvironment = environmentName;
    envSwitcherState.baseUrl = newBaseUrl;
    
    // Update FAB
    updateFABEnvironmentInfo();
    
    // Save current environment to settings
    await saveCurrentEnvironment(environmentName);
    
    return { success: true, environment: environmentName, baseUrl: newBaseUrl };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Save current environment to settings
 */
async function saveCurrentEnvironment(environmentName) {
  try {
    if (!isChromeRuntimeAvailable()) {

      return;
    }

    const response = await chrome.runtime.sendMessage({ action: 'GET_SETTINGS' });
    if (response && response.success) {
      const updatedSettings = {
        ...response.settings,
        currentEnvironment: environmentName
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
 * Auto-apply current environment on page load
 */
async function applyCurrentEnvironment() {
  await loadEnvironmentSettings();
  
  const currentEnv = envSwitcherState.currentEnvironment;
  
  // Use selected environment from popup settings
  if (currentEnv && envSwitcherState.environments[currentEnv]) {
    const selectedBaseUrl = envSwitcherState.environments[currentEnv];
    envSwitcherState.baseUrl = selectedBaseUrl;
    
    // Apply the selected environment to Swagger UI
    setTimeout(() => {
      updateSwaggerBaseUrl(selectedBaseUrl);
    }, 500);
  } else {
    // Fallback to current URL if no valid environment selected
    envSwitcherState.baseUrl = getCurrentBaseUrl();
  }
  
  // Always insert FAB and update it with current state
  setTimeout(() => {
    insertFloatingFAB();
    updateFABEnvironmentInfo();
  }, 1000); // Delay to ensure Swagger UI is loaded
}

/**
 * Watch for Swagger UI changes and maintain FAB
 */
function watchForUIChanges() {
  const observer = new MutationObserver((mutations) => {
    let shouldUpdateFAB = false;
    
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if significant Swagger UI components were added
          if (node.matches && (
            node.matches('.swagger-ui, .info, .servers') ||
            node.querySelector && node.querySelector('.swagger-ui, .info, .servers')
          )) {
            shouldUpdateFAB = true;
          }
        }
      });
    });
    
    if (shouldUpdateFAB) {
      setTimeout(() => {
        if (!document.querySelector('.swagger-helper-fab')) {
          insertFloatingFAB();
        }
      }, 500);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  return observer;
}

/**
 * Initialize environment switcher
 */
async function initializeEnvironmentSwitcher() {
  // Apply current environment
  await applyCurrentEnvironment();
  
  // Watch for UI changes
  watchForUIChanges();
}

/**
 * FAB Token Management Functions
 */

// Store FAB state
let fabState = {
  activeToken: null,
  countdownInterval: null
};

/**
 * Decode JWT token
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    
    return { header, payload };
  } catch (error) {
    return null;
  }
}

/**
 * Format time remaining in human readable format
 */
function formatTimeRemaining(milliseconds) {
  if (milliseconds <= 0) return 'Expired';
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Update FAB token information
 */
async function updateFABTokenInfo() {
  const fab = document.querySelector('.swagger-helper-fab');
  if (!fab) return;
  
  const tokenSection = fab.querySelector('#fabTokenSection');
  const expirySection = fab.querySelector('#fabExpirySection');
  
  try {
    // Get active token from background
    if (!isChromeRuntimeAvailable()) {
      // Hide token sections if runtime not available
      if (tokenSection) tokenSection.style.display = 'none';
      if (expirySection) expirySection.style.display = 'none';
      return;
    }
    
    const response = await chrome.runtime.sendMessage({ action: 'GET_ROLE_TOKENS' });
    
    if (response && response.success && response.activeToken) {
      fabState.activeToken = response.activeToken;
      
      // Update preview
      updateFABPreview(fab, response.activeToken);
      
      // Show token section
      if (tokenSection) {
        tokenSection.style.display = 'block';
        updateFABTokenDisplay(fab, response.activeToken);
      }
      
      // Check for JWT expiry
      const jwtInfo = decodeJWT(response.activeToken.token);
      if (jwtInfo && jwtInfo.payload && jwtInfo.payload.exp) {
        const expiryTime = new Date(jwtInfo.payload.exp * 1000);
        const now = new Date();
        const timeRemaining = expiryTime.getTime() - now.getTime();
        
        // Show expiry section
        if (expirySection) {
          expirySection.style.display = 'block';
          updateFABExpiryDisplay(fab, expiryTime, timeRemaining);
        }
        
        // Start countdown if not already running
        startFABCountdown();
      } else {
        // Hide expiry section if no expiry info
        if (expirySection) {
          expirySection.style.display = 'none';
        }
        stopFABCountdown();
      }
    } else {
      // No active token - hide both sections and update preview
      if (tokenSection) tokenSection.style.display = 'none';
      if (expirySection) expirySection.style.display = 'none';
      fabState.activeToken = null;
      updateFABPreviewNoToken(fab);
      stopFABCountdown();
    }
  } catch (error) {
    // Hide sections on error
    if (tokenSection) tokenSection.style.display = 'none';
    if (expirySection) expirySection.style.display = 'none';
    fabState.activeToken = null;
    updateFABPreviewNoToken(fab);
    stopFABCountdown();
  }
}

/**
 * Update FAB token display
 */
function updateFABTokenDisplay(fab, activeToken) {
  const tokenName = fab.querySelector('#fabTokenName');
  const validityIndicator = fab.querySelector('#fabValidityIndicator');
  const validityText = fab.querySelector('#fabValidityText');
  
  if (tokenName) {
    tokenName.textContent = activeToken.role || 'Token';
    tokenName.title = activeToken.role || 'Active Token';
  }
  
  // Parse JWT to determine validity
  const jwtInfo = decodeJWT(activeToken.token);
  
  if (jwtInfo && jwtInfo.payload && jwtInfo.payload.exp) {
    const expiryTime = new Date(jwtInfo.payload.exp * 1000);
    const now = new Date();
    const timeRemaining = expiryTime.getTime() - now.getTime();
    
    updateFABTokenValidity(validityIndicator, validityText, timeRemaining);
  } else {
    // No expiry information
    if (validityIndicator) validityIndicator.textContent = '⚪';
    if (validityText) {
      validityText.textContent = 'Active';
      validityText.style.color = '#90EE90';
    }
  }
}

/**
 * Update FAB token validity indicators
 */
function updateFABTokenValidity(validityIndicator, validityText, timeRemaining) {
  const isExpired = timeRemaining <= 0;
  const isExpiringSoon = timeRemaining <= 5 * 60 * 1000; // 5 minutes
  const isExpiringCritical = timeRemaining <= 1 * 60 * 1000; // 1 minute
  
  if (validityIndicator && validityText) {
    if (isExpired) {
      validityIndicator.textContent = '🔴';
      validityText.textContent = 'Expired';
      validityText.style.color = '#FFB6C1';
    } else if (isExpiringCritical) {
      validityIndicator.textContent = '🟡';
      validityText.textContent = 'Critical';
      validityText.style.color = '#FFD700';
    } else if (isExpiringSoon) {
      validityIndicator.textContent = '🟠';
      validityText.textContent = 'Warning';
      validityText.style.color = '#FFD700';
    } else {
      validityIndicator.textContent = '🟢';
      validityText.textContent = 'Valid';
      validityText.style.color = '#90EE90';
    }
  }
}

/**
 * Update FAB expiry display
 */
function updateFABExpiryDisplay(fab, expiryTime, timeRemaining) {
  const expiryTime_el = fab.querySelector('#fabExpiryTime');
  const expiryCountdown = fab.querySelector('#fabExpiryCountdown');
  
  if (expiryTime_el) {
    expiryTime_el.textContent = expiryTime.toLocaleString();
  }
  
  if (expiryCountdown) {
    const countdown = formatTimeRemaining(timeRemaining);
    expiryCountdown.textContent = countdown;
    
    // Update countdown styling based on time remaining
    expiryCountdown.style.color = '#333';
    
    if (timeRemaining <= 0) {
      expiryCountdown.textContent = 'EXPIRED';
      expiryCountdown.style.color = '#dc2626';
    } else if (timeRemaining <= 1 * 60 * 1000) { // 1 minute
      expiryCountdown.style.color = '#dc2626';
    } else if (timeRemaining <= 5 * 60 * 1000) { // 5 minutes
      expiryCountdown.style.color = '#f59e0b';
    }
  }
}

/**
 * Start FAB countdown timer
 */
function startFABCountdown() {
  // Clear any existing interval
  if (fabState.countdownInterval) {
    clearInterval(fabState.countdownInterval);
  }
  
  // Update every second
  fabState.countdownInterval = setInterval(() => {
    const fab = document.querySelector('.swagger-helper-fab');
    if (!fab || !fabState.activeToken) {
      stopFABCountdown();
      return;
    }
    
    const jwtInfo = decodeJWT(fabState.activeToken.token);
    if (jwtInfo && jwtInfo.payload && jwtInfo.payload.exp) {
      const expiryTime = new Date(jwtInfo.payload.exp * 1000);
      const now = new Date();
      const timeRemaining = expiryTime.getTime() - now.getTime();
      
      // Update displays
      updateFABTokenDisplay(fab, fabState.activeToken);
      updateFABExpiryDisplay(fab, expiryTime, timeRemaining);
    } else {
      stopFABCountdown();
    }
  }, 1000);
}

/**
 * Stop FAB countdown timer
 */
function stopFABCountdown() {
  if (fabState.countdownInterval) {
    clearInterval(fabState.countdownInterval);
    fabState.countdownInterval = null;
  }
}

/**
 * Handle FAB copy token button click
 */
async function handleFABCopyToken() {
  if (!fabState.activeToken || !fabState.activeToken.token) {
    showFABNotification('No active token to copy', 'error');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(fabState.activeToken.token);
    showFABNotification('Token copied to clipboard', 'success');
    
    // Visual feedback on button
    const copyBtn = document.querySelector('#fabCopyBtn');
    if (copyBtn) {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✅';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1000);
    }
  } catch (error) {
    showFABNotification('Failed to copy token', 'error');
  }
}

/**
 * Show FAB notification
 */
function showFABNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'fab-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 1000000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideDown 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 300px;
    word-wrap: break-word;
  `;
  notification.textContent = message;
  
  // Add CSS animation if not already added
  if (!document.querySelector('#fab-animations')) {
    const style = document.createElement('style');
    style.id = 'fab-animations';
    style.textContent = `
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

/**
 * Update FAB preview with token info
 */
function updateFABPreview(fab, activeToken) {
  const fabEnvPreview = fab.querySelector('#fabEnvPreview');
  const fabTokenPreview = fab.querySelector('#fabTokenPreview');
  
  if (fabEnvPreview) {
    fabEnvPreview.textContent = envSwitcherState.currentEnvironment.toUpperCase();
  }
  
  if (fabTokenPreview) {
    const tokenRole = activeToken.role || 'Token';
    fabTokenPreview.textContent = tokenRole;
  }
}

/**
 * Update FAB preview with no token
 */
function updateFABPreviewNoToken(fab) {
  const fabEnvPreview = fab.querySelector('#fabEnvPreview');
  const fabTokenPreview = fab.querySelector('#fabTokenPreview');
  
  if (fabEnvPreview) {
    fabEnvPreview.textContent = envSwitcherState.currentEnvironment.toUpperCase();
  }
  
  if (fabTokenPreview) {
    fabTokenPreview.textContent = 'No Token';
  }
}

/**
 * Update FAB environment information
 */
function updateFABEnvironmentInfo() {
  const fab = document.querySelector('.swagger-helper-fab');
  if (!fab) return;
  
  // Use the selected environment from popup settings (not URL detection)
  let envName = envSwitcherState.currentEnvironment || 'unknown';
  let baseUrl = envSwitcherState.baseUrl;
  
  // If we have a selected environment, use its configured URL
  if (envName && envSwitcherState.environments[envName]) {
    baseUrl = envSwitcherState.environments[envName];
    envSwitcherState.baseUrl = baseUrl; // Update state
  } else {
    // Fallback to current URL if no environment is selected
    baseUrl = getCurrentBaseUrl();
    envSwitcherState.baseUrl = baseUrl;
    envName = detectEnvironmentFromUrl(baseUrl);
  }
  
  const fabEnvName = fab.querySelector('#fabEnvName');
  const fabEnvUrl = fab.querySelector('#fabEnvUrl');
  const fabEnvPreview = fab.querySelector('#fabEnvPreview');
  const fabPanelTitle = fab.querySelector('.fab-panel-title span');
  
  if (fabEnvName) {
    fabEnvName.textContent = envName.toUpperCase();
  }
  
  if (fabEnvUrl) {
    fabEnvUrl.textContent = baseUrl;
    fabEnvUrl.title = baseUrl;
  }
  
  if (fabEnvPreview) {
    fabEnvPreview.textContent = envName.toUpperCase();
  }
  
  if (fabPanelTitle) {
    fabPanelTitle.textContent = envName.toUpperCase();
  }
}

/**
 * Detect environment from URL patterns
 */
function detectEnvironmentFromUrl(url) {
  if (!url) return 'unknown';
  
  const urlLower = url.toLowerCase();
  
  // Check for localhost patterns
  if (urlLower.includes('localhost') || urlLower.includes('127.0.0.1')) {
    return 'local';
  } 
  
  // Check for common environment patterns in URL
  if (urlLower.includes('dev') || urlLower.includes('development')) {
    return 'dev';
  } 
  
  if (urlLower.includes('staging') || urlLower.includes('stage') || urlLower.includes('stg')) {
    return 'staging';
  } 
  
  if (urlLower.includes('prod') || urlLower.includes('production')) {
    return 'prod';
  }
  
  // Check for test environments
  if (urlLower.includes('test') || urlLower.includes('qa')) {
    return 'test';
  }
  
  // For non-localhost URLs, try to determine from domain structure
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const port = urlObj.port;
    
    // If it's a non-standard port and not localhost, likely dev
    if (port && port !== '80' && port !== '443' && !hostname.includes('localhost')) {
      return 'dev';
    }
    
    // Extract subdomain patterns
    const parts = hostname.split('.');
    if (parts.length > 2) {
      const subdomain = parts[0].toLowerCase();
      if (subdomain.includes('dev') || subdomain.includes('development')) return 'dev';
      if (subdomain.includes('staging') || subdomain.includes('stage') || subdomain.includes('stg')) return 'staging';
      if (subdomain.includes('prod') || subdomain.includes('production')) return 'prod';
      if (subdomain.includes('test') || subdomain.includes('qa')) return 'test';
      
      // Use the subdomain as environment name if it's descriptive
      if (subdomain.length > 2 && subdomain !== 'www' && subdomain !== 'api') {
        return subdomain;
      }
    }
    
    // Default to hostname or 'remote' for external URLs
    return hostname.includes('.') ? 'remote' : hostname;
  } catch (error) {
    console.log('Error parsing URL for environment detection:', error);
    return 'unknown';
  }
}

// Message listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleMessage = async () => {
    try {
      switch (request.action) {
        case 'SWITCH_ENVIRONMENT':
          const result = await switchToEnvironment(request.environment);
          sendResponse(result);
          break;
          
        case 'GET_CURRENT_ENVIRONMENT':
          sendResponse({
            success: true,
            environment: envSwitcherState.currentEnvironment,
            baseUrl: envSwitcherState.baseUrl
          });
          break;
          
        case 'UPDATE_SETTINGS':
          await loadEnvironmentSettings();
          await applyCurrentEnvironment();
          // Update the FAB with new settings
          updateFABEnvironmentInfo();
          sendResponse({ success: true });
          break;
          
        case 'RELOAD_ENVIRONMENTS':
          await loadEnvironmentSettings();
          // Update the FAB with new environment data
          updateFABEnvironmentInfo();
          sendResponse({ success: true });
          break;
          
        case 'RELOAD_TOKENS':
          await updateFABTokenInfo();
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
  document.addEventListener('DOMContentLoaded', initializeEnvironmentSwitcher);
} else {
  initializeEnvironmentSwitcher();
}

// Also initialize when page is fully loaded
window.addEventListener('load', () => {
  setTimeout(initializeEnvironmentSwitcher, 2000);
});

// Export for debugging
window.EnvironmentSwitcher = {
  switchToEnvironment,
  getCurrentBaseUrl,
  updateSwaggerBaseUrl,
  applyCurrentEnvironment,
  state: envSwitcherState
};