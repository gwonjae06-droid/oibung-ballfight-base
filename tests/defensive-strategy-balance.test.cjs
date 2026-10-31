'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
function arena(){
 const w={Math,Number,Map,Set,console,players:[],CUSTOM_DEFS:[],CHARACTER_PHOTOS:{},BEHAVIORS:{},
   createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(){return null;}};
 w.window=w;w.globalThis=w;vm.createContext(w);
 for(const file of ['arena-balance','arena-stalemate','skill-forge'])vm.runInContext(read('js/features/'+file+'.js'),w);
 return w;
}
function profile(shield=false){return {name:shield?'보호막 빌드':'공격 빌드',hp:300,
 skills:[{name:'첫 기술',trigger:'auto',cooldown:1.4,actions:[
  shield?{type:'shield',duration:8,damage:0}:{type:'wave',damage:30,radius:120,status:'none',knockback:0}
 ]}]};}
test('custom shield and healing settings remain unnerfed by the soft damage budget',()=>{
 const w=arena(),shield=w.SkillForge.normalize(profile(true));
 assert.equal(shield.skills[0].actions[0].duration,8);
 assert.equal(shield.skills[0].cooldown,1.4);
 assert.equal(w.ArenaBalance.summary(shield).multiplier,1);
});
test('Tower-only bosses can keep intended HP, while custom fighters retain the 500 HP limit',()=>{
 const w=arena(),p=profile();
 p.hp=1178;
 assert.equal(w.SkillForge.normalize(p).hp,500);
 assert.equal(w.SkillForge.normalize(p,{towerEnemy:true}).hp,1178);
});
test('overtime rewards successful hits but never bypasses a defensive shield',()=>{
 const w=arena(),S=w.ArenaStalemate;
 const attacker={playerNum:1,x:100,y:100,hp:300,maxHp:300,forge:w.SkillForge.normalize(profile())};
 const defender={playerNum:2,x:130,y:100,hp:300,maxHp:300,radius:25,invincible:0,vx:0,vy:0};
 w.players=[attacker,defender];
 const hit={type:'wave',damage:30,knockback:0,status:'none'};
 assert.equal(w.SkillForge.hit(attacker,defender,hit),true);
 assert.equal(300-defender.hp,30,'before overtime uses authored damage');
 defender.hp=300;defender.invincible=60;
 for(let i=0;i<S.LIMITS.stagnant;i++)S.tick(w.players);
 assert.ok(S.attackFactor()>1);
 assert.equal(w.SkillForge.hit(attacker,defender,hit),false);
 assert.equal(defender.hp,300,'no unavoidable overtime damage through the shield');
 defender.invincible=0;
 assert.equal(w.SkillForge.hit(attacker,defender,hit),true);
 assert.equal(300-defender.hp,Math.round(30*S.attackFactor()));
});
test('long healing and invulnerability stalemates are neutral draws, regardless of current HP',()=>{
 const S=arena().ArenaStalemate;
 const roster=[{hp:500,maxHp:500,invincible:500000},{hp:70,maxHp:300,invincible:500000}];
 for(let i=0;i<S.LIMITS.stagnant+S.LIMITS.deadline+2;i++)S.tick(roster);
 assert.equal(S.state.expired,true);
 assert.equal(roster[0].hp,500);
 assert.equal(roster[1].hp,70);
});
test('special boss defense windows are shorter than their reuse rate, not a user-wide shield nerf',()=>{
 const tower=read('js/features/tower-challenge.js');
 assert.match(tower,/duration:type==='shield'&&f\.boss\?/);
 assert.match(tower,/time:\.28,storm:\.25,ice:\.58/);
 assert.doesNotMatch(read('js/features/skill-forge.js'),/p\.invincible=Math\.min\(p\.invincible/);
 const ui=read('index.html');
 assert.match(ui,/공격 위력 상승 · 보호막과 회복은 그대로/);
});
