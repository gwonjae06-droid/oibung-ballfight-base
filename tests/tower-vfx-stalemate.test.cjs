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
 for(let i=0;i<120*60;i++){
   // Simulate effectively permanent regeneration, without real attacks.
   p.forEach(a=>{if(a.hp>0)a.hp=Math.min(a.maxHp,a.hp+400);});
   active=S.tick(p)||active;
   if(p.every(a=>a.hp===0))break;
 }
 assert.equal(active,true);
 assert.ok(p.every(a=>a.hp===0),'no build can remain immortal forever');
 assert.equal(S.state.active,true);
 S.reset();assert.equal(S.state.active,false);
});
test('pauses never count as physics ticks and Tower bosses have a longer grace period',()=>{
 const S=world('js/features/arena-stalemate.js').ArenaStalemate;
 const p=[{hp:3000,maxHp:3000},{hp:200,maxHp:200}];
 for(let i=0;i<38*60+2;i++)S.tick(p,true);
 assert.equal(S.state.active,false,'tower must not trigger at free-battle grace interval');
 assert.equal(S.state.elapsed,38*60+2);
 for(let i=0;i<18*60;i++)S.tick(p,true);
 assert.equal(S.state.active,true);
});
test('engine resets the overtime supervisor and only ticks it on active fights',()=>{
 const source=read('js/core/engine.js'),html=read('index.html');
 assert.match(source,/ArenaStalemate\?\.reset\?\.\(\)/);
 assert.match(source,/ArenaStalemate\?\.tick\?\.\(players,/);
 assert.ok(source.indexOf('ArenaStalemate?.tick?.(players')<source.indexOf('const finalAlive='));
 assert.ok(html.indexOf('arena-stalemate.js')<html.indexOf('core/engine.js'));
});
