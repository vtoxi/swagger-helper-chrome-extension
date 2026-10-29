/**
 * All-in-One Swagger Helper - Popup Script
 * Handles UI interactions and communication with background script
 */

// Global state management
let state = {
  environments: {},
  settings: {},
  roleTokens: [],
  activeToken: null,
  savedCredentials: [],
  currentEditingToken: null
};

// DOM element references
let elements = {};

/**
 * Initialize popup when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', async () => {
  await initializeElements();
  await loadInitialData();
  setupEventListeners();
  initializeUI();
});

/**
 * Initialize DOM element references
 */
async function initializeElements() {
  elements = {
    // Header elements
    headerEnvName: document.getElementById('headerEnvName'),
    headerEnvUrl: document.getElementById('headerEnvUrl'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    headerTokenRow: document.getElementById('headerTokenRow'),
    headerTokenName: document.getElementById('headerTokenName'),
    headerTokenValidity: document.getElementById('headerTokenValidity'),
    headerValidityIndicator: document.getElementById('headerValidityIndicator'),
    headerValidityText: document.getElementById('headerValidityText'),
    headerCopyTokenBtn: document.getElementById('headerCopyTokenBtn'),
    headerTokenDetailsBtn: document.getElementById('headerTokenDetailsBtn'),
    headerExpiryRow: document.getElementById('headerExpiryRow'),
    headerExpiryTime: document.getElementById('headerExpiryTime'),
    headerExpiryCountdown: document.getElementById('headerExpiryCountdown'),
    
    // Environment elements
    environmentSelect: document.getElementById('environmentSelect'),
    baseUrlInput: document.getElementById('baseUrlInput'),
    saveEnvBtn: document.getElementById('saveEnvBtn'),
    addEnvBtn: document.getElementById('addEnvBtn'),
    
    // API Format elements
    apiFormatPresetSelect: document.getElementById('apiFormatPresetSelect'),
    usernameFieldSelect: document.getElementById('usernameFieldSelect'),
    usernameFieldCustom: document.getElementById('usernameFieldCustom'),
    passwordFieldSelect: document.getElementById('passwordFieldSelect'),
    passwordFieldCustom: document.getElementById('passwordFieldCustom'),
    requestWrapperSelect: document.getElementById('requestWrapperSelect'),
    requestWrapperCustom: document.getElementById('requestWrapperCustom'),
    additionalFieldsInput: document.getElementById('additionalFieldsInput'),
    tokenPathInput: document.getElementById('tokenPathInput'),
    errorPathInput: document.getElementById('errorPathInput'),
    apiFormatPreview: document.getElementById('apiFormatPreview'),
    
    // Auto Login elements
    loginEndpointInput: document.getElementById('loginEndpointInput'),
    tokenPathQuickInput: document.getElementById('tokenPathQuickInput'),
    usernameInput: document.getElementById('usernameInput'),
    passwordInput: document.getElementById('passwordInput'),
    loginBtn: document.getElementById('loginBtn'),
    testLoginBtn: document.getElementById('testLoginBtn'),
    loginStatusText: document.getElementById('loginStatusText'),
    savedCredentialsContainer: document.getElementById('savedCredentialsContainer'),
    credentialsList: document.getElementById('credentialsList'),
    clearCredentialsBtn: document.getElementById('clearCredentialsBtn'),
    
    // Token Manager elements
    activeTokenSelect: document.getElementById('activeTokenSelect'),
    refreshTokenBtn: document.getElementById('refreshTokenBtn'),
    tokenForm: document.getElementById('tokenForm'),
    tokenFormTitle: document.getElementById('tokenFormTitle'),
    tokenRoleInput: document.getElementById('tokenRoleInput'),
    tokenValueInput: document.getElementById('tokenValueInput'),
    tokenDescInput: document.getElementById('tokenDescInput'),
    saveTokenBtn: document.getElementById('saveTokenBtn'),
    cancelTokenBtn: document.getElementById('cancelTokenBtn'),
    tokenList: document.getElementById('tokenList'),
    addTokenBtn: document.getElementById('addTokenBtn'),
    clearTokensBtn: document.getElementById('clearTokensBtn'),
    
    // Token Format elements
    tokenPresetSelect: document.getElementById('tokenPresetSelect'),
    tokenHeaderInput: document.getElementById('tokenHeaderInput'),
    tokenFormatSelect: document.getElementById('tokenFormatSelect'),
    tokenPrefixInput: document.getElementById('tokenPrefixInput'),
    tokenFormatPreview: document.getElementById('tokenFormatPreview'),
    saveTokenFormatBtn: document.getElementById('saveTokenFormatBtn'),
    resetTokenFormatBtn: document.getElementById('resetTokenFormatBtn'),
    
    // UI Enhancement elements
    darkModeToggle: document.getElementById('darkModeToggle'),
    autoCollapseToggle: document.getElementById('autoCollapseToggle'),
    copyButtonsToggle: document.getElementById('copyButtonsToggle'),
    
    // Quick Actions elements
    refreshPageBtn: document.getElementById('refreshPageBtn'),
    exportConfigBtn: document.getElementById('exportConfigBtn'),
    importConfigBtn: document.getElementById('importConfigBtn'),
    exportPostmanBtn: document.getElementById('exportPostmanBtn'),
    
    // Status elements
    statusIndicator: document.getElementById('statusIndicator'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText')
  };
}

/**
 * Check if Chrome extension runtime is available
 */
function isChromeRuntimeAvailable() {
  return typeof chrome !== 'undefined' && 
         chrome.runtime && 
         chrome.runtime.sendMessage && 
         !chrome.runtime.lastError;
}

/**
 * Safe chrome.runtime.sendMessage with error handling
 */
async function safeRuntimeSendMessage(message) {
  if (!isChromeRuntimeAvailable()) {
    console.warn('Chrome runtime not available for message:', message);
    return { success: false, error: 'Chrome runtime not available' };
  }
  
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    console.warn('Failed to send runtime message:', message, error);
    return { success: false, error: error.message };
  }
}

/**
 * Safe chrome.tabs operations with error handling
 */
async function safeTabsOperation(operation) {
  if (!isChromeRuntimeAvailable() || !chrome.tabs) {
    console.warn('Chrome tabs API not available');
    return false;
  }
  
  try {
    await operation();
    return true;
  } catch (error) {
    console.warn('Chrome tabs operation failed:', error);
    return false;
  }
}

/**
 * Load initial data from storage
 */
async function loadInitialData() {
  try {
    // Ensure environments state is valid
    state.environments = {};

    // Load environments
    const envResponse = await safeRuntimeSendMessage({ action: 'GET_ENVIRONMENTS' });
    if (envResponse && envResponse.success) {
      state.environments = envResponse.environments || {};
    }

    // Load settings
    const settingsResponse = await safeRuntimeSendMessage({ action: 'GET_SETTINGS' });
    if (settingsResponse && settingsResponse.success) {
      state.settings = settingsResponse.settings || {};
      populateAPIFormatSettings();
      populateTokenFormatSettings();
      populateUISettings();
      populateLoginEndpoint();
      populateTokenPath();
      // Populate environment select AFTER settings are loaded to restore selection
      populateEnvironmentSelect();
    } else {
      // Fallback: populate environment select with basic options even if settings fail to load
      populateEnvironmentSelect();
    }

    // Load role tokens
    await loadRoleTokens();
    
    // Load saved credentials
    await loadSavedCredentials();
    
  } catch (error) {
    console.error('Failed to load initial data:', error);
    showMessage('Failed to load extension data. Please refresh the popup.', 'error');
    
    // Initialize with defaults if loading fails
    state.environments = {
      local: 'http://localhost:8080',
      dev: 'https://dev-api.example.com',
      staging: 'https://staging-api.example.com',
      prod: 'https://api.example.com'
    };
    state.settings = {
      currentEnvironment: 'local',
      autoInject: true,
      darkMode: false,
      autoCollapse: false,
      copyButtons: true
    };
    populateEnvironmentSelect();
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Header Actions
  if (elements.headerCopyTokenBtn) {
    elements.headerCopyTokenBtn.addEventListener('click', handleHeaderCopyToken);
  }
  if (elements.headerTokenDetailsBtn) {
    elements.headerTokenDetailsBtn.addEventListener('click', handleHeaderTokenDetails);
  }
  
  // Environment Management
  if (elements.saveEnvBtn) {
    elements.saveEnvBtn.addEventListener('click', handleSaveEnvironment);
  }
  if (elements.environmentSelect) {
    elements.environmentSelect.addEventListener('change', handleEnvironmentChange);
  }
  
  // API Format Configuration
  if (elements.apiFormatPresetSelect) {
    elements.apiFormatPresetSelect.addEventListener('change', handleApiFormatPresetChange);
  }
  
  // Custom field toggles
  if (elements.usernameFieldSelect) {
    elements.usernameFieldSelect.addEventListener('change', toggleCustomUsernameField);
  }
  if (elements.passwordFieldSelect) {
    elements.passwordFieldSelect.addEventListener('change', toggleCustomPasswordField);
  }
  if (elements.requestWrapperSelect) {
    elements.requestWrapperSelect.addEventListener('change', toggleCustomWrapperField);
  }
  
  // Auto Login
  if (elements.loginBtn) {
  elements.loginBtn.addEventListener('click', handleLogin);
  }
  if (elements.testLoginBtn) {
  elements.testLoginBtn.addEventListener('click', handleTestLogin);
  }
  if (elements.clearCredentialsBtn) {
    elements.clearCredentialsBtn.addEventListener('click', handleClearCredentials);
  }
  
  // Token Management
  if (elements.activeTokenSelect) {
    elements.activeTokenSelect.addEventListener('change', handleActiveTokenChange);
  }
  if (elements.addTokenBtn) {
    elements.addTokenBtn.addEventListener('click', showTokenForm);
  }
  if (elements.saveTokenBtn) {
    elements.saveTokenBtn.addEventListener('click', handleSaveToken);
  }
  if (elements.cancelTokenBtn) {
    elements.cancelTokenBtn.addEventListener('click', hideTokenForm);
  }
  if (elements.clearTokensBtn) {
  elements.clearTokensBtn.addEventListener('click', handleClearTokens);
  }
  if (elements.refreshTokenBtn) {
    elements.refreshTokenBtn.addEventListener('click', loadRoleTokens);
  }
  
  // Token Format Configuration
  if (elements.tokenPresetSelect) {
    elements.tokenPresetSelect.addEventListener('change', handleTokenPresetChange);
  }
  if (elements.tokenFormatSelect) {
    elements.tokenFormatSelect.addEventListener('change', updateTokenFormatPreview);
  }
  if (elements.tokenPrefixInput) {
    elements.tokenPrefixInput.addEventListener('input', updateTokenFormatPreview);
  }
  if (elements.saveTokenFormatBtn) {
    elements.saveTokenFormatBtn.addEventListener('click', handleSaveTokenFormat);
  }
  if (elements.resetTokenFormatBtn) {
    elements.resetTokenFormatBtn.addEventListener('click', handleResetTokenFormat);
  }
  
  // UI Enhancement toggles
  if (elements.darkModeToggle) {
    elements.darkModeToggle.addEventListener('change', handleUISettingChange);
  }
  if (elements.autoCollapseToggle) {
    elements.autoCollapseToggle.addEventListener('change', handleUISettingChange);
  }
  if (elements.copyButtonsToggle) {
    elements.copyButtonsToggle.addEventListener('change', handleUISettingChange);
  }

  // Quick Actions
  if (elements.refreshPageBtn) {
  elements.refreshPageBtn.addEventListener('click', handleRefreshPage);
  }
  if (elements.exportConfigBtn) {
  elements.exportConfigBtn.addEventListener('click', handleExportConfig);
  }
  if (elements.importConfigBtn) {
  elements.importConfigBtn.addEventListener('click', handleImportConfig);
  }
  if (elements.exportPostmanBtn) {
    elements.exportPostmanBtn.addEventListener('click', handleExportPostman);
  }
  
  // Add input listeners for live preview updates
  ['usernameFieldSelect', 'usernameFieldCustom', 'passwordFieldSelect', 'passwordFieldCustom', 
   'requestWrapperSelect', 'requestWrapperCustom', 'additionalFieldsInput'].forEach(elementName => {
    if (elements[elementName]) {
      elements[elementName].addEventListener('input', updateApiFormatPreview);
      elements[elementName].addEventListener('change', updateApiFormatPreview);
    }
  });
  
  // Setup collapsible sections
  setupCollapsibleSections();
}

/**
 * Initialize UI state
 */
function initializeUI() {
  updateTokenFormatPreview();
  updateApiFormatPreview();
  
  // Initialize custom section visibility
  toggleApiFormatCustomSection();
  toggleTokenFormatCustomSection();
  
  // Initialize custom field visibility
  toggleCustomUsernameField();
  toggleCustomPasswordField();
  toggleCustomWrapperField();
  
  // Initialize header display
  updateHeader();
}

/**
 * Handle environment selection change
 */
async function handleEnvironmentChange() {
  const selectedEnv = elements.environmentSelect?.value;
  
  // Update base URL field if environment has a configured URL
  if (selectedEnv && state.environments[selectedEnv] && elements.baseUrlInput) {
    elements.baseUrlInput.value = state.environments[selectedEnv];
  } else if (elements.baseUrlInput) {
    // Clear base URL field if no URL is configured for this environment
    elements.baseUrlInput.value = '';
  }
  
  // Always save selected environment to storage (regardless of whether it has a base URL)
  if (selectedEnv) {
    try {
      const updatedSettings = {
        ...state.settings,
        currentEnvironment: selectedEnv
      };
      
      await safeRuntimeSendMessage({
        action: 'SAVE_SETTINGS', 
        settings: updatedSettings
      });
      
      // Update local state
      state.settings = updatedSettings;
      
      // Update header environment display
      updateHeaderEnvironment();
      
      // Notify content script to update banner
      await safeTabsOperation(async () => {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'UPDATE_SETTINGS'});
        }
      });
    } catch (error) {

    }
  }
}

