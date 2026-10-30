'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/features/battle-effects.js'),'utf8');

function simulate({route='tower',tab='tower',speedValue='3'}={}){
  const queue=[],speedSelect={value:speedValue};
  let steps=0;
  const ctx={save(){},restore(){}};
  const menu={appendChild(){}};
  const game={console,Math,Set,WeakMap,window:null,ctx,
    players:[],isPlaying:true,isGameOver:false,screenShake:0,
    update(){steps++;},draw(){},drawCharacter(){},
    arenaEffectColor:v=>v,
    document:{
      getElementById:id=>id==='bf-speed'?speedSelect:null,
      createElement(){return {append(){},type:'',checked:false};},
      createTextNode:text=>({text}),
      querySelector:selector=>selector==='.bf-tools'?menu:null,
      addEventListener(){}
    },
    requestAnimationFrame(fn){queue.push(fn);},
    ArenaScreenRouter:{active:route,activeTowerTab:tab},
    matchMedia(){return {matches:false};}
  };
  game.window=game;
  vm.createContext(game);
  vm.runInContext(source,game,{filename:'battle-effects.js'});
  assert.equal(queue.length,1,'single rendering loop scheduled');
  queue.shift()(0);
  queue.shift()(1000/60+0.001);
  return steps;
}

test('the shared selector runs 1x, 2x, 3x, 10x and 100x fixed physics in Tower',()=>{
  for(const speed of [1,2,3,10,100])assert.equal(simulate({speedValue:String(speed)}),speed);
});
test('the same selector speeds up free battle, too',()=>{
  for(const speedValue of ['1','2','3','10','100']){
    const expected=Number(speedValue);
    assert.equal(simulate({route:'tower',tab:'free',speedValue}),expected);
    assert.equal(simulate({route:'lobby',speedValue}),expected);
  }
});
test('invalid speed values fall back safely to 1x',()=>{
  assert.equal(simulate({speedValue:'99'}),1);
  assert.equal(simulate({speedValue:'-5'}),1);
  assert.equal(simulate({speedValue:'not-a-number'}),1);
});
test('only one visible speed selector is declared in the shared battle canvas',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const tower=fs.readFileSync(path.join(__dirname,'../js/features/tower-challenge.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../css/tower-mine-ui.css'),'utf8');
  assert.equal((html.match(/id="bf-speed"/g)||[]).length,1);
  for(const value of ['1','2','3','10','100'])assert.ok(html.includes('<option value="'+value+'">'));
  assert.ok(!tower.includes('tower-speed'));
  assert.ok(!css.includes('tower-speed'));
});
