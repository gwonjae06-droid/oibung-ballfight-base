'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function battleWorld(){
 const g={console,Math,Date,Set,Map,WeakMap,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
 createHitParticles(){},addFloatingText(){},canvas:{width:500,height:500}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['js/features/action-registry.js','js/features/forge-archetypes.js','js/features/basic-attacks.js',
  'js/features/signature-program.js','js/features/signature-scratch.js','js/features/signature-live.js',
  'js/features/bounce-momentum.js','js/features/arena-balance.js','js/features/skill-forge.js'])
  vm.runInContext(read(file),g,{filename:file});
 return g;
}
const payload=(trigger)=>({name:'핀볼 캐릭터',signatureVersion:1,archetype:'melee',skills:[{
 name:'메가 충격파',trigger,cooldown:.2,actions:[{type:'wave',damage:25,radius:170}],
 program:[{kind:'action',action:{type:'wave',damage:25,radius:170}}]}]});
const target=()=>({hp:1000,maxHp:1000,playerNum:2,x:430,y:420,vx:0,vy:0,radius:24});
test('modern profiles normalize any old external trigger to one momentum-only trigger',()=>{
 const g=battleWorld();
 for(const condition of ['danger','dodge','contactEnergy','wallEnergy','basicHit','lowhp','damaged']){
  const p=g.SkillForge.normalize(payload(condition));
  assert.equal(p.skills[0].trigger,'auto',condition);
 }
 const old=g.SkillForge.normalize({...payload('lowhp'),signatureVersion:0});
 assert.equal(old.skills[0].trigger,'lowhp','legacy compatibility');
});
test('full momentum starts a signature regardless of previous external trigger or far-away enemy',()=>{
 const g=battleWorld();
 for(const condition of ['danger','dodge','contactEnergy','wallEnergy','basicHit']){
  g.SkillForge.register(payload(condition));
  const p=g.CUSTOM_DEFS.at(-1).createInstance(1),foe=target();
  p.x=65;p.y=65;g.players.splice(0,g.players.length,p,foe);
  for(let k=0;k<35;k++)g.SkillForge.autoUpdate(p,foe);
  assert.equal(p._bounceCasts||0,0,'no early use: '+condition);
  g.BounceMomentum.add(p,100,'contact');
  g.SkillForge.autoUpdate(p,foe);
  assert.equal(p._bounceCasts,1,'must cast at full energy: '+condition);
  assert.equal(g.BounceMomentum.meter(p),0,'must spend on cast: '+condition);
 }
});
test('tower ledges and scenery ricochet without deleting most velocity',()=>{
 const g={Math,Number,Set,Map,console};g.globalThis=g;g.window=g;vm.createContext(g);
 for(const file of ['js/features/tower-map-architecture.js','js/features/tower-terrain-25d.js'])
   vm.runInContext(read(file),g,{filename:file});
 const T=g.ArenaTowerTerrain,A=g.ArenaTowerArchitecture;
 let wasHit=false, preserved=0;
 for(const realm of ['fire','time','space','storm','ice','forest']){
  const map=A.getMap(realm,5,500,500,0);
  const obstacle=map.obstacles[0];
  const p={x:obstacle.x+obstacle.r+5,y:obstacle.y,hp:200,vx:-6,vy:0,radius:22};
  const initial=Math.hypot(p.vx,p.vy);
  const out=A.bounce(p,realm,500,500,5,0);
  if(out){wasHit=true;preserved+=Math.hypot(p.vx,p.vy)/initial;}
  assert.ok(Number.isFinite(p.vx)&&Number.isFinite(p.vy));
 }
 assert.equal(wasHit,true);assert.ok(preserved>1.5,'solid obstacles should not absorb most velocity');
});
test('steep-step solver uses vector reflection rather than very low multiplier',()=>{
 const t=read('js/features/tower-terrain-25d.js');
 assert.match(t,/const incoming=Math.max\(0,vx\*nx\+vy\*ny\)/);
 assert.match(t,/p.vx=\(vx-1\.87\*incoming\*nx\)\*\.97/);
 assert.doesNotMatch(t,/p.vx=-\(p.vx\|\|0\)\*\.14/);
});
test('tower body collisions work between grounded decks while physical attack height remains strict',()=>{
 const src=read('js/core/engine.js'),attacks=read('js/features/advanced-combat.js');
 assert.match(src,/const towerPinball=/);
 assert.match(src,/groundedA&&groundedB/);
 assert.match(src,/BounceMomentum\?\.contact/);
 assert.match(attacks,/Math.abs\(a-z\)<=Math.max\(30,26\*\(target.bodyScale\|\|1\)\)/);
});
test('AI genuinely promotes physical momentum clashes without removing hazard avoidance',()=>{
 const g={Math,Number,Set,Map,console,canvas:{width:500,height:500}};g.globalThis=g;g.window=g;
 g.BounceMomentum={enabled:p=>!!p.forge&&p.forge.signatureVersion===1,ready:()=>false};
 vm.createContext(g);vm.runInContext(read('js/features/arena-auto-ai.js'),g);
 const mk=(x,cls)=>({x,y:220,playerNum:x,hp:250,maxHp:250,vx:1,vy:0,radius:26,_aiClock:130,
  forge:{signatureVersion:1,archetype:cls,skills:[{trigger:'auto',cooldown:10,actions:[{type:'shot',damage:15}]}]}});
 const p=mk(140,'ranged'),foe=mk(260,'defense');
 assert.equal(g.ArenaAutoAI.stance(p,foe).mode,'clash');
 assert.equal(p.hp,250);
});
test('beginner interface describes fixed energy trigger while expert disables old trigger selection',()=>{
 const easy=read('js/features/scratch-beginner.js'),advanced=read('js/features/scratch-studio.js');
 assert.match(easy,/기세 100 → 필살기 자동 발동/);
 assert.match(easy,/벽 반사/);
 assert.match(advanced,/scratch-trigger/);
 assert.match(advanced,/disabled=!legacy/);
});
