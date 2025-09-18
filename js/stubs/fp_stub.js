// Minimal UMD-style stub for FingerprintJS/fp.umd.js to avoid page crashes
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FingerprintJS = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  function createAgent() {
    return {
      get: function () {
        return Promise.resolve({ visitorId: '00000000000000000000000000000000', confidence: { score: 0 } });
      }
    };
  }
  return { load: function () { return Promise.resolve(createAgent()); } };
}));


