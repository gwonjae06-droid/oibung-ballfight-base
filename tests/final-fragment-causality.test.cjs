'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=name=>fs.readFileSync('js/features/'+name+'.js','utf8');
function boot(files){
 const g={console,Math,Date,Map,Set,WeakMap,players:[],CUSTOM_DEFS:[],
  BEHAVIORS:{},CHARACTER_PHOTOS:{},canvas:{width:480,height:320},
  createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of files)vm.runInContext(src(file),g,{filename:file+'.js'});
 return g;
}
const parser=['action-registry','semantic-physics','physics-law-engine',
 'signature-program','skill-fx-composer','metaphor-visuals','skill-color-policy',
 'semantic-concept-atlas','concept-fusion','imagination-concepts',
 'semantic-intent-composer','signature-scratch','fantasy-skill-graph',
 'signature-rule-skill','skill-ir','signature-rule-live','korean-skill-grammar',
 'korean-skill-parameters','signature-prompt-compiler',
 'semantic-relationship-graph','skill-sentence-engine'];
const sentence='붉은 얼음 투사체가 적에게 명중하면 세 조각으로 분열하고 마지막 파편이 사라지면 주변에 폭발을 일으킨다';
const timed='붉은 투사체가 공중에서 분열하여 파편이 되고 모든 파편이 소멸하면 폭발한다';
const action=g=>g.SkillSentenceEngine.parse(sentence).recipe.rules[0].action;
function scenario(g,a){
 const p={playerNum:1,x:95,y:160,radius:20,hp:220,maxHp:220,
  forge:{signatureVersion:1,color:'#abcfee',effectColor:'#abcfee'},
  _forgeActionClock:1,_forgeBalanceFrame:1,
  forgeShots:[{x:148,y:160,prevX:148,prevY:160,vx:6,vy:0,z:0,life:100,a,
   targetNum:2}],forgeZones:[],forgeOrbs:[]};
 const e={playerNum:2,x:164,y:160,radius:20,hp:200,maxHp:200,
  invincible:0,vx:0,vy:0};
 const nearby={playerNum:3,x:188,y:155,radius:20,hp:200,maxHp:200,
  invincible:0,vx:0,vy:0};
 const far={playerNum:4,x:450,y:260,radius:15,hp:200,maxHp:200,
  invincible:0,vx:0,vy:0};
 return {p,e,nearby,far,foes:[e,nearby,far]};
}
test('Korean last-fragment expiry is a real post-fracture physical trigger',()=>{
 const g=boot(parser),r=g.SkillSentenceEngine.parse(sentence);
 assert.equal(r.ok,true,r.error);
 assert.equal(r.method,'offline-verb-first-semantic-composer');
 assert.equal(r.recipe.rules.length,1);
 const a=r.recipe.rules[0].action;
 assert.equal(a.type,'shot');
 assert.equal(a.fusion.split,true);
 assert.equal(a.fusion.splitTrigger,'hit');
 assert.equal(a.fusion.finalBurst,true);
 assert.equal(a.fusion.fragments,3);
 assert.equal(a.count,1,'three pieces must not spawn three source shots');
 assert.equal(a.fusion.impact,'none','final detonation is not the source hit');
 assert.equal(a.visual.colorMode,'explicit');
 assert.equal(a.visual.color,'#ff454f');
 assert.ok(r.semanticVerification.matched.includes('terminalBurst'));
 assert.equal(r.semanticVerification.missing.length,0,JSON.stringify(r.semanticVerification));
 assert.ok(r.semanticGraph.relations.some(e=>e.type==='when_all_retired'));
 assert.ok(r.semanticGraph.relations.some(e=>e.type==='confirmed_area_damage'));
 assert.ok(r.summary[0].fusion.includes('마지막 파편'));
});
test('one final AoE follows the LAST projectile retirement and truly damages near foes',()=>{
 const g=boot([...parser,'forge-expansion','skill-forge-impact','skill-forge-world']);
 const a=action(g),{p,e,nearby,far,foes}=scenario(g,a);
 const fx=[];g.BattleFX={cast(_p,name,options){fx.push({name,...options});},
  mark(name,x,y,color,radius){fx.push({name,x,y,color,radius});}};
 const impact=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),enemies:()=>foes});
 const world=g.SkillForgeWorldFactory({hit:impact.hit,hitGround:impact.hitGround,enemies:()=>foes});
 world.tick(p,e);
 assert.equal(p.forgeShots.length,3,'source must split only after confirmed hit');
 assert.ok(p.forgeShots.every(b=>b._fusionChild&&b._fusionTerminalGroup));
 assert.equal(p.forgeShots[0]._fusionTerminalGroup.remaining,3);
 const oldNearby=nearby.hp;
 // Two children retire first, leaving the third alive. No visual burst
 // can arise from the original impact or just the first two expiries.
 p._forgeActionClock=28;p._forgeBalanceFrame=28;
 for(let i=0;i<p.forgeShots.length;i++){
  const b=p.forgeShots[i];b.x=i===0?154:310+i*45;
  b.y=i===0?160:245;b.vx=0;b.vy=0;
  b.life=i===0?99:1;
 }
 world.tick(p,e);
 assert.equal(p.forgeShots.length,1);
 assert.equal(nearby.hp,oldNearby);
 assert.equal(p._scratchEvents?.finalFragment?.count||0,0);
 p._forgeActionClock=55;p._forgeBalanceFrame=55;
 p.forgeShots[0].life=1;
 e.invincible=0;nearby.invincible=0;
 world.tick(p,e);
 assert.equal(p.forgeShots.length,0);
 assert.equal(p._scratchEvents.finalFragment.count,1);
 assert.ok(nearby.hp<oldNearby,'real area resolver must lower HP');
 assert.equal(far.hp,200,'out-of-range victim must not take damage');
 assert.ok(fx.some(x=>x.name==='wave'&&x.color==='#ff454f'));
 assert.ok(fx.some(x=>x.name==='wave'&&Math.abs(x.x-154)<2),'blast centered on last child, not caster');
 world.tick(p,e);
 assert.equal(p._scratchEvents.finalFragment.count,1,'must not refire without remaining children');
});
test('guarded targets remain immune to terminal AoE and cannot trigger hit-splitting',()=>{
 const g=boot([...parser,'forge-expansion','skill-forge-impact','skill-forge-world']);
 const a=action(g),{p,e,nearby,foes}=scenario(g,a);
 const impact=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),enemies:()=>foes});
 const world=g.SkillForgeWorldFactory({hit:impact.hit,hitGround:impact.hitGround,enemies:()=>foes});
 e.invincible=999;
 world.tick(p,e);
 assert.equal(e.hp,200);
 assert.equal(p.forgeShots.length,1);
 assert.equal(p._scratchEvents?.finalFragment?.count||0,0);
 // A later confirmed source hit may split, but a shielded bystander
 // still cannot be damaged by the resulting final-area burst.
 e.invincible=0;p._forgeActionClock=2;p._forgeBalanceFrame=2;
 world.tick(p,e);
 assert.equal(p.forgeShots.length,3);
 nearby.invincible=999;
 for(const b of p.forgeShots){b.life=1;b.vx=0;b.vy=0;}
 p._forgeActionClock=35;p._forgeBalanceFrame=35;
 world.tick(p,e);
 assert.equal(nearby.hp,200);
 assert.equal(p._scratchEvents.finalFragment.count,1);
});
test('old time-split profiles never gain a terminal explosion or extra damage',()=>{
 const g=boot(['action-registry','concept-fusion','skill-forge-world']);
 const fusion=g.ConceptFusion.normalize({form:'projectile',split:true,fragments:3});
 assert.equal(fusion.finalBurst,undefined);
 const a={type:'shot',damage:25,speed:6,status:'none',fusion};
 const {p,e,foes}=scenario(g,a);
 p.forgeShots[0].x=40;p.forgeShots[0].y=45;p.forgeShots[0].vx=1;
 let finalHits=0;g.BattleFX={cast(_p,type){if(type==='wave')finalHits++;}};
 const world=g.SkillForgeWorldFactory({hit:()=>false,hitGround:()=>false,enemies:()=>foes});
 for(let i=0;i<12;i++)world.tick(p,e);
 assert.equal(p.forgeShots.length,3);
 for(const b of p.forgeShots){b.life=1;b.vx=0;b.vy=0;}
 world.tick(p,e);
 assert.equal(finalHits,0);
});
test('terminal event does not fire when a hit-triggered orb never hits',()=>{
 const g=boot(['action-registry','concept-fusion','skill-forge-world']);
 const fusion=g.ConceptFusion.normalize({split:true,splitTrigger:'hit',
  finalBurst:true,fragments:3});
 const a={type:'shot',damage:25,speed:6,status:'none',fusion};
 const {p,e,foes}=scenario(g,a);
 p.forgeShots[0].life=1;
 let bursts=0;g.BattleFX={cast(){bursts++;},mark(){}};
 const world=g.SkillForgeWorldFactory({hit:()=>false,hitGround:()=>false,enemies:()=>foes});
 world.tick(p,e);
 assert.equal(p.forgeShots.length,0);
 assert.equal(bursts,0,'no shard family was ever spawned');
});
test('blocked child retirements still release final burst once, without phantom child hits',()=>{
 const g=boot(['action-registry','concept-fusion','skill-forge-world']);
 const fusion=g.ConceptFusion.normalize({split:true,fragments:3,finalBurst:true,radius:80});
 const a={type:'shot',damage:28,speed:6,status:'none',fusion};
 const {p,e,foes}=scenario(g,a);
 let marks=0,contacts=0;
 g.BattleFX={cast(_p,type){if(type==='wave')marks++;}};
 const world=g.SkillForgeWorldFactory({hit:(_p,_e,a)=>{contacts++;return false;},
  hitGround:()=>false,enemies:()=>foes});
 p.forgeShots[0].x=60;p.forgeShots[0].vx=1;
 for(let i=0;i<12;i++)world.tick(p,e);
 assert.equal(p.forgeShots.length,3);
 g.AdvancedCombat={blockSegment:()=>true};
 world.tick(p,e);
 assert.equal(p.forgeShots.length,0);
 assert.equal(marks,1);
 assert.ok(contacts<=3,'obstacles prevent child collision checks');
});
test('IR v1 and compact PvP v3 preserve optional finalBurst without changing old packets',()=>{
 const g=boot([...parser,'pvp-original-engine']);const parsed=g.SkillSentenceEngine.parse(sentence);
 const a=parsed.recipe.rules[0].action;
 const ir=g.SkillIR.fromRecipe(parsed.recipe);
 assert.equal(g.SkillIR.toRecipe(ir).rules[0].action.fusion.finalBurst,true);
 const create=action=>({id:'custom',name:'Fusion',forgeData:{
  signatureVersion:1,hp:220,speed:2,color:'#aa66ff',effectColor:'#aa66ff',
  allAbilities:false,skills:[{name:'파편 폭발',trigger:'auto',cooldown:5,threshold:40,
   actions:[action],ruleSet:{window:10,rules:[{when:'pulse',interval:1,action}]}}]}});
 const packed=g.PvpOriginalEngine.pack(create(a));
 const unpacked=g.PvpOriginalEngine.unpack(packed);
 assert.ok(JSON.stringify(packed).length<2380);
 assert.equal(unpacked.skills[0].ruleSet.rules[0].action.fusion.finalBurst,true);
 assert.equal(unpacked.skills[0].actions[0].fusion.finalBurst,true);
 const old={...a,fusion:g.ConceptFusion.normalize({...a.fusion,finalBurst:false})};
 const restored=g.PvpOriginalEngine.unpack(g.PvpOriginalEngine.pack(create(old)));
 assert.equal(restored.skills[0].ruleSet.rules[0].action.fusion.finalBurst,undefined);
 assert.equal(restored.skills[0].actions[0].fusion.splitTrigger,'hit');
 assert.equal(g.ConceptFusion.normalize({finalBurst:true,split:false}),undefined);
});
test('mini pinball preview shows terminal burst after all real practice fragments retire',()=>{
 const g=boot([...parser,'arena-body-physics','studio-pinball-lab']);
 const r=g.SkillSentenceEngine.parse(timed);assert.equal(r.ok,true,r.error);
 assert.equal(r.recipe.rules[0].action.fusion.finalBurst,true);
 const profile={name:'나비탄',color:'#6c88ff',effectColor:'#ff454f',
  signatureVersion:1,skills:[{name:'마지막 파편',trigger:'auto',
   actions:[r.recipe.rules[0].action],ruleSet:r.recipe}]};
 const lab=g.StudioPinballLab.make(profile);
 lab.fire();lab.advanceTo(5000);
 assert.ok(lab.terminalBurstEvents>=1,'final blast must be visible in the lab');
 assert.ok(lab.terminalBurstHistory.length>=1);
 const [b]=lab.terminalBurstHistory;
 assert.ok(b.x>=0&&b.x<=480&&b.y>=0&&b.y<=300);
});
test('negative last-fragment sentences never silently acquire final burst',()=>{
 const g=boot(parser);
 for(const sentence of [
  '투사체가 분열하지만 마지막 파편이 사라져도 폭발하지 않는다',
  '투사체가 분열하고 마지막 파편이 맞으면 폭발한다'
 ]){
  const result=g.SkillSentenceEngine.parse(sentence);
  const actions=result.recipe?.rules?.map(x=>x.action)||[];
  assert.ok(!actions.some(x=>x.fusion?.finalBurst),sentence);
 }
});
