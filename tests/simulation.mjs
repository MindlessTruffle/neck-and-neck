import assert from 'node:assert/strict';
import { VolleyballGame } from '../src/physics.js';
import { SmoothSimulation } from '../src/motion.js';
for(const difficulty of ['chill','club','spicy'])for(const mode of ['1v1','2v2']){
 let wins=[0,0],rallies=0,hits=0,max=0;
 for(let k=0;k<20;k++){
  let last=0;const g=new VolleyballGame({mode,difficulty,onEvent:e=>{if(e.type==='score'){max=Math.max(max,g.hits-last);last=g.hits;}}});
  g.seed=1234+k*271;g.start();g.players[0].human=false;
  const simulation=new SmoothSimulation(g);
  for(let i=0;i<100000&&g.phase!=='finished';i++)simulation.advance(1/60);
  assert.equal(g.phase,'finished',`${mode} ${difficulty} game ${k} did not finish`);
  wins[g.score[0]>g.score[1]?0:1]++;rallies+=g.rally;hits+=g.hits;
 }
 const mean=hits/rallies;assert(mean>1.35,`${mode} ${difficulty}: too few returns`);assert(wins[0]>0&&wins[1]>0,`${mode} ${difficulty}: one-sided`);
 console.log(`${difficulty} ${mode} (fixed clock): wins ${wins.join('-')}, ${mean.toFixed(2)} hits/point, longest ${max}, ${rallies} points`);
}

