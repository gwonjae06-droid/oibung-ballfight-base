'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
function boot(){
 const g={Math,Date,Number,Map,WeakMap,Set,console,players:[],CUSTOM_DEFS:[],
  BEHAVIORS:{},CHARACTER_PHOTOS:{},canvas:{width:480,height:320},
  createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['action-registry','semantic-physics','physics-law-engine',
  'signature-program','skill-fx-composer','procedural-visual-geometry',
  'metaphor-visuals','skill-color-policy','semantic-concept-atlas',
  'concept-fusion','imagination-concepts','semantic-intent-composer',
  'signature-scratch','fantasy-skill-graph','signature-rule-skill',
  'skill-ir','signature-rule-live','korean-skill-grammar',
  'korean-skill-parameters','signature-prompt-compiler',
  'semantic-relationship-graph','skill-sentence-engine']){
  vm.runInContext(fs.readFileSync('js/features/'+file+'.js','utf8'),g,
   {filename:file+'.js'});
 }
 return g;
}
test('verified action graph relates original butterfly, confirmed contact and homing children',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse(
  '푸른 얼음 나비 세 마리가 적을 추적하다가 닿으면 조각으로 분열하고 그 조각들이 다시 적을 공격한다');
 assert.equal(r.ok,true,r.error);
 const graph=r.semanticGraph;
 assert.equal(graph.version,1);
 assert.equal(graph.actions[0].type,'shot');
 assert.equal(graph.actions[0].shape,'butterfly');
 assert.equal(graph.actions[0].fragments,3);
 assert.equal(graph.actions[0].splitTrigger,'hit');
 assert.ok(graph.relations.some(x=>x.type==='fractures_on_hit'));
 assert.ok(graph.relations.some(x=>x.type==='tracks'&&x.from.startsWith('entity_')));
 assert.ok(graph.references.some(x=>x.resolved&&x.target));
 assert.ok(graph.entities.length<=graph.limits.maxEntities);
 assert.ok(graph.relations.length<=graph.limits.maxRelations);
});
test('IR v2 keeps source graph and legacy v1 remains executable',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse(
  '붉은 레일건이 적을 추적하다가 명중하면 폭발한다');
 assert.equal(r.ok,true,r.error);
 const v1=g.SkillIR.fromRecipe(r.recipe);
 const v2=r.semanticIR;
 assert.equal(v1.version,1);
 assert.equal(v2.version,2);
 assert.equal(v2.sourceText,r.sourceText);
 assert.ok(v2.semantics.actions.length>0);
 assert.equal(g.SkillIR.toRecipe(v2).rules[0].action.type,'shot');
 assert.equal(g.SkillIR.normalize(v2).version,2);
 assert.equal(g.SkillIR.normalize(v1).version,1);
});
test('untrusted semantic graph is discarded and regenerated from validated actions',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse('푸른 화살을 3발 발사해 적을 추적한다');
 const bad={...r.semanticIR,semantics:{entities:[{id:'tampered'}],actions:[{type:'eval'}]}};
 const safe=g.SkillIR.normalize(bad);
 assert.ok(!safe.semantics.entities.some(x=>x.id==='tampered'));
 assert.ok(!safe.semantics.actions.some(x=>x.type==='eval'));
 assert.equal(safe.semantics.runtime,'SignatureRuleSkill / ForgeWorld');
});
test('the user-facing compiler loads graph after Korean grammar analysis',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('semantic-relationship-graph.js')<
  html.indexOf('skill-sentence-engine.js'));
});
