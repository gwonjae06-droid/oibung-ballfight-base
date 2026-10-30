'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function mock(){
 let now=1000,id=0;const intervals=new Map();
 const w={Promise,Math,Set,Map,JSON,Number,console,Error,Date:{now:()=>now},
  setInterval(fn){const n=++id;intervals.set(n,fn);return n;},
  clearInterval(n){intervals.delete(n);},setTimeout(){return ++id;},clearTimeout(){}};
 w.window=w;vm.createContext(w);
 vm.runInContext(fs.readFileSync('js/features/pvp-supabase.js','utf8'),w);
 const t=Object.create(w.SupabasePvpTransport.prototype);
 Object.assign(t,{closed:false,done:false,side:1,room:'demo',ticket:'11111111-1111-4111-8111-111111111111',
  current:{ended:false},pendingControls:new Map(),seenControls:new Set(),controlSequence:0,
  readyState:1,connected:true,lastPeer:1000,checkFailures:0});
 const packets=[];
 t.channel={send(packet){packets.push(packet);return Promise.resolve('ok');}};
 t.emit=()=>{};
 return {t,packets,intervals,now:v=>{now=v;},tick(){for(const fn of [...intervals.values()])fn();}};
}
test('cancel RPC accepts thenable without a .catch method',async()=>{
 const {t}=mock();let count=0;
 t.sb={rpc(){count++;return {then(resolve){resolve({data:true,error:null});}};}};
 await assert.doesNotReject(t.leave());
 assert.equal(count,1);
 let closed=false;t.onclose=()=>{closed=true;};t.channel=null;t.close();
 assert.equal(closed,true);assert.equal(count,2);
});
test('poll failures are bounded and a successful query resets the counter',async()=>{
 const {t}=mock();t.room=null;let calls=0,failed=0;
 t.sb={rpc:()=>Promise.resolve(++calls===3?{data:{status:'queued'}}:{error:new Error('offline')})};
 t.fail=()=>failed++;
 for(let i=0;i<2;i++)await t.check();
 assert.equal(t.checkFailures,2);
 await t.check();assert.equal(t.checkFailures,0);
 for(let i=0;i<4;i++)await t.check().catch(()=>failed++);
 assert.equal(failed,1);
});
test('guest retry gets ack and duplicated packets do not cast twice',()=>{
 const guest=mock(),host=mock(),casts=[];
 host.t.side=0;host.t.rule={cast:(r,side,slot)=>casts.push([side,slot])};
 guest.t.sendReliable({type:'cast',slot:2});
 const first=guest.packets[0].payload;
 guest.now(1450);guest.tick();
 assert.equal(guest.packets[1].payload.eventId,first.eventId);
 host.t.control(first,host.t.rule);host.t.control(first,host.t.rule);
 assert.equal(casts.length,1);
 assert.equal(host.packets.length,2);
 guest.t.control(host.packets[0].payload,{});
 assert.equal(guest.t.pendingControls.size,0);
 assert.equal(guest.intervals.size,0);
});
test('stalled reliable packets end after ten attempts rather than retry forever',()=>{
 const h=mock();let failure='';
 h.t.fail=e=>{failure=e.message;h.t.stopReliable();h.t.closed=true;};
 h.t.sendReliable({type:'cast',slot:0});
 for(let i=0;i<12;i++){h.now(1400+i*400);h.tick();}
 assert.match(failure,/응답/);assert.equal(h.intervals.size,0);
});
test('network broadcast backpressure clears if send never settles',()=>{
 const h=mock(),snap=[];h.t.side=0;h.t.peerReady=true;
 h.t.lastStep=4000;h.t.lastPeer=4000;h.t.lastBroadcast=0;h.t.lastFull=0;
 h.t.sending=true;h.t.lastSendAt=1000;
 h.t.rule={step(){},snapshot(){snap.push(true);return {type:'state',players:[]};}};
 h.now(4000);h.t.advance(h.t.rule);
 assert.ok(snap.length>0);
});

test('guest uses one-shot casts with legacy host and ACK protocol after version negotiation',()=>{
 const h=mock(),t=h.t;t.rule={predict(){},previewCast(){}};
 t.peerReliable=false;t.send(JSON.stringify({type:'cast',slot:0}));
 assert.equal(h.packets.length,1);
 assert.equal(h.packets[0].payload.eventId,undefined);
 assert.equal(h.intervals.size,0);
 t.peerReliable=true;t.send(JSON.stringify({type:'cast',slot:1}));
 assert.equal(h.packets.length,2);
 assert.ok(Number.isInteger(h.packets[1].payload.eventId));
});

test('stale rooms are closed without deleting match history or touching active games',()=>{
 const sql=fs.readFileSync('supabase/pvp_reliability_v3.sql','utf8');
 assert.match(sql,/where ended_at is null and created_at<now\(\)-interval '6 minutes'/);
 assert.match(sql,/create or replace function public\.oibung_pvp_join_v2/);
 assert.match(sql,/pg_advisory_xact_lock\(719826,1\)/);
 assert.match(sql,/ticket_a=p_ticket/);
 assert.match(sql,/ticket_b=p_ticket/);
});
