/**
 * Timezone Protection - Content script coordinator
 */

(function() {
    'use strict';
    
    // Log removed
    
    function initializeProtection() {
        // Log removed
        
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
                // Log removed
                
                let timezone, locale, latitude, longitude;
                
                // Use IP-based values if matchIP is selected
                if (result.location_config === 'matchIP' && result.current_timezone) {
                    timezone = result.current_timezone;
                    locale = result.current_locale || 'en-US';
                    latitude = result.latitude || '0';
                    longitude = result.longitude || '0';
                    // Log removed
                } else if (result.timezone) {
                    timezone = result.timezone;
                    locale = result.locale || 'en-US';
                    latitude = result.latitude || '0';
                    longitude = result.longitude || '0';
                    // Log removed
                } else {
                    // Log removed
                    setTimeout(getSettings, 200);
                    return;
                }
                
                // Log removed
                
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
                // Log removed
                chrome.storage.local.get(['timezone', 'locale', 'latitude', 'longitude', 'location_config', 'current_timezone', 'current_locale'], (result) => {
                    let timezone, locale, latitude, longitude;
                    
                    // Use IP-based values if matchIP is selected
                    if (result.location_config === 'matchIP' && result.current_timezone) {
                        timezone = result.current_timezone;
                        locale = result.current_locale || 'en-US';
                        latitude = result.latitude || '0';
                        longitude = result.longitude || '0';
                        // Log removed
                    } else {
                        timezone = result.timezone || 'UTC';
                        locale = result.locale || 'en-US';
                        latitude = result.latitude || '0';
                        longitude = result.longitude || '0';
                        // Log removed
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
    
    // Log removed
    
})();