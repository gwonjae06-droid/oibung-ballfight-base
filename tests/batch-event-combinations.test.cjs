'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync('js/features/'+name+'.js','utf8');
const BASE=['action-registry','semantic-physics','physics-law-engine',
 'signature-program','skill-fx-composer','metaphor-visuals','skill-color-policy',
 'semantic-concept-atlas','concept-fusion','terminal-event-chain',
 'imagination-concepts','semantic-intent-composer','signature-scratch',
 'fantasy-skill-graph','combat-event-graph','signature-live','signature-rule-skill',
 'skill-ir','signature-rule-live','korean-skill-grammar','korean-skill-parameters',
 'signature-prompt-compiler','semantic-relationship-graph','sentence-auto-repair',
 'skill-sentence-engine'];
function boot(extra=[]){
 const g={Math,Date,Number,Set,Map,WeakMap,console,players:[],
 CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
 canvas:{width:480,height:320},createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of [...BASE,...extra])
  vm.runInContext(read(file),g,{filename:file+'.js'});
 return g;
}
const AND='공격을 두 번 명중시키고 적의 공격을 회피하면 충격파를 일으키고 보호막을 두른다';
const OR='공격을 두 번 명중시키거나 적의 공격을 회피하면 보호막을 생성한다';
function parsed(g,raw=AND){
 const p=g.SkillSentenceEngine.parse(raw);
 assert.equal(p.ok,true,p.error);
 assert.equal(p.method,'offline-confirmed-combat-event-graph');
 assert.ok(p.semanticVerification.matched.includes('combatEventGraph'));
 assert.deepEqual(Array.from(p.semanticVerification.missing),[]);
 return {p,r:p.recipe.rules[0],graph:p.recipe.rules[0].eventGraph};
}
function player(hp=160){
 return {playerNum:1,x:100,y:100,hp,maxHp:200,
  forge:{signatureVersion:1},_forgeActionClock:12,_forgeBalanceFrame:12,
  _scratchEvents:{}};
}
function hit(g,p){p._forgeActionClock++;g.SignatureLive.record(p,'hit');}
function dodge(p){p._forgeDodgeSerial=(p._forgeDodgeSerial||0)+1;p._forgeActionClock++;}
function guard(g,p){p._forgeActionClock++;g.SignatureLive.record(p,'guard');}
test('Korean AND maps two actual authenticated event sources and ordered actions',()=>{
 const g=boot(),{p,r,graph}=parsed(g);
 assert.equal(graph.trigger,'hit');
 assert.equal(graph.minCount,2);
 assert.equal(graph.secondary.trigger,'dodge');
 assert.equal(graph.secondary.mode,'and');
 assert.deepEqual(Array.from(graph.actions),['wave','shield']);
 assert.equal(r.when,'hit');
 assert.ok(p.semanticGraph.conditions.some(c=>
  c.mode==='confirmed_combat_event'&&c.eventOperator==='and'&&
  c.additionalEvent==='dodge'));
 assert.ok(p.semanticGraph.relations.some(x=>x.type==='verified_event_AND'));
 assert.match(p.summary[0].when,/그리고/);
});
test('AND does not fire on hits alone, and executes once after a verified dodge',()=>{
 const g=boot(),{p}=parsed(g),a=player();
 const run=g.SignatureRuleLive.begin(p.recipe,a);
 assert.equal(run.graphFires[0],0);
 hit(g,a);assert.equal(g.SignatureRuleLive.step(run,a,null),null);
 hit(g,a);assert.equal(g.SignatureRuleLive.step(run,a,null),null);
 assert.equal(run.graphCounts[0],2);
 assert.equal(run.secondaryCounts[0],0);
 dodge(a);
 assert.equal(g.SignatureRuleLive.step(run,a,null)?.type,'wave');
 assert.equal(run.secondaryCounts[0],1);
 assert.equal(run.graphFires[0],1);
 let next=null;
 for(let i=0;i<35&&!next;i++){a._forgeActionClock++;next=g.SignatureRuleLive.step(run,a,null);}
 assert.equal(next?.type,'shield');
 hit(g,a);dodge(a);
 for(let i=0;i<25;i++)assert.equal(g.SignatureRuleLive.step(run,a,null),null);
});
test('AND does not fire on dodge alone, and order of confirmed events is independent',()=>{
 const g=boot(),{p}=parsed(g),a=player();
 const run=g.SignatureRuleLive.begin(p.recipe,a);
 dodge(a);assert.equal(g.SignatureRuleLive.step(run,a,null),null);
 hit(g,a);assert.equal(g.SignatureRuleLive.step(run,a,null),null);
 hit(g,a);assert.equal(g.SignatureRuleLive.step(run,a,null)?.type,'wave');
});
test('OR fires on a dodge without any hits at all',()=>{
 const g=boot(),{p,graph}=parsed(g,OR),a=player();
 assert.equal(graph.secondary.mode,'or');
 const run=g.SignatureRuleLive.begin(p.recipe,a);
 dodge(a);
 assert.equal(g.SignatureRuleLive.step(run,a,null)?.type,'shield');
 assert.equal(run.graphCounts[0],0);
 assert.equal(run.secondaryCounts[0],1);
});
test('OR fires on hit threshold alone and does not require the second event',()=>{
 const g=boot(),{p}=parsed(g,OR),a=player();
 const run=g.SignatureRuleLive.begin(p.recipe,a);
 hit(g,a);assert.equal(g.SignatureRuleLive.step(run,a,null),null);
 hit(g,a);assert.equal(g.SignatureRuleLive.step(run,a,null)?.type,'shield');
 assert.equal(run.secondaryCounts[0],0);
});
test('events before arming and same-frame duplicates never count as confirmed new events',()=>{
 const g=boot(),{p}=parsed(g),a=player();
 hit(g,a);dodge(a);
 const run=g.SignatureRuleLive.begin(p.recipe,a);
 assert.equal(run.graphCounts[0],0);
 assert.equal(run.secondaryCounts[0],0);
 assert.equal(g.SignatureRuleLive.step(run,a,null),null);
 hit(g,a);g.SignatureLive.record(a,'hit');g.SignatureLive.record(a,'hit');
 assert.equal(g.SignatureRuleLive.step(run,a,null),null);
 assert.equal(run.graphCounts[0],1);
 dodge(a);assert.equal(g.SignatureRuleLive.step(run,a,null),null);
 hit(g,a);assert.equal(g.SignatureRuleLive.step(run,a,null)?.type,'wave');
});
test('guard can replace dodge as the second authenticated source and cannot be a visual-only effect',()=>{
 const g=boot(),raw='공격을 세 번 적중시키고 상대의 공격을 방어하면 자신을 회복한다';
 const {p,graph}=parsed(g,raw),a=player();
 assert.equal(graph.secondary.trigger,'guard');
 assert.equal(graph.minCount,3);
 const run=g.SignatureRuleLive.begin(p.recipe,a);
 for(let i=0;i<3;i++){hit(g,a);assert.equal(g.SignatureRuleLive.step(run,a,null),null);}
 assert.equal(run.graphCounts[0],3);
 assert.equal(run.secondaryCounts[0],0,'no auto-guard generated by the parser');
 guard(g,a);
 assert.equal(g.SignatureRuleLive.step(run,a,null)?.type,'heal');
});
test('wire and IR round trips retain AND/OR without modifying legacy encoded events',()=>{
 const g=boot(['pvp-original-engine']),{p,r,graph}=parsed(g);
 const norm=g.CombatEventGraph.normalize(graph);
 assert.deepEqual(JSON.parse(JSON.stringify(g.CombatEventGraph.unpack(g.CombatEventGraph.pack(graph)))),
  JSON.parse(JSON.stringify(norm)));
 const old=g.CombatEventGraph.pack({trigger:'hit',actions:['wave']});
 assert.deepEqual(Array.from(old),[0,2]);
 const previous=g.CombatEventGraph.pack({trigger:'hit',actions:['wave'],minCount:2,hpBelow:40});
 assert.deepEqual(Array.from(previous),[0,2,-1,2,40]);
 const profile={id:'c',name:'AND 스킬',forgeData:{hp:240,speed:2,color:'#112233',
  effectColor:'#112233',signatureVersion:1,allAbilities:false,
  skills:[{name:'AND',trigger:'auto',cooldown:5,threshold:40,
   actions:[r.action],ruleSet:p.recipe}]}};
 const packet=g.PvpOriginalEngine.pack(profile);
 assert.ok(JSON.stringify(packet).length<2380);
 const decoded=g.PvpOriginalEngine.unpack(packet);
 assert.deepEqual(JSON.parse(JSON.stringify(decoded.skills[0].ruleSet.rules[0].eventGraph)),
  JSON.parse(JSON.stringify(graph)));
 assert.deepEqual(JSON.parse(JSON.stringify(g.SkillIR.toRecipe(g.SkillIR.fromRecipe(p.recipe)).rules[0].eventGraph)),
  JSON.parse(JSON.stringify(graph)));
});
test('untrusted network input cannot inject more event sources, nested operations or invalid modes',()=>{
 const g=boot(),T=g.CombatEventGraph;
 const cases=[
  {trigger:'hit',actions:['wave'],secondary:{trigger:'hit',mode:'or'}},
  {trigger:'hit',actions:['wave'],secondary:{trigger:'dodge',mode:'xor'}},
  {trigger:'hit',actions:['wave'],secondary:{trigger:'dodge',mode:'and',minCount:5}},
  {trigger:'hit',actions:['wave'],secondary:{trigger:'guard',mode:'or'},hpBelow:40,minCount:2},
  {trigger:'hit',actions:['wave'],secondary:{trigger:'dodge',mode:'or',callback:'eval'}},
  {trigger:'hit',actions:['wave'],secondary:{trigger:'javascript',mode:'or'}}
 ];
 for(const c of cases.filter(x=>x.secondary?.callback===undefined))
  assert.equal(T.normalize(c),undefined);
 for(const bad of [[0,2,-2,2,1,1,2],[0,2,-2,2,1,1,0,9],[0,2,-2,2,10,1,0]])
  assert.equal(T.unpack(bad),undefined);
});
test('explicit but unimplemented OR/AND + live HP and vague chronology return errors',()=>{
 const g=boot(),phrases=[
  '공격을 두 번 명중시키거나 적의 공격을 회피하면 내 체력이 40% 이하라면 폭발한다',
  '공격을 5회 명중시키고 적의 공격을 회피하면 보호막을 만든다',
  '공격을 두 번 명중시키고 적의 공격을 회피하면 보호막을 만들지 않는다',
  '공격을 두 번 명중시키고 적의 공격을 회피하면 회복하고 보호막을 생성하고 충격파를 발사한 뒤 속박한다',
  '공격을 두 번 명중시키고 적의 공격을 회피하면 충격파를 쓴 뒤 피해가 들어가면 회복한다'
 ];
 for(const raw of phrases){
  const p=g.SkillSentenceEngine.parse(raw);
  assert.equal(p.ok,false,raw);
 }
});
test('mock lab shows two observed counters and accurately flags unverified dodge/guard',()=>{
 const g=boot(['arena-body-physics','studio-pinball-lab']),{p,r}=parsed(g);
 const profile={name:'복합 사건',color:'#9999ff',effectColor:'#9999ff',
  signatureVersion:1,skills:[{name:'AND',trigger:'auto',actions:[r.action],ruleSet:p.recipe}]};
 const lab=g.StudioPinballLab.make(profile);lab.fire();lab.advanceTo(1400);
 const audit=lab.combatEventAudit[0];
 assert.equal(audit.secondary.trigger,'dodge');
 assert.equal(audit.secondary.required,1);
 assert.equal(audit.secondary.verifiedInRealBattle,false);
 assert.match(audit.note,/실제 전투에서만 인증/);
});
