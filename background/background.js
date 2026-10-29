/**
 * All-in-One Swagger Helper - Background Service Worker
 * Handles authentication, token management, and communication between popup and content scripts
 */

// Configuration constants
const CONFIG = {
  DEFAULT_LOGIN_ENDPOINT: '/api/auth/login',
  TOKEN_STORAGE_KEY: 'swagger_auth_tokens',
  ENVIRONMENT_STORAGE_KEY: 'swagger_environments',
  SETTINGS_STORAGE_KEY: 'swagger_settings',
  
  // Role-based token storage
  ROLE_TOKENS_STORAGE_KEY: 'swagger_role_tokens',
  ACTIVE_TOKEN_STORAGE_KEY: 'swagger_active_token',

  
  // Saved credentials storage
  SAVED_CREDENTIALS_STORAGE_KEY: 'swagger_saved_credentials',
  MAX_SAVED_CREDENTIALS: 10
};

/**
 * Initialize extension on startup
 */
chrome.runtime.onStartup.addListener(() => {
  initializeStorage();
});

/**
 * Handle installation and updates
 */
chrome.runtime.onInstalled.addListener(() => {
  initializeStorage();
});

/**
 * Initialize storage with default values
 */
async function initializeStorage() {
  try {
    const result = await chrome.storage.local.get([
      CONFIG.TOKEN_STORAGE_KEY,
      CONFIG.ENVIRONMENT_STORAGE_KEY,
      CONFIG.SETTINGS_STORAGE_KEY
    ]);

    // Initialize environments if not present
    if (!result[CONFIG.ENVIRONMENT_STORAGE_KEY]) {
      const defaultEnvironments = {
        local: 'http://localhost:8080',
        dev: 'https://dev-api.example.com',
        staging: 'https://staging-api.example.com',
        prod: 'https://api.example.com'
      };
      await chrome.storage.local.set({
        [CONFIG.ENVIRONMENT_STORAGE_KEY]: defaultEnvironments
      });
    }

    // Initialize or migrate settings
    const defaultSettings = {
      currentEnvironment: 'local',
      autoInject: true,
      darkMode: false,
      autoCollapse: false,
      copyButtons: true,
      // Token format customization - NEW DEFAULTS
      tokenPrefix: '',             // Default: no prefix (plain token)
      tokenHeader: 'Authorization', // Authorization, X-API-Key, etc.
      tokenFormat: 'value',        // Default: 'value' (plain token), 'prefix' (Prefix + token)
      
      // API format customization
      apiFormat: {
        // Request format configuration
        request: {
          usernameField: 'email',     // email, username, loginname, user, etc.
          passwordField: 'password',  // password, pass, pwd, etc.
          wrapper: 'request',         // null for no wrapper, 'request', 'data', 'user', etc.
          additionalFields: {}        // Extra fields like { "grant_type": "password" }
        },
        // Response format configuration  
        response: {
          tokenPath: 'Data.Token',    // Token extraction path: 'token', 'data.accessToken', 'result.access_token', etc.
          errorPath: 'Message',       // Error message path: 'message', 'error', 'error.message', etc.
          successField: 'Success'     // Success indicator field: 'success', 'status', etc.
        }
      }
    };

    if (!result[CONFIG.SETTINGS_STORAGE_KEY]) {
      // No settings exist - create with defaults
      await chrome.storage.local.set({
        [CONFIG.SETTINGS_STORAGE_KEY]: defaultSettings
      });
    } else {
      // Settings exist - check for migration needs
      let settings = result[CONFIG.SETTINGS_STORAGE_KEY];
      let needsUpdate = false;
      
      // MIGRATION: Reset old Bearer token format to new defaults
      if (settings.tokenFormat === 'prefix' && settings.tokenPrefix === 'Bearer') {
        settings.tokenFormat = 'value';  // Plain token
        settings.tokenPrefix = '';       // No prefix
        needsUpdate = true;
      }
      
      // Ensure all new fields exist with defaults
      for (const [key, value] of Object.entries(defaultSettings)) {
        if (!(key in settings)) {
          settings[key] = value;
          needsUpdate = true;
        }
      }
      
      // Deep merge apiFormat if it exists but is incomplete
      if (settings.apiFormat) {
        if (!settings.apiFormat.request) {
          settings.apiFormat.request = defaultSettings.apiFormat.request;
          needsUpdate = true;
        }
        if (!settings.apiFormat.response) {
          settings.apiFormat.response = defaultSettings.apiFormat.response;
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await chrome.storage.local.set({
          [CONFIG.SETTINGS_STORAGE_KEY]: settings
        });
      }
    }

    // Initialize tokens if not present
    if (!result[CONFIG.TOKEN_STORAGE_KEY]) {
      await chrome.storage.local.set({
        [CONFIG.TOKEN_STORAGE_KEY]: {}
      });
    }
  } catch (error) {

  }
}

/**
 * Get nested object value by path (e.g., 'data.token' from { data: { token: 'abc' } })
 */
function getNestedValue(obj, path) {
  if (!path || !obj) return null;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return null;
    }
  }
  
  return current;
}

