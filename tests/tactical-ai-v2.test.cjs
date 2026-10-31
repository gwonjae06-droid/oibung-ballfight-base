'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const script=fs.readFileSync('js/features/arena-auto-ai.js','utf8');
function world(overrides={}){
 const w={window:null,console,Math,Number,Map,Set,canvas:{width:500,height:500},...overrides};
 w.window=w;vm.createContext(w);vm.runInContext(script,w);return w;
}
function actor(num,x,y,type='shot'){
 return {playerNum:num,x,y,vx:0,vy:0,hp:300,maxHp:300,radius:24,forgeDash:0,
  forge:{skills:[{trigger:'auto',cooldown:1.5,actions:[{type,radius:160,speed:6,damage:28}]}]}};
}
test('different loadouts have purposeful roles and no endless mutual head-on charge',()=>{
 const w=world(),ai=w.ArenaAutoAI,archer=actor(1,140,240),swordsman=actor(2,360,240,'slash');
 assert.equal(ai.loadout(archer).role,'ranged');
 assert.equal(ai.loadout(swordsman).role,'melee');
 assert.ok(ai.range(archer)>ai.range(swordsman));
 const archerStance=ai.stance(archer,swordsman),meleeStance=ai.stance(swordsman,archer);
 assert.equal(archerStance.mode,'approach');assert.equal(meleeStance.mode,'approach');
 swordsman.x=230;
 assert.equal(ai.stance(archer,swordsman).mode,'reposition');
 assert.equal(ai.stance(swordsman,archer).mode,'strafe');
 for(let i=0;i<40;i++){
   ai.steer(archer,swordsman,2.5);archer.x+=archer.vx;archer.y+=archer.vy;
   ai.steer(swordsman,archer,2.5);swordsman.x+=swordsman.vx;swordsman.y+=swordsman.vy;
   for(const p of [archer,swordsman]){
     assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
     assert.ok(Math.hypot(p.vx,p.vy)<=3.1);
   }
 }
 assert.ok(Math.abs(archer.y-240)>5||Math.abs(swordsman.y-240)>5,'side-stepping makes the duel readable');
});
test('ranged fighter baits announced enemy melee without accessing hidden casts',()=>{
 const foe=actor(2,220,250,'slash'),archer=actor(1,160,250);
 const w=world({ArenaTelegraph:{preview(p){return p===foe?[{kind:'melee',remaining:8,lead:11}]:[];}}});
 assert.equal(w.ArenaAutoAI.stance(archer,foe).mode,'bait');
 assert.ok(w.ArenaAutoAI.stance(archer,foe).x<0,'backs away from telegraphed hit');
});
test('AI tactical targeting values nearby finishers without flickering targets',()=>{
 const w=world(),a=w.ArenaAutoAI,p=actor(1,100,100),normal=actor(2,245,100),weak=actor(3,252,110);
 weak.hp=12;normal.hp=300;
 a.setRoster([p,normal,weak]);
 assert.equal(a.targetFor(p,normal),weak,'finish a nearby wounded opponent');
 normal.x=237;
 for(let i=0;i<25;i++)assert.equal(a.targetFor(p,normal),weak,'retain chosen target for readable commitment');
 weak.hp=0;
 assert.equal(a.targetFor(p,normal),normal,'immediately switch on target death');
});
test('movement-only charge avoids danger, while authored attack combos remain available',()=>{
 const p=actor(1,120,250),foe=actor(2,350,250);
 const z={shape:'circle',x:210,y:250,r:65,fire:0,end:100,relative:true,weight:2};
 foe.forgeZones=[{type:'zone',x:210,y:250,timer:100,a:{radius:65}}];
 const a=world().ArenaAutoAI;
 const rush={actions:[{type:'dash',speed:8,radius:150,duration:1}]};
 assert.equal(a.canCast(p,foe,rush),false,'avoid dashing into a visible dangerous zone');
 assert.equal(a.canCast(p,foe,{actions:[rush.actions[0],{type:'wave',damage:30,radius:150}]}),true,
  'do not silently discard a deliberately authored dash attack combo');
});
test('height-aware path keeps high ground for ranged but does not modify any terrain',()=>{
 const a=actor(1,250,240),foe=actor(2,450,240),w=world({ArenaTower:{active:true},ArenaTowerTerrain:{worldHeight(x,y){return x<290?42:x>320?0:42-(x-290)*1.4;}}});
 a.towerGroundZ=42;const before={...a},plan=w.ArenaAutoAI.plan(a,foe,3);
 assert.ok(plan&&Number.isFinite(plan.x));assert.equal(a.x,before.x);assert.equal(a.towerGroundZ,42);
 assert.equal(typeof w.ArenaAutoAI.setRoster,'function');
});
test('a crowded free-for-all gets modest separation and keeps speed bounded',()=>{
 const a=world().ArenaAutoAI,p=actor(1,245,250),foe=actor(2,390,250),third=actor(3,265,240);
 a.setRoster([p,foe,third]);const plan=a.plan(p,foe,2.4);
 assert.ok(plan&&Number.isFinite(plan.score));
 for(let i=0;i<35;i++){a.steer(p,foe,2.4);p.x+=p.vx;p.y+=p.vy;}
 assert.ok(Math.hypot(p.vx,p.vy)<3);
});
test('tactical AI never alters skill damage, HP or cooldown clocks',()=>{
 const a=world().ArenaAutoAI,p=actor(1,100,100,'slash'),foe=actor(2,400,400);
 p.forgeTicks=[20];const before=JSON.stringify({hp:p.hp,skills:p.forge.skills,ticks:p.forgeTicks});
 for(let i=0;i<60;i++)a.steer(p,foe,2.5);
 assert.equal(JSON.stringify({hp:p.hp,skills:p.forge.skills,ticks:p.forgeTicks}),before);
});
