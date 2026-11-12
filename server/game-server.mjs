import http from 'node:http';
import { randomBytes, randomUUID, randomInt } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { isIP } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { VolleyballGame } from '../src/physics.js';
import { ACTION_KEYS, CLIENT_MESSAGES, PROTOCOL_VERSION, TICK_RATE, SNAPSHOT_RATE, MODES, MAX_PAYLOAD_BYTES, normalizeControls, normalizeLoadout, normalizeName, snapshotState } from '../src/net-protocol.js';

const STEP=1/TICK_RATE;
const capacity=mode=>mode==='1v1'?2:4;
const emptyActions=input=>{for(const key of ACTION_KEYS)input[key]=false;};
const noControls=()=>({x:0,z:0});
const LOOPBACK=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);
const token=()=>randomBytes(32).toString('base64url');
const code=()=>randomBytes(5).toString('hex').toUpperCase();
function privateAddress(address='') {const ip=address.replace(/^::ffff:/,'');return LOOPBACK.has(address)||ip.startsWith('10.')||ip.startsWith('192.168.')||/^172\.(1[6-9]|2\d|3[01])\./.test(ip)||/^(fc|fd)[0-9a-f]{2}:/i.test(ip);}

/** Authoritative rooms, matchmaking and 120 Hz physics. No client position/score writes. */
export function createGameServer(options={}) {
  const config={host:'127.0.0.1',port:8787,maxRooms:8,maxConnections:64,maxConnectionsPerIP:8,maxSessions:128,
    reconnectGraceMs:15000,sessionTtlMs:60000,roomIdleMs:15*60e3,matchTimeoutMs:20*60e3,
    heartbeatMs:10000,helloTimeoutMs:5000,inputStaleMs:300,maxBufferedBytes:512*1024,
    maxMessagesPerSecond:70,maxCommandsPerSecond:12,production:process.env.NODE_ENV==='production',...options};
  const origins=new Set((Array.isArray(config.allowedOrigins)?config.allowedOrigins:String(config.allowedOrigins||'').split(',')).map(v=>v.trim()).filter(Boolean));
  if(config.production&&!origins.size)throw new Error('Production requires an explicit ALLOWED_ORIGINS allowlist.');
  for(const key of ['maxRooms','maxConnections','maxConnectionsPerIP','maxSessions'])if(!Number.isInteger(config[key])||config[key]<1)throw new Error(`Invalid ${key}`);
  const sessions=new Map(),rooms=new Map(),matches=new Map(),connections=new Set(),queues=[];
  const stats={ticks:0,physicsSteps:0,snapshots:0,messages:0,rejected:0,tickMs:0,maxTickMs:0,droppedTimeMs:0};
  let timer=null,heartbeat=null,closing=false,started=false,lastTick=performance.now(),accumulator=0,snapshotElapsed=0,lastHousekeeping=0;

  const server=http.createServer((request,response)=>{
    if(request.method==='GET'&&request.url==='/health'){
      response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
      response.end(JSON.stringify({ok:!closing,protocol:PROTOCOL_VERSION,rooms:rooms.size,matches:matches.size,connections:connections.size}));
    }else{response.writeHead(404,{'content-type':'text/plain'});response.end('Not found');}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:MAX_PAYLOAD_BYTES,perMessageDeflate:false});
  function send(ws,message) {
    if(!ws||ws.readyState!==WebSocket.OPEN)return false;
    if(ws.bufferedAmount>config.maxBufferedBytes){ws.close(1013,'Connection too slow');return false;}
    ws.send(typeof message==='string'?message:JSON.stringify(message));return true;
  }
  const tell=(s,message)=>send(s?.ws,message);
  const fail=(ws,error,message)=>{stats.rejected++;send(ws,{type:'error',code:error,message});};
  const roomFor=s=>rooms.get(s.roomCode);
  const matchFor=s=>matches.get(s.matchId);
  function roomView(room) {return room?{code:room.code,mode:room.mode,hostId:room.hostId,status:room.matchId?'playing':room.queued?'queued':'lobby',members:room.members.map(s=>({id:s.id,name:s.name,team:s.team,connected:!!s.ws,host:s.id===room.hostId,loadout:s.loadout}))}:null;}
  function publishRoom(room) {if(!room)return;const message={type:'room',room:roomView(room)};for(const s of room.members)tell(s,message);}
  function touch(room){if(room)room.activity=Date.now();}
  function cancelQueue(session,notify=true) {
    const group=queues.find(g=>g.members.includes(session));if(!group)return;
    queues.splice(queues.indexOf(group),1);
    for(const s of group.members){s.queued=false;if(notify)tell(s,{type:'queue',status:'cancelled',mode:group.mode,partySize:group.members.length});}
    const room=rooms.get(group.roomCode);if(room){room.queued=false;publishRoom(room);}
  }
  function removeFromRoom(session,{notify=true}={}) {
    cancelQueue(session);const room=roomFor(session);session.roomCode=null;
    if(room){room.members=room.members.filter(s=>s!==session);if(!room.members.length)rooms.delete(room.code);else{if(room.hostId===session.id)room.hostId=room.members[0].id;touch(room);publishRoom(room);}}
    if(notify)tell(session,{type:'room',room:null});
  }
  function makeRoom(mode,members=[]) {
    let roomCode;do{roomCode=code();}while(rooms.has(roomCode));
    const room={code:roomCode,mode,members,hostId:members[0]?.id||null,queued:false,matchId:null,activity:Date.now()};rooms.set(roomCode,room);
    for(const s of members)s.roomCode=roomCode;
    return room;
  }
  function defaultControls(player) {return{x:0,z:0,aimYaw:player.aimYaw,neckYaw:player.neck.yaw,neckPitch:player.neck.pitch,extension:player.neck.extension};}
  function matchNotice(match,s) {return{type:'match',matchId:match.id,playerId:s.playerId,team:s.team,localTeam:s.team,mode:match.game.mode,roomCode:match.room.code};}
  function publishSnapshot(match,one=null) {
    // The large render state is identical for every player. Encode it once;
    // only the acknowledgement differs. Keep the existing JSON wire format.
    const state=JSON.stringify(snapshotState(match.game)),seq=++match.snapshotSeq,time=Date.now();stats.snapshots++;
    const prefix=JSON.stringify({type:'snapshot',matchId:match.id,seq,time}).slice(0,-1);
    for(const s of one?[one]:match.members)send(s.ws,`${prefix},"ack":${s.ack},"state":${state}}`);
  }
  function flushEvents(match) {
    if(!match.events.length)return;
    const events=match.events.splice(0);const message={type:'events',matchId:match.id,events};
    for(const s of match.members)tell(s,message);
  }
  function startMatch(room) {
    const members=[...room.members].sort((a,b)=>a.team-b.team);
    const match={id:randomUUID(),room,members,game:null,events:[],eventId:0,snapshotSeq:0,startedAt:Date.now(),reason:'completed',finishedAt:0};
    match.game=new VolleyballGame({mode:room.mode,onEvent:event=>{
      match.events.push({...event,id:++match.eventId});
      if(match.events.length>256)match.events.shift();
      if(event.type==='win')match.finishedAt=Date.now();
    }});
    match.game.seed=randomInt(1,0x7fffffff);
    for(let i=0;i<members.length;i++){
      const s=members[i],p=match.game.players[i];s.matchId=match.id;s.playerId=i;s.lastSeq=-1;s.ack=-1;s.pendingSeq=-1;s.input=defaultControls(p);s.inputAt=Date.now();s.queued=false;
      p.human=true;p.name=s.name;match.game.setPlayerLoadout(i,s.loadout);
    }
    room.matchId=match.id;room.queued=false;touch(room);matches.set(match.id,match);match.game.start();
    for(const s of members){tell(s,{type:'queue',status:'matched',mode:room.mode,partySize:members.length});tell(s,matchNotice(match,s));}
    publishRoom(room);flushEvents(match);publishSnapshot(match);
    return match;
  }
  function finishMatch(match) {
    if(!matches.has(match.id))return;
    const game=match.game,winner=game.score[0]===game.score[1]?null:game.score[0]>game.score[1]?0:1;
    for(const s of match.members){tell(s,{type:'match.end',matchId:match.id,reason:match.reason,winner,score:[...game.score]});s.matchId=null;s.playerId=null;s.input=noControls();s.lastSeq=s.ack=s.pendingSeq=-1;}
    matches.delete(match.id);match.room.matchId=null;touch(match.room);
    for(const s of [...match.room.members])if(!s.ws)removeFromRoom(s,{notify:false});
    publishRoom(rooms.get(match.room.code));tryMatchQueues();
  }
  function forfeit(match,team,reason='disconnect') {
    if(!match||match.game.phase==='finished')return;
    match.reason=reason;const g=match.game,winner=1-team;
    g.score[winner]=Math.max(g.score[winner],Math.min(10,Math.max(6,g.score[team]+1)));
    g._point(winner,reason);flushEvents(match);publishSnapshot(match);
  }
  function canFit(groups,mode) {
    const total=groups.reduce((n,g)=>n+g.members.length,0);if(total!==capacity(mode))return null;
    const half=capacity(mode)/2,teams=[[],[]];
    for(const group of [...groups].sort((a,b)=>b.members.length-a.members.length)){
      const team=teams[0].length+group.members.length<=half?0:1;
      if(teams[team].length+group.members.length>half)return null;teams[team].push(...group.members);
    }return teams;
  }
  function tryMatchQueues() {
    for(const mode of MODES){
      let again=true;
      while(again){again=false;const candidates=queues.filter(g=>g.mode===mode&&g.members.every(s=>s.ws&&!s.matchId));let found=null,teams=null;
        function search(index,picked,size){if(found)return;if(size===capacity(mode)){const assigned=canFit(picked,mode);if(assigned){found=picked;teams=assigned;}return;}if(size>capacity(mode))return;for(let i=index;i<candidates.length;i++)search(i+1,[...picked,candidates[i]],size+candidates[i].members.length);}
        search(0,[],0);if(!found)break;
        const replaced=new Set(found.map(g=>g.roomCode).filter(Boolean));
        if(rooms.size-replaced.size>=config.maxRooms||matches.size>=config.maxRooms)break;
        for(const group of found){queues.splice(queues.indexOf(group),1);if(group.roomCode)rooms.delete(group.roomCode);}
        const members=teams.flat();for(let t=0;t<2;t++)for(const s of teams[t])s.team=t;
        const room=makeRoom(mode,members);startMatch(room);again=true;
      }
    }
  }
  function processCommand(ws,message) {
    const now=Date.now();let session=ws.session;
    if(!CLIENT_MESSAGES.includes(message.type))return fail(ws,'COMMAND','Unknown command.');
    if(message.type==='hello'){
      if(session)return fail(ws,'ALREADY_CONNECTED','This connection is already initialized.');
      if(message.version!==undefined&&message.version!==PROTOCOL_VERSION)return fail(ws,'VERSION','Please reload the game to update its network protocol.');
      if(message.sessionToken!==undefined&&(typeof message.sessionToken!=='string'||message.sessionToken.length>128))return fail(ws,'SESSION','Invalid session.');
      session=message.sessionToken?sessions.get(message.sessionToken):null;
      if(message.sessionToken&&!session)return fail(ws,'SESSION_EXPIRED','Your session expired. Connect again to join a new room.');
      const resumed=!!session;
      if(!session){
        if(sessions.size>=config.maxSessions){fail(ws,'CAPACITY','The clubhouse is full. Try again shortly.');ws.close(1013,'Server full');return;}
        session={id:randomUUID(),token:token(),name:normalizeName(message.name),loadout:normalizeLoadout(message.loadout),ws:null,roomCode:null,matchId:null,playerId:null,team:0,queued:false,input:noControls(),lastSeq:-1,pendingSeq:-1,ack:-1,inputAt:now,disconnectedAt:0,lastSeen:now};sessions.set(session.token,session);
      }
      if(session.ws&&session.ws!==ws){session.ws.session=null;session.ws.close(4001,'Session resumed elsewhere');}
      ws.session=session;session.ws=ws;session.disconnectedAt=0;session.lastSeen=now;
      tell(session,{type:'welcome',version:PROTOCOL_VERSION,id:session.id,sessionToken:session.token,resumed,matchId:session.matchId||null});
      const room=roomFor(session);if(room)publishRoom(room);else tell(session,{type:'room',room:null});
      const match=matchFor(session);if(match){tell(session,matchNotice(match,session));publishSnapshot(match,session);}
      return;
    }
    if(!session)return fail(ws,'HELLO_REQUIRED','Connect before sending commands.');
    session.lastSeen=now;
    if(message.type==='ping'){if((typeof message.id==='number'&&Number.isFinite(message.id))||(typeof message.id==='string'&&message.id.length<=64))tell(session,{type:'pong',id:message.id,clientTime:Number.isFinite(message.clientTime)?message.clientTime:null,serverTime:now});return;}
    if(message.type==='profile.update'){
      if(message.name!==undefined)session.name=normalizeName(message.name);
      if(message.loadout!==undefined)session.loadout=normalizeLoadout(message.loadout);
      publishRoom(roomFor(session));return;
    }
    if(message.type==='input'){
      const match=matchFor(session);if(!match||match.game.phase==='finished')return;
      if(!Number.isSafeInteger(message.seq)||message.seq<0||message.seq>0x7fffffff||message.seq<=session.lastSeq)return;
      const controls=normalizeControls(message.controls);if(!controls)return fail(ws,'INPUT','Input must contain finite control values.');
      session.lastSeq=message.seq;session.pendingSeq=message.seq;session.inputAt=now;
      const previous=session.input;session.input={...previous,...controls};for(const key of ACTION_KEYS)session.input[key]=!!(previous[key]||controls[key]);return;
    }
    const room=roomFor(session);
    if(message.type==='room.leave'){
      const match=matchFor(session);if(match){forfeit(match,session.team,'left');session.matchId=null;session.playerId=null;match.members=match.members.filter(s=>s!==session);}
      removeFromRoom(session);return;
    }
    if(message.type==='queue.cancel'){cancelQueue(session);return;}
    if(session.matchId)return fail(ws,'IN_MATCH','Finish your match before changing rooms.');
    if(message.type==='room.create'){
      if(!MODES.includes(message.mode))return fail(ws,'MODE','Choose 1v1 or 2v2.');
      if(session.roomCode||session.queued)return fail(ws,'IN_ROOM','Leave your current room or queue first.');
      if(rooms.size>=config.maxRooms||matches.size>=config.maxRooms)return fail(ws,'CAPACITY','All courts are occupied. Try again shortly.');
      session.team=0;const next=makeRoom(message.mode,[session]);publishRoom(next);return;
    }
    if(message.type==='room.join'){
      if(session.roomCode||session.queued)return fail(ws,'IN_ROOM','Leave your current room or queue first.');
      const target=typeof message.code==='string'&&rooms.get(message.code.trim().toUpperCase());
      if(!target||target.matchId||target.queued)return fail(ws,'ROOM_UNAVAILABLE','That room is unavailable.');
      if(target.members.length>=capacity(target.mode))return fail(ws,'ROOM_FULL','That court is full.');
      const half=capacity(target.mode)/2;session.team=target.members.filter(s=>s.team===0).length<half?0:1;
      target.members.push(session);session.roomCode=target.code;touch(target);publishRoom(target);return;
    }
    if(message.type==='room.team'){
      if(!room||room.queued)return fail(ws,'NO_ROOM','Join an idle room first.');
      if(![0,1].includes(message.team))return fail(ws,'TEAM','Choose a valid team.');
      if(room.members.filter(s=>s!==session&&s.team===message.team).length>=capacity(room.mode)/2)return fail(ws,'TEAM_FULL','That team is full.');
      session.team=message.team;touch(room);publishRoom(room);return;
    }
    if(message.type==='room.mode'){
      if(!room||room.hostId!==session.id||room.queued)return fail(ws,'HOST_REQUIRED','Only the host can change the room mode.');
      if(!MODES.includes(message.mode)||room.members.length>capacity(message.mode))return fail(ws,'MODE','That mode cannot fit this party.');
      room.mode=message.mode;room.members.forEach((s,i)=>s.team=Math.floor(i/(capacity(room.mode)/2)));touch(room);publishRoom(room);return;
    }
    if(message.type==='room.start'){
      if(!room||room.hostId!==session.id||room.queued)return fail(ws,'HOST_REQUIRED','Only the host can start this room.');
      const half=capacity(room.mode)/2;
      if(room.members.length!==capacity(room.mode)||room.members.some(s=>!s.ws)||[0,1].some(t=>room.members.filter(s=>s.team===t).length!==half))return fail(ws,'PLAYERS_REQUIRED',`This match needs ${capacity(room.mode)} connected players on balanced teams.`);
      if(matches.size>=config.maxRooms)return fail(ws,'CAPACITY','All courts are occupied. Try again shortly.');
      startMatch(room);return;
    }
    if(message.type==='queue.join'){
      if(session.queued)return fail(ws,'ALREADY_QUEUED','Already finding a court.');
      if(!MODES.includes(message.mode))return fail(ws,'MODE','Choose 1v1 or 2v2.');
      if(room&&(room.hostId!==session.id||room.mode!=='2v2'||message.mode!=='2v2'||room.members.length!==2||room.members.some(s=>!s.ws)))return fail(ws,'PARTY','A party queue requires a connected two-player 2v2 room and its host.');
      const members=room?[...room.members]:[session];const group={id:randomUUID(),mode:message.mode,members,roomCode:room?.code||null};
      queues.push(group);if(room)room.queued=true;
      for(const s of members){s.queued=true;tell(s,{type:'queue',status:'waiting',mode:message.mode,partySize:members.length});}publishRoom(room);tryMatchQueues();return;
    }
    fail(ws,'COMMAND','Unknown command.');
  }

  server.on('upgrade',(request,socket,head)=>{
    let address=request.socket.remoteAddress;const origin=request.headers.origin;
    // Opt-in only behind a private, non-publicly-exposed reverse proxy. The last
    // XFF entry is the peer appended by that proxy, not a user-supplied prefix.
    if(config.trustProxy===true&&privateAddress(address)){
      const forwarded=String(request.headers['x-forwarded-for']||'').split(',').at(-1).trim();
      if(isIP(forwarded))address=forwarded;
    }
    const localOrigin=typeof origin==='string'&&/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
    const allowed=origins.has(origin)||(!config.production&&!origins.size&&LOOPBACK.has(address)&&(!origin||localOrigin));
    const count=[...connections].filter(ws=>ws.remoteAddress===address).length;
    if(closing||!allowed||request.url!=='/'||connections.size>=config.maxConnections||count>=config.maxConnectionsPerIP){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');socket.destroy();return;}
    wss.handleUpgrade(request,socket,head,ws=>{ws.remoteAddress=address;wss.emit('connection',ws,request);});
  });
  wss.on('connection',ws=>{
    connections.add(ws);ws.alive=true;ws.connectedAt=Date.now();ws.windowAt=Date.now();ws.messageCount=0;ws.commandCount=0;
    ws.on('pong',()=>{ws.alive=true;});ws.on('error',()=>{});
    ws.on('message',(data,binary)=>{
      stats.messages++;const now=Date.now();if(now-ws.windowAt>=1000){ws.windowAt=now;ws.messageCount=ws.commandCount=0;}
      if(++ws.messageCount>config.maxMessagesPerSecond){fail(ws,'RATE_LIMIT','Too many messages.');ws.close(1008,'Rate limit');return;}
      if(binary)return fail(ws,'FORMAT','Messages must be JSON text.');
      let message;try{message=JSON.parse(data.toString());}catch{return fail(ws,'FORMAT','Invalid JSON.');}
      if(!message||typeof message!=='object'||Array.isArray(message)||typeof message.type!=='string')return fail(ws,'FORMAT','Invalid command.');
      if(message.type!=='input'&&message.type!=='ping'&&++ws.commandCount>config.maxCommandsPerSecond){fail(ws,'RATE_LIMIT','Too many commands.');ws.close(1008,'Rate limit');return;}
      processCommand(ws,message);
    });
    ws.on('close',()=>{
      connections.delete(ws);const session=ws.session;
      if(session?.ws===ws){session.ws=null;session.disconnectedAt=Date.now();session.input=noControls();cancelQueue(session);publishRoom(roomFor(session));}
    });
  });
  function housekeeping(now) {
    for(const session of sessions.values()){
      if(session.ws)continue;
      const elapsed=now-session.disconnectedAt;
      if(session.matchId&&elapsed>=config.reconnectGraceMs)forfeit(matchFor(session),session.team,'disconnect');
      if(!session.matchId&&elapsed>=config.sessionTtlMs){removeFromRoom(session,{notify:false});sessions.delete(session.token);}
    }
    for(const room of [...rooms.values()])if(!room.matchId&&!room.queued&&now-room.activity>config.roomIdleMs){for(const session of [...room.members])removeFromRoom(session);}
    for(const match of matches.values())if(match.game.phase!=='finished'&&now-match.startedAt>config.matchTimeoutMs){match.reason='time-limit';const g=match.game;forfeit(match,g.score[0]<=g.score[1]?0:1,'time-limit');}
  }
  function tick() {
    if(closing)return;const before=performance.now(),now=Date.now(),elapsed=(before-lastTick)/1000;lastTick=before;
    stats.droppedTimeMs+=Math.max(0,elapsed-.1)*1000;accumulator+=Math.min(.1,Math.max(0,elapsed));snapshotElapsed+=Math.min(.1,elapsed);
    // Session expiry needs a 100 ms cadence, not a scan on every physics tick.
    if(now-lastHousekeeping>=100){housekeeping(now);lastHousekeeping=now;}
    while(accumulator>=STEP){
      for(const match of matches.values()){
        const inputs={};for(const s of match.members){
          if(now-s.inputAt>config.inputStaleMs){s.input.x=0;s.input.z=0;emptyActions(s.input);}
          inputs[s.playerId]={...s.input};s.ack=s.pendingSeq;emptyActions(s.input);
        }
        match.game.update(STEP,inputs);stats.physicsSteps++;
      }accumulator-=STEP;
    }
    const snapshot=snapshotElapsed>=1/SNAPSHOT_RATE;if(snapshot)snapshotElapsed%=1/SNAPSHOT_RATE;
    for(const match of [...matches.values()]){
      flushEvents(match);if(snapshot)publishSnapshot(match);
      if(match.game.phase==='finished'&&match.game.celebrationRemaining<=0)finishMatch(match);
    }
    stats.ticks++;const duration=performance.now()-before;stats.tickMs+=duration;stats.maxTickMs=Math.max(stats.maxTickMs,duration);
  }
  return {
    server,
    async start(){if(started)return this.address();started=true;await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,config.host,()=>{server.off('error',reject);resolve();});});lastTick=performance.now();timer=setInterval(tick,8);heartbeat=setInterval(()=>{for(const ws of connections){if(!ws.session&&Date.now()-ws.connectedAt>config.helloTimeoutMs){ws.close(1008,'Hello timeout');continue;}if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},Math.min(config.heartbeatMs,config.helloTimeoutMs));return this.address();},
    address(){const address=server.address();return typeof address==='object'&&address?{host:address.address,port:address.port,url:`ws://${address.family==='IPv6'?'['+address.address+']':address.address}:${address.port}`} :null;},
    metrics(){return{...stats,averageTickMs:stats.ticks?stats.tickMs/stats.ticks:0,rooms:rooms.size,matches:matches.size,sessions:sessions.size,connections:connections.size,queued:queues.reduce((n,g)=>n+g.members.length,0)};},
    async close(){closing=true;clearInterval(timer);clearInterval(heartbeat);for(const ws of connections)ws.terminate();await new Promise(resolve=>wss.close(resolve));if(server.listening)await new Promise(resolve=>server.close(resolve));sessions.clear();rooms.clear();matches.clear();queues.length=0;},
  };
}
