/**
 * Security Utilities
 * 
 * This module provides security-related utilities for the application.
 */

(function() {
  /**
   * Sanitizes input to prevent XSS attacks
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  function sanitizeInput(input) {
    if (!input) return '';
    const element = document.createElement('div');
    element.textContent = input;
    return element.innerHTML;
  }

  /**
   * Validate an email address format
   * @param {string} email - Email to validate
   * @returns {boolean} Whether email is valid
   */
  function isValidEmail(email) {
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    return re.test(String(email).toLowerCase());
  }

  /**
   * Checks JWT token expiration
   * @param {string} token - JWT token
   * @returns {boolean} Whether token is expired
   */
  function isTokenExpired(token) {
    if (!token) return true;
    
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const { exp } = JSON.parse(jsonPayload);
      return exp * 1000 < Date.now();
    } catch (e) {
      console.error('Error checking token expiration:', e);
      return true;
    }
  }

  /**
   * Securely store data in browser storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @param {boolean} useSession - Whether to use sessionStorage
   */
  function secureStore(key, value, useSession = false) {
    try {
      const storage = useSession ? sessionStorage : localStorage;
      storage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error storing data securely:', e);
    }
  }

  /**
   * Securely retrieve data from browser storage
   * @param {string} key - Storage key
   * @param {boolean} useSession - Whether to use sessionStorage
   * @returns {any} Retrieved value
   */
  function secureRetrieve(key, useSession = false) {
    try {
      const storage = useSession ? sessionStorage : localStorage;
      const value = storage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      console.error('Error retrieving data securely:', e);
      return null;
    }
  }

  /**
   * Create a CSRF token for forms
   * @returns {string} CSRF token
   */
  function generateCSRFToken() {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    const token = Array.from(array, byte => ('0' + byte.toString(16)).slice(-2)).join('');
    secureStore('csrfToken', token);
    return token;
  }

  /**
   * Verify a CSRF token from forms
   * @param {string} token - Token to verify
   * @returns {boolean} Whether token is valid
   */
  function verifyCSRFToken(token) {
    return token === secureRetrieve('csrfToken');
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>} Whether user is authenticated
   */
  async function isAuthenticated() {
    const supabase = window.AppConfig?.initSupabase();
    if (!supabase) return false;
    
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) return false;
      
      // Check if token is expired
      return !isTokenExpired(data.session.access_token);
    } catch (e) {
      console.error('Error checking authentication:', e);
      return false;
    }
  }

  /**
   * Redirect to login if user is not authenticated
   * @returns {Promise<void>}
   */
  async function requireAuth() {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      window.location.href = "/login.html";
    }
  }

  // Export utilities
  window.SecurityUtils = {
    sanitizeInput,
    isValidEmail,
    secureStore,
    secureRetrieve,
    generateCSRFToken,
    verifyCSRFToken,
    isAuthenticated,
    requireAuth
  };
})();