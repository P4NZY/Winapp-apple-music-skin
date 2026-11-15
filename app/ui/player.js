// ============================================================================
// Music Player skin - logic
// Injected into music.apple.com by MusicPlayer.exe, which wraps this file in a
// function and defines:  __MP_CSS  (player.css as text)
//                        __MP_ICON (the app icon as a data: URL, or "")
//
// The app has three faces (data-mp-mode on <html>):
//   full     our own player: deck across the top, library on the left, a
//            browser for playlists / songs / albums / artists / search in the
//            middle, and a column of panels on the right
//   compact  the small player: deck + the same panels stacked under it
//   apple    Apple's own pages (browse, radio, sign-in, account), dressed in
//            the same chassis
// The panels can each be switched on and off (keys VIS / LYR / PL on the deck):
//   visualizer  effects drawn with WebGL that move with the music
//   lyrics      Apple's lyrics for the current song, following along
//   queue       what plays next
//
// Apple's page keeps running underneath in every face: its MusicKit instance
// is what fetches the library and plays the music. This file only draws the
// interface and tells that instance what to do.
//
// The page cannot hear the music itself (the songs are copy-protected and are
// decoded outside it), so the app listens to its own sound output and passes
// it in: see "Sound" below and src\AudioTap.cs.
//
// Edit and restart the app to change behaviour. No rebuild needed.
// ============================================================================

if (window.top !== window || location.hostname !== 'music.apple.com' || window.__mpLoaded) return;
window.__mpLoaded = true;

// ---------------------------------------------------------------- themes ----
// shellA / shellB : chassis colour, top and bottom of its gradient
// shellText       : labels printed on the chassis
// lit             : lamps, lit buttons, slider fill
// lcdBg / lcdFg   : display background and ink
var THEMES = [
  { id: 'midnight',  name: 'Midnight',  jp: '真夜中',     shellA: '#263145', shellB: '#141a27', shellText: '#cfdaec', lit: '#5aa9ff', lcdBg: '#050a12', lcdFg: '#7cc4ff' },
  { id: 'classic',   name: 'Classic',   jp: 'クラシック', shellA: '#4b5066', shellB: '#2a2d3d', shellText: '#dde1ee', lit: '#f5b301', lcdBg: '#020403', lcdFg: '#27e06f' },
  { id: 'graphite',  name: 'Graphite',  jp: '黒鉛',       shellA: '#3c3c40', shellB: '#222224', shellText: '#dcdcde', lit: '#ededf0', lcdBg: '#0a0a0a', lcdFg: '#e9e9ea' },
  { id: 'indigo',    name: 'Indigo',    jp: '藍',         shellA: '#2b4a7a', shellB: '#172c4d', shellText: '#e3ecf9', lit: '#ffd27a', lcdBg: '#060d1a', lcdFg: '#9cc3ff' },
  { id: 'synthwave', name: 'Synthwave', jp: 'シンセ',     shellA: '#3d2c7c', shellB: '#1f1547', shellText: '#e6deff', lit: '#ff4fd8', lcdBg: '#0a0420', lcdFg: '#35f2ff' },
  { id: 'sunset',    name: 'Sunset',    jp: '夕焼け',     shellA: '#4d2c48', shellB: '#2a1730', shellText: '#f3dbe8', lit: '#ff7a59', lcdBg: '#12060f', lcdFg: '#ffb38a' },
  { id: 'forest',    name: 'Forest',    jp: '森',         shellA: '#2d4337', shellB: '#18261e', shellText: '#d5e8dc', lit: '#5ddc8b', lcdBg: '#040b07', lcdFg: '#86f0a8' },
  { id: 'matcha',    name: 'Matcha',    jp: '抹茶',       shellA: '#7f9c5c', shellB: '#566f3c', shellText: '#f6f9ea', lit: '#fff3b0', lcdBg: '#111a0b', lcdFg: '#cfe89a' },
  { id: 'crimson',   name: 'Crimson',   jp: '紅',         shellA: '#5c212c', shellB: '#2e1016', shellText: '#f5d9dd', lit: '#ff5263', lcdBg: '#0d0304', lcdFg: '#ff8d97' },
  { id: 'tomato',    name: 'Tomato',    jp: 'トマト',     shellA: '#f25a35', shellB: '#c93414', shellText: '#fff4ea', lit: '#ffe08a', lcdBg: '#3a0d05', lcdFg: '#ffd66b' },
  { id: 'paper',     name: 'Paper',     jp: '和紙',       shellA: '#ebe7dd', shellB: '#cfc9bb', shellText: '#2b2b2b', lit: '#2f5bd8', lcdBg: '#1b2230', lcdFg: '#a9c6ff' },
  { id: 'sakura',    name: 'Sakura',    jp: '桜',         shellA: '#ffc4d6', shellB: '#f29bb6', shellText: '#5a1930', lit: '#b3124d', lcdBg: '#3a1020', lcdFg: '#ffc4d6' },
  // after singers: teal hair and a pink tie / red drills on grey / Ado's blue with a red rose
  { id: 'miku',      name: 'Miku',      jp: 'ミク',       shellA: '#237a75', shellB: '#134f4c', shellText: '#e9fcfa', lit: '#ff4fa3', lcdBg: '#03151a', lcdFg: '#5fe8dc' },
  { id: 'teto',      name: 'Teto',      jp: 'テト',       shellA: '#c42a46', shellB: '#86132c', shellText: '#fff0f2', lit: '#ffe1e7', lcdBg: '#1b0508', lcdFg: '#ff8fa3' },
  { id: 'ado',       name: 'Ado',       jp: 'アド',       shellA: '#24327f', shellB: '#0d1238', shellText: '#e4e9ff', lit: '#ff3f6c', lcdBg: '#050822', lcdFg: '#7aa2ff' },
  { id: 'neon',      name: 'Neon Tokyo', jp: 'ネオン',    shellA: '#22222d', shellB: '#0c0c12', shellText: '#e8e8f6', lit: '#ff2bd6', lcdBg: '#05030c', lcdFg: '#2cf6ff' },
  { id: 'fuji',      name: 'Wisteria',  jp: '藤',         shellA: '#7a6aae', shellB: '#4f4282', shellText: '#f7f3ff', lit: '#fff0a8', lcdBg: '#120c24', lcdFg: '#cdb8ff' },
  { id: 'kin',       name: 'Gold',      jp: '金',         shellA: '#5d4c22', shellB: '#2e2410', shellText: '#f6e8c3', lit: '#ffcf4a', lcdBg: '#0d0a03', lcdFg: '#ffd772' }
];

// Japanese readings shown beside Apple's sidebar entries (matched by label).
var JP_NAV = {
  'Search': '検索', 'Home': 'ホーム', 'New': '新着', 'Radio': 'ラジオ',
  'Recently Added': '最近追加', 'Artists': 'アーティスト', 'Albums': 'アルバム', 'Songs': '曲',
  'Music Videos': 'ビデオ', 'Videos': 'ビデオ', 'Made for You': 'おすすめ', 'Made For You': 'おすすめ',
  'All Playlists': 'プレイリスト', 'Playlists': 'プレイリスト', 'Favorite Songs': 'お気に入り',
  'Library': 'ライブラリ', 'Replay': 'リプレイ'
};
// Status words on the deck's display.
var JP_STATE = { play: '再生中', pause: '一時停止', stop: '停止', load: '読込中' };

// Compact window size in CSS pixels (the app scales it for the display).
var COMPACT_W = 500;
var COMPACT_H = 680;     // with the queue as the only panel
var CP_VIZ = 230, CP_LYR = 210, CP_PL = 250;   // panel heights when more than one is open
var ROW_H = 34;          // browser row height, must match .mpr in player.css
var QUEUE_CHUNK = 200;   // most songs handed to the player at once from a long list

// --------------------------------------------------------------- helpers ----
// What the page talks to: the Windows app (MusicPlayer.exe, through WebView2),
// or on a Mac the browser extension's bridge (Music Player for Mac\extension).
// Both take the same "verb|arg" messages; whatever one cannot do, it ignores.
var host = (window.chrome && window.chrome.webview) ? window.chrome.webview : (window.__mpBridge || null);
var HOST_KIND = (window.chrome && window.chrome.webview) ? 'windows' : window.__mpBridge ? 'mac' : 'none';
function send(msg) { try { if (host) host.postMessage(msg); } catch (e) {} }

// The app keeps a small log of what happened (player.log beside its settings):
// starts, failures, what the player and the sound feed were doing. It is what
// gets read when something "sometimes does not work". No more than a few
// lines a second, and it stops for the session after 3000 lines.
var LOG = { n: 0, burst: 0, at: 0 };
function dlog(text) {
  var now = Date.now();
  if (now - LOG.at > 1000) { LOG.at = now; LOG.burst = 0; }
  if (++LOG.burst > 8 || ++LOG.n > 3000) return;
  send('log|' + String(text).replace(/[\r\n]+/g, ' ').slice(0, 380));
}

