import assert from 'node:assert/strict';
import { VolleyballGame, ABILITIES, BALL_RADIUS, BALL_GRAVITY, MAX_BALL_SPEED } from '../src/physics.js';
import { SmoothSimulation } from '../src/motion.js';

const tick=1/120;
function live(mode='1v1'){
  const events=[];const g=new VolleyballGame({mode,onEvent:e=>events.push(e)});g.start();g.phase='play';
  Object.assign(g.ball,{x:10,y:12,z:8,vx:0,vy:0,vz:0});
  return {g,p:g.players[0],events};
}
function hit(g,p=g.players[0],offset=.8){
  g.phase='play';g.touchCooldown=0;p._contactCooldown=0;
  Object.assign(p.head,{x:-4,y:3,z:0,vx:0,vy:0,vz:0});
  Object.assign(g.ball,{x:-4+offset,y:3,z:0,vx:-4,vy:0,vz:0});g._ballStep(.001);
}
function equip(p,id){const definition=ABILITIES.find(a=>a.id===id);p.ability={...definition,charges:1,cooldown:0,active:0,ready:true};}

// The official two-click interaction is a real toss, meter, and aimed timed strike.
const serveEvents=[];const serve=new VolleyballGame({onEvent:e=>serveEvents.push(e)});serve.start();
for(let i=0;i<720;i++)serve.update(tick);
assert.equal(serve.phase,'serve');assert.equal(serve.serveStage,'ready');
serve.update(tick,{swing:true,serve:true});assert.equal(serve.serveStage,'toss');assert(serve.ball.vy>5);
const tossY=serve.ball.y;for(let i=0;i<55;i++)serve.update(tick);
assert(serve.ball.y>tossY+.6);assert(serve.serveCharge>.5&&serve.serveCharge<1);
serve.update(tick,{serve:true,power:.8,aimYaw:.25});
assert.equal(serve.phase,'play');assert(serve.ball.vx>5&&serve.ball.vz>1);assert(serve.serveQuality>.95);
assert.equal(serveEvents.filter(e=>e.type==='toss').length,1);assert.equal(serveEvents.filter(e=>e.type==='serve').length,1);
const fallback=new VolleyballGame();fallback.start();fallback.update(tick,{toss:true});
for(let i=0;i<200&&fallback.phase==='serve';i++)fallback.update(tick);
assert.equal(fallback.phase,'play');assert.deepEqual(fallback.score,[0,0],'missed timing receives a forgiving bump serve');

// Contextual inputs arm genuinely different contact trajectories.
const bump=live();bump.g.update(tick,{swing:true});assert.equal(bump.p._contactAction,'bump');hit(bump.g);assert.equal(bump.events.at(-1).action,'bump');
const spike=live();spike.p.y=1;spike.g.update(tick,{swing:true});assert.equal(spike.p._contactAction,'spike');hit(spike.g);
assert.equal(spike.events.at(-1).action,'spike');assert(spike.g.ball.vx>bump.g.ball.vx);assert(spike.g.ball.vy<bump.g.ball.vy);
const set=live('2v2');set.g.update(tick,{set:true});assert.equal(set.p._contactAction,'set');hit(set.g);
assert.equal(set.events.at(-1).action,'set');assert(set.g.ball.vz>1,'set travels toward teammate on other lane');
const setTime=(set.g.ball.vy+Math.sqrt(set.g.ball.vy**2+2*BALL_GRAVITY*(set.g.ball.y-3.5)))/BALL_GRAVITY;
assert(set.g.ball.x+set.g.ball.vx*setTime<0,'teammate set stays on own side');
const block=live();block.p.y=1;block.g.update(tick,{set:true});assert.equal(block.p._contactAction,'block');hit(block.g);
assert.equal(block.events.at(-1).action,'block');assert.equal(block.g.touches[0],0,'block does not consume a team touch');
const jumpSet=live();jumpSet.g.update(tick,{jumpSet:true});assert(jumpSet.p._jumpV>0);assert.equal(jumpSet.p._contactAction,'set','E forces a high set, not an airborne block');
const dive=live();dive.g.update(tick,{dive:true,z:1});const diveZ=dive.p.z;
for(let i=0;i<20;i++)dive.g.update(tick);assert(dive.p.z>diveZ+.6);assert(dive.p.dive>.5);hit(dive.g);
assert.equal(dive.events.at(-1).action,'dive');assert(dive.g.ball.vy>7,'dive pops low balls upward');
const diveEvents=dive.events.filter(e=>e.type==='dive').length;dive.g.update(tick,{dive:true});assert.equal(dive.events.filter(e=>e.type==='dive').length,diveEvents,'dive cooldown prevents repeated launches');

