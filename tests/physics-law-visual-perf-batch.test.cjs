'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync('js/features/'+name+'.js','utf8');
const modules=['action-registry','semantic-physics','physics-law-engine',
 'signature-program','skill-fx-composer','metaphor-visuals',
 'signature-scratch','fantasy-skill-graph','signature-rule-skill',
 'skill-ir','signature-rule-live','korean-skill-grammar',
 'korean-skill-parameters','signature-prompt-compiler','skill-sentence-engine'];
function boot(extra=[]){
 const g={Math,Date,Number,Set,Map,WeakMap,console,players:[],
  CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:480,height:320},createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of [...modules,...extra])
  vm.runInContext(read(file),g,{filename:file+'.js'});
 return g;
}
function fight(g,law,options={}){
 const p={playerNum:1,x:100,y:100,vx:0,vy:0,radius:20,
  hp:250,forge:{signatureVersion:1,color:'#aabbcc',effectColor:'#aabbcc'}};
 const e={playerNum:2,x:190,y:100,vx:options.vx??-6,vy:options.vy??0,
  radius:20,hp:250,invincible:options.invincible||0};
 const a={type:'phenomenon',damage:options.damage??0,
  law,radius:law.radius,duration:law.duration};
 let hits=0;
 const hit=(_attacker,target,action)=>{
  hits++;if(target.invincible>0)return false;
  target.hp=Math.max(0,target.hp-action.damage);
  return true;
 };
 assert.equal(g.ActionRegistry.run(p,a,e,{hit,enemies:()=>[e]}),true);
 return {p,e,a,hit,get hits(){return hits;}};
}
test('two new Korean physical operators compile as REAL force data with distinct procedural layers',()=>{
 const g=boot();
 const reflect=g.SkillSentenceEngine.parse('탄성 반사장을 반경 180으로 펼쳐서 다가오는 공을 튕겨낸다. 힘 3');
 assert.equal(reflect.ok,true,reflect.error);
 assert.equal(reflect.method,'offline-physics-law-dsl');
 const a=reflect.recipe.rules[0].action;
 assert.deepEqual(Array.from(a.law.terms,t=>t.op),['reflect']);
 assert.equal(a.visual.layers[0].kind,'rebound');
 assert.equal(a.law.radius,180);
 const shear=g.SkillSentenceEngine.parse('전단력으로 반경 170 안쪽과 바깥쪽을 서로 다른 속도로 회전시키며 힘 2를 가한다');
 assert.equal(shear.ok,true,shear.error);
 const b=shear.recipe.rules[0].action;
 assert.ok(b.law.terms.some(t=>t.op==='shear'));
 assert.equal(b.visual.layers[0].kind,'shear');
 assert.ok(g.ActionRegistry.get('phenomenon')?.execute,'registered physical engine must remain authoritative');
});
test('inbound enemy is reflected by actual bounded velocity impulses, not just an animation',()=>{
 const g=boot(),law=g.PhysicsLawEngine.normalize({
  radius:220,duration:2,damage:0,terms:[
   {op:'reflect',strength:4,falloff:'constant'}]});
 const b=fight(g,law,{vx:-6}),start=b.e.vx;
 g.PhysicsLawEngine.tick(b.p,[b.e],b.hit);
 assert.ok(b.e.vx>start);
 for(let i=0;i<6;i++)g.PhysicsLawEngine.tick(b.p,[b.e],b.hit);
 assert.ok(b.e.vx>0,'incoming radial motion must eventually reverse');
 assert.equal(b.e.hp,250,'reflected motion never fabricates HP damage');
 assert.equal(b.hits,0);
 assert.ok(Math.abs(b.e.vx)<=18);
});
test('an already departing ball is NOT accelerated by the reflection operator',()=>{
 const g=boot(),law=g.PhysicsLawEngine.normalize({
  radius:220,duration:1,damage:0,terms:[
   {op:'reflect',strength:4,falloff:'constant'}]});
 const b=fight(g,law,{vx:6,vy:0});
 g.PhysicsLawEngine.tick(b.p,[b.e],b.hit);
 assert.equal(b.e.vx,6);
 assert.equal(b.e.vy,0);
});
test('radial shear creates counter-rotating motion on inner versus outer rings',()=>{
 const g=boot(),law=g.PhysicsLawEngine.normalize({
  radius:180,duration:1,damage:0,terms:[
   {op:'shear',strength:2,falloff:'constant'}]});
 const p={x:100,y:100,vx:0,vy:0,hp:220,playerNum:1},
  inside={x:145,y:100,vx:0,vy:0,hp:220,radius:12},
  outside={x:245,y:100,vx:0,vy:0,hp:220,radius:12};
 const a={type:'phenomenon',damage:0,radius:180,duration:1,law};
 g.PhysicsLawEngine.fieldFor(p,a,p);
 g.PhysicsLawEngine.tick(p,[inside,outside],()=>{throw Error('no HP damage on force-only fields');});
 assert.ok(inside.vy<0,'inner band rotates clockwise');
 assert.ok(outside.vy>0,'outer band rotates counterclockwise');
 assert.ok(Number.isFinite(inside.vx)&&Number.isFinite(outside.vx));
});
test('broadphase culls distant targets before per-term geometry, preserves correct near HP callback',()=>{
 const g=boot(),law=g.PhysicsLawEngine.normalize({
  radius:150,duration:1,damage:20,terms:[
   {op:'reflect',strength:2,falloff:'constant'},
   {op:'shear',strength:2,falloff:'linear'},
   {op:'drag',strength:1,falloff:'quadratic'}]});
 const b=fight(g,law,{damage:20,invincible:1}),near=b.e;
 const far=Array.from({length:50},(_,i)=>({
  x:500+i*10,y:400,vx:0,vy:0,hp:250,radius:12,playerNum:i+3}));
 g.PhysicsLawEngine.tick(b.p,[...far,near],b.hit);
 const stats=g.PhysicsLawEngine.metrics(b.p);
 assert.equal(stats.tested,51);
 assert.equal(stats.inside,1);
 assert.equal(stats.terms,3,'far balls must skip all force operators');
 assert.equal(stats.hitChecks,1);
 assert.equal(b.hits,1);
 assert.equal(near.hp,250,'shielded hits remain authoritative');
 assert.ok(far.every(x=>x.vx===0&&x.vy===0),'no invisible force outside the field');
});
test('a large number of active fields respects caps and never grows unbounded',()=>{
 const g=boot(),law={terms:[{op:'reflect',strength:6,falloff:'constant'},
  {op:'shear',strength:6,falloff:'linear'}],duration:8,radius:200,damage:0};
 const p={playerNum:1,x:100,y:100,hp:250},e={x:160,y:100,hp:250,vx:-6,vy:0,radius:20};
 for(let i=0;i<100;i++)g.PhysicsLawEngine.fieldFor(p,{type:'phenomenon',
  law,damage:0,radius:200,duration:8},e);
 assert.equal(g.PhysicsLawEngine.report(p).length,g.PhysicsLawEngine.maxFields);
 for(let i=0;i<500;i++)g.PhysicsLawEngine.tick(p,[e],()=>false);
 assert.equal(g.PhysicsLawEngine.report(p).length,0);
 assert.ok(Math.abs(e.vx)<=18&&Math.abs(e.vy)<=18);
 assert.ok(Number.isFinite(e.vx)&&Number.isFinite(e.vy));
});
function painter(){
 const calls=[],ctx=new Proxy({globalAlpha:1},{get(obj,k){
  if(k in obj)return obj[k];
  return (...args)=>{calls.push({k,args});};
 },set(obj,k,v){obj[k]=v;return true;}});
 return {ctx,calls};
}
test('animated rebound and shear visuals change geometry across frames and respect reduced-detail budget',()=>{
 const g=boot();
 for(const kind of ['rebound','shear']){
  const visual={layers:[{kind,color:'#aabbcc',power:1.2,spin:1}]};
  const first=painter(),last=painter(),low=painter();
  assert.equal(g.SkillFXComposer.paint(first.ctx,{visual,progress:.1,radius:155,phase:'cast'}),true);
  assert.equal(g.SkillFXComposer.paint(last.ctx,{visual,progress:.75,radius:155,phase:'cast'}),true);
  assert.equal(g.SkillFXComposer.paint(low.ctx,{visual,progress:.1,radius:155,phase:'cast',low:true}),true);
  assert.notDeepEqual(first.calls,last.calls,kind+' needs actual time-varying geometry');
  assert.ok(first.calls.length<175&&last.calls.length<175);
  assert.ok(low.calls.length<first.calls.length,'reduced-detail should draw fewer primitives');
  assert.ok(first.calls.some(c=>c.k===('rebound'===kind?'ellipse':'arc')));
 }
});
test('authoritative world requests opponents only once per tick even with dozens of homing shots',()=>{
 const g=boot(['skill-forge-world']);
 const p={x:100,y:100,hp:250,radius:20,playerNum:1,
  _forgeActionClock:10,_forgeBalanceFrame:10,
  forge:{color:'#aabbcc',effectColor:'#aabbcc'},
  forgeShots:Array.from({length:48},(_,i)=>({
   x:105,y:105+i%5,vx:1,vy:0,life:100,z:0,
   targetNum:2,a:{type:'shot',speed:4,damage:0,
    fusion:{homing:true}}})),forgeZones:[],forgeOrbs:[]};
 const e={x:430,y:100,hp:250,playerNum:2,radius:20};
 let requested=0;
 const w=g.SkillForgeWorldFactory({
  hit:()=>false,hitGround:()=>false,
  enemies:()=>{requested++;return [e];}});
 w.tick(p,e);
 assert.equal(requested,1,'one shared roster rather than per-projectile lookups');
 assert.ok(p.forgeShots.every(b=>Number.isFinite(b.vx)&&Number.isFinite(b.vy)));
});
test('new law opcodes survive PvP compact packet and SkillIR without changing old opcode indices',()=>{
 const g=boot(['pvp-original-engine']);
 const raw='탄성 반사장을 펼치고 전단력을 작용시켜 상대를 밀어낸다. 힘 3';
 const out=g.PhysicsLawEngine.interpret(raw);
 assert.equal(out.ok,true);
 const a=out.recipe.rules[0].action;
 assert.ok(a.law.terms.some(t=>t.op==='reflect'));
 assert.ok(a.law.terms.some(t=>t.op==='shear'));
 const profile={id:'custom',name:'물리장',forgeData:{signatureVersion:1,
  hp:230,speed:2,color:'#aabbcc',effectColor:'#aabbcc',
  allAbilities:false,skills:[{name:'반사 전단력',trigger:'auto',
   cooldown:5,threshold:40,actions:[a],ruleSet:out.recipe}]}};
 const packed=g.PvpOriginalEngine.pack(profile);
 assert.ok(JSON.stringify(packed).length<2380);
 const restored=g.PvpOriginalEngine.unpack(packed);
 const lawRestored=restored.skills[0].actions[0].law;
 assert.ok(lawRestored.terms.some(t=>t.op==='reflect'));
 assert.ok(lawRestored.terms.some(t=>t.op==='shear'));
 assert.ok(restored.skills[0].ruleSet.rules[0].action.law.terms.some(t=>t.op==='reflect'));
 assert.equal(g.SkillIR.toRecipe(g.SkillIR.fromRecipe(out.recipe)).rules[0].action.law.terms.length,a.law.terms.length);
 const old=g.PhysicsLawEngine.interpret('중력장으로 적을 중심으로 끌어당기며 회전시킨다').recipe.rules[0].action;
 const oldProfile={...profile,forgeData:{...profile.forgeData,skills:[{
  ...profile.forgeData.skills[0],actions:[old],ruleSet:{window:6,rules:[{when:'pulse',action:old}]}}]}};
 assert.equal(g.PvpOriginalEngine.unpack(g.PvpOriginalEngine.pack(oldProfile))
  .skills[0].actions[0].law.terms[0].op,old.law.terms[0].op);
});
test('these same new procedural FX layers are carried by registered SkillVisuals on cast',()=>{
 const g=boot(['skill-visuals']);
 const x=g.PhysicsLawEngine.interpret('반경 170 탄성 반사장이 적의 운동량을 반사한다');
 assert.ok(x?.ok);
 const p={x:100,y:100,vx:0,vy:0,hp:200,
  forge:{color:'#aabbcc',effectColor:'#aabbcc'}};
 assert.equal(g.SkillVisuals.cast(p,x.recipe.rules[0].action,null),true);
 const event=g.SkillVisuals.exportEffects().slice(-1)[0];
 assert.equal(event.type,'phenomenon');
 assert.ok(event.visual.layers.some(v=>v.kind==='rebound'));
});
