import React, { useEffect, useRef, useState } from 'react';
import { assetUrl } from './assets.js';
import { Crest, ModeEmblem, TrophyArt, PauseArt } from './ui-art.jsx';

const FOES = [
  { id: 'chill', name: 'Chill', hint: 'Slow hooves. Gentle bonks.', pips: 1 },
  { id: 'club', name: 'Scrappy', hint: 'A proper neck-and-neck scrap.', pips: 2 },
  { id: 'spicy', name: 'Savage', hint: 'They have been practicing.', pips: 3 },
];

export function ControlArt({ names, label }) {
  return <span className="control-art" aria-label={label}>{names.map(name => <img key={name} src={assetUrl(`kenney/controls/${name}.png`)} alt="" />)}</span>;
}

function Arrow({ direction = 'right' }) {
  return <svg width="26" height="23" viewBox="0 0 26 23" aria-hidden="true" className={`menu-arrow ${direction}`}><path d="M3 7h11V2l10 9-10 10v-6H3Z" fill="currentColor" stroke="#302219" strokeWidth="2.5" strokeLinejoin="round"/></svg>;
}

function SoundGlyph({ music }) {
  return <svg viewBox="0 0 25 25" width="23" height="23" aria-hidden="true" fill="currentColor" stroke="#302219" strokeWidth="1.5" strokeLinejoin="round">{music ? <><path d="M10 5v14l12-4V2Z" fill="none" stroke="currentColor" strokeWidth="3"/><ellipse cx="7" cy="20" rx="4" ry="3"/><ellipse cx="19" cy="16" rx="4" ry="3"/></> : <><path d="M3 9h5l7-6v19l-7-6H3Z"/><path d="M19 7q7 6 0 12" fill="none" stroke="currentColor" strokeWidth="3"/></>}</svg>;
}

