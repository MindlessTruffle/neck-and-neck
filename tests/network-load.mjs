import assert from 'node:assert/strict';
import { once } from 'node:events';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/game-server.mjs';

const COURTS=Math.max(1,Math.min(32,Number(process.env.LOAD_ROOMS)||8)),DURATION=Math.max(1500,Number(process.env.LOAD_MS)||4000);
const server=createGameServer({port:0,maxRooms:COURTS,maxConnections:COURTS*4+4,maxConnectionsPerIP:COURTS*4+4,maxSessions:COURTS*4+4});
const clients=[];const delay=monitorEventLoopDelay({resolution:10});let snapshots=0,bytes=0,interval;
function wait(client,type,predicate=()=>true){const match=()=>client.messages.findIndex(m=>m.type===type&&predicate(m));const i=match();if(i>=0)return Promise.resolve(client.messages.splice(i,1)[0]);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{client.ws.off('message',check);reject(new Error(`Load client timed out: ${type}`));},5000);function check(){const index=match();if(index>=0){clearTimeout(timer);client.ws.off('message',check);resolve(client.messages.splice(index,1)[0]);}}client.ws.on('message',check);});}
function send(client,type,data={}){client.ws.send(JSON.stringify({type,...data}));}
try{
  const address=await server.start();
  for(let room=0;room<COURTS;room++){
    const party=[];
    for(let slot=0;slot<4;slot++){
      const ws=new WebSocket(address.url,{origin:'http://localhost:5173'});await once(ws,'open');const client={ws,messages:[],seq:0,slot};clients.push(client);party.push(client);
      ws.on('message',data=>{bytes+=data.length;const message=JSON.parse(data);if(message.type==='snapshot'){snapshots++;client.last=message;assert.ok(message.state.players.every(p=>Number.isFinite(p.head.x)));}else{if(message.type==='match.end'&&client.slot===0)client.restart=true;if(message.type==='room'&&message.room?.status==='lobby'&&client.restart){client.restart=false;send(client,'room.start');}client.messages.push(message);if(client.messages.length>200)client.messages.shift();}});
      send(client,'hello',{name:`Load ${room}-${slot}`});await wait(client,'welcome');
    }
    send(party[0],'room.create',{mode:'2v2'});const {room:created}=await wait(party[0],'room',m=>m.room?.code);
    for(let i=1;i<4;i++){send(party[i],'room.join',{code:created.code});await wait(party[i],'room',m=>m.room?.members.length===i+1);}
    send(party[0],'room.start');await Promise.all(party.map(c=>wait(c,'match')));
  }
  const baseline=server.metrics(),bytesBefore=bytes,snapshotsBefore=snapshots,start=performance.now(),cpuBefore=process.cpuUsage();delay.enable();
  interval=setInterval(()=>{
    const time=(performance.now()-start)/1000;
    for(const client of clients){const phase=client.last?.state.phase,serveStage=client.last?.state.serveStage;send(client,'input',{seq:++client.seq,controls:{x:Math.sin(time+client.slot),z:Math.cos(time*.8+client.slot),neckYaw:(client.slot<2?0:Math.PI)+Math.sin(time*2)*.7,neckPitch:Math.sin(time*3)*.5,extension:.8,swing:client.seq%17===0,serve:client.slot===0&&phase==='serve'&&(serveStage==='ready'||client.seq%20===0),jump:client.seq%43===0,dive:client.seq%71===0,ability:client.seq===30}});}
  },1000/30);
  await new Promise(resolve=>setTimeout(resolve,DURATION));clearInterval(interval);delay.disable();
  const elapsed=(performance.now()-start)/1000,metrics=server.metrics(),steps=metrics.physicsSteps-baseline.physicsSteps,meanStepHz=steps/COURTS/elapsed;
  const cpu=process.cpuUsage(cpuBefore);
  const report={cpuCorePercent:Number(((cpu.user+cpu.system)/1e6/elapsed*100).toFixed(1)),courts:COURTS,players:clients.length,seconds:Number(elapsed.toFixed(2)),physicsHzPerCourt:Number(meanStepHz.toFixed(1)),snapshotsHzPerClient:Number(((snapshots-snapshotsBefore)/clients.length/elapsed).toFixed(1)),meanServerTickMs:Number(((metrics.tickMs-baseline.tickMs)/(metrics.ticks-baseline.ticks)).toFixed(3)),maxServerTickMs:Number(metrics.maxTickMs.toFixed(3)),eventLoopP95Ms:Number((delay.percentile(95)/1e6).toFixed(2)),outboundMBps:Number(((bytes-bytesBefore)/elapsed/1e6).toFixed(2)),rssMB:Number((process.memoryUsage().rss/1e6).toFixed(1)),droppedTimeMs:Number((metrics.droppedTimeMs-baseline.droppedTimeMs).toFixed(1))};
  console.log(JSON.stringify(report,null,2));
  assert.equal(metrics.matches,COURTS);assert.equal(metrics.connections,clients.length);assert.ok(meanStepHz>105,'server must retain practical120 Hz physics');assert.ok(report.snapshotsHzPerClient>16,'server must retain practical20 Hz snapshots');assert.ok(report.eventLoopP95Ms<100,'event loop must stay interactive');
  console.log('PASS real WebSocket load: four human clients per court, 30 Hz inputs, continuous physics, snapshots and finite neck poses.');
}finally{clearInterval(interval);delay.disable();for(const client of clients)client.ws.terminate();await server.close();}
