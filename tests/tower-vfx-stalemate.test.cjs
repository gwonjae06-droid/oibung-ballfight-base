'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
function world(script){const w={Math,Map,Set,Number,console};w.globalThis=w;w.window=w;vm.createContext(w);vm.runInContext(read(script),w);return w;}
function canvas(){
 const log=[];
 const ctx=new Proxy({},{get(obj,key){
  if(key in obj)return obj[key];
  return (...args)=>{log.push({key,args});return undefined;};
 },set(obj,key,value){obj[key]=value;return true;}});
 return {ctx,log};
}
const props={time:['fast',95],space:['gravity',100],fire:['lava',50],storm:['lightning',60],ice:['frost',90],forest:['sapling',70]};
for(const [realm,[mode,r]] of Object.entries(props)){
 test(realm+' environment has real drawn shapes and changes over simulated frames',()=>{
  const V=world('js/features/tower-environment-vfx.js').ArenaTowerEnvironmentVFX;
  const z={realm,mode,x:220,y:230,shape:'circle',r,fire:72,born:1,end:190};
  const a=canvas(),b=canvas();
  assert.equal(V.draw(a.ctx,z,30,6),true);
  assert.equal(V.draw(b.ctx,z,96,6),true);
  assert.ok(a.log.length>=8&&b.log.length>18,'must draw meaningful geometry instead of only a label');
  assert.ok(b.log.some(c=>['lineTo','arc','ellipse','bezierCurveTo'].includes(c.key)));
  assert.notEqual(JSON.stringify(a.log),JSON.stringify(b.log),'animation depends on world tick');
 });
}
test('tower renderer delegates active warning zones to elaborate themed animation module',()=>{
 const env=read('js/features/tower-environment.js'),html=read('index.html');
 assert.match(env,/ArenaTowerEnvironmentVFX\?\.draw\?\.\(ctx,z,tick,level\)/);
 assert.ok(html.indexOf('tower-environment-vfx.js')<html.indexOf('tower-environment.js'));
});
test('rounds that deal damage normally do not have their HP scaled before overtime',()=>{
 const S=world('js/features/arena-stalemate.js').ArenaStalemate;
 const fighters=[{hp:150,maxHp:200},{hp:150,maxHp:200}];
 for(let i=0;i<40*60;i++){if(i%45===0)fighters[0].hp-=2;S.tick(fighters);}
 assert.equal(S.state.active,false);
 assert.ok(fighters[0].hp>0&&fighters[1].hp===150);
});
test('unbounded healing and permanent shields still end after bounded simulation time',()=>{
 const S=world('js/features/arena-stalemate.js').ArenaStalemate;
 const p=[{hp:240,maxHp:240,invincible:9999},{hp:400,maxHp:400,invincible:9999}];
 let active=false;
 for(let i=0;i<S.LIMITS.stagnant+S.LIMITS.deadline+3;i++){
   // Simulate effectively infinite regeneration and invulnerability.
   p.forEach(a=>{if(a.hp>0)a.hp=Math.min(a.maxHp,a.hp+400);});
   active=S.tick(p)||active;
   if(S.state.expired)break;
 }
 assert.equal(active,true);
 assert.equal(S.state.expired,true,'hard draw deadline resolves permanent heal loops');
 assert.equal(S.state.active,true);
 S.reset();assert.equal(S.state.active,false);
 assert.equal(S.state.expired,false);
});
test('pauses never count as physics ticks and Tower bosses have a longer grace period',()=>{
 const S=world('js/features/arena-stalemate.js').ArenaStalemate;
 const p=[{hp:3000,maxHp:3000},{hp:200,maxHp:200}];
 for(let i=0;i<S.LIMITS.stagnant+2;i++)S.tick(p,true);
 assert.equal(S.state.active,false,'tower must not trigger at free-battle grace interval');
 assert.equal(S.state.elapsed,S.LIMITS.stagnant+2);
 for(let i=0;i<S.LIMITS.towerStagnant-S.LIMITS.stagnant;i++)S.tick(p,true);
 assert.equal(S.state.active,true);
});
test('engine resets the overtime supervisor and only ticks it on active fights',()=>{
 const source=read('js/core/engine.js'),html=read('index.html');
 assert.match(source,/ArenaStalemate\?\.reset\?\.\(\)/);
 assert.match(source,/ArenaStalemate\?\.tick\?\.\(players,/);
 assert.ok(source.indexOf('ArenaStalemate?.tick?.(players')<source.indexOf('const finalAlive='));
 assert.ok(html.indexOf('arena-stalemate.js')<html.indexOf('core/engine.js'));
});

test('slow max-HP percentage pulses ignore shields fairly without changing maximum HP',()=>{
 const S=world('js/features/arena-stalemate.js').ArenaStalemate;
 const p=[{hp:200,maxHp:200,invincible:9999},{hp:1500,maxHp:1500,invincible:9999}];
 for(let i=0;i<S.LIMITS.stagnant;i++)S.tick(p);
 const old=p.map(a=>a.hp),caps=p.map(a=>a.maxHp);
 for(let i=0;i<S.LIMITS.pulse;i++)S.tick(p);
 assert.equal(S.state.pulses,1);
 const lost=p.map((a,i)=>(old[i]-a.hp)/caps[i]*100);
 assert.ok(Math.abs(lost[0]-lost[1])<1e-6,'both take equal relative damage');
 assert.ok(lost[0]>=1&&lost[0]<2,'first overtime pulse stays gentle');
 assert.deepEqual(p.map(a=>a.maxHp),caps);
 assert.ok(p.every(a=>a.hp>0));
});
test('overtime true damage ramps slowly while attack bonus also rises, with a guaranteed draw cap',()=>{
 const S=world('js/features/arena-stalemate.js').ArenaStalemate;
 const fighters=[{hp:200,maxHp:200},{hp:800,maxHp:800}];
 assert.equal(S.attackFactor(),1);
 for(let i=0;i<S.LIMITS.stagnant;i++)S.tick(fighters);
 assert.equal(Number(S.attackFactor().toFixed(2)),1.08);
 for(let i=0;i<30*60;i++){
   fighters.forEach(p=>p.hp=p.maxHp);S.tick(fighters);
 }
 assert.equal(Number(S.attackFactor().toFixed(2)),1.15);
 assert.ok(S.pulseRate(30*60)>S.pulseRate(0));
 for(let i=0;i<S.LIMITS.deadline;i++){
   fighters.forEach(p=>p.hp=p.maxHp);S.tick(fighters);
   if(S.state.expired)break;
 }
 assert.equal(S.state.expired,true,'persistent healing cannot stall the game forever');
 assert.ok(fighters.every(p=>p.hp>0),'persistent healing is still a tactical option');
});
test('overtime tick plays urgency music only at activation and restores it on reset',()=>{
 const calls=[],w={Math,Map,Set,Number,console,BackgroundMusic:{setOvertime(v){calls.push(v)}}};
 w.window=w;w.globalThis=w;vm.createContext(w);vm.runInContext(read('js/features/arena-stalemate.js'),w);
 const S=w.ArenaStalemate,p=[{hp:100,maxHp:100},{hp:100,maxHp:100}];
 for(let i=0;i<S.LIMITS.stagnant+S.LIMITS.pulse*3;i++)S.tick(p);
 assert.deepEqual(calls,[true]);S.reset();assert.deepEqual(calls,[true,false]);
});
test('overtime and health-bar visuals are present in both current and regenerated HUD cards',()=>{
 const html=read('index.html'),engine=read('js/core/engine.js'),css=read('css/style.css');
 assert.match(html,/id="arena-overtime-banner"/);
 assert.match(html,/id="p1-hp-trail"/);
 assert.match(engine,/hp-bar-trail/);
 assert.match(engine,/hp-impact-/);
 assert.match(engine,/_hudHitSerial/);
 assert.match(css,/\.hp-bar-trail/);
 assert.match(css,/arena-overtime-glow/);
});
