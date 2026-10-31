'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function world(){
 const h={window:null,Math,Set,Map,Date,console,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},
   CHARACTER_PHOTOS:{},canvas:{width:500,height:500},
   createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(){return null;}};
 h.window=h;vm.createContext(h);
 for(const path of ['js/features/action-registry.js','js/features/forge-expansion.js',
   'js/features/advanced-combat.js','js/features/skill-forge.js',
   'js/features/block-forge.js','js/features/studio-easy-designer.js'])vm.runInContext(read(path),h,{filename:path});
 return h;
}
test('guided designer is valid JS and exposes distinct presets without DOM',()=>{
 const h=world(),api=h.StudioEasyDesigner;
 assert.ok(api&&api.presetPlan&&api.change);
 assert.deepEqual(Object.keys(api.PLANS).sort(),['agile','assault','balanced','control','guardian'].sort());
});
test('all guided templates use 4 validated, playable independent skills',()=>{
 const h=world(),api=h.StudioEasyDesigner,original=h.SkillForge.getDraft();
 for(const type of Object.keys(api.PLANS)){
  const p=api.presetPlan(type,original);
  assert.equal(p.skills.length,4,type);
  assert.equal(p.allAbilities,false,type);
  assert.ok(p.skills.every(s=>s.actions.length===1),type);
  assert.ok(p.skills.every(s=>s.cooldown>=.2&&s.cooldown<=30),type);
  assert.ok(p.skills.every(s=>s.actions.every(a=>h.SkillForge.TYPE[a.type])),type);
 }
});
test('choosing a starter style retains saved character name, appearance and HP',()=>{
 const h=world(),api=h.StudioEasyDesigner;
 const p=h.SkillForge.normalize({
  name:'개인 작품',color:'#123abc',effectColor:'#aa44bb',hp:333,speed:2.4,
  artKey:'keep-original-art',skills:[{name:'원본 동작',cooldown:4,actions:[{type:'shot',damage:37}]}]
 });
 const result=api.presetPlan('guardian',p);
 for(const key of ['name','color','effectColor','hp','speed','artKey'])assert.equal(result[key],p[key],key);
 assert.equal(result.skills[0].actions[0].type,'shield');
 assert.equal(result.skills[1].actions[0].type,'heal');
 assert.equal(result.skills[2].actions[0].type,'fortify');
});
test('simple edits modify exactly the same recipe accepted by the expert BlockForge',()=>{
 const h=world(),easy=h.StudioEasyDesigner,block=h.BlockForge;
 let p=easy.presetPlan('balanced',h.SkillForge.getDraft());
 const untouched=JSON.stringify(p.skills[1]);
 p=easy.change(p,'type',0,'bolt');
 assert.equal(p.skills[0].actions[0].type,'bolt');
 p=easy.change(p,'cooldown',0,'2.7');
 p=easy.change(p,'trigger',0,'lowhp');
 p=easy.change(p,'threshold',0,'35');
 p=easy.change(p,'name',0,'내가 만든 기술');
 assert.equal(p.skills[0].name,'내가 만든 기술');
 assert.equal(p.skills[0].cooldown,2.7);
 assert.equal(p.skills[0].trigger,'lowhp');
 assert.equal(p.skills[0].threshold,35);
 assert.equal(JSON.stringify(p.skills[1]),untouched,'editing first skill must not overwrite others');
 p=block.modify(p,{kind:'add',skill:0,type:'zone'});
 assert.equal(p.skills[0].actions.length,2);
 p=easy.change(p,'type',0,'wave');
 assert.equal(p.skills[0].actions.length,2,'simple edit must not discard expert chain');
 assert.equal(p.skills[0].actions[1].type,'zone');
});
test('adding/removing respects 4-skill limit while retaining extra expert options',()=>{
 const h=world(),easy=h.StudioEasyDesigner;
 let p=h.SkillForge.normalize({
  name:'A',skills:[{name:'스킬1',cooldown:3,actions:[{type:'timestop',duration:2,delay:.5}]}]
 });
 p=easy.change(p,'new-skill');
 assert.equal(p.skills.length,2);
 p=easy.change(p,'new-skill');p=easy.change(p,'new-skill');
 assert.equal(p.skills.length,4);
 assert.throws(()=>easy.change(p,'new-skill'),/최대 4/);
 p=easy.change(p,'remove-skill',2);
 assert.equal(p.skills.length,3);
 assert.equal(p.skills[0].actions[0].type,'timestop');
});
test('expert inspector remains wired to a visible switch and existing block values',()=>{
 const code=read('js/features/studio-easy-designer.js'),
   modes=read('js/features/studio-modes.js'),
   blocks=read('js/features/block-forge.js'),
   html=read('index.html'),css=read('css/ui-clarity.css');
 assert.match(code,/data-designer-mode="expert"/);
 assert.match(code,/data-easy-detail/);
 assert.match(code,/blocks\.inspectSkill\?\./);
 assert.match(code,/original\.forEach\(node=>advanced\.append\(node\)\)/);
 assert.match(blocks,/inspectSkill:\(si,ai=0\)/);
 assert.match(modes,/global\.StudioEasyDesigner\?\.refresh/);
 assert.match(css,/\.studio-easy-presets/);
 assert.match(css,/\.studio-easy-panel\[hidden\]/);
 assert.ok(html.indexOf('studio-easy-designer.js')>html.indexOf('studio-modes.js'));
});