export function GameMenu({ menu, mode, difficulty, onMode, onDifficulty, onPlay, onBack, ready, error, result, muted, music, onMuted, onMusic, captureFailed, onReload, panelRef, onFullscreen, isFullscreen, onMenuSound }) {
  const [help, setHelp] = useState(false);
  const helpButton = useRef(null), helpClose = useRef(null), wasHelp = useRef(false);
  const foeIndex = Math.max(0, FOES.findIndex(foe => foe.id === difficulty));
  const foe = FOES[foeIndex];
  const finished = menu === 'finished', paused = menu === 'pause';
  const won = result?.winner === 0;

  useEffect(() => {
    if (help) { helpClose.current?.focus(); wasHelp.current = true; }
    else if (wasHelp.current) { helpButton.current?.focus(); wasHelp.current = false; }
  }, [help]);

  const soundClick = action => () => { onMenuSound(true); action(); };
  const cycleFoes = step => { onMenuSound(true); onDifficulty(FOES[(foeIndex + step + FOES.length) % FOES.length].id); };
  const navigate = event => {
    if (event.code === 'Escape' && help) { event.preventDefault(); setHelp(false); return; }
    if (event.code === 'KeyH') { event.preventDefault(); setHelp(value => !value); return; }
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const controls = [...panelRef.current.querySelectorAll('button:not(:disabled)')].filter(element => element.getClientRects().length);
    const index = controls.indexOf(document.activeElement);
    if (!controls.length) return;
    event.preventDefault();
    controls[(index + (event.key === 'ArrowDown' ? 1 : controls.length - 1) + controls.length) % controls.length].focus();
    onMenuSound(false);
  };

  return <div className="menu-scene" data-menu={menu}>
    <div className="wordmark" aria-label="Neck and Neck: Meadow Mayhem">
      <Crest className="title-crest" />
      <div className="logo-copy"><span className="logo-top">A very tall adventure</span><span className="logo-neck">NECK<span className="logo-amp">&</span>NECK</span><span className="logo-ribbon">MEADOW MAYHEM</span></div>
    </div>
    <section className={`menu-panel${help ? ' is-help' : ''}`} ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="menu-title" onKeyDown={navigate}>
      {help ? <div className="help-scroll">
        <button className="close-help" ref={helpClose} onClick={soundClick(() => setHelp(false))} aria-label="Close controls">×</button>
        <div className="chapter">The ancient art of bonking</div>
        <h1 id="menu-title" className="menu-title">Know thy neck!</h1>
        <dl className="control-scroll">
          <div><dt><ControlArt names={['keyboard_w','keyboard_a','keyboard_s','keyboard_d']} label="WASD"/></dt><dd><b>Move thy hooves</b><span>Walk relative to the camera.</span></dd></div>
          <div><dt><ControlArt names={['mouse_move','mouse_left']} label="Mouse and left click"/></dt><dd><b>Swing & bonk</b><span>Move your neck. Click to headbutt or serve.</span></dd></div>
          <div><dt><ControlArt names={['mouse_right']} label="Right mouse"/></dt><dd><b>Survey the chaos</b><span>Hold right mouse to turn. J / L also work. Camera stays high.</span></dd></div>
          <div><dt><ControlArt names={['keyboard_alt']} label="Alt"/></dt><dd><b>Grab thy mouse</b><span>Alt locks or releases mouse. A visible cursor stays centered.</span></dd></div>
          <div><dt><ControlArt names={['mouse_scroll','keyboard_q','keyboard_e']} label="Scroll or Q and E"/></dt><dd><b>More neck, please</b><span>Stretch or shorten your reach.</span></dd></div>
          <div><dt><ControlArt names={['keyboard_space','keyboard_shift']} label="Space and Shift"/></dt><dd><b>Leap & dash</b><span>Space jumps. Shift gives a quick burst.</span></dd></div>
          <div><dt><ControlArt names={['keyboard_r','keyboard_c','keyboard_escape']} label="R C and Escape"/></dt><dd><b>Recover thy dignity</b><span>R centers neck. C resets camera. Esc pauses.</span></dd></div>
        </dl>
        <p className="rules-note">Meet the glowing ball with your head. Gentle hits float; a little aim assist helps forward returns. Keep the volley alive! First to 7, win by 2, cap at 11.</p>
        <p className="touch-note">Touch: left drag walks, right drag swings, tap bonks, two fingers jump, three fingers pause.</p>
        <button className="play-button" onClick={soundClick(() => setHelp(false))}>I was born to bonk!<Arrow/></button>
      </div> : <>
        <button className="fullscreen-button" onClick={soundClick(onFullscreen)} aria-label={isFullscreen ? 'Leave fullscreen' : 'Enter fullscreen'} title="F toggles fullscreen"><ControlArt names={['keyboard_f']} label="F"/><span>{isFullscreen ? 'Windowed' : 'Fullscreen'}</span></button>
        {(paused || finished) && <div className="menu-ornament">{paused ? <PauseArt/> : <TrophyArt/>}</div>}
        <div className="chapter">{paused ? 'A most necessary breather' : finished ? 'The dust has settled' : 'Gather thy herd'}</div>
        <h1 id="menu-title" className="menu-title">{paused ? 'Hold thy neck!' : finished ? won ? 'Glorious victory!' : 'A noble bonking!' : 'Choose thy chaos!'}</h1>
        <p className="intro">{paused ? 'The ball can wait. Thy neck cannot.' : finished ? won ? 'The crowd demands another round.' : 'Dust off thy hooves. Demand a rematch.' : 'Pick a side. Stretch thy neck. Bonk somebody.'}</p>
        {finished && <div className="result-score" aria-label={`Final score ${result?.score[0]} to ${result?.score[1]}`}><span className="score-team">{result?.score[0] ?? 0}</span><b>:</b><span className="score-team away">{result?.score[1] ?? 0}</span></div>}
        {!paused && <>
          <fieldset className="match-picker"><legend>Battle formation</legend><div className="mode-options">{['1v1','2v2'].map(value => <button className="mode-card" key={value} aria-pressed={mode === value} onPointerEnter={() => onMenuSound(false)} onClick={soundClick(() => onMode(value))}><ModeEmblem mode={value}/><b>{value === '1v1' ? 'DUEL' : 'TAG TEAM'}</b><span>{value === '1v1' ? '1 vs 1 · A personal grudge' : '2 vs 2 · Bring a buddy'}</span><i aria-hidden="true"/></button>)}</div></fieldset>
          <div className="difficulty-picker" role="group" aria-label="Bot difficulty">
            <button className="difficulty-arrow" aria-label="Easier opponents" onClick={() => cycleFoes(-1)}>‹</button>
            <button className="difficulty-copy" aria-label={`Bot difficulty: ${foe.name}. Choose next level.`} onClick={() => cycleFoes(1)} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); cycleFoes(event.key === 'ArrowLeft' ? -1 : 1); } }}><small>Thy foes</small><b>{foe.name}</b><span>{foe.hint}</span><div className="difficulty-pips" aria-hidden="true">{[1,2,3].map(value => <i key={value} className={value <= foe.pips ? 'active' : ''}/>)}</div></button>
            <button className="difficulty-arrow" aria-label="Harder opponents" onClick={() => cycleFoes(1)}>›</button>
          </div>
        </>}
        {error ? <div className="error" role="alert"><p>{error}</p><button className="play-button" onClick={onReload}>Try again<Arrow/></button></div> : <button className="play-button" disabled={!ready} onPointerEnter={() => onMenuSound(false)} onClick={soundClick(onPlay)}>{!ready ? 'Rallying the herd…' : paused ? 'Back to the bonking!' : finished ? 'Demand a rematch!' : 'TO BATTLE!'}<Arrow/></button>}
        <div className="menu-secondary"><button className="back-button" ref={helpButton} onClick={soundClick(() => setHelp(true))}>How to bonk <span>?</span></button>{menu !== 'lobby' && <button className="back-button" onClick={soundClick(onBack)}>Retreat to camp</button>}</div>
        {captureFailed && <p className="capture-hint">Mouse capture was blocked here. Click the field or press Alt to retry. Chrome or Edge supports full capture; left-drag remains available.</p>}
        <div className="sound-options"><button className={`sound-toggle ${!muted ? 'is-on' : ''}`} aria-pressed={!muted} onClick={soundClick(onMuted)}><SoundGlyph/><span>Sound</span><b>{muted ? 'OFF' : 'ON'}</b></button><button className={`sound-toggle ${music ? 'is-on' : ''}`} aria-pressed={music} onClick={soundClick(onMusic)}><SoundGlyph music/><span>Music</span><b>{music ? 'ON' : 'OFF'}</b></button></div>
        <div className="quick-controls"><ControlArt names={['keyboard_arrows_all']} label="Arrow keys"/><span>Browse</span><ControlArt names={['keyboard_enter']} label="Enter"/><span>Choose</span></div>
      </>}
    </section>
    <div className="field-note"><span>One field. Four hooves.</span><p>ABSOLUTELY NO NECK BRAKES.</p></div>
  </div>;
}
