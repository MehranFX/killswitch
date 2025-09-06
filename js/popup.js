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
            console.error('Error storing URL:', error);
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
    static async refreshIP() {
        try {
            this.showLoading(true);
            
            // Send refresh message to background
            const response = await chrome.runtime.sendMessage({type: "refreshIP"});
            
            if (response.success) {
                this.showMessage('IP refreshed successfully!', 'success');
                // Update display
                await this.updateIPDisplay();
            } else {
                throw new Error(response.error || 'Failed to refresh IP');
            }
        } catch (error) {
            console.error('Error refreshing IP:', error);
            this.showMessage('Error refreshing IP', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Update IP display in popup
     */
    static async updateIPDisplay() {
        try {
            // Get IP from storage directly
            const result = await chrome.storage.local.get(['current_ip', 'cachedIP']);
            const ip = result.current_ip || result.cachedIP;
            const ipElement = document.getElementById('current_ip');
            if (ipElement) {
                ipElement.textContent = ip || 'Loading...';
                console.log('✅ IP element updated with:', ip);
            } else {
                console.error('❌ IP element not found!');
            }
            console.log('IP displayed:', ip);
            console.log('Storage result:', result);
        } catch (error) {
            console.error('Error updating IP display:', error);
            const ipElement = document.getElementById('current_ip');
            if (ipElement) {
                ipElement.textContent = 'Error';
            }
        }
    }

    /**
     * Update countdown display
     */
    static updateCountdown() {
        const countdownElement = document.getElementById('countdown');
        const statusElement = document.getElementById('ip_status_text');
        
        if (!countdownElement || !statusElement) return;

        chrome.storage.local.get(['last_ip_update', 'ipTimestamp'], (result) => {
            const lastUpdate = result.last_ip_update || result.ipTimestamp || 0;
            const now = Date.now();
            const timeSinceUpdate = now - lastUpdate;
            const updateInterval = 30 * 1000; // 30 seconds
            const timeUntilUpdate = updateInterval - timeSinceUpdate;

            console.log('Countdown update:', {
                lastUpdate: new Date(lastUpdate).toLocaleTimeString(),
                timeSinceUpdate: Math.floor(timeSinceUpdate / 1000) + 's',
                timeUntilUpdate: Math.floor(timeUntilUpdate / 1000) + 's',
                storageKeys: result
            });

            if (timeUntilUpdate <= 0) {
                countdownElement.textContent = '00:00';
                statusElement.textContent = 'Ready for update';
                statusElement.style.color = '#ff9800';
            } else {
                const minutes = Math.floor(timeUntilUpdate / 60000);
                const seconds = Math.floor((timeUntilUpdate % 60000) / 1000);
                countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                statusElement.textContent = 'Active';
                statusElement.style.color = '#4CAF50';
            }
        });
    }

    /**
     * Set up popup interface and event handlers
     */
    static async setUpPopup() {
        try {
            console.log('🚀 Setting up popup...');
            
            // Wait a bit for storage to be ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Update IP display
            await this.updateIPDisplay();
            
            // Update countdown
            this.updateCountdown();
            
            // Set up countdown timer
            setInterval(() => {
                this.updateCountdown();
            }, 1000);
            
            // Initialize event listeners
            this.initializeEventListeners();
            
            console.log('✅ Popup setup completed');
            
        } catch (error) {
            console.error('Error setting up popup:', error);
            this.showMessage('Error initializing popup', 'error');
        }
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

        // Refresh IP button
        const refreshIPBtn = document.getElementById("refresh_ip");
        if (refreshIPBtn) {
            refreshIPBtn.addEventListener("click", (e) => {
                e.preventDefault();
                this.refreshIP();
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

// Initialize popup when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        PopupManager.setUpPopup();
    });
} else {
    PopupManager.setUpPopup();
}