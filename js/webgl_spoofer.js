(function(){
  'use strict';

  // Wait for settings to be synced from chrome.storage to localStorage
  function waitForSettings(callback) {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    function checkSettings() {
      attempts++;
      
      try {
        // Check if settings have been synced
        if (localStorage.getItem('ks_settings_synced') === 'true') {
          // Settings synced, check privacy settings
          if (localStorage.getItem('ks_privacy_master') === 'off') { 
            return; // Master privacy off, skip WebGL spoofing
          }
          if (localStorage.getItem('ks_webgl_protection') === 'off') { 
            return; // WebGL protection off, skip WebGL spoofing
          }
          callback(); // Settings allow WebGL spoofing, proceed
          return;
        }
        
        // Settings not synced yet, wait a bit more
        if (attempts < maxAttempts) {
          setTimeout(checkSettings, 100);
        } else {
          // Timeout reached, check current localStorage values or apply defaults
          try {
            if (localStorage.getItem('ks_privacy_master') === 'off') { return; }
            if (localStorage.getItem('ks_webgl_protection') === 'off') { return; }
          } catch(_) {}
          callback(); // Fallback: proceed with spoofing
        }
      } catch (e) {
        // localStorage access failed, proceed with spoofing as fallback
        if (attempts >= maxAttempts) {
          callback();
        } else {
          setTimeout(checkSettings, 100);
        }
      }
    }
    
    checkSettings();
  }
  
  // Wait for settings before proceeding
  waitForSettings(() => {

  if (window.__ksWebglSpoofApplied) return;
  window.__ksWebglSpoofApplied = true;

  // Hide WebGL INVALID_ENUM noise and privacy-related errors
  try{
    // Leave console.error untouched to avoid site compatibility issues
  }catch(_e){}

  const UNMASKED_VENDOR = 0x9245;
  const UNMASKED_RENDERER = 0x9246;

  // Consistent vendor-renderer pairs to avoid detection
  const vendorRendererPairs = [
    // Intel Graphics
    { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 620' },
    { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 630' },
    { vendor: 'Intel Inc.', renderer: 'Intel(R) HD Graphics 4000' },
    { vendor: 'Intel Inc.', renderer: 'Intel(R) HD Graphics 520' },
    { vendor: 'Intel Inc.', renderer: 'Intel(R) HD Graphics 530' },
    { vendor: 'Intel Inc.', renderer: 'Intel(R) Iris Xe Graphics' },
    { vendor: 'Intel Inc.', renderer: 'Intel(R) Iris Pro Graphics 5200' },
    { vendor: 'Intel Inc.', renderer: 'Intel(R) HD Graphics 4600' },
    
    // NVIDIA Graphics
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1060' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1070' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1080' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 2060' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3060' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3070' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 4060' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 4070' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1660' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1650' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce MX150' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce MX250' },
    
    // AMD Graphics
    { vendor: 'AMD', renderer: 'AMD Radeon RX 580' },
    { vendor: 'AMD', renderer: 'AMD Radeon RX 6600' },
    { vendor: 'AMD', renderer: 'AMD Radeon RX 570' },
    { vendor: 'AMD', renderer: 'AMD Radeon RX 5700' },
    { vendor: 'AMD', renderer: 'AMD Radeon RX 6700 XT' },
    { vendor: 'AMD', renderer: 'AMD Radeon RX 7600' },
    { vendor: 'AMD', renderer: 'AMD Radeon RX 550' },
    { vendor: 'AMD', renderer: 'AMD Radeon RX 560' },
    { vendor: 'AMD', renderer: 'AMD Radeon RX 480' },
    { vendor: 'AMD', renderer: 'AMD Radeon RX 470' },
    { vendor: 'AMD', renderer: 'AMD Radeon R9 390' },
    { vendor: 'AMD', renderer: 'AMD Radeon R7 370' },
    
    // Qualcomm Mobile Graphics
    { vendor: 'Qualcomm', renderer: 'Adreno 640' },
    { vendor: 'Qualcomm', renderer: 'Adreno 650' },
    { vendor: 'Qualcomm', renderer: 'Adreno 530' },
    { vendor: 'Qualcomm', renderer: 'Adreno 630' },
    { vendor: 'Qualcomm', renderer: 'Adreno 540' },
    { vendor: 'Qualcomm', renderer: 'Adreno 430' },
    
    // Apple Graphics (for Mac users)
    { vendor: 'Apple Inc.', renderer: 'Apple M1' },
    { vendor: 'Apple Inc.', renderer: 'Apple M2' },
    { vendor: 'Apple Inc.', renderer: 'Apple M1 Pro' },
    { vendor: 'Apple Inc.', renderer: 'Apple M1 Max' },
    
    // ARM Mali Graphics
    { vendor: 'ARM', renderer: 'Mali-G78 MP14' },
    { vendor: 'ARM', renderer: 'Mali-G76 MP16' },
    { vendor: 'ARM', renderer: 'Mali-G72 MP18' },
    { vendor: 'ARM', renderer: 'Mali-G710 MP7' },
    
    // PowerVR Graphics
    { vendor: 'Imagination Technologies', renderer: 'PowerVR SGX543' },
    { vendor: 'Imagination Technologies', renderer: 'PowerVR SGX554' },
    { vendor: 'Imagination Technologies', renderer: 'PowerVR GM9446' }
  ];

  let seedStr; try{ seedStr = sessionStorage.getItem('ks_webgl_seed') || (sessionStorage.setItem('ks_webgl_seed', String(Math.random())), sessionStorage.getItem('ks_webgl_seed')); }catch(_e){ seedStr = String(Math.random()); }
  const seedNum = Math.abs(Array.from(seedStr).reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0)|0, 0)) || Math.floor(Math.random()*1e9);
  const selectedPair = vendorRendererPairs[seedNum % vendorRendererPairs.length];
  const fakeVendor = selectedPair.vendor;
  const fakeRenderer = selectedPair.renderer;

  function patchContext(gl){
    if (!gl || gl.__ksPatched) return gl;
    gl.__ksPatched = true;

    // Comprehensive fake parameter map (safe, plausible values)
    const fake = Object.create(null);
    fake[0x1F00] = 'WebKit'; // VENDOR
    fake[0x1F01] = 'WebKit WebGL'; // RENDERER
    fake[0x1F02] = (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext)
      ? 'WebGL 2.0 (OpenGL ES 3.0 Chromium)'
      : 'WebGL 1.0 (OpenGL ES 2.0 Chromium)'; // VERSION
    fake[0x8B8C] = (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext)
      ? 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)'
      : 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)'; // SHADING_LANGUAGE_VERSION

    // Capabilities
    fake[0x0D33] = 16384; // MAX_TEXTURE_SIZE
    fake[0x8073] = 32;    // MAX_TEXTURE_IMAGE_UNITS
    fake[0x8B4D] = 32;    // MAX_VERTEX_TEXTURE_IMAGE_UNITS
    fake[0x8DFB] = 64;    // MAX_COMBINED_TEXTURE_IMAGE_UNITS
    fake[0x0D3A] = new Int32Array([32768, 32768]); // MAX_VIEWPORT_DIMS
    fake[0x8824] = 32768; // MAX_RENDERBUFFER_SIZE
    fake[0x8B49] = 32;    // MAX_VERTEX_ATTRIBS
    fake[0x8B4A] = 4096;  // MAX_VERTEX_UNIFORM_VECTORS
    fake[0x8B4B] = 31;    // MAX_VARYING_VECTORS
    fake[0x8B4C] = 4096;  // MAX_FRAGMENT_UNIFORM_VECTORS

    // Color/depth/stencil bits
    fake[0x0D52] = 8; // RED_BITS
    fake[0x0D53] = 8; // GREEN_BITS
    fake[0x0D54] = 8; // BLUE_BITS
    fake[0x0D55] = 8; // ALPHA_BITS
    fake[0x0D56] = 24; // DEPTH_BITS
    fake[0x0D57] = 8; // STENCIL_BITS

    // Unmasked vendor/renderer (fake)
    fake[UNMASKED_VENDOR] = fakeVendor;
    fake[UNMASKED_RENDERER] = fakeRenderer;

    // Final override: never call original getParameter (prevents INVALID_ENUM)
    gl.getParameter = function(pname){
      if (typeof pname === 'number' && pname in fake) return fake[pname];
      
      // Handle common WebGL parameters that might cause "Unimplemented type" errors
      try {
        // For unknown parameters, try to return a safe default based on parameter type
        if (typeof pname === 'number') {
          // Common WebGL parameter ranges and their expected return types
          if (pname >= 0x0B00 && pname <= 0x0BFF) {
            return false; // Boolean parameters
          } else if (pname >= 0x0C00 && pname <= 0x0CFF) {
            return 0; // Integer parameters
          } else if (pname >= 0x0D00 && pname <= 0x0DFF) {
            return 0; // Integer parameters
          } else if (pname >= 0x1F00 && pname <= 0x1FFF) {
            return ''; // String parameters
          } else if (pname >= 0x8B00 && pname <= 0x8BFF) {
            return 0; // Integer parameters
          }
        }
        return 0;
      } catch (e) {
        return 0;
      }
    };

    // Remove debug extension to block real unmasked values
    const originalGetSupportedExtensions = gl.getSupportedExtensions?.bind(gl);
    if (originalGetSupportedExtensions){
      gl.getSupportedExtensions = function(){
        try{
          const list = originalGetSupportedExtensions() || [];
          return list.filter((n)=> n && n.toLowerCase() !== 'webgl_debug_renderer_info');
        }catch(_e){ return []; }
      };
    }

    const originalGetExtension = (typeof gl.getExtension === 'function' && typeof gl.getExtension.bind === 'function')
      ? gl.getExtension.bind(gl)
      : function(){ return null; };
    gl.getExtension = function(name){
      try{
        if (!name) return null;
        if (String(name).toLowerCase() === 'webgl_debug_renderer_info'){
          return { UNMASKED_VENDOR_WEBGL: UNMASKED_VENDOR, UNMASKED_RENDERER_WEBGL: UNMASKED_RENDERER };
        }
        return originalGetExtension(name);
      }catch(_e){ return null; }
    };

    return gl;
  }

  if (window.HTMLCanvasElement && HTMLCanvasElement.prototype){
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function(type){
        const ctx = originalGetContext.apply(this, arguments);
        if (type && String(type).toLowerCase().includes('webgl')) return patchContext(ctx);
        return ctx;
      }, writable:false, configurable:false
    });
  }

  if (window.OffscreenCanvas && OffscreenCanvas.prototype){
    const originalOffscreenGetContext = OffscreenCanvas.prototype.getContext;
    Object.defineProperty(OffscreenCanvas.prototype, 'getContext', {
      value: function(type){
        const ctx = originalOffscreenGetContext.apply(this, arguments);
        if (type && String(type).toLowerCase().includes('webgl')) return patchContext(ctx);
        return ctx;
      }, writable:false, configurable:false
    });
  }
  
  }); // End of waitForSettings callback
})();
