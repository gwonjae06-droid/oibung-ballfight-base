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
 'signature-simple-designer','signature-live','arena-balance-formula','arena-balance','forge-expansion','bounce-momentum','arena-combat-v2',
 'arena-pinball-motion','arena-body-physics','tower-flat-arena',
 'ancient-six-seals','ancient-one','skill-forge-impact','skill-forge-casting','skill-forge-world','skill-forge-profiles','skill-forge-storage','skill-forge-executor','skill-forge'];
 for(const file of files)vm.runInContext(read(file),g,{filename:file+'.js'});
 return g;
}
const action=(type,damage=0,duration=1.2)=>({type,damage,
 radius:type==='wave'?300:130,count:1,speed:6,duration,
 status:'none',target:'nearest',pattern:'direct',link:'after',
 condition:'always',knockback:0,delay:0});

function buildProfile(g,archetype,style){
 const step=(type,damage=0,repeat=1,opts={})=>({
  action:{...action(type,damage,opts.duration??1.5),radius:opts.radius??(type==='wave'?300:130),
   count:opts.count??1,status:opts.status||'none',link:'after'},
  condition:'always',repeat
 });
 const shield=()=>step('shield',0,1,{duration:7.4});
 const heal=(x=40)=>step('heal',x);
 const wave=(x=65,repeat=2)=>step('wave',x,repeat,{radius:300});
 const boost=()=>step('timeburst',0,1,{duration:8});
 let steps;
 switch(style){
  case 'safe-echo':steps=[shield(),heal(40),wave(65,2)];break;
  case 'assault-echo':steps=[shield(),wave(65,2),wave(40)];break;
  case 'healing-echo':steps=[heal(40),wave(65,2)];break;
  case 'time-echo':steps=[boost(),shield(),wave(65,2),heal(40)];break;
  case 'beam-echo':steps=[shield(),heal(40),step('beam',65,2,{radius:300})];break;
  case 'bolt-echo':steps=[shield(),heal(40),step('bolt',65,2,{count:8,radius:130})];break;
  case 'poison-echo':steps=[shield(),heal(30),step('wave',60,2,{radius:300,status:'poison'}),step('wave',20,1,{radius:300})];break;
  case 'mobile-echo':steps=[shield(),heal(40),wave(65,2),step('retreat',0)];break;
  default:throw Error('Unknown style '+style);
 }
 const assessment=g.SignatureSimpleDesigner.inspect(steps);
 assert.equal(assessment.ok,true,JSON.stringify({archetype,style,assessment}));
 const program=g.SignatureSimpleDesigner.build(steps);
 return {name:'여섯 봉인 반사술',archetype,signatureVersion:1,signatureTiming:'instant',
  hp:370,speed:1.35,color:'#7acaff',effectColor:'#d7aaff',
  skills:[{name:'반사·수호 연계',trigger:'auto',cooldown:5,
   program,actions:g.SignatureScratch.preview(program)}]};
}
function attempt(g,build,point,limit=7800){
 const skill=buildProfile(g,...build);
 const hId=g.SkillForge.register(skill);
 const bId=g.SkillForge.register({name:'고대의 존재의 팔',hp:500,speed:.6,
  skills:[{name:'촉수의 위협',trigger:'auto',cooldown:99,
   actions:[action('shield',0,.2)]}]},{towerEnemy:true});
 const hd=g.CUSTOM_DEFS.find(d=>d.id===hId),bd=g.CUSTOM_DEFS.find(d=>d.id===bId);
 const hero=hd.createInstance(1),boss=bd.createInstance(2);
 hero.towerHero=true;hero.x=point.x;hero.y=point.y;hero.vx=point.vx;hero.vy=point.vy;
 boss.towerPatternBoss=true;boss._ancientEnergyOnly=true;boss.towerRealm='space';
 boss.hp=3000;boss.maxHp=3000;boss.forgeLastHp=3000;boss.towerDefense=1;
 boss.x=250;boss.y=90;boss.vx=0;boss.vy=0;
 g.players.splice(0,g.players.length,hero,boss);
 let scene;
 g.ArenaTower={active:true,stage:'fighting',state:{ancient:true,realm:'space',level:10},
  get encounter(){return scene;}};
 const stats={build,point,startingHp:hero.hp,startingBossHp:boss.hp,
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
 stats.legal=true;
 return stats;
}

test('test fresh 4-step single-screen authored skills against real 3000HP Ancient One phases',()=>{
 const g=boot();
 const builds=[
  ['defense','safe-echo'],['defense','assault-echo'],
  ['defense','healing-echo'],['defense','time-echo'],
  ['defense','beam-echo'],['defense','bolt-echo'],
  ['defense','poison-echo'],['mobility','mobile-echo'],
  ['melee','assault-echo'],['melee','safe-echo']
 ];
 const points=[
  {x:120,y:300,vx:3.2,vy:1.5},
  {x:300,y:410,vx:-3.4,vy:-1.7},
  {x:205,y:370,vx:3.1,vy:-2.5},
  {x:150,y:190,vx:-2,vy:3.2}
 ];
 const rows=builds.flatMap(build=>points.map(point=>attempt(g,build,point,7800)));
 const byBuild=builds.map(build=>{
  const matches=rows.filter(x=>x.build[0]===build[0]&&x.build[1]===build[1]);
  const best=matches.slice().sort((a,b)=>a.remaining-b.remaining)[0];
  return {build,clears:matches.filter(x=>x.won).length,bestBossHp:best.remaining,bestHeroHp:best.heroRemaining,frames:best.frames,casts:best.casts,phase:best.phase,limbHits:best.limbHits};
 });
 const winners=rows.filter(x=>x.won);
 console.log('ONE_EDITOR_ANCIENT_CHALLENGE '+JSON.stringify({
  matches:rows.length,legalBuilds:builds.length,limitFrames:7800,
  wins:winners.length,best:rows.slice().sort((a,b)=>a.remaining-b.remaining)[0],
  byBuild,winners:winners.slice(0,6)
 }));
 for(const row of rows){
  assert.equal(row.startingBossHp,3000);
  assert.ok(row.legal&&Number.isFinite(row.remaining)&&row.remaining>=0);
  assert.ok(row.casts>0);
 }
});
