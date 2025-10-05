/**
 * Alumil Auth Helper
 * Centralizes authentication logic for the Alumil Label App
 */

class AlumilAuthHelper {
  constructor(supabaseUrl, supabaseKey) {
    // Initialize Supabase client
    this.supabase = null;
    this.user = null;
    this.userProfile = null;
    this.isAdmin = false;
    
    // Initialize Supabase
    this.init(supabaseUrl, supabaseKey);
    
    // Set up event listeners for auth state changes
    this.setupAuthListeners();
  }
  
  /**
   * Initialize Supabase client
   */
  async init(supabaseUrl, supabaseKey) {
    try {
      // Check if Supabase client already exists
      if (window._sbClient) {
        this.supabase = window._sbClient;
        console.log('✅ Using existing Supabase client');
      } else if (supabaseUrl && supabaseKey) {
        // Create new Supabase client
        this.supabase = supabase.createClient(supabaseUrl, supabaseKey);
        window._sbClient = this.supabase;
        console.log('✅ Created new Supabase client');
      } else {
        console.error('❌ Supabase URL or key missing');
        return;
      }
      
      // Load initial auth state
      await this.refreshAuthState();
      
      // Make auth helper available globally
      window.authHelper = this;
    } catch (error) {
      console.error('Error initializing auth helper:', error);
    }
  }
  
  /**
   * Set up listeners for auth state changes
   */
  setupAuthListeners() {
    // Monitor auth state changes
    if (this.supabase) {
      this.supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN') {
          await this.refreshAuthState();
          this.updateUI(true);
        } else if (event === 'SIGNED_OUT') {
          this.user = null;
          this.userProfile = null;
          this.isAdmin = false;
          this.updateUI(false);
        } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          await this.refreshAuthState();
          this.updateUI(true);
        }
        
