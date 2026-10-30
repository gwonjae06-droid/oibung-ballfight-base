/* Minimal readable preparation cues, derived from the authoritative
 * SkillForge action queue. No independent damage, projectile or hit logic.
 * One ring and one geometric warning per fighter, capped across the arena.
 */
(function(global){
'use strict';
const close=new Set('slash thrust spinslash uppercut aircombo dive erupt wave pull nova'.split(' '));
const ranged=new Set('shot beam homing pierce boomerang arcshot splitshot chain drain'.split(' '));
const area=new Set('zone bolt meteor mine starfall blackhole trap wall turret summon lifebloom'.split(' '));
const move=new Set('dash blink retreat swap leap hover glide portal burrow burrowdash flight'.split(' '));
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const n=(v,defaultValue=0)=>Number.isFinite(Number(v))?Number(v):defaultValue;
const CUE_LIMIT=5;
function category(a){
 if(!a||a.type==='charge')return 'none'; // Charge already has its own animation.
 if(close.has(a.type))return 'melee';
 if(ranged.has(a.type))return 'ranged';
 if(area.has(a.type))return 'area';
 if(move.has(a.type))return 'movement';
 const group=global.ActionRegistry?.get?.(a.type)?.category;
 return group==='defense'?'support':group==='attacks'?'melee':'support';
}
function leadFrames(a){
 const kind=category(a);
 return kind==='none'?0:kind==='area'?15:kind==='ranged'?12:
   kind==='melee'?11:kind==='movement'?9:7;
}
function data(q){
 if(!q?.a)return null;
 const kind=category(q.a),lead=n(q.windup,leadFrames(q.a));
 if(kind==='none'||lead<=0)return null;
 const remaining=clamp(n(q.remaining),0,120);
 if(remaining>lead)return null;
 return {type:q.a.type,kind,remaining,lead,castId:n(q.castId),
   radius:clamp(n(q.a.radius,95),25,300),targetNum:q.targetNum,
   target:q.a.target||'nearest',pattern:q.a.pattern||'direct'};
}
function select(p){
 const source=Array.isArray(p.forgeQueue)?p.forgeQueue:
   Array.isArray(p.telegraphPreviews)?p.telegraphPreviews:[];
 const list=[];
 for(const entry of source){
  const cue=entry.a?data(entry):entry;
  if(!cue||cue.remaining>cue.lead||cue.lead<=0||cue.remaining<0)continue;
  // Concurrent "with" blocks of the same cast display one readable cue.
  if(list.some(x=>x.castId===cue.castId))continue;
  list.push(cue);
  if(list.length>=1)break;
 }
 return list;
}
function preview(p){
 return select(p).map(c=>({type:c.type,kind:c.kind,remaining:c.remaining,
   lead:c.lead,castId:c.castId,radius:c.radius,targetNum:c.targetNum,
   target:c.target,pattern:c.pattern}));
}
function draw(ctx,roster){
 if(!ctx||!Array.isArray(roster))return;
 let count=0;
 for(const p of roster){
  if(count>=CUE_LIMIT)break;
  if(!p||p.hp<=0)continue;
  const cue=select(p)[0];if(!cue)continue;
  const target=cue.target==='random'?null:
    roster.find(e=>e!==p&&e.hp>0&&e.playerNum===cue.targetNum)||
    roster.find(e=>e!==p&&e.hp>0);
  const pos=global.ArenaMotion?.position?.(p)||p;
  const x=n(pos.x),y=n(pos.y)-(global.AdvancedCombat?.height?.(p)||0);
  const tx=target?n((global.ArenaMotion?.position?.(target)||target).x):x+45;
  const ty=target?n((global.ArenaMotion?.position?.(target)||target).y):y;
  const angle=Math.atan2(ty-y,tx-x),distance=Math.hypot(tx-x,ty-y);
  const progress=clamp(1-cue.remaining/Math.max(1,cue.lead),0,1);
  const color=p.forge?.effectColor||p.themeColor||'#74b9e8';
  const tint=/^#[0-9a-f]{6}$/i.test(color)?color:'#74b9e8';
  const base=clamp(n(p.radius,25),12,50);
  ctx.save();ctx.globalCompositeOperation='source-over';
  ctx.lineCap='round';ctx.lineJoin='round';
  // White/dark edge plus colored inner line makes the cue readable on both
  // bright default arena and dark themed Tower floors.
  ctx.globalAlpha=.72+progress*.23;ctx.lineWidth=3.7;
  ctx.strokeStyle='rgba(12,21,35,.85)';
  ctx.beginPath();ctx.arc(x,y,base+7,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();
  ctx.strokeStyle=tint;ctx.lineWidth=2.2;
  ctx.beginPath();ctx.arc(x,y,base+7,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();
  if(cue.kind==='melee'){
   ctx.beginPath();
   const width=cue.type==='spinslash'||cue.type==='nova'||cue.type==='wave'?Math.PI*.92:Math.PI*.42;
   ctx.arc(x,y,clamp(cue.radius*.44,base+12,105),angle-width/2,angle+width/2);
   ctx.stroke();
  }else if(cue.kind==='ranged'||cue.kind==='movement'){
   const limit=cue.kind==='ranged'?clamp(cue.radius*1.5,60,250):clamp(cue.radius*.75,45,150);
   const length=target?Math.min(limit,distance):limit;
   const x2=x+Math.cos(angle)*length,y2=y+Math.sin(angle)*length;
   ctx.setLineDash(cue.kind==='ranged'?[5,6]:[9,5]);
   ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*(base+9),y+Math.sin(angle)*(base+9));
   ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);
   ctx.beginPath();ctx.arc(x2,y2,2.9,0,Math.PI*2);ctx.fillStyle=tint;ctx.fill();
  }else if(cue.kind==='area'){
   // This is a TARGET REGION hint, not a promise of exact hit radius
   // for multi-projectile patterns or randomly scattered casts.
   const centered=['mine','trap'].includes(cue.type)||!target;
   const px=centered?x:tx,py=centered?y:ty;
   const radius=clamp(cue.radius*.34,22,90);
   ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);
   ctx.stroke();ctx.setLineDash([]);
  }
  ctx.restore();count++;
 }
}
global.ArenaTelegraph=Object.freeze({category,leadFrames,data,preview,draw,CUE_LIMIT});
})(typeof window!=='undefined'?window:globalThis);
