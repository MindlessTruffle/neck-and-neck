import React from 'react';
import { Crest } from './ui-art.jsx';
import { LoadingScreen } from './loading-screen.jsx';
import { assetUrl } from './assets.js';
import './cloud-lobby.css';
import { Icon } from './icons.jsx';
import { useT } from './i18n.jsx';

const LANDMARKS = [
  { id: 'play', name: 'PLAY',  x: 25, y: 52 },
  { id: 'shop', name: 'STYLE',  x: 73, y: 48 },
  { id: 'abilities', name: 'POWERS',  x: 48, y: 69 },
  { id: 'online', name: 'MULTIPLAYER',  x: 83, y: 72 },
];

function LandmarkIcon({ id }) {
  return <svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" aria-hidden="true">{id === 'play' ? <><circle cx="20" cy="20" r="16" fill="#fff5d8"/><path d="M5 15q16 9 24-10M8 31q0-18 14-26m13 20q-17-2-18 10"/></> : id === 'shop' ? <path d="m13 7-9 7 6 9 5-3v15h17V20l5 3 5-9-10-7q-10 10-19 0Z" transform="translate(-3)" fill="#edc6d4"/> : id === 'abilities' ? <path d="m20 3 5 12 13 5-13 5-5 12-5-12-13-5 13-5Z" fill="#f7d16b"/> : <><path d="M4 11h32v23H4Z" fill="#c0dce2"/><path d="m4 11 16 13 16-13M5 33l11-12m19 12L24 21M14 5h20"/></>}</svg>;
}

function CloudBackdrop() {
  return <div className="lobby-clouds" aria-hidden="true"><i/><i/><i/><i/><i/></div>;
}

export function CloudLobby({ error, onReload, profile, skinName, abilityName, hotspots, onSelect, muted, music, touch, onMuted, onMusic, onTouch, onFullscreen, ready, progress, panelRef, children, view, onClose, onFocus }) {
  const t=useT();
  return <div className="cloud-lobby" data-view={view} ref={panelRef} onKeyDown={event => { if (event.key === 'Escape' && view !== 'home') onClose(); }}>
    <CloudBackdrop />
    {!ready && !error ? <LoadingScreen progress={progress}/> : <>
      {view === 'home' && <header className="sky-brand"><Crest/><div><small>{t('THE SKY CLUB')}</small><h1>NECK <i>&</i> NECK</h1></div></header>}
      {view === 'home' && <button className="sky-wallet" onClick={() => onSelect('shop')} aria-label={`Clovers ${profile.coins}. Open skins shop`}><Icon name="coin"/><b>{profile.coins.toLocaleString()}</b></button>}
      {error && <div className="sky-error" role="alert"><p>{error}</p><button onClick={onReload}>{t('RELOAD')}</button></div>}
      {view === 'home' ? <>
        <nav className="landmark-buttons" aria-label="Sky club destinations">{LANDMARKS.map(item => {
          const point = hotspots?.[item.id];
          const projected = point?.visible && Number.isFinite(point.x) && Number.isFinite(point.y);
          return <button key={item.id} className={`world-menu-access landmark-${item.id}`} onFocus={() => onFocus?.(item.id)} disabled={!ready} onClick={() => onSelect(item.id)} style={projected ? { left: `clamp(112px, ${point.x}px, calc(100% - 112px))`, top: `${point.y}px` } : { left: `clamp(112px, ${item.x}%, calc(100% - 112px))`, top: `${item.y}%` }}>
            <span className="landmark-icon"><LandmarkIcon id={item.id}/></span><strong>{t(item.name)}</strong>
          </button>;
        })}</nav>
        <div className="sky-loadout"><span>{skinName}</span><Icon name="power" size={20}/><span>{abilityName}</span></div>
        <footer className="sky-settings"><button onClick={() => onSelect("options")} aria-label={t("Options")}><Icon name="settings"/></button>
          <button onClick={() => onSelect('controls')} aria-label={t("How to play")}><Icon name="help"/></button>
          <button onClick={onMuted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}><Icon name={muted ? "mute" : "sound"}/></button>
          <button onClick={onMusic} aria-label={music ? 'Turn music off' : 'Turn music on'} aria-pressed={music}><Icon name="music"/></button>
          <button onClick={onTouch} aria-label={touch ? 'Turn touch controls off' : 'Turn touch controls on'} aria-pressed={touch}><Icon name="touch"/></button>
          <button onClick={onFullscreen} aria-label="Toggle fullscreen"><Icon name="fullscreen"/></button>
        </footer>
      </> : <div className={`sky-overlay sky-view-${view}`}><button className="sky-close" style={{ backgroundImage: `url("${assetUrl('kenney/ui/back-button-red.png')}")` }} onClick={onClose} aria-label="Back to clouds"><img className="sky-back-icon" src={assetUrl('kenney/ui/back-arrow-red.png')} alt=""/></button>{children}</div>}
    </>}
  </div>;
}
