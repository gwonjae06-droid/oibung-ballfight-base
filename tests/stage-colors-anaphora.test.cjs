'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync('js/features/'+name+'.js','utf8');
function boot(files){
 const g={console,Math,Date,Map,Set,WeakMap,players:[],CUSTOM_DEFS:[],
  BEHAVIORS:{},CHARACTER_PHOTOS:{},canvas:{width:480,height:320},
  createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of files)vm.runInContext(read(file),g,{filename:file+'.js'});
 return g;
}
const parser=['action-registry','semantic-physics','physics-law-engine',
 'signature-program','skill-fx-composer','metaphor-visuals','skill-color-policy',
 'semantic-concept-atlas','concept-fusion','imagination-concepts',
 'semantic-intent-composer','signature-scratch','signature-live','fantasy-skill-graph',
 'signature-rule-skill','skill-ir','signature-rule-live','korean-skill-grammar',
 'korean-skill-parameters','signature-prompt-compiler',
 'semantic-relationship-graph','skill-sentence-engine'];
const sentence='파란색 투사체가 적에게 명중하면 붉은색 파편 세 조각으로 분열하고 그 파편들은 적을 추적하다 모두 사라지면 보라색 폭발한다';
function parsed(g,raw=sentence){
 const r=g.SkillSentenceEngine.parse(raw);
 assert.equal(r.ok,true,r.error);
 return {r,a:r.recipe.rules[0].action};
}
test('Korean source, actual shards, and final burst retain three different explicit palettes',()=>{
 const g=boot(parser),{r,a}=parsed(g);
 assert.equal(a.type,'shot');
 assert.equal(a.fusion.split,true);
 assert.equal(a.fusion.splitTrigger,'hit');
 assert.equal(a.fusion.fragments,3);
 assert.equal(a.count,1,'three SHARDS are not three launched source shots');
 assert.equal(a.fusion.finalBurst,true);
 assert.equal(a.fusion.homing,false,'the root projectile is not the referent');
 assert.equal(a.fusion.childHoming,true,'only emitted physical children home');
 assert.equal(a.visual.colorMode,'explicit');
 assert.equal(a.visual.color,'#276df0');
 assert.equal(a.fusion.childColor,'#ff454f');
 assert.equal(a.fusion.finalColor,'#a855f7');
 assert.equal(r.stageColors.source.color,'#276df0');
 assert.equal(r.stageColors.fragment.color,'#ff454f');
 assert.equal(r.stageColors.terminal.color,'#a855f7');
 assert.equal(r.colorPriority,'phase-specific');
 assert.ok(r.semanticVerification.matched.includes('homing'));
 assert.equal(r.semanticVerification.missing.length,0,
  JSON.stringify(r.semanticVerification));
 assert.ok(r.semanticGraph.references.some(x=>x.resolved&&
  x.binding==='actual_child_projectiles'&&x.text.includes('그 파편')));
 assert.ok(r.semanticGraph.actions.some(x=>x.childOnlyHoming&&
  x.childColor==='#ff454f'&&x.finalColor==='#a855f7'));
 assert.ok(r.semanticGraph.relations.some(x=>x.type==='resolved_reference'));
});
test('the actual root flies straight; spawned children turn toward target and wear shard hue',()=>{
 const g=boot([...parser,'skill-forge-world']),{a}=parsed(g);
 const p={playerNum:1,x:60,y:120,hp:250,
  forge:{color:'#aaaaaa',effectColor:'#aaaaaa'},
  forgeShots:[{x:95,y:120,vx:6,vy:0,life:100,a,targetNum:2}],
  forgeZones:[],forgeOrbs:[]};
 const e={playerNum:2,x:240,y:180,radius:18,hp:250};
 const fx=[];g.BattleFX={mark(_kind,x,y,color){fx.push({x,y,color});}};
 let confirmed=false;
 const world=g.SkillForgeWorldFactory({hit:()=>confirmed,
  hitGround:()=>false,enemies:()=>[e]});
 world.tick(p,e);
 assert.equal(p.forgeShots.length,1);
 assert.equal(p.forgeShots[0].vy,0,'root should not chase before fracture');
 confirmed=true;e.x=115;e.y=120;
 world.tick(p,e);
 assert.equal(p.forgeShots.length,3);
 assert.ok(p.forgeShots.every(b=>b._fusionChild&&b.a.fusion.homing===true));
 assert.ok(p.forgeShots.every(b=>b.a.visual.color==='#ff454f'));
 assert.ok(p.forgeShots.every(b=>b.a.visual.colorMode==='explicit'));
 const old=p.forgeShots.map(b=>b.vy);
 e.x=200;e.y=240;confirmed=false;
 world.tick(p,e);
 assert.ok(p.forgeShots.some((b,i)=>b.vy!==old[i]));
});
test('the LAST real child expiry causes precisely one violet impact, not a root or red shard burst',()=>{
 const g=boot([...parser,'skill-forge-world']);
 const {a}=parsed(g);
 const p={playerNum:1,x:90,y:100,hp:200,
  forge:{color:'#aaaaaa',effectColor:'#aaaaaa'},
  forgeShots:[{x:100,y:100,vx:5,vy:0,life:100,a,targetNum:2}],
  forgeZones:[],forgeOrbs:[],_forgeActionClock:1};
 const e={playerNum:2,x:110,y:100,radius:20,hp:300};
 const effects=[];let confirmed=true;
 g.BattleFX={cast(_p,type,opts){effects.push({type,...opts});},mark(){}};
 const world=g.SkillForgeWorldFactory({hit:()=>confirmed,
  hitGround:()=>false,enemies:()=>[e]});
 world.tick(p,e);
 assert.equal(p.forgeShots.length,3);
 assert.equal(effects.length,0);
 confirmed=false;
 p._forgeActionClock=30;
 p.forgeShots.forEach((b,i)=>{b.life=i===0?70:1;
  b.x=400+i*5;b.y=250;b.vx=0;b.vy=0;});
 world.tick(p,e);
 assert.equal(effects.length,0);
 assert.equal(p.forgeShots.length,1);
 p._forgeActionClock=55;
 p.forgeShots[0].life=1;
 p.forgeShots[0].x=201;p.forgeShots[0].y=138;
 world.tick(p,e);
 assert.equal(p.forgeShots.length,0);
 assert.equal(effects.length,1);
 assert.equal(effects[0].type,'wave');
 assert.equal(effects[0].color,'#a855f7');
 assert.ok(Math.abs(effects[0].x-201)<15,
  'the last homing child travels during its final physical tick');
 assert.ok(Math.abs(effects[0].x-p.x)>40,'explosion must not be centered on caster');
 world.tick(p,e);assert.equal(effects.length,1);
});
test('old single-color skills and explicit origin hue remain backwards-compatible',()=>{
 const g=boot(parser);
 const single=parsed(g,'붉은 얼음 투사체가 명중하면 세 조각으로 분열하고 마지막 파편이 소멸하면 폭발한다');
 assert.equal(single.a.visual.color,'#ff454f');
 assert.equal(single.a.fusion.childColor,undefined);
 assert.equal(single.a.fusion.finalColor,undefined);
 const onlyChild=parsed(g,
  '투사체가 적에게 닿으면 초록색 파편으로 분열하고 마지막 파편이 소멸하면 폭발한다');
 assert.equal(onlyChild.a.visual.colorMode,'inherit');
 assert.equal(onlyChild.a.fusion.childColor,'#4ade80');
 assert.equal(onlyChild.a.fusion.finalColor,undefined);
 assert.equal(g.SkillColorPolicy.explicit('검은 레일건을 발사한다').color,'#101827');
 assert.equal(g.SkillColorPolicy.stages('은색 파편으로 분열한다').fragment.color,'#9ca3af');
});
test('an orphan demonstrative does not invent earlier physical shards',()=>{
 const g=boot(parser);
 for(const raw of ['그 파편들이 적을 추적한다',
  '남은 조각들이 마지막으로 사라지면 폭발한다']){
  const r=g.SkillSentenceEngine.parse(raw);
  assert.equal(r.ok,false,raw);
  assert.match(r.error,/파편 생성 단계/);
 }
});
test('multiple generated fragment families are ambiguous until disambiguated',()=>{
 const g=boot(parser);
 const {a}=parsed(g);
 const recipe=g.SignatureRuleSkill.normalize({window:10,rules:[
  {when:'pulse',interval:2,action:a},
  {when:'pulse',interval:2,action:a}]});
 const graph=g.SemanticRelationshipGraph.build('두 분열탄을 만들고 그 파편들이 적을 추적한다',recipe);
 assert.ok(graph.references.length>0);
 assert.ok(graph.references.every(ref=>ref.resolved===false&&ref.target===null));
 const one=g.SemanticRelationshipGraph.build(sentence,{...recipe,rules:recipe.rules.slice(0,1)});
 assert.ok(one.references.some(ref=>ref.resolved));
});
test('PvP packet roundtrip preserves childOnly targeting and each color without altering old slots',()=>{
 const g=boot([...parser,'pvp-original-engine']),{r,a}=parsed(g);
 const fighter=action=>({id:'custom',name:'삼색 파편탄',
  forgeData:{signatureVersion:1,hp:250,speed:2,color:'#aa99cc',
   effectColor:'#aaaaaa',allAbilities:false,skills:[{
    name:'삼색탄',trigger:'auto',cooldown:5,threshold:30,
    actions:[action],ruleSet:{window:10,
     rules:[{when:'pulse',interval:1,action}]}}]}});
 const packet=g.PvpOriginalEngine.pack(fighter(a));
 assert.ok(JSON.stringify(packet).length<2380);
 const packedFusion=packet.f[5][0][4][0][13];
 assert.equal(packedFusion.length,12);
 const restored=g.PvpOriginalEngine.unpack(packet).skills[0].ruleSet.rules[0].action;
 assert.equal(restored.fusion.childColor,'#ff454f');
 assert.equal(restored.fusion.finalColor,'#a855f7');
 assert.equal(restored.fusion.childHoming,true);
 assert.equal(restored.fusion.homing,false);
 assert.equal(restored.visual.color,'#276df0');
 const fromIR=g.SkillIR.toRecipe(g.SkillIR.fromRecipe(r.recipe));
 assert.equal(fromIR.rules[0].action.fusion.childHoming,true);
 const legacy={...a,fusion:{...a.fusion,childColor:undefined,finalColor:undefined,
  childHoming:undefined}};
 const old=g.PvpOriginalEngine.pack(fighter(legacy));
 assert.equal(old.f[5][0][4][0][13].length,9);
});
test('invalid phase colors never enter saved physics or online compact packets',()=>{
 const g=boot(['concept-fusion','pvp-original-engine']);
 const f=g.ConceptFusion.normalize({split:true,finalBurst:true,
  childColor:'javascript:alert(1)',finalColor:'red',
  childHoming:true});
 assert.equal(f.childColor,undefined);
 assert.equal(f.finalColor,undefined);
 assert.equal(f.childHoming,true);
 const s=g.SkillColorPolicy;
 assert.equal(s,undefined);
});
test('mini pinball sandbox inherits all three stage colors from the saved recipe',()=>{
 const g=boot([...parser,'arena-body-physics','studio-pinball-lab']);
 const {r,a}=parsed(g,
  '파란색 투사체가 공중에서 붉은색 파편으로 분열하고 모든 파편이 사라지면 보라색 폭발한다');
 const profile={name:'삼색탄',color:'#444444',effectColor:'#eeeeee',
  signatureVersion:1,skills:[{name:'삼색 파편탄',trigger:'auto',
   actions:[a],ruleSet:r.recipe}]};
 const lab=g.StudioPinballLab.make(profile);
 lab.fire();lab.advanceTo(5000);
 assert.ok(lab.terminalBurstEvents>=1);
 assert.ok(lab.terminalBurstHistory.some(x=>x.color==='#a855f7'));
 assert.ok(read('studio-pinball-lab').includes('color:childColor||b.color'));
 assert.ok(read('skill-forge').includes('ink.fillStyle=shotColor'));
});
