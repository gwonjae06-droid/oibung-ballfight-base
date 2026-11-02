'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=file=>fs.readFileSync('js/features/'+file+'.js','utf8');
function context(extra={}){
 const g={Math,Number,JSON,Object,Array,Set,Map,console,...extra};g.window=g;g.globalThis=g;vm.createContext(g);return g;
}
test('profile normalization keeps persisted v3 contract and prevents passive movement damage',()=>{
 const g=context();vm.runInContext(read('skill-forge-profiles'),g);
 const p=g.SkillForgeProfilesFactory({TYPE:{wave:'파동',dash:'돌진',shot:'투사체'},
  TRIGGER:{auto:'자동'},STATUS:{none:'없음',fire:'화상'},ACTION_PARAMETERS:{},MOVEMENT_ONLY:new Set(['dash'])});
 const original={name:'테스트<파이터>',hp:280,speed:2.1,color:'#aabbcc',skills:[
  {name:'이동과 공격',cooldown:4,actions:[{type:'dash',damage:100,knockback:9,status:'fire'},{type:'wave',damage:22}]}]};
 const frozen=JSON.stringify(original),got=p.normalize(original);
 assert.equal(JSON.stringify(original),frozen,'normalization must not mutate the source profile');
 assert.equal(got.name,'테스트파이터');assert.equal(got.hp,280);assert.equal(got.speed,2.1);
 assert.equal(got.skills[0].actions[0].damage,0);assert.equal(got.skills[0].actions[0].knockback,0);
 assert.equal(got.skills[0].actions[0].status,'none');
 assert.equal(got.skills[0].actions[1].damage,22);
 assert.equal(got.signatureVersion,0);
 assert.equal(got.skills.length,1);
 assert.ok(Object.isFrozen(p));
});
test('tower-only HP limits remain separate from saved normal fighter limits',()=>{
 const g=context();vm.runInContext(read('skill-forge-profiles'),g);
 const p=g.SkillForgeProfilesFactory({TYPE:{wave:'파동'},TRIGGER:{auto:'자동'},STATUS:{none:'없음'},
  ACTION_PARAMETERS:{wave:'damage'},MOVEMENT_ONLY:new Set()});
 const config={name:'체력 시험',hp:7900,skills:[{name:'파동',actions:[{type:'wave',damage:20}]}]};
 assert.equal(p.normalize(config).hp,500);
 assert.equal(p.normalize(config,{towerEnemy:true}).hp,7900);
});
test('store adapter retains legacy key, full fighter roster and graceful malformed data handling',()=>{
 let data='[]',key='',writes=0;
 const disk={getItem:k=>{key=k;return data;},setItem:(k,v)=>{key=k;data=v;writes++;}};
 const g=context({localStorage:disk});vm.runInContext(read('skill-forge-storage'),g);
 const roster=Array.from({length:40},(_,i)=>({forgeData:{name:'파이터'+i,skills:[{actions:[{type:'wave'}]}]}}));
 const s=g.SkillForgeStoreFactory({STORE:'oibung-forge-v3',getDefs:()=>roster});
 s.persist();assert.equal(writes,1);assert.equal(key,'oibung-forge-v3');
 assert.equal(s.saved().length,40);
 data='{broken';assert.equal(s.saved().length,0);
 data='{"not":"a list"}';assert.equal(s.saved().length,0);
});
test('dispatcher uses the same injected hit authority and never damages during pure repositioning',()=>{
 const foe={x:130,y:100,hp:100,radius:20,playerNum:2};
 let hits=0;
 const g=context({canvas:{width:500,height:500},getClosestAliveEnemy:()=>foe});
 vm.runInContext(read('skill-forge-executor'),g);
 const actions=g.SkillForgeExecutorFactory({MOVEMENT_ONLY:new Set(['dash']),
  enemies:()=>[foe],hit:()=>{hits++;return true;}});
 const p={x:100,y:100,px:100,py:100,vx:0,vy:0,radius:30,
  forge:{color:'#abcdef',effectColor:'#abcdef'},forgeShots:[],forgeZones:[],forgeOrbs:[]};
 actions.execute(p,{type:'wave',radius:100,damage:20},foe);
 assert.equal(hits,1);
 actions.execute(p,{type:'dash',speed:5,duration:.3,damage:999},foe);
 assert.equal(hits,1);assert.ok(p.forgeDash>0);
 assert.ok(p.movementOnlyFrames>0);
 assert.equal(foe.hp,100,'only injected hit authority may change opponent HP');
});
test('new modules load exactly once and before SkillForge in both runtime entrypoints',()=>{
 for(const page of ['index.html','pvp-runtime.html']){
  const h=fs.readFileSync(page,'utf8'),paths=[...h.matchAll(/<script\s+src="([^"]+)"/g)].map(x=>x[1].split('?')[0]);
  const core=paths.indexOf('js/features/skill-forge.js');
  for(const name of ['skill-forge-impact','skill-forge-casting','skill-forge-world','skill-forge-profiles','skill-forge-storage','skill-forge-executor']){
   const file='js/features/'+name+'.js';
   assert.ok(paths.indexOf(file)>=0&&paths.indexOf(file)<core,page+' dependency: '+file);
   assert.equal(paths.filter(x=>x===file).length,1,page+' duplicate '+file);
  }
 }
});
