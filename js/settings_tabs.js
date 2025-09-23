"use strict";

// Tab functionality
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching functionality
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      // Remove active class from all buttons and contents
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    });
  });

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
});