/**
 * Handle environment save
 */
async function handleSaveEnvironment() {
  // Ensure environments state is valid before saving
  if (!state.environments || typeof state.environments !== 'object') {
    state.environments = {};
  }
  
  const envName = elements.environmentSelect?.value?.trim();
  const baseUrl = elements.baseUrlInput?.value?.trim();

  if (!envName || !baseUrl) {
    showMessage('Please select environment and enter base URL', 'error');
    return;
  }
  
  try {
    // Validate URL
    new URL(baseUrl);
    
    const response = await safeRuntimeSendMessage({
      action: 'SAVE_ENVIRONMENT',
      name: envName,
      url: baseUrl
    });

    if (response && response.success) {
      showMessage('Environment saved successfully!', 'success');
      state.environments[envName] = baseUrl;
      populateEnvironmentSelect();
      
      // Update header environment display
      updateHeaderEnvironment();
      
      // Notify content script to update banner
      await safeTabsOperation(async () => {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'UPDATE_SETTINGS'});
        }
      });
    } else {
      showMessage(`Failed to save environment: ${response?.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {

    showMessage(`Failed to save environment: ${error.message}`, 'error');
  }
}

/**
 * Populate environment select dropdown
 */
function populateEnvironmentSelect() {
  if (!elements.environmentSelect) return;
  
  // Get previously selected environment from settings
  const savedSelection = state.settings?.currentEnvironment;
  
  // Clear existing options except default ones
  elements.environmentSelect.innerHTML = `
    <option value="local">Local</option>
    <option value="dev">Development</option>
    <option value="staging">Staging</option>
    <option value="prod">Production</option>
  `;
  
  // Add custom environments
  if (state.environments && typeof state.environments === 'object') {
    Object.keys(state.environments).forEach(envName => {
      if (!['local', 'dev', 'staging', 'prod'].includes(envName)) {
    const option = document.createElement('option');
        option.value = envName;
        option.textContent = envName.charAt(0).toUpperCase() + envName.slice(1);
    elements.environmentSelect.appendChild(option);
      }
    });
  }
  
  // Restore selection from saved settings
  if (savedSelection) {
    // Check if the saved selection still exists as an option
    const option = elements.environmentSelect.querySelector(`option[value="${savedSelection}"]`);
    if (option) {
      elements.environmentSelect.value = savedSelection;
      // Update base URL field for the restored selection
      if (savedSelection && state.environments[savedSelection] && elements.baseUrlInput) {
        elements.baseUrlInput.value = state.environments[savedSelection];
      }
    }
  }
}

/**
 * Toggle custom username field
 */
function toggleCustomUsernameField() {
  const value = elements.usernameFieldSelect?.value;
  if (elements.usernameFieldCustom) {
    elements.usernameFieldCustom.style.display = value === 'custom' ? 'block' : 'none';
  }
  updateApiFormatPreview();
}

/**
 * Toggle custom password field
 */
function toggleCustomPasswordField() {
  const value = elements.passwordFieldSelect?.value;
  if (elements.passwordFieldCustom) {
    elements.passwordFieldCustom.style.display = value === 'custom' ? 'block' : 'none';
  }
  updateApiFormatPreview();
}

/**
 * Toggle custom wrapper field
 */
function toggleCustomWrapperField() {
  const value = elements.requestWrapperSelect?.value;
  if (elements.requestWrapperCustom) {
    elements.requestWrapperCustom.style.display = value === 'custom' ? 'block' : 'none';
  }
  updateApiFormatPreview();
}

/**
 * Toggle API format custom section visibility
 */
function toggleApiFormatCustomSection() {
  const preset = elements.apiFormatPresetSelect?.value;
  const customSection = document.getElementById('apiFormatCustom');
  
  if (customSection) {
    customSection.style.display = preset === 'custom' ? 'block' : 'none';
  }
}

/**
 * Get actual username field value
 */
function getUsernameFieldValue() {
  const selectValue = elements.usernameFieldSelect?.value;
  if (selectValue === 'custom') {
    return elements.usernameFieldCustom?.value || 'username';
  }
  return selectValue || 'username';
}

/**
 * Get actual password field value
 */
function getPasswordFieldValue() {
  const selectValue = elements.passwordFieldSelect?.value;
  if (selectValue === 'custom') {
    return elements.passwordFieldCustom?.value || 'password';
  }
  return selectValue || 'password';
}

/**
 * Get actual wrapper value
 */
function getWrapperValue() {
  const selectValue = elements.requestWrapperSelect?.value;
  if (selectValue === 'custom') {
    return elements.requestWrapperCustom?.value || '';
  }
  return selectValue || '';
}

/**
 * Handle API format preset change
 */
function handleApiFormatPresetChange() {
  const preset = elements.apiFormatPresetSelect?.value;
  
  // Show/hide custom format section
  toggleApiFormatCustomSection();
  
  const presets = {
    'current-api': {
      usernameField: 'email',
      passwordField: 'password',
      wrapper: 'request',
      additionalFields: '{}',
      tokenPath: 'Data.Token',
      errorPath: 'Message'
    },
    'simple-auth': {
      usernameField: 'username',
      passwordField: 'password',
      wrapper: '',
      additionalFields: '{}',
      tokenPath: 'token',
      errorPath: 'message'
    },
    'oauth-password': {
      usernameField: 'username',
      passwordField: 'password',
      wrapper: '',
      additionalFields: '{"grant_type": "password"}',
      tokenPath: 'access_token',
      errorPath: 'error_description'
    },
    'email-auth': {
      usernameField: 'email',
      passwordField: 'password',
      wrapper: '',
      additionalFields: '{}',
      tokenPath: 'access_token',
      errorPath: 'error'
    },
    'loginname-auth': {
      usernameField: 'loginname',
      passwordField: 'password',
      wrapper: '',
      additionalFields: '{}',
      tokenPath: 'token',
      errorPath: 'error'
    }
  };
  
  if (preset && presets[preset]) {
    const config = presets[preset];
    
    // Set dropdown values
    if (elements.usernameFieldSelect) elements.usernameFieldSelect.value = config.usernameField;
    if (elements.passwordFieldSelect) elements.passwordFieldSelect.value = config.passwordField;
    if (elements.requestWrapperSelect) elements.requestWrapperSelect.value = config.wrapper;
    if (elements.additionalFieldsInput) elements.additionalFieldsInput.value = config.additionalFields;
    if (elements.tokenPathInput) elements.tokenPathInput.value = config.tokenPath;
    if (elements.errorPathInput) elements.errorPathInput.value = config.errorPath;
    
    // Hide custom fields
    toggleCustomUsernameField();
    toggleCustomPasswordField();
    toggleCustomWrapperField();
    
    updateApiFormatPreview();
  }
}

/**
 * Populate API format settings
 */
function populateAPIFormatSettings() {
  if (!state.settings.apiFormat) return;
  
  const apiFormat = state.settings.apiFormat;
  
  // Set username field
  if (elements.usernameFieldSelect && apiFormat.request?.usernameField) {
    const usernameField = apiFormat.request.usernameField;
    const predefinedValues = ['email', 'username', 'loginname', 'user', 'login'];
    
    if (predefinedValues.includes(usernameField)) {
      elements.usernameFieldSelect.value = usernameField;
    } else {
      elements.usernameFieldSelect.value = 'custom';
      if (elements.usernameFieldCustom) {
        elements.usernameFieldCustom.value = usernameField;
        elements.usernameFieldCustom.style.display = 'block';
      }
    }
  }
  
  // Set password field
  if (elements.passwordFieldSelect && apiFormat.request?.passwordField) {
    const passwordField = apiFormat.request.passwordField;
    const predefinedValues = ['password', 'pass', 'pwd', 'passwd'];
    
    if (predefinedValues.includes(passwordField)) {
      elements.passwordFieldSelect.value = passwordField;
    } else {
      elements.passwordFieldSelect.value = 'custom';
      if (elements.passwordFieldCustom) {
        elements.passwordFieldCustom.value = passwordField;
        elements.passwordFieldCustom.style.display = 'block';
      }
    }
  }
  
  // Set wrapper field
  if (elements.requestWrapperSelect && apiFormat.request?.wrapper !== undefined) {
    const wrapper = apiFormat.request.wrapper || '';
    const predefinedValues = ['', 'request', 'data', 'user', 'credentials'];
    
    if (predefinedValues.includes(wrapper)) {
      elements.requestWrapperSelect.value = wrapper;
    } else {
      elements.requestWrapperSelect.value = 'custom';
      if (elements.requestWrapperCustom) {
        elements.requestWrapperCustom.value = wrapper;
        elements.requestWrapperCustom.style.display = 'block';
      }
    }
  }
  
  // Set additional fields
  if (elements.additionalFieldsInput && apiFormat.request?.additionalFields) {
    elements.additionalFieldsInput.value = JSON.stringify(apiFormat.request.additionalFields, null, 2);
  }
  
  // Set response settings
  if (elements.tokenPathInput && apiFormat.response?.tokenPath) {
    elements.tokenPathInput.value = apiFormat.response.tokenPath;
  }
  if (elements.errorPathInput && apiFormat.response?.errorPath) {
    elements.errorPathInput.value = apiFormat.response.errorPath;
  }
}

/**
 * Update API format preview
 */
function updateApiFormatPreview() {
  if (!elements.apiFormatPreview) return;
  
  try {
    const usernameField = getUsernameFieldValue();
    const passwordField = getPasswordFieldValue();
    const wrapper = getWrapperValue();
    const additionalFields = elements.additionalFieldsInput?.value?.trim() || '{}';
    
    let preview = {
      [usernameField]: 'user@example.com',
      [passwordField]: 'password123'
    };
    
    // Add additional fields
    try {
      const additional = JSON.parse(additionalFields);
      preview = { ...preview, ...additional };
    } catch (e) {
      // Invalid JSON, ignore
    }
    
    // Wrap if specified
    if (wrapper && wrapper.trim()) {
      preview = { [wrapper]: preview };
    }
    
    elements.apiFormatPreview.textContent = JSON.stringify(preview, null, 2);
  } catch (error) {
    elements.apiFormatPreview.textContent = 'Invalid configuration';
  }
}

/**
 * Handle login button click
 */
async function handleLogin() {
  const environment = elements.environmentSelect?.value;
  const username = elements.usernameInput?.value;
  const password = elements.passwordInput?.value;
  const customEndpoint = elements.loginEndpointInput?.value?.trim();
  const tokenPath = elements.tokenPathQuickInput?.value?.trim();

  if (!environment || !username || !password) {
    showMessage('Please fill in all required fields', 'error');
    return;
  }
  
  if (!customEndpoint) {
    showMessage('Please enter the login endpoint path', 'error');
    return;
  }

  if (!tokenPath) {
    showMessage('Please enter the token path in response', 'error');
    return;
  }

  try {
    showMessage('Authenticating...', 'info');
    updateLoginStatus('authenticating');
    
    // First save API format settings, login endpoint, and token path
    await saveApiFormatSettings();
    await saveLoginEndpoint(customEndpoint);
    await saveTokenPath(tokenPath);
    
    const response = await safeRuntimeSendMessage({
      action: 'AUTHENTICATE',
      environment,
      username,
      password,
      customEndpoint: customEndpoint
    });

    if (response && response.success) {
      showMessage('Authentication successful!', 'success');
      updateLoginStatus('authenticated');
      
      // Save credentials
      await safeRuntimeSendMessage({
        action: 'SAVE_CREDENTIALS',
        username,
        environment,
        password
      });
      
      // Reload tokens and credentials
      await loadRoleTokens();
      await loadSavedCredentials();
      
    } else {
      showMessage(`Authentication failed: ${response?.error || 'Unknown error'}`, 'error');
      updateLoginStatus('failed');
    }
  } catch (error) {

    showMessage(`Login failed: ${error.message}`, 'error');
    updateLoginStatus('failed');
  }
}

/**
 * Handle test login
 */
async function handleTestLogin() {
  const environment = elements.environmentSelect?.value;
  const username = elements.usernameInput?.value;
  const password = elements.passwordInput?.value;
  const customEndpoint = elements.loginEndpointInput?.value?.trim();
  const tokenPath = elements.tokenPathQuickInput?.value?.trim();

  if (!environment || !username || !password) {
    showMessage('Please fill in all required fields', 'error');
    return;
  }

  if (!customEndpoint) {
    showMessage('Please enter the login endpoint path', 'error');
    return;
  }

  if (!tokenPath) {
    showMessage('Please enter the token path in response', 'error');
    return;
  }

  try {
    showMessage('Testing authentication...', 'info');
    
    // First save API format settings, login endpoint, and token path
    await saveApiFormatSettings();
    await saveLoginEndpoint(customEndpoint);
    await saveTokenPath(tokenPath);
    
    const response = await safeRuntimeSendMessage({
      action: 'TEST_AUTHENTICATE',
      environment,
      username,
      password,
      customEndpoint: customEndpoint
    });

    if (response && response.success) {
      showTestResultModal(response);
    } else {
      showMessage(`Test failed: ${response?.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {

    showMessage(`Test failed: ${error.message}`, 'error');
  }
}

/**
 * Show test result modal (simplified)
 */
function showTestResultModal(result) {
  const message = `Test Result:\n${result.success ? '✅ Success' : '❌ Failed'}\nStatus: ${result.statusCode}\nToken: ${result.token ? 'Found' : 'Not found'}`;
  alert(message);
}

/**
 * Save API format settings
 */
async function saveApiFormatSettings() {
  try {
    const wrapper = getWrapperValue();
    const apiFormat = {
      request: {
        usernameField: getUsernameFieldValue(),
        passwordField: getPasswordFieldValue(),
        wrapper: wrapper && wrapper.trim() ? wrapper.trim() : null,
        additionalFields: JSON.parse(elements.additionalFieldsInput?.value || '{}')
      },
      response: {
        tokenPath: elements.tokenPathInput?.value || 'token',
        errorPath: elements.errorPathInput?.value || 'message',
        successField: 'success'
      }
    };
    
    const updatedSettings = { ...state.settings, apiFormat };
    
    const response = await safeRuntimeSendMessage({
      action: 'SAVE_SETTINGS',
      settings: updatedSettings
    });
    
    if (response && response.success) {
      state.settings = updatedSettings;
      return true;
    }
    return false;
  } catch (error) {

    return false;
  }
}

/**
 * Save login endpoint setting
 */
async function saveLoginEndpoint(endpoint) {
  try {
    const updatedSettings = { ...state.settings, loginEndpoint: endpoint };
    
    const response = await safeRuntimeSendMessage({
      action: 'SAVE_SETTINGS',
      settings: updatedSettings
    });
    
    if (response && response.success) {
      state.settings = updatedSettings;
      return true;
    }
    return false;
    } catch (error) {

    return false;
  }
}

/**
 * Save token path setting and sync with API format
 */
async function saveTokenPath(tokenPath) {
  try {
    // Update both the quick setting and the API format
    const apiFormat = state.settings.apiFormat || {
      request: { usernameField: 'username', passwordField: 'password', wrapper: null, additionalFields: {} },
      response: { tokenPath: 'token', errorPath: 'message', successField: 'success' }
    };
    
    apiFormat.response.tokenPath = tokenPath;
    
    const updatedSettings = { 
      ...state.settings, 
      tokenPath: tokenPath,  // Quick access
      apiFormat: apiFormat   // Full API format
    };
    
    const response = await safeRuntimeSendMessage({
      action: 'SAVE_SETTINGS',
      settings: updatedSettings
    });
    
    if (response && response.success) {
      state.settings = updatedSettings;
      
      // Sync both fields
      if (elements.tokenPathInput) {
        elements.tokenPathInput.value = tokenPath;
      }
      if (elements.tokenPathQuickInput) {
        elements.tokenPathQuickInput.value = tokenPath;
      }
      
      return true;
    }
    return false;
  } catch (error) {

    return false;
  }
}

/**
 * Populate login endpoint from saved settings
 */
function populateLoginEndpoint() {
  if (elements.loginEndpointInput && state.settings.loginEndpoint) {
    elements.loginEndpointInput.value = state.settings.loginEndpoint;
  } else if (elements.loginEndpointInput) {
    // Set default value if no saved setting
    elements.loginEndpointInput.value = '/api/auth/login';
  }
}

/**
 * Populate token path from saved settings
 */
function populateTokenPath() {
  let tokenPath = '';
  
  // Try to get from API format first (most reliable)
  if (state.settings.apiFormat?.response?.tokenPath) {
    tokenPath = state.settings.apiFormat.response.tokenPath;
  } 
  // Fallback to quick setting
  else if (state.settings.tokenPath) {
    tokenPath = state.settings.tokenPath;
  } 
  // Default
  else {
    tokenPath = 'Data.Token';
  }
  
  // Set both fields
  if (elements.tokenPathQuickInput) {
    elements.tokenPathQuickInput.value = tokenPath;
  }
  if (elements.tokenPathInput) {
    elements.tokenPathInput.value = tokenPath;
  }
}

/**
 * Update login status
 */
function updateLoginStatus(status) {
  if (!elements.loginStatusText) return;
  
  const statusMap = {
    'not_authenticated': 'Not authenticated',
    'authenticating': 'Authenticating...',
    'authenticated': 'Authenticated ✅',
    'failed': 'Authentication failed ❌'
  };
  
  elements.loginStatusText.textContent = statusMap[status] || status;
}

/**
 * Load saved credentials
 */
async function loadSavedCredentials() {
  try {
    const response = await safeRuntimeSendMessage({ action: 'GET_SAVED_CREDENTIALS' });
    
    if (response && response.success) {
      state.savedCredentials = response.credentials || [];
      displaySavedCredentials();
    }
  } catch (error) {

  }
}

/**
 * Display saved credentials
 */
function displaySavedCredentials() {
  if (!elements.credentialsList || !elements.savedCredentialsContainer) return;
  
  if (state.savedCredentials.length === 0) {
    elements.savedCredentialsContainer.style.display = 'none';
      return;
    }
    
  elements.savedCredentialsContainer.style.display = 'block';
  elements.credentialsList.innerHTML = '';
  
  state.savedCredentials.slice(0, 5).forEach(credential => {
    const credElement = createCredentialElement(credential);
    elements.credentialsList.appendChild(credElement);
  });
}

/**
 * Create credential element
 */
function createCredentialElement(credential) {
  const div = document.createElement('div');
  div.className = 'credential-item';
  
  const lastUsed = credential.lastUsed ? new Date(credential.lastUsed).toLocaleDateString() : 'Never';
  const created = credential.createdAt ? new Date(credential.createdAt).toLocaleDateString() : '';
  
  div.innerHTML = `
    <div class="credential-info">
      <div class="credential-main">
        <span class="credential-username">${credential.username}</span>
        <span class="credential-environment">${credential.environment}</span>
      </div>
      <div class="credential-meta">
        <span class="credential-time">Last used: ${lastUsed}</span>
        ${created ? ` • Created: ${created}` : ''}
      </div>
    </div>
    <div class="credential-actions">
      <button class="btn btn-xs btn-primary use-credential" data-id="${credential.id}" title="Auto-fill login form">
        🚀 Use
      </button>
      <button class="btn btn-xs btn-danger delete-credential" data-id="${credential.id}" title="Delete credential">
        🗑️
      </button>
    </div>
  `;
  
  const useButton = div.querySelector('.use-credential');
  const deleteButton = div.querySelector('.delete-credential');
  
  if (useButton) {
    useButton.addEventListener('click', () => useCredential(credential));
  }
  if (deleteButton) {
    deleteButton.addEventListener('click', () => deleteCredential(credential.id));
  }
  
  return div;
}

/**
 * Use saved credential
 */
function useCredential(credential) {
  if (elements.environmentSelect) {
    elements.environmentSelect.value = credential.environment;
    handleEnvironmentChange();
  }
  if (elements.usernameInput) {
    elements.usernameInput.value = credential.username;
  }
  if (elements.passwordInput && credential.password) {
    elements.passwordInput.value = credential.password;
  }
  
  safeRuntimeSendMessage({
    action: 'UPDATE_CREDENTIALS_LAST_USED',
    credentialId: credential.id
  });
  
  showMessage('Credentials auto-filled', 'success');
}

/**
 * Delete saved credential
 */
async function deleteCredential(credentialId) {
  try {
    const response = await safeRuntimeSendMessage({
      action: 'DELETE_CREDENTIALS',
      credentialId
    });
    
    if (response && response.success) {
      await loadSavedCredentials();
      showMessage('Credential deleted', 'success');
    } else {
      showMessage('Failed to delete credential', 'error');
    }
  } catch (error) {

    showMessage('Failed to delete credential', 'error');
  }
}

/**
 * Handle clear credentials
 */
async function handleClearCredentials() {
  if (!confirm('Clear all saved credentials?')) return;
  
  try {
    const response = await safeRuntimeSendMessage({
      action: 'CLEAR_SAVED_CREDENTIALS'
    });
    
    if (response && response.success) {
      await loadSavedCredentials();
      showMessage('All credentials cleared', 'success');
    } else {
      showMessage('Failed to clear credentials', 'error');
    }
  } catch (error) {

    showMessage('Failed to clear credentials', 'error');
  }
}

/**
 * Load role tokens
 */
async function loadRoleTokens() {
  try {
    const response = await safeRuntimeSendMessage({ action: 'GET_ROLE_TOKENS' });
    
    if (response && response.success) {
      state.roleTokens = response.tokens || [];
      state.activeToken = response.activeToken || null;
      populateActiveTokenSelect();
      displayTokenList();
      
      // Update header token display
      updateHeader();
      
      // Notify content script to update banner
      await safeTabsOperation(async () => {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'RELOAD_TOKENS'});
        }
      });
    }
  } catch (error) {

  }
}

