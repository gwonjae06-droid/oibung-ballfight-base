'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={console,Math,Date,WeakMap,Set,Map,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
 createHitParticles(){},addFloatingText(){},canvas:{width:500,height:500}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['js/features/action-registry.js','js/features/forge-archetypes.js','js/features/basic-attacks.js',
  'js/features/signature-program.js','js/features/signature-scratch.js','js/features/signature-live.js',
  'js/features/bounce-momentum.js','js/features/arena-balance.js','js/features/skill-forge.js']){
  vm.runInContext(read(file),g,{filename:file});
 }
 return g;
}
function player(role='melee'){
 return {forge:{signatureVersion:1,archetype:role,effectColor:'#89addd'},hp:250,maxHp:250,
  x:0,y:0,radius:30,vx:2,vy:0,_forgeActionClock:1,_scratchEvents:Object.create(null)};
}
test('real body collisions grant both players bounded momentum, repeated overlaps do not farm',()=>{
 const g=world(),A=g.BounceMomentum,a=player(),b=player('defense');
 assert.equal(A.contact(a,b,-.5),false);
 assert.equal(A.contact(a,b,-2),true);
 assert.equal(A.meter(a),A.meter(b));
 assert.ok(A.meter(a)>=16);
 assert.equal(a._scratchEvents.contact.count,1);
 assert.equal(b._scratchEvents.contact.count,1);
 const saved=A.meter(a);
 a._forgeActionClock=23;b._forgeActionClock=23;
 assert.equal(A.contact(a,b,-3),false);
 assert.equal(A.meter(a),saved);
 a._forgeActionClock=40;b._forgeActionClock=40;
 assert.equal(A.contact(a,b,-3),true);
 assert.ok(A.meter(a)>saved&&A.meter(b)>saved);
});
test('wall bounces have a minimum speed, per-player throttling and real events',()=>{
 const g=world(),p=player(),M=g.BounceMomentum;
 assert.equal(M.wall(p,.5),false);
 assert.equal(M.wall(p,3),true);
 assert.equal(p._scratchEvents.wall.count,1);
 const first=M.meter(p);
 p._forgeActionClock=10;assert.equal(M.wall(p,4),false);
 p._forgeActionClock=30;assert.equal(M.wall(p,4),true);
 assert.equal(M.meter(p),first+M.WALL);
});
test('passive energy prevents softlocks but cannot generate bursts during paused or absent opponents',()=>{
 const g=world(),p=player(),target={hp:200},M=g.BounceMomentum;
 for(let frame=0;frame<600;frame++){p._forgeActionClock++;M.tick(p,target);}
 assert.equal(M.meter(p),100);
 assert.equal(M.ready(p),true);
 assert.equal(M.spend(p),true);
 assert.equal(M.meter(p),0);
 assert.equal(M.spend(p),false);
 p._forgeActionClock++;
 M.tick(p,null);
 assert.equal(M.meter(p),0);
});
test('non-tower legacy and manual fighters never earn momentum',()=>{
 const g=world(),M=g.BounceMomentum;
 for(const option of [{forge:{signatureVersion:0}},{manualTower:true},{forge:null}]){
  const p=Object.assign(player(),option);
  assert.equal(M.wall(p,5),false);
  assert.equal(M.add(p,100,'contact'),false);
  assert.equal(M.ready(p),false);
  assert.equal(M.meter(p),null);
 }
});
test('rebound and collision skill triggers require recent nonconsumed physical events',()=>{
 const g=world(),a=player(),b=player();
 g.BounceMomentum.contact(a,b,-2);
 assert.equal(g.SignatureProgram.eligible(a,b,{trigger:'contactEnergy'}),true);
 a._scratchContactConsumed=a._scratchEvents.contact.count;
 assert.equal(g.SignatureProgram.eligible(a,b,{trigger:'contactEnergy'}),false);
 a._forgeActionClock=240;
 assert.equal(g.SignatureProgram.eligible(a,b,{trigger:'contactEnergy'}),false);
 g.BounceMomentum.wall(a,4);
 assert.equal(g.SignatureProgram.eligible(a,b,{trigger:'wallEnergy'}),true);
 const run=g.SignatureLive.begin([{kind:'if',condition:'wall',then:[{kind:'action',action:{type:'wave'}}],else:[]}],a,'wallEnergy');
 assert.ok(run);
 assert.equal(g.SignatureLive.condition(a,b,'wall',run),true);
});
test('signatures are gated by momentum rather than old frequent cooldown, then spend once',()=>{
 const g=world(),profile={name:'핀볼 시험',archetype:'melee',signatureVersion:1,skills:[{
  name:'기세 폭발',trigger:'auto',cooldown:.2,actions:[{type:'wave',damage:21,radius:100}],
  program:[{kind:'action',action:{type:'wave',damage:21,radius:100}}]}]};
 g.SkillForge.register(profile);
 const fighter=g.CUSTOM_DEFS[0].createInstance(1);
 const enemy={playerNum:2,hp:500,maxHp:500,x:450,y:450,radius:25,invincible:0,vx:0,vy:0};
 g.players.push(fighter,enemy);
 fighter.x=60;fighter.y=60;
 for(let i=0;i<40;i++)g.SkillForge.autoUpdate(fighter,enemy);
 assert.equal(fighter._bounceCasts||0,0,'old 0.2s spam cannot bypass momentum');
 g.BounceMomentum.add(fighter,100,'contact');
 g.SkillForge.autoUpdate(fighter,enemy);
 assert.equal(fighter._bounceCasts,1);
 assert.equal(g.BounceMomentum.meter(fighter),0,'consumed at successful cast');
 for(let i=0;i<90;i++)g.SkillForge.autoUpdate(fighter,enemy);
 assert.equal(fighter._bounceCasts,1,'no second cast until momentum refills');
});
test('energy budget ignores obsolete saved cooldown numbers for modern signature builds',()=>{
 const g=world();
 const profile=cd=>({signatureVersion:1,skills:[{name:'기세',cooldown:cd,trigger:'auto',
  actions:[{type:'wave',damage:32,radius:120}],program:[{kind:'action',action:{type:'wave',damage:32,radius:120}}]}]});
 assert.equal(g.ArenaBalance.summary(profile(.2)).multiplier,g.ArenaBalance.summary(profile(20)).multiplier);
 const legacy=cd=>({...profile(cd),signatureVersion:0});
 assert.notEqual(g.ArenaBalance.summary(legacy(.2)).pressure,g.ArenaBalance.summary(legacy(20)).pressure);
});
test('arena collision, wall, script loading and gauge reuse the existing physics/effects',()=>{
 const game=read('js/core/engine.js'),forge=read('js/features/skill-forge.js');
 assert.match(game,/BounceMomentum\?\.contact/);
 assert.match(game,/BounceMomentum\?\.wall/);
 assert.match(game,/BounceMomentum\?\.meter/);
 assert.match(forge,/BounceMomentum\.ready/);
 assert.match(forge,/BounceMomentum\?\.spend/);
 assert.match(forge,/function contact/);
 assert.match(forge,/basicAttack/);
 for(const file of ['index.html','pvp-runtime.html']){
  const s=read(file);
  assert.ok(s.indexOf('bounce-momentum.js')<s.indexOf('skill-forge.js'));
  assert.ok(s.includes('engine.js?v=elastic2-bodyphysics2-minionhud'));
 }
 assert.match(read('js/features/scratch-beginner.js'),/기세가 가득 차면/);
 assert.match(read('js/features/skill-forge.js'),/auto:'주기적으로'/);
 assert.match(read('js/features/scratch-studio.js'),/legacy\?forge\.TRIGGER/);
 assert.match(read('js/features/scratch-beginner.js'),/벽 반사 돌격/);
 assert.match(read('css/bounce-momentum.css'),/forge-energy-meter/);
});
