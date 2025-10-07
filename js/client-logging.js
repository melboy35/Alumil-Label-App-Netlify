// Simple client-side logger: stores events to localStorage and prints to console
(function(){
  const STORAGE_KEY = 'alumil_client_logs';
  function now(){ return new Date().toISOString(); }
  function pushEvent(type, payload){
    const entry = { ts: now(), type, payload };
    try{
      const raw = localStorage.getItem(STORAGE_KEY) || '[]';
      const arr = JSON.parse(raw);
      arr.push(entry);
      // keep last 200 events
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(-200)));
    }catch(e){ console.warn('alumilLogger storage failed', e); }
    try{ console.info('[alumil-log]', entry); }catch(e){}
  }

  window.alumilLogger = {
    log: pushEvent,
    get: ()=>{ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }catch(e){ return []; } },
    clear: ()=> localStorage.removeItem(STORAGE_KEY)
  };
})();