var store = {
  get: function (k, d) {
    try { var v = localStorage.getItem('mp.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
  },
  set: function (k, v) { try { localStorage.setItem('mp.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del: function (k) { try { localStorage.removeItem('mp.' + k); } catch (e) {} }
};

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function fmt(sec) {                       // 3:07 / 1:02:09
  sec = Math.max(0, Math.round(sec || 0));
  var hrs = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return hrs ? hrs + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
}
function clock(sec) {                     // 03:07 for the big display
  sec = Math.max(0, Math.floor(sec || 0));
  return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60);
}
function hexToRgb(hex) {
  var n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {                   // t = share of colour a
  var x = hexToRgb(a), y = hexToRgb(b);
  return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(x[i] * t + y[i] * (1 - t)); }).join(',') + ')';
}
function isDark(hex) {
  var c = hexToRgb(hex);
  return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 < 140;
}
function errText(e) {
  if (!e) return 'unknown error';
  return String(e.description || e.message || e.errorCode || e).slice(0, 120);
}

// Elements are built node by node (no innerHTML), so nothing from a song title
// or the page can ever be parsed as markup.
function h(tag, attrs) {
  var el = document.createElement(tag), k, i;
  if (attrs) {
    for (k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (i = 2; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
  return el;
}
function jp(text, cls) { return h('span', { class: 'mp-jp' + (cls ? ' ' + cls : ''), lang: 'ja', text: text }); }

var SVG_NS = 'http://www.w3.org/2000/svg';
function svg(d, cls) {
  var s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  if (cls) s.setAttribute('class', cls);
  var p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', d);
  p.setAttribute('fill-rule', 'evenodd');
  s.appendChild(p);
  return s;
}
var I = {
  prev:    'M5 5h2.5v14H5zM20 5v14L9 12z',
  play:    'M7 4.5v15l13-7.5z',
  pause:   'M6 5h4.5v14H6zM13.5 5H18v14h-4.5z',
  stop:    'M6 6h12v12H6z',
  next:    'M16.5 5H19v14h-2.5zM4 5v14l11-7z',
  theme:   'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zm0 2a7 7 0 0 1 0 14z',
  pin:     'M9 3h6v2l-1 1v5l3 3v2h-4.2v5h-1.6v-5H7v-2l3-3V6L9 5z',
  mini:    'M3 5h18v14H3zm2 2v10h14V7zm6 5h6v3.5h-6z',
  full:    'M3 4h18v16H3zm2 2v3h14V6zm0 5v7h4v-7zm6 0v7h8v-7z',
  speaker: 'M4 9v6h4l5 4V5L8 9zM15.5 8.5a4.5 4.5 0 0 1 0 7z',
  chevron: 'M5.5 8.6L12 15.1l6.5-6.5 1.4 1.4-7.9 7.9-7.9-7.9z',
  close:   'M6.4 5L12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z',
  back:    'M14.6 5.4L8 12l6.6 6.6 1.5-1.5L11 12l5.1-5.1z',
  go:      'M9.4 5.4L16 12l-6.6 6.6-1.5-1.5L13 12 7.9 6.9z',
  search:  'M10.5 4a6.5 6.5 0 1 0 4 11.6l4.4 4.4 1.5-1.5-4.4-4.4A6.5 6.5 0 0 0 10.5 4zm0 2.2a4.3 4.3 0 1 1 0 8.6a4.3 4.3 0 0 1 0-8.6z',
  note:    'M9 4v10.6A3.5 3.5 0 1 0 11 18V8h7V4z',
  disc:    'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zm0 6.2a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 0 1 0-5.6z',
  person:  'M12 4a4 4 0 1 1 0 8a4 4 0 0 1 0-8zM4 20c0-3.6 3.6-6 8-6s8 2.4 8 6z',
  recent:  'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zm-1 4h2v4.6l3.4 2-1 1.7L11 12.7z',
  list:    'M4 6h16v2H4zM4 11h16v2H4zM4 16h10v2H4z',
  shuffle: 'M3 7h4l8 10h3v-2l3.5 3-3.5 3v-2h-4L6 9H3zM18 7h-3l-1.6 2-1.3-1.6L14 5h4V3l3.5 3L18 9zM3 17h3l1.6-2 1.3 1.6L7 19H3z',
  expand:  'M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z',
  grid:    'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  plus:    'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  check:   'M9.6 16.3L5.2 11.9 3.8 13.3l5.8 5.8L20.4 8.3 19 6.9z',
  more:    'M5 10.4a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 0 0 0-3.2zm7 0a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 0 0 0-3.2zm7 0a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 0 0 0-3.2z'
};

// ----------------------------------------------------------------- state ----
var S = {
  theme: store.get('theme', 'midnight'),
  autoCompact: store.get('autoCompact', false),  // go compact when music starts
  // compact player stays above every other window (on unless switched off;
  // a new name for the setting, so it starts on also where the old one was off)
  onTop: store.get('compactOnTop', true),
  showPl: store.get('showPl', true),             // panel: queue
  showViz: store.get('showViz', true),           // panel: visualizer
  showLyr: store.get('showLyr', true),           // panel: lyrics
  vizBig: false,                                 // visualizer fills the whole window
  remaining: store.get('remaining', false),      // clock shows time remaining
  mode: 'full',         // full | compact | apple
  panelOpen: false,
  music: null,          // the page's MusicKit instance
  state: 'stop',        // play | pause | stop | load   (what the display shows)
  stable: 'idle',       // playing | paused | idle      (ignores loading blips)
  pendingAuto: false,
  seen: true,                    // false while the window is minimised or covered (the app says so)
  startTok: 0,                   // counts requests to start playing; the newest one waiting wins
  starting: Promise.resolve(),   // the start being carried out (they run one after another)
  haltAt: 0,                     // when Stop or Pause was last pressed
  shuffleHeld: false,            // shuffle is on for the listener but switched off for a moment (see startNow)
  queueChangedAt: -1e9,
  dragSeek: null,       // 0..1 while the seek knob is being dragged
  marquee: null,
  notice: 0             // timer for a temporary message on the song line
};
var ui = {};
var sheet = null;

function themeNow() {
  for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === S.theme) return THEMES[i];
  return THEMES[0];
}
function deckShown() { return S.mode !== 'apple'; }

// ---------------------------------------------------------------- styles ----
function themeCss() {
  return THEMES.map(function (t) {
    return 'html[data-mp-theme="' + t.id + '"]{' +
      '--mp-shell-a:' + t.shellA + ';--mp-shell-b:' + t.shellB + ';--mp-shell-text:' + t.shellText + ';' +
      '--mp-lit:' + t.lit + ';' +
      '--mp-lcd-bg:' + t.lcdBg + ';--mp-lcd-bg-rgb:' + hexToRgb(t.lcdBg).join(',') + ';' +
      '--mp-lcd-fg:' + t.lcdFg + ';--mp-lcd-fg-rgb:' + hexToRgb(t.lcdFg).join(',') + ';}';
  }).join('\n');
}

function installCss() {
  var css = themeCss() + '\n' + __MP_CSS;
  try {
    if (!sheet) { sheet = new CSSStyleSheet(); sheet.replaceSync(css); }
    if (document.adoptedStyleSheets.indexOf(sheet) < 0)
      document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
    return;
  } catch (e) {}
  if (!document.getElementById('mp-style')) {
    var st = document.createElement('style');
    st.id = 'mp-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
}

function applyTheme() {
  var root = document.documentElement;
  if (!root) return;
  var t = themeNow();
  if (root.getAttribute('data-mp-theme') !== t.id) root.setAttribute('data-mp-theme', t.id);
  if (root.getAttribute('data-mp-mode') !== S.mode) root.setAttribute('data-mp-mode', S.mode);
  if (root.getAttribute('data-mp-host') !== HOST_KIND) root.setAttribute('data-mp-host', HOST_KIND);
}

// Tell the app window how to paint its title bar. The displays are dark in
// every theme, so the page always runs in dark mode; the title bar takes the
// chassis colour.
//   theme|<page dark 0/1>|<caption RRGGBB>|<caption text RRGGBB>|<caption is dark 0/1>
function notifyHost() {
  var t = themeNow();
  var msg = 'theme|1|' + t.shellA.slice(1) + '|' + t.shellText.slice(1) + '|' + (isDark(t.shellA) ? 1 : 0);
  if (msg === notifyHost.last) return;
  notifyHost.last = msg;
  send(msg);
}

function setTheme(id) {
  S.theme = id;
  store.set('theme', id);
  applyTheme();
  notifyHost();
  syncPanel();
  vizColors();
  vzColors();
  kickViz();
}

// ------------------------------------------------------ playback (MusicKit) --
function MK() { return window.MusicKit || null; }

function stateName() {
  var m = S.music, mk = MK();
  if (!m || !mk || !mk.PlaybackStates) return 'none';
  return mk.PlaybackStates[m.playbackState] || 'none';
}
function authorized() {
  try { return !!(S.music && S.music.isAuthorized); } catch (e) { return false; }
}

function call(name) {
  var m = S.music;
  if (!m || typeof m[name] !== 'function') return;
  try {
    var r = m[name].apply(m, Array.prototype.slice.call(arguments, 1));
    if (r && typeof r.catch === 'function') r.catch(function () {});
  } catch (e) {}
}

function curIndex() {
  var m = S.music;
  if (!m) return -1;
  try {
    if (typeof m.nowPlayingItemIndex === 'number' && m.nowPlayingItemIndex >= 0) return m.nowPlayingItemIndex;
    if (m.queue && typeof m.queue.position === 'number') return m.queue.position;
  } catch (e) {}
  return -1;
}

function queueItems() {
  try { return (S.music && S.music.queue && S.music.queue.items) || []; } catch (e) { return []; }
}

function itemInfo(it) {
  var o = { title: 'Unknown', artist: '', album: '', dur: 0, art: '', id: '', cid: '' };
  if (!it) return o;
  try { o.title = it.title || (it.attributes && it.attributes.name) || 'Unknown'; } catch (e) {}
  try { o.artist = it.artistName || ''; } catch (e) {}
  try { o.album = it.albumName || ''; } catch (e) {}
  try { o.dur = (it.playbackDuration || 0) / 1000; } catch (e) {}
  try { o.art = it.artworkURL || (it.artwork && it.artwork.url) || ''; } catch (e) {}
  try { o.id = String(it.id || ''); } catch (e) {}
  try { o.cid = String((it.attributes && it.attributes.playParams && it.attributes.playParams.catalogId) || ''); } catch (e) {}
  return o;
}

function nowItem() {
  try { return (S.music && S.music.nowPlayingItem) || null; } catch (e) { return null; }
}

// Artwork addresses come as templates with {w}x{h} in them.
function artUrl(tpl, px) {
  if (!tpl) return '';
  var s = Math.round(px * Math.min(2, window.devicePixelRatio || 1));
  return tpl.replace('{w}', s).replace('{h}', s).replace('{f}', 'jpg').replace('{c}', 'bb');
}

function hookMusic() {
  var tries = 0;
  function attempt() {
    var m = null;
    try { m = MK() && MK().getInstance && MK().getInstance(); } catch (e) {}
    if (m && typeof m.addEventListener === 'function') { bindMusic(m); return true; }
    return false;
  }
  if (!attempt()) {
    var iv = setInterval(function () { if (attempt() || ++tries > 1200) clearInterval(iv); }, 300);
  }
  document.addEventListener('musickitloaded', attempt);
  document.addEventListener('musickitconfigured', attempt);
}

function bindMusic(m) {
  if (S.music === m) return;
  S.music = m;
  function on(ev, fn) { try { m.addEventListener(ev, fn); } catch (e) {} }
  on('playbackStateDidChange', onState);
  on('nowPlayingItemDidChange', onItem);
  on('playbackTimeDidChange', refreshTime);
  on('playbackTimeDidChange', clockSample);   // measure the precise clock at every tick, lyrics on screen or not
  on('playbackDurationDidChange', refreshTime);
  on('queueItemsDidChange', onQueue);
  on('queuePositionDidChange', function () { refreshItem(); });
  on('playbackVolumeDidChange', refreshVolume);
  on('shuffleModeDidChange', refreshModes);
  on('repeatModeDidChange', refreshModes);
  on('playbackBitrateDidChange', refreshChips);
  on('mediaPlaybackError', onPlaybackError);
  on('authorizationStatusDidChange', function () { setTimeout(onAuthChange, 300); });
  onState();
  refreshAll();
  onAuthChange();
}

function onQueue() {
  S.queueChangedAt = performance.now();
  clearTimeout(onQueue.t);
  onQueue.t = setTimeout(renderQueue, 80);
}

function onItem() {
  // A new track right after the queue was replaced means the listener picked
  // something to play (as opposed to the queue simply moving on by itself).
  if (performance.now() - S.queueChangedAt < 4000) S.pendingAuto = true;
  CK.have = false;      // the precise clock measures each track afresh
  CK.lastT = NaN;       // (not -1: a new song's first reading, 0, must not count as a tick)
  refreshItem();
  onState();
  lyRefresh();
  vzSongOsd();
}

function onState() {
  var name = stateName();
  var stable = S.stable;
  if (name === 'playing') stable = 'playing';
  else if (name === 'paused') stable = 'paused';
  else if (name === 'none' || name === 'stopped' || name === 'ended' || name === 'completed') stable = 'idle';

  var started = stable === 'playing' && (S.stable !== 'playing' || S.pendingAuto);
  S.stable = stable;
  if (name === 'playing') {
    S.pendingAuto = false;
    if (started && S.autoCompact && S.mode !== 'compact') setMode('compact');
  }
  refreshState();
}

// Apple shows playback failures in a dialog on its own page, which is not
// drawn in our faces - so say it here.
function onPlaybackError(e) {
  var what = errText(e);
  var hint = /LICENSE/i.test(what) ? ' - closing and reopening the app usually clears this' : '';
  dlog('playback error: ' + what);
  notice('PLAYBACK ERROR: ' + what + hint);
}

// A temporary message: on the browser's notice line and on the song line.
// good: news rather than trouble (shown for a shorter time, without the "!").
function notice(text, good) {
  if (ui.toast) {
    ui.toastText.textContent = text;
    ui.toast.setAttribute('data-kind', good ? 'ok' : 'warn');
    ui.toast.setAttribute('data-show', '1');
  }
  setMarquee((good ? '' : '! ') + text, true);
  clearTimeout(S.notice);
  S.notice = setTimeout(function () {
    S.notice = 0;
    if (ui.toast) ui.toast.setAttribute('data-show', '0');
    S.marquee = null;
    refreshItem();
  }, good ? 6000 : 9000);
}

// ----------------------------------------------------------- deck: refresh ---
function refreshState() {
  if (!ui.app) return;
  var name = stateName();
  var st = name === 'playing' ? 'play'
    : name === 'paused' ? 'pause'
    : (name === 'loading' || name === 'waiting' || name === 'stalled' || name === 'seeking') ? 'load'
    : 'stop';
  if (S.state !== st || ui.app.getAttribute('data-state') !== st) {
    S.state = st;
    ui.app.setAttribute('data-state', st);
    ui.chipState.textContent = JP_STATE[st];
    kickViz();
    vzKick();
    lyKick();
  }
}

function refreshTime() {
  if (!ui.app) return;
  var m = S.music, t = 0, d = 0, idle = true;
  if (m) {
    try { t = m.currentPlaybackTime || 0; d = m.currentPlaybackDuration || 0; idle = !m.nowPlayingItem; } catch (e) {}
  }
  if (S.dragSeek !== null) t = S.dragSeek * d;
  var text = idle ? '--:--' : (S.remaining && d ? '-' + clock(Math.max(0, d - t)) : clock(t));
  if (ui.time.textContent !== text) ui.time.textContent = text;
  if (S.dragSeek === null) setSlider(ui.seek, d ? t / d : 0);
  ui.seek.setAttribute('data-disabled', idle || !d ? '1' : '0');
  ui.seek.setAttribute('aria-valuetext', fmt(t) + ' of ' + fmt(d));
}

function refreshItem() {
  if (!ui.app) return;
  var m = S.music, it = null;
  try { it = m && m.nowPlayingItem; } catch (e) {}
  var text, info = itemInfo(it);
  if (it) {
    var idx = curIndex();
    text = (idx >= 0 ? (idx + 1) + '. ' : '') + (info.artist ? info.artist + ' - ' : '') + info.title +
           (info.dur ? ' (' + fmt(info.dur) + ')' : '');
  } else {
    text = 'Nothing playing - pick a song or a playlist from your library';
  }
  if (!S.notice || !ui.toast || ui.toast.getAttribute('data-show') !== '1') setMarquee(text);
  ui.album.textContent = it ? info.album : '';

  var art = it && info.art ? artUrl(info.art, 80) : (__MP_ICON || '');
  if (ui.art.getAttribute('src') !== art) {
    if (art) ui.art.setAttribute('src', art); else ui.art.removeAttribute('src');
  }
  ui.art.setAttribute('data-empty', it && info.art ? '0' : '1');
  ui.art.style.visibility = art ? 'visible' : 'hidden';
  if (ui.chipAdd) ui.chipAdd.hidden = !it;

  send('title|' + (it ? info.title + (info.artist ? ' - ' + info.artist : '') : ''));
  refreshChips();
  // bring the playing song into view in the queue only when it changed - not
  // every time this runs (a notice ending, say), which would undo the
  // listener's own scrolling
  var key = curKey();
  markCurrent(key !== S.itemKey);
  S.itemKey = key;
  refreshTime();
  markBrowserCurrent();
}

function refreshChips() {
  if (!ui.app) return;
  var m = S.music, kbps = '', pos = '';
  try { if (m && m.nowPlayingItem && m.bitrate) kbps = m.bitrate + ' KBPS'; } catch (e) {}
  var n = queueItems().length, idx = curIndex();
  if (n && idx >= 0) pos = 'TRACK ' + (idx + 1) + '/' + n;
  ui.chipKbps.textContent = kbps;
  ui.chipPos.textContent = pos;
}

function refreshVolume() {
  if (!ui.app || !S.music) return;
  try {
    var pos = posFromVol(S.music.volume || 0);
    setSlider(ui.vol, pos);
    ui.vol.title = 'Volume ' + Math.round(pos * 100) + '%  (scroll over it for fine steps)';
  } catch (e) {}
}

function refreshModes() {
  if (!ui.app) return;
  var m = S.music, mk = MK(), shuffle = false, repeat = 'none';
  try {
    if (m && mk) {
      // (held: switched off for a moment while a picked song starts, see startNow)
      shuffle = S.shuffleHeld || (!!mk.PlayerShuffleMode && m.shuffleMode !== mk.PlayerShuffleMode.off);
      if (mk.PlayerRepeatMode) repeat = mk.PlayerRepeatMode[m.repeatMode] || 'none';
    }
  } catch (e) {}
  ui.shuffle.setAttribute('data-on', shuffle ? '1' : '0');
  ui.shuffle.setAttribute('aria-pressed', shuffle ? 'true' : 'false');
  ui.repeat.setAttribute('data-on', repeat === 'none' ? '0' : '1');
  ui.repeat.setAttribute('aria-pressed', repeat === 'none' ? 'false' : 'true');
  ui.repeatLabel.textContent = repeat === 'one' ? 'REPEAT 1' : repeat === 'all' ? 'REPEAT ALL' : 'REPEAT';
}

function refreshAll() {
  refreshState();
  renderQueue();
  refreshItem();
  refreshVolume();
  refreshModes();
}

// The song line scrolls only when it does not fit.
function setMarquee(text, force) {
  if (!ui.marqueeIn) return;
  if (!force && S.marquee === text) return;
  S.marquee = text;
  var inner = ui.marqueeIn, first = h('span', { text: text });
  inner.classList.remove('scroll');
  inner.replaceChildren(first);
  if (!deckShown()) return;
  requestAnimationFrame(function () {
    if (S.marquee !== text || first.offsetWidth <= ui.marquee.clientWidth - 4) return;
    var gap = '   ***   ';
    inner.appendChild(h('span', { text: gap }));
    inner.appendChild(h('span', { text: text }));
    inner.appendChild(h('span', { text: gap }));
    inner.style.setProperty('--mp-dur', Math.max(9, (text.length + gap.length) * 0.24).toFixed(1) + 's');
    inner.classList.add('scroll');
  });
}

// ------------------------------------------------------------------ queue ----
function renderQueue() {
  if (!ui.app) return;
  var items = queueItems(), list = ui.list;
  if (!items.length) {
    list.replaceChildren(h('div', { class: 'mpc-empty' },
      h('div', { text: 'The queue is empty. Play a song, album or playlist from your library and it shows up here.' })));
    ui.count.textContent = '';
    ui.total.textContent = '0曲';
    refreshChips();
    return;
  }
  var keep = list.scrollTop, frag = document.createDocumentFragment(), total = 0, max = Math.min(items.length, 3000);
  for (var i = 0; i < max; i++) {
    var info = itemInfo(items[i]);
    total += info.dur;
    frag.appendChild(h('div', { class: 'mpc-row', 'data-i': String(i), role: 'option' },
      h('span', { class: 'n', text: (i + 1) + '.' }),
      h('span', { class: 't', text: (info.artist ? info.artist + ' - ' : '') + info.title }),
      h('span', { class: 'd', text: info.dur ? fmt(info.dur) : '' })));
  }
  list.replaceChildren(frag);
  ui.count.textContent = items.length + (items.length === 1 ? ' TRACK' : ' TRACKS');
  ui.total.textContent = items.length + '曲 / ' + fmt(total);     // 曲 = songs
  refreshChips();
  // a new queue, or a new song playing: show it; songs added or moved: stay
  // where the listener was looking
  var key = curKey();
  if (key !== S.queueKey) { S.queueKey = key; markCurrent(true); }
  else { list.scrollTop = keep; markCurrent(false); }
}

// which song is playing, and where in the queue
function curKey() {
  var it = nowItem();
  return it ? String(it.id) + '@' + curIndex() : '';
}

function markCurrent(scroll) {
  if (!ui.list) return;
  var idx = curIndex(), rows = ui.list.children, old = ui.list.querySelector('.mpc-row[data-cur="1"]');
  var row = idx >= 0 && rows[idx] && rows[idx].classList.contains('mpc-row') ? rows[idx] : null;
  if (old && old !== row) old.removeAttribute('data-cur');
  if (row) {
    row.setAttribute('data-cur', '1');
    if (scroll && deckShown() && S.showPl) {
      try { row.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
  }
}

function onListClick(e) {
  var row = e.target.closest && e.target.closest('.mpc-row');
  if (!row) return;
  var prev = ui.list.querySelector('.mpc-row[data-sel="1"]');
  if (prev) prev.removeAttribute('data-sel');
  row.setAttribute('data-sel', '1');
  if (e.type === 'dblclick') call('changeToMediaAtIndex', parseInt(row.getAttribute('data-i'), 10));
}

// ---------------------------------------------------------------- sliders ----
function setSlider(el, v) {
  v = clamp01(v || 0);
  el._v = v;
  el.style.setProperty('--v', v.toFixed(4));
  el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
}

function makeSlider(label, onInput, onCommit) {
  var el = h('div', {
    class: 'mp-slider', role: 'slider', tabindex: '0', 'aria-label': label,
    'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0'
  }, h('div', { class: 'mp-slider-fill' }), h('div', { class: 'mp-slider-thumb mp-key' }));
  var dragging = false;

  function ratioAt(e) {
    var r = el.getBoundingClientRect();
    var thumb = parseFloat(getComputedStyle(el).getPropertyValue('--thumb')) || 28;
    return clamp01((e.clientX - r.left - thumb / 2) / Math.max(1, r.width - thumb));
  }
  function disabled() { return el.getAttribute('data-disabled') === '1'; }

  el.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || disabled()) return;
    dragging = true;
    try { el.setPointerCapture(e.pointerId); } catch (x) {}
    var v = ratioAt(e);
    setSlider(el, v);
    onInput(v);
    e.preventDefault();
  });
  el.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var v = ratioAt(e);
    setSlider(el, v);
    onInput(v);
  });
  function end(e) {
    if (!dragging) return;
    dragging = false;
    try { el.releasePointerCapture(e.pointerId); } catch (x) {}
    if (onCommit) onCommit(el._v || 0);
  }
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  // the drag can also end without either (alt-tab in the middle of it): without
  // this the seek bar would stay stuck on the dragged position
  el.addEventListener('lostpointercapture', end);
  el.addEventListener('keydown', function (e) {
    var step = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 0.05
      : (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ? -0.05 : 0;
    if (!step || disabled()) return;
    e.preventDefault();
    e.stopPropagation();
    var v = clamp01((el._v || 0) + step);
    setSlider(el, v);
    onInput(v);
    if (onCommit) onCommit(v);
  });
  return el;
}

function seekTo(ratio) {
  var m = S.music, d = 0;
  try { d = (m && m.currentPlaybackDuration) || 0; } catch (e) {}
  if (d) call('seekToTime', Math.min(d - 0.5, Math.max(0, ratio * d)));
  // keep showing the dragged position until the player reports the new time
  setTimeout(function () { S.dragSeek = null; refreshTime(); }, 350);
}

function seekBy(seconds) {
  var m = S.music;
  if (!m) return;
  try {
    var d = m.currentPlaybackDuration || 0, t = m.currentPlaybackTime || 0;
    if (d) call('seekToTime', Math.min(d - 0.5, Math.max(0, t + seconds)));
  } catch (e) {}
}

function setVolume(v) {
  if (!S.music) return;
  try { S.music.volume = clamp01(v); } catch (e) {}
}

// The volume slider follows loudness, not signal strength: the player's volume
// is the cube of the slider position. Ears hear on a curve, so a straight
// slider is nearly full loudness from half way up and crams every quiet level
// into its first few millimetres. With the curve, half way is about a quarter
// as loud (-18 dB) and the quiet end gets most of the travel.
function volFromPos(x) { x = clamp01(x); return x * x * x; }
function posFromVol(v) { return Math.pow(clamp01(v), 1 / 3); }
function setVolumePos(x) { setVolume(volFromPos(x)); }
function nudgeVolume(d) {
  var v = 0;
  try { v = (S.music && S.music.volume) || 0; } catch (e) {}
  setVolumePos(posFromVol(v) + d);
}

// -------------------------------------------------------------- level bars ---
// The small spectrum on the clock display. It shows the same sound analysis
// the visualizer uses (see "Sound" below).
var viz = { raf: 0, n: 22, last: 0, fg: '#fff', hot: '#fff', off: '#222' };
viz.cur = new Float32Array(viz.n);
viz.peak = new Float32Array(viz.n);
viz.tgt = new Float32Array(viz.n);

function vizColors() {
  var t = themeNow();
  viz.fg = t.lcdFg;
  viz.hot = mix('#ffffff', t.lcdFg, 0.55);
  viz.off = mix(t.lcdFg, t.lcdBg, 0.13);
}

function kickViz() {
  if (!viz.raf && deckShown() && S.seen && ui.viz) viz.raf = requestAnimationFrame(vizFrame);
}

function vizFrame(now) {
  viz.raf = 0;
  var c = ui.viz, dpr = window.devicePixelRatio || 1;
  var w = Math.round(c.clientWidth * dpr), ht = Math.round(c.clientHeight * dpr);
  if (!deckShown() || !S.seen || !w || !ht) { viz.last = 0; return; }
  if (c.width !== w || c.height !== ht) { c.width = w; c.height = ht; }

  var dt = viz.last ? Math.min(64, now - viz.last) : 16;
  viz.last = now;
  var playing = S.state === 'play', n = viz.n, i;

  if (playing) auWant(now);
  auFrame(now);
  for (i = 0; i < n; i++) {
    // each bar shows the loudest point of its slice of the spectrum
    var a = 6 + Math.floor(i * 240 / n), b = 6 + Math.floor((i + 1) * 240 / n), top = 0, j;
    for (j = a; j < b; j++) if (AU.spec[j] > top) top = AU.spec[j];
    viz.tgt[i] = clamp01(top * 1.04);
  }

  var energy = 0;
  for (i = 0; i < n; i++) {
    var diff = viz.tgt[i] - viz.cur[i];
    viz.cur[i] = clamp01(viz.cur[i] + diff * Math.min(1, (diff > 0 ? 0.7 : 0.3) * dt / 16.7));
    viz.peak[i] = Math.max(viz.cur[i], viz.peak[i] - 0.00055 * dt);
    energy += viz.cur[i] + viz.peak[i];
  }

  var g = c.getContext('2d');
  g.clearRect(0, 0, w, ht);
  var gap = Math.max(1, Math.round(1.5 * dpr));
  var bw = (w - gap * (n - 1)) / n;
  var seg = Math.max(2, Math.round(3 * dpr)), segGap = Math.max(1, Math.round(dpr));
  var rows = Math.max(1, Math.floor((ht + segGap) / (seg + segGap)));
  for (i = 0; i < n; i++) {
    var x = Math.round(i * (bw + gap)), bwi = Math.max(1, Math.round(bw));
    var lit = Math.round(viz.cur[i] * rows);
    for (var r = 0; r < rows; r++) {
      g.fillStyle = r < lit ? (r >= rows * 0.72 ? viz.hot : viz.fg) : viz.off;
      g.fillRect(x, ht - (r + 1) * (seg + segGap) + segGap, bwi, seg);
    }
    if (viz.peak[i] > 0.03) {
      var pr = Math.min(rows - 1, Math.round(viz.peak[i] * rows));
      g.fillStyle = viz.hot;
      g.fillRect(x, ht - (pr + 1) * (seg + segGap) + segGap, bwi, Math.max(1, Math.round(seg / 2)));
    }
  }
  if (playing || energy > 0.02) viz.raf = requestAnimationFrame(vizFrame);
  else viz.last = 0;
}

// ============================================================================
// Sound
// What the app is playing, as numbers the displays can draw.
//
// The app (MusicPlayer.exe) listens to its own sound output and, for as long
// as the page keeps asking ("tap|1"), sends the newest stretch about 60 times
// a second:
//     pcm|<base64>   8 bytes: frames captured so far, then 1024 stereo frames
//                    of 16-bit samples (left, right, left, right ...)
// From that this section keeps the spectrum (256 points spread evenly over
// pitch), its peaks, a steady stretch of the waveform, how strong bass / mid /
// treble are, and a pulse on every beat.
//
// When no sound arrives while a song is playing (an older MusicPlayer.exe,
// Windows before 10 version 2004, volume at zero) a built-in tune stands in so
// the displays keep moving. AU.mode says which it is: live | demo | idle.
// ============================================================================
var AU = {
  rate: 44100,
  N: 2048,                       // samples per analysis
  ringL: new Float32Array(8192), ringR: new Float32Array(8192), pos: 0,
  total: -1,                     // frame counter of the last message
  lastMsg: -1e9, lastLoud: -1e9, lastWant: -1e9, playAt: 0, wasPlaying: false,
  tapState: '',                  // what the app says about its listening: on / failed|<code>
  mode: 'idle',
  force: '',                     // for tests: 'demo' plays the built-in tune regardless
  stamp: -1, lastFrame: 0,
  pre: 1, minVol: 0.01,          // undoing the volume slider (see auFrame)
  // the fixed scale: spectrum decibels shown, tilt towards the top end, and
  // the size of the waveform. Tuned on eight real songs: loud modern pop sits
  // around the middle of the bars and reaches the red top only on its peaks
  // (2-6 % of the time); quiet piano stays low.
  dbRange: 60, dbOff: 46, dbTilt: 24, waveK: 0.45,
  spec: new Float32Array(256), peak: new Float32Array(256), hold: new Float32Array(256),
  waveL: new Float32Array(512), waveR: new Float32Array(512),
  bass: 0, mid: 0, treb: 0, level: 0, beat: 0, hit: false, flow: 0, avgE: 0, lastBeat: 0,
  demoN: 0, demoRnd: 0,
  tex: new Uint8Array(512 * 4)   // what the effects read: spectrum, left wave, right wave, peaks
};
(function () {
  var N = AU.N, bits = Math.round(Math.log(N) / Math.LN2), i, b, r, x;
  AU.re = new Float32Array(N);
  AU.im = new Float32Array(N);
  AU.mag = new Float32Array(N / 2 + 1);
  AU.win = new Float32Array(N);
  AU.cos = new Float32Array(N / 2);
  AU.sin = new Float32Array(N / 2);
  AU.rev = new Uint16Array(N);
  for (i = 0; i < N; i++) {
    AU.win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    for (r = 0, x = i, b = 0; b < bits; b++) { r = (r << 1) | (x & 1); x >>= 1; }
    AU.rev[i] = r;
  }
  for (i = 0; i < N / 2; i++) { AU.cos[i] = Math.cos(2 * Math.PI * i / N); AU.sin[i] = Math.sin(2 * Math.PI * i / N); }
  // where each of the 256 spectrum points sits in the analysis: 35 Hz ... 16 kHz
  AU.binAt = new Float32Array(257);
  for (i = 0; i <= 256; i++) AU.binAt[i] = 35 * Math.pow(16000 / 35, i / 256) / (AU.rate / N);
})();

// Ask the app for sound. Called from whatever is drawing; the app stops
// listening by itself a few seconds after the asking stops.
function auWant(now) {
  if (now - AU.lastWant < 400) return;
  AU.lastWant = now;
  send('tap|1');
}

function onHostMessage(e) {
  var d = e && e.data;
  if (typeof d !== 'string') return;
  if (d.lastIndexOf('pcm|', 0) === 0) auPcm(d);
  else if (d.lastIndexOf('seen|', 0) === 0) setSeen(d.charAt(5) !== '0');
  else if (d.lastIndexOf('tapstate|', 0) === 0) {
    AU.tapState = d.slice(9, 60);
    if (AU.tapState.lastIndexOf('failed', 0) === 0) dlog('sound capture ' + AU.tapState);
    vzStatus();
  }
}

// The window went out of sight (minimised, covered by a game) or came back.
// Out of sight, nothing moves: the visualizer, the level bars, the lyrics and
// the CSS animations stop, and with them the sound capture. The music plays on.
function setSeen(on) {
  if (S.seen === on) return;
  S.seen = on;
  document.documentElement.setAttribute('data-mp-seen', on ? '1' : '0');
  if (!on) return;
  VZ.last = 0;
  AU.playAt = performance.now();      // the sound capture needs a moment to start again: no stand-in tune meanwhile
  kickViz();
  vzKick();
  lyKick();
  if (deckShown()) setMarquee(S.marquee, true);
}

function auPcm(d) {
  var bin;
  try { bin = atob(d.slice(4)); } catch (e) { return; }
  var n = (bin.length - 8) >> 2, i;
  if (n <= 0 || n > 4096) return;
  var total = 0;
  for (i = 5; i >= 0; i--) total = total * 256 + bin.charCodeAt(i);
  var fresh = (AU.total < 0 || total < AU.total || total - AU.total > n) ? n : total - AU.total;
  var now = performance.now();
  AU.total = total;
  AU.lastMsg = now;

  var L = AU.ringL, R = AU.ringR, mask = L.length - 1, pos = AU.pos, o = 8 + (n - fresh) * 4, l, r, peak = 0;
  // the built-in tune is playing: only real sound may take the stage back
  var keep = AU.mode !== 'demo';
  if (!keep) {
    for (i = 8; i < bin.length; i += 30) { l = bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8); if (l > 32767) l = 65536 - l; if (l > peak) peak = l; }   // (30 bytes: alternates left and right)
    keep = peak > 4;
    peak = 0;
  }
  if (!keep) return;
  for (i = 0; i < fresh; i++, o += 4) {
    l = bin.charCodeAt(o) | (bin.charCodeAt(o + 1) << 8); if (l > 32767) l -= 65536;
    r = bin.charCodeAt(o + 2) | (bin.charCodeAt(o + 3) << 8); if (r > 32767) r -= 65536;
    if (l > peak) peak = l; else if (-l > peak) peak = -l;
    if (r > peak) peak = r; else if (-r > peak) peak = -r;
    L[pos] = l / 32768;
    R[pos] = r / 32768;
    pos = (pos + 1) & mask;
  }
  AU.pos = pos;
  if (peak > 4) AU.lastLoud = now;
}

// The stand-in tune: kick, bass, a chord, a hopping note, snare and hi-hat, so
// that spectrum, waveform and beat all have something believable to show.
function auDemo(n) {
  var L = AU.ringL, R = AU.ringR, mask = L.length - 1, pos = AU.pos, k = AU.demoN, rate = AU.rate, i;
  var spb = 60 / 122, TAU = 6.283185307, roots = [55, 55, 65.41, 49], hops = [8, 10, 12, 16, 12, 10];
  for (i = 0; i < n; i++, k++) {
    var t = k / rate, beat = t / spb, bi = Math.floor(beat), bt = (beat - bi) * spb;
    var f = roots[Math.floor(bi / 4) % 4];
    var kick = Math.sin(TAU * (44 * bt + 3.4 * (1 - Math.exp(-bt * 30)))) * Math.exp(-bt * 7.5);
    var late = bt - spb * 0.5, bass = late > 0 ? Math.sin(TAU * f * t) * Math.exp(-late * 7) * 0.45 : 0;
    var pad = (Math.sin(TAU * f * 4 * t) + Math.sin(TAU * f * 5 * t) + Math.sin(TAU * f * 6 * t)) * 0.07 * (0.6 + 0.4 * Math.sin(t * 0.9));
    var six = beat * 4, si = Math.floor(six), st = (six - si) * spb / 4;
    var hop = Math.sin(TAU * f * hops[si % 6] * t) * Math.exp(-st * 16) * 0.16;
    var rnd = Math.random() * 2 - 1, eight = beat * 2, ei = Math.floor(eight), et = (eight - ei) * spb / 2;
    var hat = (rnd - AU.demoRnd) * Math.exp(-et * 55) * (ei % 2 ? 0.16 : 0.07);
    AU.demoRnd = rnd;
    var snare = (bi % 2) ? (rnd * 0.22 + Math.sin(TAU * 185 * bt) * 0.12) * Math.exp(-bt * 16) : 0;
    var pan = 0.5 + 0.45 * Math.sin(t * 1.3);
    // (as loud as a finished record, so that it sits on the fixed scale like real music)
    L[pos] = (kick * 0.8 + bass + pad + hop * pan + hat + snare) * 1.2;
    R[pos] = (kick * 0.8 + bass + pad * 0.9 + hop * (1 - pan) + hat * 0.8 + snare) * 1.2;
    pos = (pos + 1) & mask;
  }
  AU.pos = pos;
  AU.demoN = k;
}

// In-place FFT of AU.re / AU.im (already in bit-reversed order).
function auFft() {
  var N = AU.N, re = AU.re, im = AU.im, cosT = AU.cos, sinT = AU.sin, len, step, i, j, k, a, b, wr, wi, tr, ti;
  for (len = 1; len < N; len <<= 1) {
    step = N / (len << 1);
    for (i = 0; i < N; i += len << 1) {
      for (j = 0, k = 0; j < len; j++, k += step) {
        wr = cosT[k]; wi = -sinT[k];
        a = i + j; b = a + len;
        tr = re[b] * wr - im[b] * wi;
        ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
}

// Work out everything for this frame. Safe to call from several drawing loops:
// it runs once per frame time.
function auFrame(now) {
  if (AU.stamp === now) return;
  var dt = AU.stamp < 0 ? 0.016 : Math.min(0.1, Math.max(0.001, (now - AU.lastFrame) / 1000));
  AU.stamp = now;
  AU.lastFrame = now;

  var playing = S.state === 'play';
  if (playing && !AU.wasPlaying) AU.playAt = now;
  AU.wasPlaying = playing;
  var fed = now - AU.lastMsg < 700, loud = now - AU.lastLoud < 500, mode;
  if (AU.force) mode = AU.force;
  else if (fed && loud) mode = 'live';
  else if (playing) {
    // a song is playing but nothing is heard: wait a moment (the app needs a
    // beat to start listening, songs open with silence) before the tune steps in
    if (fed) mode = now - Math.max(AU.lastLoud, AU.playAt) < 3000 ? 'live' : 'demo';
    else mode = now - Math.max(AU.lastMsg, AU.playAt) < 3000 ? 'idle' : 'demo';
  }
  else mode = fed ? 'live' : 'idle';
  if (mode !== AU.mode) { AU.mode = mode; vzStatus(); }

  var N = AU.N, L = AU.ringL, R = AU.ringR, mask = L.length - 1, i, j, k, v;
  var fresh = Math.min(4096, Math.round(dt * AU.rate));
  if (mode === 'demo') auDemo(fresh);
  else if (mode === 'idle') {
    for (i = 0; i < fresh; i++) { L[AU.pos] = R[AU.pos] = 0; AU.pos = (AU.pos + 1) & mask; }
  }

  // The sound arrives with the volume slider already applied. Undo that, so
  // the displays show how loud the music itself is, on a fixed scale: loud
  // passages fill the bars, quiet ones do not, and turning the volume down
  // does not shrink them (as on Winamp, or a hi-fi's own displays). Very low
  // volume settings (under about 1 %) are not made up for: there is too little
  // left of the sound to show.
  var start = (AU.pos - N) & mask, vol = 1;
  if (mode === 'live') { try { vol = S.music ? +S.music.volume : 1; } catch (e) {} }
  var wantPre = 1 / Math.max(AU.minVol, isFinite(vol) ? vol : 1);
  AU.pre += (wantPre - AU.pre) * Math.min(1, dt * 5);     // (the sound lags the slider a little)
  var g = AU.pre;

  // spectrum
  var re = AU.re, im = AU.im, mag = AU.mag, rev = AU.rev, win = AU.win, norm = 4 / N;
  for (i = 0; i < N; i++) { j = (start + i) & mask; re[rev[i]] = (L[j] + R[j]) * 0.5 * g * win[i]; }
  im.fill(0);
  auFft();
  for (i = 0, k = N >> 1; i < k; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) * norm;
  mag[k] = 0;

  var spec = AU.spec, peak = AU.peak, hold = AU.hold, bin = AU.binAt, sum = 0, m, b0, b1;
  var up = Math.min(1, dt * 38), down = Math.min(1, dt * 9);
  for (i = 0; i < 256; i++) {
    b0 = bin[i]; b1 = bin[i + 1];
    if (b1 - b0 < 1) { k = b0 | 0; m = mag[k] + (mag[k + 1] - mag[k]) * (b0 - k); }
    else { m = 0; for (k = b0 | 0; k < b1; k++) if (mag[k] > m) m = mag[k]; }
    // decibels (0 = a full-scale tone), tilted up towards the top end (music
    // naturally has less there), on a fixed window of AU.dbRange decibels
    v = 8.6859 * Math.log(m + 1e-7);
    if (AU.rawOut) AU.rawOut[i] = v;                       // (tests: the levels before the scale)
    v = (v + AU.dbTilt * i / 256 + AU.dbOff) / AU.dbRange;
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    spec[i] += (v - spec[i]) * (v > spec[i] ? up : down);
    if (spec[i] >= peak[i]) { peak[i] = spec[i]; hold[i] = 0.35; }
    else if (hold[i] > 0) hold[i] -= dt;
    else peak[i] = Math.max(spec[i], peak[i] - dt * 0.55);
    sum += spec[i];
  }

  var bs = 0, md = 0, tb = 0;
  for (i = 4; i < 70; i++) bs += spec[i];
  for (i = 70; i < 170; i++) md += spec[i];
  for (i = 170; i < 244; i++) tb += spec[i];
  var ease = Math.min(1, dt * 14);
  AU.bass += (bs / 66 - AU.bass) * ease;
  AU.mid += (md / 100 - AU.mid) * ease;
  AU.treb += (tb / 74 - AU.treb) * ease;
  AU.level += (sum / 256 - AU.level) * Math.min(1, dt * 6);

  // a beat: the low end suddenly well above its recent average
  var e = 0;
  for (i = 2; i < 9; i++) e += mag[i] * mag[i];
  AU.hit = false;
  if (e > AU.avgE * 1.5 + 0.0004 && now - AU.lastBeat > 190) { AU.hit = true; AU.lastBeat = now; AU.beat = 1; }
  AU.avgE += (e - AU.avgE) * Math.min(1, dt * 2.2);
  AU.beat *= Math.exp(-dt / 0.17);
  AU.flow += dt * (0.3 + 1.5 * AU.bass + 1.4 * AU.beat);

  // a steady stretch of the waveform: start where it crosses zero going up
  var from = (AU.pos - 1536) & mask, off = 0, p0, p1;
  for (i = 0; i < 500; i++) {
    j = (from + i) & mask; k = (from + i + 1) & mask;
    p0 = L[j] + R[j]; p1 = L[k] + R[k];
    if (p0 < 0 && p1 >= 0) { off = i; break; }
  }
  var wl = AU.waveL, wr = AU.waveR, wg = g * AU.waveK;
  for (i = 0; i < 512; i++) {
    j = (from + off + i * 2) & mask;
    v = L[j] * wg; wl[i] = v < -1 ? -1 : v > 1 ? 1 : v;
    v = R[j] * wg; wr[i] = v < -1 ? -1 : v > 1 ? 1 : v;
  }

  var t = AU.tex, s;
  for (i = 0; i < 512; i++) {
    s = i * 0.5; k = s | 0; j = k < 255 ? k + 1 : 255;
    t[i] = (spec[k] + (spec[j] - spec[k]) * (s - k)) * 255;
    t[512 + i] = 127.5 + wl[i] * 127.5;
    t[1024 + i] = 127.5 + wr[i] * 127.5;
    t[1536 + i] = (peak[k] + (peak[j] - peak[k]) * (s - k)) * 255;
  }
}

// ============================================================================
// Visualizer
// Each effect is one small program for the graphics card (a fragment shader).
// Every frame it gets the previous picture (uPrev) and the sound (uAudio, the
// numbers from "Sound" above) and paints the next picture; effects that warp
// and fade the previous picture are what leave trails. To add an effect, add
// an entry to EFFECTS with a function  vec3 fx(vec2 uv, vec2 p)  where uv runs
// 0..1 across the picture and p is centred (y from -1 to 1, x wider by the
// picture's shape).
// ============================================================================
// One triangle that covers the whole picture (its corners come from a small
// vertex buffer: the most widely supported way to draw it).
var VZ_VERT = [
  '#version 300 es',
  'in vec2 aPos;',
  'out vec2 vUv;',
  'void main(){',
  '  vUv = aPos * 0.5 + 0.5;',
  '  gl_Position = vec4(aPos, 0.0, 1.0);',
  '}'
].join('\n');

// The same programs for WebGL 1 (older or limited graphics), which speaks
// GLSL ES 1.00. The effects themselves only use the helpers in VZ_HEAD, so
// translating the header, the vertex program and the two main()s is enough.
function vzGl1(src, fragment) {
  return src
    .replace('#version 300 es\n', '')
    .replace('precision highp float;', fragment
      ? '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif'
      : 'precision highp float;')
    .replace('precision highp sampler2D;\n', '')
    .replace('in vec2 aPos;', 'attribute vec2 aPos;')
    .replace('out vec2 vUv;', 'varying vec2 vUv;')
    .replace('in vec2 vUv;', 'varying vec2 vUv;')
    .replace('out vec4 outColor;\n', '')
    .replace(/\boutColor\b/g, 'gl_FragColor')
    .replace(/\btexture\(/g, 'texture2D(');
}

var VZ_HEAD = [
  '#version 300 es',
  'precision highp float;',
  'precision highp sampler2D;',
  'uniform sampler2D uPrev;        // the previous picture',
  'uniform sampler2D uAudio;       // rows: spectrum, left wave, right wave, spectrum peaks',
  'uniform vec2 uRes;              // picture size in pixels',
  'uniform float uTime;            // seconds',
  'uniform float uBass, uMid, uTreb, uLevel;   // 0..1',
  'uniform float uBeat;            // jumps to 1 on a beat, then fades',
  'uniform float uFlow;            // time that runs faster when the music pushes',
  'uniform float uSeed;',
  'uniform vec3 uC1, uC2;          // the theme: display ink, lamp colour',
  'uniform vec4 uRing[6];          // ripples: x, y, age in seconds, strength',
  'in vec2 vUv;',
  'out vec4 outColor;',
  '#define PI 3.14159265',
  '#define TAU 6.2831853',
  'float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
  'vec2 hash22(vec2 p){ float n = hash21(p); return vec2(n, hash21(p + n + 17.17)); }',
  'float vnoise(vec2 p){',
  '  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);',
  '}',
  'float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }',
  'vec3 pal(float t){ return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67))); }     // rainbow',
  'mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }',
  'float spec(float x){ return texture(uAudio, vec2(clamp(x, 0.0, 1.0), 0.125)).r; }',
  'float wavL(float x){ return texture(uAudio, vec2(clamp(x, 0.002, 0.998), 0.375)).r * 2.0 - 1.0; }',
  'float wavR(float x){ return texture(uAudio, vec2(clamp(x, 0.002, 0.998), 0.625)).r * 2.0 - 1.0; }',
  'float peakAt(float x){ return texture(uAudio, vec2(clamp(x, 0.0, 1.0), 0.875)).r; }',
  'vec3 prev(vec2 uv){ return texture(uPrev, uv).rgb; }',
  'vec2 toUv(vec2 p){ return vec2(p.x * uRes.y / uRes.x, p.y) * 0.5 + 0.5; }',
  ''
].join('\n');

var VZ_MAIN = [
  '',
  'void main(){',
  '  vec2 p = (vUv * 2.0 - 1.0) * vec2(uRes.x / uRes.y, 1.0);',
  '  outColor = vec4(clamp(fx(vUv, p), 0.0, 4.0), 1.0);',
  '}'
].join('\n');

var VZ_PRESENT = [
  '#version 300 es',
  'precision highp float;',
  'uniform sampler2D uTex;',
  'in vec2 vUv;',
  'out vec4 outColor;',
  'void main(){',
  '  vec3 c = clamp(texture(uTex, vUv).rgb, 0.0, 1.0);',
  '  c = pow(c, vec3(0.9));',
  '  vec2 q = vUv - 0.5;',
  '  c *= 1.0 - 0.5 * dot(q, q);',
  '  outColor = vec4(c, 1.0);',
  '}'
].join('\n');

var EFFECTS = [
  // Two coloured waveforms (left and right channel) flying into the screen.
  { id: 'waves', name: 'Colour Waves', jp: '色波', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  float asp = uRes.x / uRes.y, px = 2.0 / uRes.y;',
    '  vec2 q = rot(0.010 * sin(uTime * 0.23) + 0.004) * p * (0.975 - 0.035 * uBeat);',
    '  q += 0.0035 * vec2(sin(p.y * 2.5 + uTime * 0.6), cos(p.x * 2.5 + uTime * 0.5));',
    '  vec3 c = prev(toUv(q)) * 0.94;',
    '  c = mix(c, c.brg, 0.03);',
    '  float x = uv.x, e = 0.004, a = 0.30 + 0.10 * uLevel;',
    '  float yl = 0.34 + a * wavL(x), yr = -0.34 + a * wavR(x);',
    '  float sl = a * (wavL(x + e) - wavL(x - e)) / (4.0 * e * asp);',
    '  float sr = a * (wavR(x + e) - wavR(x - e)) / (4.0 * e * asp);',
    '  float w = px * (1.7 + 2.2 * uBeat);',
    '  float dl = abs(p.y - yl) / sqrt(1.0 + sl * sl), dr = abs(p.y - yr) / sqrt(1.0 + sr * sr);',
    '  float gl = smoothstep(w, 0.0, dl) + 0.10 * w / (dl + w);',
    '  float gr = smoothstep(w, 0.0, dr) + 0.10 * w / (dr + w);',
    '  c = mix(c, pal(uTime * 0.05 + x * 0.45), clamp(gl, 0.0, 1.0));',
    '  c = mix(c, pal(uTime * 0.05 + x * 0.45 + 0.5), clamp(gr, 0.0, 1.0));',
    '  return c;',
    '}'
  ] },

  // Flying through stars; the low end is the throttle.
  { id: 'stars', name: 'Starfield', jp: '星空', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  vec3 c = prev(toUv(p * (0.985 - 0.02 * uBass))) * (0.86 + 0.06 * uBass);',
    '  float n = fbm(p * 1.1 + vec2(uTime * 0.012, uSeed));',
    '  c += pal(n * 0.8 + uTime * 0.01) * 0.014 * n * n;',
    '  float travel = uFlow * 0.16;',
    '  for (int i = 0; i < 8; i++) {',
    '    float fi = float(i);',
    '    float depth = fract(fi / 8.0 + travel);',
    '    float scale = mix(16.0, 0.5, depth);',
    '    float fade = smoothstep(0.0, 0.15, depth) * smoothstep(1.0, 0.92, depth);',
    '    vec2 g = p * scale + vec2(fi * 37.3, fi * 11.9) + uSeed;',
    '    vec2 id = floor(g), f = fract(g) - 0.5;',
    '    vec2 h = hash22(id + fi * 3.7);',
    '    if (h.x > 0.34) continue;',
    '    vec2 off = (hash22(id + 91.7 + fi) - 0.5) * 0.6;',
    '    float d = length(f - off);',
    '    float size = (0.07 + 0.07 * h.y) * mix(1.0, 0.13, depth);',
    '    float tw = 0.75 + 0.25 * sin(uTime * (2.0 + 5.0 * h.y) + h.x * 60.0);',
    '    float s = smoothstep(size, 0.0, d);',
    '    s = s * s * (0.55 + 1.3 * uBeat + 0.9 * uTreb) * tw;',
    '    vec3 tint = mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.86, 0.68), fract(h.y * 7.0));',
    '    tint = mix(tint, pal(h.y + uTime * 0.02), 0.35);',
    '    c += tint * s * fade * 0.8;',
    '  }',
    '  return c;',
    '}'
  ] },

  // The classic: lit segments per band, falling peak caps, a reflection below.
  { id: 'bars', name: 'Spectrum', jp: 'スペクトラム', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  float n = floor(clamp(uRes.x / 15.0, 16.0, 72.0));',
    '  float base = 0.26;',
    '  float bar = floor(uv.x * n), fr = fract(uv.x * n);',
    '  float x = 0.02 + (bar + 0.5) / n * 0.94;',
    '  float v = spec(x), pk = peakAt(x);',
    '  float gap = step(0.13, fr) * step(fr, 0.87);',
    '  float rows = floor(uRes.y * (0.94 - base) / 7.0);',
    '  vec3 c = vec3(0.0);',
    '  if (uv.y >= base) {',
    '    float y = (uv.y - base) / (0.94 - base);',
    '    float seg = step(0.24, fract(y * rows));',
    '    float lit = step(y, v) * step(y, 1.0);',
    '    vec3 ink = mix(uC1, uC2, smoothstep(0.5, 0.95, y));',
    '    ink = mix(ink, vec3(1.0), smoothstep(0.86, 1.0, y) * 0.55);',
    '    c += ink * lit * seg * gap;',
    '    c += uC1 * 0.075 * (1.0 - lit) * seg * gap * step(y, 1.0);',
    '    float cap = step(abs(y - pk - 0.6 / rows), 0.55 / rows) * gap * step(0.03, pk);',
    '    c += mix(uC2, vec3(1.0), 0.5) * cap;',
    '  } else {',
    '    float y = (base - uv.y) / base;',
    '    float ym = y * 0.62;',
    '    float seg = step(0.24, fract(ym * rows));',
    '    float lit = step(ym, v);',
    '    c += mix(uC1, uC2, smoothstep(0.5, 0.95, ym)) * lit * seg * gap * 0.30 * (1.0 - y) * (1.0 - y);',
    '  }',
    '  c += uC1 * 0.045 * exp(-abs(uv.y - base) * 9.0) * (0.5 + uBass);',
    '  return c;',
    '}'
  ] },

  // An oscilloscope with a glowing phosphor trace.
  { id: 'scope', name: 'Oscilloscope', jp: '波形', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  float asp = uRes.x / uRes.y, px = 2.0 / uRes.y;',
    '  vec3 c = prev(uv) * 0.78;',
    '  vec2 gd = abs(fract(vec2(uv.x * 10.0, uv.y * 8.0) + 0.5) - 0.5) * vec2(uRes.x / 10.0, uRes.y / 8.0);',
    '  float grid = 1.0 - smoothstep(0.4, 1.3, min(gd.x, gd.y));',
    '  float axis = 1.0 - smoothstep(0.6, 1.6, min(abs(uv.x - 0.5) * uRes.x, abs(uv.y - 0.5) * uRes.y));',
    '  c = max(c, uC1 * (0.10 * grid + 0.16 * axis));',
    '  float x = uv.x, e = 0.003, a = 0.66;',
    '  float m0 = 0.5 * (wavL(x) + wavR(x));',
    '  float m1 = 0.5 * (wavL(x + e) + wavR(x + e)), m2 = 0.5 * (wavL(x - e) + wavR(x - e));',
    '  float s = a * (m1 - m2) / (4.0 * e * asp);',
    '  float d = abs(p.y - a * m0) / sqrt(1.0 + s * s);',
    '  float w = px * 1.5;',
    '  c = max(c, mix(uC1, vec3(1.0), 0.45) * smoothstep(w, 0.0, d));',
    '  c += uC1 * 0.07 * w / (d + w * 2.5);',
    '  return c;',
    '}'
  ] },

  // A tunnel of lit tiles; each ring of tiles shows the spectrum.
  { id: 'tunnel', name: 'Tunnel', jp: 'トンネル', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  vec2 q = p - 0.16 * vec2(sin(uTime * 0.31), cos(uTime * 0.23));',
    '  float r = length(q) + 0.0001, a = atan(q.y, q.x);',
    '  float z = 0.5 / r + uFlow * 0.5;',
    '  float u = a / TAU + 0.5 + 0.04 * sin(z * 0.5 + uTime * 0.2);',
    '  float cu = u * 24.0, cz = z * 2.6;',
    '  vec2 cell = vec2(floor(cu), floor(cz)), f = vec2(fract(cu), fract(cz));',
    '  float edge = smoothstep(0.0, 0.08, f.x) * smoothstep(1.0, 0.92, f.x) * smoothstep(0.0, 0.10, f.y) * smoothstep(1.0, 0.90, f.y);',
    '  float band = abs(fract(cell.x / 12.0) * 2.0 - 1.0);',
    '  float v = spec(0.03 + band * 0.85);',
    '  float lit = smoothstep(0.30, 0.75, v * (0.8 + 0.5 * hash21(cell)));',
    '  lit += 0.8 * uBeat * step(0.8, hash21(cell + 7.7));',
    '  vec3 ink = pal(cell.y * 0.05 + band * 0.35 + uTime * 0.04);',
    '  float fog = smoothstep(0.03, 0.5, r);',
    '  vec3 c = ink * (0.07 + 1.15 * lit) * edge * fog;',
    '  c += pal(uTime * 0.05 + 0.3) * (0.08 + 0.55 * uBeat) * exp(-r * 6.0);',
    '  c += prev(toUv(p * 0.985)) * 0.40;',
    '  return c;',
    '}'
  ] },

  // Old-school plasma, with the waveform etched across it.
  { id: 'plasma', name: 'Plasma', jp: 'プラズマ', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  float t = uFlow * 0.45 + uTime * 0.12;',
    '  vec2 q = p * (1.5 - 0.3 * uBass);',
    '  float v = sin(q.x * 2.3 + t) + sin(q.y * 2.9 - t * 1.3) + sin((q.x + q.y) * 1.7 + t * 0.7)',
    '          + sin(length(q + vec2(sin(t * 0.5), cos(t * 0.4))) * 4.2 - t * 1.6);',
    '  v += 0.9 * uTreb * sin(length(q) * 12.0 - uTime * 3.0);',
    '  vec3 c = pal(v * 0.15 + uTime * 0.03 + 0.1 * uBeat);',
    '  c *= 0.42 + 0.58 * smoothstep(-1.0, 1.0, sin(v * 2.6 + uTime * 0.8));',
    '  float d = abs(p.y - 0.5 * wavL(uv.x) * (0.4 + uLevel));',
    '  c += vec3(0.6) * smoothstep(5.0 / uRes.y, 0.0, d);',
    '  c = mix(c, prev(uv), 0.35);',
    '  return c * (0.78 + 0.35 * uLevel + 0.25 * uBeat);',
    '}'
  ] },

  // A waveform and a spectrum ring, mirrored seven times and left to spin.
  { id: 'kaleido', name: 'Kaleidoscope', jp: '万華鏡', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  float px = 2.0 / uRes.y;',
    '  vec3 c = prev(toUv(rot(0.018 + 0.02 * uBass) * p * 1.025)) * 0.915;',
    '  c = mix(c, c.gbr, 0.025);',
    '  float n = 7.0, sector = TAU / n;',
    '  float r = length(p), a = atan(p.y, p.x) + uTime * 0.06;',
    '  a = mod(a, sector);',
    '  a = abs(a - sector * 0.5);',
    '  vec2 q = r * vec2(cos(a), sin(a));',
    '  float x = clamp(q.x / 1.25, 0.0, 1.0);',
    '  float y = 0.05 + (0.05 + 0.20 * x) * (0.6 + wavL(x * 0.9 + 0.05));',
    '  float w = px * 1.6;',
    '  c = mix(c, pal(x * 0.7 - uTime * 0.07), smoothstep(w * 1.4, 0.0, abs(q.y - y)));',
    '  float an = a / (sector * 0.5);',
    '  float rr = 0.30 + 0.55 * spec(0.05 + an * 0.75);',
    '  c = mix(c, pal(an * 0.5 + uTime * 0.05 + 0.5), smoothstep(w * 1.6, 0.0, abs(r - rr)));',
    '  c += pal(uTime * 0.1) * 0.25 * uBeat * smoothstep(0.12, 0.0, r);',
    '  return c;',
    '}'
  ] },

  // Fireflies over a dark field; each one glows with its own band.
  { id: 'hotaru', name: 'Fireflies', jp: '蛍', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  float asp = uRes.x / uRes.y;',
    '  vec3 c = prev(toUv(p * 0.997 + vec2(0.0, -0.001))) * 0.88;',
    '  vec3 night = mix(vec3(0.004, 0.02, 0.022), vec3(0.0, 0.006, 0.014), uv.y);',
    '  night += vec3(0.02, 0.05, 0.03) * exp(-5.0 * uv.y) * (0.6 + uBass);',
    '  c = max(c, night);',
    '  for (int i = 0; i < 36; i++) {',
    '    float fi = float(i);',
    '    vec2 h = hash22(vec2(fi * 1.37 + uSeed, fi * 7.77));',
    '    float sp = 0.12 + 0.3 * h.x;',
    '    vec2 pos = vec2(asp * 1.05 * sin(uTime * sp * 0.55 + h.y * TAU + fi), 0.95 * sin(uTime * sp * 0.4 + h.x * TAU * 2.0 + fi * 2.3));',
    '    pos += 0.07 * vec2(sin(uTime * 1.3 + fi), cos(uTime * 1.1 + fi * 1.7));',
    '    float band = spec(0.03 + h.y * 0.85);',
    '    float blink = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (0.9 + h.x) + fi * 3.1), 2.0);',
    '    float size = (0.014 + 0.03 * h.x) * (0.8 + 1.1 * band + 0.5 * uBeat);',
    '    float d = length(p - pos);',
    '    float g = size * size / (d * d + size * size * 0.2);',
    '    vec3 ink = mix(vec3(0.72, 1.0, 0.32), vec3(1.0, 0.86, 0.3), h.y);',
    '    c += mix(ink, uC1, 0.25 * h.x) * g * blink * 0.075 * (0.5 + band);',
    '  }',
    '  return c;',
    '}'
  ] },

  // Cherry petals on the wind at dusk; the low end is the wind.
  { id: 'sakura', name: 'Sakura Storm', jp: '桜吹雪', src: [
    'float petal(vec2 q){',
    '  float lens = max(length(q - vec2(0.0, 0.35)), length(q + vec2(0.0, 0.35))) - 0.62;',
    '  return max(lens, 0.12 - length(q - vec2(0.55, 0.0)));',
    '}',
    'vec3 fx(vec2 uv, vec2 p){',
    '  float asp = uRes.x / uRes.y;',
    '  vec3 c = mix(vec3(0.16, 0.05, 0.13), vec3(0.03, 0.02, 0.09), smoothstep(0.0, 0.9, uv.y));',
    '  c += vec3(0.30, 0.10, 0.16) * exp(-3.5 * uv.y) * (0.6 + 0.6 * uBass);',
    '  float md = length(p - vec2(asp * 0.52, 0.5));',
    '  c += vec3(1.0, 0.94, 0.9) * (smoothstep(0.17, 0.16, md) * 0.8 + 0.05 / (md + 0.12));',
    '  for (int i = 0; i < 4; i++) {',
    '    float fl = 3.0 - float(i);',
    '    float scale = 2.2 + fl * 1.6;',
    '    vec2 g = p * scale;',
    '    g.x += uFlow * (0.42 - 0.05 * fl) + 0.35 * sin(p.y * 1.5 + uTime * 0.4 + fl);',
    '    g.y += uTime * 0.24 * (1.3 - 0.15 * fl) + fl * 3.7;',
    '    vec2 id = floor(g), f = fract(g) - 0.5;',
    '    vec2 h = hash22(id + fl * 13.1 + uSeed);',
    '    if (h.x > 0.5) continue;',
    '    vec2 off = (hash22(id * 1.7 + 3.3) - 0.5) * 0.5;',
    '    float spin = h.y * TAU + uTime * (0.6 + h.x) * (h.y > 0.5 ? 1.0 : -1.0);',
    '    float flip = 0.55 + 0.45 * sin(uTime * (1.2 + h.x * 2.0) + h.y * 30.0);',
    '    vec2 q = rot(spin) * (f - off) / 0.2;',
    '    q.y /= max(0.28, flip);',
    '    float aa = scale * 2.0 / uRes.y / 0.2 * 1.5;',
    '    float cov = smoothstep(aa, -aa, petal(q));',
    '    vec3 ink = mix(vec3(1.0, 0.70, 0.82), vec3(1.0, 0.90, 0.94), h.y) * (0.72 + 0.28 * flip);',
    '    c = mix(c, ink, cov * (0.92 - 0.13 * fl));',
    '  }',
    '  c += vec3(1.0, 0.6, 0.75) * 0.07 * uBeat;',
    '  return c;',
    '}'
  ] },

  // Rings on still water, one for every beat.
  { id: 'hamon', name: 'Ripples', jp: '波紋', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  float hgt = 0.0;',
    '  vec2 slope = vec2(0.0);',
    '  for (int i = 0; i < 6; i++) {',
    '    vec4 rg = uRing[i];',
    '    if (rg.w <= 0.0) continue;',
    '    vec2 dv = p - rg.xy;',
    '    float d = length(dv) + 0.0001;',
    '    float x = d - rg.z * 0.42;',
    '    float env = rg.w * exp(-rg.z * 0.75) * exp(-x * x * 9.0) * smoothstep(0.0, 0.08, d);',
    '    hgt += cos(x * 34.0) * env;',
    '    slope += dv / d * (-sin(x * 34.0)) * env;',
    '  }',
    '  vec2 sw = vec2(cos(p.x * 2.6 + uTime * 0.5) * sin(p.y * 2.1 - uTime * 0.4), sin(p.x * 2.6 + uTime * 0.5) * cos(p.y * 2.1 - uTime * 0.4));',
    '  slope += sw * (0.10 + 0.25 * uBass);',
    '  vec3 nrm = normalize(vec3(-slope * 0.6, 1.0));',
    '  vec3 sun = normalize(vec3(-0.35, 0.55, 0.75));',
    '  float diff = max(dot(nrm, sun), 0.0);',
    '  float glint = pow(max(dot(reflect(-sun, nrm), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);',
    '  vec3 deep = mix(vec3(0.0, 0.02, 0.045), uC1 * 0.14, 0.45);',
    '  vec3 c = deep + uC1 * 0.5 * pow(diff, 2.5) + mix(uC2, vec3(1.0), 0.6) * glint * 0.9;',
    '  c += uC1 * 0.25 * max(hgt, 0.0);',
    '  c *= 0.75 + 0.25 * smoothstep(1.6, 0.2, length(p));',
    '  return c;',
    '}'
  ] },

  // Northern lights over a lake: three curtains that reach higher where the music is.
  { id: 'aurora', name: 'Aurora', jp: 'オーロラ', src: [
    'vec3 night(vec2 p){',
    '  vec3 c = vec3(0.0, 0.012, 0.035) + vec3(0.02, 0.01, 0.05) * smoothstep(-0.5, 1.0, p.y);',
    '  vec2 g = p * 34.0;',
    '  vec2 id = floor(g), f = fract(g) - 0.5, h = hash22(id);',
    '  c += vec3(0.8, 0.9, 1.0) * smoothstep(0.07, 0.0, length(f - (h - 0.5) * 0.6)) * step(0.80, h.x) * (0.5 + 0.5 * sin(uTime * 3.0 * h.y + h.x * 50.0));',
    '  for (int i = 0; i < 3; i++) {',
    '    float fi = float(i);',
    '    float x = p.x * (0.9 + 0.25 * fi) + fi * 2.1;',
    '    float t = uTime * (0.10 + 0.04 * fi) + uFlow * 0.08;',
    '    float n = fbm(vec2(x * 1.3 + t, t * 0.7 + fi * 5.0));',
    '    float low = -0.62 + 0.42 * n + 0.10 * fi;',
    '    float band = spec(fract(abs(x) * 0.13 + 0.08 * fi));',
    '    float reach = 0.6 + 0.7 * band + 0.3 * uMid;',
    '    float y = (p.y - low) / reach;',
    '    float body = smoothstep(0.0, 0.06, y) * exp(-y * 2.4);',
    '    float rays = 0.6 + 0.4 * vnoise(vec2(x * 22.0 + t * 3.0, 0.5 + fi));',
    '    vec3 ink = mix(vec3(0.1, 1.0, 0.45), vec3(0.6, 0.25, 0.95), smoothstep(0.1, 0.9, y));',
    '    c += mix(ink, uC1, 0.18) * body * rays * (0.35 + 0.5 * band + 0.35 * uBeat) * (0.85 - 0.2 * fi);',
    '  }',
    '  return c;',
    '}',
    'vec3 fx(vec2 uv, vec2 p){',
    '  float hz = -0.56;                                   // the far shore',
    '  vec3 c;',
    '  if (p.y >= hz) c = night(p);',
    '  else {',
    '    float dy = hz - p.y;                              // the same sky, upside down in the water',
    '    vec2 q = vec2(p.x + 0.012 * sin(dy * 70.0 + uTime * 1.6) + 0.02 * sin(dy * 23.0 - uTime), hz + 0.05 + dy * 2.4);',
    '    c = night(q) * vec3(0.40, 0.48, 0.52) * (1.0 - 0.5 * dy);',
    '  }',
    '  float hills = hz + 0.035 + 0.07 * fbm(vec2(p.x * 1.6 + 3.0, 1.0));',
    '  c = mix(c, vec3(0.0, 0.006, 0.012), smoothstep(hills, hills - 0.008, p.y) * smoothstep(hz - 0.012, hz, p.y));',
    '  return c;',
    '}'
  ] },

  // A sun whose rim is pushed out by the spectrum, with rays; trails drift outwards.
  { id: 'corona', name: 'Corona', jp: '光環', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  float px = 2.0 / uRes.y;',
    '  vec2 q = rot(0.004 + 0.01 * uBass) * p * (0.975 - 0.02 * uBeat);',
    '  vec3 c = prev(toUv(q)) * 0.9;',
    '  float r = length(p), a = atan(p.y, p.x);',
    '  float m = abs(a) / PI;',
    '  float v = spec(0.03 + m * 0.8);',
    '  float rim = 0.26 + 0.06 * uBass + 0.34 * v;',
    '  vec3 ink = pal(m * 0.6 + uTime * 0.04);',
    '  c = mix(c, ink, smoothstep(px * 2.5, 0.0, abs(r - rim)));',
    '  c += ink * 0.22 * smoothstep(rim, 0.0, r) * (0.3 + 0.7 * v);',
    '  c += mix(uC1, vec3(1.0), 0.5) * smoothstep(0.24 + 0.05 * uBass, 0.0, r) * (0.25 + 0.6 * uBeat);',
    '  float rays = pow(abs(sin(a * 12.0 + uTime * 0.3)), 24.0) * smoothstep(rim + 0.6, rim, r) * step(rim, r) * v;',
    '  c += ink * rays * 0.5;',
    '  return c;',
    '}'
  ] },

  // Synthwave: a striped sun, mountains that follow the spectrum, a grid floor rushing in.
  { id: 'outrun', name: 'Outrun', jp: 'アウトラン', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  float asp = uRes.x / uRes.y, px = 2.0 / uRes.y;',
    '  float hz = -0.12;',
    '  vec3 c;',
    '  if (p.y > hz) {',
    '    float hh = (p.y - hz) / (1.0 - hz);',
    '    c = mix(vec3(0.5, 0.1, 0.42), vec3(0.04, 0.02, 0.14), smoothstep(0.0, 0.8, hh));',
    '    vec2 sc = vec2(0.0, hz + 0.3);',
    '    float sr = 0.28 + 0.05 * uBass + 0.03 * uBeat;',
    '    float d = length(p - sc);',
    '    float below = clamp((sc.y - p.y) / sr, 0.0, 1.0);',
    '    float stripe = step(below * 0.55, fract((p.y + uTime * 0.04) * 16.0));',
    '    float sun = smoothstep(sr, sr - px * 1.5, d) * mix(1.0, stripe, step(0.0001, below));',
    '    vec3 sunInk = mix(vec3(1.0, 0.85, 0.3), vec3(1.0, 0.25, 0.6), clamp((sc.y + sr - p.y) / (2.0 * sr), 0.0, 1.0));',
    '    c = mix(c, sunInk, sun);',
    '    c += vec3(1.0, 0.3, 0.6) * 0.22 * exp(-d * 4.0);',
    '    float x = abs(p.x) / asp;',
    '    float mh = hz + 0.03 + 0.3 * spec(0.05 + x * 0.6) * (0.35 + 0.65 * x);',
    '    c = mix(c, vec3(0.06, 0.02, 0.12), smoothstep(mh + px, mh - px, p.y));',
    '    c = mix(c, uC2, smoothstep(px * 2.0, 0.0, abs(p.y - mh)) * 0.8);',
    '  } else {',
    '    float dy = hz - p.y + 0.0001;',
    '    float z = 0.35 / dy;',
    '    float gx = p.x * z * 3.0;',
    '    float gz = z * 2.0 + uFlow * 1.2;',
    '    float dX = abs(fract(gx + 0.5) - 0.5);',
    '    float dZ = abs(fract(gz + 0.5) - 0.5);',
    '    float wX = z * 3.0 * px * 1.4, wZ = 0.7 / (dy * dy) * px * 1.4;',
    '    float line = max(smoothstep(wX, 0.0, dX), smoothstep(wZ, 0.0, dZ));',
    '    float fade = smoothstep(0.0, 0.3, dy);',
    '    vec3 lineC = mix(vec3(1.0, 0.2, 0.75), vec3(0.2, 0.9, 1.0), 0.5 + 0.5 * sin(uTime * 0.2));',
    '    c = vec3(0.03, 0.0, 0.06) + lineC * line * fade * (0.7 + 0.6 * uBeat);',
    '    c += vec3(1.0, 0.3, 0.6) * 0.18 * exp(-dy * 10.0);',
    '  }',
    '  return c;',
    '}'
  ] },

  // Fireworks over a dark hill; bursts come faster when the music pushes.
  { id: 'hanabi', name: 'Fireworks', jp: '花火', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  float asp = uRes.x / uRes.y;',
    '  vec3 c = prev(toUv(p * 0.996 + vec2(0.0, 0.002))) * 0.86;',
    '  c = max(c, mix(vec3(0.012, 0.01, 0.045), vec3(0.0, 0.0, 0.015), uv.y));',
    '  for (int i = 0; i < 5; i++) {',
    '    float fi = float(i);',
    '    float run = uFlow * 0.35 + fi * 0.2;',
    '    float t = fract(run);',
    '    vec2 hs = hash22(vec2(floor(run) * 3.1 + fi, fi * 7.3 + uSeed));',
    '    vec2 ctr = vec2((hs.x * 2.0 - 1.0) * asp * 0.75, 0.1 + 0.6 * hs.y);',
    '    vec3 ink = pal(hs.x * 3.0 + hs.y);',
    '    float power = 0.6 + 0.8 * spec(0.05 + 0.7 * hs.y);',
    '    float spread = (0.25 + 0.2 * hs.y) * power * (1.0 - exp(-t * 5.0));',
    '    float fall = 0.18 * t * t;',
    '    float glow = (1.0 - t) * (1.0 - t);',
    '    for (int k = 0; k < 20; k++) {',
    '      float a = (float(k) + hs.x) / 20.0 * TAU;',
    '      vec2 sp = ctr + vec2(cos(a), sin(a)) * spread - vec2(0.0, fall);',
    '      float d = length(p - sp);',
    '      c += ink * glow * (exp(-d * d * 3000.0) + 0.02 * exp(-d * 40.0)) * 0.35;',
    '    }',
    '  }',
    '  float hill = -0.78 + 0.05 * sin(p.x * 3.0) + 0.03 * sin(p.x * 7.0 + 1.0);',
    '  c = mix(c, vec3(0.0, 0.0, 0.01), smoothstep(hill + 0.005, hill - 0.005, p.y));',
    '  return c;',
    '}'
  ] },

  // A city at night: each building is a band of the spectrum, windows flicker with the treble.
  { id: 'city', name: 'Neon City', jp: '夜景', src: [
    'vec3 fx(vec2 uv, vec2 p){',
    '  float asp = uRes.x / uRes.y;',
    '  float water = -0.45;',
    '  vec2 q = p;',
    '  float refl = 0.0;',
    '  if (p.y < water) { q.y = 2.0 * water - p.y; q.x += 0.008 * sin(p.y * 90.0 + uTime * 2.0); refl = 1.0; }',
    '  vec3 c = mix(vec3(0.05, 0.03, 0.12), vec3(0.0, 0.0, 0.03), smoothstep(water, 1.0, q.y));',
    '  c += uC1 * 0.08 * exp(-(q.y - water) * 4.0);',
    '  float md = length(q - vec2(asp * 0.55, 0.62));',
    '  c += vec3(1.0, 0.95, 0.85) * (smoothstep(0.1, 0.095, md) * 0.9 + 0.025 / (md + 0.08));',
    '  float n = 26.0;',
    '  float cx = (q.x / asp * 0.5 + 0.5) * n;',
    '  float col = floor(cx), fr = fract(cx);',
    '  float v = spec(0.03 + (col / n) * 0.85);',
    '  float top = water + 0.12 + 0.35 * hash21(vec2(col, 3.7)) + 0.55 * v;',
    '  float inside = step(0.08 + 0.12 * hash21(vec2(col, 9.1)), fr) * step(fr, 0.94) * step(q.y, top) * step(water, q.y);',
    '  if (inside > 0.5) {',
    '    vec3 wall = mix(vec3(0.03, 0.03, 0.06), uC1 * 0.08, 0.5);',
    '    vec2 wg = vec2(fr * 6.0, (q.y - water) * 40.0);',
    '    vec2 wid = floor(wg), wf = fract(wg);',
    '    float lit = step(0.55, hash21(wid + col * 13.0 + floor(uTime * (0.2 + 2.0 * uTreb) + hash21(wid))));',
    '    float win = step(0.2, wf.x) * step(wf.x, 0.8) * step(0.25, wf.y) * step(wf.y, 0.75);',
    '    wall += mix(vec3(1.0, 0.8, 0.45), uC2, 0.35) * win * lit * (0.5 + 0.5 * v);',
    '    wall += uC1 * smoothstep(0.012, 0.0, top - q.y) * (0.6 + uBeat);',
    '    c = wall;',
    '  }',
    '  if (refl > 0.5) c *= vec3(0.35, 0.4, 0.5) * (0.8 + 0.2 * sin(p.y * 160.0 + uTime * 3.0));',
    '  return c;',
    '}'
  ] }
];

