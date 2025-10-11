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

          // If Supabase does not show a session, also check Static Web Apps auth (AAD)
          // This handles users who signed-in with Microsoft via the SWA auth endpoint.
          if (!isAuthenticated) {
            try {
              console.log('No Supabase session found — checking Static Web Apps /.auth/me');
              const resp = await fetch('/.auth/me', { method: 'GET', cache: 'no-store' });
              if (resp.ok) {
                const body = await resp.json();

                // Normalize different possible shapes of the /.auth/me response
                // Prefer clientPrincipal when present
                let principal = null;
                if (body.clientPrincipal) {
                  principal = body.clientPrincipal;
                } else if (Array.isArray(body) && body.length > 0) {
                  // Some platforms return an array of provider principals
                  principal = body[0].clientPrincipal || body[0];
                } else if (typeof body === 'object') {
                  principal = body;
                }

                const userDetails = principal?.userDetails || principal?.user?.email || principal?.user?.userDetails || null;
                const roles = principal?.userRoles || principal?.roles || [];

                if (userDetails) {
                  console.log('Static Web Apps identity detected for', userDetails);
                  isAuthenticated = true;

                  // Try to map by email to your Supabase profiles table to determine admin status
                  try {
                    const email = userDetails; // typically the email
                    const { data: profileByEmail, error: profErr } = await supabase
                      .from('profiles')
                      .select('is_admin, role, id')
                      .eq('email', email)
                      .maybeSingle();

                    if (profErr) {
                      console.warn('Error querying profile by email:', profErr);
                    }

                    if (profileByEmail) {
                      isAdmin = !!(profileByEmail.is_admin === true || profileByEmail.role === 'admin' || profileByEmail.role === 'ADMIN');
                      // set authHelper state if available
                      if (window.authHelper) {
                        window.authHelper.user = { id: profileByEmail.id, email };
                        window.authHelper.userProfile = profileByEmail;
                        window.authHelper.isAdmin = isAdmin;
                      }
                    } else {
                      // No profile found - check AAD roles if present
                      if (Array.isArray(roles) && roles.includes('admin')) {
                        isAdmin = true;
                      }
                    }
                  } catch (e) {
                    console.warn('Error mapping SWA identity to Supabase profile:', e);
                  }

                  // Broadcast a SIGNED_IN event so other parts of the app react
                  window.dispatchEvent(new CustomEvent('authStateChanged', {
                    detail: {
                      event: 'SIGNED_IN',
                      isSignedIn: true,
                      isAdmin: isAdmin,
                      email: userDetails
                    }
                  }));

                  // If we're on a public page, redirect immediately to home/admin
                  const currentPathInner = location.pathname.split('/').pop() || 'index.html';
                  if (PUBLIC_PAGES.includes(currentPathInner)) {
                    console.log('Redirecting after SWA sign-in to', isAdmin ? 'admin.html' : 'home.html');
                    location.replace(isAdmin ? 'admin.html' : 'home.html');
                    return; // stop further checks
                  }
                } else {
                  console.log('No user details found in /.auth/me principal:', principal);
                }
              } else {
                console.log('/.auth/me returned', resp.status);
              }
            } catch (e) {
              console.warn('Failed to fetch /.auth/me:', e);
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