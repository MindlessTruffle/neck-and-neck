import { createGameServer } from './game-server.mjs';

const app=createGameServer({
  host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT)||8787,
  allowedOrigins:process.env.ALLOWED_ORIGINS||'',maxRooms:Number(process.env.MAX_ROOMS)||8,
  maxConnections:Number(process.env.MAX_CONNECTIONS)||64,
  trustProxy:process.env.TRUST_PROXY==='true',
});
const address=await app.start();
console.log(`Neck & Neck authoritative server listening on ${address.host}:${address.port}`);
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await app.close();process.exitCode=0;}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
