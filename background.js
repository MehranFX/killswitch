"use strict";

/**
 * Enhanced background script with better error handling and async operations
 */

// Utility classes (copied from utils.js for service worker compatibility)
class ValidationUtils {
    static isValidIPv4(ip) {
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipv4Regex.test(ip);
    }

    static isValidIPv6(ip) {
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv6Regex.test(ip);
    }

    static isValidIP(ip) {
        if (!ip || typeof ip !== 'string') return false;
        return this.isValidIPv4(ip) || this.isValidIPv6(ip);
    }

    static isValidURL(url) {
        if (!url || typeof url !== 'string') return false;
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static isValidDomain(domain) {
        if (!domain || typeof domain !== 'string') return false;
        
        // Handle wildcard domains
        if (domain.includes('*')) {
            // Simple wildcard validation - allow * at start, middle, or end
            // Examples: *.example.com, example.*, *.example.*
            const parts = domain.split('.');
            
            // Check if all parts are valid (either * or valid domain part)
            for (const part of parts) {
                if (part === '*') continue;
                if (part === '') return false; // Empty part not allowed
                
                // Check if part is valid domain part
                const partRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/;
                if (!partRegex.test(part)) return false;
            }
            
            return true;
        }
        
        // Regular domain validation
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
        return domainRegex.test(domain);
    }
}

class IPUtils {
    static IP_SERVICES = [
        'https://api.ipify.org',
        'https://ipapi.co/ip/',
        'https://api.myip.com',
        'https://ipinfo.io/ip'
    ];

    static IP_CACHE_DURATION = 30 * 1000; // 30 seconds

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

    /**
     * Force refresh IP (bypass cache)
     * @returns {Promise<string>} - Fresh IP address
     */
    static async getFreshIP() {
        try {
            const ip = await this.getPublicIP();
            const now = Date.now();
            await chrome.storage.local.set({
                current_ip: ip,
                last_ip_update: now,
                cachedIP: ip,
                ipTimestamp: now
            });
            return ip;
        } catch (error) {
            console.error('Error getting fresh IP:', error);
            throw error;
        }
    }

    /**
     * Get time remaining until next IP update
     * @returns {Promise<number>} - Time remaining in milliseconds
     */
    static async getTimeUntilNextUpdate() {
        try {
            const cached = await chrome.storage.local.get(['ipTimestamp']);
            const now = Date.now();
            
            if (!cached.ipTimestamp) {
                return 0; // No cache, can update immediately
            }
            
            const timeElapsed = now - cached.ipTimestamp;
            const timeRemaining = this.IP_CACHE_DURATION - timeElapsed;
            
            return Math.max(0, timeRemaining);
        } catch (error) {
            console.error('Error getting time until next update:', error);
            return 0;
        }
    }

