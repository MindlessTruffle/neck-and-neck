import React from 'react';
import { ICON_PATHS } from './icon-paths.js';
import { assetUrl } from './assets.js';
import './icons.css';
const atlas={settings:0,help:1,sound:2,mute:2,music:3,hand:4,touch:4,fullscreen:5,back:6,close:7,coin:8,power:9,play:10,trophy:11,lock:12,check:13,globe:14,pause:15};
export function Icon({name,size=28,className='',style,...props}){
 const index=atlas[name];
 if(index!==undefined)return <span {...props} aria-hidden="true" className={`game-icon ${name==='mute'?'game-icon-muted':''} ${className}`} style={{display:'inline-block',width:size,height:size,backgroundImage:`url("${assetUrl('ui/toy-icons.png')}")`,backgroundPosition:`${index%4*100/3}% ${Math.floor(index/4)*100/3}%`,...style}}/>;
 return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style} {...props}><path d={ICON_PATHS[name]||ICON_PATHS.power}/></svg>;
}
