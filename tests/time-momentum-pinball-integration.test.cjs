'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={console,Math,Date,Map,Set,WeakMap,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},
  CHARACTER_PHOTOS:{},canvas:{width:500,height:500},addFloatingText(){},createHitParticles(){}};
 g.window=g;g.globalThis=g;
 vm.createContext(g);
 for(const file of ['js/features/action-registry.js','js/features/forge-archetypes.js',
  'js/features/signature-program.js','js/features/signature-scratch.js',
  'js/features/signature-live.js','js/features/bounce-momentum.js',
  'js/features/arena-balance.js','js/features/forge-expansion.js','js/features/skill-forge.js',
  'js/features/arena-body-physics.js','js/features/ball-impact-squash.js',
  'js/features/studio-pinball-lab.js'])
   vm.runInContext(read(file),g,{filename:file});
 return g;
}
function actor(energy=0){
 return {x:100,y:100,vx:3,vy:2,hp:300,maxHp:300,radius:23,playerNum:1,
  _forgeActionClock:1,forgeEffects:{},forgeHistory:[],
  forge:{signatureVersion:1,speed:2.5,effectColor:'#ace0ff',skills:[]},
  _bounceMomentum:energy};
}
const api=e=>({enemies:()=>[e]});
test('time stop steals at most 20 from a real momentum enemy and returns half to caster',()=>{
 const g=world(),p=actor(0),e=actor(85);e.playerNum=2;e.x=160;
 g.players=[p,e];
 assert.equal(g.ForgeExpansion.execute(p,{type:'timestop',radius:180,duration:1},e,api(e)),true);
 assert.equal(g.BounceMomentum.meter(e),65);
 assert.equal(g.BounceMomentum.meter(p),10);
 assert.equal(g.ForgeExpansion.movement(e),0);
 assert.ok(g.ForgeExpansion.active(e,'momentumStasis'));
 assert.equal(g.BounceMomentum.add(e,9,'wall'),false,'stopped target cannot build rebound energy');
 assert.equal(g.BounceMomentum.add(e,1,'passive'),false);
 assert.equal(g.BounceMomentum.add(e,16,'contact'),false);
});
test('time stop respects CC recovery, shield immunity, and non-energy targets',()=>{
 const g=world(),p=actor(0),e=actor(65);e.playerNum=2;e.x=140;g.players=[p,e];
 g.ForgeExpansion.execute(p,{type:'timestop',radius:180,duration:1},e,api(e));
 const currentP=g.BounceMomentum.meter(p),currentE=g.BounceMomentum.meter(e);
 g.ForgeExpansion.execute(p,{type:'timestop',radius:180,duration:1},e,api(e));
 assert.equal(g.BounceMomentum.meter(p),currentP);assert.equal(g.BounceMomentum.meter(e),currentE);
 const immune=actor(90);immune.playerNum=3;immune.invincible=20;immune.x=146;
 g.ForgeExpansion.execute(p,{type:'timestop',radius:180,duration:1},immune,api(immune));
 assert.equal(g.BounceMomentum.meter(immune),90);
 const old=actor(0);old.forge.signatureVersion=0;old.playerNum=4;old.x=148;
 g.ForgeExpansion.execute(p,{type:'timestop',radius:180,duration:1},old,api(old));
 assert.equal(g.BounceMomentum.meter(p),currentP);
});
test('time acceleration boosts real collisions and passive recharge without stacking with haste',()=>{
 const g=world(),p=actor(),F=g.ForgeExpansion,M=g.BounceMomentum;
 F.execute(p,{type:'haste',duration:2},actor(),api(actor()));
 assert.equal(M.add(p,8,'wall'),true);
 assert.equal(M.meter(p),8*M.TIME_HASTE);
 p._forgeActionClock+=40;F.execute(p,{type:'timeburst',duration:2},actor(),api(actor()));
 M.add(p,8,'wall');
 assert.equal(M.meter(p),8*M.TIME_HASTE+8*M.TIME_ACCEL);
 p._forgeActionClock++;M.tick(p,{hp:100});
 assert.ok(M.meter(p)>8*M.TIME_HASTE+8*M.TIME_ACCEL);
});
test('rewind returns recorded pinball position, heading and no more than 30 energy',()=>{
 const g=world(),p=actor(0),e=actor();e.playerNum=2;e.x=180;
 p.forgeHistory=[{x:66,y:88,vx:-6,vy:2,hp:260,momentum:95}];
 p.x=340;p.y=300;p.vx=4;p.vy=-4;p.hp=100;g.players=[p,e];
 assert.equal(g.ForgeExpansion.execute(p,{type:'rewind',duration:2},e,api(e)),true);
 assert.equal(p.x,66);assert.equal(p.y,88);
 assert.equal(p.vx,-6);assert.equal(p.vy,2);
 assert.equal(g.BounceMomentum.meter(p),30);
 assert.ok(p.hp>100);
});
test('time rewind heading survives ordinary pinball AI velocity restoration',()=>{
 const g=world();
 vm.runInContext(read('js/features/arena-pinball-motion.js'),g);
 const p=actor(0),e=actor();e.x=190;e.playerNum=2;g.players=[p,e];
 p.forgeHistory=[{x:85,y:85,vx:-8,vy:1,hp:260,momentum:30}];
 const before=g.ArenaPinballMotion.begin(p);
 assert.equal(before.scripted,false);
 g.ForgeExpansion.execute(p,{type:'rewind',duration:2},e,api(e));
 assert.equal(g.ArenaPinballMotion.end(p,before),false,'rewind must not revert to pre-cast direction');
 assert.equal(p.vx,-8);assert.equal(p.vy,1);
 assert.ok(p._pinballRewindUntil>p._forgeActionClock);
});
test('practice supports 55 action families without live battle access or editing player data',()=>{
 const g=world();
 for(const type of g.ActionRegistry.ids()){
  const profile={name:'action',signatureVersion:1,skills:[{
    name:type,actions:[{type,radius:110,duration:1,count:2}],
    program:[{kind:'action',action:{type,radius:110,duration:1,count:2}}]
  }]};
  const snapshot=JSON.stringify(profile);
  const lab=g.StudioPinballLab.make(profile);lab.fire();
  assert.doesNotThrow(()=>lab.advanceTo(250),type);
  assert.equal(lab.balls.length,2);
  assert.ok(lab.balls.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),type);
  assert.equal(JSON.stringify(profile),snapshot,type+' cannot mutate player recipe');
 }
});

