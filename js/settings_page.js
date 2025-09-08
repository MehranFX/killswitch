"use strict";

(function(){
  async function loadSettings(){
    const data = await chrome.storage.local.get(['fallback_proxy','webrtc_policy','location_config','timezone','locale','latitude','longitude','privacy_protection']);
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
    
    // Privacy protection setting
    const privacyProtection = document.getElementById('privacy_protection');
    if(privacyProtection){ privacyProtection.checked = !!data.privacy_protection }
  }

  function toggleCustomFields(config) {
    const customFields = document.getElementById('custom_location_fields');
    if (customFields) {
      customFields.style.display = config === 'custom' ? 'block' : 'none';
    }
  }

  async function fetchIPLocation() {
    try {
      const response = await fetch('http://ip-api.com/json?fields=status,message,countryCode,lat,lon,timezone,query');
      const data = await response.json();
      if (data.status === 'success') {
        return {
          timezone: data.timezone,
          locale: getLocaleFromCountryCode(data.countryCode),
          latitude: data.lat,
          longitude: data.lon
        };
      }
    } catch (error) {
      console.error('Error fetching IP location:', error);
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
      }
    }
    
    // Privacy protection setting
    const privacyProtection = document.getElementById('privacy_protection');
    const protectionEnabled = privacyProtection ? privacyProtection.checked : false;
    
    await chrome.storage.local.set({ 
      fallback_proxy: value, 
      webrtc_policy: policy,
      location_config: config,
      timezone: timezone,
      locale: locale,
      latitude: latitude,
      longitude: longitude,
      privacy_protection: protectionEnabled
    });
    
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
        console.error('Failed to update location spoofing:', response.error);
      }
    } catch (error) {
      console.error('Error updating location spoofing:', error);
    }
    
    const msg = document.getElementById('message');
    if(msg){ msg.textContent = 'Saved'; msg.style.display = 'block'; setTimeout(()=> msg.style.display='none', 2000); }
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
  });
})();


