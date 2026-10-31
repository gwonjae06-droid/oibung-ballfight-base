'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={console,Math,Date,Map,Set,WeakMap,CUSTOM_DEFS:[],BEHAVIORS:{},players:[],
 createHitParticles(){},addFloatingText(){},CHARACTER_PHOTOS:{}};
 g.window=g;g.globalThis=g;
 vm.createContext(g);
 for(const file of ['js/features/action-registry.js','js/features/forge-archetypes.js','js/features/basic-attacks.js',
   'js/features/signature-program.js','js/features/signature-scratch.js','js/features/signature-live.js','js/features/skill-forge.js']){
  vm.runInContext(read(file),g,{filename:file});
 }
 return g;
}
const profile=(role,opts)=>({name:'전사',archetype:role,signatureVersion:1,
 skills:[{name:'필살기',trigger:'auto',cooldown:5,actions:[{type:'shot',damage:22}]}],basicAttack:opts});
const target=()=>({hp:200,maxHp:200,x:55,y:0,radius:22,invincible:0,slowTimer:0,slowMultiplier:1,vx:0,vy:0});
const hero=(role,opts)=>({forge:{archetype:role,signatureVersion:1,basicAttack:opts},hp:240,maxHp:240,
 x:0,y:0,radius:28,vx:0,vy:0,_forgeActionClock:1,_scratchEvents:Object.create(null)});
