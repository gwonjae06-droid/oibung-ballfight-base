'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
function terrain(){const w={Math,Number,Map,Set,console};w.globalThis=w;w.window=w;vm.createContext(w);vm.runInContext(read('js/features/tower-terrain-25d.js'),w);return w.ArenaTowerTerrain;}
const realms=['fire','time','space','storm','ice','forest'];
const actor=(x,y,radius=20)=>({x,y,radius,vx:7,vy:2,z:0,hp:200});
test('six tower arenas have different physical boundary polygons and terrace outlines',()=>{
 const T=terrain(),keys=new Set();
 for(const realm of realms){
  const vertices=T.outline(realm,500,500);
  assert.ok(vertices.length>=7,realm);
  keys.add(vertices.map(p=>Math.round(p.x)+','+Math.round(p.y)).join(';'));
  assert.equal(T.isWalkable(realm,250,250,500,500),true);
  assert.equal(T.isWalkable(realm,7,7,500,500),false);
  const plates=T.nodes(realm,6,500,500,230).map(n=>T.footprint(realm,n));
  assert.equal(plates.length,3);
  assert.ok(plates.every(shape=>shape.length>=3));
 }
 assert.equal(keys.size,6);
 const sizes=realms.map(realm=>T.footprint(realm,T.nodes(realm)[0]).length);
 assert.ok(new Set(sizes).size>=5,'gear, triangle, diamond, ice shelf, leaf and volcanic ridge are distinct');
});
test('arena walls enforce the actual shape and reflect ball velocity into the arena',()=>{
 const T=terrain();
 for(const realm of realms){
  const p=actor(499,250);p.vx=7;p.vy=0;
  assert.equal(T.boundaryBounce(p,realm,500,500),true);
  assert.ok(T.arenaClearance(realm,p.x,p.y)>=p.radius*.65-.01,realm+' outside arena');
  assert.ok(p.vx<7,realm+' wall must redirect outgoing momentum');
  assert.ok(Number.isFinite(p.vy));
  assert.ok(p._towerRimBounce>0);
 }
});
test('post-movement sync restores a high-speed fighter to the actual realm footprint',()=>{
 const T=terrain(),p=actor(-80,200);T.step('ice',4,[p],500,500,0);
 p.x=-20;p.vx=-9;T.sync([p]);
 assert.ok(T.isWalkable('ice',p.x,p.y,500,500,p.radius*.6));
 assert.ok(p.vx>0,'world edge ricochet restores momentum');
 T.clear([p]);assert.equal(p.towerGroundZ,undefined);
});
test('ring, ridge, fault and gravity sink are actual elevation fields',()=>{
 const T=terrain();
 assert.ok(T.heightAt('time',4,250+172.5,250)>5,'clock rail is raised');
 assert.ok(T.heightAt('storm',4,250,242)>0,'storm diagonal crest');
 const left=T.heightAt('ice',4,250,235),side=T.heightAt('ice',4,250,208);
 assert.ok(left<side,'ice fissure is lower than adjacent shelf');
 assert.ok(T.heightAt('forest',4,245,245)>0,'roots form a ridge');
 const x=T.heightAt('space',4,175,295),y=T.heightAt('space',4,175,355);
 assert.ok(x>=0&&y>=0);
});
test('terrain physics is scoped to Tower battles and reset on exit',()=>{
 const T=terrain(),p=actor(495,250);assert.equal(p.towerGroundZ,undefined);
 T.step('space',2,[p],500,500,90);
 assert.equal(p.towerGravity,.34);T.clear([p]);assert.equal(p.towerGravity,undefined);
 assert.equal(T.obstructsShot(0,250,2,500,250,2),false);
});
test('tactical melee fighter makes intermittent deliberate body clashes while ranged fighter keeps spacing',()=>{
 const w={Math,Map,Set,Number,console,canvas:{width:500,height:500}};w.window=w;vm.createContext(w);
 vm.runInContext(read('js/features/arena-auto-ai.js'),w);
 const mk=(type,x)=>({playerNum:x, x,y:240,vx:0,vy:0,hp:300,maxHp:300,radius:24,
  _aiClock:110,forgeTicks:[90],forge:{skills:[{trigger:'auto',cooldown:1,actions:[{type,radius:110,damage:25}]}]}});
 const melee=mk('slash',155),ranged=mk('shot',255);
 const stance=w.ArenaAutoAI.stance(melee,ranged);
 assert.equal(stance.mode,'clash');assert.ok(stance.x>0);
 assert.notEqual(w.ArenaAutoAI.stance(ranged,melee).mode,'clash');
 assert.equal(melee.hp,300,'decision does not change actual damage');
});
