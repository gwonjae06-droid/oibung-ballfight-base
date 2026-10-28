'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html'),css=read('css/ui-clarity.css'),
  workspace=read('js/features/studio-workspace.js'),
  categories=read('js/features/ui-categories.js'),
  flow=read('js/features/ui-flow.js');
test('desktop studio uses broad 2-column preview-left/edit-right and keeps original canvas',()=>{
  assert.match(css,/\.character-studio-dialog\{\s*width:min\(96vw,1560px\)/);
  assert.match(css,/grid-template-columns:minmax\(355px,\.91fr\) minmax\(0,1\.5fr\)/);
  assert.match(css,/\.studio-motion-preview\{[\s\S]*?grid-column:1;grid-row:2/);
  assert.match(css,/\.character-studio-content\{[\s\S]*?grid-column:2;grid-row:2/);
  assert.match(css,/\.studio-motion-stage\{[\s\S]*?aspect-ratio:8\/3/);
  assert.match(css,/overflow-y:auto/);
  assert.ok(workspace.includes("shell.insertBefore(preview,content)"),
    'retain same preview element and canvas instead of adding a second preview');
  assert.match(workspace,/id="studio-motion-canvas"/);
  assert.ok(workspace.includes('SkillVisuals?.previewFrame?.('));
  assert.ok(!workspace.includes('SkillForge.cast('),'preview cannot execute live combat');
});
test('block editor is first and the one existing character roster is after save',()=>{
  assert.match(workspace,/\[blocks,random,tuning,library,\.\.\.rest\]/);
  assert.match(workspace,/\[name,tabs,skills,looks,create,manager,saved\]/);
  assert.equal((workspace.match(/manager\.append\(owned\)/g)||[]).length,1);
  assert.equal((workspace.match(/manager\.append\(feedback\)/g)||[]).length,1);
  assert.ok(!categories.includes("hint.textContent='랜덤 생성"),'remove repeated intro text');
  assert.ok(css.includes('.studio-roster-manager'));
  assert.ok(html.includes('js/features/studio-workspace.js'));
});
test('single battle controls move to right setup and keep all engine selectors',()=>{
  assert.equal((html.match(/id="btn-start"/g)||[]).length,1);
  assert.equal((html.match(/id="btn-reset"/g)||[]).length,1);
  assert.equal((html.match(/id="arena-player-count"/g)||[]).length,1);
  assert.equal((html.match(/class="control-panel"/g)||[]).length,1);
  assert.ok(flow.includes("const controls=arena.querySelector('.control-panel')"));
  assert.ok(flow.includes('picks.after(controls)'),'move original node, never clone');
  assert.ok(flow.includes("controls.classList.add('arena-setup-controls')"));
  assert.ok(!flow.includes("go.className='arena-setup-proceed'"),
    'the old redundant link is no longer added');
  assert.match(css,/#container \.arena-match-setup \.arena-setup-controls #btn-start/);
  assert.match(css,/grid-column:1\/-1;min-height:58px/);
  assert.ok(categories.includes('openArea.append(openButton)'));
});
test('narrow screens and 200 percent zoom fall back to a stacked preview above blocks',()=>{
  assert.ok(css.includes('@media(max-width:1100px), (max-height:640px)'));
  assert.ok(css.includes('display:flex!important;flex-direction:column'));
  assert.ok(css.includes('max-height:min(41dvh,355px)'));
  assert.ok(css.includes('flex:1 1 auto;min-height:0;overflow-y:auto'));
  assert.ok(css.includes('@media(max-width:700px)'));
  assert.ok(css.includes('height:100dvh!important'));
  assert.ok(css.includes('studio-motion-progress'));
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.match(html,/id="studio-motion-canvas"|js\/features\/studio-workspace\.js/);
});
test('scripts remain valid and user data/engine logic modules are unchanged',()=>{
  for(const src of [flow,categories,workspace])assert.doesNotThrow(()=>new vm.Script(src));
  assert.ok(html.indexOf('js/features/ui-flow.js')>html.indexOf('js/features/studio-workspace.js'));
  assert.ok(html.indexOf('css/ui-clarity.css')>html.indexOf('css/style.css'));
});
