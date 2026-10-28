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
  assert.ok(b.impactVX>=25,'heavy hits now use a separate explosive impulse far above capped running speed');
  assert.equal(b.impactVY,0);assert.ok(a.vx<0,'attacker should recoil');
  assert.ok(b.x>180,'the target should react visually on the first frame');
  assert.ok(world.screenShake>=10);
  assert.equal(fx.pulseCount,1);
  assert.equal(played[0][0],'heavy');
  const initial=b.impactSpeed;
  b.vx=-1;const before=b.x;fx.integrate(b);
  assert.ok(b.x-before>18,'first knockback frame must travel explosively');
  assert.equal(b.vx,-1,'forced velocity must not overwrite the fighter AI');
  assert.ok(b.impactSpeed<initial,'knockback must decay smoothly');
  for(let i=0;i<30;i++)fx.tick();
  assert.equal(fx.pulseCount,0);
});
test('every confirmed separate blow generates its own pulse; animation is bounded under ten-player spam',()=>{
  const {world,fx}=harness(),a=actor(1,100,100),b=actor(2,120,140);
  for(let i=0;i<100;i++)fx.hit(a,b,8,{knockback:9});
  assert.equal(fx.pulseCount,80);
  assert.ok(Math.hypot(b.impactVX,b.impactVY)<=48.01,'stacking hits cannot create runaway momentum');
  assert.ok(world.screenShake<=15,'camera shake stays capped');
  assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));
  assert.ok(b.x>=b.radius&&b.x<=world.canvas.width-b.radius);
  fx.reset();assert.equal(fx.pulseCount,0);
});
test('reduced-motion preference suppresses camera shake but keeps gameplay physics',()=>{
  const {world,fx}=harness(),a=actor(1,100,100),b=actor(2,200,100);
  fx.setReduced(true);fx.hit(a,b,50);
  assert.equal(world.screenShake,0);
  assert.ok(b.impactVX>26);
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
  assert.ok(b.impactVX>20);
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

test('knockback starts explosively, decays smoothly and returns to ordinary movement',()=>{
  const {world,fx}=harness(),a=actor(1,100,100),b=actor(2,250,100);
  world.canvas.width=1800;
  b.vx=2;b.vy=1;
  fx.hit(a,b,32);
  const distances=[];
  for(let i=0;i<30;i++){
    const x=b.x,y=b.y;
    fx.integrate(b);
    distances.push(Math.hypot(b.x-x,b.y-y));
  }
  assert.ok(distances[0]>20,'first frame remains punchy but is intentionally shorter');
  assert.ok(distances[1]<distances[0] && distances[1]>distances[0]*.5,
    'second frame should retain most of the speed but be slower');
  assert.ok(distances[8]<distances[0]*.3,'momentum dissipates rapidly without snapping to a stop');
  assert.ok(distances[4]>0,'the hit decays for multiple frames');
  assert.equal(distances[15],0,'knockback no longer persists after the short recovery window');
  assert.ok(distances[20]<3,'return toward normal locomotion by 1/3 second');
  assert.equal(b.impactSpeed,0,'finite trailing momentum must settle completely');
  assert.equal(b.vx,2,'normal forward movement resumes untouched');
  assert.equal(b.vy,1);
  assert.equal(b.hp,300,'more force must not change damage');
});
test('powerful knockback reflects off walls and never escapes the arena',()=>{
  const {world,fx}=harness(),a=actor(1,380,200),b=actor(2,458,200);
  fx.hit(a,b,100);
  const path=[];
  for(let i=0;i<30;i++){
    fx.integrate(b);
    path.push(b.x);
    assert.ok(b.x<=world.canvas.width-b.radius && b.x>=b.radius);
    assert.ok(b.y<=world.canvas.height-b.radius && b.y>=b.radius);
  }
  assert.ok(path.some((x,i)=>i>2&&x<path[0]-1),
    'the fighter bounces back after impacting the wall');
  assert.equal(b.hp,300);
});
test('engine applies hit momentum outside normal 12px speed cap and then settles',()=>{
  const {world,fx}=harness(),a=actor(1,100,100),b=actor(2,230,100);
  world.updateCharacter=()=>{};
  world.isPlaying=true;world.isGameOver=false;world.screenShake=0;
  world.particles=[];world.floatingTexts=[];world.shockwaves=[];
  world.updateUI=()=>{};
  vm.runInContext(read('js/core/engine.js'),world);
  world.updateUI=()=>{};
  world.players=[a,b];
  b.vx=2;b.vy=0;
  fx.hit(a,b,30);
  const previous=b.x;
  world.update();
  assert.ok(b.x-previous>20,'force is applied separately from the engine movement cap');
  assert.equal(b.vx,2,'base motion remains unchanged by knockback integration');
  const firstStep=b.x-previous;
  const next=b.x;
  world.update();
  assert.ok(b.x-next<firstStep,'knockback loses momentum quickly');
  for(let i=0;i<35;i++)world.update();
  assert.equal(b.impactSpeed,0);
  assert.equal(b.hp,300,'no extra HP loss from the impact itself');
});

test('being hurled into another fighter does not cause additional contact damage',()=>{
  const {world}=harness(),a=actor(1,100,100),b=actor(2,150,100);
  world.updateCharacter=()=>{};
  world.BEHAVIORS.attacker={order:1,onContact(self,other){other.hp-=9;}};
  world.BEHAVIORS.target={order:1,onContact(self,other){other.hp-=9;}};
  a.id='attacker';b.id='target';
  vm.runInContext(read('js/core/engine.js'),world);
  world.players=[a,b];
  b.impactSpeed=55;b.impactVX=-30;b.impactVY=0;
  world.handleCombat(a,b);
  assert.equal(a.hp,300);assert.equal(b.hp,300,
    'forced collisions are positional only, not accidental bonus attacks');
  a.x=100;b.x=145;b.impactSpeed=0;b.impactVX=0;
  world.handleCombat(a,b);
  assert.equal(a.hp,291);assert.equal(b.hp,291,
    'ordinary contact attacks remain available after the knockback ends');
});
