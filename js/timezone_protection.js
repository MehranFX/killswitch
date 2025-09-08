"use strict";

/**
 * Timezone Protection Content Script
 * Protects against aggressive timezone detection methods
 */

(function() {
    'use strict';
    
    // Always enable timezone protection
    initializeProtection();
    
    function initializeProtection() {
        console.log('🛡️ Timezone Protection: Initializing...');
        
        // Block Performance API timing-based detection
        if (window.performance) {
            try {
                Object.defineProperty(window, 'performance', {
                    value: undefined,
                    writable: false,
                    configurable: false
                });
                console.log('🛡️ Blocked Performance API');
            } catch (e) {
                console.log('⚠️ Could not block Performance API:', e.message);
            }
        }
        
        // Block Web Workers (aggressive detection method)
        try {
            window.Worker = undefined;
            window.SharedWorker = undefined;
            console.log('🛡️ Blocked Web Workers');
        } catch (e) {
            console.log('⚠️ Could not block Web Workers:', e.message);
        }
        
        // Block Service Workers (aggressive detection method)
        if (navigator.serviceWorker) {
            try {
                Object.defineProperty(navigator, 'serviceWorker', {
                    value: undefined,
                    writable: false,
                    configurable: false
                });
                console.log('🛡️ Blocked Service Workers');
            } catch (e) {
                console.log('⚠️ Could not block Service Workers:', e.message);
            }
        }
        
        // Override fetch to prevent timing-based detection
        const originalFetch = window.fetch;
        if (originalFetch) {
            window.fetch = function(...args) {
                // Add random delay to prevent timing analysis
                const delay = Math.random() * 50 + 10; // 10-60ms random delay
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve(originalFetch.apply(this, args));
                    }, delay);
                });
            };
            console.log('🛡️ Protected fetch with random delays');
        }
        
        // Block timing-based detection via setTimeout/setInterval
        const originalSetTimeout = window.setTimeout;
        const originalSetInterval = window.setInterval;
        
        window.setTimeout = function(callback, delay, ...args) {
            // Add small random variation to prevent timing analysis
            const variation = Math.random() * 10 - 5; // -5 to +5ms variation
            return originalSetTimeout(callback, delay + variation, ...args);
        };
        
        window.setInterval = function(callback, delay, ...args) {
            // Add small random variation to prevent timing analysis
            const variation = Math.random() * 10 - 5; // -5 to +5ms variation
            return originalSetInterval(callback, delay + variation, ...args);
        };
        
        console.log('🛡️ Protected setTimeout/setInterval with timing variations');
        
        // Block Date.now() timing analysis
        const originalDateNow = Date.now;
        Date.now = function() {
            // Add small random variation
            const variation = Math.random() * 2 - 1; // -1 to +1ms variation
            return originalDateNow() + variation;
        };
        
        console.log('🛡️ Protected Date.now() with timing variations');
        
        // Block performance.now() if still accessible
        if (window.performance && window.performance.now) {
            try {
                Object.defineProperty(window.performance, 'now', {
                    value: function() {
                        // Return spoofed time
                        return Math.random() * 1000;
                    },
                    writable: false,
                    configurable: false
                });
                console.log('🛡️ Blocked performance.now()');
            } catch (e) {
                console.log('⚠️ Could not block performance.now():', e.message);
            }
        }
        
        console.log('✅ Timezone Protection: Initialized successfully');
    }
    
})();
