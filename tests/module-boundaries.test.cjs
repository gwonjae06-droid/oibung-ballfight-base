'use strict';
/* Update safety net: run in CI whenever another skill, tower or arena module is added. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const pages=['index.html','pvp-runtime.html'];
const scripts=html=>[...html.matchAll(/<script\s+[^>]*src="([^"]+)"/g)].map(m=>m[1]);
const local=url=>!/^https?:\/\//.test(url)&&!url.startsWith('//');
const file=url=>url.split('?')[0].split('#')[0];
function entries(name){return scripts(read(name)).filter(local);}
test('every locally loaded JavaScript file exists and no page runs the same script twice',()=>{
 for(const page of pages){
  const paths=entries(page).map(file);
  assert.equal(new Set(paths).size,paths.length,page+' contains a duplicate script');
  for(const name of paths)assert.ok(fs.existsSync(name),page+' missing '+name);
 }
});
test('pure budget formulas precede mutable resource budgets and SkillForge in every runtime',()=>{
 for(const page of pages){
  const paths=entries(page).map(file);
  const formula=paths.indexOf('js/features/arena-balance-formula.js');
  const runtime=paths.indexOf('js/features/arena-balance.js');
  const forge=paths.indexOf('js/features/skill-forge.js');
  assert.ok(formula>=0&&runtime>formula&&forge>runtime,page+' missing/out-of-order balance modules');
 }
});
test('Forge impact, casting and world authorities load before the runtime in both entries',()=>{
 for(const page of pages){
  const paths=entries(page).map(file);
  const hit=paths.indexOf('js/features/skill-forge-impact.js');
  const queue=paths.indexOf('js/features/skill-forge-casting.js');
  const world=paths.indexOf('js/features/skill-forge-world.js');
  const core=paths.indexOf('js/features/skill-forge.js');
  assert.ok(hit>=0&&queue>=0&&world>=0&&core>hit&&core>queue&&core>world,page+' needs hit, queue and world before runtime');
 }
 const core=read('js/features/skill-forge.js');
 const hit=read('js/features/skill-forge-impact.js');
 const queue=read('js/features/skill-forge-casting.js');
 const world=read('js/features/skill-forge-world.js');
 assert.ok(!core.includes('function hit(p,e,action,multiplier=1,attackZ)'));
 assert.ok(!core.includes('function tickQueue(p,target)'));
 assert.ok(!core.includes('for(let i=p.forgeShots.length-1;i>=0;i--)'));
 assert.ok(world.includes('for(let i=p.forgeShots.length-1;i>=0;i--)'));
 assert.ok(core.includes('world.tick(p,target);'));
 assert.ok(core.includes('global.SkillForgeWorldFactory({hit,hitGround,enemies})'));
 assert.ok(hit.includes('function hit(p,e,action,multiplier=1,attackZ)'));
 assert.ok(queue.includes('function tickQueue(p,target)'));
 assert.ok(core.includes("const {hit,hitGround,groundImpactZ}=global.SkillForgeImpactFactory({MOVEMENT_ONLY});"));
});
test('the same JavaScript modules use identical versions across PvE and PvP',()=>{
 const local=new Map(entries('index.html').map(url=>[file(url),url]));
 for(const url of entries('pvp-runtime.html')){
  const path=file(url);
  if(!local.has(path))continue;
  assert.equal(url,local.get(path),'two runtimes must not cache different revisions: '+path);
 }
});
test('ArenaBalance stable public API and authored profiles stay compatible across refactoring',()=>{
 const world={Math,Number,Set,Map,console};world.window=world;world.globalThis=world;
 vm.createContext(world);
 assert.throws(()=>vm.runInContext(read('js/features/arena-balance.js'),world),
  /arena-balance-formula\.js/,'wrong load order must fail explicitly');
 vm.runInContext(read('js/features/arena-balance-formula.js'),world);
 vm.runInContext(read('js/features/arena-balance.js'),world);
 const a=world.ArenaBalance;
 for(const name of ['summary','skillPressure','actionPressure','factorOf','defenseSummary',
  'defenseSkillPressure','defenseFactorOf','tickShield','shieldWindow','shieldCapacity',
  'tickHealing','healingWindow','healingCapacity'])
  assert.equal(typeof a[name],'function','existing ArenaBalance.'+name+' API retained');
 assert.equal(a.POWER_BUDGET,65);
 assert.equal(a.DEFENSE_BUDGET,90);
 const profile={hp:300,signatureVersion:1,skills:[{cooldown:5,actions:[
  {type:'wave',damage:40,radius:120,count:1,duration:1.5,status:'none'}]}]};
 const before=JSON.stringify(profile),power=a.summary(profile),defense=a.defenseSummary(profile);
 assert.equal(JSON.stringify(profile),before,'budget calculations cannot mutate saved authored skills');
 assert.ok(Number.isFinite(power.multiplier)&&Number.isFinite(defense.multiplier));
 const player={maxHp:300,hp:300,forge:profile,playerNum:1};
 const other={maxHp:300,hp:300,forge:profile,playerNum:2};
 a.shieldWindow(player,150);a.tickShield(other);
 assert.ok(other._forgeShieldEnergy>player._forgeShieldEnergy,
  'shield energy is independently stored per fighter, not shared on the model');
});
