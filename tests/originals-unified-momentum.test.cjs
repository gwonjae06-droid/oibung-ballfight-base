'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function boot(){
 const rng=Object.create(Math);rng.random=()=>.56;
 const g={window:null,globalThis:null,Math:rng,Date,Set,Map,WeakMap,console,
  CHARACTER_DEFS:[],CUSTOM_DEFS:[],CHARACTER_PHOTOS:{},BEHAVIORS:{},players:[],
  ArenaScreenRouter:{active:'pve'},canvas:{width:500,height:500},
  addFloatingText(){},createHitParticles(){},
  ImpactPhysics:{hit(){}},BattleFX:{sound(){},caption(){},cast(){}},
  ArenaBattleDirector:{charge(){},originalUltimate(){},legacyHit(){}}};
 g.window=g;g.globalThis=g;
 vm.createContext(g);
 for(const id of ['bae','oh','lee','park','choi'])
   vm.runInContext(read('js/characters/'+id+'.js'),g);
 vm.runInContext(read('js/features/bounce-momentum.js'),g);
 vm.runInContext(read('js/features/original-momentum-ultimates.js'),g);
 return g;
}
function hero(g,id,n=1){
 const p=g.CHARACTER_DEFS.find(d=>d.id===id).createInstance(n);
 p.x=200;p.y=250;p.vx=2;p.vy=1;p._combat2Tick=1;
 return p;
}
function chargeCast(g,p,t,roster){
 const M=g.BounceMomentum,A=g.ArenaOriginalMomentum;
 p._combat2Tick+=60;
 assert.equal(M.add(p,100,'tactic'),true);
 assert.equal(M.ready(p),true);
 A.update(p,t,roster);
 assert.equal(M.meter(p),0);
}
test('all five original fighters use single 100 momentum; never old cooldown attack',()=>{
 const g=boot(),t={hp:1000,maxHp:1000,x:280,y:250,radius:28,invincible:0};
 for(const id of ['bae','oh','lee','park','choi']){
  const p=hero(g,id);
  assert.equal(g.BounceMomentum.enabled(p),true,id);
  const initial=t.hp;
  for(let i=0;i<30;i++){
   p._combat2Tick++;g.ArenaOriginalMomentum.update(p,t,[p,t]);
  }
  assert.equal(t.hp,initial,'original '+id+' may not deal uncharged periodic or basic attacks');
  assert.equal(g.ArenaOriginalMomentum.onContact(p,t),false,
   'ordinary uncharged collision is only physical');
  chargeCast(g,p,t,[p,t]);
  assert.equal(p._bounceCasts,1);
 }
});
test('Bae charges a wave, a second wave then blood collection, no off-meter casts',()=>{
 const g=boot(),p=hero(g,'bae'),t={hp:500,maxHp:500,x:286,y:250,
  radius:28,invincible:0,jumpState:'ground'};
 chargeCast(g,p,t,[p,t]);assert.equal(p.skillCycle,1);assert.equal(p.waves.length,1);
 for(let i=0;i<48;i++){p._combat2Tick++;g.ArenaOriginalMomentum.update(p,t,[p,t]);if(t.invincible>0)t.invincible--;}
 assert.ok(t.hp<500,'blood wave deals actual delayed cast damage');
 chargeCast(g,p,t,[p,t]);assert.equal(p.skillCycle,2);
 p.hp=160;chargeCast(g,p,t,[p,t]);assert.equal(p.skillCycle,0);
 assert.equal(p.hp,198);
});
test('Oh transforms only on meter, switching real momentum mass and movement modes',()=>{
 const g=boot(),p=hero(g,'oh'),t={hp:250,x:300,y:250};
 assert.equal(p.mode,'boin');
 chargeCast(g,p,t,[p,t]);assert.equal(p.mode,'menhera');
 assert.equal(p._originalMassBoost,1.48);
 assert.ok(p.invincible>=12);
 chargeCast(g,p,t,[p,t]);assert.equal(p.mode,'boin');
 assert.equal(p._originalMassBoost,1);
});
test('Lee uses one huge forward-arc jaw hit, never timer poke attacks',()=>{
 const g=boot(),p=hero(g,'lee'),t={hp:350,maxHp:350,x:323,y:250,
  radius:30,invincible:0};
 chargeCast(g,p,t,[p,t]);
 assert.ok(t.hp<350,'real cone hit');
 assert.equal(p._jawVisual.life,30);
 assert.equal(p.pokeAnim,1);
});
test('Park jumps above the target then crashes with one earned impact',()=>{
 const g=boot(),p=hero(g,'park'),t={hp:500,maxHp:500,x:235,y:250,
  radius:30,invincible:0};
 chargeCast(g,p,t,[p,t]);
 assert.equal(p.jumpState,'rising');assert.equal(t.hp,500);
 for(let i=0;i<60;i++){
  p._combat2Tick++;
  g.ArenaOriginalMomentum.update(p,t,[p,t]);
  if(t.invincible>0)t.invincible--;
 }
 assert.equal(p.jumpState,'ground');
 assert.ok(t.hp<500,'only charged landing impacts');
 assert.equal(p._bounceCasts,1);
});
test('Choi exam has 30/45/25 outcomes and charged bull alone deals contact damage',()=>{
 const g=boot(),p=hero(g,'choi'),t={hp:500,maxHp:500,x:260,y:250,
  radius:28,invincible:0};
 g.Math.random=()=>.1;chargeCast(g,p,t,[p,t]);
 assert.equal(p.suneungState,'fail');assert.equal(p.slowMultiplier,.62);
 assert.equal(g.ArenaOriginalMomentum.onContact(p,t),false);
 p.hp=170;p.slowTimer=0;
 g.Math.random=()=>.55;chargeCast(g,p,t,[p,t]);
 assert.equal(p.suneungState,'normal');assert.equal(p.hp,206);
 g.Math.random=()=>.92;chargeCast(g,p,t,[p,t]);
 assert.equal(p.suneungState,'success');
 const old=t.hp;assert.equal(g.ArenaOriginalMomentum.onContact(p,t),true);
 assert.ok(t.hp<old);
 p._combat2Tick+=246;t.invincible=0;
 assert.equal(g.ArenaOriginalMomentum.onContact(p,t),false);
});
test('all saved custom 4-skill fighters share a 100-point gauge; one skill per spend',()=>{
 const src=read('js/features/skill-forge.js'),m=read('js/features/bounce-momentum.js'),
  engine=read('js/core/engine.js');
 assert.match(m,/!!p\.forge\|\|!!g\.ArenaOriginalMomentum/);
 assert.match(src,/chargedPlayer&&i!==(p\._playerEnergyCursor/);
 assert.match(src,/if\(chargedPlayer\)p\._playerEnergyCursor/);
 assert.match(engine,/ArenaOriginalMomentum\.update\(self,foe,players\)/);
 assert.match(engine,/ArenaOriginalMomentum\.onContact\(a,b\)/);
 assert.match(engine,/ArenaOriginalMomentum\?\.isOriginal\?\.\(p\)/);
});
test('large single universal bar and commentator images/event hooks load on both game runtimes',()=>{
 const html=read('index.html'),pvp=read('pvp-runtime.html'),
  css=read('css/energy-broadcast.css'),director=read('js/features/battle-director.js');
 for(const src of [html,pvp])assert.ok(src.includes('js/features/original-momentum-ultimates.js'));
 assert.match(css,/forge-cooldown-track\{[\s\S]*?height:15px/);
 assert.match(css,/commentator-face/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(director,/function charge\(p,level\)/);
 assert.match(director,/function originalUltimate\(p,label/);
 assert.match(director,/function combo\(p,chain\)/);
 assert.match(director,/function expression\(kind\)/);
 assert.ok(html.includes('css/energy-broadcast.css'));
});
