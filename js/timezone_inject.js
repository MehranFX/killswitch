/**
 * Timezone Injection Script - Injected into MAIN world
 */

(function() {
    'use strict';
    
    // Log removed
    
    // Get timezone from URL parameters or use default
    const urlParams = new URLSearchParams(window.location.search);
    const timezone = urlParams.get('tz') || 'UTC';
    const locale = urlParams.get('loc') || 'en-US';
    
    // Log removed
    
    // Apply timezone spoofing
    try {
        // Override Date constructor
        const OriginalDate = Date;
        window.Date = function(...args) {
            if (args.length === 0) {
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
            const now = new OriginalDate();
            const utc = new OriginalDate(now.getTime() + (now.getTimezoneOffset() * 60000));
            const spoofedTime = new OriginalDate(utc.toLocaleString('en-US', { timeZone: timezone }));
            return Math.round((spoofedTime.getTime() - utc.getTime()) / 60000);
        };
        
        // Override Intl.DateTimeFormat
        if (window.Intl && window.Intl.DateTimeFormat) {
            const OriginalDateTimeFormat = window.Intl.DateTimeFormat;
            window.Intl.DateTimeFormat = function(locales, options) {
                const spoofedOptions = { ...(options || {}), timeZone: timezone };
                return new OriginalDateTimeFormat(locales || locale, spoofedOptions);
            };
        }
        
        // Log removed
        
    } catch (e) {
        // Error removed
    }
    
})();
