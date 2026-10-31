'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync('js/features/'+p+'.js','utf8');
function makeWorld(){
 const w={Math,Number,Set,Map,console,players:[],canvas:{width:500,height:500},
  addFloatingText(){},createHitParticles(){},CUSTOM_DEFS:[],CHARACTER_PHOTOS:{},BEHAVIORS:{},
  getClosestAliveEnemy(){return null;}};
 w.window=w;w.globalThis=w;vm.createContext(w);
 for(const path of ['arena-balance','forge-expansion','skill-forge'])vm.runInContext(read(path),w);
 return w;
}
const spell=(type,damage=0,duration=1.5,cooldown=3)=>({
 name:type,cooldown,trigger:'auto',actions:[{type,damage,duration,radius:100,count:1,knockback:0,status:'none'}]});
test('a modest standalone heal or shield retains its authored effectiveness',()=>{
 const w=makeWorld(),p={hp:100,maxHp:300,forge:{skills:[spell('heal',35,1.5,4)]}};
 assert.equal(w.ArenaBalance.defenseFactorOf(p),1);
 assert.equal(w.ForgeExpansion.heal(p,35),35);
 assert.equal(p.hp,135);
 const protector={forge:{skills:[spell('shield',0,1,5)]}};
 assert.equal(w.ArenaBalance.defenseFactorOf(protector),1);
});
test('very high-frequency defensive loadouts retain healing but at a softer effective rate',()=>{
 const w=makeWorld();
 const p={hp:100,maxHp:500,forge:{skills:[
 spell('heal',120,1.5,.3),spell('heal',120,1.5,.3),
 spell('shield',0,8,.4),spell('regen',120,8,.4)
 ]}};
 const score=w.ArenaBalance.defenseSummary(p.forge);
 assert.ok(score.excess);
 assert.ok(score.multiplier>=.38&&score.multiplier<1);
 assert.equal(w.ArenaBalance.summary(p.forge).multiplier,1,'defense must not penalize offensive stats');
 const gained=w.ForgeExpansion.heal(p,100);
 assert.ok(gained>0&&gained<100);
 assert.ok(Math.abs(gained-100*score.multiplier)<.01);
});
test('regen and fortify obey the same defense coefficient in the real combat implementation',()=>{
 const w=makeWorld(),p={hp:200,maxHp:500,
  forge:{skills:Array.from({length:4},(_,i)=>spell('regen',120,8,.3))},
  forgeEffects:{regen:{time:110,age:29,power:120}}};
 const factor=w.ArenaBalance.defenseFactorOf(p);
 w.ForgeExpansion.tick(p);
 assert.ok(p.hp>200);
 assert.ok(Math.abs(p.hp-200-30*factor)<.001);
 const defender={hp:300,maxHp:300,forge:p.forge,forgeEffects:{fortify:{time:60}}};
 const scaled=w.ForgeExpansion.damageScale({forgeEffects:{}},defender);
 assert.ok(Math.abs(scaled-(1-.45*factor))<.001);
});
test('PvP and local modes load identical budget revisions and the forge UI explains both budgets',()=>{
 const html=fs.readFileSync('index.html','utf8'),
       pvp=fs.readFileSync('pvp-runtime.html','utf8'),
       editor=read('block-forge');
 for(const file of [html,pvp]){
   assert.match(file,/arena-balance\.js\?v=defense-budget3/);
   assert.match(file,/forge-expansion\.js\?v=defense-budget3/);
   assert.match(file,/skill-forge\.js\?v=defense-budget3/);
 }
 assert.match(editor,/회복·보호 밸런스/);
 assert.match(editor,/defenseSummary/);
 assert.match(read('skill-forge'),/defenseFactorOf/);
});
