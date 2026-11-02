"use strict";

/**
 * Privacy Settings Synchronization Script
 * Ensures clean storage environment without leaving detectable traces on websites.
 */

(function() {
    'use strict';
    
    try {
        const keysToRemove = [
            'ks_privacy_master', 'ks_webgl_protection', 'ks_canvas_protection',
            'ks_audio_protection', 'ks_font_protection', 'ks_screen_spoofing',
            'ks_battery_protection', 'ks_memory_spoofing', 'ks_hardware_spoofing',
            'ks_language_spoofing', 'ks_settings_synced', '__ks_cached_tz__'
        ];
        keysToRemove.forEach(k => {
            try { localStorage.removeItem(k); } catch (_) {}
        });
    } catch (_) {}
})();
