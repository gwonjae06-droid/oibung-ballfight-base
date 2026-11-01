'use strict';
/* Deterministic tower duel laboratory. The actual SkillForge, bounce momentum,
 * on-hit defense/CC, authoring templates, tower encounter hazards, flat
 * collision and regen/shield resources are executed in a VM. Headless limits:
 * no render loop, no AdvancedCombat multi-object projectiles, no cinematic
 * boss spectacle or live browser scheduling. Therefore these are preliminary
 * capped-duration combat observations, NEVER real browser clear-rate claims.
 */
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const REALMS=['time','space','fire','storm','ice','forest'],
 BUILDS=['balanced','assault','guardian','control','agile'];
const SEEDS=5,FRAME_LIMIT=1800,TOTAL=REALMS.length*BUILDS.length*10*SEEDS;
function boot(){
 const g={Math,Date,Number,Set,Map,WeakMap,console,players:[],
  CUSTOM_DEFS:[],CHARACTER_PHOTOS:{},BEHAVIORS:{},canvas:{width:500,height:500},
  createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(p){
   return g.players.find(e=>e!==p&&e.hp>0)||null;},
  document:{querySelector(){return null;},getElementById(){return null;}}};
 g.window=g;g.globalThis=g;
 vm.createContext(g);
 const files=['action-registry','forge-archetypes','signature-program','signature-scratch',
  'signature-live','arena-balance','forge-expansion','bounce-momentum',
  'arena-pinball-motion','arena-body-physics','tower-flat-arena','tower-realms',
  'tower-world-mechanics','tower-encounters','tower-environment','skill-forge'];
 for(const f of files)vm.runInContext(read('js/features/'+f+'.js'),g,{filename:f+'.js'});
 g.BlockForge={};vm.runInContext(read('js/features/studio-easy-designer.js'),g);
 return g;
}
function playerDefinition(g,name){
 const plan=g.StudioEasyDesigner.PLANS[name];
 const archetype={balanced:'melee',assault:'melee',guardian:'defense',
  control:'control',agile:'mobility'}[name];
 const actions=plan.skills.map(([label,type,damage],i)=>({
  type,damage,radius:type==='wave'?125:145,count:1,speed:6,
  duration:type==='shield'?1.8:type==='zone'?3:1.7,
  status:type==='zone'?'poison':type==='mine'?'ice':type==='wave'&&name==='control'?'ice':'none',
  target:'nearest',pattern:'direct',link:i===0?'and':'after',condition:'always',knockback:2
 }));
 return {name,archetype,signatureVersion:1,
  skills:[{name:name+' 고유기',trigger:'auto',cooldown:4.5,actions}]};
}
function enemyDefinition(g,realm,floor){
 const f=g.ArenaTowerRealms.floor({number:floor,boss:floor%5===0},realm);
 const raw=f.boss?[['보스 방어막','shield']]:g.ArenaTowerRealms.enemyLoadout(realm,floor);
 const skills=raw.map(([label,type],i)=>({
  name:label,trigger:'auto',cooldown:Math.max(.45,f.cooldown+i*.17),
  actions:[{type,damage:['shield','fortify','haste','timeburst','timestop','rewind','dash'].includes(type)?
    0:Math.round(f.damage*(i===0?1:.7)),radius:112,speed:5,
    duration:type==='shield'?.45:1.7,count:1,
    status:realm==='fire'?'fire':realm==='ice'?'ice':realm==='forest'?'poison':'none',
    knockback:2}]
 }));
 return {name:f.name,hp:f.hp,speed:f.speed,skills};
}
function run(g,heroDef,enemyDef,realm,floor,seed,frameLimit=FRAME_LIMIT){
 const f=g.ArenaTowerRealms.floor({number:floor,boss:floor%5===0},realm);
 const h=heroDef.createInstance(1),e=enemyDef.createInstance(2),score={casts:0,hits:0,
  damageDealt:0,damageTaken:0,healed:0,heroHp:h.hp,opponentHp:e.hp,events:0};
 h.x=157+(seed-2)*11;h.y=250+(seed-2)*13;
 e.x=343-(seed-2)*11;e.y=250+(seed-2)*17;
 h.vx=2.9+seed*.12;h.vy=1.1+seed*.15;
 e.vx=-2.4-seed*.14;e.vy=1.5-seed*.1;
 h.towerHero=true;e.towerEnemy=true;e.towerPatternBoss=f.boss;
 h._bounceMomentum=0;e._bounceMomentum=0;
 e.towerDefense=f.towerDefense;
 e._bossMomentumPhase='pattern';
 e._bossEnergyCursor=0;
 e._minionEnergyCursor=0;
 const roster=g.players;roster.splice(0,roster.length,h,e);
 g.ArenaTower={active:true,state:{realm,level:floor,ancient:false}};
 const hurt=(p,amount,z)=>{
  const attacker=p===h?e:h;
  if(p.invincible>0||p.hp<=0)return false;
  const applied=g.SkillForge.hit(attacker,p,{type:'wave',damage:amount,radius:0,
    status:'none',knockback:0,duration:1},1,0);
  if(applied)score.events++;
  return applied;
 };
 const enc=g.ArenaEncounter.create({realm,level:floor,width:500,height:500,
   hero:h,boss:e,damage:hurt,environmentManaged:true});
 const env=g.ArenaTowerEnvironment.create({realm,level:floor,width:500,height:500,
   roster:[h,e],damage:hurt});
 let elapsed=0,previousHero=h.hp,previousEnemy=e.hp;
 for(let t=0;t<frameLimit;t++){
  for(const p of [h,e]){
   if(p.invincible>0)p.invincible--;
   if(p.movementOnlyFrames>0)p.movementOnlyFrames--;
   if(p.slowTimer>0)p.slowTimer--;
   g.ForgeExpansion.tick(p);
  }
  const starts=[h,e].map(p=>g.ArenaPinballMotion.begin(p));
  if(h.hp>0&&e.hp>0){
   g.SkillForge.autoUpdate(h,e);g.SkillForge.autoUpdate(e,h);
   g.ArenaPinballMotion.end(h,starts[0]);g.ArenaPinballMotion.end(e,starts[1]);
   for(const p of [h,e]){p.x+=(p.vx||0);p.y+=(p.vy||0);
     g.ArenaTowerFlat.bounce(p,realm,500,500,floor,t);
   }
   const dx=e.x-h.x,dy=e.y-h.y,d=Math.hypot(dx,dy)||1,limit=h.radius+e.radius;
   if(d<limit){
    const nx=dx/d,ny=dy/d,overlap=(limit-d)/2;
    h.x-=overlap*nx;h.y-=overlap*ny;e.x+=overlap*nx;e.y+=overlap*ny;
    const approach=(e.vx-h.vx)*nx+(e.vy-h.vy)*ny;
    const impact=g.ArenaBodyPhysics.pair(h,e,nx,ny);
    if(impact)g.BounceMomentum.contact(h,e,approach);
   }
   enc.step();env.step();
  }
  score.damageDealt+=Math.max(0,previousEnemy-e.hp);
  score.damageTaken+=Math.max(0,previousHero-h.hp);
  score.healed+=Math.max(0,h.hp-previousHero);
  previousHero=h.hp;previousEnemy=e.hp;
  elapsed=t+1;
  if(h.hp<=0||e.hp<=0)break;
 }
 score.casts=h._bounceCasts||0;score.enemyCasts=e._bounceCasts||0;
 score.heroHp=h.hp;score.opponentHp=e.hp;
 return {outcome:h.hp<=0&&e.hp<=0?'draw':e.hp<=0?'win':h.hp<=0?'loss':'time',frames:elapsed,score};
}
test('1500 seeded headless real-module tower duels provide reproducible balance telemetry, not fictitious win rates',()=>{
 const g=boot(),defs=new Map(),players=new Map(),results=[];
 for(const build of BUILDS){
  const id=g.SkillForge.register(playerDefinition(g,build));
  players.set(build,g.CUSTOM_DEFS.find(x=>x.id===id));
 }
 for(const realm of REALMS)for(let floor=1;floor<=10;floor++){
  const id=g.SkillForge.register(enemyDefinition(g,realm,floor),{towerEnemy:true});
  defs.set(realm+floor,g.CUSTOM_DEFS.find(x=>x.id===id));
 }
 for(const build of BUILDS)for(const realm of REALMS)for(let floor=1;floor<=10;floor++){
  for(let seed=0;seed<SEEDS;seed++){
   const out=run(g,players.get(build),defs.get(realm+floor),realm,floor,seed);
   assert.ok(Number.isFinite(out.score.heroHp)&&Number.isFinite(out.score.opponentHp));
   assert.ok(out.frames>=1&&out.frames<=FRAME_LIMIT);
   results.push({build,realm,floor,...out});
  }
 }
 assert.equal(results.length,TOTAL);
 const stats={matches:TOTAL,seedCount:SEEDS,maxFrames:FRAME_LIMIT,headsUpSeconds:FRAME_LIMIT/60,
  byBuild:{},byRealm:{},perFloor:{}};
 for(const build of BUILDS){
  const rows=results.filter(r=>r.build===build);
  stats.byBuild[build]={wins:rows.filter(r=>r.outcome==='win').length,
   losses:rows.filter(r=>r.outcome==='loss').length,
   timeouts:rows.filter(r=>r.outcome==='time').length,
   avgCasts:Number((rows.reduce((v,r)=>v+r.score.casts,0)/rows.length).toFixed(2))};
 }
 for(const realm of REALMS){
  const rows=results.filter(r=>r.realm===realm);
  stats.byRealm[realm]={wins:rows.filter(r=>r.outcome==='win').length,
   losses:rows.filter(r=>r.outcome==='loss').length,
   timeouts:rows.filter(r=>r.outcome==='time').length};
 }
 for(const floor of [1,3,5,6,9,10]){
  const rows=results.filter(r=>r.floor===floor);
  stats.perFloor[floor]={wins:rows.filter(r=>r.outcome==='win').length,
   losses:rows.filter(r=>r.outcome==='loss').length,
   timeouts:rows.filter(r=>r.outcome==='time').length};
 }
 console.log('BALANCE_LAB_V1_HEADLESS_ONLY '+JSON.stringify(stats));
 // Protect test against a false pass that accidentally never executes combat.
 assert.ok(results.some(r=>r.score.casts>0),'real hero momentum must cast a skill');
 assert.ok(results.some(r=>r.score.events>0),'arena hazards must actually use hit adapter');
 assert.ok(results.some(r=>r.score.damageDealt>0),'real SkillForge hits must deal enemy damage');
});

