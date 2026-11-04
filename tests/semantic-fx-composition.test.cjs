'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'../js/features',n+'.js'),'utf8');
function boot(){
 const TYPE={wave:'충격파',shot:'투사체',beam:'레이저',bolt:'낙뢰',
  slash:'베기',haste:'가속',splitshot:'분열탄',shield:'보호막',
  dive:'낙하',leap:'점프',dash:'돌진',heal:'회복',pull:'흡입',zone:'지속 장판',
  nova:'주변 폭발',meteor:'운석',blackhole:'블랙홀'};
 const g={Math,Date,Number,console,
  SkillForge:{TYPE,STATUS:{none:'없음',ice:'빙결',fire:'화염',poison:'독'}},
  ActionRegistry:{TYPE,get:id=>({id,offense:!['haste','heal','shield'].includes(id),physics:'strike'}),
   visualCatalog:Object.fromEntries(Object.keys(TYPE).map(x=>[x,['ripples','#aaccff']]))}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['signature-program','skill-fx-composer','metaphor-visuals',
  'signature-scratch','fantasy-skill-graph','signature-rule-skill','signature-rule-live',
  'korean-skill-grammar','signature-prompt-compiler','skill-sentence-engine'])
  vm.runInContext(read(file),g,{filename:file});
 return g;
}
const names=['lightning','coil','burst','embers','mist','ice','vortex',
 'stars','wind','water','runes','petals','shards','shadow','rings','chains',
 'thorns','hearts','rain','orbit','trail','web',
 'gears','circuit','hologram','steam','feathers','plasma','rebound','shear'];
