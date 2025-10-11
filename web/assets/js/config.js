/**
 * Secure Configuration Loader
 * 
 * This module securely loads configuration from .env files or environment variables
 * and provides a central location for all configuration values.
 */

(function() {
  // Default configuration (safe fallbacks)
  const DEFAULT_CONFIG = {
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    ORG_ID: 'default'
  };

  // Configuration loaded from environment
  let loadedConfig = {};

  /**
   * Loads configuration from multiple sources in order:
   * 1. Environment variables if in server environment (Node.js)
   * 2. Server-side injected config variables
   * 3. Default values (as fallback)
   */
  function loadConfig() {
    // Only load once
    if (Object.keys(loadedConfig).length > 0) {
      return loadedConfig;
    }

    try {
      // Check for server-side injected configuration
      if (typeof window.__APP_CONFIG__ !== 'undefined') {
        loadedConfig = { ...DEFAULT_CONFIG, ...window.__APP_CONFIG__ };
        return loadedConfig;
      }
    } catch (e) {
      console.warn('Error loading injected config:', e);
    }

    // Use defaults as fallback
    loadedConfig = { ...DEFAULT_CONFIG };
    return loadedConfig;
  }

  /**
   * Get a configuration value
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Configuration value or default
   */
  function getConfig(key, defaultValue = null) {
    const config = loadConfig();
    return config[key] !== undefined ? config[key] : defaultValue;
  }

  /**
   * Initialize Supabase client
   * @returns {Object} Supabase client
   */
  function initSupabase() {
    // Ensure supabase is loaded
    if (typeof supabase === 'undefined') {
      console.error('Supabase library not loaded');
      return null;
    }

    try {
      const url = getConfig('SUPABASE_URL');
      const key = getConfig('SUPABASE_ANON_KEY');

      if (!url || !key) {
        console.error('Supabase configuration missing - check environment variables');
        return null;
      }

      return supabase.createClient(url, key);
    } catch (e) {
      console.error('Error initializing Supabase client:', e);
      return null;
    }
  }

  // Create global configuration object
  window.AppConfig = {
    get: getConfig,
    getOrgId: () => getConfig('ORG_ID', 'default'),
    initSupabase
  };

  // For development/debugging only
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.info('App config loaded in development mode');
  }
})();