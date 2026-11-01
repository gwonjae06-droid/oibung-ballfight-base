/* Scratch-style safe block AST; no JS evaluation, no arbitrary callbacks.
 * The AST is data, compiled into the game's existing bounded combat queue. */
(function(g){
'use strict';
const LIMIT=12,MAX_NODES=32,MAX_DEPTH=3,MAX_REPEAT=3;
const KINDS=Object.freeze({action:'행동',if:'만약 / 아니면',repeat:'반복',wait:'기다리기',
 waitUntil:'조건까지 기다리기',repeatUntil:'조건까지 반복',set:'변수 정하기',change:'변수 바꾸기'});
const clamp=(v,lo,hi,fallback)=>Number.isFinite(Number(v))?Math.max(lo,Math.min(hi,Number(v))):fallback;
const allowed=()=>g.ActionRegistry?.TYPE||g.SkillForge?.TYPE||{shot:'투사체',wave:'충격파',dash:'돌진',shield:'방어막'};
// Old saved 'basic attack landed' conditions cannot occur now that basic
 // attacks are removed; migrate to any authored skill's confirmed hit/status.
const cond=v=>g.SignatureProgram?.validCondition?.(
  v==='basicHit'?'hit':v==='basicStatus'?'status':v)||'always';
const safeAction=a=>{
 const map=allowed(),src=a&&typeof a==='object'?a:{};
 const type=Object.prototype.hasOwnProperty.call(map,src.type)?src.type:'wave';
 const status=g.SkillForge?.STATUS||{none:'',ice:'',fire:'',poison:''};
 const patterns=g.AbilityAtlas?.PATTERNS||{direct:''},targets=g.AbilityAtlas?.TARGETS||{nearest:''};
 return {type,pattern:patterns[src.pattern]?src.pattern:'direct',target:targets[src.target]?src.target:'nearest',
  damage:Math.round(clamp(src.damage,0,120,18)),radius:clamp(src.radius,30,300,120),
  count:Math.round(clamp(src.count,1,8,1)),speed:clamp(src.speed,2,14,5),
  duration:clamp(src.duration,.2,8,1.5),status:Object.hasOwn(status,src.status)?src.status:'none',
  knockback:clamp(src.knockback,0,9,2),delay:clamp(src.delay,0,2,0),
  ricochet:type==='shot'?Math.round(clamp(src.ricochet,0,3,0)):0,
  link:['and','after','with'].includes(src.link)?src.link:'after'};
};
function normalize(program){
 let nodes=0;
 function list(value,depth){
  if(!Array.isArray(value)||depth>MAX_DEPTH)return [];
  const out=[];
  for(const node of value){
   if(nodes>=MAX_NODES)break;
   if(!node||typeof node!=='object'||!Object.hasOwn(KINDS,node.kind))continue;
   nodes++;
   if(node.kind==='action')out.push({kind:'action',action:safeAction(node.action)});
   else if(node.kind==='wait')out.push({kind:'wait',seconds:clamp(node.seconds,.1,2,.4)});
   else if(node.kind==='repeat'||node.kind==='repeatUntil')out.push({kind:node.kind,condition:cond(node.condition),times:Math.round(clamp(node.times,1,MAX_REPEAT,2)),body:list(node.body,depth+1)});
   else if(node.kind==='waitUntil')out.push({kind:'waitUntil',condition:cond(node.condition),timeout:clamp(node.timeout,.5,5,3)});
   else if(node.kind==='set'||node.kind==='change')out.push({kind:node.kind,value:Math.round(clamp(node.value,-10,10,1))});
   else out.push({kind:'if',condition:cond(node.condition),then:list(node.then,depth+1),else:list(node.else,depth+1)});
  }
  return out;
 }
 return list(program,0);
}
function fromActions(actions){
 return normalize((actions||[]).slice(0,LIMIT).map(a=>
  a?.condition&&a.condition!=='always'?{kind:'if',condition:a.condition,then:[{kind:'action',action:a}],else:[]}:
  {kind:'action',action:a}));
}
function compile(program,p,target,options={}){
 const result=[],max=Math.min(LIMIT,Math.max(1,Number(options.limit)||LIMIT));
 let seconds=0,visited=0;
 const check=options.condition||((id)=>g.SignatureProgram?.condition?.(p,target,id)!==false);
 function walk(blocks,depth){
  if(depth>MAX_DEPTH||result.length>=max)return;
  for(const node of blocks){
   if(result.length>=max||visited++>96)break;
   if(node.kind==='wait'){seconds=Math.min(8,seconds+node.seconds);continue;}
   if(node.kind==='waitUntil'||node.kind==='set'||node.kind==='change')continue;
   if(node.kind==='if'){walk(check(node.condition)?node.then:node.else,depth+1);continue;}
   if(node.kind==='repeat'||node.kind==='repeatUntil'){for(let j=0;j<node.times&&result.length<max;j++)walk(node.body,depth+1);continue;}
   if(node.kind==='action'){
    const a={...node.action};
    a.delay=Math.min(8,Math.max(seconds,a.delay||0));
    if(result.length>0&&a.link==='with'&&seconds>0)a.link='after';
    result.push(a);
   }
  }
 }
 walk(normalize(program),0);
 return result;
}
function worstPressure(program,weight){
 const score=typeof weight==='function'?weight:()=>0;
 function walk(list){
  return list.reduce((sum,node)=>{
   if(node.kind==='action')return sum+Math.max(0,Number(score(node.action))||0);
   if(node.kind==='if')return sum+Math.max(walk(node.then),walk(node.else));
   if(node.kind==='repeat'||node.kind==='repeatUntil')return sum+node.times*walk(node.body);
   return sum;
  },0);
 }
 return walk(normalize(program));
}
function preview(program){return compile(program,null,null,{condition:()=>true});}
function random(rng=Math.random){
 const pick=a=>a[Math.floor(Math.max(0,Math.min(.999999,rng()))*a.length)];
 const start=pick(['shot','wave','slash','bolt','homing','zone','nova']);
 const finish=pick(['beam','shot','chain','meteor','wave','uppercut']);
 const make=(type,damage)=>({kind:'action',action:{type,damage,radius:120,count:1,speed:5,duration:1.5,status:'none',knockback:2,link:'after'}});
 const head=pick(['dash','blink','retreat','shield']);
 const condition=pick(['danger','near','hpLow','far']);
 return normalize([
   {kind:'action',action:{...make(start,23).action,link:'and'}},
   {kind:'if',condition,then:[make(head,0),{kind:'wait',seconds:.3},make(finish,29)],else:[make(pick(['shield','wave','shot','retreat']),18)]},
   {kind:'repeat',times:2,body:[make(pick(['shot','wave','bolt','arcshot']),14)]}
 ]);
}
g.SignatureScratch=Object.freeze({LIMIT,MAX_NODES,MAX_DEPTH,MAX_REPEAT,KINDS,normalize,fromActions,compile,preview,worstPressure,random,safeAction});
})(typeof window!=='undefined'?window:globalThis);
