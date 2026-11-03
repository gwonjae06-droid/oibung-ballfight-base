/* Fantasy Skill Graph v1 — declarative, bounded multi-stage skill execution.
 * Data-only DSL: CAST, MORPH, TUNE, WAIT, IF, REPEAT. No JS/eval.
 * The existing combat engine still owns all hit, physics and object budgets.
 */
(function(g){'use strict';
const MAX_NODES=36,MAX_DEPTH=3,MAX_PENDING=48,MAX_CASTS=24;
const KINDS=Object.freeze({cast:'공격·행동',morph:'형태 변화',tune:'능력 변형',
 wait:'대기',if:'조건 분기',repeat:'반복'});
const FIELDS=Object.freeze({damage:[0,120],radius:[30,300],count:[1,8],
 speed:[2,14],duration:[.2,8],knockback:[0,9]});
const clamp=(v,a,b,f=a)=>Number.isFinite(Number(v))?
 Math.min(b,Math.max(a,Number(v))):f;
const cleanAction=value=>g.SignatureScratch?.safeAction?.(value)||{
 ...value,type:g.SkillForge?.TYPE?.[value?.type]?value.type:'wave',
 damage:clamp(value?.damage,0,120,18),radius:clamp(value?.radius,30,300,120),
 count:clamp(value?.count,1,8,1)};
function normalize(steps){
 let visited=0;
 function walk(list,depth){
  if(depth>MAX_DEPTH||!Array.isArray(list))return [];
  const out=[];
  for(const raw of list){
   if(visited++>=MAX_NODES||!raw||typeof raw!=='object')break;
   if(!Object.hasOwn(KINDS,raw.kind))continue;
   if(raw.kind==='cast')out.push({kind:'cast',action:cleanAction(raw.action)});
   else if(raw.kind==='morph'){
    const visual=g.MetaphorVisuals?.normalize?.(raw.visual);
    if(visual)out.push({kind:'morph',visual});
   }else if(raw.kind==='wait')out.push({kind:'wait',seconds:clamp(raw.seconds,.05,2,.25)});
   else if(raw.kind==='tune'&&Object.hasOwn(FIELDS,raw.field)){
    out.push({kind:'tune',field:raw.field,operator:
     ['add','multiply','set'].includes(raw.operator)?raw.operator:'multiply',
     value:clamp(raw.value,-120,120,1)});
   }else if(raw.kind==='if')out.push({kind:'if',
    condition:g.SignatureProgram?.validCondition?.(raw.condition)||'always',
    then:walk(raw.then,depth+1),else:walk(raw.else,depth+1)});
   else if(raw.kind==='repeat')out.push({kind:'repeat',
    times:Math.round(clamp(raw.times,1,4,2)),body:walk(raw.body,depth+1)});
  }
  return out;
 }
 return walk(steps,0);
}
function compile(steps,actor,target,condition){
 const result=[],maximum=MAX_PENDING;
 const check=condition||((id)=>g.SignatureProgram?.condition?.(actor,target,id)!==false);
 let nodes=0,casts=0;
 function visit(list,depth){
  if(depth>MAX_DEPTH||result.length>=maximum)return;
  for(const item of list){
   if(result.length>=maximum||nodes++>=128||casts>=MAX_CASTS)return;
   if(item.kind==='if'){visit(check(item.condition)?item.then:item.else,depth+1);continue;}
   if(item.kind==='repeat'){
    for(let j=0;j<item.times&&result.length<maximum&&casts<MAX_CASTS;j++)
      visit(item.body,depth+1);
    continue;
   }
   if(item.kind==='cast')casts++;
   result.push(item);
  }
 }
 visit(normalize(steps),0);
 return result;
}
function applyTune(action,tune){
 if(!action||!tune||!Object.hasOwn(FIELDS,tune.field))return action;
 const [min,max]=FIELDS[tune.field],field=tune.field;
 const current=Number(action[field]);
 if(!Number.isFinite(current))return action;
 const value=tune.operator==='add'?current+tune.value:
  tune.operator==='set'?tune.value:current*tune.value;
 return {...action,[field]:field==='count'?Math.round(clamp(value,min,max)):clamp(value,min,max)};
}
function evaluate(pending,context){
 const {clock,actor}=context;
 if(context.waitUntil>clock)return null;
 let hops=0;
 while(pending.length&&hops++<MAX_PENDING){
  const step=pending.shift();
  if(step.kind==='wait'){context.waitUntil=clock+Math.round(step.seconds*60);return null;}
  if(step.kind==='morph'){context.visual=step.visual;continue;}
  if(step.kind==='tune'){context.tunes.push(step);continue;}
  if(step.kind==='cast'){
   let action={...step.action};
   for(const tune of context.tunes)action=applyTune(action,tune);
   if(context.visual&&!action.visual)action.visual=context.visual;
   // On return to the main world only an already-authorized action travels.
   return action;
  }
 }
 return null;
}
function fromText(sentence,options={}){
 const raw=String(sentence||'').trim();
 // Do not turn separate reactive wall/hit/guard rules into unconditional casts.
 if(/벽.*(?:튕|부딪)|상대.*(?:부딪|충돌)|(?:맞으면|적중하면|명중하면|피격하면|회피하면|방어하면|분열하면|착지하면)|체력.*(?:낮|부족)/.test(raw))return [];
 const parts=raw.split(/\s*(?:,\s*그리고|그리고|그\s*다음(?:에는)?|그\s*후|그\s*뒤|이어서|뒤이어|그런\s*다음)\s*/).filter(Boolean);
 if(parts.length<2||parts.length>6)return [];
 const supported=options.types||g.SkillForge?.TYPE||g.ActionRegistry?.TYPE||{};
 const fallback=options.action||{type:'wave',damage:18,radius:120};
 const all=[];
 for(const part of parts){
  const metaphor=g.MetaphorVisuals?.interpret?.(part);
  const recognized=g.NaturalForge?.recognize?.(part)||[];
  const grammar=g.KoreanSkillGrammar?.pickType?.(part,supported);
  const type=metaphor?.type&&Object.hasOwn(supported,metaphor.type)?
   metaphor.type:grammar?.type||
   recognized.find(x=>Object.hasOwn(supported,x.type))?.type;
  if(!type)return [];
  const fx=g.SkillFXComposer?.infer?.(part);
  const visual=g.MetaphorVisuals?.normalize?.({
   ...(metaphor?.visual||{shape:'aura'}),
   color:metaphor?.visual?.color||fx?.color,
   scale:Math.max(metaphor?.visual?.scale||1,fx?.scale||1),
   charge:!!metaphor?.visual?.charge||!!fx?.charge,
   layers:[...(metaphor?.visual?.layers||[]),...(fx?.layers||[])]
  });
  if(visual)all.push({kind:'morph',visual});
  const a={...fallback,type,visual,damage:
   ['haste','leap','blink','dash','shield','timestop'].includes(type)?0:
    fallback.damage??18};
  all.push({kind:'cast',action:a});
  // Short, explicit gaps between stages are meaningful; the loop is bounded.
  if(part!==parts[parts.length-1]){
   const delay=part.match(/(\d+(?:\.\d+)?)\s*초\s*(?:뒤|후|대기)/);
   if(delay)all.push({kind:'wait',seconds:clamp(delay[1],.05,2,.25)});
  }
 }
 return normalize(all);
}
function count(steps){return compile(steps,null,null,()=>true).filter(x=>x.kind==='cast').length;}
g.FantasySkillGraph=Object.freeze({KINDS,FIELDS,MAX_NODES,MAX_DEPTH,MAX_PENDING,MAX_CASTS,
 normalize,compile,evaluate,applyTune,fromText,count});
})(typeof window!=='undefined'?window:globalThis);
