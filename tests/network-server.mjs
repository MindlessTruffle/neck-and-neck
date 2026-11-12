import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/game-server.mjs';
import { normalizeControls, normalizeLoadout } from '../src/net-protocol.js';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class Peer {
  constructor(ws){this.ws=ws;this.messages=[];this.waiters=[];ws.on('message',data=>{const message=JSON.parse(data);this.messages.push(message);if(this.messages.length>800)this.messages.shift();for(const wake of [...this.waiters])wake();});}
  send(type,data={}){this.ws.send(JSON.stringify({type,...data}));}
  async next(type,predicate=()=>true,timeout=3500){
    const find=()=>this.messages.findIndex(m=>m.type===type&&predicate(m));let index=find();if(index>=0)return this.messages.splice(index,1)[0];
    return new Promise((resolve,reject)=>{const clean=()=>{clearTimeout(timer);this.waiters=this.waiters.filter(w=>w!==check);};const check=()=>{const i=find();if(i>=0){const m=this.messages.splice(i,1)[0];clean();resolve(m);}};const timer=setTimeout(()=>{clean();reject(new Error(`Timed out waiting for ${type}: ${this.messages.map(m=>m.type).join(',')}`));},timeout);this.waiters.push(check);});
  }
  close(){this.ws.terminate();}
}
async function connect(url,{name='Player',token,loadout,origin='http://127.0.0.1:5173',headers,autoPong=true}={}){
  const ws=new WebSocket(url,{origin,headers,autoPong});await once(ws,'open');const peer=new Peer(ws);peer.send('hello',{version:1,name,loadout,sessionToken:token});peer.welcome=await peer.next('welcome');return peer;
}
async function privateMatch(peers,mode){
  peers[0].send('room.create',{mode});const {room}=await peers[0].next('room',m=>m.room?.mode===mode);
  for(let i=1;i<peers.length;i++){peers[i].send('room.join',{code:room.code});await peers[i].next('room',m=>m.room?.members.length===i+1);}
  peers[0].send('room.start');return Promise.all(peers.map(p=>p.next('match')));
}
function allFinite(value){if(typeof value==='number')assert.ok(Number.isFinite(value));else if(value&&typeof value==='object')for(const part of Object.values(value))allFinite(part);}
assert.equal(normalizeControls({x:NaN}),null);assert.equal(normalizeControls({dive:1}),null);
assert.deepEqual(normalizeLoadout({ability:'invented',skin:{body:'url(secret)'}}),{ability:'magnet',skin:null});
assert.ok(Math.hypot(...['x','z'].map(k=>normalizeControls({x:99,z:99})[k]))<=1.00001);
assert.throws(()=>createGameServer({production:true}),/allowlist/);
const app=createGameServer({port:0,maxRooms:4,maxConnectionsPerIP:20,reconnectGraceMs:180,sessionTtlMs:10000,heartbeatMs:200,helloTimeoutMs:1000});
const peers=[];let address;
try {
  address=await app.start();
  const health=await fetch(`http://127.0.0.1:${address.port}/health`).then(r=>r.json());assert.equal(health.ok,true);assert.equal('sessions' in health,false);
  const bad=new WebSocket(address.url,{origin:'https://untrusted.example'});await assert.rejects(once(bad,'open'),/403/);
  const a=await connect(address.url,{name:'Alfa'}),b=await connect(address.url,{name:'Bravo'});peers.push(a,b);
  a.send('room.create',{mode:'1v1'});const room=(await a.next('room',m=>m.room?.mode==='1v1')).room;assert.match(room.code,/^[A-F0-9]{10}$/);
  a.send('room.start');assert.equal((await a.next('error')).code,'PLAYERS_REQUIRED');
  b.send('room.join',{code:room.code});await b.next('room',m=>m.room?.members.length===2);
  b.send('room.start');assert.equal((await b.next('error')).code,'HOST_REQUIRED');
  a.send('room.start');const [ma,mb]=await Promise.all([a.next('match'),b.next('match')]);assert.equal(ma.playerId,0);assert.equal(mb.playerId,1);assert.equal(mb.team,1);
  const initial=await a.next('snapshot');assert.equal(initial.state.players.length,2);assert.ok(initial.state.players.every(p=>p.human));allFinite(initial.state);
  a.send('input',{seq:1,controls:{x:99,z:0,neckYaw:1e99,neckPitch:99,extension:9},score:[999,0],position:{x:1000}});
  const moved=await a.next('snapshot',m=>m.ack===1&&m.state.players[0].x>initial.state.players[0].x+.15);assert.equal(moved.state.score[0],0);assert.ok(moved.state.players[0].x<0);assert.ok(moved.state.players[0].neck.pitch<=1.35);allFinite(moved.state);
  a.send('input',{seq:2,controls:{serve:true,aimYaw:0,neckYaw:0,x:0}});const toss=await a.next('snapshot',m=>m.ack===2);assert.equal(toss.state.serveStage,'toss');assert.equal(toss.state.phase,'serve');
  a.send('input',{seq:2,controls:{serve:true}});await sleep(80);const duplicate=await a.next('snapshot',m=>m.seq>toss.seq);assert.equal(duplicate.state.phase,'serve','duplicate sequence cannot strike serve');
  a.send('input',{seq:3,controls:{serve:true}});const play=await a.next('snapshot',m=>m.ack===3);assert.equal(play.state.phase,'play');
  a.send('input',{seq:4,controls:{jump:true}});const jump=await a.next('snapshot',m=>m.ack===4);assert.ok(jump.state.players[0]._jumpV>0);const jumpEvents=await a.next('events',m=>m.events.some(e=>e.type==='jump'));assert.equal(jumpEvents.events.filter(e=>e.type==='jump').length,1);
  a.send('input',{seq:5,controls:{neckYaw:'infinite'}});assert.equal((await a.next('error')).code,'INPUT');
  a.ws.send('{');assert.equal((await a.next('error')).code,'FORMAT');a.send('invented');assert.equal((await a.next('error')).code,'COMMAND');
  a.send('ping',{id:42,clientTime:123});const pong=await a.next('pong');assert.equal(pong.id,42);assert.equal(pong.clientTime,123);
  const oldToken=b.welcome.sessionToken;b.close();await sleep(35);
  const resumed=await connect(address.url,{token:oldToken});peers.push(resumed);assert.equal(resumed.welcome.id,b.welcome.id);assert.equal(resumed.welcome.resumed,true);assert.equal(resumed.welcome.matchId,ma.matchId);assert.equal((await resumed.next('match')).playerId,1);await resumed.next('snapshot');
  resumed.close();const finishEvents=await a.next('events',m=>m.events.some(e=>e.type==='win'));assert.equal(finishEvents.events.find(e=>e.type==='win').team,0);
  const blast=await a.next('snapshot',m=>m.state.phase==='finished');assert.ok(blast.state.celebrationRemaining>0);const laterBlast=await a.next('snapshot',m=>m.seq>blast.seq&&m.state.phase==='finished');assert.notEqual(laterBlast.state.players[0].x,blast.state.players[0].x,'celebration keeps moving');
  const ended=await a.next('match.end',()=>true,4000);assert.equal(ended.reason,'disconnect');assert.equal(ended.winner,0);await a.next('room',m=>m.room?.status==='lobby');a.send('room.leave');await a.next('room',m=>m.room===null);
  const afterGrace=await connect(address.url,{token:oldToken});peers.push(afterGrace);assert.equal(afterGrace.welcome.resumed,true);assert.equal(afterGrace.welcome.matchId,null,'expired match must be explicitly absent on resume');await afterGrace.next('room',m=>m.room===null);afterGrace.close();
  console.log('PASS server: authoritative 1v1, finite/clamped inputs, ignored score writes, sequenced two-click serve/jump, origin/schema checks, rejoin and animated forfeit cleanup.');

  const group=[];for(let i=0;i<4;i++){group.push(await connect(address.url,{name:`Doubles ${i}`}));peers.push(group[i]);}
  group[0].send('profile.update',{name:'Captain',loadout:{ability:'spring',skin:{body:'#abcdef',spots:'#112233',muzzle:'#ffeedd',scarf:'#88aabb',accent:'#102030'}}});
  const matches=await privateMatch(group,'2v2');assert.deepEqual(matches.map(m=>m.playerId),[0,1,2,3]);
  const doubles=await group[0].next('snapshot');assert.equal(doubles.state.players.length,4);assert.ok(doubles.state.players.every(p=>p.human));assert.equal(doubles.state.players[0].ability.id,'spring');assert.equal(doubles.state.players[0].skin.body,'#abcdef');assert.equal(doubles.state.players[0].name,'Captain');
  group[3].send('input',{seq:1,controls:{x:-1,jump:true}});const remote=await group[3].next('snapshot',m=>m.ack===1);assert.ok(remote.state.players[3]._jumpV>0);assert.equal(remote.state.players[0]._jumpV,0);
  group[0].send('room.leave');await group[1].next('match.end',()=>true,4000);for(const p of group){p.send('room.leave');await p.next('room',m=>m.room===null);}
  console.log('PASS server: four real human slots, loadout/profile transfer, isolated remote actions and host leave forfeit.');

  group[0].send('room.create',{mode:'2v2'});const party=(await group[0].next('room',m=>m.room?.members.length===1)).room;
  group[1].send('room.join',{code:party.code});await group[1].next('room',m=>m.room?.members.length===2);
  group[0].send('queue.join',{mode:'2v2'});await group[1].next('queue',m=>m.status==='waiting');group[1].send('queue.cancel');await group[0].next('queue',m=>m.status==='cancelled');assert.equal(app.metrics().queued,0);
  group[0].send('queue.join',{mode:'2v2'});await group[0].next('queue',m=>m.status==='waiting');group[2].send('queue.join',{mode:'2v2'});group[3].send('queue.join',{mode:'2v2'});
  const queuedMatches=await Promise.all(group.map(p=>p.next('match')));assert.equal(new Set(queuedMatches.map(m=>m.matchId)).size,1);assert.equal(queuedMatches[0].team,queuedMatches[1].team);assert.notEqual(queuedMatches[0].team,queuedMatches[2].team);assert.equal(app.metrics().queued,0);
  group[0].send('room.leave');await group[1].next('match.end',()=>true,4000);for(const p of group){p.send('room.leave');await p.next('room',m=>m.room===null);}
  group[0].send('queue.join',{mode:'1v1'});await group[0].next('queue',m=>m.status==='waiting');group[0].send('queue.cancel');await group[0].next('queue',m=>m.status==='cancelled');assert.equal(app.metrics().queued,0);
  group[0].send('queue.join',{mode:'1v1'});group[1].send('queue.join',{mode:'1v1'});await Promise.all([group[0].next('match'),group[1].next('match')]);assert.equal(app.metrics().matches,1);
  console.log('PASS server: private party queue/cancel, two-player party stays together in real 2v2, solo 1v1 queue and no bot fill.');
  const overflow=await connect(address.url);peers.push(overflow);const closed=once(overflow.ws,'close');overflow.ws.send('x'.repeat(5000));assert.equal((await closed)[0],1009);
  const spam=await connect(address.url);peers.push(spam);const spamClosed=once(spam.ws,'close');for(let i=0;i<85;i++)spam.send('ping',{id:i});assert.equal((await spamClosed)[0],1008);
  assert.ok(app.metrics().physicsSteps>0);assert.ok(app.metrics().snapshots>0);
  console.log('PASS server: payload/rate limits, health privacy, fixed-clock snapshots and cleanup.');
} finally {for(const peer of peers)peer.close();await app.close();}

