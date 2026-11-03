'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../js/features',file+'.js'),'utf8');
function boot(){
 const g={Math,Date,Number,console};
 g.window=g;g.globalThis=g;
 vm.createContext(g);
 const load=file=>vm.runInContext(read(file),g,{filename:file+'.js'});
 load('action-registry');
 load('semantic-physics');
 g.SkillForge={TYPE:g.ActionRegistry.TYPE,STATUS:{none:'없음',ice:'얼음',fire:'화상',poison:'독'}};
 for(const name of ['signature-program','skill-fx-composer','metaphor-visuals',
  'signature-scratch','fantasy-skill-graph','signature-rule-skill',
  'signature-rule-live','korean-skill-grammar','signature-prompt-compiler',
  'skill-sentence-engine'])load(name);
 return {g,load};
}
test('three original mechanics are registered as executable, bounded physics',()=>{
 const {g}=boot();
 for(const type of ['tether','repulse','vortex']){
  const record=g.ActionRegistry.get(type);
  assert.ok(record&&record.offense&&record.execute&&record.visual);
  assert.ok(g.ActionRegistry.TYPE[type]);
  assert.ok(['contact','strike'].includes(record.physics));
  assert.ok(g.ActionRegistry.visualCatalog[type]);
  const probe=g.SemanticPhysics.probe({type,damage:24,radius:160,duration:1.2});
  assert.equal(probe.passed,true,type);
  assert.ok(probe.near.damage>0,type+' must damage a reachable unshielded target');
  assert.equal(probe.far.damage,0,type+' cannot hit out of range');
  assert.equal(probe.shield.damage,0,type+' cannot damage protected target');
  assert.ok(probe.near.displacement>.1,type+' must impart physical displacement');
 }
});
test('Korean object and verb semantics emit new physics instead of only visual analogies',()=>{
 const {g}=boot();
 for(const [phrase,type] of [
  ['사슬로 적을 꽁꽁 묶어 끌어당긴다','tether'],
  ['상대를 강하게 밀쳐 멀리 날려버린다','repulse'],
  ['소용돌이가 적을 휘말아 빙빙 돌려버린다','vortex']
 ]){
  const p=g.SkillSentenceEngine.parse(phrase);
  assert.equal(p.ok,true,phrase+': '+p.error);
  const action=p.recipe.rules[0].action;
  assert.equal(action.type,type,phrase);
  assert.equal(p.verification.sandbox.probes[0].type,type);
  assert.equal(p.verification.sandbox.probes[0].passed,true);
  assert.equal(p.verification.checks[0].sandbox.passed,true);
  assert.ok(p.notes.some(s=>s.includes('신규 물리 동작')));
 }
});
test('two sequential physical verbs are two real cast stages, not decorations',()=>{
 const {g}=boot();
 const r=g.SkillSentenceEngine.parse('적을 사슬로 묶고 상대를 강하게 밀어낸다');
 assert.equal(r.ok,true);
 const types=new Set(r.recipe.rules.map(v=>v.action.type));
 assert.ok(types.has('tether')&&types.has('repulse'));
 const rules=r.recipe.rules.flatMap(v=>v.steps?.filter(s=>s.kind==='cast').map(s=>s.action.type)||[]);
 if(rules.length)assert.ok(rules.includes('tether')&&rules.includes('repulse'));
 assert.ok(r.recipe.rules.length<=8);
});
test('existing conditional wall acceleration is not turned into an unsolicited physical attack',()=>{
 const {g}=boot();
 const r=g.SkillSentenceEngine.parse('벽에 튕기면 가속하고 상대와 충돌하면 충격파를 발사한다');
 assert.equal(r.ok,true);
 assert.ok(r.recipe.rules.some(s=>s.when==='wall'&&s.action.type==='haste'));
 assert.ok(r.recipe.rules.some(s=>s.when==='contact'&&s.action.type==='wave'));
 assert.equal(r.recipe.rules.some(s=>['tether','repulse','vortex'].includes(s.action.type)),false);
});
test('the actual Forge hit resolver, not a synthetic damage shortcut, records confirmed contact',()=>{
 const {g,load}=boot();let impacts=0;
 Object.assign(g,{
  AdvancedCombat:{canHit:()=>true,height:()=>0,execute:()=>false},
  ForgeExpansion:{execute:()=>false,damageScale:()=>1,applyStatus:()=>{}},
  SkillVisuals:{cast:()=>true,impact:()=>{impacts++}},
  createHitParticles(){},addFloatingText(){},
  canvas:{width:500,height:400},
  AbilityAtlas:{choose:(_p,enemies)=>enemies[0]||null,execute:()=>false}
 });
 load('skill-forge-impact');load('skill-forge-executor');
 const p={x:100,y:100,vx:0,vy:0,radius:20,hp:280,maxHp:280,playerNum:1,
  forge:{color:'#bb88ff',effectColor:'#bb88ff'},_forgeBalanceFrame:1};
 const e={x:140,y:100,vx:0,vy:0,radius:20,hp:280,maxHp:280,invincible:0,playerNum:2};
 const impact=g.SkillForgeImpactFactory({MOVEMENT_ONLY:g.ActionRegistry.MOVEMENT_ONLY});
 const executor=g.SkillForgeExecutorFactory({MOVEMENT_ONLY:g.ActionRegistry.MOVEMENT_ONLY,
  hit:impact.hit,enemies:()=>[e]});
 executor.execute(p,{type:'repulse',damage:25,radius:120,status:'none',
  knockback:2,speed:5,duration:1},e);
 assert.ok(e.hp<280,'HP must fall through authoritative ForgeImpact hit');
 assert.ok(impacts>0,'impact VFX requires actual damage/contact');
 assert.ok(e.vx>0,'collision applies a physical push to target');
 const report=g.SemanticPhysics.liveReport(p);
 assert.equal(report.casts,1);
 assert.equal(report.hits,1);
 assert.equal(report.damage,280-e.hp);
 e.x=450;e.hp=280;e.invincible=0;p._forgeBalanceFrame+=30;
 executor.execute(p,{type:'repulse',damage:25,radius:60,status:'none',
  knockback:2,speed:5,duration:1},e);
 assert.equal(e.hp,280,'out-of-range blast must not damage');
 assert.equal(g.SemanticPhysics.liveReport(p).hits,1,'unconfirmed attacks are not counted as hits');
});
test('semantic effects are wired in PvE and PvP, with independent world tick',()=>{
 const root=path.join(__dirname,'..');
 for(const page of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.ok(html.includes('js/features/semantic-physics.js'));
  assert.ok(html.indexOf('action-registry.js')<html.indexOf('semantic-physics.js'));
  assert.ok(html.indexOf('semantic-physics.js')<html.indexOf('skill-forge.js'));
 }
 assert.match(read('skill-forge-world'),/SemanticPhysics\?\.tick/);
 assert.match(read('skill-forge-executor'),/SemanticPhysics\?\.noteCast/);
 assert.match(read('skill-forge-impact'),/SemanticPhysics\?\.noteHit/);
});
test('hundreds of odd offline prompts stay bounded and free of executable source',()=>{
 const {g}=boot();
 const fragments=['적을 꽁꽁 묶고','상대를 밀쳐 날려버리고',
  '소용돌이가 적을 휘말아 돌려버리고','검은 번개를 쏘고',
  '바닥에 장판을 펼치고','벽에 튕기면 가속하며'];
 for(let i=0;i<240;i++){
  const phrase=fragments[i%fragments.length]+' '+fragments[(i*5+3)%fragments.length];
  const r=g.SkillSentenceEngine.parse(phrase);
  if(!r.ok)continue;
  assert.ok(r.recipe.rules.length<=8);
  const p=g.SemanticPhysics.verifyRecipe(r.recipe);
  assert.ok(p.probes.length<=8);
  for(const entry of p.probes){
   assert.ok(Number.isFinite(entry.near.displacement));
   assert.ok(entry.near.damage>=0&&entry.near.damage<=250);
   assert.equal(entry.far.damage,0);
  }
 }
});
