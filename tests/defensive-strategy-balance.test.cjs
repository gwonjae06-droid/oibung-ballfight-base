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
test('overtime forced percent damage bypasses shield without choosing by raw HP',()=>{
 const w=arena(),S=w.ArenaStalemate;
 const attacker={playerNum:1,x:100,y:100,hp:200,maxHp:200,forge:w.SkillForge.normalize(profile())};
 const defender={playerNum:2,x:130,y:100,hp:1000,maxHp:1000,radius:25,invincible:6000,vx:0,vy:0};
 w.players=[attacker,defender];const shield=defender.invincible;
 for(let i=0;i<S.LIMITS.stagnant+S.LIMITS.pulse;i++)S.tick(w.players);
 assert.ok(S.state.active);
 assert.equal(S.state.pulses,1);
 const pct=S.pulseRate(S.LIMITS.pulse)/100;
 assert.ok(Math.abs((200-attacker.hp)/200-pct)<.0001);
 assert.ok(Math.abs((1000-defender.hp)/1000-pct)<.0001);
 assert.equal(defender.invincible,shield,'the shield skill is not deleted');
});
test('overwhelming healing can resist early overtime, but the draw deadline always finishes',()=>{
 const S=arena().ArenaStalemate;
 const roster=[{hp:500,maxHp:500,invincible:500000},{hp:70,maxHp:300,invincible:500000}];
 for(let i=0;i<S.LIMITS.stagnant+S.LIMITS.deadline+2;i++){
  if(i%40===0)for(const p of roster)p.hp=p.maxHp;
  S.tick(roster);if(S.state.expired)break;
 }
 assert.equal(S.state.expired,true);
 assert.ok(roster.every(p=>p.hp>0));
});
test('extreme shields and healing are softened separately, never hard-capped',()=>{
 const w=arena(),a=w.ArenaBalance;
 const simple=profile(true),stack=profile(true);
 stack.skills=[1,2,3,4].map(i=>({...simple.skills[0],name:'방어 '+i}));
 const weak=a.defenseSummary(simple),heavy=a.defenseSummary(stack);
 assert.equal(a.summary(stack).multiplier,1,'defense never hurts attack damage');
 assert.ok(weak.multiplier>heavy.multiplier);
 assert.ok(heavy.multiplier>=.38,'soft floor permits extreme defensive builds');
 const heal={skills:[{name:'소생',cooldown:.2,trigger:'auto',actions:[{type:'heal',damage:120}]}]};
 assert.ok(a.defenseSummary(heal).multiplier<1);
 assert.equal(a.defenseSummary(profile(false)).multiplier,1);
});
test('special boss defense windows are shorter than their reuse rate, not a user-wide shield nerf',()=>{
 const tower=read('js/features/tower-challenge.js');
 assert.match(tower,/duration:type==='shield'&&f\.boss\?/);
 assert.match(tower,/time:\.28,storm:\.25,ice:\.58/);
 assert.doesNotMatch(read('js/features/skill-forge.js'),/p\.invincible=Math\.min\(p\.invincible/);
 const ui=read('index.html');
 assert.match(ui,/2초마다 최대 HP 비례 피해 · 회복 가능/);
});
