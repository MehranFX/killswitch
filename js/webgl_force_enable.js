/**
 * Force Enable WebGL - Injects at earliest possible moment
 */

// This script FORCES WebGL to appear enabled even if disabled in Chrome settings
(function() {
    'use strict';
    
    console.log('🔧 Force Enable WebGL: Starting...');
    
    // Generate fake but consistent WebGL data
    const sessionSeed = Math.random();
    const fakeVendors = ['Intel Inc.', 'NVIDIA Corporation', 'AMD', 'Qualcomm'];
    const fakeRenderers = [
        'Intel(R) UHD Graphics 620',
        'NVIDIA GeForce GTX 1060',
        'AMD Radeon RX 580',
        'Intel(R) HD Graphics 4000'
    ];
    
    const fakeVendor = fakeVendors[Math.floor(sessionSeed * fakeVendors.length)];
    const fakeRenderer = fakeRenderers[Math.floor(sessionSeed * fakeRenderers.length)];
    
    // Complete fake WebGL context that passes all tests
    function createCompleteWebGLContext(contextType) {
        const isWebGL2 = contextType === 'webgl2';
        
        const context = {
            canvas: null,
            drawingBufferWidth: 300,
            drawingBufferHeight: 150,
            
            // Core identification
            getParameter: function(pname) {
                switch(pname) {
                    case 0x1F00: return 'WebKit'; // VENDOR
                    case 0x1F01: return 'WebKit WebGL'; // RENDERER
                    case 0x1F02: return isWebGL2 ? 'WebGL 2.0 (OpenGL ES 3.0 Chromium)' : 'WebGL 1.0 (OpenGL ES 2.0 Chromium)'; // VERSION
                    case 0x8B8C: return isWebGL2 ? 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)' : 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)'; // SHADING_LANGUAGE_VERSION
                    case 0x9245: return fakeVendor; // UNMASKED_VENDOR_WEBGL
                    case 0x9246: return fakeRenderer; // UNMASKED_RENDERER_WEBGL
                    
                    // Capabilities
                    case 0x0D33: return 16384; // MAX_TEXTURE_SIZE
                    case 0x8073: return 16; // MAX_TEXTURE_IMAGE_UNITS
                    case 0x8B4D: return 16; // MAX_VERTEX_TEXTURE_IMAGE_UNITS
                    case 0x8DFB: return 32; // MAX_COMBINED_TEXTURE_IMAGE_UNITS
                    case 0x0D3A: return new Int32Array([16384, 16384]); // MAX_VIEWPORT_DIMS
                    case 0x8824: return 16384; // MAX_RENDERBUFFER_SIZE
                    case 0x8B49: return 16; // MAX_VERTEX_ATTRIBS
                    case 0x8B4A: return 4096; // MAX_VERTEX_UNIFORM_VECTORS
                    case 0x8B4B: return 30; // MAX_VARYING_VECTORS
                    case 0x8B4C: return 4096; // MAX_FRAGMENT_UNIFORM_VECTORS
                    case 0x8869: return 4; // MAX_VERTEX_UNIFORM_COMPONENTS
                    case 0x8DFD: return 16; // MAX_TEXTURE_MAX_ANISOTROPY_EXT
                    
                    // Color/depth/stencil
                    case 0x8D50: return new Int32Array([8, 8, 8, 8]); // RGBA_BITS
                    case 0x0D56: return 24; // DEPTH_BITS
                    case 0x0D57: return 8; // STENCIL_BITS
                    
                    default: return 1;
                }
            },
            
            getSupportedExtensions: function() {
                return [
                    'ANGLE_instanced_arrays',
                    'EXT_blend_minmax',
                    'EXT_color_buffer_half_float',
                    'EXT_disjoint_timer_query',
                    'EXT_frag_depth',
                    'EXT_shader_texture_lod',
                    'EXT_texture_compression_rgtc',
                    'EXT_texture_filter_anisotropic',
                    'EXT_sRGB',
                    'KHR_parallel_shader_compile',
                    'OES_element_index_uint',
                    'OES_fbo_render_mipmap',
                    'OES_standard_derivatives',
                    'OES_texture_float',
                    'OES_texture_float_linear',
                    'OES_texture_half_float',
                    'OES_texture_half_float_linear',
                    'OES_vertex_array_object',
                    'WEBGL_color_buffer_float',
                    'WEBGL_compressed_texture_s3tc',
                    'WEBGL_compressed_texture_s3tc_srgb',
                    'WEBGL_debug_shaders',
                    'WEBGL_depth_texture',
                    'WEBGL_draw_buffers',
                    'WEBGL_lose_context'
                ];
            },
            
            getExtension: function(name) {
                if (!name) return null;
                const n = String(name).toLowerCase();
                // Block debug renderer info
                if (n === 'webgl_debug_renderer_info') return null;
                // Return fake extension objects for others
                return { 
                    name: name,
                    UNMASKED_VENDOR_WEBGL: 0x9245,
                    UNMASKED_RENDERER_WEBGL: 0x9246
                };
            },
            
            getContextAttributes: function() {
                return {
                    alpha: true,
                    antialias: true,
                    depth: true,
                    desynchronized: false,
                    failIfMajorPerformanceCaveat: false,
                    powerPreference: 'default',
                    premultipliedAlpha: true,
                    preserveDrawingBuffer: false,
                    stencil: false
                };
            },
            
            getShaderPrecisionFormat: function(shaderType, precisionType) {
                return {
                    precision: 23,
                    rangeMin: 127,
                    rangeMax: 127
                };
            },
            
            // Essential methods for functionality
            createBuffer: () => ({}),
            createTexture: () => ({}),
            createProgram: () => ({}),
            createShader: () => ({}),
            createFramebuffer: () => ({}),
            createRenderbuffer: () => ({}),
            
            // State methods
            enable: () => {},
            disable: () => {},
            clear: () => {},
            clearColor: () => {},
            viewport: () => {},
            
            // Shader methods
            shaderSource: () => {},
            compileShader: () => {},
            attachShader: () => {},
            linkProgram: () => {},
            useProgram: () => {},
            
            // Buffer methods
            bindBuffer: () => {},
            bufferData: () => {},
            
            // Texture methods
            bindTexture: () => {},
            texImage2D: () => {},
            texParameteri: () => {},
            
            // Drawing methods
            drawArrays: () => {},
            drawElements: () => {},
            
            // Attribute methods
            getAttribLocation: () => 0,
            enableVertexAttribArray: () => {},
            vertexAttribPointer: () => {},
            
            // Uniform methods
            getUniformLocation: () => ({}),
            uniform1f: () => {},
            uniform2f: () => {},
            uniform3f: () => {},
            uniform4f: () => {},
            uniformMatrix4fv: () => {},
            
            // Error handling
            getError: () => 0, // GL_NO_ERROR
            
            // Info methods
            getProgramParameter: () => true,
            getShaderParameter: () => true,
            getProgramInfoLog: () => '',
            getShaderInfoLog: () => ''
        };
        
        return context;
    }
    
    // FORCE override getContext to ALWAYS return a WebGL context
    if (HTMLCanvasElement && HTMLCanvasElement.prototype) {
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
            value: function(contextType, ...args) {
                if (contextType) {
                    const type = String(contextType).toLowerCase();
                    if (type.includes('webgl') || type === 'experimental-webgl' || type === 'webgl2') {
                        console.log('🔧 FORCING WebGL context:', contextType);
                        
                        // Try to get real context first
                        try {
                            const realContext = originalGetContext.apply(this, [contextType, ...args]);
                            if (realContext) {
                                // Real WebGL works, just spoof the parameters
                                const originalGetParameter = realContext.getParameter;
                                realContext.getParameter = function(pname) {
                                    switch(pname) {
                                        case 0x1F00: return 'WebKit';
                                        case 0x1F01: return 'WebKit WebGL';
                                        case 0x9245: return fakeVendor;
                                        case 0x9246: return fakeRenderer;
                                        default: return originalGetParameter.apply(this, arguments);
                                    }
                                };
                                
                                const originalGetExtension = realContext.getExtension;
                                realContext.getExtension = function(name) {
                                    if (name && name.toLowerCase() === 'webgl_debug_renderer_info') return null;
                                    return originalGetExtension.apply(this, arguments);
                                };
                                
                                console.log('✅ Real WebGL context spoofed');
                                return realContext;
                            }
                        } catch (e) {
                            console.log('⚠️ Real WebGL failed, using fake context');
                        }
                        
                        // Real WebGL failed or disabled, return complete fake context
                        const fakeContext = createCompleteWebGLContext(type);
                        fakeContext.canvas = this;
                        console.log('✅ Fake WebGL context created');
                        return fakeContext;
                    }
                }
                return originalGetContext.apply(this, args);
            },
            writable: false,
            configurable: false
        });
        
        console.log('✅ WebGL FORCED to be available!');
    }
    
})();