/**
 * Populate active token select dropdown
 */
function populateActiveTokenSelect() {
  if (!elements.activeTokenSelect) return;
  
  elements.activeTokenSelect.innerHTML = '<option value="">Select a token...</option>';
  
  if (state.roleTokens && Array.isArray(state.roleTokens)) {
    state.roleTokens.forEach(token => {
      const option = document.createElement('option');
      option.value = token.id;
      option.textContent = `${token.role} (${token.token.substring(0, 20)}...)`;
      
      if (state.activeToken && state.activeToken.id === token.id) {
        option.selected = true;
      }
      
      elements.activeTokenSelect.appendChild(option);
    });
  }
}

/**
 * Display token list
 */
function displayTokenList() {
  if (!elements.tokenList) return;
  
  if (state.roleTokens.length === 0) {
    elements.tokenList.innerHTML = `
      <div class="empty-state">
        <p>No tokens stored yet</p>
        <small>Create tokens by logging in or add them manually</small>
      </div>
    `;
      return;
    }
    
  elements.tokenList.innerHTML = '';
  
  // Sort tokens: active first, then by creation date
  const sortedTokens = [...state.roleTokens].sort((a, b) => {
    const aIsActive = state.activeToken && state.activeToken.id === a.id;
    const bIsActive = state.activeToken && state.activeToken.id === b.id;
    
    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;
    
    // If both active or both inactive, sort by creation date (newest first)
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
  
  sortedTokens.forEach(token => {
    const tokenElement = createTokenElement(token);
    elements.tokenList.appendChild(tokenElement);
  });
}

/**
 * Create token list element
 */
function createTokenElement(token) {
  const div = document.createElement('div');
  const isActive = state.activeToken && state.activeToken.id === token.id;
  
  div.className = `token-item ${isActive ? 'active' : ''}`;
  
  // Parse JWT to get expiry info if possible
  let tokenInfo = '';
  let expiryInfo = '';
  try {
    const payload = JSON.parse(atob(token.token.split('.')[1]));
    if (payload.exp) {
      const expiry = new Date(payload.exp * 1000);
      const now = new Date();
      const isExpired = expiry < now;
      const timeLeft = isExpired ? 'Expired' : formatTimeRemaining(expiry - now);
      expiryInfo = `<span class="token-expiry ${isExpired ? 'expired' : ''}">${timeLeft}</span>`;
    }
    if (payload.email || payload.sub || payload.username) {
      tokenInfo = payload.email || payload.sub || payload.username;
    }
  } catch (e) {
    // Not a JWT or can't parse
  }
  
  const tokenPreview = token.token.length > 60 
    ? `${token.token.substring(0, 30)}...${token.token.substring(token.token.length - 20)}`
    : token.token;
  
  const createdTime = token.createdAt ? new Date(token.createdAt).toLocaleDateString() : '';
  
  div.innerHTML = `
    <div class="token-card">
      <div class="token-header">
        <div class="token-header-left">
          <div class="token-role-container">
            <span class="token-role">${token.role}</span>
            ${isActive ? '<span class="active-badge">🔹 Active</span>' : ''}
          </div>
          ${tokenInfo ? `<div class="token-user">${tokenInfo}</div>` : ''}
        </div>
        <div class="token-status">
          ${expiryInfo}
          ${token.environment ? `<span class="token-env">${token.environment}</span>` : ''}
        </div>
      </div>
      
      <div class="token-content">
        <div class="token-preview-container">
          <span class="token-preview-label">Token:</span>
          <code class="token-preview">${tokenPreview}</code>
          <button class="token-copy-btn" data-token="${token.token}" title="Copy token">📋</button>
        </div>
        ${createdTime ? `<div class="token-meta">Created: ${createdTime}</div>` : ''}
      </div>
      
      <div class="token-actions">
        <button class="btn btn-xs btn-outline edit-token" data-id="${token.id}" title="Edit token">
          ✏️ Edit
        </button>
        <button class="btn btn-xs btn-secondary view-token-details" data-id="${token.id}" title="View token details">
          🔍 Details
        </button>
        ${!isActive ? `<button class="btn btn-xs btn-primary set-active-token" data-id="${token.id}" title="Set as active token">
          ⚡ Activate
        </button>` : ''}
        <button class="btn btn-xs btn-danger delete-token" data-id="${token.id}" title="Delete token">
          🗑️ Delete
        </button>
      </div>
    </div>
  `;
  
  // Add event listeners
  const editBtn = div.querySelector('.edit-token');
  const setActiveBtn = div.querySelector('.set-active-token');
  const deleteBtn = div.querySelector('.delete-token');
  const copyBtn = div.querySelector('.token-copy-btn');
  const viewDetailsBtn = div.querySelector('.view-token-details');
  
  if (editBtn) {
    editBtn.addEventListener('click', () => editToken(token));
  }
  if (setActiveBtn) {
    setActiveBtn.addEventListener('click', () => setActiveToken(token.id));
  }
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => deleteToken(token.id));
  }
  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(token.token).then(() => {
        showMessage('Token copied to clipboard', 'success');
        copyBtn.textContent = '✅';
        setTimeout(() => copyBtn.textContent = '📋', 2000);
      }).catch(() => {
        showMessage('Failed to copy token', 'error');
      });
    });
  }
  if (viewDetailsBtn) {
    viewDetailsBtn.addEventListener('click', () => showTokenDetails(token));
  }
  
  return div;
}



