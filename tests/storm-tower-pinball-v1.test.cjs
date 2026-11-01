'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),
 fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={Math,Date,Set,Map,WeakMap,console,addFloatingText(){}};
 g.globalThis=g;g.window=g;vm.createContext(g);
 for(const f of ['tower-storm-supercell','tower-storm-boss-fx','tower-spectacle'])
  vm.runInContext(read('js/features/'+f+'.js'),g,{filename:f});
 return g;
}
const ball=(x,y)=>({x,y,vx:0,vy:0,hp:1000,maxHp:1000,radius:20,
 forgeShots:[],bfShots:[]});
function make(){
 const g=world(),h=ball(65,65),b=ball(420,420);
 let hits=0,weak=0;
 const s=g.ArenaStormSupercell.create({width:500,height:500,hero:h,boss:b,
  damage(){hits++;return true;},weakpoint(){weak++;}});
 return {g,h,b,s,hits:()=>hits,weak:()=>weak};
}
function canvas(){
 const ops=[],obj={createRadialGradient(){return {addColorStop(){}};},
  createLinearGradient(){return {addColorStop(){}};},
  measureText(v){return {width:String(v).length*8};}};
 const c=new Proxy(obj,{
  get(o,k){return k in o?o[k]:(...args)=>{ops.push([k,...args]);};},
  set(o,k,v){o[k]=v;return true;}
 });
 return {c,ops};
}
test('5F hurricane waits for its telegraph before touching real momentum or projectiles',()=>{
 const {h,s,hits}=make();s.begin(1,0);
 h.forgeShots=[{x:140,y:250,vx:2,vy:1}];
 for(let i=0;i<109;i++)s.step();
 assert.equal(h.vx,0);assert.equal(h.vy,0);
 assert.equal(h.forgeShots[0].vx,2);assert.equal(h.forgeShots[0].vy,1);
 assert.equal(hits(),0);
});
test('5F supercell rotates ball AND authored ranged shots with real wind',()=>{
 const {h,s}=make();s.begin(1,0);
 h.x=96;h.y=250;
 h.forgeShots=[{x:100,y:250,vx:1,vy:0}];
 for(let i=0;i<160;i++)s.step();
 assert.ok(Math.hypot(h.vx,h.vy)>.1);
 assert.ok(h.forgeShots[0].vy<-.01,'wind must bend the projectile tangent to vortex');
});
test('storm blade capsule hitbox matches the drawn rotating spoke, reflects and bounds hits',()=>{
 const {g,h,s,hits}=make();
 let squash=0,energy=0;
 g.ArenaBallSquash={wall(){squash++;}};
 g.BounceMomentum={wall(){energy++;}};
 s.begin(1,0);for(let i=0;i<169;i++)s.step();
 const arm=s.spokeAt(0,170);
 h.x=(arm.x1+arm.x2)/2;h.y=(arm.y1+arm.y2)/2;h.vx=0;h.vy=0;
 s.step();
 assert.ok(Math.hypot(h.vx,h.vy)>.1);
 assert.ok(hits()>=1);assert.ok(squash>0);assert.ok(energy>0);
 const prior=hits();
 for(let i=0;i<23;i++){
  const a=s.spokeAt(0,s.age+1);
  h.x=(a.x1+a.x2)/2;h.y=(a.y1+a.y2)/2;
  s.step();
 }
 assert.equal(hits(),prior,'same rotating blade cannot deal damage each frame');
});
test('5F chain lightning has three real rods, with warned timed arcs and cooldown',()=>{
 const {h,s,hits}=make();s.begin(1,1);
 assert.equal(s.rods.length,3);
 for(let i=0;i<174;i++)s.step();
 assert.equal(hits(),0);
 const line=s.arcAt(0);
 h.x=(line.x1+line.x2)/2;h.y=(line.y1+line.y2)/2;
 s.step();
 assert.equal(s.arcLive(0,s.age),true);
 assert.ok(hits()>=1);
 const once=hits();
 for(let i=0;i<15;i++){
  const l=s.arcAt(0);
  h.x=(l.x1+l.x2)/2;h.y=(l.y1+l.y2)/2;
  s.step();
 }
 assert.equal(hits(),once,'a beam must not hit on every frame');
});
test('10F lightning lattice and projectiles share the exact beam geometry',()=>{
 const {h,s}=make();s.begin(2,1);
 assert.equal(s.rods.length,5);
 for(let i=0;i<174;i++)s.step();
 const l=s.arcAt(0),shot={x:(l.x1+l.x2)/2,y:(l.y1+l.y2)/2,vx:0,vy:0};
 h.forgeShots.push(shot);s.step();
 assert.ok(Math.hypot(shot.vx,shot.vy)>.1,'real beam displaces a projectile');
 assert.ok(s.arcLive(0,s.age));
 assert.equal(s.arcLive(1,s.age),false,'next zap requires a new warning');
});
test('10F thunderbird dive moves an electric orb whose visible radius is the physical hitbox',()=>{
 const {h,s,hits}=make();s.begin(2,2);
 for(let i=0;i<211;i++)s.step();
 const p=s.diveAt(0,212);
 h.x=p.x+5;h.y=p.y;h.vx=-2;h.vy=0;
 s.step();
 assert.ok(hits()>=1);
 assert.ok(Math.hypot(h.vx,h.vy)>.01);
 const next=s.diveAt(0,240);assert.notEqual(next.x,p.x);
});
test('real repeated contacts with storm eye expose weakness once, reset on clear',()=>{
 const {h,s,weak}=make();s.begin(1,0);
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
 s.clear();assert.equal(s.active,false);
});
test('all three arena and page rendering variants are side-effect-free on physics, including reduced motion',()=>{
 const {g,h,s,hits}=make(),{c,ops}=canvas();
 for(let v=0;v<3;v++){
  s.begin(2,v);for(let i=0;i<180;i++)s.step();
  const snapshot=JSON.stringify(h),count=hits(),momentum={vx:h.vx,vy:h.vy};
  assert.doesNotThrow(()=>s.draw(c));
  assert.doesNotThrow(()=>g.ArenaStormBossFX.page(c,{realm:'storm',variant:v,progress:.5,start:0},210,1400,900,false));
  assert.doesNotThrow(()=>g.ArenaStormBossFX.page(c,{realm:'storm',variant:v,progress:.5,start:0},210,390,840,true));
  assert.equal(hits(),count);assert.equal(JSON.stringify(h),snapshot);
  assert.deepEqual({vx:h.vx,vy:h.vy},momentum);
 }
 assert.ok(ops.some(x=>x[0]==='arc'||x[0]==='ellipse'));
});
test('spectacles isolate storm boss floors, spend the existing timing cycle, restore weakened defense',()=>{
 const g=world(),h=ball(90,90),b=ball(420,420);
 b.towerDefense=1;
 const normal=g.ArenaTowerSpectacle.create({realm:'storm',level:4,width:500,height:500,hero:h,boss:b,damage(){}});
 for(let i=0;i<900;i++)normal.step();
 assert.equal(normal.event,null);assert.equal(normal.supercell,null);
 const boss=g.ArenaTowerSpectacle.create({realm:'storm',level:10,width:500,height:500,hero:h,boss:b,damage(){return true;}});
 const variants=new Set();
 for(let i=0;i<2300;i++){
  boss.step();if(boss.event)variants.add(boss.event.variant);
 }
 assert.deepEqual([...variants].sort(),[0,1,2]);
 assert.equal(boss.zones.length,0,'special attacks now use the new real hitboxes');
 assert.equal(boss.supercell.active,true);
 boss.clear();assert.equal(boss.supercell.active,false);
 assert.equal(b.z,0);
});
test('storm battle files load before spectacle, with cache invalidation',()=>{
 const html=read('index.html'),spec=read('js/features/tower-spectacle.js');
 assert.ok(html.indexOf('tower-storm-supercell.js')<html.indexOf('tower-spectacle.js'));
 assert.ok(html.indexOf('tower-storm-boss-fx.js')<html.indexOf('tower-spectacle.js'));
 assert.match(html,/tower-spectacle\.js\?v=fx25d1-clock-v2-space-v2-fire-v1-storm-v1/);
 assert.match(spec,/supercell\?\.step\(\)/);
 assert.match(spec,/supercell\?\.draw\(ctx\)/);
 assert.match(spec,/ArenaStormBossFX\?\.page/);
});
