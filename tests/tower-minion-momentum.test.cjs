'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={console,Math,Date,WeakMap,Set,Map,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  createHitParticles(){},addFloatingText(){},canvas:{width:500,height:500}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['js/features/action-registry.js','js/features/forge-archetypes.js','js/features/basic-attacks.js',
  'js/features/signature-program.js','js/features/signature-scratch.js','js/features/signature-live.js',
  'js/features/bounce-momentum.js','js/features/arena-balance.js','js/features/skill-forge.js',
  'js/features/ball-impact-squash.js','js/features/arena-body-physics.js']){
  vm.runInContext(read(file),g,{filename:file});
 }
 return g;
}
const profile=()=>({name:'탑 수호석',hp:330,speed:2.3,skills:[
 {name:'속성 투사체',trigger:'auto',cooldown:.2,actions:[{type:'shot',damage:20,radius:160}]},
 {name:'방어막',trigger:'lowhp',threshold:30,cooldown:.2,actions:[{type:'shield',damage:0,radius:100}]},
 {name:'충격파',trigger:'damaged',cooldown:.2,actions:[{type:'wave',damage:18,radius:100}]}
]});
function mob(g){g.SkillForge.register(profile(),{towerEnemy:true});
 const p=g.CUSTOM_DEFS[g.CUSTOM_DEFS.length-1].createInstance(2);
 p.x=300;p.y=250;p.towerEnemy=true;p.towerPatternBoss=false;p._minionEnergyCursor=0;
 return p;
}
const foe=()=>({x:100,y:250,vx:0,vy:0,playerNum:1,radius:24,hp:10000,maxHp:10000,invincible:0});
test('tower minions have a meter without requiring a boss flag or new signature profile',()=>{
 const g=world(),p=mob(g),M=g.BounceMomentum;
 assert.equal(p.forge.signatureVersion,0);
 assert.equal(M.isMinion(p),true);
 assert.equal(M.isBoss(p),false);
 assert.equal(M.enabled(p),true);
 assert.equal(M.meter(p),0);
 const boss={...p,towerPatternBoss:true};
 assert.equal(M.isBoss(boss),true);
 assert.equal(M.isMinion(boss),false);
 const player={...p,towerEnemy:false};
 assert.equal(M.isMinion(player),false);
});
test('wall rebounds and physical collisions charge minions, limit per-event farming',()=>{
 const g=world(),M=g.BounceMomentum,p=mob(g),other=foe();other.forge={signatureVersion:1};
 assert.equal(M.wall(p,0.4),false);
 assert.equal(M.wall(p,4),true);
 assert.equal(M.meter(p),9);
 assert.equal(M.wall(p,4),false);
 const first=M.meter(p);
 assert.equal(M.contact(p,other,-3),true);
 assert.ok(M.meter(p)>first);
 assert.equal(M.contact(p,other,-3),false);
 const clock=p._forgeActionClock||0;p._forgeActionClock=clock+40;
 assert.equal(M.contact(p,other,-3),true);
});
test('minions earn less confirmed-hit energy than bosses, with no reward for blocked hits',()=>{
 const g=world(),M=g.BounceMomentum,p=mob(g),b={...p,towerPatternBoss:true};
 assert.equal(M.damageTaken(p,0),false);
 assert.equal(M.damageTaken(p,-4),false);
 assert.equal(M.meter(p),0);
 assert.equal(M.damageTaken(p,30),true);
 assert.equal(M.damageTaken(b,30),true);
 assert.ok(M.meter(p)<M.meter(b));
});
test('one filled bar casts exactly one authored minion skill, rotates over all skills',()=>{
 const g=world(),p=mob(g),enemy=foe();g.players.push(p,enemy);
 const M=g.BounceMomentum;
 for(let i=0;i<30;i++)g.SkillForge.autoUpdate(p,enemy);
 assert.equal(p._bounceCasts||0,0,'legacy sub-second cooldown must not cast');
 for(let n=0;n<3;n++){
  M.add(p,100,'script');
  assert.equal(M.ready(p),true);
  g.SkillForge.autoUpdate(p,enemy);
  assert.equal(p._bounceCasts,n+1,'one bar = one cast');
  assert.equal(p._minionEnergyCursor,n+1,'all available skills should cycle');
  assert.equal(M.meter(p),0,'meter consumed');
  g.SkillForge.autoUpdate(p,enemy);
  assert.equal(p._bounceCasts,n+1,'no free follow-up cast');
 }
 assert.equal(p.hp,p.maxHp,'test enemy cannot damage self');
});
test('minion passive charge is bounded and disabled without a living opponent',()=>{
 const g=world(),M=g.BounceMomentum,p=mob(g),enemy=foe();
 for(let i=0;i<600;i++){p._forgeActionClock=i+1;M.tick(p,enemy);}
 assert.ok(M.meter(p)>70&&M.meter(p)<100,'slower than boss, enough to avoid softlock');
 const saved=M.meter(p);M.tick(p,{hp:0});assert.equal(M.meter(p),saved);
 M.add(p,999,'script');assert.equal(M.meter(p),100);
 assert.equal(M.spend(p),true);assert.equal(M.spend(p),false);
});
test('normal minions use real mass-based bounce and visible squash/stretch',()=>{
 const g=world(),p=mob(g),e={...mob(g),playerNum:3,x:260,y:250,vx:4,vy:0};
 p.x=310;p.y=250;p.vx=-4;p.vy=0;
 const before=p.vx;
 const impact=g.ArenaBodyPhysics.pair(p,e,-1,0);
 assert.ok(impact&&impact.impulse>0);
 assert.ok(p.vx>before,'actual momentum changes heading');
 assert.equal(g.ArenaBallSquash.pair(p,e,-5,-1,0),true);
 for(let i=0;i<3;i++)g.ArenaBallSquash.tick(p);
 const squash=g.ArenaBallSquash.pose(p);
 assert.ok(squash.sx<1&&squash.sy>1,'visible compression');
 for(let i=0;i<4;i++)g.ArenaBallSquash.tick(p);
 assert.ok(g.ArenaBallSquash.pose(p).sx>1,'spring stretches');
});
test('boss and ancient pattern spending still use their own shared 100 bar',()=>{
 const g=world(),p=mob(g),M=g.BounceMomentum;
 p.towerPatternBoss=true;p._bossMomentumPhase='pattern';
 M.add(p,100,'script');
 assert.equal(M.bossCan(p,'pattern'),true);
 assert.equal(M.bossSpend(p,'pattern'),true);
 assert.equal(M.meter(p),0);
 assert.equal(M.bossPhase(p),'skill');
 p._ancientEnergyOnly=true;M.add(p,100,'script');
 assert.equal(M.bossCan(p,'skill'),true);
 assert.equal(M.bossSpend(p,'skill'),true);
 assert.equal(M.bossPhase(p),'pattern');
});
test('tower interface and game HUD show one shared minion energy bar',()=>{
 const tower=read('js/features/tower-challenge.js'),hud=read('js/core/engine.js');
 assert.match(tower,/기세 100 충전 시/);
 assert.match(tower,/공통 기세 게이지 사용/);
 assert.match(hud,/const visibleIndices=sharedEnergy\?\[0\]/);
 for(const file of ['index.html','pvp-runtime.html']){
  const html=read(file);
  assert.match(html,/js\/features\/bounce-momentum\.js\?v=/,'versioned momentum module must load');
  assert.match(html,/js\/features\/skill-forge\.js\?v=[^"']+/);
  assert.match(html,/js\/core\/engine\.js\?v=[^"']+/);
 }
});