var VZ = {
  effect: store.get('vizEffect', 'waves'),
  auto: store.get('vizAuto', true),   // move on to the next effect every so often
  gl: null, dead: false, lost: false, isFloat: false,
  api: 0,              // 2 = WebGL 2, 1 = WebGL 1 (older graphics), 0 = none (yet)
  bad2: false,         // WebGL 2 was there but refused to set up: use WebGL 1
  forceApi: 0,         // (tests: 1 or 2)
  tries: 0, retryAt: 0, why: '', renderer: '', glErrors: 0,
  raf: 0, last: 0, t: 0, since: 0, frames: 0, ms: 0,
  vs: null, present: null, progs: {}, bad: {}, errors: [],
  tex: [null, null], fbo: [null, null], cur: 0, w: 0, h: 0, audioTex: null, audioFmt: 0, vao: null, buf: null,
  rings: [], ringAt: 0, ringData: new Float32Array(24),
  seed: Math.random() * 50, osdTimer: 0, idleTimer: 0, c1: [0.5, 0.8, 1], c2: [1, 0.8, 0.4]
};

function vzVisible() { return !!ui.vzPanel && S.showViz && deckShown() && S.seen && !document.hidden; }
function vzKick() { if (!VZ.raf && vzVisible()) VZ.raf = requestAnimationFrame(vzFrame); }

