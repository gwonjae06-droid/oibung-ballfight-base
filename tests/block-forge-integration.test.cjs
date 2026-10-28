'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const forgeSource=read('js/features/skill-forge.js');
const blocksSource=read('js/features/block-forge.js');
function harness(){
  const casts=[];
  const h={window:null,document:{querySelector(){return null;}},CUSTOM_DEFS:[],
    BEHAVIORS:{},CHARACTER_PHOTOS:{},players:[],
    canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},
    getClosestAliveEnemy(p){return h.players.find(e=>e!==p&&e.hp>0)||null;},
    ForgeExpansion:{blocked:()=>false,update(){},execute(){return false;},
      damageScale:()=>1,applyStatus(){},active:()=>false,
      heal(p,amount){casts.push(amount);p.hp=Math.min(p.maxHp,p.hp+amount);}
    }
  };
  h.window=h;vm.createContext(h);vm.runInContext(forgeSource,h);vm.runInContext(blocksSource,h);
  return {h,forge:h.SkillForge,blocks:h.BlockForge,casts};
}
const initial=()=>({name:'블록 파이터',skills:[{
  name:'기본 스킬',trigger:'auto',cooldown:3,actions:[{type:'heal',damage:9}]
}]});
test('block editor handles adding, merging and splitting without code strings',()=>{
  const {blocks}=harness();
  let p=blocks.modify(initial(),{kind:'add',skill:0,type:'shield'});
  assert.equal(p.skills[0].actions.length,2);
  p=blocks.modify(p,{kind:'link',skill:0,index:1,value:'with'});
  assert.equal(p.skills[0].actions[1].link,'with');
  p=blocks.modify(p,{kind:'split',skill:0,index:1});
  assert.equal(p.skills.length,2);
  assert.equal(p.skills[0].actions.length,1);
  assert.equal(p.skills[1].actions.length,1);
  p=blocks.modify(p,{kind:'merge',skill:1});
  assert.equal(p.skills.length,1);
  assert.equal(p.skills[0].actions.length,2);
  assert.throws(()=>blocks.modify(p,{kind:'add',skill:0,type:'<script>'}));
});
test('Korean final-consonant particle inflection matches action names',()=>{
  const {blocks}=harness();
  assert.equal(blocks.josa('낙뢰','을','를'),'낙뢰를');
  assert.equal(blocks.josa('회복','을','를'),'회복을');
  assert.equal(blocks.josa('낙뢰','과','와'),'낙뢰와');
  assert.equal(blocks.josa('회복','과','와'),'회복과');
});
test('with connector runs skills together; after schedules them in order',()=>{
  function run(link){
    const {h,forge,casts}=harness();
    const profile=initial();
    profile.skills[0].actions.push({type:'heal',damage:17,link});
    const id=forge.register(profile);
    const player=h.CUSTOM_DEFS[0].createInstance(1);
    const target={playerNum:2,x:150,y:100,hp:250,radius:25};
    player.hp=100;player.x=100;player.y=100;
    h.players.push(player,target);player.forgeTicks[0]=180;
    h.BEHAVIORS[id].update(player,target);
    return {casts,player};
  }
  const together=run('with'),ordered=run('after');
  assert.deepEqual(together.casts,[9,17]);
  assert.deepEqual(ordered.casts,[9]);
  assert.ok(ordered.player.forgeQueue.some(a=>a.remaining>0));
});
test('imported JSON also refreshes the visual block workspace',()=>{
  assert.match(forgeSource,/forge-json-text'\)\.value\)\);refreshBasics\(\);render\(\);global\.BlockForge\?\.refresh\?\.\(\)/);
  assert.match(forgeSource,/draft=normalize\(value\);refreshForm\(\);global\.BlockForge\?\.refresh\?\.\(\)/);
  assert.match(read('index.html'),/js\/features\/block-forge\.js/);
});
