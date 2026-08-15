// Early timezone override to prevent timezone leaks on first load
// Runs in MAIN world at document_start before any page scripts

(function() {
    'use strict';

    if (window.__KS_TIMEZONE_EARLY_APPLIED__) return;
    window.__KS_TIMEZONE_EARLY_APPLIED__ = true;

    // Stealth Function.prototype.toString wrapper to hide monkey-patching from CreepJS / FingerprintJS
    const origFnToString = Function.prototype.toString;
    const patchedFnMap = new WeakMap();

    function markAsNative(targetFn, originalFnOrName) {
        try {
            let nativeString = '';
            if (typeof originalFnOrName === 'function') {
                nativeString = origFnToString.call(originalFnOrName);
            } else if (typeof originalFnOrName === 'string') {
                nativeString = `function ${originalFnOrName}() { [native code] }`;
            }
            if (nativeString) {
                patchedFnMap.set(targetFn, nativeString);
            }
        } catch (_) {}
    }

    try {
        const spoofedFnToString = function toString() {
            if (patchedFnMap.has(this)) {
                return patchedFnMap.get(this);
            }
            return origFnToString.call(this);
        };
        markAsNative(spoofedFnToString, origFnToString);
        Object.defineProperty(Function.prototype, 'toString', {
            value: spoofedFnToString,
            writable: true,
            configurable: true
        });
    } catch (_) {}

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

    function getTimezoneOffsetMinutes(tzName, date = new Date()) {
        if (!tzName || tzName === 'UTC') return 0;
        try {
            const utcStr = origToLocaleString.call(date, 'en-US', { timeZone: 'UTC' });
            const tzStr = origToLocaleString.call(date, 'en-US', { timeZone: tzName });
            const utcDate = new OrigDate(utcStr);
            const tzDate = new OrigDate(tzStr);
            return Math.round((utcDate.getTime() - tzDate.getTime()) / 60000);
        } catch (_) {
            return 0;
        }
    }

    function getFormattedDateParts(dateObj, tzName) {
        const formatter = new OrigDateTimeFormat('en-US', {
            timeZone: tzName,
            weekday: 'short',
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZoneName: 'long'
        });
        const parts = {};
        formatter.formatToParts(dateObj).forEach(p => parts[p.type] = p.value);
        return parts;
    }

    function formatFullDateString(dateObj, tzName) {
        try {
            const offsetMin = getTimezoneOffsetMinutes(tzName, dateObj);
            const absOffset = Math.abs(offsetMin);
            const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
            const mins = String(absOffset % 60).padStart(2, '0');
            const sign = offsetMin <= 0 ? '+' : '-';
            const gmtOffsetStr = `GMT${sign}${hours}${mins}`;

            const parts = getFormattedDateParts(dateObj, tzName);
            const timeStr = `${parts.hour}:${parts.minute}:${parts.second}`;
            const dateStr = `${parts.weekday} ${parts.month} ${parts.day} ${parts.year}`;
            const tzNameLong = parts.timeZoneName || tzName;

            return `${dateStr} ${timeStr} ${gmtOffsetStr} (${tzNameLong})`;
        } catch (_) {
            return origToString.call(dateObj);
        }
    }

    function formatTimeString(dateObj, tzName) {
        try {
            const offsetMin = getTimezoneOffsetMinutes(tzName, dateObj);
            const absOffset = Math.abs(offsetMin);
            const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
            const mins = String(absOffset % 60).padStart(2, '0');
            const sign = offsetMin <= 0 ? '+' : '-';
            const gmtOffsetStr = `GMT${sign}${hours}${mins}`;

            const parts = getFormattedDateParts(dateObj, tzName);
            const timeStr = `${parts.hour}:${parts.minute}:${parts.second}`;
            const tzNameLong = parts.timeZoneName || tzName;

            return `${timeStr} ${gmtOffsetStr} (${tzNameLong})`;
        } catch (_) {
            return origToTimeString.call(dateObj);
        }
    }

    function formatDateString(dateObj, tzName) {
        try {
            const parts = getFormattedDateParts(dateObj, tzName);
            return `${parts.weekday} ${parts.month} ${parts.day} ${parts.year}`;
        } catch (_) {
            return origToDateString.call(dateObj);
        }
    }

    // Preserve original Date & Intl prototype methods
    const OrigDate = window.Date;
    const origGetTimezoneOffset = OrigDate.prototype.getTimezoneOffset;
    const origToString = OrigDate.prototype.toString;
    const origToTimeString = OrigDate.prototype.toTimeString;
    const origToDateString = OrigDate.prototype.toDateString;
    const origToLocaleString = OrigDate.prototype.toLocaleString;
    const origToLocaleDateString = OrigDate.prototype.toLocaleDateString;
    const origToLocaleTimeString = OrigDate.prototype.toLocaleTimeString;

    const OrigDateTimeFormat = window.Intl ? window.Intl.DateTimeFormat : null;

    // 1. Date.prototype.getTimezoneOffset
    const spoofedGetTimezoneOffset = function getTimezoneOffset() {
        const tz = getActiveTimezone();
        return getTimezoneOffsetMinutes(tz, this);
    };
    markAsNative(spoofedGetTimezoneOffset, origGetTimezoneOffset);
    Object.defineProperty(OrigDate.prototype, 'getTimezoneOffset', {
        value: spoofedGetTimezoneOffset,
        writable: true,
        configurable: true
    });

    // 2. Date.prototype.toString
    const spoofedToString = function toString() {
        const tz = getActiveTimezone();
        return formatFullDateString(this, tz);
    };
    markAsNative(spoofedToString, origToString);
    Object.defineProperty(OrigDate.prototype, 'toString', {
        value: spoofedToString,
        writable: true,
        configurable: true
    });

    // 3. Date.prototype.toTimeString
    const spoofedToTimeString = function toTimeString() {
        const tz = getActiveTimezone();
        return formatTimeString(this, tz);
    };
    markAsNative(spoofedToTimeString, origToTimeString);
    Object.defineProperty(OrigDate.prototype, 'toTimeString', {
        value: spoofedToTimeString,
        writable: true,
        configurable: true
    });

    // 4. Date.prototype.toDateString
    const spoofedToDateString = function toDateString() {
        const tz = getActiveTimezone();
        return formatDateString(this, tz);
    };
    markAsNative(spoofedToDateString, origToDateString);
    Object.defineProperty(OrigDate.prototype, 'toDateString', {
        value: spoofedToDateString,
        writable: true,
        configurable: true
    });

    // 5. Date.prototype.toLocaleString
    const spoofedToLocaleString = function toLocaleString(locales, options) {
        const opts = options ? Object.assign({}, options) : {};
        if (!opts.timeZone) {
            opts.timeZone = getActiveTimezone();
        }
        return origToLocaleString.call(this, locales, opts);
    };
    markAsNative(spoofedToLocaleString, origToLocaleString);
    Object.defineProperty(OrigDate.prototype, 'toLocaleString', {
        value: spoofedToLocaleString,
        writable: true,
        configurable: true
    });

    // 6. Date.prototype.toLocaleDateString
    const spoofedToLocaleDateString = function toLocaleDateString(locales, options) {
        const opts = options ? Object.assign({}, options) : {};
        if (!opts.timeZone) {
            opts.timeZone = getActiveTimezone();
        }
        return origToLocaleDateString.call(this, locales, opts);
    };
    markAsNative(spoofedToLocaleDateString, origToLocaleDateString);
    Object.defineProperty(OrigDate.prototype, 'toLocaleDateString', {
        value: spoofedToLocaleDateString,
        writable: true,
        configurable: true
    });

    // 7. Date.prototype.toLocaleTimeString
    const spoofedToLocaleTimeString = function toLocaleTimeString(locales, options) {
        const opts = options ? Object.assign({}, options) : {};
        if (!opts.timeZone) {
            opts.timeZone = getActiveTimezone();
        }
        return origToLocaleTimeString.call(this, locales, opts);
    };
    markAsNative(spoofedToLocaleTimeString, origToLocaleTimeString);
    Object.defineProperty(OrigDate.prototype, 'toLocaleTimeString', {
        value: spoofedToLocaleTimeString,
        writable: true,
        configurable: true
    });

    // 8. Intl.DateTimeFormat Constructor & Prototype Override
    if (OrigDateTimeFormat) {
        const origResolvedOptions = OrigDateTimeFormat.prototype.resolvedOptions;

        function SpoofedDateTimeFormat(locales, options) {
            const opts = options ? Object.assign({}, options) : {};
            if (!opts.timeZone) {
                opts.timeZone = getActiveTimezone();
            }
            return new OrigDateTimeFormat(locales, opts);
        }

        SpoofedDateTimeFormat.prototype = OrigDateTimeFormat.prototype;
        if (OrigDateTimeFormat.supportedLocalesOf) {
            SpoofedDateTimeFormat.supportedLocalesOf = OrigDateTimeFormat.supportedLocalesOf;
        }

        const spoofedResolvedOptions = function resolvedOptions() {
            const res = origResolvedOptions.call(this);
            if (res && typeof res === 'object') {
                res.timeZone = getActiveTimezone();
            }
            return res;
        };
        markAsNative(spoofedResolvedOptions, origResolvedOptions);

        Object.defineProperty(OrigDateTimeFormat.prototype, 'resolvedOptions', {
            value: spoofedResolvedOptions,
            writable: true,
            configurable: true
        });

        markAsNative(SpoofedDateTimeFormat, OrigDateTimeFormat);

        try {
            window.Intl.DateTimeFormat = SpoofedDateTimeFormat;
        } catch (_) {}
    }
})();
