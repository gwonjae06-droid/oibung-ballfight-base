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
// Intention is persistent for a short window: AI does not change its mind every frame.
// All calculations are deterministic simulation ticks (including at 100x).
let roster=[];
function setRoster(fighters){roster=Array.isArray(fighters)?fighters:[];}
const getRoster=()=>roster;
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
function loadout(p){
 const skills=(p.forge?.skills||[]).slice(0,6),actions=skills.flatMap(s=>(s.actions||[]).slice(0,p.forge?.signatureVersion===1?12:3));
 const close=actions.filter(a=>MELEE.has(a.type));
 const far=actions.filter(a=>RANGED.has(a.type)||['zone','blackhole','turret','summon'].includes(a.type));
 const sustain=actions.filter(a=>HEAL.has(a.type)||SUPPORT.has(a.type));
 const ready=g.BounceMomentum?.enabled?.(p)?
   g.BounceMomentum.ready(p):skills.some((s,i)=>s.trigger==='auto'&&
   (p.forgeTicks?.[i]??0)>=Math.max(12,Math.round((s.cooldown||3)*60))*.80);
 const hp=clamp(finite(p.hp,1)/Math.max(1,finite(p.maxHp,1)),0,1);
 const classId=p.forge?.archetype;
 const natural=far.length>close.length?'ranged':close.length>far.length?'melee':
   far.length?'hybrid':sustain.length?'support':'melee';
 const role=({melee:'melee',ranged:'ranged',defense:'melee',mobility:'hybrid',control:'ranged'})[classId]||natural;
 // The authored reach matters; no global 145px rule for an 80px weapon.
 const reach=far.length?clamp(far.reduce((n,a)=>n+finite(a.radius,120),0)/far.length,80,260):0;
 const preferred=g.ForgeArchetypes?.get?.(classId)?.reach??(role==='ranged'?clamp(reach*.83,122,216):
   role==='hybrid'?clamp(92+reach*.22,103,148):role==='support'?148:74);
 return {role,classId,hp,ready,hasHeal:actions.some(a=>HEAL.has(a.type)),preferred,
   attacking:actions.some(a=>MELEE.has(a.type)||RANGED.has(a.type))};
}
function range(p){return loadout(p).preferred;}
function targetFor(p,fallback){
 if(!p||p.hp<=0||!fallback||!roster.length||g.ArenaTower?.active)return fallback;
 const candidates=roster.filter(e=>e&&e!==p&&e.hp>0);
 if(candidates.length<2)return fallback;
 const previous=candidates.find(e=>e.playerNum===p._aiTargetNum);
 // Reconsider about twice a second, but immediately when a target dies.
 if(previous&&(p._aiTargetHold||0)>0){p._aiTargetHold--;return previous;}
 let best=fallback,bestScore=Infinity;
 for(const e of candidates){
   const d=magnitude(e.x-p.x,e.y-p.y);
   const pct=clamp(finite(e.hp,1)/Math.max(1,finite(e.maxHp,e.hp)),0,1);
   // Nearby low-HP opponents are worth finishing, but don't chase a dying
   // opponent right across the map or switch on every single frame.
   const score=d+35*pct-(e===previous?26:0)+
     (e.forgeCharge?.phase==='charging'?13:0);
   if(score<bestScore){best=e;bestScore=score;}
 }
 p._aiTargetNum=best.playerNum;p._aiTargetHold=30+(p.playerNum||1)%10;
 return best;
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
 // Both AI fighters react to the very same visible environment zones;
 // beneficial time acceleration never counts as a danger.
 if(g.ArenaTower?.active){
   const env=g.ArenaTower.environment;
   for(const z of (env?.zones||[]).slice(-3)){
     if(z.mode==='fast')continue;
     out.push({...z,relative:false,
       fire:finite(z.fire)-finite(env.tick),end:finite(z.end)-finite(env.tick),
       weight:['lava','eruption','lightning','roots','frost'].includes(z.mode)?1.2:.65});
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
function stance(p,foe,data){
 const profile=loadout(p),dx=foe.x-p.x,dy=foe.y-p.y,d=magnitude(dx,dy)||1;
 const enemyClosing=(finite(foe.vx)*dx+finite(foe.vy)*dy)<-.3;
 const threat=g.ArenaTelegraph?.preview?.(foe)?.[0];
 const windup=threat&&threat.remaining<=threat.lead&&
   (threat.kind==='melee'||threat.kind==='area')&&d<145;
 let mode=d>profile.preferred+40?'approach':d<profile.preferred-28?'reposition':'strafe';
 if(profile.role==='melee'&&d>100)mode='approach';
 if(profile.hasHeal&&profile.hp<.48&&d<160)mode='recover';
 else if(profile.role!=='melee'&&(windup||enemyClosing&&d<profile.preferred+4))mode='bait';
 else if(profile.role==='melee'&&!profile.ready&&d<85)mode='reposition';
 // No indefinite stalling: even under low HP a melee-only fighter fights.
 if(profile.role==='melee'&&d>125)mode='approach';
 // Fixed combat archetypes remain legible even when their unique skill mixes
 // multiple ranges: range/control seek space, defense holds an approach lane.
 if(profile.classId==='defense'&&d>112)mode='approach';
 if(profile.classId==='ranged'&&d<profile.preferred-12)mode='reposition';
 if(profile.classId==='control'&&d<profile.preferred-15)mode='bait';
 if(profile.classId==='mobility'&&windup)mode='bait';
 // Collision-charged fighters need actual clashes to build energy.
 if(g.BounceMomentum?.enabled?.(p)&&d>safeRadius(p)+safeRadius(foe)+10&&
   d<175&&!windup&&Math.floor(finite(p._aiClock)/100)%3!==2)mode='clash';
 // Tactical does not mean sterile: occasionally *commit* to a real-body
 // collision at a favorable moment. The normal collision solver owns bounce.
 if(profile.role==='melee'&&profile.ready&&d>=58&&d<135&&!windup&&
    Math.floor(finite(p._aiClock)/105)%3===1)mode='clash';
 const order=g.ArenaTowerTactics?.modeFor?.(p)||'';
 const pressure=order==='attack'?1.35:order==='evade'?-1.12:order==='hold'?
   (d>profile.preferred+15?.6:d<profile.preferred-15?-.7:0):
   mode==='clash'?1.28:mode==='approach'?1:mode==='bait'?-.84:mode==='recover'?-.8:
   mode==='reposition'?-.58:d>profile.preferred+9?.16:0;
 // Commit to one flank until a new tactical beat, not a direction flip each tick.
 const tick=finite(p._aiClock),beat=Math.floor((tick+(p.playerNum||1)*23)/95);
 const spin=((beat+(p.playerNum||1))%2)?1:-1;
 const sidestep=order==='attack'?.12:order==='evade'?.65:order==='hold'?.85:
   profile.classId==='mobility'?.98:profile.classId==='control'?.86:
   mode==='clash'?.14:mode==='approach'?.26:mode==='bait'?.48:mode==='recover'?.36:
   mode==='reposition'?.60:.9;
 const sideX=-dy/d*spin,sideY=dx/d*spin;
 let x=dx/d*pressure+sideX*sidestep,y=dy/d*pressure+sideY*sidestep;
 // When both fighters are too close, lateral separation beats collision spam.
 if(d<safeRadius(p)+safeRadius(foe)+14&&mode!=='clash'){x-=dx/d*.80;y-=dy/d*.80;}
 return {x,y,mode,profile,distance:d,preferred:profile.preferred};
}
function plan(p,foe,speed,evadeOnly=false){
 const threats=sense(p,foe),intent=stance(p,foe,threats);
 const pn=magnitude(intent.x,intent.y)||1;
 let preferred={x:intent.x/pn,y:intent.y/pn};
 // On separated towers, use real stair/bridge nodes instead of trying to
 // charge across nonwalkable void. Keep the same movement physics at contact.
 if(g.ArenaTower?.active&&g.ArenaTowerTerrain?.nextWaypoint){
   const wp=g.ArenaTowerTerrain.nextWaypoint(g.ArenaTower?.state?.realm||p.towerRealm||'time',
     p,foe,dimension('width'),dimension('height'),g.ArenaTower?.state?.level||1,
     g.ArenaTower?.encounter?.tick||0);
   if(wp&&Math.hypot(wp.x-p.x,wp.y-p.y)>9){const dx=wp.x-p.x,dy=wp.y-p.y,d=Math.hypot(dx,dy);
     preferred={x:dx/d,y:dy/d};
   }
 }
 const pad=safeRadius(p)+18,w=dimension('width'),h=dimension('height');
 const base=clamp(finite(speed,2),.6,8);
 const oldX=finite(p.vx),oldY=finite(p.vy),oldSpeed=magnitude(oldX,oldY);
 const baseline=risk(p,foe,oldX,oldY,threats);
 const urgent=baseline>.34;
 if(evadeOnly&&!urgent)return null;
 const terrain=g.ArenaTower?.active?g.ArenaTowerTerrain:null;
 const baseZ=terrain?.worldHeight?.(p.x,p.y)||0;
 const role=intent.profile.role;
 const others=roster.filter(e=>e&&e!==p&&e!==foe&&e.hp>0);
 let best=null,bestScore=-Infinity;
 for(let i=-2;i<12;i++){
   const angle=i*Math.PI/6;
   let ux=i===-2?preferred.x:i===-1?0:Math.cos(angle);
   let uy=i===-2?preferred.y:i===-1?0:Math.sin(angle);
   const rawX=p.x+ux*base*18,rawY=p.y+uy*base*18;
   const futureX=clamp(rawX,pad,w-pad),futureY=clamp(rawY,pad,h-pad);
   const safety=risk(p,foe,ux*base,uy*base,threats);
   const border=clamp((pad-rawX)/30,0,3)+clamp((rawX-(w-pad))/30,0,3)
     +clamp((pad-rawY)/30,0,3)+clamp((rawY-(h-pad))/30,0,3)
     +(terrain?.arenaClearance&&g.ArenaTower?.active?
        clamp((pad-terrain.arenaClearance(g.ArenaTower?.state?.realm||p.towerRealm||'time',
          futureX,futureY,w,h))/20,0,12):0);
   const projectedDistance=magnitude(foe.x-futureX,foe.y-futureY);
   const gap=Math.abs(projectedDistance-intent.preferred);
   const preference=ux*preferred.x+uy*preferred.y;
   const inertia=oldSpeed>0?(ux*oldX+uy*oldY)/oldSpeed:0;
   let separation=0;
   for(const other of others){
     const dist=magnitude(other.x-futureX,other.y-futureY);
     if(dist<safeRadius(other)+pad+27)separation+=
       (safeRadius(other)+pad+27-dist)/25;
   }
   let elevation=0;
   if(terrain?.worldHeight){
     const candidateZ=terrain.worldHeight(futureX,futureY);
     const drop=baseZ-candidateZ;
     // Prefer high ground for ranged shots, but don't leap off a ledge to flee.
     elevation=clamp((candidateZ-baseZ)/30,-1.2,1.2)*(role==='ranged'?.85:.28);
     if(drop>18)elevation-=clamp((drop-18)/12,0,3)*1.6;
     // Simple line-of-sight estimate: terrain halfway along the lane is cover.
     if(role==='ranged'&&projectedDistance<350){
       const midX=(futureX+foe.x)/2,midY=(futureY+foe.y)/2;
       const midZ=terrain.worldHeight(midX,midY),targetZ=finite(foe.towerGroundZ);
       if(midZ>Math.max(candidateZ,targetZ)+13)elevation-=2.4;
     }
   }
   const still=ux===0&&uy===0;
   const score=-safety*(urgent?17:15)-border*12-gap*(intent.mode==='clash'?.004:.009)+
     preference*(urgent?.75:3.1)+inertia*.38-separation*2.3+elevation+
     (still&&intent.mode==='strafe'?-1:0);
   if(score>bestScore){bestScore=score;best={x:ux,y:uy,threat:baseline,danger:safety,
     mode:intent.mode,score};}
 }
 return best;
}
function steer(p,foe,speed){
 // Passive ball movement is owned by ArenaPinballMotion after abilities tick.
 // This suppresses chasing, fleeing, strafing and hazard steering but does
 // NOT touch target selection or skill canCast/aiming.
 if(g.ArenaPinballMotion?.enabled?.(p))return true;
 // Returning true skips the normal speed-lerp fallback in SkillForge too.
 // A short bounce grace therefore preserves physical velocity and heading.
 if(g.BounceMomentum?.enabled?.(p)&&p?._pinballReboundHold>0){
   p._pinballReboundHold--;
   return true;
 }
 if(!p||p.hp<=0||!foe||foe.hp<=0||p.forgeDash>0||
   p.movementOnlyFrames>0||p.manualTower||p.impactSpeed>5||
   (p.jumpState&&p.jumpState!=='ground'))return false;
 p._aiClock=(p._aiClock||0)+1;
 const base=clamp(finite(speed,2),.6,8),choice=plan(p,foe,base);
 if(!choice)return false;
 const tx=choice.x*base,ty=choice.y*base,oldX=finite(p.vx),oldY=finite(p.vy);
 const smoothing=choice.threat>.34?.29:.115;
 p.vx=oldX+(tx-oldX)*smoothing;p.vy=oldY+(ty-oldY)*smoothing;
 const v=magnitude(p.vx,p.vy),max=clamp(base*1.22,1,8.5);
 if(v>max){p.vx=p.vx/v*max;p.vy=p.vy/v*max;}
 p.aiDanger=choice.threat;p.aiManeuver=choice.mode;
 return true;
}
function react(p,foe){
 if(g.ArenaPinballMotion?.enabled?.(p))return false;
 // Legacy character skills remain authoritative; guide only ordinary movement.
 // Scripted dashes, launches, knockback and manual input are never overwritten.
 if(!p||!foe||p.hp<=0||foe.hp<=0||p.forge||
   p.forgeDash>0||p.movementOnlyFrames>0||p.manualTower||
   p.towerPatternBoss||p.impactSpeed>4||
   p.jumpState&&p.jumpState!=='ground')return false;
 const oldX=finite(p.vx),oldY=finite(p.vy),oldSpeed=magnitude(oldX,oldY);
 if(oldSpeed>5.4)return false;
 p._aiClock=(p._aiClock||0)+1;
 const speed=clamp(oldSpeed||2,1.5,4.2),choice=plan(p,foe,speed);
 if(!choice)return false;
 const strength=choice.threat>.34?.44:.18;
 p.vx=oldX*(1-strength)+choice.x*speed*strength;
 p.vy=oldY*(1-strength)+choice.y*speed*strength;
 p.aiManeuver=choice.mode;p.aiDanger=choice.threat;
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
 // A mobility-only dash is repositioning, not an automatic ram. Don't
 // charge into a body overlap or a visible danger zone. Combo skills that
 // deliberately link a dash with an attack keep their authored behavior.
 const pureMovement=actions.every(a=>MOBILITY.has(a.type));
 const rushing=actions.some(a=>['dash','burrowdash','flight'].includes(a.type));
 if(pureMovement&&rushing){
   if(distance<safeRadius(p)+safeRadius(target)+22)return false;
   const dx=(target.x-p.x)/Math.max(1,distance),dy=(target.y-p.y)/Math.max(1,distance);
   const dash=actions.find(a=>['dash','burrowdash','flight'].includes(a.type));
   const speed=clamp(finite(dash?.speed,5),2,9);
   if(risk(p,target,dx*speed,dy*speed)>risk(p,target,0,0)+.48)return false;
 }
 if(offensive.length&&!otherOffense&&g.AdvancedCombat?.canHit?.(p,target)===false)
   return false;
 return true;
}
g.ArenaAutoAI=Object.freeze({range,steer,react,canCast,plan,risk,signed,loadout,stance,targetFor,setRoster,getRoster});
})(typeof window!=='undefined'?window:globalThis);
