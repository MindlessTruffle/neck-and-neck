import React,{useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {createWorld} from '../src/art.js';
import {VolleyballGame} from '../src/physics.js';
import {MatchUI} from '../src/match-ui.jsx';
import {perfectSpikeReady} from '../src/spike-timing.js';
import '../src/style.css';import '../src/touch-controls.css';
function Preview(){
 const canvas=useRef(null),touch=new URLSearchParams(location.search).has('touch');
 useEffect(()=>{
  const game=new VolleyballGame({mode:'1v1'});game.start();game.phase='play';game.touchCooldown=0;game.lastHitter=null;game.mapId='beach';
  const p=game.players[0];Object.assign(game.ball,{x:p.head.x+2,y:p.head.y+.55,z:p.head.z,vx:-4,vy:-.4,vz:0});
  const world=createWorld({canvas:canvas.current,reducedMotion:true});world.setMenuScene(false);let frame;
  const resize=()=>world.resize(innerWidth,innerHeight);resize();addEventListener('resize',resize);
  const draw=t=>{world.update(1/60,game,t/1000);world.renderer.render(world.scene,world.camera);frame=requestAnimationFrame(draw);};
  world.ready.then(()=>{if(!perfectSpikeReady(game,p))throw Error('Preview must satisfy real timing helper');draw(0);});
  return()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);world.dispose();};
 },[]);
 return <main className="meadow" data-playing="true" data-touch={touch}><canvas ref={canvas}/><MatchUI touch={touch} state={{score:[0,0],phase:'play',mode:'1v1',round:1,perfectSpikeReady:true,energy:1,touches:[0,0]}} onAction={()=>{}} onWalk={()=>{}} onPause={()=>{}}/></main>;
}
createRoot(document.querySelector('#root')).render(<Preview/>);