/**
 * Build request body based on API format configuration
 */
function buildRequestBody(username, password, apiFormat) {
  const requestConfig = apiFormat?.request || {};
  const usernameField = requestConfig.usernameField || 'username';
  const passwordField = requestConfig.passwordField || 'password';
  const wrapper = requestConfig.wrapper;
  const additionalFields = requestConfig.additionalFields || {};
  
  // Create base auth object
  const authData = {
    [usernameField]: username,
    [passwordField]: password,
    ...additionalFields
  };
  
  // Wrap in container if specified
  if (wrapper && wrapper.trim()) {
    return {
      [wrapper]: authData
    };
  }
  
  return authData;
}

/**
 * Extract token from response using configurable path
 */
function extractTokenFromResponseV2(responseData, apiFormat) {
  const tokenPath = apiFormat?.response?.tokenPath;
  if (!tokenPath) {
    // Fallback to legacy extraction
    return extractTokenFromResponse(responseData);
  }
  
  return getNestedValue(responseData, tokenPath);
}

/**
 * Extract error message from response
 */
function extractErrorFromResponse(responseData, apiFormat) {
  const errorPath = apiFormat?.response?.errorPath;
  if (!errorPath) {
    // Common fallbacks
    return responseData?.message || responseData?.error || responseData?.Message || null;
  }
  
  return getNestedValue(responseData, errorPath);
}

/**
 * Legacy token extraction (for backward compatibility)
 */
function extractTokenFromResponse(responseData) {
  if (!responseData) return null;
  
  // Try different common token field names
  const tokenFields = ['token', 'access_token', 'accessToken', 'jwt', 'authToken'];
  
  for (const field of tokenFields) {
    if (responseData[field]) {
      return responseData[field];
    }
  }
  
  // Try nested paths
  const nestedPaths = [
    'data.token', 'data.access_token', 'data.accessToken',
    'result.token', 'result.access_token', 'result.accessToken',
    'Data.Token', 'Data.AccessToken'
  ];
  
  for (const path of nestedPaths) {
    const token = getNestedValue(responseData, path);
    if (token) return token;
  }
  
  return null;
}

/**
 * Parse JWT expiration date
 */
function parseJwtExpiration(token) {
  if (!token) return null;
  
  try {
    // Remove Bearer prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    
    // Split token into parts
    const parts = cleanToken.split('.');
    if (parts.length !== 3) return null;
    
    // Decode payload
    const payload = JSON.parse(atob(parts[1]));
    
    // Extract expiry time
    if (payload.exp) {
      return new Date(payload.exp * 1000);
    }
  } catch (e) {
    // JWT parsing failed, that's okay
  }
  
  return null;
}

/**
 * Main authentication function
 */
