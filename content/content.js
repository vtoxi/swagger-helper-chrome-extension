/**
 * Main Content Script for All-in-One Swagger Helper
 * Coordinates other content scripts and provides common utilities
 */

// Common utility functions
function isSwaggerPage() {
  // Check URL patterns
  const url = window.location.href.toLowerCase();
  const urlIndicators = ['swagger', 'api-docs', 'openapi', 'docs', 'documentation'];
  const hasUrlIndicator = urlIndicators.some(indicator => url.includes(indicator));
  
  // Check page title
  const title = document.title.toLowerCase();
  const titleIndicators = ['swagger', 'api', 'openapi', 'docs', 'documentation'];
  const hasTitleIndicator = titleIndicators.some(indicator => title.includes(indicator));
  
  // Check for Swagger UI elements
  const swaggerElements = [
    '.swagger-ui',
    '#swagger-ui', 
    '[class*="swagger"]',
    '.swagger-wrapper',
    '.api-docs',
    '.openapi',
    '.redoc-wrap',
    '[id*="swagger"]',
    '[id*="api-docs"]',
    '[id*="redoc"]'
  ];
  const hasSwaggerElements = swaggerElements.some(selector => document.querySelector(selector) !== null);
  
  // Check for typical API documentation content
  const apiContentIndicators = [
    'application/json',
    'Authorization',
    'Bearer',
    'api_key',
    'swagger.json',
    'openapi.json',
    '"openapi"',
    '"swagger"',
    'Try it out',
    'Execute',
    'Authorize'
  ];
  const bodyText = document.body ? document.body.textContent.toLowerCase() : '';
  const hasApiContent = apiContentIndicators.some(indicator => 
    bodyText.includes(indicator.toLowerCase())
  );
  
  // Check for common API documentation meta tags
  const apiMetaTags = document.querySelectorAll('meta[name*="api"], meta[name*="swagger"], meta[name*="openapi"]');
  const hasApiMetaTags = apiMetaTags.length > 0;
  
  // Check for script tags that might load Swagger UI
  const swaggerScripts = document.querySelectorAll('script[src*="swagger"], script[src*="openapi"], script[src*="redoc"]');
  const hasSwaggerScripts = swaggerScripts.length > 0;
  
  return hasUrlIndicator || hasTitleIndicator || hasSwaggerElements || hasApiContent || hasApiMetaTags || hasSwaggerScripts;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSwaggerHelper);
} else {
  initializeSwaggerHelper();
}

function initializeSwaggerHelper() {
  // Check immediately and also with a delay to catch dynamically loaded content
  const checkAndInitialize = () => {
    if (isSwaggerPage()) {
      console.log('🎯 Swagger Helper: Detected API documentation page, initializing...');
      // Initialize components with a small delay to allow DOM to settle
      setTimeout(() => {
        // Dispatch event to notify other scripts
        window.dispatchEvent(new CustomEvent('swaggerHelperInitialized', {
          detail: { url: window.location.href }
        }));
      }, 500);
      return true;
    }
    return false;
  };
  
  // Try immediate initialization
  if (!checkAndInitialize()) {
    // If not detected immediately, try again after a delay for SPAs
    setTimeout(() => {
      checkAndInitialize();
    }, 2000);
  }
}

// Export utility functions for other scripts
window.SwaggerHelper = {
  isSwaggerPage,
  // Add more utilities as needed
};
