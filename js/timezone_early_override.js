// Early timezone override to prevent timezone leaks on first load
// Runs in MAIN world at document_start before any page scripts

(function() {
    'use strict';

    if (window.__KS_TIMEZONE_EARLY_APPLIED__) return;
    try {
        Object.defineProperty(window, '__KS_TIMEZONE_EARLY_APPLIED__', {
            value: true,
            writable: false,
            enumerable: false,
            configurable: false
        });
    } catch (_) {
        window.__KS_TIMEZONE_EARLY_APPLIED__ = true;
    }

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

    try {
        window.addEventListener('__ks_timezone_sync__', function(e) {
            try {
                if (e.detail && e.detail.timezone) {
                    window.__ks_boot_tz__ = e.detail.timezone;
                }
            } catch (_) {}
        });
    } catch (_) {}

    function getActiveTimezone() {
        if (window.__ks_boot_tz__) {
            return window.__ks_boot_tz__;
        }
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
    const origGetHours = OrigDate.prototype.getHours;
    const origGetMinutes = OrigDate.prototype.getMinutes;
    const origGetSeconds = OrigDate.prototype.getSeconds;
    const origGetDate = OrigDate.prototype.getDate;
    const origGetDay = OrigDate.prototype.getDay;
    const origGetMonth = OrigDate.prototype.getMonth;
    const origGetFullYear = OrigDate.prototype.getFullYear;
    const origToString = OrigDate.prototype.toString;
    const origToTimeString = OrigDate.prototype.toTimeString;
    const origToDateString = OrigDate.prototype.toDateString;
    const origToLocaleString = OrigDate.prototype.toLocaleString;
    const origToLocaleDateString = OrigDate.prototype.toLocaleDateString;
    const origToLocaleTimeString = OrigDate.prototype.toLocaleTimeString;

    const OrigDateTimeFormat = window.Intl ? window.Intl.DateTimeFormat : null;

    function getShiftedDate(dateObj, tzName) {
        try {
            const targetOffset = getTimezoneOffsetMinutes(tzName, dateObj);
            const hostOffset = origGetTimezoneOffset.call(dateObj);
            const diffMs = (hostOffset - targetOffset) * 60000;
            if (diffMs === 0) return dateObj;
            return new OrigDate(dateObj.getTime() - diffMs);
        } catch (_) {
            return dateObj;
        }
    }

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

    // 2. Date.prototype.getHours (aligned with spoofed timezone offset)
    const spoofedGetHours = function getHours() {
        const tz = getActiveTimezone();
        const shifted = getShiftedDate(this, tz);
        return origGetHours.call(shifted);
    };
    markAsNative(spoofedGetHours, origGetHours);
    Object.defineProperty(OrigDate.prototype, 'getHours', {
        value: spoofedGetHours,
        writable: true,
        configurable: true
    });

    // 3. Date.prototype.getMinutes
    const spoofedGetMinutes = function getMinutes() {
        const tz = getActiveTimezone();
        const shifted = getShiftedDate(this, tz);
        return origGetMinutes.call(shifted);
    };
    markAsNative(spoofedGetMinutes, origGetMinutes);
    Object.defineProperty(OrigDate.prototype, 'getMinutes', {
        value: spoofedGetMinutes,
        writable: true,
        configurable: true
    });

    // 4. Date.prototype.getDate
    const spoofedGetDate = function getDate() {
        const tz = getActiveTimezone();
        const shifted = getShiftedDate(this, tz);
        return origGetDate.call(shifted);
    };
    markAsNative(spoofedGetDate, origGetDate);
    Object.defineProperty(OrigDate.prototype, 'getDate', {
        value: spoofedGetDate,
        writable: true,
        configurable: true
    });

    // 5. Date.prototype.getDay
    const spoofedGetDay = function getDay() {
        const tz = getActiveTimezone();
        const shifted = getShiftedDate(this, tz);
        return origGetDay.call(shifted);
    };
    markAsNative(spoofedGetDay, origGetDay);
    Object.defineProperty(OrigDate.prototype, 'getDay', {
        value: spoofedGetDay,
        writable: true,
        configurable: true
    });

    // 6. Date.prototype.getMonth
    const spoofedGetMonth = function getMonth() {
        const tz = getActiveTimezone();
        const shifted = getShiftedDate(this, tz);
        return origGetMonth.call(shifted);
    };
    markAsNative(spoofedGetMonth, origGetMonth);
    Object.defineProperty(OrigDate.prototype, 'getMonth', {
        value: spoofedGetMonth,
        writable: true,
        configurable: true
    });

    // 7. Date.prototype.getFullYear
    const spoofedGetFullYear = function getFullYear() {
        const tz = getActiveTimezone();
        const shifted = getShiftedDate(this, tz);
        return origGetFullYear.call(shifted);
    };
    markAsNative(spoofedGetFullYear, origGetFullYear);
    Object.defineProperty(OrigDate.prototype, 'getFullYear', {
        value: spoofedGetFullYear,
        writable: true,
        configurable: true
    });

    // 8. Date.prototype.toString
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

    // 9. Date.prototype.toTimeString
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

    // 10. Date.prototype.toDateString
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

    // 11. Date.prototype.toLocaleString
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

    // 12. Date.prototype.toLocaleDateString
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

    // 13. Date.prototype.toLocaleTimeString
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

    // 14. Intl.DateTimeFormat Constructor & Prototype Override
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

        Object.defineProperty(SpoofedDateTimeFormat, 'name', {
            value: 'DateTimeFormat',
            writable: false,
            configurable: true
        });

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

        Object.defineProperty(OrigDateTimeFormat.prototype, 'constructor', {
            value: SpoofedDateTimeFormat,
            writable: true,
            configurable: true
        });

        markAsNative(SpoofedDateTimeFormat, OrigDateTimeFormat);

        try {
            window.Intl.DateTimeFormat = SpoofedDateTimeFormat;
        } catch (_) {}
    }
})();
