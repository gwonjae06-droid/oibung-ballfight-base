'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=(f)=>fs.readFileSync('js/features/'+f+'.js','utf8');
function sim(){
 const world={Math,Number,Set,Map,players:[],console,addFloatingText(){},createHitParticles(){}};
 world.window=world;world.globalThis=world;
 vm.createContext(world);for(const file of ['arena-balance','forge-expansion','forge-combo-vfx'])vm.runInContext(code(file),world);
 return world;
}
const spell=(type='wave',extra={})=>({type,damage:60,duration:1,radius:120,count:1,status:'none',...extra});
const skill=(action,cd=.2,extra={})=>({name:'반복 마법',trigger:'auto',cooldown:cd,actions:[action],...extra});
const profile=(...skills)=>({name:'커스텀',hp:400,skills});
const fighter=(forge)=>({playerNum:1,x:90,y:120,hp:400,maxHp:400,invincible:0,forge,forgeEffects:{},vx:0,vy:0});

test('real 0.2s cadence is accounted for instead of the old 0.35s budget shortcut',()=>{
 const w=sim(),A=w.ArenaBalance,s=.2,fast=skill(spell(),s);
 assert.equal(A.skillPressure(fast),300);
 assert.equal(A.skillPressure(skill(spell(),1)),60);
 assert.ok(A.summary(profile(fast)).multiplier<A.summary(profile(skill(spell(),1))).multiplier);
});
test('timeburst is costed against the same loadout and conditional nearly-always triggers lose their discount',()=>{
 const w=sim(),A=w.ArenaBalance,gun=skill(spell(),1),boost=skill(spell('timeburst',{damage:0,duration:5}),.5);
 const plain=profile(gun),accelerated=profile(gun,boost);
 const original=JSON.stringify(accelerated);
 assert.ok(A.summary(accelerated).pressure>A.summary(plain).pressure*1.9);
 assert.equal(JSON.stringify(accelerated),original,'the balance pass never rewrites any authored skill');
 assert.ok(A.skillPressure(skill(spell(),1,{trigger:'lowhp',threshold:95})) >
   A.skillPressure(skill(spell(),1,{trigger:'lowhp',threshold:40})));
});
test('non-damaging walls no longer distort offensive damage budgets',()=>{
 const w=sim(),A=w.ArenaBalance,attack=skill(spell(),1),wall=skill(spell('wall',{damage:120,duration:8}),.2);
 assert.equal(A.actionPressure(wall.actions[0]),0);
 assert.equal(A.summary(profile(attack,wall)).pressure,A.summary(profile(attack)).pressure);
});
test('repeat hard crowd control has bounded duration and recovery even if spammed every 0.2s',()=>{
 const w=sim(),target=fighter(profile()),source=fighter(profile()),X=w.ForgeExpansion;w.players.push(source,target);
 X.applyStatus(source,target,{status:'freeze',duration:8});
 assert.equal(target.forgeEffects.freeze.time,84);
 let disabled=0,recovered=0;
 for(let frame=0;frame<360;frame++){
  X.tick(target);
  if(frame%12===0)X.applyStatus(source,target,{status:frame%24===0?'stun':'freeze',duration:8});
  if(X.blocked(target))disabled++;else recovered++;
 }
 assert.ok(recovered>=100,'the victim receives substantial actionable recovery time');
 assert.ok(disabled>0,'crowd control still works');
});
test('shared shield energy prevents four repeating shields from maintaining permanent immunity',()=>{
 const w=sim(),s=skill(spell('shield',{damage:0,duration:8}),.2),p=fighter(profile(s,s,s,s)),A=w.ArenaBalance;
 const capacity=A.shieldCapacity(p);assert.equal(capacity,48);
 let protectedFrames=0;
 for(let frame=0;frame<1200;frame++){
  A.tickShield(p);if(p.invincible>0)p.invincible--;
  if(frame%12===0){
   for(let j=0;j<4;j++)p.invincible=A.shieldWindow(p,480);
  }
  if(p.invincible>0)protectedFrames++;
 }
 assert.ok(protectedFrames<1100,'continuous 100% uptime is no longer possible');
 assert.ok(protectedFrames>500,'defensive play remains meaningful');
 const boss=fighter(profile(s));boss.towerEnemy=true;
 assert.equal(A.shieldWindow(boss,480),480,'the dedicated Tower boss patterns remain intact');
});
test('refreshing regen every 12 frames does not postpone 30-frame healing ticks',()=>{
 const w=sim(),p=fighter(profile()),X=w.ForgeExpansion;p.hp=100;w.players.push(p);
 for(let t=0;t<120;t++){
  if(t%12===0)X.execute(p,{type:'regen',duration:2,damage:80},null,{enemies:()=>[]});
  X.tick(p);
 }
 assert.equal(p.hp,180,'four 20HP periodic heals at frames 30,60,90,120');
});
test('poison timer extension does not reset its own periodic damage clock',()=>{
 const w=sim(),p=fighter(profile()),X=w.ForgeExpansion;p.hp=300;p.bfDotDamage=5;w.players.push(p);
 for(let t=0;t<120;t++){
  if(t%12===0)p.bfDot=Math.max(p.bfDot||0,120);
  X.tick(p);
 }
 assert.equal(p.hp,280,'four poison damage ticks occur despite frequent reapplications');
});
test('pure 0.1s visual pulses have no combat state and respect reduced effects',()=>{
 const w=sim(),p=fighter(profile(skill(spell(),.2))),FX=w.ForgeComboFX;
 for(let i=0;i<10;i++)assert.equal(FX.pulse(p,spell('bolt'),0),true);
 assert.equal(FX.active,10);assert.equal(p.hp,400);
 assert.equal(p.invincible,0);assert.equal(p.forgeEffects.freeze,undefined);
 FX.setReduced(true);assert.equal(FX.pulse(p,spell('bolt')),false);
 FX.clear();assert.equal(FX.active,0);
});
test('local and PvP scripts use the exact same latest auto balance, and the periodic visuals are loaded after skill visuals',()=>{
 for(const file of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(file,'utf8');
  for(const name of ['skill-forge','arena-balance','forge-expansion','forge-combo-vfx'])
   assert.ok(html.includes(name+'.js?v=periodic-balance1'),`${file} ${name} cache version`);
  assert.ok(html.indexOf('skill-visuals.js')<html.indexOf('forge-combo-vfx.js'));
 }
 const src=code('skill-forge');assert.match(src,/forgeVisualFrame.*\+1/);
 assert.match(src,/ForgeComboFX\?\.pulse/);
});

