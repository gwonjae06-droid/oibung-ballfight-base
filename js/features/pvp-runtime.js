/* Isolated copy of the original combat engine; no wallet, UI scheduler or saves. */
(function(global){
'use strict';
updateUI=()=>{};syncStopButton=()=>{};
global.settleRound=()=>{};
let current=null,accumulator=0,remote=false,targets=null,lastPaint=0;
let lastSimAt=0,lastSnapshotAt=0,lastSteerAt=0,lastStateSeq=-1;
let steer=null,fxOutbox=[],fxSequence=0,remoteFxSequence=0,preview=null,fxFrameCarry=0;
let fxWake=null;
function setFxWake(fn){fxWake=typeof fn==='function'?fn:null;}
function captureFx(effect,owner){
  if(remote||!current||current.ended)return;
  const src=players.indexOf(owner);
  if(fxOutbox.length>=128)fxOutbox.shift();
  fxOutbox.push({
    id:++fxSequence,owner:src,follow:!!effect.source,
    type:effect.type,kind:effect.kind,x:effect.x,y:effect.y,
    angle:effect.angle,radius:effect.radius,color:effect.color,
    life:effect.life,scale:effect.scale
  });
  fxWake?.();
}
function drainFx(max=24){return fxOutbox.splice(0,Math.min(24,Math.max(1,max)));}
// Called as soon as a remote effect event arrives, not on the next
// infrequent world snapshot. All 55 authored visual types use their original renderer.
function receiveFx(events){
  if(!Array.isArray(events))return 0;
  remote=true;
  let count=0;
  for(const e of events.slice(0,24)){
    if(!Number.isInteger(e?.id)||e.id<=remoteFxSequence)continue;
    remoteFxSequence=e.id;
    // An optimistic local manual cast was already drawn at keydown.
    if(preview&&e.kind==='cast'&&e.owner===1&&e.type===preview.type&&
      Date.now()-preview.time<650){preview=null;continue;}
    if(SkillVisuals.replay(e,players))count++;
  }
  return count;
}
function previewCast(index,slot){
  if(index!==1||!remote||!current||current.ended)return false;
  const p=players[index],action=p?.forge?.skills?.[slot]?.actions?.[0];
  if(!p?.onlineManual||!action)return false;
  if(!SkillVisuals.cast(p,action,players[0]))return false;
  preview={type:action.type,time:Date.now()};
  return true;
}
const baseUpdate=updateCharacter;
updateCharacter=function(p){
 if(!p.onlineManual)return baseUpdate(p);
 const target=getClosestAliveEnemy(p);
 if(ForgeExpansion.blocked(p)){SkillForge.advanceTimers(p);SkillForge.advanceWorld(p,target);return;}
 if(!(p.forgeDash>0)){
   const speed=Math.max(.6,Math.min(5,Number(p.forge?.speed)||2.4));
   p.vx=(p.inputX||0)*speed;p.vy=(p.inputY||0)*speed;
  }
 SkillForge.manualUpdate(p,target);
};
const baseDraw=drawCharacter;
drawCharacter=p=>{if(p.forge)SkillForge.drawFighter(p);baseDraw(p);};
// Cache the detailed Tower scene at its native canvas resolution.
let stageCache=null,stageWidth=0,stageHeight=0;
global.ArenaTower={paintBackground:(c,s)=>{
 if((!stageCache||stageWidth!==s.width||stageHeight!==s.height)&&
    typeof document.createElement==='function'){
   const cached=document.createElement('canvas');
   cached.width=s.width;cached.height=s.height;
   const cachedCtx=cached.getContext?.('2d');
   if(cachedCtx){
     ArenaTowerScenes.paint(cachedCtx,s.width,s.height,1);
     stageCache=cached;stageWidth=s.width;stageHeight=s.height;
   }
 }
 if(stageCache&&typeof c.drawImage==='function'){
   c.drawImage(stageCache,0,0);return true;
 }
 return ArenaTowerScenes.paint(c,s.width,s.height,1);
}};
function createRoom(a,b,mode,now,modes){
 AdvancedCombat.reset();SkillVisuals.clear();CUSTOM_DEFS.forEach(d=>delete BEHAVIORS[d.id]);CUSTOM_DEFS.length=0;
 const defs=[a,b].map(raw=>{
  if(raw.skills){const id=SkillForge.register(raw);return CUSTOM_DEFS.find(d=>d.id===id);}
  const def=CHARACTER_DEFS.find(d=>d.id===raw.id);if(!def)throw Error('Unknown fighter');return def;
 });
 players=placeFighters(defs);particles=[];floatingTexts=[];shockwaves=[];
 openingCollisionPairs.clear();isPlaying=true;isGameOver=false;roundStarted=true;
 players.forEach((p,i)=>{
  p.onlineManual=modes[i]==='manual'||modes.includes('blitz');
  if(p.onlineManual)SkillForge.enableManual(p);
 });
 remote=false;targets=null;steer=null;lastPaint=0;accumulator=0;
 lastSimAt=0;lastSnapshotAt=0;lastSteerAt=0;lastStateSeq=-1;
 global.ArenaMotion?.reset?.(players);
 fxOutbox=[];fxSequence=0;remoteFxSequence=0;preview=null;fxFrameCarry=0;
 current={players,started:now,elapsed:0,ended:false,winner:null,modes,pending:[]};
 if(modes.includes('blitz'))current.blitz={
   phase:'plan',round:1,turn:0,maxTurns:24,deadline:now+10000,
   plans:[null,null],resolved:null,secondDone:false,executionEnd:0
 };
 SkillVisuals.setSpawnListener(captureFx);
 return current;
}
function setInput(room,i,msg,now=Date.now()){
 if(room.blitz)return false; // Disable direct steering in turn-based matches.
 const p=players[i];if(!p?.onlineManual||room.ended)return false;
 let x=Number.isFinite(Number(msg.x))?Number(msg.x):0,y=Number.isFinite(Number(msg.y))?Number(msg.y):0,n=Math.max(1,Math.hypot(x,y));
 p.inputX=x/n;p.inputY=y/n;p.inputAt=now;return true;
}
function cast(room,i,slot,fromPlan=false){return !room.ended&&(!room.blitz||fromPlan)&&!!players[i]?.onlineManual&&SkillForge.manualCast(players[i],slot,getClosestAliveEnemy(players[i]));}
// Turn-based Blitz: alternate owners; the host resolves each short action
// using the existing combat engine. Both cooldowns freeze during planning.
function normalizePlan(raw){
 const allowed=['approach','retreat','left','right','hold'];
 const move=allowed.includes(raw?.move)?raw.move:'hold';
 const slots=Array.isArray(raw?.slots)?raw.slots.slice(0,2).map(Number)
   .filter(x=>Number.isInteger(x)&&x>=0&&x<4):[];
 return {move,slots:[...new Set(slots)]};
}
function submitPlan(room,index,raw,now=Date.now()){
 const b=room.blitz;
 if(!b||room.ended||b.phase!=='plan'||index!==b.turn||
    b.plans[index]||raw?.round!==b.round||now>b.deadline)return false;
 if(room.modes[index]!=='blitz')return false;
 b.plans[index]=normalizePlan(raw);
 return true;
}
function autoPlan(room,index){
 const p=players[index],e=players[1-index],distance=Math.hypot(p.x-e.x,p.y-e.y);
 const slots=(p.forge?.skills||[])
  .map((skill,j)=>({j,ready:(p.forgeTicks[j]||0)>=SkillForge.cooldownFrames(p,skill)}))
  .filter(item=>item.ready).slice(0,2).map(item=>item.j);
 return {move:distance<95?'retreat':'approach',slots};
}
function beginBlitzExecution(room,b,now){
 const i=b.turn,p=players[i],e=players[1-i],plan=b.plans[i]||{move:'hold',slots:[]};
 b.resolved=plan;b.phase='execute';b.executionEnd=now+1350;
 b.secondAt=now+500;b.secondDone=false;
 for(const fighter of players){
  fighter.inputX=0;fighter.inputY=0;fighter.vx=0;fighter.vy=0;
 }
 const distance=Math.hypot(e.x-p.x,e.y-p.y)||1,dx=(e.x-p.x)/distance,dy=(e.y-p.y)/distance;
 const move=plan.move,dir=move==='retreat'?-1:move==='hold'?0:1;
 p.inputX=move==='left'?-dy:move==='right'?dy:dx*dir;
 p.inputY=move==='left'?dx:move==='right'?-dx:dy*dir;
 p.inputAt=now;
 if(move==='hold')p.invincible=Math.max(p.invincible||0,18);
 if(plan.slots.length)cast(room,i,plan.slots[0],true);
}
function finishBlitz(room){
 room.ended=true;isPlaying=false;isGameOver=true;
 room.winner=players[0].hp===players[1].hp?-1:players[0].hp>players[1].hp?0:1;
}
function blitzTick(room,now){
 const b=room.blitz;if(!b)return true;
 if(b.phase==='plan'){
  if(room.modes[b.turn]==='auto'&&!b.plans[b.turn])b.plans[b.turn]=autoPlan(room,b.turn);
  if(b.plans[b.turn]||now>=b.deadline)beginBlitzExecution(room,b,now);
  else return false;
 }
 if(b.phase==='execute'){
  if(!b.secondDone&&now>=b.secondAt){
   b.secondDone=true;
   if(b.resolved.slots.length>1)cast(room,b.turn,b.resolved.slots[1],true);
  }
  if(now>=b.executionEnd){
   if(b.round>=b.maxTurns){finishBlitz(room);return false;}
   b.round++;b.turn=1-b.turn;b.phase='plan';b.deadline=now+10000;
   b.plans=[null,null];b.resolved=null;b.secondDone=false;
   for(const p of players){p.inputX=0;p.inputY=0;p.vx=0;p.vy=0;}
   return false;
  }
 }
 return true;
}
function step(room,dt,now){
 if(room.ended)return;
 if(!blitzTick(room,now))return;
 accumulator+=dt;
 while(accumulator>=1/60&&!isGameOver){
  players.forEach(p=>{if(p.onlineManual&&!room.blitz&&now-(p.inputAt||0)>700)p.inputX=p.inputY=0;});
  global.ArenaMotion?.capture?.(players);
  update();SkillVisuals.tick();accumulator-=1/60;room.elapsed+=1/60;
 }
 lastSimAt=Date.now();
 if(isGameOver||room.elapsed>=120){room.ended=true;isPlaying=false;isGameOver=true;
  room.winner=players[0].hp===players[1].hp?-1:players[0].hp>players[1].hp?0:1;}
}
// Explicit references keep projectile owners, targets and hit sets intact.
function encode(value,root=false,seen=new Set()){
 if(!root&&players.includes(value))return {$fighter:players.indexOf(value)};
 if(value===null||typeof value!=='object')return typeof value==='function'?undefined:value;
 if(value instanceof Set)return {$set:[...value].map(v=>encode(v,false,seen))};
 if(seen.has(value))return undefined;seen.add(value);
 const out=Array.isArray(value)?[]:{};
 for(const k of Object.keys(value)){if(k==='forge')continue;const v=encode(value[k],false,seen);if(v!==undefined)out[k]=v;}
 seen.delete(value);return out;
}
function decode(v){
 if(!v||typeof v!=='object')return v;
 if('$fighter'in v)return players[v.$fighter];if('$set'in v)return new Set(v.$set.map(decode));
 const out=Array.isArray(v)?[]:{};for(const k of Object.keys(v))out[k]=decode(v[k]);return out;
}
// Heavy effect data is transferred only 2 times per second. Frequent
// position, HP and cooldown updates stay small and interpolate smoothly.
function snapshot(room,full=true){
 const b=room.blitz;
 const state={type:'state',clock:Math.max(0,120-room.elapsed),finished:room.ended,winner:room.winner,
  ...(b?{blitz:{phase:b.phase,round:b.round,turn:b.turn,maxTurns:b.maxTurns,
    remainingMs:Math.max(0,(b.phase==='plan'?b.deadline:b.executionEnd)-Date.now()),
    submitted:b.plans.map(Boolean)}}:{}),
  players:players.map((p,i)=>({x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,name:p.name,
   color:p.themeColor,mode:room.modes[i],
   ...(Math.abs(global.AdvancedCombat?.height?.(p)||0)>.5?
      {h:Math.round(global.AdvancedCombat.height(p)*10)/10}:{}),
   ...(p.jumpState&&p.jumpState!=='ground'?{j:p.jumpState}:{}),
   ...(global.ArenaTelegraph?.preview?.(p)?.length?
     {previews:global.ArenaTelegraph.preview(p)}:{}),
   charge:p.forgeCharge?{phase:p.forgeCharge.phase,ticks:p.forgeCharge.ticks,total:p.forgeCharge.total,
     expires:p.forgeCharge.expires,flash:p.forgeCharge.flash}:null,
   skills:p.forge?.skills.slice(0,4).map(s=>({name:s.name}))||[],
   cooldowns:p.forge?.skills.slice(0,4).map((s,j)=>
     Math.max(0,(SkillForge.cooldownFrames(p,s)-(p.forgeTicks[j]||0))/60))||[]}))};
 if(full){
   const take=(a,n)=>Array.isArray(a)?a.slice(-n):[];
   state.world={
     // Spawn events are delivered instantly via the 'fx' broadcast. Never
     // overwrite the guest's playing effect pool with a stale 600ms snapshot.
     // Only animated objects are needed remotely. Sending all player
     // internals (queues, caches, links) created huge packets and frame stalls.
     visualPlayers:players.map(p=>({
       forgeShots:encode(take(p.forgeShots,20)),
       forgeZones:encode(take(p.forgeZones,20)),
       forgeOrbs:encode(take(p.forgeOrbs,12)),
       waves:encode(take(p.waves,12)),
       projectiles:encode(take(p.projectiles,20)),
       poisonTears:encode(take(p.poisonTears,12)),
       forgeDash:Number(p.forgeDash)||0,
       jumpState:p.jumpState||'ground'
     })),
     objects:encode(take(AdvancedCombat.objects,24)),
     projectiles:encode(take(AdvancedCombat.projectiles,36)),
     effects:encode(take(AdvancedCombat.effects,24)),
     floatingTexts:encode(take(floatingTexts,16)),
     shockwaves:encode(take(shockwaves,16))
   };
 }
 return state;
}
function receive(s){
 if(!s?.players||s.players.length!==2)return;
 if(Number.isFinite(s.seq)){
   if(s.seq<=lastStateSeq)return;
   lastStateSeq=s.seq;
 }
 remote=true;lastSnapshotAt=Date.now();
 targets=s.players.map(p=>({x:p.x,y:p.y,h:Number.isFinite(p.h)?p.h:0}));
 if(s.world){
   if(s.world.visualPlayers?.length===2)
     s.world.visualPlayers.forEach((v,i)=>{
       const p=players[i];
       for(const field of ['forgeShots','forgeZones','forgeOrbs','waves',
         'projectiles','poisonTears'])
         if(Array.isArray(v[field]))p[field]=decode(v[field]);
       if(Number.isFinite(v.forgeDash))p.forgeDash=v.forgeDash;
       if(typeof v.jumpState==='string')p.jumpState=v.jumpState;
     });
   // Read old version full-state frames only during rolling deployments.
   else if(s.world.players?.length===2)
     s.world.players.forEach((p,i)=>{
       const old={x:players[i].x,y:players[i].y};
       Object.assign(players[i],decode(p));Object.assign(players[i],old);
     });
   for(const k of ['objects','projectiles','effects'])
     if(Array.isArray(s.world[k]))AdvancedCombat[k].splice(0,AdvancedCombat[k].length,...decode(s.world[k]));
   // Keep local VFX running; network event replay owns the remote effect pool.
   if(s.world.floatingTexts)floatingTexts=decode(s.world.floatingTexts);
   if(s.world.shockwaves)shockwaves=decode(s.world.shockwaves);
 }
 s.players.forEach((p,i)=>{
   players[i].hp=p.hp;players[i].maxHp=p.maxHp;
   players[i].forgeCharge=p.charge||null;
   players[i].telegraphPreviews=Array.isArray(p.previews)?p.previews.slice(0,1):[];
   if(remote){players[i].jumpState=typeof p.j==='string'?p.j:'ground';}
 });
 isGameOver=!!s.finished;isPlaying=!isGameOver;
}
function predict(side,msg){
 if(!remote||!current||current.ended||side!==1||!players[side]?.onlineManual)return;
 const x=Math.max(-1,Math.min(1,Number(msg.x)||0));
 const y=Math.max(-1,Math.min(1,Number(msg.y)||0));
 const n=Math.max(1,Math.hypot(x,y)),nextX=x/n,nextY=y/n;
 if(!steer||Math.abs(steer.x-nextX)+Math.abs(steer.y-nextY)>.001)
   lastSteerAt=Date.now();
 steer={side,x:nextX,y:nextY};
}
function paint(){
 const now=Date.now(),dt=Math.min(55,Math.max(0,now-(lastPaint||now)));
 const alpha=1-Math.exp(-dt/100);lastPaint=now;
 if(!remote){
   // Host simulation ticks at ~30Hz; interpolate entities at display Hz.
   const elapsed=lastSimAt?Math.min(80,now-lastSimAt):0;
   global.ArenaMotion?.setAlpha?.(Math.min(1,(accumulator*1000+elapsed)/(1000/60)));
 }else{
   global.ArenaMotion?.setAlpha?.(1);
   fxFrameCarry+=dt;
   const frames=Math.min(3,Math.floor(fxFrameCarry/(1000/60)));
   for(let i=0;i<frames;i++)SkillVisuals.tick();
   fxFrameCarry=Math.max(0,fxFrameCarry-frames*1000/60);
 }
 if(remote&&targets)players.forEach((p,i)=>{
   const local=steer?.side===i&&p.hp>0;
   const moving=local&&Math.hypot(steer.x,steer.y)>.001;
   // Predict local movement immediately; never chase an old server sample.
   if(moving){
     const speed=Math.max(.6,Math.min(5,Number(p.forge?.speed)||2.4));
     p.x+=steer.x*speed*dt/(1000/60);
     p.y+=steer.y*speed*dt/(1000/60);
     if(lastSnapshotAt&&now-lastSnapshotAt<350){
       const age=Math.max(0,Math.min(180,now-lastSnapshotAt+50));
       const predictedX=targets[i].x+steer.x*speed*age/(1000/60);
       const predictedY=targets[i].y+steer.y*speed*age/(1000/60);
       const error=Math.hypot(predictedX-p.x,predictedY-p.y);
       // Gently correct real drift due to hits/collisions or slow effects.
       if(error>48){
         const correction=(1-Math.exp(-dt/240))*Math.min(1,(error-48)/64);
         p.x+=(predictedX-p.x)*correction;
         p.y+=(predictedY-p.y)*correction;
       }
     }
   }else if(!local||lastSnapshotAt>=lastSteerAt){
     // Wait for a post-release snapshot before correcting stopped movement.
     p.x+=(targets[i].x-p.x)*alpha;
     p.y+=(targets[i].y-p.y)*alpha;
   }
   // Smooth vertical corrections at display Hz; game logic remains host-owned.
   const height=targets[i]?.h||0;
   const currentHeight=Number.isFinite(p.z)?p.z:0;
   p.z=currentHeight+(height-currentHeight)*Math.min(1,alpha*1.4);
   p.jumpHeight=p.z;
   const r=p.radius||28;
   p.x=Math.max(r,Math.min(canvas.width-r,p.x));
   p.y=Math.max(r,Math.min(canvas.height-r,p.y));
 });
 draw();
 // The guest has a separate instant FX pool. Project it using the same
 // depth mapping as the host world, not an obsolete flat affine scale.
 const painter=global.ArenaDepth?.layer?.(canvas,'instantfx');
 if(painter){
   painter.ctx.clearRect(0,0,canvas.width,canvas.height);
   SkillVisuals.draw(painter.ctx);
   global.ArenaTelegraph?.draw?.(painter.ctx,players);
   global.ArenaDepth?.projectWorld?.(ctx,painter.canvas,canvas);
 }else{
   SkillVisuals.draw(ctx);
   global.ArenaTelegraph?.draw?.(ctx,players);
 }
 // HP bars are screen-space UI, anchored to projected airborne fighter positions.
 players.forEach((p,i)=>{
   if(!p||p.hp<=0)return;
   const w=76,h=9,rad=Number(p.radius)||30;
   const pos=!remote?(global.ArenaMotion?.position?.(p)||p):p;
   const height=global.AdvancedCombat?.visibleHeight?.(p)||0;
   const screen=global.ArenaDepth?.elevatedPoint?.(pos,height,canvas)||
     {x:pos.x,y:pos.y-height};
   const x=Math.max(2,Math.min(canvas.width-w-2,screen.x-w/2));
   const y=Math.max(4,screen.y-rad-27);
   const ratio=Math.min(1,Math.max(0,p.hp/Math.max(1,p.maxHp)));
   ctx.save();ctx.fillStyle='#18202bdc';ctx.fillRect(x-2,y-2,w+4,h+4);
   ctx.fillStyle='#2b3545';ctx.fillRect(x,y,w,h);
   ctx.fillStyle=i===0?'#8be8b5':'#f6a6ad';ctx.fillRect(x,y,w*ratio,h);
   ctx.strokeStyle='#f7f4ea';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);
   ctx.restore();
 });
}

global.PvpRuntime={createRoom,setInput,cast,submitPlan,step,snapshot,receive,receiveFx,
  drainFx,setFxWake,previewCast,predict,paint};
})(window);
