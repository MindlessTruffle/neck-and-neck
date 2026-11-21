import { WardrobePreview, revealTryOn } from './wardrobe-preview.jsx';
import { assetUrl } from './assets.js';
import React, { useEffect, useRef, useState } from 'react';
import { SKINS, ABILITY_CATALOG, ROLL_COST, DUPLICATE_REFUND, getSkin, getAbility, purchaseSkin, equipSkin, equipAbility, rollAbility, validateProfile } from './profile.js';
import './shop.css';
import './spin-menu.css';
import { CosmeticLocker } from './cosmetic-locker.jsx';
import { PowerRoll } from './power-roll.jsx';
import { Icon } from './icons.jsx';
import { PowerIcon } from './power-icon.jsx';
import { useT } from './i18n.jsx';

function Clover({size=20}) { return <Icon name="coin" size={size}/>; }

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
  const [collection,setCollection]=useState('skins');
  const powers = view === 'abilities';
  const item = getSkin(selectedSkin), power = getAbility(selectedAbility);
  const displayedPower=getAbility(selectedAbility);
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
  if (powers) return <section ref={panel} onKeyDown={keys} className={`power-spin-screen ${rolling ? 'is-spinning' : ''}`} role="dialog" aria-modal="true" aria-labelledby="spin-title">
    <header className="spin-heading"><span>{t(selectedAbility===profile.equippedAbility?'CURRENT POWER':'PREVIEW')}</span><h1 id="spin-title" style={{color: displayedPower.color}}>{rolling ? t('ROLLING…') : displayedPower.name}</h1><strong>{rolling ? t('GOOD LUCK!') : t(POWER_EFFECT[displayedPower.id])}</strong></header>
    <button className="spin-close" onClick={close} aria-label="Close locker"><Icon name="back"/></button>
    <aside className="spin-inventory" aria-label="Power collection"><h2>{t('YOUR POWERS')}</h2>{ABILITY_CATALOG.map(ability => {
      const unlocked=profile.ownedAbilities.includes(ability.id),active=profile.equippedAbility===ability.id;
      return <button key={ability.id} className={`spin-slot ${selectedAbility===ability.id?'selected':''}`} style={{'--power-color':ability.color}} aria-pressed={selectedAbility===ability.id} disabled={rolling} onClick={()=>{setSelectedAbility(ability.id);setLastRoll(null);onSound('menu');}}><PowerIcon id={ability.id} color={ability.color}/><span><b>{ability.name}</b><small>{rolling?'…':active?t('EQUIPPED'):unlocked?t('OWNED'):t('LOCKED')}</small></span></button>;
    })}</aside>
    <div className="spin-showcase"><div className="spin-aura"/><PowerRoll palette={getSkin(profile.equippedSkin).palette} cosmetics={profile.cosmetics} selected={rolling?rollTarget:selectedAbility} rolling={rolling} reducedMotion={reducedMotion} onTick={()=>onSound('menu')}/><div className="spin-reveal" role="status">{lastRoll ? lastRoll.duplicate ? `${t('DUPLICATE')} +${DUPLICATE_REFUND}` : t('NEW POWER!') : ''}</div></div>
    <aside className="spin-rates"><h2>{t('ROLL ODDS')}</h2><div className="spin-odds-list">{ABILITY_CATALOG.map(ability=><div key={ability.id} style={{'--power-color':ability.color}}><span>{ability.name}</span><strong>{ability.odds}%</strong></div>)}</div><div className="spin-equip"><PowerIcon id={power.id} color={power.color}/><b>{power.name}</b><button disabled={rolling||!profile.ownedAbilities.includes(power.id)||profile.equippedAbility===power.id} onClick={()=>apply(equipAbility(profileRef.current,power.id))}>{profile.equippedAbility===power.id?t('EQUIPPED'):profile.ownedAbilities.includes(power.id)?t('EQUIP POWER'):t('LOCKED')}</button></div></aside>
    <div className="spin-actions"><div className="spin-balance"><Clover size={26}/>{profile.coins.toLocaleString()}</div><button className="spin-button" onClick={roll} disabled={rolling||profile.coins<ROLL_COST}>{rolling?t('SPINNING…'):t('SPIN')}</button><div className="spin-cost">1 SPIN = <Clover size={22}/>{ROLL_COST}<span>{Math.floor(profile.coins/ROLL_COST)} {t(Math.floor(profile.coins/ROLL_COST)===1?'SPIN LEFT':'SPINS LEFT')}</span></div><span className="spin-notice" role="status" aria-live="polite">{notice}</span></div>
    <button className="spin-return" onClick={close}><Icon name="back"/>{t('RETURN TO LOBBY')}</button>
  </section>;
  return <section ref={panel} onKeyDown={keys} className={`locker-shop ${powers ? 'locker-powers' : 'locker-colours'}`} role="dialog" aria-modal="true" aria-labelledby="locker-title">
    <header className="locker-header"><div><span className="locker-kicker"></span><h1 id="locker-title">{powers ? t('PICK YOUR POWER.') : collection==='gear' ? t('HATS & GEAR') : t('COURT COLOURS.')}</h1></div><div className="locker-wallet"><Clover/><strong>{profile.coins.toLocaleString()}</strong><small>{t('CLOVERS')}</small></div><button className="locker-close" onClick={close} aria-label="Close locker">×</button></header>

    <nav className="locker-tabs" aria-label="Shop collection"><button aria-pressed={collection==='skins'} onClick={()=>setCollection('skins')}>COLOURS</button><button aria-pressed={collection==='gear'} onClick={()=>setCollection('gear')}>HATS & GEAR</button></nav>
    {collection==='gear'?<CosmeticLocker profile={profile} onChange={onChange} onNotice={message=>{setNotice(message);onSound('menu');}}/>:<div className="locker-skin-layout">
      <aside className="locker-skin-preview"><div className="locker-portrait-stage" style={{ '--coat': item.palette.body, '--trim': item.palette.scarf }}><span className="locker-rarity">{item.rarity}</span><WardrobePreview palette={item.palette} cosmetics={profile.cosmetics}/><div className="locker-colour-dots">{Object.values(item.palette).map((colour, index) => <i key={index} style={{ background: colour }}/>)}</div></div><h2>{item.name}</h2><button className="locker-primary" onClick={buy} disabled={equipped || (!owned && profile.coins < item.price)}><span>{equipped ? t('EQUIPPED') : owned ? t('EQUIP') : t('BUY')}</span>{!owned && <span><Clover size={19}/>{item.price}</span>}</button>{!owned && profile.coins < item.price && <small className="locker-refund">{item.price - profile.coins} more clovers to this colourway.</small>}</aside>
      <div className="locker-collection"><div className="locker-section-label"><h2>{t('THE COLLECTION')}</h2><span>{profile.ownedSkins.length} / {SKINS.length} COLOURWAYS</span></div><div className="locker-skin-grid">{SKINS.map(entry => <button key={entry.id} className={`locker-skin-card ${selectedSkin === entry.id ? 'is-selected' : ''}`} aria-pressed={selectedSkin === entry.id} onClick={e => { setSelectedSkin(entry.id); onSound('menu'); revealTryOn(e.currentTarget); }}><div style={{ '--card-coat': entry.palette.body }}><img loading="lazy" src={assetUrl('ui/locker/skin-'+entry.id+'.webp')} alt=""/>{profile.equippedSkin === entry.id && <i className="locker-card-equipped">{t('EQUIPPED')}</i>}</div><b>{entry.name}</b><small>{entry.rarity}</small><span>{profile.ownedSkins.includes(entry.id) ? t('OWNED') : <><Clover size={14}/>{entry.price}</>}</span></button>)}</div></div>
    </div>}
    <footer className="locker-footer"><span className="locker-notice" role="status" aria-live="polite">{notice}</span><button onClick={close} className="visual-back" aria-label="Back">➜</button></footer>
  </section>;
}

export default Shop;