function vzColors() {
  var t = themeNow(), a = hexToRgb(t.lcdFg), b = hexToRgb(t.lit);
  // a very dark lamp colour (some themes) would vanish on a black picture
  if (isDark(t.lit)) b = hexToRgb(t.lcdFg).map(function (v) { return Math.min(255, v + 60); });
  VZ.c1 = [a[0] / 255, a[1] / 255, a[2] / 255];
  VZ.c2 = [b[0] / 255, b[1] / 255, b[2] / 255];
}

function vzEffectAt() {
  for (var i = 0; i < EFFECTS.length; i++) if (EFFECTS[i].id === VZ.effect) return i;
  return 0;
}

function vzCompile(type, src) {
  var gl = VZ.gl, s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    var log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log || 'shader did not compile');
  }
  return s;
}
function vzProgram(fragSrc) {
  var gl = VZ.gl, p = gl.createProgram(), fs = vzCompile(gl.FRAGMENT_SHADER, VZ.api === 1 ? vzGl1(fragSrc, true) : fragSrc);
  gl.attachShader(p, VZ.vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    var log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(log || 'program did not link');
  }
  var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), i, info;
  for (i = 0; i < n; i++) {
    info = gl.getActiveUniform(p, i);
    if (info) u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
  }
  return { p: p, u: u };
}

// Get a drawing context and the things every effect shares: WebGL 2 if the
// computer offers it, else WebGL 1 (older or limited graphics). If neither
// works it tries again a few times (the browser's graphics part may just be
// restarting), and only then settles for plain 2D bars - saying why on the
// panel, with a key to try again.
var VZ_ATTRS = { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false };

function vzHook(c) {
  if (c._mpHooked) return;
  c._mpHooked = true;
  c.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    if (c !== ui.vzCanvas) return;
    VZ.gl = null; VZ.lost = true; VZ.progs = {}; VZ.tex = [null, null]; VZ.fbo = [null, null]; VZ.w = VZ.h = 0;
    VZ.errors.push('the graphics context was lost');
  });
  c.addEventListener('webglcontextrestored', function () { if (c === ui.vzCanvas) { VZ.lost = false; vzKick(); } });
}

// A canvas keeps the kind of context it first had: a fresh one for each new try.
function vzNewCanvas() {
  var old = ui.vzCanvas, c = h('canvas', { class: 'mpv-canvas', 'aria-hidden': 'true' });
  if (old && old.parentNode) old.parentNode.replaceChild(c, old);
  ui.vzCanvas = c;
  VZ.gl = null; VZ.api = 0; VZ.lost = false; VZ.progs = {}; VZ.tex = [null, null]; VZ.fbo = [null, null];
  VZ.w = VZ.h = 0; VZ.vs = VZ.present = VZ.audioTex = VZ.vao = VZ.buf = null;
}

