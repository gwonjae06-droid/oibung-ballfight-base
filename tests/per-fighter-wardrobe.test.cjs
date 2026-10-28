'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const source=read('js/features/cosmetic-arcade.js');
class Node {
  constructor(tag='div'){
    this.tagName=tag.toUpperCase();this.children=[];this.handlers={};this.attrs={};
    this.dataset={};this.style={setProperty(){}};
    this.textContent='';this.value='';this.disabled=false;this.innerHTMLValue='';
  }
  set innerHTML(value){
    this.innerHTMLValue=value;
    if(this.id==='skin-editor'){
      this.parts={};
      for(const id of ['skin-fighter-select','skin-current-fighter','skin-slots','skin-editor-status'])
        this.parts[id]=new Node(id==='skin-fighter-select'?'select':'div');
    }
  }
  querySelector(selector){return this.parts?.[selector.slice(1)]||null;}
  addEventListener(name,callback){this.handlers[name]=callback;}
  setAttribute(name,value){this.attrs[name]=value;}
  insertBefore(node){this.children.unshift(node);}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  click(){this.handlers.click?.({target:this});}
  change(value){this.value=value;this.handlers.change?.({target:this});}
}
function harness(saved={}){
  const storage=new Map(Object.entries(saved));
  const studio=new Node();const elements=new Map([['studio-panel-appearance',studio]]);
  const document={getElementById:id=>elements.get(id)||null,
    querySelector:()=>null,createElement(tag){return new Node(tag);}};
  const defs=[
    {id:'forge_1',profile:{name:'첫 번째',artKey:'art-alpha'}},
    {id:'forge_2',profile:{name:'두 번째',artKey:'art-beta'}}
  ];
  const players=[
    {id:'forge_1',forge:{artKey:'art-alpha',effectColor:'#123456',skills:[]},hp:250},
    {id:'forge_2',forge:{artKey:'art-beta',effectColor:'#654321',skills:[]},hp:250}
  ];
  const sandbox={Math,Date,document,players,roundStarted:false,isGameOver:false,
    SkillForge:{list:()=>defs},formatGold:v=>v+' G',
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    renderEconomyUI(){},saveEconomyState(){}};
  sandbox.window=sandbox;sandbox.globalThis=sandbox;
  vm.createContext(sandbox);vm.runInContext('var coins=10000',sandbox);
  new vm.Script(source).runInContext(sandbox);
  return {sandbox,storage,studio,defs,players,editor:studio.children[0]};
}
const cosmetics={owned:['border-steel','border-neon','motion-rune','tint-rose'],
  equipped:{border:'border-neon'}}; // Legacy global value must be ignored.