    /**
     * Format time remaining as MM:SS
     * @param {number} milliseconds - Time in milliseconds
     * @returns {string} - Formatted time string
     */
    static formatTimeRemaining(milliseconds) {
        const totalSeconds = Math.ceil(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

class ErrorHandler {
    static async handle(error, context) {
        console.error(`Error in ${context}:`, error);
        await this.logError(error, context);
    }

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
}

class URLUtils {
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
     * Convert domain pattern to regex string for declarativeNetRequest
     * @param {string} domain - Domain pattern (supports * wildcard)
     * @returns {string} - Regex string for declarativeNetRequest
     */
    static domainToRegex(domain) {
        if (!domain || typeof domain !== 'string') return '';
        
        console.log(`🔧 Converting domain to regex: ${domain}`);
        
        // Handle wildcards
        if (domain.includes('*')) {
            // For *.binance.* pattern, we want to match:
            // - www.binance.com
            // - api.binance.com  
            // - binance.org
            // - etc.
            
            if (domain === '*.binance.*') {
                // Special case for binance
                const finalRegex = `^https?://.*binance\\.[^/]+/.*`;
                console.log(`🎯 Generated regex for ${domain}: ${finalRegex}`);
                return finalRegex;
            }
            
            // General wildcard handling
            let regexPattern = domain;
            
            // Replace * with appropriate regex patterns
            regexPattern = regexPattern.replace(/\./g, '\\.');  // Escape dots
            regexPattern = regexPattern.replace(/\\\.\*/g, '\\.[^./]+');  // Replace .* with .[^./]+
            regexPattern = regexPattern.replace(/^\*/, '[^./]*');  // Replace leading * 
            regexPattern = regexPattern.replace(/\*$/, '[^./]*');  // Replace trailing *
            
            const finalRegex = `^https?://.*${regexPattern}/.*`;
            console.log(`🎯 Generated regex for ${domain}: ${finalRegex}`);
            return finalRegex;
        } else {
            // Return regex for exact domain match
            const finalRegex = `^https?://(www\\.)?${domain.replace(/\./g, '\\.')}/.*`;
            console.log(`🎯 Generated regex for ${domain}: ${finalRegex}`);
            return finalRegex;
        }
    }

    static matchingDomainRegex(accessUrl, urlPattern) {
        if (!accessUrl || !urlPattern) return false;
        
        try {
            // Extract hostname from access URL
            const accessHostname = this.getHostFromURL(accessUrl);
            if (!accessHostname) return false;
            
            // Handle wildcard patterns
            if (urlPattern.includes('*')) {
                // Convert wildcard pattern to regex
                let regexPattern = urlPattern
                    .replace(/\./g, '\\.')  // Escape dots
                    .replace(/\*/g, '.*');   // Convert * to .*
                
                // If pattern doesn't start with *, add start anchor
                if (!urlPattern.startsWith('*')) {
                    regexPattern = '^' + regexPattern;
                }
                
                // If pattern doesn't end with *, add end anchor
                if (!urlPattern.endsWith('*')) {
                    regexPattern = regexPattern + '$';
                }
                
                const regex = new RegExp(regexPattern, 'i');
                return regex.test(accessHostname);
            }
            
            // Handle exact domain match
            if (!urlPattern.includes('http')) {
                // Remove protocol if present
                const cleanPattern = urlPattern.replace(/^https?:\/\//, '');
                return accessHostname === cleanPattern;
            }
            
            // Handle full URL match
            return accessUrl === urlPattern;
            
        } catch (error) {
            console.error('Error in matchingDomainRegex:', error);
            return false;
        }
    }
}

class BackgroundManager {
    /**
     * Update local storage with current settings
     */
    static async updateLocalStorage() {
        try {
            // No need to copy to localStorage in service worker
            // Data is already available through chrome.storage.local
            console.log('Storage updated successfully');
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
            const tabColorData = await chrome.storage.local.get([`tabColors${tabID}`]);
            const tabColor = tabColorData[`tabColors${tabID}`];
            let iconPath = '/img/icon-48x48-grey.png';
            
            console.log(`🎨 Setting color for tab ${tabID}: ${tabColor}`);
            
            if (tabColor === 'red') {
                iconPath = '/img/icon-48x48-red.png';
                console.log('🔴 Setting RED icon');
            } else if (tabColor === 'green') {
                iconPath = '/img/icon-48x48-green.png';
                console.log('🟢 Setting GREEN icon');
            } else {
                console.log('⚫ Setting GREY icon (default)');
            }
            
            // Set icon for all tabs (not just specific tab)
            await chrome.action.setIcon({ path: iconPath });
            console.log(`✅ Icon set to: ${iconPath}`);
            
            // Also set for specific tab if possible
            if (tabID && tabID > 0) {
                try {
                    await chrome.tabs.get(tabID);
                    // Tab exists, we can set specific icon
                    console.log(`✅ Icon set for tab ${tabID}`);
                } catch (tabError) {
                    console.log(`⚠️ Tab ${tabID} not found, using global icon`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error in setColor:', error);
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
            
            // Get stored data from chrome.storage
            const storageData = await chrome.storage.local.get(['urls', 'allowed_ips', 'current_tab_id']);
            const storedUrls = storageData.urls || [];
            const storedIPs = storageData.allowed_ips || [];
            
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
                const currentIPs = storedIPs[domainIndex] ? storedIPs[domainIndex].replace(/\|$/, '').split(',') : [];
                
                try {
                    const userIP = await IPUtils.getCachedIP();
                    
                    if (!ValidationUtils.isValidIP(userIP)) {
                        throw new Error(`Invalid IP address received: ${userIP}`);
                    }
                    
                    // Debug logging
                    console.log('Domain matched:', storedUrls[domainIndex]);
                    console.log('Current IP:', userIP);
                    console.log('Allowed IPs:', currentIPs);
                    
                    shouldBlock = this.checkIPRules(userIP, currentIPs);
                    
                    console.log('Should block:', shouldBlock);
                    
                } catch (error) {
                    await ErrorHandler.handle(error, 'validateIP - IP fetch');
                    shouldBlock = true; // Block on error for security
                }
            }
            
            // Update tab color
            const tabId = storageData.current_tab_id || details.tabId;
            let tabColor = 'grey';
            if (shouldBlock) {
                tabColor = 'red';
            } else if (isDomain) {
                tabColor = 'green';
            }
            
            // Store tab color in chrome.storage
            await chrome.storage.local.set({
                [`tabColors${tabId}`]: tabColor
            });
            
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
     * Update IP and rules - core update logic
     */
    static async updateIPAndRules() {
        console.log('🔄 Updating IP and rules...');
        try {
            // Get fresh IP
            const freshIP = await IPUtils.getFreshIP();
            console.log(`✅ IP updated to: ${freshIP}`);
            
            // Update rules based on new IP
            await this.setupCachedRules();
            await this.setupProxyBlocking();
            
        } catch (error) {
            console.error('❌ Failed to update IP and rules:', error);
        }
    }

    /**
     * Initialize background script
     */
    static async initialize() {
        try {
            console.log('🚀 Kill Switch Initializing...');
            
            // First, get IP and set up rules
            await this.updateIPAndRules();
            
            await this.updateLocalStorage();
            
            // Set up message listener
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                this.handleMessage(request, sender, sendResponse);
                return true; // Keep message channel open for async response
            });
            
            // Set up tab activation listener
            chrome.tabs.onActivated.addListener(async (info) => {
                await chrome.storage.local.set({
                    current_tab_id: info.tabId
                });
                await this.setColor(info.tabId);
            });
            
            // Set up cached rules for sync access
            await this.setupCachedRules();
            
            // Set up DNS level proxy blocking
            await this.setupProxyBlocking();
            
            // Set up detection for blocked requests
            this.setupBlockedRequestDetection();
            
            // Set up alarms for periodic tasks
            this.setupAlarms();
            
        } catch (error) {
            await ErrorHandler.handle(error, 'initialize');
        }
    }


    /**
     * Setup alarms for periodic tasks
     */
    static setupAlarms() {
        console.log('⏰ Setting up alarms...');
        // Create an alarm to refresh the IP every 10 minutes
        chrome.alarms.create('refreshIP', {
            delayInMinutes: 0.5,  // 30 ثانیه تاخیر اولیه
            periodInMinutes: 0.5  // هر 30 ثانیه تکرار
        });

        // Add a listener for when the alarm fires
        chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
        console.log('✅ Alarms set up.');
    }

    /**
     * Handle incoming alarms
     * @param {chrome.alarms.Alarm} alarm - The alarm that fired
     */
    static async handleAlarm(alarm) {
        if (alarm.name === 'refreshIP') {
            console.log('⏰ Alarm triggered: refreshIP');
            await this.updateIPAndRules();
        }
    }


    /**
     * Set up detection for requests blocked by the proxy.
     * When a request fails because of our proxy, we redirect the tab to our custom block page.
     */
    static setupBlockedRequestDetection() {
        console.log('🔧 Setting up blocked request detection...');
        chrome.webRequest.onErrorOccurred.addListener(
            async (details) => {
                // These errors indicate the proxy blocked the connection
                const proxyErrors = [
                    'net::ERR_PROXY_CONNECTION_FAILED',
                    'net::ERR_TUNNEL_CONNECTION_FAILED',
                    'net::ERR_CONNECTION_REFUSED' 
                ];

                if (proxyErrors.includes(details.error) && details.tabId > 0) {
                    console.log(`🚫 Proxy error detected for ${details.url}. Error: ${details.error}`);
                    
                    // Check if this URL was meant to be blocked by our rules
                    const shouldBlock = await this.shouldBlockURL(details.url);
                    
                    if (shouldBlock) {
                        console.log(`🎯 URL ${details.url} matches blocking rules. Replacing tab content.`);
                        try {
                            // Store the original URL so the blocked page can display it
                            await chrome.storage.local.set({ [`blockedUrl_${details.tabId}`]: details.url });
                            
                            // Update the tab to show our custom blocked page
                            await chrome.tabs.update(details.tabId, {
                                url: chrome.runtime.getURL('html/blocked.html')
                            });
                            
                            console.log(`✅ Tab ${details.tabId} redirected to custom blocked page.`);
                        } catch (error) {
                            // It's possible the tab was closed before we could update it.
                            if (!error.message.includes('No tab with id')) {
                                console.error(`❌ Error updating tab ${details.tabId}:`, error);
                            }
                        }
                    }
                }
            },
            { urls: ["<all_urls>"] }
        );
        console.log('✅ Blocked request detection is active.');
    }


    /**
     * Check and block tab immediately
     * @param {number} tabId - Tab ID
     * @param {string} url - URL to check
     */
    static async checkAndBlockTabImmediately(tabId, url) {
        try {
            console.log('⚡ IMMEDIATE CHECK for tab', tabId, ':', url);
            
            const shouldBlock = await this.shouldBlockURL(url);
            
            if (shouldBlock) {
                console.log('🚫 IMMEDIATE BLOCK for tab', tabId, ':', url);
                
                // Set tab color to red immediately
                await chrome.storage.local.set({
                    [`tabColors${tabId}`]: 'red'
                });
                await this.setColor(tabId);
                
                // Block immediately by redirecting to blocked page
                try {
                    await chrome.tabs.update(tabId, {
                        url: chrome.runtime.getURL('html/blocked.html')
                    });
                    console.log('✅ Tab', tabId, 'redirected to blocked page');
                } catch (redirectError) {
                    console.error('❌ Error redirecting tab:', redirectError);
                    
                    // Fallback: try to close the tab
                    try {
                        await chrome.tabs.remove(tabId);
                        console.log('✅ Tab', tabId, 'closed as fallback');
                    } catch (closeError) {
                        console.error('❌ Error closing tab:', closeError);
                    }
                }
            } else {
                console.log('✅ Tab', tabId, 'allowed:', url);
                await this.updateTabColor(tabId, url);
            }
        } catch (error) {
            console.error('❌ Error in checkAndBlockTabImmediately:', error);
        }
    }

    /**
     * Update tab color based on URL status
     * @param {number} tabId - Tab ID
     * @param {string} url - URL to check
     */
    static async updateTabColor(tabId, url) {
        try {
            const shouldBlock = await this.shouldBlockURL(url);
            
            if (shouldBlock) {
                // Set tab color to red
                await chrome.storage.local.set({
                    [`tabColors${tabId}`]: 'red'
                });
                await this.setColor(tabId);
            } else {
                // Set tab color based on status
                const isWhitelisted = await this.isURLWhitelisted(url);
                if (isWhitelisted) {
                    await chrome.storage.local.set({
                        [`tabColors${tabId}`]: 'green'
                    });
                } else {
                    await chrome.storage.local.set({
                        [`tabColors${tabId}`]: 'grey'
                    });
                }
                await this.setColor(tabId);
            }
        } catch (error) {
            await ErrorHandler.handle(error, 'updateTabColor');
        }
    }

    /**
     * Check if URL should be blocked (synchronous version for webRequest)
     * @param {string} url - URL to check
     * @returns {boolean} - Whether to block
     */
    static shouldBlockURLSync(url) {
        try {
            console.log('🔍 Sync check for URL:', url);
            
            // Use cached data if available
            if (this._cachedRules) {
                for (const rule of this._cachedRules) {
                    if (URLUtils.matchingDomainRegex(url, rule.domain)) {
                        const shouldBlock = this.checkIPRules(rule.currentIP, rule.allowedIPs);
                        console.log(`🔍 Cached rule check: ${rule.domain} -> ${shouldBlock}`);
                        return shouldBlock;
                    }
                }
            }
            
            console.log('✅ No cached rules matched, allowing');
            return false;
        } catch (error) {
            console.error('❌ Error in shouldBlockURLSync:', error);
            return false;
        }
    }

    /**
     * Check if URL should be blocked
     * @param {string} url - URL to check
     * @returns {Promise<boolean>} - Whether to block
     */
    static async shouldBlockURL(url) {
        try {
            console.log('🔍 Checking URL:', url);
            
            const storageData = await chrome.storage.local.get(['urls', 'allowed_ips']);
            const storedUrls = storageData.urls || [];
            const storedIPs = storageData.allowed_ips || [];
            
            console.log('📋 Stored URLs:', storedUrls);
            console.log('📋 Stored IPs:', storedIPs);
            
            // Check if URL matches any stored domain
            for (let i = 0; i < storedUrls.length; i++) {
                const domainMatches = URLUtils.matchingDomainRegex(url, storedUrls[i]);
                console.log(`🔍 Checking domain ${storedUrls[i]}: ${domainMatches}`);
                
                if (domainMatches) {
                    const currentIPs = storedIPs[i] ? storedIPs[i].replace(/\|$/, '').split(',') : [];
                    
                    try {
                        const userIP = await IPUtils.getCachedIP();
                        
                        if (!ValidationUtils.isValidIP(userIP)) {
                            throw new Error(`Invalid IP address received: ${userIP}`);
                        }
                        
                        // Debug logging
                        console.log('✅ Domain matched:', storedUrls[i]);
                        console.log('🌐 Current IP:', userIP);
                        console.log('📝 Allowed IPs:', currentIPs);
                        
                        const shouldBlock = this.checkIPRules(userIP, currentIPs);
                        
                        console.log('🚫 Should block:', shouldBlock);
                        
                        return shouldBlock;
                        
                    } catch (error) {
                        console.error('❌ Error in IP check:', error);
                        await ErrorHandler.handle(error, 'shouldBlockURL - IP fetch');
                        return true; // Block on error for security
                    }
                }
            }
            
            console.log('✅ No matching domain found, allowing request');
            return false; // No matching domain, don't block
            
        } catch (error) {
            console.error('❌ Error in shouldBlockURL:', error);
            await ErrorHandler.handle(error, 'shouldBlockURL');
            return false;
        }
    }

    /**
     * Check if URL is whitelisted
     * @param {string} url - URL to check
     * @returns {Promise<boolean>} - Whether URL is whitelisted
     */
    static async isURLWhitelisted(url) {
        try {
            const storageData = await chrome.storage.local.get(['urls']);
            const storedUrls = storageData.urls || [];
            
            for (const storedUrl of storedUrls) {
                if (URLUtils.matchingDomainRegex(url, storedUrl)) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            await ErrorHandler.handle(error, 'isURLWhitelisted');
            return false;
        }
    }

    /**
     * Set up cached rules for sync access
     */
    static async setupCachedRules() {
        try {
            console.log('🔧 Setting up cached rules...');
            
            // Get all stored URLs for caching
            const storageData = await chrome.storage.local.get(['urls', 'allowed_ips']);
            const storedUrls = storageData.urls || [];
            const storedIPs = storageData.allowed_ips || [];
            const currentIP = await IPUtils.getCachedIP();
            
            // Cache rules for sync access
            this._cachedRules = [];
            this._blockedDomains = new Set();
            
            for (let i = 0; i < storedUrls.length; i++) {
                const domain = storedUrls[i];
                const allowedIPsString = storedIPs[i] || '';
                const allowedIPs = allowedIPsString.replace(/\|$/, '').split(',').filter(ip => ip.trim());
                
                this._cachedRules.push({
                    domain: domain,
                    allowedIPs: allowedIPs,
                    currentIP: currentIP
                });
                
                // Check if this domain should be blocked
                const shouldBlock = this.checkIPRules(currentIP, allowedIPs);
                if (shouldBlock) {
                    // Convert wildcard domains to specific patterns
                    if (domain.includes('*')) {
                        if (domain === '*.binance.*') {
                            this._blockedDomains.add('binance.com');
                            this._blockedDomains.add('www.binance.com');
                            this._blockedDomains.add('api.binance.com');
                            this._blockedDomains.add('binance.org');
                            this._blockedDomains.add('www.binance.org');
                        } else {
                            // General wildcard handling
                            const baseDomain = domain.replace(/^\*\./, '').replace(/\.\*$/, '');
                            this._blockedDomains.add(baseDomain);
                            this._blockedDomains.add(`www.${baseDomain}`);
                        }
                    } else {
                        this._blockedDomains.add(domain);
                        this._blockedDomains.add(`www.${domain}`);
                    }
                }
            }
            
            console.log('📋 Cached rules for sync access:', this._cachedRules);
            console.log('🚫 Blocked domains:', Array.from(this._blockedDomains));
        } catch (error) {
            console.error('❌ Error setting up cached rules:', error);
        }
    }

    /**
     * Set up DNS level proxy blocking
     */
    static async setupProxyBlocking() {
        try {
            console.log('🔧 Setting up DNS level proxy blocking...');
            
            if (!this._blockedDomains || this._blockedDomains.size === 0) {
                console.log('ℹ️ No domains to block, clearing proxy settings');
                await chrome.proxy.settings.clear({});
                return;
            }
            
            // Create PAC script that blocks domains at DNS level
            const pacScript = this.generatePACScript(Array.from(this._blockedDomains));
            
            const proxyConfig = {
                mode: 'pac_script',
                pacScript: {
                    data: pacScript
                }
            };
            
            await chrome.proxy.settings.set({
                value: proxyConfig,
                scope: 'regular'
            });
            
            console.log('✅ DNS level proxy blocking set up');
            console.log('🚫 Blocking domains:', Array.from(this._blockedDomains));
            
        } catch (error) {
            console.error('❌ Error setting up proxy blocking:', error);
        }
    }

    /**
     * Generate PAC script for redirecting blocked domains
     */
    static generatePACScript(blockedDomains) {
        const blockedDomainsArray = JSON.stringify(blockedDomains);
        const blockedPageUrl = chrome.runtime.getURL('html/blocked.html');
        
        return `
function FindProxyForURL(url, host) {
    console.log("PAC: Checking URL:", url, "Host:", host);
    
    var blockedDomains = ${blockedDomainsArray};
    
    // Check if this is already our blocked page - allow it
    if (url.indexOf("${blockedPageUrl}") === 0) {
        console.log("PAC: ALLOWING blocked page:", url);
        return "DIRECT";
    }
    
    // Check if host matches any blocked domain
    for (var i = 0; i < blockedDomains.length; i++) {
        var blockedDomain = blockedDomains[i];
        
        // Exact match
        if (host === blockedDomain) {
            console.log("PAC: BLOCKING (exact match):", host);
            return "PROXY 127.0.0.1:1";
        }
        
        // Subdomain match
        if (host.endsWith('.' + blockedDomain)) {
            console.log("PAC: BLOCKING (subdomain):", host);
            return "PROXY 127.0.0.1:1";
        }
        
        // Wildcard match for binance
        if (blockedDomain === 'binance.com' && host.indexOf('binance') !== -1) {
            console.log("PAC: BLOCKING (binance wildcard):", host);
            return "PROXY 127.0.0.1:1";
        }
    }
    
    console.log("PAC: ALLOWING:", host);
    return "DIRECT";
}`;
    }

    /**
     * Set up declarativeNetRequest for real blocking
     */
    static async setupDeclarativeNetRequest() {
        try {
            console.log('🔧 Setting up declarativeNetRequest...');
            
            // Get all stored URLs for blocking
            const storageData = await chrome.storage.local.get(['urls', 'allowed_ips']);
            const storedUrls = storageData.urls || [];
            const storedIPs = storageData.allowed_ips || [];
            
            console.log('📋 Stored URLs for blocking (raw):', JSON.stringify(storedUrls));
            console.log('📋 Allowed IPs (raw):', JSON.stringify(storedIPs));
            
            // Clear existing rules
            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            const ruleIdsToRemove = existingRules.map(rule => rule.id);
            
            if (ruleIdsToRemove.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: ruleIdsToRemove
                });
            }
            
            // Get current IP
            const currentIP = await IPUtils.getCachedIP();
            console.log('🌐 Current IP for rules:', currentIP);
            
            // Create rules for each URL
            const rules = [];
            let ruleId = 1;
            
            // Process each URL entry
            for (let i = 0; i < storedUrls.length; i++) {
                try {
                    const domain = storedUrls[i];
                    const allowedIPsString = storedIPs[i] || '';
                    const allowedIPs = allowedIPsString.replace(/\|$/, '').split(',').filter(ip => ip.trim());
                    
                    console.log(`🔍 Processing rule ${i + 1}:`);
                    console.log(`   Domain: ${domain}`);
                    console.log(`   Allowed IPs: [${allowedIPs.join(', ')}]`);
                    console.log(`   Current IP: ${currentIP}`);
                    
                    // Check if current IP is allowed
                    const shouldBlock = this.checkIPRules(currentIP, allowedIPs);
                    console.log(`   Should block: ${shouldBlock}`);
                    
                    if (shouldBlock) {
                        // Create blocking rule
                        const regexFilter = URLUtils.domainToRegex(domain);
                        const rule = {
                            id: ruleId++,
                            priority: 1,
                            action: {
                                type: 'block'
                            },
                            condition: {
                                regexFilter: regexFilter,
                                resourceTypes: ['main_frame']
                            }
                        };
                        
                        rules.push(rule);
                        console.log(`🚫 Added BLOCKING rule for ${domain}`);
                        console.log(`   Regex: ${regexFilter}`);
                    } else {
                        console.log(`✅ Skipping ${domain} - IP ${currentIP} is allowed`);
                    }
                } catch (error) {
                    console.error(`❌ Error processing URL ${storedUrls[i]}:`, error);
                }
            }
            
            // Add rules
            if (rules.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    addRules: rules
                });
                console.log(`✅ Added ${rules.length} blocking rules to declarativeNetRequest`);
                
                // Log all active rules for debugging
                const activeRules = await chrome.declarativeNetRequest.getDynamicRules();
                console.log('📋 Active declarativeNetRequest rules:');
                activeRules.forEach(rule => {
                    console.log(`   Rule ${rule.id}: ${rule.condition.regexFilter} -> ${rule.action.type}`);
                });
            } else {
                console.log('ℹ️ No blocking rules to add - all domains are allowed for current IP');
            }
            
            console.log('✅ DeclarativeNetRequest setup completed');
            
            // Cache rules for sync access
            this._cachedRules = [];
            for (let i = 0; i < storedUrls.length; i++) {
                const domain = storedUrls[i];
                const allowedIPsString = storedIPs[i] || '';
                const allowedIPs = allowedIPsString.replace(/\|$/, '').split(',').filter(ip => ip.trim());
                
                this._cachedRules.push({
                    domain: domain,
                    allowedIPs: allowedIPs,
                    currentIP: currentIP
                });
            }
            
            console.log('📋 Cached rules for sync access:', this._cachedRules);
        } catch (error) {
            console.error('❌ Error setting up declarativeNetRequest:', error);
        }
    }

    /**
     * Initialize blocking rules
     */
    static async initializeBlockingRules() {
        try {
            // Clear existing rules
            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            const ruleIdsToRemove = existingRules.map(rule => rule.id);
            
            if (ruleIdsToRemove.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: ruleIdsToRemove
                });
            }
            
            console.log('Blocking rules initialized');
            
            // Test wildcard functionality
            this.testWildcardFunctionality();
        } catch (error) {
            await ErrorHandler.handle(error, 'initializeBlockingRules');
        }
    }

    /**
     * Test wildcard functionality
     */
    static testWildcardFunctionality() {
        console.log('Testing wildcard functionality:');
        
        // Test domain validation first
        console.log('Testing domain validation:');
        const domainTests = [
            { domain: '*.binance.*', expected: true },
            { domain: '*.example.com', expected: true },
            { domain: 'example.*', expected: true },
            { domain: '*.google.com', expected: true },
            { domain: 'example.com', expected: true },
            { domain: 'invalid..domain', expected: false },
            { domain: '*.', expected: false },
            { domain: '.*', expected: false }
        ];
        
        domainTests.forEach((test, index) => {
            const result = ValidationUtils.isValidDomain(test.domain);
            const status = result === test.expected ? '✅' : '❌';
            console.log(`${status} Domain Test ${index + 1}: ${test.domain} = ${result} (expected: ${test.expected})`);
        });
        
        console.log('\nTesting URL matching:');
        const testCases = [
            { pattern: '*.example.com', url: 'https://api.example.com/page', expected: true },
            { pattern: '*.example.com', url: 'https://www.example.com/page', expected: true },
            { pattern: '*.example.com', url: 'https://subdomain.example.com/page', expected: true },
            { pattern: '*.example.com', url: 'https://example.com/page', expected: false },
            { pattern: '*.example.com', url: 'https://other.com/page', expected: false },
            { pattern: 'example.*', url: 'https://example.com/page', expected: true },
            { pattern: 'example.*', url: 'https://example.org/page', expected: true },
            { pattern: 'example.*', url: 'https://sub.example.com/page', expected: false },
            { pattern: '*.google.com', url: 'https://maps.google.com/page', expected: true },
            { pattern: '*.google.com', url: 'https://drive.google.com/page', expected: true },
            { pattern: '*.google.com', url: 'https://google.com/page', expected: false },
            { pattern: '*.binance.*', url: 'https://api.binance.com/page', expected: true },
            { pattern: '*.binance.*', url: 'https://www.binance.org/page', expected: true },
            { pattern: '*.binance.*', url: 'https://binance.com/page', expected: false }
        ];
        
        testCases.forEach((testCase, index) => {
            const result = URLUtils.matchingDomainRegex(testCase.url, testCase.pattern);
            const status = result === testCase.expected ? '✅' : '❌';
            console.log(`${status} URL Test ${index + 1}: ${testCase.pattern} vs ${testCase.url} = ${result} (expected: ${testCase.expected})`);
        });
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
                    await this.setupCachedRules();
                    await this.setupProxyBlocking();
                    sendResponse({ success: true });
                    break;
                    
                case 'refresh':
                    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
                    if (tabs[0]) {
                        await chrome.scripting.executeScript({
                            target: { tabId: tabs[0].id },
                            func: () => {
                                setTimeout(function(){
                                    window.location.reload();
                                }, 500);
                            }
                        });
                    }
                    sendResponse({ success: true });
                    break;
                    
                case 'refreshIP':
                    try {
                        await this.updateIPAndRules();
                        const result = await chrome.storage.local.get(['current_ip']);
                        sendResponse({ success: true, ip: result.current_ip });
                    } catch (error) {
                        await ErrorHandler.handle(error, 'refreshIP');
                        sendResponse({ success: false, error: error.message });
                    }
                    break;
                    
                case 'getTimeUntilUpdate':
                    try {
                        const timeRemaining = await IPUtils.getTimeUntilNextUpdate();
                        sendResponse({ success: true, timeRemaining: timeRemaining });
                    } catch (error) {
                        await ErrorHandler.handle(error, 'getTimeUntilUpdate');
                        sendResponse({ success: false, error: error.message });
                    }
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
