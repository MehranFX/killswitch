document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  var countryData = window.COUNTRY_DATA || {};

  function hexToRgba(hex, alpha) {
    if (!hex || hex[0] !== '#') return 'rgba(100, 116, 139, ' + alpha + ')';
    var clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    var r = parseInt(clean.substring(0, 2), 16) || 0;
    var g = parseInt(clean.substring(2, 4), 16) || 0;
    var b = parseInt(clean.substring(4, 6), 16) || 0;
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  function extractCountryCode(text) {
    if (!text) return null;
    var match = text.match(/\b([A-Z]{2})\b/);
    if (match && match[1] !== 'AM' && match[1] !== 'PM' && countryData[match[1]]) {
      return match[1];
    }
    var lower = text.toLowerCase();
    for (var code in countryData) {
      var cName = countryData[code].name.toLowerCase();
      if (lower.indexOf(cName) > -1) {
        return code;
      }
    }
    return null;
  }

  function applyFlagTheme(countryCode, explicitFlag) {
    var statusCard = document.querySelector('.status-card');
    if (!statusCard || !countryCode) return;

    var code = countryCode.toUpperCase();
    var entry = (window.getCountryInfo ? window.getCountryInfo(code) : countryData[code]) || {};
    var name = entry.name || code;
    var colors = entry.colors || ['#667eea', '#764ba2'];
    var flag = explicitFlag || entry.flag || (window.countryCodeToFlag ? window.countryCodeToFlag(code) : '');

    // 1. Top accent bar gradient using country colors
    var topBar = 'linear-gradient(90deg, ' + colors.join(', ') + ')';
    statusCard.style.setProperty('--flag-top-bar', topBar);

    // 2. Ambient mesh orbs with subtle alpha tints
    var orb1 = hexToRgba(colors[0], 0.16);
    var orb2 = hexToRgba(colors[1] || colors[0], 0.16);
    var mesh = 'radial-gradient(circle at 10% 20%, ' + orb1 + ' 0%, transparent 45%), ' +
               'radial-gradient(circle at 90% 80%, ' + orb2 + ' 0%, transparent 50%), ' +
               'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.8) 0%, transparent 70%)';
    statusCard.style.setProperty('--card-ambient-mesh', mesh);
    statusCard.setAttribute('data-country', code);

    // 3. Update texts & code pill
    var nameEl = document.getElementById('country_name_text');
    if (nameEl) nameEl.textContent = name;

    var pillEl = document.getElementById('country_code_pill');
    if (pillEl) pillEl.textContent = code;

    // 4. Update flag medal with the authentic flag
    var medalEl = document.getElementById('flag_medal');
    if (medalEl && flag) {
      medalEl.textContent = flag;
    }

    var locationEl = document.getElementById('location_text');
    if (locationEl) {
      locationEl.textContent = name;
    }
  }

  function detectCountry() {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['ip_country', 'ip_flag'], function(data) {
          if (data && data.ip_country) {
            applyFlagTheme(String(data.ip_country), data.ip_flag);
            return;
          }
          fallback();
        });
        return;
      }
    } catch (_) {}

    fallback();

    function fallback() {
      var locationEl = document.getElementById('location_text');
      var timezoneEl = document.getElementById('timezone_text');
      var text = (locationEl ? locationEl.textContent : '') + ' ' + (timezoneEl ? timezoneEl.textContent : '');
      var cc = extractCountryCode(text);
      if (cc) applyFlagTheme(cc, null);
    }
  }

  // Rapid detection triggers
  setTimeout(detectCountry, 30);
  setTimeout(detectCountry, 150);
  setTimeout(detectCountry, 500);
  setTimeout(detectCountry, 1500);

  var locationEl = document.getElementById('location_text');
  if (locationEl && window.MutationObserver) {
    var observer = new MutationObserver(detectCountry);
    observer.observe(locationEl, { childList: true, subtree: true, characterData: true });
  }

  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function(changes) {
      if (changes.ip_country || changes.ip_flag) {
        detectCountry();
      }
    });
  }
});
