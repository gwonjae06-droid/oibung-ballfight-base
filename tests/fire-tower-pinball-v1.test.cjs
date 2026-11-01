'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={console,Math,Date,Set,Map,WeakMap,addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const p of ['js/features/tower-fire-volcano.js','js/features/tower-fire-boss-fx.js',
  'js/features/tower-spectacle.js'])vm.runInContext(read(p),g,{filename:p});
 return g;
}
const ball=(x=100,y=100)=>({x,y,vx:0,vy:0,hp:300,maxHp:300,radius:20,forgeShots:[],bfShots:[]});
function setup(){
 const g=world(),h=ball(70,70),b=ball(430,430);
 let hits=0,weak=0;
 const fx=g.ArenaFireVolcano.create({width:500,height:500,hero:h,boss:b,
  damage(){hits++;return true;},weakpoint(){weak++;}});
 return {g,h,b,fx,hits:()=>hits,weak:()=>weak};
}
function canvas(){
 const ops=[];
 const c=new Proxy({createRadialGradient(){return {addColorStop(){}};},
  createLinearGradient(){return {addColorStop(){}};},
  measureText(s){return {width:String(s).length*7};}},{
   get(o,k){return k in o?o[k]:(...args)=>{ops.push([k,...args]);};},
   set(o,k,v){o[k]=v;return true;}});
 return {c,ops};
}
test('fire warning is non-lethal and does not impart physical impulses before eruption',()=>{
 const {h,fx,hits}=setup();fx.begin(1,1);
 for(let i=0;i<140;i++)fx.step();
 assert.equal(h.vx,0);assert.equal(h.vy,0);assert.equal(hits(),0);
 assert.equal(fx.vents.length,3);
});
test('5F lava vents reflect real balls and respect hit cooldown',()=>{
 const {g,h,fx,hits}=setup();
 let squashes=0,momentum=0;
 g.ArenaBallSquash={wall(){squashes++;}};
 g.BounceMomentum={wall(){momentum++;}};
 fx.begin(1,1);for(let i=0;i<155;i++)fx.step();
 const vent=fx.vents[0];
 h.x=vent.x+8;h.y=vent.y;h.vx=-2;h.vy=0;fx.step();
 assert.ok(h.vx>0);assert.ok(Math.hypot(h.x-vent.x,h.y-vent.y)>vent.r);
 assert.equal(hits(),1);assert.ok(squashes>0);assert.ok(momentum>0);
 for(let i=0;i<30;i++){h.x=vent.x+8;h.y=vent.y;fx.step();}
 assert.equal(hits(),1,'same vent cannot apply damage each render/physics frame');
});
test('10F eruptions deflect launched skill shots, without spawning fake enemies',()=>{
 const {h,fx}=setup();fx.begin(2,1);for(let i=0;i<160;i++)fx.step();
 const v=fx.vents[0];
 h.forgeShots=[{x:v.x+10,y:v.y,vx:.4,vy:1.7}];
 fx.step();assert.ok(h.forgeShots[0].vx>.4);
 assert.equal(fx.vents.length,5);
 assert.equal(fx.hits,0);
});
test('10F cyclones physically change velocity, with true visual impact circles',()=>{
 const {h,fx,hits}=setup();
 fx.begin(2,2);for(let i=0;i<170;i++)fx.step();
 const c=fx.cyclone(0,171);
 h.x=c.x+2;h.y=c.y;h.vx=-3;h.vy=0;fx.step();
 assert.ok(h.vx>-3,'tornado collision must produce a rebound');
 assert.ok(hits()>=1);
 const {c:ctx,ops}=canvas();
 assert.doesNotThrow(()=>fx.draw(ctx));
 assert.ok(ops.some(x=>x[0]==='ellipse'||x[0]==='arc'));
});
test('caldera fire covers the outer rim but keeps a visible safe central lane',()=>{
 const {h,fx,hits}=setup();fx.begin(2,2);
 for(let i=0;i<245;i++)fx.step();
 h.x=250;h.y=250;fx.step();assert.equal(hits(),0);
 h.x=442;h.y=250;h.vx=0;h.vy=0;fx.step();
 assert.equal(hits(),1,'physical outer rim must damage once');
 for(let i=0;i<28;i++){h.x=442;fx.step();}
 assert.equal(hits(),1,'caldera repeated hits must respect cooldown');
});
test('two distinct physical core contacts expose magma weakness once',()=>{
 const {h,fx,weak}=setup();fx.begin(1,1);
 for(let i=0;i<170;i++)fx.step();
 h.x=270;h.y=250;h.vx=-4;h.vy=0;fx.step();
 assert.equal(fx.coreHits,1);assert.equal(weak(),0);
 for(let i=0;i<63;i++)fx.step();
 h.x=270;h.y=250;h.vx=-4;fx.step();
 assert.equal(fx.coreHits,2);assert.equal(weak(),1);
 for(let i=0;i<65;i++)fx.step();
 h.x=270;h.y=250;h.vx=-4;fx.step();
 assert.equal(weak(),1);
 fx.clear();assert.equal(fx.active,false);
});
test('rendering arena and page effects does not mutate health, velocity or world state',()=>{
 const {g,h,fx,hits}=setup(),{c}=canvas();
 fx.begin(2,2);for(let i=0;i<260;i++)fx.step();
 const before=JSON.stringify(h),oldHits=hits();
 for(let i=0;i<7;i++){
  assert.doesNotThrow(()=>fx.draw(c));
  assert.doesNotThrow(()=>g.ArenaFireBossFX.page(c,{realm:'fire',variant:2,progress:.45,start:0},260,1400,900,false));
  assert.doesNotThrow(()=>g.ArenaFireBossFX.page(c,{realm:'fire',variant:2,progress:.45,start:0},260,390,844,true));
 }
 assert.equal(JSON.stringify(h),before);
 assert.equal(hits(),oldHits);
});
test('fire spectacles keep existing meteor rules and cycle only on boss floors',()=>{
 const g=world(),h=ball(),b=ball(440,440);
 const ordinary=g.ArenaTowerSpectacle.create({realm:'fire',level:4,width:500,height:500,hero:h,boss:b,damage(){}});
 for(let i=0;i<1000;i++)ordinary.step();
 assert.equal(ordinary.volcano,null);assert.equal(ordinary.event,null);
 const boss=g.ArenaTowerSpectacle.create({realm:'fire',level:10,width:500,height:500,hero:h,boss:b,damage(){}});
 for(let i=0;i<241;i++)boss.step();
 assert.equal(boss.event.title,'종말 운석');
 assert.equal(boss.event.deadline-boss.event.start,720);
 assert.equal(boss.volcano.spell.variant,0);
 const variants=new Set();
 // Keep hero alive to inspect all three fallback rotations in isolation.
 for(let i=0;i<2220;i++){
  if(h.hp<=0)h.hp=300;
  boss.step();if(boss.event)variants.add(boss.event.variant);
 }
 assert.deepEqual([...variants].sort(),[0,1,2]);
 assert.ok(boss.zones.length===0,'fire special attacks use their physical apparatus');
 boss.clear();assert.equal(boss.volcano.active,false);
});
test('HTML imports fire modules before spectacles and cache-busts the changed entrypoint',()=>{
 const html=read('index.html'),spec=read('js/features/tower-spectacle.js');
 assert.ok(html.indexOf('tower-fire-volcano.js')<html.indexOf('tower-spectacle.js'));
 assert.ok(html.indexOf('tower-fire-boss-fx.js')<html.indexOf('tower-spectacle.js'));
 assert.match(html,/tower-spectacle\.js\?v=fx25d1-clock-v2-space-v2-fire-v1/);
 assert.match(spec,/volcano\?\.step\(\)/);assert.match(spec,/volcano\?\.draw\(ctx\)/);
 assert.match(spec,/ArenaFireBossFX\?\.page/);
});
