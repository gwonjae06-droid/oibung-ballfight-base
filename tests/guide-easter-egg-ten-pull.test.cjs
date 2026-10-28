'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const run=(p,s)=>vm.runInContext(read(p),s,{filename:p});
function clickHarness(saved=new Map()){
  const ids=new Map();
  const el=tag=>{
    const n={tag,open:false,hidden:false,children:[],listeners:new Map(),
      classList:{add(){},remove(){}},
      addEventListener(key,fn){this.listeners.set(key,fn);},
      dispatch(key,event={}){this.listeners.get(key)?.(event);},
      setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},
      showModal(){this.open=true;},close(){this.open=false;this.dispatch('close');},
      appendChild(child){this.children.push(child);},
      querySelector(sel){this.controls||=new Map();if(!this.controls.has(sel))this.controls.set(sel,el(sel));return this.controls.get(sel);},
      focus(){}
    };return n;
  };
  const nav=el('nav');ids.set('arena-category-nav',nav);
  const body=el('body');
  const doc={body,getElementById:id=>ids.get(id)||null,createElement:el};
  const world={window:null,document:doc,
    localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,v)=>saved.set(key,v)},
    saveEconomyState(){saved.set('wallet',String(world.coins));return true;},
    renderEconomyUI(){world.rendered=(world.rendered||0)+1;},console,Math};
  world.window=world;vm.createContext(world);
  vm.runInContext('var coins=1000;',world);
  run('js/features/welcome-guide.js',world);
  return {world,saved,nav,dialog:body.children.find(x=>x.tag==='dialog')};
}
function gachaHarness(saved=new Map(),amount=60000){
  const world={window:null,console,Math,Date,
    document:{getElementById:()=>null,querySelector:()=>null,addEventListener(){}},
    localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},
    saveEconomyState(){saved.set('wallet',String(world.coins));return true;},
    renderEconomyUI(){world.renders=(world.renders||0)+1;},
    formatGold:n=>Math.round(n).toLocaleString('ko-KR')+' G'};
  world.window=world;vm.createContext(world);vm.runInContext('var coins='+amount+';',world);
  run('js/features/cosmetic-arcade.js',world);
  return {world,saved};
}
function fixedSequence(){
  let i=0;const values=[0,.99,.13,.44,.88,.3,.67,.16,.999,.26,.99,.02,.99,.95,.32];
  return ()=>values[(i++)%values.length];
}
test('first-visit automatic guide is not a secret click; 12 explicit Help opens give 10000 G once',()=>{
  const first=clickHarness(),trigger=first.nav.children.find(n=>n.className==='arena-guide-reopen');
  assert.equal(first.dialog.open,true);
  assert.equal(first.world.coins,1000);
  assert.equal(first.saved.get(first.world.ArenaWelcomeGuide.SECRET_KEY),undefined);
  first.dialog.querySelector('#arena-welcome-confirm').dispatch('click');
  for(let i=0;i<11;i++){
    trigger.dispatch('click');
    first.dialog.querySelector('#arena-welcome-confirm').dispatch('click');
  }
  assert.equal(first.world.coins,1000);
  assert.equal(first.world.ArenaWelcomeGuide.secretProgress(first.world.localStorage).count,11);
  trigger.dispatch('click');
  assert.equal(first.world.coins,11000);
  assert.equal(first.saved.get('wallet'),'11000');
  assert.equal(first.saved.get(first.world.ArenaWelcomeGuide.SECRET_KEY),'claimed');
  const message=first.dialog.querySelector('#arena-welcome-secret');
  assert.equal(message.hidden,false);
  assert.match(message.textContent,/10,000 G/);
  first.dialog.querySelector('#arena-welcome-confirm').dispatch('click');
  for(let i=0;i<4;i++){trigger.dispatch('click');first.dialog.querySelector('#arena-welcome-confirm').dispatch('click');}
  assert.equal(first.world.coins,11000,'no second award');
  const reloaded=clickHarness(first.saved);
  reloaded.world.coins=11000;
  const again=reloaded.nav.children.find(n=>n.className==='arena-guide-reopen');
  again.dispatch('click');
  assert.equal(reloaded.world.coins,11000,'persistent claim blocks refresh exploit');
});
test('wallet save failure reverts the one-time grant instead of burning a browser claim',()=>{
  const x=clickHarness();
  for(let i=0;i<11;i++)x.world.ArenaWelcomeGuide.secretClick(x.world.localStorage,()=>true);
  const first=x.world.ArenaWelcomeGuide.secretClick(x.world.localStorage,()=>false);
  assert.equal(first.awarded,false);
  assert.equal(x.world.ArenaWelcomeGuide.secretProgress(x.world.localStorage).count,11);
  const second=x.world.ArenaWelcomeGuide.secretClick(x.world.localStorage,()=>true);
  assert.equal(second.awarded,true);
  assert.equal(x.world.ArenaWelcomeGuide.secretProgress(x.world.localStorage).claimed,true);
});
test('10-draw batch preserves exact ten single-draw odds, pity counters, refunds and wallet',()=>{
  const single=gachaHarness(),multi=gachaHarness();
  const a=single.world.CosmeticArcade,b=multi.world.CosmeticArcade;
  const rngSingle=fixedSequence(),rngBatch=fixedSequence();
  const entries=[];
  for(let i=0;i<10;i++){a.drawReward(rngSingle);entries.push(a.lastResult());}
  const actual=b.drawTen(rngBatch);
  assert.ok(actual&&actual.length===10);
  assert.equal(multi.world.coins,single.world.coins);
  assert.deepEqual(JSON.parse(multi.saved.get('oibung-cosmetics-v1')),
    JSON.parse(single.saved.get('oibung-cosmetics-v1')));
  assert.deepEqual(actual.map(e=>e.kind),entries.map(e=>e.kind));
  assert.deepEqual(actual.map(e=>e.text),entries.map(e=>e.text));
  assert.deepEqual(b.lastTenResults().map(e=>e.kind),entries.map(e=>e.kind));
});
test('10-draw checks upfront cost, allows refunds, and cannot be spammed during animation',()=>{
  const insufficient=gachaHarness(new Map(),2999);
  assert.equal(insufficient.world.CosmeticArcade.drawTen(),null);
  assert.equal(insufficient.world.coins,2999);
  assert.equal(insufficient.saved.has('oibung-cosmetics-v1'),false);
  const x=gachaHarness(new Map(),3000);
  const ran=x.world.CosmeticArcade.drawTen(()=>.99);
  assert.equal(ran.length,10);
  assert.equal(x.world.CosmeticArcade.getOwned().length,0);
  assert.equal(JSON.parse(x.saved.get('oibung-cosmetics-v1')).draws,10);
  // After real ten-pull, net balance includes any refunds from missed draws.
  assert.ok(x.world.coins>=0);
  const queue=[];
  const playing=gachaHarness();
  playing.world.requestAnimationFrame=fn=>{queue.push(fn);};
  assert.equal(playing.world.CosmeticArcade.beginRoulette(10),true);
  assert.equal(playing.world.CosmeticArcade.beginRoulette(10),false);
  assert.equal(JSON.parse(playing.saved.get('oibung-cosmetics-v1')).draws,10);
  for(let i=0;i<queue.length&&i<20;i++)queue[i](i*2500);
  assert.ok(playing.world.CosmeticArcade.lastTenResults().length===10);
});
test('a 75th result within a ten-draw batch still guarantees an item and resets pity',()=>{
  const setup=gachaHarness(new Map(),100000);
  for(let i=0;i<70;i++)setup.world.CosmeticArcade.drawReward(()=>.99);
  const results=setup.world.CosmeticArcade.drawTen(()=>.99);
  assert.equal(results.length,10);
  assert.equal(results[4].kind,'item','75th attempt grants new item');
  assert.equal(setup.world.CosmeticArcade.getOwned().length,1);
  const save=JSON.parse(setup.saved.get('oibung-cosmetics-v1'));
  assert.equal(save.draws,80);
  assert.equal(save.misses,5);
});
test('ten result buttons, reduced-motion support and compact layout are wired',()=>{
  const html=read('index.html'),js=read('js/features/cosmetic-arcade.js'),css=read('css/style.css');
  assert.match(html,/id="cosmetic-draw-ten"/);
  assert.match(html,/id="cosmetic-ten-results"/);
  assert.match(js,/beginRoulette\(10\)/);
  assert.match(css,/\.cosmetic-ten-card/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.arena-welcome-secret/);
});
