const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const BALL_GRAVITY = 10.8;
export const MAX_BALL_SPEED = 11.5;
export const BALL_RADIUS = .34;
const G = BALL_GRAVITY;
const BALL_R = BALL_RADIUS;
const HEAD_R = .68;
const DIVE_DURATION=.72;
const ACTION_KEYS=['jump','dash','swing','smash','serve','toss','set','jumpSet','dive','ability'];
const EMPTY_INPUT=Object.freeze({});
export const ABILITIES = [
  { id:'feather',name:'Feather Float',description:'Your next touch becomes a slow, lofty return.',color:'#d8f4ee',duration:6,cooldown:6 },
  { id:'spring',name:'Spring Step',description:'Launch into a high jump for a spike or block.',color:'#ffd56c',duration:3,cooldown:5 },
  { id:'magnet',name:'Magnet Head',description:'A wide receiving field rescues your next touch.',color:'#f3a4db',duration:5,cooldown:6 },
  { id:'rocket',name:'Rocket Hooves',description:'Burst toward the ball with an extended diving reach.',color:'#ffa574',duration:2,cooldown:5 },
  { id:'shield',name:'Iron Canopy',description:'Raise a broad blocking canopy for three seconds.',color:'#82cbe8',duration:3,cooldown:6 },
];
const SKILL = {
  chill: { speed: 5.0, reaction: .25, error: .45 },
  club: { speed: 5.1, reaction: .18, error: .30 },
  spicy: { speed: 5.7, reaction: .10, error: .12 },
};
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export class VolleyballGame {
  constructor({ mode = '2v2', difficulty = 'club', equippedAbility='magnet',loadout=null,onEvent = () => {} } = {}) {
    this.onEvent = onEvent; this.mode = mode; this.difficulty = difficulty; this.seed = 72931;
    this.reset({ mode, difficulty,equippedAbility,loadout });
  }
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  emit(type, data = {}) { this.onEvent({ type, ...data }); }
  get state() { return this; }
  reset({ mode = this.mode, difficulty = this.difficulty,equippedAbility=this.equippedAbility||'magnet',loadout=null } = {}) {
    this.mode = mode === '1v1' ? '1v1' : '2v2'; this.difficulty = SKILL[difficulty] ? difficulty : 'club';
    this.equippedAbility=ABILITIES.some(a=>a.id===(loadout?.ability||equippedAbility))?(loadout?.ability||equippedAbility):'magnet';this.loadout=loadout;this.networkInputs=null;this._allowEdges=true;this._serveClickPlayer=null;this.celebrationRemaining=0;
    this.paused = false; this.phase = 'attract'; this.score = [0, 0]; this.rally = 0; this.hits = 0; this.rallyHits = 0;
    this.server = 0; this.timer = 0; this.message = 'READY'; this.lastTeam = null; this.lastHitter = null; this.touchCooldown = 0; this.netCooldown = 0;
    this.round=1;this.touches=[0,0];this.touchTeam=null;this.lastAction='';this.serveStage='ready';this.serveCharge=0;this.serveQuality=0;this._serveTime=0;this._lastWasBlock=false;
    const count = this.mode === '1v1' ? 1 : 2; this.players = [];
    for (let team = 0; team < 2; team++) for (let i = 0; i < count; i++) {
      const x = team ? 4.8 : -4.8, z = count === 1 ? 0 : (i ? 2 : -2), yaw = team ? Math.PI : 0;
      this.players.push({ id: team * count + i, team, human: !team && !i, x, z, y: 0, vx: 0, vz: 0, heading: team ? -1 : 1, jump: 0, action: '', energy: 1,
        bodyYaw: yaw, neckPoints: [], head: { x, y: 3.2, z, vx: 0, vy: 0, vz: 0 }, neck: { yaw, pitch: team === 0 && i === 0 ? -.12 : .1, extension: .35 }, swing: 0,
        _jumpV: 0, _jumpBuffer: 0, _dash: 0, _dashCooldown: 0, _dashBuffer: 0, _dashX: 0, _dashZ: 0,
        _swingTime: 0, _swingCooldown: 0, _swingBuffer: 0, _shotYaw: 0, _reaction: 0, _tx: x, _tz: z,
        aimYaw:yaw,shotPower:.55,role:count===1?'all-rounder':i===0?'receiver':'striker',ability:null,
        equippedAbility:!team&&!i?this.equippedAbility:null,_matchAbility:null,skin:!team&&!i?loadout?.skin:null,
        _actionTime:0,_actionSerial:0,_lastHitActionSerial:-1,_contactAction:'bump',_setBuffer:0,_jumpSetBuffer:0,_blockTime:0,_contactCooldown:0,_jumpCooldown:0,
        _dive:0,_diveCooldown:0,_diveX:0,_diveZ:0,dive:0,setBounce:0,_setBounceTime:0,
        knockback:0,_knockTime:0,_knockVX:0,_knockVY:0,_knockVZ:0,tumble:0,_tumbleSpeed:0 });
    }
    for (const p of this.players) this._initNeck(p);
    this.ball = { x: -5, y: 3.2, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 };
    this._launch(0, true); return this;
  }
  start(options={}) { if(options.equippedAbility||options.loadout)this.setPlayerLoadout(0,options.loadout||{ability:options.equippedAbility});this.paused = false; this.phase = 'serve'; this.score = [0, 0]; this.rally = this.hits = this.rallyHits = 0; this.server = 0; this.timer = 0;this.celebrationRemaining=0; this.message = 'CLICK TO TOSS'; this.lastHitter = this.lastTeam = null; this._place(); this._newRound(); this._hold(); return this; }
  setPlayerLoadout(id,loadout={}) {
    const p=this.players.find(q=>q.id===Number(id));if(!p)return false;
    if(ABILITIES.some(a=>a.id===loadout.ability)){p.equippedAbility=loadout.ability;p._matchAbility=loadout.ability;if(p.id===0)this.equippedAbility=loadout.ability;}
    if(loadout.skin!==undefined)p.skin=loadout.skin;
    return true;
  }
  setNetworkInputs(map=null) {
    this.networkInputs=map?Object.fromEntries(this.players.map(p=>[p.id,{...(map[p.id]||EMPTY_INPUT)}])):null;
  }
  _inputForPlayer(p,local=EMPTY_INPUT) {
    const source=this.networkInputs?(this.networkInputs[p.id]||EMPTY_INPUT):(p.id===0?local:EMPTY_INPUT);
    if(this._allowEdges&&p.id!==this._serveClickPlayer)return source;
    const input={...source};for(const key of ACTION_KEYS)if(!this._allowEdges||key==='swing'||key==='smash')input[key]=false;return input;
  }
  togglePause() { this.paused = !this.paused; if (this.paused) this.clearBufferedInput(); return this.paused; }
  clearBufferedInput() {
    for (const player of this.players) player._jumpBuffer = player._dashBuffer = player._swingBuffer = player._setBuffer = player._jumpSetBuffer = 0;
    if(this.networkInputs)for(const input of Object.values(this.networkInputs))for(const key of ACTION_KEYS)input[key]=false;
  }
  _newRound() {
    this.round=this.rally+1;this.touches=[0,0];this.touchTeam=null;this.lastAction='';this._lastWasBlock=false;
    this.serveStage='ready';this.serveCharge=0;this._serveTime=0;
    for(const p of this.players){
      const chosen=p.human?(p.equippedAbility||this.equippedAbility):p._matchAbility;
      const choice=ABILITIES.find(a=>a.id===chosen)||ABILITIES[Math.floor(this.random()*ABILITIES.length)];p._matchAbility=choice.id;
      p.ability={...choice,charges:1,cooldown:0,active:0,ready:false};
      p.role=this.mode==='1v1'?'all-rounder':(p.id%2===(this.round-1)%2?'receiver':'striker');
    }
    this.emit('round',{round:this.round,abilities:this.players.map(p=>({player:p.id,id:p.ability.id,name:p.ability.name,x:p.head.x,y:p.head.y,z:p.head.z}))});
  }
  _place() {
    const count = this.mode === '1v1' ? 1 : 2;
    for (const p of this.players) {
      p.x = p.team ? 4.8 : -4.8; p.z = count === 1 ? 0 : ((p.id % count) ? 2 : -2); p.y = p.jump = p._jumpV = 0;
      p.vx = p.vz = 0; p._dash = p._dashCooldown = p._dashBuffer = p._jumpBuffer = p._swingBuffer = p._swingTime = p._swingCooldown = 0; p.swing = 0;
      p.setBounce=p._setBounceTime=p.knockback=p._knockTime=p._knockVX=p._knockVY=p._knockVZ=p.tumble=0;
      p._actionTime=p._actionSerial=p._setBuffer=p._jumpSetBuffer=p._blockTime=p._contactCooldown=p._jumpCooldown=p._dive=p._diveCooldown=p.dive=0;p._lastHitActionSerial=-1;p._contactAction='bump';p.action='';
      this._initNeck(p);
    }
  }
  _initNeck(p) {
    p.neckPoints = Array.from({length:9}, (_,i) => ({x:p.x, y:1.45+p.y+i*1.8/8, z:p.z, vx:0, vy:0, vz:0}));
    p._previousNeck = p.neckPoints.map(q => ({x:q.x, y:q.y, z:q.z}));
    Object.assign(p.head, p.neckPoints[8]);
  }
  _hold() {
    const p = this.players.find(q => q.team === this.server); const n = p.neck;
    Object.assign(this.ball, { x: p.head.x + Math.cos(n.yaw) * 1.15, y: p.head.y + .2, z: p.head.z + Math.sin(n.yaw) * 1.15, vx: 0, vy: 0, vz: 0, spin: 0 });
  }
  _toss() {
    this.serveStage='toss';this._serveTime=0;this.serveCharge=0;this._hold();this.ball.vy=5.5;
    this.message='CLICK TO STRIKE';this.emit('toss',{team:this.server,x:this.ball.x,y:this.ball.y,z:this.ball.z});
  }
  _launch(team, attract = false, power=.55) {
    const p = this.players.find(q => q.team === team); const yaw = p.human && !attract ? p.aimYaw : (team ? Math.PI : 0);
    const pitch = p.human && !attract ? clamp(p.neck.pitch, -.15, .7) : .25;
    power=clamp(Number(power)||0,0,1);const speed=5.2+power*1.8;
    const tossed=!attract&&this.serveStage==='toss';
    Object.assign(this.ball, { x: p.head.x + Math.cos(yaw) * 1.5, y: tossed?Math.max(p.head.y+.3,this.ball.y):p.head.y+.3, z: p.head.z + Math.sin(yaw) * 1.5,
      vx: Math.cos(yaw) * speed, vy: 4.5 + pitch*.7+power*.8, vz: Math.sin(yaw) * speed, spin: 0 });
    this.lastTeam = team; this.lastHitter = p.id; this.touchCooldown = .2;p._contactCooldown=.45;this.rallyHits = 0;this.touches=[0,0];this.touchTeam=null;
    this.serveQuality=clamp(1-Math.abs(power-.82),0,1);this.serveStage='ready';this.lastAction='serve';
    if (!attract) { this.phase = 'play'; this.message = 'PLAY'; this.emit('serve', { team, player:p.id,power,quality:this.serveQuality,x: this.ball.x, y: this.ball.y, z: this.ball.z }); }
  }
  _point(team, reason) {
    if (this.phase === 'attract') { this._place(); this._launch(team, true); return; }
    this.score[team]++; this.rally++; this.server = team; this.phase = 'point'; this.timer = 0; this.message = team ? 'THEIR POINT' : 'YOUR POINT';
    const final=(this.score[team]>=7&&this.score[team]-this.score[1-team]>=2)||this.score[team]>=11;
    const origin=this._blastPlayers(final);
    this.emit('score', { team, score: [...this.score], reason,rallyHits:this.rallyHits,explosion:true,final,...origin });
    if(final){this.phase='finished';this.message=team?'THEY WIN':'YOU WIN';this.emit('win',{team,score:[...this.score],explosion:true,final:true,...origin});}
  }
  _blastPlayers(final=false) {
    const origin={x:clamp(this.ball.x,-9,9),y:Math.max(.5,Math.min(this.ball.y,4)),z:clamp(this.ball.z,-5,5)};
    const duration=final?2.6:1.5;this.celebrationRemaining=duration;
    this.clearBufferedInput();
    for(const p of this.players){
      let dx=p.x-origin.x,dz=p.z-origin.z;const distance=Math.hypot(dx,dz);
      if(distance<.1){dx=Math.cos(p.id*2.4);dz=Math.sin(p.id*2.4);}else{dx/=distance;dz/=distance;}
      const force=(final?12:7)+2/(1+distance*.2);
      // Give the whole articulated giraffe a clear upward launch. The rig follows
      // this shared velocity and tumble state for both local and remote snapshots.
      p._knockVX=dx*force;p._knockVZ=dz*force;p._knockVY=final?14:10;p._knockTime=duration;p.knockback=1;
      p._tumbleSpeed=(p.id%2?-1:1)*(final?8:5);p.tumble=0;p._dive=p.dive=p._setBounceTime=p.setBounce=0;p.action='knockback';
    }
    return origin;
  }
  _stepCelebration(dt) {
    this.celebrationRemaining=Math.max(0,this.celebrationRemaining-dt);
    for(const p of this.players){
      if(p._knockTime<=0)continue;
      p._knockTime=Math.max(0,p._knockTime-dt);p.knockback=Math.min(1,p._knockTime/.45);
      const drag=Math.exp(-1.65*dt);p._knockVX*=drag;p._knockVZ*=drag;p._knockVY-=18*dt;
      p.x=clamp(p.x+p._knockVX*dt,-23,23);p.z=clamp(p.z+p._knockVZ*dt,-18,18);p.y=Math.max(0,p.y+p._knockVY*dt);
      if(p.y===0&&p._knockVY<0)p._knockVY=-p._knockVY*.12;
      p.vx=p._knockVX;p.vz=p._knockVZ;p.jump=p.y;p.tumble+=p._tumbleSpeed*dt;p._tumbleSpeed*=Math.exp(-dt*.8);
      this._stepNeck(p,dt);
    }
  }
  advanceCelebration(dt) {
    if(this.celebrationRemaining<=0||!['point','finished'].includes(this.phase))return;
    dt=clamp(Number(dt)||0,0,.1);const steps=Math.max(1,Math.ceil(dt*120));
    if(dt>0)for(let i=0;i<steps;i++)this._stepCelebration(dt/steps);
  }
  _predict(height = 3.2) {
    const b = this.ball, disc = Math.max(0, b.vy*b.vy + 2*G*(b.y-height));
    const t = clamp((b.vy + Math.sqrt(disc)) / G, .02, 1.8);
    return { x: b.x + b.vx*t, z: b.z + b.vz*t, t };
  }
  _swing(p,action=p.y>.15||p._jumpV>0?'spike':'bump') {
    if (p._swingCooldown > 0) return;
    if(!p.human||this.phase==='attract')p._shotYaw=(this.random()-.5)*(.75+Math.min(.35,this.rallyHits*.02));
    p._swingTime = .5; p._swingCooldown = .48;p._actionTime=.6;p._actionSerial++;p._contactAction=action;p.action=action;
    if(action==='set')p._setBounceTime=.58;
    if(action==='block')p._blockTime=.68;
    const event={action,player:p.id,team:p.team,x:p.head.x,y:p.head.y,z:p.head.z};
    this.emit('action',event);if(action==='bump'||action==='spike')this.emit('smash',event);
  }
  _divePlayer(p,dx=0,dz=0) {
    if(p._diveCooldown>0||p.y>.4)return false;
    const len=Math.hypot(dx,dz);p._diveX=len>.1?dx/len:Math.cos(p.aimYaw);p._diveZ=len>.1?dz/len:Math.sin(p.aimYaw);
    p._dive=DIVE_DURATION;p._diveCooldown=1.35;p._actionTime=.8;p._actionSerial++;p._contactAction='dive';p.action='dive';
    this.emit('dive',{action:'dive',player:p.id,team:p.team,x:p.x,y:p.head.y,z:p.z});return true;
  }
  _useAbility(p,dx=0,dz=0) {
    const a=p.ability;if(!a||a.charges<=0||a.cooldown>0||this.phase!=='play')return false;
    a.charges--;a.cooldown=ABILITIES.find(q=>q.id===a.id).cooldown;a.active=a.duration;a.ready=false;
    if(a.id==='spring'){p._jumpV=Math.max(p._jumpV,10.4);this.emit('jump',{player:p.id,x:p.x,y:p.y,z:p.z,ability:a.id});}
    if(a.id==='rocket'){p._diveCooldown=0;this._divePlayer(p,dx,dz);p._dash=.45;const d=Math.hypot(dx,dz);p._dashX=d>.1?dx/d:Math.cos(p.aimYaw);p._dashZ=d>.1?dz/d:Math.sin(p.aimYaw);}
    if(a.id==='shield'){p._blockTime=a.duration;p._contactAction='block';p._actionTime=a.duration;p._actionSerial++;}
    this.emit('ability',{ability:a.id,name:a.name,color:a.color,player:p.id,team:p.team,x:p.head.x,y:p.head.y,z:p.head.z});return true;
  }
  _registerTouch(p,action) {
    if(this.touchTeam!==p.team){this.touches=[0,0];this.touchTeam=p.team;this._lastWasBlock=false;}
    if(action==='block'){this._lastWasBlock=true;return true;}
    if(this.touches[p.team]>=3){this._point(1-p.team,'four touches');return false;}
    if(this.mode==='2v2'&&this.lastHitter===p.id&&this.touches[p.team]>0&&!this._lastWasBlock){this._point(1-p.team,'double touch');return false;}
    this.touches[p.team]++;this._lastWasBlock=false;return true;
  }
  _shapeShot(p,action) {
    const b=this.ball,forward=p.team?-1:1,aim=p.aimYaw,facesCourt=Math.cos(aim)*forward>.1;
    if(action==='set'){
      const mate=this.players.find(q=>q.team===p.team&&q.id!==p.id);
      const targetX=clamp(mate?mate.x+forward*.8:p.x+forward*.65,p.team?1.1:-8.2,p.team?8.2:-1.1);
      const targetZ=clamp(mate?mate.z:p.z+Math.sin(aim)*.6,-4,4),flight=1.15;
      b.vx=(targetX-b.x)/flight;b.vz=(targetZ-b.z)/flight;b.vy=(3.5-b.y+.5*G*flight*flight)/flight;
    }else if(action==='spike'&&facesCourt){
      const targetX=forward*(4.8+p.shotPower),distance=Math.abs(targetX-b.x),flight=clamp(distance/(7.1+p.shotPower),.65,1.5);
      b.vx=(targetX-b.x)/flight;b.vz=(clamp(b.z+Math.sin(aim)*3,-3.8,3.8)-b.z)/flight;
      b.vy=(BALL_R-b.y+.5*G*flight*flight)/flight;
    }else if(action==='block'){
      b.vx=forward*5.5;b.vz=clamp(b.vz*.3,-2,2);b.vy=Math.max(1.5,Math.min(3.8,b.vy*.35));
    }else if(action==='dive'&&facesCourt){
      b.vy=Math.max(b.vy,7.6);b.vx=forward*Math.max(3.8,Math.min(6.5,Math.abs(b.vx)));
    }
    const ability=p.ability?.active>0?p.ability.id:null;
    if(ability==='feather'){b.vx*=.86;b.vz*=.7;b.vy=Math.max(8,b.vy);p.ability.active=0;}
    if(ability==='magnet')p.ability.active=0;
    return ability;
  }
  _guideReturn(p,action,assisted) {
    if(!p.human||!assisted||action==='set')return;
    const b=this.ball,flight=(b.vy+Math.sqrt(b.vy*b.vy+2*G*Math.max(0,b.y-BALL_R)))/G;
    if(flight<.15)return;
    const projectedX=b.x+b.vx*flight,projectedZ=b.z+b.vz*flight;
    const targetX=clamp(projectedX,p.team?-7.6:1.1,p.team?-1.1:7.6),targetZ=clamp(projectedZ,-4.1,4.1);
    b.vx+=((targetX-b.x)/flight-b.vx)*.88;b.vz+=((targetZ-b.z)/flight-b.vz)*.88;
  }
  _stepPlayers(dt, frameInput) {
    const b = this.ball, pred = this._predict(), skill = SKILL[this.difficulty], count = this.mode === '1v1' ? 1 : 2;
    for (const p of this.players) {
      const human = p.human && this.phase !== 'attract',input=this._inputForPlayer(p,frameInput);let dx = 0, dz = 0;
      p.energy = clamp(p.energy + dt*.13, 0, 1); p._dash = Math.max(0,p._dash-dt); p._swingCooldown = Math.max(0,p._swingCooldown-dt);
      p._dashCooldown = Math.max(0,p._dashCooldown-dt);
      p._jumpBuffer = Math.max(0,p._jumpBuffer-dt); p._dashBuffer = Math.max(0,p._dashBuffer-dt); p._swingBuffer = Math.max(0,p._swingBuffer-dt);
      for(const key of ['_setBuffer','_jumpSetBuffer','_actionTime','_blockTime','_contactCooldown','_jumpCooldown','_dive','_diveCooldown','_setBounceTime'])p[key]=Math.max(0,p[key]-dt);
      p.setBounce=p._setBounceTime>0?Math.sin(Math.PI*(1-p._setBounceTime/.58)):0;
      if(p.ability){p.ability.active=Math.max(0,p.ability.active-dt);p.ability.cooldown=Math.max(0,p.ability.cooldown-dt);p.ability.ready=this.phase==='play'&&p.ability.charges>0&&p.ability.cooldown===0;}
      if (human) {
        dx = clamp(Number(input.x)||0,-1,1); dz = clamp(Number(input.z)||0,-1,1);
        const neckYaw = Number.isFinite(input.neckYaw) ? input.neckYaw : input.lookYaw;
        const neckPitch = Number.isFinite(input.neckPitch) ? input.neckPitch : input.lookPitch;
        if (Number.isFinite(neckYaw)) p.neck.yaw = neckYaw;
        if (Number.isFinite(neckPitch)) p.neck.pitch = clamp(neckPitch,-1.22,1.35);
        if (Number.isFinite(input.extension)) p.neck.extension = clamp(input.extension,0,1);
        p.aimYaw=Number.isFinite(input.aimYaw)?input.aimYaw:p.neck.yaw;
        if(Number.isFinite(input.power))p.shotPower=clamp(input.power,0,1);
        // Short buffers forgive a press just before landing or an ability recovering.
        if (input.jump) p._jumpBuffer = .12;
        if (input.dash) p._dashBuffer = .12;
        if ((input.swing || input.smash)&&this.phase!=='serve') p._swingBuffer = .16;
        if(input.set)p._setBuffer=.16;
        if(input.jumpSet){p._jumpSetBuffer=.2;p._jumpBuffer=.12;}
        if(input.dive&&this.phase==='play')this._divePlayer(p,dx,dz);
        if(input.ability)this._useAbility(p,dx,dz);
        if (p._jumpBuffer > 0 && p.y === 0) { p._jumpBuffer = 0; p._jumpV = p.ability?.id==='spring'&&p.ability.active>0?10.4:7.8; this.emit('jump',{player:p.id,x:p.x,z:p.z}); }
        if (p._dashBuffer > 0 && p.energy >= .28 && p._dashCooldown === 0) {
          const direction = Math.hypot(dx,dz);
          p._dashX = direction > .1 ? dx/direction : Math.cos(p.neck.yaw);
          p._dashZ = direction > .1 ? dz/direction : Math.sin(p.neck.yaw);
          p._dashBuffer = 0; p.energy -= .28; p._dash = .3; p._dashCooldown = .55;
          this.emit('dash',{player:p.id,x:p.x,z:p.z});
        }
        if(p._jumpSetBuffer>0&&p._swingCooldown===0){p._jumpSetBuffer=0;this._swing(p,'set');}
        else if(p._setBuffer>0&&p._swingCooldown===0){p._setBuffer=0;this._swing(p,p.y>.15?'block':'set');}
        else if (p._swingBuffer > 0 && p._swingCooldown === 0) {
          p._swingBuffer=0;
          this._swing(p);
        }
      } else {
        p._reaction -= dt;
        if (p._reaction <= 0) {
          p._reaction = skill.reaction * (.8+this.random()*.4);
          const own = pred.x*(p.team ? 1 : -1) > -.3;
          const mates = this.players.filter(q => q.team === p.team && !(count>1&&this.touchTeam===p.team&&this.lastHitter===q.id&&this.touches[p.team]>0) && (!q.human || this.phase === 'attract' || Math.hypot(q.x-pred.x,q.z-pred.z)<3));
          const nearest = mates.reduce((a,q) => Math.hypot(q.x-pred.x,q.z-pred.z)<Math.hypot(a.x-pred.x,a.z-pred.z)?q:a,mates[0]);
          if (own && nearest === p) {
            // Approach from the back of the ball so the contact normal sends it across the net.
            p._tx = pred.x - (p.team ? -1 : 1)*1.5 + (this.random()-.5)*skill.error;
            p._tz = pred.z + (this.random()-.5)*skill.error;
          } else { p._tx = (p.team ? 1 : -1)*4.3; p._tz = count===1 ? 0 : (p.id%count ? 2 : -2); }
        }
        dx=p._tx-p.x; dz=p._tz-p.z; const len=Math.hypot(dx,dz);
        // Ease into the receive position instead of repeatedly braking at full speed.
        if(len>.08){const arrival=Math.min(1,len/.7);dx=dx/len*arrival;dz=dz/len*arrival;}else{dx=dz=0;}
        p.neck.yaw = (p.team ? Math.PI : 0)+(p._swingTime>0?p._shotYaw:0);p.aimYaw=p.neck.yaw;p.neck.pitch = p._blockTime>0?.25:-.3; p.neck.extension = p._blockTime>0?.6:0;
        const d=Math.hypot(b.x-p.head.x,b.z-p.head.z);
        const live=this.phase==='play'||this.phase==='attract',eligible=this.mode==='1v1'||this.touchTeam!==p.team||this.lastHitter!==p.id||this._lastWasBlock;
        if(live&&eligible&&d<2.1&&b.y>p.head.y-.5&&b.y<p.head.y+1.8&&b.vy<2&&p._swingCooldown<=0){
          const teamTouches=this.touchTeam===p.team?this.touches[p.team]:0;
          const canSet=count>1&&teamTouches<2&&this.random()<(p.role==='receiver'?.32:.12)*(this.rallyHits>12?.35:1);
          this._swing(p,canSet?'set':(p.y>.15?'spike':'bump'));
        }
        if(live&&eligible&&p.y===0&&p._jumpCooldown===0&&d<1.8&&b.y>4.2&&b.y<5.8&&b.vy<-.5){p._jumpV=7.8;p._jumpCooldown=1.1;this.emit('jump',{player:p.id,x:p.x,z:p.z});}
        if(live&&eligible&&b.y<2.5&&b.vy<0&&d<3.4&&d>1.2)this._divePlayer(p,b.x-p.x,b.z-p.z);
        if(live&&eligible&&p.ability?.ready){const id=p.ability.id;const useful=id==='spring'?b.y>4.2&&d<3:id==='rocket'?d>2.5&&d<5&&b.y<4:id==='shield'?Math.abs(p.x)<3&&d<3:d<2.3;if(useful)this._useAbility(p,dx,dz);}
      }
      if (!human && (this.phase === 'serve' || this.phase === 'point')) { dx = 0; dz = 0; }
      let len=Math.hypot(dx,dz); if(len>1){dx/=len;dz/=len;}
      const speed=(human?5.5:skill.speed)*(p.ability?.id==='rocket'&&p.ability.active>0?1.25:1);
      const dashProgress = p._dash > 0 ? (1-p._dash/.3) : 1;
      const dashEnvelope = p._dash > 0 ? Math.sin(Math.PI*Math.min(1,dashProgress+.06)) : 0;
      // The dash has a committed direction and a rounded acceleration/recovery curve.
      const dashWeight = p._dash > 0 ? .8*dashEnvelope : 0;
      let targetX = dx*speed*(1-dashWeight) + p._dashX*10.8*dashWeight;
      let targetZ = dz*speed*(1-dashWeight) + p._dashZ*10.8*dashWeight;
      p.dive=p._dive>0?Math.sin(Math.PI*(1-p._dive/DIVE_DURATION)):0;
      if(p._dive>0){const diveSpeed=(p.ability?.id==='rocket'&&p.ability.active>0?12.5:9)*(0.4+.6*p._dive/DIVE_DURATION);targetX=p._diveX*diveSpeed;targetZ=p._diveZ*diveSpeed;}
      // Acceleration and drag make direction changes gradual; air steering is weaker.
      const response = p._dive>0?30:p._dash > 0 ? 25 : (p.y > .01 ? 5 : (dx || dz ? 16 : 12));
      const blend = 1 - Math.exp(-response * dt);
      p.vx += (targetX-p.vx)*blend; p.vz += (targetZ-p.vz)*blend;
      const minX=p.team?.7:-8.6, maxX=p.team?8.6:-.7;
      p.x=clamp(p.x+p.vx*dt,minX,maxX);p.z=clamp(p.z+p.vz*dt,-4.6,4.6);
      if ((p.x<=minX&&p.vx<0)||(p.x>=maxX&&p.vx>0)) p.vx=0;
      if ((p.z<=-4.6&&p.vz<0)||(p.z>=4.6&&p.vz>0)) p.vz=0;
      if (Math.abs(dx)>.1) p.heading=dx>0?1:-1;
      if(p.y>0||p._jumpV>0){p._jumpV-=18*dt;p.y+=p._jumpV*dt;if(p.y<=0){p.y=0;p._jumpV=0;}}p.jump=p.y;
      p._swingTime=Math.max(0,p._swingTime-dt); p.swing=p._swingTime>0?Math.sin(Math.PI*(1-p._swingTime/.5)):0;
      p.action=p._dive>0?'dive':p._actionTime>0?p._contactAction:(p.y>0?'jump':(p._dash?'dash':''));
      this._stepNeck(p, dt);

    }
  }
  _stepNeck(p, dt) {
    const human=p.human&&this.phase!=='attract';
    const n=p.neck, points=p.neckPoints, length=(human?2.1+n.extension*1.6:1.8+n.extension*1.2)+(p._blockTime>0?.35:0), segment=length/8;
    const setting=p._contactAction==='set'&&p._actionTime>0;
    const reach=Math.min(length*(human?.94:.82), (human?1.05:.75) + p.swing*(setting?.55:human?2.25:1) + Math.abs(n.pitch)*.3+p.dive*.9);
    const yaw=n.yaw, vertical=(Math.sqrt(length*length-reach*reach) + Math.sin(n.pitch)*(human?1:.8))*(1-p.dive*.65)+p.setBounce*.35;
    const base={x:p.x+p._diveX*p.dive*.3,y:1.45+p.y-p.dive*1.1,z:p.z+p._diveZ*p.dive*.3};
    const target={x:base.x+Math.cos(yaw)*reach,y:base.y+vertical,z:base.z+Math.sin(yaw)*reach};
    Object.assign(points[0],base);
    const previous=p._previousNeck;
    for(let i=1;i<9;i++){const q=points[i],old=previous[i];old.x=q.x;old.y=q.y;old.z=q.z;}
    for(let i=1;i<9;i++) {
      const q=points[i], t=i/8;
      // Every joint has inertia. Lower damping leaves a pronounced visible whip.
      const tx=base.x+(target.x-base.x)*t*t, ty=base.y+(target.y-base.y)*t, tz=base.z+(target.z-base.z)*t*t;
      const stiffness= human ? (i===8 ? 42 : 28) : 85;
      const damping=human ? 2.7 : 10;
      q.vx+=(stiffness*(tx-q.x)-damping*q.vx)*dt;
      q.vy+=(stiffness*(ty-q.y)-damping*q.vy)*dt;
      q.vz+=(stiffness*(tz-q.z)-damping*q.vz)*dt;
      q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;
    }
    // Project distance constraints; the fixed shoulder anchors the physical chain.
    for(let iteration=0;iteration<12;iteration++) {
      for(let i=1;i<9;i++) {
        const a=points[i-1], b=points[i], dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z, dist=Math.hypot(dx,dy,dz)||1e-8;
        const desired=clamp(dist,segment*.72,segment), correction=(dist-desired)/dist;
        const wa=i===1?0:.5, wb=i===1?1:.5;
        a.x+=dx*correction*wa;a.y+=dy*correction*wa;a.z+=dz*correction*wa;
        b.x-=dx*correction*wb;b.y-=dy*correction*wb;b.z-=dz*correction*wb;
      }
    }
    for(let i=1;i<9;i++) { const q=points[i], old=previous[i]; q.vx=clamp((q.x-old.x)/dt,-28,28);q.vy=clamp((q.y-old.y)/dt,-28,28);q.vz=clamp((q.z-old.z)/dt,-28,28); }
    Object.assign(p.head,points[8]);
  }
  _ballStep(dt) {
    const b=this.ball, oldX=b.x, oldY=b.y, oldZ=b.z; b.vy-=G*dt;
    const drag=Math.exp(-.018*dt);b.vx*=drag;b.vy*=drag;b.vz*=drag;
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.spin*=Math.exp(-.35*dt);
    const netSide=oldX<0?-1:1, netSurface=netSide*BALL_R;
    const towardNet=(b.x-oldX)*netSide<0;
    const crossedNet=towardNet && ((oldX-netSurface)*netSide>=0 && (b.x-netSurface)*netSide<=0 || Math.abs(oldX)<BALL_R);
    const crossedCenter=oldX*b.x<=0;
    if((crossedNet||crossedCenter) && !this.netCooldown){
      const t=clamp((netSurface-oldX)/(b.x-oldX||1e-8),0,1);
      const y=oldY+(b.y-oldY)*t,z=oldZ+(b.z-oldZ)*t;
      if(Math.abs(z)<5+BALL_R && y-BALL_R<2.35 && y+BALL_R>0){
        b.vx*=-.32;b.vy*=.8;b.x=netSurface+b.vx*dt*(1-t);
        this.netCooldown=.08;this.emit('net',{x:0,y,z});
      }
    }
    const floorTime=b.y<=BALL_R?clamp((oldY-BALL_R)/(oldY-b.y||1e-8),0,1):1;
    if(this.touchCooldown<=0)for(const p of this.players){
      if(p._contactCooldown>0)continue;
      // A generous hitbox must not turn one continuous body overlap into a fault.
      // Repeated 2v2 contacts count only after a fresh deliberate action.
      if(this.mode==='2v2'&&this.lastHitter===p.id&&this.touchTeam===p.team&&this.touches[p.team]>0&&!this._lastWasBlock&&
        (p._actionSerial===p._lastHitActionSerial||p._actionTime<=0))continue;
      const h=p.head, human=p.human&&this.phase!=='attract';
      const physicalRadius=BALL_R+HEAD_R, forgiveness=human ? (p._actionTime>0?.5:.4) : 0;
      const action=p._dive>0?'dive':p._blockTime>0?'block':p._actionTime>0?p._contactAction:'bump';
      const abilityReach=p.ability?.active>0?(p.ability.id==='magnet'?.65:p.ability.id==='shield'?.55:0):0;
      const min=physicalRadius+forgiveness+abilityReach+(action==='dive'?.4:action==='block'?.3:0);
      // Sweep the ball against the moving head so a fast whip cannot tunnel through it.
      const sx=oldX-(h.x-h.vx*dt),sy=oldY-(h.y-h.vy*dt),sz=oldZ-(h.z-h.vz*dt);
      const ex=b.x-h.x,ey=b.y-h.y,ez=b.z-h.z;
      const mx=ex-sx,my=ey-sy,mz=ez-sz;
      const aa=mx*mx+my*my+mz*mz,bb=2*(sx*mx+sy*my+sz*mz),cc=sx*sx+sy*sy+sz*sz-min*min;
      let t=0;
      if(cc>0){
        const discriminant=bb*bb-4*aa*cc;
        if(aa<1e-12||discriminant<0)continue;
        t=(-bb-Math.sqrt(discriminant))/(2*aa);
        if(t<0||t>floorTime)continue;
      }
      const dx=sx+mx*t,dy=sy+my*t,dz=sz+mz*t,d=Math.hypot(dx,dy,dz);
      if(d<.0001)continue;
      const nx=dx/d,ny=dy/d,nz=dz/d, relative=(b.vx-h.vx)*nx+(b.vy-h.vy)*ny+(b.vz-h.vz)*nz;
      if(relative>=0)continue;
      if(!this._registerTouch(p,action))return;
      // A padded volleyball absorbs most whip speed instead of becoming a cannonball.
      const paddedRelative=(b.vx-h.vx*.38)*nx+(b.vy-h.vy*.38)*ny+(b.vz-h.vz*.38)*nz;
      const impulse=Math.max(0,-(1+.42)*paddedRelative);
      b.vx+=impulse*nx;b.vy+=impulse*ny;b.vz+=impulse*nz;
      b.x=h.x+nx*(min+.01);b.y=h.y+ny*(min+.01);b.z=h.z+nz*(min+.01);
      const forward=p.team?-1:1;
      const forwardFace=Math.cos(p.aimYaw)*forward>.15;
      // Help front/top receives clear the tape. Back-of-head shots retain their direction.
      const assisted=forwardFace && nx*forward>-.08 && (b.vx*forward>-.7 || ny>.35);
      if(assisted){
        const distance=Math.abs(forward*4.8-b.x),flight=1.2+distance*.045;
        const targetX=(forward*4.8-b.x)/flight;
        const targetZ=(clamp(b.z+Math.sin(p.aimYaw)*2,-2.8,2.8)-b.z)/flight;
        const targetY=(BALL_R-b.y+.5*G*flight*flight)/flight;
        const correction=human?.68:.2;
        b.vx+=(targetX-b.vx)*correction;b.vz+=(targetZ-b.vz)*correction;
        b.vy=Math.max(b.vy,clamp(targetY,5.8,8.4)*(human?1:.79));
        const airtime=(b.vy+Math.sqrt(b.vy*b.vy+2*G*Math.max(0,b.y-BALL_R)))/G;
        const minimumForward=(Math.abs(b.x)+1.5)/airtime;
        b.vx=forward*Math.max(b.vx*forward,Math.min(7,minimumForward));
      }
      const ability=this._shapeShot(p,action);
      const speed=Math.hypot(b.vx,b.vy,b.vz);
      if(speed>MAX_BALL_SPEED){const scale=MAX_BALL_SPEED/speed;b.vx*=scale;b.vy*=scale;b.vz*=scale;}
      this._guideReturn(p,action,assisted);
      const guidedSpeed=Math.hypot(b.vx,b.vy,b.vz);if(guidedSpeed>MAX_BALL_SPEED){const scale=MAX_BALL_SPEED/guidedSpeed;b.vx*=scale;b.vy*=scale;b.vz*=scale;}
      b.spin=clamp((h.vz-b.vz)*nx-(h.vx-b.vx)*nz,-15,15);
      this.lastTeam=p.team;this.lastHitter=p.id;this.touchCooldown=.08;p._contactCooldown=.36;p._lastHitActionSerial=p._actionSerial;this.hits++;this.rallyHits++;this.lastAction=action;
      const tip=p.neckPoints[8],recoil=Math.min(2.5,impulse*.09);tip.vx-=nx*recoil;tip.vy-=ny*recoil;tip.vz-=nz*recoil;
      this.emit('hit',{player:p.id,team:p.team,action,ability,touches:[...this.touches],x:b.x,y:b.y,z:b.z,power:clamp(.18+impulse/18,0,1),incomingSpeed:-relative,impact:impulse,rallyHits:this.rallyHits,assisted,softContact:d>physicalRadius,outgoingSpeed:Math.hypot(b.vx,b.vy,b.vz),normal:{x:nx,y:ny,z:nz},velocity:{x:b.vx,y:b.vy,z:b.vz}});break;
    }
    if(b.y<=BALL_R){const out=Math.abs(b.x)>9 || Math.abs(b.z)>5;const side=b.x<0?0:1;this._point(out?(this.lastTeam===null?1-side:1-this.lastTeam):1-side,out?'out':'floor');return;}
    if(Math.abs(b.x)>13||Math.abs(b.z)>9||b.y>22){this._point(this.lastTeam===null?0:1-this.lastTeam,'out');}
  }
  update(dt,input={}) {
    if(this.paused)return;dt=clamp(Number(dt)||0,0,.05);if(!dt)return;
    if(this.phase==='finished'){this.advanceCelebration(dt);return;}
    if(input.players||Object.keys(input).some(key=>/^\d+$/.test(key))){this.setNetworkInputs(input.players||input);input=EMPTY_INPUT;}
    this._allowEdges=true;this._serveClickPlayer=null;
    this.timer+=dt;
    let serveClick=false;
    if(this.phase==='serve'){
      const server=this.players.find(p=>p.team===this.server),serveInput=this._inputForPlayer(server,input);
      if(server.human){if(Number.isFinite(serveInput.aimYaw))server.aimYaw=serveInput.aimYaw;else if(Number.isFinite(serveInput.neckYaw))server.aimYaw=serveInput.neckYaw;}
      serveClick=server.human&&!!(serveInput.serve||serveInput.toss||serveInput.swing||serveInput.smash);
      if(serveClick){
        this._serveClickPlayer=server.id;
        if(this.serveStage==='ready')this._toss();
        else this._launch(this.server,false,Number.isFinite(serveInput.power)?serveInput.power:Number.isFinite(serveInput.charge)?serveInput.charge:this.serveCharge);
      }else if(!server.human&&this.serveStage==='ready'&&this.timer>.65)this._toss();
    }
    const steps=Math.max(1,Math.ceil(dt/(1/120))), step=dt/steps;
    for(let i=0;i<steps;i++){
      if(this.paused||this.phase==='finished')break;
      this._allowEdges=i===0;
      if(this.phase==='point'){this._stepCelebration(step);continue;}
      this.touchCooldown=Math.max(0,this.touchCooldown-step);this.netCooldown=Math.max(0,this.netCooldown-step);
      this._stepPlayers(step,input);
      if(this.phase==='point')continue;
      if(this.phase==='serve'){
        if(this.serveStage==='ready')this._hold();
        else{
          this._serveTime+=step;this.serveCharge=.5+.5*Math.sin(this._serveTime*4-Math.PI/2);
          this.ball.vy-=G*step;this.ball.y+=this.ball.vy*step;
          const server=this.players.find(p=>p.team===this.server);
          if(server.human?(this._serveTime>1.55||this.ball.y<server.head.y-.25):this._serveTime>.72)this._launch(this.server,false,server.human?.35:.55+this.random()*.25);
        }
        continue;
      }
      if(this.phase==='play'||this.phase==='attract')this._ballStep(step);
    }
    if(this.phase==='point'&&this.timer>1.75){this.phase='serve';this.timer=0;this._place();this._newRound();this.message=this.server?'THEIR SERVE':'CLICK TO TOSS';this._hold();}
    this._allowEdges=true;this._serveClickPlayer=null;
    if(this.networkInputs)for(const value of Object.values(this.networkInputs))for(const key of ACTION_KEYS)value[key]=false;
  }
}














