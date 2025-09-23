"use strict";

/**
 * Privacy Settings Synchronization Script
 * Runs at document_start in ISOLATED world to sync privacy settings to localStorage
 * This ensures that MAIN world scripts can access settings synchronously
 */

(function() {
    'use strict';
    
    // Sync privacy settings from chrome.storage to localStorage
    chrome.storage.local.get([
        'privacy_master',
        'webgl_protection', 
        'canvas_protection', 
        'audio_protection',
        'font_protection',
        'screen_spoofing',
        'battery_protection',
        'memory_spoofing',
        'hardware_spoofing',
        'language_spoofing'
    ], (result) => {
        try {
            // Sync master privacy toggle
            const privacyMaster = result.privacy_master !== false ? 'on' : 'off';
            localStorage.setItem('ks_privacy_master', privacyMaster);
            
            // Sync individual protection settings
            const webglProtection = result.webgl_protection !== false ? 'on' : 'off';
            localStorage.setItem('ks_webgl_protection', webglProtection);
            
            const canvasProtection = result.canvas_protection !== false ? 'on' : 'off';
            localStorage.setItem('ks_canvas_protection', canvasProtection);
            
            const audioProtection = result.audio_protection !== false ? 'on' : 'off';
            localStorage.setItem('ks_audio_protection', audioProtection);
            
            const fontProtection = result.font_protection !== false ? 'on' : 'off';
            localStorage.setItem('ks_font_protection', fontProtection);
            
            const screenSpoofing = result.screen_spoofing !== false ? 'on' : 'off';
            localStorage.setItem('ks_screen_spoofing', screenSpoofing);
            
            const batteryProtection = result.battery_protection !== false ? 'on' : 'off';
            localStorage.setItem('ks_battery_protection', batteryProtection);
            
            const memorySpoofing = result.memory_spoofing !== false ? 'on' : 'off';
            localStorage.setItem('ks_memory_spoofing', memorySpoofing);
            
            const hardwareSpoofing = result.hardware_spoofing !== false ? 'on' : 'off';
            localStorage.setItem('ks_hardware_spoofing', hardwareSpoofing);
            
            const languageSpoofing = result.language_spoofing !== false ? 'on' : 'off';
            localStorage.setItem('ks_language_spoofing', languageSpoofing);
            
            // Set a flag to indicate settings have been synced
            localStorage.setItem('ks_settings_synced', 'true');
            
        } catch (e) {
            // If localStorage is not available, set a fallback flag
            try {
                sessionStorage.setItem('ks_settings_sync_failed', 'true');
            } catch (e2) {
                // Both localStorage and sessionStorage failed
            }
        }
    });
})();
