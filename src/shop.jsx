import React, { useEffect, useRef, useState } from 'react';
import { SKINS, ABILITY_CATALOG, ROLL_COST, DUPLICATE_REFUND, getSkin, getAbility, purchaseSkin, equipSkin, equipAbility, rollAbility, validateProfile } from './profile.js';
import './shop.css';
import { PowerRoll } from './power-roll.jsx';
import { Icon } from './icons.jsx';
import { useT } from './i18n.jsx';

function Clover({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><path d="M16 16C3 13 7 0 14 5l2 4 2-4c7-5 11 8-2 11Zm0 0c3-13 16-9 11-2l-4 2 4 2c5 7-8 11-11-2Zm0 0c13 3 9 16 2 11l-2-4-2 4c-7 5-11-8 2-11Zm0 0c-3 13-16 9-11 2l4-2-4-2c-5-7 8-11 11 2Z" fill="#8dc875" stroke="#315b3a" strokeWidth="1.5"/><path d="M17 17q3 10 10 13" fill="none" stroke="#315b3a" strokeWidth="2.5" strokeLinecap="round"/></svg>;
}

export function SkinPortrait({ palette, className = '' }) {
  return <svg className={className} viewBox="0 0 220 260" aria-hidden="true" fill="none"><ellipse cx="111" cy="237" rx="64" ry="10" fill="#223d4920"/><g stroke="#28363d" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"><path d="m83 219 4-91 49-1 4 93Z" fill={palette.body}/><path d="m94 137 15-8 13 10-8 15-18-3m-3 22 16-9 16 12-8 16-21-3m-2 24 14-9 15 9-5 12-23 2" fill={palette.spots} strokeWidth="2"/><path d="m88 83-13-9-12 3 2 16 23 8m49-17 14-10 13 3-1 14-25 10" fill={palette.body}/><path d="m95 78-6-27m37 27 6-28" stroke={palette.body} strokeWidth="9"/><ellipse cx="88" cy="49" rx="8" ry="7" fill={palette.spots}/><ellipse cx="133" cy="48" rx="8" ry="7" fill={palette.spots}/><path d="M80 104q-3-36 30-37 33 0 34 36l-4 33q-7 24-31 23-28-2-31-25Z" fill={palette.body}/><path d="m85 87 8 4m30-4 8 2" stroke={palette.spots} strokeWidth="6"/><ellipse cx="95" cy="104" rx="8" ry="12" fill="#fff6e1"/><ellipse cx="126" cy="104" rx="8" ry="12" fill="#fff6e1"/><path d="M96 103v6m31-6v6" strokeWidth="6"/><path d="M76 125q4-17 34-17 30 0 38 18l-5 21q-35 20-66-1Z" fill={palette.muzzle}/><path d="m91 128 2 1m34-1 2 1m-27 15q10 7 19-1" strokeWidth="3"/><path d="M78 171q31 15 66-1l-3 20q-32 17-64-1Z" fill={palette.scarf}/><path d="m131 186 24 13-16 12 3 17-24-13Z" fill={palette.scarf}/><path d="m83 180 18 4m28 5 8 3" stroke={palette.accent} strokeWidth="4"/><path d="m82 220-5 14 30 2 5-16m12 0 2 17 27-2-10-15" fill={palette.spots}/></g></svg>;
}

function PowerIcon({ id, color, className = '' }) {
  return <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="43" fill={color} opacity=".35"/><g stroke="#253c49" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">{id === 'magnet' ? <><path d="M25 26v30q0 26 25 26t25-26V26H59v29q0 10-9 10t-9-10V26Z" fill={color}/><path d="M25 39h16m18 0h16M20 19l-7-7m66 7 8-7M50 24V11"/></> : id === 'feather' ? <><path d="M23 80q7-51 48-62 19 31-27 53Z" fill={color}/><path d="m23 80 43-48m-17 19 18-4m-27 15 17-3M49 51l1-15"/></> : id === 'spring' ? <><path d="m39 17 24 10-29 12 33 12-33 12 29 12-25 10" stroke={color} strokeWidth="14"/><path d="m39 17 24 10-29 12 33 12-33 12 29 12-25 10M29 87h40M30 12h39"/></> : id === 'rocket' ? <><path d="M36 67q0-35 29-48 16 29-7 55Z" fill={color}/><circle cx="58" cy="39" r="7" fill="#fff5dc"/><path d="m35 48-15 8-2 19 20-6m22-6 10 16-19 2-8-10M31 74 22 88m20-9-2 12"/></> : <><path d="m50 15 30 13-5 33q-5 16-25 27-21-12-26-27l-5-33Z" fill={color}/><path d="m35 50 11 12 22-27" stroke="#fff7e3" strokeWidth="7"/></>}</g></svg>;
}

const POWER_EFFECT = { magnet: 'WIDER RECEIVES', feather: 'FLOATING RETURNS', spring: 'HIGHER JUMPS', rocket: 'LONGER DIVES', shield: 'WIDER BLOCKS' };

export function Shop({ view = 'skins', profile: rawProfile, onChange, onClose, onSound = () => {}, reducedMotion = false }) {
  const t = useT();
  const profile = validateProfile(rawProfile), profileRef = useRef(profile), timer = useRef(null);
  const panel = useRef(null);
  profileRef.current = profile;
  const [selectedSkin, setSelectedSkin] = useState(profile.equippedSkin);
  const [selectedAbility, setSelectedAbility] = useState(profile.equippedAbility);
  const [rollTarget, setRollTarget] = useState(profile.equippedAbility);
  const [rolling, setRolling] = useState(false), [notice, setNotice] = useState(''), [lastRoll, setLastRoll] = useState(null);
  const powers = view === 'abilities';
  const item = getSkin(selectedSkin), power = getAbility(selectedAbility);
  const owned = profile.ownedSkins.includes(item.id), equipped = profile.equippedSkin === item.id;
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.querySelector('button')?.focus();
    return () => { if (previous?.isConnected) previous.focus?.(); };
  }, []);
  useEffect(() => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; setRolling(false); setNotice(''); setLastRoll(null); }, [view]);

  const apply = result => {
    setNotice(result.message);
    if (result.ok) { onChange?.(result.profile); onSound(result.ability ? 'ability' : 'score'); }
    else onSound('menu');
    return result;
  };
  const buy = () => apply(owned ? equipSkin(profileRef.current, item.id) : purchaseSkin(profileRef.current, item.id));
  const roll = () => {
    if (rolling) return;
    if (profileRef.current.coins < ROLL_COST) { apply(rollAbility(profileRef.current)); return; }
    const result = rollAbility(profileRef.current);
    if (!result.ok) { apply(result); return; }
    onChange?.(result.profile); setRollTarget(result.ability.id);
    onSound('roll'); setRolling(true); setNotice(''); setLastRoll(null);
    timer.current = setTimeout(() => {
      timer.current = null; setSelectedAbility(result.ability.id); setLastRoll(result);
      setNotice(result.message); onSound('ability'); setRolling(false);
    }, reducedMotion ? 300 : 2750);
  };
  const close = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; onSound('menu'); onClose?.(); };

  const keys = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <section ref={panel} onKeyDown={keys} className={`locker-shop ${powers ? 'locker-powers' : 'locker-colours'}`} role="dialog" aria-modal="true" aria-labelledby="locker-title">
    <header className="locker-header"><div><span className="locker-kicker"></span><h1 id="locker-title">{powers ? t('PICK YOUR POWER.') : t('COURT COLOURS.')}</h1></div><div className="locker-wallet"><Clover/><strong>{profile.coins.toLocaleString()}</strong><small>{t('CLOVERS')}</small></div><button className="locker-close" onClick={close} aria-label="Close locker">×</button></header>

    {powers ? <div className="locker-power-layout">
      <aside className="locker-roll-panel">
        <PowerRoll selected={rolling ? rollTarget : (lastRoll?.ability || power).id} rolling={rolling} reducedMotion={reducedMotion} onTick={() => onSound('menu')}/>
        <span className="locker-kicker">{lastRoll ? lastRoll.duplicate ? t('DUPLICATE DRAW') : t('NEW POWER UNLOCKED') : ''}</span>
        <h2>{rolling ? t('HERE IT COMES…') : (lastRoll?.ability || power).name}</h2>

        <button className="locker-primary" onClick={roll} disabled={rolling || profile.coins < ROLL_COST}><span>{rolling ? t('DRAWING…') : t('ROLL A POWER')}</span><span><Clover size={19}/>{ROLL_COST}</span></button>
        <small className="locker-refund">Duplicate: +{DUPLICATE_REFUND} clovers</small>
        <details className="locker-odds"><summary>{t('ROLL ODDS')}</summary>{ABILITY_CATALOG.map(ability => <div key={ability.id}><i style={{ background: ability.color }}/><span>{ability.name}</span><strong>{ability.odds}%</strong></div>)}</details>
      </aside>
      <div className="locker-collection"><div className="locker-section-label"><h2>{t('YOUR PLAYBOOK')}</h2><span>{profile.ownedAbilities.length} / {ABILITY_CATALOG.length} POWERS</span></div><div className="locker-ability-grid">{ABILITY_CATALOG.map(ability => {
        const unlocked = profile.ownedAbilities.includes(ability.id), active = profile.equippedAbility === ability.id;
        return <button key={ability.id} className={`locker-ability-card ${selectedAbility === ability.id ? 'is-selected' : ''} ${active ? 'is-equipped' : ''}`} aria-pressed={selectedAbility === ability.id} onClick={() => { setSelectedAbility(ability.id); setLastRoll(null); onSound('menu'); }}><PowerIcon id={ability.id} color={ability.color}/><div><small>{ability.rarity}</small><b>{ability.name}</b></div><i>{active ? t('EQUIPPED') : unlocked ? t('OWNED') : `${ability.odds}% DRAW`}</i></button>;
      })}</div><div className="locker-power-detail"><div><b>{power.name}</b><p className="power-effect">{t(POWER_EFFECT[power.id])}</p></div><button className="locker-secondary" disabled={rolling || !profile.ownedAbilities.includes(power.id) || profile.equippedAbility === power.id} onClick={() => apply(equipAbility(profileRef.current, power.id))}>{profile.equippedAbility === power.id ? t('EQUIPPED') : profile.ownedAbilities.includes(power.id) ? t('EQUIP POWER') : t('UNLOCK BY ROLLING')}</button></div></div>
    </div> : <div className="locker-skin-layout">
      <aside className="locker-skin-preview"><div className="locker-portrait-stage" style={{ '--coat': item.palette.body, '--trim': item.palette.scarf }}><span className="locker-rarity">{item.rarity}</span><SkinPortrait palette={item.palette} className="locker-hero-giraffe"/><div className="locker-colour-dots">{Object.values(item.palette).map((colour, index) => <i key={index} style={{ background: colour }}/>)}</div></div><h2>{item.name}</h2><button className="locker-primary" onClick={buy} disabled={equipped || (!owned && profile.coins < item.price)}><span>{equipped ? t('EQUIPPED') : owned ? t('EQUIP') : t('BUY')}</span>{!owned && <span><Clover size={19}/>{item.price}</span>}</button>{!owned && profile.coins < item.price && <small className="locker-refund">{item.price - profile.coins} more clovers to this colourway.</small>}</aside>
      <div className="locker-collection"><div className="locker-section-label"><h2>{t('THE COLLECTION')}</h2><span>{profile.ownedSkins.length} / {SKINS.length} COLOURWAYS</span></div><div className="locker-skin-grid">{SKINS.map(entry => <button key={entry.id} className={`locker-skin-card ${selectedSkin === entry.id ? 'is-selected' : ''}`} aria-pressed={selectedSkin === entry.id} onClick={() => { setSelectedSkin(entry.id); onSound('menu'); }}><div style={{ '--card-coat': entry.palette.body }}><SkinPortrait palette={entry.palette}/>{profile.equippedSkin === entry.id && <i className="locker-card-equipped">{t('EQUIPPED')}</i>}</div><b>{entry.name}</b><small>{entry.rarity}</small><span>{profile.ownedSkins.includes(entry.id) ? t('OWNED') : <><Clover size={14}/>{entry.price}</>}</span></button>)}</div></div>
    </div>}
    <footer className="locker-footer"><span className="locker-notice" role="status" aria-live="polite">{notice}</span><button onClick={close} className="visual-back" aria-label="Back">➜</button></footer>
  </section>;
}

export default Shop;
