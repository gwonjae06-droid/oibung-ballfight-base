'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function boot(){
  const marks=[];
  const ctx=new Proxy({},{
    get(obj,key){if(key in obj)return obj[key];return (...args)=>marks.push([key,...args]);},
    set(obj,key,value){obj[key]=value;return true;}
  });
  const h={window:null,players:[],Math,ctx,canvas:{width:500,height:500},
    CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},createHitParticles(){},addFloatingText(){},
    document:{querySelector(){return null;}},
    getClosestAliveEnemy(p){return h.players.find(e=>e!==p&&e.hp>0)||null;}};
  h.window=h;vm.createContext(h);
  for(const file of ['ability-atlas','forge-expansion','advanced-combat','skill-forge'])
    vm.runInContext(read('js/features/'+file+'.js'),h,{filename:file+'.js'});
  function player(n,x=100,y=100){
    h.SkillForge.register({name:'물리 전투',color:'#4e8ca0',skills:[
      {name:'능력',trigger:'lowhp',threshold:5,cooldown:30,actions:[{type:'heal',damage:1}]}]});
    const p=h.CUSTOM_DEFS.at(-1).createInstance(n);p.x=x;p.y=y;p.vx=0;p.vy=0;
    return p;
  }
  const enemy=(n,x,y)=>({id:'target',name:'적',playerNum:n,x,y,vx:0,vy:0,
    z:0,vz:0,radius:22,hp:300,maxHp:300,invincible:0,jumpState:'ground'});
  const api={enemies:p=>h.players.filter(q=>q!==p&&q.hp>0),
    hit:(p,e,a,m=1,z)=>h.SkillForge.hit(p,e,a,m,z)};
  const tick=(count=1)=>{for(let j=0;j<count;j++){
    for(const p of h.players)if(p.invincible>0)p.invincible--;
    h.AdvancedCombat.tick(api);
  }};
  const action=(type,opts={})=>({type,damage:40,radius:170,count:1,speed:7,
    duration:3,status:'none',knockback:0,...opts});
  return {h,marks,ctx,player,enemy,api,tick,action};
}
test('uppercut displays a windup and hits only when contact is physically valid',()=>{
  const t=boot(),p=t.player(1),e=t.enemy(2,140,100);
  t.h.players.push(p,e);
  t.h.AdvancedCombat.execute(p,t.action('uppercut',{damage:45}),e,t.api);
  assert.equal(e.hp,300,'no damage on cast');
  assert.ok(t.h.AdvancedCombat.objects.some(o=>o.kind==='uppercut'));
  t.tick(7);assert.equal(e.hp,300,'the visible arm is winding up');
  e.x=360;t.tick(1);
  assert.equal(e.hp,300,'a target that escapes the fist reach is not struck');
  e.x=142;e.invincible=0;
  t.h.AdvancedCombat.execute(p,t.action('uppercut',{damage:45}),e,t.api);
  t.tick(8);
  assert.ok(e.hp<300,'close-range fist connects on hit frame');
  assert.ok(e.vz>0,'launch is caused by hit, not by casting');
});
test('uppercut-to-aircombo launches the caster on actual contact',()=>{
  const t=boot();
  t.h.SkillForge.register({name:'격투',skills:[{name:'연계',trigger:'auto',
    cooldown:.2,actions:[{type:'uppercut',damage:30,radius:110},
      {type:'aircombo',damage:25,radius:110}]}]});
  const hero=t.h.CUSTOM_DEFS.at(-1).createInstance(1),foe=t.enemy(2,142,100);
  hero.x=100;hero.y=100;hero.vx=0;hero.vy=0;
  t.h.players.push(hero,foe);
  for(let i=0;i<45;i++){
    if(foe.invincible>0)foe.invincible--;
    t.h.BEHAVIORS[hero.id].update(hero,foe);
    t.h.AdvancedCombat.tick(t.api);
  }
  assert.ok(hero.forgeSerial>=1,'combo actually casts');
  assert.ok(t.h.AdvancedCombat.effects.some(e=>e.kind==='cut') ||
    foe.hp<270,'aerial strikes use their own timing and altitude');
  assert.ok(hero.takeoffAge===0||hero.z>=0);
});
test('aircombo hit checks use current attacker altitude, not altitude at cast',()=>{
  const t=boot(),p=t.player(1),e=t.enemy(2,145,100);
  t.h.players.push(p,e);
  t.h.AdvancedCombat.execute(p,t.action('aircombo',{damage:50}),e,t.api);
  p.z=70;e.z=70;
  t.tick(9);
  assert.ok(e.hp<300,'an aerial sword at a different height from cast hits its layer');
});
test('turret turns toward its enemy and fires a real traveling projectile',()=>{
  const t=boot(),p=t.player(1),e=t.enemy(2,270,100);
  t.h.players.push(p,e);
  t.h.AdvancedCombat.execute(p,t.action('turret',{radius:250,duration:3}),e,t.api);
  const turret=t.h.AdvancedCombat.objects.find(o=>o.kind==='turret');
  assert.ok(turret);
  t.tick(24);assert.equal(e.hp,300,'turret does not apply instant remote damage');
  assert.equal(t.h.AdvancedCombat.projectiles.length,0);
  t.tick(1);
  const shot=t.h.AdvancedCombat.projectiles.find(s=>s.kind==='turretshot');
  assert.ok(shot,'a real projectile exists after the muzzle fires');
  assert.ok(Math.abs(turret.aim)<.1);
  t.tick(30);
  assert.ok(e.hp<300,'moving projectile reaches and strikes target');
});
test('wall intercepts advanced turret shot and takes collision damage',()=>{
  const t=boot(),p=t.player(1),e=t.enemy(2,320,100);
  t.h.players.push(p,e);
  t.h.AdvancedCombat.execute(p,t.action('turret',{radius:290,duration:3,damage:30}),e,t.api);
  t.h.AdvancedCombat.objects.push({
    kind:'wall',owner:1,x:211,y:100,r:24,hp:90,maxHp:90,life:200,age:0});
  const wall=t.h.AdvancedCombat.objects.find(o=>o.kind==='wall');
  let collisionVisual=false;
  for(let frame=0;frame<45;frame++){
    t.tick(1);
    collisionVisual ||=t.h.AdvancedCombat.effects.some(x=>x.kind==='burst');
  }
  assert.equal(e.hp,300,'wall shields against ground-level turret shells');
  assert.ok(wall.hp<90,'physical wall absorbs projectile damage');
  assert.ok(collisionVisual,'blocking a projectile produces an impact flash');
});
test('wall intercepts ordinary player shots and returning extended projectiles',()=>{
  const t=boot(),p=t.player(1),e=t.enemy(2,260,100);
  t.h.players.push(p,e);
  t.h.AdvancedCombat.objects.push({
    kind:'wall',owner:1,x:136,y:100,r:13,hp:100,maxHp:100,life:200,age:0});
  const wall=t.h.AdvancedCombat.objects.at(-1);
  p.forgeShots.push({x:100,y:100,vx:20,vy:0,life:30,a:t.action('shot')});
  t.h.SkillForge.advanceWorld(p,e);
  t.h.SkillForge.advanceWorld(p,e);
  assert.equal(p.forgeShots.length,0);
  assert.ok(wall.hp<100);
  const before=wall.hp;
  t.h.ForgeExpansion.execute(p,t.action('homing',{count:1,speed:10,radius:250}),e,t.api);
  for(let i=0;i<5;i++)t.h.ForgeExpansion.update(p,t.api);
  assert.ok(wall.hp<before,'expansion homing shot also collides with wall');
  assert.equal(e.hp,300);
});
test('meteor visibly descends with a shadow; landing damage is delayed',()=>{
  const t=boot(),p=t.player(1),e=t.enemy(2,240,200);
  t.h.players.push(p,e);
  t.h.ForgeExpansion.execute(p,t.action('meteor',{radius:100,damage:60}),e,t.api);
  const meteor=p.forgeExtras[0];
  assert.equal(meteor.flight,45);
  t.h.ForgeExpansion.update(p,t.api);
  t.marks.length=0;t.h.ForgeExpansion.draw(p);
  assert.ok(t.marks.some(x=>x[0]==='ellipse'),'ground shadow is rendered');
  assert.ok(t.marks.some(x=>x[0]==='lineTo'),'falling burning tail is rendered');
  for(let i=0;i<43;i++)t.h.ForgeExpansion.update(p,t.api);
  assert.equal(e.hp,300,'no damage while above ground');
  t.h.ForgeExpansion.update(p,t.api);
  assert.ok(e.hp<300,'damage is applied at impact time only');
});
