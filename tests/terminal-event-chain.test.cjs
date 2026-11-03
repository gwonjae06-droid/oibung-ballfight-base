'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync('js/features/'+name+'.js','utf8');
const parser=['action-registry','semantic-physics','physics-law-engine','signature-program',
 'skill-fx-composer','metaphor-visuals','skill-color-policy','semantic-concept-atlas',
 'concept-fusion','terminal-event-chain','imagination-concepts','semantic-intent-composer',
 'signature-scratch','signature-live','fantasy-skill-graph','signature-rule-skill',
 'skill-ir','signature-rule-live','korean-skill-grammar','korean-skill-parameters',
 'signature-prompt-compiler','semantic-relationship-graph','sentence-auto-repair',
 'skill-sentence-engine'];
const sentence='푸른 투사체가 적에게 명중하면 세 조각으로 분열하고 마지막 파편이 사라지면 충격파로 적을 공격하고 피해가 들어가면 자신을 회복한 뒤 적이 가까이 있다면 속박한다';
const short='붉은 투사체가 공중에서 세 조각으로 분열하고 모든 파편이 소멸하면 충격파로 공격한 뒤 자신을 회복한다';
function boot(extra=[]){
 const g={console,Math,Date,Number,Map,Set,WeakMap,players:[],
  CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},canvas:{width:480,height:320},
  createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const name of [...parser,...extra])vm.runInContext(read(name),g,{filename:name+'.js'});
 return g;
}
function parse(g,text=sentence){
 const r=g.SkillSentenceEngine.parse(text);
 assert.equal(r.ok,true,r.error);
 const a=r.recipe.rules[0].action;
 assert.equal(r.recipe.rules.length,1,'event sub-actions must not become unconditional rules');
 assert.equal(a.type,'shot');
 return {r,a};
}
function actors(a){
 const p={playerNum:1,x:140,y:110,radius:20,vx:0,vy:0,
  hp:150,maxHp:250,invincible:0,
  _forgeActionClock:1,_forgeBalanceFrame:1,
  forge:{signatureVersion:1,color:'#4477cc',effectColor:'#4477cc'},
  forgeShots:[{x:130,y:110,vx:5,vy:0,z:0,life:95,
   targetNum:2,a}],forgeZones:[],forgeOrbs:[]};
 const e={playerNum:2,x:200,y:110,radius:20,hp:260,maxHp:260,
  invincible:0,vx:0,vy:0};
 return {p,e};
}
function forceTerminal(g,a,options={}){
 const {p,e}=actors(a),effects=[];
 let hitReady=options.hitReady??false,damageEnabled=options.damageEnabled??true;
 const hit=(actor,target,attack)=>{
  if(!damageEnabled||!hitReady||target.invincible>0||attack.damage<=0)return false;
  target.hp-=Math.min(target.hp,attack.damage);return true;
 };
 const execute=(actor,act,target)=>{
  effects.push({type:act.type,target:target===actor?'self':'enemy'});
  if(act.type==='heal')actor.hp=Math.min(actor.maxHp,actor.hp+act.damage);
  if(act.type==='shield')actor.invincible=60;
 };
 const fx=[];
 g.BattleFX={cast(_p,kind){fx.push(kind);},mark(){}};
 const world=g.SkillForgeWorldFactory({
  hit,hitGround:()=>false,enemies:()=>[e],execute});
 const start=a.fusion.splitTrigger==='hit';
 if(start){hitReady=true;e.x=150;world.tick(p,e);
  assert.equal(p.forgeShots.length,3);
  hitReady=false;
 }else{
  p.forgeShots[0].x=30;p.forgeShots[0].y=30;p.forgeShots[0].vx=0;
  for(let i=0;i<12;i++)world.tick(p,e);
  assert.equal(p.forgeShots.length,3);
 }
 const group=p.forgeShots[0]._fusionTerminalGroup;
 assert.ok(group,'chain must follow actual child objects');
 if(options.near===false){p.x=450;p.y=290;}
 else {p.x=150;p.y=110;}
 const bx=options.burstFar?400:200,by=110;
 for(let i=0;i<p.forgeShots.length;i++){
  const b=p.forgeShots[i];b.life=i===0?20:1;
  b.x=bx+i*2;b.y=by;b.vx=0;b.vy=0;
 }
 p._forgeActionClock=31;p._forgeBalanceFrame=31;
 hitReady=true;world.tick(p,e);
 assert.equal(group.remaining,1);
 assert.equal(effects.length,0);
 p.forgeShots[0].life=1;p.forgeShots[0].vx=0;p.forgeShots[0].vy=0;
 p._forgeActionClock=55;p._forgeBalanceFrame=55;
 world.tick(p,e);
 return {p,e,group,effects,fx,world};
}
test('compiler emits one shot and exactly three ordered post-fragment actions with TWO independent gates',()=>{
 const g=boot(),{r,a}=parse(g);
 assert.equal(a.fusion.split,true);
 assert.equal(a.fusion.splitTrigger,'hit');
 assert.equal(a.fusion.fragments,3);
 assert.deepEqual(JSON.parse(JSON.stringify(a.fusion.terminalChain)),[
  {type:'burst',gate:'always'},
  {type:'heal',gate:'damage'},
  {type:'tether',gate:'near'}]);
 assert.equal(r.semanticVerification.missing.length,0,JSON.stringify(r.semanticVerification));
 for(const key of ['terminalChain','heal','tether','terminalBurst'])
  assert.ok(r.semanticVerification.matched.includes(key),key);
 assert.ok(r.summary[0].fusion.includes('실제 피해 시'));
 assert.ok(r.summary[0].fusion.includes('적이 가까우면'));
 const graph=r.semanticGraph;
 assert.equal(graph.actions[0].terminalChain.length,3);
 assert.ok(graph.relations.some(e=>e.type==='requires_confirmed_damage'));
 assert.ok(graph.relations.some(e=>e.type==='requires_nearby_target'));
 assert.ok(graph.relations.some(e=>e.type==='next_stage'));
});
test('registered terminal evaluator executes three real actions in order when both gates hold',()=>{
 const g=boot(['skill-forge-world']),{a}=parse(g);
 const {p,e,effects,fx,world,group}=forceTerminal(g,a);
 assert.deepEqual(effects.map(x=>x.type),['heal','tether']);
 assert.equal(effects[0].target,'self');
 assert.equal(effects[1].target,'enemy');
 assert.equal(fx.filter(x=>x==='wave').length,1);
 assert.ok(e.hp<260,'terminal burst actually damaged its live target');
 assert.ok(p.hp>150);
 assert.equal(group.finished,true);
 assert.deepEqual(Array.from(p._terminalChainHistory[0].executed),['burst','heal','tether']);
 assert.equal(p._terminalChainHistory[0].stopped,null);
 world.tick(p,e);
 assert.equal(p._terminalChainHistory.length,1,'the group must never be replayed');
});
test('no confirmed burst damage blocks heal AND tether without imaginary successes',()=>{
 const g=boot(['skill-forge-world']),{a}=parse(g);
 for(const opts of [{damageEnabled:false},{burstFar:true}]){
  const {p,e,effects,fx}=forceTerminal(g,a,opts);
  assert.equal(e.hp,260);
  assert.deepEqual(effects,[]);
  assert.ok(fx.includes('wave'),'it still displays a real bounded burst VFX');
  assert.deepEqual(Array.from(p._terminalChainHistory[0].executed),['burst']);
  assert.equal(p._terminalChainHistory[0].stopped,'no-confirmed-damage');
  assert.equal(p.hp,150);
 }
});
test('the proximity gate stops tether after burst and healing if target is no longer near the caster',()=>{
 const g=boot(['skill-forge-world']),{a}=parse(g);
 const {p,e,effects}=forceTerminal(g,a,{near:false});
 assert.ok(e.hp<260,'the burst center is separate from caster');
 assert.deepEqual(effects.map(x=>x.type),['heal']);
 assert.ok(p.hp>150);
 assert.deepEqual(Array.from(p._terminalChainHistory[0].executed),['burst','heal']);
 assert.equal(p._terminalChainHistory[0].stopped,'no-nearby-enemy');
});
test('no hit-triggered fracture means NO terminal event or false heal',()=>{
 const g=boot(['skill-forge-world']),{a}=parse(g),{p,e}=actors(a);
 p.forgeShots[0].life=1;p.forgeShots[0].x=20;p.forgeShots[0].y=20;
 p.forgeShots[0].vx=0;p.forgeShots[0].vy=0;
 const effects=[];
 const world=g.SkillForgeWorldFactory({hit:()=>false,hitGround:()=>false,
  enemies:()=>[e],execute:(_p,act)=>{effects.push(act.type)}});
 world.tick(p,e);
 assert.equal(p.forgeShots.length,0);
 assert.deepEqual(effects,[]);
 assert.equal(p._terminalChainHistory,undefined);
});
test('a shielded enemy cannot satisfy the damage gate despite collision',()=>{
 const g=boot(['skill-forge-world']),{a}=parse(g);
 const {p,e,effects}=forceTerminal(g,a,{damageEnabled:false});
 assert.equal(p.hp,150);
 assert.equal(effects.length,0);
 assert.equal(e.hp,260);
});
test('two-stage sequential burst then self-healing works with a timed fracture',()=>{
 const g=boot(['skill-forge-world']),{r,a}=parse(g,short);
 assert.deepEqual(a.fusion.terminalChain.map(x=>x.type),['burst','heal']);
 assert.equal(a.fusion.splitTrigger,undefined);
 assert.ok(r.semanticVerification.matched.includes('heal'));
 const {p,e,effects}=forceTerminal(g,a);
 assert.ok(e.hp<260);
 assert.deepEqual(effects.map(x=>x.type),['heal']);
 assert.deepEqual(Array.from(p._terminalChainHistory[0].executed),['burst','heal']);
});
test('legacy terminal burst and shield work unchanged with no new chain data',()=>{
 const g=boot(['skill-forge-world']);
 const {a}=parse(g,
  '붉은 투사체가 공중에서 세 조각으로 분열하고 마지막 파편이 소멸하면 폭발하고 보호막을 생성한다');
 // A valid parsed two-action chain can coexist with old flags; emulate
 // an actual OLD saved profile by removing only the new opt-in payload.
 const legacy={...a,fusion:{...a.fusion,terminalChain:undefined}};
 const {p,e,effects,fx}=forceTerminal(g,legacy);
 assert.ok(fx.includes('wave'));
 assert.deepEqual(effects.map(x=>x.type),['shield']);
 assert.equal(p._terminalChainHistory,undefined);
});
test('untrusted graph cannot inject arbitrary operations, infinite loops or impossible gates',()=>{
 const g=boot(),T=g.TerminalEventChain;
 for(const broken of [
  [{type:'burst',gate:'always'},{type:'eval',gate:'always'}],
  [{type:'heal',gate:'damage'},{type:'shield',gate:'always'}],
  [{type:'shield',gate:'always'},{type:'heal',gate:'damage'}],
  [{type:'heal',gate:'always'},{type:'tether',gate:'near'},
   {type:'burst',gate:'always'},{type:'shield',gate:'always'}],
  [{type:'burst',gate:'always'},{type:'burst',gate:'always'}],
  [{type:'burst',gate:'always'},{type:'heal',gate:'near'}]
 ])assert.equal(T.normalize(broken),undefined);
 assert.equal(g.ConceptFusion.normalize({split:false,
  terminalChain:[{type:'burst',gate:'always'},{type:'heal',gate:'always'}]}),undefined);
 const once=g.TerminalEventChain.evaluate([
  {type:'burst',gate:'always'},{type:'heal',gate:'damage'}],
  {perform:t=>({performed:true,damaged:false})});
 assert.equal(once.stopped,'no-confirmed-damage');
 assert.deepEqual(once.executed,['burst']);
});
test('semantic input validation rejects ambiguous conditional structures instead of claiming success',()=>{
 const g=boot();
 const bad='투사체가 세 조각으로 분열하고 마지막 파편이 사라지면 자신을 회복한 뒤 피해가 들어가면 적을 속박한다';
 const parsed=g.TerminalEventChain.parse(bad);
 assert.match(parsed.error,/직전 충격파/);
 const r=g.SkillSentenceEngine.parse(bad);
 assert.equal(r.ok,false);
});
test('PVP compact trailer and saved IR preserve EXACT step order and gates',()=>{
 const g=boot(['pvp-original-engine']),{r,a}=parse(g);
 const ir=g.SkillIR.toRecipe(g.SkillIR.fromRecipe(r.recipe));
 assert.deepEqual(JSON.parse(JSON.stringify(ir.rules[0].action.fusion.terminalChain)),
  JSON.parse(JSON.stringify(a.fusion.terminalChain)));
 const profile={id:'custom',name:'인과 스킬',forgeData:{
  hp:240,speed:2,color:'#4477aa',effectColor:'#4477aa',
  signatureVersion:1,allAbilities:false,skills:[{
   name:'분열 회복 속박',cooldown:5,threshold:40,trigger:'auto',
   actions:[a],ruleSet:r.recipe}]}};
 const packet=g.PvpOriginalEngine.pack(profile);
 assert.ok(JSON.stringify(packet).length<2380);
 const f=packet.f[5][0][4][0][13];
 assert.equal(f.length,14);
 assert.ok(Array.isArray(f[13]));
 const restored=g.PvpOriginalEngine.unpack(packet);
 assert.deepEqual(JSON.parse(JSON.stringify(restored.skills[0].actions[0].fusion.terminalChain)),
  JSON.parse(JSON.stringify(a.fusion.terminalChain)));
 assert.deepEqual(JSON.parse(JSON.stringify(restored.skills[0].ruleSet.rules[0].action.fusion.terminalChain)),
  JSON.parse(JSON.stringify(a.fusion.terminalChain)));
 const previous={...a,fusion:{...a.fusion,terminalChain:undefined}};
 const oldpacket=g.PvpOriginalEngine.pack({
  ...profile,forgeData:{...profile.forgeData,skills:[{
   ...profile.forgeData.skills[0],actions:[previous],
   ruleSet:g.SignatureRuleSkill.normalize({window:7,
    rules:[{when:'pulse',interval:1,action:previous}]})}]}});
 assert.notEqual(oldpacket.f[5][0][4][0][13].length,14);
});
test('offline mini pinball lab uses the same bounded gate interpreter and physical fragment retirement',()=>{
 const g=boot(['arena-body-physics','studio-pinball-lab']),{r,a}=parse(g,short);
 const profile={name:'인과 연쇄',color:'#4488bb',effectColor:'#4488bb',
  signatureVersion:1,skills:[{name:'분열 회복',trigger:'auto',actions:[a],ruleSet:r.recipe}]};
 const lab=g.StudioPinballLab.make(profile);lab.balls[0].hp=68;
 lab.fire();lab.advanceTo(5000);
 assert.ok(lab.terminalChainEvents>0);
 assert.ok(lab.terminalChainHistory.length>0);
 assert.ok(lab.terminalChainHistory.every(x=>x.mode==='geometry-only-preview'));
 assert.ok(lab.terminalChainHistory.every(x=>x.executed.length<=3));
 assert.equal(lab.terminalShieldEvents,0);
});
test('both runtime entry pages load the conditional evaluator after fusion, before semantics and world',()=>{
 for(const page of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(page,'utf8');
  const fusion=html.indexOf('concept-fusion.js'),graph=html.indexOf('terminal-event-chain.js');
  const semantic=html.indexOf('semantic-intent-composer.js');
  assert.ok(fusion<graph&&graph<semantic,page);
 }
});
