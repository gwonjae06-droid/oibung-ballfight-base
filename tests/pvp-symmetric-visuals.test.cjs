'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function world(){
 const ctx=new Proxy({}, {get:(t,k)=>t[k]||(()=>({addColorStop(){}})),set:(t,k,v)=>(t[k]=v,true)});
 const canvas={width:500,height:500,getContext:()=>ctx};
 const w={console,Math,Date,Set,Map,Image:class{},localStorage:{getItem:()=>null},
 document:{getElementById:id=>id==='arena'?canvas:{style:{},dataset:{}},querySelector:()=>null},requestAnimationFrame(){}};
 w.window=w;vm.createContext(w);
 for(const m of fs.readFileSync('pvp-runtime.html','utf8').matchAll(/src="([^"]+)"/g)){
  const file=m[1].split('?')[0];vm.runInContext(fs.readFileSync(file,'utf8'),w,{filename:file});
 }
 return w;
}
const fighter={name:'테스터',hp:300,speed:2.5,color:'#92adf3',
  skills:[{name:'세 번 공격',trigger:'auto',cooldown:.7,actions:[{type:'shot',damage:12}]}]};
test('guest renders out-of-order realtime effects exactly once rather than permanently dropping them',()=>{
 const w=world(),p=w.PvpRuntime;
 p.createRoom(fighter,fighter,'auto',Date.now(),['auto','auto']);
 const effect=id=>({id,type:'wave',kind:'cast',owner:0,x:190,y:200,
  radius:70,color:'#83caef',angle:0,life:50});
 assert.equal(p.receiveFx([effect(4)]),1);
 assert.equal(p.receiveFx([effect(2),effect(3)]),2,'late packet visual events still render');
 assert.equal(p.receiveFx([effect(2),effect(4)]),0,'redundant events do not flash twice');
 assert.equal(w.SkillVisuals.active,3);
});
test('guest position correction uses host velocity, without simulating new HP damage',()=>{
 const w=world(),p=w.PvpRuntime;
 const room=p.createRoom(fighter,fighter,'auto',Date.now(),['auto','auto']);
 const start=room.players[0].hp,x=room.players[0].x;
 const packet=JSON.parse(JSON.stringify(p.snapshot(room,false)));
 packet.players[0].x=x+50;packet.players[0].vx=3.4;packet.players[0].vy=0;
 p.receive(packet);
 for(let i=0;i<5;i++)p.paint();
 assert.ok(room.players[0].x>x,'guest applies movement direction rather than frozen 120ms sample');
 assert.equal(room.players[0].hp,start,'interpolating positions never changes match outcomes');
});
test('transport protects loss of single FX packet via bounded redundant IDs and existing visual replay',()=>{
 const code=fs.readFileSync('js/features/pvp-supabase.js','utf8');
 assert.match(code,/this\.fxRecent=events\.slice\(-6\)/);
 assert.match(code,/events:\[\.\.\.redundant,\.\.\.events\]/);
 assert.match(code,/FX_MIN_INTERVAL=55/);
 const runtime=fs.readFileSync('js/features/pvp-runtime.js','utf8');
 assert.match(runtime,/remoteFxSeen=new Set\(\)/);
 assert.match(runtime,/remoteFxSeen\.has\(e\.id\)/);
 assert.match(runtime,/targetVelocities/);
});

test('guest canvas advances full-detail projectiles between full world packets',()=>{
 const w=world(),p=w.PvpRuntime;
 const room=p.createRoom(fighter,fighter,'auto',Date.now(),['auto','auto']);
 room.players[0].forgeShots.push({x:140,y:170,vx:5,vy:2,life:90});
 const full=JSON.parse(JSON.stringify(p.snapshot(room,true)));
 p.receive(full);
 const bullet=room.players[0].forgeShots[0];
 const before={x:bullet.x,y:bullet.y,hp:room.players[0].hp};
 let time=Date.now();w.Date=class extends Date{static now(){return time;}};
 p.paint();time+=33;p.paint();
 assert.ok(bullet.x>before.x&&bullet.y>before.y,'guest sees smoothly moving shot');
 assert.equal(room.players[0].hp,before.hp,'visual extrapolation never changes hit logic');
});
test('host sends one final duplicate FX burst even if no further ability fires',()=>{
 const events=[{id:1,type:'wave',kind:'cast',x:120,y:130}];
 const packets=[];
 const o={closed:false,done:false,side:0,connected:true,fxRecent:[],fxRepeatPending:false,
  lastFx:0,fxTimer:null,rule:{drainFx:()=>events.splice(0,24)},
  channel:{send(v){packets.push(v);return Promise.resolve();}}};
 const h={window:null,Date:{now:()=>2000},console,Promise,
   setTimeout(){return 1;},clearTimeout(){}};
 h.window=h;vm.createContext(h);
 vm.runInContext(fs.readFileSync('js/features/pvp-supabase.js','utf8'),h);
 const proto=h.SupabasePvpTransport.prototype;
 proto.flushFx.call(o);
 assert.equal(packets.length,1);
 proto.flushFx.call(o);
 assert.equal(packets.length,2,'last FX has one bounded retransmission');
 assert.deepEqual(packets[1].payload.events.map(e=>e.id),[1]);
 proto.flushFx.call(o);
 assert.equal(packets.length,2,'not an endless background rebroadcast');
});