test('a real rapid periodic fighter emits 10 ornamental pulses per simulated second, without 10 damaging casts',()=>{
 const w=sim();
 Object.assign(w,{CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:500,height:500},getClosestAliveEnemy(p){return w.players.find(e=>e!==p&&e.hp>0)||null;},
  document:{querySelector(){return null;}}});
 vm.runInContext(code('skill-forge'),w);
 const id=w.SkillForge.register(profile(skill(spell('wave',{damage:0,radius:30}),.2)));
 const hero=w.CUSTOM_DEFS[0].createInstance(1),target={playerNum:2,hp:400,maxHp:400,x:450,y:450,radius:24};
 hero.x=100;hero.y=100;w.players=[hero,target];
 let pulses=0;const original=w.ForgeComboFX.pulse;
 w.ForgeComboFX.pulse=function(...args){pulses++;return original(...args);};
 for(let frame=0;frame<60;frame++)w.BEHAVIORS[id].update(hero,target);
 assert.equal(pulses,10);
 assert.ok(hero.forgeSerial<=6,'no extra combat casts were caused by 0.1s visual pulses');
 assert.equal(target.hp,400);
});

test('sustained healing has a shared pool, regardless of whether it comes from flowers or direct heals',()=>{
 const w=sim(),A=w.ArenaBalance,s=skill(spell('heal',{damage:120}),.2),p=fighter(profile(s,s));
 p.maxHp=500;
 const capacity=A.healingCapacity(p);assert.equal(capacity,200);
 const big=A.healingWindow(p,120);assert.equal(big,120);
 const second=A.healingWindow(p,120);assert.equal(second,80);
 assert.equal(A.healingWindow(p,120),0);
 let total=200;
 for(let t=0;t<600;t++){
  A.tickHealing(p);
  if(t%12===0)total+=A.healingWindow(p,120);
 }
 assert.ok(total<1500,'overlapping repeat heals must share an effective per-second budget');
 assert.ok(total>1000,'the recovery build must retain meaningful sustained healing');
});
test('timeburst contributes to the defense budget as well as offensive pressure',()=>{
 const w=sim(),A=w.ArenaBalance,
   normal=profile(skill(spell('heal',{damage:50}),1)),
   boosted=profile(skill(spell('heal',{damage:50}),1),skill(spell('timeburst',{damage:0,duration:6}),.6));
 assert.ok(A.defenseSummary(boosted).pressure>A.defenseSummary(normal).pressure*1.9);
});
