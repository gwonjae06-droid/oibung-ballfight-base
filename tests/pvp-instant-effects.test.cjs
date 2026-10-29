'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function world(){
 const ctx=new Proxy({},{
  get:(o,k)=>o[k]||(()=>({addColorStop(){}})),
  set:(o,k,v)=>(o[k]=v,true)
 });
 const canvas={width:500,height:500,getContext:()=>ctx};
 const w={console,Math,Date,Set,Map,Image:class{},localStorage:{getItem:()=>null},
  document:{getElementById:id=>id==='arena'?canvas:{style:{},dataset:{}},
   querySelector:()=>null},requestAnimationFrame(){}};
 w.window=w;vm.createContext(w);
 for(const m of fs.readFileSync('pvp-runtime.html','utf8').matchAll(/src="([^"]+)"/g)){
  const script=m[1].split('?')[0];
  vm.runInContext(fs.readFileSync(script,'utf8'),w,{filename:script});
 }
 return w;
}
const hero={name:'스킬 폭발',hp:240,speed:2.2,color:'#28aaff',
 skills:[{name:'검격',trigger:'auto',cooldown:1,
 actions:[{type:'slash',damage:18,radius:120},{type:'bolt',damage:22,radius:150}]}]};
test('authored skill effects are captured on execution and carried in small immediate event packets',()=>{
 const w=world(),r=w.PvpRuntime,room=r.createRoom(hero,hero,'manual',1000,['manual','manual']);
 let wake=0;
 r.setFxWake(()=>wake++);
 assert.equal(r.cast(room,0,0),true);
 const events=JSON.parse(JSON.stringify(r.drainFx(24)));
 assert.ok(events.length>0,'first slash is generated immediately on skill execution');
 assert.ok(wake>0,'transport is notified without waiting for a game state frame');
 assert.ok(events.every(e=>e.kind==='cast'||e.kind==='impact'));
 assert.equal(events[0].type,'slash');
 assert.equal(events[0].owner,0);
 assert.ok(JSON.stringify(events).length<2400,'skill packet contains compact VFX descriptors');
 assert.equal(r.drainFx(24).length,0,'events are not rebroadcast every frame');
});
test('guest visual engine replays original skill artwork without importing stale world effect snapshots',()=>{
 const host=world(),guest=world(),a=host.PvpRuntime,b=guest.PvpRuntime;
 const room=a.createRoom(hero,hero,'manual',1000,['manual','manual']);
 b.createRoom(hero,hero,'manual',1000,['manual','manual']);
 b.receive(JSON.parse(JSON.stringify(a.snapshot(room,false)));
 assert.equal(a.cast(room,0,0),true);
 const events=JSON.parse(JSON.stringify(a.drainFx(24)));
 assert.ok(b.receiveFx(events)>0,'guest renders VFX before any full-state packet');
 assert.equal(guest.SkillVisuals.exportEffects()[0].type,'slash');
 assert.equal(b.receiveFx(events),0,'duplicate effects cannot restart animation');
 const firstAge=guest.SkillVisuals.exportEffects()[0].age;
 let clock=Date.now();
 guest.Date=class extends Date{static now(){return clock;}};
 b.paint();clock+=34;b.paint();
 assert.ok(guest.SkillVisuals.exportEffects()[0].age>firstAge,
  'guest independently advances real skill animation at 60fps');
 const snapshot=JSON.parse(JSON.stringify(a.snapshot(room,true)));
 assert.equal(snapshot.world.skillEffects,undefined,'old effect snapshots no longer overwrite playback');
 const before=guest.SkillVisuals.active;
 b.receive(snapshot);
 assert.equal(guest.SkillVisuals.active,before,'light/full corrections preserve live VFX');
});
test('all original authored VFX types replay through the same visual renderer',()=>{
 const guest=world(),r=guest.PvpRuntime;
 r.createRoom(hero,hero,'manual',1000,['manual','auto']);
 const types=Object.keys(guest.SkillVisuals.catalog),total=types.length;
 let id=0,count=0;
 for(let i=0;i<types.length;i+=16){
  const events=types.slice(i,i+16).map(type=>({
   id:++id,type,kind:'cast',owner:0,follow:false,x:140,y:170,
   angle:0,radius:90,life:30,scale:1,color:'#80d8ff'
  }));
  count+=r.receiveFx(JSON.parse(JSON.stringify(events)));
 }
 assert.equal(count,total,'all custom VFX types are supported');
 assert.doesNotThrow(()=>r.paint(),'the native VFX renderer handles replayed families');
});
test('online transport has separate fast VFX broadcast, independent from large world frames',()=>{
 const c=fs.readFileSync('js/features/pvp-supabase.js','utf8');
 assert.match(c,/event:'fx'/);
 assert.match(c,/rule\.receiveFx\?\.\(payload\.events\)/);
 assert.match(c,/FX_MIN_INTERVAL=55/);
 assert.match(c,/setFxWake\?\.\(\(\)=>this\.scheduleFx\(\)\)/);
 assert.match(c,/rule\.previewCast\?\.\(1,Number\(msg\.slot\)\)/);
 assert.match(c,/this\.flushFx\(\);\s*this\.done=true/);
});