test('new wardrobe appears only inside Appearance tab with an explicit saved-fighter selector',()=>{
  const {editor,studio,sandbox}=harness({'oibung-cosmetics-v1':JSON.stringify(cosmetics)});
  assert.equal(editor.id,'skin-editor');
  assert.equal(studio.children.length,1);
  assert.ok(editor.innerHTML.includes('캐릭터별 스킨 장착'));
  const picker=editor.querySelector('#skin-fighter-select');
  assert.deepEqual(picker.children.map(n=>n.textContent),['첫 번째','두 번째']);
  assert.equal(picker.value,'art-alpha');
  assert.equal(editor.querySelector('#skin-slots').children.length,5);
  const active=editor.querySelector('#skin-current-fighter').textContent;
  assert.ok(active.includes('첫 번째'));
  assert.equal(sandbox.CosmeticArcade.getLoadout('art-alpha').border,null,
    'a preexisting global equipped skin must not auto-apply');
});
test('appearance buttons attach and detach owned skins for the selected fighter only',()=>{
  const {sandbox,editor,players,storage}=harness({'oibung-cosmetics-v1':JSON.stringify(cosmetics)});
  const api=sandbox.CosmeticArcade;
  const firstSlot=()=>editor.querySelector('#skin-slots').children[0];
  const buttons=()=>firstSlot().children[1].children;
  // The first border choice is a detach button; second is the first owned skin.
  assert.equal(buttons()[0].disabled,true);
  buttons()[1].click();
  assert.equal(api.getLoadout('art-alpha').border,'border-steel');
  assert.equal(api.getLoadout('art-beta').border,null);
  assert.equal(api.borderColor(players[0]),'#b9ddfb');
  assert.equal(api.borderColor(players[1]),null);
  const picker=editor.querySelector('#skin-fighter-select');
  picker.change('art-beta');
  const betaMotion=editor.querySelector('#skin-slots').children[4].children[1].children[1];
  betaMotion.click();
  assert.equal(api.getLoadout('art-beta').motion,'motion-rune');
  assert.equal(api.getLoadout('art-alpha').motion,null);
  picker.change('art-alpha');
  buttons()[0].click(); // Explicit detach.
  assert.equal(api.getLoadout('art-alpha').border,null);
  assert.equal(api.getLoadout('art-beta').motion,'motion-rune');
  assert.equal(api.borderColor(players[0]),null);
  assert.equal(players[0].forge.effectColor,'#123456');
  const stored=JSON.parse(storage.get('oibung-cosmetics-v1'));
  assert.equal(stored.loadouts['art-beta'].motion,'motion-rune');
  assert.ok(!stored.loadouts['art-alpha']);
});
test('skin color is restored when detached; distinct characters and reload remain independent',()=>{
  const {sandbox,storage,players}=harness({'oibung-cosmetics-v1':JSON.stringify(cosmetics)});
  const api=sandbox.CosmeticArcade;
  assert.equal(api.equip('art-alpha','tint','tint-rose'),true);
  assert.equal(players[0].forge.effectColor,'#ef849c');
  assert.equal(players[1].forge.effectColor,'#654321');
  assert.equal(api.equip('art-alpha','tint',null),true);
  assert.equal(players[0].forge.effectColor,'#123456');
  assert.equal(api.equip('art-beta','motion','motion-rune'),true);
  // Simulate refresh: new runtime fighter IDs but identical profile keys.
  const reloaded=harness(Object.fromEntries(storage));
  assert.equal(reloaded.sandbox.CosmeticArcade.getLoadout('art-beta').motion,'motion-rune');
  assert.equal(reloaded.players[1].cosmetic.motion,'motion-rune');
  assert.equal(reloaded.players[0].cosmetic.motion,null);
  assert.equal(reloaded.sandbox.CosmeticArcade.forgetFighter('art-beta'),true);
  assert.equal(reloaded.sandbox.CosmeticArcade.getLoadout('art-beta').motion,null);
});
test('unowned and fake fighters cannot equip; active battle defers visual replacement',()=>{
  const {sandbox,players}=harness({'oibung-cosmetics-v1':JSON.stringify(cosmetics)});
  const api=sandbox.CosmeticArcade;
  assert.equal(api.equip('art-alpha','motion','motion-echo'),false);
  assert.equal(api.equip('art-fake','border','border-steel'),false);
  sandbox.roundStarted=true;sandbox.isGameOver=false;
  assert.equal(api.equip('art-alpha','border','border-steel'),true);
  assert.equal(players[0].cosmetic.border,null,'live round should not switch effects');
  api.applyToFighter(players[0]); // next match
  assert.equal(players[0].cosmetic.border,'border-steel');
});
test('removal hook cleans wardrobe, studio is explicit, and gacha no longer attaches all',()=>{
  const forge=read('js/features/skill-forge.js'),html=read('index.html');
  assert.ok(forge.includes('CosmeticArcade?.forgetFighter?.('));
  assert.ok(forge.includes('CosmeticArcade?.refreshStudio?.()'));
  assert.ok(html.includes('모든 캐릭터에 자동 적용되지 않습니다'));
  assert.ok(!source.includes("state.equipped.border||null"));
  assert.ok(!source.includes("장착 완료 · 다음 경기부터 적용"));
});
