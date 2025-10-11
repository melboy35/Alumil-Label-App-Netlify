/**
 * Supabase Client Module
 * 
 * Provides a centralized Supabase client instance with proper configuration
 * and error handling. Works with the existing browser global setup.
 */

class SupabaseClient {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize the Supabase client
   * @returns {Promise<Object>} Supabase client instance
   */
  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  async _initialize() {
    try {
      // Wait for config to be loaded
      if (typeof window.SUPABASE_URL === 'undefined' || typeof window.SUPABASE_KEY === 'undefined') {
        throw new Error('Supabase configuration not found. Make sure config.js is loaded.');
      }

      // Check if supabase library is loaded
      if (typeof window.supabase === 'undefined') {
        throw new Error('Supabase library not loaded. Make sure to include the Supabase CDN script.');
      }

      // Use the URL from your code snippet or config
      const supabaseUrl = 'https://grsikgldzkqntlotawyi.supabase.co';
      const supabaseKey = window.SUPABASE_KEY || process.env.SUPABASE_KEY;

      if (!supabaseKey) {
        throw new Error('SUPABASE_KEY not found in configuration or environment variables.');
      }

      // Create client with proper configuration
      this.client = window.supabase.createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storageKey: 'alumil_auth_token'
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      });

      this.isInitialized = true;
      console.log('✅ Supabase client initialized successfully');
      
      return this.client;
    } catch (error) {
      console.error('❌ Failed to initialize Supabase client:', error);
      throw error;
    }
  }

  /**
   * Get the Supabase client instance
   * @returns {Promise<Object>} Supabase client
   */
  async getClient() {
    if (!this.isInitialized) {
      await this.init();
    }
    return this.client;
  }

  /**
   * Get current authenticated user
   * @returns {Promise<Object|null>} User object or null
   */
  async getCurrentUser() {
    const client = await this.getClient();
    try {
      const { data: { user }, error } = await client.auth.getUser();
      if (error) {
        console.error('Error getting user:', error);
        return null;
      }
      return user;
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
      return null;
    }
  }

  /**
   * Sign in with email and password
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} Auth response
   */
  async signIn(email, password) {
    const client = await this.getClient();
    return await client.auth.signInWithPassword({ email, password });
  }

  /**
   * Sign up with email and password
   * @param {string} email 
   * @param {string} password 
   * @param {Object} metadata Additional user metadata
   * @returns {Promise<Object>} Auth response
   */
  async signUp(email, password, metadata = {}) {
    const client = await this.getClient();
    return await client.auth.signUp({ 
      email, 
      password, 
      options: { data: metadata }
    });
  }

  /**
   * Sign out current user
   * @returns {Promise<Object>} Auth response
   */
  async signOut() {
    const client = await this.getClient();
    return await client.auth.signOut();
  }

  /**
   * Query database table
   * @param {string} table Table name
   * @returns {Object} Query builder
   */
  async from(table) {
    const client = await this.getClient();
    return client.from(table);
  }

  /**
   * Upload file to storage
   * @param {string} bucket Bucket name
   * @param {string} path File path
   * @param {File|Blob} file File object
   * @returns {Promise<Object>} Upload response
   */
  async uploadFile(bucket, path, file) {
    const client = await this.getClient();
    return await client.storage.from(bucket).upload(path, file);
  }

  /**
   * Listen to real-time changes
   * @param {string} table Table name
   * @param {Function} callback Callback function
   * @returns {Object} Subscription object
   */
  async subscribe(table, callback) {
    const client = await this.getClient();
    return client
      .channel(`${table}_changes`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: table 
        }, 
        callback
      )
      .subscribe();
  }
}

// Create singleton instance
const supabaseClient = new SupabaseClient();

// Export for use in other modules
window.SupabaseClient = supabaseClient;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    supabaseClient.init().catch(console.error);
  });
} else {
  // DOM already loaded
  supabaseClient.init().catch(console.error);
}

// Export the client instance for easy access
window.supabase = supabaseClient;