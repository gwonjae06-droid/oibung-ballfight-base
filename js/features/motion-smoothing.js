/* Frame-rate independent visual positions. Simulation and hitboxes remain untouched. */
(function(global){
'use strict';
const previous=new WeakMap();
let roster=null,alpha=1;
const finite=n=>Number.isFinite(n)?n:0;
function reset(fighters){
  roster=fighters||null;alpha=1;
  if(Array.isArray(fighters))fighters.forEach(p=>{
    if(p)previous.set(p,{x:finite(p.x),y:finite(p.y)});
  });
}
function capture(fighters){
  if(roster!==fighters)reset(fighters);
  if(!Array.isArray(fighters))return;
  fighters.forEach(p=>{
    if(p)previous.set(p,{x:finite(p.x),y:finite(p.y)});
  });
}
function setAlpha(value){alpha=Math.max(0,Math.min(1,finite(value)));}
function position(p){
  if(!p)return {x:0,y:0};
  const x=finite(p.x),y=finite(p.y),old=previous.get(p);
  if(!old)return {x,y};
  // Teleports and knockback bursts should never trail across the arena.
  if(Math.hypot(x-old.x,y-old.y)>65)return {x,y};
  return {x:old.x+(x-old.x)*alpha,y:old.y+(y-old.y)*alpha};
}
function drawFighter(ctx,p,render){
  const next=position(p),dx=next.x-finite(p.x),dy=next.y-finite(p.y);
  if(Math.abs(dx)+Math.abs(dy)<.001){render(p);return;}
  ctx.save();ctx.translate(dx,dy);
  try{render(p);}finally{ctx.restore();}
}
global.ArenaMotion={reset,capture,setAlpha,position,drawFighter};
})(window);
