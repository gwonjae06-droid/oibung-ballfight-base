'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..');
const load=(n)=>fs.readFileSync(path.join(base,'js/features',n),'utf8');
function harness(){
  const ctx={console,URLSearchParams,localStorage:{store:{},getItem(k){return this.store[k]||null;},setItem(k,v){this.store[k]=v;}},
    document:{querySelector(){return null;},getElementById(){return null;}},CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
    players:[],canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},
    getClosestAliveEnemy(){return null;}};
  ctx.window=ctx;
  const context=vm.createContext(ctx);
  for(const file of ['skill-forge.js','natural-forge.js','community-forge.js'])vm.runInContext(load(file),context);
  return ctx;
}
function profile(){
  return {name:'번개 기사',hp:250,speed:2,color:'#333333',skills:[
    {name:'천둥',trigger:'auto',cooldown:3,actions:[{type:'bolt',damage:45,radius:160,count:3}]}
  ]};
}
test('Korean description extracts HP trigger, lightning count, cooldown and damage',()=>{
  const h=harness();
  const out=h.NaturalForge.parse('체력 30% 이하에서 3초마다 번개 3줄기를 내려쳐 피해 45를 준다. 그 후 2초간 방어막을 만든다.','천둥 기사');
  assert.equal(out.profile.name,'천둥 기사');
  assert.equal(out.profile.skills[0].trigger,'lowhp');
  assert.equal(out.profile.skills[0].threshold,30);
  assert.equal(out.profile.skills[0].cooldown,3);
  assert.equal(out.profile.skills[0].actions[0].type,'bolt');
  assert.equal(out.profile.skills[0].actions[0].count,3);
  assert.equal(out.profile.skills[0].actions[0].damage,45);
  assert.ok(out.profile.skills.some(s=>s.actions.some(a=>a.type==='shield')));
});
test('saved characters can be removed and their behavior unregistered',()=>{
  const h=harness();
  const id=h.SkillForge.register(profile());h.SkillForge.persist();
  assert.equal(h.SkillForge.list().length,1);
  assert.ok(h.BEHAVIORS[id]);
  assert.ok(h.SkillForge.remove(id));
  assert.equal(h.SkillForge.list().length,0);
  assert.equal(h.BEHAVIORS[id],undefined);
  assert.equal(JSON.parse(h.localStorage.getItem('oibung-forge-v3')).length,0);
});
test('community issue content round-trips through a strict validated recipe',()=>{
  const h=harness();
  const body=h.CommunityForge.makeBody(profile());
  const restored=h.CommunityForge.parseBody(body);
  assert.equal(restored.name,'번개 기사');
  assert.equal(restored.skills[0].actions[0].type,'bolt');
  const url=h.CommunityForge.makeUrl(profile());
  assert.match(url,/https:\/\/github.com\/gwonjae06-droid\/oibung-ballfight-base\/issues\/new\?/);
  assert.match(url,/body=/);
  assert.equal(h.CommunityForge.parseBody('nonsense'),null);
});
test('input is treated as data and impossible or malformed recipes are rejected',()=>{
  const h=harness();
  assert.equal(h.CommunityForge.parseBody('OIBUNG-CHARACTER-V1\n<script>alert(1)</script>\nEND-OIBUNG-CHARACTER-V1'),null);
  const result=h.NaturalForge.parse('매 2초마다 강한 화염 구슬을 4발 쏘고 화상 효과를 건다.','화염 마법사');
  assert.equal(result.profile.skills[0].actions[0].type,'shot');
  assert.equal(result.profile.skills[0].actions[0].status,'fire');
  assert.equal(result.profile.skills[0].cooldown,2);
});
