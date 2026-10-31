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

test('tower warning uses the TRUE circular, rotated-line and donut danger geometry',()=>{
 const a=world();
 const ring={shape:'ring',x:250,y:250,inner:95,r:165};
 assert.ok(a.signed(250,250,ring,20)>0,'ring centre is genuinely safe');
 assert.ok(a.signed(350,250,ring,20)<0,'ring band is dangerous');
 assert.ok(a.signed(480,250,ring,20)>0,'outside of ring is safe');
 const line={shape:'line',x:250,y:250,angle:Math.PI/4,width:48,length:600};
 assert.ok(a.signed(300,300,line,20)<0,'on the diagonal beam');
 assert.ok(a.signed(300,200,line,20)>0,'sideways escape from a beam');
});
test('Tower AI anticipates locked boss attacks and chooses a safer lane',()=>{
 const a=world(),p=fighter('shot',344,250),foe={x:250,y:420,hp:400,maxHp:400,radius:30,forgeShots:[]};
 p.towerHero=true;
 // A real 90px–165px annulus, with the centre as a possible escape.
 const zone={shape:'ring',x:250,y:250,inner:90,r:165,fire:45,end:90,kind:'boss'};
 const encounter={tick:0,zones:[zone]};
 // The isolated test window is the one consulted by ArenaAutoAI.
 const sandbox={};
 // world() returns the controller; the instance's global is its closure,
 // so pass a fresh realm through the existing window-scoped API.
 const w={window:null,console,Math,Number,Set,canvas:{width:500,height:500},
  ArenaTower:{active:true,encounter}};w.window=w;
 const vm=require('node:vm'),f=require('node:fs');
 vm.createContext(w);vm.runInContext(f.readFileSync('js/features/arena-auto-ai.js','utf8'),w);
 const director=w.ArenaAutoAI,choice=director.plan(p,foe,3);
 assert.ok(choice&&Number.isFinite(choice.x));
 const stationary=director.risk(p,foe,0,0);
 const escaping=director.risk(p,foe,choice.x*3,choice.y*3);
 assert.ok(escaping<stationary,'AI selects lower incoming pattern exposure');
});
test('both competing forge fighters dodge incoming shots without changing HP or damage',()=>{
 const a=world();
 for(const num of [1,2]){
   const p=fighter('shot',120,200);p.playerNum=num;
   const e=fighter('shot',360,200);
   e.forgeShots=[{x:148,y:205,vx:-2,vy:0,life:32}];
   const hp=p.hp,damage=p.forge.skills[0].actions[0].damage;
   assert.equal(a.steer(p,e,3),true);
   assert.equal(p.hp,hp);assert.equal(p.forge.skills[0].actions[0].damage,damage);
   assert.ok(Number.isFinite(p.vx)&&Number.isFinite(p.vy));
 }
});
test('legacy fighters now strafe tactically, but preserve scripted bursts and airborne moves',()=>{
 const a=world(),p=fighter(),e=fighter('shot',330,200);
 delete p.forge;p.vx=1.5;p.vy=0;
 assert.equal(a.react(p,e),true);
 assert.ok(p.vx<1.5&&p.vx>0,'ordinary movement blends without an abrupt turn');
 assert.ok(Math.abs(p.vy)>0,'a lateral motion develops');
 e.forgeShots=[{x:114,y:220,vx:0,vy:0,life:45}];
 assert.equal(a.react(p,e),true);
 assert.ok(Number.isFinite(p.vx)&&Number.isFinite(p.vy));
 p.vx=9;p.vy=0;
 assert.equal(a.react(p,e),false,'scripted high-speed dash remains authoritative');
 p.vx=2;p.jumpState='rising';
 assert.equal(a.react(p,e),false,'jumping behavior remains authoritative');
});
test('AI saves pure healing for missing health while mixed authored combos remain usable',()=>{
 const a=world(),p=fighter(),e={x:165,y:200,hp:200,radius:20};
 const heal={actions:[{type:'heal',damage:30}]};
 assert.equal(a.canCast(p,e,heal),false);
 p.hp=120;assert.equal(a.canCast(p,e,heal),true);
 p.hp=200;
 assert.equal(a.canCast(p,e,{actions:[{type:'heal'},{type:'shot'}]}),true);
});
