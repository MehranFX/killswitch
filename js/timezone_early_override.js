// Early timezone override to prevent clonedData capture
// This runs before any page scripts and immediately overrides Date APIs

(function() {
    'use strict';
    
    const originalResolvedOptions = (window.Intl && window.Intl.DateTimeFormat && window.Intl.DateTimeFormat.prototype.resolvedOptions)
        ? window.Intl.DateTimeFormat.prototype.resolvedOptions
        : null;

    function getActiveTimezone() {
        if (window.__ks_boot_tz__) {
            try { localStorage.setItem('__ks_cached_tz__', window.__ks_boot_tz__); } catch (_) {}
            return window.__ks_boot_tz__;
        }
        try {
            const cached = localStorage.getItem('__ks_cached_tz__');
            if (cached) return cached;
        } catch (_) {}
        return 'UTC';
    }

    function getTimezoneOffsetMinutes(tzName) {
        if (!tzName || tzName === 'UTC') return 0;
        try {
            const now = new Date();
            const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
            const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tzName }));
            return Math.round((utcDate.getTime() - tzDate.getTime()) / 60000);
        } catch (_) {
            return 0;
        }
    }
    
    // Override getTimezoneOffset dynamically but keep it reconfigurable
    Object.defineProperty(Date.prototype, 'getTimezoneOffset', {
        value: function() {
            const tz = getActiveTimezone();
            return getTimezoneOffsetMinutes(tz);
        },
        writable: true,
        configurable: true
    });

    // Override Date string representations to align with spoofed timezone
    const originalToTimeString = Date.prototype.toTimeString;
    Object.defineProperty(Date.prototype, 'toTimeString', {
        value: function() {
            try {
                const tz = getActiveTimezone();
                const formatted = this.toLocaleTimeString('en-US', { timeZone: tz, hour12: false });
                const offsetMin = getTimezoneOffsetMinutes(tz);
                const absOffset = Math.abs(offsetMin);
                const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
                const mins = String(absOffset % 60).padStart(2, '0');
                const sign = offsetMin <= 0 ? '+' : '-';
                return `${formatted} GMT${sign}${hours}${mins} (${tz})`;
            } catch (_) {
                return originalToTimeString.call(this);
            }
        },
        writable: true,
        configurable: true
    });
    
    // Override Intl.DateTimeFormat immediately
    if (window.Intl && window.Intl.DateTimeFormat && window.Intl.DateTimeFormat.prototype.resolvedOptions) {
        const originalResolvedOptions = window.Intl.DateTimeFormat.prototype.resolvedOptions;
        Object.defineProperty(window.Intl.DateTimeFormat.prototype, 'resolvedOptions', {
            value: function() {
                try {
                    const options = originalResolvedOptions.call(this) || {};
                    if (typeof options === 'object') {
                        options.timeZone = getActiveTimezone();
                    }
                    return options;
                } catch (e) {
                    return { timeZone: getActiveTimezone() };
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
        // Silently fail - some sites prevent this override
    }
    
    // Early override applied
    
    // Mark that early override was applied
    window.__KS_TIMEZONE_EARLY_APPLIED__ = true;
})();