function vzSetup() {
  var gl = VZ.gl, two = VZ.api === 2;
  VZ.isFloat = two && !!gl.getExtension('EXT_color_buffer_float');
  VZ.vs = vzCompile(gl.VERTEX_SHADER, two ? VZ_VERT : vzGl1(VZ_VERT, false));
  VZ.present = vzProgram(VZ_PRESENT);
  if (two) { VZ.vao = gl.createVertexArray(); gl.bindVertexArray(VZ.vao); }
  VZ.buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, VZ.buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  VZ.audioFmt = two ? gl.RED : gl.LUMINANCE;
  VZ.audioTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, VZ.audioTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, two ? gl.R8 : gl.LUMINANCE, 512, 4, 0, VZ.audioFmt, gl.UNSIGNED_BYTE, AU.tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  var err = gl.getError();
  if (err) throw new Error('graphics error 0x' + err.toString(16) + ' while setting up');
  var d = gl.getExtension('WEBGL_debug_renderer_info');
  VZ.renderer = String((d && gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '').slice(0, 120);
}

function vzStart() {
  if (VZ.gl) return true;
  if (VZ.dead || VZ.lost) return false;
  var now = performance.now();
  if (now < VZ.retryAt) return false;
  var apis = VZ.forceApi ? [VZ.forceApi] : VZ.bad2 ? [1] : [2, 1], k, api, gl;
  for (k = 0; k < apis.length; k++) {
    api = apis[k];
    gl = null;
    vzHook(ui.vzCanvas);
    try { gl = ui.vzCanvas.getContext(api === 2 ? 'webgl2' : 'webgl', VZ_ATTRS); }
    catch (e) { VZ.errors.push('WebGL ' + api + ': ' + errText(e)); }
    if (!gl) { if (VZ.errors.length < 40) VZ.errors.push('WebGL ' + api + ' is not available'); continue; }
    VZ.gl = gl;
    VZ.api = api;
    try {
      vzSetup();
      VZ.tries = 0;
      VZ.progs = {};
      VZ.w = VZ.h = 0;
      dlog('visualizer: WebGL ' + api + ', ' + VZ.renderer);
      vzNote();
      return true;
    } catch (e) {
      VZ.errors.push('setting up WebGL ' + api + ': ' + errText(e));
      if (api === 2) VZ.bad2 = true;
      vzNewCanvas();
    }
  }
  if (++VZ.tries >= 4) {
    vzGiveUp(VZ.errors.some(function (x) { return /setting up/.test(x); })
      ? 'the graphics card refused the effects (' + VZ.errors[VZ.errors.length - 1].slice(0, 90) + ')'
      : 'the browser is not letting this page use the graphics card. In the browser\'s settings (System), turn on "Use graphics acceleration when available", then restart Music Player.');
    return false;
  }
  VZ.retryAt = now + 2500 * VZ.tries;
  return false;
}

// Settle for plain 2D bars, and say why on the panel.
function vzGiveUp(why) {
  VZ.dead = true;
  VZ.why = why;
  dlog('visualizer: ' + why + ' | ' + VZ.errors.slice(-4).join(' | '));
  try { console.warn('Music Player visualizer: ' + why, VZ.errors); } catch (e) {}
  vzNewCanvas();                       // (a canvas that had a WebGL context cannot draw in 2D)
  vzNote();
}

// Start again from scratch (the TRY AGAIN key).
function vzRetry() {
  VZ.dead = false; VZ.tries = 0; VZ.retryAt = 0; VZ.bad2 = false; VZ.bad = {}; VZ.errors = []; VZ.why = ''; VZ.glErrors = 0;
  vzNewCanvas();
  vzNote();
  vzKick();
}

// What the panel says about the graphics: a line on the picture when only the
// plain bars can be drawn, and the details at the bottom of the effects list.
function vzNote() {
  if (ui.vzNote) {
    ui.vzNoteText.textContent = VZ.dead ? 'PLAIN BARS ONLY: ' + VZ.why : '';
    ui.vzNote.hidden = !VZ.dead;
  }
  if (ui.vzInfo) {
    var bad = EFFECTS.filter(function (fx) { return VZ.bad[fx.id]; }).length;
    ui.vzInfo.textContent = VZ.dead ? 'Graphics: not available - ' + VZ.why
      : VZ.api ? 'Graphics: WebGL ' + VZ.api + (VZ.renderer ? '  ·  ' + VZ.renderer : '') + (bad ? '  ·  ' + bad + ' effect(s) could not start here' : '')
      : 'Graphics: starting...';
  }
  vzMenuSync();
}

// The two pictures the effects paint into in turn.
function vzTargets(w, h) {
  var gl = VZ.gl, i, t;
  for (i = 0; i < 2; i++) {
    if (VZ.tex[i]) gl.deleteTexture(VZ.tex[i]);
    if (!VZ.fbo[i]) VZ.fbo[i] = gl.createFramebuffer();
    t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (VZ.isFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, VZ.api === 2 ? gl.RGBA8 : gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // (WebGL 1 only allows clamping on pictures whose sides are not powers of two)
    var wrap = VZ.api === 2 ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.bindFramebuffer(gl.FRAMEBUFFER, VZ.fbo[i]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    VZ.tex[i] = t;
    if (VZ.isFloat && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      VZ.isFloat = false;                 // no high-precision pictures here: use ordinary ones
      vzTargets(w, h);
      return;
    }
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  VZ.w = w; VZ.h = h; VZ.cur = 0;
}

function vzProgFor(fx) {
  if (VZ.progs[fx.id]) return VZ.progs[fx.id];
  if (VZ.bad[fx.id]) return null;
  try {
    VZ.progs[fx.id] = vzProgram(VZ_HEAD + fx.src.join('\n') + VZ_MAIN);
  } catch (e) {
    VZ.bad[fx.id] = String(e && e.message || e).replace(/\s+/g, ' ').slice(0, 300) || 'could not start';
    VZ.errors.push(fx.id + ': ' + VZ.bad[fx.id]);
    dlog('visualizer: effect ' + fx.id + ' could not start: ' + VZ.bad[fx.id]);
    vzNote();
    return null;
  }
  return VZ.progs[fx.id];
}

function vzFrame(now) {
  VZ.raf = 0;
  if (!vzVisible()) return;
  VZ.raf = requestAnimationFrame(vzFrame);
  if (now - VZ.last < 11.5) return;                   // 60 to 85 pictures a second, however fast the screen is
  var dt = VZ.last ? Math.min(0.1, (now - VZ.last) / 1000) : 0.016;
  VZ.last = now;
  VZ.t += dt;
  VZ.since += dt;

  if (S.state === 'play') auWant(now);
  auFrame(now);

  // ripples: one per beat, or a slow drip when nothing is playing
  if (AU.hit || VZ.t - VZ.ringAt > (AU.mode === 'idle' ? 2.6 : 1.4)) {
    VZ.ringAt = VZ.t;
    VZ.rings.push({ x: (Math.random() * 2 - 1) * 0.8, y: (Math.random() * 2 - 1) * 0.7, t: VZ.t, s: AU.hit ? 0.8 + 0.5 * AU.bass : 0.45 });
    if (VZ.rings.length > 6) VZ.rings.shift();
  }
  // on AUTO: move on after a while, on a beat if one comes along
  if (VZ.auto && ui.vzMenu.hidden && VZ.since > 34 && (AU.hit || VZ.since > 42)) vzStep(1, true);

  var t0 = performance.now();
  if (vzStart()) vzDraw(); else if (VZ.dead) vzDraw2d();
  VZ.ms += (performance.now() - t0 - VZ.ms) * 0.1;
  VZ.frames++;
}

function vzSize() {
  var box = ui.vzScreen, cw = box.clientWidth, ch = box.clientHeight;
  if (cw < 8 || ch < 8) return null;
  var k = Math.min(window.devicePixelRatio || 1, 1.5);
  var w = Math.round(cw * k), h = Math.round(ch * k), over = (w * h) / 1400000;
  if (over > 1) { k = 1 / Math.sqrt(over); w = Math.round(w * k); h = Math.round(h * k); }
  var c = ui.vzCanvas;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return [w, h];
}

function vzDraw() {
  var gl = VZ.gl, size = vzSize(), fx, pr, tries = 0, u, i, r;
  if (!size) return;
  if (VZ.w !== size[0] || VZ.h !== size[1]) vzTargets(size[0], size[1]);

  fx = EFFECTS[vzEffectAt()];
  pr = vzProgFor(fx);
  while (!pr && ++tries <= EFFECTS.length) {            // an effect this card refuses: move on
    VZ.effect = EFFECTS[(vzEffectAt() + 1) % EFFECTS.length].id;
    fx = EFFECTS[vzEffectAt()];
    pr = vzProgFor(fx);
  }
  if (!pr) {
    if (VZ.api === 2 && !VZ.forceApi) {                  // perhaps they run in the older mode
      VZ.bad2 = true; VZ.bad = {};
      VZ.errors.push('no effect started with WebGL 2: trying WebGL 1');
      vzNewCanvas();
      return;
    }
    vzGiveUp('none of the effects could start on this graphics card (' + String(VZ.errors[VZ.errors.length - 1] || '').slice(0, 90) + ')');
    return;
  }

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, VZ.audioTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 4, VZ.audioFmt, gl.UNSIGNED_BYTE, AU.tex);

  var src = VZ.cur, dst = 1 - src;
  gl.bindFramebuffer(gl.FRAMEBUFFER, VZ.fbo[dst]);
  gl.viewport(0, 0, VZ.w, VZ.h);
  gl.useProgram(pr.p);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, VZ.tex[src]);
  u = pr.u;
  if (u.uPrev) gl.uniform1i(u.uPrev, 0);
  if (u.uAudio) gl.uniform1i(u.uAudio, 1);
  if (u.uRes) gl.uniform2f(u.uRes, VZ.w, VZ.h);
  if (u.uTime) gl.uniform1f(u.uTime, VZ.t);
  if (u.uBass) gl.uniform1f(u.uBass, AU.bass);
  if (u.uMid) gl.uniform1f(u.uMid, AU.mid);
  if (u.uTreb) gl.uniform1f(u.uTreb, AU.treb);
  if (u.uLevel) gl.uniform1f(u.uLevel, AU.level);
  if (u.uBeat) gl.uniform1f(u.uBeat, AU.beat);
  if (u.uFlow) gl.uniform1f(u.uFlow, AU.flow % 4096);
  if (u.uSeed) gl.uniform1f(u.uSeed, VZ.seed);
  if (u.uC1) gl.uniform3f(u.uC1, VZ.c1[0], VZ.c1[1], VZ.c1[2]);
  if (u.uC2) gl.uniform3f(u.uC2, VZ.c2[0], VZ.c2[1], VZ.c2[2]);
  if (u.uRing) {
    for (i = 0; i < 6; i++) {
      r = VZ.rings[i];
      VZ.ringData[i * 4] = r ? r.x * VZ.w / VZ.h : 0;
      VZ.ringData[i * 4 + 1] = r ? r.y : 0;
      VZ.ringData[i * 4 + 2] = r ? VZ.t - r.t : 0;
      VZ.ringData[i * 4 + 3] = r && VZ.t - r.t < 7 ? r.s : 0;
    }
    gl.uniform4fv(u.uRing, VZ.ringData);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, VZ.w, VZ.h);
  gl.useProgram(VZ.present.p);
  gl.bindTexture(gl.TEXTURE_2D, VZ.tex[dst]);
  if (VZ.present.u.uTex) gl.uniform1i(VZ.present.u.uTex, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  VZ.cur = dst;

  // Now and then: did the graphics card complain? Three times in a row and
  // this effect is put aside (and if that leaves none, the older mode or the
  // plain bars take over, saying why).
  if (VZ.frames % 30 === 0) {
    var err = gl.getError();
    if (!err) { VZ.glErrors = 0; return; }
    VZ.errors.push(fx.id + ': graphics error 0x' + err.toString(16) + ' while drawing');
    if (++VZ.glErrors >= 3) {
      VZ.glErrors = 0;
      VZ.bad[fx.id] = 'graphics error 0x' + err.toString(16) + ' while drawing';
      delete VZ.progs[fx.id];
      vzNote();
    }
  }
}

// Without WebGL: plain bars and a scope line.
function vzDraw2d() {
  var size = vzSize(), c = ui.vzCanvas, g, i, w, h, n = 48, t = themeNow();
  if (!size) return;
  try { g = c.getContext('2d'); } catch (e) { return; }
  if (!g) return;
  w = size[0]; h = size[1];
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.fillStyle = t.lcdFg;
  for (i = 0; i < n; i++) {
    var v = AU.spec[4 + Math.floor(i * 240 / n)], bh = Math.round(v * h * 0.8);
    g.fillRect(Math.round(i * w / n) + 1, h - bh, Math.max(1, Math.floor(w / n) - 2), bh);
  }
  g.strokeStyle = '#fff';
  g.lineWidth = Math.max(1, h / 300);
  g.beginPath();
  for (i = 0; i < 512; i++) {
    var y = h * 0.3 - AU.waveL[i] * h * 0.22;
    if (i) g.lineTo(i * w / 511, y); else g.moveTo(0, y);
  }
  g.stroke();
}

// ---- visualizer: choosing effects, messages on the picture ----
function vzSet(id, byUser) {
  var fx = null, i;
  for (i = 0; i < EFFECTS.length; i++) if (EFFECTS[i].id === id) fx = EFFECTS[i];
  if (!fx) return;
  // say so, rather than seeming to ignore the choice
  if (VZ.dead) { vzOsd(fx.jp, 'EFFECTS CANNOT RUN HERE - SEE THE NOTE ON THE PICTURE'); return; }
  if (VZ.bad[id]) { vzOsd(fx.jp, fx.name.toUpperCase() + ' CANNOT RUN ON THIS COMPUTER'); return; }
  VZ.effect = id;
  VZ.since = 0;
  if (byUser) store.set('vizEffect', id);
  vzOsd(fx.jp, fx.name.toUpperCase());
  vzMenuSync();
  vzKick();
}
function vzStep(d, auto) {
  var n = EFFECTS.length, i = vzEffectAt(), tries = 0;
  do { i = (i + d + n) % n; } while (VZ.bad[EFFECTS[i].id] && ++tries < n);
  vzSet(EFFECTS[i].id, !auto);
}
function vzSetAuto(on, keep) {
  VZ.auto = !!on;
  VZ.since = 0;
  if (keep !== false) store.set('vizAuto', VZ.auto);
  if (ui.vzAuto) {
    ui.vzAuto.setAttribute('data-on', VZ.auto ? '1' : '0');
    ui.vzAuto.setAttribute('aria-pressed', VZ.auto ? 'true' : 'false');
  }
}
function vzOsd(ja, en) {
  if (!ui.vzOsd) return;
  ui.vzOsdJp.textContent = ja || '';
  ui.vzOsdEn.textContent = en || '';
  ui.vzOsd.setAttribute('data-show', '1');
  clearTimeout(VZ.osdTimer);
  VZ.osdTimer = setTimeout(function () { ui.vzOsd.setAttribute('data-show', '0'); }, 2600);
}
// in the big view, name the song when it changes
function vzSongOsd() {
  if (!S.vizBig || !S.showViz) return;
  var info = itemInfo(nowItem());
  if (info.id) vzOsd('♪', (info.artist ? info.artist + ' - ' : '') + info.title);
}
function vzMenuSync() {
  if (!ui.vzMenu) return;
  var items = ui.vzMenu.querySelectorAll('[data-effect]'), i, id;
  for (i = 0; i < items.length; i++) {
    id = items[i].getAttribute('data-effect');
    items[i].setAttribute('aria-pressed', id === VZ.effect && !VZ.dead ? 'true' : 'false');
    if (VZ.bad[id] || VZ.dead) { items[i].setAttribute('data-bad', '1'); items[i].title = 'Cannot run on this computer: ' + (VZ.bad[id] || VZ.why); }
    else { items[i].removeAttribute('data-bad'); items[i].removeAttribute('title'); }
  }
}
function vzMenu(open) {
  if (!ui.vzMenu) return;
  ui.vzMenu.hidden = !open;
  if (open) vzMenuSync();
}
// LIVE = drawing the real sound, DEMO = the built-in tune stands in
function vzStatus() {
  if (!ui.vzSrc) return;
  var m = AU.mode, failed = AU.tapState.lastIndexOf('failed', 0) === 0;
  ui.vzSrc.textContent = m === 'live' ? 'LIVE' : m === 'demo' ? 'DEMO' : '';
  ui.vzSrc.setAttribute('data-s', m);
  ui.vzSrc.title = m === 'live' ? 'Moving with the sound the app is playing'
    : m === 'demo' ? 'The app cannot hear the music right now' + (failed ? ' (' + AU.tapState + ')' : '') + ', so a built-in animation is shown'
    : '';
}
// big view: the strip of keys hides while the mouse rests
function vzIdle(idle) {
  if (!ui.vzPanel) return;
  clearTimeout(VZ.idleTimer);
  ui.vzPanel.setAttribute('data-idle', idle ? '1' : '0');
  if (!idle && S.vizBig) VZ.idleTimer = setTimeout(function () { if (S.vizBig && ui.vzMenu.hidden) vzIdle(true); }, 2600);
}
function setVizBig(on) {
  on = !!on && deckShown();
  if (on && !S.showViz) setPanel('viz', true);
  S.vizBig = on;
  syncPanels();
  vzIdle(false);
  if (on) vzSongOsd();
  lyBigLine();
  vzKick();
}

// ============================================================================
// Lyrics
// Apple's own lyrics for the song that is playing, fetched the way Apple's
// page does. Most come timed line by line, many word by word; Japanese (and
// other non-Latin) songs can also carry a romanised reading and an English
// translation.
// ============================================================================

// ---- a precise clock for the current song ----
// The player only reports whole seconds. The <audio> element underneath knows
// the exact position, but on its own timeline (songs can be joined end to
// end), so the offset between the two is measured: at the moment the player's
// seconds tick over, the true position is that second minus a half (it rounds).
var CK = { el: null, off: 0, have: false, lastT: -1, hist: [] };
function mediaEl() {
  if (!CK.el || !CK.el.isConnected) CK.el = document.getElementById('apple-music-player');
  return CK.el;
}
function clockSample() {
  var m = S.music, el = mediaEl(), T, e;
  if (!m || !el) return;
  try { T = m.currentPlaybackTime; e = el.currentTime; } catch (x) { return; }
  if (typeof T !== 'number' || typeof e !== 'number' || isNaN(e)) return;
  if (!CK.have) { CK.hist = []; CK.off = e - T; }
  if (T === CK.lastT + 1 && !el.paused) {
    CK.hist.push(e - (T - 0.5));
    if (CK.hist.length > 6) CK.hist.shift();
    CK.off = Math.min.apply(null, CK.hist);       // the tick is noticed a little late, never early
    CK.have = true;
  }
  CK.lastT = T;
}
function songTime() {
  var m = S.music, el = mediaEl(), t = 0;
  try { t = (m && m.currentPlaybackTime) || 0; } catch (x) {}
  if (!el) return t;
  var p = el.currentTime - CK.off;
  return Math.abs(p - t) < 1.6 ? p : t;           // never far from what the player says
}

var LY = {
  roma: store.get('lyrRoma', true),     // show the romanised reading when there is one
  trans: store.get('lyrTrans', true),   // show the translation when there is one
  key: '',              // id of the song the panel is showing
  state: 'idle',        // idle | empty (nothing playing) | loading | ready | none | error
  data: null,           // {lines, synced, hasRo, hasTr, writers, lang}
  cache: {}, cached: [],
  token: 0, rows: [], active: -1, raf: 0, last: 0, userAt: -1e9
};

function lyVisible() { return !!ui.lyPanel && S.showLyr && deckShown(); }
function lyKick() {
  if (!LY.raf && lyVisible() && S.seen && LY.data && LY.data.synced && !document.hidden) LY.raf = requestAnimationFrame(lyFrame);
}

function ttTime(s) {                    // "5.932", "1:21.726", "1:02:03.5" -> seconds
  if (!s) return -1;
  var parts = String(s).split(':'), t = 0, i;
  for (i = 0; i < parts.length; i++) t = t * 60 + (parseFloat(parts[i]) || 0);
  return t;
}

// Apple sends lyrics as TTML (an XML subtitle format).
function parseTtml(xml) {
  var doc;
  try { doc = new DOMParser().parseFromString(xml, 'text/xml'); } catch (e) { return null; }
  if (!doc || !doc.documentElement || doc.getElementsByTagName('parsererror').length) return null;
  var root = doc.documentElement, timing = root.getAttribute('itunes:timing') || '';
  function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  // translations and romanised readings, by line key
  var tr = {}, ro = {};
  each(doc.getElementsByTagName('translation'), function (t) {
    each(t.getElementsByTagName('text'), function (x) { tr[x.getAttribute('for')] = clean(x.textContent); });
  });
  each(doc.getElementsByTagName('transliteration'), function (t) {
    each(t.getElementsByTagName('text'), function (x) { ro[x.getAttribute('for')] = clean(x.textContent); });
  });

  var lines = [], firstAgent = '', hasRo = false, hasTr = false;
  each(doc.getElementsByTagName('p'), function (p) {
    var parts = [], text = '';
    (function walk(node, bg) {
      each(node.childNodes, function (ch) {
        if (ch.nodeType === 3) {
          var s = ch.data.replace(/\s+/g, ' ');
          if (s) { parts.push({ t: s, b: -1, e: -1, bg: bg }); text += s; }
          return;
        }
        if (ch.nodeType !== 1) return;
        var b = ch.getAttribute('begin');
        if (b && !ch.getElementsByTagName('span').length) {
          parts.push({ t: ch.textContent, b: ttTime(b), e: ttTime(ch.getAttribute('end')), bg: bg });
          text += ch.textContent;
        } else {
          walk(ch, bg || ch.getAttribute('ttm:role') === 'x-bg');
        }
      });
    })(p, false);
    text = clean(text);
    if (!text) return;
    var key = p.getAttribute('itunes:key') || '', agent = p.getAttribute('ttm:agent') || '';
    if (agent && !firstAgent) firstAgent = agent;
    var same = function (a) { return a.toLowerCase() === text.toLowerCase(); };
    var ln = {
      b: ttTime(p.getAttribute('begin')), e: ttTime(p.getAttribute('end')), t: text,
      parts: parts.some(function (x) { return x.b >= 0; }) ? parts : null,
      ro: ro[key] && !same(ro[key]) ? ro[key] : '',
      tr: tr[key] && !same(tr[key]) ? tr[key] : '',
      side: agent && agent !== firstAgent && agent !== 'v1000' ? 'r' : ''     // a second singer sits on the right
    };
    if (ln.ro) hasRo = true;
    if (ln.tr) hasTr = true;
    lines.push(ln);
  });
  if (!lines.length) return null;
  var synced = timing !== 'None' && lines.every(function (l) { return l.b >= 0; });

  // a row of dots for the intro and for long stretches without words
  var out = [], prevEnd = 0;
  lines.forEach(function (l, i) {
    if (synced && l.b - prevEnd > (i === 0 ? 4 : 8))
      out.push({ b: i === 0 ? 0 : prevEnd + 0.5, e: l.b, t: '', gap: true, parts: null, ro: '', tr: '', side: '' });
    out.push(l);
    prevEnd = Math.max(l.b, l.e);
  });

  var writers = [];
  each(doc.getElementsByTagName('songwriter'), function (w) { var s = clean(w.textContent); if (s) writers.push(s); });
  return { lines: out, synced: synced, hasRo: hasRo, hasTr: hasTr, writers: writers, lang: root.getAttribute('xml:lang') || '' };
}

function lyFetch(cid) {
  var sf = 'us';
  try { sf = S.music.storefrontId || 'us'; } catch (e) {}
  var q = { 'l[lyrics]': 'en-US', 'l[script]': 'en-Latn', extend: 'ttmlLocalizations' };
  function get(kind) {
    return api('/v1/catalog/' + sf + '/songs/' + cid + '/' + kind, q).then(function (d) {
      var a = d && d.data && d.data[0] && d.data[0].attributes;
      var xml = a && (a.ttmlLocalizations || a.ttml);
      return xml ? parseTtml(xml) : null;
    });
  }
  // word-by-word first; songs that only have line timing (or none) answer the plain request
  return get('syllable-lyrics').then(function (r) { return r || get('lyrics'); }, function () { return get('lyrics'); });
}

function lyMsg(big, small, key) {
  LY.data = null;
  LY.rows = [];
  LY.active = -1;
  ui.lyBody.replaceChildren(h('div', { class: 'mpl-msg' }, h('div', { class: 'big', text: big }), small ? h('div', { text: small }) : null, key || null));
  ui.lyBody.scrollTop = 0;
  ui.lyPanel.setAttribute('data-synced', '0');
  ui.lyRo.hidden = ui.lyTr.hidden = true;
  lyBigLine();
}
function lyNone() {
  LY.state = 'none';
  lyMsg('NO LYRICS FOR THIS SONG', '歌詞なし');
}

// Show the lyrics of the song that is playing (fetching them if need be).
function lyRefresh(force) {
  if (!ui.lyPanel || LY.hold) return;          // (LY.hold, LY.testItem: for tests)
  // not on screen: a forced refresh (signed in, say) is done when it is shown again
  if (!lyVisible()) { if (force) LY.state = 'idle'; return; }
  var it = LY.testItem || nowItem(), info = itemInfo(it);
  if (!it) {
    if (LY.state === 'empty') return;
    LY.key = ''; LY.state = 'empty'; LY.token++;
    lyMsg('NOTHING PLAYING', 'Lyrics show up here when a song with lyrics plays.');
    return;
  }
  if (!force && LY.key === info.id && LY.state !== 'idle') return;
  LY.key = info.id;
  LY.token++;
  if (!authorized()) { LY.state = 'none'; lyMsg('SIGN IN TO SEE LYRICS', 'Lyrics come with an Apple Music subscription.'); return; }
  var cid = info.cid || (/^\d+$/.test(info.id) ? info.id : ''), has = null;
  try { has = it.attributes.hasLyrics; } catch (e) {}
  if (!cid || has === false) { lyNone(); return; }
  if (LY.cache[cid] !== undefined) { if (LY.cache[cid]) lyShow(LY.cache[cid]); else lyNone(); return; }

  LY.state = 'loading';
  lyMsg('LOADING LYRICS', '読込中');
  var tok = LY.token;
  lyFetch(cid).then(function (data) {
    LY.cache[cid] = data || null;
    LY.cached.push(cid);
    if (LY.cached.length > 40) delete LY.cache[LY.cached.shift()];
    if (tok !== LY.token) return;
    if (data) lyShow(data); else lyNone();
  }, function (e) {
    if (tok !== LY.token) return;
    if (/40[34]|not found|no related/i.test(errText(e))) { lyNone(); return; }
    // a network hiccup: ask again by itself, twice, before giving up
    if (LY.triesFor !== cid) { LY.triesFor = cid; LY.tries = 0; }
    if (++LY.tries < 3) {
      setTimeout(function () { if (tok === LY.token) lyRefresh(true); }, 4000 * LY.tries);
      return;
    }
    LY.state = 'error';
    lyMsg('COULD NOT LOAD LYRICS', errText(e), textKey('lyrretry', 'TRY AGAIN', null, 'Ask for the lyrics again'));
  });
}

function lyShow(data) {
  LY.data = data;
  LY.state = 'ready';
  LY.active = -1;
  LY.rows = [];
  var frag = document.createDocumentFragment();
  data.lines.forEach(function (ln, i) {
    var t = h('div', { class: 'mpl-t' }), words = null;
    if (ln.gap) { t.appendChild(h('i')); t.appendChild(h('i')); t.appendChild(h('i')); }
    else if (ln.parts) {
      words = [];
      ln.parts.forEach(function (x) {
        if (x.b < 0) { t.appendChild(document.createTextNode(x.t)); return; }
        var w = h('span', { class: x.bg ? 'w bg' : 'w', text: x.t });
        t.appendChild(w);
        words.push({ el: w, b: x.b, e: Math.max(x.e, x.b + 0.05), p: -1 });
      });
    } else t.textContent = ln.t;
    var row = h('div', { class: 'mpl-line', 'data-i': String(i), 'data-gap': ln.gap ? '1' : null, 'data-side': ln.side || null, lang: data.lang || null },
      t, ln.ro ? h('div', { class: 'mpl-ro', lang: 'en', text: ln.ro }) : null, ln.tr ? h('div', { class: 'mpl-tr', lang: 'en', text: ln.tr }) : null);
    row._w = words;
    frag.appendChild(row);
    LY.rows.push(row);
  });
  if (data.writers.length) frag.appendChild(h('div', { class: 'mpl-credit', text: 'Written by ' + data.writers.join(', ') }));
  if (!data.synced) frag.appendChild(h('div', { class: 'mpl-credit', text: 'These lyrics are not timed, so they do not follow the song.' }));
  ui.lyBody.replaceChildren(frag);
  ui.lyBody.scrollTop = 0;
  ui.lyPanel.setAttribute('data-synced', data.synced ? '1' : '0');
  ui.lyRo.hidden = !data.hasRo;
  ui.lyTr.hidden = !data.hasTr;
  lySyncKeys();
  lyBigLine();                        // (the big view may still show the previous song's line)
  LY.userAt = -1e9;
  lyKick();
}

function lySyncKeys() {
  if (!ui.lyPanel) return;
  ui.lyPanel.setAttribute('data-roma', LY.roma ? '1' : '0');
  ui.lyPanel.setAttribute('data-trans', LY.trans ? '1' : '0');
  [[ui.lyRo, LY.roma], [ui.lyTr, LY.trans]].forEach(function (x) {
    x[0].setAttribute('data-on', x[1] ? '1' : '0');
    x[0].setAttribute('aria-pressed', x[1] ? 'true' : 'false');
  });
}

// Follow the song: light the line being sung, fill its words, keep it in view.
function lyFrame(now) {
  LY.raf = 0;
  if (!lyVisible() || !S.seen || !LY.data || !LY.data.synced || document.hidden) return;
  LY.raf = requestAnimationFrame(lyFrame);
  if (now - LY.last < 30) return;
  LY.last = now;
  clockSample();
  // (LY.testTime: a made-up position, so the following can be checked without playing)
  var L = LY.data.lines, t = (typeof LY.testTime === 'number' ? LY.testTime : songTime()) + 0.06, i = LY.active, lo, hi, mid;
  if (i < 0 || i >= L.length || t < L[i].b || (i + 1 < L.length && t >= L[i + 1].b)) {
    lo = 0; hi = L.length - 1; i = -1;
    while (lo <= hi) { mid = (lo + hi) >> 1; if (L[mid].b <= t) { i = mid; lo = mid + 1; } else hi = mid - 1; }
  }
  // past the end of the last line: the outro, nothing is being sung
  if (i === L.length - 1 && !L[i].gap && L[i].e > L[i].b && t > L[i].e + 0.5) i = -1;
  if (i !== LY.active) lySetActive(i, now);
  var row = i >= 0 ? LY.rows[i] : null, ws = row && row._w, k, w, p;
  if (ws) {
    for (k = 0; k < ws.length; k++) {
      w = ws[k];
      p = t >= w.e ? 1 : t <= w.b ? 0 : (t - w.b) / (w.e - w.b);
      if (p !== w.p) { w.p = p; w.el.style.setProperty('--p', p.toFixed(3)); }
    }
  }
}

function lySetActive(i, now) {
  var old = LY.rows[LY.active], row = i >= 0 ? LY.rows[i] : null;
  if (old) old.removeAttribute('data-on');
  LY.active = i;
  if (row) {
    row.setAttribute('data-on', '1');
    // leave the list alone for a moment after the listener scrolled it themselves
    if (now - LY.userAt > 3500) {
      var body = ui.lyBody, top = row.offsetTop - (body.clientHeight - row.offsetHeight) * 0.36;
      try { body.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); } catch (e) { body.scrollTop = Math.max(0, top); }
    }
  }
  lyBigLine();
}

// The line being sung, laid over the big visualizer.
function lyBigLine() {
  if (!ui.vzLyric) return;
  var ln = S.vizBig && S.showLyr && LY.data && LY.data.synced && LY.active >= 0 ? LY.data.lines[LY.active] : null;
  if (!ln || ln.gap) { ui.vzLyric.setAttribute('data-show', '0'); return; }
  ui.vzLyricT.textContent = ln.t;
  ui.vzLyricS.textContent = (LY.roma && ln.ro) || (LY.trans && ln.tr) || '';
  ui.vzLyric.setAttribute('data-show', '1');
}

function onLyricsClick(e) {
  var key = e.target.closest && e.target.closest('[data-act]');
  if (key) { onActClick(e); return; }
  var row = e.target.closest && e.target.closest('.mpl-line');
  if (!row || !LY.data || !LY.data.synced) return;
  var ln = LY.data.lines[+row.getAttribute('data-i')];
  if (!ln || ln.gap) return;
  LY.userAt = -1e9;
  call('seekToTime', Math.max(0, ln.b + 0.01));
}

// ============================================================================
// Library data. Everything comes from the page's MusicKit instance
// (music.api.music), i.e. the same requests Apple's own pages make. Results
// are kept in memory, and the big lists are also saved locally so the next
// start shows them at once and refreshes them in the background.
// ============================================================================
var DB = {
  playlists: null,      // [{id, n, art}]
  recent: null,         // [{id, kind, n, a, art}]
  albums: null,         // [{id, kind:'album', n, a, art, tc}]
  artists: null,        // [{id, n}]
  songs: [],            // [{id, cid, n, a, al, d, art, tn}] - may have holes while loading
  songsTotal: -1,
  songsState: 'idle',   // idle | loading | done
  tracks: {},           // 'playlist:<id>' / 'album:<id>' -> songs
  artistAlbums: {},     // artist id -> albums
  busy: {}
};

function api(path, params) {
  var m = S.music;
  if (!m || !m.api || typeof m.api.music !== 'function') return Promise.reject(new Error('player not ready'));
  return m.api.music(path, params || {}).then(function (res) { return (res && res.data) || {}; });
}

function packSong(x) {
  var a = x.attributes || {}, pp = a.playParams || {};
  return { id: x.id, cid: pp.catalogId ? String(pp.catalogId) : '', n: a.name || 'Unknown', a: a.artistName || '',
           al: a.albumName || '', d: Math.round((a.durationInMillis || 0) / 1000),
           art: (a.artwork && a.artwork.url) || '', tn: a.trackNumber || 0 };
}
function packTile(x) {      // albums and playlists, library or catalog
  var a = x.attributes || {}, isPl = /playlists$/.test(x.type || '');
  var t = { id: x.id, kind: isPl ? 'playlist' : 'album', n: a.name || 'Untitled',
            a: a.artistName || a.curatorName || '', art: (a.artwork && a.artwork.url) || '', tc: a.trackCount || 0 };
  if (isPl && typeof a.canEdit === 'boolean') t.ed = a.canEdit;      // can songs be added to it
  return t;
}
function packArtist(x) { return { id: x.id, n: (x.attributes && x.attributes.name) || 'Unknown' }; }

// Every page of a list, 100 at a time. onChunk is called as pages arrive.
function fetchAll(path, params, pack, onChunk) {
  var out = [];
  function page(offset) {
    var p = { limit: 100, offset: offset }, k;
    for (k in (params || {})) p[k] = params[k];
    return api(path, p).then(function (d) {
      var arr = (d.data || []).map(pack);
      out = out.concat(arr);
      if (onChunk) onChunk(out);
      return (d.next && arr.length) ? page(offset + arr.length) : out;
    });
  }
  return page(0);
}

// Run a loader once at a time per key.
function once(key, fn) {
  if (DB.busy[key]) return DB.busy[key];
  var p = fn().then(function (v) { delete DB.busy[key]; return v; }, function (e) { delete DB.busy[key]; throw e; });
  DB.busy[key] = p;
  return p;
}

function loadPlaylists() {
  return once('playlists', function () {
    return fetchAll('/v1/me/library/playlists', {}, packTile).then(function (list) {
      DB.playlists = list;
      store.set('c.playlists', list);
      renderNavPlaylists();
      return list;
    });
  });
}
function loadRecent() {
  return once('recent', function () {
    return api('/v1/me/library/recently-added', { limit: 25 }).then(function (d) {
      var first = (d.data || []).map(packTile);
      if (!d.next) return first;
      return api('/v1/me/library/recently-added', { limit: 25, offset: 25 })
        .then(function (d2) { return first.concat((d2.data || []).map(packTile)); }, function () { return first; });
    }).then(function (list) { DB.recent = list; store.set('c.recent', list); return list; });
  });
}
function loadAlbums(onChunk) {
  return once('albums', function () {
    return fetchAll('/v1/me/library/albums', {}, packTile, DB.albums ? null : onChunk).then(function (list) {
      DB.albums = list; store.set('c.albums', list); return list;
    });
  });
}
function loadArtists(onChunk) {
  return once('artists', function () {
    return fetchAll('/v1/me/library/artists', {}, packArtist, DB.artists ? null : onChunk).then(function (list) {
      DB.artists = list; store.set('c.artists', list); return list;
    });
  });
}

// All songs: the first page tells how many there are, the rest are fetched
// three pages at a time. With a saved copy on screen the fresh list replaces
// it once complete; without one, rows fill in as pages arrive.
function loadSongs(onProgress) {
  if (DB.songsState !== 'idle') return;
  DB.songsState = 'loading';
  var haveCopy = DB.songs.length > 0;
  api('/v1/me/library/songs', { limit: 100, offset: 0 }).then(function (d) {
    var total = (d.meta && d.meta.total) || (d.data || []).length;
    var fresh = new Array(total);
    function put(offset, data) { for (var i = 0; i < data.length; i++) fresh[offset + i] = packSong(data[i]); }
    put(0, d.data || []);
    function show() {
      if (!haveCopy) { DB.songs = fresh; DB.songsTotal = total; if (onProgress) onProgress(); }
    }
    show();
    var offsets = [], o;
    for (o = 100; o < total; o += 100) offsets.push(o);
    var failed = 0;
    function worker() {
      if (!offsets.length) return Promise.resolve();
      var off = offsets.shift();
      return api('/v1/me/library/songs', { limit: 100, offset: off })
        .then(function (dd) { put(off, dd.data || []); show(); }, function () { failed++; })
        .then(worker);
    }
    return Promise.all([worker(), worker(), worker()]).then(function () {
      DB.songs = fresh;
      DB.songsTotal = total;
      DB.songsState = failed ? 'idle' : 'done';
      if (!failed) saveSongs();
      if (onProgress) onProgress();
    });
  }).catch(function () { DB.songsState = 'idle'; if (onProgress) onProgress(); });
}

// Songs are saved as plain arrays to keep the copy small.
function saveSongs() {
  var rows = [];
  for (var i = 0; i < DB.songs.length; i++) {
    var s = DB.songs[i];
    if (!s) return;
    rows.push([s.id, s.cid, s.n, s.a, s.al, s.d, s.art, s.tn]);
  }
  if (!store.set('c.songs', rows)) store.del('c.songs');   // too big for local storage: go without
}
function readCache() {
  DB.playlists = store.get('c.playlists', null);
  DB.recent = store.get('c.recent', null);
  DB.albums = store.get('c.albums', null);
  DB.artists = store.get('c.artists', null);
  var rows = store.get('c.songs', null);
  if (rows && rows.length) {
    DB.songs = rows.map(function (r) { return { id: r[0], cid: r[1], n: r[2], a: r[3], al: r[4], d: r[5], art: r[6], tn: r[7] }; });
    DB.songsTotal = DB.songs.length;
  }
}
function dropCache() {
  ['c.playlists', 'c.recent', 'c.albums', 'c.artists', 'c.songs'].forEach(store.del);
  DB.playlists = DB.recent = DB.albums = DB.artists = null;
  DB.songs = []; DB.songsTotal = -1; DB.songsState = 'idle'; DB.tracks = {}; DB.artistAlbums = {};
}

function isLibId(kind, id) { return kind === 'playlist' ? /^p\./.test(id) : /^l\./.test(id); }
function tracksPath(kind, id) {
  var sf = 'us';
  try { sf = S.music.storefrontId || 'us'; } catch (e) {}
  var lib = isLibId(kind, id), coll = kind === 'playlist' ? 'playlists' : 'albums';
  return (lib ? '/v1/me/library/' : '/v1/catalog/' + sf + '/') + coll + '/' + id + '/tracks';
}
function loadTracks(kind, id, onChunk) {
  var key = kind + ':' + id;
  if (DB.tracks[key]) return Promise.resolve(DB.tracks[key]);
  return once('t:' + key, function () {
    return fetchAll(tracksPath(kind, id), {}, packSong, onChunk)
      .then(function (list) { DB.tracks[key] = list; return list; });
  });
}

// ============================================================================
// Browser (the big display in the full face)
// ============================================================================

// A list that only builds the rows that are on screen, so thousands of songs
// scroll as easily as twenty.
function VList(scroller, makeRow, bindRow) {
  var self = this;
  this.el = scroller;
  this.count = 0;
  this.live = {};
  this.pool = [];
  this.make = makeRow;
  this.bind = bindRow;
  this.raf = 0;
  this.space = h('div', { class: 'mpv-space' });
  scroller.replaceChildren(this.space);
  // While the list is being flung, rows skip their artwork (this.fast) and
  // get it once the scrolling settles - that is what keeps a fling smooth.
  this.fast = false;
  this.lastTop = 0;
  this.settle = 0;
  this.onScroll = function () {
    if (self.raf) return;
    self.raf = requestAnimationFrame(function () {
      self.raf = 0;
      var top = self.el.scrollTop;
      var flung = Math.abs(top - self.lastTop) > ROW_H * 5;
      self.lastTop = top;
      if (flung) {
        self.fast = true;
        clearTimeout(self.settle);
        self.settle = setTimeout(function () { self.fast = false; self.update(true); }, 130);
      }
      self.update(false);
    });
  };
  scroller.addEventListener('scroll', this.onScroll, { passive: true });
}
VList.prototype.setCount = function (n) {
  this.count = n;
  this.space.style.height = (n * ROW_H) + 'px';
  this.update(true);
};
VList.prototype.update = function (rebind) {
  var top = this.el.scrollTop, view = this.el.clientHeight || 700;
  var first = Math.max(0, Math.floor(top / ROW_H) - 8);
  var last = Math.min(this.count - 1, Math.ceil((top + view) / ROW_H) + 8);
  var k, i, el;
  for (k in this.live) {
    i = +k;
    if (i < first || i > last) { el = this.live[k]; delete this.live[k]; el.style.display = 'none'; this.pool.push(el); }
  }
  for (i = first; i <= last; i++) {
    el = this.live[i];
    if (!el) {
      el = this.pool.pop() || this.make();
      if (!el.parentNode) this.space.appendChild(el);
      el.style.display = '';
      el.style.transform = 'translateY(' + (i * ROW_H) + 'px)';
      el.setAttribute('data-i', String(i));
      this.live[i] = el;
      this.bind(el, i);
    } else if (rebind) {
      this.bind(el, i);
    }
  }
};
VList.prototype.reveal = function (i) {
  var top = i * ROW_H, view = this.el.clientHeight || 700;
  if (top < this.el.scrollTop) this.el.scrollTop = top;
  else if (top + ROW_H > this.el.scrollTop + view) this.el.scrollTop = top + ROW_H - view;
};
VList.prototype.destroy = function () {
  this.el.removeEventListener('scroll', this.onScroll);
  if (this.raf) cancelAnimationFrame(this.raf);
  clearTimeout(this.settle);
};

var B = {
  view: null,     // what the browser is showing: {kind, ...}
  hist: [],       // where "back" goes
  token: 0,       // bumps on every navigation; late answers for an old view are dropped
  vlist: null,
  items: null,    // rows of the current table
  numbered: false,
  sel: -1,
  play: null,     // function (index) for the current table
  shuffle: null,
  secs: {},       // search results: section name -> {items, play}
  tiles: null,    // items behind the tiles on screen
  searchTimer: 0
};

function viewKey(v) {
  if (!v) return '';
  if (v.kind === 'playlist' || v.kind === 'album' || v.kind === 'artist') return v.kind + ':' + v.id;
  if (v.kind === 'search') return 'search:' + v.term;
  return v.kind;
}
function go(view) {
  // (one search replacing another as it is typed is not kept; results that
  // were left by opening something from them are, so Back returns to them)
  if (B.view && viewKey(B.view) !== viewKey(view) && !(B.view.kind === 'search' && view.kind === 'search')) {
    B.hist.push(B.view);
    if (B.hist.length > 40) B.hist.shift();
  }
  B.view = view;
  B.navAt = performance.now();
  renderView();
}
function goBack() {
  var v = B.hist.pop();
  if (!v) return;
  if (ui.search) ui.search.value = v.kind === 'search' ? v.term : '';
  B.view = v;
  B.navAt = performance.now();
  renderView();
}

function clearBody(kind) {
  closeMenu();
  if (B.vlist) { B.vlist.destroy(); B.vlist = null; }
  B.items = null; B.play = null; B.shuffle = null; B.sel = -1; B.secs = {}; B.tiles = null;
  ui.browser.setAttribute('data-kind', kind);
  ui.bBody.className = 'mpb-body';
  ui.bBody.replaceChildren();
  ui.bBody.scrollTop = 0;
}

// head: {title, jp, meta, art, canPlay}
function setHead(o) {
  ui.bBack.hidden = !B.hist.length;
  ui.bTitle.textContent = o.title || '';
  ui.bTitleJp.textContent = o.jp || '';
  ui.bMeta.textContent = o.meta || '';
  if (o.art) { ui.bArt.setAttribute('src', artUrl(o.art, 56)); ui.bArt.hidden = false; }
  else { ui.bArt.hidden = true; ui.bArt.removeAttribute('src'); }
  ui.bPlay.disabled = ui.bShuffle.disabled = !o.canPlay;
  ui.bActions.style.display = o.hideActions ? 'none' : '';
  syncAddKey();
}
function setMeta(text) { ui.bMeta.textContent = text; }

function showMsg(big, small, key) {
  clearBody('msg');
  var box = h('div', { class: 'mpb-msg' }, h('div', { class: 'big', text: big }), small ? h('div', { text: small }) : null, key || null);
  ui.bBody.appendChild(box);
}

function sumDur(items) {
  var t = 0;
  for (var i = 0; i < items.length; i++) if (items[i]) t += items[i].d || 0;
  return t;
}
function songsMeta(n, items) { return n + '曲' + (items && items.length ? ' / ' + fmt(sumDur(items)) : ''); }

// ---- track table ----
function makeTrackRow() {
  return h('div', { class: 'mpr', role: 'row' },
    h('span', { class: 'n' }, h('img', { class: 'mpr-art', alt: '', decoding: 'async' }), h('span', { class: 'mpr-num' })),
    h('span', { class: 't' }), h('span', { class: 'a' }), h('span', { class: 'al' }), h('span', { class: 'd' }),
    // keys that show while the pointer is on the row (or the row is selected)
    h('span', { class: 'x' },
      h('button', { class: 'mpr-key', type: 'button', 'data-row': 'add', title: 'Add to your library', 'aria-label': 'Add to your library' }, svg(I.plus)),
      h('button', { class: 'mpr-key', type: 'button', 'data-row': 'menu', title: 'More: play next, add to a playlist ... (or right-click the row)', 'aria-label': 'More' }, svg(I.more))));
}
// the song a row stands for, and what double-clicking it would do
function rowSong(row) {
  if (!row) return null;
  var i = +row.getAttribute('data-i'), sec = row.getAttribute('data-sec');
  if (sec) return (B.secs[sec] && B.secs[sec].items && B.secs[sec].items[i]) || null;
  return (B.items && B.items[i]) || null;
}
function rowPlay(row) {
  var i = +row.getAttribute('data-i'), sec = row.getAttribute('data-sec');
  if (sec) return B.secs[sec] && B.secs[sec].play ? function () { B.secs[sec].play(i); } : null;
  return B.play ? function () { B.play(i); } : null;
}
function isCurrent(s) {
  var c = B.cur;
  if (!c || !s) return false;
  return s.id === c.id || (!!s.cid && (s.cid === c.id || s.cid === c.cid)) || (!!c.cid && s.id === c.cid);
}
function fillTrackRow(el, s, i, numbered, selected, skipArt) {
  var c = el.children, img = c[0].firstChild;
  if (!s) {
    el.setAttribute('data-empty', '1');
    img.removeAttribute('src');
    c[0].lastChild.textContent = '';
    c[1].textContent = '. . .';
    c[2].textContent = c[3].textContent = c[4].textContent = '';
    el.removeAttribute('data-cur');
    el.removeAttribute('data-sel');
    el.removeAttribute('data-lib');
    return;
  }
  el.removeAttribute('data-empty');
  if (numbered) { el.setAttribute('data-num', '1'); c[0].lastChild.textContent = String(s.tn || i + 1); }
  else {
    el.removeAttribute('data-num');
    var src = skipArt ? '' : artUrl(s.art, 26);
    if ((img.getAttribute('src') || '') !== src) { if (src) img.setAttribute('src', src); else img.removeAttribute('src'); }
  }
  c[1].textContent = s.n;
  c[2].textContent = s.a;
  c[3].textContent = s.al;
  c[4].textContent = s.d ? fmt(s.d) : '';
  if (isCurrent(s)) el.setAttribute('data-cur', '1'); else el.removeAttribute('data-cur');
  if (selected) el.setAttribute('data-sel', '1'); else el.removeAttribute('data-sel');
  rowFlag(el, s);
}
function bindTrackRow(el, i) {
  fillTrackRow(el, B.items && B.items[i], i, B.numbered, i === B.sel, !!(B.vlist && B.vlist.fast));
}

// o: {items, total, numbered, play(i), shuffle()}
function showTable(o) {
  // a list is reused only for the same view (a refresh), never for another
  // one, which would inherit its selection and scroll position
  if (!B.vlist || ui.browser.getAttribute('data-kind') !== 'table' || B.tableKey !== viewKey(B.view)) {
    clearBody('table');
    B.vlist = new VList(ui.bBody, makeTrackRow, bindTrackRow);
    B.tableKey = viewKey(B.view);
  }
  B.items = o.items;
  B.numbered = !!o.numbered;
  B.play = o.play;
  B.shuffle = o.shuffle;
  // an album's own page has no use for the album column
  ui.browser.setAttribute('data-numbered', o.numbered ? '1' : '0');
  B.vlist.setCount(o.total);
}

function markBrowserCurrent() {
  var m = S.music, it = null;
  try { it = m && m.nowPlayingItem; } catch (e) {}
  var info = itemInfo(it);
  B.cur = it ? { id: info.id, cid: info.cid } : null;
  if (S.mode !== 'full' || !ui.bBody) return;
  if (B.vlist) { B.vlist.update(true); return; }
  var rows = ui.bBody.querySelectorAll('.mpr[data-sec]');
  for (var i = 0; i < rows.length; i++) {
    var sec = B.secs[rows[i].getAttribute('data-sec')];
    var s = sec && sec.items[+rows[i].getAttribute('data-i')];
    if (isCurrent(s)) rows[i].setAttribute('data-cur', '1'); else rows[i].removeAttribute('data-cur');
  }
}

// ---- tiles ----
function makeTile(t, i, sec) {
  var sub = t.kind === 'playlist' && !t.a ? jp('プレイリスト') : h('span', { text: t.a });
  var img = h('img', { alt: '', loading: 'lazy', decoding: 'async' });
  if (t.art) img.setAttribute('src', artUrl(t.art, 150));
  else if (__MP_ICON) img.setAttribute('src', __MP_ICON);
  return h('button', { class: 'mpg-tile', type: 'button', 'data-i': String(i), 'data-sec': sec || null, title: t.n },
    img, h('span', { class: 'nm', text: t.n }), h('span', { class: 'sb' }, sub));
}
function showTiles(items) {
  clearBody('tiles');
  B.tiles = items;
  var grid = h('div', { class: 'mpg' });
  for (var i = 0; i < items.length; i++) grid.appendChild(makeTile(items[i], i));
  ui.bBody.appendChild(grid);
}
function openTile(t) {
  if (!t) return;
  go({ kind: t.kind, id: t.id, name: t.n, artist: t.a, art: t.art });
}

// ---- playing things ----
function shuffleOn() {
  var m = S.music, mk = MK();
  try {
    return S.shuffleHeld || (!!m && !!mk && !!mk.PlayerShuffleMode && m.shuffleMode !== mk.PlayerShuffleMode.off);
  } catch (e) { return false; }
}

// shuffle true / false: set the shuffle switch first (the SHUFFLE keys do).
// Left out: the listener picked one particular song, and that song has to
// play first whatever the switch says.
function startQueue(opts, shuffle) {
  var m = S.music, mk = MK();
  if (!m) return;
  // Starts run one after another (two at once trip the player up); when
  // several are waiting, only the newest is carried out.
  var tok = ++S.startTok;
  S.starting = S.starting.then(function () {
    return tok === S.startTok ? startNow(m, mk, opts, shuffle) : null;
  });
}

function reallyPlaying() {
  var s = stateName();
  return !!nowItem() && s !== 'none' && s !== 'stopped' && s !== 'ended' && s !== 'completed';
}

// Ask the player to play what is queued - and make sure it does. A start that
// comes within about a third of a second of the previous one falls flat: the
// player answers "ok" and plays nothing. Asking again a moment later works.
// (since: when this start was asked for; a Stop or Pause after that ends it.)
function playForSure(m, since) {
  var tries = 0;
  function attempt() {
    return Promise.resolve().then(function () { return m.play(); }).then(function () {
      if (!reallyPlaying() && tries === 4 && S.haltAt <= since) dlog('start: nothing playing after 5 tries, state ' + stateName());
      if (reallyPlaying() || ++tries > 4 || S.haltAt > since) return null;
      return new Promise(function (go) { setTimeout(go, 300); }).then(function () {
        return (reallyPlaying() || S.haltAt > since) ? null : attempt();
      });
    });
  }
  return attempt();
}

function startNow(m, mk, opts, shuffle) {
  var PM = mk && mk.PlayerShuffleMode, resume = false, settled = false, since = performance.now();
  dlog('start: ' + Object.keys(opts).map(function (k) { return k === 'songs' ? 'songs x' + opts.songs.length : k; }).join(' ') + ', state ' + stateName());
  try {
    if (PM && shuffle !== undefined) m.shuffleMode = shuffle ? PM.songs : PM.off;
    else if (PM && m.shuffleMode !== PM.off) {
      // Shuffle is on and one song was picked. Handed over like that, the
      // player shuffles the list and then starts at the picked song's old
      // *position* - on some other song. So: queue in order with shuffle off,
      // start the picked song, and only then switch shuffle back on. That
      // keeps what is playing and shuffles everything else behind it.
      resume = true;
      S.shuffleHeld = true;            // the SHUFFLE lamp stays lit meanwhile
      m.shuffleMode = PM.off;
    }
  } catch (e) {}
  function settle() {
    if (settled) return;
    settled = true;
    if (!resume || !S.shuffleHeld) return;        // (the listener may have switched shuffle off meanwhile)
    S.shuffleHeld = false;
    try { m.shuffleMode = PM.songs; } catch (e) {}
    refreshModes();
  }
  var work = Promise.resolve()
    .then(function () { return m.setQueue(opts); })
    .then(function () { return playForSure(m, since); })
    .then(settle, function (e) { settle(); notice('COULD NOT START PLAYBACK: ' + errText(e)); });
  // ...but never wait on the player for ever
  return Promise.race([work, new Promise(function (done) { setTimeout(done, 9000); })]).then(settle);
}
function idsFrom(items, start, max) {
  var ids = [];
  for (var i = start; i < items.length && ids.length < max; i++) if (items[i]) ids.push(items[i].id);
  return ids;
}
function randomIds(items, max) {
  var pool = [], i, j, t;
  for (i = 0; i < items.length; i++) if (items[i]) pool.push(items[i].id);
  for (i = pool.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  return pool.slice(0, max);
}
// What to hand the player when song i is picked in the Songs list: normally it
// and the ones listed after it; with shuffle on, it and then songs from all
// over the library.
function songIdsFrom(i) {
  var first = DB.songs[i];
  if (!first || !shuffleOn()) return idsFrom(DB.songs, i, QUEUE_CHUNK);
  return [first.id].concat(randomIds(DB.songs, QUEUE_CHUNK).filter(function (id) { return id !== first.id; }).slice(0, QUEUE_CHUNK - 1));
}

// ============================================================================
// Changing the library: add a song (or a whole album / playlist) to the
// library, add a song to a playlist, make a new playlist.
//
// These are the requests Apple's own page makes for the same things. What
// they change is the account's iCloud Music Library - the one copy that every
// device signed in to the account shows - so a song added here turns up in the
// Music app on a phone by itself (as long as "Sync Library" is on there).
// ============================================================================
function storefront() { try { return (S.music && S.music.storefrontId) || 'us'; } catch (e) { return 'us'; } }
function pause(ms) { return new Promise(function (go) { setTimeout(go, ms); }); }
function isLibrarySong(s) { return /^i\./.test(String(s && s.id)); }
// A song's id in Apple Music's catalogue ('' for something only this library has, e.g. an upload).
function catalogIdOf(s) { return !s ? '' : isLibrarySong(s) ? String(s.cid || '') : String(s.id); }
function songFromItem(it) {           // a song as the lists know it, from one of the player's queue items
  var info = itemInfo(it);
  return { id: info.id, cid: info.cid, n: info.title, a: info.artist, al: info.album, d: Math.round(info.dur), art: info.art, tn: 0 };
}

// A request that changes something. Refusals come back as an answer with
// "errors" in it rather than as a failure, so they are turned into one here.
function apiWrite(method, path, params, body) {
  var m = S.music;
  if (!m || !m.api || typeof m.api.music !== 'function') return Promise.reject(new Error('the player is not ready'));
  var opts = { method: method };
  if (body !== undefined) opts.body = JSON.stringify(body);
  opts.fetchOptions = { method: method, body: opts.body };       // (the documented spelling of the same thing)
  return m.api.music(path, params || {}, opts).then(function (res) {
    var data = (res && res.data) || {};
    var errs = (res && res.errors && res.errors.length ? res.errors : null) || (data.errors && data.errors.length ? data.errors : null);
    var status = res && typeof res.status === 'number' ? res.status : 200;
    if (errs || status >= 400) {
      var first = (errs && errs[0]) || {};
      var e = new Error(first.detail || first.title || ('Apple refused the request (' + status + ')'));
      e.status = +first.status || status;
      throw e;
    }
    return data;
  });
}

// Which of these catalogue items are in the library already?
// kind: songs | albums | playlists.  Resolves with {catalogueId: libraryId}.
function inLibrary(kind, ids) {
  var out = {}, chunks = [], i;
  ids = ids.filter(function (id) { return /^[\w.\-]+$/.test(String(id)); });
  for (i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  return Promise.all(chunks.map(function (part) {
    var q = { ids: part.join(','), relate: 'library' };
    q['fields[' + kind + ']'] = 'inLibrary';
    return api('/v1/catalog/' + storefront() + '/' + kind, q).then(function (d) {
      (d.data || []).forEach(function (x) {
        var lib = x.relationships && x.relationships.library && x.relationships.library.data && x.relationships.library.data[0];
        if (lib || (x.attributes && x.attributes.inLibrary)) out[x.id] = lib ? String(lib.id) : true;
      });
    });
  })).then(function () { return out; });
}

// Add one catalogue item to the library, then watch for it to arrive there.
// Resolves with its library id, or null if Apple took the request but the
// item had not shown up after about ten seconds (it usually takes two).
function addToLibrary(kind, catalogId) {
  if (!catalogId) return Promise.reject(new Error('it is not in the Apple Music catalogue'));
  var q = { representation: 'ids' };
  q['ids[' + kind + ']'] = catalogId;
  return apiWrite('POST', '/v1/me/library', q).then(function () {
    var looks = 0;
    function look() {
      return inLibrary(kind, [catalogId]).then(function (map) {
        if (map[catalogId]) return map[catalogId];
        return ++looks >= 6 ? null : pause(1600).then(look);
      }, function () { return null; });
    }
    return pause(900).then(look);
  });
}

// The songs of one of the listener's playlists, fresh from Apple.
function playlistSongs(id) {
  delete DB.tracks['playlist:' + id];
  return loadTracks('playlist', id).then(null, function () { return []; });     // an empty playlist answers "not found"
}
function sameSong(a, b) {
  if (!a || !b) return false;
  var ca = catalogIdOf(a), cb = catalogIdOf(b);
  return a.id === b.id || (!!ca && ca === cb);
}

// Add a song to a playlist (once: a song that is in it already is left alone).
function addToPlaylist(pl, s) {
  return playlistSongs(pl.id).then(function (songs) {
    if (songs.some(function (t) { return sameSong(t, s); })) {
      var dup = new Error('it is already in that playlist');
      dup.already = true;
      throw dup;
    }
    var item = isLibrarySong(s) ? { id: s.id, type: 'library-songs' } : { id: String(s.id), type: 'songs' };
    return apiWrite('POST', '/v1/me/library/playlists/' + pl.id + '/tracks', { representation: 'resources' }, { data: [item] });
  }).then(function () {
    // watch for it to arrive
    var looks = 0;
    function look() {
      return playlistSongs(pl.id).then(function (songs) {
        if (songs.some(function (t) { return sameSong(t, s); })) return true;
        return ++looks >= 5 ? false : pause(1500).then(look);
      });
    }
    return pause(800).then(look);
  });
}

// Make a new playlist holding this one song. Resolves with the playlist.
function newPlaylist(name, s) {
  var item = isLibrarySong(s) ? { id: s.id, type: 'library-songs' } : { id: String(s.id), type: 'songs' };
  return apiWrite('POST', '/v1/me/library/playlists', {}, { attributes: { name: name }, relationships: { tracks: { data: [item] } } })
    .then(function (d) {
      var made = d && d.data && d.data[0];
      return made ? packTile(made) : null;
    });
}

// After a change: bring the lists on screen (and the saved copies) up to date.
function libraryChanged() {
  clearTimeout(libraryChanged.t);
  libraryChanged.t = setTimeout(function () {
    if (!authorized()) return;
    loadRecent().then(function () { if (S.mode === 'full' && B.view && B.view.kind === 'recent') renderView(); }, function () {});
    if (DB.songsState !== 'loading') {
      DB.songsState = 'idle';
      loadSongs(function () { if (S.mode === 'full' && B.view && B.view.kind === 'songs') renderView(); });
    }
    loadAlbums().catch(function () {});
    loadArtists().catch(function () {});
  }, 3500);
}
function playlistChanged(id) {
  delete DB.tracks['playlist:' + id];
  loadPlaylists().catch(function () {});
  if (S.mode === 'full' && B.view && B.view.kind === 'playlist' && B.view.id === id) renderView();
}

// ---- what the keys and the menu do with all that ----
function doAddToLibrary(s) {
  if (!s || s.adding) return;
  if (!authorized()) { notice('SIGN IN TO ADD SONGS TO YOUR LIBRARY'); return; }
  s.adding = true;
  syncRowFlags();
  notice('ADDING TO YOUR LIBRARY: ' + s.n, true);
  dlog('library add: ' + catalogIdOf(s));
  addToLibrary('songs', catalogIdOf(s)).then(function (libId) {
    s.adding = false;
    s.lib = true;
    if (typeof libId === 'string') s.libId = libId;
    dlog('library add ' + (libId ? 'confirmed' : 'sent, not confirmed'));
    notice(libId ? 'ADDED TO YOUR LIBRARY: ' + s.n + '   (it shows up on your other devices too)'
                 : 'SENT TO YOUR LIBRARY: ' + s.n + '   (Apple has not shown it in the library yet)', true);
    syncRowFlags();
    libraryChanged();
  }, function (e) {
    s.adding = false;
    dlog('library add failed: ' + errText(e));
    notice('COULD NOT ADD TO YOUR LIBRARY: ' + errText(e));
    syncRowFlags();
  });
}

function doAddToPlaylist(s, pl) {
  if (!s || !pl) return;
  if (!authorized()) { notice('SIGN IN TO CHANGE YOUR PLAYLISTS'); return; }
  notice('ADDING TO ' + pl.n + ': ' + s.n, true);
  dlog('playlist add');
  addToPlaylist(pl, s).then(function (seen) {
    dlog('playlist add ' + (seen ? 'confirmed' : 'sent, not confirmed'));
    notice(seen ? 'ADDED TO ' + pl.n + ': ' + s.n : 'SENT TO ' + pl.n + ': ' + s.n + '   (Apple has not shown it in the playlist yet)', true);
    if (!isLibrarySong(s)) { s.lib = true; syncRowFlags(); libraryChanged(); }   // a catalogue song joins the library with it
    playlistChanged(pl.id);
  }, function (e) {
    if (e && e.already) { notice(s.n + ' IS ALREADY IN ' + pl.n, true); return; }
    dlog('playlist add failed: ' + errText(e));
    notice('COULD NOT ADD TO ' + pl.n + ': ' + errText(e));
  });
}

function doNewPlaylist(name, s) {
  if (!s || !name) return;
  if (!authorized()) { notice('SIGN IN TO CHANGE YOUR PLAYLISTS'); return; }
  notice('MAKING PLAYLIST ' + name, true);
  dlog('playlist create');
  newPlaylist(name, s).then(function (pl) {
    dlog('playlist create ok');
    notice('MADE PLAYLIST ' + name + ' WITH ' + s.n, true);
    if (!isLibrarySong(s)) { s.lib = true; syncRowFlags(); libraryChanged(); }
    setTimeout(function () { loadPlaylists().catch(function () {}); }, 1200);
    if (pl && DB.playlists && !DB.playlists.some(function (p) { return p.id === pl.id; })) {
      pl.ed = true;
      DB.playlists.push(pl);
      renderNavPlaylists();
    }
  }, function (e) {
    dlog('playlist create failed: ' + errText(e));
    notice('COULD NOT MAKE THE PLAYLIST: ' + errText(e));
  });
}

// A whole album or playlist of Apple's, from its page (the ADD key).
function doAddCollection(v) {
  if (!v || v.adding || v.lib) return;
  if (!authorized()) { notice('SIGN IN TO ADD TO YOUR LIBRARY'); return; }
  var kind = v.kind === 'playlist' ? 'playlists' : 'albums';
  v.adding = true;
  syncAddKey();
  notice('ADDING TO YOUR LIBRARY: ' + v.name, true);
  addToLibrary(kind, v.id).then(function (libId) {
    v.adding = false;
    v.lib = true;
    notice(libId ? 'ADDED TO YOUR LIBRARY: ' + v.name + '   (it shows up on your other devices too)'
                 : 'SENT TO YOUR LIBRARY: ' + v.name + '   (Apple has not shown it in the library yet)', true);
    syncAddKey();
    libraryChanged();
    if (kind === 'playlists') setTimeout(function () { loadPlaylists().catch(function () {}); }, 2500);
  }, function (e) {
    v.adding = false;
    notice('COULD NOT ADD TO YOUR LIBRARY: ' + errText(e));
    syncAddKey();
  });
}
// the ADD key in the browser's head: only on Apple's own albums and playlists
function syncAddKey() {
  if (!ui.bAdd) return;
  var v = B.view, cat = !!v && (v.kind === 'album' || v.kind === 'playlist') && !isLibId(v.kind, v.id);
  ui.bAdd.hidden = !cat;
  if (!cat) return;
  ui.bAdd.disabled = !!v.adding || !!v.lib;
  ui.bAddLabel.textContent = v.lib ? 'IN LIBRARY' : v.adding ? 'ADDING' : 'ADD';
  ui.bAdd.setAttribute('data-done', v.lib ? '1' : '0');
}

// Play a song after the current one, or at the end of the queue.
function queueSong(s, next) {
  var m = S.music;
  if (!m || !s) return;
  if (!queueItems().length) { startQueue({ songs: [s.id] }); return; }
  var fn = next ? m.playNext : m.playLater;
  if (typeof fn !== 'function') { notice('THIS PLAYER CANNOT DO THAT'); return; }
  Promise.resolve().then(function () { return fn.call(m, { song: s.id }); }).then(function () {
    notice((next ? 'PLAYING NEXT: ' : 'ADDED TO THE QUEUE: ') + s.n, true);
  }, function (e) { notice('COULD NOT QUEUE IT: ' + errText(e)); });
}

// Lamps on the rows: which of Apple's songs on screen are in the library.
function fetchRowFlags(items) {
  if (!authorized() || !items) return;
  var ask = items.filter(function (s) { return s && !isLibrarySong(s) && s.lib === undefined; });
  if (!ask.length) return;
  ask.forEach(function (s) { s.lib = null; });                // asked
  inLibrary('songs', ask.map(function (s) { return String(s.id); })).then(function (map) {
    ask.forEach(function (s) { s.lib = !!map[s.id]; if (typeof map[s.id] === 'string') s.libId = map[s.id]; });
    syncRowFlags();
  }, function () { ask.forEach(function (s) { s.lib = undefined; }); });
}
function rowFlag(el, s) {
  var v = !s || isLibrarySong(s) ? null : s.adding ? 'adding' : s.lib === true ? '1' : s.lib === false ? '0' : null;
  if (v === null) el.removeAttribute('data-lib'); else el.setAttribute('data-lib', v);
}
function syncRowFlags() {
  if (!ui.bBody) return;
  if (B.vlist) { B.vlist.update(true); return; }
  var rows = ui.bBody.querySelectorAll('.mpr[data-sec]'), i, sec;
  for (i = 0; i < rows.length; i++) {
    sec = B.secs[rows[i].getAttribute('data-sec')];
    rowFlag(rows[i], sec && sec.items[+rows[i].getAttribute('data-i')]);
  }
}

// ---- the song menu (right-click, or the ... key on a row) ----
var MENU = { song: null, opts: null, page: 'main' };

function menuKey(what, icon, en, ja, off, arg) {
  return h('button', { class: 'mpm-item', type: 'button', 'data-m': what, 'data-arg': arg || null, disabled: off ? true : null },
    icon ? svg(icon) : h('i'), h('span', { class: 'mpm-en', text: en }), ja ? jp(ja) : null);
}

function menuPage(page) {
  var s = MENU.song, o = MENU.opts || {}, box = ui.menu, signedIn = authorized();
  if (!s || !box) return;
  MENU.page = page;
  var kids = [h('div', { class: 'mpm-head' }, h('span', { class: 'mpm-title', text: s.n }), h('span', { class: 'mpm-sub', text: s.a || '' }))];
  if (page === 'main') {
    var have = isLibrarySong(s) || s.lib === true;
    if (o.play) kids.push(menuKey('play', I.play, 'Play', '再生'));
    kids.push(menuKey('next', I.next, 'Play next', '次に再生'));
    kids.push(menuKey('later', I.list, 'Add to queue', 'キューに追加'));
    kids.push(h('div', { class: 'mpm-sep' }));
    if (have) kids.push(menuKey('', I.check, 'In your library', 'ライブラリにあります', true));
    else kids.push(menuKey('lib', I.plus, signedIn ? (s.adding ? 'Adding to library' : 'Add to library') : 'Sign in to add to library', 'ライブラリに追加', !signedIn || !!s.adding || !catalogIdOf(s)));
    kids.push(menuKey('pl', I.go, 'Add to a playlist', 'プレイリストに追加', !signedIn));
  } else {
    var mine = orderedPlaylists().filter(function (p) { return p.ed === true; });
    kids.push(menuKey('back', I.back, 'Add to a playlist', 'プレイリストに追加'));
    ui.menuName = h('input', { type: 'text', class: 'mpm-input', maxlength: '80', placeholder: 'New playlist name', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Name for a new playlist' });
    kids.push(h('div', { class: 'mpm-new' }, ui.menuName, h('button', { class: 'mp-key mpm-make', type: 'button', 'data-m': 'create', text: 'MAKE' })));
    kids.push(h('div', { class: 'mpm-sep' }));
    var list = h('div', { class: 'mpm-scroll' });
    mine.forEach(function (p) { list.appendChild(menuKey('topl', I.list, p.n, null, false, p.id)); });
    if (!mine.length) list.appendChild(h('div', { class: 'mpm-note', text: DB.playlists ? 'No playlists of your own yet. Make one above.' : 'Loading your playlists...' }));
    kids.push(list);
  }
  box.replaceChildren.apply(box, kids);
}

function placeMenu(x, y) {
  var box = ui.menu;
  if (typeof x === 'number') { MENU.x = x; MENU.y = y; }
  box.style.left = '0px';
  box.style.top = '0px';
  var w = box.offsetWidth, hgt = box.offsetHeight, pad = 8;
  box.style.left = Math.max(pad, Math.min(MENU.x, window.innerWidth - w - pad)) + 'px';
  box.style.top = Math.max(pad, Math.min(MENU.y, window.innerHeight - hgt - pad)) + 'px';
}

// opts.play: what "Play" does for this row (left out where the song is playing already)
function openSongMenu(s, x, y, opts) {
  if (!s || !ui.menu || !s.id) return;
  MENU.song = s;
  MENU.opts = opts || {};
  menuPage('main');
  ui.menu.setAttribute('data-open', '1');
  placeMenu(x, y);
  // Apple's song, not known yet whether it is in the library: find out
  if (!isLibrarySong(s) && typeof s.lib !== 'boolean' && authorized()) {
    inLibrary('songs', [String(s.id)]).then(function (map) {
      if (typeof s.lib !== 'boolean') s.lib = !!map[s.id];
      if (MENU.song === s && MENU.page === 'main') { menuPage('main'); placeMenu(); }
    }, function () {});
  }
  // the playlists that can be added to (the saved copy may predate that knowledge)
  if (authorized() && (!DB.playlists || DB.playlists.some(function (p) { return p.ed === undefined; })))
    loadPlaylists().then(function () { if (MENU.song === s && MENU.page === 'pl') { menuPage('pl'); placeMenu(); } }, function () {});
}
function closeMenu() {
  if (!ui.menu || !MENU.song) return;
  MENU.song = null;
  ui.menu.setAttribute('data-open', '0');
}
function menuOpen() { return !!MENU.song; }

function onMenuClick(e) {
  var key = e.target.closest && e.target.closest('[data-m]');
  if (!key || key.disabled) return;
  var s = MENU.song, o = MENU.opts || {}, what = key.getAttribute('data-m'), arg = key.getAttribute('data-arg');
  if (!s) return;
  if (what === 'pl') { menuPage('pl'); placeMenu(); return; }
  if (what === 'back') { menuPage('main'); placeMenu(); return; }
  if (what === 'create') {
    var name = (ui.menuName ? ui.menuName.value : '').trim();
    if (!name) { if (ui.menuName) ui.menuName.focus(); return; }
    closeMenu();
    doNewPlaylist(name, s);
    return;
  }
  closeMenu();
  if (what === 'play' && o.play) o.play();
  else if (what === 'next') queueSong(s, true);
  else if (what === 'later') queueSong(s, false);
  else if (what === 'lib') doAddToLibrary(s);
  else if (what === 'topl') {
    var pl = null;
    (DB.playlists || []).forEach(function (p) { if (p.id === arg) pl = p; });
    doAddToPlaylist(s, pl);
  }
}

// ---- the views ----
function viewRecent(tok) {
  setHead({ title: 'Recently Added', jp: '最近追加', meta: DB.recent ? DB.recent.length + ' items' : 'loading...', hideActions: true });
  if (DB.recent) showTiles(DB.recent); else showMsg('LOADING', '読込中');
  loadRecent().then(function (list) {
    if (tok !== B.token) return;
    setMeta(list.length + ' items');
    showTiles(list);
  }).catch(function (e) { if (tok === B.token && !DB.recent) showMsg('COULD NOT LOAD', errText(e)); });
}

function viewSongs(tok) {
  function draw() {
    if (tok !== B.token) return;
    var total = DB.songsTotal;
    setHead({ title: 'Songs', jp: '曲', canPlay: total > 0,
              meta: total < 0 ? 'loading...' : total + '曲' + (DB.songsState === 'loading' ? '  (refreshing)' : '') });
    if (total < 0) { showMsg('LOADING', '読込中'); return; }
    showTable({
      items: DB.songs, total: total,
      play: function (i) { startQueue({ songs: songIdsFrom(i) }); },
      shuffle: function () { startQueue({ songs: randomIds(DB.songs, QUEUE_CHUNK) }, false); }
    });
  }
  draw();
  if (DB.songsState === 'idle') loadSongs(draw);
}

function viewAlbums(tok) {
  function draw(list, done) {
    if (tok !== B.token) return;
    setHead({ title: 'Albums', jp: 'アルバム', meta: list.length + ' albums' + (done ? '' : '  (loading)'), hideActions: true });
    showTiles(list);
  }
  if (DB.albums) draw(DB.albums, true); else { setHead({ title: 'Albums', jp: 'アルバム', meta: 'loading...', hideActions: true }); showMsg('LOADING', '読込中'); }
  loadAlbums(function (part) { draw(part, false); })
    .then(function (list) { draw(list, true); })
    .catch(function (e) { if (tok === B.token && !DB.albums) showMsg('COULD NOT LOAD', errText(e)); });
}

function makeArtistRow() {
  return h('div', { class: 'mpr', role: 'row', 'data-kind': 'artist' },
    h('span', { class: 'n' }, svg(I.person)), h('span', { class: 't' }), h('span', { class: 'n' }, svg(I.go)));
}
function viewArtists(tok) {
  function draw(list, done) {
    if (tok !== B.token) return;
    setHead({ title: 'Artists', jp: 'アーティスト', meta: list.length + ' artists' + (done ? '' : '  (loading)'), hideActions: true });
    if (!B.vlist || ui.browser.getAttribute('data-kind') !== 'artists') {
      clearBody('artists');
      B.vlist = new VList(ui.bBody, makeArtistRow, function (el, i) {
        var a = B.items && B.items[i];
        el.children[1].textContent = a ? a.n : '';
        if (i === B.sel) el.setAttribute('data-sel', '1'); else el.removeAttribute('data-sel');
      });
    }
    B.items = list;
    B.vlist.setCount(list.length);
  }
  if (DB.artists) draw(DB.artists, true); else { setHead({ title: 'Artists', jp: 'アーティスト', meta: 'loading...', hideActions: true }); showMsg('LOADING', '読込中'); }
  loadArtists(function (part) { draw(part, false); })
    .then(function (list) { draw(list, true); })
    .catch(function (e) { if (tok === B.token && !DB.artists) showMsg('COULD NOT LOAD', errText(e)); });
}

function viewArtist(v, tok) {
  setHead({ title: v.name, jp: 'アーティスト', meta: 'loading...', hideActions: true });
  var have = DB.artistAlbums[v.id];
  if (have) { setMeta(have.length + ' albums'); showTiles(have); return; }
  showMsg('LOADING', '読込中');
  fetchAll('/v1/me/library/artists/' + v.id + '/albums', {}, packTile).then(function (list) {
    DB.artistAlbums[v.id] = list;
    if (tok !== B.token) return;
    setMeta(list.length + ' albums');
    if (list.length) showTiles(list); else showMsg('NO ALBUMS', 'Nothing by this artist is saved as an album.');
  }).catch(function (e) { if (tok === B.token) showMsg('COULD NOT LOAD', errText(e)); });
}

// a playlist or an album
function viewCollection(v, tok) {
  var isPl = v.kind === 'playlist';
  var opt = isPl ? 'playlist' : 'album';
  var fromApple = !isLibId(v.kind, v.id);
  // one of Apple's albums or playlists: is it in the library already? (for the ADD key)
  if (fromApple && v.lib === undefined && authorized()) {
    v.lib = null;
    inLibrary(isPl ? 'playlists' : 'albums', [v.id]).then(function (map) {
      v.lib = !!map[v.id];
      if (B.view === v) syncAddKey();
    }, function () { v.lib = undefined; });
  }
  function draw(list, done) {
    if (tok !== B.token) return;
    setHead({ title: v.name, jp: isPl ? 'プレイリスト' : 'アルバム', art: v.art || '', canPlay: list.length > 0,
              meta: (v.artist ? v.artist + '  ·  ' : '') + songsMeta(list.length, list) + (done ? '' : '  (loading)') });
    if (done && !list.length) { showMsg('EMPTY', isPl ? 'This playlist has no songs yet.' : 'No songs found.'); return; }
    var q = {}; q[opt] = v.id;
    showTable({
      items: list, total: list.length, numbered: !isPl,
      play: function (i) { var o = {}; o[opt] = v.id; o.startWith = i; startQueue(o); },
      shuffle: function () { startQueue(q, true); }
    });
    if (done && fromApple) fetchRowFlags(list);
  }
  var have = DB.tracks[v.kind + ':' + v.id];
  if (have) {
    draw(have, true);
    // the copy is from earlier this session: the playlist may have changed
    // since (here, or on another device). Ask again and redraw if it did.
    if (!fromApple) {
      delete DB.tracks[v.kind + ':' + v.id];
      loadTracks(v.kind, v.id).then(function (list) {
        var same = list.length === have.length && list.every(function (s, k) { return s && have[k] && s.id === have[k].id; });
        if (!same && tok === B.token) draw(list, true);
      }, function () { if (!DB.tracks[v.kind + ':' + v.id]) DB.tracks[v.kind + ':' + v.id] = have; });
    }
    return;
  }
  setHead({ title: v.name, jp: isPl ? 'プレイリスト' : 'アルバム', art: v.art, meta: 'loading...' });
  showMsg('LOADING', '読込中');
  loadTracks(v.kind, v.id, function (part) { draw(part, false); })
    .then(function (list) { draw(list, true); })
    .catch(function (e) {
      if (tok !== B.token) return;
      // an empty library playlist answers "not found"
      if (isPl) draw([], true); else showMsg('COULD NOT LOAD', errText(e));
    });
}

function viewSearch(v, tok) {
  setHead({ title: 'Search: ' + v.term, jp: '検索', meta: 'searching...', hideActions: true });
  showMsg('SEARCHING', '検索中');
  var sf = 'us';
  try { sf = S.music.storefrontId || 'us'; } catch (e) {}
  var lib = authorized()
    ? api('/v1/me/library/search', { term: v.term, types: 'library-songs,library-albums,library-playlists,library-artists', limit: 15 })
        .then(function (d) { return d.results || {}; }, function () { return {}; })
    : Promise.resolve({});
  var cat = api('/v1/catalog/' + sf + '/search', { term: v.term, types: 'songs,albums,playlists', limit: 15 })
    .then(function (d) { return d.results || {}; }, function () { return {}; });

  Promise.all([lib, cat]).then(function (res) {
    if (tok !== B.token) return;
    var L = res[0], C = res[1];
    function arr(o, k, pack) { return ((o[k] && o[k].data) || []).map(pack); }
    var libSongs = arr(L, 'library-songs', packSong), libAlbums = arr(L, 'library-albums', packTile);
    var libPls = arr(L, 'library-playlists', packTile), libArtists = arr(L, 'library-artists', packArtist);
    var catSongs = arr(C, 'songs', packSong), catAlbums = arr(C, 'albums', packTile), catPls = arr(C, 'playlists', packTile);
    var n = libSongs.length + libAlbums.length + libPls.length + libArtists.length + catSongs.length + catAlbums.length + catPls.length;
    setMeta(n ? n + ' results' : 'nothing found');
    if (!n) { showMsg('NOTHING FOUND', '見つかりません'); return; }

    clearBody('flow');
    ui.bBody.className = 'mpb-body mpb-flow';
    var body = ui.bBody;
    function sec(title, ja) { body.appendChild(h('div', { class: 'mpb-sec' }, h('span', { text: title }), jp(ja))); }
    function songRows(name, items) {
      B.secs[name] = { items: items, play: function (i) { startQueue({ songs: idsFrom(items, 0, QUEUE_CHUNK), startWith: i }); } };
      for (var i = 0; i < items.length; i++) {
        var row = makeTrackRow();
        row.setAttribute('data-i', String(i));
        row.setAttribute('data-sec', name);
        fillTrackRow(row, items[i], i, false, false);
        body.appendChild(row);
      }
    }
    function tiles(name, items) {
      B.secs[name] = { items: items };
      var grid = h('div', { class: 'mpg' });
      for (var i = 0; i < items.length; i++) grid.appendChild(makeTile(items[i], i, name));
      body.appendChild(grid);
    }
    function artistRows(items) {
      B.secs.libArtists = { items: items };
      for (var i = 0; i < items.length; i++) {
        var row = makeArtistRow();
        row.setAttribute('data-i', String(i));
        row.setAttribute('data-sec', 'libArtists');
        row.children[1].textContent = items[i].n;
        body.appendChild(row);
      }
    }
    if (libSongs.length) { sec('YOUR LIBRARY: SONGS', 'ライブラリの曲'); songRows('libSongs', libSongs); }
    if (libAlbums.length || libPls.length) { sec('YOUR LIBRARY: ALBUMS & PLAYLISTS', 'アルバム'); tiles('libTiles', libAlbums.concat(libPls)); }
    if (libArtists.length) { sec('YOUR LIBRARY: ARTISTS', 'アーティスト'); artistRows(libArtists); }
    if (catSongs.length) { sec('APPLE MUSIC: SONGS', 'カタログの曲'); songRows('catSongs', catSongs); }
    if (catAlbums.length || catPls.length) { sec('APPLE MUSIC: ALBUMS & PLAYLISTS', 'カタログ'); tiles('catTiles', catAlbums.concat(catPls)); }
    fetchRowFlags(catSongs);            // which of Apple's songs are in the library already
  });
}

function viewSignIn() {
  setHead({ title: 'Not signed in', jp: 'サインイン', meta: '', hideActions: true });
  showMsg('SIGN IN TO SEE YOUR LIBRARY',
    'Signing in happens on Apple\'s own page. Search still works without it (30-second previews).',
    h('button', { class: 'mp-key mpc-lib', 'data-act': 'apple', type: 'button' }, h('span', { text: 'OPEN APPLE MUSIC' }), jp('サインイン')));
}

function renderView() {
  var v = B.view;
  if (!v || !ui.browser) return;
  var tok = ++B.token;
  syncNav();
  if (!S.music) {
    setHead({ title: 'Music Player', jp: 'ミュージックプレーヤー', meta: '', hideActions: true });
    showMsg('STARTING UP', '起動中');
    return;
  }
  if (v.kind === 'search') { viewSearch(v, tok); return; }
  // Apple Music's own albums and playlists (reached from search) can be
  // opened without signing in; everything from the library cannot.
  var fromCatalog = (v.kind === 'album' || v.kind === 'playlist') && !isLibId(v.kind, v.id);
  if (!authorized() && !fromCatalog) { viewSignIn(); return; }
  switch (v.kind) {
    case 'recent': viewRecent(tok); break;
    case 'songs': viewSongs(tok); break;
    case 'albums': viewAlbums(tok); break;
    case 'artists': viewArtists(tok); break;
    case 'artist': viewArtist(v, tok); break;
    case 'playlist':
    case 'album': viewCollection(v, tok); break;
  }
}

// ---- library panel ----
function navItem(goKey, icon, label, ja) {
  return h('button', { class: 'mpa-nav-item', type: 'button', 'data-go': goKey, title: label },
    svg(icon), h('span', { class: 'nm', text: label }), ja ? jp(ja) : null);
}
function renderNavPlaylists() {
  if (!ui.navPls) return;
  var list = orderedPlaylists(), frag = document.createDocumentFragment(), item;
  for (var i = 0; i < list.length; i++) {
    item = navItem('playlist:' + list[i].id, I.list, list[i].n, null);
    item.title = list[i].n + '  (drag it to reorder your playlists)';
    frag.appendChild(item);
  }
  ui.navPls.replaceChildren(frag);
  ui.navPlCount.textContent = list.length ? String(list.length) : '';
  if (ui.navPlReset) ui.navPlReset.hidden = !list.length || !store.get('plOrder', null);
  syncNav();
}

// ---- the listener's own order for the playlists ----
// Apple Music has no order of its own for playlists, so the one dragged into
// shape here is kept on this computer. Playlists it does not know yet (new
// ones) go at the end, in Apple's order; deleted ones simply drop out.
function orderedPlaylists() {
  var list = (DB.playlists || []).slice(), order = store.get('plOrder', null);
  if (!order || !order.length) return list;
  var rank = {}, i;
  for (i = 0; i < order.length; i++) rank[order[i]] = i;
  return list.map(function (p, k) { return { p: p, r: rank.hasOwnProperty(p.id) ? rank[p.id] : 100000 + k }; })
    .sort(function (a, b) { return a.r - b.r; })
    .map(function (x) { return x.p; });
}
function savePlaylistOrder(ids) {
  store.set('plOrder', ids);
  renderNavPlaylists();
}
function navPlItems() {
  return Array.prototype.filter.call(ui.navPls.children, function (c) { return c.classList && c.classList.contains('mpa-nav-item'); });
}
// move one playlist to place `to` (0 = top), counted in the list without it
function movePlaylist(id, to) {
  var ids = orderedPlaylists().map(function (p) { return p.id; }), from = ids.indexOf(id);
  if (from < 0) return;
  ids.splice(from, 1);
  to = Math.max(0, Math.min(ids.length, to));
  ids.splice(to, 0, id);
  savePlaylistOrder(ids);
}

// Dragging: press on a playlist, move a few pixels, a lit line shows where it
// will land, let go. A press without moving stays an ordinary click.
var PLDRAG = null;
function onPlDown(e) {
  if (e.button !== 0 || !ui.navPls) return;
  var item = e.target.closest && e.target.closest('.mpa-nav-item');
  if (!item || item.parentNode !== ui.navPls) return;
  PLDRAG = { item: item, id: item.getAttribute('data-go').slice(9), x: e.clientX, y: e.clientY, pid: e.pointerId, moved: false, to: -1 };
}
function onPlMove(e) {
  var d = PLDRAG;
  if (!d || e.pointerId !== d.pid) return;
  if (!d.moved) {
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 6) return;
    d.moved = true;
    try { ui.navPls.setPointerCapture(e.pointerId); } catch (x) {}
    d.item.setAttribute('data-drag', '1');
    ui.navPls.setAttribute('data-dragging', '1');
    d.mark = h('div', { class: 'mpa-drop' });
    ui.navPls.appendChild(d.mark);
  }
  e.preventDefault();
  if (!d.mark.parentNode) ui.navPls.appendChild(d.mark);   // (the list was redrawn meanwhile)
  var items = navPlItems(), box = ui.navPls.getBoundingClientRect(), i, r, n = items.length;
  if (!n) return;
  // a column (wide window) or a row of tabs (narrow window)?
  var across = n > 1 && Math.abs(items[0].getBoundingClientRect().top - items[1].getBoundingClientRect().top) < 4;
  var pos = across ? e.clientX : e.clientY, slot = n;
  for (i = 0; i < n; i++) {
    r = items[i].getBoundingClientRect();
    if (pos < (across ? r.left + r.width / 2 : r.top + r.height / 2)) { slot = i; break; }
  }
  d.slot = slot;
  // the lit line, between two playlists
  var ref = items[Math.min(slot, n - 1)].getBoundingClientRect(), s = d.mark.style;
  if (across) {
    var x = (slot < n ? ref.left - 3 : ref.right + 1) - box.left + ui.navPls.scrollLeft;
    s.left = x + 'px'; s.top = (ref.top - box.top + ui.navPls.scrollTop) + 'px'; s.width = '2px'; s.height = ref.height + 'px';
  } else {
    var y = (slot < n ? ref.top - 2 : ref.bottom) - box.top + ui.navPls.scrollTop;
    s.top = y + 'px'; s.left = '4px'; s.right = '4px'; s.width = ''; s.height = '2px';
  }
  // near the edge of a list that scrolls: scroll along
  if (!across) {
    if (e.clientY < box.top + 24) ui.navPls.scrollTop -= 8;
    else if (e.clientY > box.bottom - 24) ui.navPls.scrollTop += 8;
  } else if (ui.nav && ui.nav.scrollWidth > ui.nav.clientWidth) {   // (narrow window: the row scrolls sideways)
    var nb = ui.nav.getBoundingClientRect();
    if (e.clientX < nb.left + 30) ui.nav.scrollLeft -= 10;
    else if (e.clientX > nb.right - 30) ui.nav.scrollLeft += 10;
  }
}
function onPlUp(e) {
  var d = PLDRAG;
  if (!d || e.pointerId !== d.pid) return;
  PLDRAG = null;
  if (!d.moved) return;                  // an ordinary click: the click handler opens the playlist
  e.preventDefault();
  try { ui.navPls.releasePointerCapture(e.pointerId); } catch (x) {}
  if (d.mark && d.mark.parentNode) d.mark.parentNode.removeChild(d.mark);
  d.item.removeAttribute('data-drag');
  ui.navPls.removeAttribute('data-dragging');
  PLDRAG_NOCLICK = performance.now() + 400;          // the click that follows a drag is not a click
  if (e.type === 'pointercancel' || d.slot === undefined) return;
  var from = orderedPlaylists().map(function (p) { return p.id; }).indexOf(d.id);   // (as shown)
  movePlaylist(d.id, d.slot > from ? d.slot - 1 : d.slot);
}
var PLDRAG_NOCLICK = 0;
function syncNav() {
  if (!ui.nav) return;
  var v = B.view, key = '';
  if (v) {
    key = v.kind === 'playlist' ? 'playlist:' + v.id
      : v.kind === 'album' ? 'albums'
      : v.kind === 'artist' ? 'artists'
      : v.kind;
  }
  var items = ui.nav.querySelectorAll('[data-go]');
  for (var i = 0; i < items.length; i++)
    items[i].setAttribute('aria-current', items[i].getAttribute('data-go') === key ? 'true' : 'false');
}
function onNavClick(e) {
  if (performance.now() < PLDRAG_NOCLICK) { e.preventDefault(); return; }
  var b = e.target.closest && e.target.closest('[data-go]');
  if (!b) { onActClick(e); return; }
  if (e.detail > 0) b.blur();
  var key = b.getAttribute('data-go');
  if (ui.search) ui.search.value = '';
  if (key.indexOf('playlist:') === 0) {
    var id = key.slice(9), pl = null, list = DB.playlists || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) pl = list[i];
    go({ kind: 'playlist', id: id, name: pl ? pl.n : 'Playlist', art: pl ? pl.art : '' });
  } else {
    go({ kind: key });
  }
}

// ---- clicks and keys in the browser ----
function selectRow(i) {
  B.sel = i;
  if (B.vlist) { B.vlist.update(true); B.vlist.reveal(i); }
}
function onBodyClick(e) {
  var t = e.target;
  if (!t.closest) return;
  // the second half of a double-click whose first half opened a tile: not meant for the new view
  if (e.detail > 1 && performance.now() - (B.tileAt || -1e9) < 500) return;
  var tile = t.closest('.mpg-tile');
  if (tile) {
    if (e.detail >= 1) B.tileAt = performance.now();
    var sn = tile.getAttribute('data-sec'), idx = +tile.getAttribute('data-i');
    openTile(sn ? (B.secs[sn] && B.secs[sn].items[idx]) : (B.tiles && B.tiles[idx]));
    return;
  }
  var row = t.closest('.mpr');
  if (!row) { onActClick(e); return; }
  var key = t.closest('[data-row]');
  if (key) {                           // one of the row's own keys: + (add to library) or ... (menu)
    var song = rowSong(row);
    if (e.type !== 'click' || !song) return;
    if (e.detail > 0) key.blur();
    if (key.getAttribute('data-row') === 'add') doAddToLibrary(song);
    else {
      var box = key.getBoundingClientRect();
      openSongMenu(song, box.right - 236, box.bottom + 4, { play: rowPlay(row) });
    }
    return;
  }
  var i = +row.getAttribute('data-i'), secName = row.getAttribute('data-sec');
  if (row.getAttribute('data-kind') === 'artist') {
    var a = secName ? B.secs[secName].items[i] : (B.items && B.items[i]);
    if (a) go({ kind: 'artist', id: a.id, name: a.n });
    return;
  }
  if (secName) {                       // a song among search results
    var old = ui.bBody.querySelector('.mpr[data-sel="1"]');
    if (old) old.removeAttribute('data-sel');
    row.setAttribute('data-sel', '1');
    if (e.type === 'dblclick' && B.secs[secName].play) B.secs[secName].play(i);
    return;
  }
  if (!B.items || !B.items[i]) return;
  selectRow(i);
  if (e.type === 'dblclick' && B.play) B.play(i);
}

// right-click on a song: its menu
function onBodyMenu(e) {
  var row = e.target.closest && e.target.closest('.mpr');
  if (!row || row.getAttribute('data-kind') === 'artist') return;
  var song = rowSong(row);
  if (!song || !song.id) return;
  e.preventDefault();
  if (row.getAttribute('data-sec')) {
    var old = ui.bBody.querySelector('.mpr[data-sel="1"]');
    if (old) old.removeAttribute('data-sel');
    row.setAttribute('data-sel', '1');
  } else {
    B.sel = +row.getAttribute('data-i');
    if (B.vlist) B.vlist.update(true);
  }
  openSongMenu(song, e.clientX, e.clientY, { play: rowPlay(row) });
}
// ...and on a row of the queue
function onListMenu(e) {
  var row = e.target.closest && e.target.closest('.mpc-row');
  if (!row) return;
  var i = parseInt(row.getAttribute('data-i'), 10), it = queueItems()[i];
  if (!it) return;
  e.preventDefault();
  openSongMenu(songFromItem(it), e.clientX, e.clientY, i === curIndex() ? {} : { play: function () { call('changeToMediaAtIndex', i); } });
}

function onSearchInput() {
  clearTimeout(B.searchTimer);
  B.searchTimer = setTimeout(function () {
    var term = ui.search.value.trim();
    if (term.length < 2) {
      if (!term && B.view && B.view.kind === 'search') {
        var v = B.hist.pop() || { kind: 'recent' };
        B.view = v;
        renderView();
      }
      return;
    }
    go({ kind: 'search', term: term });
  }, 320);
}

// What changed when signing in or out, or when the player first appears.
function onAuthChange() {
  if (!S.music) return;
  dlog(authorized() ? 'signed in' : 'not signed in');
  if (authorized()) {
    renderNavPlaylists();
    loadPlaylists().catch(function () {});
    // warm the big lists a little later so the first screen comes up first
    setTimeout(function () { if (authorized() && DB.songsState === 'idle') loadSongs(function () { if (B.view && B.view.kind === 'songs') renderView(); }); }, 2500);
    setTimeout(function () { if (authorized()) { loadAlbums().catch(function () {}); loadArtists().catch(function () {}); } }, 6000);
  } else {
    dropCache();
    renderNavPlaylists();
  }
  if (S.mode === 'full') renderView();
  lyRefresh(true);
}

// ------------------------------------------------------------- actions -------
var ACT = {
  full: function () { setMode('full'); },
  compact: function () { setMode('compact'); },
  apple: function () { setMode('apple'); },
  theme: function () { openPanel(); },
  addview: function () { doAddCollection(B.view); },
  plreset: function () { store.del('plOrder'); renderNavPlaylists(); notice('PLAYLISTS BACK IN APPLE MUSIC\'S ORDER', true); },
  nowmenu: function () {                 // the "+ ADD" on the song display: the menu for the song that is playing
    var it = nowItem();
    if (!it || !ui.chipAdd) return;
    if (menuOpen()) { closeMenu(); return; }
    var box = ui.chipAdd.getBoundingClientRect();
    openSongMenu(songFromItem(it), box.left, box.bottom + 6, {});
  },
  closepanel: function () { closePanel(); },
  ontop: function () { setOnTop(!S.onTop); },
  pl: function () { setPanel('pl', !S.showPl); },
  viz: function () { setPanel('viz', !S.showViz); },
  lyr: function () { setPanel('lyr', !S.showLyr); },
  vizprev: function () { vzStep(-1); },
  viznext: function () { vzStep(1); },
  vizlist: function () { vzMenu(ui.vzMenu.hidden); },
  vizauto: function () { vzSetAuto(!VZ.auto); vzOsd('自動', VZ.auto ? 'AUTO: NEW EFFECT EVERY 40 SECONDS' : 'AUTO OFF'); },
  vizbig: function () { setVizBig(!S.vizBig); },
  vizretry: function () { vzRetry(); },
  lyrroma: function () { LY.roma = !LY.roma; store.set('lyrRoma', LY.roma); lySyncKeys(); lyBigLine(); },
  lyrtrans: function () { LY.trans = !LY.trans; store.set('lyrTrans', LY.trans); lySyncKeys(); lyBigLine(); },
  lyrretry: function () { lyRefresh(true); },
  back: function () { goBack(); },
  playview: function () { if (B.play) B.play(B.sel >= 0 ? B.sel : 0); },
  shuffleview: function () { if (B.shuffle) B.shuffle(); },
  timemode: function () { S.remaining = !S.remaining; store.set('remaining', S.remaining); refreshTime(); },
  play: function () { call('play'); },
  pause: function () { S.haltAt = performance.now(); call('pause'); },
  stop: function () { S.haltAt = performance.now(); call('stop'); },
  next: function () { call('skipToNextItem'); },
  prev: function () {
    // like a CD player: early in a track goes back one, later restarts it
    var t = 0;
    try { t = S.music.currentPlaybackTime || 0; } catch (e) {}
    if (t > 3) call('seekToTime', 0); else call('skipToPreviousItem');
  },
  shuffle: function () {
    var m = S.music, mk = MK();
    if (!m || !mk || !mk.PlayerShuffleMode) return;
    try {
      if (S.shuffleHeld) {
        // pressed while a picked song is still starting (lamp lit, switch held
        // off): the listener wants it off, so simply do not switch it back on
        S.shuffleHeld = false;
      } else {
        m.shuffleMode = m.shuffleMode === mk.PlayerShuffleMode.off ? mk.PlayerShuffleMode.songs : mk.PlayerShuffleMode.off;
      }
    } catch (e) {}
    setTimeout(refreshModes, 60);
  },
  repeat: function () {
    var m = S.music, mk = MK();
    if (!m || !mk || !mk.PlayerRepeatMode) return;
    var R = mk.PlayerRepeatMode;
    try { m.repeatMode = m.repeatMode === R.none ? R.all : m.repeatMode === R.all ? R.one : R.none; } catch (e) {}
    setTimeout(refreshModes, 60);
  }
};

function togglePlay() {
  var playing = false;
  try { playing = !!S.music.isPlaying; } catch (e) {}
  if (playing) S.haltAt = performance.now();
  call(playing ? 'pause' : 'play');
}

function onActClick(e) {
  var b = e.target.closest && e.target.closest('[data-act]');
  if (!b) return;
  // after a mouse click, drop focus so Space keeps meaning play / pause
  if (e.detail > 0 && typeof b.blur === 'function') b.blur();
  var fn = ACT[b.getAttribute('data-act')];
  if (fn) fn();
}

// Switch between the three faces.
function setMode(mode) {
  if (mode !== 'full' && mode !== 'compact' && mode !== 'apple') return;
  if (S.mode === mode) return;
  if (S.vizBig) { S.vizBig = false; syncPanels(); }
  S.mode = mode;
  applyTheme();
  notifyHost();
  closePanel();
  if (mode === 'compact') requestCompactSize(); else send('compact|0');

  if (mode === 'apple') {
    send('tap|0');
    watchApple(true);
    // Apple's page was not being drawn; let it measure itself again
    setTimeout(function () { placeControls(); try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
    return;
  }
  watchApple(false);
  S.marquee = null;
  refreshAll();
  vizColors();
  kickViz();
  if (mode === 'full') {
    if (!B.view) B.view = { kind: 'recent' };
    // sizes changed with the window: let lists and the song line re-measure
    setTimeout(function () { if (S.mode === 'full') { renderView(); setMarquee(S.marquee, true); } }, 80);
  }
  setTimeout(function () { kickViz(); vzKick(); lyRefresh(); lyKick(); }, 150);
}

// The compact window is as tall as what is open in it: the deck alone, or the
// deck with any of the three panels stacked under it.
function requestCompactSize() {
  if (S.mode !== 'compact') return;
  var base = ui.strip.offsetHeight + ui.deck.offsetHeight;
  var n = (S.showViz ? 1 : 0) + (S.showLyr ? 1 : 0) + (S.showPl ? 1 : 0), height = base;
  if (n === 1 && S.showPl) height = COMPACT_H;
  else if (n) height = base + 10 + (n - 1) * 6 + (S.showViz ? CP_VIZ : 0) + (S.showLyr ? CP_LYR : 0) + (S.showPl ? CP_PL : 0);
  var room = (window.screen && screen.availHeight ? screen.availHeight : 900) - 56;
  send('compact|1|' + COMPACT_W + '|' + Math.round(Math.max(base, Math.min(height, room))));
}

// Switch one of the panels on or off: 'viz', 'lyr' or 'pl' (the queue).
function setPanel(which, on) {
  var key = which === 'viz' ? 'showViz' : which === 'lyr' ? 'showLyr' : 'showPl';
  S[key] = !!on;
  store.set(key, S[key]);
  if (which === 'viz' && !on) { S.vizBig = false; vzMenu(false); }
  syncPanels();
  requestCompactSize();
  if (which === 'pl' && on) markCurrent(true);
  if (which === 'viz' && on) { VZ.last = 0; vzKick(); }
  if (which === 'lyr' && on) { lyRefresh(); lyKick(); }
  lyBigLine();
  // the column changed width: let the lists and the song line re-measure
  setTimeout(function () {
    if (S.mode === 'full' && B.vlist) B.vlist.update(false);
    if (deckShown()) setMarquee(S.marquee, true);
  }, 80);
}

function syncPanels() {
  if (!ui.app) return;
  ui.app.setAttribute('data-pl', S.showPl ? '1' : '0');
  ui.app.setAttribute('data-viz', S.showViz ? '1' : '0');
  ui.app.setAttribute('data-lyr', S.showLyr ? '1' : '0');
  ui.app.setAttribute('data-vizbig', S.vizBig ? '1' : '0');
  [[ui.tgViz, S.showViz], [ui.tgLyr, S.showLyr], [ui.tgPl, S.showPl]].forEach(function (x) {
    if (!x[0]) return;
    x[0].setAttribute('data-on', x[1] ? '1' : '0');
    x[0].setAttribute('aria-pressed', x[1] ? 'true' : 'false');
  });
}

function setOnTop(on) {
  S.onTop = !!on;
  store.set('compactOnTop', S.onTop);
  send('ontop|' + (S.onTop ? 1 : 0));
  if (ui.pinBtn) {
    ui.pinBtn.setAttribute('data-on', S.onTop ? '1' : '0');
    ui.pinBtn.setAttribute('aria-pressed', S.onTop ? 'true' : 'false');
  }
  syncPanel();
}

// --------------------------------------------------------------- build UI ----
function keyBtn(act, icon, label, cls) {
  return h('button', { class: 'mp-key ' + cls, 'data-act': act, title: label, 'aria-label': label, type: 'button' }, svg(icon));
}
// A small key with text (and optionally an icon and a Japanese reading).
function textKey(act, en, ja, title, icon, extra) {
  return h('button', { class: 'mp-key mpc-lib' + (extra ? ' ' + extra : ''), 'data-act': act, type: 'button', title: title || en },
    icon ? svg(icon) : null, h('span', { text: en }), ja ? jp(ja) : null);
}
// A larger key with an English label over its Japanese reading.
function labelKey(act, icon, en, ja, title, lamp) {
  var label = h('span', { class: 'mp-btn-label' }, h('span', { class: 'mp-btn-en', text: en }), jp(ja, 'mp-btn-jp'));
  return h('button', { class: 'mp-key mp-btn', 'data-act': act, type: 'button', title: title, 'aria-label': title },
    lamp ? h('i', { class: 'mp-led', 'data-on': '1' }) : null, svg(icon), label);
}

function buildApp() {
  var root = h('div', { id: 'mp-app', class: 'mp-ui', 'data-state': 'stop' });

  // ---- top strip ----
  ui.pinBtn = keyBtn('ontop', I.pin, 'Keep on top of other windows', 'mpc-ibtn only-compact');
  ui.pinBtn.setAttribute('data-on', S.onTop ? '1' : '0');
  ui.pinBtn.setAttribute('aria-pressed', S.onTop ? 'true' : 'false');
  ui.search = h('input', { type: 'search', placeholder: 'Search  検索', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Search your library and Apple Music' });
  ui.search.addEventListener('input', onSearchInput);
  ui.strip = h('div', { class: 'mpc-strip' },
    __MP_ICON ? h('img', { class: 'mpc-logo', src: __MP_ICON, alt: '' }) : null,
    h('span', { class: 'mpc-brand', text: 'MUSIC PLAYER' }),
    jp('ミュージックプレーヤー', 'mpc-brand-jp'),                       // "music player"
    h('span', { class: 'mp-grip' }),
    h('label', { class: 'mpa-search only-full' }, svg(I.search), ui.search),
    keyBtn('theme', I.theme, 'Themes and settings', 'mpc-ibtn'),
    ui.pinBtn,
    textKey('compact', 'COMPACT', null, 'Small player (Ctrl+M)', I.mini, 'only-full'),
    textKey('full', 'LIBRARY', null, 'Back to the full player (Ctrl+M)', null, 'only-compact'));
  ui.strip.addEventListener('click', onActClick);

  // ---- deck ----
  ui.time = h('button', { class: 'mpc-time', 'data-act': 'timemode', title: 'Click to switch between elapsed and remaining time', type: 'button', text: '--:--' });
  ui.viz = h('canvas', { class: 'mpc-viz', 'aria-hidden': 'true' });
  var clockLcd = h('div', { class: 'mpc-lcd mpc-clock' },
    h('div', { class: 'mpc-state' }, svg(I.play, 's-play'), svg(I.pause, 's-pause'), svg(I.stop, 's-stop')),
    ui.time, ui.viz);

  ui.marqueeIn = h('div', { class: 'mpc-marquee-in' });
  ui.marquee = h('div', { class: 'mpc-marquee' }, ui.marqueeIn);
  ui.album = h('div', { class: 'mpc-album' });
  ui.chipState = h('span', { class: 'mpc-chip mpc-chip-state', lang: 'ja', text: JP_STATE.stop });
  ui.chipKbps = h('span', { class: 'mpc-chip' });
  ui.chipPos = h('span', { class: 'mpc-chip' });
  // add the song that is playing to the library or to a playlist
  ui.chipAdd = h('button', { class: 'mpc-chip mpc-chip-key', 'data-act': 'nowmenu', type: 'button', hidden: true,
    title: 'Add this song to your library or to a playlist', text: '+ ADD' });
  ui.art = h('img', { class: 'mpc-art', alt: '' });
  var infoLcd = h('div', { class: 'mpc-lcd mpc-info' },
    ui.marquee,
    h('div', { class: 'mpc-meta' }, ui.album, h('div', { class: 'mpc-chips' }, ui.chipState, ui.chipKbps, ui.chipPos, ui.chipAdd)),
    ui.art);

  ui.seek = makeSlider('Position',
    function (v) { S.dragSeek = v; refreshTime(); },
    function (v) { seekTo(v); });
  ui.seek.classList.add('mpc-seek');

  ui.vol = makeSlider('Volume', setVolumePos, null);
  ui.repeatLabel = h('span', { text: 'REPEAT' });
  ui.shuffle = h('button', { class: 'mp-key mpc-toggle', 'data-act': 'shuffle', type: 'button', 'aria-pressed': 'false', title: 'Shuffle' },
    h('i', { class: 'mp-led' }), h('span', { text: 'SHUFFLE' }));
  ui.repeat = h('button', { class: 'mp-key mpc-toggle', 'data-act': 'repeat', type: 'button', 'aria-pressed': 'false', title: 'Repeat: off, all, one' },
    h('i', { class: 'mp-led' }), ui.repeatLabel);
  // the three panel switches, in the spirit of Winamp's EQ / PL keys
  ui.tgViz = smallToggle('viz', 'VIS', 'Visualizer (G)');
  ui.tgLyr = smallToggle('lyr', 'LYR', 'Lyrics (L)');
  ui.tgPl = smallToggle('pl', 'PL', 'Queue (Q)');
  var controls = h('div', { class: 'mpc-controls' },
    h('div', { class: 'mpc-transport' },
      keyBtn('prev', I.prev, 'Previous (Z)', ''),
      keyBtn('play', I.play, 'Play (X)', ''),
      keyBtn('pause', I.pause, 'Pause (C)', ''),
      keyBtn('stop', I.stop, 'Stop (V)', ''),
      keyBtn('next', I.next, 'Next (B)', '')),
    h('div', { class: 'mpc-toggles' }, ui.shuffle, ui.repeat, h('span', { class: 'mp-grip' }), ui.tgViz, ui.tgLyr, ui.tgPl),
    ui.volBox = h('div', { class: 'mpc-vol' }, svg(I.speaker), ui.vol));
  // the mouse wheel over the volume (speaker included): small steps either way
  ui.volBox.addEventListener('wheel', function (e) {
    if (!e.deltaY) return;
    e.preventDefault();
    nudgeVolume(e.deltaY < 0 ? 0.02 : -0.02);
  }, { passive: false });

  ui.deck = h('div', { class: 'mpc-deck' }, clockLcd, infoLcd, ui.seek, controls);
  ui.deck.addEventListener('click', onActClick);

  // ---- library panel (full) ----
  ui.navPls = h('div', { class: 'mpa-nav-pls' });
  ui.navPlCount = h('span', { class: 'mpc-pl-count' });
  ui.nav = h('nav', { class: 'mpa-nav only-full', 'aria-label': 'Library' },
    h('div', { class: 'mpa-nav-sec' }, h('span', { text: 'LIBRARY' }), jp('ライブラリ'), h('span', { class: 'mp-grip' })),
    h('div', { class: 'mpa-nav-list' },
      navItem('recent', I.recent, 'Recently Added', '最近追加'),
      navItem('songs', I.note, 'Songs', '曲'),
      navItem('albums', I.disc, 'Albums', 'アルバム'),
      navItem('artists', I.person, 'Artists', 'アーティスト')),
    h('div', { class: 'mpa-nav-sec' }, h('span', { text: 'PLAYLISTS' }), jp('プレイリスト'), ui.navPlCount, h('span', { class: 'mp-grip' }),
      ui.navPlReset = h('button', { class: 'mpa-pl-reset', type: 'button', 'data-act': 'plreset', hidden: true,
        title: 'Back to Apple Music\'s order', text: 'RESET' })),
    ui.navPls,
    h('div', { class: 'mpa-nav-foot' },
      labelKey('theme', I.theme, 'THEMES', 'テーマ', 'Themes and settings', false),
      labelKey('apple', I.go, 'APPLE', 'ブラウズ', 'Apple Music pages: browse, radio, account', false)));
  ui.nav.addEventListener('click', onNavClick);
  // dragging playlists into the order the listener wants
  ui.navPls.addEventListener('pointerdown', onPlDown);
  ui.navPls.addEventListener('pointermove', onPlMove);
  ui.navPls.addEventListener('pointerup', onPlUp);
  ui.navPls.addEventListener('pointercancel', onPlUp);

  // ---- browser (full) ----
  ui.bBack = keyBtn('back', I.back, 'Back (Backspace)', 'mpb-back');
  ui.bBack.hidden = true;
  ui.bArt = h('img', { class: 'mpb-art', alt: '', hidden: true });
  ui.bTitle = h('span', { class: 'tx' });
  ui.bTitleJp = jp('');
  ui.bMeta = h('div', { class: 'mpb-meta', lang: 'ja' });
  ui.bPlay = textKey('playview', 'PLAY', '再生', 'Play from the top (or from the selected song)', I.play);
  ui.bShuffle = textKey('shuffleview', 'SHUFFLE', null, 'Play in random order', I.shuffle);
  // on Apple's own albums and playlists: add the whole thing to the library
  ui.bAddLabel = h('span', { text: 'ADD' });
  ui.bAdd = h('button', { class: 'mp-key mpc-lib', 'data-act': 'addview', type: 'button', hidden: true, 'data-done': '0',
    title: 'Add this to your library (it shows up on your other devices too)' }, svg(I.plus), ui.bAddLabel, jp('追加'));
  ui.bActions = h('div', { class: 'mpb-actions' }, ui.bAdd, ui.bPlay, ui.bShuffle);
  var head = h('div', { class: 'mpb-head' },
    ui.bBack, ui.bArt,
    h('div', { class: 'mpb-titles' }, h('div', { class: 'mpb-title' }, ui.bTitle, ui.bTitleJp), ui.bMeta),
    ui.bActions);
  head.addEventListener('click', onActClick);
  var cols = h('div', { class: 'mpb-cols' },
    h('span', { class: 'n', text: '#' }), h('span', { class: 't', text: 'TITLE' }), h('span', { class: 'a', text: 'ARTIST' }),
    h('span', { class: 'al', text: 'ALBUM' }), h('span', { class: 'd', text: 'TIME' }));
  ui.bBody = h('div', { class: 'mpb-body', tabindex: '-1' });
  ui.bBody.addEventListener('click', onBodyClick);
  ui.bBody.addEventListener('dblclick', onBodyClick);
  ui.bBody.addEventListener('contextmenu', onBodyMenu);
  ui.bBody.addEventListener('scroll', closeMenu, { passive: true });
  ui.toastText = h('span');
  ui.toast = h('div', { class: 'mpb-toast', role: 'status', 'data-show': '0' }, ui.toastText);
  ui.browser = h('section', { class: 'mpa-browser only-full', 'data-kind': 'msg', 'aria-label': 'Browser' },
    head, cols, ui.bBody,
    h('div', { class: 'mpb-kanji', lang: 'ja', 'aria-hidden': 'true', text: '音楽' }),     // "music"
    ui.toast);

  // ---- queue ----
  ui.count = h('span', { class: 'mpc-pl-count' });
  ui.plHead = h('div', { class: 'mpp-head' },
    h('span', { text: 'QUEUE' }), jp('再生リスト'), ui.count, h('span', { class: 'mp-grip' }),      // "play list"
    keyBtn('pl', I.close, 'Hide the queue (Q)', 'mpc-ibtn'));
  ui.list = h('div', { class: 'mpc-pl-list', role: 'listbox', 'aria-label': 'Queue' });
  ui.total = h('span', { class: 'mpc-pl-total', lang: 'ja' });
  var foot = h('div', { class: 'mpc-pl-foot' }, ui.total,
    textKey('full', 'OPEN LIBRARY', 'ライブラリ', 'Open the full player to play something else', null, 'only-compact'));
  var pl = h('div', { class: 'mpp mpc-pl' },
    ui.plHead, ui.list,
    h('div', { class: 'mpc-pl-kanji', lang: 'ja', 'aria-hidden': 'true', text: '音楽' }),
    foot);
  pl.addEventListener('click', onActClick);
  ui.list.addEventListener('click', onListClick);
  ui.list.addEventListener('dblclick', onListClick);
  ui.list.addEventListener('contextmenu', onListMenu);

  // ---- the column of panels: visualizer, lyrics, queue ----
  ui.panels = h('div', { class: 'mpa-side' }, buildVizPanel(), buildLyricsPanel(), pl);

  root.appendChild(ui.strip);
  root.appendChild(ui.deck);
  root.appendChild(ui.nav);
  root.appendChild(ui.browser);
  root.appendChild(ui.panels);
  ui.app = root;
  syncPanels();
  return root;
}

// A small key with a lamp, for things that are on or off.
function smallToggle(act, label, title) {
  return h('button', { class: 'mp-key mpc-toggle', 'data-act': act, type: 'button', 'aria-pressed': 'false', title: title },
    h('i', { class: 'mp-led' }), h('span', { text: label }));
}

function buildVizPanel() {
  ui.vzCanvas = h('canvas', { class: 'mpv-canvas', 'aria-hidden': 'true' });
  ui.vzOsdJp = jp('');
  ui.vzOsdEn = h('span');
  ui.vzOsd = h('div', { class: 'mpv-osd', 'data-show': '0' }, ui.vzOsdJp, ui.vzOsdEn);
  ui.vzLyricT = h('div', { class: 'mpv-lyric-t' });
  ui.vzLyricS = h('div', { class: 'mpv-lyric-s' });
  ui.vzLyric = h('div', { class: 'mpv-lyric', 'data-show': '0' }, ui.vzLyricT, ui.vzLyricS);
  ui.vzMenu = h('div', { class: 'mpv-menu', hidden: true });
  EFFECTS.forEach(function (fx) {
    ui.vzMenu.appendChild(h('button', { class: 'mpv-item', type: 'button', 'data-effect': fx.id, 'aria-pressed': 'false' },
      jp(fx.jp), h('span', { text: fx.name })));
  });
  // which graphics the effects run on (or why they cannot), under the list
  ui.vzInfo = h('div', { class: 'mpv-info', text: 'Graphics: starting...' });
  ui.vzMenu.appendChild(ui.vzInfo);
  // shown on the picture when only the plain bars can be drawn
  ui.vzNoteText = h('span');
  ui.vzNote = h('div', { class: 'mpv-note', hidden: true }, ui.vzNoteText,
    h('button', { class: 'mp-key mpv-retry', type: 'button', 'data-act': 'vizretry', text: 'TRY AGAIN' }));
  ui.vzScreen = h('div', { class: 'mpp-screen mpv-screen' }, ui.vzCanvas, ui.vzLyric, ui.vzOsd, ui.vzNote, ui.vzMenu);
  ui.vzSrc = h('span', { class: 'mpp-chip', 'data-s': 'idle' });
  ui.vzAuto = smallToggle('vizauto', 'AUTO', 'Move on to another effect every 40 seconds');
  var head = h('div', { class: 'mpp-head' },
    h('span', { text: 'VISUALIZER' }), jp('映像'), ui.vzSrc, h('span', { class: 'mp-grip' }),          // "picture"
    keyBtn('vizprev', I.back, 'Previous effect ([)', 'mpc-ibtn'),
    keyBtn('vizlist', I.grid, 'Choose an effect', 'mpc-ibtn'),
    keyBtn('viznext', I.go, 'Next effect (])', 'mpc-ibtn'),
    ui.vzAuto,
    keyBtn('vizbig', I.expand, 'Fill the window (F, or double-click the picture)', 'mpc-ibtn'),
    keyBtn('viz', I.close, 'Hide the visualizer (G)', 'mpc-ibtn'));
  ui.vzPanel = h('section', { class: 'mpp mpp-viz', 'aria-label': 'Visualizer', 'data-idle': '0' }, head, ui.vzScreen);
  head.addEventListener('click', onActClick);
  ui.vzScreen.addEventListener('dblclick', function (e) {
    if (!e.target.closest('.mpv-menu')) setVizBig(!S.vizBig);
  });
  ui.vzScreen.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-act]')) { onActClick(e); return; }      // TRY AGAIN
    var item = e.target.closest && e.target.closest('[data-effect]');
    if (item) {                       // picking one by hand means: stay on it
      vzSetAuto(false);
      vzSet(item.getAttribute('data-effect'), true);
      vzMenu(false);
    } else if (!ui.vzMenu.hidden) vzMenu(false);
  });
  ui.vzPanel.addEventListener('mousemove', function () { if (S.vizBig) vzIdle(false); });
  vzSetAuto(VZ.auto, false);
  vzColors();
  return ui.vzPanel;
}

function buildLyricsPanel() {
  ui.lyBody = h('div', { class: 'mpl-body', tabindex: '-1' });
  ui.lyRo = smallToggle('lyrroma', 'ROMAJI', 'Show how each line is pronounced (romanised)');
  ui.lyTr = smallToggle('lyrtrans', 'ENGLISH', 'Show the English translation under each line');
  ui.lyRo.hidden = ui.lyTr.hidden = true;
  var head = h('div', { class: 'mpp-head' },
    h('span', { text: 'LYRICS' }), jp('歌詞'), h('span', { class: 'mp-grip' }), ui.lyRo, ui.lyTr,
    keyBtn('lyr', I.close, 'Hide the lyrics (L)', 'mpc-ibtn'));
  ui.lyPanel = h('section', { class: 'mpp mpp-lyr', 'aria-label': 'Lyrics', 'data-synced': '0' }, head,
    h('div', { class: 'mpp-screen mpl-screen' }, ui.lyBody,
      h('div', { class: 'mpl-kanji', lang: 'ja', 'aria-hidden': 'true', text: '歌詞' })));     // "lyrics"
  head.addEventListener('click', onActClick);
  ui.lyBody.addEventListener('click', onLyricsClick);
  // scrolling by hand pauses the automatic scrolling for a moment
  ['wheel', 'pointerdown', 'touchstart'].forEach(function (ev) {
    ui.lyBody.addEventListener(ev, function () { LY.userAt = performance.now(); }, { passive: true });
  });
  lySyncKeys();
  return ui.lyPanel;
}

// Keys shown in Apple's sidebar while its pages are on screen.
function sideButtons() {
  return [
    labelKey('full', I.full, 'PLAYER', 'プレーヤー', 'Back to the player (Ctrl+M)', true),
    labelKey('theme', I.theme, 'THEMES', 'テーマ', 'Themes and settings', false)
  ];
}

// Brand plate for the top of Apple's sidebar.
function buildBrand() {
  return h('div', { class: 'mp-brand mp-ui' },
    __MP_ICON ? h('img', { class: 'mp-brand-logo', src: __MP_ICON, alt: '' }) : null,
    h('div', { class: 'mp-brand-text' }, h('span', { class: 'mp-brand-en', text: 'MUSIC PLAYER' }), jp('ミュージックプレーヤー', 'mp-brand-jp')),
    h('span', { class: 'mp-seal', lang: 'ja', 'aria-hidden': 'true', text: '音' }));   // "sound"
}

// The ring + watermark drawn around Apple's content area.
function buildFrame() {
  var f = h('div', { id: 'mp-frame', 'aria-hidden': 'true' });
  ['mpf-glass', 'mpf-top', 'mpf-bottom', 'mpf-left', 'mpf-c1', 'mpf-c2'].forEach(function (c) {
    f.appendChild(h('i', { class: c }));
  });
  f.appendChild(h('i', { class: 'mpf-kanji', lang: 'ja', text: '音楽' }));
  return f;
}

function buildPanel() {
  var wrap = h('div', { id: 'mp-panel-wrap', class: 'mp-ui', 'data-open': '0' });
  var panel = h('div', { class: 'mp-panel', role: 'dialog', 'aria-label': 'Themes and settings' });

  panel.appendChild(h('div', { class: 'mp-panel-head' },
    h('span', { class: 'mp-panel-title', text: 'THEMES' }), jp('テーマ', 'mp-panel-title-jp'),
    h('span', { class: 'mp-grip' }),
    h('button', { class: 'mp-key mp-x', 'data-act': 'closepanel', type: 'button', title: 'Close', 'aria-label': 'Close' }, svg(I.close))));

  var body = h('div', { class: 'mp-panel-body' });
  var grid = h('div', { class: 'mp-themes' });
  THEMES.forEach(function (t) {
    var prev = h('div', { class: 'mp-swatch-prev' });
    var dot = h('div', { class: 'mp-swatch-dot' }), lcd = h('div', { class: 'mp-swatch-lcd' });
    prev.style.background = 'linear-gradient(180deg,' + t.shellA + ',' + t.shellB + ')';
    dot.style.background = t.lit;
    dot.style.boxShadow = '0 0 5px ' + t.lit;
    lcd.style.background = t.lcdBg;
    [0.5, 0.9, 0.65, 1, 0.4, 0.75, 0.55, 0.3, 0.6, 0.35].forEach(function (v) {
      var bar = h('i');
      bar.style.background = t.lcdFg;
      bar.style.height = Math.round(v * 100) + '%';
      lcd.appendChild(bar);
    });
    prev.appendChild(dot);
    prev.appendChild(lcd);
    grid.appendChild(h('button', { class: 'mp-swatch', 'data-theme': t.id, type: 'button', 'aria-pressed': 'false', title: t.name },
      prev, h('div', { class: 'mp-swatch-name' }, h('span', { class: 'mp-swatch-en', text: t.name }), jp(t.jp, 'mp-swatch-jp'))));
  });
  body.appendChild(grid);

  body.appendChild(h('div', { class: 'mp-panel-sub' }, h('span', { text: 'COMPACT PLAYER' }), jp('設定'), h('span', { class: 'mp-grip' })));   // "settings"
  body.appendChild(h('button', { class: 'mp-opt', 'data-opt': 'autoCompact', type: 'button', role: 'switch', 'aria-checked': 'false' },
    h('span', { text: 'Shrink to the compact player when music starts' }),
    h('span', { class: 'mp-switch' }, h('i', { class: 'mp-led' }))));
  body.appendChild(h('button', { class: 'mp-opt', 'data-opt': 'onTop', type: 'button', role: 'switch', 'aria-checked': 'false' },
    h('span', { text: 'Keep the compact player above everything - fullscreen browsers, and games set to windowed fullscreen' }),
    h('span', { class: 'mp-switch' }, h('i', { class: 'mp-led' }))));
  body.appendChild(h('div', { class: 'mp-hint' },
    h('span', { class: 'mp-kbd', text: 'Ctrl+M' }), h('span', { text: ' compact / full    ' }),
    h('span', { class: 'mp-kbd', text: '/' }), h('span', { text: ' search    ' }),
    h('span', { class: 'mp-kbd', text: 'Space' }), h('span', { text: ' play / pause    ' }),
    h('span', { class: 'mp-kbd', text: 'Backspace' }), h('span', { text: ' back    ' }),
    h('span', { class: 'mp-kbd', text: 'G' }), h('span', { text: ' visualizer    ' }),
    h('span', { class: 'mp-kbd', text: 'L' }), h('span', { text: ' lyrics    ' }),
    h('span', { class: 'mp-kbd', text: 'Q' }), h('span', { text: ' queue    ' }),
    h('span', { class: 'mp-kbd', text: '[ ]' }), h('span', { text: ' change effect    ' }),
    h('span', { class: 'mp-kbd', text: 'F' }), h('span', { text: ' visualizer fills the window' })));
  panel.appendChild(body);

  wrap.appendChild(panel);
  wrap.addEventListener('click', function (e) {
    if (e.target === wrap) { closePanel(); return; }
    var sw = e.target.closest('[data-theme]');
    if (sw) { setTheme(sw.getAttribute('data-theme')); return; }
    var opt = e.target.closest('[data-opt]');
    if (opt) {
      var key = opt.getAttribute('data-opt');
      if (key === 'onTop') setOnTop(!S.onTop);
      else if (key === 'autoCompact') { S.autoCompact = !S.autoCompact; store.set('autoCompact', S.autoCompact); syncPanel(); }
      return;
    }
    onActClick(e);
  });
  ui.panelWrap = wrap;
  return wrap;
}

function syncPanel() {
  if (!ui.panelWrap) return;
  var sw = ui.panelWrap.querySelectorAll('[data-theme]'), i;
  for (i = 0; i < sw.length; i++)
    sw[i].setAttribute('aria-pressed', sw[i].getAttribute('data-theme') === themeNow().id ? 'true' : 'false');
  var opts = ui.panelWrap.querySelectorAll('[data-opt]');
  for (i = 0; i < opts.length; i++)
    opts[i].setAttribute('aria-checked', S[opts[i].getAttribute('data-opt')] ? 'true' : 'false');
}

function openPanel() {
  if (!ui.panelWrap) return;
  S.panelOpen = true;
  syncPanel();
  ui.panelWrap.setAttribute('data-open', '1');
}
function closePanel() {
  if (!ui.panelWrap) return;
  S.panelOpen = false;
  ui.panelWrap.setAttribute('data-open', '0');
}

function buildUi() {
  if (ui.root) return;
  ui.root = h('div', { id: 'mp-root' });

  // pieces that live inside Apple's sidebar (apple face)
  ui.brand = buildBrand();
  var sb = sideButtons();
  ui.side = h('div', { class: 'mp-side mp-ui' }, sb[0], sb[1]);
  ui.side.addEventListener('click', onActClick);
  var fb = sideButtons();
  ui.fab = h('div', { id: 'mp-fab', class: 'mp-ui', 'data-show': '0' }, fb[0], fb[1]);
  ui.fab.addEventListener('click', onActClick);
  ui.frame = buildFrame();

  ui.root.appendChild(ui.frame);
  ui.root.appendChild(buildApp());
  ui.root.appendChild(ui.fab);
  ui.root.appendChild(buildPanel());

  // the song menu (one, shared by every list)
  ui.menu = h('div', { id: 'mp-menu', class: 'mp-ui', 'data-open': '0', role: 'menu' });
  ui.menu.addEventListener('click', onMenuClick);
  ui.menu.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.target !== ui.menuName) return;
    e.preventDefault();
    var make = ui.menu.querySelector('[data-m="create"]');
    if (make) make.click();
  });
  ui.root.appendChild(ui.menu);
  // the engine's own right-click menu (Back, Reload, Inspect ...) has no place in the player
  ui.root.addEventListener('contextmenu', function (e) {
    var t = e.target, tag = (t && t.tagName) || '';
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') e.preventDefault();
  });
  vizColors();
}

// ------------------------------------------------- apple face: housekeeping --
// Apple's page re-renders itself, so keep our pieces where they belong. Only
// runs while Apple's pages are on screen.
function placeControls() {
  if (!document.body || !ui.root) return;
  if (!ui.root.isConnected) document.body.appendChild(ui.root);
  if (S.mode !== 'apple') return;

  // Is Apple showing its sidebar (wide window) or a top bar (narrow window)?
  var nav = document.querySelector('nav.navigation');
  var layout = 'top', left = 0, top = 0;
  if (nav) {
    var nr = nav.getBoundingClientRect();
    if (nr.height > window.innerHeight * 0.6 && nr.width > 100 && nr.width < window.innerWidth * 0.6) {
      layout = 'side';
      left = Math.round(nr.right);
    } else {
      top = Math.round(Math.max(0, nr.bottom));
    }
  }
  var root = document.documentElement;
  if (root.getAttribute('data-mp-layout') !== layout) root.setAttribute('data-mp-layout', layout);
  ui.frame.style.setProperty('--mpf-left', left + 'px');
  ui.frame.style.setProperty('--mpf-top', top + 'px');

  var head = document.querySelector('.navigation__header');
  if (head && ui.brand.parentNode !== head) head.insertBefore(ui.brand, head.firstChild);

  var slot = document.querySelector('.navigation__native-cta');
  if (slot && ui.side.parentNode !== slot) slot.insertBefore(ui.side, slot.firstChild);
  var r = ui.side.isConnected ? ui.side.getBoundingClientRect() : null;
  var visible = !!r && r.width > 60 && r.height > 10 && r.right > 0 && r.left < window.innerWidth &&
                r.bottom > 0 && r.top < window.innerHeight;
  ui.fab.setAttribute('data-show', visible ? '0' : '1');

  // Japanese readings beside the sidebar entries
  var labels = document.querySelectorAll('.navigation-item__label:not([data-jp-seen])');
  for (var i = 0; i < labels.length; i++) {
    var reading = JP_NAV[(labels[i].textContent || '').trim()];
    labels[i].setAttribute('data-jp-seen', '1');
    if (reading) labels[i].setAttribute('data-jp', reading);
  }
}

var appleWatch = null, applePending = 0;
function watchApple(on) {
  if (on && !appleWatch) {
    appleWatch = new MutationObserver(function () {
      if (applePending) return;
      applePending = setTimeout(function () { applePending = 0; placeControls(); }, 400);
    });
    appleWatch.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  } else if (!on && appleWatch) {
    appleWatch.disconnect();
    appleWatch = null;
  }
}

// ---------------------------------------------------------------- keyboard ---
function moveSel(delta) {
  if (!B.vlist || !B.items) return false;
  var n = B.vlist.count;
  if (!n) return false;
  var i = Math.max(0, Math.min(n - 1, (B.sel < 0 ? (delta > 0 ? -1 : n) : B.sel) + delta));
  selectRow(i);
  return true;
}

function onKey(e) {
  var typing = false, t = e.target, tag = (t && t.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) typing = true;

  if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && (e.key === 'm' || e.key === 'M')) {
    e.preventDefault(); e.stopImmediatePropagation();
    setMode(S.mode === 'full' ? 'compact' : 'full');
    return;
  }
  if (e.key === 'Escape') {
    if (menuOpen()) { e.preventDefault(); e.stopImmediatePropagation(); closeMenu(); return; }
    if (S.panelOpen) { e.preventDefault(); e.stopImmediatePropagation(); closePanel(); return; }
    if (ui.vzMenu && !ui.vzMenu.hidden) { e.preventDefault(); e.stopImmediatePropagation(); vzMenu(false); return; }
    if (S.vizBig) { e.preventDefault(); e.stopImmediatePropagation(); setVizBig(false); return; }
    if (S.mode === 'full' && t === ui.search) {
      e.preventDefault(); e.stopImmediatePropagation();
      ui.search.value = '';
      ui.search.blur();
      onSearchInput();
      return;
    }
  }
  if (S.mode === 'apple' || S.panelOpen) return;

  // search shortcuts (full face)
  if (S.mode === 'full' && !typing &&
      ((e.key === '/' && !e.ctrlKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'f' || e.key === 'F')))) {
    e.preventDefault(); e.stopImmediatePropagation();
    ui.search.focus();
    ui.search.select();
    return;
  }
  if (typing) {
    // keep Apple's own page shortcuts away from what is typed into our own boxes
    if (t === ui.search || (ui.menu && ui.menu.contains(t))) e.stopPropagation();
    return;
  }
  // Alt + Up / Down on a playlist in the library panel: move it up or down
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && t && ui.navPls && t.parentNode === ui.navPls) {
    e.preventDefault(); e.stopImmediatePropagation();
    var plId = t.getAttribute('data-go').slice(9), plAt = navPlItems().indexOf(t);
    movePlaylist(plId, plAt + (e.key === 'ArrowUp' ? -1 : 1));
    navPlItems().forEach(function (x) { if (x.getAttribute('data-go') === 'playlist:' + plId) x.focus(); });
    return;
  }
  if (S.mode === 'full' && e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault(); e.stopImmediatePropagation();
    goBack();
    return;
  }
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  var onControl = t && t.closest && t.closest('button, .mp-slider');
  var handled = true;
  switch (e.key) {
    case ' ':          if (onControl) return; togglePlay(); break;
    case 'ArrowLeft':  if (onControl) return; seekBy(-5); break;
    case 'ArrowRight': if (onControl) return; seekBy(5); break;
    case 'ArrowUp':
      if (onControl) return;
      if (S.mode === 'full') { if (!moveSel(-1)) handled = false; }
      else nudgeVolume(0.05);
      break;
    case 'ArrowDown':
      if (onControl) return;
      if (S.mode === 'full') { if (!moveSel(1)) handled = false; }
      else nudgeVolume(-0.05);
      break;
    case 'PageDown': if (S.mode !== 'full' || !moveSel(12)) handled = false; break;
    case 'PageUp':   if (S.mode !== 'full' || !moveSel(-12)) handled = false; break;
    case 'Enter':
      if (onControl || S.mode !== 'full' || !B.play || B.sel < 0) return;
      B.play(B.sel);
      break;
    case 'Backspace': if (S.mode !== 'full') return; goBack(); break;
    case 'z': case 'Z': ACT.prev(); break;
    case 'x': case 'X': ACT.play(); break;
    case 'c': case 'C': togglePlay(); break;
    case 'v': case 'V': ACT.stop(); break;
    case 'b': case 'B': ACT.next(); break;
    case 'g': case 'G': ACT.viz(); break;
    case 'l': case 'L': ACT.lyr(); break;
    case 'q': case 'Q': ACT.pl(); break;
    case 'f': case 'F': ACT.vizbig(); break;
    case '[': if (S.showViz) vzStep(-1); else handled = false; break;
    case ']': if (S.showViz) vzStep(1); else handled = false; break;
    default: handled = false;
  }
  if (handled) { e.preventDefault(); e.stopImmediatePropagation(); }
}

