export const DEFAULT_BINDINGS = { forward: 'KeyW', backward: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', set: 'KeyQ', jumpSet: 'KeyE', dive: 'ControlLeft', dash: 'ShiftLeft', ability: 'KeyX' };
export const DEFAULT_SETTINGS = { language: 'en', sensitivity: 1, touchSensitivity: 1, invertY: false, cameraDistance: 7.2, fov: 0, masterVolume: .8, musicVolume: .65, quality: 'auto', shadows: true, reducedMotion: false, shake: true, showFps: false, touchMode: 'auto', bindings: DEFAULT_BINDINGS };
export function validateSettings(raw = {}) {
  raw=raw&&typeof raw==='object'?raw:{};
  const s = { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
  for (const key of ['invertY', 'shadows', 'reducedMotion', 'shake', 'showFps']) if (typeof raw[key] === 'boolean') s[key] = raw[key];
  for (const [key, min, max] of [['sensitivity', .2, 3], ['touchSensitivity', .2, 3], ['cameraDistance', 6, 10], ['fov', -10, 15], ['masterVolume', 0, 1], ['musicVolume', 0, 1]]) if (Number.isFinite(raw[key])) s[key] = Math.min(max, Math.max(min, raw[key]));
  for (const [key, values] of [['language', ['en', 'es', 'fr']], ['quality', ['auto', 'low', 'high']], ['touchMode', ['auto', 'on', 'off']]]) if (values.includes(raw[key])) s[key] = raw[key];
  const used = new Set();
  for (const action of Object.keys(DEFAULT_BINDINGS)) { const key = raw.bindings?.[action]; if (/^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ControlLeft|Arrow(Up|Down|Left|Right))$/.test(key || '') && !used.has(key)) { s.bindings[action] = key; used.add(key); } }
  if(new Set(Object.values(s.bindings)).size!==Object.keys(s.bindings).length)s.bindings={...DEFAULT_BINDINGS};
  return s;
}
export function loadSettings() { try { return validateSettings(JSON.parse(localStorage.getItem('neck.settings.v1') || '{}')); } catch { return validateSettings(); } }
export function saveSettings(value) { const s = validateSettings(value); try { localStorage.setItem('neck.settings.v1', JSON.stringify(s)); } catch {} return s; }
