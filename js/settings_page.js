"use strict";

(function(){
  async function loadSettings(){
    const data = await chrome.storage.local.get(['fallback_proxy','webrtc_protect']);
    const input = document.getElementById('fallback_proxy');
    if(input){ input.value = data.fallback_proxy || '' }
    const webrtc = document.getElementById('webrtc_protect');
    if(webrtc){ webrtc.checked = !!data.webrtc_protect }
  }

  async function saveSettings(){
    const input = document.getElementById('fallback_proxy');
    const value = (input?.value || '').trim();
    const webrtc = document.getElementById('webrtc_protect');
    const protect = !!(webrtc && webrtc.checked);
    await chrome.storage.local.set({ fallback_proxy: value, webrtc_protect: protect });
    const msg = document.getElementById('message');
    if(msg){ msg.textContent = 'Saved'; msg.style.display = 'block'; setTimeout(()=> msg.style.display='none', 2000); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    const btn = document.getElementById('save_settings');
    if(btn){ btn.addEventListener('click', (e)=>{ e.preventDefault(); saveSettings(); }); }
  });
})();


