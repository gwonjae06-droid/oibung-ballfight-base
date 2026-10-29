'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(){
 let now=1000;const w={window:null,Date:{now:()=>now},Promise,console,clearInterval(){},setTimeout(){}};w.window=w;vm.createContext(w);
 vm.runInContext(fs.readFileSync('js/features/pvp-supabase.js','utf8'),w);
 const t=Object.create(w.SupabasePvpTransport.prototype);Object.assign(t,{side:0,current:{ended:false},connected:true,lastStep:1000,lastBroadcast:0,lastPeer:1000,closed:false,peerReady:false});
 const steps=[],sent=[];const rule={step:(r,dt)=>steps.push(dt),snapshot:()=>({players:[],type:'state'})};
 t.emit=()=>{};t.channel={send:v=>{sent.push(v);return Promise.resolve('ok');}};
 return {t,rule,steps,sent,now:v=>{now=v;}};
}
test('host waits for ready, catches up in bounded steps, pauses during lost heartbeat and resumes',()=>{
 const h=harness();h.now(1200);h.t.advance(h.rule);assert.equal(h.steps.length,0);
 h.t.control({type:'ready',from:1},h.rule);h.now(1400);h.t.advance(h.rule);
 assert.ok(Math.abs(h.steps.reduce((a,b)=>a+b,0)-.2)<1e-8);assert.ok(h.steps.every(x=>x<=.025));
 const count=h.steps.length;h.now(5000);h.t.advance(h.rule);assert.equal(h.steps.length,count);
 h.t.control({type:'ready',from:1},h.rule);h.now(5050);h.t.advance(h.rule);assert.equal(h.steps.length,count+2);
});
test('pending broadcast is not queued again',()=>{
 const h=harness();h.t.peerReady=true;h.t.sending=true;h.now(1200);h.t.advance(h.rule);assert.equal(h.sent.length,0);
});
