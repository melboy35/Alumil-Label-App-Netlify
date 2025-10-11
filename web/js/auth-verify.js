/**
 * Authentication Verification Script
 * This script helps verify that authentication is working correctly
 */

// Function to test the authentication system
async function verifyAuthentication() {
  console.log('🔍 Starting authentication verification...');
  
  const results = {
    supabaseLoaded: false,
    credentialsFound: false,
    clientInitialized: false,
    connectionWorking: false,
    authHelperWorking: false,
    sessionCheckerWorking: false,
    errors: []
  };
  
  try {
    // 1. Check if Supabase is loaded
    if (typeof supabase !== 'undefined') {
      results.supabaseLoaded = true;
      console.log('✅ Supabase library loaded');
    } else {
      results.errors.push('Supabase library not found');
      console.error('❌ Supabase library not found');
    }
    
    // 2. Check for credentials
    const urlMeta = document.querySelector('meta[name="supabase-url"]');
    const keyMeta = document.querySelector('meta[name="supabase-key"]');
    
    if (urlMeta?.content && keyMeta?.content) {
      results.credentialsFound = true;
      console.log('✅ Supabase credentials found in meta tags');
    } else {
      results.errors.push('Supabase credentials not found in meta tags');
      console.error('❌ Supabase credentials not found in meta tags');
    }
    
    // 3. Check if client can be initialized
    if (window.getSupabaseClient && window.getSupabaseClient()) {
      results.clientInitialized = true;
      console.log('✅ Supabase client initialized');
      
      // 4. Test connection
      try {
        const client = window.getSupabaseClient();
        const { data, error } = await client.auth.getSession();
        
        if (!error) {
          results.connectionWorking = true;
          console.log('✅ Supabase connection working');
          
          if (data.session) {
            console.log(`📋 Active session found for: ${data.session.user.email}`);
          } else {
            console.log('📋 No active session (this is normal if not logged in)');
          }
        } else {
          results.errors.push(`Connection error: ${error.message}`);
          console.error(`❌ Connection error: ${error.message}`);
        }
      } catch (connError) {
        results.errors.push(`Connection test failed: ${connError.message}`);
        console.error(`❌ Connection test failed: ${connError.message}`);
      }
    } else {
      results.errors.push('Supabase client could not be initialized');
      console.error('❌ Supabase client could not be initialized');
    }
    
    // 5. Check auth helper
    if (window.authHelper && typeof window.authHelper.refreshAuthState === 'function') {
      results.authHelperWorking = true;
      console.log('✅ Auth helper working');
      
      try {
        const authState = await window.authHelper.refreshAuthState();
        console.log('📋 Auth state:', authState);
      } catch (authError) {
        console.warn(`⚠️ Auth helper error: ${authError.message}`);
      }
    } else {
      console.log('⚠️ Auth helper not yet available (may load later)');
    }
    
    // 6. Check session checker
    if (typeof window.AuthHelper !== 'undefined') {
      results.sessionCheckerWorking = true;
      console.log('✅ Session checker loaded');
    } else {
      console.log('⚠️ Session checker not loaded');
    }
    
  } catch (error) {
    results.errors.push(`Verification failed: ${error.message}`);
    console.error(`❌ Verification failed: ${error.message}`);
  }
  
  // Summary
  console.log('\n📊 Authentication Verification Summary:');
  console.log(`Supabase loaded: ${results.supabaseLoaded ? '✅' : '❌'}`);
  console.log(`Credentials found: ${results.credentialsFound ? '✅' : '❌'}`);
  console.log(`Client initialized: ${results.clientInitialized ? '✅' : '❌'}`);
  console.log(`Connection working: ${results.connectionWorking ? '✅' : '❌'}`);
  console.log(`Auth helper working: ${results.authHelperWorking ? '✅' : '❌'}`);
  console.log(`Session checker working: ${results.sessionCheckerWorking ? '✅' : '❌'}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors found:');
    results.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  const overallSuccess = results.supabaseLoaded && 
                        results.credentialsFound && 
                        results.clientInitialized && 
                        results.connectionWorking;
  
  console.log(`\n🎯 Overall Status: ${overallSuccess ? '✅ READY' : '❌ NEEDS ATTENTION'}`);
  
  return results;
}

// Function to test login with provided credentials
async function testLogin(email, password) {
  console.log(`🔑 Testing login for: ${email}`);
  
  if (!window.authHelper) {
    console.error('❌ Auth helper not available');
    return false;
  }
  
  try {
    const result = await window.authHelper.loginWithEmail(email, password);
    
    if (result.success) {
      console.log(`✅ Login successful for: ${result.user.email}`);
      
      // Check admin status
      const isAdmin = await window.authHelper.checkIsAdmin();
      console.log(`👑 Admin status: ${isAdmin}`);
      
      return true;
    } else {
      console.error(`❌ Login failed: ${result.error.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Login error: ${error.message}`);
    return false;
  }
}

// Function to create a test user (if registration is enabled)
async function createTestUser(email, password) {
  console.log(`👤 Creating test user: ${email}`);
  
  if (!window.authHelper) {
    console.error('❌ Auth helper not available');
    return false;
  }
  
  try {
    const result = await window.authHelper.register(email, password);
    
    if (result.success) {
      console.log(`✅ User created successfully: ${result.user.email}`);
      return true;
    } else {
      console.error(`❌ User creation failed: ${result.error.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ User creation error: ${error.message}`);
    return false;
  }
}

// Auto-run verification when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    verifyAuthentication();
  }, 2000); // Wait 2 seconds for everything to load
});

// Make functions available globally for manual testing
window.verifyAuthentication = verifyAuthentication;
window.testLogin = testLogin;
window.createTestUser = createTestUser;

console.log('🚀 Authentication verification script loaded');
console.log('💡 Available commands:');
console.log('  - verifyAuthentication() - Check if auth system is working');
console.log('  - testLogin(email, password) - Test login with credentials');
console.log('  - createTestUser(email, password) - Create a test user');