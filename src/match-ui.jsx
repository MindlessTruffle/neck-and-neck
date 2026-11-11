import React, { useRef } from 'react';
import { stickMovement } from './controls.js';
import { assetUrl } from './assets.js';

export function MatchUI({ state, onAction, onPause, onWalk, touch }) {
  const stick = useRef(null), stickPointer = useRef(null), origin = useRef({ x: 0, y: 0 });
  const ability = state.ability;
  const serving = state.phase === 'serve' && state.server === 0;
  const toss = serving && state.serveStage === 'toss';
  const air = state.airborne;
  const actions = [
    ['swing', serving ? toss ? 'STRIKE' : 'TOSS' : air ? 'SPIKE' : 'BUMP', 'CLICK', 'mouse_left'],
    ['set', air ? 'BLOCK' : 'SET', 'Q', 'keyboard_q'],
    ['jumpSet', 'JUMP SET', 'E', 'keyboard_e'],
    ['dive', 'DIVE', 'CTRL', null],
  ];
  const press = action => event => { event.preventDefault(); onAction(action); };
  const releaseStick = event => {
    if (stickPointer.current !== event.pointerId) return;
    stickPointer.current = null; onWalk({ x: 0, z: 0 }, event.pointerId);
    stick.current?.style.setProperty('--stick-x', '0px'); stick.current?.style.setProperty('--stick-y', '0px');
  };
  return <div className="match-ui" data-touch={touch}>
    <header className="match-top">
      <div className="scoreboard-ui" aria-label={`Meadow ${state.score[0]}, Ember ${state.score[1]}`}>
        <span className="team-name home">MEADOW</span><b>{state.score[0]}</b>
        <div className="round-pill"><span>{state.mode}</span><small>ROUND {state.round || 1}</small></div>
        <b>{state.score[1]}</b><span className="team-name away">EMBER</span>
      </div>
      <button className="pause-game" onClick={onPause} aria-label="Pause game">Ⅱ</button>
      <div className="rally-info"><span>{state.phase === 'point' ? state.message : serving ? toss ? 'CLICK AGAIN · LOCK YOUR POWER' : 'YOUR SERVE · TOSS THE BALL' : state.phase === 'serve' ? 'THEIR SERVE' : `RALLY ${state.rallyHits || 0}`}</span><div className="touch-pips" aria-label={`${state.touches?.[state.touchTeam ?? 0] || 0} team touches`}>{[1, 2, 3].map(n => <i key={n} data-active={n <= (state.touches?.[state.touchTeam ?? 0] || 0)}/>)}</div></div>
    </header>
    {state.reveal && ability && <div className="ability-reveal" key={`${state.round}-${ability.id}`} role="status" style={{ '--ability-color': ability.color || '#b7a2ff' }}><small>ROUND {state.round} · NEW ABILITY</small><strong>{ability.name}</strong><span>{ability.description}</span></div>}
    <div className="serve-meter" data-visible={toss} aria-hidden={!toss}><div><span>HIT POWER</span><b>{Math.round((state.serveCharge || 0) * 100)}%</b></div><div className="power-track"><i style={{ transform: `scaleX(${state.serveCharge || 0})` }}/><em/></div><small>Click again to serve · jump for a spike serve</small></div>
    <footer className="action-deck">
      <button className="ability-button" disabled={!ability?.ready || state.phase !== 'play'} onPointerDown={press('ability')} onClick={event => { if (event.detail === 0) onAction('ability'); }} style={{ '--ability-color': ability?.color || '#ba9eff' }} aria-label={`Use ${ability?.name || 'ability'}`}>
        <span className="ability-key">X</span><div><small>ROUND ABILITY</small><strong>{ability?.name || 'Drawing ability…'}</strong><span>{ability?.active > 0 ? 'ACTIVE' : ability?.charges > 0 ? state.phase === 'play' ? touch ? 'READY · TAP TO USE' : 'HOLD CLICK · USE POWER' : 'READY WHEN RALLY STARTS' : 'USED · NEXT ROUND'}</span></div><b className="ability-symbol">✦</b>
      </button>
      <div className="action-buttons">{actions.map(([id, name, key, icon]) => <button key={id} className={`action-button action-${id}`} onPointerDown={press(id)} onClick={event => { if (event.detail === 0) onAction(id); }} aria-label={name}><span className="keycap">{icon ? <img src={assetUrl(`kenney/controls/${icon}.png`)} alt={key}/> : key}</span><strong>{name}</strong></button>)}</div>
      <div className="movement-actions"><button onPointerDown={press('jump')} onClick={event => { if (event.detail === 0) onAction('jump'); }} aria-label="Jump"><span>SPACE</span>JUMP</button><button onPointerDown={press('dash')} onClick={event => { if (event.detail === 0) onAction('dash'); }} aria-label="Dash"><span>SHIFT</span>DASH</button></div>
      <div className="energy-track" aria-label={`Stamina ${Math.round(state.energy * 100)} percent`}><i style={{ transform: `scaleX(${state.energy})` }}/></div>
    </footer>
    <div ref={stick} className="touch-stick" aria-label="Movement joystick" role="group"
      onPointerDown={event => { if (stickPointer.current !== null) return; event.preventDefault(); stickPointer.current = event.pointerId; const box = event.currentTarget.getBoundingClientRect(); origin.current = { x: box.x + box.width / 2, y: box.y + box.height / 2 }; event.currentTarget.setPointerCapture(event.pointerId); const v = stickMovement(event.clientX - origin.current.x, event.clientY - origin.current.y); onWalk(v, event.pointerId); }}
      onPointerMove={event => { if (stickPointer.current !== event.pointerId) return; const v = stickMovement(event.clientX - origin.current.x, event.clientY - origin.current.y); onWalk(v, event.pointerId); stick.current.style.setProperty('--stick-x', `${v.x * 36}px`); stick.current.style.setProperty('--stick-y', `${v.z * 36}px`); }}
      onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}><span/><small>MOVE</small></div>
    <p className="look-hint">{touch ? 'DRAG FIELD TO SWING' : `MOUSE · SWING NECK   /   CLICK · RETURN   /   ${state.autoFeet ? 'AUTO FOOTWORK' : 'WASD · MOVE'}`}</p>
  </div>;
}
