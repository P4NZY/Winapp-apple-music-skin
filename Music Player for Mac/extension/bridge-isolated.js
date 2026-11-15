// Music Player for Mac - bridge, extension side.
//
// Carries out what the skin asks of the window it is in:
//   compact|1|<w>|<h>   make the window's inside w x h (the compact player,
//                       when it is not floating in a window of its own)
//   compact|0           put the window back the way it was
//   focus|1             bring this tab and its window to the front
//   tap|1               the visualizer wants to hear the music (asked again
//                       and again while it does; see background.js)
//   theme|<dark>|<RRGGBB>|...   title bar colour, where the browser uses it
// and hands the skin what comes back:
//   pcm|<base64>        a stretch of the sound
//   tapstate|<state>    on | off | click | busy | failed|<why>
// Everything else (keep on top the Windows way, the log) needs the Windows
// app and is ignored here.
(function () {
  'use strict';
  if (window.top !== window) return;
  // opened again by the Music Player app in the Dock (see background.js): the
  // mark is not part of the page's address
  if (location.hash === '#mp-show') {
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
  }
  var before = null;          // the window as it was before going compact
  var port = null;            // to background.js, for the sound
  var askAt = 0;

  function noop() {}
  function toExtension(o) {
    try {
      var p = chrome.runtime.sendMessage(o);
      if (p && typeof p.catch === 'function') p.catch(noop);
    } catch (e) {}            // (the extension was reloaded: this page has to be reloaded too)
  }
  function resize(o) { toExtension(Object.assign({ kind: 'resize' }, o)); }
  function toPage(text) { window.postMessage({ __mpFromHost: text }, location.origin); }

  function link() {
    if (port) return port;
    try { port = chrome.runtime.connect({ name: 'mp-page' }); } catch (e) { port = null; return null; }
    port.onMessage.addListener(function (m) {
      if (!m) return;
      if (m.kind === 'pcm' && typeof m.b64 === 'string') toPage('pcm|' + m.b64);
      else if (m.kind === 'tapstate' && typeof m.s === 'string') toPage('tapstate|' + m.s);
    });
    port.onDisconnect.addListener(function () { port = null; });
    return port;
  }

  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || typeof e.data.__mpToHost !== 'string') return;
    var p = e.data.__mpToHost.split('|');
    if (p[0] === 'compact') {
      if (p[1] === '1' && p.length >= 4) {
        var w = +p[2], h = +p[3];
        if (!(w > 0 && h > 0)) return;
        if (!before) before = { left: window.screenX, top: window.screenY, width: window.outerWidth, height: window.outerHeight };
        // the window's frame (title bar, edges) comes on top of the inside
        resize({ width: w + (window.outerWidth - window.innerWidth), height: h + (window.outerHeight - window.innerHeight) });
      } else if (p[1] === '0' && before) {
        resize(before);
        before = null;
      }
    } else if (p[0] === 'tap') {
      if (p[1] !== '1') { askAt = 0; return; }
      var now = Date.now();
      if (now - askAt < 900) return;          // (the skin asks every 400 ms; once a second is plenty)
      askAt = now;
      var pt = link();
      if (pt) { try { pt.postMessage({ kind: 'tap', on: true }); } catch (x) { port = null; } }
    } else if (p[0] === 'focus') {
      toExtension({ kind: 'focus' });
    } else if (p[0] === 'theme' && /^[0-9a-fA-F]{6}$/.test(p[2] || '')) {
      var colour = '#' + p[2];
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      if (!metas.length && document.head) {
        var m = document.createElement('meta');
        m.name = 'theme-color';
        document.head.appendChild(m);
        metas = [m];
      }
      for (var i = 0; i < metas.length; i++) metas[i].content = colour;
    }
  });
})();
