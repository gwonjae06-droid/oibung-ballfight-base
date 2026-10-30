'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
function depthWorld(override={}){
 const calls={saves:0,restores:0,shadows:[],fills:0,draws:0,gradient:0};
 const ctx=new Proxy({},{
  get:(o,k)=>{
   if(k in o)return o[k];
   if(k==='save')return()=>calls.saves++;
   if(k==='restore')return()=>calls.restores++;
   if(k==='ellipse')return(...a)=>calls.shadows.push(a);
   if(k==='fillRect')return()=>calls.fills++;
   if(k==='drawImage')return()=>calls.draws++;
   if(k==='createLinearGradient'||k==='createRadialGradient')
    return()=>{calls.gradient++;return{addColorStop(){}};};
   return()=>{};
  },
  set:(o,k,v)=>(o[k]=v,true)
 });
 const w={Math,Number,Set,console,...override};w.window=w;
 vm.createContext(w);vm.runInContext(read('js/features/arena-depth.js'),w,{filename:'arena-depth.js'});
 return {w,ctx,calls};
}
test('free and Tower floor have 2.5D rim and preserve cached Tower painting',()=>{
 const {w,ctx,calls}=depthWorld();
 const game={width:500,height:500};
 w.ArenaDepth.paintFloor(ctx,game,false);
 assert.ok(calls.fills>10,'tile shading is painted for white arena');
 const before=calls.fills;
 w.ArenaDepth.paintFloor(ctx,game,true);
 assert.ok(calls.fills>before,'Tower obtains a subtle plinth overlay');
 assert.equal(calls.saves,calls.restores,'graphics state restored');
});
test('offscreen floor cache is reused rather than repainted every frame',()=>{
 const {w,ctx,calls}=depthWorld();
 let created=0;
 const doc={createElement(){
   created++;
   return {width:0,height:0,getContext:()=>ctx};
 }};
 w.document=doc;
 w.ArenaDepth.paintFloor(ctx,{width:500,height:500},false);
 const once=created;
 w.ArenaDepth.paintFloor(ctx,{width:500,height:500},false);
 assert.equal(created,once);
 assert.ok(calls.draws>=2,'blit cached floor');
 w.ArenaDepth.paintFloor(ctx,{width:500,height:500},true);
 assert.ok(created>once,'Tower separate cached overlay');
});
test('fighter ground footprint stays fixed while drawn height alters shadow shape',()=>{
 const {w,ctx,calls}=depthWorld(),p={x:200,y:210,radius:26,hp:100,z:0};
 const original={x:p.x,y:p.y,z:p.z};
 w.ArenaDepth.shadow(ctx,p,0);
 const ground=calls.shadows.slice(-2);
 w.ArenaDepth.shadow(ctx,p,90);
 const airborne=calls.shadows.slice(-2);
 assert.ok(airborne[0][2]>ground[0][2],'high shadow spreads');
 assert.ok(airborne[1][2]>ground[1][2]);
 assert.deepEqual({x:p.x,y:p.y,z:p.z},original,'visual layer does not change physics');
 assert.equal(calls.saves,calls.restores);
});
test('photos and circles receive the same restrained 2.5D lighting',()=>{
 const {w,ctx,calls}=depthWorld(),p={hp:150,radius:24};
 w.ArenaDepth.underlay(ctx,p,24);
 w.ArenaDepth.lightSurface(ctx,24);
 assert.ok(calls.gradient>0);
 assert.equal(calls.saves,calls.restores);
});
test('shot spawned while airborne carries its height and hits only matching altitude',()=>{
 const w={console,Math,Number,Date,Map,Set,CUSTOM_DEFS:[],CHARACTER_PHOTOS:{},
  BEHAVIORS:{},players:[],canvas:{width:500,height:500},
  createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(p){
    return w.players.find(e=>e!==p&&e.hp>0)||null;}};
 w.window=w;vm.createContext(w);
 vm.runInContext(read('js/features/advanced-combat.js'),w);
 vm.runInContext(read('js/features/skill-forge.js'),w);
 const profile={name:'공중 사격수',hp:240,speed:2,color:'#546677',
  skills:[{name:'높이별 총알',cooldown:3,trigger:'auto',
    actions:[{type:'shot',damage:30,radius:190,speed:8,count:1,delay:0}]}]};
 const id=w.SkillForge.register(profile),hero=w.CUSTOM_DEFS[0].createInstance(1);
 hero.x=100;hero.y=100;hero.z=74;hero.vz=0;hero.forgeTicks=[1000];
 const foe={playerNum:2,x:154,y:100,z:0,hp:240,maxHp:240,invincible:0,radius:24,vx:0,vy:0};
 w.players=[hero,foe];
 for(let i=0;i<16;i++)w.BEHAVIORS[id].update(hero,foe);
 assert.ok(hero.forgeShots.length>0);
 const bullet=hero.forgeShots[0];
 assert.equal(bullet.z,74);
 assert.equal(w.SkillForge.hit(hero,foe,bullet.a,1,bullet.z),false,
   'elevated shot cannot strike ground-level target');
 foe.z=74;
 assert.equal(w.SkillForge.hit(hero,foe,bullet.a,1,bullet.z),true,
   'same-height target is vulnerable');
 const oldHp=foe.hp;foe.z=0;foe.invincible=0;
 assert.equal(w.SkillForge.hit(hero,foe,bullet.a,1,0),true,'a ground shot can hit ground again');
 assert.ok(foe.hp<oldHp);
});
test('lightweight network snapshots only include height when airborne; remote uses it for render',()=>{
 const w={console,Math,Date,Set,Map,Image:class{},localStorage:{getItem:()=>null}};
 const ctx=new Proxy({}, {get:(o,k)=>o[k]||(()=>({addColorStop(){}})),set:(o,k,v)=>(o[k]=v,true)});
 const canvas={width:500,height:500,getContext:()=>ctx};
 w.document={getElementById:id=>id==='arena'?canvas:{style:{},dataset:{}},
  querySelector:()=>null};w.requestAnimationFrame=()=>{};w.window=w;
 vm.createContext(w);
 for(const m of read('pvp-runtime.html').matchAll(/src="([^"]+)"/g)){
  const file=m[1].split('?')[0];vm.runInContext(read(file),w,{filename:file});
 }
 const r=w.PvpRuntime,profile={name:'높이 전송',hp:240,speed:2,color:'#557799',
  skills:[{name:'파동',trigger:'auto',cooldown:2,actions:[{type:'wave',damage:11}]}]};
 const room=r.createRoom(profile,profile,'auto',Date.now(),['auto','auto']);
 assert.ok(!('h' in r.snapshot(room,false).players[0]));
 room.players[0].z=76;
 const state=r.snapshot(room,false);
 assert.equal(state.players[0].h,76);
 room.players[0].z=0;
 r.receive(JSON.parse(JSON.stringify(state)));
 // Guest height targets are included even when a full world snapshot is skipped.
 assert.equal(room.players[0].jumpState,'ground');
 assert.doesNotThrow(()=>r.paint());
 assert.ok(room.players[0].z>=0);
});
test('floor, height and VFX share the one camera transform',()=>{
 const render=read('js/core/render.js');
 const floor=render.indexOf('ArenaDepth?.paintFloor');
 const objects=render.indexOf('AdvancedCombat?.draw(ctx)');
 const actor=render.indexOf('ArenaMotion.drawFighter');
 const fx=render.indexOf('ArenaFXLayer?.draw');
 assert.ok(floor>0&&floor<objects&&objects<actor&&actor<fx);
 const main=read('index.html'),pvp=read('pvp-runtime.html');
 for(const html of [main,pvp])
  assert.ok(html.indexOf('arena-depth.js')<html.indexOf('core/render.js'));
});