        // Notify others of auth change
        window.dispatchEvent(new CustomEvent('authStateChanged', {
          detail: {
            event,
            isSignedIn: !!session,
            isAdmin: this.isAdmin
          }
        }));
      });
    }
  }
  
  /**
   * Refresh current auth state
   */
  async refreshAuthState() {
    try {
      if (!this.supabase) return;
      
      // Get current session
      const { data: { session } } = await this.supabase.auth.getSession();
      
      if (session) {
        this.user = session.user;
        
        // Load user profile from database
        if (this.user?.id) {
          await this.loadUserProfile();
        }
      } else {
        this.user = null;
        this.userProfile = null;
        this.isAdmin = false;
      }
      
      return {
        isAuthenticated: !!this.user,
        isAdmin: this.isAdmin,
        user: this.user,
        profile: this.userProfile
      };
    } catch (error) {
      console.error('Error refreshing auth state:', error);
      return { isAuthenticated: false, isAdmin: false };
    }
  }
  
  /**
   * Load user profile from database
   */
  async loadUserProfile() {
    if (!this.supabase || !this.user?.id) return;
    
    try {
      // Fetch profile from database
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', this.user.id)
        .single();
      
      if (error) {
        console.error('Error loading user profile:', error);
        this.userProfile = null;
      } else {
        this.userProfile = data;
        
        // Check if user is admin - this supports both is_admin boolean and role string fields
        this.isAdmin = 
          (data.is_admin === true) || 
          (data.role === 'admin') || 
          (data.role === 'ADMIN') ||
          (this.user.app_metadata && this.user.app_metadata.role === 'admin') ||
          (this.user.user_metadata && this.user.user_metadata.is_admin === true);
          
        console.log('User profile loaded, admin status:', this.isAdmin);
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      this.userProfile = null;
      this.isAdmin = false;
    }
  }
  
  /**
   * Update UI based on auth state
   */
  updateUI(isAuthenticated) {
    // Update navigation elements
    this.updateNavigation(isAuthenticated);
    
    // Show/hide admin button
    this.updateAdminButton();
    
    // Show/hide logout button
    this.updateLogoutButton(isAuthenticated);
  }
  
  /**
   * Update navigation elements
   */
  updateNavigation(isAuthenticated) {
    const navElements = document.querySelectorAll('[data-auth-required]');
    
    navElements.forEach(el => {
      if (isAuthenticated) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
  }
  
  /**
   * Update admin button visibility
   */
  updateAdminButton() {
    const adminElements = document.querySelectorAll('[data-admin-only]');
    console.log(`Found ${adminElements.length} admin elements, admin status: ${this.isAdmin}`);
    
    adminElements.forEach(el => {
      if (this.isAdmin) {
        // For buttons and links, restore original display type
        if (el.tagName === 'BUTTON' || el.tagName === 'A') {
          // For items in navigation, use inline-flex
          if (el.classList.contains('flex') || el.closest('nav')) {
            el.style.display = 'inline-flex';
          } else {
            el.style.display = 'inline-block';
          }
        } else {
          el.style.display = '';
        }
      } else {
        el.style.display = 'none';
      }
      
      // Log visibility change for debugging
      console.log(`Updated admin element visibility: ${el.id || el.tagName}=${this.isAdmin ? 'visible' : 'hidden'}`);
    });
  }
  
  /**
   * Update logout button visibility
   */
  updateLogoutButton(isAuthenticated) {
    // Check for both possible logout button IDs
    const logoutBtn = document.getElementById('logoutButton') || document.getElementById('logout-btn') || document.getElementById('mobile-logout-btn');
    
    if (logoutBtn) {
      if (isAuthenticated) {
        logoutBtn.style.display = '';
      } else {
        logoutBtn.style.display = 'none';
      }
    }
    
    // Also update all elements with data-auth-required attribute
    const authElements = document.querySelectorAll('[data-auth-required]');
    authElements.forEach(el => {
      el.style.display = isAuthenticated ? '' : 'none';
    });
  }
  
  /**
   * Log user in with email and password
   */
  async loginWithEmail(email, password) {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        throw error;
      }
      
      await this.refreshAuthState();
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Log user out
   */
  async logout() {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      this.user = null;
      this.userProfile = null;
      this.isAdmin = false;
      
      // Redirect to login page
      window.location.href = 'login.html';
      
      return { success: true };
    } catch (error) {
      console.error('Logout failed:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    if (this.user) return true;
    
    // Double check with Supabase
    const state = await this.refreshAuthState();
    return state.isAuthenticated;
  }
  
  /**
   * Check if current user is admin
   */
  async checkIsAdmin() {
    if (this.isAdmin) return true;
    
    // Double check with Supabase
    const state = await this.refreshAuthState();
    return state.isAdmin;
  }
  
  /**
   * Register a new user
   * Note: This should be restricted based on your app's requirements
   */
  async register(email, password, metadata = {}) {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });
      
      if (error) {
        throw error;
      }
      
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Registration failed:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Reset password
   */
  async resetPassword(email) {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { error } = await this.supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        throw error;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Password reset failed:', error);
      return { success: false, error };
    }
  }
}

// Initialize auth helper when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if Supabase is loaded
  if (typeof supabase !== 'undefined') {
    // Look for Supabase credentials
    const supabaseUrl = document.querySelector('meta[name="supabase-url"]')?.content;
    const supabaseKey = document.querySelector('meta[name="supabase-key"]')?.content;
    
    if (supabaseUrl && supabaseKey) {
      // Initialize auth helper
      window.authHelper = new AlumilAuthHelper(supabaseUrl, supabaseKey);
      console.log('✅ Auth helper initialized');
    } else {
      console.warn('⚠️ Supabase credentials not found in meta tags');
    }
  } else {
    console.warn('⚠️ Supabase library not loaded');
  }
});

// Export auth helper class
window.AlumilAuthHelper = AlumilAuthHelper;

// Convenience function for logout
window.logoutUser = function() {
  if (window.authHelper) {
    return window.authHelper.logout();
  } else {
    console.error('Auth helper not initialized');
    
    // Fallback to direct Supabase call if available
    if (window._sbClient) {
      console.log('Falling back to direct Supabase logout');
      return window._sbClient.auth.signOut()
        .then(() => {
          window.location.href = 'login.html';
          return { success: true };
        })
        .catch(error => {
          console.error('Sign out error:', error);
          return { success: false, error };
        });
    }
    
    // Last resort fallback - just redirect
    window.location.href = 'login.html';
    return Promise.resolve({ success: true });
  }
};