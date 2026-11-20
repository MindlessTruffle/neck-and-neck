import React,{useState} from 'react';
import {COSMETICS,getCosmetic} from './cosmetics-catalog.js';
import {purchaseCosmetic,equipCosmetic,getSkin} from './profile.js';
import {assetUrl} from './assets.js';
import {Icon} from './icons.jsx';
import {WardrobePreview,revealTryOn} from './wardrobe-preview.jsx';
const categories={hat:'Hats',face:'Glasses',back:'Back',scarf:'Scarves',goal:'Goal FX'};
export function CosmeticLocker({profile,onChange,onNotice}){
 const [slot,setSlot]=useState('hat'),[selected,setSelected]=useState(profile.cosmetics.hat||'cap');
 const item=getCosmetic(selected),owned=profile.ownedCosmetics.includes(selected),equipped=profile.cosmetics[slot]===selected;
 const apply=result=>{if(result.ok)onChange(result.profile);onNotice(result.message);};
 function browse(s){setSlot(s);setSelected(profile.cosmetics[s]||COSMETICS.find(c=>c.slot===s).id);}
 return <div className="locker-skin-layout wardrobe-layout"><aside className="locker-skin-preview">
   <WardrobePreview palette={getSkin(profile.equippedSkin).palette} cosmetics={{...profile.cosmetics,[slot]:selected}} back={slot==='back'} goalPreview={slot==='goal'}/>
   <h2>{item.name}</h2><button className="locker-primary" disabled={!owned&&profile.coins<item.price} onClick={()=>apply(equipped?equipCosmetic(profile,null,slot):purchaseCosmetic(profile,selected))}>{equipped?'REMOVE':owned?'EQUIP':<><Icon name="coin" size={20}/>{item.price} · BUY</>}</button>
 </aside><div className="locker-collection"><nav className="wardrobe-categories" aria-label="Gear category">{Object.entries(categories).map(([s,label])=><button key={s} aria-pressed={slot===s} onClick={()=>browse(s)}>{label}</button>)}</nav><div className="locker-skin-grid">{COSMETICS.filter(c=>c.slot===slot).map(c=><button key={c.id} className={'locker-skin-card '+(selected===c.id?'is-selected':'')} aria-pressed={selected===c.id} onClick={e=>{setSelected(c.id);revealTryOn(e.currentTarget);}}><div style={{'--card-coat':c.color}}><img loading="lazy" alt="" src={assetUrl('ui/locker/'+c.id+'.webp')}/></div><b>{c.name}</b><span>{profile.cosmetics[slot]===c.id?'EQUIPPED':profile.ownedCosmetics.includes(c.id)?'OWNED':<><Icon name="coin" size={16}/>{c.price}</>}</span></button>)}</div></div></div>;
}
