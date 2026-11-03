'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync('js/features/'+name+'.js','utf8');
function boot(names){
 const g={Math,Date,Number,Map,Set,WeakMap,console,players:[],
  CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:480,height:320},createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const name of names)vm.runInContext(read(name),g,{filename:name+'.js'});
 return g;
}
const compiler=['action-registry','arena-body-physics','wall-impact-store',
 'semantic-physics','physics-law-engine','signature-program','skill-fx-composer',
 'procedural-visual-geometry','metaphor-visuals','skill-color-policy',
 'semantic-concept-atlas','concept-fusion','imagination-concepts',
 'semantic-intent-composer','signature-scratch','fantasy-skill-graph',
 'signature-rule-skill','skill-ir','signature-rule-live','korean-skill-grammar',
 'korean-skill-parameters','signature-prompt-compiler',
 'semantic-relationship-graph','skill-sentence-engine'];
const phrase='캐릭터가 벽에 부딪힐 때마다 충격을 몸에 저장하고 세 번 충돌하면 저장한 충격을 붉은 폭발로 방출한다';
function scenario(g,overrides={}){
 const r=g.SkillSentenceEngine.parse(phrase);
 assert.equal(r.ok,true,r.error);
 const p={playerNum:1,x:100,y:110,radius:20,vx:4,vy:0,hp:250,maxHp:250,
  invincible:0,forge:{signatureVersion:1,effectColor:'#aaccee',color:'#aaccee'},
  _forgeActionClock:1,_forgeBalanceFrame:1};
 const e={playerNum:2,x:170,y:110,radius:20,vx:0,vy:0,hp:250,maxHp:250,invincible:0};
 Object.assign(p,overrides);
 return {r,p,e,run:g.SignatureRuleLive.begin(r.recipe,p)};
}
test('Korean clause compiles into a counted physical wall trigger, not a pulse',()=>{
 const g=boot(compiler),{r}=scenario(g);
 assert.equal(r.method,'offline-verb-first-semantic-composer');
 assert.equal(r.recipe.rules.length,1);
 const rule=r.recipe.rules[0];
 assert.equal(rule.when,'wallStored');
 assert.equal(rule.wallHits,3);
 assert.equal(rule.action.type,'nova');
 assert.ok(rule.action.damage>0);
 assert.equal(rule.action.visual.colorMode,'explicit');
 assert.equal(rule.action.visual.color,'#ff454f');
 assert.ok(r.semanticVerification.matched.includes('wallStore'));
 assert.equal(r.semanticVerification.missing.length,0);
 assert.ok(r.semanticGraph.relations.some(x=>x.type==='accumulates_wall_impulse'));
 assert.ok(r.semanticGraph.relations.some(x=>x.type==='releases_on_count'&&x.count===3));
});
test('unseen wall synonyms reuse the same counted trigger, without example-specific hardcoding',()=>{
 const g=boot(compiler),variant=g.SkillSentenceEngine.parse(
  '벽에 튕길 때마다 운동량을 축적하고 네 번 부딪치면 금빛 폭발로 방출한다');
 assert.equal(variant.ok,true,variant.error);
 assert.equal(variant.recipe.rules[0].when,'wallStored');
 assert.equal(variant.recipe.rules[0].wallHits,4);
 assert.equal(variant.recipe.rules[0].action.visual.colorMode,'explicit');
});
test('storage-only and explicitly negated releases cannot invent a nova attack',()=>{
 const g=boot(compiler);
 for(const sentence of [
  '벽에 부딪힐 때마다 충격을 몸에 저장한다',
  '벽에 부딪힐 때마다 충격을 저장하고 세 번 튕겨도 폭발하지 않는다'
 ]){
  const parsed=g.SkillSentenceEngine.parse(sentence);
  assert.equal(parsed.ok,false,sentence);
  assert.match(parsed.error,/구현할 수 없습니다/);
 }
});
test('only three DISTINCT confirmed boundary rebounds release stored impulse once',()=>{
 const g=boot(compiler),{r,p,e,run}=scenario(g);
 assert.ok(run);
 const output=[];
 for(let t=2;t<=105;t++){
  p._forgeActionClock=t;
  if([26,52,78].includes(t)){
   assert.equal(g.WallImpactStore.record(p,3.5+t/52,'wall-left'),true);
   assert.equal(g.WallImpactStore.record(p,100,'wall-left'),false,'same-tick bounce double counting');
  }
  const action=g.SignatureRuleLive.step(run,p,e);
  if(action)output.push({t,action});
  if(t===77)assert.equal(output.length,0);
 }
 assert.equal(output.length,1);
 assert.equal(output[0].t,78);
 assert.equal(output[0].action.type,'nova');
 assert.equal(output[0].action.storedImpact.hits,3);
 assert.ok(output[0].action.storedImpact.impulse>5,
  'stored impulse follows radius-dependent 2D body mass');
 assert.ok(output[0].action.damage>r.recipe.rules[0].action.damage);
 assert.ok(output[0].action.damage<=120);
 assert.equal(run.wallCharge[0].count,0);
 assert.equal(run.wallCharge[0].impulse,0);
});
test('real nova applies health damage through one authoritative hit resolver',()=>{
 const g=boot([...compiler,'forge-expansion','skill-forge-impact']);
 const {p,e,run}=scenario(g);
 let result;
 for(let t=2;t<=90;t++){
  p._forgeActionClock=t;p._forgeBalanceFrame=t;
  if([26,52,78].includes(t))g.WallImpactStore.record(p,7,'wall-right');
  const emitted=g.SignatureRuleLive.step(run,p,e);
  if(emitted)result=emitted;
 }
 assert.ok(result);
 const hit=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),enemies:()=>[e]}).hit;
 const visualColors=[];g.BattleFX={mark(_type,_x,_y,color){visualColors.push(color);}};
 assert.equal(g.ForgeExpansion.execute(p,result,e,{hit,enemies:()=>[e]}),true);
 assert.ok(e.hp<250,'nova must damage a nearby enemy, not only create VFX');
 assert.ok(visualColors.includes('#ff454f'),
  'real explosion uses explicit red skill color, not character default');
 const before=e.hp;p.x=440;p.y=300;e.invincible=0;e._forgeImpactGrace=0;
 g.ForgeExpansion.execute(p,result,e,{hit,enemies:()=>[e]});
 assert.equal(e.hp,before,'distant target must not be hit by visual alone');
});
test('shielded enemies take no wall-release damage',()=>{
 const g=boot([...compiler,'forge-expansion','skill-forge-impact']);
 const {p,e,run}=scenario(g);
 e.invincible=999;
 let action;
 for(let t=2;t<=80;t++){
  p._forgeActionClock=t;p._forgeBalanceFrame=t;
  if([26,52,78].includes(t))g.WallImpactStore.record(p,8,'wall-bottom');
  action=g.SignatureRuleLive.step(run,p,e)||action;
 }
 assert.ok(action);
 const hit=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),enemies:()=>[e]}).hit;
 g.ForgeExpansion.execute(p,action,e,{hit,enemies:()=>[e]});
 assert.equal(e.hp,250);
});
test('old wall skills and malformed values cannot silently turn into wall store',()=>{
 const g=boot(compiler);
 const saved=g.SignatureRuleSkill.normalize({window:12,rules:[
  {when:'wall',wallHits:6,action:{type:'wave',damage:12}},
  {when:'wallStored',wallHits:999,action:{type:'nova',damage:999}}]});
 assert.equal(saved.rules[0].when,'wall');
 assert.equal(saved.rules[0].wallHits,undefined);
 assert.equal(saved.rules[1].wallHits,6);
 assert.equal(saved.rules[1].action.damage,120);
 const old=g.SkillSentenceEngine.parse('벽에 튕기면 주위에 붉은 충격파를 만든다');
 assert.ok(old.recipe.rules.every(x=>x.when!=='wallStored'),'ordinary wall conditions keep legacy semantics');
});
test('IR and compact PvP preserve wall count without migrating legacy payloads',()=>{
 const g=boot([...compiler,'pvp-original-engine']),{r}=scenario(g);
 const ir=g.SkillIR.fromRecipe(r.recipe),restored=g.SkillIR.toRecipe(ir);
 assert.equal(restored.rules[0].wallHits,3);
 const create=recipe=>({id:'custom',name:'Wall',forgeData:{
  signatureVersion:1,hp:260,speed:2,color:'#aaaaaa',effectColor:'#aaaaaa',
  allAbilities:false,skills:[{name:'벽 에너지',trigger:'auto',cooldown:5,threshold:40,
   actions:[recipe.rules[0].action],ruleSet:recipe}]}});
 const packed=g.PvpOriginalEngine.pack(create(r.recipe));
 const unpacked=g.PvpOriginalEngine.unpack(packed);
 assert.equal(unpacked.skills[0].ruleSet.rules[0].wallHits,3);
 assert.equal(unpacked.skills[0].ruleSet.rules[0].when,'wallStored');
 assert.ok(JSON.stringify(packed).length<2380);
 const legacy=g.SignatureRuleSkill.normalize({window:8,
  rules:[{when:'wall',interval:1,action:{type:'wave',damage:10}}]});
 assert.equal(g.PvpOriginalEngine.unpack(
  g.PvpOriginalEngine.pack(create(legacy))).skills[0].ruleSet.rules[0].wallHits,undefined);
});
test('no event telemetry is added to non-signature fighters or low-speed overlaps',()=>{
 const g=boot(['arena-body-physics','wall-impact-store']);
 const p={hp:100,forge:{signatureVersion:0},radius:20,_forgeActionClock:10};
 assert.equal(g.WallImpactStore.record(p,8,'wall-left'),false);
 p.forge.signatureVersion=1;
 assert.equal(g.WallImpactStore.record(p,0.7,'wall-right'),false);
 assert.equal(g.WallImpactStore.record(p,Infinity,'wall-right'),false);
 assert.equal(g.WallImpactStore.record(p,5,'wall-right'),true);
 p._forgeActionClock=200;
 assert.equal(g.WallImpactStore.record(p,5,'wall-left'),true);
 assert.ok(g.WallImpactStore.since(p,1,100).every(x=>x.frame>=100));
});
test('real and PvP entrypoints load event ledger and do not simulate damage by wall event',()=>{
 for(const file of ['index.html','pvp-runtime.html']){
  const text=fs.readFileSync(file,'utf8');
  assert.ok(text.includes('wall-impact-store.js?v=stored-wall1'));
  assert.ok(text.indexOf('wall-impact-store.js')<text.indexOf('signature-rule-live.js'));
 }
 const engine=fs.readFileSync('js/core/engine.js','utf8');
 assert.match(engine,/WallImpactStore\?\.record\?\.\(p,normalSpeed,wallSource\)/);
 const preview=read('studio-pinball-lab');
 assert.match(preview,/WallImpactStore\?\.record\?\.\(previewActor,-d,wallKind\)/);
});
