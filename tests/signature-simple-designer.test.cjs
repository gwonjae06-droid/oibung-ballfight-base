'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=rel=>fs.readFileSync(path.join(__dirname,'..',rel),'utf8');
function world(){
 const g={console,Math,Date,SkillForge:{TYPE:{wave:'충격파',dash:'돌진',shot:'구슬',heal:'회복'}}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const rel of ['js/features/signature-program.js','js/features/signature-scratch.js','js/features/signature-simple-designer.js'])
  vm.runInContext(read(rel),g,{filename:rel});
 return g;
}
const make=(type,damage=30,condition='always',repeat=1)=>({action:{type,damage,radius:130,link:'after'},condition,repeat});
test('single editor round-trip compiles conditional repeated actions with bounded size',()=>{
 const g=world(),S=g.SignatureSimpleDesigner;
 const steps=[make('dash',0),make('wave',48,'near',2),make('shield' in g.SkillForge.TYPE?'shield':'heal',25,'hpLow')];
 const result=S.build(steps);
 const parsed=S.read(result);
 assert.equal(parsed.length,3);
 assert.equal(parsed[1].repeat,2);
 assert.equal(parsed[1].condition,'near');
 assert.equal(g.SignatureScratch.compile(result,{hp:150,maxHp:500,x:0,y:0},{x:30,y:0},{condition:()=>true}).length,4);
});
test('limit four steps, six executions, damage 65 and 170 budget',()=>{
 const g=world(),S=g.SignatureSimpleDesigner;
 assert.match(S.inspect(Array.from({length:5},()=>make('wave',10))).reason,/4개/);
 assert.match(S.inspect(Array.from({length:4},()=>make('wave',10,'always',2))).reason,/6개/);
 assert.match(S.inspect([make('wave',66)]).reason,/0~65/);
 assert.match(S.inspect([make('wave',60),make('shot',60),make('wave',60)]).reason,/예산/);
 assert.equal(S.inspect([make('wave',50),make('shot',20,'danger',2),make('dash',0)]).ok,true);
});
test('advanced nested program is not implicitly converted, explicit flattening is safe',()=>{
 const g=world(),S=g.SignatureSimpleDesigner;
 const old=g.SignatureScratch.normalize([{kind:'if',condition:'near',
  then:[{kind:'action',action:{type:'wave',damage:100}},{kind:'action',action:{type:'shot',damage:50}}],else:[]}]);
 assert.equal(S.read(old),null);
 const copy=JSON.stringify(old),simple=S.flatten(old);
 assert.equal(simple[0].action.damage,65);
 assert.equal(S.inspect(simple).ok,true);
 assert.equal(JSON.stringify(old),copy,'existing program remains untouched');
});
test('single editor has no expert switches, modal settings or hidden Scratch workbench',()=>{
 const js=read('js/features/scratch-beginner.js'),css=read('css/scratch-beginner.css');
 assert.doesNotMatch(js,/data-kid-view|function chooseMode/);
 assert.doesNotMatch(js,/<details class="kid-action-settings"/);
 assert.match(js,/data-kid-key="condition"/);
 assert.match(js,/data-kid-key="repeat"/);
 assert.match(js,/data-kid-key="link"/);
 assert.match(js,/SignatureSimpleDesigner/);
 assert.match(css,/#scratch-workbench\s*\{display:none!important\}/);
 assert.match(css,/#studio-easy-panel/);
 assert.match(read('index.html'),/signature-simple-designer\.js/);
});
