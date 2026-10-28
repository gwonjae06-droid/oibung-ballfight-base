'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('custom fighter deletion is in an always-visible manager above both tabs',()=>{
  const ui=read('js/features/studio-workspace.js');
  const category=read('js/features/ui-categories.js');
  const css=read('css/style.css');
  assert.ok(ui.includes("const owned=pick('#bf-custom-list')"));
  assert.ok(ui.includes("feedback=pick('#bf-result')"));
  assert.ok(ui.includes('manager.append(owned)'));
  assert.ok(ui.includes('manager.append(feedback)'));
  assert.ok(ui.includes('studio.replaceChildren(...[name,manager,tabs,skills,looks,create,saved]'),
    'roster must appear above tab panels, not inside a hidden tab');
  assert.ok(ui.includes('global.SkillForge.refreshList?.()'));
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
  const h={document:{createElement},ids:elements,
    CUSTOM_DEFS:[{id:'forge_1',name:'테스트 캐릭터',forgeData:{skills:[{}]}},
      {id:'classic',name:'기본 캐릭터'}]};
  vm.createContext(h);
  vm.runInContext("const $=id=>ids[id];"+snippet+"roster();",h);
  assert.equal(elements['forge-custom-count'].textContent,'1 / 6');
  const row=elements['bf-custom-list'].children[0];
  assert.equal(row.children[0].textContent,'테스트 캐릭터');
  assert.equal(row.children[1].textContent,'삭제');
  assert.equal(row.children[1].dataset.forgeId,'forge_1');
  assert.equal(row.children[1].attrs['aria-label'],'테스트 캐릭터 삭제');
  h.CUSTOM_DEFS.length=0;
  vm.runInContext('roster()',h);
  assert.equal(elements['forge-custom-count'].textContent,'0 / 6');
  assert.ok(elements['bf-custom-list'].children[0].textContent.includes('저장한 캐릭터가 없습니다'));
});

test('delete still uses confirmation and never deletes mid-battle',()=>{
  const forge=read('js/features/skill-forge.js');
  assert.ok(forge.includes('if(roundStarted&&!isGameOver){report('));
  assert.ok(forge.includes("if(!confirm(selected.name+' 캐릭터를 삭제하시겠습니까?'))return;"));
  assert.ok(forge.includes('if(remove(id)){reRollMatch();roster();report('));
  assert.ok(forge.includes('persist();refreshList();return true;'));
});
