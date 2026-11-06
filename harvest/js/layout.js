// v4.1 界面模式: which layout the screens use. Auto-detected from the viewport (size, aspect, dual-screen
// segments, iPad), or chosen in 设置 → 界面模式 (saved). Applied as root classes on <body>:
//   dev-phone | dev-duo | dev-tab | dev-ipad   — the device class
//   land | port                                — the real orientation of the viewport (always live)
//   mode-phone-l | mode-phone-p | mode-duo | mode-tab | mode-ipad   — combined, for the CSS
// plus --hinge (px) for the gap left free over the fold / hinge in the two-pane 双屏 layout.
export const MODES = { auto: '自动', 'phone-p': '手机竖屏', 'phone-l': '手机横屏', duo: '折叠屏 / 双屏', tab: '安卓平板', ipad: 'iPad' };

function segments() {
  try {
    const v = window.visualViewport;
    if (v && v.segments && v.segments.length > 1) return v.segments;
    if (typeof window.getWindowSegments === 'function') { const s = window.getWindowSegments(); if (s && s.length > 1) return s; }
  } catch (_) { /* ignore */ }
  return null;
}

// device class from what the screen looks like
export function detect(w = window.innerWidth, h = window.innerHeight) {
  const short = Math.min(w, h), long = Math.max(w, h), r = long / Math.max(1, short);
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  let mm = false; try { mm = matchMedia('(horizontal-viewport-segments: 2)').matches || matchMedia('(vertical-viewport-segments: 2)').matches; } catch (_) { /* ignore */ }
  if (segments() || mm) return 'duo';                    // Surface Duo / dual-screen spanned
  if (short < 600) return w >= h ? 'phone-l' : 'phone-p';   // phones (any aspect, incl. 20:9)
  if (ipad) return 'ipad';
  if (r <= 1.28) return 'duo';                           // square-ish inner screen of a foldable
  if (r <= 1.45) return 'ipad';                          // 4:3-ish tablet: centred card layout
  return 'tab';                                          // 16:10 Android tablet
}

export function hingeGap(w, h) {
  const s = segments();
  if (s && s.length > 1) { const a = s[0], b = s[1]; const gap = b.left > a.left ? b.left - (a.left + a.width) : b.top - (a.top + a.height); return Math.max(16, Math.round(gap) || 0); }
  return w >= h ? 28 : 0;
}

// apply the chosen (or detected) mode to <body>; returns { mode, dev, land, detected }
export function applyMode(choice = 'auto') {
  const w = window.innerWidth, h = window.innerHeight, land = w >= h;
  const det = detect(w, h), m = choice && choice !== 'auto' && MODES[choice] ? choice : det;
  const dev = m.startsWith('phone') ? 'phone' : m;
  const b = document.body, cl = b.classList;
  for (const c of [...cl]) if (c.startsWith('dev-') || c.startsWith('mode-')) cl.remove(c);
  cl.add('dev-' + dev, dev === 'phone' ? (land ? 'mode-phone-l' : 'mode-phone-p') : 'mode-' + dev);
  cl.toggle('land', land); cl.toggle('port', !land);
  cl.toggle('twopane', dev === 'duo' && land);
  document.documentElement.style.setProperty('--hinge', `${dev === 'duo' ? hingeGap(w, h) : 0}px`);
  return { mode: m, dev, land, detected: det, choice };
}
