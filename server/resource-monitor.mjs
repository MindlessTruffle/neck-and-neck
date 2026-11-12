import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';

const cpuTimes=()=>os.cpus().reduce((sum,cpu)=>({idle:sum.idle+cpu.times.idle,total:sum.total+Object.values(cpu.times).reduce((a,b)=>a+b,0)}),{idle:0,total:0});
const percent=value=>Math.max(0,Math.min(100,Math.round(value*10)/10));
/** Cached aggregate telemetry only. Requests never trigger /proc or CPU sampling. */
export function createResourceMonitor() {
  let lastCPU=process.cpuUsage(),lastHost=cpuTimes(),lastTime=performance.now(),busy=false,closed=false;
  const delay=monitorEventLoopDelay({resolution:20});delay.enable();
  let sample={sampledAt:null,processCpuCorePercent:null,hostCpuPercent:null,processMemoryBytes:process.memoryUsage().rss,hostMemoryTotalBytes:os.totalmem(),hostMemoryAvailableBytes:null,eventLoopP95Ms:null};
  async function refresh(){
    if(busy||closed)return;busy=true;
    try{
      const now=performance.now(),cpu=process.cpuUsage(),host=cpuTimes(),elapsed=now-lastTime;
      let available=os.freemem();
      if(process.platform==='linux')try{const info=await readFile('/proc/meminfo','utf8');const value=info.match(/^MemAvailable:\s+(\d+) kB/m);if(value)available=Number(value[1])*1024;}catch{}
      sample={sampledAt:new Date().toISOString(),processCpuCorePercent:Math.round(((cpu.user-lastCPU.user+cpu.system-lastCPU.system)/(elapsed*1000))*1000)/10,hostCpuPercent:host.total>lastHost.total?percent((1-(host.idle-lastHost.idle)/(host.total-lastHost.total))*100):0,processMemoryBytes:process.memoryUsage().rss,hostMemoryTotalBytes:os.totalmem(),hostMemoryAvailableBytes:available,eventLoopP95Ms:Math.round(delay.percentile(95)/1e5)/10};
      lastCPU=cpu;lastHost=host;lastTime=now;delay.reset();
    }finally{busy=false;}
  }
  const timer=setInterval(refresh,2000);timer.unref();
  return {read:()=>({...sample,uptimeSeconds:Math.floor(process.uptime())}),close(){closed=true;clearInterval(timer);delay.disable();}};
}