test('120 longer 105-second 5F/10F seeded boss previews expose real finishing power instead of only 30s wins',()=>{
 const g=boot(),heroes={},enemy={};
 for(const build of BUILDS){
  const id=g.SkillForge.register(playerDefinition(g,build));
  heroes[build]=g.CUSTOM_DEFS.find(x=>x.id===id);
 }
 for(const realm of REALMS)for(const floor of [5,10]){
  const id=g.SkillForge.register(enemyDefinition(g,realm,floor),{towerEnemy:true});
  enemy[realm+floor]=g.CUSTOM_DEFS.find(x=>x.id===id);
 }
 const rows={};
 let n=0,won=0,defeated=0,exceeded=0;
 for(const build of BUILDS){
  rows[build]={};
  for(const realm of REALMS)for(const floor of [5,10]){
   const tag=realm+'-'+floor,record={win:0,loss:0,time:0};
   for(let seed=0;seed<2;seed++){
    const r=run(g,heroes[build],enemy[realm+floor],realm,floor,seed,105*60);
    record[r.outcome]++;n++;won+=r.outcome==='win';
    defeated+=r.outcome==='loss';exceeded+=r.outcome==='time';
    assert.ok(Number.isFinite(r.score.heroHp)&&Number.isFinite(r.score.opponentHp));
   }
   rows[build][tag]=record;
  }
 }
 assert.equal(n,120);
 console.log('BALANCE_LAB_BOSS_105S_HEADLESS_ONLY '+
  JSON.stringify({matches:n,wins:won,losses:defeated,timeouts:exceeded,
   samplesPerBuildRealmFloor:2,includeCinematicBossSpectacles:false,rows}));
});
