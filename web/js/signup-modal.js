// signup-modal.js - opens signup modal and wires existing signup form handlers
(function(){
  function qs(sel, root=document){ return root.querySelector(sel); }

  function openModal(){
    const modal = qs('#signup-modal');
    if(!modal) return;
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden','false');
    // trap focus
    const focusable = modal.querySelectorAll('a[href], button, input, textarea, select');
    if(focusable && focusable.length) focusable[0].focus();
    document.body.style.overflow = 'hidden';
  }

  function closeModal(){
    const modal = qs('#signup-modal');
    if(!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', (e)=>{
    if(e.target && e.target.id === 'open-signup-modal'){
      e.preventDefault(); openModal();
    }
    if(e.target && e.target.id === 'signup-cancel'){
      e.preventDefault(); closeModal();
    }
    if(e.target && e.target.id === 'signup-modal-backdrop'){
      closeModal();
    }
  });

  // close on ESC
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape') closeModal();
  });

  // export for tests
  window.signupModal = { open: openModal, close: closeModal };
})();
