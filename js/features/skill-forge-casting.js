/* Forge casting scheduler: independently timed skill gauges and queues.
 * The game engine owns fighter objects and action execution. This module
 * does not change cooldown or momentum mechanics; it only sequences them.
 */
(function(global){'use strict';
global.SkillForgeCastingFactory=function({MOVEMENT_ONLY,execute}){
/* Each skill owns its cooldown and its own cast sequence.
 * A combo has action-relative windups; different skills never wait for one
 * another. Explicit authored delays stay meaningful. */
const transitionLead={leap:14,hover:12,glide:12,erupt:12,uppercut:7,
  dash:7,blink:4,slash:8,spinslash:8,thrust:8,aircombo:7,
  arcshot:7,splitshot:7,dive:8,wall:5,portal:5,summon:5,turret:5};
const cooldownFrames=(p,s)=>global.BounceMomentum?.enabled?.(p)?1:
 Math.max(12,Math.round((p.forgeRush?Math.min(1,s.cooldown):s.cooldown)*60));
function cast(p,s,target,index){
  // A sentence-authored skill stays alive as a bounded simulation-time rule set.
  if(p.forge?.signatureVersion===1&&s.ruleSet&&global.SignatureRuleLive){
    const runs=p.forgeRuleRuns||=([]);
    if(runs.some(entry=>entry.index===index&&!entry.run.finished))return false;
    const run=global.SignatureRuleLive.begin(s.ruleSet,p);
    if(!run)return false;
    runs.push({index,run,castId:++p.forgeSerial});
    p.forgeRuleRun=run;
    global.ArenaCombatV2?.onCast?.(p);
    global.BattleFX?.caption?.(p,s.name,(p.forge.effectColor||p.forge.color));
    return true;
  }
  // A Scratch program is a coroutine: evaluate each branch AFTER the previous
  // action has actually executed, never by flattening conditions at cast time.
  if(p.forge?.signatureVersion===1&&Array.isArray(s.program)){
    if(p.forgeScratchRun&&!p.forgeScratchRun.finished)return false;
    const run=global.SignatureLive?.begin?.(s.program,p,s.trigger);
    if(!run)return false;
    p.forgeScratchRun=run;
    global.ArenaCombatV2?.onCast?.(p);
    global.BattleFX?.caption?.(p,s.name,(p.forge.effectColor||p.forge.color));
    return true;
  }
  // Only executable branches enter the real combat queue. Skipped branches
  // cannot silently deal damage, consume a separate cooldown, or emit VFX.
  const actions=p.forge?.signatureVersion===1&&Array.isArray(s.program)?
    global.SignatureScratch.compile(s.program,p,target):
    p.forge?.signatureVersion===1?
    s.actions.filter(a=>global.SignatureProgram?.condition?.(p,target,a.condition)!==false):
    s.actions;
  if(!actions.length)return false;
  const castId=++p.forgeSerial;
  let start=0;
  for(let step=0;step<actions.length;step++){
    const a=actions[step],previous=actions[Math.max(0,step-1)];
    const requested=Math.max(0,Math.round(a.delay*60));
    const lead=transitionLead[previous.type]||6;
    start=step>0&&previous.type==='charge'?
      Math.max(requested,start+(global.ArenaCharge?.framesOf?.(previous)||60)+2):
      step===0?Math.max(requested,global.ArenaTelegraph?.leadFrames?.(a)||0):
      a.link==='with'?start:
      a.link==='after'?Math.max(requested,start+Math.max(24,lead)):
      Math.max(requested,start+lead);
    p.forgeQueue.push({remaining:start,step,castId,skillIndex:index,steps:actions.length,
      a,targetNum:target?.playerNum??null,
      windup:global.ArenaTelegraph?.leadFrames?.(a)||0,
      waitApex:step>0&&['leap','glide','hover','uppercut'].includes(previous.type)&&
        ['dive','aircombo','slash','spinslash','thrust'].includes(a.type)});
  }
  if(p.forgeQueue.length>48)p.forgeQueue.splice(0,p.forgeQueue.length-48);
  global.ArenaCombatV2?.onCast?.(p);
  global.BattleFX?.caption?.(p,s.name,(p.forge.effectColor||p.forge.color));
  return true;
}
function tickSkills(p,blocked=false){
  // Full-energy casts bypass independent cooldowns. Do not loop through an
  // unlimited skills array just to saturate clocks that are never consulted.
  if(global.BounceMomentum?.enabled?.(p))return !blocked;
  const speed=global.ForgeExpansion?.active(p,'timeburst')?2:1;
  p.forge.skills.forEach((s,i)=>{
    const max=cooldownFrames(p,s);
    p.forgeTicks[i]=Math.min(max,Math.max(0,(p.forgeTicks[i]||0)+speed));
  });
  // No shared global "skillCooldown": each gauge always progresses,
  // even during a silence/stun. Only casts and execution are suspended.
  return !blocked;
}
function tickQueue(p,target){
  const blocked=!!global.ForgeExpansion?.blocked(p);
  // Exactly one program action may be queued at a time; this preserves a
  // genuine opportunity to observe hit/movement/guard events before branching.
  const liveRuns=p.forgeRuleRuns?.length?p.forgeRuleRuns:
    (p.forgeRuleRun&&!p.forgeRuleRun.finished?
      [{index:0,run:p.forgeRuleRun,castId:p.forgeSerial}]:[]);
  if(!blocked){
    for(const entry of liveRuns){
      if(entry.run.finished||p.forgeQueue.length>=40)continue;
      const action=global.SignatureRuleLive?.step?.(entry.run,p,target);
      if(action){
        const windup=global.ArenaTelegraph?.leadFrames?.(action)||0;
        p.forgeQueue.push({remaining:Math.max(windup,1),step:Math.max(0,entry.run.actions-1),
          castId:entry.castId,skillIndex:entry.index,steps:entry.run.actions,a:action,
          targetNum:target?.playerNum??null,windup,rule:true});
      }
    }
  }
  if(p.forgeRuleRuns){
    p.forgeRuleRuns=p.forgeRuleRuns.filter(entry=>!entry.run.finished);
    p.forgeRuleRun=p.forgeRuleRuns[0]?.run||null;
  }
  const run=p.forgeScratchRun;
  if(run&&!run.finished&&!blocked){
    const a=global.SignatureLive?.step?.(run,p,target);
    if(a){
      const windup=global.ArenaTelegraph?.leadFrames?.(a)||0;
      p.forgeQueue.push({remaining:Math.max(windup,Math.round((Number(a.delay)||0)*60)),
        step:Math.max(0,run.actions-1),castId:p.forgeSerial,skillIndex:0,
        steps:Math.min(12,run.actions),a,targetNum:target?.playerNum??null,
        windup,waitApex:false,scratch:true});
    }
  }
  for(let i=0;i<p.forgeQueue.length;){
    const q=p.forgeQueue[i];
    if(q.remaining>0)q.remaining--;
    if(q.remaining>0){i++;continue;}
    if(blocked){i++;continue;} // keep the action pending instead of dropping it
    // Across separate skills, attacks also wait until charging completes.
    // Movement/support blocks remain independent and can play during windup.
    if(p.forgeCharge?.phase==='charging'&&global.ArenaCharge?.ATTACK?.has(q.a.type)){
      i++;continue;
    }
    if(q.waitApex){
      const z=global.AdvancedCombat?.height(p)||0;
      const pose=p.jumpMotion?.phase||p.jumpState;
      if(pose==='prepare'||pose==='rising'||(z<24&&pose!=='ground'&&pose!=='landing')){
        i++;continue;
      }
    }
    // Tell the physical uppercut object whether a same-cast aircombo follows.
    // The caster launches on the actual uppercut CONTACT frame, not at cast.
    const aerialLink=q.a.type==='uppercut'&&p.forgeQueue.some(next=>
      next.castId===q.castId&&next.step>q.step&&next.a.type==='aircombo');
    if(aerialLink)p.uppercutFollow=true;
    const castTarget=players.find(e=>e.playerNum===q.targetNum&&e.hp>0)||target;
    global.ArenaBattleDirector?.skillUsed?.(p,castTarget,q.a,p.forge?.skills?.[q.skillIndex]?.name);
    execute(p,q.a,castTarget);
    if(q.rule)global.SignatureRuleLive?.performed?.(p,q.a);
    if(q.scratch){
      if(q.a.type==='shield'&&p.invincible>0)
        p._scratchShieldUntil=(Number(p._forgeActionClock)||0)+Math.min(480,p.invincible);
      if(MOVEMENT_ONLY.has(q.a.type))global.SignatureLive?.beginMove?.(p,q.a);
      global.SignatureLive?.performed?.(p.forgeScratchRun);
    }
    global.ForgeComboFX?.cast?.(p,q.a,{castId:q.castId,step:q.step,steps:q.steps,link:q.a.link},castTarget);
    if(aerialLink)p.uppercutFollow=false;
    p.forgeQueue.splice(i,1);
  }
}

return Object.freeze({cast,tickQueue,tickSkills,cooldownFrames});
};
})(typeof window!=='undefined'?window:globalThis);
