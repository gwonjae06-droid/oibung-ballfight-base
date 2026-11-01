'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={console,Math,Date,Map,Set,WeakMap,addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['js/features/tower-space-gravity.js',
  'js/features/tower-space-boss-fx.js','js/features/arena-pinball-motion.js',
  'js/features/tower-spectacle.js'])vm.runInContext(read(file),g,{filename:file});
 return g;
}
const makeBall=(x,y,playerNum=1)=>({
 x,y,vx:0,vy:0,hp:300,maxHp:300,radius:22,playerNum,
 forge:{speed:2.5,signatureVersion:1,skills:[]},forgeShots:[],bfShots:[]});
const create=(g,hero,boss,damage=()=>true,weakpoint=()=>{})=>
 g.ArenaSpaceGravity.create({width:500,height:500,hero,boss,damage,weakpoint});
function canvas(){
 const ops=[],obj={
 createRadialGradient(){return {addColorStop(){}};},
 createLinearGradient(){return {addColorStop(){}};},
 measureText(t){return {width:String(t).length*8};}
 };
 const c=new Proxy(obj,{get(o,k){return k in o?o[k]:(...args)=>{ops.push([k,...args]);};},
  set(o,k,v){o[k]=v;return true;}});
 return {c,ops};
}
test('5F black hole pulls balls and bends authored ranged shots rather than steering AI',()=>{
 const g=world(),h=makeBall(110,250),b=makeBall(390,250,2);
 h.forgeShots=[{x:100,y:200,vx:0,vy:6}];g.AdvancedCombat={projectiles:[]};
 const c=create(g,h,b);
 c.begin(1,0);
 for(let i=0;i<175;i++)c.step();
 assert.ok(h.vx>0,'black hole must add actual inward x-velocity');
 assert.ok(h.forgeShots[0].vx>0,'ranged shot must bend toward lens');
 assert.equal(h.hp,300,'force field itself never gives free untelegraphed damage');
 assert.equal(c.spell.variant,0);
});
test('event warning gives time to anticipate gravity and blast',()=>{
 const g=world(),h=makeBall(160,250),b=makeBall(360,250,2),c=create(g,h,b);
 c.begin(1,0);
 for(let i=0;i<90;i++)c.step();
 assert.equal(h.vx,0);
 assert.equal(h.vy,0);
 c.step();
 assert.equal(h.vx,0,'gravity has not started before 105-frame telegraph');
});
test('10F Big Bang is a single impulse with a finite star bumper field',()=>{
 const g=world(),h=makeBall(175,250),b=makeBall(360,250,2);
 let hits=0;const c=create(g,h,b,()=>{hits++;return true;});
 c.begin(2,1);
 for(let i=0;i<229;i++)c.step();
 assert.equal(c.blastCount,0);
 const before=h.vx;
 c.step();
 assert.equal(c.blastCount,1);
 assert.equal(c.stars.length,7);
 assert.ok(h.vx<before,'hero is pushed out from Big Bang center');
 assert.equal(hits,1);
 for(let i=0;i<30;i++)c.step();
 assert.equal(c.blastCount,1,'Big Bang cannot repeat the same impulse or hit');
 assert.equal(hits,1);
});
test('physical star contacts earn rebound energy and can expose temporary weakness once',()=>{
 const g=world(),h=makeBall(32,32),b=makeBall(455,455,2),damaged=[];
 let squash=0,energy=0,exposures=0;
 g.ArenaBallSquash={wall(){squash++;}};
 g.BounceMomentum={enabled(){return true;},wall(){energy++;}};
 const c=create(g,h,b,(p,n)=>{damaged.push(n);return true;},()=>exposures++);
 c.begin(2,1);for(let i=0;i<235;i++)c.step();
 for(let j=0;j<2;j++){
  const s=c.stars[j],a=s.angle+(235+j-255)*.003*(j%2?-1:1);
  h.x=s.x+4;h.y=s.y;h.vx=1;h.vy=2;c.step();
 }
 assert.ok(squash>=2);
 assert.ok(energy>=2);
 assert.equal(exposures,1);
 for(let i=0;i<100;i++)c.step();
 assert.equal(exposures,1,'a given spectacle can expose its weak point only once');
});
test('10F zero-G conserves inertia and collision velocities while galaxy arms have real hitboxes',()=>{
 const g=world(),h=makeBall(80,80),b=makeBall(420,420,2);
 let hits=0;const c=create(g,h,b,()=>{hits++;return true;});
 c.begin(2,2);for(let i=0;i<180;i++)c.step();
 assert.equal(h._towerSpaceZeroG,2);
 h.vx=7.4;h.vy=-1.9;
 const prior=g.ArenaPinballMotion.begin(h);
 assert.equal(g.ArenaPinballMotion.end(h,prior),true);
 assert.equal(h.vx,7.4);assert.equal(h.vy,-1.9);
 const beam=c.galaxyBeam(c.age,0);
 const x=(beam.x1+beam.x2)/2,y=(beam.y1+beam.y2)/2;
 h.x=x;h.y=y;c.step();
 assert.ok(Math.abs(h.vx-7.4)>.01||Math.abs(h.vy+1.9)>.01,'ribbon collision changes velocity');
 assert.ok(hits>=1,'physical galaxy interaction can damage with cooldown');
 c.clear();assert.equal(h._towerSpaceZeroG,0);
});
test('one render frame cannot damage enemies or modify momentum',()=>{
 const g=world(),h=makeBall(130,230),b=makeBall(370,230,2);
 let damage=0;const c=create(g,h,b,()=>{damage++;return true;});
 const {c:ctx,ops}=canvas();
 for(let variant=0;variant<3;variant++){
  c.begin(2,variant);
  assert.doesNotThrow(()=>c.draw(ctx));
  assert.equal(damage,0);
 }
 assert.ok(ops.some(o=>o[0]==='arc'));
 assert.ok(ops.some(o=>o[0]==='ellipse'));
 const before=JSON.stringify(h);
 assert.doesNotThrow(()=>g.ArenaSpaceBossFX.page(ctx,{realm:'space',variant:2,progress:.4,start:0},120,1200,800,false));
 assert.doesNotThrow(()=>g.ArenaSpaceBossFX.page(ctx,{realm:'space',variant:2,progress:.4,start:0},120,320,640,true));
 assert.equal(JSON.stringify(h),before);
});
test('space only on boss floors, isolated from other towers and repeated attacks limited by energy',()=>{
 const g=world(),h=makeBall(100,100),b=makeBall(380,250,2);
 const normal=g.ArenaTowerSpectacle.create({realm:'space',level:4,width:500,height:500,hero:h,boss:b,damage(){}});
 for(let i=0;i<500;i++)normal.step();
 assert.equal(normal.cosmos,null);
 assert.equal(normal.event,null);
 const boss=g.ArenaTowerSpectacle.create({realm:'space',level:10,width:500,height:500,hero:h,boss:b,damage(){}});
 const variants=new Set();
 // The isolated fallback harness has no BounceMomentum, so spectacles
 // cycle every 900 frames; the third variant begins at simulation tick 2041.
 for(let i=0;i<2300;i++){
  boss.step();
  if(boss.event)variants.add(boss.event.variant);
 }
 assert.deepEqual([...variants].sort(),[0,1,2]);
 assert.equal(boss.cosmos.active,true);
 assert.ok(boss.zones.length===0,'space damage comes from true physics, not legacy invisible zones');
});
test('HTML loads gravitational physics and page layer before spectacle, with unique cache names',()=>{
 const html=read('index.html'),spec=read('js/features/tower-spectacle.js');
 assert.ok(html.indexOf('tower-space-gravity.js')<html.indexOf('tower-spectacle.js'));
 assert.ok(html.indexOf('tower-space-boss-fx.js')<html.indexOf('tower-spectacle.js'));
 assert.match(html,/arena-pinball-motion\.js\?v=3-zero-gravity/);
 assert.match(spec,/cosmos\.begin\(level===10\?2:1,variant\)/);
 assert.match(spec,/cosmos\?\.step\(\)/);
 assert.match(spec,/cosmos\?\.draw\(ctx\)/);
 assert.match(spec,/ArenaSpaceBossFX\?\.page/);
});
