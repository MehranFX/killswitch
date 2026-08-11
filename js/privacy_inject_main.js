// Privacy protections injection script for MAIN world
// This script runs in MAIN world via external script injection

(function() {
    'use strict';
    
    // Get geolocation data and protection settings from script src URL hash (passed by content script)
    const scriptElement = document.currentScript || document.querySelector('script[src*="privacy_inject_main.js"]');
    const scriptSrc = scriptElement ? scriptElement.src : '';
    const hashIndex = scriptSrc.indexOf('#');
    
    let spoofedLat = 38.7945952;  // Default: Denver, Colorado
    let spoofedLng = -106.5348379;
    
    // Parse protection settings from URL parameters
    const protectionSettings = {
        canvas: false,
        webgl: false,
        audio: false,
        font: false,
        screen: false,
        battery: false,
        memory: false,
        hardware: false,
        language: false
    };
    
    if (hashIndex !== -1) {
        const urlParams = new URLSearchParams(scriptSrc.substring(hashIndex + 1));
        const lat = parseFloat(urlParams.get('lat'));
        const lng = parseFloat(urlParams.get('lng'));
        if (!isNaN(lat) && !isNaN(lng)) {
            spoofedLat = lat;
            spoofedLng = lng;
        }
        
        // Read individual protection settings
        protectionSettings.canvas = urlParams.get('canvas') === '1';
        protectionSettings.webgl = urlParams.get('webgl') === '1';
        protectionSettings.audio = urlParams.get('audio') === '1';
        protectionSettings.font = urlParams.get('font') === '1';
        protectionSettings.screen = urlParams.get('screen') === '1';
        protectionSettings.battery = urlParams.get('battery') === '1';
        protectionSettings.memory = urlParams.get('memory') === '1';
        protectionSettings.hardware = urlParams.get('hardware') === '1';
        protectionSettings.language = urlParams.get('language') === '1';
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
                value: function(success, error, options) {
                    if (typeof success === 'function') {
                        setTimeout(() => {
                            try {
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
                            } catch (_) {}
                        }, Math.random() * 50 + 20);
                    } else if (typeof error === 'function') {
                        setTimeout(() => {
                            try {
                                error({ code: 1, message: 'User denied Geolocation' });
                            } catch (_) {}
                        }, 20);
                    }
                },
                writable: false,
                configurable: false
            });
            
            Object.defineProperty(navigator.geolocation, 'watchPosition', {
                value: function(success, error, options) {
                    if (typeof success === 'function') {
                        setTimeout(() => {
                            try {
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
                            } catch (_) {}
                        }, Math.random() * 50 + 20);
                    } else if (typeof error === 'function') {
                        setTimeout(() => {
                            try {
                                error({ code: 1, message: 'User denied Geolocation' });
                            } catch (_) {}
                        }, 20);
                    }
                    return Math.floor(Math.random() * 1000) + 1; // fake watchId
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
