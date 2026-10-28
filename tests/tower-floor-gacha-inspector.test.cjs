'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
  const h={window:null,console,Math,Date};h.window=h;vm.createContext(h);
  for(const script of ['js/features/action-registry.js','js/features/skill-forge.js',
    'js/features/tower-scenes.js','js/features/tower-challenge.js'])
    vm.runInContext(read(script),h,{filename:script});
  return h;
}
test('every floor has a unique named concept and exactly 2/4 independent skills as requested',()=>{
  const h=world(),model=h.ArenaTowerModel,scenes=h.ArenaTowerScenes.SCENES;
  const ids=[],names=[];
  for(let i=1;i<=10;i++){
    const floor=model.floor(i),foe=model.makeEnemy(i);
    const expected=i<3?2:4;
    assert.equal(floor.skillCount,expected,'floor '+i+' description');
    assert.equal(floor.skills.length,expected,'floor '+i+' metadata');
    assert.equal(foe.skills.length,expected,'floor '+i+' live fighter');
    assert.equal(floor.scene,scenes[i-1].id);
    ids.push(floor.scene);names.push(scenes[i-1].name);
    const registry=Array.from(foe.skills,s=>s.actions[0].type);
    assert.equal(new Set(registry).size,expected,'floor '+i+' uses varied moves');
    for(const skill of foe.skills){
      assert.equal(skill.actions.length,1,'one real action per independently timed skill');
      assert.equal(skill.trigger,'auto');
      assert.ok(skill.cooldown>0);
      assert.ok(h.ActionRegistry.get(skill.actions[0].type),'action exists in registry');
    }
    const normalized=h.SkillForge.normalize(foe);
    assert.equal(normalized.skills.length,expected,'SkillForge retains all skills');
  }
  assert.equal(new Set(ids).size,10);
  assert.equal(new Set(names).size,10);
  assert.equal(model.makeEnemy(5).skills.length,4);
  assert.equal(model.makeEnemy(10).skills.length,4);
});
test('early tutorial skills, later mobility, poison, time and cosmic bosses keep their mechanical identities',()=>{
  const h=world(),m=h.ArenaTowerModel;
  assert.deepEqual(Array.from(m.makeEnemy(1).skills,s=>s.actions[0].type),['shot','shield']);
  assert.deepEqual(Array.from(m.makeEnemy(2).skills,s=>s.actions[0].type),['wave','shot']);
  assert.equal(m.makeEnemy(3).skills[0].actions[0].type,'dash');
  assert.equal(m.makeEnemy(3).skills[0].actions[0].damage,0);
  assert.equal(m.makeEnemy(4).skills[0].actions[0].status,'fire');
  assert.equal(m.makeEnemy(6).skills[0].actions[0].status,'poison');
  const steel=Array.from(m.makeEnemy(5).skills,s=>s.actions[0].type);
  const voids=Array.from(m.makeEnemy(10).skills,s=>s.actions[0].type);
  assert.ok(steel.includes('shield')&&steel.includes('uppercut'));
  assert.ok(voids.includes('blackhole')&&voids.includes('starfall'));
  assert.ok(Array.from(m.makeEnemy(8).skills,s=>s.actions[0].type).includes('timestop'));
});
function fakeCtx(){
 const marks=[],ctx={
  marks,fillRect(...v){marks.push(['fillRect',...v]);},
  fill(){marks.push(['fill']);},
  beginPath(){marks.push(['begin']);},arc(...v){marks.push(['arc',...v]);},
  moveTo(...v){marks.push(['move',...v]);},lineTo(...v){marks.push(['line',...v]);},
  stroke(){marks.push(['stroke']);},strokeRect(...v){marks.push(['strokeRect',...v]);},
  save(){marks.push(['save']);},restore(){marks.push(['restore']);},
  rotate(){marks.push(['rotate']);},scale(){marks.push(['scale']);},
  translate(){marks.push(['translate']);},
  createLinearGradient(){return {addColorStop(...v){marks.push(['color',...v]);}};},
  createRadialGradient(){return {addColorStop(...v){marks.push(['radial',...v]);}};}
 };
 return ctx;
}
test('each battleground draws a physically distinct 2D canvas motif without affecting hit logic',()=>{
  const h=world(),visuals=h.ArenaTowerScenes;
  const hashes=[];
  for(let i=1;i<=10;i++){
    const ctx=fakeCtx();
    assert.doesNotThrow(()=>visuals.paint(ctx,560,340,i),'floor '+i+' should paint');
    assert.ok(ctx.marks.length>60,'floor '+i+' draws a real background');
    hashes.push(JSON.stringify(ctx.marks.slice(0,150)));
  }
  assert.equal(new Set(hashes).size,10,'ten different color and shape scenes');
  const render=read('js/core/render.js');
  assert.ok(render.includes('globalThis.ArenaTower?.paintBackground?.(ctx,canvas)'));
  const tower=read('js/features/tower-challenge.js');
  assert.match(tower,/screen\.dataset\.towerTheme=f\.scene/);
  assert.match(tower,/screen\.dataset\.battleMode==='free'/,'free match has original background');
});
test('existing single roulette moves into mine, controls and pity remain untouched',()=>{
  const router=read('js/features/screen-router.js'),gacha=read('js/features/cosmetic-arcade.js');
  assert.match(router,/screens\.mine\.append\(cosmetic\)/);
  assert.ok(!router.includes('cosmeticSlot.append(cosmetic)'));
  assert.match(router,/data-mine-tab="gacha"/);
  assert.match(router,/mineTab\(mineView\)/);
  assert.match(router,/global\.CosmeticArcade\?\.refresh\?\.\(\)/);
  assert.match(router,/global\.CharacterStudioWorkspace\?\.selectTab\?\./);
  assert.match(gacha,/cosmetic-draw-ten/);
  assert.match(gacha,/drawTen/);
  assert.ok(read('index.html').includes('id="cosmetic-roulette"'));
});
test('action inspector uses native collapsed details and keeps selection and edits',()=>{
  const block=read('js/features/block-forge.js'),css=read('css/tower-mine-ui.css');
  assert.match(block,/let selectedSkill=0,selectedAction=0,inspectorOpen=false/);
  assert.match(block,/<details class="block-action-inspector"/);
  assert.match(block,/class="block-inspector-toggle"/);
  assert.match(block,/inspectorOpen=!inspectorOpen/);
  assert.match(css,/details\.block-action-inspector:not\(\[open\]\)>\.block-inspector-body\{display:none!important\}/);
  assert.match(css,/\.block-inspector-toggle:focus-visible/);
  assert.match(block,/else if\(el\.dataset\.edit==='param'\)/);
  assert.match(read('index.html'),/css\/tower-mine-ui\.css/);
});
