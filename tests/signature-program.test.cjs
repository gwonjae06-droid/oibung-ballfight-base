'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function harness(){
 const g={console,Math,Date,Set,Map,WeakMap,CUSTOM_DEFS:[],BEHAVIORS:{}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const f of ['signature-program','skill-forge','block-forge']){
  const p='js/features/'+f+'.js';vm.runInContext(src(p),g,{filename:p});
 }
 return g;
}
const act=(type='shot')=>({type,damage:20,radius:140,count:1,speed:5,duration:2,status:'none',knockback:0,delay:0,link:'and'});
const skill=(i=0)=>({name:'기술'+i,trigger:'auto',cooldown:3,threshold:40,actions:[act()]});
const profile=(sig=1)=>({name:'시그니처',signatureVersion:sig,archetype:'melee',
 color:'#aabbcc',effectColor:'#aabbcc',skills:[skill()]});
test('new profile is one unique skill with up to 12 condition-bearing actions',()=>{
 const g=harness();
 const d={...profile(),skills:[{...skill(),actions:Array.from({length:12},(_,i)=>({...act(),condition:i%2?'near':'always'}))},skill(1)]};
 const n=g.SkillForge.normalize(d);
 assert.equal(n.signatureVersion,1);assert.equal(n.skills.length,1);
 assert.equal(n.skills[0].actions.length,12);
 assert.equal(n.skills[0].actions[1].condition,'near');
 assert.equal(g.SkillForge.normalize({...d,skills:[{...skill(),actions:[{...act(),condition:'arbitrary-code'}]}]}).skills[0].actions[0].condition,'always');
});
test('block editor allows conditional actions, twelve blocks and refuses a second unique skill',()=>{
 const g=harness(),forge=g.BlockForge;
 let p=profile();
 p=forge.modify(p,{kind:'condition',skill:0,index:0,value:'danger'});
 assert.equal(p.skills[0].actions[0].condition,'danger');
 for(let i=0;i<11;i++)p=forge.modify(p,{kind:'add',skill:0,type:'shot'});
 assert.equal(p.skills[0].actions.length,12);
 assert.throws(()=>forge.modify(p,{kind:'add',skill:0,type:'wave'}),/최대 12/);
 assert.throws(()=>forge.modify(p,{kind:'new-skill',type:'shot'}),/한 개/);
 assert.throws(()=>forge.modify(p,{kind:'split',skill:0,index:1}),/한 개/);
 assert.equal(p.skills.length,1);
});
test('stored four-skill profiles stay intact and can explicitly migrate and restore',()=>{
 const g=harness();
 const original={...profile(0),skills:[skill(0),skill(1),skill(2),skill(3)]};
 const legacy=g.SkillForge.normalize(original);
 assert.equal(legacy.skills.length,4);assert.equal(legacy.signatureVersion,0);
 const migrated=g.BlockForge.modify(legacy,{kind:'migrate-signature'});
 assert.equal(migrated.signatureVersion,1);
 assert.equal(migrated.skills.length,1);
 assert.equal(migrated.skills[0].actions.length,4);
 assert.equal(migrated.legacySkills.length,4);
 const restored=g.BlockForge.modify(migrated,{kind:'restore-legacy'});
 assert.equal(restored.signatureVersion,0);
 assert.equal(restored.skills.length,4);
});
test('condition engine checks real proximity, HP, warning and dodge events',()=>{
 const g=harness(),S=g.SignatureProgram;
 const p={x:0,y:0,hp:20,maxHp:100,_forgeActionClock:50,_forgeDodgeWindow:101,_forgeDodgeSerial:1};
 const foe={x:125,y:0};
 assert.equal(S.condition(p,foe,'hpLow'),true);
 assert.equal(S.condition(p,foe,'near'),true);
 assert.equal(S.condition(p,foe,'far'),false);
 assert.equal(S.condition(p,foe,'dodge'),true);
 assert.equal(S.eligible(p,foe,{trigger:'dodge'},0),true);
 p._forgeDodgeConsumed=1;
 assert.equal(S.eligible(p,foe,{trigger:'dodge'},0),false);
 foe.x=200;
 assert.equal(S.condition(p,foe,'far'),true);
 g.ArenaTower={encounter:{tick:10,zones:[{kind:'boss',fire:65}]}};
 assert.equal(S.condition(p,foe,'danger'),true);
 assert.equal(S.eligible(p,foe,{trigger:'danger'},0),true);
 g.ArenaTower.encounter.zones=[];
 assert.equal(S.condition(p,foe,'danger'),false);
});
test('real runtime filters skipped condition blocks before the combat queue',()=>{
 const srcForge=src('js/features/skill-forge.js');
 assert.match(srcForge,/s\.actions\.filter\(a=>global\.SignatureProgram\?\.condition/);
 assert.match(srcForge,/if\(!actions\.length\)return false/);
 assert.match(srcForge,/if\(active&&global\.ArenaAutoAI\?\.canCast/);
 const arena=src('js/features/tower-encounters.js');
 assert.match(arena,/_forgeDodgeSerial=/);
 assert.match(arena, /!z\.hits\.has\(hero\)/);
});
test('five roles coexist with the signature program and page loads the runtime first',()=>{
 const g=harness(),p=g.SkillForge.normalize(profile());
 assert.equal(p.signatureVersion,1);assert.equal(p.skills.length,1);
 const html=src('index.html');
 assert.ok(html.indexOf('signature-program.js')<html.indexOf('skill-forge.js'));
 assert.match(html,/signature-program\.css/);
 const designer=src('js/features/studio-modes.js');
 assert.match(designer,/signatureVersion:1/);
 assert.match(designer,/actions=rolled\.skills\.map/);
});
