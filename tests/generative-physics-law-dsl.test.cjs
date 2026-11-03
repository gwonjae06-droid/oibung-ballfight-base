'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm');
const read=n=>fs.readFileSync('js/features/'+n+'.js','utf8');
function boot(modules){
 const g={Math,Date,Number,Set,Map,WeakMap,console,
  players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:480,height:320},
  createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(){return null;}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const name of modules)vm.runInContext(read(name),g,{filename:name+'.js'});
 return g;
}
const language=['action-registry','semantic-physics','physics-law-engine',
 'signature-program','skill-fx-composer','metaphor-visuals','concept-fusion',
 'signature-scratch','fantasy-skill-graph','signature-rule-skill','skill-ir',
 'signature-rule-live','korean-skill-grammar','korean-skill-parameters',
 'signature-prompt-compiler','skill-sentence-engine'];
test('Korean imagination creates a NEW combined vector field equation',()=>{
 const g=boot(language);
 const s='적을 중심으로 반경 180의 역중력으로 밀어내면서 소용돌이로 회전시키고 4초 동안 점점 약해진다. 힘 3';
 const out=g.SkillSentenceEngine.parse(s);
 assert.equal(out.ok,true,out.error);
 assert.equal(out.method,'offline-physics-law-dsl');
 assert.equal(out.recipe.rules.length,1);
 const rule=out.recipe.rules[0],a=rule.action,l=a.law;
 assert.equal(a.type,'phenomenon');
 assert.equal(l.anchor,'target');
 assert.equal(l.decay,'fade');
 assert.equal(l.radius,180);
 assert.equal(l.duration,4);
 assert.deepEqual(Array.from(l.terms,t=>t.op),['repel','spin']);
 assert.equal(l.terms[0].strength,3);
 assert.ok(out.summary[0].law.includes('회전력'));
 assert.ok(g.ActionRegistry.get('phenomenon')?.execute);
});
test('distance-dependent and time-dependent physics are composable without new registered moves',()=>{
 const g=boot(language);
 const x=g.PhysicsLawEngine.interpret('물리 법칙: 거리가 멀어질수록 강해지는 용수철 탄성력과 궤도력을 만들어 3초 동안 작용한다. 기준 거리 100');
 assert.ok(x?.ok);
 const l=x.recipe.rules[0].action.law;
 assert.equal(l.terms[0].falloff,'edge');
 assert.ok(l.terms.some(x=>x.op==='spring'));
 assert.ok(l.terms.some(x=>x.op==='orbit'));
 assert.equal(l.terms[0].rest,100);
 const y=g.PhysicsLawEngine.interpret('거리의 제곱에 반비례하는 만유인력 법칙을 반경 200 안에 적용한다');
 assert.equal(y.recipe.rules[0].action.law.terms[0].op,'gravity');
 assert.equal(y.recipe.rules[0].action.law.terms[0].falloff,'inverse');
});
test('generated law is actual bounded force; simulated target moves under attraction and orbit',()=>{
 const g=boot(language);
 const law=g.PhysicsLawEngine.normalize({anchor:'caster',radius:240,duration:3,damage:0,terms:[
  {op:'attract',strength:1.5,falloff:'constant'},
  {op:'spin',strength:1.4,falloff:'constant'}]});
 const p={playerNum:1,x:100,y:100,vx:0,vy:0,hp:200,forge:{color:'#ffffff'}};
 const foe={playerNum:2,x:210,y:100,vx:0,vy:0,hp:200,radius:20};
 const action={type:'phenomenon',law,radius:240,duration:3,damage:0};
 assert.equal(g.ActionRegistry.run(p,action,foe,{hit:()=>true,enemies:()=>[foe]}),true);
 g.PhysicsLawEngine.tick(p,[foe],()=>true);
 assert.ok(foe.vx<0,'attraction decreases outward velocity');
 assert.ok(foe.vy>0,'spin generates tangential motion');
 assert.equal(g.PhysicsLawEngine.report(p).length,1);
 for(let i=0;i<190;i++)g.PhysicsLawEngine.tick(p,[foe],()=>true);
 assert.equal(g.PhysicsLawEngine.report(p).length,0,'bounded duration expires');
});
test('new law does not bypass shielded hits and uses the authoritative hit callback',()=>{
 const g=boot(language);
 const law=g.PhysicsLawEngine.normalize({radius:150,duration:1,damage:25,
  terms:[{op:'pulse',strength:2,falloff:'linear'}]});
 const p={playerNum:1,x:100,y:100,hp:100,forge:{color:'#ffffff'}};
 const enemy={playerNum:2,x:140,y:100,vx:0,vy:0,hp:100,radius:20,invincible:20};
 const action={type:'phenomenon',damage:25,law,radius:150,duration:1};
 let attempted=0,confirmed=0;
 const hit=(_p,e,a)=>{
  attempted++;
  if(e.invincible>0)return false;
  e.hp=Math.max(0,e.hp-a.damage);confirmed++;return true;
 };
 g.ActionRegistry.run(p,action,enemy,{hit,enemies:()=>[enemy]});
 g.PhysicsLawEngine.tick(p,[enemy],hit);
 assert.equal(enemy.hp,100,'physical force never directly subtracts HP');
 assert.equal(attempted,1);
 enemy.invincible=0;
 for(let i=0;i<29;i++)g.PhysicsLawEngine.tick(p,[enemy],hit);
 assert.equal(confirmed,1);
 assert.ok(enemy.hp<100);
});
test('malicious expressions, huge magnitudes and huge operator lists are rejected or clipped',()=>{
 const g=boot(language);
 const bad={anchor:'__proto__',radius:1e30,duration:1e12,period:0,damage:1e9,
  terms:Array.from({length:200},(_,i)=>({op:i%3===0?'eval()':'attract',
   strength:1e30,falloff:'eval',rest:-1e6,sign:-10}))};
 const safe=g.PhysicsLawEngine.normalize(bad);
 assert.ok(safe.terms.length<=5);
 assert.ok(safe.terms.every(t=>t.op==='attract'&&t.strength<=6&&t.rest>=20));
 assert.equal(safe.radius,300);
 assert.equal(safe.duration,8);
 assert.equal(safe.damage,120);
 assert.equal(safe.anchor,'caster');
 assert.equal(g.PhysicsLawEngine.normalize({terms:[{op:'constructor'}]}),undefined);
 assert.equal(g.PhysicsLawEngine.normalize({terms:[{op:'__proto__'}]}),undefined);
});
test('field-count ceiling and per-entity motion caps survive 100 simultaneous casts',()=>{
 const g=boot(language);
 const p={x:100,y:100,playerNum:1,hp:100},
  e={x:125,y:100,vx:0,vy:0,radius:20,playerNum:2,hp:100};
 const action={type:'phenomenon',damage:0,duration:8,radius:150,
  law:{terms:[{op:'repel',strength:6,falloff:'constant'}],duration:8,damage:0}};
 for(let i=0;i<100;i++)g.PhysicsLawEngine.fieldFor(p,action,e);
 assert.equal(g.PhysicsLawEngine.report(p).length,g.PhysicsLawEngine.maxFields);
 g.PhysicsLawEngine.tick(p,[e],()=>true);
 assert.ok(Math.abs(e.vx)<=18);
 for(let i=0;i<600;i++)g.PhysicsLawEngine.tick(p,[e],()=>true);
 assert.equal(g.PhysicsLawEngine.report(p).length,0);
});
test('Skill IR and saved characters retain validated generated law',()=>{
 const g=boot([...language,'skill-forge-profiles']);
 const parsed=g.SkillSentenceEngine.parse('회전시키면서 밀어내는 반경 160의 역중력 법칙, 4초 동안 힘 3');
 assert.equal(parsed.ok,true);
 const ir=g.SkillIR.fromRecipe(parsed.recipe);
 const physics=ir.events[0].physics.map(x=>x.op);
 assert.ok(physics.includes('force-repel'));
 assert.ok(physics.includes('force-spin'));
 assert.equal(g.SkillIR.toRecipe(ir).rules[0].action.law.terms.length,2);
 const P=g.SkillForgeProfilesFactory({TYPE:g.ActionRegistry.TYPE,
  TRIGGER:{auto:'자동'},STATUS:{none:'없음'},ACTION_PARAMETERS:g.ActionRegistry.ACTION_PARAMETERS,
  MOVEMENT_ONLY:g.ActionRegistry.MOVEMENT_ONLY});
 const saved=P.normalize({name:'물리학자',signatureVersion:1,skills:[{name:'장',
  actions:g.SignatureRuleSkill.preview(parsed.recipe),ruleSet:parsed.recipe,ir}]});
 assert.equal(saved.skills[0].actions[0].law.terms.length,2);
 assert.equal(saved.skills[0].ruleSet.rules[0].action.law.terms.length,2);
});
test('compact PvP format keeps the new law and still decodes legacy profiles',()=>{
 const g=boot([...language,'pvp-original-engine']);
 const a=g.SkillSentenceEngine.parse('힘 3으로 반경 170의 역중력장을 만들어 적을 밀어내면서 회전시킨다').recipe.rules[0].action;
 const p={id:'test',name:'장술사',forgeData:{signatureVersion:1,
  hp:200,speed:2,color:'#aabbcc',effectColor:'#aabbcc',
  skills:[{name:'장',trigger:'auto',cooldown:3,threshold:20,
   actions:[a],ruleSet:{window:6,rules:[{when:'pulse',interval:2,action:a}]}}]}};
 const packet=g.PvpOriginalEngine.pack(p);
 const restored=g.PvpOriginalEngine.unpack(packet);
 assert.equal(restored.skills[0].actions[0].law.terms.length,2);
 assert.equal(restored.skills[0].ruleSet.rules[0].action.law.anchor,'caster');
 assert.ok(JSON.stringify(packet).length<2380);
 const old={...a,law:undefined};
 const q={...p,forgeData:{...p.forgeData,
  skills:[{name:'구형',trigger:'auto',cooldown:3,actions:[old]}]}};
 const restoredOld=g.PvpOriginalEngine.unpack(g.PvpOriginalEngine.pack(q));
 assert.equal(restoredOld.skills[0].actions[0].law,undefined);
});
test('same generated law drives world simulation and the pinball preview',()=>{
 const g=boot([...language,'skill-forge-world','studio-pinball-lab']);
 const p={x:100,y:100,playerNum:1,hp:100,forge:{color:'#ffffff'},
  forgeShots:[],forgeZones:[],forgeOrbs:[]};
 const e={x:175,y:100,playerNum:2,hp:100,radius:12,vx:0,vy:0};
 const spec=g.PhysicsLawEngine.interpret('힘 2의 역중력장으로 적을 밀어내면서 회전시킨다');
 assert.ok(spec?.ok);
 const a=spec.recipe.rules[0].action;
 g.ActionRegistry.run(p,a,e,{enemies:()=>[e],hit:()=>true});
 g.SkillForgeWorldFactory({enemies:()=>[e],hit:()=>true,hitGround:()=>true}).tick(p,e);
 assert.ok(Math.hypot(e.vx,e.vy)>0);
 const profile={name:'입자',signatureVersion:1,
  skills:[{name:'물리 법칙',actions:[a],ruleSet:spec.recipe}]};
 const lab=g.StudioPinballLab.make(profile,'all');
 lab.fire();lab.advanceTo(220);
 assert.ok(lab.casts>0);
 assert.ok(read('studio-pinball-lab').includes('PhysicsLawEngine?.tick?.'));
});
test('native script entrypoints and sentence studio expose law creation without manual coding',()=>{
 for(const page of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(page,'utf8');
  assert.ok(html.includes('physics-law-engine.js?v=1-generated-field-algebra'));
  assert.ok(html.indexOf('physics-law-engine.js')<html.indexOf('signature-scratch.js'));
  assert.ok(html.indexOf('physics-law-engine.js')<html.indexOf('skill-forge-profiles.js'));
 }
 const ui=read('signature-rule-studio');
 assert.match(ui,/tuneLaw/);
 assert.match(ui,/data-law-index/);
 assert.match(ui,/data-rule-example="physics"/);
});
