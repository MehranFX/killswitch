// Privacy protections script for MAIN world
// Runs natively in MAIN world at document_start without DOM script tag injection

(function() {
    'use strict';

    if (window.__KS_PRIVACY_INJECT_APPLIED__) return;
    try {
        Object.defineProperty(window, '__KS_PRIVACY_INJECT_APPLIED__', {
            value: true,
            writable: false,
            enumerable: false,
            configurable: false
        });
    } catch (_) {
        window.__KS_PRIVACY_INJECT_APPLIED__ = true;
    }

    let spoofedLat = parseFloat(window.__ks_boot_lat__) || 44.8040074; // default / boot
    let spoofedLng = parseFloat(window.__ks_boot_lng__) || 20.4651257;

    const protectionSettings = {
        canvas: true,
        webgl: true,
        audio: true,
        font: true,
        screen: true,
        battery: true,
        memory: true,
        hardware: true,
        language: true
    };

    // 1. Force DNT
    try {
        Object.defineProperty(navigator, 'doNotTrack', {
            value: '1',
            writable: true,
            configurable: true
        });
    } catch (_) {}

    // 2. Geolocation Spoofing (always active in MAIN world)
    if (navigator.geolocation) {
        try {
            const spoofedGetCurrentPosition = function getCurrentPosition(success, error) {
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
                    }, Math.random() * 30 + 10);
                } else if (typeof error === 'function') {
                    setTimeout(() => {
                        try { error({ code: 1, message: 'User denied Geolocation' }); } catch (_) {}
                    }, 20);
                }
            };

            const spoofedWatchPosition = function watchPosition(success, error) {
                spoofedGetCurrentPosition(success, error);
                return Math.floor(Math.random() * 1000) + 1;
            };

            Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
                value: spoofedGetCurrentPosition,
                writable: true,
                configurable: true
            });

            Object.defineProperty(navigator.geolocation, 'watchPosition', {
                value: spoofedWatchPosition,
                writable: true,
                configurable: true
            });
        } catch (_) {}
    }

    function applyCanvas() {
        if (!window.HTMLCanvasElement) return;
        try {
            const addNoise = (imageData) => {
                if (!imageData || !imageData.data) return;
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + (Math.floor(Math.random() * 3) - 1)));
                }
            };

            if (window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype.getImageData) {
                const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
                CanvasRenderingContext2D.prototype.getImageData = function() {
                    const data = origGetImageData.apply(this, arguments);
                    addNoise(data);
                    return data;
                };
            }

            if (HTMLCanvasElement.prototype.toDataURL) {
                const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
                HTMLCanvasElement.prototype.toDataURL = function() {
                    try {
                        const ctx = this.getContext('2d');
                        if (ctx) {
                            const imgData = ctx.getImageData(0, 0, this.width, this.height);
                            ctx.putImageData(imgData, 0, 0);
                        }
                    } catch (_) {}
                    return origToDataURL.apply(this, arguments);
                };
            }
        } catch (_) {}
    }

    function applyAudio() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx && AudioCtx.prototype.createAnalyser) {
                const origCreateAnalyser = AudioCtx.prototype.createAnalyser;
                AudioCtx.prototype.createAnalyser = function() {
                    const analyser = origCreateAnalyser.apply(this, arguments);
                    const origGetFloat = analyser.getFloatFrequencyData;
                    if (origGetFloat) {
                        analyser.getFloatFrequencyData = function(arr) {
                            origGetFloat.apply(this, arguments);
                            for (let i = 0; i < arr.length; i += 2) {
                                arr[i] += (Math.random() - 0.5) * 0.05;
                            }
                        };
                    }
                    return analyser;
                };
            }
        } catch (_) {}
    }

    function applyScreen() {
        if (!window.screen) return;
        try {
            Object.defineProperty(screen, 'width', { value: 1920, configurable: true });
            Object.defineProperty(screen, 'height', { value: 1080, configurable: true });
            Object.defineProperty(screen, 'availWidth', { value: 1920, configurable: true });
            Object.defineProperty(screen, 'availHeight', { value: 1040, configurable: true });
            Object.defineProperty(screen, 'colorDepth', { value: 24, configurable: true });
            Object.defineProperty(screen, 'pixelDepth', { value: 24, configurable: true });
        } catch (_) {}
    }

    function applyBattery() {
        if (!navigator.getBattery) return;
        try {
            navigator.getBattery = function() {
                return Promise.resolve({
                    charging: true,
                    chargingTime: Infinity,
                    dischargingTime: Infinity,
                    level: 0.95
                });
            };
        } catch (_) {}
    }

    function applyMemory() {
        try {
            Object.defineProperty(navigator, 'deviceMemory', {
                value: 8,
                configurable: true
            });
        } catch (_) {}
    }

    function applyHardware() {
        try {
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                value: 8,
                configurable: true
            });
        } catch (_) {}
    }

    function applyLanguage() {
        try {
            const loc = window.__ks_boot_locale__ || 'en-US';
            const baseLang = loc.split('-')[0];
            const list = Array.from(new Set([loc, baseLang, 'en-US', 'en']));
            Object.defineProperty(navigator, 'language', { get: () => loc, configurable: true });
            Object.defineProperty(navigator, 'languages', { get: () => list, configurable: true });
        } catch (_) {}
    }

    // Apply baseline protections immediately
    applyCanvas();
    applyAudio();
    applyScreen();
    applyBattery();
    applyMemory();
    applyHardware();
    applyLanguage();

    // Listen for dynamic updates from ISOLATED world via CustomEvent (zero DOM script tags, immune to CSP)
    window.addEventListener('__ks_privacy_sync__', function(e) {
        try {
            const data = e.detail;
            if (!data) return;
            if (typeof data.lat === 'number') spoofedLat = data.lat;
            if (typeof data.lng === 'number') spoofedLng = data.lng;
            if (data.canvas) applyCanvas();
            if (data.audio) applyAudio();
            if (data.screen) applyScreen();
            if (data.battery) applyBattery();
            if (data.memory) applyMemory();
            if (data.hardware) applyHardware();
            if (data.language) applyLanguage();
        } catch (_) {}
    });

})();
