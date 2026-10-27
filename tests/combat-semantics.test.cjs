'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const actor=(n,x,y,health=300)=>({playerNum:n,id:'forge_test',x,y,z:0,vz:0,
  vx:0,vy:0,radius:26,hp:health,maxHp:health,invincible:0,
  forge:{color:'#347788'},getTag(){return {text:'test'};}});
function boot(withForge=false){
  const sim={window:null,players:[],canvas:{width:500,height:500},Math,
    document:{querySelector(){return null;}},CUSTOM_DEFS:[],BEHAVIORS:{},
    CHARACTER_PHOTOS:{},createHitParticles(){},addFloatingText(){},
    getClosestAliveEnemy(p){return sim.players.find(e=>e!==p&&e.hp>0)||null;}};
  sim.window=sim;
  vm.runInNewContext(read('js/features/advanced-combat.js'),sim);
  if(withForge)vm.runInNewContext(read('js/features/skill-forge.js'),sim);
  const api={hit(p,e,a,factor=1,z=sim.AdvancedCombat.height(p)){
    if(e.invincible>0||!sim.AdvancedCombat.canHit(p,e,z))return false;
    const damage=Math.round((a.damage||0)*factor);
    if(damage){e.hp=Math.max(0,e.hp-damage);e.invincible=12;}
    return true;
  }};
  const tick=(frames=1)=>{for(let i=0;i<frames;i++){
    for(const p of sim.players)if(p.invincible>0)p.invincible--;
    sim.AdvancedCombat.tick(api);
  }};
  return {sim,api,world:sim.AdvancedCombat,tick};
}
const action=(type,overrides={})=>({type,damage:40,radius:145,count:1,
  speed:6,duration:1.4,knockback:2,status:'none',...overrides});
test('blade sectors draw and damage using one shared radius and hit angle',()=>{
  const h=boot(),a=actor(1,100,100),front=actor(2,219,100),side=actor(3,100,233);
  h.sim.players.push(a,front,side);
  h.world.execute(a,action('slash'),front,h.api);
  const blade=h.world.objects.find(o=>o.kind==='melee');
  const preview=h.world.effects.find(o=>o.kind==='sector');
  assert.equal(preview.r,145);
  assert.equal(blade.a.radius,preview.r);
  h.tick(9);
  assert.equal(front.hp,300,'the weapon must not hit before the drawn edge completes');
  h.tick(1);
  assert.equal(front.hp,260);
  assert.equal(side.hp,300);
  const mark=h.world.effects.find(x=>x.kind==='cut');
  assert.ok(mark,'contact produces an actual slash-shaped wound');
  assert.equal(mark.x,front.x);
  assert.equal(mark.y,front.y);
});
test('the piercing stroke has narrow physical width and a distinctive stab mark',()=>{
  const h=boot(),a=actor(1,100,100),front=actor(2,215,100),off=actor(3,210,175);
  h.sim.players.push(a,front,off);
  h.world.execute(a,action('thrust',{radius:140}),front,h.api);
  assert.equal(h.world.effects.find(x=>x.kind==='line').r,140);
  h.tick(10);
  assert.ok(front.hp<300);
  assert.equal(off.hp,300,'an enemy outside spear line is not hit');
  assert.ok(h.world.effects.some(x=>x.kind==='stab'));
});
test('a melee miss does not fabricate wound marks',()=>{
  const h=boot(),a=actor(1,100,100),distant=actor(2,225,100);
  h.sim.players.push(a,distant);
  h.world.execute(a,action('slash',{radius:30}),distant,h.api);
  h.tick(11);
  assert.equal(distant.hp,300);
  assert.equal(h.world.effects.filter(x=>['cut','stab','cleave'].includes(x.kind)).length,0);
});
test('spinning cut applies omnidirectional damage and shows a crossing blade mark',()=>{
  const h=boot(),a=actor(1,100,100),east=actor(2,150,100),west=actor(3,50,100);
  h.sim.players.push(a,east,west);
  h.world.execute(a,action('spinslash',{radius:70}),east,h.api);
  h.tick(10);
  assert.ok(east.hp<300);
  assert.ok(west.hp<300);
  assert.equal(h.world.effects.filter(x=>x.kind==='cleave').length,2);
});
test('aircombo makes physically separate pulses rather than one mislabeled hit',()=>{
  const h=boot(),a=actor(1,100,100),b=actor(2,148,100);
  h.sim.players.push(a,b);
  h.world.execute(a,action('aircombo',{radius:100}),b,h.api);
  h.tick(9);
  assert.equal(b.hp,283,'first lighter aerial contact');
  assert.ok(b.vz>0);
  h.tick(28);
  assert.ok(b.hp<283,'later animation cycles must deal separate hits');
  assert.ok(h.world.effects.filter(x=>x.kind==='cut').length<=3);
});
test('arc shell uses a height shadow and deals damage only on its ground landing',()=>{
  const h=boot(),a=actor(1,100,100),b=actor(2,200,100);
  h.sim.players.push(a,b);
  h.world.execute(a,action('arcshot'),b,h.api);
  h.tick(19);
  const shell=h.world.projectiles.find(x=>x.kind==='arcshot');
  assert.ok(shell.height>60);
  assert.equal(b.hp,300,'airborne shell cannot magically hit before it lands');
  h.tick(19);
  assert.ok(b.hp<300);
  assert.ok(h.world.effects.some(x=>x.kind==='ring'));
});
test('shards collide with enemy positions swept along the trajectory',()=>{
  const h=boot(),a=actor(1,100,100),b=actor(2,113,100);
  h.sim.players.push(a,b);
  h.world.projectiles.push({kind:'fragment',owner:1,x:100,y:100,
    startX:100,startY:100,tx:300,ty:100,
    age:0,life:28,travel:18,a:action('splitshot'),height:0,trail:[]});
  h.tick(1);
  assert.ok(b.hp<300,'fragment touches enemy during flight');
  assert.ok(h.world.effects.some(x=>x.kind==='stab'));
});
test('advanced attacks are dispatched from the actual custom fighter update, not just the palette',()=>{
  const h=boot(true);
  const profile={name:'검술 장인',color:'#397b99',hp:300,speed:1.6,
    skills:[{name:'찌르기',trigger:'auto',cooldown:.2,actions:[
      action('thrust',{radius:130})]}]};
  const id=h.sim.SkillForge.register(profile);
  const hero=h.sim.CUSTOM_DEFS[0].createInstance(1),enemy=actor(2,140,100);
  hero.x=100;hero.y=100;h.sim.players.push(hero,enemy);
  for(let i=0;i<32;i++){h.sim.BEHAVIORS[id].update(hero,enemy);h.tick(1);}
  assert.ok(enemy.hp<300,'custom user-authored thrust must really execute and hit');
  assert.ok(h.world.effects.some(x=>x.kind==='stab') ||
    h.world.objects.some(o=>o.kind==='melee'));
});
test('every new action has a grounded description in the creator',()=>{
  const h=boot();
  assert.equal(Object.keys(h.world.DESCRIPTIONS).length,Object.keys(h.world.TYPES).length);
  for(const type of Object.keys(h.world.TYPES))
    assert.ok(h.world.DESCRIPTIONS[type].length>16,type);
  assert.ok(read('js/features/natural-forge.js').includes('AdvancedCombat?.DESCRIPTIONS'));
});
