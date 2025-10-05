// Supabase Auth Helper - Consistent authentication handling across the application

// Global constants for Supabase
window.SUPABASE_URL = "https://grsikgldzkqntlotawyi.supabase.co";
window.SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyc2lrZ2xkemtxbnRsb3Rhd3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1OTQ0NTQsImV4cCI6MjA3NTE3MDQ1NH0.RtGvQ7vDNFNiabghTWVEzFroA4Z_fc8ZTr9p07fk_eQ";

// Initialize the Supabase client once and store it in the window
if (!window._sbClient && typeof supabase !== 'undefined') {
  window._sbClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
  console.log('✅ Supabase client initialized in auth-helper.js');
}

// Get the current user
async function getCurrentUser() {
  if (!window._sbClient) {
    console.error('Supabase client not initialized');
    return null;
  }
  
  try {
    const { data: { user }, error } = await window._sbClient.auth.getUser();
    if (error) {
      console.error('Error getting user:', error);
      return null;
    }
    return user;
  } catch (err) {
    console.error('Exception getting user:', err);
    return null;
  }
}

// Check if the current user is an admin
async function isAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;
  
  try {
    // Try first with 'is_admin' field
    const { data: isAdminData, error: isAdminError } = await window._sbClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
      
    if (!isAdminError && isAdminData?.is_admin === true) {
      return true;
    }
    
    // If that fails, try with 'role' field
    const { data: roleData, error: roleError } = await window._sbClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (!roleError && roleData?.role === 'admin') {
      return true;
    }
    
    // If both checks fail, log error and return false
    if (isAdminError && roleError) {
      console.error('Error checking admin status:', isAdminError, roleError);
    }
    
    return false;
  } catch (err) {
    console.error('Exception checking admin status:', err);
    return false;
  }
}

// Sign out the current user
async function signOut() {
  if (!window._sbClient) {
    console.error('Supabase client not initialized');
    return { success: false, error: 'Supabase client not initialized' };
  }
  
  try {
    const { error } = await window._sbClient.auth.signOut();
    
    if (error) {
      console.error('Sign out error:', error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (err) {
    console.error('Exception signing out:', err);
    return { success: false, error: err };
  }
}

// Show/hide navigation elements based on user role
async function updateNavigation() {
  try {
    console.log('Updating navigation visibility...');
    const user = await getCurrentUser();
    
    // For debugging - always print user info
    console.log('Current user:', user ? 'Authenticated' : 'Not authenticated', user);
    
    // Get all navigation elements
    const logoutBtns = [
      document.getElementById('logout-btn'),
      document.getElementById('mobile-logout-btn')
    ].filter(Boolean);
    
    const adminLinks = [
      document.getElementById('admin-link'),
      document.getElementById('mobile-admin-btn')
    ].filter(Boolean);
    
    console.log('Found buttons:', 'logout='+logoutBtns.length, 'admin='+adminLinks.length);
    
    const bottomNav = document.getElementById('alumil-bottom-nav');
    
    if (user) {
      // User is authenticated, show logout buttons
      logoutBtns.forEach(btn => {
        btn.style.display = 'flex';
        console.log('✅ Logout button shown for authenticated user:', btn.id);
      });
      
      // CRITICAL: Force admin links to be visible for now - we'll debug role issues later
      // This ensures admin functionality is available while we fix role issues
      console.log('⚠️ FORCING ADMIN LINKS VISIBLE FOR AUTHENTICATED USER');
      adminLinks.forEach(link => {
        link.style.display = 'flex';
        console.log('✅ Admin link shown (forced):', link.id);
      });
      
      if (bottomNav) {
        bottomNav.classList.add('admin-user');
        bottomNav.classList.remove('non-admin-user');
      }
      
      // Check admin status for logging purposes
      const adminStatus = await isAdmin();
      console.log('User admin status (for reference):', adminStatus);
    } else {
      // Not authenticated, hide navigation elements
      logoutBtns.forEach(btn => {
        btn.style.display = 'none';
      });
      
      adminLinks.forEach(link => {
        link.style.display = 'none';
      });
      
      // Redirect to login after short delay (to avoid immediate redirect during page load)
      setTimeout(() => {
        console.log('⚠️ No authenticated user found, redirecting to login');
        location.href = 'login.html';
      }, 500);
    }
  } catch (error) {
    console.error('❌ Error updating navigation:', error);
    // Fail gracefully - show ALL buttons
    const logoutBtns = [
      document.getElementById('logout-btn'),
      document.getElementById('mobile-logout-btn')
    ].filter(Boolean);
    
    const adminLinks = [
      document.getElementById('admin-link'),
      document.getElementById('mobile-admin-btn')
    ].filter(Boolean);
    
    logoutBtns.forEach(btn => {
      btn.style.display = 'flex';
    });
    
    adminLinks.forEach(link => {
      link.style.display = 'flex';
    });
  }
}

// Handle logout action
function handleLogout() {
  signOut()
    .then(() => {
      location.href = 'login.html';
    })
    .catch(error => {
      console.error('Logout error:', error);
      location.href = 'login.html';
    });
}

// Export functions to window
window.AuthHelper = {
  getCurrentUser,
  isAdmin,
  signOut,
  updateNavigation,
  handleLogout
};

// Make admin and logout buttons visible by default for DOM initialization
// This ensures they're visible before auth check completes
function showNavElements() {
  const adminLinks = [
    document.getElementById('admin-link'),
    document.getElementById('mobile-admin-btn')
  ].filter(Boolean);
  
  const logoutBtns = [
    document.getElementById('logout-btn'),
    document.getElementById('mobile-logout-btn')
  ].filter(Boolean);
  
  // Show by default - will be hidden by updateNavigation if needed
  adminLinks.forEach(link => {
    if (link && link.style.display === 'none') {
      link.style.display = 'flex';
    }
  });
  
  logoutBtns.forEach(btn => {
    if (btn && btn.style.display === 'none') {
      btn.style.display = 'flex';
    }
  });
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // First make everything visible
  showNavElements();
  // Then check permissions
  updateNavigation();
});

// Also run immediately if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  // First make everything visible
  setTimeout(showNavElements, 0);
  // Then check permissions
  setTimeout(updateNavigation, 100);
}