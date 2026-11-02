/* Simulation-clock rule coroutine: persistent reactions without infinite loops.
 * One emitted action at a time, max 80 per 100-energy activation. */
(function(g){'use strict';
const MAX_ACTIONS=80;
function begin(config,p){
 const skill=g.SignatureRuleSkill?.normalize?.(config);
 if(!skill?.rules?.length)return null;
 const now=Number(p?._forgeActionClock)||0;
 const observed=skill.rules.map(r=>r.when==='dodge'?
  Number(p?._forgeDodgeSerial)||0:(p?._scratchEvents?.[r.when]?.count)||0);
 return {rules:skill.rules,window:Math.round(skill.window*60),clock:0,actions:0,
  nextAt:skill.rules.map(()=>0),seen:observed,startedAt:now,finished:false,cursor:0};
}
function step(run,p,target){
 if(!run||run.finished||!p||p.hp<=0)return null;
 if(++run.clock>run.window||run.actions>=MAX_ACTIONS){run.finished=true;return null;}
 for(let t=0;t<run.rules.length;t++){
  const i=(run.cursor+t)%run.rules.length,r=run.rules[i];
  if(run.clock<run.nextAt[i])continue;
  const when=r.when;
  const isState=when==='hpLow'||when==='near'||when==='far';
  const current=when==='dodge'?Number(p._forgeDodgeSerial)||0:
   (p._scratchEvents?.[when]?.count||0);
  if(isState){
   if(when==='hpLow'&&(p.hp/Math.max(1,p.maxHp||p.hp))>.4)continue;
   if(when==='near'&&(!target||Math.hypot(p.x-target.x,p.y-target.y)>130))continue;
   if(when==='far'&&(!target||Math.hypot(p.x-target.x,p.y-target.y)<130))continue;
  }else if(when!=='pulse'&&current<=run.seen[i])continue;
  const delta=Math.max(21,Math.round(r.interval*60));
  run.nextAt[i]=run.clock+delta;
  if(!isState&&when!=='pulse')run.seen[i]=current;
  run.actions++;run.cursor=(i+1)%run.rules.length;
  const a={...r.action};
  if(a.type==='splitshot')a.fractureDepth=r.fracture;
  return a;
 }
 return null;
}
function performed(p,a){
 if(!p||!['haste','timeburst'].includes(a?.type))return;
 const now=Number(p._forgeActionClock)||0;
 const prev=p._ruleSpeed;
 const stacks=(prev?.until>now?prev.stacks:0)||0;
 p._ruleSpeed={stacks:Math.min(7,stacks+1),until:now+125};
}
g.SignatureRuleLive=Object.freeze({begin,step,performed,MAX_ACTIONS});
})(typeof window!=='undefined'?window:globalThis);
