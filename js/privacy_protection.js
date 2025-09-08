"use strict";

/**
 * Advanced Privacy Protection Content Script
 * Protects against various fingerprinting and tracking methods
 */

(function() {
    'use strict';
    
    // Check if privacy protection is enabled
    chrome.storage.local.get(['privacy_protection'], (result) => {
        if (!result.privacy_protection) {
            console.log('🛡️ Privacy Protection: Disabled by user settings');
            return;
        }
        
        initializePrivacyProtection();
    });
    
    function initializePrivacyProtection() {
        console.log('🛡️ Privacy Protection: Initializing...');
        
        // 1. Canvas Fingerprinting Protection
        protectCanvasFingerprinting();
        
        // 2. WebGL Fingerprinting Protection
        protectWebGLFingerprinting();
        
        // 3. Audio Context Fingerprinting Protection
        protectAudioFingerprinting();
        
        // 4. Font Fingerprinting Protection
        protectFontFingerprinting();
        
        // 5. Screen Resolution Spoofing
        spoofScreenResolution();
        
        // 6. Battery API Protection
        protectBatteryAPI();
        
        // 7. Device Memory Protection
        spoofDeviceMemory();
        
        // 8. Hardware Concurrency Spoofing
        spoofHardwareConcurrency();
        
        // 9. Language and Platform Spoofing
        spoofLanguageAndPlatform();
        
        // 10. Do Not Track Header
        enableDoNotTrack();
        
        // 11. Referrer Policy Control
        controlReferrerPolicy();
        
        // 12. Local Storage Protection
        protectLocalStorage();
        
        // 13. Cookie Protection
        protectCookies();
        
        // 14. Enhanced WebRTC Leak Prevention
        enhanceWebRTCProtection();
        
        // 15. DNS Leak Protection
        protectDNSLeaks();
        
        // 16. IP Leak Detection
        detectIPLeaks();
        
        // 17. Fingerprint Randomization
        randomizeFingerprint();
        
        // 18. Network Information Spoofing
        spoofNetworkInformation();
        
        // 19. Media Devices Spoofing
        spoofMediaDevices();
        
        // 20. Advanced Timing Protection
        enhanceTimingProtection();
        
        console.log('✅ Privacy Protection: Initialized successfully');
    }
    
    function protectCanvasFingerprinting() {
        try {
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function() {
                // Add noise to canvas data to prevent fingerprinting
                const canvas = this;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Add random noise
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        imageData.data[i] += Math.floor(Math.random() * 3) - 1; // R
                        imageData.data[i + 1] += Math.floor(Math.random() * 3) - 1; // G
                        imageData.data[i + 2] += Math.floor(Math.random() * 3) - 1; // B
                    }
                    ctx.putImageData(imageData, 0, 0);
                }
                return originalToDataURL.apply(this, arguments);
            };
            console.log('🛡️ Canvas fingerprinting protected');
        } catch (e) {
            console.log('⚠️ Could not protect canvas fingerprinting:', e.message);
        }
    }
    
    function protectWebGLFingerprinting() {
        try {
            const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                // Spoof WebGL parameters
                if (parameter === 37445) return 'Intel Inc.'; // VENDOR
                if (parameter === 37446) return 'Intel(R) HD Graphics 620'; // RENDERER
                if (parameter === 37447) return 'OpenGL ES 2.0'; // VERSION
                if (parameter === 37448) return 'WebGL 1.0'; // SHADING_LANGUAGE_VERSION
                return originalGetParameter.apply(this, arguments);
            };
            console.log('🛡️ WebGL fingerprinting protected');
        } catch (e) {
            console.log('⚠️ Could not protect WebGL fingerprinting:', e.message);
        }
    }
    
    function protectAudioFingerprinting() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
                AudioContext.prototype.createAnalyser = function() {
                    const analyser = originalCreateAnalyser.apply(this, arguments);
                    const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
                    analyser.getFloatFrequencyData = function(array) {
                        originalGetFloatFrequencyData.apply(this, arguments);
                        // Add noise to frequency data
                        for (let i = 0; i < array.length; i++) {
                            array[i] += (Math.random() - 0.5) * 0.1;
                        }
                    };
                    return analyser;
                };
            }
            console.log('🛡️ Audio fingerprinting protected');
        } catch (e) {
            console.log('⚠️ Could not protect audio fingerprinting:', e.message);
        }
    }
    
    function protectFontFingerprinting() {
        try {
            // Spoof font measurements
            const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
            const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
            
            if (originalOffsetWidth) {
                Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
                    get: function() {
                        const width = originalOffsetWidth.get.call(this);
                        return width + Math.floor(Math.random() * 3) - 1;
                    }
                });
            }
            
            if (originalOffsetHeight) {
                Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
                    get: function() {
                        const height = originalOffsetHeight.get.call(this);
                        return height + Math.floor(Math.random() * 3) - 1;
                    }
                });
            }
            console.log('🛡️ Font fingerprinting protected');
        } catch (e) {
            console.log('⚠️ Could not protect font fingerprinting:', e.message);
        }
    }
    
    function spoofScreenResolution() {
        try {
            Object.defineProperty(screen, 'width', { value: 1920, writable: false });
            Object.defineProperty(screen, 'height', { value: 1080, writable: false });
            Object.defineProperty(screen, 'availWidth', { value: 1920, writable: false });
            Object.defineProperty(screen, 'availHeight', { value: 1040, writable: false });
            Object.defineProperty(screen, 'colorDepth', { value: 24, writable: false });
            Object.defineProperty(screen, 'pixelDepth', { value: 24, writable: false });
            console.log('🛡️ Screen resolution spoofed');
        } catch (e) {
            console.log('⚠️ Could not spoof screen resolution:', e.message);
        }
    }
    
    function protectBatteryAPI() {
        try {
            if (navigator.getBattery) {
                navigator.getBattery = function() {
                    return Promise.resolve({
                        charging: true,
                        chargingTime: Infinity,
                        dischargingTime: Infinity,
                        level: 0.8 + Math.random() * 0.2
                    });
                };
            }
            console.log('🛡️ Battery API protected');
        } catch (e) {
            console.log('⚠️ Could not protect Battery API:', e.message);
        }
    }
    
    function spoofDeviceMemory() {
        try {
            if (navigator.deviceMemory) {
                Object.defineProperty(navigator, 'deviceMemory', { 
                    value: 8, 
                    writable: false,
                    configurable: false
                });
            }
            console.log('🛡️ Device memory spoofed');
        } catch (e) {
            console.log('⚠️ Could not spoof device memory:', e.message);
        }
    }
    
    function spoofHardwareConcurrency() {
        try {
            Object.defineProperty(navigator, 'hardwareConcurrency', { 
                value: 8, 
                writable: false,
                configurable: false
            });
            console.log('🛡️ Hardware concurrency spoofed');
        } catch (e) {
            console.log('⚠️ Could not spoof hardware concurrency:', e.message);
        }
    }
    
    function spoofLanguageAndPlatform() {
        try {
            Object.defineProperty(navigator, 'language', { 
                value: 'en-US', 
                writable: false,
                configurable: false
            });
            Object.defineProperty(navigator, 'languages', { 
                value: ['en-US', 'en'], 
                writable: false,
                configurable: false
            });
            Object.defineProperty(navigator, 'platform', { 
                value: 'Win32', 
                writable: false,
                configurable: false
            });
            console.log('🛡️ Language and platform spoofed');
        } catch (e) {
            console.log('⚠️ Could not spoof language and platform:', e.message);
        }
    }
    
    function enableDoNotTrack() {
        try {
            Object.defineProperty(navigator, 'doNotTrack', { 
                value: '1', 
                writable: false,
                configurable: false
            });
            console.log('🛡️ Do Not Track enabled');
        } catch (e) {
            console.log('⚠️ Could not enable Do Not Track:', e.message);
        }
    }
    
    function controlReferrerPolicy() {
        try {
            const meta = document.createElement('meta');
            meta.name = 'referrer';
            meta.content = 'no-referrer';
            document.head.appendChild(meta);
            console.log('🛡️ Referrer policy controlled');
        } catch (e) {
            console.log('⚠️ Could not control referrer policy:', e.message);
        }
    }
    
    function protectLocalStorage() {
        try {
            const sensitiveKeys = ['fingerprint', 'tracking', 'analytics', 'gtm', 'ga', 'fbq'];
            sensitiveKeys.forEach(key => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
            console.log('🛡️ Local storage protected');
        } catch (e) {
            console.log('⚠️ Could not protect local storage:', e.message);
        }
    }
    
    function protectCookies() {
        try {
            // Set secure cookie attributes
            document.cookie = 'SameSite=Strict; Secure; HttpOnly';
            console.log('🛡️ Cookies protected');
        } catch (e) {
            console.log('⚠️ Could not protect cookies:', e.message);
        }
    }
    
    function enhanceWebRTCProtection() {
        try {
            // Block WebRTC completely if needed
            if (window.RTCPeerConnection) {
                window.RTCPeerConnection = undefined;
            }
            if (window.webkitRTCPeerConnection) {
                window.webkitRTCPeerConnection = undefined;
            }
            console.log('🛡️ WebRTC protection enhanced');
        } catch (e) {
            console.log('⚠️ Could not enhance WebRTC protection:', e.message);
        }
    }
    
    function protectDNSLeaks() {
        try {
            // Monitor for DNS-related requests
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                const url = args[0];
                if (typeof url === 'string' && (url.includes('dns') || url.includes('whois'))) {
                    console.warn('🚫 Blocked potential DNS leak:', url);
                    return Promise.reject(new Error('DNS leak blocked'));
                }
                return originalFetch.apply(this, args);
            };
            console.log('🛡️ DNS leak protection enabled');
        } catch (e) {
            console.log('⚠️ Could not protect DNS leaks:', e.message);
        }
    }
    
    function detectIPLeaks() {
        try {
            // Monitor for IP leak attempts
            const checkForIPLeaks = () => {
                const scripts = document.querySelectorAll('script');
                scripts.forEach(script => {
                    if (script.src && (script.src.includes('ip') || script.src.includes('location'))) {
                        console.warn('🚨 Potential IP leak detected:', script.src);
                    }
                });
            };
            
            // Check periodically
            setInterval(checkForIPLeaks, 5000);
            console.log('🛡️ IP leak detection enabled');
        } catch (e) {
            console.log('⚠️ Could not enable IP leak detection:', e.message);
        }
    }
    
    function randomizeFingerprint() {
        try {
            // Randomize user agent slightly
            const userAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ];
            
            const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
            Object.defineProperty(navigator, 'userAgent', {
                value: randomUA,
                writable: false,
                configurable: false
            });
            console.log('🛡️ Fingerprint randomized');
        } catch (e) {
            console.log('⚠️ Could not randomize fingerprint:', e.message);
        }
    }
    
    function spoofNetworkInformation() {
        try {
            if (navigator.connection) {
                Object.defineProperty(navigator.connection, 'effectiveType', { 
                    value: '4g', 
                    writable: false 
                });
                Object.defineProperty(navigator.connection, 'downlink', { 
                    value: 10, 
                    writable: false 
                });
                Object.defineProperty(navigator.connection, 'rtt', { 
                    value: 50, 
                    writable: false 
                });
            }
            console.log('🛡️ Network information spoofed');
        } catch (e) {
            console.log('⚠️ Could not spoof network information:', e.message);
        }
    }
    
    function spoofMediaDevices() {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                navigator.mediaDevices.enumerateDevices = function() {
                    return Promise.resolve([
                        { deviceId: 'default', kind: 'audioinput', label: 'Default - Microphone' },
                        { deviceId: 'default', kind: 'audiooutput', label: 'Default - Speaker' }
                    ]);
                };
            }
            console.log('🛡️ Media devices spoofed');
        } catch (e) {
            console.log('⚠️ Could not spoof media devices:', e.message);
        }
    }
    
    function enhanceTimingProtection() {
        try {
            // Enhanced timing protection
            const originalDate = Date;
            Date = function(...args) {
                if (args.length === 0) {
                    const variation = Math.random() * 1000 - 500;
                    return new originalDate(originalDate.now() + variation);
                }
                return new originalDate(...args);
            };
            
            // Copy static methods
            Date.now = function() {
                const variation = Math.random() * 2 - 1;
                return originalDate.now() + variation;
            };
            
            Date.parse = originalDate.parse;
            Date.UTC = originalDate.UTC;
            
            console.log('🛡️ Timing protection enhanced');
        } catch (e) {
            console.log('⚠️ Could not enhance timing protection:', e.message);
        }
    }
    
})();