// Three contacts per possession; blocks exempt, solo repeated touches permitted.
const rules=live('2v2');const [a,b,c]=rules.g.players;
assert(rules.g._registerTouch(a,'set'));rules.g.lastHitter=a.id;
assert(rules.g._registerTouch(b,'set'));rules.g.lastHitter=b.id;
assert(rules.g._registerTouch(a,'bump'));rules.g.lastHitter=a.id;
assert.equal(rules.g._registerTouch(b,'bump'),false);assert.deepEqual(rules.g.score,[0,1]);assert.equal(rules.events.at(-1).reason,'four touches');
const double=live('2v2');double.g._registerTouch(double.p,'set');double.g.lastHitter=double.p.id;
assert.equal(double.g._registerTouch(double.p,'bump'),false);assert.equal(double.events.at(-1).reason,'double touch');
const lingering=live('2v2');hit(lingering.g);hit(lingering.g);
assert.equal(lingering.g.hits,1);assert.deepEqual(lingering.g.score,[0,0],'passive lingering overlap is not a double-touch fault');
lingering.p._swingCooldown=0;lingering.g._swing(lingering.p,'bump');hit(lingering.g);
assert.deepEqual(lingering.g.score,[0,1],'a fresh deliberate second action still faults in 2v2');
const solo=live();solo.g._registerTouch(solo.p,'set');solo.g.lastHitter=solo.p.id;assert(solo.g._registerTouch(solo.p,'spike'));assert.equal(solo.g.touches[0],2);
const blockFollow=live('2v2');blockFollow.g._registerTouch(blockFollow.p,'block');blockFollow.g.lastHitter=blockFollow.p.id;
assert(blockFollow.g._registerTouch(blockFollow.p,'set'));assert.equal(blockFollow.g.touches[0],1);
blockFollow.g._registerTouch(blockFollow.g.players[2],'bump');assert.deepEqual(blockFollow.g.touches,[0,1]);

// Each ability has a distinct physical effect and a single, non-repeatable charge.
for(const id of ABILITIES.map(a=>a.id)){
  const s=live();equip(s.p,id);s.g.update(tick,{ability:true,x:1});
  assert.equal(s.p.ability.charges,0);assert(s.p.ability.active>0);assert(s.p.ability.cooldown>0);assert.equal(s.p.ability.ready,false);
  const count=s.events.filter(e=>e.type==='ability').length;s.g.update(tick,{ability:true});assert.equal(s.events.filter(e=>e.type==='ability').length,count);
  if(id==='spring')assert(s.p._jumpV>9,'Spring Step creates a stronger jump');
  if(id==='rocket')assert(s.p._dive>0&&s.p._dash>0,'Rocket Hooves starts a fast extended dive');
  if(id==='shield'){assert(s.p._blockTime>2);hit(s.g);assert.equal(s.events.at(-1).action,'block');}
  if(id==='magnet'){hit(s.g,s.p,1.9);assert.equal(s.g.hits,1);assert.equal(s.events.at(-1).ability,'magnet');assert.equal(s.p.ability.active,0);}
  if(id==='feather'){hit(s.g);assert(s.g.ball.vy>=7.9);assert.equal(s.p.ability.active,0);}
  assert(Math.hypot(s.g.ball.vx,s.g.ball.vy,s.g.ball.vz)<=MAX_BALL_SPEED+1e-8);
}
const narrow=live();hit(narrow.g,narrow.p,1.9);assert.equal(narrow.g.hits,0,'Magnet Head adds meaningful rescue reach');
const round=live('2v2');const oldIds=round.g.players.map(p=>p.ability.id);round.g._point(0,'test');
for(let i=0;i<240;i++)round.g.update(tick);
assert.equal(round.g.round,2);assert.equal(round.g.serveStage,'ready');
round.g.players.forEach((p,i)=>{assert.equal(p.ability.id,oldIds[i],'equipped powers stay fixed each match');assert.equal(p.ability.charges,1);assert.equal(p.ability.active,0);});
assert.equal(round.g.players[0].role,'striker');assert.equal(round.g.players[1].role,'receiver');

