import { useEffect, useState } from 'react';
export function presenceUrl(endpoint){try{const u=new URL(endpoint);if(!['ws:','wss:'].includes(u.protocol)||u.username||u.password)return null;u.protocol=u.protocol==='wss:'?'https:':'http:';u.pathname='/api/presence';u.search='';u.hash='';return u.href;}catch{return null;}}
export function usePresence(active){
 const [presence,setPresence]=useState(null);
 useEffect(()=>{if(!active)return;let disposed=false,timer,controller;
 const poll=async()=>{if(document.hidden){timer=setTimeout(poll,12000);return;}let endpoint=import.meta.env.VITE_SERVER_URL||'ws://127.0.0.1:8787';try{endpoint=localStorage.getItem('neck.server')||endpoint;}catch{}
 const url=presenceUrl(endpoint);controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5000);
 try{if(!url)throw new Error('No server');const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw new Error('Offline');const value=await r.json();if(!value.ok||!['total','queued','playing'].every(k=>Number.isSafeInteger(value[k])&&value[k]>=0))throw new Error('Invalid counts');if(!disposed)setPresence(value);}catch{if(!disposed)setPresence({unavailable:true});}finally{clearTimeout(timeout);if(!disposed)timer=setTimeout(poll,12000);}};poll();return()=>{disposed=true;clearTimeout(timer);controller?.abort();};
 },[active]);return presence;
}
