'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function boot(files){
 const g={Math,Date,Number,Set,Map,WeakMap,console,players:[],
  canvas:{width:480,height:320},createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of files)vm.runInContext(fs.readFileSync('js/features/'+file+'.js','utf8'),g,
  {filename:file+'.js'});
 return g;
}
function setup(g,action,shielded=false){
 const attacker={playerNum:1,x:20,y:100,hp:250,maxHp:250,
  _forgeActionClock:1,_forgeBalanceFrame:1,
  forge:{color:'#2266ee',effectColor:'#2266ee'},
  forgeShots:[{x:90,y:100,vx:8,vy:0,life:80,a:action,targetNum:2}],
  forgeZones:[],forgeOrbs:[]};
 const enemy={playerNum:2,x:104,y:100,hp:200,maxHp:200,
  radius:18,vx:0,vy:0,invincible:shielded?90:0};
 return {attacker,enemy};
}
const fused=(g,options={})=>({
 type:'shot',damage:30,count:1,speed:8,radius:100,status:'none',
 knockback:0,duration:1,
 fusion:g.ConceptFusion.normalize({form:'projectile',element:'ice',
  homing:true,split:true,fragments:3,...options})
});
test('confirmed projectile contact creates independent real split shots and deals actual damage',()=>{
 const g=boot(['action-registry','concept-fusion','skill-forge-impact','skill-forge-world']);
 const a=fused(g,{splitTrigger:'hit'}),{attacker:p,enemy:e}=setup(g,a);
 const impact=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),enemies:()=>[e]});
 const world=g.SkillForgeWorldFactory({hit:impact.hit,hitGround:impact.hitGround,enemies:()=>[e]});
 world.tick(p,e);
 assert.ok(e.hp<200,'the original projectile must use authoritative HP resolver');
 assert.equal(p.forgeShots.length,3,'fracture produces three true child projectiles');
 assert.ok(p.forgeShots.every(b=>b._fusionChild&&b.a.fusion.homing&&!b.a.fusion.split));
 assert.ok(p.forgeShots.every(b=>b.targetNum===2));
 const before=p.forgeShots.map(b=>[b.x,b.y]);
 world.tick(p,e);
 assert.ok(p.forgeShots.some((b,i)=>b.x!==before[i][0]||b.y!==before[i][1]));
});
test('shields must not generate a contact fracture until hit is confirmed',()=>{
 const g=boot(['action-registry','concept-fusion','skill-forge-impact','skill-forge-world']);
 const a=fused(g,{splitTrigger:'hit'}),{attacker:p,enemy:e}=setup(g,a,true);
 const impact=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),enemies:()=>[e]});
 const world=g.SkillForgeWorldFactory({hit:impact.hit,hitGround:impact.hitGround,enemies:()=>[e]});
 world.tick(p,e);
 assert.equal(e.hp,200);
 assert.equal(p.forgeShots.length,1);
 assert.equal(p.forgeShots[0]._fusionChild,undefined);
});
test('legacy skill split without splitTrigger still fractures after exactly 12 ticks',()=>{
 const g=boot(['action-registry','concept-fusion','skill-forge-world']);
 const a=fused(g),{attacker:p}=setup(g,a);
 p.forgeShots[0].x=10;p.forgeShots[0].y=20;p.forgeShots[0].vx=3;
 const e={playerNum:2,x:350,y:260,hp:200,radius:18};
 const world=g.SkillForgeWorldFactory({hit:()=>false,hitGround:()=>false,enemies:()=>[e]});
 for(let i=0;i<11;i++)world.tick(p,e);
 assert.equal(p.forgeShots.length,1);
 world.tick(p,e);
 assert.equal(p.forgeShots.length,3);
});
test('new split trigger and old seven-field fusion survive PvP roundtrip',()=>{
 const g=boot(['concept-fusion','pvp-original-engine']);
 const create=a=>({id:'custom',name:'Tester',forgeData:{signatureVersion:1,
  hp:260,speed:2,color:'#aaaaff',effectColor:'#aaaaff',allAbilities:false,
  skills:[{name:'동작',trigger:'auto',cooldown:5,threshold:30,
   actions:[a],ruleSet:{version:1,window:9,
    rules:[{when:'pulse',interval:1,action:a}]}}]}});
 const fresh=fused(g,{splitTrigger:'hit'});
 const packet=g.PvpOriginalEngine.pack(create(fresh));
 const restored=g.PvpOriginalEngine.unpack(packet);
 assert.equal(restored.skills[0].actions[0].fusion.splitTrigger,'hit');
 assert.equal(restored.skills[0].ruleSet.rules[0].action.fusion.splitTrigger,'hit');
 assert.ok(JSON.stringify(packet).length<2380);
 const prior=g.PvpOriginalEngine.unpack(g.PvpOriginalEngine.pack(create(fused(g))));
 assert.equal(prior.skills[0].actions[0].fusion.split,true);
 assert.equal(prior.skills[0].actions[0].fusion.splitTrigger,undefined);
});
test('native Korean butterfly counters map to launch count and reject inflated input',()=>{
 const g=boot(['korean-skill-parameters']);
 assert.equal(g.KoreanSkillParameters.analyze('얼음 나비 세 마리가 적에게 날아간다').values.count,3);
 assert.equal(g.KoreanSkillParameters.analyze('구슬 일곱 마리가 공격한다').values.count,7);
 assert.equal(g.KoreanSkillParameters.analyze('파편 999마리가 나온다').values.count,8);
});
