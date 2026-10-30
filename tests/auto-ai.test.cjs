'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/features/arena-auto-ai.js','utf8');
function world(){
 const w={console,Math,Number,Set,canvas:{width:500,height:500}};w.window=w;
 vm.createContext(w);vm.runInContext(source,w);return w.ArenaAutoAI;
}
const fighter=(type='shot',x=100,y=200)=>({
 x,y,hp:200,maxHp:200,radius:22,vx:0,vy:0,playerNum:1,forgeDash:0,
 forge:{speed:2.5,skills:[{name:'전투 스킬',actions:[{type,radius:90}]}]}
});
test('AI approaches target smoothly rather than drifting aimlessly',()=>{
 const a=world(),p=fighter(),e={x:390,y:200,hp:200,radius:22,forgeShots:[],forgeZones:[]};
 assert.equal(a.steer(p,e,2.5),true);
 assert.ok(p.vx>0&&p.vx<2.5);
 for(let i=0;i<50;i++){a.steer(p,e,2.5);p.x+=p.vx;p.y+=p.vy;}
 assert.ok(p.x>120,'fighter closes distance');
 assert.ok(Math.hypot(p.vx,p.vy)<3.3,'no runaway speed');
});
test('melee fighters approach closer and do not waste out-of-range slashes',()=>{
 const a=world(),melee=fighter('slash'),ranged=fighter('shot');
 assert.ok(a.range(melee)<a.range(ranged));
 const e={x:390,y:200,hp:200,radius:22};
 assert.equal(a.canCast(melee,e,melee.forge.skills[0]),false);
 e.x=175;assert.equal(a.canCast(melee,e,melee.forge.skills[0]),true);
 e.x=390;assert.equal(a.canCast(ranged,e,ranged.forge.skills[0]),true);
});
test('incoming projectiles change steering with bounded effort',()=>{
 const a=world(),foe={x:290,y:200,hp:200,radius:22,forgeShots:[],forgeZones:[]};
 const plain=fighter(),dodging=fighter();
 a.steer(plain,foe,2.5);
 foe.forgeShots=[{x:114,y:220,vx:0,vy:0}];
 a.steer(dodging,foe,2.5);
 assert.ok(Math.hypot(plain.vx-dodging.vx,plain.vy-dodging.vy)>.01);
});
test('authored dash and movement-only actions are not overridden by AI',()=>{
 const a=world(),p=fighter(),e={x:390,y:200,hp:200};
 p.forgeDash=12;p.vx=10;p.vy=3;
 assert.equal(a.steer(p,e,2.5),false);assert.equal(p.vx,10);
 p.forgeDash=0;p.movementOnlyFrames=5;
 assert.equal(a.steer(p,e,2.5),false);
});
