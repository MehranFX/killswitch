"use strict";

/**
 * Enhanced popup functionality with better error handling and async operations
 */

class PopupManager {
    /**
     * Store URL with enhanced validation and error handling
     * @param {boolean} domainOnly - Whether to store only domain
     * @param {boolean} whitelist - Whether to whitelist or blacklist
     */
    static async storeURL(domainOnly, whitelist) {
        try {
            // Show loading state
            this.showLoading(true);
            
            // Get current tab
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            const tab = tabs[0];
            
            if (!tab || !tab.url) {
                throw new Error('No active tab found');
            }
            
            let url = tab.url;
            if (domainOnly) {
                url = URLUtils.getHostFromURL(tab.url);
                if (!url) {
                    throw new Error('Could not extract domain from URL');
                }
            }
            
            // Get public IP
            const ip = await IPUtils.getCachedIP();
            
            // Store the rule
            const ipToStore = whitelist ? ip : `!${ip}`;
            await SettingsManager.storeWhitelist(url, ipToStore, false, null);
            
            // Refresh the page
            await chrome.runtime.sendMessage({type: "refresh"});
            
            // Show success message
            this.showMessage('Rule added successfully!', 'success');
            
            // Close popup after delay
            setTimeout(() => {
                window.close();
            }, 1500);
            
        } catch (error) {
            await ErrorHandler.handle(error, 'storeURL');
            this.showLoading(false);
        }
    }

    /**
     * Set up popup with current IP display
     */
    static async setUpPopup() {
        try {
            this.showLoading(true);
            
            const ip = await IPUtils.getCachedIP();
            const ipElements = document.getElementsByClassName("ip");
            
            for (let i = 0; i < ipElements.length; i++) {
                ipElements[i].textContent = ip;
            }
            
            this.showLoading(false);
            
        } catch (error) {
            await ErrorHandler.handle(error, 'setUpPopup');
            this.showLoading(false);
            
            // Show fallback message
            const ipElements = document.getElementsByClassName("ip");
            for (let i = 0; i < ipElements.length; i++) {
                ipElements[i].textContent = 'Unable to get IP';
            }
        }
    }

    /**
     * Show/hide loading state
     * @param {boolean} show - Whether to show loading
     */
    static showLoading(show) {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
        
        // Disable buttons during loading
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.disabled = show;
        });
    }

    /**
     * Show message to user
     * @param {string} message - Message to show
     * @param {string} type - Message type (success, error, info)
     */
    static showMessage(message, type = 'info') {
        const messageElement = document.getElementById('message') || this.createMessageElement();
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        messageElement.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 3000);
    }

    /**
     * Create message element if it doesn't exist
     * @returns {HTMLElement} - Message element
     */
    static createMessageElement() {
        const messageElement = document.createElement('div');
        messageElement.id = 'message';
        messageElement.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px;
            border-radius: 4px;
            color: white;
            font-size: 12px;
            z-index: 1000;
            display: none;
        `;
        document.body.appendChild(messageElement);
        return messageElement;
    }

    /**
     * Initialize event listeners
     */
    static initializeEventListeners() {
        // Whitelist domain
        const wlDomainBtn = document.getElementById("wl_domain");
        if (wlDomainBtn) {
            wlDomainBtn.addEventListener("click", (e) => {
                e.preventDefault();
                this.storeURL(true, true);
            });
        }

        // Whitelist URL
        const wlUrlBtn = document.getElementById("wl_url");
        if (wlUrlBtn) {
            wlUrlBtn.addEventListener("click", (e) => {
                e.preventDefault();
                this.storeURL(false, true);
            });
        }

        // Blacklist domain
        const blDomainBtn = document.getElementById("bl_domain");
        if (blDomainBtn) {
            blDomainBtn.addEventListener("click", (e) => {
                e.preventDefault();
                this.storeURL(true, false);
            });
        }

        // Blacklist URL
        const blUrlBtn = document.getElementById("bl_url");
        if (blUrlBtn) {
            blUrlBtn.addEventListener("click", (e) => {
                e.preventDefault();
                this.storeURL(false, false);
            });
        }

        // Rules button
        const rulesBtn = document.getElementById("rules");
        if (rulesBtn) {
            rulesBtn.addEventListener("click", (e) => {
                e.preventDefault();
                chrome.runtime.openOptionsPage();
            });
        }
    }
}

// Legacy function for backward compatibility
function storeURL(domainOnly, whitelist) {
    PopupManager.storeURL(domainOnly, whitelist);
}

// Legacy function for backward compatibility
function setUpPopup() {
    PopupManager.setUpPopup();
}

// Initialize when page loads
window.onload = function() {
    PopupManager.initializeEventListeners();
    PopupManager.setUpPopup();
};