'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/features/advanced-combat.js','utf8');
function world(){const w={players:[],canvas:{width:500,height:500},Math};w.window=w;vm.createContext(w);vm.runInContext(source,w);return w;}
function painter(){const calls={stroke:0,fill:0,beginPath:0};
 const c=new Proxy({}, {get(target,prop){if(prop in calls)return ()=>{calls[prop]++};return target[prop]??(()=>{});},set(target,prop,val){target[prop]=val;return true;}});
 return {c,calls};}
function bullet(i){return {kind:'fragment',owner:1,x:50+i%15*12,y:100+Math.floor(i/15)*18,prevX:45+i%15*12,prevY:100+Math.floor(i/15)*18,height:18,prevHeight:18,startX:10,startY:100,tx:400,ty:100,age:8,trail:Array.from({length:9},(_,k)=>({x:48-k*4+i%15*12,y:82})),a:{damage:10}};}
test('dense projectile fields retain all simulated bullets while reducing decorative drawing',()=>{
 const w=world(),p={playerNum:1,hp:100,x:60,y:100,forge:{color:'#336699'},forgeShots:[]};w.players.push(p);
 const ac=w.AdvancedCombat;
 for(let i=0;i<12;i++)ac.projectiles.push(bullet(i));
 const normal=painter();ac.draw(normal.c);const sparse=normal.calls.stroke/12;
 for(let i=12;i<80;i++)ac.projectiles.push(bullet(i));
 assert.equal(ac.projectileLoad(),80);assert.equal(ac.projectileDetail(),2);
 const dense=painter();ac.draw(dense.c);
 assert.equal(ac.projectiles.length,80,'optimization must not remove or skip projectile physics');
 assert.ok(dense.calls.fill>=80,'all projectiles retain a visible body');
 assert.ok(dense.calls.stroke/80<sparse*.55,'heavy effects must be simplified per projectile');
});
test('visual budget combines both independent and custom Forge bullets',()=>{
 const w=world(),p={playerNum:1,hp:100,forgeShots:Array.from({length:70},()=>({}))};w.players.push(p);
 assert.equal(w.AdvancedCombat.projectileLoad(),70);assert.equal(w.AdvancedCombat.projectileDetail(),2);
 p.forgeShots.length=20;assert.equal(w.AdvancedCombat.projectileDetail(),0);
});
