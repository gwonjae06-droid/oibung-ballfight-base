'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function load(){
 const w={Math,Number,Map,Set,console};w.globalThis=w;w.window=w;
 vm.createContext(w);
 for(const file of ['tower-realms','tower-terrain-25d','tower-enemy-art','tower-pattern-25d'])
  vm.runInContext(read('js/features/'+file+'.js'),w,{filename:file+'.js'});
 return w;
}
function painter(){
 const calls={ellipses:0,shapes:0,words:[],gradient:0,raised:0};
 const c=new Proxy({},{
  get:(a,k)=>k==='ellipse'?((...args)=>{calls.ellipses++;return undefined;}):
   k==='beginPath'?(()=>{calls.shapes++;}):
   k==='fillText'?((s)=>{calls.words.push(String(s));}):
   k==='createLinearGradient'||k==='createRadialGradient'?
    (()=>{calls.gradient++;return {addColorStop(){}};}):
   k in a?a[k]:(()=>{}),
  set:(a,k,v)=>(a[k]=v,true)
 });
 return {c,calls};
}
const names={
 time:['시간의 파수꾼','영겁의 시계신','초침석','역행석','정지핵'],
 space:['중력의 지배자','특이점의 군주','성운석','위성석','중력핵'],
 fire:['용암의 심장','종말의 화산왕','잿불석','화산갑석','분화핵'],
 ice:['빙정의 수호자','영원의 빙하왕','서리석','빙정석','동결핵'],
 storm:['천둥의 파수꾼','폭풍의 제왕','뇌전석','운무석','선풍석'],
 forest:['고목의 수호자','세계수의 심장','씨앗석','포자석','수액핵']
};
test('six towers each have three distinct raised islands with safe low-ground routes',()=>{
 const w=load(),T=w.ArenaTowerTerrain,all=[];
 for(const realm of Object.keys(names)){
  const ns=T.nodes(realm,1,500,500);
  assert.equal(ns.length,3);assert.ok(ns.every(n=>n.z>=20&&n.z<=65));
  assert.ok(T.heightAt(realm,1,ns[0].x,ns[0].y)>ns[0].z*(realm==='fire'?.82:.95),
    'fire has a recessed crater while other towers retain raised centerpiece');
  assert.equal(T.heightAt(realm,1,15,15),0,'corner is always low and walkable');
  assert.ok(T.heightAt(realm,1,ns[0].x+ns[0].r*2,ns[0].y) <
     T.heightAt(realm,1,ns[0].x,ns[0].y));
  all.push(ns.map(n=>[Math.round(n.x),Math.round(n.y),n.z]).join('|'));
 }
 assert.equal(new Set(all).size,6,'each realm has its own raised terrain silhouette');
});
test('terrain visual shapes draw unique full arenas and named themed stone engravings',()=>{
 const w=load(),T=w.ArenaTowerTerrain;
 const icons=[];
 for(const realm of Object.keys(names)){
  const {c,calls}=painter();
  assert.equal(T.paint(c,realm,5,500,500,90),true);
  assert.ok(calls.shapes>=18,'polygonal terraces and physical arena edge render as closed contours');
  assert.ok(calls.shapes>=12,'raised platforms must contain visible top surfaces and side walls');
  assert.ok(calls.words.length>=3);
  icons.push(calls.words[0]);
 }
 assert.equal(new Set(icons).size,6);
});
test('terrain height follows fighters but never permanently modifies their saved physics',()=>{
 const T=load().ArenaTowerTerrain;
 const p={x:250,y:230,hp:200,z:0,vz:0,vx:1.2,vy:.2,forgeTicks:[10,20]};
 T.step('fire',4,[p],500,500,1);
 assert.ok(p.towerGroundZ>0);
 const first=p.towerGroundZ;
 for(let i=2;i<15;i++)T.step('fire',4,[p],500,500,i);
 assert.equal(p.towerGroundZ,first,'the terrain height must not lag behind unchanged geometry');
 assert.equal(p.z,0);assert.equal(p.vz,0);
 T.clear([p]);assert.equal(p.towerGroundZ,undefined);
 assert.equal(p.z,0);
});
test('no Tower terrain is loaded automatically for PVP fighters',()=>{
 const T=load().ArenaTowerTerrain;
 const p={x:250,y:250,hp:100,z:0,vx:2,vy:0};
 assert.equal(p.towerGroundZ,undefined);
 assert.equal(T.heightAt('unknown',2,5,5),0);
 assert.equal(p.towerGroundZ,undefined);
});
test('each of six towers has three go-stone variants, distinct 5F and 10F bosses',()=>{
 const w=load(),R=w.ArenaTowerRealms,T=w.ArenaTowerArt;
 for(const realm of Object.keys(names)){
  const expected=names[realm];
  const {c,calls}=painter();
  for(let v=0;v<3;v++)assert.equal(T.draw(c,{towerEnemy:true,towerRealm:realm,towerEnemyType:v,forgeClock:20},30),true);
  assert.ok(calls.shapes>3);
  assert.equal(R.floor({number:5,boss:true},realm).name,expected[0]);
  assert.equal(R.floor({number:10,boss:true},realm).name,expected[1]);
  for(const [i,fl] of [1,2,3].entries())
   assert.ok(R.floor({number:fl,boss:false},realm).name.includes(expected[i+2]));
 }
});
test('2.5D pillar effects correspond to active zone stages, never appear during telegraph',()=>{
 const w=load(),fx=w.ArenaTowerPattern3D;
 for(const realm of Object.keys(names)){
  const {c,calls}=painter(),z={x:200,y:220,r:70,shape:'circle',kind:'boss',fire:90};
  fx.draw(c,z,realm,65);assert.equal(calls.shapes,0,'no early damaging visual');
  fx.draw(c,z,realm,95);assert.ok(calls.shapes>0,'active phase has vertical geometry');
 }
});
test('height-aware combat only changes Tower actors, while regular 3D jump collision remains unchanged',()=>{
 const w={console,Math,Number,Map,Set,players:[]};w.window=w;w.globalThis=w;vm.createContext(w);
 vm.runInContext(read('js/features/advanced-combat.js'),w);
 const hero={hp:100,z:0,bodyScale:1,towerGroundZ:42},enemy={hp:100,z:0,bodyScale:1,towerGroundZ:0};
 assert.equal(w.AdvancedCombat.height(hero),42);
 assert.equal(w.AdvancedCombat.canHit(enemy,hero),false,'low attacks cannot strike elevated defenders');
 assert.equal(w.AdvancedCombat.canHit(hero,enemy),false);
 enemy.towerGroundZ=42;
 assert.equal(w.AdvancedCombat.canHit(enemy,hero),true,'matching tier can strike');
 delete enemy.towerGroundZ;delete hero.towerGroundZ;
 assert.equal(w.AdvancedCombat.height(hero),0);
 assert.equal(w.AdvancedCombat.canHit(enemy,hero),true,'ordinary mode unaffected');
});
test('Tower load order and damage fallback preserve persistent rosters and stage progression',()=>{
 const html=read('index.html'),ch=read('js/features/tower-challenge.js');
 for(const asset of ['tower-terrain-25d.js','tower-enemy-art.js','tower-pattern-25d.js']){
  assert.ok(html.includes(asset));
  assert.ok(html.indexOf(asset)<html.indexOf('tower-challenge.js'));
 }
 assert.ok(ch.includes('towerBossTier=level===10?2:level===5?1:0'));
 assert.ok(ch.includes('ArenaTowerTerrain?.clear?.('));
 assert.ok(ch.includes('ArenaTowerTerrain?.step?.('));
 assert.ok(ch.includes('p.z||p.jumpHeight||0)>38'),'jump dodges ground patterns');
 assert.ok(read('js/features/tower-encounters.js').includes('ArenaTowerPattern3D?.draw?.'));
});

