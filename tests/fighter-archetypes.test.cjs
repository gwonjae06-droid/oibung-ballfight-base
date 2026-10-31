'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function context(){
 const g={console,Math,Date,Set,WeakMap,CUSTOM_DEFS:[],BEHAVIORS:{},
  createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;
 vm.createContext(g);
 for(const file of ['js/features/forge-archetypes.js','js/features/skill-forge.js','js/features/arena-auto-ai.js'])
  vm.runInContext(source(file),g,{filename:file});
 return g;
}
const skill={name:'유일 스킬',trigger:'auto',cooldown:3,
 actions:[{type:'shot',target:'nearest',damage:20,radius:120,status:'none'}]};
const draft=(archetype,hp=250,speed=1.8)=>({name:'시험 캐릭터',archetype,hp,speed,
 color:'#aabbcc',effectColor:'#aabbcc',skills:[skill]});
test('five classes have distinct combat stats, fixed HP and movement speeds',()=>{
 const g=context(),classes=g.ForgeArchetypes.TYPES;
 assert.deepEqual(Object.keys(classes),['melee','ranged','defense','mobility','control']);
 const hps=new Set(),speeds=new Set();
 for(const [id,role] of Object.entries(classes)){
  const p=g.SkillForge.normalize(draft(id,500,5));
  assert.equal(p.archetype,id);
  assert.equal(p.hp,role.hp);
  assert.equal(p.speed,role.speed);
  hps.add(role.hp);speeds.add(role.speed);
 }
 assert.equal(hps.size,5);
 assert.equal(speeds.size,5);
 assert.ok(classes.defense.received<1&&classes.melee.attack>1);
 assert.ok(classes.control.control>1&&classes.mobility.speed>classes.defense.speed);
});
test('existing saved profiles and tower enemies retain original HP/speed and balance',()=>{
 const g=context();
 const old=g.SkillForge.normalize(draft(undefined,307,2.45));
 assert.equal(old.archetype,'legacy');
 assert.equal(old.hp,307);assert.equal(old.speed,2.45);
 const enemy=g.SkillForge.normalize(draft('defense',4000,4),{towerEnemy:true});
 assert.equal(enemy.archetype,'legacy');
 assert.equal(enemy.hp,4000);assert.equal(enemy.speed,4);
 const oldDef=g.SkillForge.register(old),created=g.CUSTOM_DEFS.find(d=>d.id===oldDef).createInstance(1);
 assert.equal(created.maxHp,307);
 assert.equal(g.ForgeArchetypes.received(created),1);
});
test('choosing a class does not replace authored skill blocks',()=>{
 const g=context();
 const original=g.SkillForge.normalize(draft(undefined,307,2.45));
 const changed=g.SkillForge.normalize(g.ForgeArchetypes.apply(original,'control'));
 assert.equal(changed.archetype,'control');
 assert.equal(changed.skills[0].name,'유일 스킬');
 assert.equal(changed.skills[0].actions[0].type,'shot');
 assert.equal(changed.hp,255);assert.equal(changed.speed,1.8);
});
test('real damage uses both attacker output and defender resistance',()=>{
 const g=context();
 const a=g.CUSTOM_DEFS.find(d=>d.id===g.SkillForge.register(draft('melee'))).createInstance(1);
 const defender=g.CUSTOM_DEFS.find(d=>d.id===g.SkillForge.register(draft('defense'))).createInstance(2);
 const action={type:'shot',damage:40,status:'none',knockback:0};
 assert.equal(g.SkillForge.hit(a,defender,action),true);
 const expected=Math.round(40*1.12*.78);
 assert.equal(defender.hp,defender.maxHp-expected);
 assert.equal(g.ForgeArchetypes.received(defender),.78);
});
test('control class extends ordinary slow, without bypassing invulnerability',()=>{
 const g=context();
 const c=g.CUSTOM_DEFS.find(d=>d.id===g.SkillForge.register(draft('control'))).createInstance(1);
 const m=g.CUSTOM_DEFS.find(d=>d.id===g.SkillForge.register(draft('melee'))).createInstance(2);
 const a={type:'shot',damage:10,status:'ice',knockback:0};
 assert.equal(g.SkillForge.hit(c,m,a),true);
 assert.equal(m.slowTimer,Math.round(90*1.35));
 assert.equal(m.slowMultiplier,.42);
 m.invincible=100;m._forgeImpactGrace=0;
 assert.equal(g.SkillForge.hit(c,m,a),false);
});
test('archetypes affect preferred AI engagement range independently of skill composition',()=>{
 const g=context();
 const a={forge:{archetype:'melee',skills:[skill]},hp:250,maxHp:250,forgeTicks:[0]};
 const b={forge:{archetype:'ranged',skills:[skill]},hp:250,maxHp:250,forgeTicks:[0]};
 const c={forge:{archetype:'control',skills:[skill]},hp:250,maxHp:250,forgeTicks:[0]};
 assert.equal(g.ArenaAutoAI.loadout(a).preferred,78);
 assert.equal(g.ArenaAutoAI.loadout(b).preferred,185);
 assert.equal(g.ArenaAutoAI.loadout(c).preferred,160);
});
test('studio exposes five choices and keeps current player skills',()=>{
 const sourceText=source('js/features/studio-workspace.js');
 assert.match(sourceText,/forge-role-options/);
 assert.match(sourceText,/global\.SkillForge\.setDraft\(next\)/);
 assert.match(sourceText,/CharacterStudioArchetypes/);
});
