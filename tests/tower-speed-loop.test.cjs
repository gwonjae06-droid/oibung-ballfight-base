'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/features/battle-effects.js'),'utf8');

function simulate({route='tower',tab='tower',active=true,towerSpeed=3,freeSpeed='2'}={}){
  const queue=[],speedSelect={value:freeSpeed};
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
    ArenaTower:{active,speed:towerSpeed},
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

test('Tower 3x accelerates actual 60Hz combat simulation',()=>{
  assert.equal(simulate({towerSpeed:1}),1);
  assert.equal(simulate({towerSpeed:2}),2);
  assert.equal(simulate({towerSpeed:3}),3);
});
test('free match never inherits tower 3x setting',()=>{
  assert.equal(simulate({tab:'free',active:false,towerSpeed:3,freeSpeed:'2'}),2);
  assert.equal(simulate({tab:'free',active:false,towerSpeed:3,freeSpeed:'1'}),1);
  assert.equal(simulate({route:'lobby',active:true,towerSpeed:3,freeSpeed:'2'}),2);
});
test('tower multiplier is limited to 3x even with bad runtime values',()=>{
  assert.equal(simulate({towerSpeed:99}),3);
});
