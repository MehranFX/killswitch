"use strict";

(function initBlockedPage(){
  async function loadCurrentIP() {
    try {
      const result = await chrome.storage.local.get(['current_ip', 'cachedIP']);
      const ip = result.current_ip || result.cachedIP;
      const el = document.getElementById('currentIP');
      if (ip && el) el.textContent = ip;
      if (!ip && el) {
        try {
          const response = await chrome.runtime.sendMessage({type: "getCurrentIP"});
          if (response && response.success && response.ip) {
            el.textContent = response.ip;
          } else {
            el.textContent = 'Unable to load';
          }
        } catch {
          el.textContent = 'Unable to load';
        }
      }
    } catch (e) {
      const el = document.getElementById('currentIP');
      if (el) el.textContent = 'Error loading IP';
    }
  }

  async function loadBlockedDomain() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromParam = params.get('domain');
      // // Log removed
      // // Log removed
      // // Log removed
      
      if (fromParam) {
        const el = document.getElementById('blockedDomain');
        if (el) el.textContent = fromParam;
        // // Log removed
        return;
      }
      
      // Try to get domain from sessionStorage first (more reliable than chrome.tabs.query)
      try {
        const sessionDomain = sessionStorage.getItem('blocked_domain');
        if (sessionDomain) {
          const el = document.getElementById('blockedDomain');
          if (el) el.textContent = sessionDomain;
          // // Log removed
          return;
        }
      } catch (error) {
        // // Log removed
      }
      
      // Try to get domain from chrome.storage.session
      try {
        const sessionData = await chrome.storage.session.get(['current_blocked_domain']);
        if (sessionData.current_blocked_domain) {
          const el = document.getElementById('blockedDomain');
          if (el) el.textContent = sessionData.current_blocked_domain;
          // // Log removed
          return;
        }
      } catch (error) {
        // // Log removed
      }
      // Prefer per-tab captured URL
      try {
        // First try to get the current tab
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        const tab = tabs && tabs[0];
        // // Log removed
        
        if (tab && typeof tab.id === 'number') {
          const key = `blockedUrl_${tab.id}`;
          const obj = await chrome.storage.local.get([key, 'last_blocked_domain']);
          // // Log removed
          const perTabUrl = obj[key];
          
          if (perTabUrl) {
            try {
              const u = new URL(perTabUrl);
              const host = u.hostname;
              const el = document.getElementById('blockedDomain');
              if (el) el.textContent = host;
              // // Log removed
              return;
            } catch (error) {
              // // Log removed
            }
          }
          
          if (obj.last_blocked_domain) {
            const el = document.getElementById('blockedDomain');
            if (el) el.textContent = obj.last_blocked_domain;
            // // Log removed
            return;
          }
        } else {
          // // Log removed
        }
      } catch (error) {
        // // Log removed
        // Fallback: try to get domain from storage without tab query
        try {
          const obj = await chrome.storage.local.get(['last_blocked_domain']);
          if (obj.last_blocked_domain) {
            const el = document.getElementById('blockedDomain');
            if (el) el.textContent = obj.last_blocked_domain;
            // // Log removed
            return;
          }
        } catch (fallbackError) {
          // // Log removed
        }
      }
      const ref = document.referrer;
      // // Log removed
      if (ref) {
        try {
          const url = new URL(ref);
          const el = document.getElementById('blockedDomain');
          if (el) el.textContent = url.hostname;
          // // Log removed
          return;
        } catch (error) {
          // // Log removed
        }
      }
      const storage = await chrome.storage.local.get(null);
      // // Log removed
      let blockedUrl = null;
      let latestTabId = null;
      let latestTimestamp = 0;
      
      // Find the most recent blockedUrl_* entry
      for (const key in storage) {
        if (key.startsWith('blockedUrl_')) {
          const tabId = parseInt(key.replace('blockedUrl_', ''));
          if (!isNaN(tabId) && tabId > latestTabId) {
            latestTabId = tabId;
            blockedUrl = storage[key];
          }
        }
      }
      // // Log removed
      // Prefer explicit last_blocked_domain if present
      if (storage.last_blocked_domain) {
        const el = document.getElementById('blockedDomain');
        if (el) el.textContent = storage.last_blocked_domain;
        // // Log removed
        return;
      }
      
      // Try to get domain from any blockedUrl_* entry
      if (blockedUrl) {
        try {
          const u = new URL(blockedUrl);
          const el = document.getElementById('blockedDomain');
          if (el) el.textContent = u.hostname;
          // // Log removed
          return;
        } catch (error) {
          // // Log removed
          const m = blockedUrl.match(/(?:https?:\/\/)?(?:www\.)?([^\/\?]+)/);
          const el = document.getElementById('blockedDomain');
          if (el) el.textContent = (m && m[1]) ? m[1] : blockedUrl;
          // // Log removed
          return;
        }
      }
      
      // Final fallback
      const el = document.getElementById('blockedDomain');
      if (!el) return;
      el.textContent = 'Unknown domain';
      // // Log removed
    } catch (error) {
      const el = document.getElementById('blockedDomain');
      if (el) el.textContent = 'Error loading domain';
      // // Log removed
    }
  }

  async function handleRefresh() {
    await loadCurrentIP();
    setTimeout(()=> window.location.reload(), 1000);
  }

  function handleOptions(){
    try { chrome.runtime.openOptionsPage(); } catch {}
  }

  function handleBack(){
    try { window.history.back(); } catch {}
  }

  // Wire events
  document.addEventListener('DOMContentLoaded', ()=>{
    const refreshBtn = document.getElementById('refresh_btn');
    const optionsBtn = document.getElementById('options_btn');
    const backBtn = document.getElementById('back_btn');
    if (refreshBtn) refreshBtn.addEventListener('click', handleRefresh);
    if (optionsBtn) optionsBtn.addEventListener('click', handleOptions);
    if (backBtn) backBtn.addEventListener('click', handleBack);

    setTimeout(()=>{
      loadCurrentIP();
      loadBlockedDomain();
    }, 100);
  });
})();


