document.addEventListener('DOMContentLoaded', function() {
  
  // Use global country data
  var countryData = window.COUNTRY_DATA || {};
  
  // Get flag colors from country data
  function getFlagColors(countryCode) {
    return countryData[countryCode]?.colors || null;
  }

  // Generate flag colors - use real colors if available, otherwise generate
  function generateFlagColors(countryCode) {
    var realColors = getFlagColors(countryCode);
    if (realColors) {
      return realColors;
    }
    
    // Fallback: generate colors for unknown countries
    var hash = 0;
    for (var i = 0; i < countryCode.length; i++) {
      hash = countryCode.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    var colors = [];
    for (var i = 0; i < 3; i++) {
      var hue = Math.abs((hash + i * 120) % 360);
      var saturation = 50 + (Math.abs(hash + i) % 30);
      var lightness = 55 + (Math.abs(hash + i * 2) % 25);
      colors.push('hsl(' + hue + ', ' + saturation + '%, ' + lightness + '%)');
    }
    
    return colors;
  }
  
  // Extract country code from text - fully automatic
  function extractCountryCode(text) {
    // Method 1: Look for 2-letter country codes (uppercase)
    var match = text.match(/\b([A-Z]{2})\b/);
    if (match && match[1] !== 'AM' && match[1] !== 'PM') { // Exclude time indicators
      return match[1];
    }
    
    // Method 2: Look for timezone patterns (America/Sao_Paulo → BR)
    var timezoneMatch = text.match(/america\/([a-z_]+)/i);
    if (timezoneMatch) {
      var city = timezoneMatch[1].toLowerCase();
      if (city.indexOf('sao') > -1 || city.indexOf('paulo') > -1) return 'BR';
      if (city.indexOf('new_york') > -1 || city.indexOf('chicago') > -1 || city.indexOf('los') > -1) return 'US';
      if (city.indexOf('toronto') > -1 || city.indexOf('vancouver') > -1) return 'CA';
      if (city.indexOf('mexico') > -1) return 'MX';
      if (city.indexOf('argentina') > -1 || city.indexOf('buenos') > -1) return 'AR';
    }
    
    var europeMatch = text.match(/europe\/([a-z_]+)/i);
    if (europeMatch) {
      var city = europeMatch[1].toLowerCase();
      if (city.indexOf('dublin') > -1) return 'IE';
      if (city.indexOf('rome') > -1 || city.indexOf('milan') > -1) return 'IT';
      if (city.indexOf('london') > -1) return 'GB';
      if (city.indexOf('berlin') > -1) return 'DE';
      if (city.indexOf('paris') > -1) return 'FR';
      if (city.indexOf('amsterdam') > -1) return 'NL';
      if (city.indexOf('madrid') > -1) return 'ES';
      if (city.indexOf('oslo') > -1) return 'NO';
      if (city.indexOf('stockholm') > -1) return 'SE';
      if (city.indexOf('copenhagen') > -1) return 'DK';
      if (city.indexOf('helsinki') > -1) return 'FI';
      if (city.indexOf('zurich') > -1) return 'CH';
      if (city.indexOf('vienna') > -1) return 'AT';
      if (city.indexOf('brussels') > -1) return 'BE';
      if (city.indexOf('warsaw') > -1) return 'PL';
      if (city.indexOf('moscow') > -1) return 'RU';
      if (city.indexOf('kiev') > -1 || city.indexOf('kyiv') > -1) return 'UA';
      if (city.indexOf('athens') > -1) return 'GR';
      if (city.indexOf('lisbon') > -1) return 'PT';
      if (city.indexOf('bucharest') > -1) return 'RO';
      if (city.indexOf('belgrade') > -1) return 'RS';
    }
    
    var asiaMatch = text.match(/asia\/([a-z_]+)/i);
    if (asiaMatch) {
      var city = asiaMatch[1].toLowerCase();
      if (city.indexOf('tokyo') > -1) return 'JP';
      if (city.indexOf('beijing') > -1 || city.indexOf('shanghai') > -1) return 'CN';
      if (city.indexOf('seoul') > -1) return 'KR';
      if (city.indexOf('mumbai') > -1 || city.indexOf('delhi') > -1 || city.indexOf('kolkata') > -1) return 'IN';
      if (city.indexOf('istanbul') > -1) return 'TR';
      if (city.indexOf('tehran') > -1) return 'IR';
    }
    
    var australiaMatch = text.match(/australia\/([a-z_]+)/i);
    if (australiaMatch) {
      var city = australiaMatch[1].toLowerCase();
      if (city.indexOf('sydney') > -1 || city.indexOf('melbourne') > -1 || city.indexOf('perth') > -1) return 'AU';
    }
    
    // Method 3: Fallback patterns for common words
    if (text.indexOf('brazil') > -1 || text.indexOf('brasil') > -1) return 'BR';
    if (text.indexOf('australia') > -1) return 'AU';
    if (text.indexOf('ireland') > -1) return 'IE';
    if (text.indexOf('italy') > -1) return 'IT';
    if (text.indexOf('america') > -1 || text.indexOf('united states') > -1) return 'US';
    if (text.indexOf('britain') > -1 || text.indexOf('united kingdom') > -1) return 'GB';
    if (text.indexOf('germany') > -1) return 'DE';
    if (text.indexOf('france') > -1) return 'FR';
    if (text.indexOf('canada') > -1) return 'CA';
    if (text.indexOf('romania') > -1) return 'RO';
    if (text.indexOf('serbia') > -1) return 'RS';
    
    return null;
  }
  
  function detectCountry() {
    var locationEl = document.getElementById('location_text');
    var timezoneEl = document.getElementById('timezone_text');
    var statusCard = document.querySelector('.status-card');
    
    if (!locationEl || !timezoneEl || !statusCard) return;
    
    try {
      chrome.storage.local.get(['ip_country'], function(data) {
        var countryCode = (data && data.ip_country) ? String(data.ip_country).toUpperCase() : null;
        if (!countryCode) {
          var locationText = (locationEl.textContent || '').toLowerCase();
          var timezoneText = (timezoneEl.textContent || '').toLowerCase();
          countryCode = extractCountryCode(locationText + ' ' + timezoneText);
        }
        if (countryCode) {
          var colors = generateFlagColors(countryCode);
          var gradient = 'linear-gradient(135deg, ' + colors[0] + ' 0%, ' + colors[1] + ' 50%, ' + colors[2] + ' 100%)';
          statusCard.setAttribute('data-country', countryCode);
          statusCard.style.setProperty('--flag-gradient', gradient);
        } else {
          statusCard.removeAttribute('data-country');
          statusCard.style.removeProperty('--flag-gradient');
        }
      });
    } catch (_) {}
  }
  
  // Run detection multiple times
  setTimeout(detectCountry, 100);
  setTimeout(detectCountry, 500);
  setTimeout(detectCountry, 1000);
  setTimeout(detectCountry, 2000);
  setTimeout(detectCountry, 5000);
  
  // Watch for changes
  var locationEl = document.getElementById('location_text');
  var timezoneEl = document.getElementById('timezone_text');
  
  if (locationEl && window.MutationObserver) {
    var observer = new MutationObserver(detectCountry);
    observer.observe(locationEl, { childList: true, subtree: true, characterData: true });
  }
  
  if (timezoneEl && window.MutationObserver) {
    var observer2 = new MutationObserver(detectCountry);
    observer2.observe(timezoneEl, { childList: true, subtree: true, characterData: true });
  }
});