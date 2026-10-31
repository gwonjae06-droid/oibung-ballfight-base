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
