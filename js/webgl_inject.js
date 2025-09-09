/**
 * WebGL Inject Script - Injected directly into page context
 * This runs BEFORE any site scripts and spoofs WebGL completely
 */

(function() {
    'use strict';
    
    console.log('🎭 WebGL Inject: Starting EARLY WebGL spoofing...');
    
    // Generate consistent fake WebGL data per session
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
    
    // Create comprehensive fake WebGL context
    function createFakeWebGLContext(contextType) {
        console.log('🎭 Creating fake WebGL context for:', contextType);
        
        const fakeContext = {
            canvas: null,
            drawingBufferWidth: 300,
            drawingBufferHeight: 150,
            
            // Core WebGL methods
            getParameter: function(pname) {
                switch(pname) {
                    case 0x1F00: return 'WebKit'; // VENDOR
                    case 0x1F01: return 'WebKit WebGL'; // RENDERER
                    case 0x1F02: return contextType === 'webgl2' ? 'WebGL 2.0' : 'WebGL 1.0'; // VERSION
                    case 0x8B8C: return contextType === 'webgl2' ? 'WebGL GLSL ES 3.00' : 'WebGL GLSL ES 1.0'; // SHADING_LANGUAGE_VERSION
                    case 0x9245: return fakeVendor; // UNMASKED_VENDOR_WEBGL
                    case 0x9246: return fakeRenderer; // UNMASKED_RENDERER_WEBGL
                    case 0x0D33: return 16384; // MAX_TEXTURE_SIZE
                    case 0x8073: return 16; // MAX_TEXTURE_IMAGE_UNITS
                    case 0x8B4D: return 16; // MAX_VERTEX_TEXTURE_IMAGE_UNITS
                    case 0x8DFB: return 32; // MAX_COMBINED_TEXTURE_IMAGE_UNITS
                    case 0x0D3A: return new Int32Array([16384, 16384]); // MAX_VIEWPORT_DIMS
                    case 0x8824: return 16; // MAX_RENDERBUFFER_SIZE
                    case 0x8B49: return 4096; // MAX_VERTEX_ATTRIBS
                    case 0x8B4A: return 16; // MAX_VERTEX_UNIFORM_VECTORS
                    case 0x8B4B: return 16; // MAX_VARYING_VECTORS
                    case 0x8B4C: return 1024; // MAX_FRAGMENT_UNIFORM_VECTORS
                    default: return 0;
                }
            },
            
            getSupportedExtensions: function() {
                return [
                    'ANGLE_instanced_arrays',
                    'EXT_blend_minmax',
                    'EXT_color_buffer_half_float',
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
                    'WEBGL_depth_texture',
                    'WEBGL_lose_context'
                ];
            },
            
            getExtension: function(name) {
                if (!name) return null;
                const n = String(name).toLowerCase();
                if (n === 'webgl_debug_renderer_info') return null; // Block debug info
                return { name: name }; // Return fake extension
            },
            
            getContextAttributes: function() {
                return {
                    alpha: true,
                    antialias: true,
                    depth: true,
                    failIfMajorPerformanceCaveat: false,
                    powerPreference: 'default',
                    premultipliedAlpha: true,
                    preserveDrawingBuffer: false,
                    stencil: false
                };
            },
            
            getShaderPrecisionFormat: function() {
                return {
                    precision: 23,
                    rangeMin: 127,
                    rangeMax: 127
                };
            }
        };
        
        // Add all WebGL methods as no-ops or fake returns
        const webglMethods = [
            'activeTexture', 'attachShader', 'bindAttribLocation', 'bindBuffer', 'bindFramebuffer',
            'bindRenderbuffer', 'bindTexture', 'blendColor', 'blendEquation', 'blendEquationSeparate',
            'blendFunc', 'blendFuncSeparate', 'bufferData', 'bufferSubData', 'checkFramebufferStatus',
            'clear', 'clearColor', 'clearDepth', 'clearStencil', 'colorMask', 'compileShader',
            'copyTexImage2D', 'copyTexSubImage2D', 'createBuffer', 'createFramebuffer', 'createProgram',
            'createRenderbuffer', 'createShader', 'createTexture', 'cullFace', 'deleteBuffer',
            'deleteFramebuffer', 'deleteProgram', 'deleteRenderbuffer', 'deleteShader', 'deleteTexture',
            'depthFunc', 'depthMask', 'depthRange', 'detachShader', 'disable', 'disableVertexAttribArray',
            'drawArrays', 'drawElements', 'enable', 'enableVertexAttribArray', 'finish', 'flush',
            'framebufferRenderbuffer', 'framebufferTexture2D', 'frontFace', 'generateMipmap',
            'getActiveAttrib', 'getActiveUniform', 'getAttachedShaders', 'getAttribLocation',
            'getBufferParameter', 'getError', 'getFramebufferAttachmentParameter', 'getProgramParameter',
            'getProgramInfoLog', 'getRenderbufferParameter', 'getShaderParameter', 'getShaderInfoLog',
            'getShaderSource', 'getTexParameter', 'getUniform', 'getUniformLocation', 'getVertexAttrib',
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
                fakeContext[method] = function() { 
                    return method.includes('create') ? {} : null; 
                };
            }
        });
        
        return fakeContext;
    }
    
    // IMMEDIATELY override getContext before ANY site script runs
    if (HTMLCanvasElement && HTMLCanvasElement.prototype) {
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        
        HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
            if (contextType) {
                const type = String(contextType).toLowerCase();
                if (type.includes('webgl') || type === 'experimental-webgl' || type === 'webgl2') {
                    console.log('🎭 EARLY WebGL context SPOOFED:', contextType);
                    
                    // Create a REAL WebGL context first, then modify it
                    const realContext = originalGetContext.apply(this, [contextType, ...args]);
                    if (!realContext) {
                        // If real WebGL fails, return fake one
                        const fakeContext = createFakeWebGLContext(type);
                        fakeContext.canvas = this;
                        return fakeContext;
                    }
                    
                    // Override specific methods on the REAL context
                    const originalGetParameter = realContext.getParameter;
                    realContext.getParameter = function(pname) {
                        switch(pname) {
                            case 0x1F00: return 'WebKit'; // VENDOR
                            case 0x1F01: return 'WebKit WebGL'; // RENDERER  
                            case 0x9245: return fakeVendor; // UNMASKED_VENDOR_WEBGL
                            case 0x9246: return fakeRenderer; // UNMASKED_RENDERER_WEBGL
                            default: return originalGetParameter.apply(this, arguments);
                        }
                    };
                    
                    // Override getExtension to block debug info
                    const originalGetExtension = realContext.getExtension;
                    realContext.getExtension = function(name) {
                        if (!name) return originalGetExtension.apply(this, arguments);
                        const n = String(name).toLowerCase();
                        if (n === 'webgl_debug_renderer_info') {
                            console.log('🚫 Blocked debug renderer info extension');
                            return null;
                        }
                        return originalGetExtension.apply(this, arguments);
                    };
                    
                    console.log('✅ Real WebGL context spoofed with fake vendor/renderer');
                    return realContext;
                }
            }
            return originalGetContext.apply(this, args);
        };
        
        console.log('✅ EARLY WebGL spoofing applied!');
    }
    
    // Also override WebGL feature detection
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        value: HTMLCanvasElement.prototype.getContext,
        writable: false,
        configurable: false
    });
    
})();
