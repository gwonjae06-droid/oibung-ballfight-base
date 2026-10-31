const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('rewind restores both actors, cooldowns, projectiles and present without cloning actor functions',()=>{
 const a={x:0,hp:200,jumpState:'ground',forgeTicks:[0],getImage(){return null;}},b={x:100,hp:300,forgeTicks:[10]};
 const world={objects:[],projectiles:[],effects:[]},g={AdvancedCombat:world};vm.createContext(g);vm.runInContext(fs.readFileSync('js/features/tower-temporal.js','utf8'),g);
 const time=g.ArenaTowerTemporal.create([a,b]);
 for(let i=0;i<300;i++){a.x=i;a.hp=200-i*.1;a.forgeTicks[0]=i;b.x=100+i;b.hp=300-i*.2;world.projectiles.splice(0,world.projectiles.length,{x:i,source:a});time.capture();}
 assert.equal(time.count,80);const present=[a.x,a.hp,b.x,b.hp,a.forgeTicks[0],world.projectiles[0].x];
 assert.equal(time.begin(),true);for(let i=0;i<91;i++)time.step();assert.ok(a.x<100);assert.ok(b.x<200);assert.equal(world.projectiles[0].source,a);
 while(time.active)time.step();assert.deepEqual([a.x,a.hp,b.x,b.hp,a.forgeTicks[0],world.projectiles[0].x],present);assert.equal(typeof a.getImage,'function');
});
