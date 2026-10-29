'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../js/features/tower-challenge.js'),'utf8');
function conclude(x,winner){
  // Production engine sets these flags *before* notifying ArenaTower.
  x.world.isGameOver=true;x.world.isPlaying=false;
  return x.tower.onBattleEnd(winner);
}
function harness(){
  const nodes=new Map();
  class Element{
    constructor(name='div'){this.tagName=name;this.listeners={};this.children=[];this.hidden=false;this.value='';this.dataset={};}
    set id(value){this._id=value;nodes.set(value,this);}
    get id(){return this._id;}
    set innerHTML(value){
      this._html=value;
      for(const m of value.matchAll(/id="([^"]+)"/g))new Element('node').id=m[1];
    }
    get innerHTML(){return this._html||'';}
    append(...children){this.children.push(...children);}
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
  const doc={getElementById:id=>nodes.get(id)||null,createElement:type=>new Element(type)};
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
  vm.runInContext(src,world,{filename:'tower-challenge.js'});
  const tower=world.ArenaTower,el=id=>nodes.get(id);
  return {world,tower,el,saved};
}
test('the real tower controller starts fresh two-fighter rounds, awards wins and never adds enemy to player roster',()=>{
  const x=harness();
  assert.equal(x.tower.begin(),true);
  assert.equal(x.tower.stage,'fighting');
  assert.equal(x.world.players[0].playerNum,1);
  assert.equal(x.world.players[1].playerNum,2);
  assert.equal(x.world.CUSTOM_DEFS.length,0);
  assert.equal(x.tower.isTransientDef(x.tower.isTransientDef?null:null),false);
  conclude(x,x.world.players[0]);
  assert.equal(x.tower.stage,'reward');
  assert.equal(x.tower.state.cleared,1);
  assert.equal(x.tower.chooseReward('gold'),true);
  assert.equal(x.world.coins,1055);
  assert.equal(x.tower.state.level,2);
  assert.equal(x.tower.stage,'fighting');
  assert.equal(x.world.CUSTOM_DEFS.length,0);
  conclude(x,x.world.players[1]);
  assert.equal(x.tower.stage,'lost');
  assert.equal(x.tower.records()[0].best,1);
  assert.equal(x.tower.records()[0].attempts,1);
  assert.equal(x.tower.begin(),true,'player can retry after defeat');
});
test('bonuses are applied only to fresh battle instances and 10th win records completion',()=>{
  const x=harness(),base=x.world.CHARACTER_DEFS[0];
  assert.equal(x.tower.begin(),true);
  for(let floor=1;floor<=10;floor++){
    assert.equal(x.tower.state.level,floor);
    assert.equal(x.world.CUSTOM_DEFS.length,0,'bosses are transient');
    conclude(x,x.world.players[0]);
    if(floor<10){
      assert.equal(x.tower.stage,'reward');
      assert.equal(x.tower.chooseReward('hp'),true);
      assert.equal(x.world.players[0].maxHp,220+(floor*40>200?200:floor*40));
      assert.equal(x.tower.stage,'fighting');
    }
  }
  assert.equal(x.tower.stage,'won');
  assert.equal(x.tower.active,false);
  assert.equal(x.tower.records()[0].best,10);
  assert.equal(base.createInstance(1).maxHp,220,'bonuses do not mutate original definition');
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
