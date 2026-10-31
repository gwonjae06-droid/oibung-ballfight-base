/* A bounded live interpreter for Scratch-style fighter programs.
 * Instructions run during simulation ticks, not all at cast time.
 * No eval, JS source execution, or access to arbitrary game objects.
 */
(function(g){
'use strict';
const MAX_TICKS=900,MAX_ACTIONS=12,MAX_INSTRUCTIONS=64;
const fresh=()=>Object.create(null);
function snapshot(p){
 const out=fresh();
 for(const [key,v] of Object.entries(p?._scratchEvents||{}))out[key]=v.count||0;
 return out;
}
function record(p,event){
 if(!p||!p.forge||p.forge.signatureVersion!==1)return;
 const events=p._scratchEvents||=(fresh());
 const tick=Number(p._forgeActionClock)||0;
 const current=events[event]||{count:0,frame:-100};
 if(current.frame===tick)return; // AoE and rapid bullets count once per tick.
 events[event]={count:current.count+1,frame:tick};
}
function observed(p,event,baseline){
 const info=p?._scratchEvents?.[event];
 return !!info&&info.count>(baseline?.[event]||0);
}
function condition(p,target,id,run){
 if(id==='hit'||id==='guard'||id==='move'||id==='status'||id==='dodge'||id==='basicHit'||id==='basicStatus'){
   if(id==='dodge'&&Number(p?._forgeDodgeSerial||0)>Number(run?.dodgeBaseline||0))return true;
   return observed(p,id,run?.baseline);
 }
 if(id==='charge3')return (run?.charge||0)>=3;
 return g.SignatureProgram?.condition?.(p,target,id)??true;
}
function begin(program,p,trigger=null){
 const nodes=g.SignatureScratch?.normalize?.(program)||[];
 if(!nodes.length)return null;
 const baseline=snapshot(p);
 // If this skill was triggered by a basic hit/status, allow its first
 // Scratch condition to see that confirmed event on the starting frame.
 if(trigger==='basicHit'||trigger==='basicStatus')
  baseline[trigger]=Math.max(0,(baseline[trigger]||0)-1);
 return {stack:[{nodes,index:0}],wait:0,until:null,pending:false,
  ticks:0,actions:0,charge:Math.max(0,Math.min(10,Number(p?._scratchCharge)||0)),finished:false,baseline,
  dodgeBaseline:Number(p?._forgeDodgeSerial)||0};
}
function stop(run){if(run)run.finished=true;}
function step(run,p,target){
 if(!run||run.finished||run.pending)return null;
 if(++run.ticks>MAX_TICKS){stop(run);return null;}
 if(run.wait>0){run.wait--;return null;}
 if(run.until){
  if(condition(p,target,run.until.id,run)){run.until=null;}
  else if(--run.until.remaining<=0){stop(run);return null;}
  else return null;
 }
 let budget=MAX_INSTRUCTIONS;
 while(budget-->0&&!run.finished){
  if(run.actions>=MAX_ACTIONS||!run.stack.length){stop(run);return null;}
  const frame=run.stack[run.stack.length-1];
  if(frame.index>=frame.nodes.length){
   if(frame.repeat&&frame.remaining>1&&(!frame.until||!condition(p,target,frame.until,run))){
    frame.remaining--;frame.index=0;continue;
   }
   run.stack.pop();continue;
  }
  const node=frame.nodes[frame.index++];
  if(node.kind==='action'){
   run.actions++;run.pending=true;
   return {...node.action};
  }
  if(node.kind==='wait'){
   run.wait=Math.max(1,Math.round(node.seconds*60));return null;
  }
  if(node.kind==='waitUntil'){
   if(!condition(p,target,node.condition,run)){
    run.until={id:node.condition,remaining:Math.min(300,Math.max(30,Math.round(node.timeout*60)))};
    return null;
   }
   continue;
  }
  if(node.kind==='set'||node.kind==='change'){
   run.charge=Math.max(0,Math.min(10,node.kind==='set'?node.value:run.charge+node.value));
   p._scratchCharge=run.charge;continue;
  }
  if(node.kind==='if'){
   const side=condition(p,target,node.condition,run)?node.then:node.else;
   if(side.length)run.stack.push({nodes:side,index:0});continue;
  }
  if(node.kind==='repeat'||node.kind==='repeatUntil'){
   const times=Math.min(3,Math.max(1,node.times||3));
   if(node.kind==='repeatUntil'&&condition(p,target,node.condition,run))continue;
   if(node.body.length)run.stack.push({nodes:node.body,index:0,repeat:true,remaining:times,
     until:node.kind==='repeatUntil'?node.condition:null});continue;
  }
 }
 if(budget<=0)stop(run);
 return null;
}
function performed(run){if(run)run.pending=false;}
function beginMove(p,action){
 if(!p?.forge||p.forge.signatureVersion!==1)return;
 p._scratchMove={start:Number(p._forgeActionClock)||0,
   deadline:(Number(p._forgeActionClock)||0)+Math.min(180,Math.max(5,Math.round((Number(action.duration)||.2)*60)))};
}
function tickMove(p){
 const move=p?._scratchMove;
 if(!move)return;
 const frame=Number(p._forgeActionClock)||0;
 if(frame<=move.start)return;
 if(!(p.forgeDash>0)&&(!(p.movementOnlyFrames>0)||frame>=move.deadline)){
  record(p,'move');p._scratchMove=null;
 }else if(frame>=move.deadline+30)p._scratchMove=null;
}
g.SignatureLive=Object.freeze({begin,step,performed,record,observed,condition,beginMove,tickMove,stop});
})(typeof window!=='undefined'?window:globalThis);
