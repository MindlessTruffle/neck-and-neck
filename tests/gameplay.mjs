import assert from 'node:assert/strict';
import { VolleyballGame } from '../src/physics.js';
const near = (a,b,t=.03) => assert.ok(Math.abs(a-b)<t, `${a} differs from ${b}`);
function impact(headV=0, zOffset=0) {
 const g=new VolleyballGame({mode:'1v1'});g.start();g.phase='play';g.touchCooldown=0;g.lastHitter=null;
 const p=g.players[0];Object.assign(p.head,{x:-4,y:3,z:0,vx:headV,vy:0,vz:0});
 Object.assign(g.ball,{x:-3.2,y:3,z:zOffset,vx:-5,vy:0,vz:0});g._ballStep(1/1000);return g.ball;
}
const still=impact(), moving=impact(4), angled=impact(0,.35);
assert(still.vx>0, 'incoming ball must bounce outward');assert(moving.vx>still.vx+3, 'moving head adds momentum');assert(Math.abs(angled.vz)>.5, 'off-center contact changes direction');
const g=new VolleyballGame({mode:'1v1'});g.start();g.phase='play';Object.assign(g.ball,{x:8,y:15,z:0,vx:0,vy:0,vz:0});
for(let i=0;i<60;i++)g.update(1/120,{lookYaw:Math.PI/2,lookPitch:.4,extension:1});
const p=g.players[0];assert(p.head.z>p.z+.45,'neck yaw moves head sideways');assert(p.head.y>3,'extension raises head');assert.equal(p.neck.extension,1);
let ev=[];const control=new VolleyballGame({onEvent:e=>ev.push(e)});control.togglePause();control.start();assert.equal(control.paused,false);control.update(1/60,{serve:true});assert.equal(control.phase,'play');
control.update(1/60,{jump:true,dash:true,swing:true});assert(ev.some(e=>e.type==='jump'));assert(ev.some(e=>e.type==='dash'));assert(ev.some(e=>e.type==='smash'));assert(control.players[0].swing>0);
control.togglePause();control.reset();assert.equal(control.paused,false);
const net=new VolleyballGame({mode:'1v1',onEvent:e=>ev.push(e)});net.start();net.phase='play';Object.assign(net.ball,{x:-.1,y:2.5,z:0,vx:8,vy:0,vz:0});net.update(.02);assert(net.ball.vx<0);assert(ev.some(e=>e.type==='net'));
function step(rate){const s=new VolleyballGame({mode:'1v1'});s.start();s.phase='play';Object.assign(s.ball,{x:-6,y:7,z:0,vx:2,vy:4,vz:0});for(let i=0;i<rate*.3;i++)s.update(1/rate,{lookYaw:.3,extension:.8});return s;}
const a=step(30),b=step(120);near(a.ball.x,b.ball.x,.02);near(a.ball.y,b.ball.y,.03);near(a.players[0].head.x,b.players[0].head.x,.02);
console.log('PASS: impact direction and head momentum, neck reach, controls, net collision, pause reset and substep stability');

