import React from 'react';
import { assetUrl } from './assets.js';
const IDS = ['magnet', 'feather', 'spring', 'rocket', 'shield', 'players'];
export function PowerIcon({ id, className = '' }) {
  const index = Math.max(0, IDS.indexOf(id));
  return <span className={`power-icon ${className}`} aria-hidden="true"><span className="power-icon-art" style={{backgroundImage:`url("${assetUrl('ui/power-icons-retro.png')}")`,backgroundPosition:`${index%3*50}% ${Math.floor(index/3)*100}%`}}/></span>;
}
