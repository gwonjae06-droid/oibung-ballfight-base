'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const balanceSrc=fs.readFileSync('js/features/arena-balance.js','utf8');
const build=(n=4,dmg=80,cooldown=1)=>({skills:Array.from({length:n},(_,i)=>({
 name:'제작 스킬 '+i,trigger:'auto',cooldown,actions:[{
  type:'wave',damage:dmg,radius:120,count:1,duration:1.5,status:'none'}]}))});
function balance(){
 const ctx={Math,Number,Set,console};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(balanceSrc,ctx);return ctx.ArenaBalance;
}
test('four 80-damage one-second skills are substantially weakened without rewriting their settings',()=>{
 const a=balance(),profile=build(),copy=JSON.stringify(profile),detail=a.summary(profile);
 assert.ok(detail.pressure>=300);
 assert.ok(detail.multiplier>.20&&detail.multiplier<.35,'expected soft penalty');
 assert.equal(profile.skills[0].actions[0].damage,80);
 assert.equal(profile.skills[0].cooldown,1);
 assert.equal(JSON.stringify(profile),copy,'saved values must remain unchanged');
 assert.ok(Math.round(80*detail.multiplier)<28);
});
test('balanced 3-second skills are not penalized; increasing cooldown improves efficiency',()=>{
 const a=balance(),normal=build(4,20,3),strong=build(4,80,1),slow=build(4,80,4);
 assert.equal(a.summary(normal).multiplier,1);
 assert.ok(a.summary(slow).multiplier>a.summary(strong).multiplier);
});
test('area, count, repeated effects and statuses count toward the same budget',()=>{
 const a=balance(),base=build(1,60,1),expanded=build(1,60,1);
 const effect=expanded.skills[0].actions[0];
 effect.type='zone';effect.count=6;effect.radius=250;effect.duration=5;effect.status='poison';
 assert.ok(a.summary(expanded).pressure>a.summary(base).pressure*2);
});
test('four-spell budget influences real combat damage, while transient Tower enemies retain boss tuning',()=>{
 const w={Math,Number,Set,Map,console,CUSTOM_DEFS:[],CHARACTER_PHOTOS:{},BEHAVIORS:{},
  players:[],createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(){return null;}};
 w.window=w;vm.createContext(w);vm.runInContext(balanceSrc,w);
 vm.runInContext(fs.readFileSync('js/features/skill-forge.js','utf8'),w);
 const profile=w.SkillForge.normalize({name:'사기 빌드',skills:build().skills});
 const attacker={playerNum:1,x:100,y:100,hp:300,forge:profile};
 const target={playerNum:2,x:130,y:100,invincible:0,radius:20,hp:500,maxHp:500,vx:0,vy:0};
 w.players=[attacker,target];
 const action={type:'wave',damage:80,knockback:0,status:'none',duration:1};
 const factor=w.ArenaBalance.factorOf(attacker);
 assert.equal(w.SkillForge.hit(attacker,target,action),true);
 assert.equal(500-target.hp,Math.round(80*factor));
 target.hp=500;target.invincible=0;attacker.towerEnemy=true;
 assert.equal(w.SkillForge.hit(attacker,target,action),true);
 assert.equal(500-target.hp,80);
});
test('skill block UI previews effective damage without changing raw damage controls',()=>{
 const ui=fs.readFileSync('js/features/block-forge.js','utf8');
 assert.match(ui,/block-power-budget/);
 assert.match(ui,/budget\?\.multiplier/);
 assert.match(ui,/data-key="\+key/);
 const html=fs.readFileSync('index.html','utf8');
 const frame=fs.readFileSync('pvp-runtime.html','utf8');
 assert.ok(html.indexOf('arena-balance.js')<html.indexOf('skill-forge.js'));
 assert.ok(frame.indexOf('arena-balance.js')<frame.indexOf('skill-forge.js'));
});