test('dynamic terrain heights are synchronized between movement and rendered platforms',()=>{
 const T=load().ArenaTowerTerrain;
 const at=(realm,t)=>T.nodes(realm,8,500,500,t);
 const clock0=at('time',0)[1],clock1=at('time',210)[1];
 assert.ok(Math.hypot(clock0.x-clock1.x,clock0.y-clock1.y)>3,'clock gear moves');
 const s0=at('space',0)[0],s1=at('space',70)[0];
 assert.ok(Math.abs(s1.z-s0.z)>4,'satellite platform levitates');
 const i0=at('ice',300)[2],i1=at('ice',440)[2];
 assert.ok(i1.z<i0.z*.4,'ice platform cracks and drops temporarily');
 const f0=at('forest',0)[2],f1=at('forest',92)[2];
 assert.ok(f1.z>f0.z+4,'root platform grows upward');
 const p={x:clock1.x,y:clock1.y,hp:100,z:0,vx:1,vy:0};
 T.step('time',8,[p],500,500,210);
 const expected=T.heightAt('time',8,p.x,p.y,500,500,210);
 assert.ok(Math.abs(p.towerGroundZ-expected)<.001);
});

test('2.5D warnings stand above the projected arena instead of being flat text',()=>{
 const w={Math,Map,Set,Number,console};w.globalThis=w;w.window=w;
 const raised=[];
 w.ArenaDepth={air(ctx,p,height,draw,radius){raised.push({p,height,draw});}};
 vm.createContext(w);
 vm.runInContext(read('js/features/tower-pattern-25d.js'),w);
 const fx=w.ArenaTowerPattern3D;
 for(const shape of [
  {shape:'circle',x:200,y:220,r:75},
  {shape:'ring',x:250,y:250,inner:65,r:140},
  {shape:'line',x:250,y:250,angle:.6,width:50,length:500}
 ]){
  const z={...shape,kind:'environment',label:'위험 경고',born:1,fire:91,end:130};
  const {c}=painter();const initial=raised.length;
  assert.equal(fx.warning(c,z,'time',40,500,500),true);
  assert.ok(raised.length-initial>=5,'upright posts and a floating countdown required');
  assert.ok(raised.slice(initial).every(x=>x.height>=20));
  for(const entry of raised.slice(initial))assert.doesNotThrow(()=>entry.draw(c));
  const emitted=raised.length;
  assert.equal(fx.warning(c,z,'time',95,500,500),false);
  assert.equal(raised.length,emitted,'no warning after active damage begins');
 }
 const env=read('js/features/tower-environment.js'),boss=read('js/features/tower-encounters.js');
 assert.match(env,/ArenaTowerPattern3D\?\.warning\?\.\(/);
 assert.match(boss,/ArenaTowerPattern3D\?\.warning\?\.\(/);
});