/**
 * Show token form
 */
function showTokenForm(token = null) {
  if (!elements.tokenForm) return;
  
  state.currentEditingToken = token;
  
  if (token) {
    elements.tokenFormTitle.textContent = 'Edit Token';
    elements.tokenRoleInput.value = token.role;
    elements.tokenValueInput.value = token.token;
    elements.tokenDescInput.value = token.description || '';
  } else {
    elements.tokenFormTitle.textContent = 'Add New Token';
    elements.tokenRoleInput.value = '';
    elements.tokenValueInput.value = '';
    elements.tokenDescInput.value = '';
  }
  
  elements.tokenForm.style.display = 'block';
}

/**
 * Hide token form
 */
function hideTokenForm() {
  if (!elements.tokenForm) return;
  
  elements.tokenForm.style.display = 'none';
  state.currentEditingToken = null;
}

/**
 * Edit token
 */
function editToken(token) {
  showTokenForm(token);
}

/**
 * Handle save token
 */
async function handleSaveToken() {
  const role = elements.tokenRoleInput?.value?.trim();
  const tokenValue = elements.tokenValueInput?.value?.trim();
  const description = elements.tokenDescInput?.value?.trim();
  
  if (!role || !tokenValue) {
    showMessage('Please enter role and token value', 'error');
      return;
    }
    
  try {
    const tokenData = {
      role,
      token: tokenValue,
      description,
      id: state.currentEditingToken?.id || undefined
    };
    
    const response = await safeRuntimeSendMessage({
      action: 'SAVE_ROLE_TOKEN',
      tokenData
    });
    
    if (response && response.success) {
      showMessage('Token saved successfully!', 'success');
      hideTokenForm();
      await loadRoleTokens();
    } else {
      showMessage(`Failed to save token: ${response?.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {

    showMessage(`Failed to save token: ${error.message}`, 'error');
  }
}

/**
 * Set active token
 */
async function setActiveToken(tokenId) {
  try {
    const response = await safeRuntimeSendMessage({
      action: 'SET_ACTIVE_TOKEN',
      tokenId
    });
    
    if (response && response.success) {
      state.activeToken = response.activeToken;
      populateActiveTokenSelect();
      displayTokenList();
      showMessage('Active token updated', 'success');
    } else {
      showMessage(`Failed to set active token: ${response?.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {

    showMessage(`Failed to set active token: ${error.message}`, 'error');
  }
}

/**
 * Delete token
 */
async function deleteToken(tokenId) {
  if (!confirm('Delete this token?')) return;
  
  try {
    const response = await safeRuntimeSendMessage({
      action: 'DELETE_ROLE_TOKEN',
      tokenId
    });
    
    if (response && response.success) {
      await loadRoleTokens();
      showMessage('Token deleted', 'success');
    } else {
      showMessage('Failed to delete token', 'error');
    }
  } catch (error) {

    showMessage('Failed to delete token', 'error');
  }
}

/**
 * Handle active token change
 */
async function handleActiveTokenChange() {
  const tokenId = elements.activeTokenSelect?.value;
  
  if (!tokenId) return;
  
  await setActiveToken(tokenId);
}

/**
 * Handle clear tokens
 */
async function handleClearTokens() {
  if (!confirm('Clear all tokens?')) return;
  
  try {
    const response = await safeRuntimeSendMessage({
      action: 'CLEAR_ROLE_TOKENS'
    });
    
    if (response && response.success) {
      await loadRoleTokens();
      showMessage('All tokens cleared', 'success');
    } else {
      showMessage('Failed to clear tokens', 'error');
    }
  } catch (error) {

    showMessage('Failed to clear tokens', 'error');
  }
}

/**
 * Populate token format settings
 */
function populateTokenFormatSettings() {
  if (!state.settings) return;
  
  const tokenFormat = state.settings.tokenFormat || 'value';
  const tokenPrefix = state.settings.tokenPrefix || '';
  const tokenHeader = state.settings.tokenHeader || 'Authorization';
  
  if (elements.tokenFormatSelect) {
    elements.tokenFormatSelect.value = tokenFormat;
  }
  if (elements.tokenPrefixInput) {
    elements.tokenPrefixInput.value = tokenPrefix;
  }
  if (elements.tokenHeaderInput) {
    elements.tokenHeaderInput.value = tokenHeader;
  }
  
  // Set preset based on current settings
  if (elements.tokenPresetSelect) {
    if (tokenFormat === 'value' && !tokenPrefix) {
      elements.tokenPresetSelect.value = 'plain';
    } else if (tokenFormat === 'prefix' && tokenPrefix === 'Bearer') {
      elements.tokenPresetSelect.value = 'bearer';
  } else {
      elements.tokenPresetSelect.value = 'custom';
    }
  }
}

/**
 * Handle token preset change
 */
function handleTokenPresetChange() {
  const preset = elements.tokenPresetSelect?.value;
  
  // Show/hide custom format section
  toggleTokenFormatCustomSection();
  
  const presets = {
    'plain': { format: 'value', prefix: '', header: 'Authorization' },
    'bearer': { format: 'prefix', prefix: 'Bearer', header: 'Authorization' },
    'token': { format: 'prefix', prefix: 'Token', header: 'Authorization' },
    'apikey': { format: 'prefix', prefix: 'ApiKey', header: 'Authorization' },
    'x-api-key': { format: 'value', prefix: '', header: 'X-API-Key' }
  };
  
  if (preset && presets[preset]) {
    const config = presets[preset];
    if (elements.tokenFormatSelect) elements.tokenFormatSelect.value = config.format;
    if (elements.tokenPrefixInput) elements.tokenPrefixInput.value = config.prefix;
    if (elements.tokenHeaderInput) elements.tokenHeaderInput.value = config.header;
    
    updateTokenFormatPreview();
  }
}

/**
 * Toggle token format custom section visibility
 */
function toggleTokenFormatCustomSection() {
  const preset = elements.tokenPresetSelect?.value;
  const customSection = document.getElementById('tokenFormatCustom');
  
  if (customSection) {
    customSection.style.display = preset === 'custom' ? 'block' : 'none';
  }
  
  // Also update the prefix group visibility
  updateTokenPrefixVisibility();
}

/**
 * Update token prefix field visibility
 */
function updateTokenPrefixVisibility() {
  const format = elements.tokenFormatSelect?.value;
  const prefixGroup = document.getElementById('tokenPrefixGroup');
  
  if (prefixGroup) {
    prefixGroup.style.display = format === 'prefix' ? 'block' : 'none';
  }
}

/**
 * Update token format preview
 */
function updateTokenFormatPreview() {
  if (!elements.tokenFormatPreview) return;
  
  // Update prefix visibility when format changes
  updateTokenPrefixVisibility();
  
  const format = elements.tokenFormatSelect?.value || 'value';
  const prefix = elements.tokenPrefixInput?.value || '';
  const header = elements.tokenHeaderInput?.value || 'Authorization';
  
  const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0...';
  
  let preview;
  if (format === 'prefix' && prefix) {
    preview = `${header}: ${prefix} ${sampleToken}`;
  } else {
    preview = `${header}: ${sampleToken}`;
  }
  
  elements.tokenFormatPreview.textContent = preview;
}

/**
 * Handle save token format
 */
async function handleSaveTokenFormat() {
  try {
    const tokenFormatSettings = {
      tokenFormat: elements.tokenFormatSelect?.value || 'value',
      tokenPrefix: elements.tokenPrefixInput?.value || '',
      tokenHeader: elements.tokenHeaderInput?.value || 'Authorization'
    };
    
    const updatedSettings = { ...state.settings, ...tokenFormatSettings };
    
    const response = await safeRuntimeSendMessage({
      action: 'SAVE_SETTINGS',
      settings: updatedSettings
    });
    
    if (response && response.success) {
      state.settings = updatedSettings;
      showMessage('Token format saved successfully!', 'success');
      
      // Notify content scripts
      safeRuntimeSendMessage({ action: 'UPDATE_SETTINGS' });
    } else {
      showMessage('Failed to save token format', 'error');
    }
  } catch (error) {

    showMessage('Failed to save token format', 'error');
  }
}

/**
 * Handle reset token format
 */
async function handleResetTokenFormat() {
  if (!confirm('Reset token format to defaults?')) return;
  
  // Set to plain token defaults
  if (elements.tokenFormatSelect) elements.tokenFormatSelect.value = 'value';
  if (elements.tokenPrefixInput) elements.tokenPrefixInput.value = '';
  if (elements.tokenHeaderInput) elements.tokenHeaderInput.value = 'Authorization';
  if (elements.tokenPresetSelect) elements.tokenPresetSelect.value = 'plain';
  
  updateTokenFormatPreview();
  await handleSaveTokenFormat();
}



/**
 * Populate UI settings
 */
function populateUISettings() {
  if (elements.darkModeToggle && state.settings.darkMode !== undefined) {
    elements.darkModeToggle.checked = state.settings.darkMode;
  }
  if (elements.autoCollapseToggle && state.settings.autoCollapse !== undefined) {
    elements.autoCollapseToggle.checked = state.settings.autoCollapse;
  }
  if (elements.copyButtonsToggle && state.settings.copyButtons !== undefined) {
    elements.copyButtonsToggle.checked = state.settings.copyButtons;
  }

}

/**
 * Handle UI setting change
 */
async function handleUISettingChange() {
  try {
    const updatedSettings = {
      ...state.settings,
      darkMode: elements.darkModeToggle?.checked || false,
      autoCollapse: elements.autoCollapseToggle?.checked || false,
      copyButtons: elements.copyButtonsToggle?.checked !== false // default true
    };
    
    const response = await safeRuntimeSendMessage({
      action: 'SAVE_SETTINGS',
      settings: updatedSettings
    });
    
    if (response && response.success) {
      state.settings = updatedSettings;
      // Notify content scripts
      safeRuntimeSendMessage({ action: 'UPDATE_SETTINGS' });
      showMessage('UI settings updated', 'success');
    } else {
      showMessage('Failed to save UI settings', 'error');
    }
  } catch (error) {

    showMessage('Failed to save UI settings', 'error');
  }
}



/**
 * Handle refresh page button click
 */
async function handleRefreshPage() {
  const success = await safeTabsOperation(async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      await chrome.tabs.reload(tabs[0].id);
    } else {
      throw new Error('No active tab found');
    }
  });
  
  if (success) {
    showMessage('Page refreshed', 'success');
  } else {
    showMessage('Failed to refresh page', 'error');
  }
}

/**
 * Handle export config button click
 */
async function handleExportConfig() {
  try {
    // Get all settings and environments
    const [settingsResponse, envResponse, tokensResponse] = await Promise.all([
      safeRuntimeSendMessage({ action: 'GET_SETTINGS' }),
      safeRuntimeSendMessage({ action: 'GET_ENVIRONMENTS' }),
      safeRuntimeSendMessage({ action: 'GET_ROLE_TOKENS' })
    ]);
    
    const config = {
      settings: settingsResponse?.settings || {},
      environments: envResponse?.environments || {},
      tokens: tokensResponse?.tokens || [],
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
    
    // Create and download file
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swagger-helper-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage('Configuration exported successfully', 'success');
  } catch (error) {

    showMessage('Export failed', 'error');
  }
}

/**
 * Handle import config button click
 */
function handleImportConfig() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      
      // Validate config structure
      if (!config.settings && !config.environments && !config.tokens) {
        throw new Error('Invalid configuration file format');
      }
      
      // Import settings
      if (config.settings) {
        await safeRuntimeSendMessage({
          action: 'SAVE_SETTINGS',
          settings: config.settings
        });
      }
      
      // Import environments
      if (config.environments) {
        for (const [name, url] of Object.entries(config.environments)) {
          await safeRuntimeSendMessage({
            action: 'SAVE_ENVIRONMENT',
            name,
            url
          });
        }
      }
      
      // Import tokens (basic validation)
      if (config.tokens && Array.isArray(config.tokens)) {
        for (const token of config.tokens) {
          if (token.role && token.token) {
            await safeRuntimeSendMessage({
              action: 'SAVE_ROLE_TOKEN',
              role: token.role,
              token: token.token,
              environment: token.environment || 'imported'
            });
          }
        }
      }
      
      showMessage('Configuration imported successfully', 'success');
      // Reload data
      await loadInitialData();
      
    } catch (error) {

      showMessage('Import failed: ' + error.message, 'error');
    }
  });
  
  input.click();
}

