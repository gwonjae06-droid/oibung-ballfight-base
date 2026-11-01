'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
function game(){
 const g={console,Math,Map,Set,WeakMap,Date,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(p){return g.players.find(x=>x!==p&&x.hp>0)||null;}};
 g.window=g;g.globalThis=g;
 vm.createContext(g);
 for(const file of ['js/features/action-registry.js','js/features/forge-archetypes.js',
  'js/features/signature-program.js','js/features/signature-scratch.js','js/features/signature-live.js',
  'js/features/arena-pinball-motion.js','js/features/bounce-momentum.js','js/features/forge-expansion.js',
  'js/features/skill-forge.js','js/features/studio-pinball-lab.js']){
  vm.runInContext(read(file),g,{filename:file});
 }
 return g;
}
function character(x=100,signatureVersion=1){
 return {playerNum:x,hp:300,maxHp:300,x,y:120,vx:4,vy:1,radius:24,
  forge:{signatureVersion,speed:3,skills:[{name:'필살기',trigger:'auto',cooldown:3,actions:[{type:'wave',damage:18}]}]},
  forgeHistory:[],forgeExtras:[],forgeEffects:{},forgeShots:[],forgeZones:[],forgeOrbs:[],forgeQueue:[],
  forgeTicks:[0],_forgeActionClock:100,invincible:0};
}
const api=(enemy)=>({enemies:()=>[enemy],hit:()=>true});
test('time acceleration now increases natural/contact/wall momentum not just cooldown ticks',()=>{
 const g=game(),p=character(),enemy=character(320),M=g.BounceMomentum,E=g.ForgeExpansion;
 g.players.push(p,enemy);
 E.execute(p,{type:'timeburst',duration:2},enemy,api(enemy));
 assert.equal(E.active(p,'timeburst'),true);
 const gain=M.meter(p);
 M.tick(p,enemy);
 assert.ok(Math.abs(M.meter(p)-gain-M.PASSIVE*M.TIME_ACCEL)<.001);
 p._forgeActionClock+=40;
 M.wall(p,3);
 assert.ok(M.meter(p)>=M.WALL*M.TIME_ACCEL);
 E.tick(p);
 assert.ok(p.forgeEffects.timeburst.time<120);
});
test('time stop freezes energy recharge only on verified crowd-control application',()=>{
 const g=game(),p=character(),enemy=character(180),M=g.BounceMomentum,E=g.ForgeExpansion;
 g.players.push(p,enemy);
 E.execute(p,{type:'timestop',duration:2,radius:150},enemy,api(enemy));
 assert.equal(E.active(enemy,'freeze'),true);
 assert.equal(E.active(enemy,'momentumStasis'),true);
 const initial=M.meter(enemy);
 M.tick(enemy,p);M.wall(enemy,8);M.contact(enemy,p,-5);
 assert.equal(M.meter(enemy),initial,'no energy while frozen');
 for(let i=0;i<150;i++)E.tick(enemy);
 assert.equal(E.active(enemy,'momentumStasis'),false);
 M.tick(enemy,p);assert.ok(M.meter(enemy)>initial,'normal recharge resumes');
 const protectedEnemy=character(180);protectedEnemy.invincible=10;
 E.execute(p,{type:'timestop',duration:2,radius:150},protectedEnemy,api(protectedEnemy));
 assert.equal(E.active(protectedEnemy,'momentumStasis'),false,'invulnerable targets are not time locked');
});
test('rewind restores heading as well as position while its energy refund is bounded',()=>{
 const g=game(),p=character(),e=character(330),M=g.BounceMomentum,E=g.ForgeExpansion;
 g.players.push(p,e);
 M.add(p,70,'script');
 E.tick(p);
 p.x=330;p.y=360;p.vx=-8;p.vy=5;p.hp=100;
 p._bounceMomentum=0;
 E.execute(p,{type:'rewind',duration:3},e,api(e));
 assert.equal(p.x,100);assert.equal(p.y,120);
 assert.equal(p.vx,4);assert.equal(p.vy,1);
 assert.ok(M.meter(p)>0&&M.meter(p)<=30);
 assert.ok(p.hp>100);
});
test('fear and charm use an initial bounce impulse without per-tick enemy homing',()=>{
 const g=game(),src=character(100),enemy=character(180),E=g.ForgeExpansion;
 g.players.push(src,enemy);
 E.applyStatus(src,enemy,{status:'fear',duration:2});
 assert.notEqual(enemy.vx,4,'status applies one impact impulse');
 const before=[enemy.vx,enemy.vy];
 for(let i=0;i<12;i++)E.tick(enemy);
 assert.deepEqual([enemy.vx,enemy.vy],before,'does not re-steer on each clock tick');
});
test('retreat is a bounded physical speed impulse, never a teleport or extra damage',()=>{
 const g=game(),p=character(100),e=character(180),E=g.ForgeExpansion;
 g.players.push(p,e);
 const pos=[p.x,p.y],hp=e.hp;
 E.execute(p,{type:'retreat',speed:8,radius:300},e,api(e));
 assert.deepEqual([p.x,p.y],pos);
 assert.ok(p.vx<0);
 assert.equal(e.hp,hp);
 assert.ok(p.movementOnlyFrames>=12);
});
test('authored resurrection must first be activated at full energy; legacy remains compatible',()=>{
 const g=game(),E=g.ForgeExpansion,p=character(100),e=character(300);
 g.players.push(p,e);
 p.forge.skills[0].actions=[{type:'resurrect'}];p.hp=0;
 assert.equal(E.revive(p),false);
 p.hp=300;
 E.execute(p,{type:'resurrect'},e,api(e));
 assert.equal(p._forgeRevivePrepared,true);
 p.hp=0;
 assert.equal(E.revive(p),true);
 assert.equal(p._forgeRevivePrepared,false);
 p.hp=0;assert.equal(E.revive(p),false);
 const legacy=character(120,0);legacy.forge.skills[0].actions=[{type:'resurrect'}];legacy.hp=0;
 assert.equal(E.revive(legacy),true,'old four-slot saves keep their legacy behavior');
});
test('advanced projectile collision wall now uses elastic physical reflection, not heading override',()=>{
 const src=read('js/features/advanced-combat.js');
 assert.match(src,/const incoming=\(e\.vx\|\|0\)\*normalX/);
 assert.match(src,/ArenaBallSquash\?\.wall/);
 assert.match(src,/BounceMomentum\?\.wall/);
 assert.ok(!src.includes('e.vx=normalX*Math.max(1,Math.abs(e.vx))'));
});
test('all action types remain present, easy mode exposes time/physical actions and lab mirrors them',()=>{
 const g=game();
 assert.equal(g.ActionRegistry.ids().length,55);
 const easy=read('js/features/scratch-beginner.js'),lab=read('js/features/studio-pinball-lab.js');
 for(const type of ['timestop','timeburst','rewind','pull','wall','homing','splitshot'])
  assert.ok(easy.includes("id:'"+type+"'"),type);
 for(const type of ["type==='timestop'","type==='timeburst'","type==='rewind'"])
  assert.ok(lab.includes(type),type);
 assert.match(lab,/energy\+\.29\*boost/);
});
