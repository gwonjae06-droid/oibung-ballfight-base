'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const block=read('js/features/block-forge.js'),style=read('css/premium-ui.css');
function editor(){
  const h={window:null,console,Math,CUSTOM_DEFS:[],CHARACTER_PHOTOS:{},BEHAVIORS:{},players:[]};
  h.window=h;vm.createContext(h);
  vm.runInContext(read('js/features/action-registry.js'),h);
  vm.runInContext(read('js/features/skill-forge.js'),h);
  const exposed=block.replace('global.BlockForge={modify,action,josa,phrase,refresh:',
    'global.BlockForge={modify,action,josa,phrase,inspector,actionRow,refresh:');
  assert.notEqual(exposed,block,'test adapter exposes the same production view helpers');
  vm.runInContext(exposed,h);
  return h;
}
const basic=()=>({name:'시각화 파이터',skills:[
  {name:'타격 콤보',trigger:'auto',cooldown:3,actions:[
    {type:'dash',speed:9,duration:.5},{type:'uppercut',damage:33,radius:100,link:'after'}
  ]}
]});
test('inspector edits only params supported by Action Registry, with no damage input for pure movement',()=>{
  const h=editor(),b=h.BlockForge;
  let p=h.SkillForge.normalize(basic());
  const move=b.inspector(p.skills[0],0);
  assert.match(move,/잔상|돌진|대시/);
  assert.match(move,/data-edit="type"/);
  assert.match(move,/data-key="speed"/);
  assert.doesNotMatch(move,/data-key="damage"/);
  assert.doesNotMatch(move,/data-key="knockback"/);
  p=b.modify(p,{kind:'param',skill:0,index:0,key:'speed',value:12});
  assert.equal(p.skills[0].actions[0].speed,12);
  assert.throws(()=>b.modify(p,{kind:'param',skill:0,index:0,key:'damage',value:50}),/지원하지 않는/);
  const attack=b.inspector(p.skills[0],0); // selectedAction starts at 0
  assert.ok(attack.includes('data-edit="type"'));
});
test('fist attacks expose damage, range and impact tuning with validated values',()=>{
  const h=editor(),b=h.BlockForge;
  let p=h.SkillForge.normalize({name:'검증',skills:[{name:'어퍼컷',actions:[{type:'uppercut',damage:34,radius:130}]}]});
  const html=b.inspector(p.skills[0],0);
  for(const key of ['damage','radius','knockback','target'])
    assert.ok(html.includes('data-key="'+key+'"'),key);
  assert.match(html,/미리보기|시연/);
  p=b.modify(p,{kind:'param',skill:0,index:0,key:'damage',value:81});
  assert.equal(p.skills[0].actions[0].damage,81);
  const row=b.actionRow(p.skills[0].actions[0],0,0,1);
  assert.match(row,/block-quick-inspect/);
  assert.match(row,/81 피해/);
  assert.match(row,/data-op="preview"/);
});
test('blocks keep in-sequence connectors and keyboard accessible select/preview',()=>{
  const h=editor(),b=h.BlockForge;
  let p=h.SkillForge.normalize(basic());
  let row=b.actionRow(p.skills[0].actions[1],0,1,2);
  assert.match(row,/data-edit="link"/);
  assert.match(row,/data-op="inspect"/);
  assert.match(row,/aria-pressed/);
  assert.match(row,/data-direction="-1"/);
  p=b.modify(p,{kind:'link',skill:0,index:1,value:'with'});
  assert.match(b.actionRow(p.skills[0].actions[1],0,1,2),/value="with" selected/);
});
test('premium UI supports hierarchy, skill visibility, mobile and reduced motion',()=>{
  const html=read('index.html'),router=read('js/features/screen-router.js');
  assert.ok(html.indexOf('css/premium-ui.css')>html.indexOf('css/app-shell.css'));
  assert.match(router,/lobby-tower-stats/);
  assert.match(router,/screen-deck/);
  for(const id of ['tower','character','ranking','mine','stock'])
    assert.ok(router.includes(id));
  for(const name of ['.lobby-hero','.lobby-card','.screen-heading','.tower-challenge',
    '.block-quick-action','.block-action-inspector','.block-inspector-grid',
    '.studio-motion-stage','.screen-tabs'])
    assert.ok(style.includes(name),name);
  assert.match(style,/@media\(max-width:730px\)/);
  assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(style,/focus-visible/);
  assert.match(read('js/features/tower-challenge.js'),/id="tower-floor"/);
  assert.match(read('js/features/tower-challenge.js'),/tower-opponent/);
  assert.doesNotMatch(read('js/features/tower-challenge.js'),/tower-floor-track/);
});
