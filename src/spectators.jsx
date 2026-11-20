import React from 'react';
import './spectators.css';

export function EyeIcon(){
  return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>;
}

export function LiveCourtList({games,onWatch,onBack}){
  return <div className="live-list"><h2>Live courts</h2>
    {games==null?<p>Finding courts…</p>:!games.length?<p>No matches in play</p>:games.map(game=><button key={game.id} onClick={()=>onWatch(game.id)}>
      <span>{game.map} · {game.mode}</span><strong>{game.score.join(' – ')}</strong>
      <small>{game.teams.map(names=>names.join(' + ')).join(' vs ')}</small>
    </button>)}<button onClick={onBack}>Back to Play</button></div>;
}

export function SpectatorBar({watching,view,onView,onLeave}){
  return <nav className="spectator-bar" aria-label="Spectator controls"><b><EyeIcon/> LIVE</b>
    {['Side','Bird’s eye','First person'].map(mode=><button key={mode} aria-pressed={view.mode===mode} onClick={()=>onView({...view,mode})}>{mode}</button>)}
    {view.mode==='First person'&&<select aria-label="Watch player" value={view.player} onChange={e=>onView({...view,player:Number(e.target.value)})}>{watching.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}
    <button onClick={onLeave}>Leave</button></nav>;
}

export function placeSpectatorCamera(camera,state,view){
  const fit=Math.max(1,1.4/camera.aspect)*(1/Math.tan(camera.fov*Math.PI/360));
  if(view.mode==='First person'){
    const p=state.players.find(player=>player.id===view.player)??state.players[0];
    if(!p)return;
    const yaw=p.aimYaw??p.bodyYaw, dx=Math.cos(yaw),dz=Math.sin(yaw);
    camera.position.set(p.head.x+dx*.77,p.head.y+.12,p.head.z+dz*.77);
    camera.lookAt(camera.position.x+dx,camera.position.y+Math.sin(p.neck.pitch||0)*.45,camera.position.z+dz);
  }else if(view.mode==='Bird’s eye'){
    camera.position.set(0,12*fit,.01);camera.lookAt(0,0,0);
  }else{
    camera.position.set(0,6+3*fit,5+13*fit);camera.lookAt(0,2,0);
  }
}
