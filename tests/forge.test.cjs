'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/features/skill-forge.js'),'utf8');

function create(){
  const state={
    window:{},document:{querySelector(){return null;}},
    CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},players:[],
    canvas:{width:500,height:500},
    createHitParticles(){},addFloatingText(){},
    getClosestAliveEnemy(p){return state.players.find(e=>e!==p&&e.hp>0)||null;}
  };
  const context=vm.createContext(state);
  vm.runInContext(source,context,{filename:'skill-forge.js'});
  return {state,api:state.window.SkillForge};
}
function profile(overrides={}){
  return {name:'테스트 파이터',color:'#123abc',hp:280,speed:2.3,skills:[
    {name:'나만의 빛',trigger:'auto',cooldown:.2,threshold:50,actions:[
      {type:'wave',damage:35,radius:250,count:2,speed:5,duration:1.5,status:'ice',knockback:1,delay:0}
    ]}
  ],...overrides};
}
function enemy(){return {name:'Target',playerNum:2,x:150,y:100,vx:0,vy:0,radius:34,hp:250,maxHp:250,invincible:0};}

test('freeform recipe preserves cooldown, triggers, combinations and distinct skill labels',()=>{
  const {api}=create(),recipe=profile({
    skills:[{name:'독성 후 폭발',trigger:'lowhp',cooldown:7.7,threshold:31,actions:[
      {type:'zone',damage:16,radius:210,count:1,speed:3,duration:5.4,status:'poison',knockback:2,delay:.5},
      {type:'bolt',damage:73,radius:160,count:4,speed:4,duration:2,status:'fire',knockback:3,delay:1.2}
    ]}]
  });
  const n=api.normalize(recipe);
  assert.equal(n.skills[0].cooldown,7.7);
  assert.equal(n.skills[0].threshold,31);
  assert.equal(n.skills[0].actions[1].type,'bolt');
  assert.equal(n.skills[0].actions[1].delay,1.2);
  assert.equal(n.skills[0].actions[0].duration,5.4);
});
test('validation caps excessive values and rejects empty skills',()=>{
  const {api}=create();
  assert.throws(()=>api.normalize({name:'empty',skills:[]}));
  const n=api.normalize(profile({hp:900,speed:80,
    skills:[{name:'강공',cooldown:0,trigger:'unknown',actions:[{type:'wave',damage:999,radius:900,count:100}]}]}));
  assert.equal(n.hp,500);assert.equal(n.speed,5);
  assert.equal(n.skills[0].cooldown,.2);
  assert.equal(n.skills[0].trigger,'auto');
  assert.equal(n.skills[0].actions[0].damage,120);
  assert.equal(n.skills[0].actions[0].radius,300);
});
test('registered custom wave deals real damage and applies status',()=>{
  const {state,api}=create(),id=api.register(profile());
  const hero=state.CUSTOM_DEFS[0].createInstance(1),target=enemy();
  hero.x=100;hero.y=100;state.players=[hero,target];
  for(let i=0;i<15;i++)state.BEHAVIORS[id].update(hero,target);
  assert.ok(target.hp<250,'custom skill never landed');
  assert.equal(target.slowMultiplier,.5);
  assert.ok(target.slowTimer>0);
});
test('ability conditions do not fire automatically while above HP threshold',()=>{
  const {state,api}=create(),id=api.register(profile({skills:[
    {name:'위기 폭발',trigger:'lowhp',cooldown:.2,threshold:30,actions:[{type:'wave',damage:41,radius:200}]}
  ]}));
  const hero=state.CUSTOM_DEFS[0].createInstance(1),target=enemy();
  hero.x=100;hero.y=100;state.players=[hero,target];
  for(let i=0;i<24;i++)state.BEHAVIORS[id].update(hero,target);
  assert.equal(target.hp,250);
  hero.hp=hero.maxHp*.2;
  state.BEHAVIORS[id].update(hero,target);
  assert.ok(target.hp<250);
});
test('custom fighter count is unrestricted while profile text is sanitized',()=>{
  const {state,api}=create();
  for(let i=0;i<40;i++)api.register(profile({name:'파이터 '+i}));
  assert.equal(api.list().length,40);
  assert.equal(state.CUSTOM_DEFS.filter(d=>d.forgeData).length,40);
  assert.equal(new Set(state.CUSTOM_DEFS.map(d=>d.id)).size,40);
  const s=api.normalize(profile({name:'<script>alert(1)</script>'}));
  assert.ok(!s.name.includes('<'));
});
test('saved roster restores every profile instead of cutting off after 6',()=>{
  const start=source.indexOf('function saved(){'),end=source.indexOf('function persist(){',start);
  assert.ok(start>=0&&end>start);
  const profiles=Array.from({length:35},(_,i)=>profile({name:'캐릭터 '+i}));
  const store={getItem(){return JSON.stringify(profiles);}};
  const context=vm.createContext({localStorage:store,JSON,Array,STORE:'oibung-forge-v3'});
  const loaded=vm.runInContext(source.slice(start,end)+'saved()',context);
  assert.equal(loaded.length,35);
  assert.equal(loaded[34].name,'캐릭터 34');
});
