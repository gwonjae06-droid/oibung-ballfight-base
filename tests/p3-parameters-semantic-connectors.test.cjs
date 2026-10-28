'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
  fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
function env(){
  const h={window:null,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
    canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},
    document:{querySelector(){return null;},getElementById(){return null;}},
    getClosestAliveEnemy(p){return h.players.find(e=>e!==p&&e.hp>0)||null;}};
  h.window=h;vm.createContext(h);
  for(const p of ['ability-atlas','forge-expansion','advanced-combat','skill-forge','natural-forge'])
    vm.runInContext(read('js/features/'+p+'.js'),h,{filename:p+'.js'});
  const p={playerNum:1,x:90,y:100,vx:0,vy:0,z:0,radius:26,
    hp:300,maxHp:300,invincible:0,forge:{color:'#496782'}};
  const target=(n,x,y)=>({playerNum:n,x,y,vx:0,vy:0,z:0,radius:22,
    hp:300,maxHp:300,invincible:0});
  const api={enemies:who=>h.players.filter(q=>q!==who&&q.hp>0),
    hit(p,e,a,f=1,z=0){if(e.invincible>0)return false;e.hp-=Math.round(a.damage*f);e.invincible=12;return true;}};
  return {h,p,target,api};
}
test('55 types show only controls actually wired to their execution family',()=>{
  const {h}=env(),types=Object.keys(h.SkillForge.TYPE);
  assert.equal(types.length,55);
  assert.equal(Object.keys(h.SkillForge.ACTION_PARAMETERS).length,55);
  const known=new Set(['pattern','target','damage','radius','count','speed','duration','status','knockback']);
  for(const type of types){
    const fields=h.SkillForge.ACTION_PARAMETERS[type].split(/\s+/).filter(Boolean);
    for(const field of fields)assert.ok(known.has(field),type+': '+field);
    assert.equal(h.SkillForge.supportedParameter(type,'delay'),true,type);
  }
  for(const key of ['shot','wave','beam','bolt','zone'])
    assert.equal(h.SkillForge.supportedParameter(key,'pattern'),true,key);
  for(const key of types.filter(x=>!['shot','wave','beam','bolt','zone'].includes(x)))
    assert.equal(h.SkillForge.supportedParameter(key,'pattern'),false,key);
  assert.equal(h.SkillForge.supportedParameter('meteor','speed'),true);
  assert.equal(h.SkillForge.supportedParameter('heal','count'),false);
  assert.equal(h.SkillForge.supportedParameter('resurrect','damage'),false);
  assert.equal(h.SkillForge.supportedParameter('fortify','duration'),true);
  assert.equal(h.SkillForge.supportedParameter('leap','duration'),false,'fixed leap hover is not user configurable');
  assert.match(read('js/features/skill-forge.js'),/key&&!supportedParameter\(a.type,key\)/);
});
test('meteor, star rain and arcing projectiles actually use speed settings',()=>{
  const {h,p,target,api}=env(),enemy=target(2,270,100);
  h.players.push(p,enemy);
  const a=(type,speed,count=1)=>({type,speed,radius:160,damage:25,count,duration:2,knockback:0,status:'none'});
  h.ForgeExpansion.execute(p,a('meteor',3),enemy,api);
  const slow=p.forgeExtras.at(-1).flight;p.forgeExtras.length=0;
  h.ForgeExpansion.execute(p,a('meteor',12),enemy,api);
  const fast=p.forgeExtras.at(-1).flight;
  assert.ok(fast<slow,'configured meteor speed controls fall time');
  p.forgeExtras.length=0;
  h.ForgeExpansion.execute(p,a('starfall',3,3),enemy,api);
  const slowStar=p.forgeExtras[0].flight;p.forgeExtras.length=0;
  h.ForgeExpansion.execute(p,a('starfall',12,3),enemy,api);
  assert.ok(p.forgeExtras[0].flight<slowStar);
  p.forgeExtras.length=0;
  h.ForgeExpansion.execute(p,a('starfall',6,1),enemy,api);
  assert.equal(p.forgeExtras.length,1,'count 1 must mean exactly one falling star');
  h.AdvancedCombat.execute(p,a('arcshot',3),enemy,api);
  const arcSlow=h.AdvancedCombat.projectiles.at(-1).travel;
  h.AdvancedCombat.projectiles.length=0;
  h.AdvancedCombat.execute(p,a('arcshot',12),enemy,api);
  const arcFast=h.AdvancedCombat.projectiles.at(-1).travel;
  assert.ok(arcFast<arcSlow,'faster shell gets to its target sooner');
});
test('splitshot count means fragments, not count-squared projectile spam',()=>{
  const {h,p,target,api}=env(),enemy=target(2,220,100);
  h.players.push(p,enemy);
  h.AdvancedCombat.execute(p,{type:'splitshot',count:7,speed:7,radius:160,
    damage:30,knockback:0,status:'none'},enemy,api);
  assert.equal(h.AdvancedCombat.projectiles.filter(x=>x.kind==='splitshot').length,1);
  assert.equal(h.AdvancedCombat.projectiles[0].a.count,7);
  for(let i=0;i<25;i++)h.AdvancedCombat.tick(api);
  assert.equal(h.AdvancedCombat.projectiles.filter(x=>x.kind==='fragment').length,7);
});
test('Korean 고 chain combines actions but modifiers do not become new skills',()=>{
  const {h}=env(),parser=h.NaturalForge;
  const combo=parser.parse('칼로 베고 찌른다','검술');
  assert.equal(combo.profile.skills.length,1);
  assert.equal(combo.profile.skills[0].actions.length,2);
  assert.deepEqual(Array.from(combo.profile.skills[0].actions,x=>x.type),['slash','thrust']);
  const modifier=parser.parse('화염탄을 발사하고 적을 중독시킨다','연소');
  assert.equal(modifier.profile.skills.length,1);
  assert.equal(modifier.profile.skills[0].actions.length,1);
  assert.equal(modifier.profile.skills[0].actions[0].type,'shot');
});
test('independent defensive action and independent trigger become separate skills',()=>{
  const {h}=env(),parser=h.NaturalForge;
  const result=parser.parse('화살을 발사하고 방어막을 펼친다','수호자');
  assert.equal(result.profile.skills.length,2);
  assert.deepEqual(Array.from(result.profile.skills,s=>s.actions[0].type),['shot','shield']);
  const triggered=parser.parse('화살을 발사하고 체력 30% 이하이면 회복한다','생존');
  assert.equal(triggered.profile.skills.length,2);
  assert.equal(triggered.profile.skills[1].trigger,'lowhp');
});
test('ambiguous 그리고 prompts for separate skill vs chained action',()=>{
  const {h}=env(),text='화살을 쏜다 그리고 번개를 내린다';
  const draft=h.NaturalForge.parse(text,'연계');
  const choice=draft.questions.find(q=>q.kind==='grouping');
  assert.ok(choice,'unclear coordination asks the user');
  const linked=h.NaturalForge.parse(text,'연계',{[choice.text]:'combo'});
  const separate=h.NaturalForge.parse(text,'연계',{[choice.text]:'separate'});
  assert.equal(linked.questions.length,0);
  assert.equal(separate.questions.length,0);
  assert.equal(linked.profile.skills.length,1);
  assert.equal(linked.profile.skills[0].actions.length,2);
  assert.equal(separate.profile.skills.length,2);
});
test('random generators appear above fighter details without a sentence generator',()=>{
  const natural=read('js/features/natural-forge.js');
  const css=read('css/style.css');
  assert.match(natural,/randomEntry\.className='forge-random-entry'/);
  assert.match(natural,/body\.insertBefore\(randomEntry,nameLabel\)/);
  assert.match(natural,/modeButtons\.append\(randomNow,themeToggle\)/);
  assert.match(natural,/randomEntry\.append\(randomHead,modeButtons,themeOptions,status,generated\)/);
  assert.match(natural,/themeOptions\.hidden=true/);
  assert.match(css,/\.forge-studio \.forge-random-entry #forge-random-create/);
  const install=natural.slice(natural.indexOf('function install(){'));
  assert.doesNotMatch(install,/forge-natural-text|forge-natural-build|forge-natural-mode|forge-choices/);
  assert.doesNotMatch(install,/forge-prompt/);
  assert.match(install,/status\.id='forge-generate-status'/);
});
