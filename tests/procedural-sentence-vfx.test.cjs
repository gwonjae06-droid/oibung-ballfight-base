'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync('js/features/'+n+'.js','utf8');
function boot(names){
 const g={Math,Date,Number,Map,WeakMap,Set,console,players:[],CUSTOM_DEFS:[],
  BEHAVIORS:{},CHARACTER_PHOTOS:{},canvas:{width:480,height:320},
  createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const n of names)vm.runInContext(source(n),g,{filename:n+'.js'});
 return g;
}
const libs=['action-registry','semantic-physics','physics-law-engine',
 'signature-program','skill-fx-composer','procedural-visual-geometry',
 'metaphor-visuals','skill-color-policy','semantic-concept-atlas',
 'concept-fusion','imagination-concepts','semantic-intent-composer',
 'signature-scratch','fantasy-skill-graph','signature-rule-skill','skill-ir',
 'signature-rule-live','korean-skill-grammar','korean-skill-parameters',
 'signature-prompt-compiler','skill-sentence-engine'];
function ctx(){
 const c={globalAlpha:1};
 for(const name of ['save','restore','scale','beginPath','moveTo','bezierCurveTo',
  'quadraticCurveTo','lineTo','closePath','fill','stroke','ellipse','arc',
  'translate','rotate','strokeRect']){
   c[name]=()=>{c.calls++;};
 }
 c.calls=0;return c;
}
test('procedural creature geometry draws six bounded distinct silhouettes',()=>{
 const g=boot(['procedural-visual-geometry']);
 const keys=Object.keys(g.ProceduralVisualGeometry.SHAPES);
 assert.equal(keys.length,6);
 for(const shape of keys){
  const c=ctx();
  assert.equal(g.ProceduralVisualGeometry.paint(c,{shape,progress:.41,
   color:'#22ccee',scale:1.2}),true);
  assert.ok(c.calls>=10,shape+' must paint nonempty paths');
 }
 assert.equal(g.ProceduralVisualGeometry.paint(ctx(),{shape:'unknown'}),false);
});
test('Korean creature skill retains butterfly geometry, count, physical hit fracture and inherited colors',()=>{
 const g=boot(libs);
 const r=g.SkillSentenceEngine.parse(
  '푸른 얼음 나비 세 마리가 적을 추적하다가 닿으면 깨지고 조각들이 다시 적을 공격한다');
 assert.equal(r.ok,true,r.error);
 const a=r.recipe.rules[0].action;
 assert.equal(a.visual.shape,'butterfly');
 assert.equal(a.count,3);
 assert.equal(a.fusion.homing,true);
 assert.equal(a.fusion.splitTrigger,'hit');
 assert.equal(a.visual.colorMode,'explicit');
 const c=ctx();
 assert.equal(g.MetaphorVisuals.paint(c,{visual:a.visual,progress:.4,
  phase:'cast',radius:85}),true);
 assert.ok(c.calls>25);
});
test('magnetic jellyfish uses actual decaying physics with a jellyfish silhouette',()=>{
 const g=boot(libs);
 const r=g.SkillSentenceEngine.parse(
  '청록색 해파리 모양 자기장이 적을 끌어당기면서 빙빙 회전시키고 3초 동안 점점 약해진다');
 assert.equal(r.ok,true,r.error);
 const a=r.recipe.rules[0].action;
 assert.equal(a.type,'phenomenon');
 assert.equal(a.visual.shape,'jellyfish');
 assert.equal(a.law.decay,'fade');
 assert.ok(a.law.terms.some(t=>t.op==='attract'));
 assert.ok(a.law.terms.some(t=>t.op==='spin'));
 assert.equal(a.visual.colorMode,'explicit');
});
test('visual hints never override explicitly requested attack and support verbs',()=>{
 const g=boot(libs);
 const r=g.SkillSentenceEngine.parse('꽃잎처럼 생긴 해파리가 아군을 회복하고 보호막을 건다');
 assert.equal(r.ok,true,r.error);
 assert.equal(r.recipe.rules[0].action.type,'regen');
 assert.equal(r.recipe.rules[1].action.type,'shield');
 assert.equal(r.recipe.rules[0].action.visual.shape,'jellyfish');
});
test('new geometry shape IDs survive PvP profile serialization without shifting old shapes',()=>{
 const g=boot([...libs,'pvp-original-engine']);
 const create=shape=>({id:'custom',name:'Art',forgeData:{
  signatureVersion:1,hp:240,speed:2,color:'#aabbcc',effectColor:'#aabbcc',allAbilities:false,
  skills:[{name:'demo',trigger:'auto',cooldown:3,threshold:30,
   actions:[{type:'shot',damage:20,count:1,visual:{
    shape,color:'#ff55aa',scale:1.5,layers:[]}}]}]}});
 for(const shape of ['halo','butterfly','jellyfish','mechanical']){
  const data=g.PvpOriginalEngine.pack(create(shape));
  const restored=g.PvpOriginalEngine.unpack(data);
  assert.equal(restored.skills[0].actions[0].visual.shape,shape);
  assert.ok(JSON.stringify(data).length<2380);
 }
});
test('both live battle entrypoints load silhouettes before metaphor visuals',()=>{
 for(const path of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(path,'utf8');
  assert.ok(html.includes('procedural-visual-geometry.js?v=causal-creatures1'));
  assert.ok(html.indexOf('procedural-visual-geometry.js')<html.indexOf('metaphor-visuals.js'));
 }
});
