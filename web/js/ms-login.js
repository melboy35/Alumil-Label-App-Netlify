// ms-login.js - simple helper to trigger AAD login via Azure Static Web Apps auth endpoint
(function(){
  function msLogin() {
    // Static Web Apps AAD login endpoint
    // This will trigger the Azure AD sign-in flow and then redirect to the site root
    const redirect = encodeURIComponent(window.location.origin + '/');
    // Use the built-in Static Web Apps auth endpoint
    const url = `/.auth/login/aad?post_login_redirect_url=${redirect}`;
    window.location.href = url;
  }

  document.addEventListener('click', (e)=>{
    if (e.target && (e.target.id === 'ms-login-btn' || e.target.closest('#ms-login-btn'))) {
      e.preventDefault();
      msLogin();
    }
  });

  window.msLogin = msLogin;
})();
