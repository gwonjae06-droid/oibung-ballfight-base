'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),
vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function world(){
 const sounds=[],w={window:null,globalThis:null,Math,Date,Map,Set,WeakMap,console,
  canvas:{width:500,height:500},BattleFX:{sound:(...a)=>sounds.push(a)}};
 w.window=w;w.globalThis=w;vm.createContext(w);
 for(const file of ['arena-body-physics','arena-pinball-motion','ball-impact-squash','arena-pinball-juice'])
  vm.runInContext(read('js/features/'+file+'.js'),w,{filename:file});
 return {w,sounds};
}
const ball=(id=1,x=220,y=250,vx=3,vy=0)=>({
 id:'stone',playerNum:id,x,y,vx,vy,radius:28,hp:300,maxHp:300,
 forge:{speed:2.8,signatureVersion:1,effectColor:'#88c6ff'}});
function canvas(){
 const calls=[],c=new Proxy({},{get(o,k){return k in o?o[k]:(...args)=>calls.push([k,...args]);},
 set(o,k,v){o[k]=v;return true;}});
 return {c,calls};
}
test('body-on-body collision converts real approach into a stronger, bounded arcade rebound',()=>{
 const {w}=world(),A=w.ArenaBodyPhysics;
 const a=ball(1,210,250,3),b=ball(2,280,250,-3);
 const before=A.mass(a)*a.vx+A.mass(b)*b.vx;
 const impact=A.pair(a,b,1,0);
 assert.ok(impact.impulse>5.7,'head-on slam has stronger rebound than old 0.89 spring');
 assert.ok(a.vx< -3 && b.vx>3,'both balls reverse sharply on genuine contact');
 assert.ok(a._pinballReboundHold>=17);
 assert.ok(Math.abs(before-(A.mass(a)*a.vx+A.mass(b)*b.vx))<.00001);
 assert.ok(Math.hypot(a.vx,a.vy)<=12 && Math.hypot(b.vx,b.vy)<=12);
 assert.equal(a.hp,300);assert.equal(b.hp,300);
});
test('moving apart or resting balls produce no free energy or false contact',()=>{
 const {w}=world(),A=w.ArenaBodyPhysics;
 const a=ball(1,200,250,-2),b=ball(2,280,250,2);
 assert.equal(A.pair(a,b,1,0),false);
 assert.equal(a.vx,-2);assert.equal(b.vx,2);
 a.vx=0;b.vx=0;assert.equal(A.pair(a,b,1,0),false);
});
test('cruise retains real impact direction while burst speed fades smoothly without chasing',()=>{
 const {w}=world(),M=w.ArenaPinballMotion,p=ball(1,180,250,-7,1);
 p._pinballReboundHold=19;
 const speeds=[],head=Math.atan2(p.vy,p.vx);
 for(let k=0;k<90;k++){
  const before=M.begin(p);
  p.vx=5;p.vy=0; // legacy animation may try to overwrite motion
  M.end(p,before);speeds.push(Math.hypot(p.vx,p.vy));
  p._pinballReboundHold=Math.max(0,p._pinballReboundHold-1);
  assert.ok(Math.abs(Math.atan2(p.vy,p.vx)-head)<1e-10);
 }
 assert.ok(speeds[0]>6.7&&speeds[16]>6.2,'fast rebound remains visible');
 assert.ok(speeds[89]<speeds[16],'high-speed burst loses energy gradually');
 assert.ok(speeds[89]>3,'fighter continues rolling without sudden stop');
 assert.equal(p.hp,300);
});
test('temporary scripted movement, zero gravity and background Ancient One remain untouched',()=>{
 const {w}=world(),M=w.ArenaPinballMotion;
 const p=ball();p.forgeDash=14;
 const before=M.begin(p);p.vx=-8;assert.equal(M.end(p,before),false);
 assert.equal(p.vx,-8);
 p.forgeDash=0;p.vx=5;p.vy=1;p._towerSpaceZeroG=30;
 const zero=M.begin(p);M.end(p,zero);assert.equal(p.vx,5);assert.equal(p.vy,1);
 w.ArenaTower={active:true,state:{ancient:true}};
 const ancient=ball(2);ancient.towerEnemy=true;assert.equal(M.enabled(ancient),false);
});
test('visual contact produces one accent and throttled low-pitch SFX without touching HP or velocities',()=>{
 const {w,sounds}=world(),a=ball(1),b=ball(2);
 const F=w.ArenaPinballJuice;
 const before={a:{hp:a.hp,vx:a.vx,vy:a.vy},b:{hp:b.hp,vx:b.vx,vy:b.vy}};
 assert.equal(F.pair(a,b,1,0,-6,7),true);assert.equal(F.burstCount,1);
 assert.equal(sounds.length,1);assert.equal(sounds[0][0],'heavy');
 assert.equal(F.wall(a,1,0,7),false,'simultaneous corner collision does not duplicate a flash');
 assert.equal(F.pair(a,b,1,0,-6,7),false);
 assert.deepEqual({hp:a.hp,vx:a.vx,vy:a.vy},before.a);
 assert.deepEqual({hp:b.hp,vx:b.vx,vy:b.vy},before.b);
 for(let i=0;i<9;i++)F.tick([a,b]);
 assert.equal(F.wall(a,-1,0,5),true);
 assert.equal(sounds.length,2);
});
test('actual travel paints short directional speed streaks, visual reductions and reset',()=>{
 const {w,sounds}=world(),F=w.ArenaPinballJuice,a=ball(1,170,240,8,0);
 const {c,calls}=canvas();
 F.tick([a]);
 a.x+=8;a.y+=1;F.tick([a]);
 assert.ok(F.trailCount>0);
 assert.doesNotThrow(()=>F.drawUnder(c));
 F.wall(a,-1,0,5);
 assert.doesNotThrow(()=>F.drawOver(c));
 assert.ok(calls.some(x=>x[0]==='lineTo'));
 assert.ok(calls.some(x=>x[0]==='ellipse'));
 w.matchMedia=()=>({matches:true});
 const oldSounds=sounds.length;
 for(let i=0;i<8;i++)F.tick([a]);
 a.x+=8;F.tick([a]);F.wall(a,-1,0,6);
 assert.equal(sounds.length,oldSounds,'reduced motion suppresses new cosmetic impact sounds');
 F.reset();assert.equal(F.burstCount,0);assert.equal(F.trailCount,0);
 assert.equal(a.hp,300);
});
test('shared live page and PvP page initialize feedback before core engine and render',()=>{
 for(const file of ['index.html','pvp-runtime.html']){
  const html=read(file);
  assert.ok(html.indexOf('arena-pinball-juice.js')>0);
  assert.ok(html.indexOf('arena-pinball-juice.js')<html.indexOf('js/core/engine.js'));
  assert.ok(html.indexOf('arena-body-physics.js')<html.indexOf('js/core/engine.js'));
  assert.match(html,/engine\.js\?v=[^"']+/);
 }
 const engine=read('js/core/engine.js'),render=read('js/core/render.js'),tower=read('js/features/tower-flat-arena.js');
 assert.match(engine,/ArenaPinballJuice\?\.pair/);
 assert.match(engine,/ArenaPinballJuice\?\.wall/);
 assert.match(engine,/ArenaPinballJuice\?\.tick/);
 assert.match(tower,/ArenaPinballJuice\?\.wall/);
 assert.match(render,/ArenaPinballJuice\?\.drawUnder/);
 assert.match(render,/ArenaPinballJuice\?\.drawOver/);
 assert.ok(!read('js/features/arena-pinball-juice.js').includes('.hp='));
});
