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
 const files=['action-registry','forge-archetypes','signature-program','signature-scratch','signature-simple-designer',
  'signature-live','arena-balance-formula','arena-balance','forge-expansion','bounce-momentum',
  'arena-pinball-motion','arena-body-physics','tower-flat-arena','tower-realms',
  'tower-world-mechanics','tower-encounters','tower-environment','skill-forge-impact','skill-forge-casting','skill-forge-world','skill-forge-profiles','skill-forge-storage','skill-forge-executor','skill-forge'];
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
 const raw=g.ArenaTowerRealms.enemyLoadout(realm,floor);
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

function singleSkill(g,name,archetype){
 const S=g.SignatureSimpleDesigner;
 const step=(type,damage=0,repeat=1,radius=120)=>({
  action:g.SignatureScratch.safeAction({type,damage,radius,speed:5,
   duration:type==='shield'?1.4:1.5,status:'none',link:'after'}),
  condition:'always',repeat
 });
 const steps=name==='assault'?
  [step('shield'),step('wave',65,2,240),step('wave',40,1,240)]:
  name==='safe'?
  [step('shield'),step('heal',40),step('wave',65,2,240)]:
  [step('heal',40),step('wave',65,2,240)];
 const report=S.inspect(steps);assert.equal(report.ok,true);
 const program=S.build(steps);
 return {name:'여섯 봉인 반사술 '+name,archetype,signatureVersion:1,
  signatureTiming:'instant',skills:[{name:'필살기',trigger:'auto',
   cooldown:5,program,actions:g.SignatureScratch.preview(program)}]};
}
test('try legal one-screen signature builds against sixty six-tower floor scenarios',()=>{
 const g=boot(),variants=[['melee','assault'],['defense','safe'],['defense','heal']];
 const results=[];
 for(const [archetype,style] of variants){
  const id=g.SkillForge.register(singleSkill(g,style,archetype));
  const hero=g.CUSTOM_DEFS.find(x=>x.id===id);
  for(const realm of REALMS)for(let floor=1;floor<=10;floor++){
   const enemyId=g.SkillForge.register(enemyDefinition(g,realm,floor),{towerEnemy:true});
   const foe=g.CUSTOM_DEFS.find(x=>x.id===enemyId);
   const out=run(g,hero,foe,realm,floor,2,105*60);
   results.push({archetype,style,realm,floor,outcome:out.outcome,remaining:out.score.opponentHp,
    heroHp:out.score.heroHp,casts:out.score.casts,seconds:Number((out.frames/60).toFixed(1))});
   assert.ok(Number.isFinite(out.score.opponentHp));
  }
 }
 const perBuild=variants.map(([archetype,style])=>{
  const s=results.filter(x=>x.archetype===archetype&&x.style===style);
  return {archetype,style,clears:s.filter(x=>x.outcome==='win').length,
   losses:s.filter(x=>x.outcome==='loss').length,timeouts:s.filter(x=>x.outcome==='time').length,
   clearByRealm:Object.fromEntries(REALMS.map(realm=>[realm,s.filter(x=>x.realm===realm&&x.outcome==='win').length])),
   bossFights:s.filter(x=>x.floor===5||x.floor===10).map(x=>({realm:x.realm,floor:x.floor,outcome:x.outcome,remaining:x.remaining}))};
 });
 console.log('ONE_EDITOR_SIX_TOWER_TRIAL '+JSON.stringify({
  scenarios:results.length,perBuild,
  sample:results.filter(x=>x.style==='assault'&&x.archetype==='melee').map(x=>({
   realm:x.realm,floor:x.floor,outcome:x.outcome,remaining:x.remaining,seconds:x.seconds
  }))
 }));
 assert.equal(results.length,180);
});
