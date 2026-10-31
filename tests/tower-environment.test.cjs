'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const ids=['time','space','fire','storm','ice','forest'];
function setup(id,level=3){
 const w={Math,Map,Set,console};w.window=w;w.globalThis=w;
 vm.createContext(w);
 vm.runInContext(read('js/features/tower-environment.js'),w);
 const roster=[{x:175,y:195,radius:20,hp:500,maxHp:500,vx:0,vy:0,forgeTicks:[60,30],slowTimer:0,slowMultiplier:1},
               {x:350,y:350,radius:20,hp:500,maxHp:500,vx:0,vy:0}];
 const hits=[];
 const env=w.ArenaTowerEnvironment.create({realm:id,level,width:500,height:500,roster,
  damage(p,n,z){hits.push({p,n,z});p.hp-=n;return true;}});
 return {w,env,roster,hits};
}
function painter(){
 const calls={arc:0,rect:0,text:0};
 const ctx=new Proxy({},{get(o,k){if(k==='fillText')return()=>{calls.text++;};
  if(k==='arc')return()=>{calls.arc++;};
  if(k==='rect')return()=>{calls.rect++;};
  return k in o?o[k]:()=>{};
 },set(o,k,v){o[k]=v;return true;}});
 return {ctx,calls};
}
test('all six towers create unique real mechanics with an explicit warning and safe lanes',()=>{
 const seen=[];
 for(const id of ids){
  const {env,w}=setup(id);
  assert.equal(env.zones.length,0);
  env.step();
  const z=env.zones[0];assert.ok(z,id);
  assert.equal(z.realm,id);
  assert.ok(z.fire-z.born>=60,'sufficient reaction time for '+id);
  assert.ok(w.ArenaTowerEnvironment.LABELS[id].includes(z.label));
  let safe=0;
  for(let x=30;x<480;x+=25)for(let y=30;y<480;y+=25){
    if(!w.ArenaTowerEnvironment.contains(z,{x,y,radius:20}))safe++;
  }
  assert.ok(safe>=45,'unavoidable hazard for '+id);
  const {ctx,calls}=painter();env.draw(ctx);
  assert.ok(calls.text>0&&calls.arc+calls.rect>0,id+' must visibly warn');
  seen.push(id+':'+z.mode);
 }
 assert.equal(new Set(seen).size,ids.length);
});
test('fire and lightning only hurt after a long telegraph and hit once per burst',()=>{
 for(const id of ['fire','storm']){
  const {env,roster,hits}=setup(id,4);
  env.step();let z=env.zones[0];if(id==='storm'){
   // First storm event is safe wind, second event is actual lightning.
   for(let i=1;i<=env.period;i++)env.step();
   z=env.zones.find(zone=>zone.mode==='lightning');
   assert.ok(z);
  }
  for(const p of roster){p.x=z.x;p.y=z.y;}
  while(env.tick<z.fire-1)env.step();
  const before=hits.length;assert.equal(before,0,'telegraphed hazard cannot strike early');
  for(let i=0;i<10;i++)env.step();
  assert.equal(hits.length,2);
  for(let i=0;i<20;i++)env.step();
  assert.equal(hits.length,2,'one event cannot deal multiple direct hits');
 });
});
test('time gears accelerate or decelerate real individual skill clocks',()=>{
 const {env,roster}=setup('time');
 env.step();let fast=env.zones[0],p=roster[0];
 p.x=fast.x;p.y=fast.y;
 p.forgeTicks=[10,50];
 while(env.tick<fast.fire+9)env.step();
 assert.ok(p.forgeTicks[0]>10&&p.forgeTicks[1]>50,'fast zone advances actual clocks');
 while(env.tick<env.period+1)env.step();
 const slow=env.zones.find(z=>z.mode==='slow');
 assert.ok(slow);
 p.x=slow.x;p.y=slow.y;p.forgeTicks=[30,70];
 while(env.tick<slow.fire+12)env.step();
 assert.ok(p.forgeTicks[0]<30,'slow zone reduces charged skill time');
 assert.ok(p.slowTimer>0);
});
test('space gravity attracts, reverse orbit repels and never creates phantom damage',()=>{
 const {env,roster,hits}=setup('space');env.step();
 const z=env.zones[0],p=roster[0];
 p.x=z.x+45;p.y=z.y;p.vx=0;
 while(env.tick<z.fire+12)env.step();
 assert.ok(p.vx<0,'gravity pulls toward the centre');
 while(env.tick<env.period+1)env.step();
 const reverse=env.zones.find(a=>a.mode==='antigravity');assert.ok(reverse);
 p.x=reverse.x+45;p.y=reverse.y;p.vx=0;
 while(env.tick<reverse.fire+12)env.step();
 assert.ok(p.vx>0,'anti-gravity pushes outward');
 assert.equal(hits.length,0,'gravity is a movement mechanic, not hidden damage');
});
test('ice changes glide and applies visible slowing, forest spore applies poison',()=>{
 const ice=setup('ice');
 ice.env.step();let z=ice.env.zones[0],p=ice.roster[0];
 p.x=z.x;p.y=z.y;p.vx=2;
 while(ice.env.tick<z.fire+8)ice.env.step();
 assert.ok(p.vx>2,'frozen floors preserve slide momentum');
 assert.ok(p.slowTimer>0,'ice also hinders movement');
 const forest=setup('forest');forest.env.step();z=forest.env.zones[0];p=forest.roster[0];
 p.x=z.x;p.y=z.y;
 while(forest.env.tick<z.fire+3)forest.env.step();
 assert.ok(p.bfDot>0,'poison spores connect to existing DOT runtime');
});
test('boss floor still has environmental scenery but never doubles up lethal hazard damage',()=>{
 for(const id of ids){
  const {env,roster,hits}=setup(id,10);
  for(let i=0;i<620;i++){
   const z=env.zones[0];if(z){roster[0].x=z.x;roster[0].y=z.y;}
   env.step();
  }
  assert.equal(hits.length,0,id+' boss environment must not stack direct damage');
  env.clear();assert.equal(env.zones.length,0);
 }
});
test('environment is Tower-only, tracked per encounter and not loaded in PvP',()=>{
 const html=read('index.html'),challenge=read('js/features/tower-challenge.js'),online=read('pvp-runtime.html');
 assert.ok(html.includes('tower-environment.js'));
 assert.ok(html.indexOf('tower-environment.js')<html.indexOf('tower-challenge.js'));
 assert.ok(!online.includes('tower-environment.js'));
 assert.match(challenge,/environmentManaged:!!environment/);
 assert.match(challenge,/environment\?\.step\?\.\(\)/);
 assert.match(challenge,/environment\?\.draw\?\.\(ctx\)/);
 assert.match(challenge,/environment\?\.clear\?\.\(\)/);
 assert.match(read('js/features/arena-auto-ai.js'),/ArenaTower\.environment/);
});
