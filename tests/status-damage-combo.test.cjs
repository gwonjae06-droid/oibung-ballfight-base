'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=n=>fs.readFileSync('js/features/'+n+'.js','utf8');
function combat(){
 const g={window:null,globalThis:null,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
   canvas:{width:600,height:450},Math,Set,Map,WeakMap,
   addFloatingText(){},createHitParticles(){},getClosestAliveEnemy(p){return g.players.find(e=>e!==p&&e.hp>0);}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const f of ['arena-balance','advanced-combat','forge-expansion','skill-forge'])vm.runInContext(read(f),g,{filename:f});
 const p={name:'caster',id:'caster',playerNum:1,x:110,y:180,z:0,radius:25,hp:300,maxHp:300,invincible:0,
   forge:{skills:[],color:'#3d9cdd',effectColor:'#3d9cdd'},forgeEffects:{},_forgeBalanceFrame:10};
 const e={name:'target',id:'target',playerNum:2,x:155,y:180,z:0,radius:25,hp:500,maxHp:500,invincible:0,forgeEffects:{}};
 g.players.push(p,e);
 const action=(status='none',damage=50)=>({type:'wave',damage,status,knockback:0,duration:2,radius:140});
 return {g,p,e,action};
}
test('a status hit and another damage block in the same combo both deal direct damage',()=>{
 for(const status of ['freeze','stun','root','silence','ice','poison','fire','shock','vulnerable']){
  const {g,p,e,action}=combat(),first=action(status),second=action('none',75);
  assert.equal(g.SkillForge.hit(p,e,first),true,status);
  const afterFirst=e.hp;
  assert.ok(afterFirst<500,status+' initial hit should deal damage');
  assert.equal(g.SkillForge.hit(p,e,second),true,status+' should not grant immunity to other skill blocks');
  assert.ok(e.hp<afterFirst,status+' should not suppress the following direct hit');
 }
});
test('one hitbox cannot repeatedly damage on the same frame or before its 12-frame grace elapses',()=>{
 const {g,p,e,action}=combat(),a=action('freeze',40);
 assert.equal(g.SkillForge.hit(p,e,a),true);const hp=e.hp;
 for(let tick=1;tick<12;tick++){
  p._forgeBalanceFrame=10+tick;
  assert.equal(g.SkillForge.hit(p,e,a),false,'same hitbox repeated at frame '+tick);
  assert.equal(e.hp,hp);
 }
 p._forgeBalanceFrame=22;
 assert.equal(g.SkillForge.hit(p,e,a),true);
 assert.ok(e.hp<hp);
});
test('true shield and revive invulnerability still prevent all damage and statuses',()=>{
 const {g,p,e,action}=combat(),a=action('poison');e.invincible=50;
 assert.equal(g.SkillForge.hit(p,e,a),false);
 assert.equal(e.hp,500);assert.equal(e.bfDot,undefined);
 e.invincible=0;
 assert.equal(g.SkillForge.hit(p,e,a),true);
});
test('zero-damage CC blocks never consume hit grace for a subsequent real attack',()=>{
 const {g,p,e,action}=combat();
 assert.equal(g.SkillForge.hit(p,e,action('freeze',0)),true);
 assert.ok(e.forgeEffects.freeze.time>0);
 assert.equal(g.SkillForge.hit(p,e,action('none',75)),true);
 assert.ok(e.hp<500);
});
test('status damage continues to tick during a shield and while caster is stunned',()=>{
 const {g,p,e,action}=combat();
 assert.equal(g.SkillForge.hit(p,e,action('poison',25)),true);
 const hp=e.hp;e.invincible=60;
 g.ForgeExpansion.applyStatus(e,p,{status:'stun',duration:1});
 for(let i=0;i<60;i++){g.ForgeExpansion.tick(e);if(e.invincible>0)e.invincible--;}
 assert.ok(e.hp<hp,'DoT ticks bypass shield and incapacitation');
});
test('post-hit recovery stays distinct from protective immunity as both timers advance',()=>{
 const {g,p,e,action}=combat();
 assert.equal(g.SkillForge.hit(p,e,action('freeze',45)),true);
 assert.equal(e.invincible,12);
 for(let t=0;t<5;t++){
  g.ForgeExpansion.tick(e);if(e.invincible>0)e.invincible--;
 }
 assert.equal(e.invincible,7);assert.equal(e._forgeImpactGrace,7);
 const hp=e.hp;
 assert.equal(g.SkillForge.hit(p,e,action('none',40)),true);
 assert.ok(e.hp<hp,'a distinct attack is not canceled by impact recovery');
 e.invincible=18; // A longer shield must still block every follow-up.
 assert.equal(g.SkillForge.hit(p,e,action('none',40)),false);
 e.invincible=12;e._forgeImpactGrace=0; // An actual 0.2s guard is protected too.
 assert.equal(g.SkillForge.hit(p,e,action('none',40)),false);
});
