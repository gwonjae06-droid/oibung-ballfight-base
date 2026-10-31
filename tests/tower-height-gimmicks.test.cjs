'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function boot(){
 const w={Math,Number,Set,Map,console,players:[],canvas:{width:500,height:500}};
 w.globalThis=w;w.window=w;vm.createContext(w);
 for(const file of ['js/features/tower-terrain-25d.js','js/features/advanced-combat.js'])vm.runInContext(read(file),w);
 return {w,T:w.ArenaTowerTerrain,combat:w.AdvancedCombat};
}
const actor=(playerNum,x=250,y=230)=>({playerNum,x,y,z:0,vz:0,vx:0,vy:0,radius:22,hp:500,maxHp:500,invincible:0});
test('bridges connect the actual height field rather than only drawing an optical walkway',()=>{
 const {T}=boot();for(const realm of ['fire','time','space','storm','ice','forest']){
   const ns=T.nodes(realm,6,500,500,0);
   for(const target of ns.slice(1)){
     const x=(ns[0].x+target.x)*.5,y=(ns[0].y+target.y)*.5;
     const measured=T.heightAt(realm,6,x,y,500,500,0);
     assert.ok(measured>12,realm+' ramp must have nonzero middle elevation');
   }
 }
});
test('low flying bullets collide with raised terrain while arcing or elevated trajectories clear it',()=>{
 const {T}=boot();T.step('fire',6,[],500,500,0);
 assert.ok(T.worldHeight(250,230)>40);
 assert.equal(T.obstructsShot(80,230,4,420,230,4),true);
 assert.equal(T.obstructsShot(80,230,98,420,230,98),false);
 assert.equal(T.obstructsShot(80,50,4,420,50,4),false,'empty side lane stays traversable');
 T.clear([]);
 assert.equal(T.obstructsShot(80,230,4,420,230,4),false,'PvP/free battles have no tower cover');
});
test('the furnace island rises, has a clear warning and only hits exposed heroes once',()=>{
 const {T}=boot(),h=actor(1);h.towerHero=true;
 const hits=[];
 T.step('fire',10,[h],500,500,140,()=>hits.push('wrong'));
 const before=T.worldHeight(h.x,h.y);
 T.step('fire',10,[h],500,500,285,(p,n,z)=>hits.push({p,n,z}));
 assert.ok(T.worldHeight(h.x,h.y)>=before+15);
 assert.equal(hits.length,1);assert.ok(hits[0].n>20);
 T.step('fire',10,[h],500,500,285,()=>hits.push('duplicate'));
 assert.equal(hits.length,1,'one eruption is one confirmed damage event');
 T.clear([h]);assert.equal(h.towerGroundZ,undefined);
});
test('ice island collapse creates a genuine fall that gravity must resolve',()=>{
 const {T}=boot();const ice=T.nodes('ice',8,500,500,409)[2],h=actor(1,ice.x,ice.y);
 T.step('ice',8,[h],500,500,409);
 const up=h.towerGroundZ;
 T.sync([h]);
 T.step('ice',8,[h],500,500,410);
 assert.ok(up-h.towerGroundZ>10);
 assert.ok(h.z>5&&h.vz<0,'fighter should fall through air, not teleport to lower surface');
 T.clear([h]);assert.equal(h.z>0,true,'leaving the map must not silently change jump physics');
});
test('time gears physically carry a grounded fighter; low-gravity and wind are tower-only',()=>{
 const {T,combat}=boot();const gear=T.nodes('time',6,500,500,110)[1],h=actor(1,gear.x,gear.y);
 T.step('time',6,[h],500,500,110);
 const origin={x:h.x,y:h.y};T.step('time',6,[h],500,500,111);
 assert.ok(Math.hypot(h.x-origin.x,h.y-origin.y)>.005);
 T.step('space',6,[h],500,500,110);assert.equal(h.towerGravity,.34);
 h.z=40;h.vz=5;combat.tick();assert.ok(h.vz>4.5);
 T.step('storm',6,[h],500,500,110);assert.equal(h.towerGravity,.44);
 T.clear([h]);assert.equal(h.towerGravity,undefined);
});
test('a storm updraft launches a grounded fighter only at the scheduled gust',()=>{
 const {T,w}=boot(),h=actor(1);w.players.push(h);
 T.step('storm',10,[h],500,500,259);assert.equal(h.vz,0);
 T.step('storm',10,[h],500,500,260);assert.ok(h.vz>=7);
});
test('forge and advanced shots all consult the same physical terrain cover',()=>{
 const engine=read('js/core/engine.js'),skill=read('js/features/skill-forge.js'),extras=read('js/features/forge-expansion.js'),advanced=read('js/features/advanced-combat.js');
 assert.match(engine,/ArenaTowerTerrain\?\.sync\?\.\(players\)/);
 assert.match(skill,/ArenaTowerTerrain\?\.obstructsShot/);
 assert.match(extras,/ArenaTowerTerrain\?\.obstructsShot/);
 assert.match(advanced,/ArenaTowerTerrain\?\.obstructsShot/);
 assert.match(advanced,/startZ:absoluteHeight\(p\)\+12/);
});

test('real advanced-combat arc shells clear a raised island but low turret shots cannot shoot through it',()=>{
 const {w,T,combat}=boot();
 const a=actor(1,80,230),b=actor(2,420,230);w.players.push(a,b);
 T.step('fire',6,[a,b],500,500,0);
 const hit={count:0},api={hit(shooter,target,action,mult=1,z){
   if(!combat.canHit(shooter,target,z))return false;
   hit.count++;target.hp-=Math.round(action.damage*mult);return true;
 }};
 const action=(type)=>({type,damage:30,radius:300,count:1,speed:7,duration:6});
 combat.execute(a,action('turret'),b,api);
 for(let i=1;i<=160;i++){combat.tick(api);T.step('fire',6,[a,b],500,500,i);}
 assert.equal(hit.count,0,'raised middle island must cover target from direct turret fire');
 combat.reset();
 combat.execute(a,action('arcshot'),b,api);
 for(let i=1;i<=90;i++){combat.tick(api);T.step('fire',6,[a,b],500,500,i);}
 assert.equal(hit.count,1,'parabolic arc must clear the same terrain and land on target');
 T.clear([a,b]);
});
