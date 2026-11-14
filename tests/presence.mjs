import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createGameServer} from '../server/game-server.mjs';
const server=createGameServer({port:0,production:true,allowedOrigins:['https://example.test']}),clients=[];
const delay=()=>new Promise(r=>setTimeout(r,100));
try{
 const {port}=await server.start(),base=`http://127.0.0.1:${port}`;
 const counts=()=>fetch(base+'/api/presence',{headers:{Origin:'https://example.test'}}).then(r=>{assert.equal(r.headers.get('access-control-allow-origin'),'https://example.test');return r.json();});
 assert.deepEqual(await counts(),{ok:true,queued:0,playing:0,total:0});
 for(let i=0;i<2;i++){const ws=new WebSocket(`ws://127.0.0.1:${port}`,{origin:'https://example.test'});clients.push(ws);await once(ws,'open');ws.send(JSON.stringify({type:'hello',version:1,name:'Presence check',loadout:{cosmetics:{hat:'cap'}}}));await delay();if(i===0){assert.equal((await counts()).total,0);ws.send(JSON.stringify({type:'queue.join',mode:'1v1'}));await delay();assert.deepEqual(await counts(),{ok:true,queued:1,playing:0,total:1});}}
 clients[1].send(JSON.stringify({type:'queue.join',mode:'1v1'}));await delay();assert.deepEqual(await counts(),{ok:true,queued:0,playing:2,total:2});
 for(const ws of clients)ws.send(JSON.stringify({type:'room.leave'}));await delay();assert.equal((await counts()).total,0);
 const denied=await fetch(base+'/api/presence',{headers:{Origin:'https://other.test'}});assert.equal(denied.headers.get('access-control-allow-origin'),null);
 console.log('PASS presence: excludes idle clients, counts queue and match once, clears on leave, respects CORS.');
}finally{clients.forEach(ws=>ws.terminate());await server.close();}
