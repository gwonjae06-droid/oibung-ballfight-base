'use strict';
/* Integration: the REAL SkillForge runtime saves a rule recipe, spends one
 * 100-momentum activation, and emits finite actions over simulation time. */
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../js/features',p+'.js'),'utf8');
function world(){
 const g={Math,Date,Number,Set,Map,WeakMap,console,players:[],CUSTOM_DEFS:[],
  CHARACTER_PHOTOS:{},BEHAVIORS:{},canvas:{width:500,height:500},
  createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(p){
   return g.players.find(e=>e!==p&&e.hp>0)||null;},
  ArenaScreenRouter:{active:'tower'}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const f of ['action-registry','forge-archetypes','signature-program','signature-scratch',
  'signature-live','signature-rule-skill','signature-rule-live','arena-balance-formula',
  'arena-balance','forge-expansion','bounce-momentum','arena-combat-v2',
  'arena-pinball-motion','arena-body-physics','tower-flat-arena',
  'skill-forge-impact','skill-forge-casting','skill-forge-world','skill-forge-profiles',
  'skill-forge-storage','skill-forge-executor','skill-forge'])
  vm.runInContext(read(f),g,{filename:f+'.js'});
 return g;
}
function make(g,ruleSet){
 const recipe=g.SignatureRuleSkill.normalize(ruleSet);
 return {signatureVersion:1,name:'반응 규칙 파이터',archetype:'melee',
  skills:[{name:'폭주 능력',trigger:'auto',cooldown:4,
   actions:g.SignatureRuleSkill.preview(recipe),ruleSet:recipe}]};
}
function spawn(g,recipe){
 const id=g.SkillForge.register(make(g,recipe));
 const hero=g.CUSTOM_DEFS.find(d=>d.id===id).createInstance(1);
 const bossId=g.SkillForge.register({name:'무반응 표적',hp:1500,speed:1,
  skills:[{name:'방어',trigger:'auto',cooldown:99,
   actions:[{type:'shield',duration:.2,damage:0}]}]},{towerEnemy:true});
 const boss=g.CUSTOM_DEFS.find(d=>d.id===bossId).createInstance(2);
 hero.x=200;hero.y=250;hero.vx=2;hero.vy=1;hero._bounceMomentum=100;
 boss.x=250;boss.y=250;boss.vx=0;boss.vy=0;
 g.players.splice(0,g.players.length,hero,boss);
 g.ArenaTower={active:true,state:{realm:'time',level:1,ancient:false}};
 return {hero,boss};
}
test('real Forge persists sentence recipes and repeatedly performs a wave during one energy activation',()=>{
 const g=world(),profile=make(g,{window:7,rules:[
  {when:'pulse',interval:.4,action:{type:'wave',radius:150,damage:20}}
 ]});
 const normalized=g.SkillForge.normalize(profile);
 assert.equal(normalized.skills[0].ruleSet.window,7);
 assert.equal(normalized.skills[0].ruleSet.rules[0].when,'pulse');
 const {hero,boss}=spawn(g,profile.skills[0].ruleSet);
 let lowest=boss.hp;
 for(let t=0;t<450;t++){
  g.ForgeExpansion.tick(hero);
  g.SkillForge.autoUpdate(hero,boss);
  lowest=Math.min(lowest,boss.hp);
 }
 assert.ok(hero._bounceCasts>=1,'one 100-energy activation occurs');
 assert.ok(hero.forgeRuleRun?.actions>=8,'live rules emit repeated actions over time');
 assert.ok(lowest<boss.maxHp,'the repeated wave actually hits an opponent');
 assert.equal(hero.forge.skills[0].ruleSet.rules[0].action.type,'wave');
});
test('repeated haste increases actual pinball cruise velocity, capped and temporary',()=>{
 const g=world(),config={window:12,rules:[
  {when:'pulse',interval:.4,action:{type:'haste',duration:1.5,damage:0}}
 ]};
 const {hero,boss}=spawn(g,config),baseline=g.ArenaPinballMotion.baseSpeed(hero);
 for(let t=0;t<240;t++){g.ForgeExpansion.tick(hero);g.SkillForge.autoUpdate(hero,boss);}
 assert.ok(hero._ruleSpeed?.stacks>=3,'real executed haste actions stack');
 const boosted=g.ArenaPinballMotion.baseSpeed(hero);
 assert.ok(boosted>baseline*1.5,'the speed buff changes actual movement physics');
 assert.ok(boosted<=10.5,'speed has a fair physics limit');
 hero._forgeActionClock=hero._ruleSpeed.until+1;
 assert.equal(g.ArenaPinballMotion.baseSpeed(hero),baseline,'stacks expire automatically');
});
