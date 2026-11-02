"use strict";

/**
 * Enhanced popup functionality with better error handling and async operations
 */

class PopupManager {
    static isRefreshing = false; // Flag to prevent multiple simultaneous refreshes
    static refreshWatchTimer = null;
    static suppressStorageUpdates = false;
    
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
            // Error removed
            this.showMessage(`Error: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Show loading state
     * @param {boolean} loading - Whether to show loading
     */
    static showLoading(loading) {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.disabled = loading;
            if (loading) {
                button.style.opacity = '0.6';
            } else {
                button.style.opacity = '1';
            }
        });
    }

    /**
     * Show message to user
     * @param {string} message - Message to show
     * @param {string} type - Type of message (success, error, info)
     */
    static showMessage(message, type = 'info') {
        let messageElement = document.getElementById('message');
        if (!messageElement) {
            messageElement = this.createMessageElement();
        }

        // Set message content and style
        messageElement.textContent = message;
        messageElement.style.display = 'block';
        
        // Set color based on type
        switch (type) {
            case 'success':
                messageElement.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                messageElement.style.backgroundColor = '#f44336';
                break;
            case 'info':
            default:
                messageElement.style.backgroundColor = '#2196F3';
                break;
        }

        // Hide after 3 seconds
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 3000);
    }

    /**
     * Update status display
     * @param {string} message - Status message
     * @param {string} type - Status type
     */
    static updateStatus(message, type = 'info') {
        this.showMessage(message, type);
    }


    /**
     * Refresh IP and update display
     */
    static async refreshIP(options = { manual: false }) {
        // Prevent multiple simultaneous refreshes
        if (this.isRefreshing) {
            // Log removed
            return;
        }
        
        try {
            this.isRefreshing = true;
            this.showLoading(true);
            // Update status immediately
            const statusElement = document.getElementById('ip_status_text');
            if (statusElement) statusElement.textContent = 'Refreshing...';
            // Log removed
            // hide current IP to avoid flicker
            const ipEl = document.getElementById('current_ip');
            if (ipEl) ipEl.textContent = '...';
            this.suppressStorageUpdates = true;
            // Watchdog to restore UI if background doesn't respond
            if (this.refreshWatchTimer) clearTimeout(this.refreshWatchTimer);
            this.refreshWatchTimer = setTimeout(() => {
                this.isRefreshing = false;
                this.showLoading(false);
                const s = document.getElementById('ip_status_text');
                if (s) s.textContent = 'Ready to update';
            }, 15000);
            
            // Send refresh message to background with automatic retry if service worker is waking up
            const sendMessageWithRetry = async (retries = 2) => {
                for (let attempt = 0; attempt <= retries; attempt++) {
                    try {
                        const res = await Promise.race([
                            chrome.runtime.sendMessage({type: "refreshIP"}),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Message timeout')), 8000))
                        ]);
                        return res;
                    } catch (err) {
                        if (attempt === retries) throw err;
                        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
                    }
                }
            };
            const response = await sendMessageWithRetry();
            
            // Log removed
            
            if (response && response.success) {
                if (options.manual) {
                    this.showMessage('IP refreshed successfully!', 'success');
                }
            } else {
                throw new Error(response?.error || 'Failed to refresh IP');
            }
        } catch (error) {
            this.showMessage(`Error refreshing IP: ${error.message}`, 'error');
        } finally {
            this.isRefreshing = false;
            this.showLoading(false);
            if (this.refreshWatchTimer) { clearTimeout(this.refreshWatchTimer); this.refreshWatchTimer = null; }
            this.suppressStorageUpdates = false;
            await this.updateIPDisplay({ highlight: true });
            this.updateCountdown();
        }
    }


    /**
     * Clear proxy settings function
     */
    static async clearProxy() {
        try {
            // Log removed
            
            const response = await chrome.runtime.sendMessage({type: "clearProxy"});
            // Log removed
            
            if (response && response.success) {
                this.showMessage('Proxy settings cleared!', 'success');
            } else {
                this.showMessage('Failed to clear proxy settings', 'error');
            }
        } catch (error) {
            // Error removed
            this.showMessage('Error clearing proxy settings', 'error');
        }
    }

    /**
     * Refresh browser function
     */
    static async refreshBrowser() {
        try {
            // Log removed
            
            // Get current tab
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            if (tabs[0]) {
                await chrome.tabs.reload(tabs[0].id);
                this.showMessage('Browser refreshed!', 'success');
            } else {
                this.showMessage('No active tab found', 'error');
            }
        } catch (error) {
            // Error removed
            this.showMessage('Error refreshing browser', 'error');
        }
    }

    /**
     * Restart browser function
     */
    static async restartBrowser() {
        try {
            // Log removed
            
            // Clear proxy first
            const response = await chrome.runtime.sendMessage({type: "clearProxy"});
            if (response && response.success) {
                this.showMessage('Proxy cleared! Please restart Chrome manually.', 'success');
                
                // Show detailed instructions
                setTimeout(() => {
                    this.showMessage('1. Close ALL Chrome windows', 'error');
                }, 2000);
                
                setTimeout(() => {
                    this.showMessage('2. Wait 5 seconds', 'error');
                }, 4000);
                
                setTimeout(() => {
                    this.showMessage('3. Reopen Chrome', 'error');
                }, 6000);
                
                setTimeout(() => {
                    this.showMessage('4. Go to binance.com', 'error');
                }, 8000);
            } else {
                this.showMessage('Failed to clear proxy', 'error');
            }
        } catch (error) {
            // Error removed
            this.showMessage('Error restarting browser', 'error');
        }
    }

    /**
     * Force restart function - nuclear option
     */
    static async forceRestart() {
        try {
            // Log removed
            
            // Force clear proxy first
            const response = await chrome.runtime.sendMessage({type: "forceClearProxy"});
            if (response && response.success) {
                this.showMessage('Proxy force cleared! Restarting...', 'success');
                
                // Show countdown
                let countdown = 5;
                const countdownInterval = setInterval(() => {
                    this.showMessage(`Restarting in ${countdown}...`, 'error');
                    countdown--;
                    
                    if (countdown <= 0) {
                        clearInterval(countdownInterval);
                        this.showMessage('Please close Chrome NOW!', 'error');
                    }
                }, 1000);
                
                // Force close all tabs after countdown
                setTimeout(async () => {
                    try {
                        const tabs = await chrome.tabs.query({});
                        for (const tab of tabs) {
                            try {
                                await chrome.tabs.remove(tab.id);
                            } catch (e) {
                                // Ignore errors
                            }
                        }
                    } catch (e) {
                        // Ignore errors
                    }
                }, 6000);
                
            } else {
                this.showMessage('Failed to force clear proxy', 'error');
            }
        } catch (error) {
            // Error removed
            this.showMessage('Error force restarting', 'error');
        }
    }

    /**
     * Manual clear function - step by step instructions
     */
    static async manualClear() {
        try {
            // Log removed
            
            this.showMessage('Manual Clear Instructions:', 'success');
            
            // Show step by step instructions
            setTimeout(() => {
                this.showMessage('1. Go to chrome://settings/', 'error');
            }, 1000);
            
            setTimeout(() => {
                this.showMessage('2. Click "Advanced" → "System"', 'error');
            }, 3000);
            
            setTimeout(() => {
                this.showMessage('3. Click "Open proxy settings"', 'error');
            }, 5000);
            
            setTimeout(() => {
                this.showMessage('4. Click "LAN settings"', 'error');
            }, 7000);
            
            setTimeout(() => {
                this.showMessage('5. Uncheck "Use proxy server"', 'error');
            }, 9000);
            
            setTimeout(() => {
                this.showMessage('6. Click OK and restart Chrome', 'error');
            }, 11000);
            
        } catch (error) {
            // Error removed
            this.showMessage('Error manual clear', 'error');
        }
    }

    /**
     * Update IP display in popup
     */
    static async updateIPDisplay(options = { highlight: false }) {
        try {
            // Log removed
            
            // Get IP from storage directly
            const result = await chrome.storage.local.get(['current_ip', 'cachedIP', 'ip_flag']);
            const ip = result.current_ip || result.cachedIP;
            const ipElement = document.getElementById('current_ip');
            const flag = result.ip_flag || '';
            
            // Log removed
            // Log removed
            
            if (ipElement) {
                const oldText = ipElement.textContent;
                ipElement.textContent = ip || 'Loading...';
                // Ensure background stays transparent
                ipElement.style.background = 'transparent';
                // Log removed
                
                // Highlight only when explicitly requested (end of refresh)
                if (options.highlight && ip) {
                    ipElement.style.backgroundColor = '#4CAF50';
                    ipElement.style.color = 'white';
                    setTimeout(() => {
                        ipElement.style.backgroundColor = 'transparent';
                        ipElement.style.color = '#667eea';
                    }, 1500);
                }
            } else {
                // Error removed
            }
            
            // Update location display
            await this.updateLocationDisplay();
            
        } catch (error) {
            // Error removed
            const ipElement = document.getElementById('current_ip');
            if (ipElement) {
                ipElement.textContent = 'Error';
            }
        }
    }

    /**
     * Update location display in popup
     */
    static async updateLocationDisplay() {
        try {
            // Log removed
            
            // Get location data from storage
            const result = await chrome.storage.local.get([
                'location_config', 'timezone', 'locale', 'latitude', 'longitude',
                'ip_country', 'ip_flag'
            ]);
            
            const locationElement = document.getElementById('location_text');
            const timezoneElement = document.getElementById('timezone_text');
            const localeElement = document.getElementById('locale_text');
            
            if (result.location_config === 'browserDefault') {
                // Show browser default
                if (locationElement) locationElement.textContent = 'Browser Default';
                if (timezoneElement) timezoneElement.textContent = 'Browser Default';
                if (localeElement) localeElement.textContent = 'Browser Default';
            } else if (result.location_config === 'matchIP') {
                // Show IP-based location
                const country = (result.ip_country || '').toUpperCase();
                const info = (window.getCountryInfo && country) ? window.getCountryInfo(country) : (window.COUNTRY_DATA?.[country] || null);
                const countryName = info?.name || country || 'Unknown';
                const flag = result.ip_flag || info?.flag || (window.countryCodeToFlag ? window.countryCodeToFlag(country) : '');
                const location = country ? countryName : 'Unknown';
                
                if (locationElement) locationElement.textContent = location;
                const cNameEl = document.getElementById('country_name_text');
                if (cNameEl) cNameEl.textContent = countryName;
                const cPillEl = document.getElementById('country_code_pill');
                if (cPillEl) cPillEl.textContent = country || '--';
                const fMedalEl = document.getElementById('flag_medal');
                if (fMedalEl) fMedalEl.textContent = flag || '🌐';
                if (timezoneElement) timezoneElement.textContent = result.timezone || 'Unknown';
                if (localeElement) localeElement.textContent = result.locale || 'Unknown';
            } else if (result.location_config === 'custom') {
                // Show custom location
                const lat = result.latitude || '';
                const lon = result.longitude || '';
                const location = (lat && lon) ? `${lat.toFixed(2)}, ${lon.toFixed(2)}` : 'Custom';
                
                if (locationElement) locationElement.textContent = location;
                if (timezoneElement) timezoneElement.textContent = result.timezone || 'Custom';
                if (localeElement) localeElement.textContent = result.locale || 'Custom';
            } else {
                // Fallback
                if (locationElement) locationElement.textContent = 'Loading...';
                if (timezoneElement) timezoneElement.textContent = 'Loading...';
                if (localeElement) localeElement.textContent = 'Loading...';
            }
            
            // Log removed
            
        } catch (error) {
            // Error removed
            const locationElement = document.getElementById('location_text');
            const timezoneElement = document.getElementById('timezone_text');
            const localeElement = document.getElementById('locale_text');
            
            if (locationElement) locationElement.textContent = 'Error';
            if (timezoneElement) timezoneElement.textContent = 'Error';
            if (localeElement) localeElement.textContent = 'Error';
        }
    }

    /**
     * Update countdown display
     */
    static updateCountdown() {
        const countdownElement = document.getElementById('countdown');
        const statusElement = document.getElementById('ip_status_text');
        
        if (!countdownElement || !statusElement) {
            // Log removed
            return;
        }

        chrome.storage.local.get(['last_ip_update', 'ipTimestamp'], (result) => {
            const lastUpdate = result.last_ip_update || result.ipTimestamp || 0;
            const now = Date.now();
            const timeSinceUpdate = now - lastUpdate;
            const updateInterval = 30 * 1000; // 30 seconds
            const timeUntilUpdate = updateInterval - timeSinceUpdate;

            // Countdown update
            // removed debug log

            if (timeUntilUpdate <= 0) {
                countdownElement.textContent = '00:00';
                statusElement.textContent = this.isRefreshing ? 'Refreshing...' : 'Ready to update';
                statusElement.style.color = this.isRefreshing ? '#2196F3' : '#ff9800';
                
                // Auto-refresh IP when countdown reaches zero (throttled to avoid rapid loop)
                const lastAutoTry = this._lastAutoRefreshTry || 0;
                if (!this.isRefreshing && (now - lastAutoTry > 10000)) {
                    this._lastAutoRefreshTry = now;
                    this.refreshIP();
                }
            } else {
                const minutes = Math.floor(timeUntilUpdate / 60000);
                const seconds = Math.floor((timeUntilUpdate % 60000) / 1000);
                countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                statusElement.textContent = 'Cached';
                statusElement.style.color = '#4CAF50';
            }
        });
    }

    /**
     * Set up popup interface and event handlers
     */
    static async setUpPopup() {
        try {
            // Log removed
            
            // Wait a bit for storage to be ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Log removed
            const initialStorage = await chrome.storage.local.get(['current_ip', 'cachedIP', 'last_ip_update']);
            // Log removed
            
            // Update IP display
            await this.updateIPDisplay();
            
            // Check if IP is fresh (< 3s old), otherwise silently refresh in background
            const now = Date.now();
            if (!initialStorage.last_ip_update || (now - initialStorage.last_ip_update) > 3000) {
                chrome.runtime.sendMessage({ type: "refreshIP" }).catch(() => {});
            }
            
            // Update countdown
            this.updateCountdown();
            
            // Set up countdown timer
            setInterval(() => {
                this.updateCountdown();
            }, 1000);
            
            // Remove periodic highlight-causing refresh; rely on storage listener and countdown
            
            // Set up storage listener for real-time updates
            this.setupStorageListener();
            
            // Set up message listener for location updates
            this.setupMessageListener();
            
            // Initialize event listeners
            this.initializeEventListeners();
            
            // Log removed
            
        } catch (error) {
            // Error removed
            this.showMessage('Error initializing popup', 'error');
        }
    }

    /**
     * Set up storage listener for real-time updates
     */
    static setupStorageListener() {
        // Log removed
        
        chrome.storage.onChanged.addListener((changes, namespace) => {
            // Log removed
            
            // Check if IP was updated
            if (changes.current_ip || changes.cachedIP) {
                if (this.suppressStorageUpdates) {
                    // Log removed
                } else {
                    // Log removed
                    this.updateIPDisplay();
                }
            }
            
            // Check if location data was updated
            if (changes.timezone || changes.locale || changes.latitude || changes.longitude || 
                changes.location_config || changes.ip_country || changes.ip_flag) {
                // Log removed
                this.updateLocationDisplay();
            }
            
            // Check if last update time changed
            if (changes.last_ip_update || changes.ipTimestamp) {
                // Log removed
                this.updateCountdown();
            }
        });
        
        // Log removed
    }

    /**
     * Set up message listener for location updates
     */
    static setupMessageListener() {
        // Log removed
        
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            // Log removed
            
            if (request.type === 'locationUpdated') {
                // Log removed
                this.updateLocationDisplay();
            }
        });
        
        // Log removed
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

        // Settings gear button → open dedicated settings page
        const settingsBtn = document.getElementById("settings_btn");
        if (settingsBtn) {
            settingsBtn.addEventListener("click", (e) => {
                e.preventDefault();
                const url = chrome.runtime.getURL('html/settings.html');
                chrome.tabs.create({ url });
            });
        }

        // Country rule button → open dedicated country rules popup window (like My Rules)
        const countryBtn = document.getElementById("country_rule");
        if (countryBtn) {
            countryBtn.addEventListener("click", async (e) => {
                e.preventDefault();
                const url = chrome.runtime.getURL('html/country_rules.html');
                try {
                    const w = 420, h = 640;
                    // Center relative to current window to avoid other monitor
                    const cur = await chrome.windows.getCurrent();
                    const left = Math.max(0, Math.round((cur.left || 0) + ((cur.width || screen.availWidth) - w) / 2));
                    const top = Math.max(0, Math.round((cur.top || 0) + ((cur.height || screen.availHeight) - h) / 2));
                    await chrome.windows.create({ url, type: 'popup', width: w, height: h, left, top, focused: true });
                } catch (_) {
                    // Fallback to opening a new tab if popup creation is blocked
                    chrome.tabs.create({ url });
                }
            });
        }

        // Refresh IP button
        const refreshIcon = document.getElementById("refresh_icon");
        if (refreshIcon) {
            refreshIcon.addEventListener("click", (e) => {
                e.preventDefault();
                this.refreshIP({ manual: true });
            });
        }

        

        // No extra debug/control buttons

    }

    // Deprecated panel handler removed
}

// Legacy function for backward compatibility
function storeURL(domainOnly, whitelist) {
    PopupManager.storeURL(domainOnly, whitelist);
}

// Legacy function for backward compatibility
function setUpPopup() {
    PopupManager.setUpPopup();
}

// Initialize popup when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        PopupManager.setUpPopup();
    });
} else {
    PopupManager.setUpPopup();
}