import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';



const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class Peer {
  constructor(ws){this.ws=ws;this.messages=[];this.waiters=[];ws.on('message',data=>{const message=JSON.parse(data);if(message.type==="error")console.log(message);this.messages.push(message);if(this.messages.length>800)this.messages.shift();for(const wake of [...this.waiters])wake();});}
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
function checkState(state){assert.ok(state.players.every(p=>p.cosmetics?.hat==='cap'),'cosmetics reach every online player');assert.ok(['meadow','jungle','beach','volcano','mountain'].includes(state.mapId),'server sends a release map');allFinite(state);}
function allFinite(value){if(typeof value==='number')assert.ok(Number.isFinite(value));else if(value&&typeof value==='object')for(const part of Object.values(value))allFinite(part);}
if(!process.env.SMOKE_SERVER_URL)throw new Error('Set SMOKE_SERVER_URL to an idle test server.');
const peers=[];
try {
 for(let i=0;i<4;i++) peers.push(await connect(process.env.SMOKE_SERVER_URL,{name:`Deploy check ${i}`,loadout:{ability:'magnet',cosmetics:{hat:'cap',face:'shades',back:null}},origin:'https://mindlesstruffle.github.io'}));
 for(const mode of ['1v1','2v2']) {
  for(const p of peers)p.messages=[];
  const group=peers.slice(0,mode==='1v1'?2:4);
  await privateMatch(group,mode);
  const presenceUrl=new URL(process.env.SMOKE_SERVER_URL);presenceUrl.protocol=presenceUrl.protocol==='wss:'?'https:':'http:';presenceUrl.pathname='/api/presence';const presence=await fetch(presenceUrl).then(r=>r.json());assert.equal(presence.playing,group.length);assert.equal(presence.total,group.length);
  await Promise.all(group.map(p=>p.next('snapshot').then(m=>checkState(m.state))));
  for(const p of group) p.send('room.leave');
  await Promise.all(group.map(p=>p.next('room',m=>m.room===null)));
  await sleep(3500);
  console.log(`PASS public TLS private ${mode}`);
 }
 for(const mode of ['1v1','2v2']) {
  for(const p of peers)p.messages=[];
  const group=peers.slice(0,mode==='1v1'?2:4);
  for(const p of group)p.send('queue.join',{mode});
  await Promise.all(group.map(p=>p.next('match')));
  await Promise.all(group.map(p=>p.next('snapshot').then(m=>checkState(m.state))));
  for(const p of group)p.send('room.leave');
  await Promise.all(group.map(p=>p.next('room',m=>m.room===null)));
  await sleep(3500);
  console.log(`PASS public TLS queue ${mode}`);
 }
 if(process.env.SMOKE_TWO_COURTS==='1') {
  for(let i=4;i<8;i++)peers.push(await connect(process.env.SMOKE_SERVER_URL,{name:`Deploy check ${i}`,loadout:{ability:'magnet',cosmetics:{hat:'cap',face:'shades',back:null}},origin:'https://mindlesstruffle.github.io'}));
  for(const p of peers)p.messages=[];
  const matches=await Promise.all([privateMatch(peers.slice(0,4),'2v2'),privateMatch(peers.slice(4),'2v2')]);
  assert.notEqual(matches[0][0].matchId,matches[1][0].matchId);
  const counts=peers.map(()=>0),listeners=peers.map((p,i)=>data=>{const m=JSON.parse(data);if(m.type==='snapshot'){checkState(m.state);counts[i]++;}});
  peers.forEach((p,i)=>p.ws.on('message',listeners[i]));
  await sleep(5000);
  peers.forEach((p,i)=>p.ws.off('message',listeners[i]));
  assert.ok(counts.every(n=>n>=80),'both public courts must deliver at least 16 snapshots/sec');
  for(const p of peers)p.send('room.leave');
  await Promise.all(peers.map(p=>p.next('room',m=>m.room===null)));
  await sleep(3500);
  console.log('PASS two simultaneous public 2v2 courts:',counts.map(n=>n/5),'snapshots/sec');
 }
} finally { for(const p of peers)p.close(); }
