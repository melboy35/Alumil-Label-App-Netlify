// signup-page.js - Direct signup without email verification
function getSupabaseClient() {
  if (window._sbClient) {
    return window._sbClient;
  }
  try {
    const url = document.querySelector('meta[name="supabase-url"]').content;
    const key = document.querySelector('meta[name="supabase-key"]').content;
    window._sbClient = supabase.createClient(url, key, { 
      auth: { 
        autoRefreshToken: true, 
        persistSession: true,
        detectSessionInUrl: true
      } 
    });
    return window._sbClient;
  } catch (e) { 
    console.error('Failed to initialize Supabase client:', e); 
    return null; 
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signup-form');
  const errorEl = document.getElementById('error-message');
  const successEl = document.getElementById('success-message');
  const btn = document.getElementById('signup-btn');

  function showError(msg) { 
    errorEl.textContent = msg; 
    errorEl.style.display = 'block';
    successEl.style.display = 'none';
  }
  
  function hideError() { 
    errorEl.style.display = 'none'; 
  }
  
  function showSuccess(msg) { 
    successEl.textContent = msg; 
    successEl.style.display = 'block';
    errorEl.style.display = 'none';
  }
  
  function hideSuccess() { 
    successEl.style.display = 'none'; 
  }

  // Validate email format
  function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  // Validate password strength
  function isValidPassword(password) {
    // At least 8 characters, contains letters and numbers
    const hasMinLength = password.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasMinLength && hasLetter && hasNumber;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    hideError(); 
    hideSuccess();
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm_password').value;

    // Validation
    if (!name || !email || !password || !confirm) { 
      showError('Please complete all fields'); 
      return; 
    }

    if (!isValidEmail(email)) {
      showError('Please enter a valid email address');
      return;
    }

    if (password.length < 8) { 
      showError('Password must be at least 8 characters'); 
      return; 
    }

    if (!isValidPassword(password)) {
      showError('Password must contain at least one letter and one number');
      return;
    }

    if (password !== confirm) { 
      showError('Passwords do not match'); 
      return; 
    }

    btn.disabled = true; 
    btn.textContent = 'Creating Account...';
    
    if (window.alumilLogger) {
      window.alumilLogger.log('signup_attempt', { email, name });
    }

    const supabase = getSupabaseClient();
    if (!supabase) { 
      showError('Service unavailable. Please try again later.'); 
      btn.disabled = false; 
      btn.textContent = 'Create Account'; 
      return; 
    }

    try {
      // Create account without email verification
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/login.html',
          data: {
            full_name: name
          }
        }
      });

      if (authError) {
        console.warn('Auth signup error:', authError);
        
        if (authError.message.includes('already registered')) {
          showError('An account with this email already exists. Please try signing in instead.');
          setTimeout(() => {
            window.location.href = './login.html';
          }, 2000);
          return;
        }
        
        showError(authError.message || 'Failed to create account. Please try again.');
        if (window.alumilLogger) {
          window.alumilLogger.log('signup_error', { error: authError.message || authError });
        }
        return;
      }

      if (!authData.user) {
        showError('Failed to create account. Please try again.');
        return;
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            email: email,
            full_name: name,
            role: 'user',
            is_admin: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);

      if (profileError) {
        console.warn('Profile creation error:', profileError);
        // Continue anyway - the auth user was created
      }

      if (window.alumilLogger) {
        window.alumilLogger.log('signup_success', { email, user_id: authData.user.id });
      }

      // Show success message and redirect
      showSuccess('Account created successfully! Redirecting to login...');
      form.reset();
      
      // Auto-redirect to login page after 2 seconds
      setTimeout(() => {
        window.location.href = './login.html?email=' + encodeURIComponent(email);
      }, 2000);

    } catch (err) {
      console.error('Signup error:', err);
      showError('An unexpected error occurred. Please try again.');
      if (window.alumilLogger) {
        window.alumilLogger.log('signup_error', { error: err.message || 'Unknown error' });
      }
    } finally {
      btn.disabled = false; 
      btn.textContent = 'Create Account';
    }
  });

  // Check if user is already logged in (disabled to prevent redirect loops)
  async function checkExistingSession() {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('Session check error:', error);
        return;
      }
      
      if (data?.session?.user) {
        // User is already logged in - show message instead of redirect to prevent loops
        console.log('User already logged in');
        showSuccess('You are already logged in. Click here to go to your dashboard.');
        const successEl = document.getElementById('success-message');
        if (successEl) {
          successEl.innerHTML = 'You are already logged in. <a href="./home.html" style="color: #007bff; text-decoration: underline;">Click here to go to your dashboard</a>';
        }
      }
    } catch (e) {
      console.error('Session check failed:', e);
    }
  }
  
  // Check session without auto-redirect to prevent loops
  setTimeout(checkExistingSession, 500);

  // Pre-fill email if passed as URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get('email');
  if (emailParam) {
    document.getElementById('email').value = emailParam;
  }
});