const prod=createGameServer({port:0,production:true,allowedOrigins:['https://example.test']});
try{const location=await prod.start();const client=await connect(location.url,{origin:'https://example.test'});assert.ok(client.welcome.sessionToken);client.close();}finally{await prod.close();}
console.log('PASS production: explicit browser origin allowlist accepted; missing configuration rejected.');

const limited=createGameServer({port:0,maxRooms:1,maxConnections:2,maxConnectionsPerIP:2,heartbeatMs:50,helloTimeoutMs:100,roomIdleMs:500});
const limitedPeers=[];
try{
  const where=await limited.start();const one=await connect(where.url),two=await connect(where.url);limitedPeers.push(one,two);
  const excess=new WebSocket(where.url,{origin:'http://localhost:5173'});await assert.rejects(once(excess,'open'),/403/);
  one.send('room.create',{mode:'2v2'});const {room}=await one.next('room',m=>m.room?.code);two.send('room.create',{mode:'1v1'});assert.equal((await two.next('error')).code,'CAPACITY');
  two.send('room.join',{code:room.code});await two.next('room',m=>m.room?.members.length===2);one.send('queue.join',{mode:'2v2'});await one.next('queue',m=>m.status==='waiting');two.close();await one.next('queue',m=>m.status==='cancelled');assert.equal(limited.metrics().queued,0);
  await sleep(30);const noHello=new WebSocket(where.url,{origin:'http://localhost:5173'});await once(noHello,'open');assert.equal((await once(noHello,'close'))[0],1008);
  await sleep(30);const noPong=await connect(where.url,{autoPong:false});limitedPeers.push(noPong);assert.equal((await once(noPong.ws,'close'))[0],1006);
  console.log('PASS limits: room/global/per-IP capacity, disconnected party dequeue, missing hello deadline and dead-peer heartbeat.');
}finally{for(const p of limitedPeers)p.close();await limited.close();}

const proxied=createGameServer({port:0,production:true,allowedOrigins:['https://example.test'],trustProxy:true,maxConnectionsPerIP:1});
const proxyPeers=[];
try{
  const where=await proxied.start();
  for(const address of ['198.51.100.1','198.51.100.2'])proxyPeers.push(await connect(where.url,{origin:'https://example.test',headers:{'x-forwarded-for':address}}));
  const spoof=new WebSocket(where.url,{origin:'https://example.test',headers:{'x-forwarded-for':'203.0.113.99, 198.51.100.1'}});await assert.rejects(once(spoof,'open'),/403/);
  assert.equal(proxied.metrics().connections,2);console.log('PASS proxy: explicit trusted private proxy preserves per-user limits and ignores spoofed XFF prefixes.');
}finally{for(const p of proxyPeers)p.close();await proxied.close();}
