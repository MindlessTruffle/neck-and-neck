import React from 'react';
import duelArt from './artwork/duel-pixel.webp';
import teamArt from './artwork/team-pixel.webp';
import { Crest } from './ui-art.jsx';
import { LoadingScreen } from './loading-screen.jsx';
import { assetUrl } from './assets.js';
import './cloud-lobby.css';
import { Icon } from './icons.jsx';
import { useT } from './i18n.jsx';
import { usePresence } from './presence.js';
import { PowerIcon } from './power-icon.jsx';
import { getAbility } from './profile.js';

const DESTINATIONS = [
  ['play','PLAY'], ['shop','STYLE'], ['abilities','POWERS'], ['online','PARTY'],
];

function navigateStations(event) {
  const arrows={ArrowDown:[0,1],ArrowUp:[0,-1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
  const dir=arrows[event.key];
  if(!dir||!event.target.matches('.station-button'))return;
  const center=button=>{const r=button.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];};
  const [x,y]=center(event.target);
  const buttons=[...event.currentTarget.querySelectorAll('.station-button')];
  let nearest=null,best=Infinity;
  for(const button of buttons){
    const [bx,by]=center(button),dx=bx-x,dy=by-y,forward=dx*dir[0]+dy*dir[1];
    if(forward<12)continue;
    const cost=forward+Math.abs(dx*dir[1]-dy*dir[0])*2;
    if(cost<best){best=cost;nearest=button;}
  }
  event.preventDefault();nearest?.focus();
}

function CloudBackdrop() {
  return <div className="lobby-clouds" aria-hidden="true"><i/><i/><i/><i/><i/></div>;
}

export function CloudLobby({ error, onReload, profile, abilityName, onSelect, muted, music, touch, onMuted, onMusic, onTouch, onFullscreen, ready, progress, panelRef, children, view, onClose }) {
  const t=useT(),presence=usePresence(ready&&view==='home');
  return <div className="cloud-lobby" data-view={view} ref={panelRef} onKeyDown={event => {
    if (event.key === 'Escape' && view !== 'home') onClose();
    if (event.defaultPrevented || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
    const strip = event.target.closest('.party-options,.formation>div,.foes>div,.play-tabs');
    if (!strip) return;
    const buttons = [...strip.querySelectorAll('button:not(:disabled)')];
    const index = buttons.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length].focus();
  }}>
    <link rel="preload" as="image" href={duelArt}/><link rel="preload" as="image" href={teamArt}/>
    <link rel="preload" as="image" href={assetUrl('kenney/ui/back-button-red.png')}/>
    <CloudBackdrop />
    {!ready && !error ? <LoadingScreen progress={progress}/> : <>
      {view === 'home' && <header className="sky-brand"><Crest/><div><h1><span className="brand-sport">Giraffe Volleyball:</span> Neck <i>&amp;</i> Neck</h1></div></header>}
      {view === 'home' && <button className="sky-wallet" onClick={() => onSelect('shop')} aria-label={`Clovers ${profile.coins}. Open skins shop`}><Icon name="coin"/><b>{profile.coins.toLocaleString()}</b></button>}
      {error && <div className="sky-error" role="alert"><p>{error}</p><button onClick={onReload}>{t('RELOAD')}</button></div>}
      {view === 'home' ? <>
        <nav className="station-dock" aria-label="Sky club destinations" onKeyDown={navigateStations}>
          {DESTINATIONS.map(([id, label]) => <div className={`station station-${id}`} key={id}>
            <button className="station-button" disabled={!ready} onClick={() => onSelect(id)}>
              <i className="station-icon" aria-hidden="true"/><strong>{t(label)}</strong>
            </button>
            {id === 'abilities' && <button className="station-bubble" onClick={() => onSelect(id)}
              style={{backgroundImage:`url("${assetUrl('ui/player-power-bubble.png')}")`}}
              aria-label={`Equipped: ${abilityName}. Open powers`} title={abilityName}>
              <PowerIcon id={profile.equippedAbility} color={getAbility(profile.equippedAbility).color}/>
            </button>}
            {id === 'play' && <button className="station-bubble" onClick={() => onSelect(id)}
              style={{backgroundImage:`url("${assetUrl('ui/player-power-bubble.png')}")`}}
              aria-label={presence?.unavailable ? 'Player count unavailable. Open Play' : `${presence?.total??0} players. Open Play`}>
              <PowerIcon id="players"/><b>{presence&&!presence.unavailable ? presence.total : '—'}</b>
            </button>}
          </div>)}
        </nav>
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
