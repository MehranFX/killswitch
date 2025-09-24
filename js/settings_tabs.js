"use strict";

// Tab functionality
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching functionality (only buttons with data-tab)
  function toggleSaveVisibility(activeTab){
    const saveBtn = document.getElementById('save_settings');
    if (!saveBtn) return;
    if (activeTab === 'donate') {
      saveBtn.style.display = 'none';
    } else {
      saveBtn.style.display = 'block';
    }
  }

  document.querySelectorAll('.tab-button[data-tab]').forEach(button => {
    button.addEventListener('click', (e) => {
      const tabName = button.dataset.tab;
      if (!tabName) return;
      
      document.querySelectorAll('.tab-button[data-tab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      button.classList.add('active');
      const target = document.getElementById(tabName);
      if (target) target.classList.add('active');
      toggleSaveVisibility(tabName);
    });
  });

  // Initialize visibility on load (default active tab has class active)
  const initialActive = document.querySelector('.tab-content.active');
  if (initialActive && initialActive.id) {
    toggleSaveVisibility(initialActive.id);
  }

  // Message functionality
  window.showMessage = function(text) {
    const message = document.getElementById('message');
    if (message) {
      message.textContent = text;
      message.classList.add('show');
      setTimeout(() => {
        message.classList.remove('show');
      }, 3000);
    }
  };

  // Copy & QR handlers for Donate tab
  document.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('[data-copy]');
    const qrBtn = e.target.closest('[data-qr]');
    if (copyBtn) {
      const selector = copyBtn.getAttribute('data-copy');
      const input = document.querySelector(selector);
      if (input) {
        try {
          // Prevent any default behavior (like navigating if inside <a>)
          e.preventDefault();
          await navigator.clipboard.writeText(input.value);
          if (window.showMessage) window.showMessage('✅ Address copied');
        } catch (_) {}
      }
    } else if (qrBtn) {
      e.preventDefault();
      const selector = qrBtn.getAttribute('data-qr');
      const input = document.querySelector(selector);
      const modal = document.getElementById('qr_modal');
      const img = document.getElementById('qr_image');
      const title = document.getElementById('qr_title');
      if (input && modal && img) {
        // Use external providers as images (no navigation)
        const value = encodeURIComponent(input.value);
        const providers = [
          `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${value}`,
          `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${value}`
        ];
        let idx = 0;
        const tryLoad = () => {
          img.onerror = () => { idx++; idx < providers.length ? (img.src = providers[idx]) : (img.removeAttribute('src'), window.showMessage && window.showMessage('❌ Cannot load QR image')); };
          img.src = providers[idx];
        };
        tryLoad();
        title.textContent = 'QR: ' + input.value.slice(0, 12) + '…';
        modal.style.display = 'flex';
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'qr_close') {
      e.preventDefault();
      e.stopPropagation();
      const modal = document.getElementById('qr_modal');
      if (modal) {
        modal.style.display = 'none';
        const img = document.getElementById('qr_image');
        if (img) img.removeAttribute('src');
      }
      return;
    }
    // Close when clicking outside the dialog
    const modal = document.getElementById('qr_modal');
    const dialog = document.getElementById('qr_dialog');
    if (modal && e.target === modal) {
      modal.style.display = 'none';
      const img = document.getElementById('qr_image');
      if (img) img.removeAttribute('src');
    }
    if (dialog && e.target === dialog) {
      // do nothing - allow interaction inside dialog
    }
  });
});
