import React, { useRef } from 'react';
import { stickMovement } from './controls.js';
import { Icon } from './icons.jsx';
import { useT } from './i18n.jsx';
import { assetUrl } from './assets.js';

export function MatchUI({ state, onAction, onPause, onWalk, touch }) {
  const t=useT();
  const stick = useRef(null), stickPointer = useRef(null), origin = useRef({ x: 0, y: 0 });
  const ability = state.ability;
  const serving = state.phase === 'serve' && (state.isServer ?? state.server === 0);
  const toss = serving && state.serveStage === 'toss';
  const air = state.airborne;
  const actions = [
    ['swing', serving ? toss ? t('STRIKE') : t('TOSS') : air ? t('SPIKE') : t('BUMP'), t('CLICK'), 'mouse_left'],
    ['set', air ? t('BLOCK') : t('SET'), 'Q', 'keyboard_q'],
    ['jumpSet', t('JUMP SET'), 'E', 'keyboard_e'],
    ['dive', t('DIVE'), t('CTRL'), null],
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
        <span className="team-name home">{t('MEADOW')}</span><b>{state.score[0]}</b>
        <div className="round-pill"><span>{state.mode}</span><small>ROUND {state.round || 1}</small></div>
        <b>{state.score[1]}</b><span className="team-name away">{t('EMBER')}</span>
      </div>
      <button className="pause-game" onClick={onPause} aria-label="Pause game"><Icon name="pause"/></button>
      <div className="rally-info"><span>{state.phase === 'point' ? state.message : serving ? toss ? touch ? t('TAP TO STRIKE') : t('CLICK AGAIN · LOCK YOUR POWER') : touch ? t('YOUR SERVE') : t('YOUR SERVE · TOSS THE BALL') : state.phase === 'serve' ? state.server === state.playerTeam ? t('PARTNER SERVES') : t('THEIR SERVE') : `RALLY ${state.rallyHits || 0}`}</span><div className="touch-pips" aria-label={`${state.touches?.[state.touchTeam ?? 0] || 0} team touches`}>{[1, 2, 3].map(n => <i key={n} data-active={n <= (state.touches?.[state.touchTeam ?? 0] || 0)}/>)}</div></div>
    </header>
    {state.reveal && ability && <div className="ability-reveal" key={`${state.round}-${ability.id}`} role="status" style={{ '--ability-color': ability.color || '#b7a2ff' }}><small>ROUND {state.round} · NEW ABILITY</small><strong>{ability.name}</strong><span>{ability.description}</span></div>}
    <div className="serve-meter serve-arc" data-visible={toss} aria-hidden={!toss}>
      <svg viewBox="0 0 320 90" role="img" aria-label={t('Serve')}><defs><linearGradient id="serve-rainbow"><stop stopColor="#ff3455"/><stop offset=".4" stopColor="#ffcd18"/><stop offset=".72" stopColor="#66ed39"/><stop offset="1" stopColor="#04efcf"/></linearGradient></defs><path d="M25 60Q160 4 295 60" fill="none" stroke="#23334b" strokeWidth="32" strokeLinecap="round"/><path d="M25 60Q160 4 295 60" fill="none" stroke="url(#serve-rainbow)" strokeWidth="24" strokeLinecap="round"/><path d="M25 60Q160 4 295 60" pathLength="100" fill="none" stroke="#20334b" strokeOpacity=".22" strokeWidth="24" strokeDasharray="100" strokeDashoffset={-Math.max(0,Math.min(100,(state.serveCharge||0)*100))}/><circle cx={25+270*(state.serveCharge||0)} cy={60-112*(state.serveCharge||0)*(1-(state.serveCharge||0))} r="16" fill="#fff7da" stroke="#23334b" strokeWidth="5"/></svg>
    </div>
    <footer className="action-deck">
      <button className="ability-button" disabled={!ability?.ready || state.phase !== 'play'} onPointerDown={press('ability')} onClick={event => { if (event.detail === 0) onAction('ability'); }} style={{ '--ability-color': ability?.color || '#ba9eff' }} aria-label={`Use ${ability?.name || 'ability'}`}>
        <span className="ability-key">X</span><div><small>{t('EQUIPPED POWER')}</small><strong>{ability?.name || 'Drawing ability…'}</strong><span>{ability?.active > 0 ? t('ACTIVE') : ability?.charges > 0 ? state.phase === 'play' ? touch ? t('READY · TAP TO USE') : t('HOLD CLICK · USE POWER') : t('READY WHEN RALLY STARTS') : t('USED · NEXT ROUND')}</span></div><Icon name="power"/>
      </button>
      <div className="action-buttons">{actions.map(([id, name, key, icon]) => <button key={id} className={`action-button action-${id}`} onPointerDown={press(id)} onClick={event => { if (event.detail === 0) onAction(id); }} aria-label={name}><span className="keycap">{icon ? <img src={assetUrl(`kenney/controls/${icon}.png`)} alt={key}/> : key}</span><span className="touch-action-icon" aria-hidden="true"><Icon name={id === "swing" ? "ball" : id === "set" ? "set" : id === "jumpSet" ? "jump" : "dive"}/></span><strong>{t(name)}</strong></button>)}</div>
      <div className="movement-actions"><button onPointerDown={press('jump')} onClick={event => { if (event.detail === 0) onAction('jump'); }} aria-label="Jump"><span>{t('SPACE')}</span>{touch ? <Icon name="jump"/> : t("JUMP")}</button><button onPointerDown={press('dash')} onClick={event => { if (event.detail === 0) onAction('dash'); }} aria-label="Dash"><span>{t('SHIFT')}</span>{touch ? <Icon name="dash"/> : t("DASH")}</button></div>
      <div className="energy-track" aria-label={`Stamina ${Math.round(state.energy * 100)} percent`}><i style={{ transform: `scaleX(${state.energy})` }}/></div>
    </footer>
    <div ref={stick} className="touch-stick" aria-label="Movement joystick" role="group"
      onPointerDown={event => { if (stickPointer.current !== null) return; event.preventDefault(); stickPointer.current = event.pointerId; const box = event.currentTarget.getBoundingClientRect(); origin.current = { x: box.x + box.width / 2, y: box.y + box.height / 2 }; event.currentTarget.setPointerCapture(event.pointerId); const v = stickMovement(event.clientX - origin.current.x, event.clientY - origin.current.y); onWalk(v, event.pointerId); }}
      onPointerMove={event => { if (stickPointer.current !== event.pointerId) return; const v = stickMovement(event.clientX - origin.current.x, event.clientY - origin.current.y); onWalk(v, event.pointerId); stick.current.style.setProperty('--stick-x', `${v.x * 36}px`); stick.current.style.setProperty('--stick-y', `${v.z * 36}px`); }}
      onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}><span/><small>{t('MOVE')}</small></div>
    <p className="look-hint">{touch ? t('DRAG FIELD TO SWING') : `MOUSE · SWING NECK   /   CLICK · RETURN   /   WASD · MOVE`}</p>
  </div>;
}