/**
 * Handle export postman button click
 */
async function handleExportPostman() {
  try {
    // Get environments and active token
    const [envResponse, activeTokenResponse] = await Promise.all([
      safeRuntimeSendMessage({ action: 'GET_ENVIRONMENTS' }),
      safeRuntimeSendMessage({ action: 'GET_ACTIVE_TOKEN' })
    ]);
    
    const environments = envResponse?.environments || {};
    const activeToken = activeTokenResponse?.token;
    
    // Create basic Postman collection structure
    const collection = {
      info: {
        name: "Swagger Helper Export",
        description: "Exported from Swagger Helper Extension",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      auth: activeToken ? {
        type: "bearer",
        bearer: [
          {
            key: "token",
            value: activeToken.token,
            type: "string"
          }
        ]
      } : undefined,
      variable: Object.entries(environments).map(([name, url]) => ({
        key: `${name}_url`,
        value: url,
        type: "string"
      })),
      item: []
    };
    
    // Create and download file
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swagger-helper-postman-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage('Postman collection exported successfully', 'success');
  } catch (error) {

    showMessage('Postman export failed', 'error');
  }
}



/**
 * Show status message
 */
function showMessage(message, type = 'info') {
  // Update status indicator
  if (elements.statusText) {
    elements.statusText.textContent = message;
  }
  
  if (elements.statusDot) {
    elements.statusDot.className = `status-dot ${type}`;
  }
  
  // Auto-clear after 3 seconds
  setTimeout(() => {
    if (elements.statusText) {
      elements.statusText.textContent = 'Ready';
    }
    if (elements.statusDot) {
      elements.statusDot.className = 'status-dot';
    }
  }, 3000);
}

/**
 * JWT Token Decoder Utilities
 */

/**
 * Decode JWT token
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    
    return {
      header,
      payload,
      signature: parts[2],
      isValid: true
    };
  } catch (error) {
    return {
      header: null,
      payload: null,
      signature: null,
      isValid: false,
      error: error.message
    };
  }
}

/**
 * Format time remaining
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
 * Show token details section
 */
function showTokenDetails(token) {
  const section = document.getElementById('tokenDetailsSection');
  if (!section) return;

  // Populate basic token info
  document.getElementById('decodedTokenRole').textContent = token.role || '-';
  document.getElementById('decodedTokenEnv').textContent = token.environment || '-';
  document.getElementById('decodedTokenCreated').textContent = 
    token.createdAt ? new Date(token.createdAt).toLocaleString() : '-';
  
  // Decode JWT
  const decoded = decodeJWT(token.token);
  
  if (decoded.isValid) {
    // Token type
    document.getElementById('decodedTokenType').textContent = 'JWT (Valid)';
    
    // JWT Header
    document.getElementById('decodedTokenHeader').textContent = 
      JSON.stringify(decoded.header, null, 2);
    
    // JWT Payload
    document.getElementById('decodedTokenPayload').textContent = 
      JSON.stringify(decoded.payload, null, 2);
    
    // Token validity info
    const payload = decoded.payload;
    
    // Issued At
    const iat = payload.iat ? new Date(payload.iat * 1000).toLocaleString() : '-';
    document.getElementById('decodedTokenIat').textContent = iat;
    
    // Expires At
    const exp = payload.exp ? new Date(payload.exp * 1000).toLocaleString() : '-';
    document.getElementById('decodedTokenExp').textContent = exp;
    
    // Status and time remaining
    if (payload.exp) {
      const expiry = new Date(payload.exp * 1000);
      const now = new Date();
      const isExpired = expiry < now;
      const timeRemaining = isExpired ? 'Expired' : formatTimeRemaining(expiry - now);
      
      document.getElementById('decodedTokenStatus').textContent = isExpired ? '❌ Expired' : '✅ Valid';
      document.getElementById('decodedTokenStatus').className = `info-value ${isExpired ? 'expired' : 'valid'}`;
      document.getElementById('decodedTokenTimeRemaining').textContent = timeRemaining;
    } else {
      document.getElementById('decodedTokenStatus').textContent = '❓ No Expiry';
      document.getElementById('decodedTokenTimeRemaining').textContent = 'Never expires';
    }
  } else {
    // Not a valid JWT
    document.getElementById('decodedTokenType').textContent = `API Key/Token (${decoded.error})`;
    document.getElementById('decodedTokenHeader').textContent = 'Not applicable for non-JWT tokens';
    document.getElementById('decodedTokenPayload').textContent = 'Not applicable for non-JWT tokens';
    document.getElementById('decodedTokenIat').textContent = '-';
    document.getElementById('decodedTokenExp').textContent = '-';
    document.getElementById('decodedTokenStatus').textContent = '❓ Unknown';
    document.getElementById('decodedTokenTimeRemaining').textContent = '-';
  }
  
  // Raw token
  document.getElementById('decodedTokenRaw').value = token.token;
  
  // Show section and expand it
  section.style.display = 'block';
  section.classList.remove('collapsed');
  const content = document.getElementById('tokenDetailsContent');
  if (content) content.style.display = 'block';
  const toggle = document.getElementById('tokenDetailsToggle');
  if (toggle) toggle.textContent = '▼';
  
  // Store current token for refresh
  section.dataset.currentTokenId = token.id;
  
  // Scroll to section
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Setup token decoder modal event listeners
 */
function setupCollapsibleSections() {
  // Setup token details section
  const copyRawBtn = document.getElementById('copyRawTokenBtn');
  const refreshBtn = document.getElementById('refreshTokenDecoderBtn');
  const hideTokenDetailsBtn = document.getElementById('hideTokenDetailsBtn');
  const hideReplayResultsBtn = document.getElementById('hideReplayResultsBtn');
  
  if (copyRawBtn) {
    copyRawBtn.addEventListener('click', () => {
      const textarea = document.getElementById('decodedTokenRaw');
      textarea.select();
      navigator.clipboard.writeText(textarea.value).then(() => {
        showMessage('Raw token copied to clipboard', 'success');
        copyRawBtn.textContent = '✅ Copied';
        setTimeout(() => copyRawBtn.textContent = '📋 Copy', 2000);
      }).catch(() => {
        showMessage('Failed to copy token', 'error');
      });
    });
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const section = document.getElementById('tokenDetailsSection');
      const tokenId = section?.dataset.currentTokenId;
      if (tokenId) {
        const token = state.roleTokens.find(t => t.id === tokenId);
        if (token) {
          showTokenDetails(token);
          showMessage('Token details refreshed', 'success');
        }
      }
    });
  }
  
  if (hideTokenDetailsBtn) {
    hideTokenDetailsBtn.addEventListener('click', () => {
      const section = document.getElementById('tokenDetailsSection');
      if (section) section.style.display = 'none';
    });
  }
  
  if (hideReplayResultsBtn) {
    hideReplayResultsBtn.addEventListener('click', () => {
      const section = document.getElementById('replayResultsSection');
      if (section) section.style.display = 'none';
    });
  }
}

