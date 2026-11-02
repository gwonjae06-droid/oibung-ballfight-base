'use strict';
/* Regression: original Park in Tower, long-lived real shots, and shared preview VFX. */
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../js/features',name+'.js'),'utf8');
function sandbox(initial,modules){
 const g={Math,Number,Set,Map,WeakMap,console,canvas:{width:500,height:500},
  players:[],BEHAVIORS:{park:{update(){}}},...initial};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const module of modules)vm.runInContext(read(module),g,{filename:module+'.js'});
 return g;
}
test('the Tower does not overwrite built-in momentum with an obsolete manual Forge kit',()=>{
 const tower=read('tower-challenge');
 assert.match(tower,/!global\.ArenaOriginalMomentum\?\.isOriginal\?\.\(players\[0\]\)/);
 const g=sandbox({BounceMomentum:{tick(){},ready:p=>p._bounceMomentum===100,
  spend(p){p._bounceMomentum=0;return true}}},
 ['original-momentum-ultimates']);
 const p={id:'park',hp:300,maxHp:300,playerNum:1,x:50,y:50,
  vx:1,vy:1,jumpState:'ground',radius:30,borderColor:'#eee'};
 const target={id:'enemy',hp:500,maxHp:500,playerNum:2,x:345,y:255,
  radius:30,invincible:0,vx:0,vy:0};
 p._bounceMomentum=100;
 g.players=[p,target];
 assert.equal(g.ArenaOriginalMomentum.isOriginal(p),true);
 g.ArenaOriginalMomentum.update(p,target,g.players);
 assert.equal(p.jumpState,'rising');
 for(let i=0;i<40;i++)g.ArenaOriginalMomentum.update(p,target,g.players);
 assert.equal(p.jumpState,'ground');
 assert.equal(p.x,target.x,'Park must land exactly over the current target X');
 assert.equal(p.y,target.y,'Park must land exactly over the current target Y');
 assert.ok(target.hp<500,'original ultimate should deal damage');
});
test('real Forge direct shots survive at least the full arena crossing time',()=>{
 const g=sandbox({SkillVisuals:{cast(){}},ArenaCharge:null},
 ['skill-forge-executor']);
 const ex=g.SkillForgeExecutorFactory({MOVEMENT_ONLY:new Set(),
  hit(){return false},enemies(){return []}});
 const p={playerNum:1,x:52,y:245,hp:200,forge:{
  color:'#fff',effectColor:'#fff'},forgeShots:[],forgeZones:[]};
 const target={playerNum:2,x:452,y:245,hp:500};
 ex.execute(p,{type:'shot',damage:12,range:30,radius:30,speed:14,count:1,
  ricochet:0,duration:1.5},target);
 assert.equal(p.forgeShots.length,1);
 assert.ok(p.forgeShots[0].life>=Math.ceil(Math.hypot(500,500)/14),
  'even fast shots with narrow attack radius should cross the arena');
});
test('homing and piercing shots use arena reach rather than short area radius',()=>{
 const g=sandbox({addFloatingText(){},ForgeExpansion:null},['forge-expansion']);
 const player={playerNum:1,x:40,y:240,hp:200,forgeExtras:[],
  forge:{color:'#fff',effectColor:'#fff'},radius:25};
 const foe={playerNum:2,x:450,y:240,hp:500,radius:25};
 g.players=[player,foe];
 const api={enemies:()=>[foe],hit:()=>false};
 for(const type of ['homing','pierce','dung']){
  g.ForgeExpansion.execute(player,{type,damage:8,radius:30,speed:14,count:1,
   duration:1.5,target:'nearest',status:'none'},foe,api);
  const projectile=player.forgeExtras.at(-1);
  assert.ok(projectile?.life>=Math.ceil(Math.hypot(500,500)/14),type+' should reach distant target');
 }
});
test('the mini lab shares actual performed action family FX and preserves visible shots at capacity',()=>{
 const events=[];
 const g=sandbox({SkillForge:{TYPE:{wave:'충격파',splitshot:'분열탄'}},
  SkillVisuals:{previewFrame(ctx,arg){events.push(arg.type);return true;}}},
 ['signature-program','signature-scratch','signature-rule-skill',
 'signature-rule-live','studio-pinball-lab']);
 const rules=g.SignatureRuleSkill.normalize({window:9,rules:[
  {when:'pulse',interval:.5,action:{type:'wave',damage:22}},
  {when:'pulse',interval:.7,action:{type:'splitshot',damage:10,count:8},fracture:3}
 ]});
 const profile={signatureVersion:1,name:'검증',skills:[
  {name:'움직이는 기술',ruleSet:rules,actions:g.SignatureRuleSkill.preview(rules)}]};
 const lab=g.StudioPinballLab.make(profile);
 lab.advanceTo(7100);
 const fn=()=>{};
 const c=new Proxy({}, {get(target,prop){return prop in target?target[prop]:fn;},
  set(target,prop,val){target[prop]=val;return true;}});
 lab.render(c);
 assert.ok(events.includes('wave'),'wave must render actual shared visual family');
 assert.ok(events.includes('splitshot'),'projectile cast must render actual shared visual family');
 assert.ok(lab.projectiles<=45,'mini bullet budget stays bounded');
});
