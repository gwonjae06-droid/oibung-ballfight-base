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
test('each floor has the requested 2/4/5/6 real skills and very hard difficulty',()=>{
  const h=world(),model=h.ArenaTowerModel,scenes=h.ArenaTowerScenes.SCENES;
  const ids=[],names=[];
  for(let i=1;i<=10;i++){
    const floor=model.floor(i),foe=model.makeEnemy(i);
    const expected=i<3?2:i<5?4:i%5===0?6:5;
    assert.equal(floor.skillCount,expected,'floor '+i+' description');
    assert.equal(floor.skills.length,expected,'floor '+i+' metadata');
    assert.equal(foe.skills.length,expected,'floor '+i+' live fighter');
    assert.equal(floor.scene,scenes[i-1].id);
    assert.equal(floor.difficulty,'매우 어려움');
    ids.push(floor.scene);names.push(scenes[i-1].name);
    const registry=Array.from(foe.skills,s=>s.actions[0].type);
    assert.equal(new Set(registry).size,expected,'floor '+i+' uses varied moves');
    for(const skill of foe.skills){
      assert.equal(skill.actions.length,1,'one real action per independently timed skill');
      assert.ok(['auto','lowhp','damaged'].includes(skill.trigger));
      assert.ok(skill.cooldown>0);
      assert.ok(h.ActionRegistry.get(skill.actions[0].type),'action exists in registry');
    }
    const normalized=h.SkillForge.normalize(foe,{towerEnemy:true});
    assert.equal(normalized.skills.length,expected,'trusted tower enemy retains all skills');
    const auto=foe.skills.filter(s=>s.trigger==='auto').length;
    assert.equal(auto,floor.autoSkillCount,'metadata shows actual number of periodic skills');
    assert.ok(i<5||auto>=3,'5F+ needs at least three periodic skills');
    if(i>=5)assert.ok(foe.skills.some(s=>s.trigger!=='auto'),'late floors have conditional skills too');
  }
  assert.equal(new Set(ids).size,10);
  assert.equal(new Set(names).size,10);
  assert.equal(model.makeEnemy(5).skills.length,6);
  assert.equal(model.makeEnemy(10).skills.length,6);
  for(let n=6;n<=9;n++)assert.equal(model.makeEnemy(n).skills.length,5);
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
  assert.ok(render.includes('globalThis.ArenaTower?.paintBackground?.(worldCtx,canvas)'));
  const tower=read('js/features/tower-challenge.js');
  assert.match(tower,/screen\.dataset\.towerTheme=f\.scene/);
  assert.match(tower,/global\.ArenaScreenRouter\?\.active!=='tower'/,'independent PvE free matches do not use Tower backgrounds');
});
test('point roulette and per-fighter skins are removed from the active UI',()=>{
  const router=read('js/features/screen-router.js'),gacha=read('js/features/cosmetic-arcade.js');
  assert.match(router,/cosmetic\.hidden=true/);
  assert.ok(!router.includes('screens.mine.append(cosmetic)'));
  assert.ok(!router.includes('mineTab(mineView)'));
  assert.match(router,/global\.CharacterStudioWorkspace\?\.selectTab\?\./);
  assert.match(gacha,/cosmetic-draw-ten/);
  assert.match(gacha,/drawTen/);
  assert.ok(!read('index.html').includes('src="js/features/cosmetic-arcade.js"'));
  assert.match(read('css/streamlined-arena.css'),/#skin-editor/);
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

test('all ten floors disclose every actual skill trigger, cooldown, effects and power',()=>{
  const w=world(),model=w.ArenaTowerModel;
  for(let n=1;n<=10;n++){
    const foe=model.makeEnemy(n),floor=model.floor(n);
    assert.equal(foe.skills.length,floor.skillCount);
    for(const s of foe.skills){
      const info=model.skillDetail(s),action=s.actions[0];
      assert.equal(info.name,s.name);
      assert.ok(info.description.length>=15,n+'F '+s.name);
      assert.ok(info.tags.includes('쿨타임 '+s.cooldown.toFixed(2)+'초'));
      assert.ok(info.tags.includes('기본 위력 '+action.damage)||
        info.tags.includes('직접 피해 없음'));
      assert.ok(info.condition);
      if(action.status==='fire')assert.ok(info.tags.includes('화상 · 지속 피해'));
      if(action.status==='poison')assert.ok(info.tags.includes('중독 · 지속 피해'));
      if(s.trigger==='lowhp')assert.match(info.condition,/HP 70% 이하/);
    }
  }
  assert.equal(model.makeEnemy(9).skills[4].actions[0].count,3,
    'chain lightning should chain to multiple targets, not be a 1-hit label');
  const shield=model.skillDetail(model.makeEnemy(1).skills[1]);
  assert.ok(shield.tags.includes('직접 피해 없음'));
});
test('Tower skill sheet uses expandable real-data cards rather than name badges',()=>{
  const src=read('js/features/tower-challenge.js'),css=read('css/tower-mine-ui.css');
  assert.match(src,/for\(const ability of \(ancient\?\[\]:makeEnemy\(level\)\.skills\)\)/);
  assert.match(src,/패턴 공격 · 2페이즈/);
  assert.match(src,/global\.ArenaEncounter\?\.patternNames/);
  assert.match(src,/doc\.createElement\('details'\)/);
  assert.match(src,/doc\.createElement\('summary'\)/);
  assert.match(src,/metadata\.textContent=info\.tags\.join/);
  assert.match(css,/\.tower-enemy-skill summary:focus-visible/);
});
