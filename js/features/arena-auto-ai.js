/* Shared AI director for custom fighters: offline, tower and hosted PvP.
 * All movement is soft-steered; authored skills/hit physics are unchanged. */
(function(g){
'use strict';
const MELEE=new Set(['slash','spinslash','thrust','uppercut','aircombo','wave','nova','erupt','dive']);
const RANGED=new Set(['shot','homing','pierce','boomerang','arcshot','splitshot','beam','bolt','chain','meteor','starfall','dung']);
const MOBILITY=new Set(['dash','blink','leap','retreat','swap','burrowdash','flight']);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function range(p){
 const actions=(p.forge?.skills||[]).slice(0,5).flatMap(s=>(s.actions||[]).slice(0,3));
 const melee=actions.filter(a=>MELEE.has(a.type)).length,ranged=actions.filter(a=>RANGED.has(a.type)).length;
 if(melee>ranged)return 78;
 if(ranged)return actions.some(a=>a.type==='heal'||a.type==='shield')?168:145;
 return 110;
}
function evade(p,foe){
 let x=0,y=0;
 for(const shot of (foe?.forgeShots||[]).slice(-14)){
  if(!Number.isFinite(shot?.x)||!Number.isFinite(shot?.y))continue;
  const dx=shot.x+(Number(shot.vx)||0)*7-p.x,dy=shot.y+(Number(shot.vy)||0)*7-p.y;
  const d=Math.hypot(dx,dy)||1;
  if(d<88){x-=dx/d*(88-d)/88*2;y-=dy/d*(88-d)/88*2;}
 }
 for(const zone of (foe?.forgeZones||[]).slice(-8)){
  if(!Number.isFinite(zone?.x)||!Number.isFinite(zone?.y))continue;
  const dx=zone.x-p.x,dy=zone.y-p.y,d=Math.hypot(dx,dy)||1;
  const r=clamp(Number(zone.a?.radius)||65,35,145);
  if(d<r+28){x-=dx/d*(r+28-d)/(r+28);y-=dy/d*(r+28-d)/(r+28);}
 }
 return {x,y};
}
function steer(p,foe,speed){
 if(!p||p.hp<=0||!foe||foe.hp<=0||p.forgeDash>0||
   p.movementOnlyFrames>0||(p.jumpState&&p.jumpState!=='ground'))return false;
 const dx=foe.x-p.x,dy=foe.y-p.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
 const preferred=range(p),forward=d>preferred+18?1:d<preferred-30?-.8:0;
 const spin=(p.playerNum||1)%2===0?-1:1;
 const orbit=forward===0?.63:.18;
 const threat=evade(p,foe);
 // The Tower director steers away from locked hazard coordinates.
 const encounter=g.ArenaTower?.active&&p.towerHero?g.ArenaTower.encounter:null;
 for(const zone of encounter?.zones||[]){
   const left=zone.fire-encounter.tick;
   if(left<0||left>110||zone.shape==='ring'&&
     Math.hypot(p.x-zone.x,p.y-zone.y)<(zone.inner||0)-28)continue;
   const dd=Math.hypot(p.x-zone.x,p.y-zone.y)||1;
   const extent=zone.shape==='line'?Math.max(80,zone.width*2):zone.r+42;
   if(dd<extent){
     const force=(extent-dd)/extent;
     threat.x+=(p.x-zone.x)/dd*force*1.35;
     threat.y+=(p.y-zone.y)/dd*force*1.35;
   }
 }
 let vx=ux*forward-uy*spin*orbit+threat.x*1.6;
 let vy=uy*forward+ux*spin*orbit+threat.y*1.6;
 const width=typeof canvas!=='undefined'?Number(canvas.width)||500:500;
 const height=typeof canvas!=='undefined'?Number(canvas.height)||500:500;
 const border=(p.radius||20)+68;
 if(p.x<border)vx+=(border-p.x)/65;
 if(p.x>width-border)vx-=(p.x-(width-border))/65;
 if(p.y<border)vy+=(border-p.y)/65;
 if(p.y>height-border)vy-=(p.y-(height-border))/65;
 const n=Math.hypot(vx,vy);if(!Number.isFinite(n)||n<.01)return false;
 const tx=vx/n*speed,ty=vy/n*speed,oldX=Number.isFinite(p.vx)?p.vx:0,oldY=Number.isFinite(p.vy)?p.vy:0;
 p.vx=oldX+(tx-oldX)*.11;p.vy=oldY+(ty-oldY)*.11;
 const v=Math.hypot(p.vx,p.vy),max=clamp(speed*1.28,1,6.8);
 if(v>max){p.vx=p.vx/v*max;p.vy=p.vy/v*max;}
 return true;
}
function canCast(p,target,skill){
 if(!target||target.hp<=0)return false;
 const actions=skill?.actions||[];
 if(!actions.length||actions.some(a=>RANGED.has(a.type)||MOBILITY.has(a.type)||
   ['heal','shield','regen','timestop','zone','trap','turret','summon'].includes(a.type)))return true;
 const close=actions.filter(a=>MELEE.has(a.type));
 if(!close.length)return true;
 const reach=Math.max(...close.map(a=>clamp(Number(a.radius)||100,50,170)));
 return Math.hypot(target.x-p.x,target.y-p.y)<=reach+(target.radius||20)+15;
}
g.ArenaAutoAI={range,steer,canCast};
})(typeof window!=='undefined'?window:globalThis);
