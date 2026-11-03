/* One authoritative combat impact resolver for custom skills.
 * Applies damage, status, impact grace, combo recording and confirmed VFX.
 * Must be loaded before skill-forge.js; calls back into no UI editor code.
 */
(function(global){'use strict';
global.SkillForgeImpactFactory=function({MOVEMENT_ONLY,enemies}){
function groundImpactZ(target){
 return global.AdvancedCombat?.floorHeight?.(target) ??
  Math.max(0,Number(target?.towerGroundZ)||0);
}
// Ground-zone damage resolves at each struck platform, not at world z=0.
// This does not bypass jumping or change the altitude of flying projectiles.
function hitGround(attacker,target,action,multiplier=1){
 return hit(attacker,target,action,multiplier,groundImpactZ(target));
}
// A hit's 12-frame recovery prevents the SAME hitbox from striking twice,
// but cannot cancel other authored combo blocks merely because the first hit
// applied a status. Shields/revival/dashes still grant true invincibility.
const IMPACT_GRACE_FRAMES=12;
function hit(p,e,action,multiplier=1,attackZ) {
  if(MOVEMENT_ONLY.has(action?.type))return false;
  if(!e||e===p||e.hp<=0)return false;
  // Post-impact grace is not defense. A shield or a distinct invulnerability
  // lasts longer than this tag and must still block every attempted strike.
  if(e.invincible>0 && (!(e._forgeImpactGrace>0)||e.invincible>e._forgeImpactGrace)){
    // Only a shield that is STILL ACTIVE counts as a guard.
    // Impact grace, boss immunity and decorative FX never qualify.
    const clock=Number(e._forgeActionClock)||0;
    if(e._scratchShieldUntil>=clock||e._forgeGuardUntil>=clock)
      global.SignatureLive?.record?.(e,'guard');
    return false;
  }
  if(global.AdvancedCombat&&!AdvancedCombat.canHit(p,e,attackZ))return false;
  if(!global.AdvancedCombat&&e.jumpState&&e.jumpState!=='ground')return false;
  const d=Math.max(0,Math.round((action.damage||0)*multiplier*(global.ForgeExpansion?.damageScale(p,e)||1)*
    (global.ArenaBalance?.factorOf?.(p)??1)*(global.ArenaStalemate?.attackFactor?.()??1)*
    (global.ArenaCombatV2?.damageFactor?.(p)??1)*
    (global.ForgeArchetypes?.attack?.(p)??1)*(global.ForgeArchetypes?.received?.(e)??1)*
    (e.towerEnemy&&Number.isFinite(e.towerDefense)?e.towerDefense:1)));
  const frame=Number(p._forgeBalanceFrame)||0;
  if(e.invincible<=0){e._forgeImpactGrace=0;e._forgeImpactStamps=new WeakMap();}
  const stamps=e._forgeImpactStamps;
  const last=stamps&&action&&typeof action==='object'?stamps.get(action):null;
  if(d>0&&last&&last.attacker===p&&frame>=last.frame&&
     frame-last.frame<IMPACT_GRACE_FRAMES)return false;
  const hpBeforeHit=Math.max(0,Number(e.hp)||0);
  if(d){
    (e._forgeImpactStamps||=new WeakMap()).set(action,{attacker:p,frame});
    const tint=p.forge?.effectColor||p.forge?.color||p.themeColor||'#58687a';
    e.hp=Math.max(0,e.hp-d);
    global.SemanticPhysics?.noteHit?.(p,e,action,hpBeforeHit-e.hp);
    global.BounceMomentum?.damageTaken?.(e,Math.min(hpBeforeHit,d));
    e.invincible=IMPACT_GRACE_FRAMES;
    e._forgeImpactGrace=IMPACT_GRACE_FRAMES;
    // In projectile storms, retain readable impact feedback without
    // producing hundreds of expensive short-lived spark sprites per tick.
    const density=global.AdvancedCombat?.projectileDetail?.()||0;
    createHitParticles(e.x,e.y,tint,density===2?4:density===1?8:d>=25?22:14);
    addFloatingText('-'+d,e.x,e.y-30,tint,17);
    global.ImpactPhysics?.hit?.(p,e,d,{knockback:action.knockback||0,color:tint,type:action.type});
     global.ArenaCombatV2?.strongHit?.(p,Math.min(hpBeforeHit,d),action.knockback||0);
  }
  const priorStatus={slow:e.slowTimer||0,dot:e.bfDot||0,effect:e.forgeEffects?.[action.status]?.time||0};
  const controlPower=global.ForgeArchetypes?.control?.(p)??1;
  if(!e.isConstruct&&action.status==='ice'){
    e.slowTimer=Math.max(e.slowTimer||0,Math.round(90*controlPower));
    e.slowMultiplier=Math.min(e.slowMultiplier||1,controlPower>1?.42:.5);
  }
  if(!e.isConstruct&&(action.status==='fire'||action.status==='poison')){
    const seconds=Number.isFinite(action.duration)?action.duration:(action.status==='fire'?2:3);
    // A DoT lasts as long as requested; its half-second damage ticks are
    // handled by the single existing simulation loop.
    e.bfDot=Math.max(e.bfDot||0,Math.max(30,Math.min(480,Math.round(seconds*60))));
    e._forgeDotKind=action.status;
    e.bfDotDamage=Math.max(e.bfDotDamage||2,Math.min(6,Math.max(1,Math.round(d*.12))));
  }
  if(!e.isConstruct)global.ForgeExpansion?.applyStatus(p,e,controlPower>1&&action.status!=='none'?{
    ...action,duration:Math.min(8,(Number(action.duration)||1.5)*controlPower)
  }:action);
  // Only report a confirmed hit; commentary never assumes a queued action
  // actually reached its target or that a resisted status was applied.
  const appliedStatus=action.status==='ice'&&e.slowTimer>0?'ice':
    action.status==='fire'&&e.bfDot>0?'fire':
    action.status==='poison'&&e.bfDot>0?'poison':
    e.forgeEffects?.[action.status]?.time>0?action.status:'none';
  if(d>0){
    if(action.basicAttack)global.BounceMomentum?.basicHit?.(p);
    global.SignatureLive?.record?.(p,'hit');
    if(action.basicAttack)global.SignatureLive?.record?.(p,'basicHit');
    if(action.basicAttack&&action.basicLifesteal&&p.hp>0){
      const heal=Math.min(4,Math.max(1,Math.round(d*.16)));
      const allowed=global.ArenaBalance?.healingWindow?.(p,heal)??heal;
      p.hp=Math.min(p.maxHp,p.hp+allowed);
    }
  }
  if(appliedStatus!=='none'&&(
    (action.status==='ice'&&(e.slowTimer||0)>priorStatus.slow)||
    (['fire','poison'].includes(action.status)&&(e.bfDot||0)>priorStatus.dot)||
    ((e.forgeEffects?.[action.status]?.time||0)>priorStatus.effect)
  )){
    global.SignatureLive?.record?.(p,'status');
    if(action.basicAttack)global.SignatureLive?.record?.(p,'basicStatus');
  }
  global.ArenaBattleDirector?.skillHit?.(p,e,action,Math.min(hpBeforeHit,d),appliedStatus);
  if(action.knockback>0&&!global.ImpactPhysics){const dx=e.x-p.x,dy=e.y-p.y,dist=Math.hypot(dx,dy)||1;e.vx+=dx/dist*action.knockback;e.vy+=dy/dist*action.knockback;}
  global.SkillVisuals?.impact(p,e,action); // Only after damage/status actually connects.
  global.ForgeComboFX?.impact?.(p,e,action);
  // A fused projectile executes its secondary physical concept only on a
  // genuinely landed damage hit, never at cast time or through shields.
  if(d>0&&hpBeforeHit>e.hp&&action.fusion)
    global.ConceptFusion?.impact?.(p,e,action,{hit,enemies});
  if(d>0&&action.charged)global.SkillVisuals?.impact?.(p,e,{type:'charge',radius:90,damage:d});
  return true;
}

return Object.freeze({hit,hitGround,groundImpactZ});
};
})(typeof window!=='undefined'?window:globalThis);
