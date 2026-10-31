'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
function boot(){
  const elements=new Map(),canvas={width:500,height:500,getContext:()=>({})};
  const document={getElementById(id){
    if(id==='arena')return canvas;
    if(!elements.has(id))elements.set(id,{
      style:{},dataset:{},innerText:'',textContent:'',disabled:false,
      classList:{add(){},remove(){}}
    });
    return elements.get(id);
  }};
  const context=vm.createContext({document,console,Math});
  for(const file of ['js/core/state.js','js/features/economy.js','js/core/engine.js'])
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  vm.runInContext('renderEconomyUI=function(){};draw=function(){};',context);
  return {document,run:expression=>vm.runInContext(expression,context)};
}
test('stop is disabled before the fight starts; stopping before a fight is a no-op',()=>{
  const h=boot();h.run('syncStopButton()');
  assert.equal(h.document.getElementById('btn-stop').disabled,true);
  assert.equal(h.run('stopMatch()'),false);
  assert.equal(h.run('roundStopped'),false);
  assert.equal(h.run('isGameOver'),false);
});
test('stopping during a match ends in a draw without any point settlement',()=>{
  const h=boot();
  h.run("roundStarted=true;isPlaying=true;coins=850;activeBet={wager:150,playerNum:1,characterName:'투사',multiplier:2};syncStopButton()");
  assert.equal(h.document.getElementById('btn-stop').disabled,false);
  assert.equal(h.run('stopMatch()'),true);
  assert.equal(h.run('isPlaying'),false);
  assert.equal(h.run('isGameOver'),true);
  assert.equal(h.run('roundStopped'),true);
  assert.equal(h.run('roundSettled'),true);
  assert.equal(h.run('coins'),850);
  assert.equal(h.document.getElementById('btn-stop').disabled,true);
  assert.equal(h.document.getElementById('btn-start').innerText,'다음 경기');
  assert.equal(h.document.getElementById('btn-start').dataset.state,'finished');
  assert.equal(h.document.getElementById('economy-message').textContent,'');
  assert.equal(h.run('stopMatch()'),false);
  assert.equal(h.run('coins'),850);
});
test('stopping a paused game works, without awarding a winner or coins',()=>{
  const h=boot();
  h.run('roundStarted=true;isPlaying=false;coins=1000;activeBet=null;syncStopButton()');
  assert.equal(h.run('stopMatch()'),true);
  assert.equal(h.run('coins'),1000);
  assert.equal(h.run('roundStopped'),true);
  assert.equal(h.document.getElementById('economy-message').textContent,'');
});
test('starting another match resets the stopped state and disables the stop control',()=>{
  const h=boot();h.run('roundStarted=true;isPlaying=true;stopMatch()');
  h.run("CHARACTER_DEFS.push({id:'a',name:'A',createInstance(n){return {id:'a',name:'A',playerNum:n,radius:34,hp:200,maxHp:200,getTag(){return null;}};}},{id:'b',name:'B',createInstance(n){return {id:'b',name:'B',playerNum:n,radius:34,hp:200,maxHp:200,getTag(){return null;}};}});updateUI=function(){};reRollMatch()");
  assert.equal(h.run('roundStopped'),false);
  assert.equal(h.run('isGameOver'),false);
  assert.equal(h.run('roundStarted'),false);
  assert.equal(h.document.getElementById('btn-stop').disabled,true);
});
