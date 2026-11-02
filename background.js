"use strict";

/**
 * Run inside a normal web tab so Chrome applies system/browser proxy routing.
 */
function probeIPInPageContext() {
    const endpoints = [
        'https://api.ipify.org?format=json',
        'https://ipwho.is/'
    ];
    const parseIP = async (url) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(url, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
                signal: controller.signal
            });
            clearTimeout(timer);
            if (!res.ok) return '';
            const data = await res.json().catch(() => ({}));
            return (data && data.ip) || '';
        } catch (_) {
            clearTimeout(timer);
            return '';
        }
    };
    return (async () => {
        for (const url of endpoints) {
            const ip = (await parseIP(url)).trim();
            if (ip) return ip;
        }
        return '';
    })();
}

/**
 * Enhanced background script with better error handling and async operations
 */

// User-Agent strings for different browsers and platforms
const USER_AGENTS = {
    // Windows
    chrome_win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    firefox_win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    edge_win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    
    // macOS
    chrome_mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    firefox_mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    safari_mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    
    // Linux
    chrome_linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    firefox_linux: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    
    // Mobile
    chrome_android: 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    safari_ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    samsung_android: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    
    // Bots
    googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
};

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
        'https://ifconfig.me/ip',
        'https://icanhazip.com',
        'https://ipinfo.io/ip',
        'https://ipapi.co/ip/'
    ];

    static IP_CACHE_DURATION = 30 * 1000; // 30 seconds

    static async getPublicIP() {
        const fetchSingleIP = async (base) => {
            const url = base.includes('?') ? `${base}&_=${Date.now()}` : `${base}?_=${Date.now()}`;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2500);
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    cache: 'no-store',
                    signal: controller.signal
                });
                clearTimeout(timer);
                if (!response.ok) throw new Error('Response not ok');
                const text = (await response.text()).trim();
                const ip = text.replace(/[^0-9A-Fa-f:\.]/g, '');
                if (ValidationUtils.isValidIP(ip)) return ip;
                throw new Error('Invalid IP format');
            } catch (err) {
                clearTimeout(timer);
                throw err;
            }
        };

        try {
            // Race all IP services concurrently to return the fastest valid response
            return await Promise.any(this.IP_SERVICES.map(fetchSingleIP));
        } catch (_) {
            // Fallback: sequential check if all concurrent requests failed
            for (const base of this.IP_SERVICES) {
                try {
                    const ip = await fetchSingleIP(base);
                    if (ip) return ip;
                } catch (_) {}
            }
        }
        throw new Error('Failed to fetch public IP from all services');
    }

    static async _fetchIPFromTab(tabId) {
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId },
            func: probeIPInPageContext
        });
        const ip = (result || '').trim();
        if (!ip) throw new Error('Empty IP from tab');
        return ip;
    }

    static async isBrowserProxyLikelyActive() {
        try {
            const settings = await chrome.proxy.settings.get({});
            const mode = settings?.value?.mode || 'system';
            if (mode === 'fixed_servers') return true;
            if (mode === 'pac_script' && settings.levelOfControl !== 'controlled_by_this_extension') {
                return true;
            }
        } catch (_) {}
        return false;
    }

    /**
     * Fetch public IP inside an open tab so system/browser proxy routing is respected.
     */
    static async getPublicIPViaActiveTab() {
        let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        let tab = tabs && tabs[0];
        if (!tab || !tab.id || !tab.url || !/^https?:/i.test(tab.url)) {
            const allTabs = await chrome.tabs.query({});
            tab = allTabs.find(t => t && t.id && t.url && /^https?:/i.test(t.url));
        }
        if (!tab || !tab.id) {
            throw new Error('No http(s) tab found');
        }
        return this._fetchIPFromTab(tab.id);
    }

    static async getPublicIPRespectingProxy() {
        if (await this.isBrowserProxyLikelyActive()) {
            try {
                const ip = await this.getPublicIPViaActiveTab();
                if (ValidationUtils.isValidIP(ip)) return ip;
            } catch (_) {}
        }
        return this.getPublicIP();
    }

    static async invalidateCache() {
        await chrome.storage.local.remove([
            'cachedIP', 'ipTimestamp',
            'cachedCountry', 'countryTimestamp'
        ]);
    }

    static async getCachedIP(forceRefresh = false) {
        try {
            if (!forceRefresh) {
                const cached = await chrome.storage.local.get(['cachedIP', 'ipTimestamp']);
                const now = Date.now();
                if (cached.cachedIP && cached.ipTimestamp &&
                    (now - cached.ipTimestamp) < this.IP_CACHE_DURATION) {
                    return cached.cachedIP;
                }
            }

            const ip = await this.getPublicIPRespectingProxy();
            await chrome.storage.local.set({
                cachedIP: ip,
                ipTimestamp: Date.now()
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

    static async _fetchCountryCodeFromEndpoint(ip, url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' },
            cache: 'no-store'
        });
        clearTimeout(timeout);
        if (!response.ok) return null;

        if (url.includes('ipwho.is')) {
            const data = await response.json();
            const country = data.country_code || '';
            return country.length === 2 ? country.toUpperCase() : null;
        }
        if (url.includes('ip-api.com')) {
            const data = await response.json();
            if (data.status === 'success' && data.countryCode) {
                return data.countryCode.toUpperCase();
            }
            return null;
        }

        const country = (await response.text()).trim();
        return country.length === 2 ? country.toUpperCase() : null;
    }

    static async getCountryFromIP(ip) {
        const endpoints = [
            `https://ipwho.is/${ip}`,
            `https://ipapi.co/${ip}/country/`
        ];

        for (const url of endpoints) {
            try {
                const country = await this._fetchCountryCodeFromEndpoint(ip, url);
                if (country) return country;
            } catch (_) {
                // try next endpoint
            }
        }

        return null;
    }

    /**
     * Force refresh IP (bypass cache)
     * @returns {Promise<string>} - Fresh IP address
     */
    static async getFreshIP() {
        try {
            await this.invalidateCache();
            const ip = await this.getPublicIPRespectingProxy();
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
        const country = await this.getCountryFromIP(ip);
        return country || '';
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
     * Stop controlling Chrome proxy without touching IP cache.
     */
    static async clearExtensionProxyIfOwned() {
        try {
            const sys = await chrome.proxy.settings.get({});
            const loc = sys.levelOfControl;
            if (loc === 'controlled_by_this_extension' || loc === 'controllable_by_this_extension') {
                await chrome.proxy.settings.clear({ scope: 'regular' });
                return true;
            }
        } catch (_) {}
        return false;
    }

    /**
     * Release extension-owned proxy so Chromium can use system/browser proxy again.
     */
    static async releaseExtensionProxyControl() {
        const cleared = await this.clearExtensionProxyIfOwned();
        if (cleared) {
            await IPUtils.invalidateCache();
            await new Promise(r => setTimeout(r, 150));
        }
    }

    static async cleanupOrphanProbeTabs() {
        try {
            const blanks = await chrome.tabs.query({ url: 'about:blank' });
            if (blanks.length < 2) return;
            for (const tab of blanks) {
                if (tab.id) {
                    try { await chrome.tabs.remove(tab.id); } catch (_) {}
                }
            }
        } catch (_) {}
    }

    static _ipUpdateInProgress = false;

    /**
     * Apply minimal routing before IP detection so getPublicIP uses the intended path
     */
    static async applyBootstrapProxyRouting() {
        await this.releaseExtensionProxyControl();
    }

    /**
     * Set tab color based on status
     * @param {number} tabID - Tab ID
     */
    static async setColor(tabID) {
        try {
            // Respect icon preference: if dynamic flag is enabled, do not override with static icons
            const pref = await chrome.storage.local.get(['icon_type','ip_flag']);
            if (pref.icon_type !== 'static') {
                if (pref.ip_flag) {
                    await IconManager.updateIcon(pref.ip_flag);
                }
                return; // do not continue to static color paths
            }
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
    static async updateIPAndRules(force = false) {
        if (force) {
            this._ipUpdateInProgress = false;
            await IPUtils.invalidateCache();
        } else if (this._ipUpdateInProgress) {
            return;
        }
        this._ipUpdateInProgress = true;
        try {
            const hadPac = await this.clearExtensionProxyIfOwned();
            if (hadPac) {
                await IPUtils.invalidateCache();
                await new Promise(r => setTimeout(r, 150));
            }

            let freshIP = '';
            try {
                freshIP = await IPUtils.getPublicIPRespectingProxy();
            } catch (_) {}

            const ipLocation = await this.fetchIPLocation(freshIP);
            if (!ValidationUtils.isValidIP(freshIP) && ipLocation && ipLocation.ip) {
                freshIP = ipLocation.ip;
            }
            if (!ValidationUtils.isValidIP(freshIP)) {
                const stored = await chrome.storage.local.get(['current_ip', 'cachedIP']);
                freshIP = stored.current_ip || stored.cachedIP || '';
            }

            if (ValidationUtils.isValidIP(freshIP)) {
            const now = Date.now();
            
            // Unified location, country and flag resolution
            let country = (ipLocation && ipLocation.country) ? ipLocation.country.toUpperCase() : '';
            if (!country && ipLocation && ipLocation.locale) {
                country = (ipLocation.locale.split('-')[1] || '').toUpperCase();
            }
            if (!country) {
                country = await IPUtils.getCountryCode(freshIP).catch(() => '');
            }
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
            
            // Respect icon preference
            try {
                const pref = await chrome.storage.local.get(['icon_type']);
                if (pref.icon_type === 'static') {
                    await IconManager.setDefaultIcon();
                } else {
                    await IconManager.updateIcon(flag);
                }
            } catch (_) {}
            
            // Update location spoofing if set to match IP
            if (ipLocation) {
                await chrome.storage.local.set({
                    timezone: ipLocation.timezone,
                    locale: ipLocation.locale,
                    latitude: ipLocation.latitude,
                    longitude: ipLocation.longitude,
                    current_timezone: ipLocation.timezone,
                    current_locale: ipLocation.locale
                });
                
                // Run heavy tab CDP debugger re-attachments asynchronously in background so IP response is instant
                (async () => {
                    try {
                        const locationData = await chrome.storage.local.get(['location_config']);
                        if (locationData.location_config === 'matchIP' || !locationData.location_config) {
                            await this.updateAllTabsWithNewLocation(ipLocation);
                            const tabs = await chrome.tabs.query({});
                            for (const tab of tabs) {
                                if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                                    try {
                                        await chrome.tabs.sendMessage(tab.id, {
                                            type: 'locationUpdated',
                                            timezone: ipLocation.timezone,
                                            locale: ipLocation.locale,
                                            latitude: ipLocation.latitude,
                                            longitude: ipLocation.longitude
                                        });
                                    } catch (_) {}
                                }
                            }
                        }
                    } catch (_) {}
                })();
            }
            }

            await this.setupCachedRules();
            await this.setupDeclarativeNetRequest();
            await this.setupProxyBlocking();
            await this.enforceBlockingOnOpenTabs();

        } catch (error) {
            try {
                await this.clearExtensionProxyIfOwned();
                await this.setupDeclarativeNetRequest();
            } catch (_) {}
        } finally {
            this._ipUpdateInProgress = false;
        }
    }

    /**
     * Enforce blocking rules on currently open tabs immediately upon IP/country change
     */
    static async enforceBlockingOnOpenTabs() {
        try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (!tab.id || !tab.url || !/^https?:/i.test(tab.url)) continue;
                const blockedPage = chrome.runtime.getURL('html/blocked.html');
                if (tab.url.startsWith(blockedPage)) continue;

                const shouldBlock = await this.shouldBlockURL(tab.url);
                if (shouldBlock) {
                    const host = URLUtils.getHostFromURL(tab.url);
                    const targetUrl = chrome.runtime.getURL(`html/blocked.html?domain=${encodeURIComponent(host)}`);
                    try {
                        await chrome.tabs.update(tab.id, { url: targetUrl });
                    } catch (_) {}
                }
            }
        } catch (_) {}
    }

    /**
     * @deprecated Use IPUtils.getPublicIPRespectingProxy() directly
     */
    static async getStablePublicIP() {
        return IPUtils.getPublicIPRespectingProxy();
    }

    /**
     * Initialize WebRTC settings
     */
    static async initializeWebRTC() {
        try {
            const data = await chrome.storage.local.get(['webrtc_policy']);
            const policy = data.webrtc_policy || 'disable_non_proxied_udp';
            
            if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
                await chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: policy });
            }
            if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCMultipleRoutesEnabled) {
                await chrome.privacy.network.webRTCMultipleRoutesEnabled.set({ value: false });
            }
        } catch (error) {}
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
                    const ip = await IPUtils.getPublicIPRespectingProxy().catch(() => '');
                    const ipLocation = await this.fetchIPLocation(ip);
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
     * Fetch IP location data for a known IP (avoids direct connection leak when proxied)
     */
    static async fetchIPLocation(ip = '') {
        try {
            if (!ip) {
                const stored = await chrome.storage.local.get(['current_ip', 'cachedIP']);
                ip = stored.current_ip || stored.cachedIP || '';
            }
            // Primary HTTPS endpoint: ipwho.is
            const primaryUrl = ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : 'https://ipwho.is/';
            try {
                const response = await fetch(primaryUrl, { cache: 'no-store' });
                if (response.ok) {
                    const data = await response.json();
                    if (data && (data.success !== false)) {
                        const tz = data.timezone?.id || data.timezone;
                        const cc = data.country_code || data.countryCode;
                        const lat = data.latitude !== undefined ? data.latitude : data.lat;
                        const lon = data.longitude !== undefined ? data.longitude : data.lon;
                        const detectedIP = data.ip || data.query || ip;
                        if (tz && lat !== undefined && lon !== undefined) {
                            return {
                                ip: detectedIP,
                                country: (cc || '').toUpperCase(),
                                timezone: tz,
                                locale: this.getLocaleFromCountryCode(cc),
                                latitude: lat,
                                longitude: lon
                            };
                        }
                    }
                }
            } catch (_) {}

            // Fallback HTTPS endpoint: ipapi.co
            const fallbackUrl = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : 'https://ipapi.co/json/';
            try {
                const response = await fetch(fallbackUrl, { cache: 'no-store' });
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.timezone) {
                        const cc = (data.country_code || data.countryCode || '').toUpperCase();
                        return {
                            country: cc,
                            timezone: data.timezone,
                            locale: this.getLocaleFromCountryCode(cc),
                            latitude: data.latitude,
                            longitude: data.longitude
                        };
                    }
                }
            } catch (_) {}
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
            'RS': 'sr-RS', 'ME': 'sr-ME', 'BA': 'bs-BA', 'MK': 'mk-MK',
            'AL': 'sq-AL', 'IS': 'is-IS', 'IE': 'en-IE', 'NZ': 'en-NZ',
            'ZA': 'en-ZA', 'GR': 'el-GR', 'PT': 'pt-PT', 'LU': 'fr-LU',
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
        if (countryCode && /^[A-Za-z]{2}$/.test(countryCode)) {
            const cc = countryCode.toUpperCase();
            return localeMap[cc] || `en-${cc}`;
        }
        return 'en-US';
    }

    /**
     * Apply location spoofing to all tabs
     */
    /**
     * Dynamically re-register the boot data content script with hardcoded timezone/locale.
     * This ensures window.__ks_boot_tz__ is always set BEFORE timezone_early_override.js runs,
     * even on the very first page load in a new tab.
     */
    static async registerBootDataScript(timezone, locale, latitude, longitude) {
        try {
            const tz = JSON.stringify(timezone || 'UTC');
            const lc = JSON.stringify(locale || 'en-US');
            const la = parseFloat(latitude) || 0;
            const lo = parseFloat(longitude) || 0;
            const code = `(function(){window.__ks_boot_tz__=${tz};window.__ks_boot_locale__=${lc};window.__ks_boot_lat__=${la};window.__ks_boot_lng__=${lo};})();`;

            // Unregister existing dynamic boot script first
            try {
                await chrome.scripting.unregisterContentScripts({ ids: ['ks-boot-data-dynamic'] });
            } catch (_) {}

            // Register new boot script with hardcoded values, running BEFORE ks_boot_data.js
            await chrome.scripting.registerContentScripts([{
                id: 'ks-boot-data-dynamic',
                matches: ['<all_urls>'],
                js: [],
                css: [],
                runAt: 'document_start',
                allFrames: true,
                world: 'MAIN',
                // Use injectImmediately to run as early as possible
            }]);
            // Since inline code isn't supported in registerContentScripts for MV3,
            // store the current tz/locale in chrome.storage.session for quick sync access
            await chrome.storage.session.set({
                ks_active_tz: timezone || 'UTC',
                ks_active_locale: locale || 'en-US',
                ks_active_lat: latitude || 0,
                ks_active_lng: longitude || 0
            });
        } catch (_) {}
    }

    static async applyLocationSpoofing(timezone, locale, latitude, longitude) {
        try {
            // Update session cache so content scripts can read it
            if (timezone) {
                try {
                    await chrome.storage.session.set({
                        ks_active_tz: timezone,
                        ks_active_locale: locale || 'en-US',
                        ks_active_lat: latitude || 0,
                        ks_active_lng: longitude || 0
                    });
                } catch (_) {}
            }
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                    await this.attachDebugger(tab.id, timezone, locale, latitude, longitude);
                }
            }
        } catch (error) {}
    }

    static async updateAllTabsWithNewLocation(ipLocation) {
        try {
            const tabs = await chrome.tabs.query({});
            const updateSingleTab = async (tab) => {
                if (!tab || !tab.url || /^chrome(-extension)?:\/\//i.test(tab.url) || /^about:/i.test(tab.url) || /^file:/i.test(tab.url)) return;
                try {
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
                                } catch (_) {}
                            },
                            args: [ipLocation.timezone, ipLocation.locale]
                        });
                    } catch (_) {}

                    try { await chrome.debugger.detach({ tabId: tab.id }); } catch (_) {}
                    await this.attachDebugger(
                        tab.id,
                        ipLocation.timezone,
                        ipLocation.locale,
                        ipLocation.latitude,
                        ipLocation.longitude
                    );
                } catch (_) {}
            };

            await Promise.allSettled(tabs.map(updateSingleTab));
        } catch (error) {}
    }

    /**
     * Attach debugger to tab for location spoofing
     */
    static async attachDebugger(tabId, timezone, locale, latitude, longitude, tabUrl = null) {
        try {
            if (!timezone && !locale && !latitude && !longitude) return;
            
            let url = tabUrl;
            if (!url) {
                // Get tab info if URL not provided
                const tab = await chrome.tabs.get(tabId);
                if (!tab || !tab.url) return;
                url = tab.url;
            }
            
            // Skip chrome:// URLs and extension URLs
            if (url.startsWith('chrome://') || 
                url.startsWith('chrome-extension://') ||
                url.startsWith('moz-extension://') ||
                url.startsWith('edge-extension://') ||
                url.startsWith('about:')) {
                return;
            }
            
            await chrome.debugger.attach({ tabId: tabId }, '1.3');

            // Fire all CDP commands concurrently to minimize injection latency on navigation
            const cdpCommands = [];

            // Inject boot timezone/locale before any page script runs (first paint guarantee)
            if (timezone || locale) {
                const bootScript = `(() => { try { window.__ks_boot_tz__ = ${JSON.stringify(timezone || '')}; window.__ks_boot_locale__ = ${JSON.stringify(locale || 'en-US')}; } catch(e){} })();`;
                cdpCommands.push(chrome.debugger.sendCommand(
                    { tabId: tabId },
                    'Page.addScriptToEvaluateOnNewDocument',
                    { source: bootScript }
                ));
            }
            
            if (timezone) {
                cdpCommands.push(chrome.debugger.sendCommand(
                    { tabId: tabId },
                    'Emulation.setTimezoneOverride',
                    { timezoneId: timezone }
                ));
            }
            
            if (latitude && longitude) {
                cdpCommands.push(chrome.debugger.sendCommand(
                    { tabId: tabId },
                    'Emulation.setGeolocationOverride',
                    {
                        latitude: parseFloat(latitude),
                        longitude: parseFloat(longitude),
                        accuracy: 1,
                    }
                ));
            }
            
            if (locale) {
                cdpCommands.push(chrome.debugger.sendCommand(
                    { tabId: tabId },
                    'Emulation.setLocaleOverride',
                    { locale: locale }
                ));
            }
            
            // Execute all CDP commands at once
            await Promise.allSettled(cdpCommands);
            
            // Apply a JS fallback layer as well to defeat aggressive probes
            try {
                await BackgroundManager.applyJSFallbackTimezone(tabId, timezone, locale);
            } catch (e) {}
            
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
            await this.cleanupOrphanProbeTabs();
            await this.clearExtensionProxyIfOwned();

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
            
            // Ensure toolbar icon is set based on preference on startup
            try {
                const { icon_type, ip_flag } = await chrome.storage.local.get(['icon_type','ip_flag']);
                if (icon_type === 'static') {
                    await IconManager.setDefaultIcon();
                } else if (ip_flag) {
                    await IconManager.updateIcon(ip_flag);
                }
            } catch (_) {}
            
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
                        
                        // Fast-path: use cached timezone, locale, latitude, longitude
                        // Do NOT call fetchIPLocation here as it delays injection by 500ms+ and causes leaks
                        
                        // Apply to new tab (debugger attachment)
                        // This sets up CDP Emulation and Page.addScriptToEvaluateOnNewDocument
                        // BEFORE the document is even created.
                        await this.attachDebugger(details.tabId, timezone, locale, latitude, longitude, details.url);
                    }
                } catch (error) {}
            });
            
            // Inject boot variables synchronously as soon as the document commits (fallback if CDP was too slow)
            chrome.webNavigation.onCommitted.addListener(async (details) => {
                try {
                    // Skip subframes to avoid performance overhead, MAIN world is usually enough for top level
                    if (details.frameId !== 0) return;
                    
                    const data = await chrome.storage.local.get(['location_config', 'timezone', 'locale']);
                    if (data.location_config !== 'browserDefault' && data.timezone) {
                        await chrome.scripting.executeScript({
                            target: { tabId: details.tabId, frameIds: [details.frameId] },
                            world: 'MAIN',
                            injectImmediately: true,
                            func: (tz, loc) => {
                                try {
                                    window.__ks_boot_tz__ = tz;
                                    window.__ks_boot_locale__ = loc || 'en-US';
                                } catch (_) {}
                            },
                            args: [data.timezone, data.locale || 'en-US']
                        });
                    }
                } catch (e) {}
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
            
            // updateIPAndRules() already configured DNR and released extension proxy control
            
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
            // onAlarm listener is registered synchronously at top-level (Manifest V3 requirement)
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
        await this.clearExtensionProxyIfOwned();
    }

    /**
     * Force refresh proxy settings to ensure changes take effect
     */
    static async refreshProxySettings() {
        await this.clearExtensionProxyIfOwned();
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
                        chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: 'disable_non_proxied_udp' });
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
            await this.clearExtensionProxyIfOwned();
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
                    const domain = URLUtils.getHostFromURL(url);
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
     * Never override Chromium proxy — blocking is handled by DNR only.
     */
    static async setupProxyBlocking() {
        await this.clearExtensionProxyIfOwned();
        return false;
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
    var ipCheckHosts = ["api.ipify.org","ipwho.is","ip-api.com","ipapi.co","icanhazip.com","ifconfig.me"];
    
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
    
    // Route IP-check and general traffic through the configured proxy
    for (var k = 0; k < ipCheckHosts.length; k++) {
        var h = ipCheckHosts[k];
        if (host === h || host.endsWith('.' + h)) {
            return fallbackProxy;
        }
    }
    return fallbackProxy;
`;
    }

    /**
     * Set up declarativeNetRequest for real blocking
     */
    static async setupDeclarativeNetRequest() {
        try {
            const settings = await chrome.storage.local.get({ privacy_master: true });
            if (settings.privacy_master === false) {
                await this.clearDynamicRules();
                return;
            }
            // Log removed
            
            // Get all stored URLs for blocking
            const storageData = await chrome.storage.local.get(['urls', 'allowed_ips', 'country_rules']);
            const storedUrls = storageData.urls || [];
            const storedIPs = storageData.allowed_ips || [];
            const countryRules = storageData.country_rules || [];
            
            // Log removed
            // Log removed
            
            // Clear existing rules (ids 1..20000)
            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            const ruleIdsToRemove = existingRules.filter(r=> r.id>=1 && r.id<=20000).map(rule => rule.id);
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
            // start ids from 1.. to avoid clashing (reserve 10000+ for fp stubs)
            let ruleId = 1;

            // Global anti-fingerprinting: redirect common FingerprintJS script URLs to local stub
            const fpTargets = [
                '||cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@*/*/fp.umd.js',
                '||cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@*/*/fingerprint2.min.js',
                '||openfpcdn.io/fingerprintjs/*/fp.umd.js',
                '||openfpcdn.io/fingerprintjs/*/fingerprint2.min.js',
                '||static.cloudflareinsights.com/beacon.min.js'
            ];
            let fpRuleId = 10000;
            for (const urlFilter of fpTargets) {
                rules.push({
                    id: fpRuleId++,
                    priority: 1000,
                    action: { type: 'redirect', redirect: { extensionPath: '/js/stubs/fp_stub.js' } },
                    condition: { urlFilter, resourceTypes: ['script'] }
                });
            }
            
            // Subresource types that must be strictly blocked (not redirected)
            const SUBRESOURCE_TYPES = [
                'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
                'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket',
                'webtransport', 'webbundle', 'other'
            ];

            // Add exception rules for essential login resources if needed (exclude ads/analytics)
            const loginExceptions = [
                { id: ruleId++, priority: 2, action: { type: 'allow' }, condition: { 
                    urlFilter: '||staticimg.com/*', resourceTypes: ['script', 'image', 'xmlhttprequest'] 
                }},
                { id: ruleId++, priority: 2, action: { type: 'allow' }, condition: { 
                    urlFilter: '||googleapis.com/*', resourceTypes: ['script', 'image', 'xmlhttprequest'] 
                }}
            ];
            rules.push(...loginExceptions);
            
            // Process each URL entry
            for (let i = 0; i < storedUrls.length; i++) {
                try {
                    const domain = storedUrls[i];
                    const allowedIPsString = storedIPs[i] || '';
                    const allowedIPs = allowedIPsString.replace(/\|$/, '').split(',').filter(ip => ip.trim());
                    
                    // Check if current IP is allowed
                    const shouldBlock = this.checkIPRules(currentIP, allowedIPs);
                    
                    if (shouldBlock) {
                        const regexFilter = URLUtils.domainToRegex(domain);
                        // 1. Redirect main_frame navigations to blocked.html
                        rules.push({
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
                        });

                        // 2. Block all subresources (WebSocket, Fetch/XHR, scripts, frames)
                        rules.push({
                            id: ruleId++,
                            priority: 1,
                            action: { type: 'block' },
                            condition: {
                                regexFilter: regexFilter,
                                resourceTypes: SUBRESOURCE_TYPES
                            }
                        });
                    }
                } catch (error) {
                    // Error removed
                }
            }
            
            // Also add country-based blocking rules
            if (countryRules && countryRules.length > 0 && currentCountry) {
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
                            rules.push({
                                id: ruleId++,
                                priority: 2,
                                action: { type: 'block' },
                                condition: { regexFilter, resourceTypes: SUBRESOURCE_TYPES }
                            });

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
                                    rules.push({
                                        id: ruleId++,
                                        priority: 2,
                                        action: { type: 'block' },
                                        condition: { regexFilter: r, resourceTypes: SUBRESOURCE_TYPES }
                                    });
                                }
                            }
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
     * Setup User-Agent spoofing using DeclarativeNetRequest
     */
    static async setupUserAgentSpoofing() {
        try {
            const data = await chrome.storage.local.get(['user_agent_type', 'custom_user_agent']);
            const userAgentType = data.user_agent_type || 'default';
            const customUserAgent = data.custom_user_agent || '';
            
            // Get current User-Agent rules (if any)
            const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
            const userAgentRuleIds = existingRules
                .filter(rule => rule.id >= 90000 && rule.id < 91000)
                .map(rule => rule.id);
            
            // Remove existing User-Agent rules
            if (userAgentRuleIds.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: userAgentRuleIds
                });
            }
            
            // If default, don't add any rules
            if (userAgentType === 'default') {
                return;
            }
            
            // Determine User-Agent string
            let userAgentString = '';
            if (userAgentType === 'custom') {
                userAgentString = customUserAgent;
            } else {
                userAgentString = USER_AGENTS[userAgentType];
            }
            
            if (!userAgentString) {
                return; // Invalid User-Agent type or empty custom string
            }
            
            // Add new User-Agent rule
            const rule = {
                id: 90001,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [{
                        header: 'User-Agent',
                        operation: 'set',
                        value: userAgentString
                    }]
                },
                condition: {
                    resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'stylesheet', 'image', 'font', 'object', 'media', 'websocket', 'other']
                }
            };
            
            await chrome.declarativeNetRequest.updateDynamicRules({
                addRules: [rule]
            });
            
        } catch (error) {
            await ErrorHandler.handle(error, 'setupUserAgentSpoofing');
        }
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
                        await this.updateIPAndRules();
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
                            // Force invalidate cache and lock to update immediately
                            await this.updateIPAndRules(true);
                            const result = await chrome.storage.local.get(['current_ip', 'cachedIP']);
                            const ip = result.current_ip || result.cachedIP;
                            sendResponse({ success: true, ip: ip });
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
                        
                    case 'updateIconType':
                        try {
                            const { iconType } = request;
                            await chrome.storage.local.set({ icon_type: iconType });
                            if (iconType === 'static') {
                                await IconManager.setDefaultIcon();
                            } else {
                                const data = await chrome.storage.local.get(['ip_flag']);
                                if (data.ip_flag) await IconManager.updateIcon(data.ip_flag);
                            }
                            sendResponse({ success: true });
                        } catch (error) {
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    case 'updateUserAgent':
                        try {
                            const { userAgentType, customUserAgent } = request;
                            await chrome.storage.local.set({ 
                                user_agent_type: userAgentType,
                                custom_user_agent: customUserAgent || ''
                            });
                            await this.setupUserAgentSpoofing();
                            sendResponse({ success: true });
                        } catch (error) {
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
                            await this.clearExtensionProxyIfOwned();
                            await IPUtils.invalidateCache();
                            sendResponse({ success: true });
                        } catch (error) {
                            sendResponse({ success: false, error: error.message });
                        }
                        break;
                        
                    case 'forceClearProxy':
                        try {
                            await this.clearExtensionProxyIfOwned();
                            await IPUtils.invalidateCache();
                            sendResponse({ success: true });
                        } catch (error) {
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

// Register Chrome Extension listeners synchronously at top-level script evaluation (Manifest V3 Requirement)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    return BackgroundManager.handleMessage(request, sender, sendResponse);
});

if (chrome.alarms && chrome.alarms.onAlarm) {
    chrome.alarms.onAlarm.addListener((alarm) => {
        BackgroundManager.handleAlarm(alarm);
    });
}

if (chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(async (info) => {
        try {
            await chrome.storage.local.set({ current_tab_id: info.tabId });
            await BackgroundManager.setColor(info.tabId);
        } catch (_) {}
    });
}

if (chrome.tabs && chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        try {
            const blockedPage = chrome.runtime.getURL('html/blocked.html');
            const url = changeInfo.url || tab?.url || '';
            if (!url || !/^https?:/i.test(url)) return;
            if (url.startsWith(blockedPage)) return;
            const host = new URL(url).hostname;
            await chrome.storage.local.set({ [`blockedUrl_${tabId}`]: url, last_blocked_domain: host });
        } catch (_) {}
    });
}

// Initialize when script loads
BackgroundManager.initialize();

chrome.runtime.onSuspend.addListener(() => {
    BackgroundManager.clearExtensionProxyIfOwned();
});

class IconManager {
    static async updateIcon(flag) {
        try {
            // Try to use country code if available for better visual via CDN PNG
            const store = await chrome.storage.local.get(['ip_country']);
            const country = (store.ip_country || '').toLowerCase();
            const sizes = [16,32,48,128];
            const imageData = {};
            for (const s of sizes) {
                const canvas = new OffscreenCanvas(s, s);
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, s, s);
                let drawn = false;
                if (country && /^[a-z]{2}$/.test(country)) {
                    try {
                        const bmp = await this._getFlagBitmap(country, s);
                        if (bmp) {
                            // preserve aspect ratio (flags are 4:3). Fit max within square with small padding
                            const padding = Math.max(1, Math.round(s * 0.03));
                            const maxW = s - padding * 2;
                            const maxH = s - padding * 2;
                            const aspect = bmp.width / bmp.height; // preserve 4:3
                            let dw = maxW, dh = Math.round(maxW / aspect);
                            if (dh > maxH) { dh = maxH; dw = Math.round(maxH * aspect); }
                            const dx = Math.round((s - dw) / 2);
                            const dy = Math.round((s - dh) / 2);
                            // restore clean white background, no border
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, s, s);
                            ctx.drawImage(bmp, dx, dy, dw, dh);
                            drawn = true;
                        }
                    } catch (_) { /* fallback to emoji below */ }
                }
                if (!drawn) {
                    // Fallback: render emoji centered
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, s, s);
                    ctx.font = `bold ${Math.floor(s*1.1)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'alphabetic';
                    ctx.fillStyle = '#000000';
                    const metrics = ctx.measureText(flag || '🏳️');
                    const textHeight = (metrics.actualBoundingBoxAscent || s*0.8) + (metrics.actualBoundingBoxDescent || s*0.2);
                    const y = (s + (metrics.actualBoundingBoxAscent || textHeight*0.8) - (metrics.actualBoundingBoxDescent || textHeight*0.2)) / 2;
                    ctx.fillText(flag || '🏳️', s/2, y);
                }
                imageData[String(s)] = ctx.getImageData(0, 0, s, s);
            }
            await chrome.action.setIcon({ imageData });
        } catch (_) {}
    }
    static async setDefaultIcon() {
        try {
            const paths = {
                16: 'img/icon-48x48-grey.png',
                32: 'img/icon-48x48-grey.png',
                48: 'img/icon-48x48-grey.png',
                128: 'img/icon-128x128-grey.png'
            };
            await chrome.action.setIcon({ path: paths });
        } catch (_) {}
    }
    static async _getFlagBitmap(country, size) {
        // cache key per size
        const key = `flag_png_${country}_${size}`;
        try {
            const cached = await chrome.storage.local.get([key]);
            if (cached[key]) {
                const blob = this._base64ToBlob(cached[key], 'image/png');
                return await createImageBitmap(blob);
            }
        } catch (_) {}
        try {
            const widthMap = {16:32, 32:64, 48:96, 128:256};
            const w = widthMap[size] || 128;
            const url = `https://flagcdn.com/${w}x${Math.round(w*0.75)}/${country}.png`;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2500);
            const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) return null;
            const blob = await res.blob();
            // cache as base64
            try {
                const b64 = await this._blobToBase64(blob);
                const toStore = {}; toStore[key] = b64; await chrome.storage.local.set(toStore);
            } catch (_) {}
            return await createImageBitmap(blob);
        } catch (_) {
            return null;
        }
    }
    static _blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result || '').toString().split(',')[1] || '');
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    static _base64ToBlob(b64, mime) {
        const byteChars = atob(b64);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const byteArray = new Uint8Array(byteNums);
        return new Blob([byteArray], { type: mime });
    }
}
// Listen storage change for ip_flag, icon_type, and user_agent settings
chrome.storage.onChanged.addListener(async (changes) => {
    try {
        if (changes.icon_type) {
            const v = changes.icon_type.newValue;
            if (v === 'static') {
                await IconManager.setDefaultIcon();
            } else {
                const data = await chrome.storage.local.get(['ip_flag']);
                if (data.ip_flag) await IconManager.updateIcon(data.ip_flag);
            }
        }
        if (changes.ip_flag) {
            const pref = await chrome.storage.local.get(['icon_type']);
            if (pref.icon_type !== 'static') {
                await IconManager.updateIcon(changes.ip_flag.newValue);
            }
        }
        if (changes.user_agent_type || changes.custom_user_agent) {
            await BackgroundManager.setupUserAgentSpoofing();
        }
    } catch (_) {}
});

// Enforce WebRTC policy synchronously on service worker evaluation to prevent initial load leaks
try {
    if (chrome.privacy && chrome.privacy.network) {
        if (chrome.privacy.network.webRTCIPHandlingPolicy) {
            chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: 'disable_non_proxied_udp' });
        }
        if (chrome.privacy.network.webRTCMultipleRoutesEnabled) {
            chrome.privacy.network.webRTCMultipleRoutesEnabled.set({ value: false });
        }
    }
} catch (_) {}

// Initialize User-Agent spoofing on startup
(async () => {
    try {
        await BackgroundManager.setupUserAgentSpoofing();
        await BackgroundManager.initializeWebRTC();
    } catch (_) {}
})();
