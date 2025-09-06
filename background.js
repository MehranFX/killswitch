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
                console.log(`🔍 Checking wildcard pattern: ${urlPattern} against ${accessHostname}`);
                
                // Special handling for *.binance.*
                if (urlPattern === '*.binance.*') {
                    const binancePatterns = ['binance.com', 'www.binance.com', 'api.binance.com', 'binance.org', 'www.binance.org'];
                    const matches = binancePatterns.some(pattern => accessHostname === pattern || accessHostname.endsWith('.' + pattern));
                    console.log(`🔍 Binance pattern check: ${matches}`);
                    return matches;
                }
                
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
                const result = regex.test(accessHostname);
                console.log(`🔍 Regex pattern: ${regexPattern}, result: ${result}`);
                return result;
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
        console.log(`🔍 checkIPRules called with IP: ${userIP}, Rules: [${rules.join(', ')}]`);
        
        if (!rules || rules.length === 0) {
            console.log('✅ No rules, allowing');
            return false;
        }
        
        const whitelistExists = rules.some(ip => !ip.startsWith('!'));
        const blacklistExists = rules.some(ip => ip.startsWith('!'));
        
        console.log(`🔍 Whitelist exists: ${whitelistExists}, Blacklist exists: ${blacklistExists}`);
        
        for (const rule of rules) {
            const isNegative = rule.startsWith('!');
            const ip = isNegative ? rule.substring(1) : rule;
            
            console.log(`🔍 Checking rule: ${rule} (isNegative: ${isNegative}, ip: ${ip})`);
            
            if (isNegative && userIP === ip) {
                console.log('🚫 IP found in blacklist, blocking');
                return true; // Block if IP is in blacklist
            } else if (!isNegative && userIP === ip) {
                console.log('✅ IP found in whitelist, allowing');
                return false; // Allow if IP is in whitelist
            }
        }
        
        // If whitelist exists and IP not found, block
        // If only blacklist exists and IP not found, allow
        if (whitelistExists && !blacklistExists) {
            console.log('🚫 Whitelist exists but IP not found, blocking');
            return true; // Block if whitelist exists but IP not found
        } else if (!whitelistExists && blacklistExists) {
            console.log('✅ Only blacklist exists and IP not found, allowing');
            return false; // Allow if only blacklist exists and IP not found
        } else if (whitelistExists && blacklistExists) {
            console.log('🚫 Both whitelist and blacklist exist but IP not found, blocking (whitelist takes precedence)');
            return true; // Block if both exist but IP not found (whitelist takes precedence)
        } else {
            console.log('✅ No rules, allowing');
            return false; // No rules, allow
        }
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
            
            // Verify IP was stored
            const stored = await chrome.storage.local.get(['current_ip', 'cachedIP', 'last_ip_update']);
            console.log('📋 Stored IP data:', stored);
            
            // Update rules based on new IP
            await this.setupCachedRules();
            await this.setupProxyBlocking();
            
            // Ensure no stale declarativeNetRequest dynamic rules remain
            await this.clearDynamicRules();
            
            console.log('✅ IP and rules update completed');
            
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
                return this.handleMessage(request, sender, sendResponse);
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
            
            // Ensure no stale declarativeNetRequest dynamic rules remain
            await this.clearDynamicRules();
            
            // Force refresh proxy settings with delay
            setTimeout(async () => {
                await this.refreshProxySettings();
            }, 1000);
            
            // Note: PAC script handles whitelist logic, no need to clear proxy
            
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
        try {
            console.log('⏰ Setting up alarms...');
            
            // Check if alarms API is available
            if (!chrome.alarms) {
                console.warn('⚠️ Alarms API not available, using fallback timer');
                // Fallback: use setInterval instead
                setInterval(() => {
                    console.log('⏰ Fallback timer triggered');
                    this.updateIPAndRules();
                }, 30000); // 30 seconds
                return;
            }
            
            // Create an alarm to refresh the IP every 30 seconds
            chrome.alarms.create('refreshIP', {
                delayInMinutes: 0.5,  // 30 ثانیه تاخیر اولیه
                periodInMinutes: 0.5  // هر 30 ثانیه تکرار
            });
            
            // Create an alarm to clear proxy every 2 minutes
            chrome.alarms.create('clearProxy', {
                delayInMinutes: 2,    // 2 دقیقه تاخیر اولیه
                periodInMinutes: 2    // هر 2 دقیقه تکرار
            });

            // Add a listener for when the alarm fires
            chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
            console.log('✅ Alarms set up.');
        } catch (error) {
            console.error('❌ Error setting up alarms:', error);
            // Fallback: use setInterval
            setInterval(() => {
                console.log('⏰ Fallback timer triggered');
                this.updateIPAndRules();
            }, 30000); // 30 seconds
        }
    }

    /**
     * Handle incoming alarms
     * @param {chrome.alarms.Alarm} alarm - The alarm that fired
     */
    static async handleAlarm(alarm) {
        if (alarm.name === 'refreshIP') {
            console.log('⏰ Alarm triggered: refreshIP');
            await this.updateIPAndRules();
        } else if (alarm.name === 'clearProxy') {
            console.log('⏰ Alarm triggered: clearProxy');
            await this.forceClearProxyOnStartup();
        }
    }


    /**
     * Force clear proxy on startup
     */
    static async forceClearProxyOnStartup() {
        try {
            console.log('🚀 Force clearing proxy on startup...');
            
            // Multiple clear attempts
            for (let i = 0; i < 5; i++) {
                await chrome.proxy.settings.clear({});
                console.log(`✅ Clear attempt ${i + 1}`);
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Force set direct connection
            await chrome.proxy.settings.set({
                value: { mode: 'direct' },
                scope: 'regular'
            });
            console.log('✅ Direct connection set');
            
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Clear again
            await chrome.proxy.settings.clear({});
            console.log('✅ Final clear completed');
            
        } catch (error) {
            console.error('❌ Error force clearing proxy on startup:', error);
        }
    }

    /**
     * Force refresh proxy settings to ensure changes take effect
     */
    static async refreshProxySettings() {
        try {
            console.log('🔄 Refreshing proxy settings...');
            
            // Get current proxy settings
            const settings = await chrome.proxy.settings.get({});
            console.log('📋 Current proxy settings:', settings);
            
            // Force a refresh by setting the same settings again
            if (settings.value && settings.value.mode === 'pac_script') {
                await chrome.proxy.settings.set({
                    value: settings.value,
                    scope: 'regular'
                });
                console.log('✅ Proxy settings refreshed');
            } else {
                console.log('ℹ️ No PAC script to refresh');
            }
        } catch (error) {
            console.error('❌ Error refreshing proxy settings:', error);
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
                console.log('🔍 ===== WEBREQUEST ERROR DETECTED =====');
                console.log('🔍 WebRequest error detected:', details.error, 'for URL:', details.url);
                console.log('🔍 Tab ID:', details.tabId, 'Frame ID:', details.frameId);
                
                // These errors indicate the proxy blocked the connection
                const proxyErrors = [
                    'net::ERR_PROXY_CONNECTION_FAILED',
                    'net::ERR_TUNNEL_CONNECTION_FAILED',
                    'net::ERR_CONNECTION_REFUSED',
                    'net::ERR_BLOCKED_BY_CLIENT'
                ];

                if (proxyErrors.includes(details.error) && details.tabId > 0) {
                    console.log(`🚫 Proxy error detected for ${details.url}. Error: ${details.error}`);
                    
                    // Check if this URL should actually be blocked by our rules (async version)
                    const shouldBlock = await this.shouldBlockURL(details.url);
                    
                    if (shouldBlock) {
                        console.log(`🎯 URL ${details.url} matches blocking rules, replacing with custom page.`);
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
                    } else {
                        console.log(`ℹ️ URL ${details.url} blocked by proxy but not by our rules, ignoring.`);
                        console.log(`ℹ️ This means the IP is in the whitelist and should be allowed.`);
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
                    const domain = URLUtils.getHostFromURL(details.url);
                    await chrome.tabs.update(tabId, {
                        url: chrome.runtime.getURL(`html/blocked.html?domain=${encodeURIComponent(domain)}`)
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
            if (this._cachedRules && this._cachedRules.length > 0) {
                console.log(`🔍 Using cached rules: ${this._cachedRules.length} rules`);
                for (const rule of this._cachedRules) {
                    console.log(`🔍 Checking rule: ${rule.domain} against ${url}`);
                    const domainMatch = URLUtils.matchingDomainRegex(url, rule.domain);
                    console.log(`🔍 Domain match: ${domainMatch}`);
                    
                    if (domainMatch) {
                        console.log(`🔍 Cached rule matched: ${rule.domain}`);
                        const shouldBlock = this.checkIPRules(rule.currentIP, rule.allowedIPs);
                        console.log(`🔍 Cached rule check: ${rule.domain} -> ${shouldBlock} (IP: ${rule.currentIP}, Allowed: ${rule.allowedIPs})`);
                        return shouldBlock;
                    }
                }
            } else {
                console.log('⚠️ No cached rules available, falling back to storage');
                // Fallback: return false for now, let the async version handle it
                return false;
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
                        console.log(`🔍 Final decision: ${shouldBlock ? 'BLOCK' : 'ALLOW'} for ${url} (IP: ${userIP}, Allowed: [${currentIPs.join(', ')}])`);
                        
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
            
            console.log('📋 Stored URLs:', storedUrls);
            console.log('📋 Stored IPs:', storedIPs);
            console.log('📋 Current IP:', currentIP);
            
            // Cache rules for sync access
            this._cachedRules = [];
            this._blockedDomains = new Set();
            
            console.log(`🔧 Processing ${storedUrls.length} stored URLs...`);
            
            for (let i = 0; i < storedUrls.length; i++) {
                const domain = storedUrls[i];
                const allowedIPsString = storedIPs[i] || '';
                const allowedIPs = allowedIPsString.replace(/\|$/, '').split(',').filter(ip => ip.trim());
                
                console.log(`🔧 Processing domain ${i + 1}/${storedUrls.length}: ${domain}`);
                console.log(`🔧 Allowed IPs: [${allowedIPs.join(', ')}]`);
                
                this._cachedRules.push({
                    domain: domain,
                    allowedIPs: allowedIPs,
                    currentIP: currentIP
                });
                
                // Check if this domain should be blocked
                const shouldBlock = this.checkIPRules(currentIP, allowedIPs);
                console.log(`🔍 Domain: ${domain}, Should block: ${shouldBlock}, Current IP: ${currentIP}, Allowed IPs: ${allowedIPs}`);
                
                if (shouldBlock) {
                    // Convert wildcard domains to specific patterns
                    if (domain.includes('*')) {
                        if (domain === '*.binance.*') {
                            this._blockedDomains.add('binance.com');
                            this._blockedDomains.add('www.binance.com');
                            this._blockedDomains.add('api.binance.com');
                            this._blockedDomains.add('binance.org');
                            this._blockedDomains.add('www.binance.org');
                            console.log('🚫 Added binance domains to blocked list');
                        } else {
                            // General wildcard handling
                            const baseDomain = domain.replace(/^\*\./, '').replace(/\.\*$/, '');
                            this._blockedDomains.add(baseDomain);
                            this._blockedDomains.add(`www.${baseDomain}`);
                            console.log(`🚫 Added wildcard domains to blocked list: ${baseDomain}`);
                        }
                    } else {
                        this._blockedDomains.add(domain);
                        this._blockedDomains.add(`www.${domain}`);
                        console.log(`🚫 Added domain to blocked list: ${domain}`);
                    }
                } else {
                    console.log(`✅ Domain ${domain} is allowed for IP ${currentIP}`);
                }
            }
            
            console.log('📋 Cached rules for sync access:', this._cachedRules);
            console.log('🚫 Blocked domains:', Array.from(this._blockedDomains));
            console.log(`✅ setupCachedRules completed: ${this._cachedRules.length} rules cached, ${this._blockedDomains.size} domains blocked`);
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
            
            // Always set up PAC script, even if no domains are blocked
            // This ensures we can handle whitelist logic properly
            
            // Check if current IP is in whitelist for any domain
            const currentIP = await IPUtils.getCachedIP();
            const storageData = await chrome.storage.local.get(['urls', 'allowed_ips']);
            const storedUrls = storageData.urls || [];
            const storedIPs = storageData.allowed_ips || [];
            
            // current IP and whitelist logic
            
            // Create whitelist data for PAC script
            const whitelistData = [];
            for (let i = 0; i < storedUrls.length; i++) {
                const domain = storedUrls[i];
                const allowedIPsString = storedIPs[i] || '';
                const allowedIPs = allowedIPsString.replace(/\|$/, '').split(',').filter(ip => ip.trim());
                
                // domain allowed IPs collected
                
                whitelistData.push({
                    domain: domain,
                    allowedIPs: allowedIPs
                });
            }
            
            // Build whitelist data for PAC script
            
            // Force clear proxy settings first
            try {
                for (let i = 0; i < 3; i++) {
                    await chrome.proxy.settings.clear({});
                    console.log(`✅ Clear attempt ${i + 1}`);
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                // Wait a bit before setting PAC script
                await new Promise(resolve => setTimeout(resolve, 500));
                console.log('⏳ Waiting before setting PAC script...');
            } catch (error) {
                console.error('❌ Error clearing proxy settings:', error);
            }
            
            // Check if current IP is in whitelist for ANY domain
            let shouldUseDirect = false;
            // checking whitelist
            
            for (let i = 0; i < storedUrls.length; i++) {
                const domain = storedUrls[i];
                const allowedIPsString = storedIPs[i] || '';
                const allowedIPs = allowedIPsString.replace(/\|$/, '').split(',').filter(ip => ip.trim());
                
                // comparing current IP with allowed list for domain
                
                if (allowedIPs.includes(currentIP)) {
                    // current IP is whitelisted for this domain
                    shouldUseDirect = true;
                    break;
                }
            }
            
            if (shouldUseDirect) {
                // Use direct connection for whitelisted IPs
                const proxyConfig = {
                    mode: 'direct'
                };
                
                await chrome.proxy.settings.set({
                    value: proxyConfig,
                    scope: 'regular'
                });
                
                console.log('✅ Direct connection set for whitelisted IP');
            } else {
                // Use PAC script for non-whitelisted IPs
                const blockedDomains = this._blockedDomains ? Array.from(this._blockedDomains) : [];
                const pacScript = this.generatePACScript(blockedDomains, currentIP, whitelistData);
                
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
                
                console.log('✅ PAC script set for non-whitelisted IP');
            }
            
            console.log('✅ DNS level proxy blocking set up');
            
        } catch (error) {
            console.error('❌ Error setting up proxy blocking:', error);
        }
    }

    /**
     * Generate PAC script for redirecting blocked domains
     */
    static generatePACScript(blockedDomains, currentIP, whitelistData) {
        const blockedDomainsArray = JSON.stringify(blockedDomains);
        const blockedPageUrl = chrome.runtime.getURL('html/blocked.html');
        const whitelistDataStr = JSON.stringify(whitelistData);
        
        return `
function FindProxyForURL(url, host) {
    console.log("PAC: ===== PAC SCRIPT EXECUTED =====");
    console.log("PAC: Checking URL:", url, "Host:", host);
    console.log("PAC: Current IP:", "${currentIP}");
    console.log("PAC: Whitelist data:", ${whitelistDataStr});
    
    var blockedDomains = ${blockedDomainsArray};
    var whitelistData = ${whitelistDataStr};
    var currentIP = "${currentIP}";
    
    // Check if this is already our blocked page - allow it
    if (url.indexOf("${blockedPageUrl}") === 0) {
        console.log("PAC: ALLOWING blocked page:", url);
        return "DIRECT";
    }
    
    // Check if current IP is in whitelist for this domain
    console.log("PAC: Checking", whitelistData.length, "whitelist entries");
    for (var i = 0; i < whitelistData.length; i++) {
        var domain = whitelistData[i].domain;
        var allowedIPs = whitelistData[i].allowedIPs;
        console.log("PAC: Checking domain", domain, "with allowed IPs:", allowedIPs);
        
        // Check if host matches this domain
        var domainMatch = false;
        
        // Handle wildcard domains
        if (domain.includes('*')) {
            if (domain === '*.binance.*') {
                // Match any binance domain
                if (host.indexOf('binance') !== -1) {
                    console.log("PAC: Binance wildcard matched for host:", host);
                    domainMatch = true;
                }
            } else if (domain.startsWith('*.')) {
                // Match subdomains
                var baseDomain = domain.substring(2);
                if (host === baseDomain || host.endsWith('.' + baseDomain)) {
                    console.log("PAC: Subdomain matched:", baseDomain, "for host:", host);
                    domainMatch = true;
                }
            } else if (domain.endsWith('.*')) {
                // Match domains with same prefix
                var prefix = domain.substring(0, domain.length - 2);
                if (host.startsWith(prefix)) {
                    console.log("PAC: Prefix matched:", prefix, "for host:", host);
                    domainMatch = true;
                }
            }
        } else {
            // Exact match
            if (host === domain) {
                console.log("PAC: Exact match:", domain, "for host:", host);
                domainMatch = true;
            } else if (host.endsWith('.' + domain)) {
                console.log("PAC: Subdomain match:", domain, "for host:", host);
                domainMatch = true;
            }
        }
        
        if (domainMatch) {
            console.log("PAC: Domain matched:", domain, "for host:", host);
            console.log("PAC: Checking IP:", currentIP, "against allowed IPs:", allowedIPs);
            
            // Check if current IP is in whitelist
            for (var j = 0; j < allowedIPs.length; j++) {
                if (allowedIPs[j] === currentIP) {
                    console.log("PAC: ALLOWING (IP in whitelist):", host, "IP:", currentIP);
                    return "DIRECT";
                }
            }
            console.log("PAC: BLOCKING (IP not in whitelist):", host, "IP:", currentIP);
            return "PROXY 127.0.0.1:1";
        }
    }
    
    console.log("PAC: ALLOWING (no domain match):", host);
    console.log("PAC: ===== PAC SCRIPT COMPLETED =====");
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
     * Clear ALL dynamic rules from declarativeNetRequest to avoid residual blocking
     */
    static async clearDynamicRules() {
        try {
            if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.getDynamicRules) {
                return;
            }
            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            if (existingRules && existingRules.length > 0) {
                const ruleIdsToRemove = existingRules.map(rule => rule.id);
                await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIdsToRemove });
                console.log(`🧹 Cleared ${ruleIdsToRemove.length} dynamic DNR rules`);
            } else {
                console.log('🧹 No dynamic DNR rules to clear');
            }
        } catch (error) {
            console.error('❌ Error clearing dynamic DNR rules:', error);
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
    static handleMessage(request, sender, sendResponse) {
        console.log('📨 Message received:', request.type);
        
        // Handle async operations properly
        (async () => {
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
                            console.log('🔄 refreshIP message received');
                            await this.updateIPAndRules();
                            const result = await chrome.storage.local.get(['current_ip', 'cachedIP']);
                            const ip = result.current_ip || result.cachedIP;
                            console.log('📤 Sending IP response:', ip);
                            sendResponse({ success: true, ip: ip });
                        } catch (error) {
                            console.error('❌ Error in refreshIP:', error);
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
                        
                    case 'getCurrentIP':
                        try {
                            const result = await chrome.storage.local.get(['current_ip', 'cachedIP']);
                            const ip = result.current_ip || result.cachedIP;
                            sendResponse({ success: true, ip: ip });
                        } catch (error) {
                            await ErrorHandler.handle(error, 'getCurrentIP');
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    case 'debugRules':
                        try {
                            console.log('🔍 Debug rules requested');
                            const storage = await chrome.storage.local.get(['urls', 'allowed_ips', 'current_ip', 'cachedIP']);
                            const currentIP = storage.current_ip || storage.cachedIP;
                            
                            console.log('📋 Debug rules data:');
                            console.log('   URLs:', storage.urls);
                            console.log('   Allowed IPs:', storage.allowed_ips);
                            console.log('   Current IP:', currentIP);
                            console.log('   Cached rules:', this._cachedRules);
                            console.log('   Blocked domains:', Array.from(this._blockedDomains));
                            
                            sendResponse({ 
                                success: true, 
                                data: {
                                    urls: storage.urls,
                                    allowed_ips: storage.allowed_ips,
                                    current_ip: currentIP,
                                    cached_rules: this._cachedRules,
                                    blocked_domains: Array.from(this._blockedDomains)
                                }
                            });
                        } catch (error) {
                            console.error('❌ Error in debugRules:', error);
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    case 'clearProxy':
                        try {
                            console.log('🧹 Clearing proxy settings...');
                            
                            // First, clear proxy settings
                            await chrome.proxy.settings.clear({});
                            console.log('✅ Proxy settings cleared successfully');
                            
                            // Wait a bit for settings to take effect
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            // Force set direct connection
                            await chrome.proxy.settings.set({
                                value: {
                                    mode: 'direct'
                                },
                                scope: 'regular'
                            });
                            console.log('✅ Direct connection set');
                            
                            // Wait a bit more
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            // Clear again to ensure it's really cleared
                            await chrome.proxy.settings.clear({});
                            console.log('✅ Proxy settings cleared again');
                            
                            // Wait for final clear to take effect
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            // Force refresh all tabs
                            const tabs = await chrome.tabs.query({});
                            console.log(`🔄 Refreshing ${tabs.length} tabs...`);
                            
                            for (const tab of tabs) {
                                try {
                                    if (tab.url && tab.url.includes('binance.com')) {
                                        console.log(`🔄 Refreshing binance tab: ${tab.id}`);
                                        await chrome.tabs.reload(tab.id);
                                    }
                                } catch (e) {
                                    console.log(`⚠️ Could not refresh tab ${tab.id}:`, e.message);
                                }
                            }
                            
                            // Also try to refresh current active tab
                            try {
                                const activeTabs = await chrome.tabs.query({active: true, currentWindow: true});
                                if (activeTabs[0]) {
                                    await chrome.tabs.reload(activeTabs[0].id);
                                    console.log('🔄 Refreshed active tab');
                                }
                            } catch (e) {
                                console.log('⚠️ Could not refresh active tab:', e.message);
                            }
                            
                            sendResponse({ success: true });
                        } catch (error) {
                            console.error('❌ Error clearing proxy:', error);
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    case 'forceClearProxy':
                        try {
                            console.log('💥 Force clearing proxy settings...');
                            
                            // Multiple clear attempts
                            for (let i = 0; i < 3; i++) {
                                await chrome.proxy.settings.clear({});
                                console.log(`✅ Clear attempt ${i + 1}`);
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                            
                            // Force set direct connection multiple times
                            for (let i = 0; i < 3; i++) {
                                await chrome.proxy.settings.set({
                                    value: { mode: 'direct' },
                                    scope: 'regular'
                                });
                                console.log(`✅ Direct connection attempt ${i + 1}`);
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                            
                            // Final clear
                            await chrome.proxy.settings.clear({});
                            console.log('✅ Final clear completed');
                            
                            sendResponse({ success: true });
                        } catch (error) {
                            console.error('❌ Error force clearing proxy:', error);
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    default:
                        sendResponse({ success: false, error: 'Unknown message type' });
                }
            } catch (error) {
                console.error('❌ Error in handleMessage:', error);
                await ErrorHandler.handle(error, 'handleMessage');
                sendResponse({ success: false, error: error.message });
            }
        })();
        
        return true; // Keep message channel open for async response
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
