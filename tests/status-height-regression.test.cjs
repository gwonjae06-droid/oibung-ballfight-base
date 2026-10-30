'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function sim(){
 const w={window:null,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:500,height:500},Math,Number,Map,Set,
  createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(p){return w.players.find(e=>e!==p&&e.hp>0);}};
 w.window=w;vm.createContext(w);
 for(const module of ['advanced-combat','forge-expansion','ability-atlas','skill-forge'])
  vm.runInContext(source('js/features/'+module+'.js'),w,{filename:module+'.js'});
 const p={id:'attacker',playerNum:1,x:140,y:220,z:0,towerGroundZ:0,radius:24,hp:300,maxHp:300,
   forge:{skills:[],color:'#bb5500',effectColor:'#ff3300'},forgeQueue:[],forgeShots:[],
   forgeZones:[],forgeOrbs:[],vx:0,vy:0,invincible:0};
 const e={id:'defender',playerNum:2,x:185,y:220,z:0,towerGroundZ:48,radius:24,
   hp:300,maxHp:300,vx:0,vy:0,invincible:0};
 w.players.push(p,e);
 const action=(type,status='poison',damage=40)=>({type,status,damage,radius:120,
   speed:5,count:1,knockback:0,duration:2,pattern:'direct',target:'nearest'});
 return {w,p,e,action};
}
test('elevated targets receive poison/fire/ice instant damage and status from ground zones',()=>{
 for(const status of ['poison','fire','ice','freeze','stun','vulnerable']){
  const {w,p,e,action}=sim();
  const a=action('zone',status,40);
  assert.equal(w.SkillForge.hit(p,e,a,1,0),false,
   'a literal world-height zero projectile cannot pass through a 48-high platform');
  assert.equal(w.SkillForge.hitGround(p,e,a),true,status+' must hit on the local platform');
  assert.equal(e.hp,260,status+' direct hit must damage, not only show status');
  if(status==='fire'||status==='poison')assert.ok(e.bfDot>0,'DoT scheduled');
  if(status==='ice')assert.ok(e.slowTimer>=89,'ice slows');
  if(status==='freeze'||status==='stun'||status==='vulnerable')
   assert.ok(e.forgeEffects?.[status]?.time>0,'advanced status attached');
 }
});
test('jumping above the platform still evades all ground-level status hazards',()=>{
 const {w,p,e,action}=sim();
 e.z=65;
 assert.equal(w.SkillForge.hitGround(p,e,action('zone','fire')),false);
 assert.equal(e.hp,300);
 assert.equal(e.bfDot||0,0,'cannot ignite an airborne enemy with a ground zone');
 e.z=0;
 assert.equal(w.SkillForge.hitGround(p,e,action('zone','fire')),true);
 assert.equal(e.hp,260);
});
test('periodic poison zone and timed lightning hit elevated fighters',()=>{
 const {w,p,e,action}=sim();
 const poison=action('zone','poison',40);
 p.forgeZones.push({type:'zone',x:e.x,y:e.y,timer:50,ticks:29,a:poison,r:55});
 w.SkillForge.advanceWorld(p,e);
 assert.equal(e.hp,284,'zone deals 40% of 40 on first periodic tick');
 assert.ok(e.bfDot>0);
 e.invincible=0;
 const lightning=action('bolt','shock',26);
 p.forgeZones.push({type:'bolt',x:e.x,y:e.y,timer:1,ticks:0,a:lightning});
 w.SkillForge.advanceWorld(p,e);
 assert.equal(e.hp,258,'lightning lands on elevated ground');
 assert.ok(e.forgeEffects?.shock?.time>0);
});
test('opening zone from ability atlas applies real elevated status damage',()=>{
 const {w,p,e,action}=sim();
 const statusZone=action('zone','fire',25);
 const hit=(...args)=>w.SkillForge.hit(...args);
 assert.equal(w.AbilityAtlas.execute(p,statusZone,e,{enemies:()=>[e],hit}),true);
 assert.equal(e.hp,275);
 assert.ok(e.bfDot>0);
});
test('burn and poison tick via shared engine in PvP as well as offline, once per frame',()=>{
 const {w,e}=sim();
 const full=e.hp;
 e.bfDot=60;e.bfDotDamage=4;e.invincible=240;
 for(let frame=0;frame<60;frame++)w.ForgeExpansion.tick(e);
 assert.equal(e.hp,full-8,'two DoT pulses at 30-frame cadence even if invincible');
 assert.equal(e.bfDot,0);
 for(let frame=0;frame<60;frame++)w.ForgeExpansion.tick(e);
 assert.equal(e.hp,full-8,'no double-tick after expiry');
 const main=source('js/main.js');
 assert.ok(!main.includes('update=function(){'), 'no competing per-frame UI DoT tick');
 const pvp=source('pvp-runtime.html');
 assert.ok(!pvp.includes('js/main.js'),'isolated PvP shares ForgeExpansion.tick via core engine');
 assert.ok(source('js/core/engine.js').includes('ForgeExpansion?.tick(p)'));
});
