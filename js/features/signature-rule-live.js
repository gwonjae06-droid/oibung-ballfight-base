/* Simulation-clock rule coroutine: persistent reactions without infinite loops.
 * One emitted action at a time, max 80 per 100-energy activation. */
(function(g){'use strict';
const MAX_ACTIONS=80;
function begin(config,p){
 const skill=g.SignatureRuleSkill?.normalize?.(config);
 if(!skill?.rules?.length)return null;
 const now=Number(p?._forgeActionClock)||0;
 const observed=skill.rules.map(r=>r.when==='wallStored'?
  g.WallImpactStore?.serial?.(p)||0:r.when==='dodge'?
  Number(p?._forgeDodgeSerial)||0:(p?._scratchEvents?.[r.when]?.count)||0);
 return {rules:skill.rules,window:Math.round(skill.window*60),clock:0,actions:0,
  nextAt:skill.rules.map(()=>0),seen:observed,startedAt:now,finished:false,cursor:0,
  pending:[],waitUntil:0,visual:null,tunes:[],
  wallCharge:skill.rules.map(()=>({count:0,impulse:0}))};
}
function step(run,p,target){
 if(!run||run.finished||!p||p.hp<=0)return null;
 if(++run.clock>run.window||run.actions>=MAX_ACTIONS){run.finished=true;return null;}
 const graph=g.FantasySkillGraph;
 if(run.pending?.length){
  const action=graph?.evaluate?.(run.pending,{
   get clock(){return run.clock;},get waitUntil(){return run.waitUntil;},
   set waitUntil(value){run.waitUntil=value;},
   get visual(){return run.visual;},set visual(value){run.visual=value;},
   tunes:run.tunes,actor:p});
  if(action){run.actions++;return action;}
  // Waits and explicit stages must complete before the next graph trigger.
  if(run.pending.length||run.waitUntil>run.clock)return null;
 }
 for(let t=0;t<run.rules.length;t++){
  const i=(run.cursor+t)%run.rules.length,r=run.rules[i];
  if(run.clock<run.nextAt[i])continue;
  const when=r.when;
  // This condition listens to accepted physical arena-wall bounces,
  // not to generic hit VFX or a fixed timer masquerading as a collision.
  if(when==='wallStored'){
   const events=g.WallImpactStore?.since?.(p,run.seen[i],run.startedAt)||[];
   if(events.length){
    run.seen[i]=events[events.length-1].seq;
    const charge=run.wallCharge[i];
    charge.count=Math.min(12,charge.count+events.length);
    for(const event of events)charge.impulse=Math.min(200,
      charge.impulse+Math.max(0,Number(event.impulse)||0));
   }
   if(run.wallCharge[i].count<r.wallHits)continue;
  }
  const isState=when==='hpLow'||when==='near'||when==='far';
  const current=when==='dodge'?Number(p._forgeDodgeSerial)||0:
   (p._scratchEvents?.[when]?.count||0);
  if(isState){
   if(when==='hpLow'&&(p.hp/Math.max(1,p.maxHp||p.hp))>.4)continue;
   if(when==='near'&&(!target||Math.hypot(p.x-target.x,p.y-target.y)>130))continue;
   if(when==='far'&&(!target||Math.hypot(p.x-target.x,p.y-target.y)<130))continue;
  }else if(when!=='pulse'&&when!=='wallStored'&&current<=run.seen[i])continue;
  const delta=Math.max(21,Math.round(r.interval*60));
  run.nextAt[i]=run.clock+delta;
  if(!isState&&when!=='pulse'&&when!=='wallStored')run.seen[i]=current;
  run.cursor=(i+1)%run.rules.length;
  if(r.steps?.length&&graph){
   run.pending=graph.compile(r.steps,p,target);
   run.visual=null;run.tunes=[];run.waitUntil=0;
   const result=graph.evaluate(run.pending,{
    get clock(){return run.clock;},get waitUntil(){return run.waitUntil;},
    set waitUntil(value){run.waitUntil=value;},
    get visual(){return run.visual;},set visual(value){run.visual=value;},
    tunes:run.tunes,actor:p});
   if(result){run.actions++;return result;}
   return null;
  }
  run.actions++;
  const a={...r.action};
  if(when==='wallStored'){
   const charge=run.wallCharge[i],total=charge.impulse;
   // The stored normal impulse changes damage only after the Nth real
   // bounce. This is deliberately capped by the same authored damage cap.
   a.damage=Math.min(120,Math.round((Number(a.damage)||0)*
     (1+Math.min(.6,total/(Math.max(2,r.wallHits)*20)))));
   a.storedImpact={hits:charge.count,impulse:Math.round(total*100)/100};
   run.wallCharge[i]={count:0,impulse:0};
  }
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
