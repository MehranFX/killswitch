"use strict";

(function(){
  async function loadSettings(){
    const data = await chrome.storage.local.get(['fallback_proxy','webrtc_policy']);
    const input = document.getElementById('fallback_proxy');
    if(input){ input.value = data.fallback_proxy || '' }
    const webrtc = document.getElementById('webrtc_policy');
    if(webrtc){ webrtc.value = data.webrtc_policy || 'default_public_interface_only' }
  }

  async function saveSettings(){
    const input = document.getElementById('fallback_proxy');
    const value = (input?.value || '').trim();
    const webrtc = document.getElementById('webrtc_policy');
    const policy = webrtc ? webrtc.value : 'default_public_interface_only';
    await chrome.storage.local.set({ fallback_proxy: value, webrtc_policy: policy });
    
    // Apply WebRTC policy immediately via background script
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'updateWebRTCPolicy',
        policy: policy
      });
      if (!response.success) {
        console.error('Failed to update WebRTC policy:', response.error);
      }
    } catch (error) {
      console.error('Error updating WebRTC policy:', error);
    }
    
    const msg = document.getElementById('message');
    if(msg){ msg.textContent = 'Saved'; msg.style.display = 'block'; setTimeout(()=> msg.style.display='none', 2000); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    const btn = document.getElementById('save_settings');
    if(btn){ btn.addEventListener('click', (e)=>{ e.preventDefault(); saveSettings(); }); }
  });
})();