test('all five archetypes have genuinely distinct baseline attacks with bounded damage and speed',()=>{
 const g=world(),B=g.BasicAttacks,roles=Object.keys(B.CONFIG);
 assert.deepEqual(roles,['melee','ranged','defense','mobility','control']);
 const actual=roles.map(role=>B.blueprint(role));
 assert.deepEqual(actual.map(x=>x.action.type),['wave','shot','wave','wave','shot']);
 assert.equal(actual[4].action.status,'ice');
 for(const item of actual){assert.ok(item.frames>=43&&item.frames<=220);assert.ok(item.action.damage>=4&&item.action.damage<=28);}
 assert.ok(actual[3].frames<actual[2].frames);
});
test('variant effects carry genuine damage/cadence/range tradeoffs',()=>{
 const B=world().BasicAttacks;
 const base=B.blueprint('ranged'),homing=B.blueprint('ranged',{style:'homing'});
 assert.equal(homing.action.type,'homing');assert.ok(homing.action.damage<base.action.damage);
 assert.equal(B.blueprint('ranged',{style:'pierce'}).action.type,'pierce');
 assert.equal(B.blueprint('ranged',{style:'split'}).action.type,'splitshot');
 assert.ok(B.blueprint('melee',{style:'sweep'}).reach> B.blueprint('melee').reach);
 assert.ok(B.blueprint('control',{style:'root'}).frames>B.blueprint('control').frames);
 assert.ok(B.blueprint('mobility',{style:'double'}).action.damage<B.blueprint('mobility').action.damage);
 const fast=B.blueprint('defense',{tempo:'fast'});
 assert.ok(fast.frames<B.blueprint('defense').frames);
 assert.ok(fast.action.damage<B.blueprint('defense').action.damage);
 const heavy=B.blueprint('defense',{tempo:'heavy'});
 assert.ok(heavy.frames>B.blueprint('defense').frames);
 const heal=B.blueprint('ranged',{effect:'leech'});
 assert.equal(heal.action.basicLifesteal,true);
 assert.ok(heal.action.damage<base.action.damage);
});
test('basic attacks are real independent combat actions, only when in range and unblocked',()=>{
 const g=world(),owner=hero('melee'),foe=target(),events=[];
 for(let i=0;i<80;i++)g.BasicAttacks.tick(owner,foe,{execute:(p,a,t)=>events.push({a,t})});
 assert.ok(events.length>=1);
 assert.equal(events[0].a.basicAttack,true);
 assert.equal(events[0].a.type,'wave');
 const count=events.length,far={...target(),x:900};
 for(let i=0;i<200;i++)g.BasicAttacks.tick(owner,far,{execute:(p,a,t)=>events.push({a,t})});
 assert.equal(events.length,count,'out-of-range attack must not be dispatched');
 const legacy=hero('legacy');
 for(let i=0;i<200;i++)g.BasicAttacks.tick(legacy,foe,{execute:()=>events.push('legacy')});
 assert.equal(events.length,count,'legacy characters receive no surprise attack');
 const classic=hero('melee');classic.forge.signatureVersion=0;
 for(let i=0;i<200;i++)g.BasicAttacks.tick(classic,foe,{execute:()=>events.push('classic')});
 assert.equal(events.length,count,'classic four-skill fighters keep their original attacks only');
 const tower=hero('melee');tower.towerEnemy=true;
 for(let i=0;i<200;i++)g.BasicAttacks.tick(tower,foe,{execute:()=>events.push('tower')});
 assert.equal(events.length,count,'tower enemies preserve authored skills');
});
test('basic attack hits damage through SkillForge.hit and signal signature combos',()=>{
 const g=world(),owner=hero('control'),foe=target();
 const attack=g.BasicAttacks.blueprint('control').action;
 assert.equal(g.SkillForge.hit(owner,foe,attack),true);
 assert.ok(foe.hp<200);
 assert.ok(foe.slowTimer>0);
 assert.equal(owner._scratchEvents.basicHit.count,1);
 assert.equal(owner._scratchEvents.basicStatus.count,1);
 const s={trigger:'basicHit'};
 assert.equal(g.SignatureProgram.eligible(owner,foe,s),true);
 owner._scratchBasicHitConsumed=owner._scratchEvents.basicHit.count;
 assert.equal(g.SignatureProgram.eligible(owner,foe,s),false);
 const run=g.SignatureLive.begin([{kind:'if',condition:'basicHit',
  then:[{kind:'action',action:{type:'wave'}}],else:[]}],owner);
 assert.ok(run);
 assert.equal(g.SignatureLive.condition(owner,foe,'basicHit',run),false);
 owner._forgeActionClock++;
 g.SignatureLive.record(owner,'basicHit');
 assert.equal(g.SignatureLive.condition(owner,foe,'basicHit',run),true);
 const start=g.SignatureLive.begin([{kind:'if',condition:'basicHit',then:[{kind:'action',action:{type:'wave'}}],else:[]}],owner,'basicHit');
 assert.equal(g.SignatureLive.condition(owner,foe,'basicHit',start),true,
   'a triggered skill should see the confirmed hit that started it');
});
test('lifesteal is capped, confirmed-hit only, and never heals above maxHP',()=>{
 const g=world(),owner=hero('ranged',{effect:'leech'}),foe=target();
 owner.hp=235;
 const a=g.BasicAttacks.blueprint('ranged',{effect:'leech'}).action;
 g.SkillForge.hit(owner,foe,a);
 assert.ok(owner.hp>235&&owner.hp<=240);
 const hp=owner.hp;
 g.SkillForge.hit(owner,{...target(),invincible:40,_forgeImpactGrace:0},a);
 assert.equal(owner.hp,hp);
});
test('new fighter stores attack variants; old or enemy data preserves previous system',()=>{
 const g=world();
 const newProfile=g.SkillForge.normalize(profile('ranged',{style:'pierce',effect:'slow',tempo:'heavy'}));
 assert.equal(newProfile.basicAttack.style,'pierce');
 const reload=g.SkillForge.normalize(JSON.parse(JSON.stringify(newProfile)));
 assert.equal(reload.basicAttack.effect,'slow');
 assert.equal(reload.basicAttack.tempo,'heavy');
 const original=g.SkillForge.normalize({name:'old',archetype:'melee',skills:[{name:'old',trigger:'auto',cooldown:3,actions:[{type:'wave',damage:18}]}]});
 assert.equal(original.signatureVersion,0);
 assert.equal(original.basicAttack,undefined);
 const enemy=g.SkillForge.normalize(profile('melee'),{towerEnemy:true});
 assert.equal(enemy.basicAttack,undefined);
});
test('studio UI contains class-specific choices, tradeoffs and a separate custom signature',()=>{
 const ui=read('js/features/basic-attack-designer.js'),css=read('css/basic-attack-designer.css');
 const main=read('js/features/scratch-beginner.js'),html=read('index.html');
 for(const term of ['base-style-options','base-effect-options','base-tempo-options','base-preview-stats',
  'forge.setDraft','scratch-beginner','aria-pressed','전투 유형'])assert.ok(ui.includes(term),term);
 assert.ok(main.includes('내 필살기 만들기'));
 assert.ok(css.includes('@media(max-width:570px)'));
 assert.ok(html.indexOf('basic-attacks.js')<html.indexOf('skill-forge.js'));
 assert.ok(html.indexOf('basic-attack-designer.js')>html.indexOf('scratch-beginner.js'));
});
