'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function harness(){
  const w={window:null,Math,console,players:[],BEHAVIORS:{},CUSTOM_DEFS:[],
    CHARACTER_PHOTOS:{},canvas:{width:500,height:500},
    document:{querySelector(){return null;}},
    createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(p){
      return w.players.find(x=>x!==p&&x.hp>0)||null;
    }};
  w.window=w;vm.createContext(w);
  vm.runInContext(read('js/features/action-registry.js'),w);
  vm.runInContext(read('js/features/ability-atlas.js'),w);
  vm.runInContext(read('js/features/skill-forge.js'),w);
  return w;
}
function fighter(n=1){return {id:n===1?'park':'enemy',playerNum:n,name:'파이터',
  x:n===1?100:145,y:100,vx:1,vy:0,hp:300,maxHp:300,radius:25,
  invincible:0,jumpState:'ground',themeColor:'#4588aa',getTag(){return null;}};}
test('manual built-in fighters gain four real reusable skills without modifying saved roster',()=>{
  const w=harness(),p=fighter(),target=fighter(2);w.players=[p,target];
  assert.equal(w.SkillForge.enableManual(p),true);
  assert.equal(p.manualTower,true);
  assert.equal(p.forge.skills.length,4);
  assert.equal(w.CUSTOM_DEFS.length,0);
  assert.ok(w.SkillForge.manualCast(p,0,target));
  assert.ok(p.forgeQueue.length>0);
  assert.equal(w.SkillForge.manualCast(p,0,target),false,'cooldown prevents immediate double-cast');
  w.SkillForge.manualUpdate(p,target);
  assert.ok(p.forgeTicks[0]>0,'independent cooldown ticks while manually controlled');
});
test('custom four-skill fighter remains under player input rather than automatic activation',()=>{
  const w=harness();
  const skills=Array.from({length:4},(_,i)=>({name:'기술 '+i,
    trigger:'auto',cooldown:1+i,actions:[{type:'shot',damage:12+i,
      speed:6,count:1,radius:100,knockback:0,status:'none'}]}));
  const id=w.SkillForge.register({name:'제작 파이터',hp:250,speed:2,skills});
  const p=w.CUSTOM_DEFS[0].createInstance(1),target=fighter(2);
  p.x=100;p.y=100;w.players=[p,target];
  assert.equal(w.SkillForge.enableManual(p),true);
  for(let i=0;i<80;i++)w.SkillForge.manualUpdate(p,target);
  assert.equal(p.forgeShots.length,0,'manual update never fires an automatic skill');
  assert.equal(p.forgeQueue.length,0);
  assert.equal(w.SkillForge.manualCast(p,1,target),true);
  assert.equal(w.SkillForge.manualCast(p,1,target),false);
  assert.equal(p.forgeTicks[1],0);
  w.SkillForge.manualUpdate(p,target);
  assert.ok(p.forgeShots.length>0,'pressed skill executes through real projectile engine');
  assert.equal(p.forgeTicks[0],w.SkillForge.cooldownFrames(p,p.forge.skills[0]),
    'using E does not reset Q cooldown');
  assert.ok(w.BEHAVIORS[id], 'normal saved fighter behavior is unchanged for auto matches');
});
test('manual activation obeys stun/silence, living target and skill slot limits',()=>{
  const w=harness(),p=fighter(),target=fighter(2);w.players=[p,target];
  w.SkillForge.enableManual(p);
  assert.equal(w.SkillForge.manualCast(p,4,target),false);
  assert.equal(w.SkillForge.manualCast(p,-1,target),false);
  assert.equal(w.SkillForge.manualCast(p,0,null),false);
  w.ForgeExpansion={blocked(){return true;}};
  assert.equal(w.SkillForge.manualCast(p,0,target),false);
  assert.equal(p.forgeTicks[0],w.SkillForge.cooldownFrames(p,p.forge.skills[0]));
});
