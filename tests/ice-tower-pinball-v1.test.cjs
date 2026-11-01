'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={Math,Date,Set,Map,WeakMap,console,addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['tower-ice-glacier','tower-ice-boss-fx','tower-spectacle'])
  vm.runInContext(read('js/features/'+file+'.js'),g,{filename:file});
 return g;
}
const ball=(x,y)=>({x,y,vx:0,vy:0,hp:1000,maxHp:1000,radius:20,
 forgeShots:[],bfShots:[],towerDefense:1});
function make(){
 const g=world(),h=ball(65,65),b=ball(420,420);let hits=0,weak=0;
 const s=g.ArenaIceGlacier.create({width:500,height:500,hero:h,boss:b,
  damage(){hits++;return true;},weakpoint(){weak++;}});
 return {g,h,b,s,hits:()=>hits,weak:()=>weak};
}
function canvas(){
 const ops=[],obj={createRadialGradient(){return {addColorStop(){}};},
  createLinearGradient(){return {addColorStop(){}};},
  measureText(v){return {width:String(v).length*8};}};
 const c=new Proxy(obj,{get(o,k){return k in o?o[k]:(...args)=>{ops.push([k,...args]);};},
 set(o,k,v){o[k]=v;return true;}});
 return {c,ops};
}
test('5F mirror crystals stay inactive during the telegraph',()=>{
 const {h,s,hits}=make();s.begin(1,0);
 h.forgeShots=[{x:140,y:250,vx:2,vy:1}];
 for(let i=0;i<94;i++)s.step();
 assert.equal(h.vx,0);assert.equal(h.vy,0);
 assert.equal(hits(),0);assert.equal(h.forgeShots[0].vx,2);
});
test('5F and 10F grow distinct deterministic crystal families',()=>{
 const {s}=make();s.begin(1,0);
 const a=s.prismAt(0,160),b=s.prismAt(0,161);
 assert.notEqual(a.y,b.y,'mirrors rotate in actual geometry');
 assert.ok(a.radius>0);
 s.begin(2,0);
 assert.ok(s.prismAt(0,160).radius>a.radius,'boss size affects hitboxes');
});
test('physical ice prisms reflect the ball, earn momentum, and rate-limit damage',()=>{
 const {g,h,s,hits}=make();let squash=0,energy=0;
 g.ArenaBallSquash={wall(){squash++;}};g.BounceMomentum={wall(){energy++;}};
 s.begin(1,0);for(let i=0;i<160;i++)s.step();
 let prism=s.prismAt(0,161);
 h.x=prism.x+5;h.y=prism.y;h.vx=-4;h.vy=0;s.step();
 assert.ok(h.vx>0);assert.equal(hits(),1);assert.ok(squash>0);assert.ok(energy>0);
 for(let i=0;i<25;i++){
  prism=s.prismAt(0,s.age+1);
  h.x=prism.x+5;h.y=prism.y;h.vx=-4;h.vy=0;s.step();
 }
 assert.equal(hits(),1,'a single rotating prism cannot damage each frame');
});
test('authored projectiles bounce on the same ice prism radius',()=>{
 const {h,s}=make();s.begin(1,0);
 for(let i=0;i<161;i++)s.step();
 const q=s.prismAt(0,162);
 const shot={x:q.x+q.radius*.75,y:q.y,vx:-3,vy:0};
 h.forgeShots.push(shot);s.step();
 assert.ok(shot.vx>0,'incoming projectile must reflect physically');
 assert.ok(s.projectilesBent>=1);
 const n=s.projectilesBent;
 s.step();assert.equal(s.projectilesBent,n,'same shot cannot bounce every frame');
});
test('absolute-zero phase slows only the hero, preserving heading without status-damage',()=>{
 const {h,b,s,hits}=make();s.begin(1,1);
 h.x=250;h.y=250;h.vx=5;h.vy=0;b.vx=5;b.vy=0;
 for(let i=0;i<170;i++)s.step();
 assert.ok(h.vx<5&&h.vx>1);
 assert.equal(h.vy,0);assert.equal(b.vx,5,'boss stays at full speed');
 assert.equal(h._towerIceAbsoluteZero,2);
 assert.equal(hits(),0);
 h.forgeShots=[{x:250,y:250,vx:4,vy:-2}];s.step();
 assert.ok(h.forgeShots[0].vx<4&&h.forgeShots[0].vx>0);
 assert.ok(h.forgeShots[0].vy<0);
 s.clear();assert.equal(h._towerIceAbsoluteZero,0);
});
test('expanding frost ring has the same physical and illustrated radius with one-hit cooldown',()=>{
 const {h,s,hits}=make();s.begin(1,1);
 for(let i=0;i<188;i++)s.step();
 const ring=s.frostRing(189);
 h.x=250+ring.r;h.y=250;h.vx=0;h.vy=0;
 s.step();assert.ok(hits()>=1);
 const first=hits();
 for(let i=0;i<35;i++){
  const next=s.frostRing(s.age+1);
  h.x=250+next.r;h.y=250;s.step();
 }
 assert.equal(hits(),first,'ring needs a cooldown');
});
test('10F moving glacier walls have a central navigable gap and reflect contact',()=>{
 const {h,s,hits}=make();s.begin(2,2);
 for(let i=0;i<240;i++)s.step();
 const q=s.wallAt(0,241);
 h.x=q.x1+2;h.y=(q.y1+q.y2)/2;h.vx=-3;h.vy=0;s.step();
 assert.ok(hits()>=1);assert.ok(Math.hypot(h.vx,h.vy)>0);
 const upper=s.wallAt(0,241),lower=s.wallAt(2,241);
 assert.ok(upper.y2<lower.y1-60,'an open navigation lane must remain');
 assert.ok(Math.abs(upper.x1-250)>45,'moving walls must not close the center');
});
test('physical ice lance impacts airborne and ground fighters differently',()=>{
 const {h,s,hits}=make();s.begin(2,2);
 for(let i=0;i<247;i++)s.step();
 const q=s.lanceAt(0,248);
 h.x=q.x;h.y=q.y;h.z=100;s.step();
 assert.equal(hits(),0,'high jump clears the ground lance');
 h.z=0;
 const next=s.lanceAt(0,249);
 h.x=next.x;h.y=next.y;s.step();
 assert.ok(hits()>0,'ground impact collides');
});
test('two separated physical core collisions open exactly one weakpoint',()=>{
 const {h,s,weak}=make();s.begin(1,1);
 for(let i=0;i<180;i++)s.step();
 h.x=270;h.y=250;h.vx=-4;h.vy=0;s.step();
 assert.equal(s.contacts,1);assert.equal(weak(),0);
 h.x=60;h.y=60;h.vx=0;h.vy=0;
 for(let i=0;i<70;i++)s.step();
 h.x=270;h.y=250;h.vx=-4;h.vy=0;s.step();
 assert.equal(s.contacts,2);assert.equal(weak(),1);
 h.x=60;h.y=60;
 for(let i=0;i<75;i++)s.step();
 h.x=270;h.y=250;h.vx=-4;s.step();
 assert.equal(weak(),1);
});
test('draw and responsive page effects never alter physics, cooldowns, or HP',()=>{
 const {g,h,s,hits}=make(),{c,ops}=canvas();
 for(let variant=0;variant<3;variant++){
  s.begin(2,variant);for(let i=0;i<180;i++)s.step();
  const state=JSON.stringify(h),prior=hits();
  assert.doesNotThrow(()=>s.draw(c));
  assert.doesNotThrow(()=>g.ArenaIceBossFX.page(c,{realm:'ice',variant,progress:.5,start:0},200,1350,900,false));
  assert.doesNotThrow(()=>g.ArenaIceBossFX.page(c,{realm:'ice',variant,progress:.5,start:0},200,390,844,true));
  assert.equal(JSON.stringify(h),state);assert.equal(hits(),prior);
 }
 assert.ok(ops.some(x=>x[0]==='arc'||x[0]==='ellipse'));
});
test('ice only runs on boss floors and all 10F variants share energy-controlled engine',()=>{
 const g=world(),h=ball(80,80),b=ball(430,430);
 const ordinary=g.ArenaTowerSpectacle.create({realm:'ice',level:4,width:500,height:500,hero:h,boss:b,damage(){}});
 for(let i=0;i<1200;i++)ordinary.step();
 assert.equal(ordinary.glacier,null);assert.equal(ordinary.event,null);
 const boss=g.ArenaTowerSpectacle.create({realm:'ice',level:10,width:500,height:500,hero:h,boss:b,damage(){return true;}});
 const variants=new Set();
 for(let i=0;i<2300;i++){boss.step();if(boss.event)variants.add(boss.event.variant);}
 assert.deepEqual([...variants].sort(),[0,1,2]);
 assert.ok(boss.glacier.active);assert.equal(boss.zones.length,0);
 boss.clear();assert.equal(boss.glacier.active,false);
});
test('glacier weak defense restores on timeout and forfeiting cleans freeze flags',()=>{
 const g=world(),h=ball(80,80),b=ball(430,430);
 const e=g.ArenaTowerSpectacle.create({realm:'ice',level:5,width:500,height:500,hero:h,boss:b,damage(){return true;}});
 for(let i=0;i<422;i++)e.step(); // variant 0, age 181
 h.x=270;h.y=250;h.vx=-4;h.vy=0;e.step();
 h.x=65;h.y=65;h.vx=0;h.vy=0;
 for(let i=0;i<68;i++)e.step();
 h.x=270;h.y=250;h.vx=-4;e.step();
 assert.equal(b.towerDefense,1.5);
 for(let i=0;i<181;i++)e.step();
 assert.equal(b.towerDefense,1);
 e.clear();assert.equal(h._towerIceAbsoluteZero||0,0);
});
test('HTML loads the glacier and page scripts before spectacle and invalidates cached JS',()=>{
 const html=read('index.html'),spec=read('js/features/tower-spectacle.js');
 assert.ok(html.indexOf('tower-ice-glacier.js')<html.indexOf('tower-spectacle.js'));
 assert.ok(html.indexOf('tower-ice-boss-fx.js')<html.indexOf('tower-spectacle.js'));
 assert.match(html,/tower-spectacle\.js\?v=fx25d1-clock-v2-space-v2-fire-v1-storm-v1-ice-v1/);
 assert.match(spec,/glacier\?\.step\(\)/);assert.match(spec,/glacier\?\.draw\(ctx\)/);
 assert.match(spec,/ArenaIceBossFX\?\.page/);
});
