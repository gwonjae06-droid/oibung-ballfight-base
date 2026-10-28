'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const script=file=>fs.readFileSync(path.join(root,'js/features',file+'.js'),'utf8');
const actor=(n,x,y)=>({id:'unit',playerNum:n,name:'actor'+n,x,y,vx:0,vy:0,z:0,vz:0,
  radius:26,hp:300,maxHp:300,invincible:0,forge:{color:'#6788a9'}});
function boot(){
  const draws=[];
  const ctx=new Proxy({},{
    get(obj,k){if(k==='canvas')return {width:500,height:500};if(k in obj)return obj[k];
      return (...args)=>{draws.push([k,...args]);};},
    set(obj,k,v){obj[k]=v;return true;}
  });
  const h={window:null,players:[],Math,ctx,canvas:{width:500,height:500},
    CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},createHitParticles(){},
    addFloatingText(){},document:{querySelector(){return null;},getElementById(){return null;}},
    getClosestAliveEnemy(p){return h.players.find(e=>e!==p&&e.hp>0)||null;}};
  h.window=h;vm.createContext(h);
  for(const name of ['ability-atlas','forge-expansion','advanced-combat','skill-forge','natural-forge'])
    vm.runInContext(script(name),h,{filename:name+'.js'});
  const api={enemies:p=>h.players.filter(e=>e!==p&&e.hp>0),
    hit(p,e,a,m=1,z=0){
      if(e.invincible>0||!h.AdvancedCombat.canHit(p,e,z))return false;
      const damage=Math.round(a.damage*m);e.hp=Math.max(0,e.hp-damage);e.invincible=6;
      return true;
    }};
  const tick=(count=1)=>{for(let i=0;i<count;i++){
    h.players.forEach(x=>{if(x.invincible>0)x.invincible--;});
    for(const p of h.players.filter(x=>x.forge))h.ForgeExpansion.update(p,api);
    h.AdvancedCombat.tick(api);
  }};
  return {h,api,ctx,draws,tick};
}
const action=(type,overrides={})=>({type,damage:30,radius:120,speed:6,count:5,
  duration:2,pattern:'direct',target:'nearest',status:'none',knockback:2,delay:0,...overrides});
