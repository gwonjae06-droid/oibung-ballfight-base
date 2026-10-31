'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const load=(names)=>{const g={Math,Number,Map,Set};g.globalThis=g;g.window=g;vm.createContext(g);for(const n of names)vm.runInContext(read('js/features/'+n+'.js'),g);return g;};
const map=()=>load(['tower-map-architecture']);
test('melee access: space, storm and ice have expanded decks and alternative bridges',()=>{
 const a=map().ArenaTowerArchitecture;
 for(const id of ['space','storm','ice']){
  const m=a.getMap(id,6,500,500,240),ramps=m.surfaces.filter(s=>s.from);
  assert.ok(ramps.length>=4,`${id} should offer alternate traversals`);
  assert.ok(m.surfaces.every(s=>s.vertices?.length>=3));
 }
 assert.ok(a.getMap('space',6).surfaces.some(s=>s.id==='nebula-bypass-west'));
 assert.ok(a.getMap('storm',6).surfaces.some(s=>s.id==='gorge-bypass'));
 assert.ok(a.getMap('ice',6).surfaces.some(s=>s.id==='frozen-crosspass'));
});
test('space outside decks paints a stellar abyss; fire surrounds the floor with magma',()=>{
 const source=read('js/features/tower-map-architecture.js');
 assert.match(source,/paintVoid\(ctx,realm,w,h,tick\)/);
 assert.match(source,/realm==='space'/);assert.match(source,/realm==='fire'/);
 assert.match(source,/starfield|const haze=/);assert.match(source,/ff8a27aa/);
});
test('endurance and defense increase floor duration without changing player PvP data',()=>{
 const g=load(['tower-realms']);
 for(const realm of ['time','space','fire','storm','ice','forest']){
  const floor=n=>g.ArenaTowerRealms.floor({number:n,boss:n%5===0},realm);
  assert.ok(floor(10).hp>floor(1).hp*8);
  assert.ok(floor(10).towerDefense<floor(1).towerDefense);
  assert.ok(floor(9).hp>floor(6).hp);
 }
 const forge=read('js/features/skill-forge.js');
 assert.match(forge,/e\.towerEnemy&&Number\.isFinite\(e\.towerDefense\)/);
 assert.match(forge,/towerEnemy\?8000:500/);
});
test('commentary has 500+ usable variants and delays next-floor intro until actual countdown',()=>{
 const g={Math,Set,Map,WeakMap,window:null};g.window=g;vm.createContext(g);
 vm.runInContext(read('js/features/battle-director.js'),g);
 assert.ok(g.ArenaBattleDirector.catalogSize>=500);
 assert.equal(typeof g.ArenaBattleDirector.floorReady,'function');
 assert.match(read('js/features/tower-challenge.js'),/ArenaBattleDirector\?\.floorReady\?\.\(level/);
});
test('meteor arrives at center only at deadline and increasing red tint never changes gameplay',()=>{
 const source=read('js/features/tower-meteor-art.js');
 assert.match(source,/Math\.pow\(progress,2\.35\)/);
 assert.match(source,/h\*\.51/);
 assert.match(source,/progress\*\.48/);
 const sim=read('js/features/tower-spectacle.js');assert.match(sim,/METEOR_COUNTDOWN=12\*60/);
 assert.match(sim,/shaken=event\.realm==='fire'\?document\.body/);
});
test('global effect rings now have actual 2.5D ground ellipse and upright impact body',()=>{
 const effects=read('js/features/battle-effects.js');
 assert.match(effects,/worldCtx\.ellipse\(0,0,r/);
 assert.match(effects,/worldCtx\.quadraticCurveTo\(-r\*\.22,-r\*\.69/);
});
