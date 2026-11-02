'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..','js/features',p+'.js'),'utf8');
function boot(){
 const g={Math,Date,Number,console,SkillForge:{TYPE:Object.fromEntries([
 'wave','splitshot','shot','haste','timeburst','leap','dive','bolt',
 'blackhole','homing','dash','shield','heal','zone','meteor','summon',
 'rewind','timestop','blink','drain','regen'].map(x=>[x,x]))}};
 g.window=g;g.globalThis=g;
 vm.createContext(g);
 for(const file of ['signature-program','signature-scratch','signature-rule-skill','signature-prompt-compiler'])
  vm.runInContext(read(file),g,{filename:file+'.js'});
 return g.SignaturePromptCompiler;
}
test('freeform Korean cascading projectiles generates safe executable recurring and split-event rules',()=>{
 const p=boot().parse('분열탄을 3개씩 계속 쏘고 파편이 분열하면 다시 분열해. 12초 동안 폭주하자');
 assert.equal(p.ok,true);
 assert.equal(p.recipe.window,12);
 assert.ok(p.recipe.rules.some(x=>x.action.type==='splitshot'&&x.fracture>=2&&x.when==='pulse'));
 assert.ok(p.recipe.rules.some(x=>x.when==='split'));
 assert.equal(p.method,'offline-rule-parser');
});
test('stacking speed + wall reaction + collision wave',()=>{
 const p=boot().parse('벽에 튕길 때마다 가속해서 미친듯이 빨라지고 상대와 충돌하면 충격파를 만들어');
 assert.equal(p.ok,true);
 assert.ok(p.recipe.rules.some(x=>x.when==='wall'&&x.action.type==='haste'));
 assert.ok(p.recipe.rules.some(x=>x.when==='contact'&&x.action.type==='wave'));
});
test('jump to landing to diving loop is built without recursion',()=>{
 const p=boot().parse('계속 점프하고 착지하면 엄청난 낙하 공격을 반복해');
 assert.equal(p.ok,true);
 assert.ok(p.recipe.rules.some(x=>x.when==='pulse'&&x.action.type==='leap'));
 assert.ok(p.recipe.rules.some(x=>x.when==='land'&&x.action.type==='dive'));
});
test('simple Korean requested strikes are interpreted without inventing unsupported actions',()=>{
 const parser=boot();
 for(const [input,type] of [['번개가 1초마다 계속 쏟아지게','bolt'],
 ['블랙홀로 적을 끌어들이고 싶어','blackhole'],
 ['보호막을 계속 펼쳐','shield'],
 ['적에게 유도탄을 발사해','homing'],
 ['차원 이동으로 순간이동','blink']]){
  const x=parser.parse(input);
  assert.equal(x.ok,true,input);
  assert.ok(x.recipe.rules.some(r=>r.action.type===type),input);
 }
});
test('unknown input and empty input fail explicitly rather than silently becoming wave',()=>{
 const parser=boot();
 assert.equal(parser.parse('').ok,false);
 assert.equal(parser.parse('내 마음을 읽고 능력을 무작위로 정해').ok,false);
 assert.equal(parser.parse('a'.repeat(301)).ok,false);
});
test('unsafe extreme numbers become safe normalized bounded controls, never code',()=>{
 const p=boot().parse('분열탄 99발을 위력 999 범위 999로 0.01초마다 999초 동안 끝없이 발사');
 assert.equal(p.ok,true);
 assert.equal(p.recipe.window,18);
 assert.equal(p.recipe.rules[0].interval,.35);
 assert.equal(p.recipe.rules[0].action.count,8);
 assert.equal(p.recipe.rules[0].action.damage,120);
 assert.equal(p.recipe.rules[0].action.radius,300);
 assert.ok(p.notes.length>=3);
});
test('skill editor includes generator proposal/apply and the preview explicitly consumes reactive rules',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../js/features/signature-rule-studio.js'),'utf8');
 assert.match(ui,/rule-prompt/);
 assert.match(ui,/SignaturePromptCompiler/);
 assert.match(ui,/data-rule-command="generate"/);
 assert.match(ui,/data-rule-command="apply"/);
 const lab=fs.readFileSync(path.join(__dirname,'../js/features/studio-pinball-lab.js'),'utf8');
 assert.match(lab,/SignatureRuleLive/);
 assert.match(lab,/recordRuleEvent/);
});
