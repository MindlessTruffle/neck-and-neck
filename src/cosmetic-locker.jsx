import React from 'react';
import { COSMETICS } from './cosmetics-catalog.js';
import { purchaseCosmetic, equipCosmetic } from './profile.js';
import { assetUrl } from './assets.js';
import { Icon } from './icons.jsx';
export function CosmeticLocker({profile,onChange,onNotice}){
 const apply=result=>{if(result.ok)onChange(result.profile);onNotice(result.message);};
 return <div className="cosmetic-locker"><div className="cosmetic-equipped">{['hat','face','back'].map(slot=><button key={slot} disabled={!profile.cosmetics[slot]} onClick={()=>apply(equipCosmetic(profile,null,slot))}><Icon name={profile.cosmetics[slot]?'close':'check'} size={24}/>{profile.cosmetics[slot]?`Remove ${COSMETICS.find(c=>c.id===profile.cosmetics[slot])?.name}`:`No ${slot==='back'?'backpack':slot==='face'?'glasses':'hat'}`}</button>)}</div><div className="cosmetic-grid">{COSMETICS.map((item,i)=>{const owned=profile.ownedCosmetics.includes(item.id),equipped=profile.cosmetics[item.slot]===item.id;return <article key={item.id} className={equipped?'is-equipped':''}><div className="cosmetic-art" role="img" aria-label={item.name} style={{backgroundImage:`url("${assetUrl('ui/cosmetics-atlas.png')}")`,backgroundPosition:`${i%3*50}% ${Math.floor(i/3)*100}%`}}/><h2>{item.name}</h2><button disabled={equipped||(!owned&&profile.coins<item.price)} onClick={()=>apply(purchaseCosmetic(profile,item.id))}>{equipped?'EQUIPPED':owned?'EQUIP':<><Icon name="coin" size={24}/>{item.price} · BUY</>}</button></article>;})}</div></div>;
}
