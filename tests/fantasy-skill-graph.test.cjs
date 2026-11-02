'use strict';
/* FantasySkillGraph validates and executes the SAME declarative stages in
 * SignatureRuleLive; StudioPinballLab and SkillForgeCasting share that runner.
 */
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'../js/features',n+'.js'),'utf8');
function boot(){
 const names={wave:'파동',shot:'탄환',slash:'베기',beam:'광선',
  summon:'소환',shield:'방어막',haste:'가속'};
 const g={Math,Number,Date,console,SkillForge:{TYPE:names,
  STATUS:{none:'없음',ice:'빙결',fire:'화염',poison:'독'}},
  ActionRegistry:{TYPE:names}};
 g.window=g;g.globalThis=g;
 vm.createContext(g);
 for(const file of ['signature-program','metaphor-visuals','signature-scratch',
   'fantasy-skill-graph','signature-rule-skill','signature-rule-live',
   'signature-prompt-compiler'])vm.runInContext(read(file),g,{filename:file});
 return g;
}
const action=(type='slash')=>({type,damage:20,radius:120,count:1,speed:5,
 duration:1.5,status:'none',target:'nearest',pattern:'direct'});
test('safe graph supports morph -> damage modifier -> cast -> wait -> repeated casts -> condition',()=>{
 const g=boot();
 const plan=[
  {kind:'morph',visual:{shape:'jaw',color:'#432052',scale:2.2,charge:false}},
  {kind:'tune',field:'damage',operator:'multiply',value:1.5},
  {kind:'cast',action:action()},
  {kind:'wait',seconds:.5},
  {kind:'repeat',times:2,body:[{kind:'cast',action:action('shot')}]},
  {kind:'if',condition:'near',then:[{kind:'cast',action:action('beam')}],else:[]}
 ];
 const g0=g.FantasySkillGraph;
 const normalized=g0.normalize(plan);
 assert.equal(g0.count(normalized),4);
 const hero={hp:200,maxHp:200,x:20,y:20,_scratchEvents:{}},foe={hp:200,x:30,y:20};
 const run=g.SignatureRuleLive.begin({window:6,rules:[{
  when:'pulse',interval:4,action:action(),steps:normalized}]},hero);
 const events=[];
 for(let i=0;i<70;i++){
  const a=g.SignatureRuleLive.step(run,hero,foe);
  if(a)events.push({tick:i+1,action:a});
 }
 assert.equal(events.length,4);
 assert.deepEqual(events.map(x=>x.action.type),['slash','shot','shot','beam']);
 assert.equal(events[0].action.damage,30);
 assert.equal(events[0].action.visual.shape,'jaw');
 assert.equal(events[1].action.damage,30,'temporary tuning applies to graph sequence');
 assert.ok(events[1].tick-events[0].tick>=30,'explicit graph wait survives 60Hz');
 assert.equal(run.actions,4);
});
test('graph forbids executable code and bounds nested repeats/actions and numeric parameters',()=>{
 const g=boot(),S=g.FantasySkillGraph;
 const dirty=[{kind:'eval',src:'window.hacked=true'},
  {kind:'repeat',times:1000,body:[{kind:'repeat',times:1000,body:[
   {kind:'cast',action:{type:'not-a-real-type',damage:999999}},
   {kind:'tune',field:'constructor',operator:'set',value:1000000}]}]}];
 const clean=S.normalize(dirty);
 assert.equal(clean.length,1);
 assert.equal(clean[0].times,4);
 assert.ok(S.count(clean)<=S.MAX_CASTS);
 const queued=S.compile(clean,null,null);
 assert.ok(queued.length<=S.MAX_PENDING);
 assert.ok(queued.every(x=>x.kind!=='eval'));
 assert.ok(queued.some(x=>x.action?.type==='wave'));
 assert.ok(queued.every(x=>!Object.hasOwn(x,'src')));
 const tuned=S.applyTune(action(),{kind:'tune',field:'damage',operator:'multiply',value:1000});
 assert.equal(tuned.damage,120);
});
test('metaphor sentence generates a sequential multi-stage graph, not two simultaneous attacks',()=>{
 const g=boot();
 const result=g.SignaturePromptCompiler.parse('거대한 턱으로 후려치고 그리고 검은 멘헤라빔을 발사한다');
 assert.equal(result.ok,true);
 assert.ok(result.recipe.rules[0].steps?.length>=4,
  'the sentence should compile to a graph of morphed actions');
 const steps=result.recipe.rules[0].steps;
 assert.deepEqual(Array.from(steps.filter(s=>s.kind==='cast'),s=>s.action.type),['slash','beam']);
 assert.equal(steps[0].kind,'morph');
 assert.equal(steps[2].kind,'morph');
 const p={hp:200,maxHp:200,x:0,y:0,_scratchEvents:{}},t={hp:200,x:50,y:0};
 const run=g.SignatureRuleLive.begin(result.recipe,p),cast=[];
 for(let i=0;i<5;i++){const a=g.SignatureRuleLive.step(run,p,t);if(a)cast.push(a);}
 assert.deepEqual(cast.map(a=>a.type),['slash','beam']);
 assert.equal(cast[0].visual.shape,'jaw');
 assert.equal(cast[1].visual.shape,'beam');
});
test('conditional wall and collision sentence remains reactive rather than a blind combo',()=>{
 const g=boot();
 const r=g.SignaturePromptCompiler.parse('벽에 튕기면 가속하고 상대와 충돌하면 충격파');
 assert.equal(r.ok,true);
 assert.ok(!r.recipe.rules.some(x=>x.steps?.length));
 assert.ok(r.recipe.rules.some(x=>x.when==='wall'));
 assert.ok(r.recipe.rules.some(x=>x.when==='contact'));
});
test('PvP serialization roundtrip retains bounded graph including nested conditional nodes',()=>{
 const g=boot();vm.runInContext(read('pvp-original-engine'),g,{filename:'pvp-original-engine'});
 const steps=[{kind:'morph',visual:{shape:'jaw',color:'#432052',scale:2,charge:true}},
  {kind:'cast',action:action('slash')},{kind:'wait',seconds:.2},
  {kind:'repeat',times:2,body:[{kind:'cast',action:action('shot')}]}];
 const skill={name:'턱 연격',trigger:'auto',cooldown:3,threshold:30,
  actions:[action('slash')],ruleSet:{window:7,rules:[
   {when:'pulse',interval:2,fracture:1,action:action('slash'),steps}]}};
 const p={id:'fighter',name:'상상',forgeData:{hp:250,speed:2,color:'#777777',
  effectColor:'#888888',signatureVersion:1,allAbilities:false,skills:[skill]}};
 const packed=g.PvpOriginalEngine.pack(p);
 assert.ok(JSON.stringify(packed).length<2380);
 const unpack=g.PvpOriginalEngine.unpack(packed);
 const got=unpack.skills[0].ruleSet.rules[0].steps;
 assert.equal(got[0].visual.shape,'jaw');
 assert.equal(got[3].times,2);
 assert.equal(got[3].body[0].action.type,'shot');
});
test('Tower blessings propagate into actual graph cast nodes',()=>{
 const g=boot();vm.runInContext(read('tower-realms'),g,{filename:'tower-realms'});
 const rule={when:'pulse',interval:2,action:action('wave'),
  steps:[{kind:'cast',action:action('wave')},{kind:'repeat',times:2,
   body:[{kind:'cast',action:action('shot')}]}]};
 const fighter={hp:250,maxHp:250,forge:{skills:[{actions:[action()],ruleSet:{window:6,rules:[rule]}}]}};
 g.ArenaTowerRealms.apply(fighter,'fire',['echo','element']);
 const steps=fighter.forge.skills[0].ruleSet.rules[0].steps;
 assert.equal(steps[0].action.status,'fire');
 assert.equal(steps[1].body[0].action.status,'fire');
 assert.ok(steps[1].body[0].action.damage>20);
});
test('graph editor and client load order carry entire authored graph into the battle',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const pvp=fs.readFileSync(path.join(__dirname,'../pvp-runtime.html'),'utf8');
 for(const s of [html,pvp]){
  assert.ok(s.includes('fantasy-skill-graph.js'));
  assert.ok(s.indexOf('fantasy-skill-graph.js')<s.indexOf('signature-rule-skill.js'));
 }
 const code=read('signature-rule-studio');
 assert.match(code,/data-step-field="type"/);
 assert.match(code,/graph-add/);
 assert.match(code,/graph-wait/);
 assert.match(code,/graph-if/);
 assert.match(code,/graph-repeat/);
 const lab=read('studio-pinball-lab');
 assert.match(lab,/SignatureRuleLive\?\.step/);
 const casting=read('skill-forge-casting');
 assert.match(casting,/SignatureRuleLive\?\.step/);
});

test('the miniature uses real hero and opponent coordinates for graph near conditions',()=>{
 const g=boot();vm.runInContext(read('studio-pinball-lab'),g,{filename:'studio-pinball-lab'});
 const nearRule={when:'pulse',interval:3,action:action('wave'),
  steps:[{kind:'if',condition:'near',then:[{kind:'cast',action:action('wave')}],else:[]}]};
 const character={signatureVersion:1,name:'근거리 환상',color:'#b19cff',
  skills:[{name:'근접 조건',trigger:'auto',cooldown:3,
   actions:[action('wave')],ruleSet:{window:5,rules:[nearRule]}}]};
 const lab=g.StudioPinballLab.make(character);
 const [hero,target]=lab.balls;
 target.x=hero.x+30;target.y=hero.y;
 lab.fire();lab.advanceTo(180);
 assert.ok(lab.ruleActions>=1,'near condition should fire in the same graph runtime as real combat');
});
