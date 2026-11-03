'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('One NEW imaginary sentence: language -> force, real hit, visual and color',()=>{
 const g={Math,Date,Number,Set,Map,WeakMap,console,players:[],CUSTOM_DEFS:[],
  BEHAVIORS:{},CHARACTER_PHOTOS:{},canvas:{width:480,height:320},
  createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['action-registry','semantic-physics','physics-law-engine',
  'signature-program','skill-fx-composer','metaphor-visuals','skill-color-policy',
  'semantic-concept-atlas','concept-fusion','imagination-concepts',
  'semantic-intent-composer','signature-scratch','fantasy-skill-graph',
  'signature-rule-skill','skill-ir','signature-rule-live','korean-skill-grammar',
  'korean-skill-parameters','signature-prompt-compiler','skill-sentence-engine','skill-visuals'])
   vm.runInContext(fs.readFileSync('js/features/'+file+'.js','utf8'),g,{filename:file+'.js'});
 const sentence='청록색 해파리 모양 자기장이 적을 끌어당기면서 빙빙 회전시키고 3초 동안 점점 약해진다.';
 const result=g.SkillSentenceEngine.parse(sentence);
 assert.equal(result.ok,true,result.error||'Skill parse failed');
 const a=result.recipe.rules[0].action;
 const ops=Array.from(a.law?.terms||[],x=>x.op);
 const color=g.SkillColorPolicy.resolve(a.visual,'#ff0000').color;
 assert.equal(a.type,'phenomenon');
 assert.ok(ops.includes('attract'),'real attraction force term missing');
 assert.ok(ops.includes('spin'),'real spin force term missing');
 assert.equal(a.law.decay,'fade','force must weaken over time');
 assert.equal(color,'#06b6d4','explicit turquoise must beat fighter red');
 assert.equal(a.visual.colorMode,'explicit');
 assert.deepEqual(Array.from(result.semanticVerification.missing),[]);
 const canvas=new Proxy({globalAlpha:1},{get(o,k){return k in o?o[k]:()=>{}},set(o,k,v){o[k]=v;return true}});
 const painted=g.SkillVisuals.previewFrame(canvas,{type:a.type,phase:'cast',visual:a.visual,
  progress:.35,radius:a.radius,color:'#ff0000'});
 assert.equal(painted,true,'Canvas graphic rendering failed');
 const owner={x:100,y:100,hp:200,playerNum:1,forge:{effectColor:'#ff0000'}};
 const enemy={x:155,y:100,vx:0,vy:0,hp:200,radius:20,playerNum:2};
 let hits=0;
 const hit=(p,e,act)=>{hits++;e.hp-=Math.max(0,act.damage||0);return true};
 assert.equal(g.ActionRegistry.run(owner,a,enemy,{enemies:()=>[enemy],hit}),true);
 for(let t=0;t<90;t++)g.PhysicsLawEngine.tick(owner,[enemy],hit);
 assert.ok(enemy.vx<0,'pull should move enemy toward caster');
 assert.ok(enemy.vy>0,'spin should move enemy tangentially');
 assert.ok(hits>0,'combat hit resolver was never reached');
 assert.ok(enemy.hp<200,'HP did not decrease via actual hit callback');
 console.log('SINGLE_SKILL_CHECK|'+JSON.stringify({
  sentence,method:result.method,action:a.type,forceOps:ops,decay:a.law.decay,
  colorSource:result.colorPriority,color,visualKinds:a.visual.layers.map(v=>v.kind),
  drawn:painted,initialEnemyHp:200,finalEnemyHp:enemy.hp,hitCalls:hits,
  velocity:{x:enemy.vx,y:enemy.vy},missing:result.semanticVerification.missing
 }));
});
