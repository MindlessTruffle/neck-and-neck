import React, { useEffect, useRef, useState } from 'react';
import { assetUrl } from './assets.js';
import { Crest, ModeEmblem } from './ui-art.jsx';
import './game-menu.css';
import { Icon } from './icons.jsx';
import { useT } from './i18n.jsx';
const FOES = [
  { id: 'chill', name: 'CASUAL', hint: 'CASUAL' },
  { id: 'club', name: 'CLUB', hint: 'CLUB' },
  { id: 'spicy', name: 'ELITE', hint: 'ELITE' },
];
export function ControlArt({ names, label }) {
  return <span className="control-art" role="img" aria-label={label}>{names.map(name => <img key={name} src={assetUrl('kenney/controls/' + name + '.png')} alt=""/>)}</span>;
}
export function GameMenu({ menu, mode, difficulty, onMode, onDifficulty, onPlay, onBack, ready, error, result, muted, music, onMuted, onMusic, captureFailed, onReload, panelRef, onFullscreen, isFullscreen, onMenuSound, touch, onTouch, startHelp = false, online = false, hasParty = false, onOptions }) {
  const t=useT();
  const [help, setHelp] = useState(startHelp);
  const helpClose = useRef(null), helpButton = useRef(null), hadHelp = useRef(false);
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
    <div className="club-brand"><Crest/><div><small>{t('MEADOW SPORTS CLUB')}</small><strong>NECK <i>&</i> NECK</strong><span>{t('VOLLEYBALL · LEGENDS IN THE MAKING')}</span></div></div>
    <div className="court-preview-caption"><b>{t('BIG NECKS.')}<br/>{t('BIGGER SAVES.')}</b><span>1v1 / 2v2 · PHYSICAL BOTS · YOUR LOOK / YOUR POWER</span></div>
    <section className={'menu-panel ' + (help ? 'show-help' : '')} role="dialog" aria-modal="true" aria-labelledby="menu-title" ref={panelRef} onKeyDown={navigate}>
      <div className="panel-topline"><span>{paused ? t('MATCH PAUSED') : finished ? t('FINAL WHISTLE') : t('PICKUP MATCH')}</span><button onClick={click(onFullscreen)} aria-label={isFullscreen ? 'Leave fullscreen' : 'Enter fullscreen'}><Icon name="fullscreen"/></button></div>
      {help ? <div className="help-scroll">
        <button className="close-help" ref={helpClose} style={{ backgroundImage: `url("${assetUrl('kenney/ui/back-button-red.png')}")` }} onClick={click(() => setHelp(false))} aria-label="Back to menu"><img src={assetUrl('kenney/ui/back-arrow-red.png')} alt=""/></button>
        <h1 id="menu-title">{t('HOW TO PLAY')}</h1>
        <div className="quick-controls" aria-label="Controls">
          <div><b>{t('NECK')}</b>{touch ? <span className="touch-glyph touch-word" aria-label="Drag field to swing">{t('DRAG')}</span> : <ControlArt names={['mouse_move']} label="Move mouse to swing your neck"/>}</div>
          <div><b>{t('RETURN')}</b>{touch ? <span className="touch-glyph" aria-label="Tap to return"><Icon name="ball"/></span> : <ControlArt names={['mouse_left']} label="Click to return the ball"/>}</div>
          <div><b>{t('SERVE')}</b><span className="control-key serve-prompt">{touch ? 'TAP → STRIKE' : 'TOSS → STRIKE'}</span></div>
          <div><b>{t('MOVE')}</b>{touch ? <span className="touch-glyph" aria-label="Movement joystick"><Icon name="touch"/></span> : <ControlArt names={['keyboard_w', 'keyboard_a', 'keyboard_s', 'keyboard_d']} label="W A S D move"/>}</div>
          <div><b>{t('SET')}</b>{touch ? <span className="touch-glyph" aria-label="Set action"><Icon name="jump"/></span> : <ControlArt names={['keyboard_q']} label="Q key sets and blocks"/>}</div>
          <div><b>{t('JUMP SET')}</b>{touch ? <span className="touch-glyph" aria-label="Jump set action"><Icon name="jump"/></span> : <ControlArt names={['keyboard_e']} label="E key jumps and sets"/>}</div>
          <div><b>{t('DIVE')}</b>{touch ? <span className="touch-glyph" aria-label="Dive action"><Icon name="dive"/></span> : <span className="control-key">{t('CTRL')}</span>}</div>
          <div><b>{t('JUMP')}</b>{touch ? <span className="touch-glyph" aria-label="Jump action"><Icon name="jump"/></span> : <span className="control-key">{t('SPACE')}</span>}</div>
          <div><b>{t('DASH')}</b>{touch ? <span className="touch-glyph" aria-label="Dash action"><Icon name="dash"/></span> : <span className="control-key">{t('SHIFT')}</span>}</div>
          <div><b>{t('POWER')}</b>{touch ? <span className="touch-glyph" aria-label="Power action"><Icon name="power"/></span> : <span className="control-key">X</span>}</div>
          {!touch && <div><b>{t('CAPTURE')}</b><span className="control-key">{t('ALT')}</span></div>}
          {!touch && <div><b>{t('STRETCH')}</b><ControlArt names={['mouse_scroll']} label="Scroll to stretch your neck"/></div>}
          <div><b>{t('PAUSE')}</b>{touch ? <span className="touch-glyph" aria-label="Pause game"><Icon name="pause"/></span> : <span className="control-key">{t('ESC')}</span>}</div>
        </div>
        <p className="rules-note" style={{ fontSize: 16 }}>3 TOUCHES · FIRST TO 7 · WIN BY 2</p>
        {touch && <p className="touch-note" style={{ fontSize: 16 }}>{t('PHONE · LANDSCAPE')}</p>}
        <button className="play-button" onClick={click(() => setHelp(false))}>GOT IT <Icon name="play"/></button>
      </div> : <>
        <h1 id="menu-title">{paused ? t('PAUSED') : finished ? result?.winner == null ? t('MATCH ENDED') : result.winner === 0 ? t('YOU WIN') : t('MATCH LOST') : t('PLAY')}</h1>
        {finished && <div className="final-score"><span>{result?.score[0]}</span><small>{result?.winner == null ? t('LAST SCORE') : t('FINAL')}</small><span>{result?.score[1]}</span></div>}
        {!paused && !online && <><fieldset className="formation"><legend>{t('TEAM SIZE')}</legend><div>{['1v1', '2v2'].map(m => <button key={m} aria-pressed={m === mode} onClick={click(() => onMode(m))}><ModeEmblem mode={m}/><b>{m}</b></button>)}</div></fieldset>
          <fieldset className="foes"><legend>{t('BOT LEVEL')}</legend><div>{FOES.map(f => <button key={f.id} aria-pressed={difficulty === f.id} onClick={click(() => onDifficulty(f.id))}>{t(f.name)}</button>)}</div></fieldset>
        </>}
        {error ? <div className="error" role="alert"><p>{error}</p><button className="play-button" onClick={onReload}>{t('RELOAD GAME')}</button></div> : <button className="play-button" disabled={!ready} onClick={click(onPlay)}>{!ready ? t('BUILDING THE COURT…') : paused ? t('BACK TO MATCH') : finished ? online ? hasParty ? t('BACK TO PARTY') : t('CHOOSE MATCH') : t('REMATCH') : t('PLAY MATCH')}<Icon name="play"/></button>}
        <div className="menu-links"><button ref={helpButton} onClick={click(() => setHelp(true))} style={{ fontSize: 16 }}>{t('CONTROLS')}</button>{menu !== 'lobby' && <button className="menu-back-arrow" style={{ backgroundImage: `url("${assetUrl('kenney/ui/back-button-red.png')}")` }} aria-label="Back to lobby" onClick={click(onBack)}><img src={assetUrl('kenney/ui/back-arrow-red.png')} alt=""/></button>}</div>
        <div className="sound-options"><button onClick={onOptions} aria-label={t("Options")}><Icon name="settings"/></button><button aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted} onClick={click(onMuted)}><Icon name={muted ? "mute" : "sound"}/></button><button aria-label={music ? 'Turn music off' : 'Turn music on'} aria-pressed={music} onClick={click(onMusic)}><Icon name="music"/></button><button aria-label={touch ? 'Turn touch controls off' : 'Turn touch controls on'} aria-pressed={touch} onClick={click(onTouch)}><Icon name="touch"/></button></div>
        {captureFailed && <p className="capture-hint" style={{ fontSize: 16 }}>{t('DRAG TO AIM')}</p>}
      </>}
    </section>
    <div className="club-footer"><span>{t('THE MEADOW / COURT 01')}</span><span>{t('YOUR POWER. YOUR PLAY.')}</span></div>
  </div>;
}
