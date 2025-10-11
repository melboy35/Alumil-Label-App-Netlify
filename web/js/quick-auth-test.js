/**
 * Quick Authentication Test Script
 * Run this in the browser console to test authentication
 */

async function quickAuthTest() {
  console.log('🔥 Starting Quick Authentication Test');
  
  try {
    // Step 1: Check if Supabase is available
    if (typeof supabase === 'undefined') {
      throw new Error('Supabase library not loaded');
    }
    console.log('✅ Supabase library found');
    
    // Step 2: Get credentials from meta tags
    const urlMeta = document.querySelector('meta[name="supabase-url"]');
    const keyMeta = document.querySelector('meta[name="supabase-key"]');
    
    if (!urlMeta || !keyMeta) {
      throw new Error('Supabase credentials not found in meta tags');
    }
    
    const supabaseUrl = urlMeta.content;
    const supabaseKey = keyMeta.content;
    
    console.log('✅ Supabase credentials found');
    console.log('URL:', supabaseUrl.substring(0, 30) + '...');
    console.log('Key length:', supabaseKey.length);
    
    // Step 3: Initialize Supabase client
    const client = supabase.createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'alumil_auth_token'
      }
    });
    
    console.log('✅ Supabase client created');
    
    // Step 4: Test connection by getting session
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    
    if (sessionError) {
      console.warn('⚠️ Session check warning:', sessionError.message);
    } else {
      console.log('✅ Session check successful');
      if (sessionData.session) {
        console.log('📋 Current session:', {
          user: sessionData.session.user.email,
          expiresAt: new Date(sessionData.session.expires_at * 1000).toISOString()
        });
      } else {
        console.log('📋 No active session');
      }
    }
    
    // Step 5: Test database connection (try to query profiles table)
    try {
      const { data: profiles, error: profileError } = await client
        .from('profiles')
        .select('id, email, is_admin')
        .limit(1);
      
      if (profileError) {
        console.warn('⚠️ Database query warning:', profileError.message);
      } else {
        console.log('✅ Database connection successful');
        console.log('📊 Sample profiles data:', profiles);
      }
    } catch (dbError) {
      console.warn('⚠️ Database test failed:', dbError.message);
    }
    
    // Step 6: Test auth helper if available
    if (window.authHelper) {
      console.log('✅ Auth helper found');
      
      const authState = await window.authHelper.refreshAuthState();
      console.log('📋 Auth helper state:', authState);
    } else {
      console.log('⚠️ Auth helper not found');
    }
    
    console.log('🎉 Quick authentication test completed successfully!');
    
    return {
      success: true,
      supabaseAvailable: true,
      credentialsFound: true,
      connectionWorks: !sessionError,
      authHelperAvailable: !!window.authHelper,
      currentSession: sessionData.session
    };
    
  } catch (error) {
    console.error('❌ Quick authentication test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Auto-run if DOM is already loaded, otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(quickAuthTest, 1000);
  });
} else {
  setTimeout(quickAuthTest, 500);
}

// Make available globally for manual testing
window.quickAuthTest = quickAuthTest;