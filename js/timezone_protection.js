/**
 * Timezone Protection - Content script coordinator
 */

(function() {
    'use strict';
    
    console.log('🛡️ Timezone Protection: Starting...');
    
    function initializeProtection() {
        console.log('🛡️ Timezone Protection: Initializing...');
        
        // Send message to early script immediately
        window.postMessage({
            type: 'updateTimezone',
            timezone: 'UTC',
            locale: 'en-US',
            timezoneOffset: 0
        }, '*');
        
        // Get settings from storage with retry mechanism
        function getSettings() {
            chrome.storage.local.get(['timezone', 'locale', 'latitude', 'longitude', 'location_config', 'current_timezone', 'current_locale'], (result) => {
                console.log('🛡️ Storage data:', result);
                
                let timezone, locale, latitude, longitude;
                
                // Use IP-based values if matchIP is selected
                if (result.location_config === 'matchIP' && result.current_timezone) {
                    timezone = result.current_timezone;
                    locale = result.current_locale || 'en-US';
                    latitude = result.latitude || '0';
                    longitude = result.longitude || '0';
                    console.log('🌍 Using IP-based timezone from storage:', timezone);
                } else if (result.timezone) {
                    timezone = result.timezone;
                    locale = result.locale || 'en-US';
                    latitude = result.latitude || '0';
                    longitude = result.longitude || '0';
                    console.log('🌍 Using custom timezone from storage:', timezone);
                } else {
                    console.log('🌍 No timezone settings found, retrying in 200ms...');
                    setTimeout(getSettings, 200);
                    return;
                }
                
                console.log('🌍 Timezone protection settings:', { timezone, locale, latitude, longitude });
                
                // Calculate timezone offset
                const now = new Date();
                const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
                const spoofedTime = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
                const timezoneOffset = Math.round((spoofedTime.getTime() - utc.getTime()) / 60000);
                
                // Send message to early script
                if (window.updateEarlyTimezoneSpoofing) {
                    window.updateEarlyTimezoneSpoofing(timezone, locale, timezoneOffset);
                }
                
                // Send message to early script via postMessage
                window.postMessage({
                    type: 'updateTimezone',
                    timezone: timezone,
                    locale: locale,
                    timezoneOffset: timezoneOffset
                }, '*');
            });
        }
        
        getSettings();
        
        // Listen for storage changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && (changes.timezone || changes.locale || changes.latitude || changes.longitude || changes.current_timezone || changes.current_locale)) {
                console.log('🔄 Timezone settings changed, reapplying spoofing...');
                chrome.storage.local.get(['timezone', 'locale', 'latitude', 'longitude', 'location_config', 'current_timezone', 'current_locale'], (result) => {
                    let timezone, locale, latitude, longitude;
                    
                    // Use IP-based values if matchIP is selected
                    if (result.location_config === 'matchIP' && result.current_timezone) {
                        timezone = result.current_timezone;
                        locale = result.current_locale || 'en-US';
                        latitude = result.latitude || '0';
                        longitude = result.longitude || '0';
                        console.log('🌍 Using IP-based timezone from storage (update):', timezone);
                    } else {
                        timezone = result.timezone || 'UTC';
                        locale = result.locale || 'en-US';
                        latitude = result.latitude || '0';
                        longitude = result.longitude || '0';
                        console.log('🌍 Using custom timezone from storage (update):', timezone);
                    }
                    
                    // Calculate timezone offset
                    const now = new Date();
                    const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
                    const spoofedTime = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
                    const timezoneOffset = Math.round((spoofedTime.getTime() - utc.getTime()) / 60000);
                    
                    // Send message to early script
                    if (window.updateEarlyTimezoneSpoofing) {
                        window.updateEarlyTimezoneSpoofing(timezone, locale, timezoneOffset);
                    }
                    
                    // Send message to early script via postMessage
                    window.postMessage({
                        type: 'updateTimezone',
                        timezone: timezone,
                        locale: locale,
                        timezoneOffset: timezoneOffset
                    }, '*');
                });
            }
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeProtection);
    } else {
        initializeProtection();
    }
    
    console.log('🛡️ Timezone Protection: Ready');
    
})();