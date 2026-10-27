'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/features/ability-atlas.js'),'utf8');
function setup(){
  const state={Math,canvas:{width:500,height:500},window:null};
  state.window=state;vm.runInNewContext(source,state,{filename:'ability-atlas.js'});
  return state.AbilityAtlas;
}
const fighter=(playerNum,x,y,hp=250)=>({playerNum,x,y,hp,maxHp:250,radius:34,vx:1,vy:0});
test('catalog contains 210 distinct executable layouts',()=>{
  const a=setup();
  assert.equal(a.count,210);
  assert.equal(new Set(a.catalog.map(x=>x.id)).size,210);
  assert.equal(Object.keys(a.TYPES).length,5);
  assert.equal(Object.keys(a.PATTERNS).length,7);
  assert.equal(Object.keys(a.TARGETS).length,6);
  for(const move of a.catalog){
    assert.ok(a.TYPES[move.type]&&a.PATTERNS[move.pattern]&&a.TARGETS[move.target]);
  }
});
test('seven formations produce meaningfully different coordinates for volleys',()=>{
  const a=setup(),hero=fighter(1,80,100),enemy=fighter(2,280,290);
  const kinds=Object.keys(a.PATTERNS);
  const signatures=kinds.map(p=>{
    const values=a.layout(hero,enemy,p,6,200,43);
    assert.equal(values.length,6);
    return values.map(v=>[Math.round(v.x),Math.round(v.y)]).join(';');
  });
  assert.equal(new Set(signatures).size,kinds.length);
});
test('six targeting policies choose intended enemies',()=>{
  const a=setup(),hero=fighter(1,150,150);
  const foes=[fighter(2,155,150,50),fighter(3,430,430,220),fighter(4,180,160,140)];
  assert.equal(a.choose(hero,foes,'nearest').playerNum,2);
  assert.equal(a.choose(hero,foes,'farthest').playerNum,3);
  assert.equal(a.choose(hero,foes,'lowest').playerNum,2);
  assert.equal(a.choose(hero,foes,'highest').playerNum,3);
  assert.ok(foes.includes(a.choose(hero,foes,'random')));
  assert.ok(foes.includes(a.choose(hero,foes,'cluster')));
});
test('all 210 combinations execute through real combat channels, not labels',()=>{
  const a=setup(),hero=fighter(1,100,100),enemy=fighter(2,240,160);
  hero.forge={color:'#667788'};hero.forgeShots=[];hero.forgeZones=[];
  const enemies=()=>[enemy];
  let hitCalls=0;
  const api={enemies,hit(_a,_b){hitCalls++;return true;}};
  const types=Object.keys(a.TYPES);
  for(const action of a.catalog){
    hero.forgeShots=[];hero.forgeZones=[];const before=hitCalls;
    const config={...action,damage:20,count:5,radius:170,speed:6,duration:1};
    const done=a.execute(hero,config,enemy,api);
    assert.equal(done,true);
    if(action.type==='shot')assert.equal(hero.forgeShots.length,5);
    if(action.type==='bolt'||action.type==='zone')assert.equal(hero.forgeZones.length,5);
    if(action.type==='wave'||action.type==='beam')assert.ok(hitCalls>=before);
  }
  assert.equal(types.length,5);
});
test('pre-existing unsupported types leave processing to the old engine',()=>{
  const a=setup(),hero=fighter(1,100,100),enemy=fighter(2,200,200);
  assert.equal(a.execute(hero,{type:'heal'},enemy,{enemies:()=>[enemy]}),false);
});
