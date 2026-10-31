'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../js/features/tower-challenge.js'),'utf8');
function conclude(x,winner){
  // Production engine sets these flags *before* notifying ArenaTower.
  x.world.isGameOver=true;x.world.isPlaying=false;
  return x.tower.onBattleEnd(winner);
}
function harness(themed=false){
  const nodes=new Map();
  class Element{
    constructor(name='div'){this.tagName=name;this.listeners={};this.children=[];this.hidden=false;this.value='';this.dataset={};this.style={setProperty(){}};}
    set id(value){this._id=value;nodes.set(value,this);}
    get id(){return this._id;}
    set innerHTML(value){
      this._html=value;
      for(const m of value.matchAll(/id="([^"]+)"/g))new Element('node').id=m[1];
    }
    get innerHTML(){return this._html||'';}
    append(...children){this.children.push(...children);}
    prepend(...children){this.children.unshift(...children);}
    querySelectorAll(){return [];}
    replaceChildren(...children){this.children=children;
      if(children[0]?.value)this.value=children[0].value;}
    addEventListener(name,callback){this.listeners[name]=callback;}
    querySelector(query){
      if(query.startsWith('[data-tower-reward='))return new Element('button');
      return nodes.get(query.slice(1))||null;
    }
    setAttribute(){}
  }
  const screen=new Element();screen.id='screen-tower';
  const slot=new Element();slot.id='tower-mode-slot';
  const canvasWrap=new Element('div');
  const doc={getElementById:id=>nodes.get(id)||null,createElement:type=>new Element(type),
    querySelector:sel=>sel==='#tower-arena-slot .canvas-wrapper'?canvasWrap:null};
  const saved=new Map();
  const world={
    window:null,document:doc,console,Math,Date,
    localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},
    CHARACTER_DEFS:[{id:'hero',name:'Hero',createInstance(playerNum){
      return {id:'hero',name:'Hero',playerNum,hp:220,maxHp:220,vx:1,vy:1};
    }}],CUSTOM_DEFS:[],BEHAVIORS:{},
    SkillForge:{register(profile){
      const id='forge_'+(++world.seq);
      const def={id,name:profile.name,createInstance(playerNum){
        return {id,name:profile.name,playerNum,hp:profile.hp,maxHp:profile.hp,vx:1,vy:1,forge:profile};
      }};
      world.CUSTOM_DEFS.push(def);world.BEHAVIORS[id]={update(){},onContact(){}};
      return id;
    }},
    canvas:{width:500,height:500},
    seq:0,coins:1000,players:[],isPlaying:false,isGameOver:false,roundStarted:false,
    roundSettled:false,
    setMatchCount(n){world.matchCount=n;return true;},
    reRollMatch(defs){
      assert.ok(defs.length===2&&defs[1]===world._lastTemporary);
      world.players=defs.map((d,i)=>d.createInstance(i+1));
      world.isPlaying=false;world.isGameOver=false;world.roundStarted=false;
      return true;
    },
    togglePlay(){world.roundStarted=true;world.isPlaying=!world.isPlaying;},
    saveEconomyState(){saved.set('wallet',String(world.coins));return true;},
    renderEconomyUI(){},
    ArenaScreenRouter:{refresh(){},showArena(){}}
  };
  world.window=world;vm.createContext(world);
  // A real mock two-fighter engine accepts only transient defs that came out
  // of SkillForge rather than fabricating a battle result in the Tower.
  world.reRollMatch=defs=>{
    assert.ok(defs.length===2&&defs[0]===world.CHARACTER_DEFS[0]);
    assert.ok(!world.CUSTOM_DEFS.includes(defs[1]));
    world.players=defs.map((d,i)=>d.createInstance(i+1));
    world.roundStarted=false;world.isGameOver=false;world.isPlaying=false;
    return true;
  };
  if(themed){
    for(const name of ['tower-realms','tower-encounters'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/features/'+name+'.js'),'utf8'),world);
    world.SkillForge.enableManual=p=>{p.forge||={skills:[{name:'공격',cooldown:2,actions:[{damage:20,radius:100}]}]};p.manualTower=true;return true;};
    world.SkillForge.hit=(a,p,action)=>{p.hp-=action.damage;return true;};
  }
  vm.runInContext(src,world,{filename:'tower-challenge.js'});
  const tower=world.ArenaTower,el=id=>nodes.get(id);
  return {world,tower,el,saved,canvasWrap};
}
test('a floor clear displays victory and prepares the next floor without starting combat',()=>{
  const x=harness();
  assert.equal(x.tower.begin(),true);
  assert.equal(x.tower.stage,'fighting');
  assert.equal(x.world.players[0].playerNum,1);
  assert.equal(x.world.players[1].playerNum,2);
  assert.equal(x.world.CUSTOM_DEFS.length,0);
  assert.equal(x.tower.isTransientDef(x.tower.isTransientDef?null:null),false);
  conclude(x,x.world.players[0]);
  assert.equal(x.tower.state.cleared,1);
  assert.equal(x.tower.state.level,2,'victory prepares floor two');
  assert.equal(x.world.coins,1000,'there is no floor-clear gold');
  assert.equal(x.el('tower-rewards'),undefined,'reward UI is not mounted');
  assert.equal(x.tower.stage,'between','the next floor is not yet fighting');
  assert.equal(x.world.isPlaying,false);
  assert.equal(x.world.roundStarted,false);
  assert.equal(x.world.isGameOver,false);
  assert.equal(x.world.players[1].name,x.tower.makeEnemy(2).name,'new opponent is prepared');
  assert.equal(x.el('tower-clear-overlay').hidden,false);
  assert.equal(x.el('tower-clear-title').textContent,'1층 클리어!');
  assert.match(x.el('tower-clear-next').textContent,/2층/);
  assert.equal(x.el('tower-start').hidden,true,'the floor clear overlay owns the next-floor action');
  assert.match(x.el('tower-next-start').textContent,/2층 시작/);
  assert.equal(x.el('tower-pause').hidden,true);
  assert.equal(x.world.CUSTOM_DEFS.length,0);
  const sequence=x.world.seq;
  assert.equal(x.tower.onBattleEnd(x.world.players[0]),false,'old victory cannot auto-skip another floor');
  assert.equal(x.world.seq,sequence,'no enemy is spawned until an actual clear');
  x.el('tower-next-start').listeners.click();
  assert.equal(x.tower.stage,'fighting');
  assert.equal(x.world.isPlaying,true);
  assert.equal(x.world.roundStarted,true);
  assert.equal(x.el('tower-clear-overlay').hidden,true);
  assert.equal(x.world.seq,sequence,'start does not reroll prepared enemy');
  conclude(x,x.world.players[1]);
  assert.equal(x.tower.stage,'lost');
  assert.equal(x.tower.records()[0].best,1);
  assert.equal(x.tower.records()[0].attempts,1);
  assert.equal(x.tower.begin(),true,'player can retry after defeat');
});
test('ten floors require explicit starts, have no rewards and record completion',()=>{
  const x=harness(),base=x.world.CHARACTER_DEFS[0];
  assert.equal(x.tower.begin(),true);
  for(let floor=1;floor<=10;floor++){
    assert.equal(x.tower.state.level,floor);
    assert.equal(x.world.CUSTOM_DEFS.length,0,'bosses are transient');
    conclude(x,x.world.players[0]);
    if(floor<10){
      assert.equal(x.tower.stage,'between');
      assert.equal(x.tower.state.level,floor+1);
      assert.equal(x.world.isPlaying,false);
      assert.equal(x.world.roundStarted,false);
      assert.equal(x.world.players[0].maxHp,220,'no between-floor HP reward');
      if([3,6,8].includes(floor)){
        assert.equal(x.tower.begin(),false,'branch choice must be made first');
        assert.equal(x.tower.chooseRoute('rush'),true);
        assert.equal(x.tower.chooseRoute('rush'),false,'route can only be chosen once');
      }
      assert.equal(x.tower.begin(),true,'pressing Start begins next floor');
      assert.equal(x.tower.stage,'fighting');
      assert.equal(x.world.isPlaying,true);
    }
  }
  assert.equal(x.tower.stage,'won');
  assert.equal(x.tower.active,false);
  assert.equal(x.tower.records()[0].best,10);
  assert.equal(base.createInstance(1).maxHp,220,'the original definition is unchanged');
  assert.equal(x.world.coins,1000,'the entire tower has no per-floor gold payouts');
  assert.equal(x.tower.begin(),true);
  assert.equal(x.world.players[0].maxHp,220,'new runs start without old buffs');
});
test('forfeit ends run without giving floor-clear reward',()=>{
  const x=harness();
  x.tower.begin();
  x.world.stopMatch=()=>{x.world.isPlaying=false;x.world.isGameOver=true;
    x.tower.onBattleEnd(null,'stopped');return true;};
  assert.equal(x.tower.forfeit(),true);
  assert.equal(x.tower.active,false);
  assert.equal(x.tower.records()[0].best,0);
  assert.equal(x.el('tower-abandon').hidden,true);
});

test('rejected engine start leaves Tower retryable and explains the waiting screen',()=>{
  const x=harness();
  x.world.togglePlay=()=>false;
  assert.equal(x.tower.begin(),false);
  assert.equal(x.tower.active,false);
  assert.equal(x.tower.stage,'ready');
  assert.equal(x.el('tower-start').hidden,false);
  assert.match(x.el('tower-feedback').textContent,/전투 엔진이 시작되지 않았습니다/);
  assert.equal(x.world.isPlaying,false);
  assert.equal(x.tower.begin(),false,'retry must remain available');
});

test('Tower uses the shared speed selector and waits between floors',()=>{
  const x=harness();
  assert.equal(x.el('tower-speed'),undefined,'no duplicate Tower-only speed button');
  assert.equal(typeof x.tower.setSpeed,'undefined');
  assert.equal(x.tower.begin(),true);
  conclude(x,x.world.players[0]);
  assert.equal(x.tower.state.level,2);
  assert.equal(x.tower.stage,'between');
  assert.equal(x.el('tower-speed'),undefined);
  assert.equal(x.el('tower-clear-overlay').hidden,false);
  assert.equal(x.tower.begin(),true);
  assert.equal(x.tower.stage,'fighting');
});

test('automatic Tower preserves authored skills and rejects retired controls',()=>{
 const h=harness(true);
 assert.equal(h.tower.mode,'auto');
 assert.equal(h.tower.setMode('manual'),false);
 assert.equal(h.tower.setMode('blitz'),false);
 assert.equal(h.tower.selectRealm('fire'),true);
 assert.equal(h.tower.begin(),true);
 assert.equal(h.world.players[0].manualTower,false,'AI owns actions');
 assert.ok(h.world.players[0].forge?.skills?.length,'builtin gains authored kit');
 conclude(h,h.world.players[0]);
 assert.equal(h.tower.state.level,2);
 assert.equal(h.tower.stage,'between');
 assert.equal(h.tower.begin(),true);
 assert.equal(h.tower.stage,'fighting');
 assert.equal(h.world.players[0].manualTower,false);
});
test('automatic Tower starts without either retired input module',()=>{
 const h=harness();
 assert.equal(h.world.ArenaTowerControls,undefined);
 assert.equal(h.world.ArenaBlitzTower,undefined);
 assert.equal(h.tower.begin(),true);
 assert.equal(h.tower.stage,'fighting');
 assert.equal(h.tower.active,true);
});
test('top-level Start button resumes prepared floor without running another round setup',()=>{
  const x=harness();
  x.tower.begin();
  conclude(x,x.world.players[0]);
  assert.equal(x.tower.stage,'between');
  assert.equal(x.tower.setMode('manual'),false,'mode stays locked during intermission');
  assert.equal(x.el('tower-hero').disabled,true,'roster stays locked during intermission');
  const seq=x.world.seq;
  x.el('tower-start').listeners.click();
  assert.equal(x.tower.stage,'fighting');
  assert.equal(x.world.seq,seq,'waiting floor is not recreated');
  assert.equal(x.tower.state.level,2);
});
test('failed intermission Start keeps the round paused and retryable',()=>{
  const x=harness();x.tower.begin();
  conclude(x,x.world.players[0]);
  const existingSeq=x.world.seq;
  x.world.togglePlay=()=>{x.world.roundStarted=true;return false;};
  assert.equal(x.tower.begin(),false);
  assert.equal(x.tower.stage,'between');
  assert.equal(x.world.isPlaying,false);
  assert.equal(x.world.seq,existingSeq);
  assert.equal(x.el('tower-clear-overlay').hidden,false);
  assert.match(x.el('tower-feedback').textContent,/시작 실패/);
  x.world.togglePlay=()=>{x.world.roundStarted=true;x.world.isPlaying=true;return true;};
  assert.equal(x.tower.begin(),true,'can retry without recreating battle');
  assert.equal(x.tower.stage,'fighting');
});
test('forfeit while waiting closes the run and records cleared floors',()=>{
  const x=harness();x.tower.begin();conclude(x,x.world.players[0]);
  assert.equal(x.tower.stage,'between');
  assert.equal(x.tower.forfeit(),true);
  assert.equal(x.tower.active,false);
  assert.equal(x.tower.stage,'lost');
  assert.equal(x.tower.records()[0].best,1);
  assert.equal(x.el('tower-clear-overlay').hidden,true);
});

test('automatic Tower keeps normal HUD across floor transitions',()=>{
 const h=harness(),screen=h.el('screen-tower');
 assert.equal(screen.dataset.manualFocus,'false');
 assert.equal(h.tower.begin(),true);
 assert.equal(screen.dataset.manualFocus,'false');
 conclude(h,h.world.players[0]);
 assert.equal(h.tower.stage,'between');
 assert.equal(screen.dataset.manualFocus,'false');
 assert.equal(h.el('tower-clear-overlay').hidden,false);
 assert.equal(h.tower.begin(),true);
 assert.equal(screen.dataset.manualFocus,'false');
 conclude(h,h.world.players[1]);
 assert.equal(screen.dataset.manualFocus,'false');
});

for(const realm of ['time','space','fire','storm','ice','forest'])test(realm+' ten-floor flow: encounter, blessings, isolation, records and cleanup',()=>{
 const x=harness(true);assert.equal(x.tower.selectRealm(realm),true);assert.equal(x.tower.begin(),true);
 for(let floor=1;floor<=10;floor++){
   assert.equal(x.tower.state.level,floor);assert.ok(x.tower.encounter);
   assert.equal(x.tower.encounter.isBoss,floor%5===0);
   assert.equal(x.tower.selectRealm('ice'),false,'cannot change realm during a run');
   conclude(x,x.world.players[0]);
   if(floor<10){
     if([2,4,7].includes(floor)){
       assert.equal(x.tower.state.offers.length,3);assert.equal(x.tower.begin(),false);
       const offer=x.tower.state.offers[0].id;
       assert.equal(x.tower.chooseBlessing('invalid'),false);
       assert.equal(x.tower.chooseBlessing(offer),true);
       assert.equal(x.tower.chooseBlessing(offer),false,'cannot apply twice');
     }
     if([3,6,8].includes(floor)){
       assert.equal(x.tower.state.routePending,true);
       assert.equal(x.tower.begin(),false,'branch selection is mandatory');
       assert.equal(x.tower.chooseRoute('rush'),true);
     }
     assert.equal(x.tower.begin(),true);
   }
 }
 assert.equal(x.tower.stage,'won');assert.equal(x.tower.state.blessings.length,3);
 assert.equal(x.world.CUSTOM_DEFS.length,0);assert.equal(Object.keys(x.world.BEHAVIORS).length,0);
 assert.equal(x.world.coins,1000);assert.equal(x.tower.records()[0].best,10);
 assert.equal(x.tower.selectRealm(realm==='ice'?'time':'ice'),true);
 assert.equal(x.tower.begin(),true);assert.equal(x.tower.state.blessings.length,0);
 assert.equal(x.world.players[0].maxHp,220);assert.equal(x.world.players[0].forge.skills[0].actions[0].damage,20);
});