/**
 * Toggle collapsible section
 */
function toggleSection(sectionName) {
  const section = document.getElementById(sectionName + 'Section');
  const content = document.getElementById(sectionName + 'Content');
  const toggle = document.getElementById(sectionName + 'Toggle');
  
  if (!section || !content) return;
  
  const isCollapsed = section.classList.contains('collapsed');
  
  if (isCollapsed) {
    section.classList.remove('collapsed');
    content.style.display = 'block';
    if (toggle) toggle.textContent = '▼';
  } else {
    section.classList.add('collapsed');
    content.style.display = 'none';
    if (toggle) toggle.textContent = '▶';
  }
}

// Make toggleSection globally available
window.toggleSection = toggleSection;

/**
 * Header Management Functions
 */

/**
 * Update header environment information
 */
function updateHeaderEnvironment() {
  const selectedEnv = elements.environmentSelect?.value || 'local';
  const envUrl = state.environments[selectedEnv] || '';
  
  if (elements.headerEnvName) {
    elements.headerEnvName.textContent = selectedEnv.charAt(0).toUpperCase() + selectedEnv.slice(1);
  }
  
  if (elements.headerEnvUrl) {
    if (envUrl) {
      elements.headerEnvUrl.textContent = envUrl;
      elements.headerEnvUrl.title = envUrl;
    } else {
      elements.headerEnvUrl.textContent = 'Not configured';
    }
  }
}

