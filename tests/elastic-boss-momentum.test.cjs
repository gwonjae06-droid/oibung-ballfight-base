'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function world(files){
 const g={Math,Number,Set,Map,WeakMap,Date,console,canvas:{width:500,height:500},
  players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},addFloatingText(){},
  createHitParticles(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of files)vm.runInContext(read(file),g,{filename:file});
 return g;
}
const physics=['js/features/arena-body-physics.js','js/features/ball-impact-squash.js'];
const bossFiles=['js/features/bounce-momentum.js'];
const fighter=(opts={})=>({hp:200,maxHp:200,radius:26,x:180,y:250,vx:0,vy:0,
 forge:{signatureVersion:1,archetype:'melee',effectColor:'#cc9eff'},_forgeActionClock:1,...opts});
function boss(opts={}){return fighter({towerEnemy:true,towerPatternBoss:true,forge:{
 signatureVersion:0,skills:[],effectColor:'#e0a0ff'},...opts});}
test('physical collisions conserve the normal component appropriately and rebound unequal masses',()=>{
 const g=world(physics),B=g.ArenaBodyPhysics;
 const a=fighter({radius:22,vx:4,vy:1}),b=boss({radius:36,vx:-2,vy:-1});
 const initial=B.mass(a)*a.vx+B.mass(b)*b.vx;
 const event=B.pair(a,b,1,0);
 assert.ok(event.impulse>0);assert.ok(a.vx<0);
 assert.ok(b.vx>-2);
 assert.ok(Math.abs(initial-(B.mass(a)*a.vx+B.mass(b)*b.vx))<.001,'mass-weighted horizontal momentum');
 assert.equal(a.vy,1);assert.equal(b.vy,-1,'tangential velocity preserved');
 assert.ok(a._pinballReboundHold>=10&&b._pinballReboundHold>=10);
});
test('no collision force when discs move apart or are stationary; no invented damage',()=>{
 const g=world(physics),B=g.ArenaBodyPhysics;
 const a=fighter({vx:-3}),b=fighter({vx:2});
 assert.equal(B.pair(a,b,1,0),false);
 assert.equal(a.vx,-3);assert.equal(b.vx,2);
 assert.equal(a.hp,200);assert.equal(b.hp,200);
});
test('impact squash compresses then stretches before settling, without changing hitboxes',()=>{
 const g=world(physics),S=g.ArenaBallSquash;
 const a=fighter(),b=fighter();
 assert.equal(S.pair(a,b,-6,1,0),true);
 const radius=a.radius;
 for(let i=0;i<3;i++)S.tick(a);
 const compressed=S.pose(a);
 assert.ok(compressed.sx<.90&&compressed.sy>1.1,'clearly visible squash');
 for(let i=0;i<5;i++)S.tick(a);
 const stretched=S.pose(a);
 assert.ok(stretched.sx>1.07&&stretched.sy<1,'recovery stretches');
 assert.equal(a.radius,radius);assert.equal(a.hp,200);
 for(let i=0;i<24;i++)S.tick(a);
 assert.equal(S.pose(a).sx,1);assert.equal(S.pose(a).sy,1);
 assert.equal(S.wall(a,1,0,4),true);
});
test('all tower bosses gain energy through real contact, wall and confirmed damage',()=>{
 const g=world(bossFiles),M=g.BounceMomentum;
 const p=boss();
 assert.equal(M.enabled(p),true);
 assert.equal(M.wall(p,3),true);
 assert.ok(M.meter(p)>0);
 const previous=M.meter(p);
 assert.equal(M.damageTaken(p,70),true);
 assert.ok(M.meter(p)>previous);
 const p2=boss({towerPatternBoss:false});
 assert.equal(M.enabled(p2),true,'normal tower enemies now also build one meter');
 assert.equal(M.isMinion(p2),true);
 assert.equal(M.damageTaken(p2,80),true);
 const manual=fighter({manualTower:true});
 assert.equal(M.enabled(manual),false);
});
test('boss shares exactly one 100 momentum meter across skill, pattern and cinematic casts',()=>{
 const g=world(bossFiles),M=g.BounceMomentum,p=boss();
 assert.equal(M.bossPhase(p),'pattern');
 assert.equal(M.bossSpend(p,'skill'),false);
 assert.equal(M.bossSpend(p,'pattern'),false);
 for(const [phase,next] of [['pattern','skill'],['skill','spectacle'],['spectacle','pattern']]){
  M.add(p,100,'charge');
  assert.equal(M.bossCan(p,phase),true);
  assert.equal(M.bossSpend(p,phase),true);
  assert.equal(M.meter(p),0);
  assert.equal(M.bossPhase(p),next);
  assert.equal(M.bossSpend(p,phase),false);
 }
 assert.equal(p._bossEnergyCursor,1);
});
test('anchored Ancient One stays energy-gated for every separate boss pattern',()=>{
 const g=world([...bossFiles,'js/features/ancient-one.js']);
 const M=g.BounceMomentum,hero=fighter({x:100,y:200}),p=boss({_ancientEnergyOnly:true,x:250,y:90,hp:3000,maxHp:3000});
 const scene=g.ArenaAncientOne.create({width:500,height:500,hero,boss:p,damage:()=>true});
 for(let i=0;i<240;i++)scene.step();
 assert.equal(scene.zones.length,0,'no scheduled free boss pattern without momentum');
 M.add(p,100,'charge');scene.step();
 assert.ok(scene.zones.length>0,'full momentum opens the Ancient telegraph');
 assert.equal(M.meter(p),0);assert.equal(M.bossPhase(p),'pattern');
});
test('tower bosses do not open scripted warning patterns on timers without energy',()=>{
 const g=world([...bossFiles,'js/features/tower-encounters.js']);
 const M=g.BounceMomentum,hero=fighter({x:150,y:250}),p=boss({x:350,y:250});
 const encounter=g.ArenaEncounter.create({realm:'time',level:5,width:500,height:500,hero,boss:p,damage:()=>true});
 for(let i=0;i<300;i++)encounter.step();
 assert.equal(encounter.zones.filter(z=>z.kind==='boss').length,0);
 M.add(p,100,'charge');encounter.step();
 assert.ok(encounter.zones.some(z=>z.kind==='boss'));
 assert.equal(M.meter(p),0);assert.equal(M.bossPhase(p),'skill');
});
test('normal boss skill casts also consume momentum and rotate among the authored slots',()=>{
 const files=['js/features/action-registry.js','js/features/forge-archetypes.js','js/features/basic-attacks.js',
  'js/features/signature-program.js','js/features/signature-scratch.js','js/features/signature-live.js',
  ...bossFiles,'js/features/arena-balance.js','js/features/skill-forge.js'];
 const g=world(files),M=g.BounceMomentum;
 g.SkillForge.register({name:'시계 수호자',hp:600,speed:2,skills:[
  {name:'시간 검',trigger:'auto',cooldown:.3,actions:[{type:'wave',damage:15}]},
  {name:'시간 탄환',trigger:'auto',cooldown:.3,actions:[{type:'shot',damage:15}]}
 ]},{towerEnemy:true});
 const p=g.CUSTOM_DEFS[0].createInstance(2),hero=fighter({playerNum:1,x:320,y:250});
 p.towerPatternBoss=true;p.x=150;p.y=250;g.players.push(p,hero);
 for(let i=0;i<60;i++)g.SkillForge.autoUpdate(p,hero);
 assert.equal(p._bounceCasts||0,0,'full energy required before any authored boss skill');
 M.add(p,100,'charge');g.SkillForge.autoUpdate(p,hero);
 assert.equal(p._bounceCasts||0,0,'scripted pattern must come first');
 M.bossSpend(p,'pattern'); // only works when full
 M.add(p,100,'charge');
 g.SkillForge.autoUpdate(p,hero);
 assert.equal(p._bounceCasts,2,'pattern and authored cast each consume momentum');
 assert.equal(M.bossPhase(p),'spectacle');
 assert.equal(p._bossEnergyCursor,1,'next authored skill gets a turn');
 assert.equal(M.meter(p),0);
});
test('HTML and collision engine use same visuals + solver on local and PvP pages',()=>{
 const game=read('js/core/engine.js');
 assert.match(game,/ArenaBodyPhysics\?\.pair/);
 assert.match(game,/ArenaBallSquash\?\.pair/);
 assert.match(game,/ArenaBallSquash\?\.wall/);
 assert.match(read('js/features/tower-encounters.js'),/bossSpend\(boss,'pattern'\)/);
 assert.match(read('js/features/tower-spectacle.js'),/bossSpend\(boss,'spectacle'\)/);
 assert.match(read('js/features/ancient-one.js'),/bossSpend\(boss,'pattern'\)/);
 for(const file of ['index.html','pvp-runtime.html']){
  const html=read(file);
  assert.ok(html.includes('arena-body-physics.js'));
  assert.ok(html.indexOf('arena-body-physics.js')<html.indexOf('js/core/engine.js'));
  assert.ok(html.indexOf('ball-impact-squash.js')<html.indexOf('js/core/engine.js'));
 }
});
