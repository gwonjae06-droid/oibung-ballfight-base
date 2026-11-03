'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync('js/features/'+name+'.js','utf8');
const files=['action-registry','semantic-physics','physics-law-engine',
 'signature-program','skill-fx-composer','metaphor-visuals','skill-color-policy',
 'semantic-concept-atlas','concept-fusion','imagination-concepts',
 'semantic-intent-composer','signature-scratch','signature-live',
 'fantasy-skill-graph','signature-rule-skill','skill-ir',
 'signature-rule-live','korean-skill-grammar','korean-skill-parameters',
 'signature-prompt-compiler','semantic-relationship-graph',
 'sentence-auto-repair','skill-sentence-engine'];
function boot(extra=[]){
 const g={console,Math,Date,Set,Map,WeakMap,players:[],CUSTOM_DEFS:[],
  BEHAVIORS:{},CHARACTER_PHOTOS:{},canvas:{width:480,height:320},
  createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of [...files,...extra])
  vm.runInContext(read(file),g,{filename:file+'.js'});
 return g;
}
const sample='청록색 투사체가 적에게 명중하면 붉은 파편 세 조각으로 분열하고 그 파편이 적을 추적하다 마지막 파편이 사라지면 보라색 폭발한다';
function shot(g,override={}){
 return g.SignatureScratch.safeAction({type:'shot',damage:26,count:1,
  radius:96,speed:6,status:'none',knockback:0,
  visual:{shape:'crystal',color:'#06b6d4',colorMode:'explicit',
   layers:[{kind:'shards',color:'#06b6d4'}]},...override});
}
function recipe(g,action=shot(g),others=[]){
 return g.SignatureRuleSkill.normalize({window:10,rules:[
  {when:'pulse',interval:1.2,action},...others]});
}
test('an existing source projectile gains physical hit-split, child-only pursuit and terminal burst',()=>{
 const g=boot(),original=recipe(g),json=JSON.stringify(original);
 const prior=g.SemanticIntentComposer.verify(sample,original);
 assert.ok(prior.missing.includes('hitSplit'));
 assert.ok(prior.missing.includes('homing'));
 assert.ok(prior.missing.includes('terminalBurst'));
 const fixed=g.SentenceAutoRepair.repair(sample,original),a=fixed.recipe.rules[0].action;
 assert.equal(fixed.report.status,'repaired');
 assert.deepEqual(Array.from(fixed.report.applied),['split','hitSplit','homing','terminalBurst']);
 assert.equal(fixed.report.attempts,1);
 assert.equal(a.fusion.split,true);
 assert.equal(a.fusion.splitTrigger,'hit');
 assert.equal(a.fusion.childHoming,true);
 assert.equal(a.fusion.homing,false);
 assert.equal(a.fusion.fragments,3);
 assert.equal(a.fusion.finalBurst,true);
 assert.equal(a.damage,26);
 assert.equal(a.count,1);
 assert.equal(a.visual.color,'#06b6d4');
 assert.equal(fixed.recipe.rules[0].interval,1.2);
 assert.equal(fixed.report.after.missing.length,0);
 assert.equal(JSON.stringify(original),json,'source skill must not be mutated');
});
test('repair is idempotent and never changes existing cooldown or a second authorial rule',()=>{
 const g=boot();
 const second={when:'wall',interval:2,action:shot(g,{damage:12})};
 const original=recipe(g,shot(g),[second]);
 const fixed=g.SentenceAutoRepair.repair(sample,original);
 assert.equal(fixed.report.status,'unresolved','two candidate shots are ambiguous');
 assert.equal(fixed.recipe,original);
 const one=g.SentenceAutoRepair.repair(sample,recipe(g));
 assert.equal(g.SentenceAutoRepair.repair(sample,one.recipe).report.status,'already-complete');
 assert.ok(one.recipe.rules.every(r=>r.when==='pulse'));
});
test('negative requests do not silently acquire positive homing, fracture or burst',()=>{
 const g=boot(),original=recipe(g);
 for(const prompt of [
  '투사체가 명중하면 분열하지 않고 폭발하지 않는다',
  '투사체가 적을 추적하지 않는다',
  '투사체가 명중해 갈라지지만 폭발하지 않는다'
 ]){
  const fixed=g.SentenceAutoRepair.repair(prompt,original);
  assert.equal(fixed.recipe,original,prompt);
  assert.notEqual(fixed.report.status,'repaired',prompt);
 }
});
test('no projectile means no fake shot, even if explicit text asks for it',()=>{
 const g=boot();
 const r=recipe(g,g.SignatureScratch.safeAction({type:'shield',damage:0}));
 const fixed=g.SentenceAutoRepair.repair(sample,r);
 assert.equal(fixed.report.status,'unresolved');
 assert.equal(fixed.recipe,r);
 assert.equal(fixed.report.after.missing.length,fixed.report.before.missing.length);
 assert.match(fixed.report.reasons.join(''),/단일 투사체/);
});
test('untrusted or unsupported capabilities never authorize automatic magic physics',()=>{
 const g=boot(),r=recipe(g);
 const original=JSON.stringify(r);
 const fixed=g.SentenceAutoRepair.repair(
  '상대의 기억을 지우고 그 투사체를 갈라지게 한다',r);
 assert.equal(fixed.report.status,'skipped');
 assert.equal(fixed.recipe,r);
 assert.equal(JSON.stringify(r),original);
});
test('multi-step spell and manually authored conditional graph do not get rewritten',()=>{
 const g=boot();
 const src=shot(g);
 const staged=g.FantasySkillGraph.normalize([
  {kind:'cast',action:src},{kind:'wait',seconds:.5},
  {kind:'cast',action:g.SignatureScratch.safeAction({type:'shield',damage:0})}
 ]);
 const r=g.SignatureRuleSkill.normalize({window:8,rules:[
  {when:'pulse',interval:1.8,action:src,steps:staged}]});
 const fixed=g.SentenceAutoRepair.repair(sample,r);
 assert.equal(fixed.report.status,'unresolved');
 assert.equal(fixed.recipe,r);
});
test('explicit on-contact explosion repairs missing burst only where collision trigger is real',()=>{
 const g=boot();
 const fixed=g.SentenceAutoRepair.repair(
  '붉은 유도탄이 적에게 명중하면 폭발한다',recipe(g));
 assert.equal(fixed.report.status,'repaired');
 assert.equal(fixed.recipe.rules[0].action.fusion.impact,'burst');
 assert.equal(fixed.recipe.rules[0].action.fusion.homing,true);
 assert.equal(fixed.report.after.missing.length,0);
 assert.equal(fixed.recipe.rules[0].action.damage,26);
});
test('unrepairable shields remain disclosed even after safe partial projectile repair',()=>{
 const g=boot();
 const raw=sample+' 그리고 아군에게 보호막을 펼친다';
 const f=g.SentenceAutoRepair.repair(raw,recipe(g));
 assert.equal(f.report.status,'repaired');
 assert.ok(f.report.applied.includes('hitSplit'));
 assert.ok(f.report.after.missing.includes('shield'));
 assert.ok(f.report.reasons.some(x=>x.includes('나머지 요구')));
 assert.equal(f.recipe.rules.length,1,'must not invent a separate shield ability');
});
test('runtime confirmation is still necessary after declarative repair: shield cancels on-hit fracture',()=>{
 const g=boot(['skill-forge-impact','skill-forge-world']);
 const a=g.SentenceAutoRepair.repair(sample,recipe(g)).recipe.rules[0].action;
 const caster={x:120,y:110,playerNum:1,hp:260,forge:{color:'#06b6d4',
   effectColor:'#06b6d4'},
  forgeShots:[{x:145,y:110,vx:7,vy:0,z:0,life:99,targetNum:2,a}],
  forgeZones:[],forgeOrbs:[],_forgeBalanceFrame:1,_forgeActionClock:1};
 const target={x:165,y:110,playerNum:2,radius:19,hp:200,maxHp:200,
  invincible:999,vx:0,vy:0};
 const enemies=()=>[target];
 const impact=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),enemies});
 const world=g.SkillForgeWorldFactory({hit:impact.hit,hitGround:impact.hitGround,enemies});
 world.tick(caster,target);
 assert.equal(target.hp,200);
 assert.equal(caster.forgeShots.length,1,'shielded collision is not a confirmed fracture');
 target.invincible=0;caster._forgeBalanceFrame=2;caster._forgeActionClock=2;
 world.tick(caster,target);
 assert.equal(caster.forgeShots.length,3);
 assert.ok(caster.forgeShots.every(b=>b._fusionChild&&b.a.fusion.homing));
});
test('repaired recipe survives SkillIR and compact PvP as the same physics, not just an explanation',()=>{
 const g=boot(['pvp-original-engine']),r=g.SentenceAutoRepair.repair(sample,recipe(g));
 const ir=g.SkillIR.fromRecipe(r.recipe);
 assert.equal(g.SkillIR.toRecipe(ir).rules[0].action.fusion.childHoming,true);
 const a=r.recipe.rules[0].action;
 const profile={id:'custom',name:'검증자',forgeData:{signatureVersion:1,
  hp:260,speed:2,color:'#06b6d4',effectColor:'#06b6d4',
  allAbilities:false,skills:[{name:'자동 수정 실험',trigger:'auto',
   cooldown:5,threshold:40,actions:[a],ruleSet:r.recipe}]}};
 const packet=g.PvpOriginalEngine.pack(profile);
 const restored=g.PvpOriginalEngine.unpack(packet);
 assert.equal(restored.skills[0].actions[0].fusion.finalBurst,true);
 assert.equal(restored.skills[0].ruleSet.rules[0].action.fusion.childHoming,true);
 assert.equal(restored.skills[0].actions[0].damage,26);
});
test('sentence parse integrates audit, retains generated graph and offers no false repair claims',()=>{
 const g=boot();
 const p=g.SkillSentenceEngine.parse('푸른 레일건이 적을 향해 4발을 쏘고 추적한다');
 assert.equal(p.ok,true,p.error);
 assert.ok(p.autoRepair);
 assert.ok(['already-complete','repaired','unresolved'].includes(p.autoRepair.status));
 assert.ok(p.semanticIR&&p.semanticGraph&&p.verification);
 assert.equal(JSON.stringify(p.recipe),JSON.stringify(g.SkillIR.toRecipe(g.SkillIR.fromRecipe(p.recipe))));
});
test('both browser script bundles load repair BEFORE sentence engine, with no untrusted execution',()=>{
 for(const name of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(name,'utf8');
  assert.ok(html.includes('sentence-auto-repair.js?v=1-safe-diff'),name);
 }
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('semantic-intent-composer.js')<html.indexOf('sentence-auto-repair.js'));
 assert.ok(html.indexOf('sentence-auto-repair.js')<html.indexOf('skill-sentence-engine.js'));
 const module=read('sentence-auto-repair');
 assert.doesNotMatch(module,/\beval\s*\(|new\s+Function\s*\(/);
 const ui=read('signature-rule-studio');
 assert.match(ui,/문장 의미 자동 검증·보완/);
 assert.match(ui,/수정 전 누락:/);
 assert.match(ui,/수정 후 누락:/);
});