test('28 visual primitives are discoverable, rendered in bounded layers',()=>{
 const g=boot(),C=g.SkillFXComposer;
 assert.equal(Object.keys(C.KINDS).length,30);
 for(const name of names)assert.ok(C.KINDS[name]);
 const raw={shape:'aura',color:'#54306d',scale:3,charge:true,layers:
  names.map(kind=>({kind,color:'#abcdef',power:999,spin:99}))};
 const v=g.MetaphorVisuals.normalize(raw);
 assert.equal(v.layers.length,5);
 assert.ok(v.layers.every(x=>x.power<=2.5&&x.spin<=3));
 assert.equal(v.scale,2.8);
 const calls=[],ctx=new Proxy({globalAlpha:1},{get(obj,key){
  if(key in obj)return obj[key];
  return (...args)=>{calls.push({name:key,args});};
 },set(obj,key,value){obj[key]=value;return true;}});
 assert.equal(g.MetaphorVisuals.paint(ctx,{visual:v,progress:.42,radius:130,phase:'cast'}),true);
 assert.ok(calls.some(c=>c.name==='lineTo'));
 assert.ok(calls.length<500);
 assert.ok(g.SkillFXComposer.paint(ctx,{visual:v,progress:.42,radius:130,low:true}));
});
test('imagery parsing composes lightning, snake-like coils and a following explosion',()=>{
 const g=boot(),input='검은 번개가 뱀처럼 휘감다가 폭발한다';
 const grammar=g.KoreanSkillGrammar.analyze(input,g.SkillForge.TYPE);
 assert.ok(grammar.clauses.length>=2);
 assert.equal(grammar.clauses[0].chosen.type,'bolt');
 assert.equal(grammar.clauses[1].chosen.type,'wave');
 const result=g.SkillSentenceEngine.parse(input);
 assert.equal(result.ok,true);
 const spell=result.recipe.rules.find(r=>r.steps?.length);
 assert.ok(spell,'must create a sequential attack, not just a decoration');
 const shots=spell.steps.filter(x=>x.kind==='cast');
 assert.deepEqual(Array.from(shots,x=>x.action.type),['bolt','wave']);
 const first=shots[0].action.visual.layers.map(x=>x.kind);
 const second=shots[1].action.visual.layers.map(x=>x.kind);
 assert.ok(first.includes('lightning')&&first.includes('coil')&&first.includes('shadow'));
 assert.ok(second.includes('burst'));
 assert.ok(!second.includes('coil'),'later attack does not inherit earlier modifier');
 assert.ok(result.summary.some(x=>x.visual.includes('번개')));
 const hero={hp:100,maxHp:100,x:100,y:100,_scratchEvents:{}};
 const enemy={hp:100,x:150,y:100};
 const live=g.SignatureRuleLive.begin(result.recipe,hero);
 const seen=[];
 for(let tick=0;tick<60;tick++){
  const action=g.SignatureRuleLive.step(live,hero,enemy);
  if(action)seen.push(action);
 }
 assert.deepEqual(Array.from(seen.slice(0,2),x=>x.type),['bolt','wave']);
});
test('unknown poetic effect infers a named working attack and explicitly discloses analogy',()=>{
 const g=boot();
 const result=g.SkillSentenceEngine.parse('장미 꽃잎이 비처럼 적을 향해 쏟아진다');
 assert.equal(result.ok,true);
 assert.ok(result.recipe.rules[0].action.type);
 assert.ok(result.recipe.rules[0].action.visual.layers.length>0);
 assert.ok(result.limitations.some(x=>x.includes('비유 유추')));
});
test('semantic mixture preserves original jaw morph and adds fire+magic parts',()=>{
 const g=boot(),p=g.SkillSentenceEngine.parse('거대한 턱이 불꽃과 함께 마법진처럼 펼쳐져 상대를 후려친다');
 assert.equal(p.ok,true);
 const a=p.recipe.rules[0].action;
 assert.equal(a.type,'slash');
 assert.equal(a.visual.shape,'jaw');
 assert.ok(a.visual.layers.some(l=>l.kind==='embers'));
 assert.ok(a.visual.layers.some(l=>l.kind==='runes'));
});
test('semantic parser binds separate conditions without inventing unsolicited pulse',()=>{
 const g=boot(),text='벽에 튕기면 가속하고 상대와 충돌하면 충격파';
 const p=g.SkillSentenceEngine.parse(text);
 assert.equal(p.ok,true);
 assert.ok(p.recipe.rules.some(r=>r.when==='wall'&&r.action.type==='haste'));
 assert.ok(p.recipe.rules.some(r=>r.when==='contact'&&r.action.type==='wave'));
 assert.ok(!p.recipe.rules.some(r=>r.steps?.length));
});
test('PvP compresses FX recipe and restores it, while old object profiles still decode',()=>{
 const g=boot();vm.runInContext(read('pvp-original-engine'),g,{filename:'pvp-original-engine'});
 const phrase='검은 번개가 뱀처럼 휘감다가 폭발한다';
 const recipe=g.SkillSentenceEngine.parse(phrase).recipe;
 const pack=g.PvpOriginalEngine.pack({id:'custom',name:'검은 뱀',
  forgeData:{signatureVersion:1,hp:250,speed:3,color:'#112233',
   effectColor:'#54306d',allAbilities:false,skills:[{
    name:'그림자 전류',trigger:'auto',cooldown:3,threshold:30,
    actions:g.SignatureRuleSkill.preview(recipe),ruleSet:recipe
   }]}});
 assert.ok(JSON.stringify(pack).length<2380);
 const restored=g.PvpOriginalEngine.unpack(pack).skills[0].ruleSet.rules[0].steps;
 assert.ok(restored);
 const first=restored.find(s=>s.kind==='cast').action.visual;
 assert.ok(first.layers.some(l=>l.kind==='lightning'));
 assert.equal(first.color,'#54306d');
});
test('the same composer is loaded before both PvP and PvE combat visual renderers',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const pvp=fs.readFileSync(path.join(__dirname,'../pvp-runtime.html'),'utf8');
 for(const page of [html,pvp]){
  const x=page.indexOf('skill-fx-composer.js');
  assert.ok(x>0);
  assert.ok(x<page.indexOf('metaphor-visuals.js'));
  assert.ok(x<page.indexOf('skill-visuals.js'));
  assert.ok(page.includes('skill-visuals.js?v=multidomain-color1'));
 }
 const skill=read('skill-visuals');
 assert.match(skill,/MetaphorVisuals\?\.paint/);
 const lab=read('studio-pinball-lab');
 assert.match(lab,/visual:fx\.a\.visual/);
 const pvpCode=read('pvp-runtime');
 assert.match(pvpCode,/effect\.visual/);
});
test('fuzz different fantasy image combinations without unbounded descriptors',()=>{
 const g=boot(),terms=['검은 번개','은하수 꽃잎','얼음 가시','불꽃 소용돌이',
 '피의 사슬','거미줄','파도','뱀처럼 휘감다','찢어지는 우주','암흑 장미'];
 for(let i=0;i<240;i++){
  const phrase=terms[i%10]+'이 '+terms[(i*7+3)%10]+'처럼 '+terms[(i*5+1)%10]+' 폭발한다';
  const generated=g.SkillSentenceEngine.parse(phrase);
  if(!generated.ok)continue;
  for(const r of generated.recipe.rules){
   const actions=r.steps?.length?r.steps.filter(s=>s.kind==='cast').map(s=>s.action):[r.action];
   for(const a of actions){
    assert.ok(g.SkillForge.TYPE[a.type]);
    if(a.visual){
     assert.ok((a.visual.layers||[]).length<=5);
     assert.ok((a.visual.layers||[]).every(v=>Object.hasOwn(g.SkillFXComposer.KINDS,v.kind)));
    }
   }
  }
 }
});
