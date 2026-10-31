'use strict';
const test=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function harness(){
 const g={console,Math,Date,Set,Map,WeakMap,CUSTOM_DEFS:[],BEHAVIORS:{},players:[],
   createHitParticles(){},addFloatingText(){},CHARACTER_PHOTOS:{}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['js/features/action-registry.js','js/features/signature-program.js',
 'js/features/signature-scratch.js','js/features/skill-forge.js']){
  vm.runInContext(read(file),g,{filename:file});
 }
 return g;
}
const action=(type='shot')=>({kind:'action',action:{type,damage:23,radius:120,count:1,speed:5,duration:1.5,status:'none',knockback:0,link:'after'}});
const profile=program=>({name:'코딩 캐릭터',signatureVersion:1,skills:[{name:'내가 코딩한 기술',
 trigger:'auto',cooldown:3,actions:[{type:'shot',damage:20}],program}]});
test('Scratch AST supports nested if/else repeat and waits with real runtime conditions',()=>{
 const g=harness(),S=g.SignatureScratch;
 const program=[action('wave'),{kind:'if',condition:'hpLow',then:[
  {kind:'wait',seconds:.5},{kind:'repeat',times:2,body:[action('shot')]}
 ],else:[action('shield')]}];
 const p={x:0,y:0,hp:20,maxHp:100,_forgeActionClock:80},target={x:90,y:0};
 const hits=S.compile(program,p,target);
 assert.deepEqual(Array.from(hits,a=>a.type),['wave','shot','shot']);
 assert.ok(hits[1].delay>=.5);
 p.hp=95;
 assert.deepEqual(Array.from(S.compile(program,p,target),a=>a.type),['wave','shield']);
});
test('invalid JSON commands and unbounded repeats cannot run arbitrary operations',()=>{
 const g=harness(),S=g.SignatureScratch;
 const unsafe=[{kind:'javascript',code:'eval("alert(1)")'},{
  kind:'repeat',times:999999,body:[action('wave')]}];
 const result=S.normalize(unsafe);
 assert.equal(result.length,1);
 assert.equal(result[0].times,3);
 assert.equal(S.compile(unsafe,{},{}).length,3);
 const deep=Array.from({length:100},()=>action('wave'));
 assert.ok(S.normalize(deep).length<=S.MAX_NODES);
 assert.ok(S.compile(deep,{},{}).length<=S.LIMIT);
});
test('program survives real SkillForge profile normalization and JSON persistence shape',()=>{
 const g=harness(),S=g.SignatureScratch;
 const p=g.SkillForge.normalize(profile([action('wave'),{kind:'if',condition:'near',
  then:[action('dash')],else:[action('shot')]}]));
 assert.equal(p.signatureVersion,1);
 assert.equal(p.skills.length,1);
 assert.equal(p.skills[0].program.length,2);
 const roundtrip=g.SkillForge.normalize(JSON.parse(JSON.stringify(p)));
 assert.equal(roundtrip.skills[0].program[1].condition,'near');
 assert.ok(S.compile(roundtrip.skills[0].program,{x:0,y:0},{x:110,y:0}).some(x=>x.type==='dash'));
});
test('legacy fighters without AST continue using existing 4 independent skills',()=>{
 const g=harness();
 const p=g.SkillForge.normalize({name:'기존 캐릭터',skills:Array.from({length:4},(_,i)=>({
  name:'기술'+i,trigger:'auto',cooldown:3,actions:[{type:'wave',damage:20}]
 }))});
 assert.equal(p.signatureVersion,0);
 assert.equal(p.skills.length,4);
 assert.equal(p.skills[0].program,undefined);
});
test('random button generates bounded meaningful nested executable blocks',()=>{
 const g=harness(),S=g.SignatureScratch;
 const program=S.random(()=>.42);
 assert.ok(program.some(x=>x.kind==='if'));
 assert.ok(program.some(x=>x.kind==='repeat'));
 assert.ok(program.some(x=>x.kind==='action'));
 assert.ok(S.compile(program,{x:0,y:0,hp:100,maxHp:100},{x:90,y:0}).length<=12);
});
test('Scratch editor replaces old two-mode UI and supports nested drag/drop, keyboard and mobile insertion',()=>{
 const editor=read('js/features/scratch-studio.js'),css=read('css/scratch-studio.css'),html=read('index.html');
 for(const symbol of ['scratch-palette','scratch-block-tree','scratch-insert-zone',
  'data-scratch-target','pointerdown','pointermove','pointerup','dragTarget','scratch-live-drop-guide','data-scratch-command="up"',
  'data-scratch-command="down"','data-scratch-command="random"','data-scratch-field="condition"',
  "setProfile(result", "skills.prepend(root)"])assert.ok(editor.includes(symbol),symbol);
 assert.match(css,/\.scratch-cavity/);
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(css,/\.scratch-studio-active #studio-mode-picker/);
 assert.ok(html.indexOf('signature-scratch.js')<html.indexOf('skill-forge.js'));
 assert.ok(html.indexOf('scratch-studio.js')>html.indexOf('studio-easy-designer.js'));
});

test('damage and defensive budgets count the strongest if-branch and repeated actions',()=>{
 const g=harness();
 vm.runInContext(read('js/features/arena-balance.js'),g);
 const program=[{kind:'if',condition:'near',
  then:[{kind:'repeat',times:3,body:[action('shot')]}],
  else:[action('wave')]}];
 const s={name:'교차 공격',trigger:'auto',cooldown:3,actions:[action('wave').action],program};
 const single={...s,program:undefined};
 assert.ok(g.ArenaBalance.skillPressure(s)>g.ArenaBalance.skillPressure(single));
 const defense={kind:'action',action:{...action('wave').action,type:'shield',duration:2}};
 const defender={...s,actions:[defense.action],program:[{kind:'repeat',times:3,body:[defense]}]};
 assert.ok(g.ArenaBalance.defenseSkillPressure(defender)>g.ArenaBalance.defenseSkillPressure({...defender,program:undefined}));
});
