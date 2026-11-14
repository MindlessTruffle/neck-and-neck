import React, { useState } from 'react';
import { DEFAULT_SETTINGS, DEFAULT_BINDINGS } from './settings.js';
import { Icon } from './icons.jsx';
import { useT } from './i18n.jsx';
import './options.css';
export function Options({ value, onChange, onClose, onFullscreen }) {
  const t = useT(), [tab, setTab] = useState('Controls'), [binding, setBinding] = useState(null);
  const set = (key, next) => onChange({ ...value, [key]: next });
  const slider = (key, label, min, max, step, format = v => v.toFixed(1)) => <label className="option-row" key={key}><span>{t(label)}</span><div><input aria-label={t(label)} type="range" min={min} max={max} step={step} value={value[key]} onChange={e => set(key, Number(e.target.value))}/><output>{format(value[key])}</output></div></label>;
  const toggle = (key, label) => <label className="option-row" key={key}><span>{t(label)}</span><input type="checkbox" checked={value[key]} onChange={e => set(key, e.target.checked)}/></label>;
  const select = (key, label, choices) => <label className="option-row" key={key}><span>{t(label)}</span><select value={value[key]} onChange={e => set(key, e.target.value)}>{choices.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}</select></label>;
  return <section className="options-panel" role="dialog" aria-modal="true" aria-label={t('Options')} onKeyDown={event => {
    if (binding) { event.preventDefault(); event.stopPropagation(); if (event.code === 'Escape') { setBinding(null); return; } if (!/^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ControlLeft|Arrow(Up|Down|Left|Right))$/.test(event.code)) return;
      const keys = { ...value.bindings }, other = Object.keys(keys).find(k => keys[k] === event.code); if (other) keys[other] = keys[binding]; keys[binding] = event.code; set('bindings', keys); setBinding(null);
    }
  }}>
    <header><Icon name="settings" size={38}/><h1>{t('Options')}</h1><button onClick={onClose} aria-label={t('Back')}><Icon name="back"/></button></header>
    <nav>{['Controls', 'Audio', 'Video', 'Language'].map((name, i) => <button key={name} aria-pressed={tab === name} onClick={() => { setTab(name); setBinding(null); }}><Icon name={['touch', 'sound', 'fullscreen', 'language'][i]}/>{t(name)}</button>)}</nav>
    <div className="options-body">
      {tab === 'Controls' && <>{slider('sensitivity', 'Mouse sensitivity', .2, 3, .05)}{slider('touchSensitivity', 'Touch sensitivity', .2, 3, .05)}{toggle('invertY', 'Invert vertical aim')}{slider('cameraDistance', 'Camera distance', 6, 10, .1)}{select('touchMode', 'Touch controls', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']])}<div className="key-bindings">{Object.keys(DEFAULT_BINDINGS).map(key => <label key={key}><span>{t(({ jumpSet: 'Jump set' })[key] || key[0].toUpperCase() + key.slice(1))}</span><button aria-label={key} onClick={() => setBinding(key)}>{binding === key ? t('Press a key') : value.bindings[key].replace('Key', '').replace('Left', ' L')}</button></label>)}</div></>}
      {tab === 'Audio' && <>{slider('masterVolume', 'Master volume', 0, 1, .01, v => `${Math.round(v * 100)}%`)}{slider('musicVolume', 'Music volume', 0, 1, .01, v => `${Math.round(v * 100)}%`)}</>}
      {tab === 'Video' && <>{select('quality', 'Quality', [['auto', 'Auto'], ['low', 'Low'], ['high', 'High']])}{slider('fov', 'Field of view', -10, 15, 1, v => `${65 + v}°`)}{toggle('shadows', 'Shadows')}{toggle('reducedMotion', 'Reduced motion')}{toggle('shake', 'Camera shake')}{toggle('showFps', 'Show FPS')}<button className="option-fullscreen" onClick={onFullscreen}><Icon name="fullscreen"/>{t('Fullscreen')}</button></>}
      {tab === 'Language' && <div className="language-choices">{[['en', 'English'], ['es', 'Español'], ['fr', 'Français']].map(([id, label]) => <button key={id} lang={id} aria-pressed={value.language === id} onClick={() => set('language', id)}><Icon name="language"/>{label}{value.language === id && <Icon name="check"/>}</button>)}</div>}
    </div>
    <footer><button onClick={() => onChange({ ...DEFAULT_SETTINGS, language: value.language })}>{t('Reset defaults')}</button><span aria-live="polite">{binding ? t('Press a key') : ''}</span></footer>
  </section>;
}
