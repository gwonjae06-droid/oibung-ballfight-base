/* Safe declarative skill rules. No arbitrary JS, no recursive execution.
 * A 100-momentum activation runs bounded reactions for a fixed time window. */
(function(g){'use strict';
const WHEN=Object.freeze({pulse:'일정 시간마다',wall:'벽에 튕기면',
 wallStored:'벽 충돌 충격을 지정 횟수만큼 모으면',contact:'상대와 충돌하면',
 land:'착지하면',hit:'공격이 맞으면',split:'탄환이 분열하면',
 guard:'공격을 방어하면',dodge:'위험을 회피하면',status:'상태이상을 걸면',
 move:'이동 스킬을 사용하면',hpDrop:'실제 체력이 감소하면',hpGain:'실제 체력이 회복되면',
 hpLow:'내 체력이 낮으면',near:'적이 가까우면',far:'적이 멀리 있으면'});
const TYPES=['splitshot','shot','wave','dash','haste','timeburst','leap','dive',
 'shield','heal','zone','bolt','homing','pull','slash','blink','retreat'];
const cap=(v,a,b,f=a)=>Number.isFinite(Number(v))?Math.min(b,Math.max(a,Number(v))):f;
const fallback=()=>({when:'pulse',interval:1,action:{type:'splitshot',damage:16,
 count:4,radius:130,speed:5,duration:1.5,status:'none',link:'after'},fracture:2});
function rule(value){
 const v=value&&typeof value==='object'?value:{};
 const allowed=g.SkillForge?.TYPE||g.ActionRegistry?.TYPE||{};
 const type=Object.prototype.hasOwnProperty.call(allowed,v.action?.type)?v.action.type:'wave';
 const graph=g.CombatEventGraph?.normalize?.(v.eventGraph);
 // A serialized event graph is DATA, not an arbitrary executable program.
 // Derive all actions and their order from its validated whitelist.
 const eventSteps=graph?g.CombatEventGraph?.toSteps?.(graph):null;
 const eventFirst=eventSteps?.find(step=>step.kind==='cast')?.action;
 const action=eventFirst||g.SignatureScratch?.safeAction?.({...v.action,type})||
  {type,damage:12,radius:120,count:1};
 // A splitshot contains ONE source orb that shatters into count fragments.
 return {when:graph?.trigger||Object.hasOwn(WHEN,v.when)?(graph?.trigger||v.when):'pulse',
  interval:cap(v.interval,.35,4,1),
  fracture:type==='splitshot'?Math.round(cap(v.fracture,1,3,1)):1,
  ...(v.when==='wallStored'?{wallHits:Math.round(cap(v.wallHits,2,6,3))}:{}),
  ...(graph?{eventGraph:graph}:{}),
  action:{...action,damage:Math.round(cap(action.damage,0,120,18)),
   count:Math.round(cap(action.count,1,8,1))},
  ...(eventSteps?.length?{steps:eventSteps}:
    v.when!=='wallStored'&&Array.isArray(v.steps)&&g.FantasySkillGraph?
     {steps:g.FantasySkillGraph.normalize(v.steps)}:{})};
}
function normalize(value){
 const obj=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 return {version:1,window:cap(obj.window,4,18,10),
  rules:(Array.isArray(obj.rules)?obj.rules:[]).slice(0,8).map(rule)};
}
function preview(value){
 const normalized=normalize(value);
 const result=normalized.rules.map(r=>r.action);
 return result.length?result:[{type:'wave',damage:18,radius:120,count:1,status:'none'}];
}
function pressure(value,weight){
 const set=normalize(value),fn=typeof weight==='function'?weight:()=>0;
 // Every pulse has a bounded maximum per activation; events use a lower
 // prior, and all rules share a single-action-per-tick execution queue.
 const MAX_ACTIONS=g.SignatureRuleLive?.MAX_ACTIONS||80;
 const estimates=set.rules.map(r=>{
   // A single ruleset may emit 50+ actions in an 18-second burst. Use
   // the same per-rule cooldown floor and shared 80-action cap as RuleLive.
   const interval=Math.max(.35,r.interval);
   const ceiling=Math.ceil(set.window/interval);
   return r.when==='pulse'?ceiling:
    r.when==='wallStored'?Math.max(1,ceiling/Math.max(2,r.wallHits)):ceiling*.5;
 });
 const total=estimates.reduce((a,b)=>a+b,0);
 const scale=total>MAX_ACTIONS?MAX_ACTIONS/total:1;
 return set.rules.reduce((sum,r,i)=>{
  // Multi-stage authored graphs emit several actions per triggered event.
  // Account for those additional casts in automatic balance estimates.
  const multiplier=r.steps?.length?Math.max(1,g.FantasySkillGraph?.count?.(r.steps)||1):1;
  const factor=(r.action.type==='splitshot'?1+(r.fracture-1)*.38:1)*multiplier;
  if(r.eventGraph){
   // One authorization per 100-energy activation; count ALL defensive and
   // offensive stages, even when the first stage is a zero-damage shield.
   const all=(r.steps||[]).filter(x=>x.kind==='cast')
    .reduce((score,x)=>score+Math.max(0,Number(fn(x.action))||0),0);
   return sum+all/Math.max(1,set.window/5);
  }
  return sum+Math.max(0,Number(fn(r.action))||0)*estimates[i]*scale*factor/Math.max(1,set.window/5);
 },0);
}
g.SignatureRuleSkill=Object.freeze({WHEN,TYPES,normalize,preview,pressure,fallback});
})(typeof window!=='undefined'?window:globalThis);
