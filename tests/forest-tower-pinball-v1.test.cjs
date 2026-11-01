'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),
 fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={Math,Date,Set,Map,WeakMap,console,addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['tower-forest-life','tower-forest-boss-fx','tower-spectacle'])
  vm.runInContext(read('js/features/'+file+'.js'),g,{filename:file});
 return g;
}
const ball=(x,y)=>({x,y,vx:0,vy:0,hp:1000,maxHp:1000,radius:20,
 forgeShots:[],bfShots:[],towerDefense:1});
function setup(){
 const g=world(),hero=ball(60,60),boss=ball(420,420);let damages=0,weak=0;
 const life=g.ArenaForestLife.create({width:500,height:500,hero,boss,
  damage(){damages++;return true;},weakpoint(){weak++;}});
 return {g,hero,boss,life,damage:()=>damages,weak:()=>weak};
}
function canvas(){
 const ops=[],obj={createRadialGradient(){return {addColorStop(){}};},
  createLinearGradient(){return {addColorStop(){}};},
  measureText(t){return {width:String(t).length*7};}};
 const c=new Proxy(obj,{get(o,k){return k in o?o[k]:(...args)=>{ops.push([k,...args]);};},
  set(o,k,v){o[k]=v;return true;}});
 return {c,ops};
}
test('5F living-root attack has a 105-frame telegraph and no damage before activation',()=>{
 const {hero,life,damage}=setup();life.begin(1,0);
 for(let i=0;i<144;i++)life.step();
 assert.equal(hero.vx,0);assert.equal(hero.vy,0);
 assert.equal(damage(),0);
});
test('root capsule physically bounces balls and earns real momentum energy',()=>{
 const {g,hero,life,damage}=setup();let squash=0,energy=0;
 g.ArenaBallSquash={wall(){squash++;}};
 g.BounceMomentum={wall(){energy++;}};
 life.begin(1,0);for(let i=0;i<155;i++)life.step();
 const r=life.rootAt(0,156);
 hero.x=(r.x1+r.x2)/2;hero.y=(r.y1+r.y2)/2;hero.vx=-3;
 life.step();
 assert.ok(Math.hypot(hero.vx,hero.vy)>0);
 assert.equal(damage(),1);assert.ok(squash>0);assert.ok(energy>0);
 const prior=damage();
 for(let i=0;i<25;i++){
  const next=life.rootAt(0,life.age+1);
  hero.x=(next.x1+next.x2)/2;hero.y=(next.y1+next.y2)/2;life.step();
 }
 assert.equal(damage(),prior,'single root has a physical damage cooldown');
});
test('real root geometry reflects approaching authored skill projectiles',()=>{
 const {hero,life}=setup();life.begin(1,0);
 for(let i=0;i<156;i++)life.step();
 const r=life.rootAt(0,157),dx=r.x2-r.x1,dy=r.y2-r.y1,
  m=Math.hypot(dx,dy),nx=-dy/m,ny=dx/m;
 const shot={x:(r.x1+r.x2)/2+nx*2,y:(r.y1+r.y2)/2+ny*2,
  vx:-nx*4,vy:-ny*4};
 hero.forgeShots.push(shot);life.step();
 assert.ok(shot.vx*nx+shot.vy*ny>0,'projectile reflected from true root capsule');
 assert.ok(life.shotBounces>0);
});
test('5F spore fields are warned, bounded, and route damage via the supplied adapter',()=>{
 const {hero,life,damage}=setup();life.begin(1,1);
 const bloom=life.blooms[0];for(let i=0;i<186;i++)life.step();
 const point=life.sporeAt(bloom,187);hero.x=point.x;hero.y=point.y;
 life.step();assert.ok(damage()>=1);
 assert.ok(hero.poisonTimer>0);
 const first=damage();for(let i=0;i<25;i++){
  const p=life.sporeAt(bloom,life.age+1);hero.x=p.x;hero.y=p.y;life.step();
 }
 assert.equal(damage(),first,'no repeated DOT hits on every simulation tick');
});
test('moving seed bumpers are physical and a full two impacts destroy one',()=>{
 const {hero,life}=setup();life.begin(1,1);for(let i=0;i<165;i++)life.step();
 const s=life.seeds[0];hero.x=s.x+5;hero.y=s.y;hero.vx=-4;life.step();
 assert.equal(s.hp,1);
 hero.x=40;hero.y=40;
 for(let i=0;i<47;i++)life.step();
 hero.x=s.x+5;hero.y=s.y;hero.vx=-4;life.step();
 assert.equal(s.hp,0);assert.equal(s.destroyed,true);
});
test('destroying two real seeds opens exactly one temporary weakness',()=>{
 const {hero,life,weak}=setup();life.begin(2,1);
 for(let i=0;i<170;i++)life.step();
 for(let n=0;n<2;n++){
  const s=life.seeds[n];
  for(let k=0;k<2;k++){
   hero.forgeShots=[{x:s.x+s.r-1,y:s.y,vx:-3,vy:0}];
   life.step();
   hero.forgeShots=[];
   for(let t=0;t<47;t++)life.step();
  }
 }
 assert.equal(life.seeds[0].destroyed,true);
 assert.equal(life.seeds[1].destroyed,true);
 assert.equal(weak(),1);
});
test('world tree healing is capped and requires living destructible seed cores',()=>{
 const {hero,boss,life}=setup();boss.hp=500;
 hero.x=250;hero.y=250;life.begin(2,2);
 for(let i=0;i<300;i++)life.step();
 assert.ok(life.heals>=1);assert.ok(boss.hp>500);
 const prior=life.heals;
 for(const s of life.seeds)s.destroyed=true;
 for(let i=0;i<115;i++)life.step();
 assert.equal(life.heals,prior,'shattering seed cores halts boss regeneration');
});
test('10F growing vines have a central gap and actual capsule collisions',()=>{
 const {hero,life,damage}=setup();life.begin(2,2);
 hero.x=250;hero.y=250;for(let i=0;i<250;i++)life.step();
 const v=life.vineAt(0,251);hero.x=v.x1;hero.y=(v.y1+v.y2)/2;
 life.step();assert.ok(damage()>=1);
 assert.ok(v.progress>0);
});
test('an elevated ball can clear ground-root barriers while the grounded ball collides',()=>{
 const {hero,life,damage}=setup();life.begin(1,0);
 for(let i=0;i<154;i++)life.step();
 const v=life.rootAt(0,155);hero.x=(v.x1+v.x2)/2;hero.y=(v.y1+v.y2)/2;hero.z=100;
 life.step();assert.equal(damage(),0);
 const after=life.rootAt(0,156);hero.z=0;
 hero.x=(after.x1+after.x2)/2;hero.y=(after.y1+after.y2)/2;life.step();
 assert.ok(damage()>0);
});
test('two physical heart contacts open a weak point once',()=>{
 const {hero,life,weak}=setup();life.begin(1,0);
 for(let i=0;i<181;i++)life.step();
 hero.x=270;hero.y=250;hero.vx=-4;life.step();
 assert.equal(life.coreHits,1);assert.equal(weak(),0);
 hero.x=60;hero.y=60;hero.vx=0;
 for(let i=0;i<70;i++)life.step();
 hero.x=270;hero.y=250;hero.vx=-4;life.step();
 assert.equal(life.coreHits,2);assert.equal(weak(),1);
 for(let i=0;i<70;i++)life.step();
 hero.x=270;hero.y=250;hero.vx=-4;life.step();
 assert.equal(weak(),1);
});
test('forest page and boss drawings are purely visual across 3 variants and reduced motion',()=>{
 const {g,hero,life,damage}=setup(),{c,ops}=canvas();
 for(let variant=0;variant<3;variant++){
  life.begin(2,variant);for(let i=0;i<180;i++)life.step();
  const snapshot=JSON.stringify(hero),old=damage();
  assert.doesNotThrow(()=>life.draw(c));
  assert.doesNotThrow(()=>g.ArenaForestBossFX.page(c,
   {realm:'forest',variant,progress:.48,start:0},200,1360,900,false));
  assert.doesNotThrow(()=>g.ArenaForestBossFX.page(c,
   {realm:'forest',variant,progress:.48,start:0},200,390,840,true));
  assert.equal(JSON.stringify(hero),snapshot);assert.equal(damage(),old);
 }
 assert.ok(ops.some(x=>x[0]==='arc'||x[0]==='ellipse'));
});
test('forest apparatus remains isolated to 5F/10F and 10F rotates three super attacks',()=>{
 const g=world(),hero=ball(80,80),boss=ball(420,420);
 const ordinary=g.ArenaTowerSpectacle.create({realm:'forest',level:4,width:500,height:500,hero,boss,damage(){}});
 for(let i=0;i<1200;i++)ordinary.step();
 assert.equal(ordinary.living,null);assert.equal(ordinary.event,null);
 const final=g.ArenaTowerSpectacle.create({realm:'forest',level:10,width:500,height:500,hero,boss,damage(){return true;}});
 const variants=new Set();
 for(let i=0;i<2300;i++){final.step();if(final.event)variants.add(final.event.variant);}
 assert.deepEqual([...variants].sort(),[0,1,2]);
 assert.ok(final.living.active);assert.equal(final.zones.length,0);
 final.clear();assert.equal(final.living.active,false);
});
test('HTML imports forest assets and cache-busts the shared spectacle',()=>{
 const html=read('index.html'),spec=read('js/features/tower-spectacle.js');
 assert.ok(html.indexOf('tower-forest-life.js')<html.indexOf('tower-spectacle.js'));
 assert.ok(html.indexOf('tower-forest-boss-fx.js')<html.indexOf('tower-spectacle.js'));
 assert.match(html,/tower-spectacle\.js\?v=fx25d1-clock-v2-space-v2-fire-v1-storm-v1-ice-v1-forest-v1/);
 assert.match(spec,/living\?\.step\(\)/);assert.match(spec,/living\?\.draw\(ctx\)/);
 assert.match(spec,/ArenaForestBossFX\?\.page/);
});