// High-refresh frame buffering also covers every new action and public UI state.
for(const input of ['set','jumpSet','dive','ability']){
  const s=live();equip(s.p,'magnet');const motion=new SmoothSimulation(s.g);
  motion.advance(1/480,{[input]:true});for(let i=0;i<3;i++)motion.advance(1/480);
  assert(s.events.some(e=>input==='ability'?e.type==='ability':input==='dive'?e.type==='dive':e.type==='action'));
  assert.equal(motion.renderState.round,1);assert.equal(motion.renderState.players[0].ability.id,'magnet');assert.deepEqual(motion.renderState.touches,[0,0]);
}
assert.equal(BALL_RADIUS,.41);assert.equal(BALL_GRAVITY,10.8);
console.log('PASS mechanics: timed/toss/fallback serves, bump/set/spike/block/dive, solo/team touch rules, equipped power refill, role rotation, buffered controls and UI state');

// Footwork is entirely manual, including compatibility with old autoMove inputs.
const stationary=live();Object.assign(stationary.g.ball,{x:-3,y:9,z:3,vx:0,vy:0,vz:0});
const startPosition=[stationary.p.x,stationary.p.z];for(let i=0;i<30;i++)stationary.g.update(tick,{autoMove:true});
assert.deepEqual([stationary.p.x,stationary.p.z],startPosition);assert.equal(stationary.p._jumpV,0);
stationary.g.update(.05,{z:-1});assert(stationary.p.z<startPosition[1]);
const standingClick=live();Object.assign(standingClick.g.ball,{x:standingClick.p.head.x+.5,y:standingClick.p.head.y+1.1,z:standingClick.p.head.z,vx:0,vy:-.5,vz:0});
standingClick.g.update(tick,{swing:true});assert.equal(standingClick.p._jumpV,0,'click no longer moves feet or jumps');

// New movement is expressive, without changing the gentle ball speed limit.
const longDive=live();longDive.p.x=-8;longDive.g._initNeck(longDive.p);const diveStart=longDive.p.x;
longDive.g.update(tick,{dive:true,x:1});for(let i=0;i<86;i++)longDive.g.update(tick);
assert(longDive.p.x-diveStart>5.5&&longDive.p.x-diveStart<=7.3,'longer flop dive covers most of a half court without crossing the net');
const bouncySet=live();bouncySet.g.update(tick,{set:true});for(let i=0;i<20;i++)bouncySet.g.update(tick);
assert(bouncySet.p.setBounce>.5,'set has a visible squash/rebound envelope');
const longNeck=live();longNeck.g.phase='serve';for(let i=0;i<180;i++)longNeck.g.update(tick,{extension:1,neckYaw:0});
assert(longNeck.p.head.y>4.3,'extended physical neck reaches much farther');
let whipPeak=0;longNeck.g.phase='play';Object.assign(longNeck.g.ball,{x:11,y:15,z:8,vx:0,vy:0,vz:0});
for(let i=0;i<55;i++){longNeck.g.update(tick,{extension:1,neckYaw:Math.PI/2,swing:i===0});whipPeak=Math.max(whipPeak,Math.abs(longNeck.p.head.vz));}
assert(whipPeak>3);assert(longNeck.p.neckPoints.every(p=>[p.x,p.y,p.z,p.vx,p.vy,p.vz].every(Number.isFinite)));
const guided=live();Object.assign(guided.g.ball,{x:-3,y:3,z:3.5,vx:10,vy:5,vz:9});
guided.g._guideReturn(guided.p,'bump',true);const flight=(guided.g.ball.vy+Math.sqrt(guided.g.ball.vy**2+2*BALL_GRAVITY*(guided.g.ball.y-BALL_RADIUS)))/BALL_GRAVITY;
assert(guided.g.ball.z+guided.g.ball.vz*flight<6,'court assistance steers wide balls substantially inward');

