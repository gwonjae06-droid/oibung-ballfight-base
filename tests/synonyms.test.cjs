'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..');
const code=f=>fs.readFileSync(path.join(base,'js/features',f),'utf8');
function app(){
  const state={
    window:null,document:{querySelector(){return null},getElementById(){return null}},
    localStorage:{getItem(){return null},setItem(){}},
    CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},players:[],
    canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},
    getClosestAliveEnemy(p){return state.players.find(e=>e!==p&&e.hp>0)||null}
  };
  state.window=state;
  const context=vm.createContext(state);
  for(const script of ['ability-atlas.js','skill-forge.js','natural-forge.js'])
    vm.runInContext(code(script),context,{filename:script});
  return state;
}
const acts=(app,text)=>app.NaturalForge.parse(text,'검증').profile.skills[0].actions;
test('이동 순간이동 텔레포트 텔포 점멸 워프 are the same blink action',()=>{
  const a=app();
  for(const term of ['이동','순간이동','텔레포트','텔포','점멸','워프']){
    const xs=acts(a,'3초마다 '+term+' 후 독딜');
    assert.deepEqual(Array.from(xs,x=>x.type),['blink','zone'],term);
    assert.equal(xs[1].status,'poison',term);
    assert.ok(xs[1].delay>xs[0].delay,term);
  }
});
test('번개 낙뢰 벼락 천둥 전격 뇌격 map to the actual bolt engine',()=>{
  const a=app();
  for(const term of ['번개','낙뢰','벼락','천둥','전격','뇌격']){
    const item=acts(a,'매 4초마다 '+term+' 3줄기로 45 피해를 준다')[0];
    assert.equal(item.type,'bolt',term);assert.equal(item.count,3);
    assert.equal(item.damage,45,term);
  }
});
test('독, 독딜, 도트데미지, DOT, 지속 피해, 중독 denote poison periodic damage',()=>{
  const a=app();
  for(const term of ['독','독딜','도트데미지','도트딜','DOT','지속 피해','중독']){
    const action=acts(a,'4초마다 '+term+'을 5초 동안 준다')[0];
    assert.equal(action.type,'zone',term);
    assert.equal(action.status,'poison',term);
    assert.equal(action.duration,5,term);
    assert.equal(action.damage,18,'duration cannot be confused with damage: '+term);
  }
});
test('poison modifier on a lightning strike remains bolt with poison, not duplicate zone',()=>{
  const a=app();
  const moves=acts(a,'2초마다 낙뢰를 떨어뜨려 독딜 20을 가한다');
  assert.equal(moves.length,1);assert.equal(moves[0].type,'bolt');
  assert.equal(moves[0].status,'poison');assert.equal(moves[0].damage,20);
});
test('이동 속도 3.2 is movement stat, not a teleport skill',()=>{
  const a=app(),result=a.NaturalForge.parse('이동 속도 3.2, 기본 체력 300이다. 4초마다 번개를 쓴다','속도형');
  assert.equal(result.profile.speed,3.2);assert.equal(result.profile.hp,300);
  assert.equal(JSON.stringify(result.profile.skills.map(s=>s.actions.map(x=>x.type))),JSON.stringify([['bolt']]));
  assert.equal(result.unmapped.length,0);
});
test('DoT length and damage persist in actual simulation entity',()=>{
  const a=app();
  const config=a.NaturalForge.parse('0.2초마다 도트데미지를 5초 동안 준다','중독 파이터').profile;
  const id=a.SkillForge.register(config);
  const p=a.CUSTOM_DEFS[0].createInstance(1);
  const e={playerNum:2,x:150,y:100,radius:34,hp:250,maxHp:250,vx:0,vy:0,invincible:0,jumpState:'ground'};
  p.x=100;p.y=100;a.players.push(p,e);
  for(let i=0;i<15;i++)a.BEHAVIORS[id].update(p,e);
  assert.ok(e.hp<250,'poison initial hit should land');
  assert.equal(e.bfDot,300,'5 seconds of poison means 300 simulation frames');
  assert.ok(e.bfDotDamage>=1);
});

test('DoT value and duration are separate numeric slots',()=>{
  const a=app();
  const x=acts(a,'매 4초마다 독딜 20을 5초 동안 준다')[0];
  assert.equal(x.damage,20);
  assert.equal(x.duration,5);
  assert.equal(x.status,'poison');
});
