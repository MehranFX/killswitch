"use strict";

// Utility classes for options page
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
 * Enhanced options page functionality with better validation and error handling
 */

class OptionsManager {
    /**
     * Save options with enhanced validation
     * @param {number} index - Current index being processed
     */
    static async saveOptions(index = 0) {
        try {
            const domainRegexs = document.getElementsByClassName("domain_regex");
            const ipInputs = document.getElementsByClassName("ips");
            
            if (index >= domainRegexs.length) {
                await this.setUpOptions();
                this.showMessage('All rules saved successfully!', 'success');
                return;
            }
            
            const domainRegex = domainRegexs[index].value.trim();
            const ip = ipInputs[index].value.trim();
            
            // Validate inputs
            if (!domainRegex) {
                throw new Error(`Domain/URL at position ${index + 1} cannot be empty`);
            }
            
            if (!ip) {
                throw new Error(`IP addresses at position ${index + 1} cannot be empty`);
            }
            
            // Validate domain/URL
            if (!ValidationUtils.isValidURL(domainRegex) && !ValidationUtils.isValidDomain(domainRegex)) {
                throw new Error(`Invalid domain/URL format at position ${index + 1}: ${domainRegex}`);
            }
            
            // Validate IPs
            const ipArray = ip.split(',').map(ip => ip.trim());
            for (const ipAddr of ipArray) {
                const cleanIP = ipAddr.startsWith('!') ? ipAddr.substring(1) : ipAddr;
                if (!ValidationUtils.isValidIP(cleanIP)) {
                    throw new Error(`Invalid IP address at position ${index + 1}: ${cleanIP}`);
                }
            }
            
            // Save the rule
            await SettingsManager.storeWhitelist(domainRegex, ip, true, null);
            
            // Process next item
            await this.saveOptions(index + 1);
            
        } catch (error) {
            await ErrorHandler.handle(error, 'saveOptions');
            this.showMessage(`Error saving rule at position ${index + 1}: ${error.message}`, 'error');
        }
    }

    /**
     * Add new rule form
     */
    static addNewRule() {
        const content = document.getElementById("content");
        if (!content) return;
        
        const newRuleHTML = `
            <div class="rule-item">
                <p>
                    <strong>URL/Domain</strong><br>
                    <input class="domain_regex" placeholder="Enter URL or domain (e.g., example.com, *.example.com)" value=""/><br>
                    <strong>ALLOWED IPS</strong> (separate with comma)<br>
                    <textarea class="ips" placeholder="Enter IP addresses (e.g., 192.168.1.1, 10.0.0.1)" style="width:100%; height:60px;"></textarea><br>
                    <small>Use ! before IP to blacklist (e.g., !192.168.1.1)<br>
                    Use * for wildcards (e.g., *.example.com matches all subdomains)</small>
                </p>
            </div>
        `;
        
        content.insertAdjacentHTML('beforeend', newRuleHTML);
    }

    /**
     * Show message to user
     * @param {string} message - Message to show
     * @param {string} type - Message type (success, error, info)
     */
    static showMessage(message, type = 'info') {
        const messageElement = document.getElementById('message');
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.className = `message ${type}`;
            messageElement.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Set up options page with existing rules
     */
    static async setUpOptions() {
        try {
            const urlData = await chrome.storage.local.get(['urls']);
            const ipData = await chrome.storage.local.get(['allowed_ips']);
            
            const urlArray = urlData.urls || [];
            const allowedIPsArray = ipData.allowed_ips || [];
            
            let html = "";
            
            if (urlArray.length > 0) {
                for (let i = 0; i < urlArray.length; i++) {
                    const url = SecurityUtils.escapeHTML(urlArray[i]);
                    const ips = SecurityUtils.escapeHTML((allowedIPsArray[i] || '').replace(/\|/g, ''));
                    
                    html += `
                        <div class="rule-item">
                            <p>
                                <strong>URL/Domain</strong> - 
                                <a href="#" url="${url}" class="delete">REMOVE RULE</a><br>
                                <input class="domain_regex" value="${url}" disabled/><br>
                                <strong>ALLOWED IPS</strong> (separate with comma)<br>
                                <textarea class="ips" style="width:100%; height:60px;">${ips}</textarea><br>
                                <small>Use ! before IP to blacklist (e.g., !192.168.1.1)</small>
                            </p>
                        </div>
                    `;
                }
            } else {
                html = '<p class="no-rules">No rules configured yet. Add your first rule below.</p>';
            }
            
            const content = document.getElementById("content");
            if (content) {
                content.innerHTML = html;
            }
            
            // Set up delete event listeners
            this.setupDeleteListeners();
            
        } catch (error) {
            await ErrorHandler.handle(error, 'setUpOptions');
        }
    }

    /**
     * Set up delete event listeners
     */
    static setupDeleteListeners() {
        const deleteButtons = document.getElementsByClassName("delete");
        
        for (let i = 0; i < deleteButtons.length; i++) {
            deleteButtons[i].addEventListener('click', async (e) => {
                e.preventDefault();
                const url = e.target.getAttribute("url");
                
                try {
                    await SettingsManager.deleteWhitelist(url);
                    e.target.closest('.rule-item').remove();
                    this.showMessage('Rule removed successfully!', 'success');
                } catch (error) {
                    await ErrorHandler.handle(error, 'deleteRule');
                }
            });
        }
    }

    /**
     * Initialize event listeners
     */
    static initializeEventListeners() {
        // Save button
        const saveBtn = document.getElementById("save");
        if (saveBtn) {
            saveBtn.addEventListener("click", (e) => {
                e.preventDefault();
                this.saveOptions(0);
            });
        }

        // Add button
        const addBtn = document.getElementById("add");
        if (addBtn) {
            addBtn.addEventListener("click", (e) => {
                e.preventDefault();
                this.addNewRule();
            });
        }
    }
}

// Legacy functions for backward compatibility
function saveOptions(i) {
    OptionsManager.saveOptions(i);
}

function setMessage(string) {
    OptionsManager.showMessage(string, 'info');
}

function setUpOptions() {
    OptionsManager.setUpOptions();
}

// Initialize when page loads
window.onload = function() {
    OptionsManager.initializeEventListeners();
    OptionsManager.setUpOptions();
};