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
            console.error('Error getting cached IP:', error);
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
            console.error('Error getting cached country:', error);
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
                console.log(`🌍 Trying country endpoint: ${url}`);
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
                        console.log(`🌍 Country detected: ${country.toUpperCase()}`);
                        return country.toUpperCase();
                    }
                }
            } catch (error) {
                console.warn(`Failed to get country from ${url}:`, error);
            }
        }
        
        console.warn('🌍 Failed to get country from all endpoints');
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
            console.error('Error getting fresh IP:', error);
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
        console.log(`🎯 DNR regex for ${domain}: ${regex}`);
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
                console.log(`🔍 Checking wildcard pattern: ${urlPattern} against ${accessHostname}`);
                
                // Special handling for *.binance.*
                if (urlPattern === '*.binance.*') {
                    const binancePatterns = ['binance.com', 'www.binance.com', 'api.binance.com', 'binance.org', 'www.binance.org'];
                    const matches = binancePatterns.some(pattern => accessHostname === pattern || accessHostname.endsWith('.' + pattern));
                    console.log(`🔍 Binance pattern check: ${matches}`);
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
                    console.log(`🔍 BingX pattern check: ${matches}`);
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
            console.warn('Bootstrap routing error:', e);
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
     * Check country rules against current IP's country
     * @param {string} url - URL to check
     * @param {string} userIP - Current user IP
     * @param {string} userCountry - Current user's country code
     * @returns {Promise<boolean>} - Whether to block
     */
    static async checkCountryRules(url, userIP, userCountry) {
        try {
            console.log(`🌍 checkCountryRules called for URL: ${url}, IP: ${userIP}, Country: ${userCountry}`);
            
            const storageData = await chrome.storage.local.get(['country_rules']);
            const countryRules = storageData.country_rules || [];
            
            console.log(`🌍 Raw country rules from storage:`, countryRules);
            
            if (countryRules.length === 0) {
                console.log('✅ No country rules, allowing');
                return false;
            }
            
            console.log(`🌍 Found ${countryRules.length} country rules`);
            
            for (const rule of countryRules) {
                console.log(`🌍 Checking country rule:`, rule);
                console.log(`🌍 Rule domain: ${rule.domain}, mode: ${rule.mode}, countries: [${rule.countries.join(', ')}]`);
                
                // Check if URL matches the domain pattern
                const domainMatch = URLUtils.matchingDomainRegex(url, rule.domain);
                console.log(`🌍 Domain match for ${rule.domain}: ${domainMatch}`);
                
                if (domainMatch) {
                    console.log(`🌍 Country rule matched: ${rule.domain}`);
                    console.log(`🌍 Rule mode: ${rule.mode}, Countries: [${rule.countries.join(', ')}]`);
                    console.log(`🌍 User country: ${userCountry}`);
                    
                    const isCountryAllowed = rule.countries.includes(userCountry);
                    console.log(`🌍 Is country allowed: ${isCountryAllowed}`);
                    
                    if (rule.mode === 'whitelist') {
                        if (isCountryAllowed) {
                            console.log('✅ Country found in whitelist, allowing');
                            return false; // Allow
                        } else {
                            console.log('🚫 Country not in whitelist, blocking');
                            return true; // Block
                        }
                    } else if (rule.mode === 'blacklist') {
                        if (isCountryAllowed) {
                            console.log('🚫 Country found in blacklist, blocking');
                            return true; // Block
                        } else {
                            console.log('✅ Country not in blacklist, allowing');
                            return false; // Allow
                        }
                    }
                } else {
                    console.log(`🌍 Domain ${rule.domain} does not match ${url}`);
                }
            }
            
            console.log('✅ No country rules matched, allowing');
            return false;
            
        } catch (error) {
            console.error('❌ Error in checkCountryRules:', error);
            await ErrorHandler.handle(error, 'checkCountryRules');
            return false; // Allow on error
        }
    }

    /**
     * Update IP and rules - core update logic
     */
    static async updateIPAndRules() {
        console.log('🔄 Updating IP and rules...');
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
            if (locationData.location_config === 'matchIP') {
                console.log('🌍 IP changed, updating location spoofing...');
                const ipLocation = await this.fetchIPLocation();
                if (ipLocation) {
                    await chrome.storage.local.set({
                        timezone: ipLocation.timezone,
                        locale: ipLocation.locale,
                        latitude: ipLocation.latitude,
                        longitude: ipLocation.longitude
                    });
                    
                    // Apply to all existing tabs
                    await this.applyLocationSpoofing(
                        ipLocation.timezone, 
                        ipLocation.locale, 
                        ipLocation.latitude, 
                        ipLocation.longitude
                    );
                    console.log('🌍 Location spoofing updated for new IP:', ipLocation);
                    
                    // Store IP-based timezone and locale for getTimezoneSettings
                    await chrome.storage.local.set({
                        current_timezone: ipLocation.timezone,
                        current_locale: ipLocation.locale
                    });
                    
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
                        console.log('⚠️ Could not notify popup:', e.message);
                    }
                }
            }
            console.log(`✅ IP updated to: ${freshIP}`);
            
            // Verify IP was stored
            const stored = await chrome.storage.local.get(['current_ip', 'cachedIP', 'last_ip_update', 'ip_country', 'ip_flag']);
            console.log('📋 Stored IP data:', stored);
            
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
            
            console.log('✅ IP and rules update completed');
            
        } catch (error) {
            console.error('❌ Failed to update IP and rules:', error);
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
            console.warn('Active-tab IP fetch failed:', e.message || e);
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
                console.log('🔒 WebRTC policy set to:', policy);
            } else {
                console.log('⚠️ WebRTC privacy API not available');
            }
        } catch (error) {
            console.error('❌ Error initializing WebRTC:', error);
        }
    }

    /**
     * Initialize location spoofing settings
     */
    static async initializeLocationSpoofing() {
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
                        
                        // Store IP-based timezone and locale for getTimezoneSettings
                        await chrome.storage.local.set({
                            current_timezone: ipLocation.timezone,
                            current_locale: ipLocation.locale
                        });
                    }
                }
                
                // Apply location spoofing to all tabs
                await this.applyLocationSpoofing(timezone, locale, latitude, longitude);
                console.log('🌍 Location spoofing initialized:', { timezone, locale, latitude, longitude });
            }
        } catch (error) {
            console.error('❌ Error initializing location spoofing:', error);
        }
    }

    /**
     * Fetch IP location data
     */
    static async fetchIPLocation() {
        try {
            const response = await fetch('http://ip-api.com/json?fields=status,message,countryCode,lat,lon,timezone,query');
            const data = await response.json();
            if (data.status === 'success') {
                return {
                    timezone: data.timezone,
                    locale: this.getLocaleFromCountryCode(data.countryCode),
                    latitude: data.lat,
                    longitude: data.lon
                };
            }
        } catch (error) {
            console.error('❌ Error fetching IP location:', error);
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
            console.error('❌ Error applying location spoofing:', error);
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
                console.log('⏭️ Skipping debugger for system URL:', tab.url);
                return;
            }
            
            await chrome.debugger.attach({ tabId: tabId }, '1.3');
            
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
            
            console.log('🌍 Location spoofing applied to tab:', tabId);
        } catch (error) {
            if (error.message && (
                error.message.includes('Another debugger is already attached') ||
                error.message.includes('Cannot access a chrome:// URL') ||
                error.message.includes('Cannot attach to this target')
            )) {
                // Expected errors, ignore silently
                return;
            }
            console.warn('⚠️ Could not attach debugger to tab:', tabId, error.message);
        }
    }

    /**
     * Initialize background script
     */
    static async initialize() {
        try {
            console.log('🚀 Kill Switch Initializing...');
            
            // Initialize WebRTC settings
            await this.initializeWebRTC();
            
            // Initialize location spoofing
            await this.initializeLocationSpoofing();
            
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
                        
                        // Apply to new tab
                        await this.attachDebugger(details.tabId, timezone, locale, latitude, longitude);
                    }
                } catch (error) {
                    console.error('❌ Error in navigation listener:', error);
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
                                console.log('❌ Error storing domain in sessionStorage:', error);
                            }
                        }
                    } catch (_) {}
                });
                console.log('✅ webNavigation onBeforeNavigate capture enabled');
            } catch (e) {
                console.warn('webNavigation capture not available:', e);
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
            try {
                console.log('📋 Current proxy settings (raw):', JSON.stringify(settings, null, 2));
            } catch (_) {
                console.log('📋 Current proxy settings:', settings);
            }
            
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
            try { console.log('🧪 Proxy snapshot:', JSON.stringify(snapshot, null, 2)); } catch { console.log('🧪 Proxy snapshot:', snapshot); }
            await chrome.storage.local.set({ proxy_snapshot: snapshot });
            return snapshot;
        } catch (e) {
            console.warn('Proxy snapshot failed:', e);
            return null;
        }
    }

    /**
     * Set up detection for requests blocked by the proxy.
     * When a request fails because of our proxy, we redirect the tab to our custom block page.
     */
    static setupBlockedRequestDetection() {
        console.log('🔧 Setting up blocked request detection...');
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
            console.warn('onBeforeRequest pre-capture not available:', e);
        }
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
                    // Auto-recovery: if fallback is enabled and repeated proxy errors occur, disable and clear
                    const cfg = await chrome.storage.local.get(['fallback_enabled']);
                    if (cfg.fallback_enabled) {
                        this._proxyErrorCount = (this._proxyErrorCount || 0) + 1;
                        clearTimeout(this._proxyErrorTimer);
                        this._proxyErrorTimer = setTimeout(()=>{ this._proxyErrorCount = 0; }, 3000);
                        if (this._proxyErrorCount >= 3) {
                            console.warn('⚠️ Repeated proxy failures detected. Disabling fallback and clearing proxy.');
                            await this.recoverFromProxyFailure();
                            this._proxyErrorCount = 0;
                        }
                    }
                    
                    // Check if this URL should actually be blocked by our rules (async version)
                    const shouldBlock = await this.shouldBlockURL(details.url);
                    
                    if (shouldBlock) {
                        console.log(`🎯 URL ${details.url} matches blocking rules, replacing with custom page.`);
                        try {
                            // Store the original URL so the blocked page can display it
                            const domain = URLUtils.getHostFromURL(details.url);
                            console.log('🔍 Blocking URL:', details.url);
                            console.log('🔍 Extracted domain:', domain);
                            console.log('🔍 Tab ID:', details.tabId);
                            
                            // Test URL parsing
                            try {
                                const testUrl = new URL(details.url);
                                console.log('🔍 Test URL parsing - hostname:', testUrl.hostname);
                            } catch (error) {
                                console.log('❌ Error parsing URL:', error);
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
                                console.log('❌ Error storing in session storage:', error);
                            }
                            
                            console.log('✅ Stored domain in storage:', domain);
                            
                            // Update the tab to show our custom blocked page
                            const blockedPageUrl = chrome.runtime.getURL(`html/blocked.html?domain=${encodeURIComponent(domain)}`);
                            console.log('🔍 Redirecting to blocked page:', blockedPageUrl);
                            
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
                                console.log('❌ Error storing domain in sessionStorage:', error);
                            }
                            
                            await chrome.tabs.update(details.tabId, {
                                url: blockedPageUrl
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
                console.warn('WebRTC privacy controls not available:', e);
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
            console.log('🧯 Recovery applied: fallback disabled and proxy cleared');
        } catch (e) {
            console.error('Recovery failed:', e);
        }
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
                    const blockedPageUrl = chrome.runtime.getURL(`html/blocked.html?domain=${encodeURIComponent(domain)}`);
                    
                    // Store domain in session storage
                    try {
                        await chrome.storage.session.set({
                            [`blocked_domain_${tabId}`]: domain,
                            current_blocked_domain: domain
                        });
                    } catch (error) {
                        console.log('❌ Error storing in session storage:', error);
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
                        console.log('❌ Error storing domain in sessionStorage:', error);
                    }
                    
                    await chrome.tabs.update(tabId, {
                        url: blockedPageUrl
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
            
            // First, check country rules for ALL URLs
            try {
                const userIP = await IPUtils.getCachedIP();
                const userCountry = await IPUtils.getCachedCountry();
                
                console.log('🌍 Country check - IP:', userIP, 'Country:', userCountry);
                
                // Force country detection if not available
                if (ValidationUtils.isValidIP(userIP) && !userCountry) {
                    console.log('🌍 Country not cached, trying to detect...');
                    const detectedCountry = await IPUtils.getCountryFromIP(userIP);
                    if (detectedCountry) {
                        console.log('🌍 Country detected:', detectedCountry);
                        await chrome.storage.local.set({
                            cachedCountry: detectedCountry,
                            countryTimestamp: Date.now()
                        });
                        userCountry = detectedCountry;
                    }
                }
                
                if (ValidationUtils.isValidIP(userIP) && userCountry) {
                    console.log('🌍 Checking country rules for:', url, 'IP:', userIP, 'Country:', userCountry);
                    const shouldBlockCountry = await this.checkCountryRules(url, userIP, userCountry);
                    
                    if (shouldBlockCountry) {
                        console.log('🚫 Country rule matched, blocking');
                        return true;
                    } else {
                        console.log('✅ Country rules checked, no blocking required');
                    }
                } else {
                    console.log('🌍 Skipping country rules - IP or Country not available');
                }
            } catch (error) {
                console.error('❌ Error in country check:', error);
                await ErrorHandler.handle(error, 'shouldBlockURL - Country check');
                // Don't block on country check error, just log it
            }
            
            // Then check IP rules
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
            const storageData = await chrome.storage.local.get(['urls', 'allowed_ips', 'country_rules']);
            const storedUrls = storageData.urls || [];
            const storedIPs = storageData.allowed_ips || [];
            const countryRules = storageData.country_rules || [];
            const currentIP = await IPUtils.getCachedIP();
            const currentCountry = await IPUtils.getCachedCountry();
            
            console.log('📋 Stored URLs:', storedUrls);
            console.log('📋 Stored IPs:', storedIPs);
            console.log('📋 Country Rules:', countryRules);
            console.log('📋 Current IP:', currentIP);
            console.log('📋 Current Country:', currentCountry);
            
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
            
            // Process country rules
            console.log(`🌍 Processing ${countryRules.length} country rules...`);
            console.log(`🌍 Current country: ${currentCountry}`);
            
            for (const rule of countryRules) {
                console.log(`🌍 Processing country rule: ${rule.domain} (${rule.mode})`);
                console.log(`🌍 Rule countries: [${rule.countries.join(', ')}]`);
                
                const isCountryAllowed = rule.countries.includes(currentCountry);
                let shouldBlockCountry = false;
                
                if (rule.mode === 'whitelist') {
                    shouldBlockCountry = !isCountryAllowed;
                } else if (rule.mode === 'blacklist') {
                    shouldBlockCountry = isCountryAllowed;
                }
                
                console.log(`🌍 Country rule result: ${rule.domain} -> ${shouldBlockCountry ? 'BLOCK' : 'ALLOW'} (Country: ${currentCountry}, Mode: ${rule.mode})`);
                
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
                            console.log(`🚫 Added country-blocked BingX related domains: ${bingxRelatedDomains.join(', ')}`);
                        } else {
                            const baseDomain = rule.domain.replace(/^\*\./, '').replace(/\.\*$/, '');
                            this._blockedDomains.add(baseDomain);
                            this._blockedDomains.add(`www.${baseDomain}`);
                            console.log(`🚫 Added country-blocked wildcard domain: ${baseDomain}`);
                        }
                    } else {
                        this._blockedDomains.add(rule.domain);
                        console.log(`🚫 Added country-blocked domain: ${rule.domain}`);
                    }
                }
            }
            
            console.log('📋 Cached rules for sync access:', this._cachedRules);
            console.log('🚫 Blocked domains:', Array.from(this._blockedDomains));
            console.log(`✅ setupCachedRules completed: ${this._cachedRules.length} IP rules cached, ${countryRules.length} country rules processed, ${this._blockedDomains.size} domains blocked`);
        } catch (error) {
            console.error('❌ Error setting up cached rules:', error);
        }
    }

    /**
     * Set up DNS level proxy blocking
     */
    static async setupProxyBlocking() {
        try {
            console.log('🔧 Setting PAC for reliable, DNS-level blocking...');

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
                    console.log('ℹ️ Respecting system/direct proxy mode. PAC cleared. Mode:', mode);
                    return false;
                } else if (mode === 'pac_script') {
                    // When user/system already has PAC, do not override unless we must block domains via sinkhole
                    if (blockedDomains.length === 0) {
                        console.log('ℹ️ System PAC present and no blocked domains; leaving as-is.');
                        return false;
                    }
                }
                // If system proxy not detectable but user provided fallback_proxy, use it
                // IMPORTANT: در حالت system/direct، از fallback کاربر استفاده نمی‌کنیم تا وقتی سیستم پروکسی خاموش است، مسیر DIRECT بماند
            } catch (e) {
                console.warn('Proxy settings read failed:', e);
            }

            // Generate and apply PAC
            const pacScript = this.generatePACScript(blockedDomains, currentIP, whitelistData, fallback);
            const proxyConfig = { mode: 'pac_script', pacScript: { data: pacScript } };
            await chrome.proxy.settings.set({ value: proxyConfig, scope: 'regular' });
            console.log('✅ PAC applied');
            return true;
            
        } catch (error) {
            console.error('❌ Error setting up proxy blocking:', error);
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
    console.log("PAC: ===== PAC SCRIPT EXECUTED =====");
    console.log("PAC: Checking URL:", url, "Host:", host);
    console.log("PAC: Current IP:", "${currentIP}");
    console.log("PAC: Whitelist data:", ${whitelistDataStr});
    
    var blockedDomains = ${blockedDomainsArray};
    var whitelistData = ${whitelistDataStr};
    var currentIP = "${currentIP}";
    var fallbackProxy = ${JSON.stringify(fallbackProxy)};
    var ipCheckHosts = ["api.ipify.org","ipapi.co","ipinfo.io","icanhazip.com","ifconfig.me"];
    
    // Check if this is already our blocked page - allow it
    if (url.indexOf("${blockedPageUrl}") === 0) {
        console.log("PAC: ALLOWING blocked page:", url);
        return "DIRECT";
    }

    // 0) Country/IP pre-block: if host is in blockedDomains (from cached IP/country rules), sinkhole immediately
    //    This ensures country-based blocks are applied before any content loads
    for (var bi = 0; bi < blockedDomains.length; bi++) {
        var bd = blockedDomains[bi];
        if (host === bd || host.endsWith('.' + bd)) {
            console.log("PAC: PRE-BLOCK via blockedDomains:", host, "matched:", bd);
            return "PROXY 127.0.0.1:1";
        }
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
                    if (fallbackProxy && fallbackProxy.length > 0) {
                        return fallbackProxy;
                    }
                    return "DIRECT";
                }
            }
            console.log("PAC: BLOCKING (IP not in whitelist):", host, "IP:", currentIP);
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
    console.log("PAC: ALLOWING (no domain match):", host);
    console.log("PAC: ===== PAC SCRIPT COMPLETED =====");
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
            console.log('🔧 Setting up declarativeNetRequest...');
            
            // Get all stored URLs for blocking
            const storageData = await chrome.storage.local.get(['urls', 'allowed_ips', 'country_rules']);
            const storedUrls = storageData.urls || [];
            const storedIPs = storageData.allowed_ips || [];
            const countryRules = storageData.country_rules || [];
            
            console.log('📋 Stored URLs for blocking (raw):', JSON.stringify(storedUrls));
            console.log('📋 Allowed IPs (raw):', JSON.stringify(storedIPs));
            
            // Clear existing rules (only ours: ids 1..999)
            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            const ruleIdsToRemove = existingRules.filter(r=> r.id>=1 && r.id<=999).map(rule => rule.id);
            if (ruleIdsToRemove.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIdsToRemove });
            }
            
            // Get current IP and country
            const currentIP = await IPUtils.getCachedIP();
            const currentCountry = await IPUtils.getCachedCountry();
            console.log('🌐 Current IP for rules:', currentIP);
            console.log('🌍 Current Country for rules:', currentCountry);
            
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
                    
                    console.log(`🔍 Processing rule ${i + 1}:`);
                    console.log(`   Domain: ${domain}`);
                    console.log(`   Allowed IPs: [${allowedIPs.join(', ')}]`);
                    console.log(`   Current IP: ${currentIP}`);
                    
                    // Check if current IP is allowed
                    const shouldBlock = this.checkIPRules(currentIP, allowedIPs);
                    console.log(`   Should block: ${shouldBlock}`);
                    
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
                        console.log(`🚫 Added BLOCKING rule for ${domain}`);
                        console.log(`   Regex: ${regexFilter}`);
                    } else {
                        console.log(`✅ Skipping ${domain} - IP ${currentIP} is allowed`);
                    }
                } catch (error) {
                    console.error(`❌ Error processing URL ${storedUrls[i]}:`, error);
                }
            }
            
            // Also add country-based blocking rules for immediate main-frame blocking
            if (countryRules && countryRules.length > 0 && currentCountry) {
                console.log(`🌍 Processing ${countryRules.length} country rules for DNR...`);
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
                            console.log(`🚫 Added COUNTRY BLOCK rule for ${rule.domain} (mode: ${rule.mode}) -> ${regexFilter}`);

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
                                    console.log(`🚫 Added COUNTRY BLOCK (bingx related) for ${d} -> ${r}`);
                                }
                            }
                        } else {
                            console.log(`✅ Country ALLOW for ${rule.domain} (mode: ${rule.mode})`);
                        }
                    } catch (e) {
                        console.warn('⚠️ Error processing country DNR rule:', e);
                    }
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
                        
                    case 'debugCountryRules':
                        try {
                            const countryRules = await chrome.storage.local.get(['country_rules']);
                            const userIP = await IPUtils.getCachedIP();
                            const userCountry = await IPUtils.getCachedCountry();
                            
                            console.log('🔍 Debug Country Rules:');
                            console.log('Country Rules:', countryRules.country_rules);
                            console.log('User IP:', userIP);
                            console.log('User Country:', userCountry);
                            
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
                        
                    case 'updateWebRTCPolicy':
                        try {
                            const { policy } = request;
                            if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
                                await chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: policy });
                                console.log('🔒 WebRTC policy updated to:', policy);
                                sendResponse({ success: true });
                            } else {
                                sendResponse({ success: false, error: 'WebRTC privacy API not available' });
                            }
                        } catch (error) {
                            console.error('❌ Error updating WebRTC policy:', error);
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
                                console.log('🌍 Location spoofing disabled');
                            } else {
                                // Apply location spoofing
                                await this.applyLocationSpoofing(timezone, locale, latitude, longitude);
                                console.log('🌍 Location spoofing updated:', { timezone, locale, latitude, longitude });
                            }
                            
                            sendResponse({ success: true });
                        } catch (error) {
                            console.error('❌ Error updating location spoofing:', error);
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    case 'getTimezoneSettings':
                        try {
                            // Get all timezone data
                            const tzData = await chrome.storage.local.get(['location_config', 'timezone', 'locale', 'current_timezone', 'current_locale', 'current_ip', 'ip_country']);
                            console.log('🌍 getTimezoneSettings data:', tzData);
                            
                            const useIP = (tzData.location_config || 'matchIP') === 'matchIP';
                            let timezone, locale;
                            
                            if (useIP && tzData.current_timezone) {
                                // Use IP-based timezone
                                timezone = tzData.current_timezone;
                                locale = tzData.current_locale || 'en-US';
                                console.log('🌍 Using IP-based timezone:', timezone);
                            } else if (tzData.timezone) {
                                // Use custom timezone
                                timezone = tzData.timezone;
                                locale = tzData.locale || 'en-US';
                                console.log('🌍 Using custom timezone:', timezone);
                            } else {
                                // Use default timezone
                                timezone = 'America/Toronto';
                                locale = 'en-CA';
                                console.log('🌍 Using default timezone:', timezone);
                            }
                            
                            // Calculate timezone offset from resolved timezone
                            let timezoneOffset = -300;
                            try {
                                const now = new Date();
                                const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
                                const spoofedTime = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
                                timezoneOffset = Math.round((spoofedTime.getTime() - utc.getTime()) / 60000);
                            } catch {}
                            
                            console.log('🌍 Sending timezone settings:', { timezone, locale, timezoneOffset });
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
