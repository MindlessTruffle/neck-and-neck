import React, { useEffect, useRef, useState } from 'react';
import { assetUrl } from './assets.js';
import { Crest, ModeEmblem } from './ui-art.jsx';
import { ABILITIES } from './physics.js';
const FOES = [
  { id: 'chill', name: 'CASUAL', hint: 'Room to learn. Time to save.' },
  { id: 'club', name: 'CLUB', hint: 'Smart rotations. Proper rallies.' },
  { id: 'spicy', name: 'ELITE', hint: 'Quick reads. Brave blocks.' },
];
export function ControlArt({ names, label }) {
  return <span className="control-art" aria-label={label}>{names.map(name => <img key={name} src={assetUrl('kenney/controls/' + name + '.png')} alt=""/>)}</span>;
}
export function GameMenu({ menu, mode, difficulty, onMode, onDifficulty, onPlay, onBack, ready, error, result, muted, music, onMuted, onMusic, captureFailed, onReload, panelRef, onFullscreen, isFullscreen, onMenuSound, touch, onTouch, startHelp = false, online = false }) {
  const [help, setHelp] = useState(startHelp);
  const helpClose = useRef(null), helpButton = useRef(null), hadHelp = useRef(false);
  const foe = FOES.find(item => item.id === difficulty) || FOES[1];
  const paused = menu === 'pause', finished = menu === 'finished';
  useEffect(() => { if (help) { helpClose.current?.focus(); hadHelp.current = true; } else if (hadHelp.current) { helpButton.current?.focus(); hadHelp.current = false; } }, [help]);
  const click = fn => () => { onMenuSound(true); fn(); };
  const navigate = event => {
    if (event.code === 'KeyH') { event.preventDefault(); setHelp(value => !value); }
    if (event.code === 'Escape' && help) { event.preventDefault(); setHelp(false); }
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const buttons = [...panelRef.current.querySelectorAll('button:not(:disabled)')].filter(el => el.getClientRects().length);
    event.preventDefault();
    const i = buttons.indexOf(document.activeElement);
    buttons[(i + (event.key === 'ArrowDown' ? 1 : buttons.length - 1) + buttons.length) % buttons.length]?.focus();
  };
  return <div className="legends-menu" data-menu={menu}>
    <div className="club-brand"><Crest/><div><small>MEADOW SPORTS CLUB</small><strong>NECK <i>&</i> NECK</strong><span>VOLLEYBALL · LEGENDS IN THE MAKING</span></div></div>
    <div className="court-preview-caption"><b>BIG NECKS.<br/>BIGGER SAVES.</b><span>1v1 / 2v2 · PHYSICAL BOTS · YOUR LOOK / YOUR POWER</span></div>
    <section className={'menu-panel ' + (help ? 'show-help' : '')} role="dialog" aria-modal="true" aria-labelledby="menu-title" ref={panelRef} onKeyDown={navigate}>
      <div className="panel-topline"><span>{paused ? 'MATCH PAUSED' : finished ? 'FINAL WHISTLE' : 'PICKUP MATCH'}</span><button onClick={click(onFullscreen)} aria-label={isFullscreen ? 'Leave fullscreen' : 'Enter fullscreen'}>⛶</button></div>
      {help ? <div className="help-scroll">
        <button className="close-help" ref={helpClose} onClick={click(() => setHelp(false))} aria-label="Close controls">×</button>
        <h1 id="menu-title">OWN THE COURT.</h1><p className="menu-intro">Read the ball. Set your partner. Jump for the finish.</p>
        <dl className="control-list">
          <div><dt>MOUSE</dt><dd>Swing your physical neck. The shoulder camera follows with a little spring lag.</dd></div>
          <div><dt>CLICK</dt><dd>Return the ball. Swing your neck through contact; jump for a spike. Hold click for your equipped power. Serving: toss, then click to strike.</dd></div>
          <div><dt>FOOTWORK</dt><dd>WASD moves your hooves. Space jumps, Shift dashes. Ball assist helps returns land inside the court.</dd></div>
          <div><dt>Q / E</dt><dd>Q sets on ground, blocks in air. E jumps into a high set.</dd></div>
          <div><dt>CTRL / X</dt><dd>Ctrl dives for low saves. X activates your equipped ability.</dd></div>
          <div><dt>ALT / ESC</dt><dd>Alt toggles mouse capture. Esc pauses. Scroll stretches your neck.</dd></div>
        </dl>
        <p className="rules-note">Three touches per team. In doubles, alternate receivers. Solo allows repeat touches. First to 7, win by 2, cap at 11.</p>
        <p className="touch-note">PHONE: drag right field to swing, tap BUMP to return. Move with the left stick. Landscape gives the widest court view.</p>
        <div className="ability-codex">{ABILITIES.map(a => <div key={a.id} style={{ '--ability-color': a.color }}><b>{a.name}</b><span>{a.description}</span></div>)}</div>
        <button className="play-button" onClick={click(() => setHelp(false))}>GOT IT <span>↗</span></button>
      </div> : <>
        <h1 id="menu-title">{paused ? 'TAKE A BREATHER.' : finished ? result?.winner == null ? 'MATCH ENDED.' : result.winner === 0 ? 'COURT CONQUERED.' : 'NEXT ONE IS YOURS.' : 'MAKE YOUR PLAY.'}</h1>
        <p className="menu-intro">{paused ? online ? 'Online rally keeps going. Resume to rejoin the action.' : 'Your rally will be right here.' : finished ? result?.reason === 'reconnect-expired' ? 'Connection expired. Return to your party to play again.' : 'Same favourite power. One more rally.' : 'Bump. Set. Spike. Become the tallest legend.'}</p>
        {finished && <div className="final-score"><span>{result?.score[0]}</span><small>{result?.winner == null ? 'LAST SCORE' : 'FINAL'}</small><span>{result?.score[1]}</span></div>}
        {!paused && !online && <><fieldset className="formation"><legend>TEAM SIZE</legend><div>{['1v1', '2v2'].map(m => <button key={m} aria-pressed={m === mode} onClick={click(() => onMode(m))}><ModeEmblem mode={m}/><b>{m}</b><span>{m === '1v1' ? 'SOLO DUEL' : 'TEAM RALLY'}</span></button>)}</div></fieldset>
          <fieldset className="foes"><legend>BOT LEVEL <span>{foe.hint}</span></legend><div>{FOES.map(f => <button key={f.id} aria-pressed={difficulty === f.id} onClick={click(() => onDifficulty(f.id))}>{f.name}</button>)}</div></fieldset>
          <div className="round-feature"><span>✦</span><div><b>YOUR EQUIPPED POWER</b><small>Roll and equip at the Wishing Star. Refreshes each point.</small></div><em>ON</em></div>
        </>}
        {error ? <div className="error" role="alert"><p>{error}</p><button className="play-button" onClick={onReload}>RELOAD GAME</button></div> : <button className="play-button" disabled={!ready} onClick={click(onPlay)}>{!ready ? 'BUILDING THE COURT…' : paused ? 'BACK TO MATCH' : finished ? online ? 'BACK TO PARTY' : 'REMATCH' : 'PLAY MATCH'}<span>↗</span></button>}
        <div className="menu-links"><button ref={helpButton} onClick={click(() => setHelp(true))}>CONTROLS & ABILITIES</button>{menu !== 'lobby' && <button onClick={click(onBack)}>LOBBY</button>}</div>
        <div className="sound-options"><button aria-pressed={!muted} onClick={click(onMuted)}>SOUND <b>{muted ? 'OFF' : 'ON'}</b></button><button aria-pressed={music} onClick={click(onMusic)}>MUSIC <b>{music ? 'ON' : 'OFF'}</b></button><button aria-pressed={touch} onClick={click(onTouch)}>TOUCH <b>{touch ? 'ON' : 'OFF'}</b></button></div>
        {captureFailed && <p className="capture-hint">Mouse capture unavailable in this preview. Drag to aim, or open in Chrome / Edge.</p>}
      </>}
    </section>
    <div className="club-footer"><span>THE MEADOW / COURT 01</span><span>YOUR POWER. YOUR PLAY.</span></div>
  </div>;
}
