'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../js/features/skill-forge.js'),'utf8');
const profile=()=>({name:'독립 타이머',hp:250,speed:1.7,skills:[
  {name:'빠른 회복',trigger:'auto',cooldown:.2,actions:[{type:'heal',damage:1}]},
  {name:'보호막',trigger:'auto',cooldown:.65,actions:[{type:'shield',duration:.3}]},
  {name:'연속 돌격',trigger:'auto',cooldown:1.1,actions:[
    {type:'heal',damage:1,delay:0},
    {type:'shield',duration:.3,delay:0},
    {type:'heal',damage:1,delay:.35}
  ]}
]});
function harness(){
  let blocked=false;
  const state={
    window:null,document:{querySelector(){return null;}},
    CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},players:[],
    canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},
    getClosestAliveEnemy(p){return state.players.find(e=>e!==p&&e.hp>0)||null;},
    ForgeExpansion:{blocked:()=>blocked,update(){},execute(){return false;},damageScale:()=>1,applyStatus(){},heal(p,amount){p.hp=Math.min(p.maxHp,p.hp+amount);},active:()=>false}
  };
  state.window=state;
  const context=vm.createContext(state);
  vm.runInContext(script,context);
  const api=state.window.SkillForge;
  const id=api.register(profile()),hero=state.CUSTOM_DEFS[0].createInstance(1);
  const target={playerNum:2,hp:250,maxHp:250,x:180,y:100,radius:34};
  hero.x=100;hero.y=100;hero.hp=200;state.players=[hero,target];
  return {state,api,id,hero,target,step(n=1){
    for(let i=0;i<n;i++)state.BEHAVIORS[id].update(hero,target);
  },blocked(value){blocked=value;}};
}
test('every skill recharges independently and its own timer resets only on its cast',()=>{
  const h=harness(),casts=[0,0,0],last=[...h.hero.forgeTicks];
  for(let frame=0;frame<155;frame++){
    h.step();
    h.hero.forgeTicks.forEach((v,i)=>{if(v<last[i])casts[i]++;last[i]=v;});
  }
  assert.ok(casts[0]>casts[1]*2,JSON.stringify(casts));
  assert.ok(casts[1]>casts[2],JSON.stringify(casts));
  assert.ok(casts[2]>=2,JSON.stringify(casts));
  assert.equal(h.hero.forgeTicks.length,3);
});
test('different skills can execute in overlapping windows while a combo stays ordered',()=>{
  const h=harness();
  let overlap=false,thirdSequence=false;
  for(let i=0;i<120;i++){
    const comboPending=h.hero.forgeQueue.some(x=>x.skillIndex===2);
    const priorFastCharge=h.hero.forgeTicks[0];
    h.step();
    const q=h.hero.forgeQueue;
    if(comboPending&&h.hero.forgeTicks[0]<priorFastCharge)overlap=true;
    if(q.some(x=>x.skillIndex===2&&x.step===2))thirdSequence=true;
  }
  assert.ok(overlap,'fast skill can recharge and fire while combo is still pending');
  assert.ok(thirdSequence,'combo should preserve the third ordered action');
});
test('silence delays pending actions without dropping them, but each timer keeps charging',()=>{
  const h=harness();h.step(23);
  // A mid-sequence combo must survive a block.
  const pending=h.hero.forgeQueue.find(x=>x.skillIndex===2);
  assert.ok(pending);
  h.blocked(true);
  const previous=h.hero.forgeTicks[0];
  h.step(12);
  assert.ok(h.hero.forgeTicks[0]>=previous);
  assert.ok(h.hero.forgeQueue.some(x=>x.castId===pending.castId));
  h.blocked(false);h.step(20);
  assert.ok(!h.hero.forgeQueue.some(x=>x.castId===pending.castId));
});
test('the economy cooldown item affects every forge skill individually',()=>{
  const h=harness();h.hero.forgeRush=true;
  assert.equal(h.api.cooldownFrames(h.hero,h.hero.forge.skills[0]),12);
  assert.equal(h.api.cooldownFrames(h.hero,h.hero.forge.skills[1]),39);
  assert.equal(h.api.cooldownFrames(h.hero,h.hero.forge.skills[2]),60);
});
test('renderer no longer intentionally freezes the physics clock on strong hits',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../js/features/battle-effects.js'),'utf8');
  assert.ok(!src.includes('stopUntil'));
  assert.ok(src.includes('while(acc+0.000001>=step'));
});
test('studio merges duplicate primary preview and saved/share library controls',()=>{
  const natural=fs.readFileSync(path.join(__dirname,'../js/features/natural-forge.js'),'utf8');
  const shared=fs.readFileSync(path.join(__dirname,'../js/features/community-forge.js'),'utf8');
  assert.ok(natural.includes("actions.replaceChildren(saveBtn)"));
  assert.ok(natural.includes("advanced.append(inspect,document.getElementById('bf-result'))"));
  assert.ok(natural.includes("library.append(libraryTitle,catalogDetail,guide)"));
  assert.ok(natural.includes("saved.append(savedTitle,document.getElementById('bf-custom-list'),body.querySelector('.forge-json'))"));
  assert.ok(shared.includes("panel.querySelector('.forge-saved')"));
});
