'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=n=>fs.readFileSync('js/features/'+n+'.js','utf8');
const BASE=['action-registry','semantic-physics','physics-law-engine',
 'signature-program','skill-fx-composer','metaphor-visuals','skill-color-policy',
 'semantic-concept-atlas','concept-fusion','terminal-event-chain',
 'imagination-concepts','semantic-intent-composer','signature-scratch',
 'fantasy-skill-graph','combat-event-graph','signature-live',
 'signature-rule-skill','skill-ir','signature-rule-live',
 'korean-skill-grammar','korean-skill-parameters',
 'signature-prompt-compiler','semantic-relationship-graph',
 'sentence-auto-repair','skill-sentence-engine'];
function boot(extra=[]){
 const g={console,Math,Number,Date,WeakMap,Map,Set,players:[],
  CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:480,height:320},
  createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const name of [...BASE,...extra])
  vm.runInContext(read(name),g,{filename:name+'.js'});
 return g;
}
function from(g,text){
 const x=g.SkillSentenceEngine.parse(text);
 assert.equal(x.ok,true,x.error);
 const rule=x.recipe.rules[0];
 assert.equal(x.recipe.rules.length,1,'no unconditional action pulse');
 assert.equal(x.method,'offline-confirmed-combat-event-graph');
 return {x,rule};
}
const cases=[
 ['공격이 적중하면 자신을 회복하고 보호막을 두른다','hit',['heal','shield']],
 ['적의 공격을 회피하면 보호막을 펼치고 충격파로 공격한다','dodge',['shield','wave']],
 ['공격을 방어하면 회복하고 적을 속박한다','guard',['heal','tether']],
 ['내 체력이 감소하면 보호막을 생성하고 회복한다','hpDrop',['shield','heal']],
 ['내 체력이 회복되면 충격파를 발생시키고 적을 속박한다','hpGain',['wave','tether']],
 ['공격을 맞으면 보호막을 치고 회복한다','hpDrop',['shield','heal']]
];
test('Korean verb-first compiler binds five real event types and three-stage sequences',()=>{
 const g=boot();
 for(const [raw,trigger,actions] of cases){
  const {x,rule}=from(g,raw);
  assert.equal(rule.when,trigger,raw);
  assert.equal(rule.eventGraph.trigger,trigger,raw);
  assert.deepEqual(Array.from(rule.eventGraph.actions),actions,raw);
  assert.deepEqual(Array.from(rule.steps.filter(s=>s.kind==='cast'),x=>x.action.type),actions,raw);
  assert.ok(x.semanticVerification.matched.includes('combatEventGraph'),raw);
  assert.equal(x.semanticVerification.missing.length,0,raw+
   JSON.stringify(x.semanticVerification));
  assert.ok(x.semanticGraph.conditions.some(c=>c.trigger===trigger&&
   c.mode==='confirmed_combat_event'),raw);
  assert.ok(x.semanticGraph.relations.some(c=>c.type==='on_verified_combat_event'),raw);
  assert.equal(x.recipe.window,8);
 }
});
test('on confirmed damage the active 100-momentum run reacts once, in order, with a physical delay',()=>{
 const g=boot(['skill-forge-impact']),{x}=from(g,cases[0][0]);
 const attacker={playerNum:1,x:100,y:100,forge:{signatureVersion:1,
  color:'#d0cafe',effectColor:'#d0cafe'},hp:200,maxHp:200,
  vx:0,vy:0,_forgeActionClock:1,_forgeBalanceFrame:1};
 const victim={playerNum:2,x:170,y:100,radius:20,hp:200,
  maxHp:200,vx:0,vy:0,invincible:0};
 const rule=g.SignatureRuleLive.begin(x.recipe,attacker);
 assert.ok(rule&&!rule.finished);
 assert.equal(g.SignatureRuleLive.step(rule,attacker,victim),null);
 const impact=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),
  enemies:()=>[victim]});
 attacker._forgeActionClock=2;attacker._forgeBalanceFrame=2;
 assert.equal(impact.hit(attacker,victim,{type:'shot',damage:24,status:'none'}),true);
 assert.equal(victim.hp,176);
 assert.equal(attacker._scratchEvents.hit.count,1);
 const first=g.SignatureRuleLive.step(rule,attacker,victim);
 assert.equal(first.type,'heal');
 assert.equal(rule.graphFires[0],1);
 assert.equal(g.SignatureRuleLive.step(rule,attacker,victim),null,
  'the graph wait is an actual simulation-time stage');
 let later=null;
 for(let t=0;t<35&&!later;t++){
  attacker._forgeActionClock++;later=g.SignatureRuleLive.step(rule,attacker,victim);
 }
 assert.equal(later?.type,'shield');
 attacker._forgeActionClock+=5;attacker._forgeBalanceFrame+=5;
 g.SignatureLive.record(attacker,'hit');
 for(let i=0;i<24;i++){
  const a=g.SignatureRuleLive.step(rule,attacker,victim);
  assert.equal(a,null,'a single 100-momentum arm may not proc infinitely');
 }
});
test('invulnerable hits never trigger a chain, and an existing event at arm-time is not replayed',()=>{
 const g=boot(['skill-forge-impact']),{x}=from(g,cases[0][0]);
 const p={playerNum:1,forge:{signatureVersion:1},
  _forgeActionClock:10,_forgeBalanceFrame:10,hp:200,maxHp:200,x:50,y:50};
 const e={playerNum:2,x:90,y:50,hp:200,maxHp:200,
  radius:20,invincible:80,_forgeImpactGrace:0};
 const impact=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),
  enemies:()=>[e]});
 assert.equal(impact.hit(p,e,{type:'wave',damage:30}),false);
 const run=g.SignatureRuleLive.begin(x.recipe,p);
 assert.equal(g.SignatureRuleLive.step(run,p,e),null);
 g.SignatureLive.record(p,'hit');
 const armedAfter=g.SignatureRuleLive.begin(x.recipe,p);
 assert.equal(g.SignatureRuleLive.step(armedAfter,p,e),null,
  'only new combat events AFTER activation should count');
});
test('real dodge serial is the only dodge condition source, not status or FX',()=>{
 const g=boot(),{x}=from(g,cases[1][0]);
 const p={hp:150,maxHp:200,forge:{signatureVersion:1},
  _forgeActionClock:10,_forgeDodgeSerial:3,_scratchEvents:{}};
 const run=g.SignatureRuleLive.begin(x.recipe,p);
 assert.equal(g.SignatureRuleLive.step(run,p,null),null);
 p._forgeDodgeSerial=4;
 const a=g.SignatureRuleLive.step(run,p,null);
 assert.equal(a.type,'shield');
 assert.equal(run.graphFires[0],1);
});
test('a real, active shield only records guard WHEN a later attack is blocked',()=>{
 const g=boot(['skill-forge-impact','skill-forge-executor']),{x}=from(g,cases[2][0]);
 const p={playerNum:1,hp:170,maxHp:200,x:90,y:100,
  radius:20,invincible:0,_forgeActionClock:20,
  forge:{signatureVersion:1,color:'#aabbcc',effectColor:'#aabbcc'}};
 const e={playerNum:2,hp:200,maxHp:200,x:140,y:100,radius:19};
 const live=g.SignatureRuleLive.begin(x.recipe,p);
 const exec=g.SkillForgeExecutorFactory({MOVEMENT_ONLY:new Set(),
  hit:()=>false,enemies:()=>[e]});
 exec.execute(p,{type:'shield',damage:0,duration:1.2},e);
 assert.ok(p.invincible>0&&p._forgeGuardUntil>=20);
 assert.equal(p._scratchEvents?.guard,undefined,'shield cast is not guard');
 const impact=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),enemies:()=>[p]});
 assert.equal(impact.hit(e,p,{type:'shot',damage:30}),false);
 assert.equal(p.hp,170);
 assert.equal(p._scratchEvents.guard.count,1);
 assert.equal(g.SignatureRuleLive.step(live,p,e).type,'heal');
});
test('boss invincibility and impact grace do not count as a real successful block',()=>{
 const g=boot(['skill-forge-impact']),{x}=from(g,cases[2][0]);
 const defender={playerNum:1,hp:200,maxHp:200,x:100,y:90,
  forge:{signatureVersion:1},_forgeActionClock:2,invincible:999};
 const attack={playerNum:2,forge:{signatureVersion:1},x:120,y:90};
 const impact=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),enemies:()=>[defender]});
 const rule=g.SignatureRuleLive.begin(x.recipe,defender);
 assert.equal(impact.hit(attack,defender,{type:'wave',damage:25}),false);
 assert.equal(defender._scratchEvents?.guard,undefined);
 assert.equal(g.SignatureRuleLive.step(rule,defender,attack),null);
});
test('actual HP drops/gains are observed, but decoration, unchanged health and missing baselines are not',()=>{
 const g=boot(),p={hp:170,maxHp:200,forge:{signatureVersion:1},
  _forgeActionClock:7,_scratchEvents:{}};
 assert.equal(g.CombatEventGraph.observeHealth(p,180,160),'hpDrop');
 assert.equal(p._scratchEvents.hpDrop.count,1);
 assert.equal(g.CombatEventGraph.observeHealth(p,180,180),null);
 assert.equal(g.CombatEventGraph.observeHealth(p,null,170),null);
 assert.equal(g.CombatEventGraph.observeHealth(p,undefined,170),null);
 assert.equal(g.CombatEventGraph.observeHealth(p,NaN,170),null);
 p._forgeActionClock=8;
 assert.equal(g.CombatEventGraph.observeHealth(p,160,185),'hpGain');
 assert.equal(p._scratchEvents.hpGain.count,1);
});
test('HP-loss and HP-gain armed rules trigger on DIFFERENT real deltas',()=>{
 const g=boot(),drop=from(g,cases[3][0]),gain=from(g,cases[4][0]);
 const p={hp:150,maxHp:200,forge:{signatureVersion:1},
  _forgeActionClock:9,_scratchEvents:{}};
 const low=g.SignatureRuleLive.begin(drop.x.recipe,p);
 const high=g.SignatureRuleLive.begin(gain.x.recipe,p);
 assert.equal(g.SignatureRuleLive.step(low,p,null),null);
 assert.equal(g.SignatureRuleLive.step(high,p,null),null);
 g.CombatEventGraph.observeHealth(p,150,120);
 assert.equal(g.SignatureRuleLive.step(low,p,null).type,'shield');
 assert.equal(g.SignatureRuleLive.step(high,p,null),null);
 p._forgeActionClock=10;
 g.CombatEventGraph.observeHealth(p,120,135);
 assert.equal(g.SignatureRuleLive.step(high,p,null).type,'wave');
});
test('malicious or ambiguous language/graph never silently grants new combat abilities',()=>{
 const g=boot(),T=g.CombatEventGraph;
 for(const bad of [
  {trigger:'javascript',actions:['heal']},
  {trigger:'hit',actions:['heal','eval']},
  {trigger:'hit',actions:['heal','heal']},
  {trigger:'hpDrop',actions:[]},
  {trigger:'hit',actions:['shield','heal','wave','tether']}
 ])assert.equal(T.normalize(bad),undefined);
 for(const raw of [
  '공격이 적중하면 회복하지 않는다',
  '공격을 회피하면 보호막을 두르고 회복하고 충격파를 발사한 뒤 속박한다',
  '공격을 회피하면 그 공격이 적중하면 보호막을 얻는다',
  '체력이 감소하면 보호막을 두른 뒤 피해가 들어가면 회복한다'
 ]){
  const r=g.SkillSentenceEngine.parse(raw);
  assert.equal(r.ok,false,raw);
  assert.match(r.error,/지원|조건|중복|부정|모호|문장|사건|3개/);
 }
});
test('serialized event graph regenerates safe actions and ignores forged raw attack damage',()=>{
 const g=boot(),graph={trigger:'hit',actions:['heal','shield']};
 const recipe=g.SignatureRuleSkill.normalize({window:8,rules:[{
  when:'pulse',interval:1,eventGraph:graph,
  action:{type:'wave',damage:120,radius:300},
  steps:[{kind:'cast',action:{type:'wave',damage:120}}]
 }]});
 assert.equal(recipe.rules[0].when,'hit');
 assert.equal(recipe.rules[0].action.type,'heal');
 assert.deepEqual(recipe.rules[0].steps.filter(x=>x.kind==='cast')
  .map(x=>x.action.type),['heal','shield']);
 assert.ok(recipe.rules[0].steps.every(x=>x.kind!=='cast'||x.action.damage<=18));
 assert.equal(g.CombatEventGraph.verify(graph,recipe),true);
});
test('SkillIR round-trip and compact PvP preserve the precise event source and action order',()=>{
 const g=boot(['pvp-original-engine']),{x,rule}=from(g,cases[1][0]);
 const ir=g.SkillIR.fromRecipe(x.recipe);
 const restored=g.SkillIR.toRecipe(ir);
 assert.equal(restored.rules[0].when,'dodge');
 assert.deepEqual(Array.from(restored.rules[0].eventGraph.actions),['shield','wave']);
 const skill={name:'이벤트 그래프',trigger:'auto',cooldown:5,threshold:40,
  actions:[rule.action],ruleSet:x.recipe};
 const profile={id:'custom',name:'회피 반응',forgeData:{
  signatureVersion:1,hp:250,speed:2,color:'#b1aaff',effectColor:'#b1aaff',
  allAbilities:false,skills:[skill]}};
 const packet=g.PvpOriginalEngine.pack(profile);
 assert.ok(JSON.stringify(packet).length<2380);
 const compact=packet.f[5][0][6][1][0];
 assert.equal(compact[0],'dodge');
 assert.equal(compact[4],null,'generated steps are not redundantly transmitted');
 assert.deepEqual(Array.from(compact[5]),[1,0,2]);
 const unpack=g.PvpOriginalEngine.unpack(packet);
 const roundTrip=g.SignatureRuleSkill.normalize(unpack.skills[0].ruleSet);
 assert.deepEqual(Array.from(roundTrip.rules[0].eventGraph.actions),['shield','wave']);
 assert.equal(roundTrip.rules[0].when,'dodge');
 assert.deepEqual(Array.from(roundTrip.rules[0].steps.filter(s=>s.kind==='cast'),
  x=>x.action.type),['shield','wave']);
 const legacy={...profile,forgeData:{...profile.forgeData,skills:[{
  ...skill,ruleSet:g.SignatureRuleSkill.normalize({window:8,
   rules:[{when:'pulse',action:{type:'shot',damage:18}}]})}]}};
 const old=g.PvpOriginalEngine.pack(legacy);
 assert.equal(old.f[5][0][6][1][0].length,5,'old compact schema unchanged');
});
test('mini pinball lab waits for real contact instead of inventing dodge/guard/HP changes',()=>{
 const g=boot(['arena-body-physics','studio-pinball-lab']),{x,rule}=from(g,cases[2][0]);
 const profile={name:'방어 반응',color:'#77aaff',effectColor:'#77aaff',
  signatureVersion:1,skills:[{name:'방어 반응',trigger:'auto',
   actions:[rule.action],ruleSet:x.recipe}]};
 const lab=g.StudioPinballLab.make(profile);
 lab.fire();lab.advanceTo(1600);
 assert.ok(lab.combatEventAudit.length>0);
 const audit=lab.combatEventAudit[0];
 assert.equal(audit.trigger,'guard');
 assert.equal(audit.fired,0);
 assert.equal(audit.simulated,false);
 assert.match(audit.note,/실제 전투 이벤트 필요/);
 assert.match(lab.title,/대기 중/);
});
test('script load order and the Forge event stream are linked without a parallel attack loop',()=>{
 const core=read('skill-forge'),impact=read('skill-forge-impact');
 assert.match(core,/CombatEventGraph\?\.observeHealth/);
 assert.match(impact,/_forgeGuardUntil/);
 for(const page of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(page,'utf8');
  const graph=html.indexOf('combat-event-graph.js'),
   rule=html.indexOf('signature-rule-skill.js'),
   fantasy=html.indexOf('fantasy-skill-graph.js');
  assert.ok(graph>fantasy&&graph<rule,page);
 }
});
