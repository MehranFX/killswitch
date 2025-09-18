"use strict";

// Utility classes for settings page
const ValidationUtils = {
    isValidIP: function(ip) {
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    },
    
    isValidDomain: function(domain) {
        if (!domain || typeof domain !== 'string') return false;
        domain = domain.trim();
        if (domain.length === 0) return false;
        
        // Allow wildcards
        if (domain.includes('*')) {
            const wildcardPattern = /^[\*\w\-\.]+$/;
            return wildcardPattern.test(domain);
        }
        
        // Regular domain validation
        const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
        return domainPattern.test(domain) && domain.length <= 253;
    },
    
    isValidURL: function(url) {
        try {
            new URL(url);
            return true;
        } catch {
            // Try with protocol
            try {
                new URL('http://' + url);
                return true;
            } catch {
                return false;
            }
        }
    }
};

const ErrorHandler = {
    handle: async function(error, context) {
        console.error(`[${context}] Error:`, error);
        try {
            const errorLog = {
                message: error.message,
                stack: error.stack,
                context: context,
                timestamp: Date.now()
            };
            
            await chrome.storage.local.set({
                lastError: errorLog
            });
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
    }
};

/**
 * Enhanced settings management with better error handling and validation
 */

class SettingsManager {
    /**
     * Update background script
     */
    static async updateBackground() {
        try {
            await chrome.runtime.sendMessage({type: "update"});
            // Also trigger rule re-evaluation for country rules
            await chrome.runtime.sendMessage({type: "refreshIP"});
        } catch (error) {
            await ErrorHandler.handle(error, 'updateBackground');
        }
    }

    /**
     * Store whitelist/blacklist rule with enhanced validation
     * @param {string} domainString - Domain or URL to store
     * @param {string} ips - IP addresses (comma-separated)
     * @param {boolean} manual - Whether this is a manual entry
     * @param {Function} callback - Callback function
     */
    static async storeWhitelist(domainString, ips, manual, callback) {
        try {
            // Validate inputs
            if (!domainString || !ips) {
                throw new Error('Domain and IP addresses are required');
            }

            // Clean and validate IPs
            const cleanedIPs = ips.replace(/\s/g, '').replace(/\|/g, '');
            const ipArray = cleanedIPs.split(',');
            
            for (const ip of ipArray) {
                if (ip.startsWith('!')) {
                    const cleanIP = ip.substring(1);
                    if (!ValidationUtils.isValidIP(cleanIP)) {
                        throw new Error(`Invalid IP address: ${cleanIP}`);
                    }
                } else {
                    if (!ValidationUtils.isValidIP(ip)) {
                        throw new Error(`Invalid IP address: ${ip}`);
                    }
                }
            }

            // Validate domain
            domainString = domainString.toLowerCase().trim();
            if (!ValidationUtils.isValidURL(domainString) && !ValidationUtils.isValidDomain(domainString)) {
                throw new Error('Invalid domain or URL format');
            }

            // Store in Chrome storage
            await this.saveToStorage(domainString, cleanedIPs, manual);
            
            // Update background
            await this.updateBackground();
            
            if (callback) callback();
            
        } catch (error) {
            await ErrorHandler.handle(error, 'storeWhitelist');
        }
    }

    /**
     * Save data to Chrome storage
     * @param {string} domainString - Domain to save
     * @param {string} ips - IP addresses
     * @param {boolean} manual - Manual entry flag
     */
    static async saveToStorage(domainString, ips, manual) {
        try {
            const urlData = await chrome.storage.local.get(['urls']);
            const ipData = await chrome.storage.local.get(['allowed_ips']);
            
            let urlArray = urlData.urls || [];
            let allowedIPsArray = ipData.allowed_ips || [];
            
            // Check if domain already exists
            const existingIndex = urlArray.findIndex(url => url === domainString);
            
            if (existingIndex === -1) {
                // Add new domain
                urlArray.push(domainString);
                allowedIPsArray.push(ips + '|');
            } else {
                // Update existing domain
                if (!manual) {
                    // Merge with existing IPs
                    const existingIPs = allowedIPsArray[existingIndex].replace(/\|/g, '').split(',');
                    const newIPs = ips.split(',');
                    const mergedIPs = [...new Set([...existingIPs, ...newIPs])];
                    allowedIPsArray[existingIndex] = mergedIPs.join(',') + '|';
                } else {
                    allowedIPsArray[existingIndex] = ips + '|';
                }
            }
            
            // Save to storage
            await chrome.storage.local.set({
                'urls': urlArray,
                'allowed_ips': allowedIPsArray
            });
            
        } catch (error) {
            await ErrorHandler.handle(error, 'saveToStorage');
            throw error;
        }
    }

    /**
     * Delete whitelist rule
     * @param {string} domainString - Domain to delete
     */
    static async deleteWhitelist(domainString) {
        try {
            const urlData = await chrome.storage.local.get(['urls']);
            const ipData = await chrome.storage.local.get(['allowed_ips']);
            
            let urlArray = urlData.urls || [];
            let allowedIPsArray = ipData.allowed_ips || [];
            
            const index = urlArray.findIndex(url => url === domainString);
            if (index !== -1) {
                urlArray.splice(index, 1);
                allowedIPsArray.splice(index, 1);
                
                await chrome.storage.local.set({
                    'urls': urlArray,
                    'allowed_ips': allowedIPsArray
                });
                
                await this.updateBackground();
            }
            
        } catch (error) {
            await ErrorHandler.handle(error, 'deleteWhitelist');
        }
    }
}

// Legacy function for backward compatibility
function updateBackground() {
    SettingsManager.updateBackground();
}

// Legacy function for backward compatibility
function storeWhitelist(domain_string, ips, manual, callback) {
    SettingsManager.storeWhitelist(domain_string, ips, manual, callback);
}

// Legacy function for backward compatibility
function deleteWhitelist(domain_string) {
    SettingsManager.deleteWhitelist(domain_string);
}

// Legacy functions for backward compatibility
function isIP(ipaddress) {
    return ValidationUtils.isValidIP(ipaddress);
}

function getHostFromURL(url) {
    return URLUtils.getHostFromURL(url);
}

function validURL(str) {
    return ValidationUtils.isValidURL(str);
}