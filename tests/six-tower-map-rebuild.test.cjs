'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
function load(){const g={Math,Number,Map,Set,console};g.globalThis=g;g.window=g;vm.createContext(g);
 for(const f of ['ball-impact-squash','tower-map-architecture','tower-terrain-25d'])
 vm.runInContext(read('js/features/'+f+'.js'),g,{filename:f});return g;}
const positions={
 time:[[250,376],[250,248]],space:[[253,417],[256,280]],
 fire:[[235,413],[381,231]],storm:[[109,393],[371,157]],
 ice:[[250,396],[257,134]],forest:[[241,418],[345,172]]};
test('all six Tower maps have different genuine deck/bridge polygons and validated spawns',()=>{
 const g=load(),A=g.ArenaTowerArchitecture;let keys=new Set(),sizes=new Set();
 for(const [realm,spawns] of Object.entries(positions)){
  const map=A.getMap(realm,10,500,500,60),decks=map.surfaces.filter(s=>!s.from),bridges=map.surfaces.filter(s=>s.from);
  assert.ok(decks.length>=3,realm+' has multiple independent architectural decks');
  assert.ok(bridges.length>=2,realm+' has navigable physical links');
  assert.ok(map.surfaces.every(s=>s.vertices.length>=3),realm+' all surfaces have real collision geometry');
  keys.add(map.surfaces.map(s=>s.id).join(':'));sizes.add(map.surfaces.length);
  for(const [x,y] of spawns)assert.ok(A.at(realm,10,x,y,500,500,60).surface,realm+' spawn in void');
  assert.equal(A.at(realm,10,2,2,500,500,60).height,0,realm+' no invisible square base');
 }
 assert.equal(keys.size,6);assert.ok(sizes.size>=4,'not the same three-plate template');
});
test('architecture renders the void plus elevated sidewalls; path exits actual play surface',()=>{
 const g=load(),A=g.ArenaTowerArchitecture;
 const calls={paths:0,fill:0,rects:0,colors:new Set()};
 const ctx=new Proxy({}, {get(o,k){return k in o?o[k]:k==='createLinearGradient'||k==='createRadialGradient'?
   ()=>({addColorStop(){}}):k==='beginPath'?()=>{calls.paths++;}:k==='fillRect'?()=>{calls.rects++;}:k==='fill'?()=>{calls.fill++;}:()=>{};},set(o,k,v){if(k==='fillStyle'&&typeof v==='string')calls.colors.add(v);o[k]=v;return true;}});
 for(const realm of Object.keys(positions)){const prev=calls.paths;
  assert.equal(A.paint(ctx,realm,10,500,500,90),true);
  assert.ok(calls.paths-prev>=8,'separate raised plate geometry');
 }
 assert.ok(calls.rects>=6&&calls.fill>=24);
 assert.ok(calls.rects>=6,'each arena paints its own full-screen void backdrop');
});
test('height matches top surfaces, real ramps, and moving platform geometry',()=>{
 const A=load().ArenaTowerArchitecture;
 assert.ok(A.heightAt('ice',10,253,131,500,500,60)>75);
 assert.ok(A.heightAt('space',10,380,180,500,500,60)>60);
 assert.ok(A.heightAt('fire',10,248,265,500,500,60)<30);
 const a=A.getMap('space',8,500,500,0),b=A.getMap('space',8,500,500,90);
 assert.notEqual(a.surfaces.find(s=>s.id==='northeast-isle').z,b.surfaces.find(s=>s.id==='northeast-isle').z);
 const before=A.heightAt('ice',8,250,393,500,500,400),after=A.heightAt('ice',8,250,393,500,500,440);
 assert.ok(after<before,'ice lake physically sinks on collapse');
});
test('bridges have usable waypoints and bounds bounce projectiles and fighters',()=>{
 const g=load(),A=g.ArenaTowerArchitecture;
 for(const [realm,[start,end]] of Object.entries(positions)){
  const wp=A.nextWaypoint(realm,{x:start[0],y:start[1]},{x:end[0],y:end[1]},500,500,10,60);
  assert.ok(wp,realm+' route across separate decks');
  assert.ok(Number.isFinite(wp.x)&&Number.isFinite(wp.y));
  const p={x:490,y:250,radius:18,vx:8,vy:0,hp:100,maxHp:100};
  assert.equal(A.bounce(p,realm,500,500,10,60),true);
  assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.vx));
 }
});
test('ball squash compresses along collision normal, stretches, and returns without changing gameplay physics',()=>{
 const squash=load().ArenaBallSquash,a={hp:100,x:10,y:10,vx:3,vy:2,radius:18},b={hp:100,vx:-3,vy:0,radius:18};
 const before={...a};assert.equal(squash.pair(a,b,-7,1,0),true);
 for(const k of ['hp','x','y','vx','vy','radius'])assert.equal(a[k],before[k]);
 for(let i=0;i<3;i++)squash.tick(a);
 assert.ok(squash.pose(a).sx<1);assert.ok(squash.pose(a).sy>1);
 for(let i=0;i<4;i++)squash.tick(a);
 assert.ok(squash.pose(a).sx>1,'spring overshoots into stretch');
 for(let i=0;i<14;i++)squash.tick(a);
 assert.deepEqual({...squash.pose(a)},{sx:1,sy:1,angle:0,compression:0});
 assert.equal(squash.pair(a,b,0,1,0),false,'non-impact must not distort the body');
});
test('integration loads both visual-only squash and new map before the Tower engine',()=>{
 const html=read('index.html'),engine=read('js/core/engine.js'),render=read('js/core/render.js');
 assert.ok(html.indexOf('ball-impact-squash.js')<html.indexOf('js/core/engine.js'));
 assert.ok(html.indexOf('tower-map-architecture.js')<html.indexOf('tower-terrain-25d.js'));
 assert.match(engine,/ArenaBallSquash\?\.pair/);assert.match(render,/ArenaBallSquash\?\.pose/);
 assert.match(read('js/features/tower-challenge.js'),/Real architectural islands/);
});
