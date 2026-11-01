'use strict';
/* A real, authored single-signature attempt against the 3000 HP Ancient One.
 * This is HEADLESS, not the full browser/canvas/Pages UI run: the actual Forge
 * skill hit/defense/regen, 100 energy, physical tower bounce, Ancient One's
 * HP phases and six mechanically active seals are simulated. Neither boss
 * HP nor hazard damage is edited during the attempt. No fake winning state.
 */
const test=require('node:test'),assert=require('node:assert/strict'),
fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..','js/features',p+'.js'),'utf8');
function boot(){
 const g={Math,Date,Number,Set,Map,WeakMap,console,players:[],
  CUSTOM_DEFS:[],CHARACTER_PHOTOS:{},BEHAVIORS:{},
  canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},
  getClosestAliveEnemy(p){return g.players.find(e=>e!==p&&e.hp>0)||null;},
  ArenaScreenRouter:{active:'tower'}};
 g.window=g;g.globalThis=g;
 vm.createContext(g);
 const files=['action-registry','forge-archetypes','signature-program','signature-scratch',
 'signature-live','arena-balance','forge-expansion','bounce-momentum','arena-combat-v2',
 'arena-pinball-motion','arena-body-physics','tower-flat-arena',
 'ancient-six-seals','ancient-one','skill-forge'];
 for(const file of files)vm.runInContext(read(file),g,{filename:file+'.js'});
 return g;
}
const action=(type,damage=0,duration=1.2)=>({type,damage,
 radius:type==='wave'?300:130,count:1,speed:6,duration,
 status:'none',target:'nearest',pattern:'direct',link:'after',
 condition:'always',knockback:0,delay:0});
function plan(shield,heal,attack){
 // One user-saveable signature containing up to 12 meaningful action blocks.
 // All numbers are within SkillForge.normalize parameter bounds.
 const actions=[
 ...Array.from({length:shield},()=>action('shield',0,7.4)),
 ...Array.from({length:heal},()=>action('heal',120,1.5)),
 ...Array.from({length:attack},()=>action('wave',120,1.5))
 ].slice(0,12);
 return {name:'천공 반사 수호자',archetype:'legacy',signatureVersion:1,
  signatureTiming:'instant',hp:500,speed:4.6,
  color:'#7acaff',effectColor:'#d7aaff',
  skills:[{name:'성운의 연속 파동',trigger:'auto',cooldown:5,
   actions:actions.map((a,i)=>({...a,link:i===0?'and':'after'}))}]};
}
function attempt(g,build,limit=13500){
 const skill=plan(...build);
 const hId=g.SkillForge.register(skill);
 const bId=g.SkillForge.register({name:'고대의 존재의 팔',hp:500,speed:.6,
  skills:[{name:'촉수의 위협',trigger:'auto',cooldown:99,
   actions:[action('shield',0,.2)]}]},{towerEnemy:true});
 const hd=g.CUSTOM_DEFS.find(d=>d.id===hId),bd=g.CUSTOM_DEFS.find(d=>d.id===bId);
 const hero=hd.createInstance(1),boss=bd.createInstance(2);
 hero.towerHero=true;hero.x=205;hero.y=370;hero.vx=3.1;hero.vy=-2.5;
 boss.towerPatternBoss=true;boss._ancientEnergyOnly=true;boss.towerRealm='space';
 boss.hp=3000;boss.maxHp=3000;boss.forgeLastHp=3000;boss.towerDefense=1;
 boss.x=250;boss.y=90;boss.vx=0;boss.vy=0;
 g.players.splice(0,g.players.length,hero,boss);
 let scene;
 g.ArenaTower={active:true,stage:'fighting',state:{ancient:true,realm:'space',level:10},
  get encounter(){return scene;}};
 const stats={build,startingHp:hero.hp,startingBossHp:boss.hp,
  casts:0,hits:0,hazardHits:0,phase:1,limbHits:0,remaining:boss.hp,heroRemaining:hero.hp};
 const dmg=(victim,amount,z)=>{
  if(victim.hp<=0||victim.invincible>0)return false;
  const hit=g.SkillForge.hit(boss,victim,
   {...action('wave',amount,1.5),radius:0},1,0);
  if(hit)stats.hazardHits++;
  return hit;
 };
 scene=g.ArenaAncientOne.create({width:500,height:500,hero,boss,damage:dmg});
 for(let k=0;k<limit&&hero.hp>0&&boss.hp>0;k++){
  for(const p of [hero,boss]){
   if(p.invincible>0)p.invincible--;
   if(p.movementOnlyFrames>0)p.movementOnlyFrames--;
   if(p.slowTimer>0)p.slowTimer--;
   g.ForgeExpansion.tick(p);
  }
  const before=g.ArenaPinballMotion.begin(hero);
  g.SkillForge.autoUpdate(hero,boss);
  g.SkillForge.autoUpdate(boss,hero);
  g.ArenaPinballMotion.end(hero,before);
  hero.x+=hero.vx||0;hero.y+=hero.vy||0;
  g.ArenaTowerFlat.bounce(hero,'space',500,500,10,k);
  scene.step();
  stats.frames=k+1;stats.phase=Math.max(stats.phase,scene.phase);
 }
 stats.casts=hero._bounceCasts||0;
 stats.limbHits=scene.seals.limbHits;
 stats.remaining=Math.max(0,boss.hp);
 stats.heroRemaining=Math.max(0,hero.hp);
 stats.won=boss.hp<=0&&hero.hp>0;
 stats.skillActions=skill.skills[0].actions.map(a=>a.type+'('+a.damage+')');
 return stats;
}
test('create real custom single-program skill and attempt Ancient One through real HP and six seals',()=>{
 const g=boot();
 const builds=[[2,2,8],[1,3,8],[2,3,7],[1,2,9]];
 const trials=builds.map(b=>attempt(g,b,13500));
 console.log('ANCIENT_REAL_HP_HEADLESS_ATTEMPT '+JSON.stringify(trials));
 for(const result of trials){
  assert.equal(result.startingBossHp,3000);
  assert.ok(Number.isFinite(result.remaining)&&result.remaining>=0);
  assert.ok(result.casts>0,'real signature skill executes');
 }
 assert.ok(trials.some(r=>r.won),
  'No authored skill has yet defeated the complete 3000HP Ancient One simulation; do not claim victory');
});
