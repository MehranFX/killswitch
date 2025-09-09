/**
 * Timezone Protection - Content script coordinator
 */

(function() {
    'use strict';
    
    console.log('🛡️ Timezone Protection: Starting...');
    
    function initializeProtection() {
        console.log('🛡️ Timezone Protection: Initializing...');
        
        // Get settings from storage
        chrome.storage.local.get(['timezone', 'locale', 'latitude', 'longitude', 'location_config'], (result) => {
            const timezone = result.timezone || 'America/Toronto';
            const locale = result.locale || 'en-CA';
            const latitude = result.latitude || '43.6532';
            const longitude = result.longitude || '-79.3832';
            
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
        
        // Listen for storage changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && (changes.timezone || changes.locale || changes.latitude || changes.longitude)) {
                console.log('🔄 Timezone settings changed, reapplying spoofing...');
                chrome.storage.local.get(['timezone', 'locale', 'latitude', 'longitude'], (result) => {
                    const timezone = result.timezone || 'America/Toronto';
                    const locale = result.locale || 'en-CA';
                    const latitude = result.latitude || '43.6532';
                    const longitude = result.longitude || '-79.3832';
                    
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