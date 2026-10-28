'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function app(){
  const h={window:null,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(p){return h.players.find(e=>e!==p&&e.hp>0);}};
  h.window=h;vm.createContext(h);
  for(const file of ['ability-atlas','forge-expansion','skill-forge','natural-forge'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/features/'+file+'.js'),'utf8'),h);
  return h;
}
function battle(type,status='none'){
  const h=app(),cfg=h.SkillForge.normalize({name:'확장',hp:300,skills:[{cooldown:30,actions:[{type,status,damage:40,radius:180,count:3,duration:2,speed:6}]}]});
  h.SkillForge.register(cfg);const p=h.CUSTOM_DEFS[0].createInstance(1);p.x=100;p.y=100;p.hp=200;
  const e={playerNum:2,x:180,y:100,vx:1,vy:0,radius:20,hp:300,maxHp:300,invincible:0};
  h.players.push(p,e);p.forgeQueue.push({timer:0,a:cfg.skills[0].actions[0],targetNum:2});h.BEHAVIORS[p.id].update(p,e);
  return {h,p,e};
}
test('all 35 action types normalize and execute, new entities stay bounded',()=>{
  const types=Object.keys(app().SkillForge.TYPE);assert.equal(types.length,35);
  for(const type of types){
    const {h,p,e}=battle(type);assert.equal(p.forge.skills[0].actions[0].type,type);
    for(let i=0;i<150;i++){e.invincible=0;h.BEHAVIORS[p.id].update(p,e);}
    assert.ok(Number.isFinite(p.hp)&&Number.isFinite(e.hp),type);
    assert.ok((p.forgeExtras?.length||0)<=48,type);
  }
});
test('homing turns, piercing survives hits, and boomerang returns',()=>{
  const {h,p,e}=battle('homing');e.y=200;h.BEHAVIORS[p.id].update(p,e);assert.ok(p.forgeExtras[1].vy>0);
  const b=battle('pierce');b.e.x=112;b.h.BEHAVIORS[b.p.id].update(b.p,b.e);assert.ok(b.e.hp<300);assert.ok(b.p.forgeExtras.length>0);
  const r=battle('boomerang');for(let i=0;i<23;i++)r.h.BEHAVIORS[r.p.id].update(r.p,r.e);assert.ok(r.p.forgeExtras.some(x=>x.vx<0));
});
test('meteor delays damage, mine arms, drain heals and swap changes both positions',()=>{
  const b=battle('meteor');assert.equal(b.e.hp,300);for(let i=0;i<45;i++)b.h.BEHAVIORS[b.p.id].update(b.p,b.e);assert.ok(b.e.hp<300);
  const m=battle('mine');assert.equal(m.e.hp,300);for(let i=0;i<20;i++)m.h.BEHAVIORS[m.p.id].update(m.p,m.e);assert.ok(m.e.hp<300);
  const d=battle('drain');assert.equal(d.p.hp,220);assert.equal(d.e.hp,260);
  const s=battle('swap');assert.equal(s.p.x,180);assert.equal(s.e.x,100);
});
test('new statuses affect movement, actions, damage, recovery, and expire',()=>{
  const h=app(),p={playerNum:1,hp:200,maxHp:300,x:100,y:100,vx:1,vy:0},e={playerNum:2,hp:300,maxHp:300,x:180,y:100,vx:1,vy:0};h.players.push(p,e);
  const x=h.ForgeExpansion;
  for(const status of Object.keys(x.STATUSES)){
    e.forgeEffects={};e.hp=300;x.applyStatus(p,e,{status,damage:20,duration:1});assert.ok(e.forgeEffects[status]);
    if(['freeze','stun','root'].includes(status))assert.equal(x.movement(e),0);
    if(['freeze','stun','silence'].includes(status))assert.ok(x.blocked(e));
    if(status==='vulnerable')assert.equal(x.damageScale(p,e),1.35);
    if(status==='weak')assert.equal(x.damageScale(e,p),.6);
    if(status==='blind')assert.equal(x.damageScale(e,p),.65);
    for(let i=0;i<31;i++)x.tick(e);
    if(['bleed','shock'].includes(status))assert.ok(e.hp<300);
    if(status==='fear')assert.ok(e.vx>0);
    if(status==='charm')assert.ok(e.vx<0);
    for(let i=0;i<30;i++)x.tick(e);assert.equal(Object.keys(e.forgeEffects).length,0);
  }
  x.applyStatus(p,e,{status:'curse',duration:2});e.hp=100;x.heal(e,50);assert.equal(e.hp,120);
});
test('cleanse clears debuffs, fortify and regen have real effects',()=>{
  const {h,p,e}=battle('fortify');assert.equal(h.ForgeExpansion.damageScale(e,p),.55);
  const r=battle('regen');for(let i=0;i<30;i++)r.h.ForgeExpansion.tick(r.p);assert.equal(r.p.hp,210);
  h.ForgeExpansion.applyStatus(e,p,{status:'root',duration:2});p.bfDot=90;
  h.ForgeExpansion.execute(p,{type:'cleanse'},e,{enemies:()=>[e]});assert.equal(p.bfDot,0);assert.equal(p.forgeEffects.root,undefined);
});
test('offline parser distinguishes specific actions and offers explicit choices for unknown concepts',async()=>{
  const h=app();h.fetch=()=>{throw Error('network forbidden');};h.LanguageModel={availability(){throw Error('model forbidden');}};
  const examples={homing:'유도 미사일',pierce:'관통탄',boomerang:'부메랑',chain:'연쇄 번개',nova:'주변 폭발',meteor:'운석',mine:'지뢰',drain:'흡혈',swap:'위치 교환',retreat:'백스텝',cleanse:'정화',haste:'가속',regen:'지속 재생',fortify:'철갑'};
  for(const [type,term] of Object.entries(examples)){
    const out=await h.NaturalForge.analyze('3초마다 '+term,'확장');assert.equal(out.profile.skills[0].actions[0].type,type,term);
    assert.equal(out.profile.skills[0].actions.length,1,term);
  }
  const text='운명의 실을 새로 짠다',out=await h.NaturalForge.analyze(text,'운명');assert.equal(out.profile,null);assert.equal(out.questions.length,1);
  const resolved=h.NaturalForge.parse(text,'운명',{[text]:'shield'});assert.equal(resolved.questions.length,0);assert.equal(resolved.profile.skills[0].actions[0].type,'shield');
  assert.equal(h.NaturalForge.parse(text,'운명',{[text]:'skip'}).profile,null);
  assert.equal(h.NaturalForge.parse('냉기 탄환을 발사해 기절시킨다').profile.skills[0].actions[0].status,'stun');
});
test('engine honors control on classic fighters and pauses effect timers',()=>{
  const h=app();
  Object.assign(h,{isPlaying:true,isGameOver:false,screenShake:0,shockwaves:[],particles:[],floatingTexts:[]});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/core/engine.js'),'utf8'),h);
  h.updateUI=()=>{};
  const a={id:'classic',playerNum:1,x:100,y:100,vx:2,vy:0,radius:20,hp:300,maxHp:300,invincible:0},b={...a,playerNum:2,x:350};
  h.players.push(a,b);let actions=0;h.BEHAVIORS.classic={update(){actions++;}};
  h.ForgeExpansion.applyStatus(b,a,{status:'stun',duration:2});h.update();assert.equal(a.x,100);assert.equal(actions,1);
  const time=a.forgeEffects.stun.time;h.isPlaying=false;h.update();assert.equal(a.forgeEffects.stun.time,time);
  h.ForgeExpansion.applyStatus(a,b,{status:'weak',duration:1});
  h.ForgeExpansion.legacy(b,()=>{a.hp-=100;});assert.equal(a.hp,240);
});
test('expanded profiles survive sharing and restoring',()=>{
  const h=app();vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/features/community-forge.js'),'utf8'),h);
  const profile=h.NaturalForge.parse('3초마다 감전 유도 미사일 3발을 발사한다','추적자').profile;
  const restored=h.CommunityForge.parseBody(h.CommunityForge.makeBody(profile));
  assert.equal(restored.skills[0].actions[0].type,'homing');assert.equal(restored.skills[0].actions[0].status,'shock');
});
test('flight and burrow protect while active then land with real damage',()=>{
  for(const type of ['flight','burrow']){
    const {h,p,e}=battle(type);assert.equal(p.forgePhase.kind,type);assert.ok(p.invincible>0);
    for(let i=0;i<121;i++){h.ForgeExpansion.tick(p);h.BEHAVIORS[p.id].update(p,e);}
    assert.equal(p.forgePhase,null);assert.ok(e.hp<300,type);
    if(type==='burrow')assert.equal(p.x,e.x);
  }
});
test('space fields pull and damage, life fields heal only within their radius',()=>{
  const b=battle('blackhole');b.e.x+=50;
  for(let i=0;i<30;i++)b.h.BEHAVIORS[b.p.id].update(b.p,b.e);
  assert.ok(b.e.vx<0);assert.ok(b.e.hp<300);
  const s=battle('starfall');assert.equal(s.p.forgeExtras.length,3);assert.ok(s.p.forgeExtras[0].life<s.p.forgeExtras[2].life);
  const l=battle('lifebloom');for(let i=0;i<30;i++)l.h.BEHAVIORS[l.p.id].update(l.p,l.e);assert.equal(l.p.hp,210);
  l.p.x=490;for(let i=0;i<30;i++)l.h.BEHAVIORS[l.p.id].update(l.p,l.e);assert.equal(l.p.hp,210);
});
test('dung applies both poison and slow on impact',()=>{
  const {h,p,e}=battle('dung');for(let i=0;i<20;i++)h.BEHAVIORS[p.id].update(p,e);
  assert.ok(e.hp<300);assert.ok(e.bfDot>0);assert.equal(e.slowMultiplier,.5);
});
test('rewind restores own recorded state and time acceleration doubles cooldown charging',()=>{
  const {h,p,e}=battle('rewind');p.hp=250;p.x=100;h.ForgeExpansion.tick(p);
  p.hp=100;p.x=300;h.ForgeExpansion.tick(p);
  h.ForgeExpansion.execute(p,{type:'rewind',duration:3},e,{enemies:()=>[e]});assert.equal(p.hp,250);assert.equal(p.x,100);
  const t=battle('timeburst'),before=t.p.forgeTicks[0];t.h.BEHAVIORS[t.p.id].update(t.p,t.e);assert.equal(t.p.forgeTicks[0]-before,2);
  const frozen=battle('timestop');assert.equal(frozen.h.ForgeExpansion.movement(frozen.e),0);assert.ok(frozen.h.ForgeExpansion.blocked(frozen.e));
});
test('resurrection occurs before winner settlement and is usable only once',()=>{
  const {h,p,e}=battle('resurrect');Object.assign(h,{isPlaying:true,isGameOver:false,screenShake:0,shockwaves:[],particles:[],floatingTexts:[]});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/core/engine.js'),'utf8'),h);h.updateUI=()=>{};
  let settled=0;h.settleRound=()=>settled++;h.document={getElementById:()=>({dataset:{}})};
  p.hp=10;h.BEHAVIORS.enemy={update(){p.hp=0;}};e.id='enemy';h.update();
  assert.equal(p.hp,105);assert.equal(h.isGameOver,false);assert.equal(settled,0);
  h.update();assert.equal(p.hp,0);assert.equal(h.isGameOver,true);assert.equal(settled,1);
  assert.equal(h.ForgeExpansion.revive(p),false);
});
test('all new themes parse offline and randomized characters remain valid and varied',()=>{
  const h=app();
  const words={flight:'공중 강하',burrow:'지하 습격',blackhole:'블랙홀',starfall:'우주 별비',dung:'똥 폭탄',lifebloom:'생명의 꽃',resurrect:'부활',timestop:'시간 정지',rewind:'시간 되감기',timeburst:'시간 가속'};
  for(const [type,text] of Object.entries(words)){const out=h.NaturalForge.parse('4초마다 '+text);assert.equal(out.questions.length,0);assert.equal(out.profile.skills[0].actions[0].type,type,text);assert.equal(out.profile.skills[0].actions.length,1,text);}
  const profiles=new Set();
  for(const theme of Object.keys(h.SkillForge.THEMES))for(let i=0;i<30;i++){
    const p=h.SkillForge.randomProfile(theme);assert.ok(p.skills.length>=3&&p.skills.length<=4);assert.ok(p.hp>=140&&p.hp<=500);
    assert.deepEqual(JSON.parse(JSON.stringify(h.SkillForge.normalize(p))),JSON.parse(JSON.stringify(p)));
    profiles.add(JSON.stringify(p));
  }
  assert.ok(profiles.size>100);
});