// Human serves wait indefinitely; bot serves still begin on their timer.
const waiting=new VolleyballGame({mode:'1v1'});assert.equal(waiting.players[0].neck.pitch,-.12);waiting.start();
for(let i=0;i<600;i++)waiting.update(1/60);assert.equal(waiting.phase,'serve');
waiting.update(1/60,{serve:true});assert.equal(waiting.phase,'play');
const botServe=new VolleyballGame({mode:'1v1'});botServe.start();botServe.players[0].human=false;
for(let i=0;i<70;i++)botServe.update(1/60);assert.equal(botServe.phase,'play');
// Ground movement builds speed and coasts to a stop; airborne steering is weaker.
const motion=new VolleyballGame({mode:'1v1'});motion.start();const m=motion.players[0];m.x=-8;
motion.update(.05,{x:1});assert(m.vx>0&&m.vx<5.5);const first=m.vx;
for(let i=0;i<10;i++)motion.update(.05,{x:1});assert(m.vx>first&&m.vx<5.51);
motion.update(.05,{});assert(m.vx>0&&m.vx<5.5);for(let i=0;i<30;i++)motion.update(.05,{});assert(Math.abs(m.vx)<.01);
m.x=-.7;m.vx=4;motion.update(.05,{x:1});assert.equal(m.x,-.7);assert.equal(m.vx,0);
const ground=new VolleyballGame({mode:'1v1'}), air=new VolleyballGame({mode:'1v1'});ground.start();air.start();air.players[0].y=1;air.players[0]._jumpV=0;
ground.update(.05,{z:1});air.update(.05,{z:1});assert(air.players[0].vz<ground.players[0].vz);
console.log('PASS: human serve waits, bot serves, ground acceleration/friction, air control, boundary velocity');

// Neck control is separate from camera, physically overshoots, and remains bounded.
const neckGame=new VolleyballGame({mode:'1v1'});neckGame.start();const neckPlayer=neckGame.players[0];
for(let i=0;i<120;i++)neckGame.update(1/120,{neckYaw:0,neckPitch:0,extension:.3,cameraYaw:2});
let samples=[];for(let i=0;i<360;i++){neckGame.update(1/120,{neckYaw:Math.PI/2,neckPitch:0,extension:.3,cameraYaw:-1});samples.push(neckPlayer.head.z-neckPlayer.z);}
assert.equal(neckPlayer.neckPoints.length,9);assert.equal(neckPlayer.neck.yaw,Math.PI/2);
assert(Math.max(...samples)>samples.at(-1)+.1,'head overshoots and settles');
for(let i=1;i<9;i++){const a=neckPlayer.neckPoints[i-1],b=neckPlayer.neckPoints[i];assert([b.x,b.y,b.z,b.vx,b.vy,b.vz].every(Number.isFinite));assert(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.31,'neck segment length remains bounded');}
near(neckPlayer.head.x,neckPlayer.neckPoints[8].x,.00001);near(neckPlayer.head.y,neckPlayer.neckPoints[8].y,.00001);
const whip=new VolleyballGame({mode:'1v1'});whip.start();for(let i=0;i<120;i++)whip.update(1/120,{neckYaw:0,extension:.3});let maxWhip=0;
for(let i=0;i<60;i++){whip.update(1/120,{neckYaw:0,extension:.3,swing:i===0});maxWhip=Math.max(maxWhip,whip.players[0].head.vx);}assert(maxWhip>2,'swing physically moves the head');
let impactEvent;const impactGame=new VolleyballGame({mode:'1v1',onEvent:e=>{if(e.type==='hit')impactEvent=e}});impactGame.start();impactGame.phase='play';impactGame.lastHitter=null;impactGame.touchCooldown=0;
const impactPlayer=impactGame.players[0];Object.assign(impactPlayer.head,{x:-4,y:3,z:0,vx:4,vy:0,vz:0});Object.assign(impactGame.ball,{x:-3.2,y:3,z:0,vx:-5,vy:0,vz:0});impactGame._ballStep(.001);
assert(impactEvent.incomingSpeed>0&&impactEvent.impact>0);assert(impactEvent.normal.x>0&&impactEvent.velocity.x>0);assert(impactPlayer.neckPoints[8].vx<0,'impact recoils the chain');
console.log('PASS: independent neck control, chain length, overshoot, whip velocity and impact recoil');

