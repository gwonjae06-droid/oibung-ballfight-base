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
 const g={console,Math,Number,Date,Map,Set,WeakMap,players:[],
  CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:480,height:320},createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of [...BASE,...extra])
  vm.runInContext(read(file),g,{filename:file+'.js'});
 return g;
}
const prose='공격을 두 번 명중시키고 내 체력이 40% 이하라면 충격파를 일으킨다';
const more='투사체를 3회 적중시키고 내 체력이 60% 이하라면 보호막을 생성하고 자신을 회복한다';
function parsed(g,raw=prose){
 const r=g.SkillSentenceEngine.parse(raw);
 assert.equal(r.ok,true,r.error);
 assert.equal(r.method,'offline-confirmed-combat-event-graph');
 assert.equal(r.recipe.rules.length,1);
 return {r,rule:r.recipe.rules[0]};
}
function actor(hp=180){
 return {playerNum:1,x:90,y:105,hp,maxHp:200,
  forge:{signatureVersion:1,color:'#aabbdd'},_forgeActionClock:1,
  _forgeBalanceFrame:1,_scratchEvents:{}};
}
function hitTick(g,p,target=null){
 p._forgeActionClock++;p._forgeBalanceFrame++;
 g.SignatureLive.record(p,'hit');
 return g.SignatureRuleLive.step(p._testRun,p,target);
}
test('Korean count AND HP percent compiles exactly one event graph and an actual wave',()=>{
 const g=boot(),{r,rule}=parsed(g);
 assert.equal(rule.when,'hit');
 assert.equal(rule.eventGraph.minCount,2);
 assert.equal(rule.eventGraph.hpBelow,40);
 assert.deepEqual(Array.from(rule.eventGraph.actions),['wave']);
 assert.equal(rule.steps.filter(x=>x.kind==='cast').length,1);
 assert.equal(rule.steps.find(x=>x.kind==='cast').action.type,'wave');
 assert.equal(r.semanticVerification.missing.length,0,JSON.stringify(r.semanticVerification));
 assert.ok(r.semanticGraph.conditions.some(c=>c.requiredHits===2&&c.casterHpAtMost===40));
 assert.ok(r.semanticGraph.relations.some(c=>c.type==='requires_live_hp_threshold'));
 assert.match(r.summary[0].when,/누적 2회/);
 assert.match(r.summary[0].when,/40% 이하/);
});
test('two CONFIRMED hits then living caster HP at most 40% triggers one wave',()=>{
 const g=boot(),{r}=parsed(g),p=actor(180);
 p._testRun=g.SignatureRuleLive.begin(r.recipe,p);
 assert.equal(g.SignatureRuleLive.step(p._testRun,p,null),null);
 assert.equal(hitTick(g,p),null);
 assert.equal(p._testRun.graphCounts[0],1);
 assert.equal(hitTick(g,p),null);
 assert.equal(p._testRun.graphCounts[0],2);
 assert.equal(p._testRun.graphFires[0],0);
 p.hp=80;p._forgeActionClock++;
 const a=g.SignatureRuleLive.step(p._testRun,p,null);
 assert.equal(a?.type,'wave');
 assert.equal(p._testRun.graphFires[0],1);
 for(let i=0;i<12;i++){
  const b=hitTick(g,p);
  assert.equal(b,null,'one full gauge activation cannot repeat the follow-up');
 }
});
test('low HP alone never triggers without both actual confirmed hits',()=>{
 const g=boot(),{r}=parsed(g),p=actor(50);
 p._testRun=g.SignatureRuleLive.begin(r.recipe,p);
 assert.equal(g.SignatureRuleLive.step(p._testRun,p,null),null);
 assert.equal(hitTick(g,p),null);
 assert.equal(p._testRun.graphCounts[0],1);
 assert.equal(p._testRun.graphFires[0],0);
 assert.equal(hitTick(g,p)?.type,'wave');
});
test('two hits while at 40.5% do not fire until the threshold actually becomes true',()=>{
 const g=boot(),{r}=parsed(g),p=actor(81);
 p._testRun=g.SignatureRuleLive.begin(r.recipe,p);
 assert.equal(hitTick(g,p),null);
 assert.equal(hitTick(g,p),null);
 assert.equal(p._testRun.graphFires[0],0);
 p.hp=80;p._forgeActionClock++;
 assert.equal(g.SignatureRuleLive.step(p._testRun,p,null)?.type,'wave');
});
test('confirmed hits recorded BEFORE spending 100 energy are ignored',()=>{
 const g=boot(),{r}=parsed(g),p=actor(70);
 g.SignatureLive.record(p,'hit');p._forgeActionClock++;
 const run=p._testRun=g.SignatureRuleLive.begin(r.recipe,p);
 assert.equal(run.seen[0],1);
 assert.equal(g.SignatureRuleLive.step(run,p,null),null);
 assert.equal(hitTick(g,p),null);
 assert.equal(run.graphCounts[0],1);
 assert.equal(hitTick(g,p)?.type,'wave');
});
test('multiple hits in the SAME simulation frame count once rather than bypass the 2-hit requirement',()=>{
 const g=boot(),{r}=parsed(g),p=actor(60);
 const run=p._testRun=g.SignatureRuleLive.begin(r.recipe,p);
 g.SignatureLive.record(p,'hit');
 g.SignatureLive.record(p,'hit');
 g.SignatureLive.record(p,'hit');
 assert.equal(g.SignatureRuleLive.step(run,p,null),null);
 assert.equal(run.graphCounts[0],1);
 p._forgeActionClock++;
 g.SignatureLive.record(p,'hit');
 assert.equal(g.SignatureRuleLive.step(run,p,null)?.type,'wave');
});
test('the old 8-second event window cannot be bypassed by waiting forever with collected hits',()=>{
 const g=boot(),{r}=parsed(g),p=actor(190);
 const run=p._testRun=g.SignatureRuleLive.begin(r.recipe,p);
 assert.equal(hitTick(g,p),null);
 assert.equal(hitTick(g,p),null);
 for(let t=0;t<485;t++){p._forgeActionClock++;g.SignatureRuleLive.step(run,p,null);}
 assert.equal(run.finished,true);
 p.hp=70;
 assert.equal(g.SignatureRuleLive.step(run,p,null),null);
 assert.equal(run.graphFires[0],0);
});
test('three hit threshold with two ordered support actions keeps the event guard',()=>{
 const g=boot(),{r,rule}=parsed(g,more),p=actor(100);
 assert.equal(rule.eventGraph.minCount,3);
 assert.equal(rule.eventGraph.hpBelow,60);
 assert.deepEqual(Array.from(rule.eventGraph.actions),['shield','heal']);
 const run=p._testRun=g.SignatureRuleLive.begin(r.recipe,p);
 assert.equal(hitTick(g,p),null);
 assert.equal(hitTick(g,p),null);
 assert.equal(hitTick(g,p)?.type,'shield');
 let next=null;for(let t=0;t<35&&!next;t++){p._forgeActionClock++;next=g.SignatureRuleLive.step(run,p,null);}
 assert.equal(next?.type,'heal');
 assert.equal(run.graphFires[0],1);
});
test('authoritative hit resolver counts real HP damage and never invulnerable false hits',()=>{
 const g=boot(['skill-forge-impact']),{r}=parsed(g);
 const p=actor(70),e={playerNum:2,x:130,y:110,invincible:90,
  hp:200,maxHp:200,radius:18,_forgeImpactGrace:0};
 const run=p._testRun=g.SignatureRuleLive.begin(r.recipe,p);
 const impact=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),enemies:()=>[e]});
 const shot={type:'shot',damage:19,status:'none'};
 assert.equal(impact.hit(p,e,shot),false);
 assert.equal(g.SignatureRuleLive.step(run,p,e),null);
 assert.equal(run.graphCounts[0],0);
 e.invincible=0;p._forgeActionClock=20;p._forgeBalanceFrame=20;
 assert.equal(impact.hit(p,e,shot),true);
 assert.equal(g.SignatureRuleLive.step(run,p,e),null);
 e.invincible=0;p._forgeActionClock=40;p._forgeBalanceFrame=40;
 assert.equal(impact.hit(p,e,shot),true);
 assert.equal(g.SignatureRuleLive.step(run,p,e)?.type,'wave');
});
test('the wire packet encodes only the new optional 2-hit/40% gate; old packets remain byte-compatible',()=>{
 const g=boot(['pvp-original-engine']),{r,rule}=parsed(g);
 const profile={id:'custom',name:'복합조건',forgeData:{
  signatureVersion:1,hp:250,speed:2,color:'#aabbcc',effectColor:'#aabbcc',
  allAbilities:false,skills:[{name:'2회 실제 명중',trigger:'auto',
   cooldown:5,threshold:40,actions:[rule.action],ruleSet:r.recipe}]}};
 const packet=g.PvpOriginalEngine.pack(profile);
 assert.ok(JSON.stringify(packet).length<2380);
 const packed=packet.f[5][0][6][1][0][5];
 assert.deepEqual(Array.from(packed),[0,2,-1,2,40]);
 const unpack=g.PvpOriginalEngine.unpack(packet);
 const restored=g.SignatureRuleSkill.normalize(unpack.skills[0].ruleSet);
 assert.equal(restored.rules[0].eventGraph.minCount,2);
 assert.equal(restored.rules[0].eventGraph.hpBelow,40);
 assert.equal(restored.rules[0].steps[0].action.type,'wave');
 assert.equal(g.SkillIR.toRecipe(g.SkillIR.fromRecipe(r.recipe))
  .rules[0].eventGraph.hpBelow,40);
 const old=g.CombatEventGraph.pack({trigger:'hit',actions:['wave']});
 assert.deepEqual(Array.from(old),[0,2]);
 assert.deepEqual(JSON.parse(JSON.stringify(g.CombatEventGraph.unpack(old))),
  {version:1,trigger:'hit',actions:['wave']});
});
test('malformed thresholds, impossible counts and unsupported comparisons are not accepted silently',()=>{
 const g=boot(),T=g.CombatEventGraph;
 for(const raw of [
  '공격을 두 번 명중시키고 내 체력이 100% 이하라면 충격파를 일으킨다',
  '공격을 두 번 명중시키고 내 체력이 40% 미만이라면 충격파를 일으킨다',
  '공격을 두 번 명중시키고 내 체력이 40% 이상이라면 충격파를 일으킨다'
 ]){
  const r=g.SkillSentenceEngine.parse(raw);
  assert.equal(r.ok,false,raw);
 }
 for(const bad of [
  {trigger:'hit',actions:['wave'],minCount:2,hpBelow:95},
  {trigger:'hit',actions:['wave'],minCount:2,hpBelow:0},
  {trigger:'hit',actions:['wave'],minCount:5,hpBelow:40},
  {trigger:'dodge',actions:['shield'],minCount:2,hpBelow:40},
  {trigger:'hit',actions:['wave'],hpBelow:40},
  {trigger:'hit',actions:['wave'],minCount:2.1,hpBelow:40}
 ])assert.equal(T.normalize(bad),undefined);
 assert.equal(T.unpack([0,2,-1,2,40,1]),undefined);
 assert.equal(T.unpack([0,2,-1,0,40]),undefined);
});
test('practice lab exposes unverified HP threshold and hit-count progress instead of inventing guaranteed success',()=>{
 const g=boot(['arena-body-physics','studio-pinball-lab']),{r,rule}=parsed(g);
 const profile={name:'복합조건 실험',color:'#7799ee',effectColor:'#7799ee',
  signatureVersion:1,skills:[{name:'실제 명중 2회 후',trigger:'auto',
   actions:[rule.action],ruleSet:r.recipe}]};
 const lab=g.StudioPinballLab.make(profile);
 lab.fire();lab.advanceTo(1400);
 const audit=lab.combatEventAudit[0];
 assert.ok(audit);
 assert.equal(audit.trigger,'hit');
 assert.equal(audit.required,2);
 assert.equal(audit.hpBelow,40);
 assert.equal(audit.thresholdVerified,false);
 assert.match(audit.note,/실제 전투 기준/);
});
test('strict parser only treats explicitly supported conjunctions as verified event graphs',()=>{
 const g=boot();
 assert.equal(g.CombatEventGraph.parse('보호막을 두른다'),null);
 const original=g.CombatEventGraph.normalize({trigger:'hit',actions:['heal','shield']});
 assert.equal(original.hpBelow,undefined);
 assert.equal(original.minCount,undefined);
 const count=g.CombatEventGraph.normalize({trigger:'hit',actions:['shield'],minCount:2,hpBelow:40});
 assert.equal(g.CombatEventGraph.unpack(g.CombatEventGraph.pack(count)).hpBelow,40);
});