test('star rain consists of visible falling stars and inflicts damage at individual ground impacts',()=>{
  const {h,api,draws,ctx,tick}=boot(),p=actor(1,80,80),enemy=actor(2,220,180);
  h.players.push(p,enemy);
  assert.equal(h.ForgeExpansion.execute(p,action('starfall',{count:5}),enemy,api),true);
  assert.equal(p.forgeExtras.length,5);
  assert.ok(p.forgeExtras.every(x=>x.kind==='starfall'));
  assert.ok(p.forgeExtras[0].delay<p.forgeExtras[4].delay);
  tick(13);assert.equal(enemy.hp,300);
  draws.length=0;h.ForgeExpansion.draw(p);
  assert.ok(draws.some(x=>x[0]==='lineTo'),'comet must have a visible streak');
  assert.ok(draws.some(x=>x[0]==='ellipse'),'falling star has a shadow');
  tick(13);assert.ok(enemy.hp<300,'central star lands and damages near ground');
  assert.ok(h.AdvancedCombat.effects.some(x=>x.kind==='burst'));
});
test('moving summon pursues target and uses physical contact distance, unlike stationary turret',()=>{
  const {h,api,tick}=boot(),p=actor(1,60,100),e=actor(2,320,100);
  h.players.push(p,e);
  h.AdvancedCombat.execute(p,action('summon',{duration:4,speed:8}),e,api);
  h.AdvancedCombat.execute(p,action('turret',{duration:4,speed:8}),e,api);
  const pet=h.AdvancedCombat.objects.find(o=>o.kind==='summon');
  const turret=h.AdvancedCombat.objects.find(o=>o.kind==='turret');
  const start=pet.x,lockedTurret=turret.x;
  tick(12);assert.ok(pet.x>start+12,'pet physically pursues its target');
  assert.equal(turret.x,lockedTurret,'turret remains stationary');
  assert.equal(e.hp,300,'pet should not damage while far from contact');
  e.y=260;tick(10);assert.ok(pet.vy>0,'pet steers when target moves');
  e.x=pet.x+20;e.y=pet.y;
  tick(32);assert.ok(e.hp<300,'pet attacks once within contact radius');
});
test('all ability command unlocks every registered type with independent cooldowns',()=>{
  const {h}=boot();
  const out=h.NaturalForge.parse('모든 능력을 가진다','만능검사');
  assert.equal(out.questions.length,0);
  assert.equal(out.profile.allAbilities,true);
  assert.equal(out.profile.skills.length,1,'saved profile remains compact');
  const configured=h.SkillForge.normalize(out.profile);
  h.SkillForge.register(configured);
  const hero=h.CUSTOM_DEFS[0].createInstance(1);
  const names=new Set(hero.forge.skills.flatMap(s=>s.actions.map(a=>a.type)));
  const types=Object.keys(h.SkillForge.TYPE);
  assert.equal(names.size,types.length,'every action type must have an executable runtime slot');
  for(const type of types)assert.ok(names.has(type),'missing '+type);
  assert.equal(hero.forgeTicks.length,types.length);
  assert.equal(hero.forge.allAbilities,true);
  assert.ok(hero.getTag().text.includes('전체'));
  // Each ability has its own independent timer and scheduling metadata.
  assert.equal(new Set(hero.forge.skills.map(x=>x.cooldown)).size>1,true);
});
test('all ability command is honored by local AI path as well',async()=>{
  const {h}=boot();
  for(const txt of ['모든 능력을 가진다','전부의 스킬을 사용한다','만능 캐릭터']){
    assert.equal(h.NaturalForge.isAllIntent(txt),true,txt);
    const out=await h.NaturalForge.analyze(txt,'전능자','auto');
    assert.equal(out.profile.allAbilities,true);
  }
});
test('all ability fighter can execute its scheduled catalog moves without queue flooding',()=>{
  const {h,api}=boot(),profile=h.SkillForge.allProfile('만능');
  h.SkillForge.register(profile);
  const hero=h.CUSTOM_DEFS[0].createInstance(1),enemy=actor(2,180,100);
  hero.x=100;hero.y=100;h.players.push(hero,enemy);
  const id=hero.id;
  for(let i=0;i<185;i++){
    h.players.forEach(x=>{if(x.invincible>0)x.invincible--;});
    h.BEHAVIORS[id].update(hero,enemy);
    h.AdvancedCombat.tick(api);
  }
  assert.ok(hero.forgeSerial>12,'full catalog must actively use varied skills');
  assert.ok(hero.forgeCursor>3,'round-robin cursor advances');
  assert.ok(hero.forgeQueue.length<=48,'queue remains bounded');
  assert.equal(hero.forgeTicks.length,Object.keys(h.SkillForge.TYPE).length);
});
test('unrestricted random mode samples the complete action pool and randomizes all fields',()=>{
  const {h}=boot(),seen=new Set(),statuses=new Set(),triggers=new Set(),
    patterns=new Set(),targets=new Set(),hp=new Set(),speed=new Set(),colors=new Set(),lengths=new Set();
  for(let i=0;i<350;i++){
    const cfg=h.SkillForge.randomProfile('any');
    lengths.add(cfg.skills.length);hp.add(cfg.hp);speed.add(cfg.speed);colors.add(cfg.color);
    cfg.skills.forEach(s=>{triggers.add(s.trigger);s.actions.forEach(a=>{
      seen.add(a.type);statuses.add(a.status);patterns.add(a.pattern);targets.add(a.target);
    });});
  }
  assert.equal(seen.size,Object.keys(h.SkillForge.TYPE).length);
  assert.equal(statuses.size,Object.keys(h.SkillForge.STATUS).length);
  assert.equal(patterns.size,Object.keys(h.AbilityAtlas.PATTERNS).length);
  assert.equal(targets.size,Object.keys(h.AbilityAtlas.TARGETS).length);
  assert.ok(triggers.size>=3);
  assert.ok(hp.size>80&&speed.size>20&&colors.size>100);
  assert.ok(lengths.has(1)&&lengths.has(4));
});
