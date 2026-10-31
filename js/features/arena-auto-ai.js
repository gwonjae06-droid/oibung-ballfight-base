/* Shared tactical AI: the same fair, visible-threat decisions for allies and enemies.
 * Reads real projectiles, cast telegraphs and tower hazard geometry; NEVER
 * changes hitboxes, HP, cooldowns, damage or skill execution semantics.
 * Fixed simulation ticks (not wall-clock time) keep 1–100x behavior identical. */
(function(g){
'use strict';
const MELEE=new Set(['slash','spinslash','thrust','uppercut','aircombo','wave','nova','erupt','dive']);
const RANGED=new Set(['shot','homing','pierce','boomerang','arcshot','splitshot','beam','bolt','chain','meteor','starfall','dung']);
const MOBILITY=new Set(['dash','blink','leap','retreat','swap','burrowdash','flight','portal','glide','hover']);
const HEAL=new Set(['heal','regen','lifebloom']);
const SUPPORT=new Set(['shield','fortify','haste','timestop']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const magnitude=(x,y)=>Math.hypot(x,y);
const safeRadius=p=>clamp(finite(p?.radius,20),10,65);
const dimension=(axis)=>typeof canvas!=='undefined'?finite(canvas?.[axis],500):500;
const signed=(x,y,z,pad=0)=>{
 const dx=x-finite(z.x),dy=y-finite(z.y);
 const shape=z.shape||'circle';
 if(shape==='ring'){
   const d=magnitude(dx,dy),inside=finite(z.inner),outside=finite(z.r,60);
   // Positive signed clearance in BOTH safe parts: centre and outer rim.
   return Math.max(inside-d-pad,d-outside-pad);
 }
 if(shape==='line'){
   const a=finite(z.angle,finite(z.a)),c=Math.cos(a),s=Math.sin(a);
   const across=Math.abs(-dx*s+dy*c)-finite(z.width,finite(z.w,48))/2-pad;
   const along=Math.abs(dx*c+dy*s)-finite(z.length,finite(z.len,500))/2-pad;
   return Math.max(across,along);
 }
 return magnitude(dx,dy)-finite(z.r,finite(z.radius,65))-pad;
};
function range(p){
 const actions=(p.forge?.skills||[]).slice(0,5).flatMap(s=>(s.actions||[]).slice(0,3));
 const melee=actions.filter(a=>MELEE.has(a.type)).length,ranged=actions.filter(a=>RANGED.has(a.type)).length;
 if(melee>ranged)return 78;
 if(ranged)return actions.some(a=>HEAL.has(a.type)||SUPPORT.has(a.type))?168:145;
 return 110;
}
function projectiles(foe,p){
 const list=[];
 for(const shot of (foe?.forgeShots||[]).slice(-16)){
   if(!Number.isFinite(shot?.x)||!Number.isFinite(shot?.y))continue;
   if(magnitude(shot.x-p.x,shot.y-p.y)>360)continue;
   list.push({x:shot.x,y:shot.y,vx:finite(shot.vx),vy:finite(shot.vy),
     life:clamp(finite(shot.life,30),0,50),radius:10});
 }
 for(const shot of (foe?.bfShots||[]).slice(-8)){
   if(!Number.isFinite(shot?.x)||!Number.isFinite(shot?.y))continue;
   if(magnitude(shot.x-p.x,shot.y-p.y)>300)continue;
   list.push({x:shot.x,y:shot.y,vx:finite(shot.vx),vy:finite(shot.vy),
     life:clamp(finite(shot.life,25),0,40),radius:9});
 }
 return list;
}
function hazards(p,foe){
 const out=[],tick=finite(g.ArenaTower?.encounter?.tick);
 // Both sides avoid enemy magic fields, not their own.
 for(const zone of (foe?.forgeZones||[]).slice(-12)){
   if(!Number.isFinite(zone?.x)||!Number.isFinite(zone?.y))continue;
   const active=zone.type==='bolt'?Math.max(0,finite(zone.timer,0)):0;
   out.push({shape:'circle',x:zone.x,y:zone.y,
     r:zone.type==='bolt'?finite(zone.a?.radius,90)*.4:finite(zone.r,finite(zone.a?.radius,65)),
     fire:active,end:zone.type==='bolt'?active+12:clamp(finite(zone.timer,60),1,180),
     relative:true,weight:zone.type==='bolt'?1.3:.9});
 }
 if(g.ArenaTower?.active&&p.towerHero){
   for(const z of (g.ArenaTower.encounter?.zones||[]).slice(-16)){
     // Boss zones hit the hero; ordinary terrain can strike both fighters.
     if(z.kind==='terrain'||z.kind==='boss'||!z.kind){
       out.push({...z,relative:false,fire:finite(z.fire)-tick,
         end:finite(z.end)-tick,weight:z.kind==='boss'?1.55:1.3});
     }
   }
 }
 // Don't use future, hidden casts. Only visible skill wind-up cues count.
 const cues=g.ArenaTelegraph?.preview?.(foe)||[];
 for(const cue of cues.slice(0,2)){
   if(cue.remaining<0||cue.remaining>cue.lead||cue.kind==='support')continue;
   if(cue.targetNum!=null&&cue.targetNum!==p.playerNum)continue;
   if(cue.kind==='area'&&cue.target!=='random'){
     out.push({shape:'circle',x:p.x,y:p.y,r:clamp(finite(cue.radius)*.34,20,90),
       fire:finite(cue.remaining),end:finite(cue.remaining)+8,relative:true,weight:.6});
   }else if(cue.kind==='melee'&&magnitude(foe.x-p.x,foe.y-p.y)<150){
     out.push({shape:'circle',x:foe.x,y:foe.y,
       r:clamp(finite(cue.radius,80)*.55,35,105),
       fire:finite(cue.remaining),end:finite(cue.remaining)+10,relative:true,weight:.65});
   }
 }
 return out;
}
function fieldRisk(z,x,y,pad,travel=18){
 const fire=finite(z.fire),end=finite(z.end,999);
 if(fire>95||end<=0)return 0;
 const d=signed(x,y,z,pad);
 // The circle, donut, and rotated rectangle use the exact same dimensions
 // and origin as their actual hit tests; gradient also helps escape deep areas.
 const overlap=clamp((32-d)/75,0,2.2);
 if(!overlap)return 0;
 // Warning time matters: danger is highest just before/while it is live.
 const urgency=fire<=0?1:clamp(1-(fire-15)/100,.28,1);
 const relevance=end<travel?.65:1;
 return overlap*urgency*relevance*finite(z.weight,1);
}
function bulletRisk(b,x,y,vx,vy,travel,pad){
 // Closest approach during the next few ticks, rather than naively fleeing
 // a projectile after it already passed or on a harmless parallel lane.
 const horizon=Math.min(travel,b.life||travel);
 const rx=b.x-x,ry=b.y-y,rvx=b.vx-vx,rvy=b.vy-vy;
 const denom=rvx*rvx+rvy*rvy;
 const t=denom>.0001?clamp(-(rx*rvx+ry*rvy)/denom,0,horizon):0;
 const d=magnitude(rx+rvx*t,ry+rvy*t);
 return clamp((pad+b.radius+26-d)/46,0,2.2)*1.6;
}
function sense(p,foe){
 return {hazards:hazards(p,foe),shots:projectiles(foe,p)};
}
function risk(p,foe,vx=0,vy=0,known){
 const data=known||sense(p,foe),pad=safeRadius(p)+7;
 const speed=magnitude(vx,vy);
 const travel=clamp(18+(speed<1?6:0),12,28);
 let value=0;
 for(const z of data.hazards){
   const when=clamp(finite(z.fire)+5,5,35);
   // A warning still dozens of frames away can be escaped by positioning
   // away from its locked footprint. Active threats use near-term movement.
   const t=z.fire<=0?12:when;
   const x=clamp(p.x+vx*t,pad,dimension('width')-pad);
   const y=clamp(p.y+vy*t,pad,dimension('height')-pad);
   value+=fieldRisk(z,x,y,pad,t);
   if(z.fire<=0)value+=fieldRisk(z,p.x+vx*4,p.y+vy*4,pad,4)*.36;
 }
 for(const b of data.shots){
   value+=bulletRisk(b,p.x,p.y,vx,vy,travel,pad);
 }
 return value;
}
function desired(p,foe){
 const dx=foe.x-p.x,dy=foe.y-p.y,d=magnitude(dx,dy)||1;
 const ux=dx/d,uy=dy/d,preferred=range(p);
 const forward=d>preferred+20?1:d<preferred-32?-.85:0;
 // Orbit direction is tied to fighter slot. All AI uses the same rules.
 const spin=(p.playerNum||1)%2===0?-1:1;
 const orbit=forward===0?.65:.23;
 return {x:ux*forward-uy*spin*orbit,y:uy*forward+ux*spin*orbit};
}
function plan(p,foe,speed,evadeOnly=false){
 const threats=sense(p,foe),pref=desired(p,foe);
 const pnorm=magnitude(pref.x,pref.y)||1;
 const preferred={x:pref.x/pnorm,y:pref.y/pnorm};
 const pad=safeRadius(p)+18,w=dimension('width'),h=dimension('height');
 const base=clamp(finite(speed,2),.6,8);
 const oldX=finite(p.vx),oldY=finite(p.vy),oldSpeed=magnitude(oldX,oldY);
 const baseline=risk(p,foe,oldX,oldY,threats);
 const urgent=baseline>.34;
 // Avoid overriding authored legacy movement when nothing threatens it.
 if(evadeOnly&&!urgent)return null;
 const angles=12;
 let best=null,bestScore=-Infinity;
 for(let i=-2;i<angles;i++){
   const a=i>=0?i*Math.PI*2/angles:0;
   let ux=i===-2?preferred.x:i===-1?0:Math.cos(a);
   let uy=i===-2?preferred.y:i===-1?0:Math.sin(a);
   const rawX=p.x+ux*base*18,rawY=p.y+uy*base*18;
   const predictedX=clamp(rawX,pad,w-pad),predictedY=clamp(rawY,pad,h-pad);
   const safety=risk(p,foe,ux*base,uy*base,threats);
   // Penalize the UNCLAMPED path. Testing clamped coordinates hid wall risk.
   const border=clamp((pad-rawX)/30,0,3)+clamp((rawX-(w-pad))/30,0,3)
     +clamp((pad-rawY)/30,0,3)+clamp((rawY-(h-pad))/30,0,3);
   // Safe combat positioning still matters; evasion is not aimless wandering.
   const projectedDistance=magnitude(foe.x-predictedX,foe.y-predictedY);
   const gap=Math.abs(projectedDistance-range(p));
   const preference=ux*preferred.x+uy*preferred.y;
   const inertia=oldSpeed>0?(ux*oldX+uy*oldY)/oldSpeed:0;
   const score=-safety*15-border*12-gap*.008+preference*(urgent?.7:2.5)+inertia*.22;
   if(score>bestScore){bestScore=score;best={x:ux,y:uy,threat:baseline,danger:safety};}
 }
 return best;
}
function steer(p,foe,speed){
 if(!p||p.hp<=0||!foe||foe.hp<=0||p.forgeDash>0||
   p.movementOnlyFrames>0||(p.jumpState&&p.jumpState!=='ground'))return false;
 const base=clamp(finite(speed,2),.6,8),choice=plan(p,foe,base);
 if(!choice)return false;
 const tx=choice.x*base,ty=choice.y*base,oldX=finite(p.vx),oldY=finite(p.vy);
 const smoothing=choice.threat>.34?.24:.11;
 p.vx=oldX+(tx-oldX)*smoothing;p.vy=oldY+(ty-oldY)*smoothing;
 const v=magnitude(p.vx,p.vy),max=clamp(base*1.28,1,8.5);
 if(v>max){p.vx=p.vx/v*max;p.vy=p.vy/v*max;}
 p.aiDanger=choice.threat;return true;
}
function react(p,foe){
 // Legacy fighters keep their authored movement and skills. Only adjust
 // velocity to avoid REAL threats. This doesn't spawn a skill or a hit.
 if(!p||!foe||p.hp<=0||foe.hp<=0||p.forge||
   p.forgeDash>0||p.movementOnlyFrames>0||p.manualTower||
   p.jumpState&&p.jumpState!=='ground')return false;
 const speed=clamp(magnitude(finite(p.vx),finite(p.vy))||2,1.5,4.8);
 const choice=plan(p,foe,speed,true);
 if(!choice)return false;
 p.vx=finite(p.vx)*.55+choice.x*speed*.45;
 p.vy=finite(p.vy)*.55+choice.y*speed*.45;
 return true;
}
function canCast(p,target,skill){
 if(!target||target.hp<=0)return false;
 const actions=skill?.actions||[];
 if(!actions.length)return true;
 const distance=magnitude(target.x-p.x,target.y-p.y);
 // Don't waste a pure healing skill while almost completely healthy.
 // Mixed authored combos still execute in their original sequence.
 if(actions.every(a=>HEAL.has(a.type)))
   return p.hp/Math.max(1,p.maxHp)<.88;
 const offensive=actions.filter(a=>MELEE.has(a.type));
 const otherOffense=actions.some(a=>RANGED.has(a.type)||
   ['zone','trap','turret','summon','blackhole','orbit','drain'].includes(a.type));
 if(offensive.length&&!otherOffense&&!actions.some(a=>MOBILITY.has(a.type))){
   const reach=Math.max(...offensive.map(a=>clamp(finite(a.radius,100),50,180)));
   return distance<=reach+safeRadius(target)+15;
 }
 if(actions.every(a=>['dash','leap','burrowdash'].includes(a.type))&&distance<55)
   return false;
 return true;
}
g.ArenaAutoAI=Object.freeze({range,steer,react,canCast,plan,risk,signed});
})(typeof window!=='undefined'?window:globalThis);
