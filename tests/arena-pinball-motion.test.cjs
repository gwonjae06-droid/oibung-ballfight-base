'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={Math,Number,Set,Map,console,canvas:{width:500,height:500}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 vm.runInContext(read('js/features/arena-pinball-motion.js'),g);
 vm.runInContext(read('js/features/arena-auto-ai.js'),g);
 return g;
}
const ball=(id='test',vx=2.4,vy=1.1)=>({
 id,playerNum:1,hp:250,maxHp:250,radius:22,x:245,y:245,vx,vy,
 slowTimer:0,slowMultiplier:1,forge:{signatureVersion:1,archetype:'ranged',speed:2.5,
 skills:[{trigger:'auto',cooldown:3,actions:[{type:'shot',damage:10,radius:200}]}]}});
const target=(x,y)=>({playerNum:2,hp:220,maxHp:220,x,y,radius:22,vx:0,vy:0});
test('each ball keeps its heading even when the opponent changes position',()=>{
 const g=world(),M=g.ArenaPinballMotion;
 const p=ball(),before={x:p.vx,y:p.vy};
 const heading=Math.atan2(p.vy,p.vx);
 for(let i=0;i<150;i++){
  const frame=M.begin(p),foe=i%2?target(0,500):target(500,0);
  assert.equal(g.ArenaAutoAI.steer(p,foe,5),true);
  M.end(p,frame);
  assert.ok(Math.abs(Math.atan2(p.vy,p.vx)-heading)<1e-9);
 }
 assert.ok(Math.hypot(p.vx,p.vy)>2);
 assert.ok(before.x*p.vx+before.y*p.vy>0,'never turned to face the target');
});
test('all archetypes, classic balls and transient tower enemies roll without target seeking',()=>{
 const g=world(),M=g.ArenaPinballMotion;
 for(const archetype of ['melee','ranged','defense','mobility','control','legacy',null]){
  const p=ball(),b=M.begin(p);
  if(archetype===null)delete p.forge;
  else p.forge.archetype=archetype;
  p.vx=-5;p.vy=0; // simulated chase written by obsolete behavior
  assert.equal(M.end(p,b),true);
  assert.ok(p.vx>0&&p.vy>0,'previous physical trajectory must survive, not chase result');
  assert.equal(p.aiManeuver,'pinball');
 }
 const tower=ball();tower.towerEnemy=true;tower.towerPatternBoss=true;
 const snap=M.begin(tower);tower.vx=-5;M.end(tower,snap);
 assert.ok(tower.vx>0,'ordinary tower boss ball must also move freely');
});
test('resting fighters receive a deterministic non-targeted launch, without freezing',()=>{
 const g=world(),M=g.ArenaPinballMotion;
 const p=ball('test',0,0),a=M.begin(p);
 const direction=M.initialDirection(p);
 assert.equal(M.end(p,a),true);
 assert.ok(Math.hypot(p.vx,p.vy)>=1.4);
 assert.ok(Math.abs(p.vx/Math.hypot(p.vx,p.vy)-direction.x)<1e-9);
 const second=ball('test',0,0),b=M.begin(second);M.end(second,b);
 assert.equal(p.vx,second.vx);assert.equal(p.vy,second.vy);
});
test('collision and wall-reflected velocities are respected rather than reset or re-aimed',()=>{
 const g=world(),M=g.ArenaPinballMotion,p=ball();
 let before=M.begin(p);p.vx=-p.vx;p.vy=p.vy; // wall rebound in world physics
 // Rebound happens AFTER ability update, not inside ordinary animation.
 M.end(p,before); // Existing velocity from before ability update is authoritative.
 p.vx=-4;p.vy=1.2;
 for(let i=0;i<12;i++){before=M.begin(p);M.end(p,before);assert.ok(p.vx<0,'reflection keeps heading');}
 const a=Math.hypot(p.vx,p.vy);assert.ok(a>3.4,'real collision speed not prematurely erased');
});
test('dash, charge, jumps, scripted movement and the built-in bull rush keep targeting',()=>{
 const g=world(),M=g.ArenaPinballMotion;
 for(const fields of [
  {forgeDash:20},{movementOnlyFrames:8},{_scratchMove:{type:'dash'}},
  {forgeCharge:{phase:'charging'}},{forgePhase:{kind:'burrow',time:80}},
  {jumpState:'rising'},{id:'choi',suneungState:'success'}]){
  const p=Object.assign(ball(),fields),b=M.begin(p);
  p.vx=-6;p.vy=-1;assert.equal(M.end(p,b),false,JSON.stringify(fields));
  assert.equal(p.vx,-6);assert.equal(p.vy,-1);
 }
 const free=ball();const snapshot=M.begin(free);
 free.forgeDash=25;free.vx=-8;free.vy=4;
 assert.equal(M.end(free,snapshot),false,'dash started THIS frame must be preserved');
 assert.equal(free.vx,-8);
});
test('ancient background boss remains anchored, and manual controls stay untouched',()=>{
 const g=world(),M=g.ArenaPinballMotion;
 g.ArenaTower={active:true,state:{ancient:true}};
 const old=ball();old.towerEnemy=true;
 assert.equal(M.enabled(old),false);assert.equal(M.begin(old),null);
 const hero=ball();assert.equal(M.enabled(hero),true);
 hero.manualTower=true;assert.equal(M.enabled(hero),false);
});
test('built-in homing movement is removed while its actual ability update still runs',()=>{
 const g=world(),M=g.ArenaPinballMotion;
 g.CHARACTER_DEFS=[];g.BEHAVIORS={};g.CHARACTER_PHOTOS={};
 g.players=[];g.particles=[];g.addFloatingText=()=>{};
 vm.runInContext(read('js/characters/oh.js'),g);
 const p=g.CHARACTER_DEFS[0].createInstance(1);
 p.x=190;p.y=200;p.vx=2;p.vy=.8;
 const foe=target(400,200),before=M.begin(p);
 g.players=[p,foe];
 g.BEHAVIORS.oh.update(p,foe);
 assert.ok(p.vx>before.vx,'original legacy movement did chase before suppression');
 M.end(p,before);
 assert.ok(p.vx>0&&p.vy>0,'pinball restores independent heading');
 assert.equal(p.modeTimer,1,'ability timers still advance');
 p.mode='menhera';p.shootTimer=p.shootCooldown-1;
 const beforeShot=M.begin(p);
 g.BEHAVIORS.oh.update(p,foe);
 M.end(p,beforeShot);
 assert.equal(p.projectiles.length,1,'target-aware projectile still fires');
 assert.ok(p.projectiles[0].vx>0,'projectile tracks enemy position');
});
test('auto combat AI movement is disabled but aiming and canCast logic remain available',()=>{
 const g=world(),p=ball(),foe=target(420,250);
 let b={vx:p.vx,vy:p.vy};
 assert.equal(g.ArenaAutoAI.steer(p,foe,3),true);
 assert.deepEqual({vx:p.vx,vy:p.vy},b);
 assert.equal(g.ArenaAutoAI.react({...p,forge:null},foe),false);
 assert.equal(g.ArenaAutoAI.canCast(p,foe,{actions:[{type:'shot',radius:200}]}),true);
 assert.equal(typeof g.ArenaAutoAI.targetFor,'function');
 assert.equal(typeof g.ArenaAutoAI.risk,'function');
});
test('engine wraps every ordinary behavior update, and both runtime pages load pinball AI',()=>{
 const engine=read('js/core/engine.js'),ai=read('js/features/arena-auto-ai.js');
 assert.match(engine,/ArenaPinballMotion\?\.begin/);
 assert.match(engine,/ArenaPinballMotion\?\.end/);
 assert.match(engine,/players\.forEach\(p=>\{/);
 assert.match(ai,/ArenaPinballMotion\?\.enabled/);
 for(const name of ['index.html','pvp-runtime.html']){
  const src=read(name);
  assert.ok(src.includes('arena-pinball-motion.js'),name);
  assert.ok(src.indexOf('arena-pinball-motion.js')<src.indexOf('arena-auto-ai.js'));
 }
 const skill=read('js/features/skill-forge.js');
 assert.match(skill,/const angle=Math\.atan2\(near\.y-p\.y,near\.x-p\.x\)/);
 assert.match(skill,/p\.forgeDash=Math\.round/);
});
