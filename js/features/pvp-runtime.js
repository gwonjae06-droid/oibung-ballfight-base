/* Isolated copy of the original combat engine; no wallet, UI scheduler or saves. */
(function(global){
'use strict';
updateUI=()=>{};syncStopButton=()=>{};
global.settleRound=()=>{};
let current=null,accumulator=0,remote=false,targets=null,lastPaint=0;
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
  p.onlineManual=modes[i]==='manual';
  if(p.onlineManual)SkillForge.enableManual(p);
 });
 remote=false;targets=null;steer=null;lastPaint=0;accumulator=0;
 fxOutbox=[];fxSequence=0;remoteFxSequence=0;preview=null;fxFrameCarry=0;
 current={players,started:now,elapsed:0,ended:false,winner:null,modes,pending:[]};
 SkillVisuals.setSpawnListener(captureFx);
 return current;
}
function setInput(room,i,msg,now=Date.now()){
 const p=players[i];if(!p?.onlineManual||room.ended)return false;
 let x=Number.isFinite(Number(msg.x))?Number(msg.x):0,y=Number.isFinite(Number(msg.y))?Number(msg.y):0,n=Math.max(1,Math.hypot(x,y));
 p.inputX=x/n;p.inputY=y/n;p.inputAt=now;return true;
}
function cast(room,i,slot){return !room.ended&&!!players[i]?.onlineManual&&SkillForge.manualCast(players[i],slot,getClosestAliveEnemy(players[i]));}
function step(room,dt,now){
 if(room.ended)return;accumulator+=dt;
 while(accumulator>=1/60&&!isGameOver){
  players.forEach(p=>{if(p.onlineManual&&now-(p.inputAt||0)>700)p.inputX=p.inputY=0;});
  update();SkillVisuals.tick();accumulator-=1/60;room.elapsed+=1/60;
 }
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
 const state={type:'state',clock:Math.max(0,120-room.elapsed),finished:room.ended,winner:room.winner,
  players:players.map((p,i)=>({x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,name:p.name,
   color:p.themeColor,mode:room.modes[i],
   skills:p.forge?.skills.slice(0,4).map(s=>({name:s.name}))||[],
   cooldowns:p.forge?.skills.slice(0,4).map((s,j)=>
     Math.max(0,(SkillForge.cooldownFrames(p,s)-(p.forgeTicks[j]||0))/60))||[]}))};
 if(full){
   const take=(a,n)=>Array.isArray(a)?a.slice(-n):[];
   state.world={
     // Spawn events are delivered instantly via the 'fx' broadcast. Never
     // overwrite the guest's playing effect pool with a stale 600ms snapshot.
     players:players.map(p=>encode(p,true)),
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
 remote=true;targets=s.players.map(p=>({x:p.x,y:p.y}));
 if(s.world?.players?.length===2){
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
 });
 isGameOver=!!s.finished;isPlaying=!isGameOver;
}
function predict(side,msg){
 if(!remote||!current||current.ended||side!==1||!players[side]?.onlineManual)return;
 const x=Math.max(-1,Math.min(1,Number(msg.x)||0));
 const y=Math.max(-1,Math.min(1,Number(msg.y)||0));
 const n=Math.max(1,Math.hypot(x,y));steer={side,x:x/n,y:y/n};
}
function paint(){
 const now=Date.now(),dt=Math.min(40,Math.max(0,now-(lastPaint||now)));
 const alpha=1-Math.exp(-dt/85);lastPaint=now;
 if(remote){
   fxFrameCarry+=dt;
   // The guest does not run physics. Still advance *visual animation frames*
   // at 60Hz so replayed slash, beam, particles, and shockwaves actually move.
   const frames=Math.min(3,Math.floor(fxFrameCarry/(1000/60)));
   for(let i=0;i<frames;i++)SkillVisuals.tick();
   fxFrameCarry=Math.max(0,fxFrameCarry-frames*1000/60);
 }
 if(remote&&targets)players.forEach((p,i)=>{
   if(steer?.side===i&&p.hp>0){
     const speed=Math.max(.6,Math.min(5,Number(p.forge?.speed)||2.4));
     p.x=Math.max(p.radius||28,Math.min(canvas.width-(p.radius||28),
       p.x+steer.x*speed*dt/(1000/60)));
     p.y=Math.max(p.radius||28,Math.min(canvas.height-(p.radius||28),
       p.y+steer.y*speed*dt/(1000/60)));
   }
   p.x+=(targets[i].x-p.x)*alpha;p.y+=(targets[i].y-p.y)*alpha;
 });
 draw();SkillVisuals.draw(ctx);
 // Individual HP bar tracks each fighter on the original arena canvas.
 players.forEach((p,i)=>{
   if(!p||p.hp<=0)return;
   const w=76,h=9,rad=Number(p.radius)||30;
   const x=Math.max(2,Math.min(canvas.width-w-2,p.x-w/2));
   const y=Math.max(4,p.y-rad-27);
   const ratio=Math.min(1,Math.max(0,p.hp/Math.max(1,p.maxHp)));
   ctx.save();ctx.fillStyle='#18202bdc';ctx.fillRect(x-2,y-2,w+4,h+4);
   ctx.fillStyle='#2b3545';ctx.fillRect(x,y,w,h);
   ctx.fillStyle=i===0?'#8be8b5':'#f6a6ad';ctx.fillRect(x,y,w*ratio,h);
   ctx.strokeStyle='#f7f4ea';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);
   ctx.restore();
 });
}

global.PvpRuntime={createRoom,setInput,cast,step,snapshot,receive,receiveFx,
  drainFx,setFxWake,previewCast,predict,paint};
})(window);
