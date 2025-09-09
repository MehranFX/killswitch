/**
 * WebGL Spoofer - Runs in MAIN world to spoof WebGL fingerprinting
 */

(function() {
    'use strict';
    
    // Generate consistent fake WebGL data
    console.log('🎭 WebGL Spoofer: Starting WebGL fingerprint spoofing...');
    
    // Fake WebGL data that changes per session but stays consistent within session
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
    
    // Create fake WebGL context
    function createFakeWebGLContext(contextType) {
        const fakeContext = {
            // Basic WebGL properties
            canvas: null,
            drawingBufferWidth: 300,
            drawingBufferHeight: 150,
            
            // Fake getParameter method
            getParameter: function(pname) {
                switch(pname) {
                    case 0x1F00: return 'WebKit'; // VENDOR
                    case 0x1F01: return 'WebKit WebGL'; // RENDERER
                    case 0x1F02: return 'WebGL 1.0 (OpenGL ES 2.0 Chromium)'; // VERSION
                    case 0x8B8C: return 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)'; // SHADING_LANGUAGE_VERSION
                    case 0x9245: return fakeVendor; // UNMASKED_VENDOR_WEBGL
                    case 0x9246: return fakeRenderer; // UNMASKED_RENDERER_WEBGL
                    case 0x0D33: return 'WebGL 1.0'; // MAX_TEXTURE_SIZE
                    case 0x8073: return 16; // MAX_TEXTURE_IMAGE_UNITS
                    case 0x8B4D: return 16; // MAX_VERTEX_TEXTURE_IMAGE_UNITS
                    case 0x8DFB: return 16; // MAX_COMBINED_TEXTURE_IMAGE_UNITS
                    case 0x0D3A: return 16384; // MAX_VIEWPORT_DIMS
                    default: return null;
                }
            },
            
            // Fake getSupportedExtensions
            getSupportedExtensions: function() {
                return [
                    'ANGLE_instanced_arrays',
                    'EXT_blend_minmax',
                    'EXT_color_buffer_half_float',
                    'EXT_disjoint_timer_query',
                    'EXT_frag_depth',
                    'EXT_shader_texture_lod',
                    'EXT_texture_filter_anisotropic',
                    'OES_element_index_uint',
                    'OES_standard_derivatives',
                    'OES_texture_float',
                    'OES_texture_half_float',
                    'OES_vertex_array_object',
                    'WEBGL_color_buffer_float',
                    'WEBGL_compressed_texture_s3tc',
                    'WEBGL_debug_shaders',
                    'WEBGL_depth_texture',
                    'WEBGL_lose_context'
                ];
            },
            
            // Fake getExtension
            getExtension: function(name) {
                if (!name) return null;
                const n = String(name).toLowerCase();
                // Block debug renderer info
                if (n === 'webgl_debug_renderer_info') return null;
                // Return fake extension objects for others
                return { name: name };
            },
            
            // Add more fake methods
            createBuffer: function() { return {}; },
            createTexture: function() { return {}; },
            createProgram: function() { return {}; },
            createShader: function() { return {}; },
            getShaderPrecisionFormat: function() {
                return {
                    precision: 23,
                    rangeMin: 127,
                    rangeMax: 127
                };
            }
        };
        
        // Add all missing WebGL methods as no-ops
        const webglMethods = [
            'activeTexture', 'attachShader', 'bindAttribLocation', 'bindBuffer', 'bindFramebuffer',
            'bindRenderbuffer', 'bindTexture', 'blendColor', 'blendEquation', 'blendEquationSeparate',
            'blendFunc', 'blendFuncSeparate', 'bufferData', 'bufferSubData', 'checkFramebufferStatus',
            'clear', 'clearColor', 'clearDepth', 'clearStencil', 'colorMask', 'compileShader',
            'copyTexImage2D', 'copyTexSubImage2D', 'createFramebuffer', 'createRenderbuffer',
            'cullFace', 'deleteBuffer', 'deleteFramebuffer', 'deleteProgram', 'deleteRenderbuffer',
            'deleteShader', 'deleteTexture', 'depthFunc', 'depthMask', 'depthRange', 'detachShader',
            'disable', 'disableVertexAttribArray', 'drawArrays', 'drawElements', 'enable',
            'enableVertexAttribArray', 'finish', 'flush', 'framebufferRenderbuffer', 'framebufferTexture2D',
            'frontFace', 'generateMipmap', 'getActiveAttrib', 'getActiveUniform', 'getAttachedShaders',
            'getAttribLocation', 'getBufferParameter', 'getContextAttributes', 'getError',
            'getFramebufferAttachmentParameter', 'getProgramParameter', 'getProgramInfoLog',
            'getRenderbufferParameter', 'getShaderParameter', 'getShaderInfoLog', 'getShaderSource',
            'getTexParameter', 'getUniform', 'getUniformLocation', 'getVertexAttrib',
            'getVertexAttribOffset', 'hint', 'isBuffer', 'isEnabled', 'isFramebuffer', 'isProgram',
            'isRenderbuffer', 'isShader', 'isTexture', 'lineWidth', 'linkProgram', 'pixelStorei',
            'polygonOffset', 'readPixels', 'renderbufferStorage', 'sampleCoverage', 'scissor',
            'shaderSource', 'stencilFunc', 'stencilFuncSeparate', 'stencilMask', 'stencilMaskSeparate',
            'stencilOp', 'stencilOpSeparate', 'texImage2D', 'texParameterf', 'texParameteri',
            'texSubImage2D', 'uniform1f', 'uniform1fv', 'uniform1i', 'uniform1iv', 'uniform2f',
            'uniform2fv', 'uniform2i', 'uniform2iv', 'uniform3f', 'uniform3fv', 'uniform3i',
            'uniform3iv', 'uniform4f', 'uniform4fv', 'uniform4i', 'uniform4iv', 'uniformMatrix2fv',
            'uniformMatrix3fv', 'uniformMatrix4fv', 'useProgram', 'validateProgram', 'vertexAttrib1f',
            'vertexAttrib1fv', 'vertexAttrib2f', 'vertexAttrib2fv', 'vertexAttrib3f', 'vertexAttrib3fv',
            'vertexAttrib4f', 'vertexAttrib4fv', 'vertexAttribPointer', 'viewport'
        ];
        
        webglMethods.forEach(method => {
            if (!fakeContext[method]) {
                fakeContext[method] = function() { return null; };
            }
        });
        
        return fakeContext;
    }
    
    try {
        // Method 1: Override getContext to return fake WebGL context
        if (HTMLCanvasElement && HTMLCanvasElement.prototype) {
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            
            Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
                value: function(contextType, ...args) {
                    if (contextType) {
                        const type = String(contextType).toLowerCase();
                        if (type.includes('webgl') || type === 'experimental-webgl' || type === 'webgl2') {
                            console.log('🎭 WebGL context SPOOFED:', contextType);
                            const fakeContext = createFakeWebGLContext(contextType);
                            fakeContext.canvas = this;
                            return fakeContext;
                        }
                    }
                    return originalGetContext.apply(this, args);
                },
                writable: false,
                configurable: false
            });
            console.log('✅ HTMLCanvasElement.getContext spoofed');
        }
    } catch (e) {
        console.log('⚠️ Could not spoof HTMLCanvasElement.getContext:', e.message);
    }
    
    try {
        // Method 2: Spoof OffscreenCanvas WebGL
        if (window.OffscreenCanvas && OffscreenCanvas.prototype) {
            const originalOffscreenGetContext = OffscreenCanvas.prototype.getContext;
            
            Object.defineProperty(OffscreenCanvas.prototype, 'getContext', {
                value: function(contextType, ...args) {
                    if (contextType) {
                        const type = String(contextType).toLowerCase();
                        if (type.includes('webgl') || type === 'experimental-webgl' || type === 'webgl2') {
                            console.log('🎭 OffscreenCanvas WebGL SPOOFED:', contextType);
                            const fakeContext = createFakeWebGLContext(contextType);
                            fakeContext.canvas = this;
                            return fakeContext;
                        }
                    }
                    return originalOffscreenGetContext.apply(this, args);
                },
                writable: false,
                configurable: false
            });
            console.log('✅ OffscreenCanvas.getContext spoofed');
        }
    } catch (e) {
        console.log('⚠️ Could not spoof OffscreenCanvas.getContext:', e.message);
    }
    
    try {
        // Method 3: Spoof WebGL constructors instead of removing them
        if (window.WebGLRenderingContext) {
            const OriginalWebGLRenderingContext = window.WebGLRenderingContext;
            window.WebGLRenderingContext = function() {
                console.log('🎭 WebGLRenderingContext constructor spoofed');
                return createFakeWebGLContext('webgl');
            };
            // Copy static properties
            Object.setPrototypeOf(window.WebGLRenderingContext, OriginalWebGLRenderingContext);
            console.log('✅ WebGLRenderingContext spoofed');
        }
        
        if (window.WebGL2RenderingContext) {
            const OriginalWebGL2RenderingContext = window.WebGL2RenderingContext;
            window.WebGL2RenderingContext = function() {
                console.log('🎭 WebGL2RenderingContext constructor spoofed');
                return createFakeWebGLContext('webgl2');
            };
            // Copy static properties
            Object.setPrototypeOf(window.WebGL2RenderingContext, OriginalWebGL2RenderingContext);
            console.log('✅ WebGL2RenderingContext spoofed');
        }
    } catch (e) {
        console.log('⚠️ Could not spoof WebGL constructors:', e.message);
    }
    
    try {
        // Method 4: Spoof WebGL through createElement override
        if (document.createElement) {
            const originalCreateElement = document.createElement;
            document.createElement = function(tagName) {
                const element = originalCreateElement.apply(this, arguments);
                if (tagName && tagName.toLowerCase() === 'canvas') {
                    try {
                        // Override getContext on newly created canvas elements
                        Object.defineProperty(element, 'getContext', {
                            value: function(contextType, ...args) {
                                if (contextType) {
                                    const type = String(contextType).toLowerCase();
                                    if (type.includes('webgl') || type === 'experimental-webgl' || type === 'webgl2') {
                                        console.log('🎭 Dynamic Canvas WebGL SPOOFED:', contextType);
                                        const fakeContext = createFakeWebGLContext(contextType);
                                        fakeContext.canvas = this;
                                        return fakeContext;
                                    }
                                }
                                return HTMLCanvasElement.prototype.getContext.apply(this, args);
                            },
                            writable: false,
                            configurable: false
                        });
                    } catch (e) {
                        // If we can't override, log the error
                        console.log('⚠️ Could not spoof canvas getContext:', e.message);
                    }
                }
                return element;
            };
            console.log('✅ document.createElement spoofed');
        }
    } catch (e) {
        console.log('⚠️ Could not spoof createElement:', e.message);
    }
    
    console.log('✅ WebGL Spoofer: WebGL fingerprint spoofing applied in MAIN world');
    
})();
