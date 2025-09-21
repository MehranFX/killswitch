// This script runs in MAIN world via external script injection
(function() {
    'use strict';
    
    // Get timezone data from script src URL hash (passed by content script)
    const scriptElement = document.currentScript || document.querySelector('script[src*="timezone_inject_main.js"]');
    const scriptSrc = scriptElement ? scriptElement.src : '';
    const hashIndex = scriptSrc.indexOf('#');
    
    let timezone = 'UTC';
    let offset = 0;
    
    if (hashIndex !== -1) {
        const urlParams = new URLSearchParams(scriptSrc.substring(hashIndex + 1));
        timezone = urlParams.get('tz') || 'UTC';
        offset = parseInt(urlParams.get('offset') || '0');
    }
    
    // External script received
    
           try {
               // Check if this is reconfiguring from early override
               const wasEarlyApplied = window.__KS_TIMEZONE_EARLY_APPLIED__;
               const currentOffset = new Date().getTimezoneOffset();
               
               if (currentOffset === -offset && timezone !== 'UTC') {
                   // Timezone already correctly applied, skipping
                   return;
               }
        
               // Override getTimezoneOffset globally (including in frames)
               const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
               const spoofedGetTimezoneOffset = function() {
                   return -offset;
               };
               
               try {
                   // First try to delete the existing property if it exists and is configurable
                   const descriptor = Object.getOwnPropertyDescriptor(Date.prototype, 'getTimezoneOffset');
                   if (descriptor && descriptor.configurable) {
                       delete Date.prototype.getTimezoneOffset;
                   }
                   
                   Object.defineProperty(Date.prototype, 'getTimezoneOffset', {
                       value: spoofedGetTimezoneOffset,
                       writable: true,
                       configurable: true
                   });
                   // Successfully overrode getTimezoneOffset
               } catch (e) {
                   // If can't override, try direct assignment
                   try {
                       Date.prototype.getTimezoneOffset = spoofedGetTimezoneOffset;
                       // Used direct assignment for getTimezoneOffset
                   } catch (e2) {
                       // Silently fail - some sites like Google prevent this override
                   }
               }
               
               // Also override for iframe contexts by intercepting iframe creation
               const originalCreateElement = document.createElement;
               document.createElement = function(tagName) {
                   const element = originalCreateElement.call(this, tagName);
                   if (tagName.toLowerCase() === 'iframe') {
                       const originalOnLoad = element.onload;
                       element.onload = function() {
                           try {
                               const frameWindow = element.contentWindow;
                               const frameDocument = element.contentDocument;
                               if (frameWindow && frameDocument && frameWindow.Date && frameWindow.Date.prototype) {
                                   Object.defineProperty(frameWindow.Date.prototype, 'getTimezoneOffset', {
                                       value: spoofedGetTimezoneOffset,
                                       writable: false,
                                       configurable: false
                                   });
                                   // Applied spoofing to iframe
                               }
                           } catch (e) {
                               // Cross-origin or other access restrictions
                           }
                           if (originalOnLoad) originalOnLoad.call(this);
                       };
                   }
                   return element;
               };
        
        // Override Intl timezone detection
        if (window.Intl && window.Intl.DateTimeFormat && window.Intl.DateTimeFormat.prototype.resolvedOptions) {
            const originalResolvedOptions = window.Intl.DateTimeFormat.prototype.resolvedOptions;
            
            try {
                // First try to delete the existing property if it exists and is configurable
                const descriptor = Object.getOwnPropertyDescriptor(window.Intl.DateTimeFormat.prototype, 'resolvedOptions');
                if (descriptor && descriptor.configurable) {
                    delete window.Intl.DateTimeFormat.prototype.resolvedOptions;
                }
                
                Object.defineProperty(window.Intl.DateTimeFormat.prototype, 'resolvedOptions', {
                    value: function() {
                        try {
                            const options = originalResolvedOptions.call(this) || {};
                            if (typeof options === 'object') {
                                options.timeZone = timezone;
                            }
                            return options;
                        } catch (e) {
                            return { timeZone: timezone };
                        }
                    },
                    writable: true,
                    configurable: true
                });
                // Successfully overrode Intl.DateTimeFormat.resolvedOptions
            } catch (e) {
                // Silently fail - some sites prevent this override
            }
        }
        
        // Successfully applied in MAIN world
    } catch (e) {
        console.error('[KS Timezone] Error in MAIN world:', e);
    }
})();
