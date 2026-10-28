'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function harness(){
  const s={window:null,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
    canvas:{width:500,height:500},Math,
    document:{querySelector:()=>null,getElementById:()=>null},
    createHitParticles(){},addFloatingText(){},
    getClosestAliveEnemy(p){return s.players.find(e=>e!==p&&e.hp>0)||null;}};
  s.window=s;vm.createContext(s);
  for(const file of ['js/features/forge-expansion.js','js/features/advanced-combat.js',
    'js/features/skill-forge.js','js/features/block-forge.js'])
    vm.runInContext(read(file),s,{filename:file});
  const def=s.SkillForge.register({name:'이동 전용 캐릭터',hp:250,speed:2,
    skills:[{name:'이동',trigger:'lowhp',threshold:5,cooldown:30,
      actions:[{type:'blink',damage:90,status:'fire',knockback:7,radius:300}]}]});
  const hero=s.CUSTOM_DEFS[0].createInstance(1);
  hero.x=100;hero.y=100;hero.vx=0;hero.vy=0;
  const enemy={id:'enemy',playerNum:2,name:'적',x:130,y:100,
    radius:26,vx:0,vy:0,hp:250,maxHp:250,invincible:0,z:0,vz:0,
    jumpState:'ground'};
  s.players=[hero,enemy];
  const action=(type,props={})=>({type,damage:95,status:'fire',
    knockback:8,radius:300,speed:10,duration:2,count:1,
    target:'nearest',...props});
  const exec=act=>{
    hero.forgeQueue.push({remaining:0,step:0,castId:++hero.forgeSerial,
      skillIndex:0,a:act,targetNum:2,waitApex:false});
    s.BEHAVIORS[def].update(hero,enemy);
  };
  return {s,hero,enemy,action,exec,def};
}
test('pure movement schema drops damage, status and knockback from old saved recipes',()=>{
  const {s,action}=harness();
  for(const type of ['dash','blink','leap','hover','glide','swap','retreat','portal']){
    const normalized=s.SkillForge.normalize({name:'기본',skills:[
      {name:'이동',actions:[action(type)]}]});
    const a=normalized.skills[0].actions[0];
    assert.equal(a.damage,0,type+' damage');
    assert.equal(a.status,'none',type+' status');
    assert.equal(a.knockback,0,type+' knockback');
  }
  assert.equal(s.SkillForge.supportedParameter('dash','damage'),false);
  assert.equal(s.SkillForge.supportedParameter('blink','status'),false);
  assert.equal(s.SkillForge.supportedParameter('dash','speed'),true);
});
test('dash, blink and accidental collision cannot deal damage or status',()=>{
  const {s,hero,enemy,action,exec,def}=harness();
  assert.equal(s.SkillForge.hit(hero,enemy,action('dash')),false,
    'even a raw old dash action cannot hit through the shared combat API');
  exec(action('blink'));assert.equal(enemy.hp,250);assert.equal(enemy.bfDot,undefined);
  assert.equal(enemy.vx,0);
  exec(action('dash'));assert.ok(hero.forgeDash>0);
  assert.equal(enemy.hp,250);
  for(let i=0;i<12;i++){
    hero.x=enemy.x;hero.y=enemy.y;
    s.BEHAVIORS[def].onContact(hero,enemy);
  }
  assert.equal(enemy.hp,250,'passive touching must not chip HP');
  assert.equal(enemy.bfDot,undefined,'movement cannot apply fire');
  assert.equal(enemy.slowTimer,undefined);
  assert.equal(enemy.vx,0,'movement cannot sneak knockback through contact');
});
test('movement plus a separately authored attack deals damage only when attack executes',()=>{
  const {s,hero,enemy,action,exec}=harness();
  exec(action('blink'));assert.equal(enemy.hp,250);
  enemy.invincible=0;
  exec(action('wave',{damage:35,status:'none',knockback:0}));
  assert.equal(enemy.hp,215,'the explicit wave attack should still deal 35');
});
test('scratch movement palette contains no offensive attacks; impact variants are separate attacks',()=>{
  const src=read('js/features/block-forge.js');
  assert.ok(src.includes("mobility:{name:'이동 · 피해 없음',types:['dash','blink','leap','hover','glide','swap','retreat','portal']}"));
  for(const type of ['dive','flight','burrow','burrowdash','erupt']){
    assert.match(src,new RegExp("'"+type+"'"));
  }
  const forge=read('js/features/skill-forge.js');
  assert.ok(forge.includes('이동 전용 · 피해·상태이상·넉백 없음'));
  assert.ok(!forge.includes('if(e&&e.invincible===0)hit(p,e,{damage:7'));
});