/**
 * Update header token information
 */
function updateHeaderToken() {
  const activeToken = state.activeToken;
  
  if (!activeToken || !activeToken.token) {
    // Hide token information
    if (elements.headerTokenRow) {
      elements.headerTokenRow.style.display = 'none';
    }
    if (elements.headerExpiryRow) {
      elements.headerExpiryRow.style.display = 'none';
    }
    return;
  }
  
  // Show token information
  if (elements.headerTokenRow) {
    elements.headerTokenRow.style.display = 'flex';
  }
  
  // Update token name
  if (elements.headerTokenName) {
    elements.headerTokenName.textContent = activeToken.role || 'Unknown';
    elements.headerTokenName.title = activeToken.role || 'Unknown';
  }
  
  // Parse JWT to get expiry information
  const jwtInfo = decodeJWT(activeToken.token);
  
  if (jwtInfo && jwtInfo.payload && jwtInfo.payload.exp) {
    const expiryTime = new Date(jwtInfo.payload.exp * 1000);
    const now = new Date();
    const timeRemaining = expiryTime.getTime() - now.getTime();
    
    updateTokenValidity(timeRemaining, expiryTime);
    
    // Show expiry row
    if (elements.headerExpiryRow) {
      elements.headerExpiryRow.style.display = 'flex';
    }
    
    updateExpiryDisplay(expiryTime, timeRemaining);
  } else {
    // No expiry information available
    updateTokenValidityNoExpiry();
    
    // Hide expiry row
    if (elements.headerExpiryRow) {
      elements.headerExpiryRow.style.display = 'none';
    }
  }
}

