'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function setup(){
  const calls=[];
  const ctx=new Proxy({},{get(o,k){
    if(k in o)return o[k];
    if(k==='createRadialGradient')return ()=>({addColorStop(){}});
    return (...args)=>{calls.push([k,...args]);};
  },set(o,k,v){o[k]=v;return true;}});
  const w={window:null,globalThis:null,canvas:{width:600,height:600},
    screenShake:0,players:[],BEHAVIORS:{},Math,console,ctx,
    isPlaying:true,isGameOver:false,particles:[],shockwaves:[],floatingTexts:[],
    updateCharacter(){},updateUI(){},getClosestAliveEnemy:()=>null,
    arenaEffectColor:c=>c,createHitParticles(){},addFloatingText(){}};
  w.window=w;w.globalThis=w;vm.createContext(w);
  vm.runInContext(read('js/features/skill-visuals.js'),w);
  vm.runInContext(read('js/features/impact-physics.js'),w);
  const actor=(id,x,y)=>({id,playerNum:id==='a'?1:2,name:id,
    x,y,radius:27,vx:0,vy:0,hp:200,invincible:0,
    borderColor:'#87654b',forge:{effectColor:'#7c48bd'}});
  return {w,fx:w.SkillVisuals,imp:w.ImpactPhysics,ctx,calls,actor};
}
test('legacy 2D actor fallback is flat while player image, wardrobe and HiDPI remain untouched',()=>{
  const s=read('js/core/render.js');
  assert.ok(s.includes('Original clean, flat 2D silhouette'));
  assert.ok(!s.includes('const surface=ctx.createRadialGradient'));
  assert.ok(s.includes('drawBorder?.(ctx,p,radius)'));
  assert.ok(s.includes('ctx.drawImage(img,-radius,-radius'));
  assert.ok(s.includes('SkillVisuals?.drawAction?.(ctx,p,z)'));
  assert.ok(read('index.html').includes('js/features/arena-resolution.js'));
  assert.ok(read('js/features/arena-resolution.js').includes('context.setTransform(scale,0,0,scale,0,0)'));
});
test('mobility types never create physics knockback even when given raw legacy damage',()=>{
  const {imp,actor}=setup();
  for(const type of ['dash','blink','leap','hover','glide','swap','retreat','portal']){
    const a=actor('a',100,100),b=actor('b',120,100);
    assert.equal(imp.hit(a,b,99,{type}),false,type);
    assert.equal(b.impactVX,undefined);
    assert.equal(b.hp,200);
  }
});
test('pure dash overlaps are resolved by moving the dasher only; no body attacks',()=>{
  const {w,actor}=setup();
  vm.runInContext(read('js/core/engine.js'),w);
  const a=actor('a',100,100),b=actor('b',145,100);
  a.vx=6;a.forgeDash=12;
  w.BEHAVIORS.a={order:1,onContact(_,other){other.hp-=5;}};
  w.BEHAVIORS.b={order:1,onContact(_,other){other.hp-=5;}};
  w.players=[a,b];
  const bx=b.x,by=b.y,bvx=b.vx,bvy=b.vy;
  w.handleCombat(a,b);
  assert.equal(b.x,bx);
  assert.equal(b.y,by);
  assert.equal(b.vx,bvx);
  assert.equal(b.vy,bvy);
  assert.equal(a.hp,200);
  assert.equal(b.hp,200);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.radius+b.radius-.01);
  a.forgeDash=0;a.x=100;b.x=145;a.vx=0;
  w.handleCombat(a,b);
  assert.equal(b.hp,195,'ordinary post-dash contact is still possible');
});
test('short impact decays rapidly and never changes damage',()=>{
  const {imp,actor}=setup(),a=actor('a',100,100),b=actor('b',300,100);
  assert.equal(imp.hit(a,b,40,{type:'uppercut'}),true);
  assert.ok(b.impactFrames<=11);
  const steps=[];
  for(let i=0;i<15;i++){const old=b.x;imp.integrate(b);steps.push(b.x-old);}
  assert.ok(steps[0]>15);
  assert.ok(steps[1]<steps[0]*.7);
  assert.ok(steps[6]<3);
  assert.equal(steps[12],0);
  assert.equal(b.hp,200);
});
test('all seven visual families perform real Canvas draws without changing HP',()=>{
  const {fx,ctx,calls,actor}=setup();
  const p=actor('a',180,180),target=actor('b',220,180);
  const actions=[
    {type:'uppercut',radius:70},{type:'shot',radius:120},{type:'wave',radius:90},
    {type:'dash',radius:70},{type:'timestop',radius:140},
    {type:'nova',radius:100},{type:'blackhole',radius:120}
  ];
  actions.forEach(a=>assert.equal(fx.cast(p,a,target),true,a.type));
  assert.equal(fx.active,7);
  for(let i=0;i<10;i++)fx.tick();
  assert.doesNotThrow(()=>fx.draw(ctx));
  assert.doesNotThrow(()=>fx.drawAction(ctx,p,0));
  assert.ok(calls.some(c=>c[0]==='ellipse'),'galaxy should have actual spiral ellipses');
  assert.ok(calls.some(c=>c[0]==='arc'),'clock, wave and blast have visible circular geometry');
  assert.ok(calls.some(c=>c[0]==='lineTo'),'moving hands and speed lines are drawn');
  assert.equal(p.hp,200);assert.equal(target.hp,200,'drawing must never deal damage');
  fx.setReduced(true);
  assert.doesNotThrow(()=>fx.draw(ctx));
});
test('fist pose follows the caster, and a successful legacy hit can animate a punch',()=>{
  const {fx,ctx,calls,actor}=setup();
  const p=actor('a',110,140),target=actor('b',149,140);
  fx.contact(p,target);
  for(let i=0;i<7;i++)fx.tick();
  fx.drawAction(ctx,p);
  assert.ok(calls.some(c=>c[0]==='quadraticCurveTo'),'arm must have actual articulated segment');
  assert.ok(calls.some(c=>c[0]==='arc'),'drawn hand must be visible');
});
test('explosions run through three visual phases without three damage events',()=>{
  const {fx,ctx,actor,calls}=setup(),p=actor('a',150,150),e=actor('b',200,150);
  assert.equal(fx.detonate(p,'meteor',200,150,95),true);
  const drawn=[];
  for(const age of [2,10,20]){
    calls.length=0;
    fx.draw(ctx);
    drawn.push(calls.filter(c=>c[0]==='arc').length);
    for(let j=0;j<(age===2?8:age===10?10:0);j++)fx.tick();
  }
  assert.ok(drawn.every(v=>v>0));
  assert.notEqual(drawn[0],drawn[1],'ignition and burst use distinct geometry');
  assert.equal(e.hp,200);
  const src=read('js/features/forge-expansion.js');
  assert.ok(src.includes("SkillVisuals?.detonate?.(p,b.kind"));
  assert.ok(src.includes("SkillVisuals?.detonate?.(p,'starfall'"));
  assert.ok(read('js/features/advanced-combat.js').includes('SkillVisuals?.detonate?.(p,action.type'));
});
test('time-watch hands, directional wave and cosmic galaxy have dedicated effects',()=>{
  const s=read('js/features/skill-visuals.js');
  assert.ok(s.includes("const minutes=direction*phase*Math.PI*2*revolutions"));
  assert.ok(s.includes("const direction=e.type==='rewind'?-1:1"));
  assert.ok(s.includes("e.type==='timestop'?Math.min(t/.6,1):t"));
  assert.ok(s.includes("arc(c,0,0,r,0,Math.PI*2)"));
  assert.ok(s.includes("c.beginPath();c.ellipse(0,0,radius*.85"));
  assert.ok(s.includes("ghosts.push({x:e.lastX,y:e.lastY"));
  assert.ok(s.includes('const MOTION_LIMIT=50'));
});
