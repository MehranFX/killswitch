/**
 * Simple Timezone Spoofing - Runs in MAIN world at document_start
 */

(function() {
    'use strict';
    
    // Log removed
    
    // Default timezone settings (will be overridden by background)
    let timezone = 'UTC'; // Neutral default
    let locale = 'en-US';
    let timezoneOffset = 0; // UTC offset
    
    // Prevent double patching
    if (window.__ks_simple_timezone_patched__) {
        return;
    }
    window.__ks_simple_timezone_patched__ = true;
    
    // Function to apply simple timezone spoofing
    function applySimpleTimezoneSpoofing() {
        // Log removed
        
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
            
            // Compute offset for arbitrary timestamps in spoofed timezone (DST-aware)
            function computeOffsetForTime(timeInMs) {
                try {
                    const nowLocal = new OriginalDate(timeInMs);
                    const utcRef = new OriginalDate(nowLocal.getTime() + (nowLocal.getTimezoneOffset() * 60000));
                    const spoofedRef = new OriginalDate(utcRef.toLocaleString('en-US', { timeZone: timezone }));
                    return Math.round((spoofedRef.getTime() - utcRef.getTime()) / 60000);
                } catch (_) {
                    return timezoneOffset; // fallback
                }
            }

            // Override getTimezoneOffset (DST-aware per-instance)
            window.Date.prototype.getTimezoneOffset = function() {
                return -computeOffsetForTime(OriginalDate.prototype.getTime.call(this));
            };
            
            // Override toString methods
            window.Date.prototype.toString = function() {
                const currentOffset = computeOffsetForTime(OriginalDate.prototype.getTime.call(this));
                const str = OriginalDate.prototype.toString.call(this);
                const sign = currentOffset >= 0 ? '+' : '';
                const hh = Math.floor(currentOffset/60).toString().padStart(2,'0');
                const mm = Math.abs(currentOffset%60).toString().padStart(2,'0');
                return str.replace(/GMT[+-]\d{4}/, `GMT${sign}${hh}${mm}`);
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
                
                // Ensure resolvedOptions reports our timezone
                try {
                    const proto = OriginalDateTimeFormat.prototype;
                    if (proto && proto.resolvedOptions) {
                        const originalResolved = proto.resolvedOptions;
                        proto.resolvedOptions = function() {
                            const r = originalResolved.call(this) || {};
                            r.timeZone = timezone;
                            return r;
                        };
                    }
                } catch (_) {}
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
            
            // Override iframe contentWindow to prevent sandbox attacks
            try {
                // 1) Patch future iframes created via createElement
                const originalCreateElement = document.createElement;
                document.createElement = function(tagName) {
                    const element = originalCreateElement.call(this, tagName);
                    if (tagName.toLowerCase() === 'iframe') {
                        const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
                        if (originalContentWindow) {
                            Object.defineProperty(element, 'contentWindow', {
                                get: function() {
                                    const win = originalContentWindow.get.call(this);
                                    try {
                                        if (win && win.Date) {
                                            win.Date = window.Date;
                                            win.Date.now = window.Date.now;
                                            win.Date.parse = window.Date.parse;
                                            win.Date.UTC = window.Date.UTC;
                                            win.Date.prototype = window.Date.prototype;
                                            if (win.Intl && win.Intl.DateTimeFormat) {
                                                // Ensure Intl shares the spoofed behavior
                                                win.Intl.DateTimeFormat = window.Intl.DateTimeFormat;
                                            }
                                        }
                                    } catch (_) {}
                                    return win;
                                },
                                configurable: true
                            });
                        }
                    }
                    return element;
                };

                // 2) Also patch the prototype getter so even existing iframes get fixed on access
                const protoCW = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
                if (protoCW && protoCW.configurable && typeof protoCW.get === 'function') {
                    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
                        get: function() {
                            const win = protoCW.get.call(this);
                            try {
                                if (win && win.Date) {
                                    win.Date = window.Date;
                                    win.Date.now = window.Date.now;
                                    win.Date.parse = window.Date.parse;
                                    win.Date.UTC = window.Date.UTC;
                                    win.Date.prototype = window.Date.prototype;
                                    if (win.Intl && win.Intl.DateTimeFormat) {
                                        win.Intl.DateTimeFormat = window.Intl.DateTimeFormat;
                                    }
                                }
                            } catch (_) {}
                            return win;
                        },
                        configurable: true
                    });
                }
            } catch (e) {
                // Log removed
            }
            
            // Override eval and Function constructor to prevent dynamic code execution
            try {
                const originalEval = window.eval;
                window.eval = function(code) {
                    // Replace timezone-related code with spoofed values
                    if (typeof code === 'string') {
                        code = code.replace(/new\s+Date\(\)/g, 'new Date()');
                        code = code.replace(/Date\.now\(\)/g, 'Date.now()');
                        code = code.replace(/\.getTimezoneOffset\(\)/g, '.getTimezoneOffset()');
                    }
                    return originalEval.call(this, code);
                };
            } catch (e) {
                // Log removed
            }
            
            try {
                const originalFunction = window.Function;
                window.Function = function(...args) {
                    const code = args[args.length - 1];
                    if (typeof code === 'string') {
                        // Replace timezone-related code with spoofed values
                        const modifiedCode = code.replace(/new\s+Date\(\)/g, 'new Date()')
                                               .replace(/Date\.now\(\)/g, 'Date.now()')
                                               .replace(/\.getTimezoneOffset\(\)/g, '.getTimezoneOffset()');
                        args[args.length - 1] = modifiedCode;
                    }
                    return originalFunction.apply(this, args);
                };
            } catch (e) {
                // Log removed
            }
            
            // Log removed
            
        } catch (e) {
            // Error removed
        }
    }
    
    // Apply spoofing immediately (use boot values if present)
    try {
        if (window.__ks_boot_tz__) {
            timezone = window.__ks_boot_tz__;
        }
        if (window.__ks_boot_locale__) {
            locale = window.__ks_boot_locale__;
        }
    } catch (_) {}
    applySimpleTimezoneSpoofing();
    
    // Try to get from background script immediately
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'getTimezoneSettings' }, (response) => {
                if (response && response.success && response.timezone) {
                    timezone = response.timezone;
                    locale = response.locale || 'en-US';
                    timezoneOffset = response.timezoneOffset || 0;
                    
                    // Log removed
                    applySimpleTimezoneSpoofing();
                } else {
                    // Log removed
                }
            });
        }
    } catch (e) {
        // Log removed
    }
    
    // Get settings from background with retry mechanism
    let retryCount = 0;
    const maxRetries = 50; // 5 seconds max
    
    function getTimezoneSettings() {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({ type: 'getTimezoneSettings' }, (response) => {
                    // Log removed
                    
                    if (response && response.success && response.timezone) {
                        timezone = response.timezone;
                        locale = response.locale || 'en-US';
                        timezoneOffset = response.timezoneOffset || 0;
                        
                        // Log removed
                        applySimpleTimezoneSpoofing();
                    } else {
                        retryCount++;
                        if (retryCount < maxRetries) {
                            // Log removed
                            setTimeout(getTimezoneSettings, 100);
                        } else {
                            // Log removed
                        }
                    }
                });
            } else {
                retryCount++;
                if (retryCount < maxRetries) {
                    // Log removed
                    setTimeout(getTimezoneSettings, 100);
                } else {
                    // Log removed
                }
            }
        } catch (e) {
            retryCount++;
            if (retryCount < maxRetries) {
                // Log removed
                setTimeout(getTimezoneSettings, 100);
            } else {
                // Log removed
            }
        }
    }
    
    // Start getting settings
    getTimezoneSettings();
    
    // Listen for updates
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'updateTimezone') {
            timezone = event.data.timezone || timezone;
            locale = event.data.locale || locale;
            timezoneOffset = event.data.timezoneOffset || timezoneOffset;
            // Log removed
            applySimpleTimezoneSpoofing();
        }
    });
    
    // Also listen for storage changes via postMessage
    window.addEventListener('storage', function(event) {
        if (event.key === 'current_timezone' || event.key === 'current_locale') {
            // Log removed
            // Request update from background
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({ type: 'getTimezoneSettings' }, (response) => {
                    if (response && response.success && response.timezone) {
                        timezone = response.timezone;
                        locale = response.locale || 'en-US';
                        timezoneOffset = response.timezoneOffset || 0;
                        // Log removed
                        applySimpleTimezoneSpoofing();
                    }
                });
            }
        }
    });
    
    // Expose an update hook so background can push new tz/locale live
    try {
        window.updateEarlyTimezoneSpoofing = function(newTimezone, newLocale) {
            try {
                if (newTimezone) { timezone = newTimezone; }
                if (newLocale) { locale = newLocale; }
                // Log removed
                // Re-apply overrides so any closures pick up the new values
                applySimpleTimezoneSpoofing();
            } catch (e) {
                // Warning removed
            }
        };
    } catch (e) {
        // Warning removed
    }
    
    // Log removed
    
})();