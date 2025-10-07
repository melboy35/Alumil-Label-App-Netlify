// login-page.js - moved from inline script in login.html
// Enhanced Singleton implementation for Supabase client
window.getSupabaseClient = function() {
  if (window._sbClient) {
    return window._sbClient;
  }
  
  try {
    const supabaseUrl = document.querySelector('meta[name="supabase-url"]').content;
    const supabaseKey = document.querySelector('meta[name="supabase-key"]').content;
    
    window._sbClient = supabase.createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      storageKey: "alumil_auth_token"
      }
    });
    
    return window._sbClient;
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
    return null;
  }
};

// Initialize the client
const directSupabase = getSupabaseClient();

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const errorMessage = document.getElementById('error-message');
  
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
  }
  
  function hideError() {
    errorMessage.style.display = 'none';
  }
  
  function pulse(el) {
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.98)' }, { transform: 'scale(1)' }],
      { duration: 180, easing: 'ease-out' }
    );
  }
  
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!email || !password) {
      showError("Please enter both email and password");
      return;
    }
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      showError("Please enter a valid email address");
      return;
    }
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    pulse(loginBtn);
  if (window.alumilLogger) window.alumilLogger.log('login_attempt', { email });
    
    try {
      if (window.authHelper) {
        const result = await window.authHelper.loginWithEmail(email, password);
        
            if (!result.success) {
              if (window.alumilLogger) window.alumilLogger.log('login_error', { source: 'authHelper', error: result.error });
              showError(result.error?.message || "Login failed");
              return;
            }
        
        const isAdmin = await window.authHelper.checkIsAdmin();
        setTimeout(() => {
          window.location.replace(isAdmin ? 'admin.html' : 'home.html');
        }, 100);
        return;
      } else {
        const result = await directSupabase.auth.signInWithPassword({
          email,
          password,
        });
        
            if (result.error) {
              if (window.alumilLogger) window.alumilLogger.log('login_error', { source: 'supabase', error: result.error.message || result.error });
              showError(result.error.message || "Login failed");
              return;
            }
        
        const user = result.data.user;
        const { data: profile } = await directSupabase
          .from('profiles')
          .select('role, is_admin')
          .eq('id', user.id)
          .single();
        
            const isAdmin = (profile && (profile.role === 'admin' || profile.is_admin === true));
            if (window.alumilLogger) window.alumilLogger.log('login_success', { email, userId: user?.id, isAdmin });
        
        setTimeout(() => {
          window.location.replace(isAdmin ? 'admin.html' : 'home.html');
        }, 100);
        return;
      }
    } catch (error) {
      if (error.message) {
        showError("Error: " + error.message);
      } else {
        showError("An unexpected error occurred. Please try again.");
      }
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Sign In";
    }
  });
  
  // Check if user is already logged in
  async function checkExistingSession() {
    try {
      const supabaseClient = window.getSupabaseClient();
      if (!supabaseClient) return;
      
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) return;
      
      if (data?.session) {
        try {
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('is_admin,email')
            .eq('id', data.session.user.id)
            .single();
          
          if (profile?.is_admin) {
            location.href = 'admin.html';
          } else {
            location.href = 'home.html';
          }
        } catch (profileError) {
          location.href = 'home.html';
        }
      }
    } catch (e) {
      console.error('Session check failed:', e);
    }
  }
  
  checkExistingSession();
});