async function performAuthentication(environment, username, password, customEndpoint = null) {
  try {

    
    // Get environment and settings configuration
    const [envResult, settingsResult] = await Promise.all([
      chrome.storage.local.get([CONFIG.ENVIRONMENT_STORAGE_KEY]),
      chrome.storage.local.get([CONFIG.SETTINGS_STORAGE_KEY])
    ]);
    
    const environments = envResult[CONFIG.ENVIRONMENT_STORAGE_KEY] || {};
    const settings = settingsResult[CONFIG.SETTINGS_STORAGE_KEY] || {};
    const baseUrl = environments[environment];
    

    
    if (!baseUrl) {
      throw new Error(`Environment '${environment}' not configured`);
    }

    const apiFormat = settings.apiFormat || {};
    
    // Construct login URL
    const loginEndpoint = customEndpoint || CONFIG.DEFAULT_LOGIN_ENDPOINT;
    const loginUrl = `${baseUrl.replace(/\/$/, '')}${loginEndpoint}`;



    // Build request body using configurable format
    const requestBody = buildRequestBody(username, password, apiFormat);

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    

    // Read response body once
    let data;
    let responseText = '';
    
    try {
      responseText = await response.text(); // Single read
      if (responseText) {
        data = JSON.parse(responseText); // Parse manually
      } else {
        data = {};
      }
    } catch (e) {
      // If parsing fails, treat as plain text response
      data = { message: responseText || 'Unknown error' };
    }

    if (!response.ok) {
      let errorText;
      let errorDetails = '';
      
      // Use configurable error extraction
      errorText = extractErrorFromResponse(data, apiFormat) || `${response.status} ${response.statusText}`;
      
      // Extract validation errors for better user feedback
      if (data.Data && data.Data.errors) {
        const errors = data.Data.errors;
        const errorMessages = [];
        
        Object.keys(errors).forEach(key => {
          if (Array.isArray(errors[key])) {
            errors[key].forEach(msg => errorMessages.push(msg));
          }
        });
        
        if (errorMessages.length > 0) {
          errorDetails = ` Details: ${errorMessages.join(', ')}`;
        }
      }
      
      throw new Error(`Authentication failed: ${errorText}${errorDetails}`);
    }

    // Extract token using configurable path
    const token = extractTokenFromResponseV2(data, apiFormat);

    if (!token) {
      console.error('Available response fields:', Object.keys(data));
      throw new Error('No token found in response');
    }

    // Store token for current environment (legacy support)
    await storeToken(environment, token, username);

    // ALSO create a role-based token for injection system
    try {
      const roleTokenData = {
        id: generateTokenId(),
        role: `${username}@${environment}`,
        token: token,
        description: `Auto-login token for ${username} in ${environment}`,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        environment: environment,
        username: username,
        source: 'auto-login'
      };
      
      // Save as role-based token
      await saveRoleToken(roleTokenData);
      
      // Set as active token if no active token exists
      const currentActiveToken = await getActiveToken();
      if (!currentActiveToken) {
        await setActiveToken(roleTokenData.id);
      }
      
    } catch (error) {
      console.error('⚠️ Failed to create role-based token from auto-login:', error);
      // Continue anyway - legacy token was still saved
    }

    return { success: true, token, environment };
  } catch (error) {
    console.error('Authentication failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test authentication function
 */
async function performTestAuthentication(environment, username, password, customEndpoint = null) {
  try {
    // Get environment and settings configuration (same as real auth)
    const [envResult, settingsResult] = await Promise.all([
      chrome.storage.local.get([CONFIG.ENVIRONMENT_STORAGE_KEY]),
      chrome.storage.local.get([CONFIG.SETTINGS_STORAGE_KEY])
    ]);
    
    const environments = envResult[CONFIG.ENVIRONMENT_STORAGE_KEY] || {};
    const settings = settingsResult[CONFIG.SETTINGS_STORAGE_KEY] || {};
    const baseUrl = environments[environment];
    
    if (!baseUrl) {
      return {
        success: false,
        error: `Environment '${environment}' not configured`,
        statusCode: null,
        requestFormat: null,
        responseBody: null
      };
    }

    const apiFormat = settings.apiFormat || {};
    
    // Construct login URL
    const loginEndpoint = customEndpoint || CONFIG.DEFAULT_LOGIN_ENDPOINT;
    const loginUrl = `${baseUrl.replace(/\/$/, '')}${loginEndpoint}`;

    // Build request body using configurable format
    const requestBody = buildRequestBody(username, password, apiFormat);

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // Read response body once for test authentication
    let responseData;
    let responseText = '';
    
    try {
      responseText = await response.text();
      if (responseText) {
        responseData = JSON.parse(responseText);
      } else {
        responseData = {};
      }
    } catch (e) {
      // If parsing fails, treat as plain text response
      responseData = { message: responseText || 'Unknown error' };
    }
    
    if (!response.ok) {
      // Use configurable error extraction for test
      const errorText = extractErrorFromResponse(responseData, apiFormat) || `${response.status} ${response.statusText}`;
      
      return {
        success: false,
        error: errorText,
        statusCode: response.status,
        requestFormat: requestBody,
        responseBody: responseData
      };
    }

    // Extract token using configurable path (for testing)
    const token = extractTokenFromResponseV2(responseData, apiFormat);
    
    return {
      success: true,
      message: 'Test authentication successful',
      token: token ? { 
        preview: token.substring(0, 20) + '...', 
        length: token.length,
        expiresAt: parseJwtExpiration(token)
      } : null,
      statusCode: response.status,
      requestFormat: requestBody,
      responseBody: responseData
    };
    
  } catch (error) {
    console.error('🧪 Test authentication failed:', error);
    return {
      success: false,
      error: error.message,
      requestFormat: null,
      responseBody: null
    };
  }
}

/**
 * Store authentication token
 */
async function storeToken(environment, token, username) {
  try {
    const { [CONFIG.TOKEN_STORAGE_KEY]: tokens } = await chrome.storage.local.get([CONFIG.TOKEN_STORAGE_KEY]);
    
    tokens[environment] = {
      token: token,
      username: username,
      timestamp: Date.now(),
      expiresAt: null
    };
    
    await chrome.storage.local.set({
      [CONFIG.TOKEN_STORAGE_KEY]: tokens
    });
    
  } catch (error) {
    console.error('Failed to store token:', error);
    throw error;
  }
}

/**
 * Get token for environment
 */
async function getToken(environment) {
  try {
    const { [CONFIG.TOKEN_STORAGE_KEY]: tokens } = await chrome.storage.local.get([CONFIG.TOKEN_STORAGE_KEY]);
    return tokens[environment] || null;
  } catch (error) {
    console.error('Failed to get token:', error);
    return null;
  }
}

/**
 * Clear tokens
 */
async function clearTokens(environment = null) {
  try {
    if (environment) {
      const { [CONFIG.TOKEN_STORAGE_KEY]: tokens } = await chrome.storage.local.get([CONFIG.TOKEN_STORAGE_KEY]);
      delete tokens[environment];
      await chrome.storage.local.set({
        [CONFIG.TOKEN_STORAGE_KEY]: tokens
      });
    } else {
      await chrome.storage.local.set({
        [CONFIG.TOKEN_STORAGE_KEY]: {}
      });
    }
  } catch (error) {
    console.error('Failed to clear tokens:', error);
    throw error;
  }
}

/**
 * Get all role-based tokens
 */
async function getRoleTokens() {
  try {
    const { [CONFIG.ROLE_TOKENS_STORAGE_KEY]: roleTokens } = await chrome.storage.local.get([CONFIG.ROLE_TOKENS_STORAGE_KEY]);
    return roleTokens || [];
  } catch (error) {
    console.error('Failed to get role tokens:', error);
    return [];
  }
}

/**
 * Get active token
 */
async function getActiveToken() {
  try {
    const { [CONFIG.ACTIVE_TOKEN_STORAGE_KEY]: activeTokenId } = await chrome.storage.local.get([CONFIG.ACTIVE_TOKEN_STORAGE_KEY]);
    
    if (!activeTokenId) return null;
    
    const roleTokens = await getRoleTokens();
    return roleTokens.find(token => token.id === activeTokenId) || null;
  } catch (error) {
    console.error('Failed to get active token:', error);
    return null;
  }
}

/**
 * Save role-based token
 */
async function saveRoleToken(tokenData) {
  try {
    // Validate input data
    if (!tokenData || typeof tokenData !== 'object') {
      throw new Error('Invalid token data provided');
    }
    
    if (!tokenData.role || typeof tokenData.role !== 'string' || !tokenData.role.trim()) {
      throw new Error('Token role is required and must be a non-empty string');
    }
    
    if (!tokenData.token || typeof tokenData.token !== 'string' || !tokenData.token.trim()) {
      throw new Error('Token value is required and must be a non-empty string');
    }
    
    const roleTokens = await getRoleTokens();
    
    // Generate unique ID if not provided
    if (!tokenData.id) {
      tokenData.id = generateTokenId();
    }
    
    // Parse JWT expiration if possible
    if (!tokenData.expiresAt) {
      try {
        const expiryDate = parseJwtExpiration(tokenData.token);
        if (expiryDate) {
          tokenData.expiresAt = expiryDate.getTime();
        }
      } catch (e) {
        // JWT parsing failed, continue without expiry
      }
    }
    
    // Set timestamps
    if (!tokenData.createdAt) {
      tokenData.createdAt = Date.now();
    }
    
    // Check if token with same role already exists
    const existingIndex = roleTokens.findIndex(token => token.id === tokenData.id);
    
    if (existingIndex >= 0) {
      // Update existing token
      roleTokens[existingIndex] = { ...roleTokens[existingIndex], ...tokenData };
    } else {
      // Add new token
      roleTokens.push(tokenData);
    }
    
    await chrome.storage.local.set({
      [CONFIG.ROLE_TOKENS_STORAGE_KEY]: roleTokens
    });
    
    return tokenData;
  } catch (error) {
    console.error('Failed to save role token:', error);
    throw error;
  }
}

/**
 * Delete role-based token
 */
async function deleteRoleToken(tokenId) {
  try {
    const roleTokens = await getRoleTokens();
    const filteredTokens = roleTokens.filter(token => token.id !== tokenId);
    
    await chrome.storage.local.set({
      [CONFIG.ROLE_TOKENS_STORAGE_KEY]: filteredTokens
    });
    
    // Clear active token if it was deleted
    const activeToken = await getActiveToken();
    if (activeToken && activeToken.id === tokenId) {
      await chrome.storage.local.remove([CONFIG.ACTIVE_TOKEN_STORAGE_KEY]);
    }
    
  } catch (error) {
    console.error('Failed to delete role token:', error);
    throw error;
  }
}

/**
 * Set active token
 */
async function setActiveToken(tokenId) {
  try {
    const roleTokens = await getRoleTokens();
    const token = roleTokens.find(t => t.id === tokenId);
    
    if (!token) {
      throw new Error('Token not found');
    }
    
    // Update last used timestamp
    token.lastUsed = Date.now();
    await saveRoleToken(token);
    
    await chrome.storage.local.set({
      [CONFIG.ACTIVE_TOKEN_STORAGE_KEY]: tokenId
    });
    
    return token;
  } catch (error) {
    console.error('Failed to set active token:', error);
    throw error;
  }
}

/**
 * Clear all role tokens
 */
async function clearAllRoleTokens() {
  try {
    await chrome.storage.local.remove([
      CONFIG.ROLE_TOKENS_STORAGE_KEY,
      CONFIG.ACTIVE_TOKEN_STORAGE_KEY
    ]);
  } catch (error) {
    console.error('Failed to clear role tokens:', error);
    throw error;
  }
}

/**
 * Generate unique token ID
 */
function generateTokenId() {
  return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get saved credentials
 */
async function getSavedCredentials() {
  try {
    const { [CONFIG.SAVED_CREDENTIALS_STORAGE_KEY]: credentials } = await chrome.storage.local.get([CONFIG.SAVED_CREDENTIALS_STORAGE_KEY]);
    return credentials || [];
  } catch (error) {
    console.error('Failed to get saved credentials:', error);
    return [];
  }
}

/**
 * Save credentials
 */
async function saveCredentials(username, environment, password = null) {
  try {
    const credentials = await getSavedCredentials();
    
    // Create new credential object
    const newCredential = {
      id: generateTokenId(),
      username: username,
      environment: environment,
      password: password, // Store password (will be encrypted in storage)
      label: `${username} (${environment})`,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };
    
    // Check if credential already exists
    const existingIndex = credentials.findIndex(cred => 
      cred.username === username && cred.environment === environment
    );
    
    if (existingIndex >= 0) {
      // Update existing credential
      credentials[existingIndex] = { ...credentials[existingIndex], ...newCredential };
    } else {
      // Add new credential
      credentials.unshift(newCredential);
      
      // Keep only the most recent credentials
      if (credentials.length > CONFIG.MAX_SAVED_CREDENTIALS) {
        credentials.splice(CONFIG.MAX_SAVED_CREDENTIALS);
      }
    }
    
    await chrome.storage.local.set({
      [CONFIG.SAVED_CREDENTIALS_STORAGE_KEY]: credentials
    });
    
    return newCredential;
  } catch (error) {
    console.error('Failed to save credentials:', error);
    throw error;
  }
}

/**
 * Delete credentials
 */
async function deleteCredentials(credentialId) {
  try {
    const credentials = await getSavedCredentials();
    const filteredCredentials = credentials.filter(cred => cred.id !== credentialId);
    
    await chrome.storage.local.set({
      [CONFIG.SAVED_CREDENTIALS_STORAGE_KEY]: filteredCredentials
    });
    
  } catch (error) {
    console.error('Failed to delete credentials:', error);
    throw error;
  }
}

/**
 * Clear all saved credentials
 */
async function clearSavedCredentials() {
  try {
    await chrome.storage.local.set({
      [CONFIG.SAVED_CREDENTIALS_STORAGE_KEY]: []
    });
  } catch (error) {
    console.error('Failed to clear saved credentials:', error);
    throw error;
  }
}

/**
 * Message handler for popup and content script communication
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'AUTHENTICATE':
          console.log('🔔 Background: Received AUTHENTICATE message:', {
            environment: request.environment,
            username: request.username ? '***' : 'missing',
            password: request.password ? '***' : 'missing',
            customEndpoint: request.customEndpoint
          });
          const { environment, username, password, customEndpoint } = request;
          const result = await performAuthentication(environment, username, password, customEndpoint);
          console.log('📋 Background: Authentication result:', result);
          sendResponse(result);
          break;

        case 'TEST_AUTHENTICATE':
          const testResult = await performTestAuthentication(request.environment, request.username, request.password, request.customEndpoint);
          sendResponse(testResult);
          break;

        case 'GET_TOKEN':
          const token = await getToken(request.environment);
          sendResponse({ success: true, token });
          break;

        case 'GET_ALL_TOKENS':
          const { [CONFIG.TOKEN_STORAGE_KEY]: allTokens } = await chrome.storage.local.get([CONFIG.TOKEN_STORAGE_KEY]);
          sendResponse({ success: true, tokens: allTokens });
          break;

        case 'CLEAR_TOKENS':
          await clearTokens(request.environment);
          sendResponse({ success: true });
          break;

        case 'GET_ENVIRONMENTS':
          try {
            const { [CONFIG.ENVIRONMENT_STORAGE_KEY]: environments } = await chrome.storage.local.get([CONFIG.ENVIRONMENT_STORAGE_KEY]);
            // Handle case where environments might be undefined
            sendResponse({ success: true, environments: environments || {} });
          } catch (error) {
            console.error('❌ GET_ENVIRONMENTS error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'SAVE_ENVIRONMENT':
          try {
            const { [CONFIG.ENVIRONMENT_STORAGE_KEY]: currentEnvs } = await chrome.storage.local.get([CONFIG.ENVIRONMENT_STORAGE_KEY]);
            // Handle case where currentEnvs might be undefined
            const environments = currentEnvs || {};
            environments[request.name] = request.url;
            await chrome.storage.local.set({
              [CONFIG.ENVIRONMENT_STORAGE_KEY]: environments
            });
            sendResponse({ success: true });
          } catch (error) {
            console.error('❌ SAVE_ENVIRONMENT error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_SETTINGS':
          const { [CONFIG.SETTINGS_STORAGE_KEY]: settings } = await chrome.storage.local.get([CONFIG.SETTINGS_STORAGE_KEY]);
          sendResponse({ success: true, settings });
          break;

        case 'SAVE_SETTINGS':
          await chrome.storage.local.set({
            [CONFIG.SETTINGS_STORAGE_KEY]: request.settings
          });
          sendResponse({ success: true });
          break;

        // Role-based Token Management Actions
        case 'GET_ROLE_TOKENS':
          const roleTokens = await getRoleTokens();
          const activeToken = await getActiveToken();
          const { [CONFIG.SETTINGS_STORAGE_KEY]: roleTokenSettings } = await chrome.storage.local.get([CONFIG.SETTINGS_STORAGE_KEY]);
          sendResponse({ 
            success: true, 
            tokens: roleTokens, 
            activeToken: activeToken,
            autoInject: roleTokenSettings?.autoInject !== false
          });
          break;

        case 'SAVE_ROLE_TOKEN':
          try {
            const savedToken = await saveRoleToken(request.tokenData);
            sendResponse({ success: true, token: savedToken });
          } catch (error) {
            console.error('❌ SAVE_ROLE_TOKEN error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'DELETE_ROLE_TOKEN':
          try {
            await deleteRoleToken(request.tokenId);
            sendResponse({ success: true });
          } catch (error) {
            console.error('❌ DELETE_ROLE_TOKEN error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'SET_ACTIVE_TOKEN':
          try {
            const newActiveToken = await setActiveToken(request.tokenId);
            sendResponse({ success: true, activeToken: newActiveToken });
          } catch (error) {
            console.error('❌ SET_ACTIVE_TOKEN error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'CLEAR_ROLE_TOKENS':
          try {
            await clearAllRoleTokens();
            sendResponse({ success: true });
          } catch (error) {
            console.error('❌ CLEAR_ROLE_TOKENS error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        // Saved credentials management
        case 'GET_SAVED_CREDENTIALS':
          try {
            const credentials = await getSavedCredentials();
            sendResponse({ success: true, credentials });
          } catch (error) {
            console.error('❌ GET_SAVED_CREDENTIALS error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'SAVE_CREDENTIALS':
          try {
            const credential = await saveCredentials(request.username, request.environment, request.password);
            sendResponse({ success: true, credential });
          } catch (error) {
            console.error('❌ SAVE_CREDENTIALS error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'DELETE_CREDENTIALS':
          try {
            await deleteCredentials(request.credentialId);
            sendResponse({ success: true });
          } catch (error) {
            console.error('❌ DELETE_CREDENTIALS error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'UPDATE_CREDENTIALS_LAST_USED':
          try {
            const credentials = await getSavedCredentials();
            const credentialIndex = credentials.findIndex(cred => cred.id === request.credentialId);
            
            if (credentialIndex >= 0) {
              credentials[credentialIndex].lastUsed = Date.now();
              await chrome.storage.local.set({
                [CONFIG.SAVED_CREDENTIALS_STORAGE_KEY]: credentials
              });
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: 'Credential not found' });
            }
          } catch (error) {
            console.error('❌ UPDATE_CREDENTIALS_LAST_USED error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'CLEAR_SAVED_CREDENTIALS':
          try {
            await clearSavedCredentials();
            sendResponse({ success: true });
          } catch (error) {
            console.error('❌ CLEAR_SAVED_CREDENTIALS error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'FORCE_RESET_SETTINGS':
          try {
            // Clear ALL stored data to force complete reset
            await chrome.storage.local.clear();
            
            // Reinitialize with new defaults
            await initializeStorage();
            
            sendResponse({ success: true, message: 'All settings force reset to defaults' });
          } catch (error) {
            console.error('❌ Force reset failed:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  // Return true to indicate we will send a response asynchronously
  return true;
});

// Initialize storage when the service worker starts
initializeStorage();

/**
 * On-demand injection: the lightweight detector (content/detector.js) runs on every
 * page and messages us only when it finds Swagger UI / ReDoc / RapiDoc. We then load
 * the full helper into that tab so the floating bubble appears.
 */
const HELPER_SCRIPT_FILES = [
  'content/content.js',
  'content/autoLogin.js',
  'content/tokenManager.js',
  'content/envSwitcher.js',
  'content/copyRequest.js',
  'content/uiEnhancer.js'
];

async function injectHelperIntoTab(tabId, frameId) {
  const target = { tabId, frameIds: [frameId] };
  try {
    const [check] = await chrome.scripting.executeScript({
      target,
      func: () => !!window.__swaggerHelperInjected
    });
    if (check && check.result) return;

    await chrome.scripting.executeScript({
      target,
      func: () => { window.__swaggerHelperInjected = true; }
    });
    await chrome.scripting.insertCSS({ target, files: ['content/styles.css'] });
    await chrome.scripting.executeScript({ target, files: HELPER_SCRIPT_FILES });
  } catch (error) {
    console.warn('Swagger Helper: could not inject into tab', tabId, error);
  }
}

chrome.runtime.onMessage.addListener((request, sender) => {
  if (!request || request.action !== 'SWAGGER_DETECTED') return;
  if (!sender || !sender.tab || typeof sender.tab.id !== 'number') return;
  injectHelperIntoTab(sender.tab.id, sender.frameId || 0);
});
