"use strict";

/**
 * Enhanced background script with better error handling and async operations
 */

class BackgroundManager {
    /**
     * Update local storage with current settings
     */
    static async updateLocalStorage() {
        try {
            const urlData = await chrome.storage.local.get(['urls']);
            const ipData = await chrome.storage.local.get(['allowed_ips']);
            
            localStorage.urls = urlData.urls || '';
            localStorage.allowed_ips = ipData.allowed_ips || '';
            
        } catch (error) {
            await ErrorHandler.handle(error, 'updateLocalStorage');
        }
    }

    /**
     * Set tab color based on status
     * @param {number} tabID - Tab ID
     */
    static async setColor(tabID) {
        try {
            const tabColor = localStorage[`tabColors${tabID}`];
            let iconPath = '/img/icon-48x48-grey.png';
            
            if (tabColor === 'red') {
                iconPath = '/img/icon-48x48-red.png';
            } else if (tabColor === 'green') {
                iconPath = '/img/icon-48x48-green.png';
            }
            
            await chrome.action.setIcon({ path: iconPath });
            
        } catch (error) {
            await ErrorHandler.handle(error, 'setColor');
        }
    }

    /**
     * Validate IP and determine if request should be blocked
     * @param {Object} details - Request details
     * @returns {Object} - Blocking decision
     */
    static async validateIP(details) {
        try {
            const accessUrl = details.url;
            const storedUrls = (localStorage.urls || '').split(',');
            const storedIPs = (localStorage.allowed_ips || '').substring(0, (localStorage.allowed_ips || '').length - 1).split('|,');
            
            let shouldBlock = false;
            let isDomain = false;
            let domainIndex = -1;
            
            // Check if access URL matches any stored domain
            for (let i = 0; i < storedUrls.length; i++) {
                const domainMatches = URLUtils.matchingDomainRegex(accessUrl, storedUrls[i]);
                if (domainMatches) {
                    isDomain = true;
                    domainIndex = i;
                    break;
                }
            }
            
            if (isDomain && domainIndex >= 0) {
                const currentIPs = storedIPs[domainIndex] ? storedIPs[domainIndex].split(',') : [];
                
                try {
                    const userIP = await IPUtils.getCachedIP();
                    
                    if (!ValidationUtils.isValidIP(userIP)) {
                        throw new Error(`Invalid IP address received: ${userIP}`);
                    }
                    
                    shouldBlock = this.checkIPRules(userIP, currentIPs);
                    
                } catch (error) {
                    await ErrorHandler.handle(error, 'validateIP - IP fetch');
                    shouldBlock = true; // Block on error for security
                }
            }
            
            // Update tab color
            const tabId = localStorage.current_tab_id || details.tabId;
            if (shouldBlock) {
                localStorage.setItem(`tabColors${tabId}`, 'red');
            } else if (isDomain) {
                localStorage.setItem(`tabColors${tabId}`, 'green');
            } else {
                localStorage.setItem(`tabColors${tabId}`, 'grey');
            }
            
            await this.setColor(tabId);
            return { cancel: shouldBlock };
            
        } catch (error) {
            await ErrorHandler.handle(error, 'validateIP');
            return { cancel: false };
        }
    }

    /**
     * Check IP rules against current IP
     * @param {string} userIP - Current user IP
     * @param {Array} rules - IP rules array
     * @returns {boolean} - Whether to block
     */
    static checkIPRules(userIP, rules) {
        if (!rules || rules.length === 0) return false;
        
        const whitelistExists = rules.some(ip => !ip.startsWith('!'));
        
        for (const rule of rules) {
            const isNegative = rule.startsWith('!');
            const ip = isNegative ? rule.substring(1) : rule;
            
            if (isNegative && userIP === ip) {
                return true; // Block if IP is in blacklist
            } else if (!isNegative && userIP === ip) {
                return false; // Allow if IP is in whitelist
            }
        }
        
        // If whitelist exists and IP not found, block
        // If only blacklist exists and IP not found, allow
        return whitelistExists;
    }

    /**
     * Initialize background script
     */
    static async initialize() {
        try {
            await this.updateLocalStorage();
            
            // Set up message listener
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                this.handleMessage(request, sender, sendResponse);
                return true; // Keep message channel open for async response
            });
            
            // Set up tab activation listener
            chrome.tabs.onActivated.addListener(async (info) => {
                localStorage.current_tab_id = info.tabId;
                await this.setColor(info.tabId);
            });
            
            // Note: webRequest API is not available in Manifest V3
            // We'll use declarativeNetRequest instead for blocking
            // This is a simplified version - full implementation would require
            // declarativeNetRequest rules and dynamic rule management
            
        } catch (error) {
            await ErrorHandler.handle(error, 'initialize');
        }
    }

    /**
     * Handle messages from other parts of the extension
     * @param {Object} request - Message request
     * @param {Object} sender - Message sender
     * @param {Function} sendResponse - Response function
     */
    static async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.type) {
                case 'update':
                    await this.updateLocalStorage();
                    sendResponse({ success: true });
                    break;
                    
                case 'refresh':
                    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
                    if (tabs[0]) {
                        const code = 'window.setTimeout(function(){window.location.reload();},500);';
                        await chrome.scripting.executeScript({
                            target: { tabId: tabs[0].id },
                            func: () => {
                                window.setTimeout(function(){window.location.reload();},500);
                            }
                        });
                    }
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            await ErrorHandler.handle(error, 'handleMessage');
            sendResponse({ success: false, error: error.message });
        }
    }
}

// Legacy functions for backward compatibility
function updateLocalStorage() {
    BackgroundManager.updateLocalStorage();
}

function setColor(tabID) {
    BackgroundManager.setColor(tabID);
}

function validateIP(details) {
    return BackgroundManager.validateIP(details);
}

// Initialize when script loads
BackgroundManager.initialize();
