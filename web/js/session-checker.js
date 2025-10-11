/**
 * Session Checker
 * Validates authentication state and redirects as needed
 */

(function() {
  // Define auth-required pages - will redirect to login if not authenticated
  const AUTH_REQUIRED_PAGES = [
    'home.html',
    'search-inventory.html',
    'profile-label-printing.html',
    'acc-label-printing.html',
    'rack-label-printing.html',
    'profile-print-preview.html',
    'accessories-print-preview.html',
    'bin-card.html'
  ];
  
  // Define admin-only pages - will redirect to home if authenticated but not admin
  const ADMIN_ONLY_PAGES = [
    'admin.html'
  ];
  
  // Pages that don't require authentication - will redirect to home if already authenticated
  const PUBLIC_PAGES = [
    'login.html',
    'index.html'
  ];

  // Check authentication state on page load
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      console.log('🔒 Session checker running...');
      
      // Get current page
      const currentPath = location.pathname.split('/').pop() || 'index.html';
      console.log('Current page:', currentPath);
      
      // Wait a moment to ensure Supabase and auth helper are loaded
      setTimeout(async () => {
        let isAuthenticated = false;
        let isAdmin = false;
        
        // Try to check auth state using auth helper
        if (window.authHelper) {
          console.log('Using authHelper to check session state');
          const state = await window.authHelper.refreshAuthState();
          isAuthenticated = state.isAuthenticated;
          isAdmin = state.isAdmin;
        } 
        // Fallback to direct Supabase client
        else if (window.getSupabaseClient && window.getSupabaseClient()) {
          console.log('Using direct Supabase client to check session state');
          const supabase = window.getSupabaseClient();
          const { data } = await supabase.auth.getSession();
          isAuthenticated = !!data?.session;
          
          // Check admin status if authenticated
          if (isAuthenticated && data?.session?.user?.id) {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin, role')
                .eq('id', data.session.user.id)
                .single();
              
              isAdmin = !!(profile && (
                profile.is_admin === true || 
                profile.role === 'admin' || 
                profile.role === 'ADMIN'
              ));
            } catch (e) {
              console.warn('Failed to check admin status:', e);
            }
          }
        }
        
        console.log('Auth state check complete:', { isAuthenticated, isAdmin });
        
        // Handle redirects based on auth state
        if (AUTH_REQUIRED_PAGES.includes(currentPath) && !isAuthenticated) {
          console.log('Access denied: Authentication required');
          location.replace('login.html');
          return;
        }
        
        if (ADMIN_ONLY_PAGES.includes(currentPath) && (!isAuthenticated || !isAdmin)) {
          console.log('Access denied: Admin privileges required');
          location.replace(isAuthenticated ? 'home.html' : 'login.html');
          return;
        }
        
        if (PUBLIC_PAGES.includes(currentPath) && isAuthenticated) {
          console.log('Already authenticated, redirecting to home');
          location.replace(isAdmin ? 'admin.html' : 'home.html');
          return;
        }
        
        // Update UI based on auth state if no redirects happened
        if (window.authHelper) {
          window.authHelper.updateUI(isAuthenticated);
        }
        
        console.log('✅ Session check completed with no redirects needed');
      }, 300);
    } catch (error) {
      console.error('Session checker error:', error);
    }
  });
  
  // Listen for auth state changes
  window.addEventListener('authStateChanged', (event) => {
    console.log('Auth state changed event detected:', event.detail);
    
    // Get current page
    const currentPath = location.pathname.split('/').pop() || 'index.html';
    
    // Handle redirects based on new auth state
    if (event.detail.event === 'SIGNED_OUT') {
      if (AUTH_REQUIRED_PAGES.includes(currentPath) || ADMIN_ONLY_PAGES.includes(currentPath)) {
        console.log('User signed out, redirecting to login');
        location.replace('login.html');
      }
    } else if (event.detail.event === 'SIGNED_IN') {
      if (PUBLIC_PAGES.includes(currentPath)) {
        console.log('User signed in, redirecting to home');
        location.replace(event.detail.isAdmin ? 'admin.html' : 'home.html');
      } else if (ADMIN_ONLY_PAGES.includes(currentPath) && !event.detail.isAdmin) {
        console.log('Non-admin access to admin page, redirecting');
        location.replace('home.html');
      }
    }
  });
})();