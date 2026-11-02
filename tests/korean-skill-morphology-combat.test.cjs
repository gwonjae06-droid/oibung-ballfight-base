'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=n=>fs.readFileSync(path.join(__dirname,'../js/features',n+'.js'),'utf8');
function boot(){
 const types={wave:'충격파',shot:'투사체',beam:'레이저',bolt:'낙뢰',slash:'베기',
 haste:'가속',splitshot:'분열탄',shield:'방어막',dive:'낙하',leap:'점프',dash:'돌진',heal:'회복'};
 const g={Math,Date,Number,console,SkillForge:{TYPE:types,STATUS:{none:'없음'}},
 ActionRegistry:{TYPE:types,get:id=>({offense:['wave','shot','beam','slash','splitshot'].includes(id),
 physics:id==='shot'?'projectile':'strike'}),
 visualCatalog:Object.fromEntries(Object.keys(types).map(id=>[id,['wave','#ffffff']]))}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const name of ['signature-program','metaphor-visuals','signature-scratch',
 'fantasy-skill-graph','signature-rule-skill','signature-rule-live',
 'korean-skill-grammar','signature-prompt-compiler','skill-sentence-engine'])
 vm.runInContext(src(name),g,{filename:name});
 return g;
}
test('Korean grammatical endings, adverbs, particles and subject-object roles',()=>{
 const g=boot(),tokens=g.KoreanSkillGrammar.tokenize('상대에게 엄청나게 턱으로 때리고 가속하면');
 assert.ok(tokens.some(t=>t.surface==='상대에게'&&t.particle==='에게'));
 assert.ok(tokens.some(t=>t.surface==='엄청나게'&&t.pos==='adverb'));
 assert.ok(tokens.some(t=>t.surface==='턱으로'&&t.particle==='으로'));
 assert.ok(tokens.some(t=>t.surface==='때리고'&&t.ending==='고'));
 assert.ok(tokens.some(t=>t.surface==='가속하면'&&t.ending==='면'));
 const clauses=g.KoreanSkillGrammar.analyze('벽에 튕기면 가속하고 상대와 충돌하면 충격파',g.SkillForge.TYPE).clauses;
 assert.ok(clauses.some(x=>x.chosen?.type==='haste'&&x.when==='wall'));
 assert.ok(clauses.some(x=>x.chosen?.type==='wave'&&x.when==='contact'));
});
test('separate reactive clauses bind only to their own attacks',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse('벽에 튕기면 가속하고 상대와 충돌하면 충격파를 발사한다');
 assert.equal(r.ok,true);
 assert.ok(r.recipe.rules.some(x=>x.when==='wall'&&x.action.type==='haste'));
 assert.ok(r.recipe.rules.some(x=>x.when==='contact'&&x.action.type==='wave'));
 assert.ok(!r.recipe.rules.some(x=>x.when==='pulse'&&x.action.type==='haste'));
});
test('onomatopoeia is mapped to a bounded, visible, executable attack',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse('뿅뿅 슝슝 적에게 슈우웅');
 assert.equal(r.ok,true);
 assert.ok(r.recipe.rules.some(x=>x.action.type==='shot'));
 assert.ok(r.verification.checks.find(x=>x.type==='shot'&&x.vfx&&x.expectedDamage));
 assert.equal(g.SkillSentenceEngine.parse('인간의 마음을 읽어 AI의 자아를 깨운다').ok,false);
});
test('negative imperative excludes attack while preserving later positive instruction',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse('멘헤라빔은 쏘지 말고 커다란 턱으로 후려친다');
 assert.equal(r.ok,true);
 assert.ok(r.recipe.rules.some(x=>x.action.type==='slash'));
 assert.ok(!r.recipe.rules.some(x=>x.action.type==='beam'));
});
test('Korean intensity modifiers adjust physical damage and attack radius',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse('강하게 엄청나게 거대한 턱으로 상대를 후려친다');
 assert.equal(r.ok,true);
 const a=r.recipe.rules[0].action;
 assert.equal(a.type,'slash');assert.ok(a.damage>18&&a.damage<=120);
 assert.ok(a.radius>150&&a.radius<=300);assert.equal(a.visual.shape,'jaw');
});
test('live wave and shadow beam lose real enemy HP, with cast and impact effects',()=>{
 const g=boot();let casts=0,fallbacks=0,impacts=0,particles=0;
 Object.assign(g,{
  SkillVisuals:{cast(){casts++;return false},impact(){impacts++}},
  BattleFX:{cast(){fallbacks++},beam(){}},
  AdvancedCombat:{canHit(){return true},height(){return 0},execute(){return false}},
  ForgeExpansion:{execute(){return false},damageScale(){return 1},applyStatus(){}},
  AbilityAtlas:{choose:(p,enemies)=>enemies[0],execute(){return false}},
  createHitParticles(){particles++},addFloatingText(){},getClosestAliveEnemy(){return null},
  canvas:{width:480,height:300}
 });
 g.ActionRegistry.run=()=>false;
 vm.runInContext(src('skill-forge-impact'),g);
 vm.runInContext(src('skill-forge-executor'),g);
 const p={x:100,y:100,radius:22,vx:0,vy:0,hp:300,maxHp:300,
  forge:{color:'#eeddff',effectColor:'#bbccff'},_forgeBalanceFrame:1};
 const e={x:160,y:100,radius:22,hp:300,maxHp:300,vx:0,vy:0,invincible:0};
 const allowed=new Set(['dash','blink']);
 const resolver=g.SkillForgeImpactFactory({MOVEMENT_ONLY:allowed});
 const executor=g.SkillForgeExecutorFactory({MOVEMENT_ONLY:allowed,hit:resolver.hit,enemies:()=>[e]});
 const wave=g.SkillSentenceEngine.parse('강하게 충격파를 발사한다').recipe.rules[0].action;
 executor.execute(p,wave,e);
 assert.ok(e.hp<300,'wave attack must damage');
 assert.ok(casts>0&&fallbacks>0&&impacts>0&&particles>0,'visible cast and contact');
 e.hp=300;e.invincible=0;e._forgeImpactStamps=new WeakMap();p._forgeBalanceFrame=30;
 const beam=g.SkillSentenceEngine.parse('오슬우의 멘헤라가 모여 멘헤라빔을 쏜다').recipe.rules[0].action;
 executor.execute(p,beam,e);
 assert.ok(e.hp<300,'dark beam damages enemy in range');
 assert.equal(beam.visual.shape,'beam');
});
test('300 malformed or absurd Korean prompts never emit unbounded executable actions',()=>{
 const g=boot(),seed=['턱으로 후려친다','벽에 튕기면 가속한다','적과 부딪히면 충격파',
 '멘헤라빔을 발사','분열탄이 분열하면 다시 쏜다','뿅뿅 슝슝','부숴랏 쾅쾅',
 '안 하고','초거대한 턱으로','회복하며 보호막','점프하고 낙하','💥🎱','안되는 문장'];
 for(let i=0;i<300;i++){
  const sample=seed[i%seed.length]+' '.repeat(i%4)+seed[(i*7+3)%seed.length];
  const r=g.SkillSentenceEngine.parse(sample);
  if(!r.ok)continue;
  assert.ok(r.recipe.rules.length<=8);
  const actor={hp:200,maxHp:200,x:0,y:0,_scratchEvents:{}};
  const run=g.SignatureRuleLive.begin(r.recipe,actor),enemy={hp:200,x:70,y:20};
  for(let tick=0;tick<120;tick++){
   const a=g.SignatureRuleLive.step(run,actor,enemy);
   if(a)assert.ok(g.SkillForge.TYPE[a.type], 'unsupported emitted action');
  }
  assert.ok(run.actions<=80);
 }
});
