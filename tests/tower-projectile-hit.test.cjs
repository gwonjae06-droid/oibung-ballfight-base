'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
function base(){
  const w={window:null,players:[],Math,Date,console,canvas:{width:500,height:500},
    CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
    createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(p){
      return w.players.find(e=>e!==p&&e.hp>0)||null;
    }};
  w.window=w;vm.createContext(w);
  vm.runInContext(read('js/features/action-registry.js'),w);
  return w;
}
const action=type=>({type,damage:42,radius:120,count:1,speed:7,
  duration:1.7,status:'none',knockback:0,delay:0,pattern:'direct',target:'nearest'});
test('swept circle checks the entire trajectory rather than only its endpoint',()=>{
  const w=base(),circle=w.ActionRegistry.sweptCircle;
  assert.equal(circle(80,100,180,100,130,100,15),true);
  assert.equal(circle(80,100,180,100,130,141,15),false);
  assert.equal(circle(100,100,100,100,100,100,5),true,'stationary projectile');
  assert.equal(circle(100,100,100,100,115,100,5),false);
});
test('standard shot connects when bullet crosses fighter between two simulation frames',()=>{
  const w=base();
  w.AdvancedCombat={canHit(p,e,z){return Math.abs(z-(e.z||0))<=30;},blockSegment(){return null;}};
  vm.runInContext(read('js/features/skill-forge.js'),w);
  const id=w.SkillForge.register({name:'발사자',hp:250,speed:1.8,
    skills:[{name:'테스트',trigger:'auto',cooldown:30,actions:[action('shot')]}]});
  const p=w.CUSTOM_DEFS.find(x=>x.id===id).createInstance(1);
  const enemy={playerNum:2,id:'target',x:135,y:100,z:0,
    hp:250,maxHp:250,radius:10,invincible:0};
  p.x=80;p.y=100;p.z=100;p.vx=0;p.vy=0;p.forgeTicks[0]=0;
  p.forgeShots.push({x:80,y:100,vx:90,vy:0,life:8,a:action('shot')});
  w.players.push(p,enemy);
  assert.equal(Math.hypot(enemy.x-170,enemy.y-100)>enemy.radius+8,true,'endpoint misses');
  w.BEHAVIORS[id].update(p,enemy);
  assert.equal(enemy.hp,208,'swept ground-level projectile must damage grounded enemy');
  assert.equal(p.forgeShots.length,0,'successful bullet hit consumes projectile');
});
test('expansion projectiles use swept ground-level contact too',()=>{
  const w=base();
  vm.runInContext(read('js/features/forge-expansion.js'),w);
  const p={playerNum:1,hp:200,maxHp:200,radius:25,x:80,y:100,z:110,
    forge:{color:'#4288aa'},forgeExtras:[]};
  const e={playerNum:2,hp:200,maxHp:200,radius:10,x:135,y:100,z:0};
  const a=action('pierce');
  p.forgeExtras.push({kind:'pierce',x:80,y:100,vx:90,vy:0,
    hits:[],a,age:0,life:15,target:2});
  w.players.push(p,e);
  const hits=[];
  w.ForgeExpansion.update(p,{enemies(){return [e];},hit(attacker,target,act,mult,z){
    hits.push(z);
    if(z!==0)return false;
    e.hp-=act.damage;
    return true;
  }});
  assert.equal(e.hp,158);
  assert.deepEqual(hits,[0]);
  assert.equal(p.forgeExtras[0].hits[0],2);
});
test('a protected enemy retains invulnerability instead of receiving false damage',()=>{
  const w=base();
  vm.runInContext(read('js/features/skill-forge.js'),w);
  const p={playerNum:1,hp:200,x:100,y:100,forge:{color:'#4288aa'}};
  const e={playerNum:2,hp:200,x:125,y:100,invincible:8};
  assert.equal(w.SkillForge.hit(p,e,action('shot'),1,0),false);
  assert.equal(e.hp,200);
});
