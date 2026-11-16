import assert from 'node:assert/strict';
import { VolleyballGame } from '../src/physics.js';
import { perfectSpikeReady } from '../src/spike-timing.js';
import { snapshotState } from '../src/net-protocol.js';
function setup(team=0){
 const events=[],g=new VolleyballGame({mode:'2v2',onEvent:e=>events.push(e)});g.start();g.phase='play';g.server=team;g.touchCooldown=0;g.lastHitter=null;
 const p=g.players.find(p=>p.team===team);p.human=true;p.aimYaw=team?Math.PI:0;
 Object.assign(p.head,{x:team?4:-4,y:3.5,z:0,vx:0,vy:0,vz:0});
 Object.assign(g.ball,{x:p.head.x+(team?-2:2),y:4.05,z:0,vx:team?4:-4,vy:-.4,vz:0});
 return {g,p,events};
}
for(const team of [0,1]){
 const {g,p,events}=setup(team);assert(perfectSpikeReady(g,p),'Approaching sweet spot gets a short actionable lead-in');
 g._swing(p);for(let i=0;i<24&&!events.some(e=>e.type==='hit');i++)g._ballStep(1/120);
 assert.equal(events.find(e=>e.type==='hit')?.perfectSpike,true,'Clicking during cue produces a perfect spike');
 assert.equal(perfectSpikeReady(g,p),false,'Successful contact clears cue');
}
for(const alter of [s=>s.g.phase='serve',s=>s.g.paused=true,s=>s.p._swingCooldown=.2,s=>s.p._contactCooldown=.1,s=>s.p._dive=.5,s=>s.p._blockTime=.3,s=>s.g.ball.y=2.8,s=>s.g.ball.z=5,s=>s.g.ball.vx=4,s=>s.p.aimYaw=Math.PI,s=>{s.g.touchTeam=0;s.g.lastHitter=s.p.id;s.g.touches=[1,0]},s=>{s.g.touchTeam=0;s.g.touches=[3,0]}]){
 const s=setup();alter(s);assert.equal(perfectSpikeReady(s.g,s.p),false);
}
const online=setup();online.g.touchTeam=0;online.g.lastHitter=online.p.id;online.g.touches=[1,0];
const snap=snapshotState(online.g);assert.equal(perfectSpikeReady(snap,snap.players[0]),false,'Online snapshots preserve legal-touch gating');
console.log('PASS perfect cue: both teams, click-to-perfect contact, legal touches, approach, cooldowns, pause and online parity.');
