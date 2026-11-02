/* Single-card signature composer. Pure AST adapter; no storage or engine side effects.
 * Four ordered steps, at most six actual actions and a bounded power budget.
 * Existing complex programs are never flattened without an explicit choice. */
(function(g){'use strict';
const engine=g.SignatureScratch;
if(!engine)return;
const MAX_STEPS=4,MAX_ACTIONS=6,MAX_DAMAGE=65,MAX_PRESSURE=170;
const CONDITIONS=Object.freeze({always:'항상 실행',hpLow:'내 체력이 35% 이하일 때',near:'상대가 가까울 때',far:'상대가 멀리 있을 때',danger:'보스 공격 예고 중',dodge:'보스 패턴을 피한 뒤'});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
function parseNode(n){
 let condition='always',repeat=1,node=n;
 if(node?.kind==='if'){
  if(!CONDITIONS[node.condition]||node.else?.length||node.then?.length!==1)return null;
  condition=node.condition;node=node.then[0];
 }
 if(node?.kind==='repeat'){
  if(node.body?.length!==1||node.times<1||node.times>2)return null;
  repeat=node.times;node=node.body[0];
 }
 if(node?.kind!=='action')return null;
 return {action:{...node.action},condition,repeat};
}
function read(program){
 if(!Array.isArray(program))return null;
 const normalized=engine.normalize(program);
 if(normalized.length>MAX_STEPS)return null;
 const steps=normalized.map(parseNode);
 if(steps.some(step=>!step))return null;
 return steps;
}
function inspect(steps){
 if(!Array.isArray(steps)||steps.length>MAX_STEPS)return {ok:false,reason:'행동은 최대 4개입니다.'};
 let count=0,power=0;
 for(const step of steps){
  if(!step||!step.action||!CONDITIONS[step.condition]||![1,2].includes(step.repeat))
   return {ok:false,reason:'행동 조건이나 반복 횟수가 올바르지 않습니다.'};
  const a=step.action;count+=step.repeat;
  if(!g.SkillForge?.TYPE[a.type])return {ok:false,reason:'지원하지 않는 행동입니다.'};
  if(a.damage<0||a.damage>MAX_DAMAGE)return {ok:false,reason:'한 행동의 위력은 0~65입니다.'};
  power+=Math.max(0,Number(a.damage)||0)*step.repeat;
 }
 if(count>MAX_ACTIONS)return {ok:false,reason:'반복을 포함한 실행 행동은 최대 6개입니다.'};
 if(power>MAX_PRESSURE)return {ok:false,reason:'연계 위력 예산 '+MAX_PRESSURE+'을 초과했습니다. 위력이나 반복을 줄여 주세요.'};
 return {ok:true,count,power};
}
function build(steps){
 const check=inspect(steps);
 if(!check.ok)throw Error(check.reason);
 return engine.normalize(steps.map(step=>{
  let node={kind:'action',action:engine.safeAction(step.action)};
  if(step.repeat>1)node={kind:'repeat',times:step.repeat,body:[node]};
  if(step.condition!=='always')node={kind:'if',condition:step.condition,then:[node],else:[]};
  return node;
 }));
}
function flatten(program){
 const actions=engine.preview(program).slice(0,MAX_STEPS);
 const steps=actions.map(action=>({action:engine.safeAction({
  ...action,damage:clamp(action.damage,0,MAX_DAMAGE)
 }),condition:'always',repeat:1}));
 // A new simple draft must be within the visible budget before any write.
 let budget=MAX_PRESSURE;
 for(const step of steps){step.action.damage=Math.min(step.action.damage,budget);budget-=step.action.damage;}
 return steps;
}
g.SignatureSimpleDesigner=Object.freeze({MAX_STEPS,MAX_ACTIONS,MAX_DAMAGE,MAX_PRESSURE,CONDITIONS,read,inspect,build,flatten});
})(typeof window!=='undefined'?window:globalThis);
