import assert from 'node:assert/strict';
import { createGameServer } from '../server/game-server.mjs';
const server=createGameServer({port:0,production:true,allowedOrigins:['https://example.test'],maxRooms:2});
try {
  const {port}=await server.start(),base=`http://127.0.0.1:${port}`;
  const page=await fetch(`${base}/serverhealth`);assert.equal(page.status,200);assert.match(await page.text(),/Server health/);
  await new Promise(resolve=>setTimeout(resolve,2200));
  const result=await fetch(`${base}/api/serverhealth`,{headers:{Origin:'https://example.test'}});
  assert.equal(result.headers.get('access-control-allow-origin'),'https://example.test');
  assert.equal(result.headers.get('cache-control'),'no-store');
  const body=await result.json(),s=body.servers[0],r=s.resources;
  assert.equal(s.maxMatches,2);assert.equal(s.matches,0);assert.equal(s.activePlayers,0);
  assert.ok(r.processMemoryBytes>0);assert.ok(r.hostMemoryTotalBytes>=r.hostMemoryAvailableBytes);
  assert.ok(Number.isFinite(r.processCpuCorePercent));assert.ok(r.hostCpuPercent>=0&&r.hostCpuPercent<=100);
  assert.ok(Date.now()-Date.parse(r.sampledAt)<5000);
  assert.equal('sessions' in s,false);assert.equal('members' in s,false);
  const denied=await fetch(`${base}/api/serverhealth`,{headers:{Origin:'https://untrusted.example'}});
  assert.equal(denied.headers.get('access-control-allow-origin'),null);
  const basic=await fetch(`${base}/health`).then(r=>r.json());assert.equal('servers' in basic,false);
  console.log('PASS health: cached host/process telemetry, live capacity, dashboard route, restricted CORS and minimal readiness endpoint.');
} finally {await server.close();}
