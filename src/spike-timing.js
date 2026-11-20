import { BALL_GRAVITY, PERFECT_SPIKE_REACH, perfectSpikeGeometry } from './physics.js';

// Short lead-in gives a tap time to arrive; never advertise an illegal touch.
export function perfectSpikeReady(game, player) {
  if(!game||!player||game.paused||game.phase!=='play'||(game.touchCooldown||0)>0||player._contactCooldown>0||player._swingCooldown>0||player._dive>0||player._blockTime>0||player.knockback>0)return false;
  if(player._actionTime>0&&['set','block','dive'].includes(player._contactAction))return false;
  if(game.touchTeam===player.team&&((game.touches?.[player.team]||0)>=4||(game.mode==='2v2'&&game.lastHitter===player.id&&!game._lastWasBlock)))return false;
  const b=game.ball,h=player.head;if(!b||!h)return false;
  const x=b.x-h.x,y=b.y-h.y,z=b.z-h.z;
  const vx=(b.vx||0)-(h.vx||0),vy=(b.vy||0)-(h.vy||0),vz=(b.vz||0)-(h.vz||0);
  if(x*vx+y*vy+z*vz>=0)return false;
  for(let step=0;step<=12;step++){
    const t=step*.015,dx=x+vx*t,dy=y+vy*t-.5*BALL_GRAVITY*t*t,dz=z+vz*t;
    if(dx*dx+dy*dy+dz*dz<=PERFECT_SPIKE_REACH**2)return perfectSpikeGeometry(player,dx,dy,dz);
  }
  return false;
}
