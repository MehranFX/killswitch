// Privacy protections injection script for MAIN world
// This script runs in MAIN world via external script injection

(function() {
    'use strict';
    
    // Get geolocation data from script src URL hash (passed by content script)
    const scriptElement = document.currentScript || document.querySelector('script[src*="privacy_inject_main.js"]');
    const scriptSrc = scriptElement ? scriptElement.src : '';
    const hashIndex = scriptSrc.indexOf('#');
    
    let spoofedLat = 38.7945952;  // Default: Denver, Colorado
    let spoofedLng = -106.5348379;
    
    if (hashIndex !== -1) {
        const urlParams = new URLSearchParams(scriptSrc.substring(hashIndex + 1));
        const lat = parseFloat(urlParams.get('lat'));
        const lng = parseFloat(urlParams.get('lng'));
        if (!isNaN(lat) && !isNaN(lng)) {
            spoofedLat = lat;
            spoofedLng = lng;
        }
    }
    
    // Applying privacy protections in MAIN world
    
    try {
        // Block cookieEnabled detection (set to true to avoid breaking auth flows)
        Object.defineProperty(navigator, 'cookieEnabled', {
            value: true,
            writable: false,
            configurable: false
        });
        
        // Force DNT
        try {
            Object.defineProperty(navigator, 'doNotTrack', {
                value: '1',
                writable: false,
                configurable: false
            });
        } catch (e) {
            // Fallback if property is not configurable
            try {
                navigator.doNotTrack = '1';
            } catch (e2) {
                // Cannot set doNotTrack
            }
        }
        
        // Block geolocation with spoofed coordinates
        if (navigator.geolocation) {
            
            Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
                value: function(success, error) {
                    if (success) {
                        setTimeout(() => {
                            success({
                                coords: {
                                    latitude: spoofedLat,
                                    longitude: spoofedLng,
                                    accuracy: 10,
                                    altitude: null,
                                    altitudeAccuracy: null,
                                    heading: null,
                                    speed: null
                                },
                                timestamp: Date.now()
                            });
                        }, Math.random() * 100 + 50);
                    }
                },
                writable: false,
                configurable: false
            });
            
            Object.defineProperty(navigator.geolocation, 'watchPosition', {
                value: function(success, error) {
                    if (success) {
                        setTimeout(() => {
                            success({
                                coords: {
                                    latitude: spoofedLat,
                                    longitude: spoofedLng,
                                    accuracy: 10,
                                    altitude: null,
                                    altitudeAccuracy: null,
                                    heading: null,
                                    speed: null
                                },
                                timestamp: Date.now()
                            });
                        }, Math.random() * 100 + 50);
                    }
                    return 1; // fake watchId
                },
                writable: false,
                configurable: false
            });
        }
        
        // Privacy protections applied successfully
    } catch (e) {
        console.error('[KS Privacy] Error applying protections:', e);
    }
})();