// Ability presses shortly before landing/recovery are retained, then consumed once.
const abilities=[];
const buffered=new VolleyballGame({mode:'1v1',onEvent:e=>abilities.push(e)});buffered.start();
const bp=buffered.players[0];bp.y=.05;bp._jumpV=-2;
buffered.update(1/120,{jump:true});
for(let i=0;i<15;i++)buffered.update(1/120);
assert.equal(abilities.filter(e=>e.type==='jump').length,1,'pre-landing jump fires once');
assert(bp.y>.2&&bp._jumpV>0,'buffered jump takes off after landing');
bp._swingCooldown=.06;buffered.update(1/120,{swing:true});
for(let i=0;i<15;i++)buffered.update(1/120);
assert.equal(abilities.filter(e=>e.type==='smash').length,1,'recovery-buffered swing fires once');
const expired=new VolleyballGame({mode:'1v1'});expired.start();expired.players[0].y=2;
expired.update(1/120,{jump:true});for(let i=0;i<120;i++)expired.update(1/120);
assert.equal(expired.players[0].y,0,'early airborne jump expires instead of auto-bouncing');
const dashGame=new VolleyballGame({mode:'1v1'});dashGame.start();const dp=dashGame.players[0];
const dashStart=dp.z;dashGame.update(1/120,{neckYaw:Math.PI/2,dash:true});
let peakDash=0;for(let i=0;i<35;i++){dashGame.update(1/120,{neckYaw:-Math.PI/2});peakDash=Math.max(peakDash,dp.vz);}
assert(dp.z>dashStart+.8,'idle dash travels along initial neck aim');
assert(dp.vz>0&&peakDash>5.5,'dash direction remains committed when aim turns');
near(dp.energy,1-.28+.13*36/120,.003);
console.log('PASS: landing/recovery buffers, expired inputs, directional eased dash and single energy charge');

// Both endpoints miss the head: the continuous sweep must still find the hit.
const fast=new VolleyballGame({mode:'1v1'});fast.start();fast.phase='play';fast.lastHitter=null;fast.touchCooldown=0;
Object.assign(fast.players[0].head,{x:-4,y:3,z:0,vx:0,vy:0,vz:0});
Object.assign(fast.ball,{x:-5.2,y:3,z:0,vx:300,vy:0,vz:0});fast._ballStep(.01);
assert.equal(fast.hits,1,'fast ball cannot tunnel through head');assert(fast.ball.vx<0);
const falling=new VolleyballGame({mode:'1v1'});falling.start();falling.phase='play';falling.lastHitter=null;falling.touchCooldown=0;
Object.assign(falling.players[0].head,{x:-4,y:3,z:0,vx:0,vy:0,vz:0});
Object.assign(falling.ball,{x:-4,y:5,z:0,vx:0,vy:-600,vz:0});falling._ballStep(.01);
assert.equal(falling.hits,1,'head collision before floor prevents false score');assert.equal(falling.phase,'play');
const netSurface=new VolleyballGame({mode:'1v1'});netSurface.start();netSurface.phase='play';
Object.assign(netSurface.ball,{x:-.3,y:2,z:0,vx:12,vy:0,vz:0});netSurface._ballStep(.01);
assert(netSurface.ball.vx<0,'net collides at ball radius before center crosses');
const aboveNet=new VolleyballGame({mode:'1v1'});aboveNet.start();aboveNet.phase='play';
Object.assign(aboveNet.ball,{x:-1,y:4,z:0,vx:400,vy:-400,vz:0});aboveNet._ballStep(.005);
assert(aboveNet.ball.vx>0,'a ball crossing above tape is not rejected from endpoint height');
console.log('PASS: swept head collision, net surface contact and crossing-height accuracy');
const ending=new VolleyballGame({mode:'1v1'});ending.start();ending.phase='play';ending.score=[6,0];
Object.assign(ending.ball,{x:4,y:.231,z:0,vx:0,vy:-5,vz:0});
let playerSteps=0;const normalStep=ending._stepPlayers.bind(ending);ending._stepPlayers=(...args)=>{playerSteps++;normalStep(...args);};
ending.update(.05,{x:1});assert.equal(ending.phase,'finished');assert.equal(playerSteps,1,'winning point stops remaining physics substeps');
console.log('PASS: finished match stops physics immediately');
