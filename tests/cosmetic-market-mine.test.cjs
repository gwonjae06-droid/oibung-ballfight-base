'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const code=p=>new vm.Script(read(p),{filename:p});
function sandbox(initial={}){
  const saved=new Map(Object.entries(initial));
  const doc={getElementById(){return null;}};
  const s={console,Math,Date,document:doc,
    localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},
    saveEconomyState(){this.savedGold=true;},formatGold:n=>Math.round(n)+' G',renderEconomyUI(){}};
  s.window=s;s.globalThis=s;vm.createContext(s);
  vm.runInContext('var coins=1000;',s);
  return {s,saved};
}
test('market persists a 5x leveraged position and allows a negative G settlement',()=>{
  const {s,saved}=sandbox();
  code('js/features/point-market.js').runInContext(s);
  assert.equal(s.PointMarket.openPosition('campus',1000,5),true);
  assert.equal(s.coins,0);
  s.PointMarket.tickMarket(()=>0); // deterministic 19% crashes
  s.PointMarket.tickMarket(()=>0);
  const result=s.PointMarket.closePosition();
  assert.ok(result.profit< -1000,'multiple leveraged drops should exceed collateral');
  assert.ok(s.coins<0,'debt must be real negative balance, not clamped to zero');
  const old=s.coins;
  assert.equal(s.PointMarket.mine(1000),true);
  assert.equal(s.PointMarket.mine(1040),false,'protect against accidental double tap');
  assert.equal(s.PointMarket.mine(1100),true);
  assert.equal(s.coins,old+4,'taps repay debt even with a negative wallet');
  assert.ok(saved.get('oibung-market-v1'),'market state must persist');
  assert.ok(s.savedGold,'wallet save hook must fire');
});
test('open investments remain persisted and block a second open',()=>{
  const first=sandbox();
  code('js/features/point-market.js').runInContext(first.s);
  assert.equal(first.s.PointMarket.openPosition('arcana',250,5),true);
  assert.equal(first.s.PointMarket.openPosition('campus',100,1),false);
  const state=JSON.parse(first.saved.get('oibung-market-v1'));
  assert.equal(state.position.asset,'arcana');
  const reloaded=sandbox(Object.fromEntries(first.saved));
  code('js/features/point-market.js').runInContext(reloaded.s);
  assert.equal(reloaded.s.PointMarket.getState().position.margin,250);
});
test('gacha collects cosmetics but only explicit per-character equip activates them',()=>{
  const {s,saved}=sandbox();
  s.SkillForge={list:()=>[{id:'forge_1',profile:{name:'단독 파이터',artKey:'art-unit1'}}]};
  code('js/features/cosmetic-arcade.js').runInContext(s);
  const first=s.CosmeticArcade.drawReward(()=>0);
  assert.equal(first.id,'border-steel');
  assert.equal(s.coins,700);
  assert.deepEqual(Array.from(s.CosmeticArcade.getOwned()),['border-steel']);
  assert.equal(s.CosmeticArcade.getLoadout('art-unit1').border,null,'drawing never auto-equips');
  s.CosmeticArcade.drawReward(()=>0);
  assert.equal(s.coins,500,'duplicate refunds exactly 100 G');
  assert.equal(s.CosmeticArcade.equip('art-unit1','border','border-gold'),false,'cannot equip locked item');
  const player={forge:{artKey:'art-unit1',effectColor:'#112233',skills:[]}};
  s.CosmeticArcade.applyToFighter(player);
  assert.equal(s.CosmeticArcade.borderColor(player),null);
  assert.equal(s.CosmeticArcade.equip('art-unit1','border','border-steel'),true);
  s.CosmeticArcade.applyToFighter(player);
  assert.equal(s.CosmeticArcade.borderColor(player),'#b9ddfb');
  assert.equal(player.forge.effectColor,'#112233','visual border does not modify combat');
  assert.ok(saved.get('oibung-cosmetics-v1'));
});
test('economy restores signed balance and inventory, and the UI navigation is wired',()=>{
  const codeText=read('js/core/state.js'),html=read('index.html');
  const setup=vm.createContext({document:{getElementById:()=>({getContext:()=>({})})},
    localStorage:{getItem:k=>k==='oibung-economy-v1'?JSON.stringify({coins:-250,items:{vitality:3}}):null}});
  new vm.Script(codeText).runInContext(setup);
  assert.equal(vm.runInContext('coins',setup),-250);
  assert.equal(vm.runInContext('itemInventory.vitality',setup),3);
  assert.ok(html.includes('src="js/features/cosmetic-arcade.js"'));
  assert.ok(!html.includes('src="js/features/point-market.js"'));
  assert.ok(html.includes('data-category="cosmetics"'));
  assert.ok(html.includes('data-category="finance" hidden'));
  assert.ok(read('js/features/ui-categories.js').includes("'cosmetics','finance'"));
  assert.ok(read('js/core/render.js').includes('CosmeticArcade?.drawUnder'));
  assert.ok(read('js/core/render.js').includes('CosmeticArcade?.borderColor'));
  assert.ok(read('js/features/skill-visuals.js').includes('CosmeticArcade?.onCast'));
});
