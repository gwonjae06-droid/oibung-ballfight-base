'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=n=>fs.readFileSync('js/features/'+n+'.js','utf8');
function boot(){
 const g={Math,Date,Number,Map,WeakMap,Set,console,players:[],
  CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:480,height:320},createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const name of ['action-registry','semantic-physics','physics-law-engine',
  'signature-program','skill-fx-composer','metaphor-visuals','skill-color-policy',
  'semantic-concept-atlas','concept-fusion','imagination-concepts',
  'semantic-intent-composer','signature-scratch','fantasy-skill-graph',
  'signature-rule-skill','skill-ir','signature-rule-live','korean-skill-grammar',
  'korean-skill-parameters','signature-prompt-compiler','skill-sentence-engine',
  'skill-forge-world','skill-visuals','studio-pinball-lab'])
   vm.runInContext(read(name),g,{filename:name+'.js'});
 return g;
}
const action=r=>r.recipe?.rules?.[0]?.action;
const types=r=>gActions(r.recipe).map(x=>x.type);
function gActions(recipe){
 const out=[];const walk=nodes=>{for(const n of nodes||[]){
  if(n.kind==='cast'&&n.action)out.push(n.action);
  walk(n.body);walk(n.then);walk(n.else);
 }};
 for(const rule of recipe?.rules||[]){
  if(rule.steps?.length)walk(rule.steps);
  else if(rule.action)out.push(rule.action);
 }return out;
}
test('Named railgun homing is a physically homing shot, not an ineligible beam',()=>{
 const g=boot(),x=g.SkillSentenceEngine.parse('푸른 레일건이 적을 향해 4발을 쏘고 추적한다');
 assert.equal(x.ok,true,x.error);
 assert.equal(x.method,'offline-verb-first-semantic-composer');
 const a=action(x);
 assert.equal(a.type,'shot');assert.equal(a.count,4);
 assert.equal(a.fusion.homing,true);assert.equal(x.semanticVerification.missing.length,0);
 assert.equal(x.explicitColor.color,'#276df0');
 assert.ok(x.semanticVerification.approximations.length>0);
 assert.ok(a.visual.layers.some(l=>l.kind==='plasma'));
});
test('Live ForgeWorld projectile actually steers by the same fusion homing bit',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse('레일건이 4발을 쏘고 추적한다'),a=action(r);
 const p={playerNum:1,x:60,y:60,hp:100,radius:20,forgeShots:[
  {x:60,y:60,prevX:60,prevY:60,vx:5,vy:0,life:60,a,targetNum:2}
 ],forgeZones:[],forgeOrbs:[],forge:{effectColor:'#abccff'}};
 const e={playerNum:2,x:190,y:120,hp:200,radius:20,vx:0,vy:0};
 const world=g.SkillForgeWorldFactory({hit:()=>false,hitGround:()=>false,enemies:()=>[e]});
 world.tick(p,e);
 assert.ok(p.forgeShots[0].vy>0,'physical projectile velocity must bend toward target');
});
test('Railgun orbiting is an actual time-bounded force-field orbit with reusable plasma art',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse('별처럼 레일건이 시계방향으로 공전하며 적을 공격한다');
 assert.equal(r.ok,true,r.error);
 const a=action(r);
 assert.equal(a.type,'phenomenon');
 assert.ok(a.law.terms.some(t=>t.op==='orbit'));
 assert.ok(a.visual.layers.some(x=>x.kind==='plasma'));
 assert.ok(!r.semanticVerification.missing.includes('orbit'));
 const p={x:100,y:100,hp:200,playerNum:1};
 const e={x:170,y:100,vx:0,vy:0,hp:200,radius:19,playerNum:2};
 let hits=0;
 g.ActionRegistry.run(p,a,e,{hit:()=>{hits++;return true},enemies:()=>[e]});
 g.PhysicsLawEngine.tick(p,[e],()=>{hits++;return true});
 assert.ok(Math.abs(e.vy)>0.01);
 assert.ok(hits>0);
});
test('An unfamiliar abstract noun still creates the explicit orbit relation, not a meteor guess',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse('은하계의 지문이 시계방향으로 공전하며 적을 공격한다');
 assert.equal(r.ok,true,r.error);
 assert.equal(action(r).type,'phenomenon');
 assert.equal(r.semanticVerification.missing.length,0);
 assert.ok(r.semanticVerification.approximations.length>0,'unknown noun must be labeled approximation');
});
test('Beam noun cannot override a direct binding verb and actual spring tether physics',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse(
  '미지수의 심장과 레일건을 결합해 적을 구속 사슬로 붙잡아 휘감는다');
 assert.equal(r.ok,true,r.error);
 assert.equal(action(r).type,'tether');
 assert.ok(r.semanticVerification.matched.includes('tether'));
 const p={x:100,y:100,hp:100,playerNum:1};
 const e={x:145,y:100,hp:100,radius:20,vx:0,vy:0,playerNum:2};
 let hits=0;
 g.ActionRegistry.run(p,action(r),e,{enemies:()=>[e],hit:()=>{hits++;return true}});
 assert.ok(hits>0);
});
test('Both healing AND shield are actual rule actions in ONE saved ability',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse(
  '레일건과 태양풍을 융합해 아군을 회복시키고 보호막을 건다');
 assert.equal(r.ok,true,r.error);
 assert.deepEqual(Array.from(types(r)),['regen','shield']);
 assert.equal(r.recipe.rules.length,2);
 assert.equal(r.semanticVerification.missing.length,0);
 const actor={hp:150,maxHp:200,_scratchEvents:{},_forgeActionClock:0};
 const run=g.SignatureRuleLive.begin(r.recipe,actor);
 const emitted=[];
 for(let i=0;i<15;i++){const a=g.SignatureRuleLive.step(run,actor,null);if(a)emitted.push(a.type);}
 assert.ok(emitted.includes('regen')&&emitted.includes('shield'));
 const ir=g.SkillIR.fromRecipe(r.recipe),restored=g.SkillIR.toRecipe(ir);
 assert.deepEqual(Array.from(restored.rules,a=>a.action.type),['regen','shield']);
});
test('Unknown abstract concept does not erase exact momentum absorb/store/release',()=>{
 const g=boot();
 for(const raw of [
  '서사의 마찰이 상대의 운동량을 흡수해 저장했다가 방출한다',
  '철학적 좀비가 상대의 운동량을 흡수해 저장했다가 방출한다'
 ]){
  const r=g.SkillSentenceEngine.parse(raw);
  assert.equal(r.ok,true,r.error);
  assert.equal(action(r).type,'kinetic_relay');
  assert.ok(r.semanticVerification.matched.includes('relay'));
  assert.ok(r.semanticVerification.approximations.length>0);
  const p={x:100,y:100,hp:100,playerNum:1},e={x:155,y:100,hp:200,radius:20,vx:6,vy:0,playerNum:2};
  let damage=0;g.ActionRegistry.run(p,action(r),e,{enemies:()=>[e],hit:()=>true});
  for(let i=0;i<70;i++)g.ImaginationConcepts.relayTick(p,[e],(_p,_e,a)=>{damage+=a.damage;return true});
  assert.ok(damage>0);
 }
});
test('Opposing gravity and magnetic field produce physically opposed mathematical terms',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse(
  '중력과 전자석이 반대 방향으로 작용하는 영역을 생성한다');
 assert.equal(r.ok,true,r.error);
 assert.equal(action(r).type,'phenomenon');
 assert.deepEqual(Array.from(action(r).law.terms,x=>x.op),['gravity','repel']);
 assert.ok(r.semanticVerification.matched.includes('opposed'));
});
test('On-hit fracture is compiled into actual contact-triggered split semantics',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse(
  '분홍색 번개로 적을 4번 타격하고 명중할 때마다 투사체가 분열한다');
 assert.equal(r.ok,true,r.error);
 assert.equal(action(r).type,'shot');
 assert.equal(action(r).visual.colorMode,'explicit');
 assert.equal(action(r).fusion.split,true);
 assert.equal(action(r).fusion.splitTrigger,'hit');
 assert.ok(!r.semanticVerification.missing.includes('hitSplit'));
 assert.ok(!r.limitations.some(s=>s.includes('명중 순간 분열은 구현하지 못했습니다')));
});
test('Fading forces require an actual force operator; otherwise explicit rejection',()=>{
 const g=boot();
 const vague=g.SkillSentenceEngine.parse('검은 프리즘이 3초 동안 서서히 약해지는 물리 법칙을 만든다');
 assert.equal(vague.ok,false);
 assert.match(vague.error,/힘의 종류/);
 const solid=g.SkillSentenceEngine.parse('서사의 마찰이 3초 동안 서서히 약해지는 물리 법칙을 만든다');
 assert.equal(solid.ok,true,solid.error);
 assert.equal(action(solid).type,'phenomenon');
 assert.equal(action(solid).law.decay,'fade');
 assert.ok(action(solid).law.terms.some(x=>x.op==='drag'));
});
test('Unimplemented hacking, future prediction, theft, memory editing, infinite invulnerability are refused',()=>{
 const g=boot(),inputs=[
  '브라우저 탭을 100개 열어 적의 컴퓨터를 물리적으로 멈춘다',
  '안개처럼 사라지다가 다음 판의 결과를 미리 계산해 뒤집는다',
  '적이 나보다 빨라질 때마다 이전 스킬을 그대로 학습해 복제한다',
  '적의 기억을 지우고 나와 똑같은 존재로 완전히 바꾼다',
  '영원히 무한대로 커지는 무적의 절대 방어막을 친다',
  '무(無) 그 자체를 소환하고 그 그림자를 12차원으로 접는다',
  '시작할 때 아무 효과도 쓰지 말고 가만히 있는다'
 ];
 for(const input of inputs){const r=g.SkillSentenceEngine.parse(input);
  assert.equal(r.ok,false,'must refuse unsupported claim: '+input);
  assert.match(r.error,/구현할 수 없습니다/);
 }
});
test('Safe unrelated words such as social trust do not trigger blanket infinite-ability refusal',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse(
  '무한한 사회적 신뢰를 꽃잎 같은 보호막으로 표현한다');
 assert.equal(r.ok,true,r.error);
 assert.notEqual(r.method,'offline-intent-validation');
});
test('Teleportation and post-movement attack are both executed in sequence',()=>{
 const g=boot(),r=g.SkillSentenceEngine.parse('적에게 순간이동하여 충격파로 공격한다');
 assert.equal(r.ok,true,r.error);
 const list=types(r);
 assert.ok(list.includes('blink')&&list.includes('wave'));
 assert.equal(r.semanticVerification.missing.length,0);
 const actor={hp:100,_scratchEvents:{},_forgeActionClock:0},target={x:140,y:100,hp:100};
 const run=g.SignatureRuleLive.begin(r.recipe,actor);
 const produced=[];
 for(let i=0;i<40;i++){const a=g.SignatureRuleLive.step(run,actor,target);if(a)produced.push(a.type);}
 assert.deepEqual(produced.slice(0,2),['blink','wave']);
});
test('Previously implemented materializer/physical law examples remain backward-compatible',()=>{
 const g=boot();
 const cases=[
  ['드래곤이 거대한 화염 브레스를 내뿜어 적에게 명중하면 폭발한다','wave'],
  ['거대한 룬 마법진으로 적을 구속 사슬로 붙잡아 휘감는다','tether'],
  ['자동 포탑을 소환해 적을 공격한다','turret'],
  ['불사조가 주인을 치유하고 재생시킨다','regen'],
  ['반경 180의 역중력장에 회전력과 진동을 동시에 적용한다. 세기 3, 4초 동안 점점 약해진다','phenomenon']
 ];
 for(const [sentence,want] of cases){
  const r=g.SkillSentenceEngine.parse(sentence);
  assert.equal(r.ok,true,sentence+': '+r.error);
  assert.equal(action(r).type,want,sentence);
 }
});
test('Color preference applies to each modified action and old artist palette stays backward compatible',()=>{
 const g=boot();
 const r=g.SkillSentenceEngine.parse('푸른색 레일건이 적을 향해 4발을 쏘고 추적한다');
 assert.equal(r.colorPriority,'skill-sentence');
 assert.equal(action(r).visual.colorMode,'explicit');
 assert.equal(g.SkillColorPolicy.resolve(action(r).visual,'#cc0044').color,'#276df0');
 const auto=g.SkillSentenceEngine.parse('레일건이 4발을 쏘고 추적한다');
 assert.equal(auto.colorPriority,'character');
 assert.equal(g.SkillColorPolicy.resolve(action(auto).visual,'#22dd44').color,'#22dd44');
});
test('HTML browser import order and studio show actionable missing features',()=>{
 const index=fs.readFileSync('index.html','utf8'),pvp=fs.readFileSync('pvp-runtime.html','utf8');
 for(const html of [index,pvp]){
  assert.ok(html.includes('semantic-intent-composer.js?v=1-verb-first-semantic'));
  assert.ok(html.indexOf('imagination-concepts.js')<html.indexOf('semantic-intent-composer.js'));
  assert.ok(html.indexOf('semantic-intent-composer.js')<html.indexOf('signature-scratch.js'));
 }
 const ui=read('signature-rule-studio');
 assert.match(ui,/sentence-intent-check/);
 assert.match(ui,/intent\.missing/);
});
