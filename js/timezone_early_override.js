// Early timezone override to prevent clonedData capture
// This runs before any page scripts and immediately overrides Date APIs

(function() {
    'use strict';
    
    // Default to UTC initially to prevent real timezone leakage
    const defaultOffset = 0; // UTC offset
    const defaultTimezone = 'UTC';
    
    // Apply immediate UTC override to prevent real timezone capture
    
    // Override getTimezoneOffset immediately but keep it reconfigurable
    const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
    Object.defineProperty(Date.prototype, 'getTimezoneOffset', {
        value: function() {
            return -defaultOffset;
        },
        writable: true,
        configurable: true // Allow later reconfiguration
    });
    
    // Override Intl.DateTimeFormat immediately
    if (window.Intl && window.Intl.DateTimeFormat && window.Intl.DateTimeFormat.prototype.resolvedOptions) {
        const originalResolvedOptions = window.Intl.DateTimeFormat.prototype.resolvedOptions;
        Object.defineProperty(window.Intl.DateTimeFormat.prototype, 'resolvedOptions', {
            value: function() {
                try {
                    const options = originalResolvedOptions.call(this) || {};
                    if (typeof options === 'object') {
                        options.timeZone = defaultTimezone;
                    }
                    return options;
                } catch (e) {
                    return { timeZone: defaultTimezone };
                }
            },
            writable: true,
            configurable: true // Allow later reconfiguration
        });
    }
    
    // Override Date constructor to ensure consistent timezone
    const originalDate = window.Date;
    const OriginalDateConstructor = originalDate;
    
    function SpoofedDate(...args) {
        if (args.length === 0) {
            // new Date() - current time
            const date = new OriginalDateConstructor();
            return date;
        } else {
            // new Date(value) or new Date(year, month, ...)
            return new OriginalDateConstructor(...args);
        }
    }
    
    // Copy all static methods and properties
    Object.setPrototypeOf(SpoofedDate, OriginalDateConstructor);
    Object.setPrototypeOf(SpoofedDate.prototype, OriginalDateConstructor.prototype);
    
    // Copy static methods
    SpoofedDate.now = OriginalDateConstructor.now;
    SpoofedDate.parse = OriginalDateConstructor.parse;
    SpoofedDate.UTC = OriginalDateConstructor.UTC;
    
    // Override window.Date
    try {
        Object.defineProperty(window, 'Date', {
            value: SpoofedDate,
            writable: true,
            configurable: true // Allow later reconfiguration
        });
    } catch (e) {
        console.warn('[KS Early Timezone] Could not override window.Date:', e);
    }
    
    // Early override applied
    
    // Mark that early override was applied
    window.__KS_TIMEZONE_EARLY_APPLIED__ = true;
})();
