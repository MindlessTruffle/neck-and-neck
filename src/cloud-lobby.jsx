import React from 'react';
import { Crest } from './ui-art.jsx';
import './cloud-lobby.css';

const LANDMARKS = [
  { id: 'play', name: 'LET’S PLAY', sub: '1v1 & 2v2 practice', icon: '🏐', x: 25, y: 52 },
  { id: 'shop', name: 'THE DRESSING CLOUD', sub: 'A fresh coat of spots', icon: '✿', x: 73, y: 48 },
  { id: 'abilities', name: 'WISHING STAR', sub: 'Roll & equip powers', icon: '✦', x: 48, y: 69 },
  { id: 'online', name: 'PARTY POST', sub: 'Friends & online queues', icon: '✉', x: 83, y: 72 },
];

function LandmarkIcon({id}) {
  return <svg viewBox="0 0 40 40" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" aria-hidden="true">{id === 'play' ? <><circle cx="20" cy="20" r="16" fill="#fff5d8"/><path d="M5 15q16 9 24-10M8 31q0-18 14-26m13 20q-17-2-18 10"/></> : id === 'shop' ? <path d="m13 7-9 7 6 9 5-3v15h17V20l5 3 5-9-10-7q-10 10-19 0Z" transform="translate(-3)" fill="#edc6d4"/> : id === 'abilities' ? <path d="m20 3 5 12 13 5-13 5-5 12-5-12-13-5 13-5Z" fill="#f7d16b"/> : <><path d="M4 11h32v23H4Z" fill="#c0dce2"/><path d="m4 11 16 13 16-13M5 33l11-12m19 12L24 21M14 5h20"/></>}</svg>;
}

export function CloudLobby({ error, onReload, profile, skinName, abilityName, hotspots, onSelect, muted, music, touch, onMuted, onMusic, onTouch, onFullscreen, ready, panelRef, children, view, onClose }) {
  return <div className="cloud-lobby" ref={panelRef} onKeyDown={event => { if (event.key === 'Escape' && view !== 'home') onClose(); }}>
    <header className="sky-brand"><Crest/><div><small>WELCOME TO THE SKY CLUB</small><h1>NECK <i>&</i> NECK</h1><span>A VERY TALL VOLLEYBALL ADVENTURE</span></div></header>
    <button className="sky-wallet" onClick={() => onSelect('shop')} aria-label={`Clovers ${profile.coins}. Open skins shop`}><span>✹</span><b>{profile.coins.toLocaleString()}</b><small>CLOVERS</small></button>
    {error && <div className="sky-error" role="alert"><p>{error}</p><button onClick={onReload}>RELOAD THE SKY CLUB</button></div>}
    {view === 'home' ? <>
      <div className="sky-welcome"><span>Take a breath. Stretch a neck.</span><strong>YOU’RE AMONG FRIENDS.</strong></div>
      <nav className="landmark-buttons" aria-label="Sky club destinations">{LANDMARKS.map(item => {
        const point = hotspots?.[item.id];
        const projected = point?.visible && Number.isFinite(point.x) && Number.isFinite(point.y);
        return <button key={item.id} className={`landmark-sign landmark-${item.id}`} disabled={!ready} onClick={() => onSelect(item.id)} style={projected ? { left: `clamp(95px, ${point.x}px, calc(100% - 95px))`, top: `${point.y}px` } : { left: `clamp(95px, ${item.x}%, calc(100% - 95px))`, top: `${item.y}%` }}>
          <span className="landmark-icon" aria-hidden><LandmarkIcon id={item.id}/></span><strong>{item.name}</strong><small>{ready ? item.sub : 'Fluffing the clouds…'}</small>
        </button>;
      })}</nav>
      <div className="sky-loadout"><span>YOUR LOOK <b>{skinName}</b></span><i/><span>YOUR POWER <b>{abilityName}</b></span></div>
      <footer className="sky-settings"><button onClick={() => onSelect('controls')}>HOW TO PLAY</button><button onClick={onMuted} aria-pressed={!muted}>SOUND {muted ? 'OFF' : 'ON'}</button><button onClick={onMusic} aria-pressed={music}>MUSIC {music ? 'ON' : 'OFF'}</button><button onClick={onTouch} aria-pressed={touch}>TOUCH {touch ? 'ON' : 'OFF'}</button><button onClick={onFullscreen} aria-label="Toggle fullscreen">⛶</button></footer>
    </> : <div className={`sky-overlay sky-view-${view}`}><button className="sky-close" onClick={onClose}>← BACK TO CLOUDS</button>{children}</div>}
  </div>;
}
