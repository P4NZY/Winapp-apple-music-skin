// Music Player for Mac - bridge, page side.
//
// The skin (skin.js) runs inside Apple's page, where it can reach Apple's
// player. On Windows it talks to MusicPlayer.exe; here it talks to this
// bridge instead, which passes its "verb|arg" messages on to the extension's
// own side (bridge-isolated.js) and hands back anything that comes the other
// way. Runs before skin.js.
(function () {
  'use strict';
  if (window.top !== window || window.__mpBridge) return;
  var listeners = [];
  window.__mpBridge = {
    postMessage: function (msg) {
      window.postMessage({ __mpToHost: String(msg) }, location.origin);
    },
    addEventListener: function (type, fn) {
      if (type === 'message' && typeof fn === 'function') listeners.push(fn);
    }
  };
  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || typeof e.data.__mpFromHost !== 'string') return;
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i]({ data: e.data.__mpFromHost }); } catch (x) {}
    }
  });
})();
