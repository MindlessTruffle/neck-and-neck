import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=mkdtempSync(join(tmpdir(),'neck-watchdog-'));
const posix=p=>process.platform==='win32'?p.replaceAll('\\','/').replace(/^([A-Z]):/i,(_,d)=>'/'+d.toLowerCase()):p;
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/bash';
try {
 const bin=join(root,'bin');mkdirSync(bin);
 const files={curl:`#!/bin/bash\ncase "$CURL_MODE" in ok) printf '{"ok":true}';; down) exit 22;; proxy) case "$*" in *8787*) printf '{"ok":true}';; *) exit 22;; esac;; esac\n`,logger:'#!/bin/bash\nexit 0\n',systemctl:'#!/bin/bash\nprintf "%s\\n" "$*" >> "$TEST_RESTART_LOG"\n'};
 for(const [name,body] of Object.entries(files)){writeFileSync(join(bin,name),body);chmodSync(join(bin,name),0o755);}
 const script=readFileSync(new URL('../deploy/health-watchdog.sh',import.meta.url),'utf8').replace('state=/run/neck-club-watchdog',`state='${posix(join(root,'state'))}'`).replaceAll('\r','');
 const target=join(root,'check.sh'),log=join(root,'restarts');writeFileSync(target,`export PATH='${posix(bin)}:/usr/bin:/bin'\n`+script);
 const run=mode=>{const result=spawnSync(bash,[posix(target)],{env:{...process.env,PATH:`${posix(bin)}:/usr/bin:/bin`,CURL_MODE:mode,TEST_RESTART_LOG:posix(log)},encoding:'utf8'});assert.equal(result.status,0,result.stderr);};
 const lines=()=>existsSync(log)?readFileSync(log,'utf8').trim().split('\n'):[];
 run('down');run('down');assert.equal(lines().length,0);run('down');assert.deepEqual(lines(),['restart neck-club']);
 run('ok');run('proxy');run('proxy');assert.equal(lines().length,1);run('proxy');assert.deepEqual(lines(),['restart neck-club','restart caddy']);
 run('ok');assert.equal(readFileSync(join(root,'state','caddy'),'utf8').trim(),'0');
 console.log('PASS watchdog: three failures required, healthy probes reset count, proxy isolated from failed upstream.');
} finally {assert.ok(root.startsWith(join(tmpdir(),'neck-watchdog-')));rmSync(root,{recursive:true,force:true});}
