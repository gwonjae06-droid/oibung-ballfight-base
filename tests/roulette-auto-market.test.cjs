'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function setup(save={}){
  const storage=new Map(Object.entries(save)),timers=[];
  const doc={hidden:false,getElementById:()=>null,querySelector:()=>null,addEventListener(){}};
  const sandbox={
    console,Math,Date,document:doc,setInterval:(fn,ms)=>{timers.push({fn,ms});return timers.length;},
    requestAnimationFrame:null,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,val)=>storage.set(key,val)},
    saveEconomyState(){},
    formatGold:value=>Math.trunc(value)+' G',renderEconomyUI(){}
  };
  sandbox.window=sandbox;sandbox.globalThis=sandbox;vm.createContext(sandbox);
  vm.runInContext('var coins=100000;',sandbox);
  return {sandbox,storage,timers};
}
function run(file,ctx){new vm.Script(read(file),{filename:file}).runInContext(ctx);}
test('five requested names run on a single automatic 3-second ticker',()=>{
  const {sandbox,timers}=setup();
  run('js/features/point-market.js',sandbox);
  const actual=sandbox.PointMarket.assets;
  assert.deepEqual(Object.values(actual).sort(),[
    '이권재 컴퍼니','배달의 서준','아토믹 성원 박','오슬우 심리학','삼수를각오한최규원'
  ].sort());
  assert.equal(timers.length,1,'one interval for all assets');
  assert.equal(timers[0].ms,3000);
  const before=sandbox.PointMarket.getState();
  timers[0].fn();
  const after=sandbox.PointMarket.getState();
  assert.equal(after.history.campus.length,before.history.campus.length+1);
  assert.equal(after.history.repeat.length,before.history.repeat.length+1);
  sandbox.document.hidden=true;
  timers[0].fn();
  assert.equal(sandbox.PointMarket.getState().history.campus.length,after.history.campus.length);
});
test('each cosmetic can win by its own probability interval',()=>{
  const {sandbox}=setup();run('js/features/cosmetic-arcade.js',sandbox);
  for(const [i,expected] of [[0,'border-steel'],[1,'border-gold'],[14,'motion-burst']]){
    const roll=(i+.1)*.005;
    const item=sandbox.CosmeticArcade.drawReward(()=>roll);
    assert.equal(item.id,expected);
  }
  assert.equal(sandbox.CosmeticArcade.getOwned().length,3);
  assert.equal(sandbox.CosmeticArcade.drawReward(()=>.08),null);
  assert.equal(sandbox.CosmeticArcade.lastResult().kind,'coins');
});
test('75 unsuccessful draws guarantee a new unowned collectible and persist pity',()=>{
  const first=setup();run('js/features/cosmetic-arcade.js',first.sandbox);
  for(let i=0;i<74;i++){
    assert.equal(first.sandbox.CosmeticArcade.drawReward(()=>.99),null,'no premature jackpot');
  }
  assert.equal(first.sandbox.CosmeticArcade.getOwned().length,0);
  const after74=JSON.parse(first.storage.get('oibung-cosmetics-v1'));
  assert.equal(after74.misses,74);
  assert.equal(after74.draws,74);
  const reloaded=setup(Object.fromEntries(first.storage));
  run('js/features/cosmetic-arcade.js',reloaded.sandbox);
  const item=reloaded.sandbox.CosmeticArcade.drawReward(()=>.99);
  assert.ok(item&&item.id);
  assert.equal(reloaded.sandbox.CosmeticArcade.lastResult().kind,'item');
  const saved=JSON.parse(reloaded.storage.get('oibung-cosmetics-v1'));
  assert.equal(saved.misses,0);
  assert.equal(saved.draws,75);
});
test('miss can yield wisdom or small G without secretly awarding an item',()=>{
  const {sandbox}=setup();run('js/features/cosmetic-arcade.js',sandbox);
  const sequence=[.9,.9,.3];
  sandbox.CosmeticArcade.drawReward(()=>sequence.shift());
  assert.equal(sandbox.CosmeticArcade.lastResult().kind,'wisdom');
  assert.equal(sandbox.CosmeticArcade.getOwned().length,0);
  const before=sandbox.coins;
  const amounts=[.9,.2,.3];sandbox.CosmeticArcade.drawReward(()=>amounts.shift());
  assert.equal(sandbox.CosmeticArcade.lastResult().kind,'coins');
  assert.equal(sandbox.coins,before-300+30);
});
test('roulette commits before animation and keeps odds out of displayed UI',()=>{
  const {sandbox,storage}=setup();
  run('js/features/cosmetic-arcade.js',sandbox);
  assert.equal(sandbox.CosmeticArcade.beginRoulette(),true);
  assert.ok(storage.has('oibung-cosmetics-v1'));
  assert.equal(JSON.parse(storage.get('oibung-cosmetics-v1')).draws,1);
  const html=read('index.html');
  assert.ok(html.includes('cosmetic-roulette'));
  assert.ok(!html.includes('0.5%')&&!html.includes('7.5%'));
  const css=read('css/style.css'),effects=read('js/features/cosmetic-arcade.js');
  assert.ok(css.includes('roulette-spinning')&&css.includes('prefers-reduced-motion:reduce'));
  for(const signature of ['function drawBorder','trail-lightning','motion-rune','tint-rose',
    'entrance-gate','requestAnimationFrame','Math.PI','quintic']){
    assert.ok(effects.includes(signature),'required visual layer: '+signature);
  }
});

test('all five equipped visual categories render on the original first lineup',()=>{
  const owned=[
    'border-neon','tint-rose','trail-ribbon','entrance-gate','motion-rune'
  ],equipped={border:'border-neon',tint:'tint-rose',trail:'trail-ribbon',
    entrance:'entrance-gate',motion:'motion-rune'};
  const state={owned,equipped};
  const {sandbox}=setup({'oibung-cosmetics-v1':JSON.stringify(state)});
  const fighter={forge:{effectColor:'#112233',skills:[]},x:100,y:120,hp:300,
    radius:32,forgeShots:[{x:135,y:150}],forgeExtras:[]};
  sandbox.players=[fighter];run('js/features/cosmetic-arcade.js',sandbox);
  assert.ok(fighter.cosmetic,'pre-existing initial round should receive saved cosmetics');
  assert.equal(fighter.forge.effectColor,'#ef849c');
  assert.equal(fighter.cosmetic.border,'border-neon');
  const arcade=sandbox.CosmeticArcade;
  arcade.startRound([fighter]);
  for(let i=0;i<8;i++)arcade.tick([fighter]);
  arcade.onCast(fighter,{type:'wave'},{x:170,y:150});
  let calls=0;
  const gradient={addColorStop(){}};
  const ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{
    get(obj,key){return key in obj?obj[key]:(...args)=>{calls++;};},
    set(obj,key,value){obj[key]=value;return true;}
  });
  assert.equal(arcade.drawBorder(ctx,fighter,32),true);
  arcade.drawUnder(ctx,[fighter]);
  arcade.drawOver(ctx,[fighter]);
  assert.ok(calls>100,'cinematic renderers should produce layered canvas geometry');
});
