(function(){
  'use strict';

  try {
    if (localStorage.getItem('ks_privacy_master') === 'off') return;
    if (localStorage.getItem('ks_webgl_protection') === 'off') return;
  } catch (_) {}

  if (window.__ksWebglSpoofApplied) return;
  window.__ksWebglSpoofApplied = true;

  // Hide WebGL INVALID_ENUM noise and privacy-related errors
  try{
    // Leave console.error untouched to avoid site compatibility issues
  }catch(_e){}

  const UNMASKED_VENDOR = 0x9245;
  const UNMASKED_RENDERER = 0x9246;

  // Standard Chrome ANGLE format vendor-renderer pairs
  const vendorRendererPairs = [
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (NVIDIA Corporation)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (NVIDIA Corporation)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (NVIDIA Corporation)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)' }
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

    // Save native originalGetParameter to preserve natural hardware parameters
    const originalGetParameter = (typeof gl.getParameter === 'function') ? gl.getParameter.bind(gl) : null;

    // Unmasked vendor/renderer (fake)
    fake[UNMASKED_VENDOR] = fakeVendor;
    fake[UNMASKED_RENDERER] = fakeRenderer;

    // Natural override: spoof vendor/renderer and delegate all other parameters to native WebGL
    gl.getParameter = function(pname) {
      if (pname === UNMASKED_VENDOR || pname === 0x9245) return fakeVendor;
      if (pname === UNMASKED_RENDERER || pname === 0x9246) return fakeRenderer;
      if (typeof pname === 'number' && pname in fake) return fake[pname];
      if (originalGetParameter) {
        try {
          return originalGetParameter(pname);
        } catch (_) {}
      }
      return 0;
    };

    // Ensure webgl_debug_renderer_info extension is listed as supported so native WebGL does not trigger INVALID_ENUM
    const originalGetSupportedExtensions = gl.getSupportedExtensions?.bind(gl);
    if (originalGetSupportedExtensions) {
      gl.getSupportedExtensions = function() {
        try {
          const list = originalGetSupportedExtensions() || [];
          if (!list.includes('WEBGL_debug_renderer_info')) {
            list.push('WEBGL_debug_renderer_info');
          }
          return list;
        } catch (_) { return ['WEBGL_debug_renderer_info']; }
      };
    }

    const originalGetExtension = (typeof gl.getExtension === 'function' && typeof gl.getExtension.bind === 'function')
      ? gl.getExtension.bind(gl)
      : function() { return null; };
    gl.getExtension = function(name) {
      try {
        if (!name) return null;
        if (String(name).toLowerCase() === 'webgl_debug_renderer_info') {
          return { UNMASKED_VENDOR_WEBGL: UNMASKED_VENDOR, UNMASKED_RENDERER_WEBGL: UNMASKED_RENDERER };
        }
        return originalGetExtension(name);
      } catch (_) { return null; }
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
})();
