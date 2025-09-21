"use strict";

// Use ValidationUtils and ErrorHandler from settings.js
// Only define SecurityUtils locally to avoid conflicts
const SecurityUtils = {
    escapeHTML: function(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

/**
 * Enhanced options page functionality with better validation and error handling
 */

class OptionsManager {
    /**
     * Save options with enhanced validation
     */
    static async saveOptions() {
        try {
            // Get form data
            const domainInput = document.getElementById("domain_input");
            const ipsInput = document.getElementById("ips_input");
            
            if (!domainInput || !ipsInput) {
                throw new Error('Form elements not found');
            }
            
            const domainRegex = domainInput.value.trim();
            const ip = ipsInput.value.trim();
            
            // Validate inputs
            if (!domainRegex) {
                throw new Error('Domain/URL cannot be empty');
            }
            
            if (!ip) {
                throw new Error('IP addresses cannot be empty');
            }
            
            // Validate domain/URL
            if (!ValidationUtils.isValidURL(domainRegex) && !ValidationUtils.isValidDomain(domainRegex)) {
                throw new Error(`Invalid domain/URL format: ${domainRegex}`);
            }
            
            // Validate IPs
            const ipArray = ip.split(',').map(ip => ip.trim());
            for (const ipAddr of ipArray) {
                const cleanIP = ipAddr.startsWith('!') ? ipAddr.substring(1) : ipAddr;
                if (!ValidationUtils.isValidIP(cleanIP)) {
                    throw new Error(`Invalid IP address: ${cleanIP}`);
                }
            }
            
            // Save the rule
            await SettingsManager.storeWhitelist(domainRegex, ip, true, null);
            
            // Clear form
            domainInput.value = '';
            ipsInput.value = '';
            
            // Refresh saved rules
            await this.setUpOptions();
            this.showMessage('Rule saved successfully!', 'success');
            
        } catch (error) {
            await ErrorHandler.handle(error, 'saveOptions');
            this.showMessage(`Error saving rule: ${error.message}`, 'error');
        }
    }

    /**
     * Add new rule form
     */
    static addNewRule() {
        const savedRulesList = document.getElementById("saved_rules_list");
        if (!savedRulesList) return;
        
        const newRuleHTML = `
            <div class="rule-item">
                <p style="margin-bottom: 8px;">
                    <strong>URL/Domain</strong>
                    <a href="#" class="delete" style="margin-left: auto; float: right;">REMOVE RULE</a>
                </p>
                <div class="op-narrow">
                    <label class="field-label">Domain/URL</label>
                    <div class="domain-row">
                        <input class="domain_regex" placeholder="e.g., example.com, *.example.com" value=""/>
                    </div>
                    <label class="field-label">Allowed IP Addresses</label>
                    <div class="ips-row">
                        <textarea class="ips" placeholder="Enter IP addresses separated by comma (e.g., 192.168.1.1, 10.0.0.1)"></textarea>
                    </div>
                    <small style="color: #6c757d; font-size: 11px;">
                        Use ! before IP to blacklist (e.g., !192.168.1.1)<br>
                        Use * for wildcards (e.g., *.example.com matches all subdomains)
                    </small>
                </div>
            </div>
        `;
        
        savedRulesList.insertAdjacentHTML('beforeend', newRuleHTML);
        
        // Set up delete listener for the new rule
        const newRule = savedRulesList.lastElementChild;
        const deleteBtn = newRule.querySelector('.delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                newRule.remove();
            });
        }
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
            
            const savedRulesList = document.getElementById("saved_rules_list");
            if (!savedRulesList) return;
            
            let html = "";
            
            if (urlArray.length > 0) {
                for (let i = 0; i < urlArray.length; i++) {
                    const url = SecurityUtils.escapeHTML(urlArray[i]);
                    const ips = SecurityUtils.escapeHTML((allowedIPsArray[i] || '').replace(/\|/g, ''));
                    
                    html += `
                        <div class="saved-rule-card">
                            <div class="rule-header">
                                <div class="rule-domain">
                                    <span class="domain-label">Domain/URL:</span>
                                    <span class="domain-value">${url}</span>
                                </div>
                                <a href="#" url="${url}" class="delete-rule-btn">DELETE</a>
                            </div>
                            <div class="rule-ips">
                                <span class="ips-label">Allowed IPs:</span>
                                <span class="ips-value">${ips}</span>
                            </div>
                        </div>
                    `;
                }
            } else {
                html = '<div class="no-rules-message">No rules configured yet. Add your first rule above.</div>';
            }
            
            savedRulesList.innerHTML = html;
            
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
        const deleteButtons = document.getElementsByClassName("delete-rule-btn");
        
        for (let i = 0; i < deleteButtons.length; i++) {
            deleteButtons[i].addEventListener('click', async (e) => {
                e.preventDefault();
                const url = e.target.getAttribute("url");
                
                try {
                    await SettingsManager.deleteWhitelist(url);
                    e.target.closest('.saved-rule-card').remove();
                    this.showMessage('Rule removed successfully!', 'success');
                } catch (error) {
                    await ErrorHandler.handle(error, 'deleteRule');
                    this.showMessage('Error removing rule', 'error');
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
                this.saveOptions();
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
function saveOptions() {
    OptionsManager.saveOptions();
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