/* Skill Forge: authored ability sequences, not keyword parsing or arbitrary JS. */
(function(global){
'use strict';
const STORE='oibung-forge-v3', TYPE=global.ActionRegistry?.TYPE||{wave:'충격파',shot:'투사체',beam:'레이저',bolt:'낙뢰',dash:'돌진',blink:'순간이동',heal:'회복',shield:'방어막',pull:'흡입',orbit:'회전 소환체',zone:'지속 장판'};
const TRIGGER={auto:'주기적으로',lowhp:'체력 이하',contact:'접촉 시',damaged:'피격 시',danger:'보스 패턴 예고 시',dodge:'보스 패턴 회피 성공 시',basicHit:'기본 공격 명중 시',basicStatus:'기본 공격 상태이상 성공 시',contactEnergy:'상대와 충돌한 뒤',wallEnergy:'벽에 튕긴 뒤'};
const STATUS={none:'없음',ice:'둔화',fire:'화상',poison:'중독'};
Object.assign(TYPE,global.ForgeExpansion?.TYPES||{});
Object.assign(TYPE,global.AdvancedCombat?.TYPES||{});
Object.assign(STATUS,global.ForgeExpansion?.STATUSES||{});

/* Per-type actionable controls. The stored schema stays backwards compatible;
 * the editor only shows inputs the actual execution path consumes. */
const ACTION_PARAMETERS=global.ActionRegistry?.ACTION_PARAMETERS||Object.freeze({
  wave:'pattern target damage radius count status knockback',
  shot:'pattern target damage radius count speed status knockback',
  beam:'pattern target damage radius count status knockback',
  bolt:'pattern target damage radius count status knockback',
  dash:'target speed duration',
  blink:'target',
  heal:'damage',shield:'duration',pull:'damage radius status knockback',
  orbit:'damage radius count duration status knockback',
  zone:'pattern target damage radius count duration status knockback',
  homing:'target damage radius count speed status knockback',
  pierce:'target damage radius count speed status knockback',
  boomerang:'target damage radius count speed status knockback',
  chain:'target damage radius count status knockback',
  nova:'damage radius status knockback',
  meteor:'target damage radius speed status knockback',
  mine:'damage radius duration status knockback',
  drain:'target damage radius status knockback',
  swap:'target',retreat:'target radius',
  cleanse:'',haste:'duration',regen:'damage duration',fortify:'duration',
  flight:'target damage radius duration status knockback',
  burrow:'target damage radius duration status knockback',
  blackhole:'target damage radius duration status',
  starfall:'target damage radius count speed status knockback',
  dung:'target damage radius speed duration status knockback',
  lifebloom:'damage radius duration',
  resurrect:'',timestop:'radius duration',rewind:'duration',timeburst:'duration',
  leap:'',hover:'duration',glide:'duration',
  dive:'damage radius speed status knockback',
  uppercut:'target damage radius status knockback',
  slash:'target damage radius status knockback',
  spinslash:'target damage radius status knockback',
  thrust:'target damage radius status knockback',
  aircombo:'target damage radius status knockback',
  arcshot:'target damage radius count speed status knockback',
  splitshot:'target damage radius count speed status knockback',
  wall:'target radius damage duration',
  portal:'target radius duration',
  summon:'target damage radius speed duration status knockback',
  turret:'target damage radius speed duration status knockback',
  trap:'damage radius duration status knockback',
  grow:'count duration',shrink:'count duration',
  burrowdash:'target damage radius duration status knockback',
  erupt:'damage radius status knockback'
});
// Motion is not an attack. These actions may reposition a fighter but
// never produce damage, statuses or knockback, even from old saved JSON.
const MOVEMENT_ONLY=global.ActionRegistry?.MOVEMENT_ONLY||new Set(['dash','blink','leap','hover','glide','swap','retreat','portal']);
// The profile schema owns normalization, random generation and default recipes.
if(!global.SkillForgeProfilesFactory||!global.SkillForgeStoreFactory)
  throw Error('Forge dependencies missing: load skill-forge-profiles.js and skill-forge-storage.js before skill-forge.js');
const {supportedParameter,number,clean,color,stage,skill,normalize,THEMES,
 allSkillset,allProfile,randomProfile}=
 global.SkillForgeProfilesFactory({TYPE,TRIGGER,STATUS,ACTION_PARAMETERS,MOVEMENT_ONLY});
const {saved,persist}=global.SkillForgeStoreFactory({STORE,getDefs:()=>CUSTOM_DEFS});

let sequence=0;
const enemies=p=>players.filter(q=>q!==p&&q.hp>0)
 .concat(globalThis.ArenaTower?.encounter?.spectacle?.targets(p)||[],
 global.AdvancedCombat?.objects?.filter(o=>o.isConstruct&&o.owner!==p.playerNum&&o.hp>0&&o.life>0)||[]);
// Combat authorities are deliberately constructed once per match runtime.
// External SkillForge API remains exactly the same for saved fighters and old mods.
if(!global.SkillForgeImpactFactory||!global.SkillForgeCastingFactory)
  throw Error('Forge dependencies missing: load skill-forge-impact.js and skill-forge-casting.js before skill-forge.js');
const {hit,hitGround,groundImpactZ}=global.SkillForgeImpactFactory({MOVEMENT_ONLY,enemies});
if(!global.SkillForgeWorldFactory)
  throw Error('Forge dependency missing: load skill-forge-world.js before skill-forge.js');
if(!global.SkillForgeExecutorFactory)
  throw Error('Forge dependency missing: load skill-forge-executor.js before skill-forge.js');
const {execute}=global.SkillForgeExecutorFactory({MOVEMENT_ONLY,hit,enemies});
// The world needs the real action executor for child-family post-events.
const world=global.SkillForgeWorldFactory({hit,hitGround,enemies,execute});
const {cast,tickQueue,tickSkills,cooldownFrames}=
  global.SkillForgeCastingFactory({MOVEMENT_ONLY,execute});
function update(p,target){
  p._forgeActionClock=(p._forgeActionClock||0)+1;
  global.SignatureLive?.tickMove?.(p);
  const loss=p.forgeLastHp-p.hp;p.forgeLastHp=p.hp;
  // Actual settled HP delta, not particles or predicted hit chance.
  // The active 100-momentum rule observes this on the same simulation tick.
  if(Number.isFinite(loss)&&loss>0)global.SignatureLive?.record?.(p,'hpDrop');
  else if(Number.isFinite(loss)&&loss<0)global.SignatureLive?.record?.(p,'hpGain');
  const cruise=p.forge.speed*(p.speedMultiplier||1),v=Math.hypot(p.vx,p.vy);
  if(p.forgeDash>0){
    p.forgeDash--;
    if(target){const t=Math.atan2(target.y-p.y,target.x-p.x);p.vx+=(Math.cos(t)*p.forgeDashAction.speed-p.vx)*.18;p.vy+=(Math.sin(t)*p.forgeDashAction.speed-p.vy)*.18;}
  }else if(p.forgeCharge?.phase==='charging'){
    // Charge-up has a readable wind-up: the fighter trembles but does not
    // rush around at full speed until energy is released.
    p.vx*=.80;p.vy*=.80;
  }else if(global.ArenaAutoAI?.steer?.(p,target,cruise)){}
   else if(v>.001&&Number.isFinite(v)){const next=v+(cruise-v)*(v>cruise?.075:.16);p.vx=p.vx/v*next;p.vy=p.vy/v*next;}
  else{p.vx=cruise;p.vy=0;}
  tickSkills(p);
  global.BounceMomentum?.tick?.(p,target);
  // No automatic normal attack: physical collisions build momentum and
  // the player's authored program is the sole skill attack at energy 100.
  // Repeat tiny ornamental pulses without triggering extra damage, healing or
  // CC. The true combat cooldown is unchanged (at least 0.2 s).
  p._forgeVisualFrame=(p._forgeVisualFrame||0)+1;
  if(target?.hp>0&&!global.BounceMomentum?.enabled?.(p)&&!global.ForgeExpansion?.blocked(p))p.forge.skills.forEach((s,i)=>{
    if(s.trigger==='auto'&&s.cooldown<=.6&&(p._forgeVisualFrame+i*2)%6===0)
      global.ForgeComboFX?.pulse?.(p,s.actions[0],i);
  });
  // Do not fire a fresh skill into the charge-up interval. Any existing
  // queued combo continues to advance and executes after the full wind-up.
  if(p.forgeCharge?.phase==='charging'){
    advanceWorld(p,target);return;
  }
  if(p.forge.allAbilities&&!global.BounceMomentum?.enabled?.(p)){
    // Each move has a separate clock; round-robin selection prevents 50+
    // casts on one tick from flooding the limited projectile/effect pools.
    p.forgeClock++;
    const skills=p.forge.skills,blocked=global.ForgeExpansion?.blocked(p);
    if(!blocked&&target&&p.forgeClock%6===0){
      for(let tries=0;tries<skills.length;tries++){
        const i=(p.forgeCursor+tries)%skills.length,s=skills[i];
        if(p.forgeTicks[i]<cooldownFrames(p,s)||
          global.ArenaAutoAI?.canCast?.(p,target,s)===false)continue;
        if(!cast(p,s,target,i))continue;
        p.forgeTicks[i]=0;
        p.forgeCursor=(i+1)%skills.length;
        break;
      }
    }
  }else{
    // One shared gauge launches every authored player skill together.
    // The charge is spent exactly once, never per skill. Each skill keeps
    // its own cast ID and its own bounded rules/condition executor.
    const simultaneous=global.BounceMomentum?.enabled?.(p)&&!p.towerEnemy;
    if(simultaneous){
      if(target&&target.hp>0&&!global.ForgeExpansion?.blocked(p)&&
         global.BounceMomentum.ready(p)&&
         (p.forge.signatureVersion!==1||
           global.ArenaCombatV2?.shouldCast?.(p,target)!==false)){
        let launched=0;
        p.forge.skills.forEach((s,i)=>{
          if(cast(p,s,target,i)){launched++;p.forgeTicks[i]=0;}
        });
        if(launched){
          global.BounceMomentum.spend(p);
          p._playerEnergyCursor=(p._playerEnergyCursor||0)+1;
          p._forgeBurstSkills=launched;
        }
      }
      advanceWorld(p,target);
      global.ArenaCombatV2?.ui?.(p);
      return;
    }
    const chargedBoss=global.BounceMomentum?.isBoss?.(p);
    const chargedMinion=global.BounceMomentum?.isMinion?.(p);
    const chargedPlayer=global.BounceMomentum?.enabled?.(p)&&!p.towerEnemy;
    // Energy-driven fighters consider only the next rotating slot. This is
    // O(1) per idle frame even when a player authored hundreds of skills.
    const len=p.forge.skills.length;
    const cursor=chargedBoss?p._bossEnergyCursor||0:
      chargedMinion?p._minionEnergyCursor||0:p._playerEnergyCursor||0;
    const indices=(chargedBoss||chargedMinion||chargedPlayer)?
      (len?[cursor%len]:[]):p.forge.skills.map((_,i)=>i);
    indices.forEach(i=>{
      const s=p.forge.skills[i];
      // Each boss has ONE 100-point gauge for its full authored arsenal and
      // its large scripted attacks. Rotate skills after each filled cast.
      if(chargedBoss&&(p._ancientEnergyOnly||
        global.BounceMomentum.bossPhase(p)!=='skill'||
        i!==(p._bossEnergyCursor||0)%p.forge.skills.length))return;
      // A regular tower enemy uses only ONE of its authored actions per
      // full meter, cycling through skills rather than dumping them at once.
      if(chargedMinion&&i!==(p._minionEnergyCursor||0)%p.forge.skills.length)return;
      if(chargedPlayer&&i!==(p._playerEnergyCursor||0)%p.forge.skills.length)return;
      if(global.ForgeExpansion?.blocked(p))return;
      if(!global.BounceMomentum?.enabled?.(p)&&p.forgeTicks[i]<cooldownFrames(p,s))return;
      if(global.BounceMomentum?.enabled?.(p)&&!global.BounceMomentum.ready(p))return;
      if(p.forge.signatureVersion===1&&!p.towerEnemy&&
         global.ArenaCombatV2?.shouldCast?.(p,target)===false)return;
      // Player signature timing waits at most 138 simulated frames
      // after reaching 100 energy, never delaying bosses or minions.
      const energyOnly=global.BounceMomentum?.enabled?.(p);
      const active=energyOnly?!!target:(global.SignatureProgram?.eligible?.(p,target,s,loss)?? 
        ((s.trigger==='auto'&&target)||(s.trigger==='lowhp'&&p.hp/p.maxHp*100<=s.threshold)
        ||(s.trigger==='damaged'&&loss>0)));
      if(active&&(energyOnly||global.ArenaAutoAI?.canCast?.(p,target,s)!==false)&&cast(p,s,target,i)){
        if(chargedBoss)global.BounceMomentum?.bossSpend?.(p,'skill');
        else if(global.BounceMomentum?.spend?.(p)){
          if(chargedMinion)p._minionEnergyCursor=(p._minionEnergyCursor||0)+1;
          if(chargedPlayer)p._playerEnergyCursor=(p._playerEnergyCursor||0)+1;
        }
        p.forgeTicks[i]=0;
        if(s.trigger==='dodge')p._forgeDodgeConsumed=p._forgeDodgeSerial||0;
        if(s.trigger==='basicHit')p._scratchBasicHitConsumed=p._scratchEvents?.basicHit?.count||0;
        if(s.trigger==='basicStatus')p._scratchBasicStatusConsumed=p._scratchEvents?.basicStatus?.count||0;
        if(s.trigger==='contactEnergy')p._scratchContactConsumed=p._scratchEvents?.contact?.count||0;
        if(s.trigger==='wallEnergy')p._scratchWallConsumed=p._scratchEvents?.wall?.count||0;
      }
    });
  }
  advanceWorld(p,target);
  global.ArenaCombatV2?.ui?.(p);
}
// Manual Tower mode uses the same cast queue, cooldown clocks, collision
// and execution pipeline as an AI Forge fighter; only the cast decision differs.
const MANUAL_PRESETS={
  bae:[['돌진','dash',0],['충격파','wave',24],['회전베기','spinslash',23],['방어막','shield',0]],
  oh:[['충격파','wave',25],['순간이동','blink',0],['흡혈','drain',24],['시간 정지','timestop',0]],
  lee:[['찌르기','thrust',25],['가속','haste',0],['낙뢰','bolt',26],['방어막','shield',0]],
  park:[['분화 점프','erupt',29],['어퍼컷','uppercut',27],['방어막','shield',0],['돌진','dash',0]],
  choi:[['투사체','shot',24],['지속 장판','zone',22],['장벽','wall',0],['주변 폭발','nova',29]]
};
function enableManual(p){
  if(!p||p.hp<=0)return false;
  if(!p.forge){
    const preset=MANUAL_PRESETS[p.id]||[['투사체','shot',22],['충격파','wave',24],['돌진','dash',0],['방어막','shield',0]];
    const profile={name:p.name||'수동 파이터',color:p.themeColor||p.borderColor||'#5189cc',
      effectColor:p.themeColor||'#5189cc',hp:p.maxHp,speed:Math.max(.6,Math.min(5,Math.hypot(p.vx||0,p.vy||0)*1.8||2.4)),
      skills:preset.map(([name,type,damage],i)=>({name,trigger:'auto',
        cooldown:[1.8,3.5,4.6,5.8][i],actions:[{type,damage,radius:115,speed:6,
          duration:type==='dash'?.45:1.6,count:1,knockback:2,status:'none'}]}))};
    p.forge=normalize(profile);
    p.forgeQueue=[];p.forgeShots=[];p.forgeZones=[];p.forgeOrbs=[];
    p.forgeSerial=0;p.forgeClock=0;p.forgeCursor=0;p.forgeDash=0;
    p.forgeLastHp=p.hp;
  }
  // The player may use the first four abilities directly. A special
  // all-abilities profile still exposes the first four controllable slots.
  p.forgeTicks||=p.forge.skills.map(()=>0);
  while(p.forgeTicks.length<p.forge.skills.length)p.forgeTicks.push(0);
  p.forgeQueue||=[];p.forgeShots||=[];p.forgeZones||=[];p.forgeOrbs||=[];
  p.forgeSerial||=0;p.forgeClock||=0;p.forgeLastHp=p.hp;
  p.manualTower=true;
  p.forgeTicks=p.forge.skills.map(s=>cooldownFrames(p,s));
  return true;
}
function manualUpdate(p,target){
  if(!p?.manualTower||p.hp<=0)return false;
  if(p.forgeDash>0)p.forgeDash--;
  tickSkills(p);
  advanceWorld(p,target);
  return true;
}
function manualCast(p,index,target){
  if(!p?.manualTower||p.hp<=0)return false;
  const i=Number(index),s=p.forge?.skills?.[i];
  if(!Number.isInteger(i)||i<0||i>=4||!s)return false;
  if(global.ForgeExpansion?.blocked(p))return false;
  if(!target||target.hp<=0)return false;
  if((p.forgeTicks[i]||0)<cooldownFrames(p,s))return false;
  if(!cast(p,s,target,i))return false;
  p.forgeTicks[i]=0;
  return true;
}
// Existing projectiles, summons, cooldown-independent sequences and zones
// must advance even when the owner is stunned, frozen or silenced.
function advanceWorld(p,target){
  global.ArenaCharge?.tick?.(p);
  global.ForgeExpansion?.update(p,{hit,enemies});
  tickQueue(p,target);
  world.tick(p,target);
}
function contact(p,e){
  if(global.ForgeExpansion?.blocked(p))return;
  p.forge.skills.forEach((s,i)=>{
    if(global.ForgeExpansion?.blocked(p))return;
    // New characters cast during update() at full momentum only.
    if(global.BounceMomentum?.enabled?.(p))return;
    if(s.trigger!=='contact'||p.forgeTicks[i]<cooldownFrames(p,s))return;
    if(global.BounceMomentum?.enabled?.(p)&&!global.BounceMomentum.ready(p))return;
    if(cast(p,s,e,i)){
      global.BounceMomentum?.spend?.(p);
      p.forgeTicks[i]=0;
    }
  });
}
function drawFighter(p,renderCtx){
  const ink=renderCtx||ctx;
  if(!p.forge||p.hp<=0)return;

  const c=global.arenaEffectColor?.((p.forge.effectColor||p.forge.color))||(p.forge.effectColor||p.forge.color);
  const projectileDetail=global.AdvancedCombat?.projectileDetail?.()||0;
  ink.save();ink.globalCompositeOperation='source-over';
  ink.shadowColor=c;ink.shadowBlur=projectileDetail?0:3;ink.fillStyle=c;ink.strokeStyle=c;
  p.forgeShots.forEach(b=>{
    const heading=Math.atan2(b.vy,b.vx),status=b.a?.status||'none';
    const x=global.AdvancedCombat?.blend(b.prevX,b.x)??b.x;
    const groundY=global.AdvancedCombat?.blend(b.prevY,b.y)??b.y;
    const height=Math.max(0,Number(b.z)||0);
    const y=groundY-height-12;
    ink.save();
    const paintShot=ink=>{
    const shotColor=global.SkillColorPolicy?.resolve?.(b.a?.visual,
      p.forge.effectColor||p.forge.color)?.color||c;
    ink.save();ink.strokeStyle=shotColor;ink.fillStyle=shotColor;
    if(projectileDetail===2){
      ink.translate(x,y);ink.rotate(heading);ink.globalAlpha=.92;
      ink.beginPath();ink.moveTo(11,0);ink.lineTo(-7,-4);ink.lineTo(-7,4);ink.closePath();
      ink.fill();ink.restore();return;
    }
    if(projectileDetail===0){
      ink.globalAlpha=.28;ink.lineWidth=b.a?.charged?8:4;ink.lineCap='round';
      ink.beginPath();ink.moveTo(x-b.vx*3,y-b.vy*3);ink.lineTo(x,y);ink.stroke();
    }
    ink.globalAlpha=1;ink.translate(x,y);ink.rotate(heading);
    // New conceptual projectiles share the same bounded silhouette painter
    // used by cast FX. Shattered children use regular small shard geometry.
    if(!b._fusionChild&&global.ProceduralVisualGeometry?.SHAPES?.[b.a?.visual?.shape]){
      const tint=global.SkillColorPolicy?.resolve?.(b.a.visual,
        p.forge.effectColor||p.forge.color)?.color||c;
      global.ProceduralVisualGeometry.paint(ink,{
        shape:b.a.visual.shape,color:tint,scale:.65,
        progress:((b.life||0)%60)/60,low:projectileDetail>0});
      ink.restore();return;
    }
    ink.strokeStyle='#253344';ink.fillStyle=shotColor;ink.lineWidth=2;
    // All projectiles have a physical pointed direction; their status
    // adds a stable silhouette that reads against the white battleground.
    ink.beginPath();
    if(status==='ice'){
      ink.moveTo(12,0);ink.lineTo(0,-8);ink.lineTo(-11,0);ink.lineTo(0,8);
    }else if(status==='fire'){
      ink.moveTo(13,0);ink.lineTo(-7,-7);ink.lineTo(-3,0);ink.lineTo(-8,7);
    }else if(status==='poison'){
      ink.moveTo(12,0);ink.quadraticCurveTo(-5,-12,-9,0);
      ink.quadraticCurveTo(-5,12,12,0);
    }else{
      ink.moveTo(13,0);ink.lineTo(-7,-6);ink.lineTo(-3,0);ink.lineTo(-7,6);
    }
    ink.closePath();ink.fill();ink.stroke();
    ink.strokeStyle='#fff';ink.lineWidth=1.4;ink.beginPath();
    ink.moveTo(-4,-2);ink.lineTo(8,0);ink.stroke();
    ink.restore();
    };
    if(global.ArenaDepth?.air)global.ArenaDepth.air(ink,{x,y:groundY},height+12,paintShot,9);
    else paintShot(ink);
    ink.restore();
  });
  p.forgeZones.forEach(z=>{ink.globalAlpha=z.type==='bolt'?.9:.65;ink.lineWidth=2;ink.setLineDash([6,5]);ink.beginPath();ink.arc(z.x,z.y,z.type==='bolt'?z.a.radius*.4:(z.r??z.a.radius),0,2*Math.PI);ink.stroke();ink.setLineDash([]);});
  p.forgeOrbs.forEach(o=>{for(let i=0;i<o.a.count;i++){
    const t=o.phase+i*2*Math.PI/o.a.count,r=o.a.radius*.75;
    const at={x:p.x+Math.cos(t)*r,y:p.y+Math.sin(t)*r};
    const z=(global.AdvancedCombat?.visibleHeight?.(p)||0)+12;
    const paintOrb=ink=>{ink.save();ink.globalAlpha=.9;ink.fillStyle=c;
      ink.beginPath();ink.arc(at.x,at.y-z,8,0,2*Math.PI);ink.fill();ink.restore();};
    if(global.ArenaDepth?.air)global.ArenaDepth.air(ink,at,z,paintOrb,8);else paintOrb(ink);
  }});
  ink.restore();
}
function register(value,{towerEnemy=false}={}){
  let profile=normalize(value,{towerEnemy}),id='forge_'+(++sequence);
  if(!profile.artKey)profile.artKey='art'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);
  let runtime=profile.allAbilities?{...profile,skills:allSkillset()}:profile;
  const def={id,name:profile.name,forgeData:profile,createInstance(n){
    return {id,name:profile.name,playerNum:n,x:0,y:0,vx:1.1,vy:.9,radius:34,
      hp:profile.hp,maxHp:profile.hp,invincible:0,slowTimer:0,slowMultiplier:1,
      borderColor:profile.color,themeColor:profile.color,tagColor:profile.color,effectColor:profile.effectColor,
      jumpState:'ground',forge:runtime,towerEnemy:!!towerEnemy,forgeLastHp:profile.hp,forgeDash:0,
      forgeDashAction:null,forgeTicks:runtime.skills.map((s,i)=>{
        const cd=Math.round(s.cooldown*60);
        return profile.allAbilities?Math.max(0,cd-((i*13+23)%Math.max(1,cd))):
          Math.min(cd,Math.round(s.cooldown*15)+i*14);
      }),forgeSerial:0,forgeClock:0,forgeCursor:0,
      forgeQueue:[],forgeShots:[],forgeZones:[],forgeOrbs:[],forgeScratchRun:null,
      _scratchEvents:Object.create(null),_scratchMove:null,_scratchShieldUntil:-1,
      getImage:()=>CHARACTER_PHOTOS[id]||null,
      getDisplayName(){return this.name;},
      getTag(){return {text:profile.allAbilities?'전체 '+runtime.skills.length+'개 능력':profile.skills.map(s=>s.name).join(' · ').slice(0,70)};}
    };
  }};
  // Swap future battle definitions rather than mutating a profile that a
  // currently running/paused match may still reference.
  def.updateProfile=next=>{
    profile=normalize({...next,artKey:profile.artKey});
    runtime=profile.allAbilities?{...profile,skills:allSkillset()}:profile;
    def.forgeData=profile;def.name=profile.name;
  };
  CUSTOM_DEFS.push(def);
  global.CharacterStudioArt?.restore?.(id,profile.artKey);
  BEHAVIORS[id]={order:7,update,onContact:contact};
  return id;
}
function remove(id){
  const index=CUSTOM_DEFS.findIndex(d=>d.id===id&&d.forgeData);
  if(index<0)return false;
  global.CharacterStudioArt?.remove?.(CUSTOM_DEFS[index].forgeData.artKey);
  global.CosmeticArcade?.forgetFighter?.(CUSTOM_DEFS[index].forgeData.artKey);
  CUSTOM_DEFS.splice(index,1);
  delete BEHAVIORS[id];if(typeof CHARACTER_PHOTOS!=='undefined')delete CHARACTER_PHOTOS[id];
  persist();refreshList();return true;
}
function list(){
  return CUSTOM_DEFS.filter(d=>d.forgeData).map(d=>({id:d.id,profile:normalize(d.forgeData)}));
}
function setDraft(value){
  draft=normalize(value);refreshForm();global.BlockForge?.refresh?.();global.NaturalForge?.refreshGenerated?.(draft);return draft;
}
// Editor state stays canonical on this runtime; view code receives explicit accessors.
let draft={name:'',blurb:'',color:'#a78bfa',effectColor:'#a78bfa',
 archetype:'melee',hp:285,speed:2.35,signatureVersion:1,skills:[skill()]};
let refreshList=()=>{},refreshForm=()=>{},editingId=null;
const editorState={
 get draft(){return draft;},set draft(v){draft=v;},
 get refreshList(){return refreshList;},set refreshList(v){refreshList=v;},
 get refreshForm(){return refreshForm;},set refreshForm(v){refreshForm=v;},
 get editingId(){return editingId;},set editingId(v){editingId=v;}
};
const editor=global.SkillForgeEditorFactory?.({
 state:editorState,normalize,skill,stage,allSkillset,supportedParameter,
 TYPE,TRIGGER,STATUS,MOVEMENT_ONLY,register,remove,persist
});
function initializeUI(){editor?.initializeUI?.();}
function render(){editor?.render?.();}
function initialize(){
  saved().forEach(profile=>{try{register(profile);}catch(_){}});
  initializeUI();
  if(CUSTOM_DEFS.length)reRollMatch();
  // Render custom projectiles and glyphs in the same pipeline as normal fighters.
  const oldDraw=drawCharacter;
  drawCharacter=function(p){
    if(p.forge){
      if(!global.ArenaDepth?.layer?.(canvas,'world'))drawFighter(p); // canvas-only fallback
    }
    oldDraw(p);
  };
}
global.SkillForge={autoUpdate:update,drawFighter,THEMES,randomProfile,normalize,register,remove,list,setDraft,refreshList:()=>refreshList(),refreshEditor:()=>editor?.refreshEditor?.(),persist,TYPE,TRIGGER,STATUS,ACTION_PARAMETERS,MOVEMENT_ONLY,supportedParameter,cooldownFrames,advanceTimers:tickSkills,advanceWorld,hit,hitGround,groundImpactZ,enableManual,manualUpdate,manualCast,allProfile,allSkillset,getDraft:()=>normalize(draft)};
if(typeof document!=='undefined'&&document.querySelector('.bf-tools'))initialize();
})(window);