test('removed basic attacks cannot charge energy; all registered actions remain available',()=>{
 const g=world(),M=g.BounceMomentum,p=actor();
 assert.equal(M.basicHit(p),false);assert.equal(M.meter(p),0);
 assert.ok(g.ActionRegistry.ids().length>=55);
 for(const type of g.ActionRegistry.ids())assert.equal(typeof g.ActionRegistry.get(type).family,'string');
 assert.match(read('js/features/block-forge.js'),/⚡ 기세 100/);
 assert.doesNotMatch(read('js/features/block-forge.js'),/자동 이동·기본 공격을 맡고/);
});
test('mini pinball lab performs actual temporary wall and portal placement',()=>{
 const g=world();
 const make=t=>({name:'test',color:'#aabbcc',signatureVersion:1,
   skills:[{name:t,actions:[{type:t,radius:110,duration:2}],
     program:[{kind:'action',action:{type:t,radius:110,duration:2}}]}]});
 const wall=g.StudioPinballLab.make(make('wall'));wall.fire();wall.advanceTo(250);
 assert.ok(wall.walls>0,'temporary solid bumper exists');
 const portal=g.StudioPinballLab.make(make('portal'));portal.fire();portal.advanceTo(250);
 assert.ok(portal.portals>0,'two-way linked portal exists');
});
test('mini pinball lab displays momentum steal only on close-range time stop and does not mutate drafts',()=>{
 const g=world(),profile={name:'clock',color:'#bbccff',signatureVersion:1,skills:[{
  name:'stop',actions:[{type:'timestop',radius:200,duration:1.5}],
  program:[{kind:'action',action:{type:'timestop',radius:200,duration:1.5}}]}]};
 const snapshot=JSON.stringify(profile),lab=g.StudioPinballLab.make(profile);
 const [a,b]=lab.balls;b.x=a.x+65;b.y=a.y;
 const before=b.energy;
 lab.fire();lab.advanceTo(170);
 assert.ok(b.energy<before,'stasis steals enemy resource');
 assert.ok(lab.energy>0,'caster receives time steal energy after cast');
 assert.equal(JSON.stringify(profile),snapshot);
});
