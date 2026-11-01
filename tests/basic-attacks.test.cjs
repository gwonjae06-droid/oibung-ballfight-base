'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={console,Math,Date,WeakMap,Set,Map,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
 createHitParticles(){},addFloatingText(){},canvas:{width:500,height:500}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['js/features/action-registry.js','js/features/forge-archetypes.js',
  'js/features/signature-program.js','js/features/signature-scratch.js','js/features/signature-live.js',
  'js/features/bounce-momentum.js','js/features/arena-balance.js','js/features/skill-forge.js']){
  vm.runInContext(read(file),g,{filename:file});
 }
 return g;
}
const profile=()=>({name:'스킬만 사용',archetype:'ranged',signatureVersion:1,
 basicAttack:{style:'split',effect:'leech',tempo:'fast'},
 skills:[{name:'나의 스킬',trigger:'auto',cooldown:3,actions:[{type:'shot',damage:25}]}]});
test('old saved basic attack settings are ignored but custom authored skills survive',()=>{
 const g=world(),p=g.SkillForge.normalize(profile());
 assert.equal(p.basicAttack,undefined);
 assert.equal(p.skills[0].name,'나의 스킬');
 assert.equal(p.skills[0].actions[0].type,'shot');
 assert.equal(g.SkillForge.normalize(JSON.parse(JSON.stringify(p))).basicAttack,undefined);
});
test('auto combat never invokes any automatic basic attack, even with stale old JSON',()=>{
 const g=world(),p=g.SkillForge.normalize(profile());
 g.SkillForge.register({...p,basicAttack:{style:'heavy',tempo:'fast'}});
 const hero=g.CUSTOM_DEFS[0].createInstance(1);
 const foe={hp:300,maxHp:300,x:60,y:40,vx:0,vy:0,radius:28,invincible:0,playerNum:2};
 hero.x=50;hero.y=40;g.players.push(hero,foe);
 let calls=0;
 g.BasicAttacks={tick(){calls++;throw Error('passive attack must not execute');}};
 for(let i=0;i<180;i++)g.SkillForge.autoUpdate(hero,foe);
 assert.equal(calls,0);
 assert.equal(foe.hp,300);
 assert.equal(hero._bounceCasts||0,0);
});
test('main and PvP runtime do not load archived basic attack code or its UI',()=>{
 for(const file of ['index.html','pvp-runtime.html']){
  const s=read(file);
  assert.ok(!s.includes('basic-attacks.js'));
  assert.ok(!s.includes('basic-attack-designer.js'));
 }
 const html=read('index.html');
 assert.ok(!html.includes('css/basic-attack-designer.css'));
 assert.match(html,/js\/features\/studio-pinball-lab\.js/);
 assert.doesNotMatch(read('js/features/skill-forge.js'),/BasicAttacks\?\.tick/);
 assert.doesNotMatch(read('js/features/skill-forge.js'),/BasicAttacks\?\.normalize/);
});