/**
 * Update token validity status
 */
function updateTokenValidity(timeRemaining, expiryTime) {
  const isExpired = timeRemaining <= 0;
  const isExpiringSoon = timeRemaining <= 5 * 60 * 1000; // 5 minutes
  const isExpiringCritical = timeRemaining <= 1 * 60 * 1000; // 1 minute
  
  if (elements.headerValidityIndicator && elements.headerValidityText) {
    if (isExpired) {
      elements.headerValidityIndicator.textContent = '🔴';
      elements.headerValidityText.textContent = 'Expired';
      elements.headerValidityText.className = 'validity-text expired';
    } else if (isExpiringCritical) {
      elements.headerValidityIndicator.textContent = '🟡';
      elements.headerValidityText.textContent = 'Critical';
      elements.headerValidityText.className = 'validity-text warning';
    } else if (isExpiringSoon) {
      elements.headerValidityIndicator.textContent = '🟠';
      elements.headerValidityText.textContent = 'Warning';
      elements.headerValidityText.className = 'validity-text warning';
    } else {
      elements.headerValidityIndicator.textContent = '🟢';
      elements.headerValidityText.textContent = 'Valid';
      elements.headerValidityText.className = 'validity-text valid';
    }
  }
}

/**
 * Update token validity when no expiry information is available
 */
function updateTokenValidityNoExpiry() {
  if (elements.headerValidityIndicator && elements.headerValidityText) {
    elements.headerValidityIndicator.textContent = '⚪';
    elements.headerValidityText.textContent = 'Unknown';
    elements.headerValidityText.className = 'validity-text';
  }
}

/**
 * Update expiry display
 */
function updateExpiryDisplay(expiryTime, timeRemaining) {
  if (elements.headerExpiryTime) {
    elements.headerExpiryTime.textContent = expiryTime.toLocaleString();
  }
  
  if (elements.headerExpiryCountdown) {
    const countdown = formatTimeRemaining(timeRemaining);
    elements.headerExpiryCountdown.textContent = countdown;
    
    // Update countdown styling based on time remaining
    elements.headerExpiryCountdown.className = 'expiry-countdown';
    
    if (timeRemaining <= 0) {
      elements.headerExpiryCountdown.classList.add('critical');
      elements.headerExpiryCountdown.textContent = 'EXPIRED';
    } else if (timeRemaining <= 1 * 60 * 1000) { // 1 minute
      elements.headerExpiryCountdown.classList.add('critical');
    } else if (timeRemaining <= 5 * 60 * 1000) { // 5 minutes
      elements.headerExpiryCountdown.classList.add('warning');
    }
  }
}

/**
 * Start the header countdown timer
 */
let headerCountdownInterval = null;

function startHeaderCountdown() {
  // Clear any existing interval
  if (headerCountdownInterval) {
    clearInterval(headerCountdownInterval);
  }
  
  // Update immediately
  updateHeaderToken();
  
  // Update every second
  headerCountdownInterval = setInterval(() => {
    updateHeaderToken();
  }, 1000);
}

/**
 * Stop the header countdown timer
 */
function stopHeaderCountdown() {
  if (headerCountdownInterval) {
    clearInterval(headerCountdownInterval);
    headerCountdownInterval = null;
  }
}

/**
 * Update complete header information
 */
function updateHeader() {
  updateHeaderEnvironment();
  updateHeaderToken();
  
  // Start countdown if we have an active token with expiry
  if (state.activeToken && state.activeToken.token) {
    const jwtInfo = decodeJWT(state.activeToken.token);
    if (jwtInfo && jwtInfo.payload && jwtInfo.payload.exp) {
      startHeaderCountdown();
    } else {
      stopHeaderCountdown();
    }
  } else {
    stopHeaderCountdown();
  }
}

/**
 * Handle header copy token button click
 */
async function handleHeaderCopyToken() {
  if (!state.activeToken || !state.activeToken.token) {
    showMessage('No active token to copy', 'error');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(state.activeToken.token);
    showMessage('Token copied to clipboard', 'success');
    
    // Visual feedback on button
    const originalText = elements.headerCopyTokenBtn.textContent;
    elements.headerCopyTokenBtn.textContent = '✅';
    setTimeout(() => {
      elements.headerCopyTokenBtn.textContent = originalText;
    }, 1000);
  } catch (error) {
    showMessage('Failed to copy token', 'error');
  }
}

/**
 * Handle header token details button click
 */
function handleHeaderTokenDetails() {
  if (!state.activeToken || !state.activeToken.token) {
    showMessage('No active token to view', 'error');
    return;
  }
  
  showTokenDetails(state.activeToken);
}

// Export functions for use by other scripts if needed
window.SwaggerHelperPopup = {
  loadRoleTokens,
  loadSavedCredentials,
  showMessage,
  showTokenDetails,
  decodeJWT,
  updateHeader,
  updateHeaderEnvironment,
  updateHeaderToken
};