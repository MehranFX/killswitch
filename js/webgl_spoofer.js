/**
 * WebGL Spoofer - Injects WebGL spoofing script into page context
 */

(function() {
    'use strict';
    
    console.log('🎭 WebGL Spoofer: Injecting early WebGL spoofing script...');
    
    // Inject the spoofing script IMMEDIATELY into page context
    try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('js/webgl_inject.js');
        script.onload = function() {
            this.remove();
            console.log('✅ WebGL inject script loaded and removed');
        };
        
        // Inject as early as possible
        if (document.documentElement) {
            document.documentElement.appendChild(script);
        } else {
            // If document not ready, wait for it
            const observer = new MutationObserver(() => {
                if (document.documentElement) {
                    document.documentElement.appendChild(script);
                    observer.disconnect();
                }
            });
            observer.observe(document, { childList: true });
        }
        
        console.log('✅ WebGL inject script added to page');
        
    } catch (e) {
        console.error('❌ Failed to inject WebGL spoofing script:', e);
        
        // Fallback: try inline injection with REAL WebGL support
        try {
            const inlineScript = document.createElement('script');
            inlineScript.textContent = `
                console.log('🎭 Fallback WebGL spoofing...');
                if (HTMLCanvasElement && HTMLCanvasElement.prototype) {
                    const orig = HTMLCanvasElement.prototype.getContext;
                    const fakeVendors = ['Intel Inc.', 'NVIDIA Corporation', 'AMD'];
                    const fakeRenderers = ['Intel(R) UHD Graphics 620', 'NVIDIA GeForce GTX 1060', 'AMD Radeon RX 580'];
                    const sessionSeed = Math.random();
                    const fakeVendor = fakeVendors[Math.floor(sessionSeed * fakeVendors.length)];
                    const fakeRenderer = fakeRenderers[Math.floor(sessionSeed * fakeRenderers.length)];
                    
                    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                        if (type && type.toLowerCase().includes('webgl')) {
                            console.log('🎭 FALLBACK WebGL spoofed:', type);
                            
                            // Get REAL WebGL context
                            const realContext = orig.apply(this, [type, ...args]);
                            if (realContext) {
                                // Override getParameter on real context
                                const origGetParameter = realContext.getParameter;
                                realContext.getParameter = function(pname) {
                                    switch(pname) {
                                        case 0x1F00: return 'WebKit';
                                        case 0x1F01: return 'WebKit WebGL';
                                        case 0x9245: return fakeVendor;
                                        case 0x9246: return fakeRenderer;
                                        default: return origGetParameter.apply(this, arguments);
                                    }
                                };
                                
                                // Block debug extension
                                const origGetExtension = realContext.getExtension;
                                realContext.getExtension = function(name) {
                                    if (name && name.toLowerCase() === 'webgl_debug_renderer_info') return null;
                                    return origGetExtension.apply(this, arguments);
                                };
                                
                                return realContext;
                            }
                        }
                        return orig.apply(this, arguments);
                    };
                }
            `;
            
            if (document.documentElement) {
                document.documentElement.appendChild(inlineScript);
                inlineScript.remove();
                console.log('✅ Fallback WebGL spoofing applied');
            }
        } catch (fallbackError) {
            console.error('❌ Fallback injection also failed:', fallbackError);
        }
    }
    
})();
