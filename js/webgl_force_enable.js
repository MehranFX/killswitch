"use strict";

// This script runs in the ISOLATED world.
// Its only job is to read the setting and inject the spoofer script into the MAIN world if needed.

chrome.storage.local.get(['webgl_protection'], function(result) {
    const webglProtectionEnabled = result.webgl_protection !== false; // Default to true

    if (webglProtectionEnabled) {
        // Log removed
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL('js/webgl_spoofer.js');
        (document.head || document.documentElement).appendChild(s);
        s.onload = function() {
            s.remove();
        };
    } else {
        // Log removed
    }
});
