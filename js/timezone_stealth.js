/**
 * Stealth Timezone Spoofing - Minimal interference with site functionality
 */

(function() {
    'use strict';
    
    // Timezone spoofing always active for privacy protection
    
    // Get timezone from background script boot values or storage
    let timezone = 'UTC'; // Neutral default
    let locale = 'en-US';
    let timezoneOffset = 0; // UTC offset
    
    // Check for boot values injected by background script
    if (window.__ks_boot_tz__) {
        timezone = window.__ks_boot_tz__;
    }
    if (window.__ks_boot_locale__) {
        locale = window.__ks_boot_locale__;
    }
    
    // If no boot values, try to get from storage
    if (timezone === 'UTC' && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
            chrome.storage.local.get(['current_timezone', 'timezone', 'current_locale', 'locale'], (data) => {
                const newTimezone = data.current_timezone || data.timezone || 'UTC';
                const newLocale = data.current_locale || data.locale || 'en-US';
                
                if (newTimezone !== timezone || newLocale !== locale) {
                    timezone = newTimezone;
                    locale = newLocale;
                updateTimezoneOffset();
                injectTimezoneSpoof(timezone, timezoneOffset); // Re-apply with new values
                }
            });
        } catch (e) {
            // Ignore storage errors
        }
    }
    
    // Function to calculate timezone offset from timezone string
    function updateTimezoneOffset() {
        if (timezone && timezone !== 'UTC') {
            try {
                // Create a date in the target timezone and compare with UTC
                const now = new Date();
                const utcTime = now.getTime();
                
                // Get the time in the target timezone
                const targetTimeString = now.toLocaleString('en-CA', { 
                    timeZone: timezone,
                    year: 'numeric',
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                
                // Parse the target time string back to a Date
                const [datePart, timePart] = targetTimeString.split(', ');
                const [year, month, day] = datePart.split('-');
                const [hour, minute, second] = timePart.split(':');
                
                const targetTime = new Date(year, month - 1, day, hour, minute, second);
                const utcDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 
                                        now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
                
                // Calculate offset in minutes
                timezoneOffset = Math.round((targetTime.getTime() - utcDate.getTime()) / 60000);
                
                // Calculate timezone offset
            } catch (e) {
                console.error('[KS Timezone] Error calculating offset:', e);
                timezoneOffset = 0;
            }
        } else {
            timezoneOffset = 0;
        }
    }
    
    // Initial calculation
    updateTimezoneOffset();
    
    // Prevent double patching
    if (window.__ks_simple_timezone_patched__) {
        return;
    }
    window.__ks_simple_timezone_patched__ = true;
    
    // Dispatch timezone spoofing update to MAIN world via CustomEvent without injecting DOM script elements
    function injectTimezoneSpoof(tz, offset) {
        try {
            window.dispatchEvent(new CustomEvent('__ks_timezone_sync__', {
                detail: { timezone: tz, offset: offset }
            }));
        } catch (e) {}
    }
    
    // Don't apply spoofing immediately with default UTC - wait for storage load
    // injectTimezoneSpoof(timezone, timezoneOffset);
    
    // Load timezone from storage and re-apply (async)
    async function loadAndApplyTimezone() {
        try {
            // Load timezone from storage
            
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                // Get timezone data from storage
                
                const data = await new Promise((resolve, reject) => {
                    chrome.storage.local.get(['current_timezone', 'timezone', 'current_locale', 'locale'], (result) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(result);
                        }
                    });
                });
                
                const newTimezone = data.current_timezone || data.timezone || 'UTC';
                const newLocale = data.current_locale || data.locale || 'en-US';
                
                // Load timezone data from storage
                
                // Always apply timezone from storage (even if same as default)
                timezone = newTimezone;
                locale = newLocale;
                updateTimezoneOffset();
                
                // Apply timezone from storage
                
                injectTimezoneSpoof(timezone, timezoneOffset); // Apply with correct values from storage
            } else {
                // Chrome storage not available - using defaults
            }
        } catch (e) {
            console.error('[KS Timezone] Error loading from storage:', e);
        }
    }
    
    // Check if early override was applied
    if (typeof window !== 'undefined' && window.__KS_TIMEZONE_EARLY_APPLIED__) {
        // Early override detected, waiting for storage then applying IP-based timezone
        // Wait a bit for DOM to be ready, then load and apply
        setTimeout(() => {
            loadAndApplyTimezone();
        }, 100);
    } else {
        // Early override not detected, applying immediate UTC spoofing
        // Apply immediate UTC spoofing as fallback
        injectTimezoneSpoof('UTC', 0);
        // Then load IP-based timezone
        loadAndApplyTimezone();
    }
    
    // Also retry after a short delay to catch IP updates during page load
    setTimeout(() => {
        loadAndApplyTimezone();
    }, 2000);
    
    // Listen for IP updates from background script
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'ipUpdated' || request.type === 'locationUpdated') {
                // Received IP update notification, reloading timezone
                loadAndApplyTimezone();
                if (sendResponse) sendResponse({ success: true });
            }
        });
    }
    
    // Listen for settings updates from background script
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'updateTimezone') {
                timezone = request.timezone || 'UTC';
                locale = request.locale || 'en-US';
                timezoneOffset = request.timezoneOffset || 0;
                // Re-apply with new settings
                applyMinimalTimezoneSpoof();
                sendResponse({ success: true });
            }
        });
    }
})();
