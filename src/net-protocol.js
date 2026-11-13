/** Shared wire contract. Sessions travel only in hello/welcome JSON, never URLs. */
export const PROTOCOL_VERSION = 1;
export const TICK_RATE = 120;
export const SNAPSHOT_RATE = 20;
export const INPUT_RATE = 30;
export const ACTION_KEYS = Object.freeze(['jump','dash','swing','smash','serve','toss','set','jumpSet','dive','ability']);
export const MODES = Object.freeze(['1v1','2v2']);
export const ABILITY_IDS = Object.freeze(['feather','spring','magnet','rocket','shield']);
export const CLIENT_MESSAGES = Object.freeze(['hello','profile.update','room.create','room.join','room.team','room.mode','room.start','room.leave','queue.join','queue.cancel','input','ping']);
export const SERVER_MESSAGES = Object.freeze(['welcome','room','queue','match','snapshot','events','match.end','pong','error']);
export const MAX_PAYLOAD_BYTES = 4096;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
export function normalizeControls(value) {
  if (!value || typeof value!=='object' || Array.isArray(value)) return null;
  const result={};
  for(const key of ['x','z','aimYaw','neckYaw','neckPitch','extension','power','charge']) {
    if(value[key]===undefined) continue;
    if(typeof value[key]!=='number'||!Number.isFinite(value[key])) return null;
    result[key]=['aimYaw','neckYaw'].includes(key)?wrap(clamp(value[key],-1e6,1e6)):key==='neckPitch'?clamp(value[key],-1.22,1.35):clamp(value[key],['x','z'].includes(key)?-1:0,1);
  }
  const length=Math.max(1,Math.hypot(result.x||0,result.z||0));
  result.x=(result.x||0)/length;result.z=(result.z||0)/length;
  for(const key of ACTION_KEYS) {if(value[key]!==undefined&&typeof value[key]!=='boolean')return null;result[key]=value[key]===true;}
  return result;
}
export function normalizeLoadout(value={}) {
  const ability=ABILITY_IDS.includes(value?.ability)?value.ability:'magnet';
  const skin=value?.skin;
  const palette=skin&&typeof skin==='object'&&['body','spots','muzzle','scarf','accent'].every(k=>typeof skin[k]==='string'&&/^#[0-9a-f]{6}$/i.test(skin[k]))?Object.fromEntries(['body','spots','muzzle','scarf','accent'].map(k=>[k,skin[k]])):null;
  return {ability,skin:palette};
}
export function normalizeName(name) {return typeof name==='string'?name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,24)||'Tall Friend':'Tall Friend';}
/** Public, JSON-safe authoritative render state. No private solver/session fields. */
export function snapshotState(game) {
  const state={};
  for(const key of ['mode','phase','paused','rally','hits','rallyHits','round','touchTeam','lastAction','serveStage','serveCharge','serveQuality','server','celebrationRemaining','message'])state[key]=game[key];
  state.score=[...game.score];state.touches=[...game.touches];state.ball={...game.ball};
  const fields=['id','team','human','name','x','y','z','vx','vz','bodyYaw','heading','jump','swing','dive','setBounce','knockback','tumble','energy','action','aimYaw','shotPower','role','equippedAbility'];
  state.players=game.players.map(p=>({...Object.fromEntries(fields.map(k=>[k,p[k]])),...Object.fromEntries(Object.entries(p).filter(([k,v])=>k.startsWith('_')&&typeof v==='number'&&Number.isFinite(v))),_contactAction:p._contactAction,neck:{...p.neck},head:{...p.head},neckPoints:p.neckPoints.map(q=>({...q})),ability:p.ability?{...p.ability}:null,skin:p.skin?{...p.skin}:null}));
  // Millimetre positions and four-decimal angles are below visible tolerance, keeping articulated
  // neck snapshots small enough for mobile connections without compression CPU.
  function round(value,key){if(typeof value==='number'){const scale=key==='yaw'||key==='pitch'||key==='aimYaw'||key==='bodyYaw'?1e4:1e3;return Number.isInteger(value)?value:Math.round(value*scale)/scale;}if(value&&typeof value==='object')for(const k in value)value[k]=round(value[k],k);return value;}
  return round(state);
}
/*
C->S hello {version?:1,name,loadout:{ability,skin:palette},sessionToken?}
     profile.update {name?,loadout?} (next match; current match loadout stays fixed)
     room.create {mode}; room.join {code}; room.mode {mode}; room.team {team:0|1}
     room.start {}; room.leave {}; queue.join {mode}; queue.cancel {}
     input {seq:increasing integer,controls}; ping {id,clientTime}
S->C welcome {version:1,id:stable member UUID,sessionToken,resumed:boolean,matchId:string|null}
     room {room:null|{code,mode,hostId,status:'lobby'|'queued'|'playing',members:[{id,name,team,connected,host,loadout}]}}
     queue {status:'waiting'|'cancelled'|'matched',mode,partySize}
     match {matchId,playerId:numeric physics slot,team,localTeam,mode,roomCode}
     snapshot {matchId,seq,time:epoch milliseconds,ack:last input seq applied,state:snapshotState}
     events {matchId,events:[{id:monotonic per match,...physics event}]}
     match.end {matchId,reason,winner,score}; room:null follows immediately.
     pong {id,clientTime,serverTime}; error {code,message}
Private room host can queue a two-member 2v2 party; party remains on one team.
Rejoin hello restores room, match and latest snapshot with same playerId.
*/
