"use strict";

/**
 * Utility functions for validation, security, and common operations
 */

class ValidationUtils {
    /**
     * Validate IPv4 address
     * @param {string} ip - IP address to validate
     * @returns {boolean} - True if valid IPv4
     */
    static isValidIPv4(ip) {
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipv4Regex.test(ip);
    }

    /**
     * Validate IPv6 address
     * @param {string} ip - IP address to validate
     * @returns {boolean} - True if valid IPv6
     */
    static isValidIPv6(ip) {
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv6Regex.test(ip);
    }

    /**
     * Validate IP address (both IPv4 and IPv6)
     * @param {string} ip - IP address to validate
     * @returns {boolean} - True if valid IP
     */
    static isValidIP(ip) {
        if (!ip || typeof ip !== 'string') return false;
        return this.isValidIPv4(ip) || this.isValidIPv6(ip);
    }

    /**
     * Validate URL
     * @param {string} url - URL to validate
     * @returns {boolean} - True if valid URL
     */
    static isValidURL(url) {
        if (!url || typeof url !== 'string') return false;
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate domain name
     * @param {string} domain - Domain to validate
     * @returns {boolean} - True if valid domain
     */
    static isValidDomain(domain) {
        if (!domain || typeof domain !== 'string') return false;
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
        return domainRegex.test(domain);
    }
}

class SecurityUtils {
    /**
     * Sanitize input to prevent XSS
     * @param {string} input - Input to sanitize
     * @returns {string} - Sanitized input
     */
    static sanitizeInput(input) {
        if (!input || typeof input !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    /**
     * Escape HTML characters
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    static escapeHTML(text) {
        if (!text || typeof text !== 'string') return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
}

class IPUtils {
    /**
     * Multiple IP services for redundancy
     */
    static IP_SERVICES = [
        'https://api.ipify.org',
        'https://ipapi.co/ip/',
        'https://api.myip.com',
        'https://ipinfo.io/ip'
    ];

    /**
     * Cache duration for IP (5 minutes)
     */
    static IP_CACHE_DURATION = 5 * 60 * 1000;

    /**
     * Get public IP with fallback services
     * @returns {Promise<string>} - Public IP address
     */
    static async getPublicIP() {
        for (const service of this.IP_SERVICES) {
            try {
                const response = await fetch(service, {
                    method: 'GET',
                    timeout: 5000
                });
                
                if (response.ok) {
                    const ip = (await response.text()).trim();
                    if (ValidationUtils.isValidIP(ip)) {
                        return ip;
                    }
                }
            } catch (error) {
                console.warn(`Failed to get IP from ${service}:`, error);
            }
        }
        throw new Error('All IP services failed');
    }

    /**
     * Get cached IP or fetch new one
     * @returns {Promise<string>} - Public IP address
     */
    static async getCachedIP() {
        try {
            const cached = await chrome.storage.local.get(['cachedIP', 'ipTimestamp']);
            const now = Date.now();
            
            if (cached.cachedIP && cached.ipTimestamp && 
                (now - cached.ipTimestamp) < this.IP_CACHE_DURATION) {
                return cached.cachedIP;
            }
            
            const ip = await this.getPublicIP();
            await chrome.storage.local.set({
                cachedIP: ip,
                ipTimestamp: now
            });
            return ip;
        } catch (error) {
            console.error('Error getting cached IP:', error);
            throw error;
        }
    }
}

class ErrorHandler {
    /**
     * Handle errors with logging and user notification
     * @param {Error} error - Error object
     * @param {string} context - Context where error occurred
     */
    static async handle(error, context) {
        console.error(`Error in ${context}:`, error);
        
        // Log error for debugging
        await this.logError(error, context);
        
        // Show user-friendly message
        await this.showUserMessage(error, context);
    }

    /**
     * Log error to storage
     * @param {Error} error - Error object
     * @param {string} context - Context where error occurred
     */
    static async logError(error, context) {
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

    /**
     * Show user-friendly error message
     * @param {Error} error - Error object
     * @param {string} context - Context where error occurred
     */
    static async showUserMessage(error, context) {
        let message = 'An error occurred. Please try again.';
        
        if (context.includes('IP')) {
            message = 'Failed to get your IP address. Please check your internet connection.';
        } else if (context.includes('storage')) {
            message = 'Failed to save settings. Please try again.';
        } else if (context.includes('validation')) {
            message = 'Invalid input. Please check your entries.';
        }
        
        // Show message in popup or options page
        const messageElement = document.getElementById('message');
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.style.color = 'red';
            setTimeout(() => {
                messageElement.textContent = '';
                messageElement.style.color = '';
            }, 5000);
        }
    }
}

class URLUtils {
    /**
     * Extract hostname from URL
     * @param {string} url - URL to extract hostname from
     * @returns {string|null} - Hostname or null if invalid
     */
    static getHostFromURL(url) {
        if (!url || typeof url !== 'string') return null;
        
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return null;
        }
    }

    /**
     * Check if URL matches domain pattern
     * @param {string} accessUrl - URL being accessed
     * @param {string} urlPattern - Pattern to match against
     * @returns {boolean} - True if matches
     */
    static matchingDomainRegex(accessUrl, urlPattern) {
        if (!accessUrl || !urlPattern) return false;
        
        try {
            // If pattern doesn't include protocol, treat as domain
            if (!urlPattern.includes('http')) {
                const hostname = this.getHostFromURL(`https://${urlPattern}`);
                if (hostname === urlPattern) {
                    const escapedPattern = urlPattern.replace(/\./g, '\\.');
                    const regex = new RegExp(`https?://${escapedPattern}/.*`, 'gi');
                    return regex.test(accessUrl);
                }
            }
            
            // Handle wildcard patterns
            if (urlPattern.includes('*')) {
                const escapedPattern = urlPattern.replace(/\*/g, '.*');
                const regex = new RegExp(escapedPattern, 'gi');
                return regex.test(accessUrl);
            }
            
            // Exact match
            return accessUrl === urlPattern;
        } catch (error) {
            console.error('Error in matchingDomainRegex:', error);
            return false;
        }
    }
}

// Export for use in other files
window.ValidationUtils = ValidationUtils;
window.SecurityUtils = SecurityUtils;
window.IPUtils = IPUtils;
window.ErrorHandler = ErrorHandler;
window.URLUtils = URLUtils;
