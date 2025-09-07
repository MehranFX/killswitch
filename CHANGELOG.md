## 2.1 (Minor)
- Respect system/direct proxy strictly: clear PAC when mode is `system` or `direct`.
- Do not override existing system PAC unless blocking domains exist (sinkhole only).
- IP detection stabilized via multi-probe fetch (no tab-based reads).
- Added diagnostic snapshot `debugProxy` and improved proxy logs.

# Kill Switch Enhanced - Changelog

## Version 2.0 - Enhanced Edition

### 🚀 Major Improvements

#### Security Enhancements
- ✅ **Input Validation**: Added comprehensive validation for URLs, domains, and IP addresses
- ✅ **XSS Protection**: Implemented input sanitization and HTML escaping
- ✅ **Error Handling**: Added robust error handling and logging system
- ✅ **CSP Support**: Added Content Security Policy for enhanced security

#### Code Quality Improvements
- ✅ **Modern JavaScript**: Converted to ES6+ with classes and async/await
- ✅ **Modular Architecture**: Separated concerns into utility classes
- ✅ **Type Safety**: Added JSDoc comments for better code documentation
- ✅ **Error Recovery**: Implemented graceful error handling throughout

#### Privacy Enhancements
- ✅ **Multiple IP Services**: Added fallback IP services for better reliability
- ✅ **IP Caching**: Implemented 5-minute IP caching to reduce external requests
- ✅ **Service Redundancy**: Added 4 different IP services as fallbacks

#### User Experience Improvements
- ✅ **Loading States**: Added visual feedback during operations
- ✅ **Success/Error Messages**: Clear user feedback for all operations
- ✅ **Enhanced UI**: Improved styling with animations and hover effects
- ✅ **Better Validation**: Real-time input validation with helpful messages

#### Technical Upgrades
- ✅ **Manifest V3**: Upgraded to Chrome Extension Manifest V3
- ✅ **Modern APIs**: Updated to use new Chrome Extension APIs
- ✅ **Performance**: Optimized for better performance and responsiveness

### 🔧 Technical Changes

#### New Files
- `js/utils.js` - Utility functions for validation, security, and common operations
- `CHANGELOG.md` - This changelog file

#### Modified Files
- `background.js` - Complete rewrite with modern architecture
- `popup.js` - Enhanced with better error handling and UX
- `options.js` - Improved validation and user interface
- `settings.js` - Refactored with new utility classes
- `manifest.json` - Upgraded to Manifest V3
- `css/popup.css` - Enhanced styling with animations
- `css/options.css` - Improved UI with better visual feedback

#### Key Features Added
1. **ValidationUtils Class**: Comprehensive input validation
2. **SecurityUtils Class**: XSS protection and input sanitization
3. **IPUtils Class**: Multiple IP services with caching
4. **ErrorHandler Class**: Centralized error handling and logging
5. **URLUtils Class**: Enhanced URL processing
6. **BackgroundManager Class**: Modern background script architecture
7. **PopupManager Class**: Enhanced popup functionality
8. **OptionsManager Class**: Improved options page management
9. **SettingsManager Class**: Better settings management

### 🛡️ Security Improvements

- **Input Sanitization**: All user inputs are now sanitized to prevent XSS
- **Validation**: Comprehensive validation for all inputs
- **Error Logging**: Secure error logging without exposing sensitive data
- **CSP Headers**: Content Security Policy implementation

### 🎨 UI/UX Improvements

- **Loading Indicators**: Visual feedback during operations
- **Message System**: Success, error, and info messages
- **Hover Effects**: Interactive button and link animations
- **Better Typography**: Improved font usage and spacing
- **Responsive Design**: Better layout for different screen sizes

### 🔄 Migration Notes

#### For Users
- All existing settings will be preserved
- No action required for existing users
- Enhanced security and performance out of the box

#### For Developers
- Code is now modular and well-documented
- Easy to extend with new features
- Better error handling and debugging
- Modern JavaScript patterns throughout

### 🐛 Bug Fixes

- Fixed IP validation issues
- Improved error handling for network failures
- Better handling of invalid inputs
- Fixed UI responsiveness issues
- Resolved memory leaks in background script

### 📈 Performance Improvements

- Reduced external API calls with IP caching
- Optimized DOM manipulation
- Better memory management
- Faster page load times
- Improved extension startup time

### 🔮 Future Roadmap

- [ ] Add support for IPv6 addresses
- [ ] Implement rule import/export functionality
- [ ] Add bulk rule management
- [ ] Implement rule templates
- [ ] Add statistics and analytics
- [ ] Support for custom IP services
- [ ] Dark mode theme
- [ ] Multi-language support

---

**Note**: This is a major version upgrade with significant improvements in security, performance, and user experience. All existing functionality has been preserved while adding many new features and improvements.