// ------------------------------------------------------------------- boot ----
function whenRoot(cb) {
  if (document.documentElement) { cb(); return; }
  var mo = new MutationObserver(function () {
    if (document.documentElement) { mo.disconnect(); cb(); }
  });
  mo.observe(document, { childList: true });
}
function whenBody(cb) {
  if (document.body) cb();
  else document.addEventListener('DOMContentLoaded', cb, { once: true });
}

window.addEventListener('keydown', onKey, true);
// sound from the app, for the visualizer and the level bars
if (host && typeof host.addEventListener === 'function') host.addEventListener('message', onHostMessage);
// mouse "back" button
window.addEventListener('mouseup', function (e) {
  if (e.button === 3 && S.mode === 'full') { e.preventDefault(); goBack(); }
}, true);
// the song menu closes when anything else is pressed, or the window loses focus
window.addEventListener('pointerdown', function (e) {
  if (menuOpen() && ui.menu && !ui.menu.contains(e.target)) closeMenu();
}, true);
window.addEventListener('blur', function () { closeMenu(); });

whenRoot(function () {
  installCss();
  applyTheme();
});

whenBody(function () {
  installCss();
  applyTheme();
  readCache();
  buildUi();
  placeControls();
  renderNavPlaylists();
  B.view = { kind: 'recent' };
  renderView();
  refreshAll();
  hookMusic();

  notifyHost();
  send('compact|0');
  send('ontop|' + (S.onTop ? 1 : 0));
  dlog('skin started, ' + innerWidth + 'x' + innerHeight + ', theme ' + S.theme);

  // Apple's player never came up (no network when the app started, say):
  // load the page again once the network is back, or every so often, at most
  // three times in a row
  window.addEventListener('online', function () { if (!S.music) location.reload(); });
  setTimeout(function retry() {
    if (S.music) { try { sessionStorage.removeItem('mp.reloads'); } catch (e) {} return; }
    var n = 0;
    try { n = +sessionStorage.getItem('mp.reloads') || 0; } catch (e) {}
    if (navigator.onLine && n < 3) {
      try { sessionStorage.setItem('mp.reloads', String(n + 1)); } catch (e) {}
      dlog('Apple\'s player did not start: loading the page again');
      location.reload();
    } else setTimeout(retry, 60000);
  }, 45000);
  lyRefresh();
  // draw the (idle) level bars and the visualizer once they have a size
  setTimeout(function () { kickViz(); vzKick(); }, 150);

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      placeControls();
      if (deckShown()) { setMarquee(S.marquee, true); kickViz(); vzKick(); }
      if (S.mode === 'full' && B.vlist) B.vlist.update(false);
    }, 120);
  });
  // back on screen (un-minimised, uncovered): pick the moving parts up again
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { kickViz(); vzKick(); lyKick(); }
  });

  // safety net: keep things in place even if an event is missed
  setInterval(function () {
    installCss();
    applyTheme();
    if (!ui.root.isConnected && document.body) document.body.appendChild(ui.root);
    if (deckShown()) { refreshState(); refreshTime(); vzKick(); lyRefresh(); lyKick(); }
  }, 1000);
});

// handy when poking around in DevTools (F12)
window.__mp = {
  state: S, themes: THEMES, db: DB, browser: B, setTheme: setTheme, setMode: setMode, go: go,
  sound: AU, viz: VZ, effects: EFFECTS, lyrics: LY, clock: CK,
  setPanel: setPanel, setEffect: vzSet, setVizBig: setVizBig, vizRetry: vzRetry, setOnTop: setOnTop,
  parseTtml: parseTtml, fetchLyrics: lyFetch, showLyrics: lyShow, songIdsFrom: songIdsFrom
};
