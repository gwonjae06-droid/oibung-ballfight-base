'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function harness(){
  const arcs=[];
  const ctx=new Proxy({},{
    get(obj,key){if(key in obj)return obj[key];
      return key==='arc'?(x,y,r)=>arcs.push({x,y,r}):()=>{};},
    set(obj,key,v){obj[key]=v;return true;}
  });
  const h={window:null,players:[],ctx,canvas:{width:500,height:500},
    CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},createHitParticles(){},
    addFloatingText(){},document:{querySelector(){return null;},getElementById(){return null;}},
    getClosestAliveEnemy(p){return h.players.find(e=>e!==p&&e.hp>0)||null;},
    isPlaying:true,isGameOver:false,screenShake:0,shockwaves:[],particles:[],floatingTexts:[]};
  h.window=h;vm.createContext(h);
  for(const file of ['js/features/ability-atlas.js','js/features/forge-expansion.js',
    'js/features/advanced-combat.js','js/features/skill-forge.js','js/core/engine.js'])
    vm.runInContext(read(file),h,{filename:file});
  h.updateUI=()=>{};
  function player(x=100,y=100){
    h.SkillForge.register({name:'P0',color:'#4f7e96',skills:[
      {name:'수동',cooldown:30,trigger:'lowhp',threshold:5,actions:[{type:'heal',damage:1}]}]});
    const p=h.CUSTOM_DEFS.at(-1).createInstance(1);
    p.x=x;p.y=y;p.vx=0;p.vy=0;
    return p;
  }
  function foe(num,x,y,r=18){return {id:'target',playerNum:num,name:'적',x,y,radius:r,
    vx:0,vy:0,hp:300,maxHp:300,invincible:0,forgeEffects:{},jumpState:'ground'};}
  const enemies=p=>h.players.filter(e=>e!==p&&e.hp>0);
  return {h,arcs,player,foe,enemies,
    action:(type,props={})=>({type,damage:40,radius:150,count:1,speed:5,
      duration:2,status:'none',knockback:0,...props}),
    tick(n=1){for(let i=0;i<n;i++)h.update();}
  };
}
test('advanced delayed slash shares weak/fortify status resistance and knockback',()=>{
  const t=harness(),p=t.player(),e=t.foe(2,207,100);t.h.players.push(p,e);
  t.h.ForgeExpansion.applyStatus(e,p,{status:'weak',duration:2});
  t.h.ForgeExpansion.execute(e,{type:'fortify',duration:2,damage:0},p,{enemies:t.enemies});
  const a=t.action('slash',{damage:100,status:'stun',knockback:4});
  assert.equal(t.h.AdvancedCombat.execute(p,a,e,{hit:t.h.SkillForge.hit,enemies:t.enemies}),true);
  t.tick(10);
  assert.equal(e.hp,267,'damage 100 * 0.6 * 0.55 = 33');
  assert.ok(e.forgeEffects.stun?.time>0,'advanced delayed hit applies special status');
  assert.ok(e.vx>0,'advanced delayed hit applies directional knockback');
});
test('existing projectiles and zones advance during stun without new casts',()=>{
  const t=harness(),p=t.player(),e=t.foe(2,200,100);t.h.players.push(p,e);
  p.forgeShots.push({x:100,y:100,vx:10,vy:0,life:30,
    a:t.action('shot',{damage:18,radius:120})});
  p.forgeZones.push({type:'zone',x:200,y:100,r:45,timer:80,ticks:0,
    a:t.action('zone',{damage:26,radius:180,knockback:0})});
  t.h.ForgeExpansion.execute(p,t.action('starfall',{damage:7,count:3}),e,{
    enemies:t.enemies,hit:t.h.SkillForge.hit
  });
  const extra=p.forgeExtras[0],timer=p.forgeZones[0].timer,cd=p.forgeTicks[0];
  t.h.ForgeExpansion.applyStatus(e,p,{status:'stun',duration:2});
  t.tick(32);
  assert.equal(p.x,100,'stunned fighter cannot move');
  assert.ok(e.hp<300,'existing projectiles and zones still hit');
  assert.equal(p.forgeZones[0].timer,timer-32,'zone ticks progress while blocked');
  assert.ok(extra.age>0,'starfall lifecycle progresses while blocked');
  assert.ok(p.forgeTicks[0]>cd,'cooldown recharges');
  assert.equal(p.forgeSerial,0,'no new skill casts under stun');
});
test('orbit damage occurs only at the actual orbiting object position',()=>{
  const t=harness(),p=t.player(),middle=t.foe(2,100,100,12),edge=t.foe(3,190,100,12);
  t.h.players.push(p,middle,edge);
  p.forgeOrbs.push({life:100,phase:-.09,ticks:27,
    a:t.action('orbit',{radius:120,count:1,damage:50})});
  t.h.SkillForge.advanceWorld(p,edge);
  assert.equal(middle.hp,300,'no invisible central AoE');
  assert.equal(edge.hp,280,'one real orb contact deals 40% damage');
});
test('atlas zone periodic damage respects its actual visual radius',()=>{
  const t=harness(),p=t.player(),inside=t.foe(2,200,100,12),
    outside=t.foe(3,294,100,12);
  t.h.players.push(p,inside,outside);
  const a=t.action('zone',{radius:200,damage:35,duration:2,count:1});
  t.h.AbilityAtlas.execute(p,a,inside,{enemies:t.enemies,hit:t.h.SkillForge.hit});
  const z=p.forgeZones[0];
  assert.equal(z.r,70,'pattern cell radius differs from general spell range');
  assert.equal(inside.hp,265);assert.equal(outside.hp,300);
  inside.invincible=0;outside.invincible=0;z.ticks=29;
  t.h.SkillForge.advanceWorld(p,inside);
  assert.equal(inside.hp,251);
  assert.equal(outside.hp,300,'outside the drawn circle cannot be struck');
  assert.match(read('js/features/skill-forge.js'),/\(z\.r\?\?z\.a\.radius\)/);
});
test('mine and meteor warnings draw their actual damage radius',()=>{
  const t=harness(),p=t.player(),e=t.foe(2,220,100);
  t.h.players.push(p,e);
  const a=t.action('mine',{radius:165});
  t.h.ForgeExpansion.execute(p,a,e,{enemies:t.enemies,hit:t.h.SkillForge.hit});
  t.h.ForgeExpansion.draw(p);
  assert.ok(t.arcs.some(entry=>entry.x===p.x&&entry.y===p.y&&entry.r===165),
    'mine full trigger and blast radius must be visible');
  t.tick(20);assert.ok(e.hp<300,'enemy inside marked radius activates mine');
  const m=t.action('meteor',{radius:175});
  t.h.ForgeExpansion.execute(p,m,e,{enemies:t.enemies,hit:t.h.SkillForge.hit});
  t.arcs.length=0;t.h.ForgeExpansion.draw(p);
  assert.ok(t.arcs.some(entry=>entry.r===175),'meteor area is visibly telegraphed');
});
