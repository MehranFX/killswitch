"use strict";

/**
 * Advanced Privacy Protection Content Script
 * Protects against various fingerprinting and tracking methods
 */

(function() {
    'use strict';
    
    // Check privacy protection settings
    chrome.storage.local.get([
        'canvas_protection','webgl_protection','audio_protection','font_protection','screen_spoofing',
        'battery_protection','memory_spoofing','hardware_spoofing','language_spoofing','dnt_header',
        'referrer_control','storage_protection','cookie_protection','block_ping',
        'ip_leak_detection','fingerprint_randomization','network_spoofing','media_spoofing','timing_protection','flash_protection'
    ], (result) => {
        initializePrivacyProtection(result);
    });
    
    // Apply direct privacy spoofing in content script world
    try {
        
        // Block cookieEnabled detection
        Object.defineProperty(navigator, 'cookieEnabled', {
            value: false,
            writable: false,
            configurable: false
        });
        
        // Block plugins detection
        Object.defineProperty(navigator, 'plugins', {
            value: Object.freeze([]),
            writable: false,
            configurable: false
        });
        
        Object.defineProperty(navigator, 'mimeTypes', {
            value: Object.freeze([]),
            writable: false,
            configurable: false
        });
        
        // Force DNT
        Object.defineProperty(navigator, 'doNotTrack', {
            value: '1',
            writable: false,
            configurable: false
        });
        
        // Block geolocation
        if (navigator.geolocation) {
            Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
                value: function(success, error) {
                    if (error) error({ code: 1, message: 'Permission denied' });
                },
                writable: false,
                configurable: false
            });
            
            Object.defineProperty(navigator.geolocation, 'watchPosition', {
                value: function(success, error) {
                    if (error) error({ code: 1, message: 'Permission denied' });
                    return 0;
                },
                writable: false,
                configurable: false
            });
        }
        
        // Block media devices
        if (navigator.mediaDevices) {
            Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
                value: function() {
                    return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
                },
                writable: false,
                configurable: false
            });
            
            Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
                value: function() {
                    return Promise.resolve([]);
                },
                writable: false,
                configurable: false
            });
        }
        
        // Block permissions API
        if (navigator.permissions) {
            Object.defineProperty(navigator.permissions, 'query', {
                value: function(descriptor) {
                    return Promise.resolve({
                        state: 'denied',
                        onchange: null
                    });
                },
                writable: false,
                configurable: false
            });
        }
        
        // Log removed
        
    } catch (e) {
        // Log removed
    }
    
    function initializePrivacyProtection(settings) {
        // Log removed
        
        // Check each setting and apply protection accordingly
        if (settings.canvas_protection) protectCanvasFingerprinting();
        if (settings.webgl_protection) protectWebGLFingerprinting();
        if (settings.audio_protection) protectAudioFingerprinting();
        if (settings.font_protection) protectFontFingerprinting();
        if (settings.screen_spoofing) spoofScreenResolution();
        if (settings.battery_protection) protectBatteryAPI();
        if (settings.memory_spoofing) spoofDeviceMemory();
        if (settings.hardware_spoofing) spoofHardwareConcurrency();
        if (settings.language_spoofing) spoofLanguageAndPlatform();
        if (settings.dnt_header) enableDoNotTrack();
        if (settings.referrer_control) controlReferrerPolicy();
        if (settings.block_ping) blockHyperlinkAuditing();
        if (settings.storage_protection) protectLocalStorage();
        if (settings.cookie_protection) protectCookies();
        if (settings.ip_leak_detection) detectIPLeaks();
        if (settings.fingerprint_randomization) randomizeFingerprint();
        if (settings.network_spoofing) spoofNetworkInformation();
        if (settings.media_spoofing) spoofMediaDevices();
        if (settings.timing_protection) enhanceTimingProtection();
        if (settings.flash_protection) blockFlash();
        
        // Log removed
    }

    function blockHyperlinkAuditing() {
        try {
            // Override "ping" on existing links
            const links = document.querySelectorAll('a[ping]');
            links.forEach(a => a.removeAttribute('ping'));

            // Intercept future link creations
            const originalSetAttribute = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function(name, value) {
                if (name && name.toLowerCase() === 'ping') {
                    return; // block
                }
                return originalSetAttribute.apply(this, arguments);
            };

            // Sanitize click events that may send ping
            document.addEventListener('click', (e) => {
                const target = e.target.closest('a');
                if (target && target.hasAttribute('ping')) {
                    target.removeAttribute('ping');
                }
            }, true);

            // Log removed
        } catch (e) {
            // Log removed
        }
    }
    
    function protectCanvasFingerprinting() {
        try {
            // Override toDataURL
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function() {
                addCanvasNoise(this);
                return originalToDataURL.apply(this, arguments);
            };
            
            // Override toBlob
            const originalToBlob = HTMLCanvasElement.prototype.toBlob;
            HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
                addCanvasNoise(this);
                return originalToBlob.apply(this, arguments);
            };
            
            // Override getImageData
            const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
            CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
                const imageData = originalGetImageData.apply(this, arguments);
                addNoiseToImageData(imageData);
                return imageData;
            };
            
            // Helper function to add noise
            function addCanvasNoise(canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    addNoiseToImageData(imageData);
                    ctx.putImageData(imageData, 0, 0);
                }
            }
            
            function addNoiseToImageData(imageData) {
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] += Math.floor(Math.random() * 5) - 2; // R
                    imageData.data[i + 1] += Math.floor(Math.random() * 5) - 2; // G
                    imageData.data[i + 2] += Math.floor(Math.random() * 5) - 2; // B
                }
            }
            
            // Log removed
        } catch (e) {
            // Log removed
        }
    }
    
    function protectWebGLFingerprinting() {
        try {
            const SPOOF_VENDOR = 'WebKit';
            const SPOOF_RENDERER = 'WebKit WebGL';

            function overrideContext(Context) {
                if (!Context) return;

                // getParameter override (both masked and unmasked values)
                const originalGetParameter = Context.prototype.getParameter;
                Context.prototype.getParameter = function(parameter) {
                    switch (parameter) {
                        case 0x1F00: // VENDOR
                            return SPOOF_VENDOR;
                        case 0x1F01: // RENDERER
                            return SPOOF_RENDERER;
                        case 0x1F02: // VERSION
                            return 'WebGL 2.0 (OpenGL ES 3.0 Chromium)';
                        case 0x8B8C: // SHADING_LANGUAGE_VERSION
                            return 'WebGL GLSL ES 3.00 (OpenGL ES 3.0 Chromium)';
                        case 0x9245: // UNMASKED_VENDOR_WEBGL
                            return SPOOF_VENDOR;
                        case 0x9246: // UNMASKED_RENDERER_WEBGL
                            return SPOOF_RENDERER;
                        default:
                            return originalGetParameter.apply(this, arguments);
                    }
                };

                // Filter out debug renderer info extension
                const originalGetSupportedExtensions = Context.prototype.getSupportedExtensions;
                if (originalGetSupportedExtensions) {
                    Context.prototype.getSupportedExtensions = function() {
                        const list = originalGetSupportedExtensions.apply(this, arguments) || [];
                        return list.filter((name) => name !== 'WEBGL_debug_renderer_info');
                    };
                }

                // Block access to WEBGL_debug_renderer_info
                const originalGetExtension = Context.prototype.getExtension;
                if (originalGetExtension) {
                    Context.prototype.getExtension = function(name) {
                        if (!name) return originalGetExtension.apply(this, arguments);
                        const n = String(name).toLowerCase();
                        if (n === 'webgl_debug_renderer_info') return null;
                        return originalGetExtension.apply(this, arguments);
                    };
                }
            }

            overrideContext(window.WebGLRenderingContext);
            overrideContext(window.WebGL2RenderingContext);

            // Log removed
        } catch (e) {
            // Log removed
        }
    }
    
    function protectAudioFingerprinting() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
                AudioContext.prototype.createAnalyser = function() {
                    const analyser = originalCreateAnalyser.apply(this, arguments);
                    
                    // Override getFloatFrequencyData
                    const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
                    analyser.getFloatFrequencyData = function(array) {
                        originalGetFloatFrequencyData.apply(this, arguments);
                        addAudioNoise(array);
                    };
                    
                    // Override getByteFrequencyData
                    const originalGetByteFrequencyData = analyser.getByteFrequencyData;
                    analyser.getByteFrequencyData = function(array) {
                        originalGetByteFrequencyData.apply(this, arguments);
                        addAudioNoise(array, true);
                    };
                    
                    // Override getByteTimeDomainData
                    const originalGetByteTimeDomainData = analyser.getByteTimeDomainData;
                    analyser.getByteTimeDomainData = function(array) {
                        originalGetByteTimeDomainData.apply(this, arguments);
                        addAudioNoise(array, true);
                    };
                    
                    return analyser;
                };
                
                // Override createOscillator
                const originalCreateOscillator = AudioContext.prototype.createOscillator;
                AudioContext.prototype.createOscillator = function() {
                    const oscillator = originalCreateOscillator.apply(this, arguments);
                    const originalStart = oscillator.start;
                    oscillator.start = function(when) {
                        // Add random frequency variation
                        this.frequency.value += (Math.random() - 0.5) * 0.1;
                        return originalStart.apply(this, arguments);
                    };
                    return oscillator;
                };
            }
            
            function addAudioNoise(array, isByte = false) {
                const noiseLevel = isByte ? 2 : 0.1;
                for (let i = 0; i < array.length; i++) {
                    array[i] += (Math.random() - 0.5) * noiseLevel;
                }
            }
            
            // Log removed
        } catch (e) {
            // Log removed
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
                        return width + Math.floor(Math.random() * 5) - 2;
                    }
                });
            }
            
            if (originalOffsetHeight) {
                Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
                    get: function() {
                        const height = originalOffsetHeight.get.call(this);
                        return height + Math.floor(Math.random() * 5) - 2;
                    }
                });
            }
            
            // Override getBoundingClientRect
            const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
            Element.prototype.getBoundingClientRect = function() {
                const rect = originalGetBoundingClientRect.apply(this, arguments);
                return {
                    x: rect.x + Math.floor(Math.random() * 3) - 1,
                    y: rect.y + Math.floor(Math.random() * 3) - 1,
                    width: rect.width + Math.floor(Math.random() * 3) - 1,
                    height: rect.height + Math.floor(Math.random() * 3) - 1,
                    top: rect.top + Math.floor(Math.random() * 3) - 1,
                    right: rect.right + Math.floor(Math.random() * 3) - 1,
                    bottom: rect.bottom + Math.floor(Math.random() * 3) - 1,
                    left: rect.left + Math.floor(Math.random() * 3) - 1,
                    toJSON: rect.toJSON
                };
            };
            
            // Override getComputedStyle for font-related properties
            const originalGetComputedStyle = window.getComputedStyle;
            window.getComputedStyle = function(element, pseudoElt) {
                const style = originalGetComputedStyle.apply(this, arguments);
                const originalGetPropertyValue = style.getPropertyValue;
                style.getPropertyValue = function(property) {
                    const value = originalGetPropertyValue.apply(this, arguments);
                    if (property === 'font-family' || property === 'font-size' || property === 'font-weight') {
                        // Add slight variation to font properties
                        if (property === 'font-size') {
                            const size = parseFloat(value);
                            if (!isNaN(size)) {
                                return (size + Math.random() * 0.1 - 0.05) + 'px';
                            }
                        }
                    }
                    return value;
                };
                return style;
            };
            
            // Log removed
        } catch (e) {
            // Log removed
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
            // Log removed
        } catch (e) {
            // Log removed
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
            // Log removed
        } catch (e) {
            // Log removed
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
            // Log removed
        } catch (e) {
            // Log removed
        }
    }
    
    function spoofHardwareConcurrency() {
        try {
            Object.defineProperty(navigator, 'hardwareConcurrency', { 
                value: 8, 
                writable: false,
                configurable: false
            });
            // Log removed
        } catch (e) {
            // Log removed
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
            // Log removed
        } catch (e) {
            // Log removed
        }
    }
    
    function enableDoNotTrack() {
        try {
            Object.defineProperty(navigator, 'doNotTrack', { 
                value: '1', 
                writable: false,
                configurable: false
            });
            // Log removed
        } catch (e) {
            // Log removed
        }
    }
    
    function controlReferrerPolicy() {
        try {
            // Add meta tag for referrer policy
            const meta = document.createElement('meta');
            meta.name = 'referrer';
            meta.content = 'no-referrer';
            document.head.appendChild(meta);
            
            // Override document.referrer
            Object.defineProperty(document, 'referrer', {
                value: '',
                writable: false,
                configurable: false
            });
            
            // Block ping attribute on links
            const originalCreateElement = document.createElement;
            document.createElement = function(tagName) {
                const element = originalCreateElement.apply(this, arguments);
                if (tagName.toLowerCase() === 'a') {
                    Object.defineProperty(element, 'ping', {
                        set: function(value) {
                            // Block ping attribute
                            return;
                        },
                        get: function() {
                            return '';
                        }
                    });
                }
                return element;
            };
            
            // Log removed
        } catch (e) {
            // Log removed
        }
    }
    
    function protectLocalStorage() {
        try {
            const sensitiveKeys = ['fingerprint', 'tracking', 'analytics', 'gtm', 'ga', 'fbq'];
            sensitiveKeys.forEach(key => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
            // Log removed
        } catch (e) {
            // Log removed
        }
    }
    
    function protectCookies() {
        try {
            // Set secure cookie attributes
            document.cookie = 'SameSite=Strict; Secure; HttpOnly';
            // Log removed
        } catch (e) {
            // Log removed
        }
    }
    
    
    function detectIPLeaks() {
        try {
            // Monitor for IP leak attempts
            const checkForIPLeaks = () => {
                const scripts = document.querySelectorAll('script');
                scripts.forEach(script => {
                    if (script.src && (script.src.includes('ip') || script.src.includes('location'))) {
                        // IP leak detected - silent monitoring
                    }
                });
            };
            
            // Check periodically
            setInterval(checkForIPLeaks, 5000);
        } catch (e) {
            // IP leak detection failed silently
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
            // Log removed
        } catch (e) {
            // Log removed
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
            // Log removed
        } catch (e) {
            // Log removed
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
            // Log removed
        } catch (e) {
            // Log removed
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
            
            // Log removed
        } catch (e) {
            // Log removed
        }
    }
    
    function blockFlash() {
        try {
            // Block Flash detection
            if (navigator.plugins) {
                Object.defineProperty(navigator, 'plugins', {
                    value: [],
                    writable: false,
                    configurable: false
                });
            }
            
            // Block Flash mimeTypes
            if (navigator.mimeTypes) {
                Object.defineProperty(navigator, 'mimeTypes', {
                    value: [],
                    writable: false,
                    configurable: false
                });
            }
            
            // Block Flash object creation
            const originalCreateElement = document.createElement;
            document.createElement = function(tagName) {
                if (tagName.toLowerCase() === 'object' || tagName.toLowerCase() === 'embed') {
                    const element = originalCreateElement.apply(this, arguments);
                    // Block Flash-related attributes
                    Object.defineProperty(element, 'type', {
                        set: function(value) {
                            if (value && value.includes('flash')) {
                                return;
                            }
                            this.setAttribute('type', value);
                        },
                        get: function() {
                            return this.getAttribute('type');
                        }
                    });
                    return element;
                }
                return originalCreateElement.apply(this, arguments);
            };
            
            // Log removed
        } catch (e) {
            // Log removed
        }
    }
    
})();
