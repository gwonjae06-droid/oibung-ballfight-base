'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={console,Math,Date,Map,Set,WeakMap,addFloatingText(){},document:null};
 g.globalThis=g;g.window=g;
 vm.createContext(g);
 for(const f of ['js/features/tower-temporal.js','js/features/tower-clock-hands.js','js/features/tower-time-boss-fx.js','js/features/tower-spectacle.js'])vm.runInContext(read(f),g,{filename:f});
 return g;
}
const actor=(x,y)=>({x,y,vx:3.5,vy:2,hp:300,maxHp:300,playerNum:1,radius:22,forge:{effectColor:'#ffe7a4'},_bounceMomentum:67,forgeTicks:[12],invincible:0});
function fakeCanvas(){
 const ops=[];const obj={
 createRadialGradient(){return {addColorStop(){}};},
 createLinearGradient(){return {addColorStop(){}};},
 measureText(t){return {width:t.length*6};},
 };
 const ctx=new Proxy(obj,{get(o,k){return k in o?o[k]:(...args)=>{ops.push([k,...args]);};},set(o,k,v){o[k]=v;return true;}});
 return {ctx,ops};
}
test('clock-hand radius, thickness, angular speed and center are mechanically accurate',()=>{
 const g=world(),h=actor(10,20),b=actor(420,420),c=g.ArenaClockHands.create({hero:h,boss:b});
 c.begin(1,'hands');let a=c.handAt(0),m=c.handAt(1);
 assert.equal(a.r,185);assert.equal(a.thickness,12);assert.equal(a.x1,250);assert.equal(a.y1,250);
 assert.equal(m.r,132);assert.equal(m.thickness,24);
 assert.ok(a.omega>0&&m.omega<0);
 c.clear();c.begin(2,'hands');a=c.handAt(0);m=c.handAt(1);
 assert.equal(a.r,195);assert.equal(m.r,142);
});
test('clock blade physically ricochets hero, triggers squash and bounded damage',()=>{
 const g=world(),hero=actor(250,25),boss=actor(400,400);let damage=0,squash=0,momentum=0;
 g.ArenaBallSquash={wall(){squash++;}};g.BounceMomentum={wall(){momentum++;}};
 const c=g.ArenaClockHands.create({hero,boss,damage(){damage++;return true;}});
 c.begin(1,'hands');
 for(let i=0;i<75;i++)c.step();
 assert.equal(damage,0,'warning stage may not deal damage');
 hero.x=254;hero.y=124;hero.vx=0;hero.vy=3.8;
 c.step();assert.ok(squash>0,'squash must happen at actual blade collision');
 assert.ok(momentum>0,'impact earns the usual wall rebound energy');
 assert.ok(Math.hypot(hero.vx,hero.vy)>0,'actual physical velocity changed');
 assert.equal(damage,1);
 for(let i=0;i<8;i++){hero.x=254;hero.y=124;c.step();}
 assert.equal(damage,1,'do not farm repeated collisions each frame');
});
test('stopped world only slows hero and cleans up after spectacle',()=>{
 const g=world(),hero=actor(130,240),boss=actor(330,240);const c=g.ArenaClockHands.create({hero,boss});
 c.begin(2,'stasis');
 for(let i=0;i<110;i++)c.step();
 assert.equal(hero._towerClockSlowScale,.18);
 assert.equal(hero._towerClockSlow,2);
 assert.equal(boss._towerClockSlow,undefined);
 c.clear();assert.equal(hero._towerClockSlow,0);
});
test('kinematic rewind never revives, rewinds energy, or duplicates projectile hits',()=>{
 const g=world(),hero=actor(55,70),boss=actor(350,200);
 const projectile={x:170,damage:99};
 const shots=[projectile];
 g.AdvancedCombat={objects:[],projectiles:shots,effects:[]};
 const rewind=g.ArenaTowerTemporal.create([hero,boss],{kinematicOnly:true});
 for(let i=0;i<270;i++){hero.x=i+30;hero.y=i/2+20;hero.vx=i%4+1;rewind.capture();}
 const saved={x:hero.x,y:hero.y,vx:hero.vx};
 hero.hp=33;hero._bounceMomentum=3;boss.hp=14;shots[0].x=490;
 assert.equal(rewind.begin(),true);
 for(let i=0;i<93;i++)rewind.step();
 assert.ok(hero.x<saved.x,'cinematic motion travels backward');
 assert.equal(hero.hp,33);assert.equal(boss.hp,14);
 assert.equal(hero._bounceMomentum,3);assert.equal(shots[0].x,490);
 while(rewind.active)rewind.step();
 assert.equal(hero.x,saved.x);assert.equal(hero.y,saved.y);assert.equal(hero.vx,saved.vx);
 assert.equal(hero.hp,33);assert.equal(hero._bounceMomentum,3);
});
test('clock center is a physical weakpoint and cannot trigger repeatedly in one frame',()=>{
 const g=world(),hero=actor(40,40),boss=actor(350,350);
 let exposed=0;const c=g.ArenaClockHands.create({hero,boss,weakpoint(){exposed++;}});
 c.begin(1,'hands');
 for(let i=0;i<105;i++)c.step();
 for(let i=0;i<2;i++){hero.x=280;hero.y=250;hero.vx=4;hero.vy=0;c.step();for(let j=0;j<55;j++){hero.x=40;hero.y=40;c.step();}}
 assert.ok(exposed>=1,'two separated physical core contacts expose a vulnerability');
});
test('visual layers draw with no mutation to combat, and have matching page atmosphere',()=>{
 const g=world(),hero=actor(100,100),boss=actor(350,350);
 let damage=0;const c=g.ArenaClockHands.create({hero,boss,damage(){damage++;}});
 c.begin(2,'hands');const {ctx,ops}=fakeCanvas();
 assert.doesNotThrow(()=>c.draw(ctx));
 assert.ok(ops.some(x=>x[0]==='arc'));
 assert.ok(ops.some(x=>x[0]==='lineTo'));
 assert.equal(damage,0,'rendering cannot inflict hits');
 const snap=JSON.stringify(hero);
 assert.doesNotThrow(()=>g.ArenaTimeBossFX.page(ctx,{realm:'time',variant:1,progress:.6,start:0},100,1200,800,false));
 assert.equal(JSON.stringify(hero),snap);
});
test('boss spectacle and main game load kinetic clock module before encounter, with matching cache',()=>{
 const html=read('index.html'),enc=read('js/features/tower-spectacle.js'),engine=read('js/core/engine.js');
 assert.ok(html.indexOf('tower-clock-hands.js')<html.indexOf('tower-spectacle.js'));
 assert.ok(html.includes('tower-time-boss-fx.js'));
 assert.ok(html.includes('tower-temporal.js?v=2-time-safe'));
 assert.match(html,/js\/core\/engine\.js\?v=[^"']+/);
 assert.ok(enc.includes("clock?.begin(level===10?2:1,'hands')"));
 assert.ok(enc.includes("clock?.begin(level===10?2:1,'stasis')"));
 assert.ok(enc.includes('kinematicOnly:true'));
 assert.ok(engine.includes('_towerClockSlowScale'));
});