// Equipped powers persist and refill; network humans receive isolated, one-shot inputs.
const equipped=new VolleyballGame({equippedAbility:'feather'});equipped.start();assert.equal(equipped.players[0].ability.id,'feather');
equipped.setPlayerLoadout(0,{ability:'shield',skin:{body:'#123456'}});equipped._newRound();assert.equal(equipped.players[0].ability.id,'shield');assert.equal(equipped.players[0].skin.body,'#123456');
const network=live('2v2');network.g.players.forEach(p=>{p.human=true;});network.g.setPlayerLoadout(2,{ability:'spring'});network.g._newRound();network.g.phase='play';
network.g.setNetworkInputs({0:{z:1},1:{z:-1},2:{jump:true,neckYaw:2},3:{set:true}});network.g.update(.05);
assert(network.g.players[0].vz>0&&network.g.players[1].vz<0);assert(network.g.players[2]._jumpV>0);assert.equal(network.g.players[2].neck.yaw,2);assert.equal(network.g.players[3]._contactAction,'set');
assert.equal(network.g.networkInputs[2].jump,false,'network edges consumed after one update');
const remoteServe=new VolleyballGame({mode:'2v2'});remoteServe.start();remoteServe.players.forEach(p=>p.human=true);remoteServe.server=1;remoteServe._hold();
remoteServe.update(.05,{2:{serve:true,aimYaw:Math.PI}});assert.equal(remoteServe.serveStage,'toss');
remoteServe.update(.05,{2:{serve:true,aimYaw:Math.PI,power:.7}});assert.equal(remoteServe.phase,'play');assert(remoteServe.ball.vx<0);

// Every point blasts bodies; a final point continues bounded physics under the result screen.
const blast=live('2v2');const beforeBlast=blast.g.players.map(p=>({x:p.x,z:p.z}));blast.g._point(0,'test');
assert(blast.events.some(e=>e.type==='score'&&e.explosion));blast.g.update(.05);
blast.g.players.forEach((p,i)=>assert(Math.hypot(p.x-beforeBlast[i].x,p.z-beforeBlast[i].z)>.1&&p.y>0));
const final=live();final.g.score=[6,0];final.g._point(0,'test');const finalMotion=new SmoothSimulation(final.g);const finalX=final.p.x;
for(let i=0;i<30;i++)finalMotion.advance(tick);assert.notEqual(final.p.x,finalX);assert.equal(final.g.phase,'finished');
for(let i=0;i<400;i++)finalMotion.advance(tick);assert.equal(final.g.celebrationRemaining,0);assert(final.p.neckPoints.every(p=>[p.x,p.y,p.z].every(Number.isFinite)));assert(Math.abs(final.p.x)<=23);
console.log('PASS overhaul: manual-only feet, long flop dives, set bounce, extreme bounded neck, court guidance, persistent loadouts, isolated network inputs and final-point knockback');

const waiting = new VolleyballGame({mode:'1v1'});waiting.start();const waitPlayer=waiting.players[0],waitX=waitPlayer.x;waiting.update(tick,{dive:true,x:1});for(let i=0;i<25;i++)waiting.update(tick);assert(waitPlayer.x>waitX+1,'Dive works before the serve toss');assert.equal(waiting.phase,'serve');
// Isolate a middle-neck contact far below the head.
const neckHit=live();neckHit.g.lastHitter=null;neckHit.g.touchCooldown=0;Object.assign(neckHit.p.head,{x:-4,y:5,z:0,vx:0,vy:0,vz:0});neckHit.p.neckPoints.forEach((q,i)=>Object.assign(q,{x:-4,y:1+i*.5,z:0,vx:0,vy:0,vz:0}));Object.assign(neckHit.g.ball,{x:-3.3,y:2.1,z:0,vx:-5,vy:0,vz:0});neckHit.g._ballStep(.001);assert.equal(neckHit.g.hits,1,'Middle of neck returns the ball');assert(Math.hypot(neckHit.g.ball.vx,neckHit.g.ball.vy,neckHit.g.ball.vz)<=MAX_BALL_SPEED);console.log('PASS expanded controls: pre-serve diving, longer bounded dives and neck-segment returns.');
