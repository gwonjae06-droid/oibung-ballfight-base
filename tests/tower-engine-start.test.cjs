'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/core/engine.js'),'utf8');
function engine(){
  const elements={
    'wager-input':{value:'350'},
    'btn-start':{innerText:'경기 시작',dataset:{state:'ready'}},
    'btn-stop':{disabled:true},
  };
  const trace=[];
  const world={window:null,console,Math,Set,document:{getElementById(id){return elements[id]||null;}},
    players:[{id:'hero',playerNum:1},{id:'enemy',playerNum:2}],
    isPlaying:false,isGameOver:false,roundStarted:false,
    roundSettled:true,activeBet:{wager:350},selectedBetPlayerNum:1,
    reservedItems:{skillRush:[1],vitality:[1],speed:[2]},
    beginRoundEconomy(){trace.push('economy');return false;},
    renderEconomyUI(){trace.push('ui');},
    BackgroundMusic:{setBattle(){trace.push('music');}},
    CosmeticArcade:{startRound(){trace.push('cosmetics');}}
  };
  world.window=world;
  vm.createContext(world);
  vm.runInContext(source,world,{filename:'engine.js'});
  return {world,elements,trace};
}
test('tower round actually starts even when hidden betting flow would reject the start',()=>{
  const {world:w,elements:e,trace}=engine();
  assert.equal(w.togglePlay({towerBattle:true}),true);
  assert.equal(w.isPlaying,true);
  assert.equal(w.roundStarted,true);
  assert.equal(w.roundSettled,false);
  assert.equal(w.activeBet,null);
  assert.equal(w.selectedBetPlayerNum,null);
  assert.equal(e['wager-input'].value,'0');
  assert.equal(e['btn-start'].dataset.state,'playing');
  assert.equal(e['btn-stop'].disabled,false);
  assert.deepEqual(Array.from(w.reservedItems.skillRush),[]);
  assert.deepEqual(Array.from(w.reservedItems.vitality),[]);
  assert.deepEqual(Array.from(w.reservedItems.speed),[]);
  assert.ok(!trace.includes('economy'),'the tower has no hidden economy requirement');
  assert.ok(trace.includes('ui')&&trace.includes('cosmetics'));
  assert.equal(w.togglePlay(),false,'existing pause behavior remains functional');
  assert.equal(w.isPlaying,false);
});
test('regular free-battle starts still respect betting validation',()=>{
  const {world:w,trace}=engine();
  assert.equal(w.togglePlay(),false);
  assert.equal(w.isPlaying,false);
  assert.equal(w.roundStarted,false);
  assert.ok(trace.includes('economy'));
});
