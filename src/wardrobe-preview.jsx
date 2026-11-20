import React,{useEffect,useRef,useState} from 'react';
import {getAthlete,makeStudio} from './wardrobe-studio.js';

export function revealTryOn(button){
 const preview=button.closest('.locker-shop')?.querySelector('.locker-skin-preview');
 if(!preview||!window.matchMedia('(max-width:700px)').matches)return;
 const area=preview.getBoundingClientRect();
 if(area.top<0||area.bottom>window.innerHeight)preview.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
export function WardrobePreview({palette,cosmetics,back=false,goalPreview=false}){
 const canvas=useRef(null),studio=useRef(null),drag=useRef(null),angle=useRef(.65),current=useRef({});
 const [error,setError]=useState(false);
 const burstFrame=useRef(0);
 function previewGoal(){cancelAnimationFrame(burstFrame.current);const start=performance.now(),short=window.matchMedia('(prefers-reduced-motion: reduce)').matches;function tick(now){const phase=Math.min(1,(now-start)/(short?350:1000));studio.current?.burstFrame(short&&phase<1?.38:phase);if(phase<1)burstFrame.current=requestAnimationFrame(tick);}burstFrame.current=requestAnimationFrame(tick);}
 useEffect(()=>()=>{cancelAnimationFrame(burstFrame.current);studio.current?.burstFrame(1);},[goalPreview,cosmetics?.goal]);
 current.current={palette,cosmetics};
 function draw(){const s=studio.current;if(s)s.show(current.current.palette,current.current.cosmetics,angle.current);}
 useEffect(()=>{
   let disposed=false,view;
   try{view=makeStudio(canvas.current);}catch{setError(true);return;}
   studio.current=view;
   function resize(){const c=canvas.current;if(!c)return;const ratio=Math.min(1.5,window.devicePixelRatio||1);view.renderer.setSize(Math.max(1,c.clientWidth*ratio),Math.max(1,c.clientHeight*ratio),false);draw();}
   const observer=new ResizeObserver(resize);observer.observe(canvas.current);
   getAthlete().then(source=>{if(!disposed){view.load(source);resize();}}).catch(()=>{if(!disposed)setError(true);});
   return ()=>{disposed=true;observer.disconnect();studio.current=null;view.dispose();};
 },[]);
 useEffect(()=>{angle.current=back?2.65:.65;draw();},[back]);
 useEffect(draw,[palette,JSON.stringify(cosmetics)]);
 return <div className="wardrobe-stage"><canvas ref={canvas} aria-label="3D fitting room. Drag or use arrow keys to rotate." tabIndex={0} onKeyDown={e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();angle.current+=e.key==='ArrowRight'?.3:-.3;draw();}}} onPointerDown={e=>{drag.current=e.clientX;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current===null)return;angle.current-=(e.clientX-drag.current)*.018;drag.current=e.clientX;draw();}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}/>{goalPreview&&!error&&<button className="wardrobe-burst" onClick={previewGoal}>Preview burst</button>}{error&&<span>3D preview unavailable</span>}</div>;
}
