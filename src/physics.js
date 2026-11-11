const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const G = 18;
const BALL_R = .23;
const HEAD_R = .68;
const SKILL = {
  chill: { speed: 5.0, reaction: .25, error: .45 },
  club: { speed: 5.1, reaction: .18, error: .30 },
  spicy: { speed: 5.7, reaction: .10, error: .12 },
};
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export class VolleyballGame {
  constructor({ mode = '2v2', difficulty = 'club', onEvent = () => {} } = {}) {
    this.onEvent = onEvent; this.mode = mode; this.difficulty = difficulty; this.seed = 72931;
    this.reset({ mode, difficulty });
  }
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  emit(type, data = {}) { this.onEvent({ type, ...data }); }
  get state() { return this; }
  reset({ mode = this.mode, difficulty = this.difficulty } = {}) {
    this.mode = mode === '1v1' ? '1v1' : '2v2'; this.difficulty = SKILL[difficulty] ? difficulty : 'club';
    this.paused = false; this.phase = 'attract'; this.score = [0, 0]; this.rally = 0; this.hits = 0; this.rallyHits = 0;
    this.server = 0; this.timer = 0; this.message = 'READY'; this.lastTeam = null; this.lastHitter = null; this.touchCooldown = 0; this.netCooldown = 0;
    const count = this.mode === '1v1' ? 1 : 2; this.players = [];
    for (let team = 0; team < 2; team++) for (let i = 0; i < count; i++) {
      const x = team ? 4.8 : -4.8, z = count === 1 ? 0 : (i ? 2 : -2), yaw = team ? Math.PI : 0;
      this.players.push({ id: team * count + i, team, human: !team && !i, x, z, y: 0, vx: 0, vz: 0, heading: team ? -1 : 1, jump: 0, action: '', energy: 1,
        bodyYaw: yaw, neckPoints: [], head: { x, y: 3.2, z, vx: 0, vy: 0, vz: 0 }, neck: { yaw, pitch: team === 0 && i === 0 ? -.12 : .1, extension: .35 }, swing: 0,
        _jumpV: 0, _jumpBuffer: 0, _dash: 0, _dashCooldown: 0, _dashBuffer: 0, _dashX: 0, _dashZ: 0,
        _swingTime: 0, _swingCooldown: 0, _swingBuffer: 0, _reaction: 0, _tx: x, _tz: z });
    }
    for (const p of this.players) this._initNeck(p);
    this.ball = { x: -5, y: 3.2, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 };
    this._launch(0, true); return this;
  }
  start() { this.paused = false; this.phase = 'serve'; this.score = [0, 0]; this.rally = this.hits = this.rallyHits = 0; this.server = 0; this.timer = 0; this.message = 'YOUR SERVE'; this.lastHitter = this.lastTeam = null; this._place(); this._hold(); return this; }
  togglePause() { this.paused = !this.paused; if (this.paused) this.clearBufferedInput(); return this.paused; }
  clearBufferedInput() {
    for (const player of this.players) player._jumpBuffer = player._dashBuffer = player._swingBuffer = 0;
  }
  _place() {
    const count = this.mode === '1v1' ? 1 : 2;
    for (const p of this.players) {
      p.x = p.team ? 4.8 : -4.8; p.z = count === 1 ? 0 : ((p.id % count) ? 2 : -2); p.y = p.jump = p._jumpV = 0;
      p.vx = p.vz = 0; p._dash = p._dashCooldown = p._dashBuffer = p._jumpBuffer = p._swingBuffer = p._swingTime = p._swingCooldown = 0; p.swing = 0;
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
  _launch(team, attract = false) {
    const p = this.players.find(q => q.team === team); const yaw = p.human && team === 0 && !attract ? p.neck.yaw : (team ? Math.PI : 0);
    const pitch = p.human && team === 0 && !attract ? clamp(p.neck.pitch, -.15, .7) : .25;
    Object.assign(this.ball, { x: p.head.x + Math.cos(yaw) * 1.2, y: p.head.y + .3, z: p.head.z + Math.sin(yaw) * 1.2,
      vx: Math.cos(yaw) * 8.5, vy: 6.4 + pitch * 2, vz: Math.sin(yaw) * 8.5, spin: 0 });
    this.lastTeam = team; this.lastHitter = p.id; this.touchCooldown = .3; this.rallyHits = 0;
    if (!attract) { this.phase = 'play'; this.message = 'PLAY'; this.emit('serve', { team, x: this.ball.x, y: this.ball.y, z: this.ball.z }); }
  }
  _point(team, reason) {
    if (this.phase === 'attract') { this._place(); this._launch(team, true); return; }
    this.score[team]++; this.rally++; this.server = team; this.phase = 'point'; this.timer = 0; this.message = team ? 'THEIR POINT' : 'YOUR POINT';
    this.emit('score', { team, score: [...this.score], reason });
    if ((this.score[team] >= 7 && this.score[team] - this.score[1-team] >= 2) || this.score[team] >= 11) { this.phase = 'finished'; this.message = team ? 'THEY WIN' : 'YOU WIN'; this.emit('win', { team, score: [...this.score] }); }
  }
  _predict(height = 3.2) {
    const b = this.ball, disc = Math.max(0, b.vy*b.vy + 2*G*(b.y-height));
    const t = clamp((b.vy + Math.sqrt(disc)) / G, .02, 1.35);
    return { x: b.x + b.vx*t, z: b.z + b.vz*t, t };
  }
  _swing(p) {
    if (p._swingCooldown > 0) return;
    p._swingTime = .5; p._swingCooldown = .75; p.action = 'smash';
    this.emit('smash', { player: p.id, team: p.team, x: p.head.x, y: p.head.y, z: p.head.z });
  }
  _stepPlayers(dt, input) {
    const b = this.ball, pred = this._predict(), skill = SKILL[this.difficulty], count = this.mode === '1v1' ? 1 : 2;
    for (const p of this.players) {
      const human = p.human && this.phase !== 'attract'; let dx = 0, dz = 0;
      p.energy = clamp(p.energy + dt*.13, 0, 1); p._dash = Math.max(0,p._dash-dt); p._swingCooldown = Math.max(0,p._swingCooldown-dt);
      p._dashCooldown = Math.max(0,p._dashCooldown-dt);
      p._jumpBuffer = Math.max(0,p._jumpBuffer-dt); p._dashBuffer = Math.max(0,p._dashBuffer-dt); p._swingBuffer = Math.max(0,p._swingBuffer-dt);
      if (human) {
        dx = clamp(Number(input.x)||0,-1,1); dz = clamp(Number(input.z)||0,-1,1);
        const neckYaw = Number.isFinite(input.neckYaw) ? input.neckYaw : input.lookYaw;
        const neckPitch = Number.isFinite(input.neckPitch) ? input.neckPitch : input.lookPitch;
        if (Number.isFinite(neckYaw)) p.neck.yaw = neckYaw;
        if (Number.isFinite(neckPitch)) p.neck.pitch = clamp(neckPitch,-1.22,1.35);
        if (Number.isFinite(input.extension)) p.neck.extension = clamp(input.extension,0,1);
        // Short buffers forgive a press just before landing or an ability recovering.
        if (input.jump) p._jumpBuffer = .12;
        if (input.dash) p._dashBuffer = .12;
        if (input.swing || input.smash) p._swingBuffer = .12;
        if (p._jumpBuffer > 0 && p.y === 0) { p._jumpBuffer = 0; p._jumpV = 7.8; this.emit('jump',{player:p.id,x:p.x,z:p.z}); }
        if (p._dashBuffer > 0 && p.energy >= .28 && p._dashCooldown === 0) {
          const direction = Math.hypot(dx,dz);
          p._dashX = direction > .1 ? dx/direction : Math.cos(p.neck.yaw);
          p._dashZ = direction > .1 ? dz/direction : Math.sin(p.neck.yaw);
          p._dashBuffer = 0; p.energy -= .28; p._dash = .3; p._dashCooldown = .55;
          this.emit('dash',{player:p.id,x:p.x,z:p.z});
        }
        if (p._swingBuffer > 0 && p._swingCooldown === 0) { p._swingBuffer = 0; this._swing(p); }
      } else {
        p._reaction -= dt;
        if (p._reaction <= 0) {
          p._reaction = skill.reaction * (.8+this.random()*.4);
          const own = pred.x*(p.team ? 1 : -1) > -.3;
          const mates = this.players.filter(q => q.team === p.team && (!q.human || this.phase === 'attract' || Math.hypot(q.x-pred.x,q.z-pred.z)<2.5));
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
        p.neck.yaw = p.team ? Math.PI : 0; p.neck.pitch = -.3; p.neck.extension = 0;
        const d=Math.hypot(b.x-p.head.x,b.z-p.head.z);
        if (this.phase !== 'serve' && this.phase !== 'point' && d < 2.1 && b.y > p.head.y-.5 && b.y < p.head.y+1.6 && b.vy < 2 && p._swingCooldown<=0) this._swing(p);
        if (p.y===0 && d<1.4 && b.y>4.15 && b.y<5.2 && b.vy<0 && this.random()<dt*.9) { p._jumpV=7.8; this.emit('jump',{player:p.id,x:p.x,z:p.z}); }
      }
      if (!human && (this.phase === 'serve' || this.phase === 'point')) { dx = 0; dz = 0; }
      let len=Math.hypot(dx,dz); if(len>1){dx/=len;dz/=len;}
      const speed=human?5.5:skill.speed;
      const dashProgress = p._dash > 0 ? (1-p._dash/.3) : 1;
      const dashEnvelope = p._dash > 0 ? Math.sin(Math.PI*Math.min(1,dashProgress+.06)) : 0;
      // The dash has a committed direction and a rounded acceleration/recovery curve.
      const dashWeight = p._dash > 0 ? .8*dashEnvelope : 0;
      const targetX = dx*speed*(1-dashWeight) + p._dashX*10.8*dashWeight;
      const targetZ = dz*speed*(1-dashWeight) + p._dashZ*10.8*dashWeight;
      // Acceleration and drag make direction changes gradual; air steering is weaker.
      const response = p._dash > 0 ? 25 : (p.y > .01 ? 5 : (dx || dz ? 16 : 12));
      const blend = 1 - Math.exp(-response * dt);
      p.vx += (targetX-p.vx)*blend; p.vz += (targetZ-p.vz)*blend;
      const minX=p.team?.7:-8.6, maxX=p.team?8.6:-.7;
      p.x=clamp(p.x+p.vx*dt,minX,maxX);p.z=clamp(p.z+p.vz*dt,-4.6,4.6);
      if ((p.x<=minX&&p.vx<0)||(p.x>=maxX&&p.vx>0)) p.vx=0;
      if ((p.z<=-4.6&&p.vz<0)||(p.z>=4.6&&p.vz>0)) p.vz=0;
      if (Math.abs(dx)>.1) p.heading=dx>0?1:-1;
      if(p.y>0||p._jumpV>0){p._jumpV-=18*dt;p.y+=p._jumpV*dt;if(p.y<=0){p.y=0;p._jumpV=0;}}p.jump=p.y;
      p._swingTime=Math.max(0,p._swingTime-dt); p.swing=p._swingTime>0?Math.sin(Math.PI*(1-p._swingTime/.5)):0;
      p.action=p._swingTime>0?'smash':(p.y>0?'jump':(p._dash?'dash':''));
      this._stepNeck(p, dt);

    }
  }
  _stepNeck(p, dt) {
    const n=p.neck, points=p.neckPoints, length=1.8+n.extension*1.2, segment=length/8;
    const reach=Math.min(length*.82, .75 + p.swing*(p.human && this.phase !== 'attract' ? 1.4 : 1) + Math.abs(n.pitch)*.2);
    const yaw=n.yaw, vertical=Math.sqrt(length*length-reach*reach) + Math.sin(n.pitch)*.8;
    const base={x:p.x,y:1.45+p.y,z:p.z};
    const target={x:base.x+Math.cos(yaw)*reach,y:base.y+vertical,z:base.z+Math.sin(yaw)*reach};
    Object.assign(points[0],base);
    const previous=p._previousNeck;
    for(let i=1;i<9;i++){const q=points[i],old=previous[i];old.x=q.x;old.y=q.y;old.z=q.z;}
    for(let i=1;i<9;i++) {
      const q=points[i], t=i/8;
      // Every joint has inertia. Lower damping leaves a pronounced visible whip.
      const tx=base.x+(target.x-base.x)*t*t, ty=base.y+(target.y-base.y)*t, tz=base.z+(target.z-base.z)*t*t;
      const human = p.human && this.phase !== 'attract';
      const stiffness= human ? (i===8 ? 45 : 35) : 85;
      const damping=human ? 3.8 : 10;
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
    for(let i=1;i<9;i++) { const q=points[i], old=previous[i]; q.vx=clamp((q.x-old.x)/dt,-24,24);q.vy=clamp((q.y-old.y)/dt,-24,24);q.vz=clamp((q.z-old.z)/dt,-24,24); }
    Object.assign(p.head,points[8]);
  }
  _ballStep(dt) {
    const b=this.ball, oldX=b.x, oldY=b.y, oldZ=b.z; b.vy-=G*dt;
    const drag=Math.exp(-.018*dt);b.vx*=drag;b.vy*=drag;b.vz*=drag;
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.spin*=Math.exp(-.35*dt);
    const netSide=oldX<0?-1:1, netSurface=netSide*BALL_R;
    const towardNet=(b.x-oldX)*netSide<0;
    const crossedNet=towardNet && (oldX-netSurface)*netSide>=0 && (b.x-netSurface)*netSide<=0;
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
      if(p.id===this.lastHitter)continue;
      const h=p.head, min=BALL_R+HEAD_R;
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
      const impulse=-(1+.95)*relative;
      b.vx+=impulse*nx;b.vy+=impulse*ny;b.vz+=impulse*nz;
      b.x=h.x+nx*(min+.01);b.y=h.y+ny*(min+.01);b.z=h.z+nz*(min+.01);
      b.spin=clamp((h.vz-b.vz)*nx-(h.vx-b.vx)*nz,-15,15);
      this.lastTeam=p.team;this.lastHitter=p.id;this.touchCooldown=.08;this.hits++;this.rallyHits++;
      const tip=p.neckPoints[8]; tip.vx-=nx*impulse*.16;tip.vy-=ny*impulse*.16;tip.vz-=nz*impulse*.16;
      this.emit('hit',{player:p.id,team:p.team,x:b.x,y:b.y,z:b.z,power:clamp(impulse/14,0,1),incomingSpeed:-relative,impact:impulse,normal:{x:nx,y:ny,z:nz},velocity:{x:b.vx,y:b.vy,z:b.vz}});break;
    }
    if(b.y<=BALL_R){const out=Math.abs(b.x)>9 || Math.abs(b.z)>5;const side=b.x<0?0:1;this._point(out?(this.lastTeam===null?1-side:1-this.lastTeam):1-side,out?'out':'floor');return;}
    if(Math.abs(b.x)>13||Math.abs(b.z)>9||b.y>22){this._point(this.lastTeam===null?0:1-this.lastTeam,'out');}
  }
  update(dt,input={}) {
    if(this.paused)return;dt=clamp(Number(dt)||0,0,.05);if(!dt||this.phase==='finished')return;
    this.timer+=dt;
    const steps=Math.max(1,Math.ceil(dt/(1/120))), step=dt/steps;
    for(let i=0;i<steps;i++){
      if(this.paused||this.phase==='finished')break;
      const edges=i===0?input:{...input,jump:false,dash:false,smash:false,swing:false,serve:false};
      this.touchCooldown=Math.max(0,this.touchCooldown-step);this.netCooldown=Math.max(0,this.netCooldown-step);
      this._stepPlayers(step,edges);
      if(this.phase==='point')continue;
      if(this.phase==='serve'){this._hold();continue;}
      if(this.phase==='play'||this.phase==='attract')this._ballStep(step);
    }
    if(this.phase==='point'&&this.timer>1.45){this.phase='serve';this.timer=0;this._place();this.message=this.server?'THEIR SERVE':'YOUR SERVE';this._hold();}
    else if(this.phase==='serve'){ const server=this.players.find(p=>p.team===this.server); if (server.human ? (input.serve||input.swing||input.smash) : this.timer>1) this._launch(this.server); }
  }
}














