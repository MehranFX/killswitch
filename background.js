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
        'https://ifconfig.me/ip',
        'https://ipinfo.io/ip',
        'https://icanhazip.com'
    ];

    static IP_CACHE_DURATION = 30 * 1000; // 30 seconds

    static async getPublicIP() {
        for (const base of this.IP_SERVICES) {
            const url = base.includes('?') ? `${base}&_=${Date.now()}` : `${base}?_=${Date.now()}`;
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 4000);
                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                    signal: controller.signal
                });
                clearTimeout(timer);
                if (!response.ok) continue;
                const text = (await response.text()).trim();
                const ip = text.replace(/[^0-9A-Fa-f:\.]/g, '');
                if (ValidationUtils.isValidIP(ip)) return ip;
            } catch (_) {
                // try next service
            }
        }
        throw new Error('Failed to fetch public IP from all services');
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
            throw error;
        }
    }

    static async getCachedCountry() {
        try {
            const cached = await chrome.storage.local.get(['cachedCountry', 'countryTimestamp']);
            const now = Date.now();
            
            if (cached.cachedCountry && cached.countryTimestamp && 
                (now - cached.countryTimestamp) < this.IP_CACHE_DURATION) {
                return cached.cachedCountry;
            }
            
            // Try to get country from IP
            const ip = await this.getCachedIP();
            const country = await this.getCountryFromIP(ip);
            
            if (country) {
                await chrome.storage.local.set({
                    cachedCountry: country,
                    countryTimestamp: now
                });
            }
            
            return country;
        } catch (error) {
            return null;
        }
    }

    static async getCountryFromIP(ip) {
        const endpoints = [
            `https://ipapi.co/${ip}/country/`,
            `https://ipinfo.io/${ip}/country`,
            `https://ipwho.is/${ip}`
        ];
        
        for (const url of endpoints) {
            try {
                // Trying country endpoint
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const response = await fetch(url, { 
                    signal: controller.signal,
                    headers: { 'Cache-Control': 'no-cache' }
                });
                clearTimeout(timeout);
                
                if (response.ok) {
                    let country = '';
                    if (url.includes('ipwho.is')) {
                        const data = await response.json();
                        country = data.country_code || '';
                    } else {
                        country = (await response.text()).trim();
                    }
                    
                    if (country && country.length === 2) {
                        // Country detected
                        return country.toUpperCase();
                    }
                }
            } catch (error) {
                // Failed to get country from endpoint
            }
        }
        
        // Failed to get country from all endpoints
        return null;
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
            throw error;
        }
    }

    /**
     * Get country code for an IP (e.g., "US")
     */
    static async getCountryCode(ip) {
        const endpoints = [
            `https://ipapi.co/${ip}/country/`,
            `https://ipinfo.io/${ip}/country`,
            `https://ipwho.is/${ip}`
        ];
        for (const url of endpoints) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timeout);
                if (!res.ok) continue;
                if (url.includes('ipwho.is')) {
                    const data = await res.json();
                    if (data && data.success && data.country_code) {
                        return (data.country_code || '').toUpperCase();
                    }
                } else {
                    const text = (await res.text()).trim();
                    if (text && text.length <= 3) return text.toUpperCase();
                }
            } catch (_) {
                // ignore and try next
            }
        }
        return '';
    }

    /**
     * Convert ISO country code to emoji flag
     */
    static countryCodeToFlag(countryCode) {
        if (!countryCode || countryCode.length !== 2) return '';
        const A = 0x1F1E6;
        const code = countryCode.toUpperCase();
        const first = A + (code.charCodeAt(0) - 65);
        const second = A + (code.charCodeAt(1) - 65);
        return String.fromCodePoint(first) + String.fromCodePoint(second);
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
            // Failed to log error
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
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let hostPattern;
        if (domain === '*.binance.*') {
            hostPattern = '((?:[^/]*\\.)?binance\\.[^/]+)';
        } else if (domain.startsWith('*.') && domain.endsWith('.*')) {
            const mid = esc(domain.slice(2, -2));
            hostPattern = `((?:[^/]*\\.)?${mid}\\.[^/]+)`;
        } else if (domain.startsWith('*.')) {
            const base = esc(domain.slice(2));
            hostPattern = `((?:[^/]*\\.)?${base})`;
        } else if (domain.endsWith('.*')) {
            const pre = esc(domain.slice(0, -2));
            hostPattern = `((?:[^/]*\\.)?${pre}\\.[^/]+)`;
        } else {
            const exact = esc(domain);
            hostPattern = `((?:[^/]*\\.)?${exact})`;
        }
        const regex = `^https?://${hostPattern}(?:/|$)`;
        // DNR regex generated
        return regex;
    }

    static matchingDomainRegex(accessUrl, urlPattern) {
        if (!accessUrl || !urlPattern) return false;
        
        try {
            // Extract hostname from access URL
            const accessHostname = this.getHostFromURL(accessUrl);
            if (!accessHostname) return false;
            
            // Handle wildcard patterns
            if (urlPattern.includes('*')) {
                // Checking wildcard pattern
                
                // Special handling for *.binance.*
                if (urlPattern === '*.binance.*') {
                    const binancePatterns = ['binance.com', 'www.binance.com', 'api.binance.com', 'binance.org', 'www.binance.org'];
                    const matches = binancePatterns.some(pattern => accessHostname === pattern || accessHostname.endsWith('.' + pattern));
                    // Binance pattern check
                    return matches;
                }
                
                // Special handling for *.bingx.com - include all bingx subdomains and related domains
                if (urlPattern === '*.bingx.com') {
                    const bingxPatterns = [
                        'bingx.com', 'www.bingx.com', 'api.bingx.com', 'trade.bingx.com',
                        'bb-client-new.log-global.aliyuncs.com', // BingX logging domain
                        'front-log.great-api.com', // BingX frontend logging
                        'scripts.prdredir.com' // BingX scripts
                    ];
                    const matches = bingxPatterns.some(pattern => 
                        accessHostname === pattern || 
                        accessHostname.endsWith('.' + pattern) ||
                        accessHostname.includes('bingx') ||
                        accessHostname.includes('bingx.com')
                    );
                    // BingX pattern check
                    return matches;
                }
                
                // Convert wildcard pattern to regex
                let regexPattern = urlPattern
                    .replace(/\./g, '\\.')  // Escape dots
                    .replace(/\*/g, '.*');   // Convert * to .*
                
                // Special handling for *.domain.* patterns
                if (urlPattern.startsWith('*.') && urlPattern.endsWith('.*')) {
                    // For *.domain.*, match both domain.com and *.domain.com
                    const domain = urlPattern.slice(2, -2); // Remove *. and .*
                    regexPattern = `(.*\\.)?${domain.replace(/\./g, '\\.')}(\\..*)?`;
                }
                
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
                // Regex pattern check
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
            // Storage updated successfully
        } catch (error) {
            await ErrorHandler.handle(error, 'updateLocalStorage');
        }
    }

    /**
     * Apply minimal routing before IP detection so getPublicIP uses the intended path
     */
    static _bootstrapAppliedTs = 0;
    static async applyBootstrapProxyRouting() {
        try {
            // Debounce to avoid rapid toggling
            const now = Date.now();
            if (now - this._bootstrapAppliedTs < 1500) return;
            const settings = await chrome.storage.local.get(['fallback_proxy']);
            const useFallback = false; // removed manual toggle; auto-handled below
            const blockedDomains = this._blockedDomains ? Array.from(this._blockedDomains) : [];
            if (useFallback || (blockedDomains && blockedDomains.length > 0)) {
                const currentIP = await IPUtils.getCachedIP().catch(()=>null) || '';
                const storageData = await chrome.storage.local.get(['urls','allowed_ips']);
                const whitelistData = [];
                const storedUrls = storageData.urls || [];
                const storedIPs = storageData.allowed_ips || [];
                for (let i=0;i<storedUrls.length;i++){
                    const allowedIPsString = storedIPs[i] || '';
                    const allowedIPs = allowedIPsString.replace(/\|$/, '').split(',').filter(ip => ip.trim());
                    whitelistData.push({ domain: storedUrls[i], allowedIPs });
                }
                const pacScript = this.generatePACScript(blockedDomains, currentIP, whitelistData, useFallback?settings.fallback_proxy:'');
                const proxyConfig = { mode: 'pac_script', pacScript: { data: pacScript } };
                await chrome.proxy.settings.set({ value: proxyConfig, scope: 'regular' });
                this._bootstrapAppliedTs = now;
            } else {
                await chrome.proxy.settings.clear({});
                this._bootstrapAppliedTs = now;
            }
        } catch (e) {
            // Bootstrap routing error
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
            
            // Setting color for tab
            
            if (tabColor === 'red') {
                iconPath = '/img/icon-48x48-red.png';
                // Setting RED icon
            } else if (tabColor === 'green') {
                iconPath = '/img/icon-48x48-green.png';
                // Setting GREEN icon
            } else {
                // Setting GREY icon (default)
            }
            
            // Set icon for all tabs (not just specific tab)
            await chrome.action.setIcon({ path: iconPath });
            // Icon set
            
            // Also set for specific tab if possible
            if (tabID && tabID > 0) {
                try {
                    await chrome.tabs.get(tabID);
                    // Tab exists, we can set specific icon
                    // Icon set for tab
                } catch (tabError) {
                    // Tab not found, using global icon
                }
            }
            
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
                    shouldBlock = this.checkIPRules(userIP, currentIPs);
                    
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
        if (!rules || rules.length === 0) {
            return false;
        }
        
        const whitelistExists = rules.some(ip => !ip.startsWith('!'));
        const blacklistExists = rules.some(ip => ip.startsWith('!'));
        
        // Checking whitelist/blacklist rules
        
        for (const rule of rules) {
            const isNegative = rule.startsWith('!');
            const ip = isNegative ? rule.substring(1) : rule;
            
            // Checking rule
            
            if (isNegative && userIP === ip) {
                return true; // Block if IP is in blacklist
            } else if (!isNegative && userIP === ip) {
                return false; // Allow if IP is in whitelist
            }
        }
        
        // If whitelist exists and IP not found, block
        // If only blacklist exists and IP not found, allow
        if (whitelistExists && !blacklistExists) {
            return true; // Block if whitelist exists but IP not found
        } else if (!whitelistExists && blacklistExists) {
            return false; // Allow if only blacklist exists and IP not found
        } else if (whitelistExists && blacklistExists) {
            return true; // Block if both exist but IP not found (whitelist takes precedence)
        } else {
            return false; // No rules, allow
        }
    }

    /**
     * Check country rules against current IP's country
     * @param {string} url - URL to check
     * @param {string} userIP - Current user IP
     * @param {string} userCountry - Current user's country code
     * @returns {Promise<boolean>} - Whether to block
     */
    static async checkCountryRules(url, userIP, userCountry) {
        try {
            const storageData = await chrome.storage.local.get(['country_rules']);
            const countryRules = storageData.country_rules || [];
            
            if (countryRules.length === 0) {
                return false;
            }
            
            for (const rule of countryRules) {
                // Check if URL matches the domain pattern
                const domainMatch = URLUtils.matchingDomainRegex(url, rule.domain);
                
                if (domainMatch) {
                    
                    const isCountryAllowed = rule.countries.includes(userCountry);
                    // Checking if country is allowed
                    
                    if (rule.mode === 'whitelist') {
                        if (isCountryAllowed) {
                            return false; // Allow
                        } else {
                            return true; // Block
                        }
                    } else if (rule.mode === 'blacklist') {
                        if (isCountryAllowed) {
                            return true; // Block
                        } else {
                            return false; // Allow
                        }
                    }
                } else {
                    // Domain does not match
                }
            }
            
            return false;
            
        } catch (error) {
            await ErrorHandler.handle(error, 'checkCountryRules');
            return false; // Allow on error
        }
    }

    /**
     * Update IP and rules - core update logic
     */
    static async updateIPAndRules() {
        // Log removed
        try {
            // 1) Get a STABLE IP (multiple probes to avoid flicker)
            const freshIP = await this.getStablePublicIP();
            // Store IP and flag atomically
            const now = Date.now();
            const country = await IPUtils.getCountryCode(freshIP).catch(()=> '');
            const flag = IPUtils.countryCodeToFlag(country);
            await chrome.storage.local.set({
                current_ip: freshIP,
                cachedIP: freshIP,
                ipTimestamp: now,
                last_ip_update: now,
                ip_country: country,
                ip_flag: flag,
                cachedCountry: country,
                countryTimestamp: now
            });
            
            // Update location spoofing if set to match IP
            const locationData = await chrome.storage.local.get(['location_config']);
            // Log removed
            if (locationData.location_config === 'matchIP' || !locationData.location_config) {
                // Log removed
                const ipLocation = await this.fetchIPLocation();
                if (ipLocation) {
                    // Log removed
                    await chrome.storage.local.set({
                        timezone: ipLocation.timezone,
                        locale: ipLocation.locale,
                        latitude: ipLocation.latitude,
                        longitude: ipLocation.longitude
                    });
                    
                    // Re-attach debugger to all tabs with new values
                    await this.updateAllTabsWithNewLocation(ipLocation);
                    // Log removed
                    
                    // Store IP-based timezone and locale for getTimezoneSettings
                    await chrome.storage.local.set({
                        current_timezone: ipLocation.timezone,
                        current_locale: ipLocation.locale,
                        timezone: ipLocation.timezone,
                        locale: ipLocation.locale
                    });
                    
                    // Log removed
                    
                    // Notify popup to update display
                    try {
                        const tabs = await chrome.tabs.query({});
                        for (const tab of tabs) {
                            if (tab.url && tab.url.includes('chrome-extension://')) {
                                try {
                                    await chrome.tabs.sendMessage(tab.id, {
                                        type: 'locationUpdated',
                                        timezone: ipLocation.timezone,
                                        locale: ipLocation.locale,
                                        latitude: ipLocation.latitude,
                                        longitude: ipLocation.longitude
                                    });
                                } catch (e) {
                                    // Ignore errors for tabs that don't have the message listener
                                }
                            }
                        }
                    } catch (e) {
                        // Log removed
                    }
                }
            }
            // Log removed
            
            // Verify IP was stored
            const stored = await chrome.storage.local.get(['current_ip', 'cachedIP', 'last_ip_update', 'ip_country', 'ip_flag']);
            // Log removed
            
            // 3) Update rules based on new IP
            await this.setupCachedRules();
            // 4) Rebuild immediate blocking rules (DNR) first to catch navigation ASAP
            await this.setupDeclarativeNetRequest();
            // 5) Then (re)apply proxy/PAC routing based on the same rules
            const pacApplied = await this.setupProxyBlocking();
            
            // اگر PAC فعال شد، دیگر نیازی به DNR نیست؛ در غیر این صورت (مد system) DNR را نگه می‌داریم
            if (pacApplied) {
                await this.clearDynamicRules();
            }
            
            // Log removed
            
        } catch (error) {
            // Error removed
            try { await chrome.proxy.settings.clear({}); } catch {}
        }
    }

    /**
     * Get current public IP by executing fetch inside the ACTIVE TAB context
     * so the exact browser routing (system proxy/PAC) is respected.
     */
    static async getIPViaActiveTab() {
        try {
            let tabs = await chrome.tabs.query({active: true, currentWindow: true});
            let tab = tabs && tabs[0];
            // اگر تب فعال http(s) نبود، بین تمام تب‌ها یکی را پیدا کن
            if (!tab || !tab.id || !tab.url || !/^https?:/i.test(tab.url)) {
                const allTabs = await chrome.tabs.query({});
                tab = allTabs.find(t => t && t.id && t.url && /^https?:/i.test(t.url));
            }
            if (!tab || !tab.id || !tab.url || !/^https?:/i.test(tab.url)) {
                throw new Error('No http(s) tab found');
            }
            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    return new Promise(async (resolve) => {
                        try {
                            const controller = new AbortController();
                            const t = setTimeout(() => controller.abort(), 5000);
                            const res = await fetch('https://api.ipify.org?format=json', {
                                cache: 'no-store',
                                headers: { 'Cache-Control': 'no-cache' },
                                signal: controller.signal
                            });
                            clearTimeout(t);
                            const data = await res.json().catch(()=>({}));
                            resolve((data && data.ip) || '');
                        } catch (e) {
                            resolve('');
                        }
                    });
                }
            });
            const ip = (result || '').trim();
            if (!ip) throw new Error('Empty IP from tab');
            return ip;
        } catch (e) {
            // Warning removed
            throw e;
        }
    }

    /**
     * Probe public IP several times and return a stable value to avoid flicker
     */
    static async getStablePublicIP() {
        // فقط بر اساس fetch (بدون تب) + هیسترزیس مقابل سوییچ سریع
        const probe = async () => {
            try {
                const ip = await IPUtils.getPublicIP();
                if (ValidationUtils.isValidIP(ip)) return ip;
            } catch {}
            return '';
        };
        const p1 = await probe();
        await new Promise(r => setTimeout(r, 300));
        const p2 = await probe();
        if (p1 && p1 === p2) return p2;
        await new Promise(r => setTimeout(r, 300));
        const p3 = await probe();
        const arr = [p1, p2, p3].filter(Boolean);
        if (arr.length === 0) throw new Error('IP probes failed');
        const counts = arr.reduce((m, v) => { m[v] = (m[v] || 0) + 1; return m; }, {});
        let best = arr[arr.length - 1];
        for (const k in counts) { if (counts[k] >= 2) { best = k; break; } }
        // Hysteresis: اگر با مقدار قبلی متفاوت است، فقط هر 20 ثانیه اجازهٔ تغییر بده
        try {
            const st = await chrome.storage.local.get(['current_ip','cachedIP','ip_last_switch_ts']);
            const previousIP = st.current_ip || st.cachedIP || '';
            const lastSwitch = st.ip_last_switch_ts || 0;
            const now = Date.now();
            if (previousIP && previousIP !== best && (now - lastSwitch) < 20000) {
                return previousIP;
            }
        } catch {}
        return best;
    }

    /**
     * Initialize WebRTC settings
     */
    static async initializeWebRTC() {
        try {
            // Get stored WebRTC policy or use default
            const data = await chrome.storage.local.get(['webrtc_policy']);
            const policy = data.webrtc_policy || 'default_public_interface_only';
            
            // Apply WebRTC policy
            if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
                await chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: policy });
                // Log removed
            } else {
                // Log removed
            }
        } catch (error) {
            // Error removed
        }
    }

    /**
     * Initialize location spoofing settings
     */
    static async initializeLocationSpoofing() {
        try {
            // Log removed
            const data = await chrome.storage.local.get(['location_config', 'timezone', 'locale', 'latitude', 'longitude']);
            const config = data.location_config || 'matchIP';
            // Log removed
            
            // Set default location_config if not set
            if (!data.location_config) {
                await chrome.storage.local.set({ location_config: 'matchIP' });
                // Log removed
            }
            
            if (config !== 'browserDefault') {
                let timezone = data.timezone || '';
                let locale = data.locale || '';
                let latitude = data.latitude || '';
                let longitude = data.longitude || '';
                
                // If matchIP, fetch current IP location
                if (config === 'matchIP') {
                    // Log removed
                    const ipLocation = await this.fetchIPLocation();
                    if (ipLocation) {
                        // Log removed
                        timezone = ipLocation.timezone;
                        locale = ipLocation.locale;
                        latitude = ipLocation.latitude;
                        longitude = ipLocation.longitude;
                        
                        // Store IP-based timezone and locale for getTimezoneSettings
                        await chrome.storage.local.set({
                            current_timezone: ipLocation.timezone,
                            current_locale: ipLocation.locale
                        });
                        
                        // Log removed
                        
                        // Also update the main timezone fields
                        await chrome.storage.local.set({
                            timezone: ipLocation.timezone,
                            locale: ipLocation.locale
                        });
                    } else {
                        // Log removed
                    }
                } else {
                    // Log removed
                }
                
                // Apply location spoofing to all tabs
                await this.applyLocationSpoofing(timezone, locale, latitude, longitude);
                // Log removed
            }
        } catch (error) {
            // Error removed
        }
    }

    /**
     * Fetch IP location data
     */
    static async fetchIPLocation() {
        try {
            // Log removed
            const response = await fetch(`http://ip-api.com/json?fields=status,message,countryCode,lat,lon,timezone,query&ts=${Date.now()}` , { cache: 'no-store' });
            const data = await response.json();
            // Log removed
            if (data.status === 'success') {
                const result = {
                    timezone: data.timezone,
                    locale: this.getLocaleFromCountryCode(data.countryCode),
                    latitude: data.lat,
                    longitude: data.lon
                };
                // Log removed
                return result;
            } else {
                // Log removed
            }
        } catch (error) {
            // Error removed
        }
        return null;
    }

    /**
     * Get locale from country code
     */
    static getLocaleFromCountryCode(countryCode) {
        const localeMap = {
            'US': 'en-US', 'GB': 'en-GB', 'CA': 'en-CA', 'AU': 'en-AU',
            'DE': 'de-DE', 'FR': 'fr-FR', 'ES': 'es-ES', 'IT': 'it-IT',
            'JP': 'ja-JP', 'KR': 'ko-KR', 'CN': 'zh-CN', 'RU': 'ru-RU',
            'BR': 'pt-BR', 'MX': 'es-MX', 'IN': 'hi-IN', 'AR': 'es-AR',
            'IR': 'fa-IR', 'TR': 'tr-TR', 'SA': 'ar-SA', 'AE': 'ar-AE',
            'EG': 'ar-EG', 'TH': 'th-TH', 'ID': 'id-ID', 'VN': 'vi-VN',
            'PH': 'en-PH', 'MY': 'ms-MY', 'SG': 'en-SG', 'HK': 'zh-HK',
            'TW': 'zh-TW', 'NL': 'nl-NL', 'BE': 'nl-BE', 'CH': 'de-CH',
            'AT': 'de-AT', 'SE': 'sv-SE', 'NO': 'no-NO', 'DK': 'da-DK',
            'FI': 'fi-FI', 'PL': 'pl-PL', 'CZ': 'cs-CZ', 'HU': 'hu-HU',
            'RO': 'ro-RO', 'BG': 'bg-BG', 'HR': 'hr-HR', 'SK': 'sk-SK',
            'SI': 'sl-SI', 'LT': 'lt-LT', 'LV': 'lv-LV', 'EE': 'et-ET',
            'UA': 'uk-UA', 'BY': 'be-BY', 'KZ': 'kk-KZ', 'UZ': 'uz-UZ',
            'AZ': 'az-AZ', 'GE': 'ka-GE', 'AM': 'hy-AM', 'KG': 'ky-KG',
            'TJ': 'tg-TJ', 'TM': 'tk-TM', 'MN': 'mn-MN', 'NP': 'ne-NP',
            'BD': 'bn-BD', 'LK': 'si-LK', 'MV': 'dv-MV', 'BT': 'dz-BT',
            'MM': 'my-MM', 'KH': 'km-KH', 'LA': 'lo-LA', 'BN': 'ms-BN',
            'TL': 'pt-TL', 'PG': 'en-PG', 'FJ': 'en-FJ', 'NC': 'fr-NC',
            'VU': 'en-VU', 'SB': 'en-SB', 'KI': 'en-KI', 'TV': 'en-TV',
            'WS': 'en-WS', 'TO': 'en-TO', 'NR': 'en-NR', 'PW': 'en-PW',
            'FM': 'en-FM', 'MH': 'en-MH', 'CK': 'en-CK', 'NU': 'en-NU',
            'TK': 'en-TK', 'WF': 'fr-WF', 'PF': 'fr-PF', 'NC': 'fr-NC',
            'RE': 'fr-RE', 'YT': 'fr-YT', 'GP': 'fr-GP', 'MQ': 'fr-MQ',
            'BL': 'fr-BL', 'MF': 'fr-MF', 'PM': 'fr-PM', 'GF': 'fr-GF',
            'SR': 'nl-SR', 'CW': 'nl-CW', 'AW': 'nl-AW', 'BQ': 'nl-BQ',
            'SX': 'nl-SX', 'AN': 'nl-AN', 'AI': 'en-AI', 'AG': 'en-AG',
            'BS': 'en-BS', 'BB': 'en-BB', 'BZ': 'en-BZ', 'DM': 'en-DM',
            'GD': 'en-GD', 'GY': 'en-GY', 'JM': 'en-JM', 'KN': 'en-KN',
            'LC': 'en-LC', 'VC': 'en-VC', 'TT': 'en-TT', 'UY': 'es-UY',
            'PY': 'es-PY', 'BO': 'es-BO', 'CL': 'es-CL', 'CO': 'es-CO',
            'EC': 'es-EC', 'PE': 'es-PE', 'VE': 'es-VE', 'GY': 'en-GY',
            'SR': 'nl-SR', 'GF': 'fr-GF', 'FK': 'en-FK', 'GS': 'en-GS',
            'SH': 'en-SH', 'AC': 'en-AC', 'TA': 'en-TA', 'BV': 'en-BV',
            'HM': 'en-HM', 'IO': 'en-IO', 'CX': 'en-CX', 'CC': 'en-CC',
            'NF': 'en-NF', 'PN': 'en-PN', 'TC': 'en-TC', 'VG': 'en-VG',
            'VI': 'en-VI', 'PR': 'es-PR', 'AS': 'en-AS', 'GU': 'en-GU',
            'MP': 'en-MP', 'VI': 'en-VI', 'PR': 'es-PR', 'AS': 'en-AS',
            'GU': 'en-GU', 'MP': 'en-MP', 'VI': 'en-VI', 'PR': 'es-PR'
        };
        return localeMap[countryCode] || 'en-US';
    }

    /**
     * Apply location spoofing to all tabs
     */
    static async applyLocationSpoofing(timezone, locale, latitude, longitude) {
        try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                    await this.attachDebugger(tab.id, timezone, locale, latitude, longitude);
                }
            }
        } catch (error) {
            // Error removed
        }
    }

    /**
     * Update all tabs with new location data (re-attach debugger with new values)
     */
    static async updateAllTabsWithNewLocation(ipLocation) {
        try {
            // Log removed
            const tabs = await chrome.tabs.query({});
            
            for (const tab of tabs) {
                if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && 
                    !tab.url.startsWith('moz-extension://') && !tab.url.startsWith('edge-extension://') &&
                    !tab.url.startsWith('about:') && !tab.url.startsWith('file://')) {
                    
                    try {
                        // First, push live values into MAIN world so no reload is needed
                        try {
                            await chrome.scripting.executeScript({
                                target: { tabId: tab.id, allFrames: true },
                                world: 'MAIN',
                                func: (tz, loc) => {
                                    try {
                                        window.__ks_boot_tz__ = tz;
                                        window.__ks_boot_locale__ = loc || 'en-US';
                                        if (typeof window.updateEarlyTimezoneSpoofing === 'function') {
                                            window.updateEarlyTimezoneSpoofing(tz, loc || 'en-US');
                                        }
                                    } catch (e) {
                                        // Warning removed
                                    }
                                },
                                args: [ipLocation.timezone, ipLocation.locale]
                            });
                        } catch (e) {
                            // Warning removed
                        }

                        // Then re-attach debugger to refresh CDP emulations (tz/geolocation)
                        try { await chrome.debugger.detach({ tabId: tab.id }); } catch (_) {}
                        await this.attachDebugger(
                            tab.id,
                            ipLocation.timezone,
                            ipLocation.locale,
                            ipLocation.latitude,
                            ipLocation.longitude
                        );

                        // Log removed
                    } catch (error) {
                        // Warning removed
                    }
                }
            }
            
            // Log removed
        } catch (error) {
            // Error removed
        }
    }

    /**
     * Attach debugger to tab for location spoofing
     */
    static async attachDebugger(tabId, timezone, locale, latitude, longitude) {
        try {
            if (!timezone && !locale && !latitude && !longitude) return;
            
            // Get tab info first to check if it's a valid target
            const tab = await chrome.tabs.get(tabId);
            if (!tab || !tab.url) return;
            
            // Skip chrome:// URLs and extension URLs
            if (tab.url.startsWith('chrome://') || 
                tab.url.startsWith('chrome-extension://') ||
                tab.url.startsWith('moz-extension://') ||
                tab.url.startsWith('edge-extension://') ||
                tab.url.startsWith('about:') ||
                tab.url.startsWith('file://')) {
                // Log removed
                return;
            }
            
            await chrome.debugger.attach({ tabId: tabId }, '1.3');

            // Inject boot timezone/locale before any page script runs (first paint guarantee)
            try {
                const bootScript = `(() => { try { window.__ks_boot_tz__ = ${JSON.stringify(timezone || '')}; window.__ks_boot_locale__ = ${JSON.stringify(locale || 'en-US')}; } catch(e){} })();`;
                await chrome.debugger.sendCommand(
                    { tabId: tabId },
                    'Page.addScriptToEvaluateOnNewDocument',
                    { source: bootScript }
                );
            } catch (e) {
                // Log removed
            }
            
            if (timezone) {
                await chrome.debugger.sendCommand(
                    { tabId: tabId },
                    'Emulation.setTimezoneOverride',
                    { timezoneId: timezone }
                );
            }
            
            if (latitude && longitude) {
                await chrome.debugger.sendCommand(
                    { tabId: tabId },
                    'Emulation.setGeolocationOverride',
                    {
                        latitude: parseFloat(latitude),
                        longitude: parseFloat(longitude),
                        accuracy: 1,
                    }
                );
            }
            
            if (locale) {
                await chrome.debugger.sendCommand(
                    { tabId: tabId },
                    'Emulation.setLocaleOverride',
                    { locale: locale }
                );
            }
            
            // Apply a JS fallback layer as well to defeat aggressive probes
            try {
                await BackgroundManager.applyJSFallbackTimezone(tabId, timezone, locale);
                // Log removed
            } catch (e) {
                // Log removed
            }
            
            // Log removed
        } catch (error) {
            if (error.message && (
                error.message.includes('Another debugger is already attached') ||
                error.message.includes('Cannot access a chrome:// URL') ||
                error.message.includes('Cannot attach to this target')
            )) {
                // If DevTools is open (another debugger attached), fall back to JS override in MAIN world
                if (error.message.includes('Another debugger is already attached')) {
                    try {
                        await BackgroundManager.applyJSFallbackTimezone(tabId, timezone, locale);
                        // Log removed
                    } catch (e) {
                        // Warning removed
                    }
                }
                return;
            }
            // Warning removed
        }
    }

    /**
     * Apply JS-only fallback overrides when debugger cannot attach (e.g., DevTools open)
     */
    static async applyJSFallbackTimezone(tabId, timezone, locale) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId, allFrames: true },
                world: 'MAIN',
                func: (tz, loc) => {
                    try {
                        const OriginalDateTimeFormat = Intl.DateTimeFormat;
                        const OriginalDate = Date;

                        // Override Intl.DateTimeFormat to always use provided timezone
                        Intl.DateTimeFormat = function(locales, options) {
                            const optionsPatched = { ...(options || {}), timeZone: tz };
                            return new OriginalDateTimeFormat(locales || loc || 'en-US', optionsPatched);
                        };
                        if (OriginalDateTimeFormat.supportedLocalesOf) {
                            Intl.DateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf;
                        }

                        // Override resolvedOptions to report timezone
                        const proto = OriginalDateTimeFormat.prototype;
                        if (proto && proto.resolvedOptions) {
                            const originalResolved = proto.resolvedOptions;
                            proto.resolvedOptions = function() {
                                const r = originalResolved.call(this) || {};
                                r.timeZone = tz;
                                return r;
                            };
                        }

                        // Minimal Date override for getTimezoneOffset alignment
                        const calcOffset = () => {
                            const now = new OriginalDate();
                            const utc = new OriginalDate(now.getTime() + (now.getTimezoneOffset() * 60000));
                            const spoofed = new OriginalDate(utc.toLocaleString('en-US', { timeZone: tz }));
                            return Math.round((spoofed.getTime() - utc.getTime()) / 60000);
                        };
                        const offset = calcOffset();
                        Object.defineProperty(OriginalDate.prototype, 'getTimezoneOffset', {
                            value: function() { return -offset; }, configurable: true, writable: true
                        });

                        // Navigator language hints
                        try {
                            Object.defineProperty(navigator, 'language', { get: () => (loc || 'en-US'), configurable: true });
                            Object.defineProperty(navigator, 'languages', { get: () => [loc || 'en-US'], configurable: true });
                        } catch {}
                    } catch (e) {
                        // Log removed
                    }
                },
                args: [timezone, locale]
            });
        } catch (e) {
            // Warning removed
        }
    }

    /**
     * Initialize background script
     */
    static async initialize() {
        try {
            // Log removed
            
            // Initialize WebRTC settings
            // Log removed
            await this.initializeWebRTC();
            
            // First, get IP and set up rules
            // Log removed
            await this.updateIPAndRules();
            
            // Initialize location spoofing (after IP is fetched)
            // Log removed
            try {
                await this.initializeLocationSpoofing();
                // Log removed
            } catch (error) {
                // Error removed
            }
            
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
            
            // Set up navigation listener for location spoofing
            chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
                try {
                    const data = await chrome.storage.local.get(['location_config', 'timezone', 'locale', 'latitude', 'longitude']);
                    const config = data.location_config || 'matchIP';
                    
                    if (config !== 'browserDefault') {
                        let timezone = data.timezone || '';
                        let locale = data.locale || '';
                        let latitude = data.latitude || '';
                        let longitude = data.longitude || '';
                        
                        // If matchIP, fetch current IP location
                        if (config === 'matchIP') {
                            const ipLocation = await this.fetchIPLocation();
                            if (ipLocation) {
                                timezone = ipLocation.timezone;
                                locale = ipLocation.locale;
                                latitude = ipLocation.latitude;
                                longitude = ipLocation.longitude;
                                
                                // Update stored values with new IP location
                                await chrome.storage.local.set({
                                    timezone: timezone,
                                    locale: locale,
                                    latitude: latitude,
                                    longitude: longitude
                                });
                            }
                        }

                        // 1) Inject boot values synchronously into MAIN world before page scripts run
                        try {
                            await chrome.scripting.executeScript({
                                target: { tabId: details.tabId, frameIds: [0] },
                                world: 'MAIN',
                                injectImmediately: true,
                                func: (tz, loc) => {
                                    try {
                                        window.__ks_boot_tz__ = tz;
                                        window.__ks_boot_locale__ = loc;
                                    } catch (_) {}
                                },
                                args: [timezone, locale]
                            });
                        } catch (e) {
                            // Log removed
                        }
                        
                        // Apply to new tab
                        await this.attachDebugger(details.tabId, timezone, locale, latitude, longitude);
                    }
                } catch (error) {
                    // Error removed
                }
            });

            // Capture URL at navigation start for accurate blocked-domain reporting
            chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
                try {
                    const blockedPage = chrome.runtime.getURL('html/blocked.html');
                    const url = changeInfo.url || tab?.url || '';
                    if (!url || !/^https?:/i.test(url)) return;
                    if (url.startsWith(blockedPage)) return;
                    // store immediately; used by blocked.html
                    const host = new URL(url).hostname;
                    await chrome.storage.local.set({ [`blockedUrl_${tabId}`]: url, last_blocked_domain: host });
                } catch (_) {}
            });
            
            // Set up cached rules for sync access
            await this.setupCachedRules();
            // Build immediate blocking rules (DNR) to avoid late blocking
            await this.setupDeclarativeNetRequest();
            // Set up DNS level proxy routing
            const pacAppliedInit = await this.setupProxyBlocking();
            
            // اگر PAC فعال شد، قوانین DNR را پاک می‌کنیم
            if (pacAppliedInit) {
                await this.clearDynamicRules();
            }
            
            // Force refresh proxy settings with delay
            setTimeout(async () => {
                await this.refreshProxySettings();
            }, 1000);
            
            // Note: PAC script handles whitelist logic, no need to clear proxy
            
            // Set up detection for blocked requests
            this.setupBlockedRequestDetection();
            // Capture original target URL before any redirect/block occurs
            try {
                chrome.webNavigation.onBeforeNavigate.addListener(async (details)=>{
                    try {
                        if (details.frameId !== 0) return; // main_frame only
                        const url = details.url || '';
                        if (!/^https?:/i.test(url)) return;
                        const should = await this.shouldBlockURL(url);
                        if (should && details.tabId > 0) {
                            const domain = (new URL(url)).hostname;
                            await chrome.storage.local.set({
                                [`blockedUrl_${details.tabId}`]: url,
                                last_blocked_domain: domain
                            });
                            
                            // Also store in session storage for immediate access
                            await chrome.storage.session.set({
                                [`blocked_domain_${details.tabId}`]: domain,
                                current_blocked_domain: domain
                            });
                            
                            // Store in sessionStorage for the blocked page
                            try {
                                await chrome.scripting.executeScript({
                                    target: { tabId: details.tabId },
                                    func: (domain) => {
                                        sessionStorage.setItem('blocked_domain', domain);
                                    },
                                    args: [domain]
                                });
                            } catch (error) {
                                // Log removed
                            }
                        }
                    } catch (_) {}
                });
                // Log removed
            } catch (e) {
                // Warning removed
            }
            
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
            // Log removed
            
            // Check if alarms API is available
            if (!chrome.alarms) {
                // Warning removed
                // Fallback: use setInterval instead
                setInterval(() => {
                    // Log removed
                    this.updateIPAndRules();
                }, 30000); // 30 seconds
                return;
            }
            
            // Create an alarm to refresh the IP every 30 seconds
            chrome.alarms.create('refreshIP', {
                delayInMinutes: 0.5,  // 30 ثانیه تاخیر اولیه
                periodInMinutes: 0.5  // هر 30 ثانیه تکرار
            });
            
            // Add a listener for when the alarm fires
            chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
            // Log removed
        } catch (error) {
            // Error removed
            // Fallback: use setInterval
            setInterval(() => {
                // Log removed
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
            // Log removed
            await this.updateIPAndRules();
        }
    }


    /**
     * Force clear proxy on startup
     */
    static async forceClearProxyOnStartup() {
        try {
            // Log removed
            
            // Multiple clear attempts
            for (let i = 0; i < 5; i++) {
                await chrome.proxy.settings.clear({});
                // Log removed
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Force set direct connection
            await chrome.proxy.settings.set({
                value: { mode: 'direct' },
                scope: 'regular'
            });
            // Log removed
            
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Clear again
            await chrome.proxy.settings.clear({});
            // Log removed
            
        } catch (error) {
            // Error removed
        }
    }

    /**
     * Force refresh proxy settings to ensure changes take effect
     */
    static async refreshProxySettings() {
        try {
            // Log removed
            
            // Get current proxy settings
            const settings = await chrome.proxy.settings.get({});
            try {
                // Log removed
            } catch (_) {
                // Log removed
            }
            
            // Force a refresh by setting the same settings again
            if (settings.value && settings.value.mode === 'pac_script') {
                await chrome.proxy.settings.set({
                    value: settings.value,
                    scope: 'regular'
                });
                // Log removed
            } else {
                // Log removed
            }
        } catch (error) {
            // Error removed
        }
    }

    /**
     * Dump proxy settings and active tab context for diagnostics
     */
    static async dumpProxySnapshot() {
        try {
            const settings = await chrome.proxy.settings.get({});
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            const activeTab = tabs && tabs[0] ? { id: tabs[0].id, url: tabs[0].url, status: tabs[0].status } : null;
            const snapshot = {
                ts: new Date().toISOString(),
                proxySettings: settings,
                activeTab,
            };
            // Log removed
            await chrome.storage.local.set({ proxy_snapshot: snapshot });
            return snapshot;
        } catch (e) {
            // Warning removed
            return null;
        }
    }

    /**
     * Set up detection for requests blocked by the proxy.
     * When a request fails because of our proxy, we redirect the tab to our custom block page.
     */
    static setupBlockedRequestDetection() {
        // Log removed
        this._proxyErrorCount = 0;
        // Pre-capture main_frame navigations that will be blocked (for accurate blocked domain on custom page)
        try {
            chrome.webRequest.onBeforeRequest.addListener(
                (details) => {
                    try {
                        const blockedPage = chrome.runtime.getURL('html/blocked.html');
                        if (details.type !== 'main_frame') return;
                        if (details.url.startsWith(blockedPage)) return;
                        // Async evaluate and store intended blocked URL
                        this.shouldBlockURL(details.url).then((shouldBlock) => {
                            if (shouldBlock && details.tabId > 0) {
                                const domain = (new URL(details.url)).hostname;
                                chrome.storage.local.set({
                                    [`blockedUrl_${details.tabId}`]: details.url,
                                    last_blocked_domain: domain
                                });
                                
                                // Also store in session storage for immediate access
                                chrome.storage.session.set({
                                    [`blocked_domain_${details.tabId}`]: domain,
                                    current_blocked_domain: domain
                                });
                                
                                // Store in sessionStorage for the blocked page
                                chrome.scripting.executeScript({
                                    target: { tabId: details.tabId },
                                    func: (domain) => {
                                        sessionStorage.setItem('blocked_domain', domain);
                                    },
                                    args: [domain]
                                }).catch(() => {});
                            }
                        }).catch(()=>{});
                    } catch (_) { /* noop */ }
                },
                { urls: ["<all_urls>"] }
            );
        } catch (e) {
            // Warning removed
        }
        chrome.webRequest.onErrorOccurred.addListener(
            async (details) => {
                // Log removed
                // Log removed
                // Log removed
                
                // These errors indicate the proxy blocked the connection
                const proxyErrors = [
                    'net::ERR_PROXY_CONNECTION_FAILED',
                    'net::ERR_TUNNEL_CONNECTION_FAILED',
                    'net::ERR_CONNECTION_REFUSED',
                    'net::ERR_BLOCKED_BY_CLIENT'
                ];

                if (proxyErrors.includes(details.error) && details.tabId > 0) {
                    // Log removed
                    // Auto-recovery: if fallback is enabled and repeated proxy errors occur, disable and clear
                    const cfg = await chrome.storage.local.get(['fallback_enabled']);
                    if (cfg.fallback_enabled) {
                        this._proxyErrorCount = (this._proxyErrorCount || 0) + 1;
                        clearTimeout(this._proxyErrorTimer);
                        this._proxyErrorTimer = setTimeout(()=>{ this._proxyErrorCount = 0; }, 3000);
                        if (this._proxyErrorCount >= 3) {
                            // Warning removed
                            await this.recoverFromProxyFailure();
                            this._proxyErrorCount = 0;
                        }
                    }
                    
                    // Check if this URL should actually be blocked by our rules (async version)
                    const shouldBlock = await this.shouldBlockURL(details.url);
                    
                    if (shouldBlock) {
                        // Log removed
                        try {
                            // Store the original URL so the blocked page can display it
                            const domain = URLUtils.getHostFromURL(details.url);
                            // Log removed
                            // Log removed
                            // Log removed
                            
                            // Test URL parsing
                            try {
                                const testUrl = new URL(details.url);
                                // Log removed
                            } catch (error) {
                                // Log removed
                            }
                            await chrome.storage.local.set({ 
                                [`blockedUrl_${details.tabId}`]: details.url,
                                last_blocked_domain: domain
                            });
                            
                            // Also store in session storage for immediate access
                            try {
                                await chrome.storage.session.set({
                                    [`blocked_domain_${details.tabId}`]: domain,
                                    current_blocked_domain: domain
                                });
                            } catch (error) {
                                // Log removed
                            }
                            
                            // Log removed
                            
                            // Update the tab to show our custom blocked page
                            const blockedPageUrl = chrome.runtime.getURL(`html/blocked.html?domain=${encodeURIComponent(domain)}`);
                            // Log removed
                            
                            // Store domain in sessionStorage for the blocked page
                            try {
                                await chrome.scripting.executeScript({
                                    target: { tabId: details.tabId },
                                    func: (domain) => {
                                        sessionStorage.setItem('blocked_domain', domain);
                                    },
                                    args: [domain]
                                });
                            } catch (error) {
                                // Log removed
                            }
                            
                            await chrome.tabs.update(details.tabId, {
                                url: blockedPageUrl
                            });
                            
                            // Log removed
                        } catch (error) {
                            // It's possible the tab was closed before we could update it.
                            if (!error.message.includes('No tab with id')) {
                                // Error removed
                            }
                        }
                    } else {
                        // Log removed
                        // Log removed
                    }
                }
            },
            { urls: ["<all_urls>"] }
        );
        // Log removed

        // Optional basic WebRTC leak mitigation when enabled
        chrome.storage.local.get(['webrtc_protect'], (cfg) => {
            if (!cfg.webrtc_protect) return;
            try {
                // Limit WebRTC with privacy API where available
                if (chrome.privacy && chrome.privacy.network) {
                    if (chrome.privacy.network.webRTCIPHandlingPolicy) {
                        chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: 'default_public_interface_only' });
                    }
                    if (chrome.privacy.network.webRTCMultipleRoutesEnabled) {
                        chrome.privacy.network.webRTCMultipleRoutesEnabled.set({ value: false });
                    }
                }
            } catch (e) {
                // Warning removed
            }
        });
    }

    /**
     * Emergency recovery: disable fallback and clear proxy settings
     */
    static async recoverFromProxyFailure() {
        try {
            await chrome.storage.local.set({ fallback_enabled: false });
            await chrome.proxy.settings.clear({});
            // Log removed
        } catch (e) {
            // Error removed
        }
    }


    /**
     * Check and block tab immediately
     * @param {number} tabId - Tab ID
     * @param {string} url - URL to check
     */
    static async checkAndBlockTabImmediately(tabId, url) {
        try {
            // Log removed
            
            const shouldBlock = await this.shouldBlockURL(url);
            
            if (shouldBlock) {
                // Log removed
                
                // Set tab color to red immediately
                await chrome.storage.local.set({
                    [`tabColors${tabId}`]: 'red'
                });
                await this.setColor(tabId);
                
                // Block immediately by redirecting to blocked page
                try {
                    const domain = URLUtils.getHostFromURL(details.url);
                    const blockedPageUrl = chrome.runtime.getURL(`html/blocked.html?domain=${encodeURIComponent(domain)}`);
                    
                    // Store domain in session storage
                    try {
                        await chrome.storage.session.set({
                            [`blocked_domain_${tabId}`]: domain,
                            current_blocked_domain: domain
                        });
                    } catch (error) {
                        // Log removed
                    }
                    
                    // Store domain in sessionStorage for the blocked page
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            func: (domain) => {
                                sessionStorage.setItem('blocked_domain', domain);
                            },
                            args: [domain]
                        });
                    } catch (error) {
                        // Log removed
                    }
                    
                    await chrome.tabs.update(tabId, {
                        url: blockedPageUrl
                    });
                    // Log removed
                } catch (redirectError) {
                    // Error removed
                    
                    // Fallback: try to close the tab
                    try {
                        await chrome.tabs.remove(tabId);
                        // Log removed
                    } catch (closeError) {
                        // Error removed
                    }
                }
            } else {
                // Log removed
                await this.updateTabColor(tabId, url);
            }
        } catch (error) {
            // Error removed
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
            // Log removed
            
            // Use cached data if available
            if (this._cachedRules && this._cachedRules.length > 0) {
                // Log removed
                for (const rule of this._cachedRules) {
                    // Log removed
                    const domainMatch = URLUtils.matchingDomainRegex(url, rule.domain);
                    // Log removed
                    
                    if (domainMatch) {
                        // Log removed
                        const shouldBlock = this.checkIPRules(rule.currentIP, rule.allowedIPs);
                        // Log removed
                        return shouldBlock;
                    }
                }
            } else {
                // Log removed
                // Fallback: return false for now, let the async version handle it
                return false;
            }
            
            // Log removed
            return false;
        } catch (error) {
            // Error removed
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
            // Log removed
            
            // First, check country rules for ALL URLs
            try {
                const userIP = await IPUtils.getCachedIP();
                const userCountry = await IPUtils.getCachedCountry();
                
                // Log removed
                
                // Force country detection if not available
                if (ValidationUtils.isValidIP(userIP) && !userCountry) {
                    // Log removed
                    const detectedCountry = await IPUtils.getCountryFromIP(userIP);
                    if (detectedCountry) {
                        // Log removed
                        await chrome.storage.local.set({
                            cachedCountry: detectedCountry,
                            countryTimestamp: Date.now()
                        });
                        userCountry = detectedCountry;
                    }
                }
                
                if (ValidationUtils.isValidIP(userIP) && userCountry) {
                    // Log removed
                    const shouldBlockCountry = await this.checkCountryRules(url, userIP, userCountry);
                    
                    if (shouldBlockCountry) {
                        // Log removed
                        return true;
                    } else {
                        // Log removed
                    }
                } else {
                    // Log removed
                }
            } catch (error) {
                // Error removed
                await ErrorHandler.handle(error, 'shouldBlockURL - Country check');
                // Don't block on country check error, just log it
            }
            
            // Then check IP rules
            const storageData = await chrome.storage.local.get(['urls', 'allowed_ips']);
            const storedUrls = storageData.urls || [];
            const storedIPs = storageData.allowed_ips || [];
            
            // Log removed
            // Log removed
            
            // Check if URL matches any stored domain
            for (let i = 0; i < storedUrls.length; i++) {
                const domainMatches = URLUtils.matchingDomainRegex(url, storedUrls[i]);
                // Log removed
                
                if (domainMatches) {
                    const currentIPs = storedIPs[i] ? storedIPs[i].replace(/\|$/, '').split(',') : [];
                    
                    try {
                        const userIP = await IPUtils.getCachedIP();
                        
                        if (!ValidationUtils.isValidIP(userIP)) {
                            throw new Error(`Invalid IP address received: ${userIP}`);
                        }
                        
                        // Debug logging
                        // Log removed
                        // Log removed
                        // Log removed
                        
                        const shouldBlock = this.checkIPRules(userIP, currentIPs);
                        
                        // Log removed
                        // Log removed
                        
                        return shouldBlock;
                        
                    } catch (error) {
                        // Error removed
                        await ErrorHandler.handle(error, 'shouldBlockURL - IP fetch');
                        return true; // Block on error for security
                    }
                }
            }
            
            // Log removed
            return false; // No matching domain, don't block
            
        } catch (error) {
            // Error removed
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
            // Log removed
            
            // Get all stored URLs for caching
            const storageData = await chrome.storage.local.get(['urls', 'allowed_ips', 'country_rules']);
            const storedUrls = storageData.urls || [];
            const storedIPs = storageData.allowed_ips || [];
            const countryRules = storageData.country_rules || [];
            const currentIP = await IPUtils.getCachedIP();
            const currentCountry = await IPUtils.getCachedCountry();
            
            // Log removed
            // Log removed
            // Log removed
            // Log removed
            // Log removed
            
            // Cache rules for sync access
            this._cachedRules = [];
            this._blockedDomains = new Set();
            
            // Log removed
            
            for (let i = 0; i < storedUrls.length; i++) {
                const domain = storedUrls[i];
                const allowedIPsString = storedIPs[i] || '';
                const allowedIPs = allowedIPsString.replace(/\|$/, '').split(',').filter(ip => ip.trim());
                
                // Log removed
                // Log removed
                
                this._cachedRules.push({
                    domain: domain,
                    allowedIPs: allowedIPs,
                    currentIP: currentIP
                });
                
                // Check if this domain should be blocked
                const shouldBlock = this.checkIPRules(currentIP, allowedIPs);
                // Log removed
                
                if (shouldBlock) {
                    // Convert wildcard domains to specific patterns
                    if (domain.includes('*')) {
                        if (domain === '*.binance.*') {
                            this._blockedDomains.add('binance.com');
                            this._blockedDomains.add('www.binance.com');
                            this._blockedDomains.add('api.binance.com');
                            this._blockedDomains.add('binance.org');
                            this._blockedDomains.add('www.binance.org');
                            // Log removed
                        } else {
                            // General wildcard handling
                            const baseDomain = domain.replace(/^\*\./, '').replace(/\.\*$/, '');
                            this._blockedDomains.add(baseDomain);
                            this._blockedDomains.add(`www.${baseDomain}`);
                            // Log removed
                        }
                    } else {
                        this._blockedDomains.add(domain);
                        this._blockedDomains.add(`www.${domain}`);
                        // Log removed
                    }
                } else {
                    // Log removed
                }
            }
            
            // Process country rules
            // Log removed
            // Log removed
            
            for (const rule of countryRules) {
                // Log removed
                // Log removed
                
                const isCountryAllowed = rule.countries.includes(currentCountry);
                let shouldBlockCountry = false;
                
                if (rule.mode === 'whitelist') {
                    shouldBlockCountry = !isCountryAllowed;
                } else if (rule.mode === 'blacklist') {
                    shouldBlockCountry = isCountryAllowed;
                }
                
                // Log removed
                
                if (shouldBlockCountry) {
                    // Add domain to blocked list
                    if (rule.domain.includes('*')) {
                        // Special handling for *.bingx.com to include all related domains for PAC blocking
                        if (rule.domain === '*.bingx.com') {
                            const bingxRelatedDomains = [
                                'bingx.com', 'www.bingx.com', 'api.bingx.com', 'trade.bingx.com',
                                'bb-client-new.log-global.aliyuncs.com', // BingX logging domain
                                'front-log.great-api.com', // BingX frontend logging
                                'scripts.prdredir.com' // BingX scripts
                            ];
                            bingxRelatedDomains.forEach(d => this._blockedDomains.add(d));
                            // Log removed
                        } else {
                            const baseDomain = rule.domain.replace(/^\*\./, '').replace(/\.\*$/, '');
                            this._blockedDomains.add(baseDomain);
                            this._blockedDomains.add(`www.${baseDomain}`);
                            // Log removed
                        }
                    } else {
                        this._blockedDomains.add(rule.domain);
                        // Log removed
                    }
                }
            }
            
            // Log removed
            // Log removed
            // Log removed
        } catch (error) {
            // Error removed
        }
    }

    /**
     * Set up DNS level proxy blocking
     */
    static async setupProxyBlocking() {
        try {
            // Log removed

            // Gather inputs
            const currentIP = await IPUtils.getCachedIP();
            const { urls = [], allowed_ips = [] } = await chrome.storage.local.get(['urls', 'allowed_ips']);

            // Build whitelist data (domain → allowed IPs)
            const whitelistData = [];
            for (let i = 0; i < urls.length; i++) {
                const domain = urls[i];
                const allowedIPsString = allowed_ips[i] || '';
                const allowedIPs = allowedIPsString.replace(/\|$/, '').split(',').filter(ip => ip.trim());
                whitelistData.push({ domain, allowedIPs });
            }

            // Blocked domains generated previously in setupCachedRules
            const blockedDomains = this._blockedDomains ? Array.from(this._blockedDomains) : [];

            // Fallback proxy (optional) or auto-derive from system when possible
            const { fallback_proxy = '' } = await chrome.storage.local.get(['fallback_proxy']);
            let fallback = '';
            try {
                const sys = await chrome.proxy.settings.get({});
                const mode = sys?.value?.mode;
                // Map Chrome proxy scheme to PAC keyword
                const toPacToken = (p) => {
                    if (!p || !p.host || !p.port) return '';
                    const scheme = (p.scheme || '').toLowerCase();
                    if (scheme === 'https') return `HTTPS ${p.host}:${p.port}`;
                    if (scheme === 'socks5') return `SOCKS5 ${p.host}:${p.port}`;
                    if (scheme === 'socks' || scheme === 'socks4') return `SOCKS ${p.host}:${p.port}`;
                    // default http
                    return `PROXY ${p.host}:${p.port}`;
                };
                if (mode === 'fixed_servers' && sys.value?.rules) {
                    const rules = sys.value.rules;
                    const pick = rules.singleProxy || rules.proxyForHttp || rules.proxyForHttps || rules.fallbackProxy;
                    const pacTok = toPacToken(pick);
                    if (pacTok) fallback = pacTok;
                } else if (mode === 'direct' || mode === 'system') {
                    // Always respect system/direct: never set PAC; rely on DNR when needed
                    await chrome.proxy.settings.clear({});
                    // Log removed
                    return false;
                } else if (mode === 'pac_script') {
                    // When user/system already has PAC, do not override unless we must block domains via sinkhole
                    if (blockedDomains.length === 0) {
                        // System PAC present and no blocked domains; leaving as-is
                        return false;
                    }
                }
                // If system proxy not detectable but user provided fallback_proxy, use it
                // IMPORTANT: در حالت system/direct، از fallback کاربر استفاده نمی‌کنیم تا وقتی سیستم پروکسی خاموش است، مسیر DIRECT بماند
            } catch (e) {
                // Warning removed
            }

            // Generate and apply PAC
            const pacScript = this.generatePACScript(blockedDomains, currentIP, whitelistData, fallback);
            const proxyConfig = { mode: 'pac_script', pacScript: { data: pacScript } };
            await chrome.proxy.settings.set({ value: proxyConfig, scope: 'regular' });
            // Log removed
            return true;
            
        } catch (error) {
            // Error removed
            return false;
        }
    }

    /**
     * Generate PAC script for redirecting blocked domains
     */
    static generatePACScript(blockedDomains, currentIP, whitelistData, fallbackProxy = '') {
        const blockedDomainsArray = JSON.stringify(blockedDomains);
        const blockedPageUrl = chrome.runtime.getURL('html/blocked.html');
        const whitelistDataStr = JSON.stringify(whitelistData);
        
        return `
function FindProxyForURL(url, host) {
    // Log removed
    // Log removed
    // Log removed
    // Log removed
    
    var blockedDomains = ${blockedDomainsArray};
    var whitelistData = ${whitelistDataStr};
    var currentIP = "${currentIP}";
    var fallbackProxy = ${JSON.stringify(fallbackProxy)};
    var ipCheckHosts = ["api.ipify.org","ipapi.co","ipinfo.io","icanhazip.com","ifconfig.me"];
    
    // Check if this is already our blocked page - allow it
    if (url.indexOf("${blockedPageUrl}") === 0) {
        // Log removed
        return "DIRECT";
    }

    // 0) Country/IP pre-block: if host is in blockedDomains (from cached IP/country rules), sinkhole immediately
    //    This ensures country-based blocks are applied before any content loads
    for (var bi = 0; bi < blockedDomains.length; bi++) {
        var bd = blockedDomains[bi];
        if (host === bd || host.endsWith('.' + bd)) {
            // Log removed
            return "PROXY 127.0.0.1:1";
        }
    }
    
    // Check if current IP is in whitelist for this domain
    // Log removed
    for (var i = 0; i < whitelistData.length; i++) {
        var domain = whitelistData[i].domain;
        var allowedIPs = whitelistData[i].allowedIPs;
        // Log removed
        
        // Check if host matches this domain
        var domainMatch = false;
        
        // Handle wildcard domains
        if (domain.includes('*')) {
            if (domain === '*.binance.*') {
                // Match any binance domain
                if (host.indexOf('binance') !== -1) {
                    // Log removed
                    domainMatch = true;
                }
            } else if (domain.startsWith('*.')) {
                // Match subdomains
                var baseDomain = domain.substring(2);
                if (host === baseDomain || host.endsWith('.' + baseDomain)) {
                    // Log removed
                    domainMatch = true;
                }
            } else if (domain.endsWith('.*')) {
                // Match domains with same prefix
                var prefix = domain.substring(0, domain.length - 2);
                if (host.startsWith(prefix)) {
                    // Log removed
                    domainMatch = true;
                }
            }
        } else {
            // Exact match
            if (host === domain) {
                // Log removed
                domainMatch = true;
            } else if (host.endsWith('.' + domain)) {
                // Log removed
                domainMatch = true;
            }
        }
        
        if (domainMatch) {
            // Log removed
            // Log removed
            
            // Check if current IP is in whitelist
            for (var j = 0; j < allowedIPs.length; j++) {
                if (allowedIPs[j] === currentIP) {
                    // Log removed
                    if (fallbackProxy && fallbackProxy.length > 0) {
                        return fallbackProxy;
                    }
                    return "DIRECT";
                }
            }
            // Log removed
            // Always sinkhole blocked domains to prevent load regardless of proxy
            return "PROXY 127.0.0.1:1";
        }
    }
    
    // Force IP check endpoints through proxy when available
    for (var k = 0; k < ipCheckHosts.length; k++) {
        var h = ipCheckHosts[k];
        if (host === h || host.endsWith('.' + h)) {
            if (fallbackProxy && fallbackProxy.length > 0) {
                return fallbackProxy;
            }
        }
    }
    // Log removed
    // Log removed
    if (fallbackProxy && fallbackProxy.length > 0) {
        return fallbackProxy;
    }
    return "DIRECT";
}`;
    }

    /**
     * Set up declarativeNetRequest for real blocking
     */
    static async setupDeclarativeNetRequest() {
        try {
            // Log removed
            
            // Get all stored URLs for blocking
            const storageData = await chrome.storage.local.get(['urls', 'allowed_ips', 'country_rules']);
            const storedUrls = storageData.urls || [];
            const storedIPs = storageData.allowed_ips || [];
            const countryRules = storageData.country_rules || [];
            
            // Log removed
            // Log removed
            
            // Clear existing rules (only ours: ids 1..999)
            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            const ruleIdsToRemove = existingRules.filter(r=> r.id>=1 && r.id<=999).map(rule => rule.id);
            if (ruleIdsToRemove.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIdsToRemove });
            }
            
            // Get current IP and country
            const currentIP = await IPUtils.getCachedIP();
            const currentCountry = await IPUtils.getCachedCountry();
            // Log removed
            // Log removed
            
            // Create rules for each URL
            const rules = [];
            // start ids from 1.. to avoid clashing
            let ruleId = 1;
            
            // Process each URL entry
            for (let i = 0; i < storedUrls.length; i++) {
                try {
                    const domain = storedUrls[i];
                    const allowedIPsString = storedIPs[i] || '';
                    const allowedIPs = allowedIPsString.replace(/\|$/, '').split(',').filter(ip => ip.trim());
                    
                    // Log removed
                    // Log removed
                    // Log removed
                    // Log removed
                    
                    // Check if current IP is allowed
                    const shouldBlock = this.checkIPRules(currentIP, allowedIPs);
                    // Log removed
                    
                    if (shouldBlock) {
                        // Create redirect rule to custom blocked page (so user always sees our page)
                        const regexFilter = URLUtils.domainToRegex(domain);
                        const rule = {
                            id: ruleId++,
                            priority: 1,
                            action: {
                                type: 'redirect',
                                redirect: { extensionPath: '/html/blocked.html' }
                            },
                            condition: {
                                regexFilter: regexFilter,
                                resourceTypes: ['main_frame']
                            }
                        };
                        
                        rules.push(rule);
                        // Log removed
                        // Log removed
                    } else {
                        // Log removed
                    }
                } catch (error) {
                    // Error removed
                }
            }
            
            // Also add country-based blocking rules for immediate main-frame blocking
            if (countryRules && countryRules.length > 0 && currentCountry) {
                // Log removed
                for (const rule of countryRules) {
                    try {
                        const isCountryAllowed = (rule.countries || []).includes(currentCountry);
                        let shouldBlockCountry = false;
                        if (rule.mode === 'whitelist') {
                            shouldBlockCountry = !isCountryAllowed;
                        } else if (rule.mode === 'blacklist') {
                            shouldBlockCountry = isCountryAllowed;
                        }
                        if (shouldBlockCountry) {
                            // Base rule for the configured domain pattern
                            const regexFilter = URLUtils.domainToRegex(rule.domain);
                            rules.push({
                                id: ruleId++,
                                priority: 2,
                                action: { type: 'redirect', redirect: { extensionPath: '/html/blocked.html' } },
                                condition: { regexFilter, resourceTypes: ['main_frame'] }
                            });
                            // Log removed

                            // Special handling for *.bingx.com: include related domains that BingX uses
                            if (rule.domain === '*.bingx.com') {
                                const bingxRelatedDomains = [
                                    'bingx.com', 'www.bingx.com', 'api.bingx.com', 'trade.bingx.com',
                                    'bb-client-new.log-global.aliyuncs.com',
                                    'front-log.great-api.com',
                                    'scripts.prdredir.com'
                                ];
                                for (const d of bingxRelatedDomains) {
                                    const r = URLUtils.domainToRegex(d);
                                    rules.push({
                                        id: ruleId++,
                                        priority: 2,
                                        action: { type: 'redirect', redirect: { extensionPath: '/html/blocked.html' } },
                                        condition: { regexFilter: r, resourceTypes: ['main_frame'] }
                                    });
                                    // Log removed
                                }
                            }
                        } else {
                            // Log removed
                        }
                    } catch (e) {
                        // Warning removed
                    }
                }
            }

            // Add rules
            if (rules.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    addRules: rules
                });
                // Log removed
                
                // Log all active rules for debugging
                const activeRules = await chrome.declarativeNetRequest.getDynamicRules();
                // Log removed
                activeRules.forEach(rule => {
                    // Log removed
                });
            } else {
                // Log removed
            }
            
            // Log removed
            
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
            
            // Log removed
        } catch (error) {
            // Error removed
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
                // Log removed
            } else {
                // Log removed
            }
        } catch (error) {
            // Error removed
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
            
            // Log removed
            
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
        // Log removed
        
        // Test domain validation first
        // Log removed
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
            // Log removed
        });
        
        // Log removed
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
            // Log removed
        });
    }

    /**
     * Handle messages from other parts of the extension
     * @param {Object} request - Message request
     * @param {Object} sender - Message sender
     * @param {Function} sendResponse - Response function
     */
    static handleMessage(request, sender, sendResponse) {
        // Log removed
        
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
                            // Log removed
                            await this.updateIPAndRules();
                            const result = await chrome.storage.local.get(['current_ip', 'cachedIP']);
                            const ip = result.current_ip || result.cachedIP;
                            // Log removed
                            sendResponse({ success: true, ip: ip });
                        } catch (error) {
                            // Error removed
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
                        
                    case 'debugCountryRules':
                        try {
                            const countryRules = await chrome.storage.local.get(['country_rules']);
                            const userIP = await IPUtils.getCachedIP();
                            const userCountry = await IPUtils.getCachedCountry();
                            
                            // Log removed
                            // Log removed
                            // Log removed
                            // Log removed
                            
                            sendResponse({ 
                                success: true, 
                                countryRules: countryRules.country_rules,
                                userIP: userIP,
                                userCountry: userCountry
                            });
                        } catch (error) {
                            await ErrorHandler.handle(error, 'debugCountryRules');
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    case 'debugRules':
                        try {
                            // Log removed
                            const storage = await chrome.storage.local.get(['urls', 'allowed_ips', 'current_ip', 'cachedIP']);
                            const currentIP = storage.current_ip || storage.cachedIP;
                            
                            // Log removed
                            // Log removed
                            // Log removed
                            // Log removed
                            // Log removed
                            // Log removed
                            
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
                            // Error removed
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                    case 'debugProxy':
                        try {
                            const snap = await this.dumpProxySnapshot();
                            sendResponse({ success: true, snapshot: snap });
                        } catch (e) {
                            sendResponse({ success: false, error: e.message });
                        }
                        break;
                        
                    case 'clearProxy':
                        try {
                            // Log removed
                            
                            // First, clear proxy settings
                            await chrome.proxy.settings.clear({});
                            // Log removed
                            
                            // Wait a bit for settings to take effect
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            // Force set direct connection
                            await chrome.proxy.settings.set({
                                value: {
                                    mode: 'direct'
                                },
                                scope: 'regular'
                            });
                            // Log removed
                            
                            // Wait a bit more
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            // Clear again to ensure it's really cleared
                            await chrome.proxy.settings.clear({});
                            // Log removed
                            
                            // Wait for final clear to take effect
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            // Force refresh all tabs
                            const tabs = await chrome.tabs.query({});
                            // Log removed
                            
                            for (const tab of tabs) {
                                try {
                                    if (tab.url && tab.url.includes('binance.com')) {
                                        // Log removed
                                        await chrome.tabs.reload(tab.id);
                                    }
                                } catch (e) {
                                    // Log removed
                                }
                            }
                            
                            // Also try to refresh current active tab
                            try {
                                const activeTabs = await chrome.tabs.query({active: true, currentWindow: true});
                                if (activeTabs[0]) {
                                    await chrome.tabs.reload(activeTabs[0].id);
                                    // Log removed
                                }
                            } catch (e) {
                                // Log removed
                            }
                            
                            sendResponse({ success: true });
                        } catch (error) {
                            // Error removed
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    case 'forceClearProxy':
                        try {
                            // Log removed
                            
                            // Multiple clear attempts
                            for (let i = 0; i < 3; i++) {
                                await chrome.proxy.settings.clear({});
                                // Log removed
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                            
                            // Force set direct connection multiple times
                            for (let i = 0; i < 3; i++) {
                                await chrome.proxy.settings.set({
                                    value: { mode: 'direct' },
                                    scope: 'regular'
                                });
                                // Log removed
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                            
                            // Final clear
                            await chrome.proxy.settings.clear({});
                            // Log removed
                            
                            sendResponse({ success: true });
                        } catch (error) {
                            // Error removed
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    case 'updateWebRTCPolicy':
                        try {
                            const { policy } = request;
                            if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
                                await chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: policy });
                                // Log removed
                                sendResponse({ success: true });
                            } else {
                                sendResponse({ success: false, error: 'WebRTC privacy API not available' });
                            }
                        } catch (error) {
                            // Error removed
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    case 'updateLocationSpoofing':
                        try {
                            const { config, timezone, locale, latitude, longitude } = request;
                            
                            if (config === 'browserDefault') {
                                // Detach all debuggers
                                const tabs = await chrome.tabs.query({});
                                for (const tab of tabs) {
                                    try {
                                        await chrome.debugger.detach({ tabId: tab.id });
                                    } catch (e) {
                                        // Ignore if not attached
                                    }
                                }
                                // Log removed
                            } else {
                                // Apply location spoofing
                                await this.applyLocationSpoofing(timezone, locale, latitude, longitude);
                                // Log removed
                                
                                // Store current timezone and locale for getTimezoneSettings
                                await chrome.storage.local.set({
                                    current_timezone: timezone,
                                    current_locale: locale
                                });
                                
                                // Log removed
                            }
                            
                            sendResponse({ success: true });
                        } catch (error) {
                            // Error removed
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    case 'getTimezoneSettings':
                        try {
                            // Get all timezone data
                            const tzData = await chrome.storage.local.get(['location_config', 'timezone', 'locale', 'current_timezone', 'current_locale', 'current_ip', 'ip_country']);
                            // Log removed
                            
                            const useIP = (tzData.location_config || 'matchIP') === 'matchIP';
                            let timezone, locale;
                            
                            if (useIP && tzData.current_timezone) {
                                // Use IP-based timezone
                                timezone = tzData.current_timezone;
                                locale = tzData.current_locale || 'en-US';
                                // Log removed
                            } else if (tzData.timezone) {
                                // Use custom timezone
                                timezone = tzData.timezone;
                                locale = tzData.locale || 'en-US';
                                // Log removed
                            } else {
                                // Use default timezone
                                timezone = 'UTC';
                                locale = 'en-US';
                                // Log removed
                            }
                            
                            // Calculate timezone offset from resolved timezone
                            let timezoneOffset = 0;
                            try {
                                const now = new Date();
                                const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
                                const spoofedTime = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
                                timezoneOffset = Math.round((spoofedTime.getTime() - utc.getTime()) / 60000);
                            } catch (e) {
                                // Log removed
                            }
                            
                            // Log removed
                            sendResponse({ success: true, timezone, locale, timezoneOffset });
                        } catch (error) {
                            await ErrorHandler.handle(error, 'getTimezoneSettings');
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    default:
                        sendResponse({ success: false, error: 'Unknown message type' });
                }
            } catch (error) {
                // Error removed
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
