"use strict";

(function(){
  async function loadSettings(){
    const data = await chrome.storage.local.get([
      'fallback_proxy','webrtc_policy','location_config','timezone','locale','latitude','longitude',
      'canvas_protection','webgl_protection','audio_protection','font_protection','screen_spoofing',
      'battery_protection','memory_spoofing','hardware_spoofing','language_spoofing','dnt_header',
      'referrer_control','storage_protection','cookie_protection','block_ping',
      'ip_leak_detection','fingerprint_randomization','network_spoofing','media_spoofing','timing_protection','flash_protection',
      'icon_type','privacy_master','user_agent_type','custom_user_agent'
    ]);
    
    const input = document.getElementById('fallback_proxy');
    if(input){ input.value = data.fallback_proxy || '' }
    const webrtc = document.getElementById('webrtc_policy');
    if(webrtc){ webrtc.value = data.webrtc_policy || 'default_public_interface_only' }
    
    // Location spoofing settings
    const locationConfig = document.getElementById('location_config');
    if(locationConfig){ 
      locationConfig.value = data.location_config || 'matchIP';
      toggleCustomFields(data.location_config);
    }
    const timezone = document.getElementById('timezone');
    if(timezone){ timezone.value = data.timezone || '' }
    const locale = document.getElementById('locale');
    if(locale){ locale.value = data.locale || '' }
    const latitude = document.getElementById('latitude');
    if(latitude){ latitude.value = data.latitude || '' }
    const longitude = document.getElementById('longitude');
    if(longitude){ longitude.value = data.longitude || '' }

    // Icon type
    const iconType = document.getElementById('icon_type');
    if(iconType){ iconType.value = data.icon_type || 'country_flag' }
    
    // User-Agent settings
    const userAgentType = document.getElementById('user_agent_type');
    if(userAgentType){ 
      userAgentType.value = data.user_agent_type || 'default';
      toggleCustomUserAgent(data.user_agent_type);
    }
    const customUserAgent = document.getElementById('custom_user_agent');
    if(customUserAgent){ customUserAgent.value = data.custom_user_agent || '' }
    
    // Master toggle
    const master = document.getElementById('privacy_master');
    if(master){
      master.checked = data.privacy_master !== false; // default true
      // Sync localStorage on load
      try { localStorage.setItem('ks_privacy_master', (data.privacy_master !== false) ? 'on' : 'off'); } catch(_) {}
      setChildrenDisabled(!master.checked);
      master.addEventListener('change', ()=>{
        setChildrenDisabled(!master.checked);
      });
    }
    
    // Privacy protection settings
    const privacySettings = [
      'canvas_protection','webgl_protection','audio_protection','font_protection','screen_spoofing',
      'battery_protection','memory_spoofing','hardware_spoofing','language_spoofing','dnt_header',
      'referrer_control','storage_protection','cookie_protection','block_ping',
      'ip_leak_detection','fingerprint_randomization','network_spoofing','media_spoofing','timing_protection','flash_protection'
    ];
    
    privacySettings.forEach(setting => {
      const element = document.getElementById(setting);
      if(element){ 
        element.checked = data[setting] !== false; // Default to true unless explicitly false
        
        // Mirror important settings to localStorage on load
        try {
          if (setting === 'webgl_protection') {
            localStorage.setItem('ks_webgl_protection', element.checked ? 'on' : 'off');
          } else if (setting === 'canvas_protection') {
            localStorage.setItem('ks_canvas_protection', element.checked ? 'on' : 'off');
          } else if (setting === 'audio_protection') {
            localStorage.setItem('ks_audio_protection', element.checked ? 'on' : 'off');
          }
        } catch(_) {}
      }
    });
  }

  function toggleCustomFields(config) {
    const customFields = document.getElementById('custom_location_fields');
    if (customFields) {
      customFields.style.display = config === 'custom' ? 'block' : 'none';
    }
  }

  function toggleCustomUserAgent(type) {
    const customField = document.getElementById('custom_user_agent_field');
    if (customField) {
      customField.style.display = type === 'custom' ? 'block' : 'none';
    }
  }

  async function fetchIPLocation() {
    try {
      const response = await fetch('https://ipwho.is/');
      if (response.ok) {
        const data = await response.json();
        if (data && data.success !== false) {
          const tz = data.timezone?.id || data.timezone;
          const cc = data.country_code || data.countryCode;
          const lat = data.latitude !== undefined ? data.latitude : data.lat;
          const lon = data.longitude !== undefined ? data.longitude : data.lon;
          if (tz && lat !== undefined && lon !== undefined) {
            return {
              timezone: tz,
              locale: getLocaleFromCountryCode(cc),
              latitude: lat,
              longitude: lon
            };
          }
        }
      }
    } catch (error) {
      // Error removed
    }
    return null;
  }

  function getLocaleFromCountryCode(countryCode) {
    const localeMap = {
      'US': 'en-US', 'GB': 'en-GB', 'CA': 'en-CA', 'AU': 'en-AU',
      'DE': 'de-DE', 'FR': 'fr-FR', 'ES': 'es-ES', 'IT': 'it-IT',
      'JP': 'ja-JP', 'KR': 'ko-KR', 'CN': 'zh-CN', 'RU': 'ru-RU',
      'BR': 'pt-BR', 'MX': 'es-MX', 'IN': 'hi-IN', 'AR': 'es-AR',
      'IR': 'fa-IR', 'TR': 'tr-TR', 'SA': 'ar-SA', 'AE': 'ar-AE',
      'EG': 'ar-EG', 'TH': 'th-TH', 'ID': 'id-ID', 'VN': 'vi-VN',
      'PH': 'en-PH', 'MY': 'ms-MY', 'SG': 'en-SG', 'HK': 'zh-HK',
      'TW': 'zh-TW', 'NL': 'nl-NL', 'BE': 'nl-BE', 'CH': 'de-CH',
      'AT': 'de-AT', 'SE': 'sv-SE', 'NO': 'no-NO', 'DK': 'da-DK',
      'FI': 'fi-FI', 'PL': 'pl-PL', 'CZ': 'cs-CZ', 'HU': 'hu-HU',
      'RO': 'ro-RO', 'BG': 'bg-BG', 'HR': 'hr-HR', 'SK': 'sk-SK',
      'SI': 'sl-SI', 'LT': 'lt-LT', 'LV': 'lv-LV', 'EE': 'et-ET',
      'UA': 'uk-UA', 'BY': 'be-BY', 'KZ': 'kk-KZ', 'UZ': 'uz-UZ',
      'AZ': 'az-AZ', 'GE': 'ka-GE', 'AM': 'hy-AM', 'KG': 'ky-KG',
      'TJ': 'tg-TJ', 'TM': 'tk-TM', 'MN': 'mn-MN', 'NP': 'ne-NP',
      'BD': 'bn-BD', 'LK': 'si-LK', 'MV': 'dv-MV', 'BT': 'dz-BT',
      'MM': 'my-MM', 'KH': 'km-KH', 'LA': 'lo-LA', 'BN': 'ms-BN',
      'TL': 'pt-TL', 'PG': 'en-PG', 'FJ': 'en-FJ', 'NC': 'fr-NC',
      'VU': 'en-VU', 'SB': 'en-SB', 'KI': 'en-KI', 'TV': 'en-TV',
      'WS': 'en-WS', 'TO': 'en-TO', 'NR': 'en-NR', 'PW': 'en-PW',
      'FM': 'en-FM', 'MH': 'en-MH', 'CK': 'en-CK', 'NU': 'en-NU',
      'TK': 'en-TK', 'WF': 'fr-WF', 'PF': 'fr-PF', 'NC': 'fr-NC',
      'RE': 'fr-RE', 'YT': 'fr-YT', 'GP': 'fr-GP', 'MQ': 'fr-MQ',
      'BL': 'fr-BL', 'MF': 'fr-MF', 'PM': 'fr-PM', 'GF': 'fr-GF',
      'SR': 'nl-SR', 'CW': 'nl-CW', 'AW': 'nl-AW', 'BQ': 'nl-BQ',
      'SX': 'nl-SX', 'AN': 'nl-AN', 'AI': 'en-AI', 'AG': 'en-AG',
      'BS': 'en-BS', 'BB': 'en-BB', 'BZ': 'en-BZ', 'DM': 'en-DM',
      'GD': 'en-GD', 'GY': 'en-GY', 'JM': 'en-JM', 'KN': 'en-KN',
      'LC': 'en-LC', 'VC': 'en-VC', 'TT': 'en-TT', 'UY': 'es-UY',
      'PY': 'es-PY', 'BO': 'es-BO', 'CL': 'es-CL', 'CO': 'es-CO',
      'EC': 'es-EC', 'PE': 'es-PE', 'VE': 'es-VE', 'GY': 'en-GY',
      'SR': 'nl-SR', 'GF': 'fr-GF', 'FK': 'en-FK', 'GS': 'en-GS',
      'SH': 'en-SH', 'AC': 'en-AC', 'TA': 'en-TA', 'BV': 'en-BV',
      'HM': 'en-HM', 'IO': 'en-IO', 'CX': 'en-CX', 'CC': 'en-CC',
      'NF': 'en-NF', 'PN': 'en-PN', 'TC': 'en-TC', 'VG': 'en-VG',
      'VI': 'en-VI', 'PR': 'es-PR', 'AS': 'en-AS', 'GU': 'en-GU',
      'MP': 'en-MP', 'VI': 'en-VI', 'PR': 'es-PR', 'AS': 'en-AS',
      'GU': 'en-GU', 'MP': 'en-MP', 'VI': 'en-VI', 'PR': 'es-PR'
    };
    return localeMap[countryCode] || 'en-US';
  }

  async function saveSettings(){
    const input = document.getElementById('fallback_proxy');
    const value = (input?.value || '').trim();
    const webrtc = document.getElementById('webrtc_policy');
    const policy = webrtc ? webrtc.value : 'default_public_interface_only';
    
    // Location spoofing settings
    const locationConfig = document.getElementById('location_config');
    const config = locationConfig ? locationConfig.value : 'matchIP';
    
    // Icon type
    const iconTypeEl = document.getElementById('icon_type');
    const iconType = iconTypeEl ? iconTypeEl.value : 'country_flag';
    
    // User-Agent settings
    const userAgentTypeEl = document.getElementById('user_agent_type');
    const userAgentType = userAgentTypeEl ? userAgentTypeEl.value : 'default';
    const customUserAgentEl = document.getElementById('custom_user_agent');
    const customUserAgent = customUserAgentEl ? customUserAgentEl.value : '';
    
    let timezone = '', locale = '', latitude = '', longitude = '';
    
    if (config === 'custom') {
      const timezoneInput = document.getElementById('timezone');
      const localeInput = document.getElementById('locale');
      const latitudeInput = document.getElementById('latitude');
      const longitudeInput = document.getElementById('longitude');
      
      timezone = timezoneInput ? timezoneInput.value : '';
      locale = localeInput ? localeInput.value : '';
      latitude = latitudeInput ? latitudeInput.value : '';
      longitude = longitudeInput ? longitudeInput.value : '';
    } else if (config === 'matchIP') {
      const ipLocation = await fetchIPLocation();
      if (ipLocation) {
        timezone = ipLocation.timezone;
        locale = ipLocation.locale;
        latitude = ipLocation.latitude;
        longitude = ipLocation.longitude;
        
        // Store IP-based timezone and locale for getTimezoneSettings
        await chrome.storage.local.set({
          current_timezone: ipLocation.timezone,
          current_locale: ipLocation.locale
        });
        
        // Log removed
      }
    }
    
    // Privacy protection settings
    const privacySettings = [
      'canvas_protection','webgl_protection','audio_protection','font_protection','screen_spoofing',
      'battery_protection','memory_spoofing','hardware_spoofing','language_spoofing','dnt_header',
      'referrer_control','storage_protection','cookie_protection',
      'ip_leak_detection','fingerprint_randomization','network_spoofing','media_spoofing','timing_protection','flash_protection'
    ];
    
    const privacyData = {};
    privacySettings.forEach(setting => {
      const element = document.getElementById(setting);
      privacyData[setting] = element ? element.checked : false;
    });
    
    await chrome.storage.local.set({ 
      fallback_proxy: value, 
      webrtc_policy: policy,
      location_config: config,
      timezone: timezone,
      locale: locale,
      latitude: latitude,
      longitude: longitude,
      icon_type: iconType,
      user_agent_type: userAgentType,
      custom_user_agent: customUserAgent,
      privacy_master: (document.getElementById('privacy_master')?.checked !== false),
      ...privacyData
    });
    
    // Mirror important privacy settings to localStorage for synchronous access
    try { 
      localStorage.setItem('ks_privacy_master', (document.getElementById('privacy_master')?.checked !== false) ? 'on' : 'off');
      
      // Mirror individual privacy settings
      const webglEl = document.getElementById('webgl_protection');
      if (webglEl) {
        localStorage.setItem('ks_webgl_protection', webglEl.checked ? 'on' : 'off');
      }
      
      const canvasEl = document.getElementById('canvas_protection');
      if (canvasEl) {
        localStorage.setItem('ks_canvas_protection', canvasEl.checked ? 'on' : 'off');
      }
      
      const audioEl = document.getElementById('audio_protection');
      if (audioEl) {
        localStorage.setItem('ks_audio_protection', audioEl.checked ? 'on' : 'off');
      }
    } catch(_) {}
    
    // Apply WebRTC policy immediately via background script
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'updateWebRTCPolicy',
        policy: policy
      });
      if (!response.success) {
        // Error removed
      }
    } catch (error) {
      // Error removed
    }
    
    // Apply location spoofing via background script
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'updateLocationSpoofing',
        config: config,
        timezone: timezone,
        locale: locale,
        latitude: latitude,
        longitude: longitude
      });
      if (!response.success) {
        // Error removed
      }
    } catch (error) {
      // Error removed
    }

    // Apply icon change via background
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'updateIconType',
        iconType: iconType
      });
      // ignore response
    } catch (_) {}
    
    // Apply User-Agent change via background
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'updateUserAgent',
        userAgentType: userAgentType,
        customUserAgent: customUserAgent
      });
      // ignore response
    } catch (_) {}
    
    const msg = document.getElementById('message');
    if(msg){ 
      msg.textContent = '✅ Settings saved successfully!'; 
      msg.classList.add('show'); 
      setTimeout(()=> msg.classList.remove('show'), 3000); 
    }
  }

  function setChildrenDisabled(disabled){
    const ids = [
      'canvas_protection','webgl_protection','audio_protection','font_protection','screen_spoofing',
      'battery_protection','memory_spoofing','hardware_spoofing','language_spoofing','dnt_header',
      'referrer_control','storage_protection','cookie_protection','block_ping',
      'ip_leak_detection','fingerprint_randomization','network_spoofing','media_spoofing','timing_protection','flash_protection'
    ];
    ids.forEach(id=>{ const el = document.getElementById(id); if(el){ el.disabled = disabled; }});
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    const btn = document.getElementById('save_settings');
    if(btn){ btn.addEventListener('click', (e)=>{ e.preventDefault(); saveSettings(); }); }
    
    // Location config change handler
    const locationConfig = document.getElementById('location_config');
    if(locationConfig){ 
      locationConfig.addEventListener('change', (e) => {
        toggleCustomFields(e.target.value);
      });
    }

    // User-Agent config change handler
    const userAgentType = document.getElementById('user_agent_type');
    if(userAgentType){ 
      userAgentType.addEventListener('change', (e) => {
        toggleCustomUserAgent(e.target.value);
      });
    }

    // Apply icon change immediately on select change (UX)
    const iconType = document.getElementById('icon_type');
    if(iconType){
      iconType.addEventListener('change', async (e) => {
        const v = e.target.value;
        await chrome.storage.local.set({ icon_type: v });
        try { await chrome.runtime.sendMessage({ type: 'updateIconType', iconType: v }); } catch(_) {}
      });
    }
  });
})();


