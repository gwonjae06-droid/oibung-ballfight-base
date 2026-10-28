'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
const script=read('js/features/skill-forge.js');
function harness(mode,delay=0){
  const casts=[],state={
    window:null,document:{querySelector(){return null;}},
    CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},players:[],
    canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},
    getClosestAliveEnemy(p){return state.players.find(e=>e!==p&&e.hp>0)||null;},
    ForgeExpansion:{
      blocked:()=>false,update(){},execute(){return false;},damageScale:()=>1,
      applyStatus(){},active:()=>false,
      heal(p,n){casts.push(n);p.hp=Math.min(p.maxHp,p.hp+n);}
    }
  };
  state.window=state;vm.createContext(state);vm.runInContext(script,state);
  const forge=state.SkillForge,skill={name:'블록 연계',trigger:'auto',cooldown:3,actions:[
    {type:'heal',damage:9},{type:'heal',damage:17}
  ],links:[{mode,delay}]};
  const profile=forge.normalize({name:'조립 테스트',skills:[skill]});
  const id=forge.register(profile),player=state.CUSTOM_DEFS[0].createInstance(1);
  const target={playerNum:2,hp:250,x:160,y:80,radius:25};
  player.x=80;player.y=80;player.hp=100;state.players=[player,target];
  player.forgeTicks[0]=180;
  const step=(n=1)=>{for(let i=0;i<n;i++)state.BEHAVIORS[id].update(player,target);};
  return {forge,profile,player,casts,step};
}
test('connector schema is bounded, saved, and backward compatible',()=>{
  const old=harness('after');
  assert.equal(old.profile.skills[0].links[0].mode,'after');
  const n=old.forge.normalize({skills:[{actions:[{type:'heal'},{type:'heal'}],links:[{mode:'__proto__',delay:999}]}]});
  assert.equal(n.skills[0].links[0].mode,'after');
  assert.equal(n.skills[0].links[0].delay,2);
  const legacy=old.forge.normalize({skills:[{actions:[{type:'heal'},{type:'shield'}]}]});
  assert.equal(legacy.skills[0].links[0].mode,'after');
});
test('together connector executes both actions in the same simulation frame',()=>{
  const h=harness('together');h.step();
  assert.deepEqual(h.casts,[9,17]);
  assert.equal(h.player.hp,126);
  assert.equal(h.player.forgeQueue.length,0);
});
test('after connector keeps authored actions sequential',()=>{
  const h=harness('after');h.step();
  assert.deepEqual(h.casts,[9]);
  assert.equal(h.player.forgeQueue.length,1);
  h.step(7);assert.deepEqual(h.casts,[9,17]);
});
test('delay connector waits requested seconds on the independent skill clock',()=>{
  const h=harness('delay',.5);h.step();
  assert.deepEqual(h.casts,[9]);
  h.step(28);assert.deepEqual(h.casts,[9]);
  h.step(2);assert.deepEqual(h.casts,[9,17]);
});
test('block editor is loaded in character studio and has no arbitrary code execution',()=>{
  const html=read('index.html'),src=read('js/features/block-forge.js'),css=read('css/block-forge.css');
  assert.match(html,/js\/features\/ui-categories\.js"[\s\S]*js\/features\/block-forge\.js"/);
  assert.match(html,/css\/block-forge\.css/);
  assert.match(src,/className='block-forge'/);
  assert.match(src,/data-command="split"/);
  assert.match(src,/data-command="merge"/);
  assert.match(src,/data-drag-index/);
  assert.match(src,/forge\.setDraft\(d\)/);
  assert.match(css,/@media\(max-width:440px\)/);
  new vm.Script(src);
});
