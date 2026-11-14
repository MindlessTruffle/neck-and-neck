import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const port = process.env.PORT || '8787';
const children = [
  spawn(process.execPath, ['server/index.mjs'], { cwd, stdio: 'inherit', env: { ...process.env, HOST: '127.0.0.1', PORT: port } }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd, stdio: 'inherit', env: { ...process.env, VITE_SERVER_URL: `ws://127.0.0.1:${port}` } }),
];
let closing = false;
function stop(code = 0) { if (closing) return; closing = true; for (const child of children) child.kill(); process.exitCode = code; }
for (const child of children) { child.on('error', error => { console.error(error.message); stop(1); }); child.on('exit', code => stop(code || 0)); }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
