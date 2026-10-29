'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
  const h={window:null,Math,Date,console,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},
    CHARACTER_PHOTOS:{},createHitParticles(){},addFloatingText(){},
    document:{querySelector(){return null;},getElementById(){return null;}},
    getClosestAliveEnemy(){return null;}};
  h.window=h;
  vm.createContext(h);
  for(const name of ['action-registry','skill-forge','tower-challenge'])
    vm.runInContext(read('js/features/'+name+'.js'),h,{filename:name+'.js'});
  return h;
}
test('tower-only registration keeps all six boss skills and independent clocks',()=>{
  const h=world();
  for(const floor of [5,10]){
    const foe=h.ArenaTowerModel.makeEnemy(floor);
    const id=h.SkillForge.register(foe,{towerEnemy:true});
    const def=h.CUSTOM_DEFS.find(x=>x.id===id);
    assert.ok(def);
    const instance=def.createInstance(2);
    assert.equal(def.forgeData.skills.length,6);
    assert.equal(instance.forge.skills.length,6);
    assert.equal(instance.forgeTicks.length,6);
    assert.ok(instance.forgeTicks.every(Number.isFinite));
    assert.equal(instance.forge.skills.filter(x=>x.trigger==='auto').length,4);
  }
});
test('normal custom characters still have four skills maximum',()=>{
  const h=world(),foe=h.ArenaTowerModel.makeEnemy(10);
  assert.equal(h.SkillForge.normalize(foe).skills.length,4);
  const id=h.SkillForge.register(foe);
  const def=h.CUSTOM_DEFS.find(x=>x.id===id);
  assert.equal(def.forgeData.skills.length,4);
  assert.equal(def.createInstance(1).forgeTicks.length,4);
});
test('transient tower enemies can spawn even when the user roster holds six fighters',()=>{
  const h=world();
  for(let i=0;i<6;i++)h.CUSTOM_DEFS.push({id:'saved_'+i,name:'Saved '+i});
  const foe=h.ArenaTowerModel.makeEnemy(10);
  assert.throws(()=>h.SkillForge.register(foe),/최대 6명/);
  const id=h.SkillForge.register(foe,{towerEnemy:true});
  assert.equal(h.CUSTOM_DEFS.length,7);
  const index=h.CUSTOM_DEFS.findIndex(x=>x.id===id);
  assert.equal(h.CUSTOM_DEFS[index].createInstance(2).forge.skills.length,6);
  h.CUSTOM_DEFS.splice(index,1);
  delete h.BEHAVIORS[id];
  assert.equal(h.CUSTOM_DEFS.length,6);
});
test('hard floor mechanics stay within runtime safety limits',()=>{
  const h=world(),m=h.ArenaTowerModel;
  for(let i=1;i<=10;i++){
    const f=m.floor(i),p=m.makeEnemy(i);
    assert.ok(f.hp<=500&&f.speed<=5&&f.damage<=90);
    assert.ok(p.skills.every(s=>s.cooldown>=.2&&s.cooldown<=30));
    assert.ok(p.skills.every(s=>s.actions.every(a=>a.damage<=120)));
    if(i>=5){
      assert.ok(p.skills.filter(s=>s.trigger==='auto').length>=3);
      assert.ok(f.hp>=300&&f.damage>=30,'late floors must be significantly difficult');
    }
  }
});
