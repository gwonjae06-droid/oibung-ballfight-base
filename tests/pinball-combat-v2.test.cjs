'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function boot(){
 const g={Math,Date,console,Map,Set,WeakMap,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},
  CHARACTER_PHOTOS:{},canvas:{width:500,height:500},
  createHitParticles(){},addFloatingText(){},ArenaScreenRouter:{active:'tower'}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['action-registry','forge-archetypes','signature-program',
  'signature-scratch','signature-live','arena-balance',
  'bounce-momentum','arena-combat-v2','arena-body-physics','skill-forge',
  'tower-tactics'])vm.runInContext(read('js/features/'+file+'.js'),g,{filename:file});
 return g;
}
function ball(n=1){return {playerNum:n,forge:{signatureVersion:1,effectColor:'#5bf',
  signatureTiming:'instant'},towerHero:n===1,towerEnemy:false,hp:300,maxHp:300,
  x:135+n*30,y:245,vx:3,vy:2,radius:28,_forgeActionClock:1,
  _scratchEvents:Object.create(null)};}
test('graded impacts reward only real collision events and never add contact damage',()=>{
 const g=boot(),p=ball(),q=ball(2),M=g.BounceMomentum,C=g.ArenaCombatV2;
 q.towerEnemy=true;q.forge.signatureVersion=0;
 assert.equal(C.grade(2),'normal');assert.equal(C.grade(5),'heavy');
 assert.equal(C.grade(7.1),'perfect');
 assert.equal(M.contact(p,q,-.7),false);
 assert.equal(p._combat2Combo,undefined);
 assert.equal(M.wall(p,1),false);
 assert.equal(p.hp,300);assert.equal(q.hp,300);
 assert.equal(M.wall(p,7,'wall'),true);
 assert.equal(p._combat2Combo.quality,'perfect');
 assert.equal(p._combat2Combo.chain,1);
 p._forgeActionClock=29;
 assert.equal(M.wall(p,7,'wall'),true);
 assert.equal(p._combat2Combo.chain,1,'same wall category never farms combos');
 p._forgeActionClock=65;
 assert.equal(M.contact(p,q,-5),true);
 assert.equal(p._combat2Combo.chain,2);
 p._forgeActionClock=105;
 assert.equal(M.wall(p,7,'bumper'),true);
 assert.equal(p._combat2Combo.chain,3);
 assert.equal(p._combat2NextBoost,1.10);
 assert.ok(M.meter(p)>0&&M.meter(p)<=100);
 assert.equal(p.hp,300);assert.equal(q.hp,300);
});
test('combo bonus is one cast only, bounded, and never modifies underlying saved action',()=>{
 const g=boot(),p=ball(),C=g.ArenaCombatV2;
 p._combat2NextBoost=1.10;
 C.onCast(p);assert.equal(C.damageFactor(p),1.10);
 assert.equal(p._combat2NextBoost,1);
 C.onCast(p);assert.equal(C.damageFactor(p),1);
 p._combat2NextBoost=12;C.onCast(p);
 assert.equal(C.damageFactor(p),1.10,'even malformed carry-over cannot exceed 10%');
 p._forgeActionClock+=421;assert.equal(C.damageFactor(p),1);
});
test('signature contact and boss-warning timings have strict simulation-tick fallback',()=>{
 const g=boot(),p=ball(),q=ball(2),C=g.ArenaCombatV2,M=g.BounceMomentum;
 p.forge.signatureTiming='contact';
 p._forgeActionClock=15;M.add(p,100,'tactic');
 assert.equal(C.shouldCast(p,q),false);
 p._forgeActionClock=16;assert.equal(C.shouldCast(p,q),false);
 g.SignatureLive.record(p,'contact');
 assert.equal(C.shouldCast(p,q),true);
 p.forge.signatureTiming='danger';
 assert.equal(C.shouldCast(p,q),false);
 g.ArenaTower={encounter:{tick:220,zones:[{kind:'boss',fire:260}]}};
 assert.equal(C.shouldCast(p,q),true);
 g.ArenaTower.encounter.zones=[];
 p._forgeActionClock=15+C.WAIT;
 assert.equal(C.shouldCast(p,q),true,'no indefinite waiting without a boss hazard');
 p.forge.signatureTiming='instant';
 p._forgeActionClock=16;assert.equal(C.shouldCast(p,q),true);
});
test('old saves default to immediate trigger and new 100-energy trigger survives normalize',()=>{
 const g=boot(),forge=g.SkillForge;
 const original={name:'전투 시험',signatureVersion:1,
  skills:[{name:'결전',trigger:'auto',cooldown:4.5,actions:[{type:'shot',damage:30}]}]};
 const normal=forge.normalize(original);
 assert.equal(normal.signatureTiming,'instant');
 assert.equal(forge.normalize({...original,signatureTiming:'danger'}).signatureTiming,'danger');
 assert.equal(forge.normalize({...original,signatureTiming:'contact'}).signatureTiming,'contact');
 assert.equal(forge.normalize({...original,signatureTiming:'invalid'}).signatureTiming,'instant');
 assert.equal(forge.normalize({...original,signatureVersion:0,signatureTiming:'danger'}).signatureTiming,'instant');
});
test('actual SkillForge waits after 100 and casts on next real contact or timeout',()=>{
 const g=boot(),forge=g.SkillForge,M=g.BounceMomentum;
 const profile={name:'대기 테스트',signatureVersion:1,signatureTiming:'contact',skills:[
 {name:'기세탄',trigger:'auto',cooldown:.2,actions:[{type:'shot',damage:20,radius:105}]}]};
 forge.register(profile);
 const p=g.CUSTOM_DEFS[0].createInstance(1),q={playerNum:2,hp:900,maxHp:900,
   x:380,y:400,radius:24,invincible:0,vx:0,vy:0};
 g.players.push(p,q);
 p.x=100;p.y=100;
 M.add(p,100,'tactic');
 forge.autoUpdate(p,q);
 assert.equal(p._bounceCasts||0,0,'no cast on charge with post-charge impact timing');
 g.SignatureLive.record(p,'contact');
 forge.autoUpdate(p,q);
 assert.equal(p._bounceCasts,1,'next real collision releases the skill');
 assert.equal(M.meter(p),0);
 for(let i=0;i<2;i++)forge.autoUpdate(p,q);
 M.add(p,100,'tactic');p._forgeActionClock+=140;
 forge.autoUpdate(p,q);
 assert.equal(p._bounceCasts,2,'two-second fallback avoids deadlock');
});
test('tower-only tactical abilities are actual bounded physics and protection; not PvP AI steering',()=>{
 const g=boot(),T=g.ArenaTowerTactics,p=ball();
 g.ArenaTower={active:true,stage:'fighting',state:{realm:'time'}};
 g.players.push(p,ball(2));
 const v=Math.hypot(p.vx,p.vy);
 assert.equal(T.choose('attack'),true);
 assert.ok(Math.hypot(p.vx,p.vy)>v);
 assert.ok(g.BounceMomentum.meter(p)>=8);
 assert.equal(T.state.remaining,1);
 assert.equal(T.choose('hold'),true);
 assert.ok(p._tacticalAnchorUntil>p._forgeActionClock);
 assert.ok(g.ArenaBodyPhysics.mass(p)>g.ArenaBodyPhysics.mass({...p,towerHero:false}));
 assert.equal(T.choose('evade'),false);
 T.reset();assert.equal(T.choose('evade'),true);assert.ok(p.invincible>=21);
 g.ArenaTower.stage='between';assert.equal(T.choose('attack'),false);
 g.ArenaTower.stage='fighting';p.manualTower=true;const m=Math.hypot(p.vx,p.vy);
 T.reset();T.choose('attack');assert.equal(Math.hypot(p.vx,p.vy),m);
});
test('new combat features never award PvP fighters extra energy, grades or bonuses',()=>{
 const g=boot(),p=ball(),M=g.BounceMomentum,C=g.ArenaCombatV2;
 g.ArenaScreenRouter.active='pvp';
 M.wall(p,8,'bumper');
 assert.equal(p._combat2Combo,undefined);
 assert.equal(C.damageFactor(p),1);
 assert.equal(C.shouldCast(p),true);
 assert.ok(!C.eligible(p));
});
test('new scripts load before engine, UI remains responsive and original movement rules remain',()=>{
 const html=read('index.html'),src=read('js/features/arena-pinball-motion.js'),
  css=read('css/bounce-momentum.css');
 assert.ok(html.indexOf('arena-combat-v2.js')>0);
 assert.ok(html.indexOf('arena-combat-v2.js')<html.indexOf('js/core/engine.js'));
 assert.match(read('js/features/tower-flat-arena.js'),/undefined,'bumper-'\+i/);
 assert.match(read('js/features/studio-easy-designer.js'),/data-easy-key="timing"/);
 assert.match(read('js/features/skill-forge.js'),/signatureTiming/);
 assert.match(css,/arena-combo-status/);
 assert.match(src,/Ordinary movement never reads enemy position/);
});
