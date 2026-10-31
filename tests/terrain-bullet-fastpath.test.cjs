'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync('js/features/tower-terrain-25d.js','utf8');
const load=()=>{const w={};w.globalThis=w;vm.createContext(w);vm.runInContext(src,w);return w.ArenaTowerTerrain;};
const heroes=()=>[{x:85,y:90,z:0,hp:200,vx:0,vy:0,radius:22},{x:415,y:390,z:0,hp:200,vx:0,vy:0,radius:22}];
test('projectiles entirely above the highest platform do not hit geometry',()=>{
 const T=load();for(const realm of ['time','space','fire','storm','ice','forest']){
  const fighters=heroes();T.step(realm,10,fighters,500,500,250);
  assert.equal(T.obstructsShot(20,200,150,460,200,150),false,realm);
  T.clear(fighters);
 }
});
test('low straight shots still interact with the high platform after visual culling',()=>{
 const T=load(),roster=heroes();T.step('space',10,roster,500,500,0);
 assert.equal(T.obstructsShot(80,250,10,420,250,10),true);
 T.clear(roster);
 assert.equal(T.obstructsShot(80,250,10,420,250,10),false,'inactive tower must not block PvP');
});
