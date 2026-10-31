'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('custom fighter deletion remains in an always-visible manager after the Save action',()=>{
  const ui=read('js/features/studio-workspace.js');
  const category=read('js/features/ui-categories.js');
  const css=read('css/style.css');
  assert.ok(ui.includes("const owned=pick('#bf-custom-list')"));
  assert.ok(ui.includes("feedback=pick('#bf-result')"));
  assert.ok(ui.includes('manager.append(owned)'));
  assert.ok(ui.includes('manager.append(feedback)'));
  assert.ok(ui.includes('studio.replaceChildren(...[name,tabs,skills,looks,create,manager,saved]'),
    'roster must stay outside both hidden tab panels and after the main Save action');
  assert.ok(ui.includes('global.SkillForge.refreshList?.()'));
  assert.ok(ui.includes('id="forge-roster-filter"'));
  assert.ok(ui.includes('캐릭터 이름 검색'));
  assert.ok(css.includes('.forge-saved-actions .forge-saved-edit'));
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(css,/\.forge-saved-actions\{[\s\S]*?grid-template-columns:minmax\(0,1\.7fr\) minmax\(0,1fr\)/);
  assert.ok(category.includes("summary.textContent='JSON 가져오기 · 내보내기'"));
  assert.ok(css.includes('.studio-roster-manager #bf-custom-list'));
  assert.ok(css.includes('@media(max-width:420px)'));
});

test('roster renders name, accessible deletion control, saved count and empty state',()=>{
  const source=read('js/features/skill-forge.js');
  const begin=source.indexOf('  function roster(){');
  const end=source.indexOf('  refreshList=roster;',begin);
  assert.ok(begin>=0&&end>begin,'roster function must remain available');
  const snippet=source.slice(begin,end);
  const elements={};
  function createElement(tag){
    return {tagName:tag.toUpperCase(),children:[],dataset:{},textContent:'',
      attrs:{},setAttribute(k,v){this.attrs[k]=v;},
      append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);return node;},
      replaceChildren(...nodes){this.children=[...nodes];}};
  }
  elements['bf-custom-list']=createElement('div');
  elements['forge-custom-count']=createElement('span');
  const h={document:{createElement},ids:elements,global:{},
    CUSTOM_DEFS:[{id:'forge_1',name:'테스트 캐릭터',forgeData:{skills:[{}]}},
      {id:'classic',name:'기본 캐릭터'}]};
  vm.createContext(h);
  vm.runInContext("const $=id=>ids[id];"+snippet+"roster();",h);
  assert.equal(elements['forge-custom-count'].textContent,'1명 저장됨');
  const row=elements['bf-custom-list'].children[0];
  assert.equal(row.children[0].textContent,'테스트 캐릭터');
  const actions=row.children[1];
  assert.equal(actions.className,'forge-saved-actions');
  const edit=actions.children.find(c=>c.dataset?.editForgeId==='forge_1');
  const remove=actions.children.find(c=>c.dataset?.forgeId==='forge_1');
  assert.equal(edit?.textContent,'✎ 스킬 수정');
  assert.equal(edit?.attrs['aria-label'],'테스트 캐릭터 스킬 수정');
  assert.equal(remove?.textContent,'삭제');
  assert.equal(remove?.attrs['aria-label'],'테스트 캐릭터 삭제');
  h.CUSTOM_DEFS.length=0;
  vm.runInContext('roster()',h);
  assert.equal(elements['forge-custom-count'].textContent,'0명 저장됨');
  assert.ok(elements['bf-custom-list'].children[0].textContent.includes('저장한 캐릭터가 없습니다'));
});

test('delete still uses confirmation and never deletes mid-battle',()=>{
  const forge=read('js/features/skill-forge.js');
  assert.ok(forge.includes('if(roundStarted&&!isGameOver){report('));
  assert.ok(forge.includes("if(!confirm(selected.name+' 캐릭터를 삭제하시겠습니까?'))return;"));
  assert.ok(forge.includes('if(remove(id)){if(editingId===id)cancelEdit();reRollMatch();roster();report('));
  assert.ok(forge.includes('persist();refreshList();return true;'));
});

test('unlimited fighter roster is searchable and the edit button opens the composer',()=>{
  const forge=read('js/features/skill-forge.js'),ui=read('js/features/studio-workspace.js');
  assert.ok(!forge.includes("CUSTOM_DEFS.length>=6"));
  assert.ok(!forge.includes("v.slice(0,6)"));
  assert.ok(forge.includes("global.CharacterStudioModes?.select?.('compose')"));
  assert.ok(forge.includes("$('forge-roster-filter')?.addEventListener('input',roster)"));
  assert.ok(ui.includes('forge-roster-filter-status'));
  const begin=forge.indexOf('  function roster(){'),end=forge.indexOf('  refreshList=roster;',begin);
  assert.ok(begin>0&&end>begin);
  const elements={},target={children:[],replaceChildren(){this.children=[];},appendChild(x){this.children.push(x);}};
  elements['bf-custom-list']=target;
  elements['forge-custom-count']={textContent:''};
  elements['forge-roster-filter']={value:''};
  elements['forge-roster-filter-status']={textContent:''};
  const createElement=tag=>({tagName:tag.toUpperCase(),children:[],dataset:{},textContent:'',attrs:{},
    setAttribute(k,v){this.attrs[k]=v;},append(...nodes){this.children.push(...nodes);},
    appendChild(x){this.children.push(x);return x;}});
  const h={document:{createElement},ids:elements,global:{},CUSTOM_DEFS:Array.from({length:26},(_,i)=>({
    id:'forge_'+i,name:i===13?'마법사 전용':'커스텀 '+i,forgeData:{skills:[{}]}}))};
  vm.createContext(h);vm.runInContext("const $=id=>ids[id];"+forge.slice(begin,end)+"roster();",h);
  assert.equal(elements['forge-custom-count'].textContent,'26명 저장됨');
  assert.equal(target.children.length,26);
  elements['forge-roster-filter'].value='마법사';
  vm.runInContext('roster()',h);
  assert.equal(target.children.length,1);
  assert.equal(target.children[0].children[0].textContent,'마법사 전용');
  assert.equal(elements['forge-roster-filter-status'].textContent,'1명 검색됨');
});
