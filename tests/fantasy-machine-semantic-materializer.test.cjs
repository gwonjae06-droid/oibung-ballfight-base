'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm');
const src=n=>fs.readFileSync('js/features/'+n+'.js','utf8');
function boot(modules){
 const g={Math,Date,Number,Set,Map,WeakMap,console,players:[],
  CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:480,height:320},createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const n of modules)vm.runInContext(src(n),g,{filename:n+'.js'});
 return g;
}
const lang=['action-registry','semantic-physics','physics-law-engine',
 'signature-program','skill-fx-composer','metaphor-visuals',
 'concept-fusion','imagination-concepts','signature-scratch',
 'fantasy-skill-graph','signature-rule-skill','skill-ir','signature-rule-live',
 'korean-skill-grammar','korean-skill-parameters',
 'signature-prompt-compiler','skill-sentence-engine'];
test('Fantasy dragon breath combines ONE existing area attack with fire, explosion and layered FX',()=>{
 const g=boot(lang),s=g.SkillSentenceEngine.parse(
  '드래곤이 거대한 화염 브레스를 내뿜어 적에게 명중하면 폭발한다. 범위 180, 피해 35');
 assert.equal(s.ok,true,s.error);
 assert.equal(s.method,'offline-concept-materializer');
 assert.equal(s.plan.strategy,'reuse');
 assert.equal(s.plan.genre,'fantasy');
 assert.equal(s.recipe.rules.length,1);
 const a=s.recipe.rules[0].action;
 assert.equal(a.type,'wave');assert.equal(a.status,'fire');
 assert.equal(a.damage,35);assert.equal(a.radius,180);
 assert.ok(a.visual.layers.some(x=>x.kind==='embers'));
 assert.ok(a.visual.layers.some(x=>x.kind==='runes'));
 assert.equal(a.fusion.impact,'burst');
});
test('fantasy rune binding combines existing REAL tether with magic glyphs',()=>{
 const g=boot(lang),s=g.SkillSentenceEngine.parse(
  '거대한 룬 마법진으로 적을 구속 사슬로 붙잡아 휘감는다');
 assert.equal(s.ok,true,s.error);
 assert.equal(s.plan.strategy,'reuse');
 const a=s.recipe.rules[0].action;
 assert.equal(a.type,'tether');
 assert.ok(a.visual.layers.some(x=>x.kind==='runes'));
 assert.ok(a.visual.layers.some(x=>x.kind==='chains'));
 const p={x:100,y:100,radius:20,hp:100,playerNum:1},
  e={x:145,y:100,radius:20,hp:100,vx:0,vy:0,playerNum:2};
 let hits=0;
 g.ActionRegistry.run(p,a,e,{hit:()=>{hits++;return true},enemies:()=>[e]});
 assert.ok(hits>0);
});
test('railgun is constructed from an executable existing beam plus plasma/circuit/trail FX',()=>{
 const g=boot(lang),s=g.SkillSentenceEngine.parse(
  '거대한 레일건에서 전자기 광선을 발사한다. 위력 42 범위 220');
 assert.equal(s.ok,true,s.error);
 assert.equal(s.plan.strategy,'reuse');
 assert.equal(s.recipe.rules[0].action.type,'beam');
 const a=s.recipe.rules[0].action;
 assert.equal(a.damage,42);assert.equal(a.radius,220);
 const layers=a.visual.layers.map(x=>x.kind);
 assert.ok(layers.includes('plasma')&&layers.includes('circuit'));
 assert.ok(layers.includes('trail'));
});
test('target-seeking machine missile reuses physical shot seeking, rather than fake visual tracking',()=>{
 const g=boot(lang),s=g.SkillSentenceEngine.parse(
  '미사일 4발이 적을 추적하고 명중하면 폭발한다');
 assert.equal(s.ok,true,s.error);
 const a=s.recipe.rules[0].action;
 assert.equal(a.type,'shot');assert.equal(a.count,4);
 assert.equal(a.fusion.homing,true);assert.equal(a.fusion.impact,'burst');
 assert.ok(a.visual.layers.some(x=>x.kind==='circuit'));
});
test('machine electromagnet reuses generated field equations for actual magnetic pulling and spin',()=>{
 const g=boot(lang),s=g.SkillSentenceEngine.parse(
  '전자석 자기장으로 상대를 끌어당기며 회전시킨다. 반경 170');
 assert.equal(s.ok,true,s.error);
 const a=s.recipe.rules[0].action;
 assert.equal(a.type,'phenomenon');
 assert.deepEqual(Array.from(a.law.terms,x=>x.op),['attract','spin']);
 assert.equal(a.law.radius,170);
 assert.ok(a.visual.layers.some(x=>x.kind==='plasma'));
 const p={playerNum:1,x:100,y:100,hp:200},
 e={playerNum:2,x:190,y:100,vx:0,vy:0,radius:20,hp:200};
 g.ActionRegistry.run(p,a,e,{enemies:()=>[e],hit:()=>true});
 g.PhysicsLawEngine.tick(p,[e],()=>true);
 assert.ok(e.vx<0&&e.vy>0);
});
test('fantasy phoenix healing and modern automated turret use separate existing production actions',()=>{
 const g=boot(lang);
 const phoenix=g.SkillSentenceEngine.parse('불사조가 주인을 치유하고 재생시킨다');
 const turret=g.SkillSentenceEngine.parse('자동 포탑을 소환해 적을 공격한다');
 assert.equal(phoenix.ok,true);assert.equal(turret.ok,true);
 assert.equal(phoenix.recipe.rules[0].action.type,'regen');
 assert.equal(turret.recipe.rules[0].action.type,'turret');
 assert.equal(phoenix.plan.strategy,'reuse');
 assert.equal(turret.plan.strategy,'reuse');
 assert.ok(phoenix.recipe.rules[0].action.visual.layers.some(x=>x.kind==='feathers'));
 assert.ok(turret.recipe.rules[0].action.visual.layers.some(x=>x.kind==='gears'));
});
test('kinetic storage followed by release creates ONE genuinely new stateful primitive',()=>{
 const g=boot(lang),s=g.SkillSentenceEngine.parse(
  '기계식 축전기가 상대의 운동량을 흡수해 저장했다가 충격파로 방출한다');
 assert.equal(s.ok,true,s.error);
 assert.equal(s.plan.strategy,'new-primitive');
 const a=s.recipe.rules[0].action;
 assert.equal(a.type,'kinetic_relay');
 assert.equal(a.relay.charge,.8);
 assert.equal(a.relay.release,.6);
 assert.equal(g.ActionRegistry.get('kinetic_relay').legacy,false);
 assert.match(s.notes.join(' '),/운동량/);
});
test('new momentum relay reduces live velocity, stores motion, then releases one bounded damaging pulse',()=>{
 const g=boot(lang);
 const p={x:100,y:100,playerNum:1,hp:100,forge:{color:'#9caaff'}};
 const e={x:145,y:100,playerNum:2,hp:200,radius:18,vx:8,vy:0};
 let damageHits=0;
 const hit=(_p,v,a)=>{damageHits++;v.hp-=a.damage;return true};
 const a={type:'kinetic_relay',damage:25,
  relay:{charge:.5,release:.6,absorb:.3,radius:160}};
 assert.equal(g.ActionRegistry.run(p,a,e,{hit,enemies:()=>[e]}),true);
 const before=e.vx;
 for(let i=0;i<15;i++)g.ImaginationConcepts.relayTick(p,[e],hit);
 assert.ok(e.vx<before);
 assert.equal(damageHits,0,'cannot damage before actual release');
 assert.ok(g.ImaginationConcepts.relayReport(p)[0].stored>0);
 for(let i=0;i<17;i++)g.ImaginationConcepts.relayTick(p,[e],hit);
 assert.equal(damageHits,1);
 assert.ok(e.hp<200);
 for(let i=0;i<80;i++)g.ImaginationConcepts.relayTick(p,[e],hit);
 assert.equal(g.ImaginationConcepts.relayReport(p).length,0);
});
test('new mechanic obeys 4-field pool limit and validated user parameters',()=>{
 const g=boot(lang),p={x:100,y:100,hp:100};
 const relay=g.ImaginationConcepts.normalizeRelay({
  charge:999,release:-100,absorb:100,radius:99999});
 assert.equal(relay.charge,2);assert.equal(relay.release,.2);
 assert.equal(relay.absorb,.45);assert.equal(relay.radius,260);
 for(let n=0;n<100;n++)g.ImaginationConcepts.relayBegin(p,{
  type:'kinetic_relay',relay,damage:150});
 assert.equal(g.ImaginationConcepts.relayReport(p).length,4);
 const t=g.SignatureScratch.safeAction({type:'kinetic_relay',damage:999,
  relay:{charge:999,absorb:999,release:-9,radius:999}});
 assert.equal(t.damage,120);assert.equal(t.relay.radius,260);
});
test('new FX motifs are real paintable Canvas geometry, not only name labels',()=>{
 const g=boot(lang);
 const v={shape:'aura',color:'#7daaff',scale:1.3,layers:[
  ...['gears','circuit','hologram','steam','plasma'].map(kind=>({
   kind,color:'#7daaff',power:1,spin:1}))]};
 let calls=0;const ctx=new Proxy({globalAlpha:1},{get(obj,key){
  if(key in obj)return obj[key];
  return (..._args)=>{calls++};
 },set(o,k,v){o[k]=v;return true}});
 assert.equal(g.SkillFXComposer.paint(ctx,{visual:v,progress:.45,radius:170}),true);
 assert.ok(calls>65,'new machine glyphs have geometric strokes');
 const p=g.SkillFXComposer.normalize([...v.layers,{kind:'unknown',color:'red'}]);
 assert.equal(p.length,5);
});
test('new genre skills persist through IR and saved fighter normalization',()=>{
 const g=boot([...lang,'skill-forge-profiles']);
 const s=g.SkillSentenceEngine.parse('축전기가 운동량을 흡수해 저장했다가 방출한다');
 assert.equal(s.ok,true);
 const ir=g.SkillIR.fromRecipe(s.recipe);
 const out=g.SkillIR.toRecipe(ir);
 assert.equal(out.rules[0].action.relay.absorb,.23);
 const profiles=g.SkillForgeProfilesFactory({TYPE:g.ActionRegistry.TYPE,
  TRIGGER:{auto:'자동'},STATUS:{none:'없음'},
  ACTION_PARAMETERS:g.ActionRegistry.ACTION_PARAMETERS,
  MOVEMENT_ONLY:g.ActionRegistry.MOVEMENT_ONLY});
 const saved=profiles.normalize({name:'축전기',signatureVersion:1,skills:[{
  name:'충전',actions:g.SignatureRuleSkill.preview(s.recipe),ruleSet:s.recipe,ir}]});
 assert.equal(saved.skills[0].actions[0].relay.release,.6);
 assert.equal(saved.skills[0].ruleSet.rules[0].action.type,'kinetic_relay');
 assert.ok(g.SkillIR.describe(saved.skills[0].ir)[0].primitives.includes('store-kinetic-energy'));
});
test('PvP compact encoding retains new VFX and physical storage without breaking old packets',()=>{
 const g=boot([...lang,'pvp-original-engine']);
 const s=g.SkillSentenceEngine.parse('기계식 축전기가 운동량을 흡수해 저장했다가 방출한다');
 const a=s.recipe.rules[0].action;
 const p={id:'custom',name:'축전기',forgeData:{name:'축전기',signatureVersion:1,
 hp:240,speed:2,color:'#b5b5ff',effectColor:'#b5b5ff',allAbilities:false,
 skills:[{name:'충전',trigger:'auto',cooldown:4,threshold:30,
  actions:[a],ruleSet:s.recipe}]}};
 const packet=g.PvpOriginalEngine.pack(p),restored=g.PvpOriginalEngine.unpack(packet);
 assert.equal(restored.skills[0].actions[0].relay.charge,.8);
 assert.equal(restored.skills[0].ruleSet.rules[0].action.relay.absorb,.23);
 assert.ok(restored.skills[0].actions[0].visual.layers.some(x=>x.kind==='gears'));
 assert.ok(JSON.stringify(packet).length<2380);
 const legacyAction={...a,relay:undefined,visual:undefined};
 const legacy={...p,forgeData:{...p.forgeData,skills:[
  {name:'old',trigger:'auto',cooldown:3,actions:[legacyAction]}]}};
 assert.equal(g.PvpOriginalEngine.unpack(g.PvpOriginalEngine.pack(legacy)).skills[0].actions[0].relay,undefined);
});
test('genre parser only activates for recognized subject nouns; older skills stay unchanged',()=>{
 const g=boot(lang);
 const old=g.SkillSentenceEngine.parse('분열탄을 4발 발사한다');
 assert.equal(old.ok,true);assert.notEqual(old.method,'offline-concept-materializer');
 const unknown=g.ImaginationConcepts.interpret('일상의 슬픔을 3차원 행성으로 만든다');
 assert.equal(unknown,null);
 const hacking=g.SkillSentenceEngine.parse('로봇이 실제 컴퓨터를 해킹한다');
 assert.equal(hacking.ok,false,'do not falsely advertise device hacking');
});
test('both entrypoints load concept module before normalizers and studio displays reuse vs new',()=>{
 for(const page of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(page,'utf8');
  assert.ok(html.includes('imagination-concepts.js?v=1-fantasy-machine-materializer'));
  assert.ok(html.indexOf('imagination-concepts.js')<html.indexOf('signature-scratch.js'));
  assert.ok(html.indexOf('imagination-concepts.js')<html.indexOf('skill-forge-world.js'));
 }
 const lab=src('studio-pinball-lab');
 assert.match(lab,/relayTick/);
 const ui=src('signature-rule-studio');
 assert.match(ui,/new-primitive/);
 assert.match(ui,/data-rule-example="machine"/);
 assert.match(ui,/data-rule-example="fantasy"/);
});

test('trailing numeric sentences are merged into one generated skill in real studio flow',()=>{
 const g=boot(lang),s=g.SkillSentenceEngine.parseBundle(
  '드래곤이 화염 브레스를 내뿜는다. 범위 180, 피해 35');
 assert.equal(s.ok,true,s.error);
 assert.equal(s.skills.length,1);
 const a=s.skills[0].recipe.rules[0].action;
 assert.equal(a.radius,180);assert.equal(a.damage,35);
});

test('fantasy rune combined with modern drone retains both concepts and has a real summon action',()=>{
 const g=boot(lang),result=g.SkillSentenceEngine.parse('룬 마법진에서 자동 드론을 소환한다');
 assert.equal(result.ok,true,result.error);
 assert.equal(result.plan.strategy,'reuse');
 assert.equal(result.recipe.rules[0].action.type,'summon');
 const motifs=result.recipe.rules[0].action.visual.layers.map(x=>x.kind);
 assert.ok(motifs.includes('runes')&&motifs.includes('circuit'));
 assert.ok(result.plan.conceptIds.includes('rune'));
 assert.ok(result.plan.conceptIds.includes('drone'));
});
