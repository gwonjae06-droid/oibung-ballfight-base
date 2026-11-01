'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const src=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function world(){
 const g={console,Math,Date,Set,Map,WeakMap,CUSTOM_DEFS:[],BEHAVIORS:{}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const path of ['js/features/action-registry.js','js/features/signature-program.js',
   'js/features/signature-scratch.js','js/features/signature-live.js','js/features/skill-forge.js'])
  vm.runInContext(src(path),g,{filename:path});
 return g;
}
const action=(type)=>({kind:'action',action:{type,damage:22,radius:120,count:1,
 speed:5,duration:1.5,status:'none',knockback:0,link:'after'}});
test('elementary-friendly builder offers obvious 3-step creation, plain speech and visible preview',()=>{
 const s=src('js/features/scratch-beginner.js');
 for(const phrase of ['① 기세가 100이 되면','② 행동을 최대 4개 선택','③ 순서와 연계 편집',
  '나만의 전투 기술 설계','▶ 스킬 동작 시연 (승률 예측 아님)','기본 설계','고급 코딩',
  'kid-trigger-options','kid-action-grid','kid-plan','data-kid-command="random"']){
   assert.ok(s.includes(phrase),phrase);
 }
});
test('skill presets use supported real combat blocks and never introduce raw executable content',()=>{
 const g=world(),S=g.SignatureScratch;
 const allowed=['slash','wave','shot','bolt','dash','blink','retreat','shield','heal','zone'];
 for(const type of allowed){
  assert.ok(g.SkillForge.TYPE[type],type);
  const program=S.normalize([action(type)]);
  assert.equal(program.length,1);
  assert.equal(program[0].action.type,type);
  assert.ok(S.compile(program,{hp:150,maxHp:250},{x:100,y:0}).length<=12);
 }
});
test('beginner and expert UIs write the same versioned Scratch program',()=>{
 const b=src('js/features/scratch-beginner.js'),expert=src('js/features/scratch-studio.js');
 assert.match(b,/S\.applyProgram\(/);
 assert.match(b,/S\.applyFields\(/);
 assert.match(b,/compiler/);
 assert.match(expert,/applyProgram\(program,fields=/);
 assert.match(expert,/applyFields\(fields=/);
 assert.match(expert,/g\.ScratchStudio\?\.onChange\?\.\(\)/);
 assert.match(b,/S\.onChange=refresh/);
 const html=src('index.html');
 assert.ok(html.indexOf('scratch-studio.js')<html.indexOf('scratch-beginner.js'));
 assert.match(html,/scratch-beginner\.css/);
});
test('former four-skill profiles are preserved until the user explicitly converts',()=>{
 const g=world();
 const p={name:'이전 파이터',skills:Array.from({length:4},(_,i)=>({
  name:'기술'+i,trigger:'auto',cooldown:3,actions:[{type:'wave',damage:20}]
 }))};
 const before=g.SkillForge.normalize(p);
 assert.equal(before.signatureVersion,0);assert.equal(before.skills.length,4);
 const result=g.SignatureProgram.migrate(before);
 assert.equal(result.signatureVersion,1);assert.equal(result.skills.length,1);
 assert.equal(result.legacySkills.length,4);
 const restored=g.SignatureProgram.restore(result);
 assert.equal(restored.skills.length,4);
 assert.match(src('js/features/scratch-beginner.js'),/safeConfirm\(/);
});
test('large controls remain legible and stacking works on mobile',()=>{
 const css=src('css/scratch-beginner.css');
 assert.match(css,/min-height:69px/);
 assert.match(css,/min-height:117px/);
 assert.match(css,/@media\(max-width:790px\)/);
 assert.match(css,/@media\(max-width:440px\)/);
 assert.match(css,/\.kid-trigger\[aria-pressed=true\]/);
 assert.match(css,/focus-visible/);
 assert.match(css,/scratch-friendly-advanced/);
 assert.match(css,/scratch-main-nav/);
});
test('advanced view and appearance UI remain reachable, original Scratch has no duplicated engine',()=>{
 const easy=src('js/features/scratch-beginner.js');
 assert.match(easy,/data-scratch-tab="looks"/);
 assert.match(easy,/S\.render\(\)/);
 assert.match(easy,/compiler\.safeAction/);
 assert.match(easy,/get mode\(\)/);
 assert.match(easy,/g\.CharacterStudioWorkspace\?\.selectPreviewSkill/);
});

test('intermediate workbench edits validated action attributes and preserves advanced Scratch workflow',()=>{
 const ui=src('js/features/scratch-beginner.js'),css=src('css/scratch-beginner.css');
 for(const word of ['data-kid-edit','data-kid-move','data-kid-dir','data-kid-key="link"',
  'data-kid-key="target"','data-kid-key="damage"','data-kid-key="radius"',
  'compiler.safeAction','S.applyProgram','if(code.length>=4']){
  assert.ok(ui.includes(word),word);
 }
 assert.match(ui,/scratch-friendly-advanced/);
 assert.match(css,/kid-action-fields/);
 assert.match(css,/min-height:42px/);
});
