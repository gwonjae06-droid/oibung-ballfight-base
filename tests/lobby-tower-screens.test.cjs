'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function model(saved=new Map()){
  const context={window:null,console,Math,Date};
  context.window=context;
  vm.createContext(context);
  vm.runInContext(read('js/features/tower-challenge.js'),context);
  const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
  return {model:context.ArenaTowerModel,storage,saved};
}
test('ten playable floors have distinct skills, deterministic difficulty, and exactly two bosses',()=>{
  const {model:m}=model(),floors=Array.from({length:10},(_,i)=>m.floor(i+1));
  assert.equal(floors.length,10);
  assert.deepEqual(floors.filter(f=>f.boss).map(f=>f.number),[5,10]);
  assert.ok(floors.every((f,i)=>f.number===i+1&&f.hp>=180&&f.damage>=12));
  assert.ok(floors.every((f,i)=>i===0||f.hp>=floors[i-1].hp));
  assert.equal(new Set(floors.map(f=>f.main)).size,10,'floor skill types differ');
  const iron=m.makeEnemy(5),cosmos=m.makeEnemy(10);
  assert.ok(iron.skills.flatMap(s=>s.actions).some(a=>a.type==='uppercut'));
  assert.ok(iron.skills.flatMap(s=>s.actions).some(a=>a.type==='shield'));
  assert.ok(cosmos.skills.flatMap(s=>s.actions).some(a=>a.type==='blackhole'));
  assert.ok(cosmos.skills.flatMap(s=>s.actions).some(a=>a.type==='starfall'));
  assert.equal(m.makeEnemy(3).skills[0].actions[0].type,'dash');
  assert.equal(m.makeEnemy(4).skills[0].actions[0].status,'fire');
  assert.equal(m.makeEnemy(6).skills[0].actions[0].status,'poison');
});
test('local tower records are bounded, per-fighter, persistent and isolated from save profiles',()=>{
  const {model:m,storage,saved}=model(),a={id:'bae',name:'기본 파이터'},
    b={id:'forge_100',name:'내 파이터',forgeData:{artKey:'personal-112',skills:[{actions:[{type:'shot'}]}]}};
  m.updateRecord(storage,a,4,true);
  m.updateRecord(storage,a,3,false);
  m.updateRecord(storage,b,9,true);
  const r=m.read(storage);
  assert.equal(r.records.bae.best,4);
  assert.equal(r.records.bae.victories,1);
  assert.equal(r.records.bae.attempts,1);
  assert.equal(r.records['personal-112'].best,9);
  assert.equal(r.last.id,'personal-112');
  assert.ok(saved.has('oibung-tower-v1'));
  assert.equal(b.forgeData.skills[0].actions[0].type,'shot');
});
test('malformed records and excessive counters safely clamp to valid floor range',()=>{
  const {model:m,storage}=model();
  storage.setItem('oibung-tower-v1','not-json');
  assert.equal(Object.keys(m.read(storage).records).length,0);
  const r=m.updateRecord(storage,{id:'forge_1',name:'Fighter'},10000,true);
  assert.equal(r.best,10);
  assert.equal(m.floor(-40).number,1);
  assert.equal(m.floor(120).number,10);
});
test('router creates one lobby and exactly five separate destinations from existing nodes',()=>{
  const src=read('js/features/screen-router.js'),html=read('index.html');
  for(const name of ['lobby','tower','character','ranking','mine','stock'])
    assert.ok(src.includes("'"+name+"'"),name);
  assert.ok(src.includes("lobby.append(hero)"));
  assert.ok(src.includes('rankingPower.append(ranking)'));
  assert.ok(src.includes('shared.append(gallery)'));
  assert.ok(src.includes('designSlot.append(studio)'));
  assert.ok(src.includes('cosmeticSlot.append(cosmetic)'));
  assert.ok(src.includes('mineFrame.append(mine)'));
  assert.ok(src.includes('stockFrame.append(market)'));
  assert.ok(src.includes('arenaSlot.append(arena)'));
  assert.ok(src.includes('free.append(tools)'));
  assert.ok(src.includes("main.dataset.route=where"));
  assert.ok(src.includes("global.ArenaScreenRouter=api"));
  assert.ok(src.includes("global.ArenaTower?.records?.()"));
  assert.ok(html.indexOf('js/features/screen-router.js')>html.indexOf('js/features/ui-flow.js'));
  assert.ok(html.indexOf('js/features/tower-challenge.js')>html.indexOf('js/features/screen-router.js'));
  assert.ok(html.indexOf('css/app-shell.css')>html.indexOf('css/ui-clarity.css'));
});
test('tower uses original 2-person combat engine with transient real Forge enemies, not fake wins',()=>{
  const engine=read('js/core/engine.js'),src=read('js/features/tower-challenge.js');
  assert.ok(src.includes('global.SkillForge.register(makeEnemy(level))'));
  assert.ok(src.includes('CUSTOM_DEFS.splice(i,1)[0]'));
  assert.ok(src.includes('setMatchCount(2)'));
  assert.ok(src.includes('reRollMatch([selected,enemy])'));
  assert.ok(src.includes('if(!isPlaying)togglePlay()'));
  assert.ok(engine.includes('globalThis.ArenaTower?.isTransientDef?.(d)'));
  assert.ok(engine.includes('globalThis.ArenaTower?.onBattleEnd?.(finalAlive.length===1?finalAlive[0]:null)'));
  assert.ok(engine.includes("globalThis.ArenaTower?.onBattleEnd?.(null,'stopped')"));
  assert.ok(src.includes("winner.playerNum!==1"));
  assert.ok(src.includes('chooseReward'));
  assert.ok(src.includes('saveEconomyState()'));
  assert.ok(src.includes("return {active,stage,level,cleared"));
  assert.ok(src.includes("p.maxHp+=bonus.hp"));
  assert.ok(src.includes("bonus.speed"));
});
test('creator remains inline and stored UI singletons are neither cloned nor reinitialized',()=>{
  const router=read('js/features/screen-router.js');
  const ui=read('js/features/ui-categories.js');
  const css=read('css/app-shell.css');
  const effects=read('js/features/battle-effects.js');
  assert.ok(ui.includes("if(global.ArenaScreenRouter?.enabled){global.ArenaScreenRouter.go('character');return;}"));
  assert.ok(router.includes("dialog.setAttribute('open','')"));
  assert.ok(router.includes("global.dispatchEvent?.(new global.Event('studio:open'))"));
  assert.ok(css.includes('#screen-character #character-studio-dialog'));
  assert.ok(css.includes('position:relative!important;display:block!important'));
  assert.ok(css.includes('body.has-power-ranking{display:block!important'));
  assert.ok(effects.includes("ArenaScreenRouter.active==='tower'"));
  assert.ok(router.includes("if(typeof isPlaying!=='undefined'&&isPlaying"));
  assert.ok(router.includes('towerTab(subtab)'));
  for(const p of ['screen-router.js','tower-challenge.js','ui-categories.js']){
    assert.doesNotThrow(()=>new vm.Script(read('js/features/'+p)));
  }
});
