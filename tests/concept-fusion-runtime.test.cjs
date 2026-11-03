'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm');
const src=p=>fs.readFileSync('js/features/'+p+'.js','utf8');
function boot(files){
 const g={Math,Date,Number,Set,Map,WeakMap,console,
  players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:480,height:320},createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;
 vm.createContext(g);
 for(const file of files)vm.runInContext(src(file),g,{filename:file+'.js'});
 return g;
}
const parserFiles=['action-registry','semantic-physics','signature-program',
 'skill-fx-composer','metaphor-visuals','concept-fusion','signature-scratch',
 'fantasy-skill-graph','signature-rule-skill','skill-ir','signature-rule-live',
 'korean-skill-grammar','korean-skill-parameters','signature-prompt-compiler',
 'skill-sentence-engine'];
test('fire projectile combines element, motion and on-hit explosion in one executable object',()=>{
 const g=boot(parserFiles);
 const r=g.SkillSentenceEngine.parse('불꽃 투사체 3발이 적을 추적하고 명중하면 폭발한다');
 assert.equal(r.ok,true,r.error);
 const bullets=r.recipe.rules.filter(x=>x.action.type==='shot');
 assert.equal(bullets.length,1,JSON.stringify(r.recipe));
 const a=bullets[0].action;
 assert.equal(a.status,'fire');
 assert.equal(a.fusion.element,'fire');
 assert.equal(a.fusion.homing,true);
 assert.equal(a.fusion.impact,'burst');
 assert.equal(bullets[0].when,'pulse','payload on-hit cannot prevent initial launch');
 assert.ok(a.visual.layers.some(x=>x.kind==='embers'));
 assert.ok(a.visual.layers.some(x=>x.kind==='burst'));
 assert.equal(a.count,3);
 assert.ok(r.concepts.labels.some(x=>x==='화염'));
 assert.ok(r.summary.some(x=>x.fusion?.includes('충돌 폭발')));
});
test('gravity projectiles split into bounded seeking fragments with pull on contact',()=>{
 const g=boot(parserFiles);
 const r=g.SkillSentenceEngine.parse('중력으로 된 투사체 4발이 분열하고 각각 적을 추적한다');
 assert.equal(r.ok,true,r.error);
 const actions=r.recipe.rules.filter(x=>x.action.type==='shot');
 assert.equal(actions.length,1,JSON.stringify(r.recipe));
 const f=actions[0].action.fusion;
 assert.equal(f.element,'gravity');
 assert.equal(f.homing,true);
 assert.equal(f.split,true);
 assert.equal(f.fragments,4);
 assert.equal(f.impact,'pull');
 assert.equal(g.SkillIR.fromRecipe(r.recipe).events.length>0,true);
});
test('lightning tether is physical tether with lightning layers, not an extra bolt skill',()=>{
 const g=boot(parserFiles);
 const r=g.SkillSentenceEngine.parse('번개 사슬로 적을 묶어 끌어당긴다');
 assert.equal(r.ok,true,r.error);
 assert.ok(r.recipe.rules.some(x=>x.action.type==='tether'),JSON.stringify(r.recipe));
 assert.ok(!r.recipe.rules.some(x=>x.action.type==='bolt'));
 const tether=r.recipe.rules.find(x=>x.action.type==='tether').action;
 assert.equal(tether.fusion.element,'lightning');
 assert.ok(tether.visual.layers.some(x=>x.kind==='chains'));
 assert.ok(tether.visual.layers.some(x=>x.kind==='lightning'));
});
test('one ice arrow really carries slow status, while a separate verb stays separate',()=>{
 const g=boot(parserFiles);
 const r=g.SkillSentenceEngine.parse('얼음 화살을 발사한다');
 assert.equal(r.ok,true,r.error);
 const a=r.recipe.rules.find(x=>x.action.type==='shot')?.action;
 assert.ok(a);assert.equal(a.status,'ice');
 const next=g.SkillSentenceEngine.parse('얼음 화살을 발사하고 그 다음 방어막을 펼친다');
 assert.equal(next.ok,true,next.error);
 assert.ok(next.recipe.rules.some(x=>x.action.type==='shield'),'explicit follow-up action is not absorbed');
});
test('fusion is data-only and validates untrusted effects and huge child counts',()=>{
 const g=boot(parserFiles);
 const safe=g.SignatureScratch.safeAction({
  type:'shot',damage:900,visual:{shape:'aura',color:'<script>'},
  fusion:{element:'fire',form:'projectile',split:true,homing:true,
   fragments:1e9,impact:'eval(window)',radius:1e10}});
 assert.equal(safe.damage,120);
 assert.equal(safe.fusion.fragments,4);
 assert.equal(safe.fusion.impact,'none');
 assert.equal(safe.fusion.radius,160);
 assert.equal(g.ConceptFusion.normalize({impact:'__proto__',homing:false,split:false}),undefined);
 assert.equal(g.ConceptFusion.normalize({split:true,fragments:0}).fragments,2);
});
test('skill rule, IR and profile roundtrip retain the exact same hybrid physics',()=>{
 const g=boot([...parserFiles,'skill-forge-profiles']);
 const recipe=g.SkillSentenceEngine.parse('불꽃 투사체가 추적해 적에 닿으면 폭발한다').recipe;
 const ir=g.SkillIR.fromRecipe(recipe);
 const restored=g.SkillIR.toRecipe(ir);
 assert.equal(restored.rules[0].action.fusion.impact,'burst');
 const profiles=g.SkillForgeProfilesFactory({
  TYPE:g.ActionRegistry.TYPE,TRIGGER:{auto:'자동'},STATUS:{none:'없음',fire:'화상'},
  ACTION_PARAMETERS:g.ActionRegistry.ACTION_PARAMETERS,MOVEMENT_ONLY:g.ActionRegistry.MOVEMENT_ONLY});
 const p=profiles.normalize({signatureVersion:1,name:'개념법사',skills:[{
  name:'폭렬탄',actions:g.SignatureRuleSkill.preview(recipe),ruleSet:recipe,
  ir,trigger:'auto',cooldown:5}]});
 assert.equal(p.skills[0].ruleSet.rules[0].action.fusion.homing,true);
 assert.equal(p.skills[0].actions[0].fusion.impact,'burst');
 assert.equal(p.skills[0].ir.events[0].action.fusion.impact,'burst');
});
test('real projectile physics dynamically forks into homing fragments without recursion',()=>{
 const g=boot(['action-registry','concept-fusion','skill-forge-world']);
 const a={type:'shot',damage:32,radius:150,count:1,speed:6,knockback:0,
  status:'none',fusion:g.ConceptFusion.normalize({
   element:'gravity',form:'projectile',homing:true,split:true,fragments:3,impact:'pull'})};
 const p={x:20,y:60,forge:{color:'#ffffff',effectColor:'#ffffff'},
  playerNum:1,forgeShots:[{x:20,y:60,vx:6,vy:0,life:100,a,targetNum:2}],
  forgeZones:[],forgeOrbs:[]};
 const foe={playerNum:2,hp:500,x:260,y:130,radius:18,vx:0,vy:0};
 const world=g.SkillForgeWorldFactory({hit:()=>true,hitGround:()=>true,enemies:()=>[foe]});
 for(let i=0;i<12;i++)world.tick(p,foe);
 assert.equal(p.forgeShots.length,3);
 assert.ok(p.forgeShots.every(x=>x.a.fusion.homing&&!x.a.fusion.split&&x._fusionChild));
 const oldVy=p.forgeShots[0].vy;
 world.tick(p,foe);
 assert.ok(p.forgeShots[0].vy!==oldVy,'child orientation updates toward moving target');
 for(let i=0;i<14;i++)world.tick(p,foe);
 assert.ok(p.forgeShots.length<=3,'children do not recursively split');
});
test('confirmed hit causes bounded real AoE splash, and shielded hits do not trigger it',()=>{
 const g=boot(['action-registry','concept-fusion','skill-forge-impact']);
 const p={x:80,y:100,playerNum:1,forge:{color:'#aabbcc'},_forgeActionClock:1,
  _forgeBalanceFrame:1};
 const e={x:160,y:100,radius:20,hp:100,maxHp:100,invincible:0,vx:0,vy:0};
 const bystander={x:200,y:100,radius:20,hp:100,maxHp:100,invincible:0,vx:0,vy:0};
 const safe={x:174,y:120,radius:20,hp:100,maxHp:100,invincible:999,vx:0,vy:0};
 const hit=g.SkillForgeImpactFactory({MOVEMENT_ONLY:new Set(),enemies:()=>[e,bystander,safe]}).hit;
 const a={type:'shot',damage:40,knockback:0,status:'none',duration:1,
  fusion:g.ConceptFusion.normalize({element:'fire',homing:true,impact:'burst',radius:90})};
 assert.equal(hit(p,e,a),true);
 assert.ok(e.hp<100);
 assert.ok(bystander.hp<100,'real splash damage must reach a nearby enemy');
 assert.equal(safe.hp,100,'invulnerable bystander must be protected');
 const other={x:155,y:100,radius:20,hp:100,maxHp:100,invincible:999,vx:0,vy:0};
 const p2={...p,_forgeActionClock:2,_forgeBalanceFrame:2};
 assert.equal(hit(p2,other,a),false);
});
test('strong hybrid physics receives higher combat pressure and a softer damage multiplier',()=>{
 const g=boot(['action-registry','concept-fusion','arena-balance-formula']);
 const base={type:'shot',damage:40,count:1,radius:130,duration:2,status:'none'};
 const hybrid={...base,fusion:g.ConceptFusion.normalize({
  homing:true,split:true,fragments:4,impact:'burst',radius:120})};
 assert.ok(g.ArenaBalanceFormula.actionPressure(hybrid)>g.ArenaBalanceFormula.actionPressure(base)*3);
 const one={signatureVersion:1,skills:[{actions:[base]}]};
 const mixed={signatureVersion:1,skills:Array.from({length:12},()=>({actions:[hybrid]}))};
 assert.ok(g.ArenaBalanceFormula.summary(mixed,true).multiplier<
  g.ArenaBalanceFormula.summary(one,true).multiplier);
});
test('PvP compact profile format roundtrips fusion and older packets',()=>{
 const g=boot(['concept-fusion','pvp-original-engine']);
 const a={type:'shot',damage:34,radius:110,count:1,speed:6,status:'fire',
  fusion:{element:'fire',form:'projectile',homing:true,split:true,fragments:3,
   impact:'burst',radius:80}};
 const d={id:'custom',name:'융합법사',forgeData:{signatureVersion:1,
  hp:260,speed:2,color:'#aaaaff',effectColor:'#aaaaff',allAbilities:false,
  skills:[{name:'융합탄',trigger:'auto',cooldown:5,threshold:30,
   actions:[a],ruleSet:{version:1,window:9,rules:[{when:'pulse',interval:1,action:a}]}}]}};
 const packed=g.PvpOriginalEngine.pack(d);
 const saved=g.PvpOriginalEngine.unpack(packed);
 assert.equal(saved.skills[0].actions[0].fusion.impact,'burst');
 assert.equal(saved.skills[0].ruleSet.rules[0].action.fusion.split,true);
 const old={...a,fusion:undefined},legacy={...d,forgeData:{...d.forgeData,
  skills:[{name:'old',trigger:'auto',cooldown:3,actions:[old]}]}};
 assert.equal(g.PvpOriginalEngine.unpack(g.PvpOriginalEngine.pack(legacy)).skills[0].actions[0].fusion,undefined);
 assert.ok(JSON.stringify(packed).length<2380);
});
test('both browser entrypoints load one trusted fusion module before normalizing authored actions',()=>{
 for(const name of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(name,'utf8');
  assert.ok(html.includes('concept-fusion.js?v=1-hybrid-physics'));
  assert.ok(html.indexOf('concept-fusion.js')<html.indexOf('signature-scratch.js'));
  assert.ok(html.indexOf('concept-fusion.js')<html.indexOf('skill-forge-profiles.js'));
 }
 const mini=src('studio-pinball-lab');
 assert.match(mini,/b\.a\?\.fusion\?\.homing/);
 assert.match(mini,/recordRuleEvent\('split'\)/);
 assert.match(mini,/impact!==['"]none['"]/);
});
