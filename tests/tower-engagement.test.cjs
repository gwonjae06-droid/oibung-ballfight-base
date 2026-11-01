/* Focused tests for tactical commands, tower pacing and dodge-break logic. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function moduleAt(rel,extras={}){
 const g={...extras};
 g.globalThis=g;g.window=g;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',rel),'utf8'),g,{filename:rel});
 return g;
}
test('tactical orders have two per-floor charges, only affect tower hero and expire in simulation ticks',()=>{
 const hero={towerHero:true,manualTower:false,hp:200,maxHp:200,x:200,y:200,vx:3,vy:1,forge:{signatureVersion:1}};
 const g=moduleAt('js/features/tower-tactics.js',{ArenaTower:{active:true,stage:'fighting'},players:[hero]});
 const t=g.ArenaTowerTactics;
 assert.equal(t.choose('attack'),true);
 assert.equal(t.modeFor({towerHero:true}),'attack');
 assert.equal(t.modeFor({towerHero:false}),'');
 assert.equal(t.choose('evade'),true);
 assert.equal(t.choose('hold'),false);
 assert.equal(t.state.remaining,0);
 for(let i=0;i<t.DURATION;i++)t.tick();
 assert.equal(t.modeFor({towerHero:true}),'');
 t.reset();
 assert.equal(t.state.remaining,2);
 assert.equal(t.choose('hold'),true);
 g.ArenaTower.stage='between';
 assert.equal(t.modeFor({towerHero:true}),'');
 assert.equal(t.choose('attack'),false);
});
test('tower high-floor enemy HP no longer inflates by 2.75x',()=>{
 const g=moduleAt('js/features/tower-realms.js');
 const base={number:10,boss:true,hp:600,damage:50,speed:2,cooldown:2};
 const fire=g.ArenaTowerRealms.floor(base,'fire');
 assert.ok(fire.hp>500);
 assert.ok(fire.hp<2000,'endurance curve should make a shorter boss fight');
 const ice=g.ArenaTowerRealms.floor(base,'ice');
 assert.ok(ice.hp>fire.hp);
});
test('successfully avoiding boss telegraphs opens a temporary real damage window',()=>{
 const g=moduleAt('js/features/tower-encounters.js');
 const hero={x:-1000,y:-1000,radius:15,hp:500,maxHp:500};
 const boss={x:250,y:250,radius:20,hp:1000,maxHp:1000,towerDefense:.8};
 const enc=g.ArenaEncounter.create({realm:'time',level:5,hero,boss,width:500,height:500,damage(){return true;}});
 let seen=false;
 for(let i=0;i<1100;i++){
  enc.step();
  if(enc.weakpointFrames>0){
   seen=true;
   assert.ok(Math.abs(boss.towerDefense-1.2)<1e-9);
   break;
  }
 }
 assert.ok(seen,'dodged boss attacks should reveal a weak point');
 for(let i=0;i<180;i++)enc.step();
 assert.equal(boss.towerDefense,.8,'weak point closes after 3 simulated seconds');
});
test('only tower battles receive the earlier stalemate pressure',()=>{
 const g=moduleAt('js/features/arena-stalemate.js');
 assert.equal(g.ArenaStalemate.LIMITS.tower,105*60);
 assert.equal(g.ArenaStalemate.LIMITS.regular,300*60);
 const roster=[{hp:100,maxHp:100},{hp:100,maxHp:100}];
 for(let i=0;i<65*60;i++)g.ArenaStalemate.tick(roster,true);
 assert.ok(g.ArenaStalemate.state.active);
});
test('tower route selection is one-time, blocks the next fight until chosen',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/features/tower-challenge.js'),'utf8');
 assert.match(source,/routePending=\[3,6,8\]\.includes\(cleared\)/);
 assert.match(source,/routePending&&!routeSelected/);
 assert.match(source,/function chooseRoute\(id\)/);
 assert.match(source,/changeAttack\(foe,1\.25\)/);
});
