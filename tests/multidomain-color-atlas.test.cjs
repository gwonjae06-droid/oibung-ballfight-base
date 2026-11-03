'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm');
const src=n=>fs.readFileSync('js/features/'+n+'.js','utf8');
function boot(names){
 const g={Math,Date,Number,Set,Map,WeakMap,console,players:[],
  CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:480,height:320},createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const n of names)vm.runInContext(src(n),g,{filename:n+'.js'});
 return g;
}
const scripts=['action-registry','semantic-physics','physics-law-engine','signature-program',
 'skill-fx-composer','metaphor-visuals','skill-color-policy','semantic-concept-atlas',
 'concept-fusion','imagination-concepts','signature-scratch','fantasy-skill-graph',
 'signature-rule-skill','skill-ir','signature-rule-live','korean-skill-grammar',
 'korean-skill-parameters','signature-prompt-compiler','skill-sentence-engine'];
test('19 domains and 198 reusable concept atoms share only the 28 existing Canvas motifs',()=>{
 const g=boot(scripts),a=g.SemanticConceptAtlas;
 assert.equal(a.CATALOG.length,198);
 assert.equal(a.domains.length,19);
 for(const def of a.CATALOG){
  assert.ok(def.visual.length>=1&&def.visual.length<=3,def.id);
  for(const kind of def.visual)assert.ok(g.SkillFXComposer.KINDS[kind],def.name+': '+kind);
 }
 assert.equal(Object.keys(g.SkillFXComposer.KINDS).length,28,
  'hundreds of concepts must not generate hundreds of separate renderers');
 const atlas=String(src('semantic-concept-atlas'));
 assert.ok(atlas.includes('new RegExp(words'));
 assert.ok(!atlas.includes('eval('));
});
test('cross-domain sentence reuses geometry for genetics, virology, music, mathematics and food',()=>{
 const g=boot(scripts);
 for(const [s,desired] of [
  ['DNA 유전자의 나선과 바이러스의 안개를 합쳐 적에게 피해를 준다',['coil','mist']],
  ['피보나치 수열과 바이올린의 현이 소용돌이친다',['rings','coil']],
  ['별가루가 초콜릿 폭포를 따라 흐르며 폭발한다',['water','stars']],
  ['프랙탈 종이접기 결정이 사방으로 폭발한다',['shards','petals']],
  ['오로라와 심전도의 박동을 융합해 파동을 일으킨다',['stars','hearts']]
 ]){
  const result=g.SkillSentenceEngine.parse(s);
  assert.equal(result.ok,true,result.error||s);
  assert.equal(result.method,'offline-concept-materializer',s);
  assert.equal(result.plan.strategy,'reuse');
  const layers=result.recipe.rules[0].action.visual.layers.map(v=>v.kind);
  for(const kind of desired)assert.ok(layers.includes(kind),s+' missing '+kind+' in '+layers);
 }
});
test('semantic meaning keeps damaging biology separate from regenerative biology',()=>{
 const g=boot(scripts);
 const attack=g.SkillSentenceEngine.parse('바이러스 안개가 적에게 피해를 준다');
 const healer=g.SkillSentenceEngine.parse('DNA 유전자 치료로 세포를 재생한다');
 assert.equal(attack.ok,true,attack.error);
 assert.equal(healer.ok,true,healer.error);
 assert.equal(attack.recipe.rules[0].action.type,'zone');
 assert.equal(healer.recipe.rules[0].action.type,'regen');
 assert.ok(attack.verification.checks.some(x=>x.expectedDamage));
});
test('unrecognized unrelated prose is not falsely advertised as invented executable physics',()=>{
 const g=boot(scripts),a=g.SemanticConceptAtlas;
 assert.equal(a.match('오늘 일찍 잠들어야겠다').length,0);
 const unsupported=g.ImaginationConcepts.interpret('사회학의 인과성을 전부 통제한다');
 assert.equal(unsupported,null);
 const x=g.SkillSentenceEngine.parse('로봇이 실제 컴퓨터를 해킹한다');
 assert.equal(x.ok,false);
});
test('explicit Korean palette and hex overrides are detected independent of element colors',()=>{
 const g=boot(scripts),cp=g.SkillColorPolicy;
 for(const [text,hex] of [
  ['푸른 화염을 발사한다','#276df0'],
  ['검은 번개 사슬로 묶는다','#101827'],
  ['황금색 얼음 창으로 찌른다','#facc15'],
  ['분홍색 드론을 소환한다','#fb7185'],
  ['색상 #1a2b3c 의 유성탄','#1a2b3c']
 ])assert.equal(cp.explicit(text)?.color,hex,text);
 assert.equal(cp.explicit('화염의 번개를 발사한다'),null,
  'fire and lightning are element names, not requested colors');
});
test('skill sentence priority overrides actor color only for explicitly chosen skills',()=>{
 const g=boot(scripts),parser=g.SkillSentenceEngine;
 const explicit=parser.parse('푸른 화염 레일건이 발사된다');
 const inherited=parser.parse('화염 레일건이 발사된다');
 assert.equal(explicit.ok,true,explicit.error);
 assert.equal(inherited.ok,true,inherited.error);
 assert.equal(explicit.colorPriority,'skill-sentence');
 assert.equal(inherited.colorPriority,'character');
 const a=explicit.recipe.rules[0].action,b=inherited.recipe.rules[0].action;
 assert.equal(a.visual.colorMode,'explicit');
 assert.equal(b.visual.colorMode,'inherit');
 assert.equal(g.SkillColorPolicy.resolve(a.visual,'#ff00ff').color,'#276df0');
 assert.equal(g.SkillColorPolicy.resolve(b.visual,'#ff00ff').color,'#ff00ff');
 assert.equal(g.SkillColorPolicy.resolve(b.visual,'#123456').color,'#123456');
 assert.ok(g.SkillColorPolicy.resolve(b.visual,'#123456').layers.every(x=>/^#[0-9a-f]{6}$/.test(x.color)));
});
test('independent sentences retain independent palette priorities and colors after normalization',()=>{
 const g=boot(scripts);
 const result=g.SkillSentenceEngine.parseBundle('붉은색 레일건을 발사한다. 별빛 결정으로 공격한다.');
 assert.equal(result.ok,true,result.error);
 assert.equal(result.skills.length,2);
 assert.equal(result.skills[0].colorPriority,'skill-sentence');
 assert.equal(result.skills[1].colorPriority,'character');
 const a=g.SignatureRuleSkill.normalize(result.skills[0].recipe).rules[0].action;
 const b=g.SignatureRuleSkill.normalize(result.skills[1].recipe).rules[0].action;
 assert.equal(a.visual.colorMode,'explicit');
 assert.equal(b.visual.colorMode,'inherit');
 assert.equal(g.SkillColorPolicy.resolve(a.visual,'#00ff00').color,'#ff454f');
 assert.equal(g.SkillColorPolicy.resolve(b.visual,'#00ff00').color,'#00ff00');
});
test('legacy authored arts without color mode retain their pre-existing art palette',()=>{
 const g=boot(scripts);
 const old={shape:'aura',color:'#aabbcc',scale:1,
  layers:[{kind:'stars',color:'#ddaacc',power:1,spin:1}]};
 const result=g.SkillColorPolicy.resolve(old,'#112233');
 assert.equal(result.color,'#aabbcc');
 assert.equal(result.layers[0].color,'#ddaacc');
 assert.equal(result.colorMode,undefined);
});
test('actual SkillVisuals combat stores dynamically resolved colors for real cast and impact',()=>{
 const g=boot([...scripts,'skill-visuals']);
 const hero={x:80,y:120,playerNum:1,radius:22,forge:{effectColor:'#1199aa'},
  vx:2,vy:0};
 const enemy={x:150,y:120,playerNum:2,radius:20,hp:200};
 const autos=g.SkillSentenceEngine.parse('초콜릿 폭포를 쏜다').recipe.rules[0].action;
 const blue=g.SkillSentenceEngine.parse('파란색 초콜릿 폭포를 쏜다').recipe.rules[0].action;
 assert.equal(g.SkillVisuals.cast(hero,autos,enemy),true);
 let fx=g.SkillVisuals.exportEffects().at(-1);
 assert.equal(fx.color,'#1199aa');
 assert.equal(fx.visual.color,'#1199aa');
 assert.ok(fx.visual.layers.every(x=>x.color!== '#ff7941'));
 hero.forge.effectColor='#dd11cc';
 assert.equal(g.SkillVisuals.cast(hero,autos,enemy),true);
 fx=g.SkillVisuals.exportEffects().at(-1);
 assert.equal(fx.visual.color,'#dd11cc','recolor without rewriting saved action');
 assert.equal(g.SkillVisuals.impact(hero,enemy,blue),true);
 fx=g.SkillVisuals.exportEffects().at(-1);
 assert.equal(fx.color,'#276df0');
 assert.equal(fx.visual.color,'#276df0');
});
test('real mini-preview uses chosen profile color and ignores it for sentence-specific colors',()=>{
 const g=boot([...scripts,'skill-visuals']);
 const v=g.SkillSentenceEngine.parse('검은 프리즘 광선을 발사한다').recipe.rules[0].action.visual;
 const u=g.SkillSentenceEngine.parse('프리즘 광선을 발사한다').recipe.rules[0].action.visual;
 const call=[];const ctx=new Proxy({globalAlpha:1},{get(o,k){
  if(k in o)return o[k];return (...args)=>call.push([k,args]);
 },set(o,k,v){o[k]=v;return true}});
 assert.equal(g.SkillVisuals.previewFrame(ctx,{type:'beam',color:'#66cc88',
  visual:v,progress:.4,radius:100}),true);
 assert.equal(g.SkillVisuals.previewFrame(ctx,{type:'beam',color:'#66cc88',
  visual:u,progress:.4,radius:100}),true);
 assert.ok(call.length>30);
 assert.equal(g.SkillColorPolicy.resolve(v,'#66cc88').color,'#101827');
 assert.equal(g.SkillColorPolicy.resolve(u,'#66cc88').color,'#66cc88');
});
test('compact PvP transfer retains palette source and preserves old packet dimensions',()=>{
 const g=boot([...scripts,'pvp-original-engine']);
 const a=g.SkillSentenceEngine.parse('보라색 나선 로켓탄을 발사한다').recipe.rules[0].action;
 const b=g.SkillSentenceEngine.parse('나선 로켓탄을 발사한다').recipe.rules[0].action;
 const p={id:'t',name:'실험',forgeData:{name:'실험',signatureVersion:1,
  hp:200,speed:2,color:'#1188dd',effectColor:'#1188dd',
  skills:[{name:'색',trigger:'auto',cooldown:3,threshold:40,actions:[a],
   ruleSet:{window:6,rules:[{when:'pulse',interval:2,action:a}]}}]}};
 let packed=g.PvpOriginalEngine.pack(p);
 assert.ok(JSON.stringify(packed).length<2380);
 let unpack=g.PvpOriginalEngine.unpack(packed);
 assert.equal(unpack.skills[0].actions[0].visual.colorMode,'explicit');
 assert.equal(unpack.skills[0].ruleSet.rules[0].action.visual.colorMode,'explicit');
 p.forgeData.skills[0].actions=[b];p.forgeData.skills[0].ruleSet.rules[0].action=b;
 packed=g.PvpOriginalEngine.pack(p);
 unpack=g.PvpOriginalEngine.unpack(packed);
 assert.equal(unpack.skills[0].actions[0].visual.colorMode,'inherit');
 const legacy={...b,visual:{...b.visual,colorMode:undefined}};
 p.forgeData.skills[0].actions=[legacy];delete p.forgeData.skills[0].ruleSet;
 packed=g.PvpOriginalEngine.pack(p);
 assert.equal(g.PvpOriginalEngine.unpack(packed).skills[0].actions[0].visual.colorMode,undefined);
});
test('HTML loaders keep both new modules ahead of action normalizers in game and PvP',()=>{
 for(const page of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(page,'utf8');
  assert.ok(html.includes('skill-color-policy.js?v=1-dynamic-hero-color'));
  assert.ok(html.includes('semantic-concept-atlas.js?v=1-multidomain-atlas'));
  assert.ok(html.indexOf('skill-fx-composer.js')<html.indexOf('semantic-concept-atlas.js'));
  assert.ok(html.indexOf('metaphor-visuals.js')<html.indexOf('skill-color-policy.js'));
  assert.ok(html.indexOf('semantic-concept-atlas.js')<html.indexOf('imagination-concepts.js'));
  assert.ok(html.indexOf('skill-color-policy.js')<html.indexOf('signature-scratch.js'));
 }
 assert.match(src('signature-rule-studio'),/sentence-color-choice/);
});
