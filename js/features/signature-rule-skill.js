/* Safe declarative skill rules. No arbitrary JS, no recursive execution.
 * A 100-momentum activation runs bounded reactions for a fixed time window. */
(function(g){'use strict';
const WHEN=Object.freeze({pulse:'일정 시간마다',wall:'벽에 튕기면',contact:'상대와 충돌하면',
 land:'착지하면',hit:'공격이 맞으면',split:'탄환이 분열하면'});
const TYPES=['splitshot','shot','wave','dash','haste','timeburst','leap','dive',
 'shield','heal','zone','bolt','homing','pull','slash','blink','retreat'];
const cap=(v,a,b,f=a)=>Number.isFinite(Number(v))?Math.min(b,Math.max(a,Number(v))):f;
const fallback=()=>({when:'pulse',interval:1,action:{type:'splitshot',damage:16,
 count:4,radius:130,speed:5,duration:1.5,status:'none',link:'after'},fracture:2});
function rule(value){
 const v=value&&typeof value==='object'?value:{};
 const allowed=g.SkillForge?.TYPE||g.ActionRegistry?.TYPE||{};
 const type=Object.prototype.hasOwnProperty.call(allowed,v.action?.type)?v.action.type:'wave';
 const action=g.SignatureScratch?.safeAction?.({...v.action,type})||{type,damage:12,radius:120,count:1};
 // A splitshot contains ONE source orb that shatters into count fragments.
 return {when:Object.hasOwn(WHEN,v.when)?v.when:'pulse',
  interval:cap(v.interval,.35,4,1),
  fracture:type==='splitshot'?Math.round(cap(v.fracture,1,3,1)):1,
  action:{...action,damage:Math.round(cap(action.damage,0,120,18)),
   count:Math.round(cap(action.count,1,8,1))}};
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
 return set.rules.reduce((sum,r)=>{
  const count=r.when==='pulse'?Math.min(18,set.window/r.interval):
   Math.min(12,set.window/r.interval)*.5;
  const factor=r.action.type==='splitshot'?1+(r.fracture-1)*.38:1;
  return sum+Math.max(0,Number(fn(r.action))||0)*count*factor/Math.max(1,set.window/5);
 },0);
}
g.SignatureRuleSkill=Object.freeze({WHEN,TYPES,normalize,preview,pressure,fallback});
})(typeof window!=='undefined'?window:globalThis);
