/**
 * Simple Timezone Spoofing - Runs in MAIN world at document_start
 */

(function() {
    'use strict';
    
    console.log('🌍 SIMPLE Timezone: Starting simple timezone spoofing...');
    
    // Default timezone settings (will be overridden by background)
    let timezone = 'America/Toronto'; // Default to Canada timezone
    let locale = 'en-CA';
    let timezoneOffset = -300; // Default EST offset in minutes
    
    // Prevent double patching
    if (window.__ks_simple_timezone_patched__) {
        return;
    }
    window.__ks_simple_timezone_patched__ = true;
    
    // Function to apply simple timezone spoofing
    function applySimpleTimezoneSpoofing() {
        console.log('🌍 Applying SIMPLE timezone spoofing:', timezone, 'offset:', timezoneOffset);
        
        try {
            // Store original Date constructor
            const OriginalDate = Date;
            
            // Override Date constructor
            window.Date = function(...args) {
                if (args.length === 0) {
                    // new Date() - return current time in spoofed timezone
                    const now = new OriginalDate();
                    const utc = new OriginalDate(now.getTime() + (now.getTimezoneOffset() * 60000));
                    const spoofedTime = new OriginalDate(utc.toLocaleString('en-US', { timeZone: timezone }));
                    return spoofedTime;
                } else {
                    return new OriginalDate(...args);
                }
            };
            
            // Copy static methods
            window.Date.now = function() {
                const now = new OriginalDate();
                const utc = new OriginalDate(now.getTime() + (now.getTimezoneOffset() * 60000));
                const spoofedTime = new OriginalDate(utc.toLocaleString('en-US', { timeZone: timezone }));
                return spoofedTime.getTime();
            };
            
            window.Date.parse = OriginalDate.parse;
            window.Date.UTC = OriginalDate.UTC;
            
            // Override getTimezoneOffset
            window.Date.prototype.getTimezoneOffset = function() {
                return -timezoneOffset;
            };
            
            // Override toString methods
            window.Date.prototype.toString = function() {
                const str = OriginalDate.prototype.toString.call(this);
                return str.replace(/GMT[+-]\d{4}/, `GMT${timezoneOffset >= 0 ? '+' : ''}${Math.floor(timezoneOffset/60).toString().padStart(2,'0')}${(timezoneOffset%60).toString().padStart(2,'0')}`);
            };
            
            // Simple Intl.DateTimeFormat override
            if (window.Intl && window.Intl.DateTimeFormat) {
                const OriginalDateTimeFormat = window.Intl.DateTimeFormat;
                window.Intl.DateTimeFormat = function(locales, options) {
                    const spoofedOptions = { ...(options || {}), timeZone: timezone };
                    return new OriginalDateTimeFormat(locales || locale, spoofedOptions);
                };
                
                // Copy static methods
                if (OriginalDateTimeFormat.supportedLocalesOf) {
                    window.Intl.DateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf;
                }
            }
            
            // Override navigator properties
            try {
                Object.defineProperty(navigator, 'language', {
                    get: function() { return locale; },
                    configurable: true
                });
            } catch {}
            
            try {
                Object.defineProperty(navigator, 'languages', {
                    get: function() { return [locale, locale.split('-')[0]]; },
                    configurable: true
                });
            } catch {}
            
            console.log('✅ SIMPLE timezone spoofing applied successfully');
            
        } catch (e) {
            console.error('❌ Error applying SIMPLE timezone spoofing:', e);
        }
    }
    
    // Apply spoofing immediately
    applySimpleTimezoneSpoofing();
    
    // Get settings from background
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'getTimezoneSettings' }, (response) => {
                if (response && response.timezone) {
                    timezone = response.timezone;
                    locale = response.locale || 'en-US';
                    timezoneOffset = response.timezoneOffset || -300;
                    
                    console.log('🌍 Received timezone settings from background:', { timezone, locale, timezoneOffset });
                    applySimpleTimezoneSpoofing();
                } else {
                    console.log('🌍 No timezone settings received, using defaults');
                }
            });
        }
    } catch (e) {
        console.log('⚠️ Could not access chrome runtime:', e);
    }
    
    // Listen for updates
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'updateTimezone') {
            timezone = event.data.timezone || timezone;
            locale = event.data.locale || locale;
            timezoneOffset = event.data.timezoneOffset || timezoneOffset;
            console.log('🌍 Received timezone update:', { timezone, locale, timezoneOffset });
            applySimpleTimezoneSpoofing();
        }
    });
    
    console.log('🌍 SIMPLE Timezone: Ready');
    
})();