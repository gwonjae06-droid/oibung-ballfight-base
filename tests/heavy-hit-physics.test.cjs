'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function harness(){
  const played=[];
  const world={window:null,canvas:{width:500,height:500},screenShake:0,Math,
    console,document:{querySelector(){return null;}},
    CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},players:[],
    createHitParticles(){},addFloatingText(){},
    BattleFX:{sound:(kind,volume)=>played.push([kind,volume])},
    getClosestAliveEnemy(p){return world.players.find(e=>e!==p&&e.hp>0)||null;}};
  world.window=world;world.globalThis=world;vm.createContext(world);
  vm.runInContext(read('js/features/impact-physics.js'),world);
  return {world,fx:world.ImpactPhysics,played};
}
const actor=(num,x,y)=>({playerNum:num,x,y,radius:32,hp:300,maxHp:300,vx:0,vy:0,invincible:0,
  forge:{color:'#336699',effectColor:'#336699'}});
test('a landed hit gives large directional momentum, attacker recoil, shake and a visual pulse, without increasing damage',()=>{
  const {world,fx,played}=harness(),a=actor(1,100,100),b=actor(2,180,100);
  assert.equal(fx.hit(a,b,35),true);
  assert.equal(b.hp,300,'physics must never alter combat damage');
  assert.ok(b.vx>=14,'heavy hit must be several times stronger than the old 0.45px blade shove');
  assert.equal(b.vy,0);assert.ok(a.vx<0,'attacker should recoil');
  assert.ok(b.x>180,'the target should react visually on the first frame');
  assert.ok(world.screenShake>=10);
  assert.equal(fx.pulseCount,1);
  assert.equal(played[0][0],'heavy');
  const initial=b.impactSpeed;
  b.vx=-1;fx.integrate(b);
  assert.ok(b.vx>6,'short stagger survives AI movement override');
  assert.ok(b.impactSpeed<initial,'knockback must decay');
  for(let i=0;i<30;i++)fx.tick();
  assert.equal(fx.pulseCount,0);
});
test('every confirmed separate blow generates its own pulse; animation is bounded under ten-player spam',()=>{
  const {world,fx}=harness(),a=actor(1,100,100),b=actor(2,120,140);
  for(let i=0;i<100;i++)fx.hit(a,b,8,{knockback:9});
  assert.equal(fx.pulseCount,80);
  assert.ok(Math.hypot(b.vx,b.vy)<=18.01);
  assert.ok(world.screenShake<=15,'camera shake stays capped');
  assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));
  assert.ok(b.x>=b.radius&&b.x<=world.canvas.width-b.radius);
  fx.reset();assert.equal(fx.pulseCount,0);
});
test('reduced-motion preference suppresses camera shake but keeps gameplay physics',()=>{
  const {world,fx}=harness(),a=actor(1,100,100),b=actor(2,200,100);
  fx.setReduced(true);fx.hit(a,b,50);
  assert.equal(world.screenShake,0);
  assert.ok(b.vx>12);
  const noop=()=>{};
  const ctx=new Proxy({}, {get(o,k){return k in o?o[k]:noop;},set(o,k,v){o[k]=v;return true;}});
  assert.doesNotThrow(()=>fx.draw(ctx));
});
test('custom fighter hits use the physics pipeline only on actual attacks, never on movement',()=>{
  const {world,fx}=harness(),a=actor(1,100,100),b=actor(2,154,100);
  vm.runInContext(read('js/features/skill-forge.js'),world);
  assert.equal(world.SkillForge.hit(a,b,{type:'dash',damage:100,status:'fire',knockback:9}),false);
  assert.equal(b.hp,300);assert.equal(fx.pulseCount,0);
  assert.equal(world.SkillForge.hit(a,b,{type:'wave',damage:26,status:'none',knockback:5}),true);
  assert.equal(b.hp,274);
  assert.equal(fx.pulseCount,1);
  assert.ok(b.vx>10);
  b.invincible=0;
  assert.equal(world.SkillForge.hit(a,b,{type:'wave',damage:26,status:'none',knockback:5}),true);
  assert.equal(b.hp,248);assert.equal(fx.pulseCount,2);
});
test('all five classic fighters, high-level attacks, and aftershock wire to the same confirmed-hit response',()=>{
  const characters=['bae','lee','park','oh','choi'];
  for(const id of characters){
    const src=read('js/characters/'+id+'.js');
    const count=(src.match(/ImpactPhysics\?\.hit\?\./g)||[]).length;
    assert.ok(count>=1,'no physical impact wired for '+id);
  }
  assert.equal((read('js/characters/oh.js').match(/ImpactPhysics\?\.hit\?\./g)||[]).length,4,
    'projectiles, tear shots, aura and rush must each be physical');
  assert.ok(read('js/features/character-remix.js').includes('ImpactPhysics?.hit?.'));
  const engine=read('js/core/engine.js');
  assert.ok(engine.includes('ImpactPhysics?.integrate?.(p)'));
  assert.ok(engine.includes('ImpactPhysics?.hit?.(attacker,defender,value'));
  assert.ok(read('js/core/render.js').includes('ImpactPhysics?.draw?.(ctx)'));
  const html=read('index.html');
  assert.ok(html.indexOf('js/features/impact-physics.js')<html.indexOf('js/characters/bae.js'),
    'physics must be loaded before the original character damage handlers');
  assert.ok(read('js/features/battle-effects.js').includes('ImpactPhysics?.setReduced?.'));
});
