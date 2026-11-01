'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function boot(){
 const nodes={};
 const top={append(el){nodes[el.id]=el;}};
 function node(){
  const slots={};
  return {
   dataset:{},classList:{add(){},remove(){}},style:{},hidden:true,offsetWidth:20,
   setAttribute(k,v){this[k]=v;},
   querySelector(s){return slots[s]??(slots[s]={textContent:'',style:{}});}
  };
 }
 const g={
  console,Math,Set,Map,WeakMap,Date,BEHAVIORS:{},canvas:{width:500,height:500},
  ArenaScreenRouter:{active:'pve'},players:[],
  document:{getElementById(id){return nodes[id]||null;},
   querySelector(s){return s==='.battle-screen .arena-heading'?top:null;},
   createElement(){return node();}},
  addFloatingText(){},createHitParticles(){},screenShake:0
 };
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const f of ['js/features/bounce-momentum.js','js/features/arena-combat-v2.js',
  'js/features/arena-body-physics.js','js/core/engine.js','js/features/tower-flat-arena.js'])
  vm.runInContext(read(f),g,{filename:f});
 return {g,nodes};
}
const fighter=(n=1,forge)=>({
 playerNum:n,hp:250,maxHp:250,x:180+(n-1)*46,y:245,
 radius:28,vx:n===1?3:-3,vy:0,_combat2Tick:1,
 jumpState:'ground',forge
});
test('HUD is visible at COMBO 0 before combat, even with no signature profile',()=>{
 const {g,nodes}=boot();
 g.ArenaCombatV2.reset();
 const el=nodes['arena-combo-status'];
 assert.ok(el,'header element is created by match reset, not by first signature');
 assert.equal(el.hidden,false);
 assert.equal(el.dataset.combo,'0');
 assert.equal(el.querySelector('.combo-number').textContent,'0');
 assert.match(el.querySelector('.combo-message').textContent,/첫 충돌/);
});
test('actual engine body collision increments combo for both legacy built-in fighters',()=>{
 const {g,nodes}=boot();g.ArenaCombatV2.reset();
 const a=fighter(),b=fighter(2);
 g.handleCombat(a,b);
 assert.equal(a._combat2Combo.chain,1);
 assert.equal(b._combat2Combo.chain,1);
 assert.equal(nodes['arena-combo-status'].hidden,false);
 assert.equal(nodes['arena-combo-status'].dataset.combo,'1');
 assert.equal(a.hp,250);assert.equal(b.hp,250,'the scoreboard is visual only');
 assert.equal(a._combat2NextBoost,undefined,'legacy fighters never get free signature damage');
 assert.equal(b._combat2NextBoost,undefined);
 b._combat2Tick=50;
 assert.equal(g.ArenaCombatV2.signal(b,'wall-left',5),true);
 assert.equal(nodes['arena-combo-status'].dataset.combo,'2');
 assert.match(nodes['arena-combo-status'].querySelector('.combo-message').textContent,/P2/);
});
test('real tower wall and bumper collide without momentum meter and can reach 2-combo',()=>{
 const {g,nodes}=boot();
 g.ArenaScreenRouter.active='tower';
 g.ArenaCombatV2.reset();
 const a=fighter();
 a.x=10;a.y=250;a.vx=-4;a.vy=0;a._combat2Tick=4;
 assert.equal(g.ArenaTowerFlat.bounce(a,'time',500,500,1,4),true);
 assert.equal(a._combat2Combo.chain,1);
 assert.equal(nodes['arena-combo-status'].dataset.combo,'1');
 a._combat2Tick=65;
 assert.equal(g.ArenaCombatV2.signal(a,'wall-right',6),true);
 assert.equal(a._combat2Combo.chain,2);
 assert.equal(nodes['arena-combo-status'].dataset.combo,'2');
 assert.equal(g.ArenaCombatV2.signal(a,'wall-right',6),false);
});
test('exhausted combo resets to visible 0 with latest best, not disappearing',()=>{
 const {g,nodes}=boot(),p=fighter();
 g.ArenaCombatV2.reset();
 g.ArenaCombatV2.signal(p,'wall-left',5);p._combat2Tick=50;
 g.ArenaCombatV2.signal(p,'wall-right',6);
 assert.equal(nodes['arena-combo-status'].dataset.combo,'2');
 p._combat2Tick=260;g.ArenaCombatV2.ui(p);
 assert.equal(nodes['arena-combo-status'].hidden,false);
 assert.equal(nodes['arena-combo-status'].dataset.combo,'0');
 assert.equal(nodes['arena-combo-status'].dataset.best,'2');
 assert.match(nodes['arena-combo-status'].querySelector('.combo-message').textContent,/최고 2콤보/);
 g.ArenaCombatV2.reset();
 assert.equal(nodes['arena-combo-status'].dataset.best,'0');
});
test('legacy combo stays visual while signature combo keeps 100-energy one-cast reward',()=>{
 const {g}=boot(),old=fighter(1,{signatureVersion:0}),modern=fighter(2,{signatureVersion:1});
 for(const p of [old,modern]){
  for(const [i,kind] of ['wall-left','wall-right','bumper-0'].entries()){
   p._combat2Tick=1+i*40;p._forgeActionClock=1+i*40;
   assert.equal(g.ArenaCombatV2.signal(p,kind,7),true);
  }
 }
 assert.equal(old._combat2NextBoost,undefined);
 assert.equal(old._bounceMomentum,undefined);
 assert.equal(modern._combat2NextBoost,1.10);
 assert.ok(g.BounceMomentum.meter(modern)>0);
});
test('combo cannot score PvP, tower enemies, or repeated overlap spam',()=>{
 const {g,nodes}=boot(),p=fighter();
 g.ArenaCombatV2.reset();
 assert.equal(g.ArenaCombatV2.signal(p,'wall-left',6),true);
 assert.equal(g.ArenaCombatV2.signal(p,'wall-left',6),false);
 g.ArenaScreenRouter.active='pvp';p._combat2Tick=80;
 assert.equal(g.ArenaCombatV2.signal(p,'wall-right',6),false);
 assert.equal(g.ArenaCombatV2.ui(p),undefined);
 const boss=fighter(2);boss.towerEnemy=true;
 assert.equal(g.ArenaCombatV2.signal(boss,'wall-right',6),false);
 assert.ok(nodes['arena-combo-status']);
});
test('new versions load correctly and engine clock updates legacy fighters every tick',()=>{
 const html=read('index.html'),engine=read('js/core/engine.js'),css=read('css/combo-celebration.css');
 assert.match(html,/arena-combat-v2\.js\?v=4-visible-tower-sibling/);
 assert.match(html,/tower-flat-arena\.js\?v=5-surface-chain/);
 assert.match(html,/engine\.js\?v=[^"]+combo-all/);
 assert.match(engine,/p\._combat2Tick=\(p\._combat2Tick\|\|0\)\+1/);
 assert.match(css,/arena-combo-status\[hidden\]/);
});
