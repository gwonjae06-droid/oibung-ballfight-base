'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=n=>fs.readFileSync('js/features/'+n+'.js','utf8');
const parser=['action-registry','semantic-physics','physics-law-engine',
 'signature-program','skill-fx-composer','metaphor-visuals','skill-color-policy',
 'semantic-concept-atlas','concept-fusion','imagination-concepts',
 'semantic-intent-composer','signature-scratch','signature-live','fantasy-skill-graph',
 'signature-rule-skill','skill-ir','signature-rule-live','korean-skill-grammar',
 'korean-skill-parameters','signature-prompt-compiler',
 'semantic-relationship-graph','sentence-auto-repair','skill-sentence-engine'];
const sentence='푸른 투사체가 적을 추적하다 명중하면 세 조각으로 분열하고 모든 파편이 사라지면 자신에게 보호막을 생성한다';
const timed='붉은 투사체가 공중에서 세 조각으로 분열하고 모든 파편이 소멸하면 시전자에게 보호막을 생성한다';
function boot(others=[]){
 const g={console,Math,Date,Number,Set,Map,WeakMap,players:[],CUSTOM_DEFS:[],
  BEHAVIORS:{},CHARACTER_PHOTOS:{},canvas:{width:480,height:320},
  createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const f of [...parser,...others])
  vm.runInContext(read(f),g,{filename:f+'.js'});
 return g;
}
function parsed(g,raw=sentence){
 const r=g.SkillSentenceEngine.parse(raw);
 assert.equal(r.ok,true,r.error);
 return {r,a:r.recipe.rules[0].action};
}
function actors(a){
 const p={playerNum:1,x:80,y:160,radius:20,hp:220,maxHp:220,
  invincible:0,forge:{signatureVersion:1,color:'#276df0',effectColor:'#276df0'},
  _forgeActionClock:1,_forgeBalanceFrame:1,
  forgeShots:[{x:146,y:160,prevX:146,prevY:160,
   vx:6,vy:0,z:0,life:100,a,targetNum:2}],
  forgeZones:[],forgeOrbs:[]};
 const e={playerNum:2,x:162,y:160,radius:20,hp:200,maxHp:200,
  invincible:0,vx:0,vy:0};
 return {p,e};
}
test('a compound Korean sentence compiles exactly one physical projectile and one real last-child guard',()=>{
 const g=boot(),{r,a}=parsed(g);
 assert.equal(r.method,'offline-verb-first-semantic-composer');
 assert.equal(r.recipe.rules.length,1,'no unconditional standalone shield pulse');
 assert.equal(a.type,'shot');
 assert.equal(a.fusion.homing,true);
 assert.equal(a.fusion.split,true);
 assert.equal(a.fusion.splitTrigger,'hit');
 assert.equal(a.fusion.fragments,3);
 assert.equal(a.fusion.finalShield,true);
 assert.equal(a.fusion.finalBurst,undefined);
 assert.ok(r.summary[0].fusion.includes('마지막 파편 소멸 시 보호막'));
 assert.ok(r.semanticVerification.matched.includes('terminalShield'));
 assert.ok(r.semanticVerification.matched.includes('shield'));
 assert.equal(r.semanticVerification.missing.length,0,
  JSON.stringify(r.semanticVerification));
 assert.ok(r.semanticGraph.relations.some(x=>x.type==='grants_shield'&&
  x.to==='caster'));
 assert.ok(r.semanticGraph.relations.some(x=>x.type==='when_all_retired'));
 assert.ok(r.semanticGraph.actions.some(x=>x.finalShield===true));
});
test('confirmed source hit spawns shards, but does not prematurely award the shield',()=>{
 const g=boot(['skill-forge-world']),{a}=parsed(g),{p,e}=actors(a);
 const casts=[],world=g.SkillForgeWorldFactory({
  hit:()=>true,hitGround:()=>false,enemies:()=>[e],
  execute:(actor,action,target)=>{casts.push({actor,action,target});actor.invincible=81;}
 });
 world.tick(p,e);
 assert.equal(p.forgeShots.length,3,'actual hit fractures into 3 children');
 assert.equal(p.invincible,0);
 assert.equal(casts.length,0);
 const group=p.forgeShots[0]._fusionTerminalGroup;
 assert.equal(group.remaining,3);
 assert.ok(p.forgeShots.every(b=>b._fusionTerminalGroup===group));
 for(let i=0;i<3;i++){
  const b=p.forgeShots[i];
  b.x=335+i*15;b.y=260;b.vx=0;b.vy=0;b.life=i===0?80:1;
 }
 p._forgeActionClock=32;p._forgeBalanceFrame=32;
 world.tick(p,e);
 assert.equal(casts.length,0,'two of three children are not the last');
 assert.equal(group.remaining,1);
 assert.equal(p.invincible,0);
 p.forgeShots[0].life=1;p.forgeShots[0].vx=0;p.forgeShots[0].vy=0;
 p._forgeActionClock=55;p._forgeBalanceFrame=55;
 world.tick(p,e);
 assert.equal(casts.length,1);
 assert.equal(casts[0].action.type,'shield');
 assert.equal(casts[0].action.damage,0);
 assert.equal(casts[0].target,p,'guard is self-targeted');
 assert.equal(p.invincible,81);
 assert.equal(group.finished,true);
 world.tick(p,e);
 assert.equal(casts.length,1,'no repeated guard after last child retires');
});
test('the real combat executor grants invincibility and VFX via the registered shield path',()=>{
 const g=boot(['skill-forge-executor','skill-forge-world']),{a}=parsed(g),
  {p,e}=actors(a);
 const fx=[];
 g.BattleFX={cast(_actor,kind){fx.push(kind);},mark(){}};
 const executor=g.SkillForgeExecutorFactory({MOVEMENT_ONLY:new Set(),
  hit:()=>false,enemies:()=>[e]});
 const world=g.SkillForgeWorldFactory({
  hit:()=>true,hitGround:()=>false,enemies:()=>[e],
  execute:executor.execute});
 world.tick(p,e);
 assert.equal(p.invincible,0);
 for(const b of p.forgeShots){b.life=1;b.vx=0;b.vy=0;}
 p._forgeActionClock=27;p._forgeBalanceFrame=27;
 world.tick(p,e);
 assert.ok(p.invincible>0,'real shield path must modify authoritative fighter');
 assert.ok(fx.includes('shield'),'registered shield must render its defense VFX');
 assert.equal(p._scratchEvents.finalShield.count,1);
 assert.equal(p._scratchEvents?.finalFragment?.count||0,0,
  'a shield-only ending must NOT invent AoE damage');
});
test('an invulnerable victim cannot cause premature on-hit fracture or shield',()=>{
 const g=boot(['forge-expansion','skill-forge-impact','skill-forge-world']);
 const {a}=parsed(g),{p,e}=actors(a);e.invincible=999;
 const attack=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),enemies:()=>[e]});
 let casts=0;
 const world=g.SkillForgeWorldFactory({hit:attack.hit,
  hitGround:attack.hitGround,enemies:()=>[e],execute:()=>{casts++;}});
 world.tick(p,e);
 assert.equal(p.forgeShots.length,1);
 assert.equal(casts,0);
 e.invincible=0;
 p._forgeActionClock=2;p._forgeBalanceFrame=2;
 world.tick(p,e);
 assert.equal(p.forgeShots.length,3);
 assert.equal(casts,0);
});
test('a miss with hit-triggered split cannot produce defense just by aging out',()=>{
 const g=boot(['skill-forge-world']),{a}=parsed(g);
 const {p,e}=actors(a);p.forgeShots[0].x=10;p.forgeShots[0].y=25;
 p.forgeShots[0].vx=0;p.forgeShots[0].vy=0;p.forgeShots[0].life=1;
 let casts=0;const world=g.SkillForgeWorldFactory({
  hit:()=>false,hitGround:()=>false,enemies:()=>[e],execute:()=>{casts++;}});
 world.tick(p,e);
 assert.equal(casts,0);
 assert.equal(p.forgeShots.length,0);
});
test('timed root fracture still waits for the actual last child and grants guard once',()=>{
 const g=boot(['skill-forge-world']),{a}=parsed(g,timed);
 assert.notEqual(a.fusion.splitTrigger,'hit');
 const {p,e}=actors(a);
 p.forgeShots[0].x=25;p.forgeShots[0].y=20;p.forgeShots[0].vx=1;
 let casts=0;const world=g.SkillForgeWorldFactory({
  hit:()=>false,hitGround:()=>false,enemies:()=>[e],execute:()=>{casts++;}});
 for(let i=0;i<12;i++)world.tick(p,e);
 assert.equal(p.forgeShots.length,3);
 assert.equal(casts,0);
 for(const b of p.forgeShots){b.life=1;b.vx=0;b.vy=0;}
 world.tick(p,e);
 assert.equal(casts,1);
});
test('terminal explosion and shield can both follow the SAME last physical child family',()=>{
 const g=boot(['skill-forge-world']),raw=
  '붉은 투사체가 공중에서 세 조각으로 분열하고 마지막 파편이 소멸하면 폭발하고 보호막을 생성한다';
 const {r,a}=parsed(g,raw);
 assert.equal(a.fusion.finalBurst,true);
 assert.equal(a.fusion.finalShield,true);
 assert.ok(r.semanticVerification.matched.includes('terminalBurst'));
 const {p,e}=actors(a);p.forgeShots[0].x=30;p.forgeShots[0].y=30;p.forgeShots[0].vx=0;
 const effects=[];let shields=0;g.BattleFX={cast(_p,type){effects.push(type);},mark(){}};
 const world=g.SkillForgeWorldFactory({hit:()=>false,hitGround:()=>false,
  enemies:()=>[e],execute:()=>{shields++;}});
 for(let i=0;i<12;i++)world.tick(p,e);
 for(const b of p.forgeShots){b.life=1;b.vx=0;b.vy=0;}
 world.tick(p,e);
 assert.equal(shields,1);
 assert.equal(effects.filter(x=>x==='wave').length,1);
 assert.equal(p._scratchEvents.finalShield.count,1);
 assert.equal(p._scratchEvents.finalFragment.count,1);
});
test('negated guard never grants a hidden shield and leaves a visible semantic omission',()=>{
 const g=boot(),raw=
  '푸른 투사체가 세 조각으로 분열하고 마지막 파편이 사라지면 보호막을 생성하지 않는다';
 const r=g.SkillSentenceEngine.parse(raw);
 assert.equal(g.ConceptFusion.terminalShieldIntent(raw),false);
 if(r.ok){
  assert.equal(r.recipe.rules[0].action.fusion?.finalShield,undefined);
  assert.ok(!r.semanticVerification?.matched?.includes('terminalShield'));
 }
});
test('no existing shard origin means terminal guard request is rejected',()=>{
 const g=boot(),raw='마지막 파편이 사라지면 보호막을 생성한다';
 const r=g.SkillSentenceEngine.parse(raw);
 assert.equal(r.ok,false);
 assert.match(r.error,/분열 파편 생성 단계/);
});
test('PvP compact schema and IR keep terminal guard while legacy 7-12 trailers remain safe',()=>{
 const g=boot(['pvp-original-engine']),{r,a}=parsed(g);
 const profile=action=>({id:'custom',name:'파편 보호막',
  forgeData:{signatureVersion:1,hp:250,speed:2,
   color:'#abcdef',effectColor:'#abcdef',allAbilities:false,
   skills:[{name:'파편 보호막',trigger:'auto',cooldown:5,threshold:40,
    actions:[action],ruleSet:r.recipe}]}});
 const packet=g.PvpOriginalEngine.pack(profile(a));
 assert.ok(JSON.stringify(packet).length<2380);
 const packed=packet.f[5][0][4][0][13];
 assert.equal(packed.length,13);
 const restored=g.PvpOriginalEngine.unpack(packet);
 assert.equal(restored.skills[0].actions[0].fusion.finalShield,true);
 assert.equal(restored.skills[0].ruleSet.rules[0].action.fusion.finalShield,true);
 assert.equal(restored.skills[0].ruleSet.rules[0].action.fusion.splitTrigger,'hit');
 assert.equal(g.SkillIR.toRecipe(g.SkillIR.fromRecipe(r.recipe))
  .rules[0].action.fusion.finalShield,true);
 const old=g.ConceptFusion.normalize({split:true,fragments:3,
  splitTrigger:'hit',finalBurst:true});
 assert.equal(old.finalShield,undefined);
 assert.equal(g.ConceptFusion.normalize({split:false,finalShield:true}),undefined);
});
test('safe autorepair can recover a missing terminal shield, but not a fake standalone defense',()=>{
 const g=boot(),raw=sentence;
 const r=g.SignatureRuleSkill.normalize({window:8,rules:[{
  when:'pulse',interval:1,action:g.SignatureScratch.safeAction({
   type:'shot',damage:20,duration:1.3,count:1,
   fusion:{split:true,splitTrigger:'hit',homing:true,fragments:3}})}]});
 const fixed=g.SentenceAutoRepair.repair(raw,r);
 assert.equal(fixed.report.status,'repaired');
 assert.ok(fixed.report.applied.includes('terminalShield'));
 assert.equal(fixed.recipe.rules.length,1);
 assert.equal(fixed.recipe.rules[0].action.fusion.finalShield,true);
});
test('practice lab renders one caster shield on the physical last-fragment event, no fake final explosion',()=>{
 const g=boot(['arena-body-physics','studio-pinball-lab']);
 const {r,a}=parsed(g,timed);
 const profile={name:'연쇄막',color:'#4488bb',effectColor:'#4488bb',
  signatureVersion:1,skills:[{name:'연쇄막',trigger:'auto',
   actions:[a],ruleSet:r.recipe}]};
 const lab=g.StudioPinballLab.make(profile);
 lab.fire();lab.advanceTo(5000);
 assert.ok(lab.splitEvents>0);
 assert.ok(lab.terminalShieldEvents>0,'preview should wait for actual children');
 assert.equal(lab.terminalBurstEvents,0);
 assert.ok(lab.terminalShieldHistory.every(e=>e.expires>e.frame));
});
test('main combat composition explicitly injects the authoritative cast path',()=>{
 const live=read('skill-forge'),world=read('skill-forge-world');
 assert.match(live,/SkillForgeWorldFactory\(\{hit,hitGround,enemies,execute\}\)/);
 assert.match(world,/execute\(p,defense,p\)/);
 assert.doesNotMatch(world,/setTimeout|setInterval|eval\s*\(/);
});
