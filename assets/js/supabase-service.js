/**
 * Supabase Service
 * 
 * This module provides a secure wrapper around Supabase client functionality.
 * It uses AppConfig to load configuration securely and provides authentication
 * and database operations.
 */

// Initialize Supabase client
let supabaseClient = null;

// Initialize Supabase when the script loads
function initSupabase() {
  if (typeof window.AppConfig === 'undefined') {
    console.error('AppConfig not loaded - include config.js before supabase-service.js');
    return null;
  }

  try {
    supabaseClient = window.AppConfig.initSupabase();
    if (supabaseClient) {
      console.log('Supabase client initialized');
    }
    return supabaseClient;
  } catch (e) {
    console.error('Error initializing Supabase client:', e);
    return null;
  }
}

// Helper function to get current user
async function getCurrentUser() {
  if (!supabaseClient) {
    // Try to initialize if not already done
    supabaseClient = initSupabase();
    if (!supabaseClient) {
      console.error('Supabase client not initialized');
      return null;
    }
  }
  
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error) {
      console.error('Error getting user:', error);
      return null;
    }
    return user;
  } catch (e) {
    console.error('Error in getCurrentUser:', e);
    return null;
  }
}

// Helper function to check if user is admin
async function isAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;
  
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
    
    return data?.role === 'admin';
  } catch (e) {
    console.error('Error in isAdmin check:', e);
    return false;
  }
}

// Helper function to get user profile
async function getUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('Error in getUserProfile:', e);
    return null;
  }
}

// Authentication functions
async function signUp(email, password, username) {
  if (!email || !password) {
    return { success: false, error: { message: 'Email and password are required' } };
  }
  
  // Validate email
  if (!window.SecurityUtils?.isValidEmail(email)) {
    return { success: false, error: { message: 'Invalid email format' } };
  }
  
  // Validate password
  if (password.length < 6) {
    return { success: false, error: { message: 'Password must be at least 6 characters' } };
  }
  
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || email.split('@')[0]
        }
      }
    });
    
    if (error) {
      console.error('Sign up error:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (e) {
    console.error('Error in signUp:', e);
    return { success: false, error: { message: 'An unexpected error occurred' } };
  }
}

async function signIn(email, password) {
  if (!email || !password) {
    return { success: false, error: { message: 'Email and password are required' } };
  }
  
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('Sign in error:', error);
      return { success: false, error };
    }
    
    // Store auth state securely
    if (window.SecurityUtils) {
      window.SecurityUtils.secureStore('authSession', {
        timestamp: Date.now(),
        userId: data.user.id
      }, true);
    }
    
    return { success: true, data };
  } catch (e) {
    console.error('Sign in error:', e);
    return { success: false, error: { message: 'An unexpected error occurred' } };
  }
}

async function signOut() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    
    if (error) {
      console.error('Sign out error:', error);
      return { success: false, error };
    }
    
    // Clear secure storage
    if (window.SecurityUtils) {
      window.SecurityUtils.secureStore('authSession', null, true);
    }
    
    return { success: true };
  } catch (e) {
    console.error('Error in signOut:', e);
    return { success: false, error: { message: 'An unexpected error occurred' } };
  }
}

// Database query helpers with rate limiting and security
const requestLimiter = {
  timestamps: {},
  maxRequests: 60, // Maximum requests per minute
  interval: 60000, // 1 minute in milliseconds
  
  canMakeRequest(operation) {
    const now = Date.now();
    const key = operation || 'default';
    
    // Initialize timestamps for this operation
    this.timestamps[key] = this.timestamps[key] || [];
    
    // Remove timestamps older than the interval
    this.timestamps[key] = this.timestamps[key].filter(time => now - time < this.interval);
    
    // Check if under the limit
    if (this.timestamps[key].length < this.maxRequests) {
      // Add current timestamp
      this.timestamps[key].push(now);
      return true;
    }
    
    return false;
  }
};

// Database helpers with rate limiting and improved error handling
async function getItems() {
  if (!requestLimiter.canMakeRequest('getItems')) {
    console.warn('Rate limit exceeded for getItems');
    return { data: [], error: { message: 'Rate limit exceeded. Please try again later.' } };
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching items:', error);
      return { data: [], error };
    }
    
    return { data: data || [], error: null };
  } catch (e) {
    console.error('Error in getItems:', e);
    return { data: [], error: { message: 'Failed to fetch items' } };
  }
}

// Export functions for global use
window.SupabaseService = {
  init: initSupabase,
  getCurrentUser,
  isAdmin,
  getUserProfile,
  signUp,
  signIn,
  signOut,
  getItems,
  // Export other database functions as needed
};

// Initialize on document load
document.addEventListener('DOMContentLoaded', initSupabase);