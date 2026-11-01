/* Pure pinball locomotion for ALL ordinary balls.
 * Ordinary movement never reads enemy position, HP, attack radius or hazards.
 * A real collision solver / wall is the ONLY source of direction change.
 * Skill aiming / dash / jumping / explicit temporary movement remain owned by
 * their existing ability code; projectiles remain fully target-aware.
 *
 * begin/end wrap each fighter's normal BEHAVIORS.update. That lets legacy
 * characters keep timers/projectiles without their chase/spacing velocity AI.
 * End reads the pre-behavior velocity, so knockback from other fighters isn't
 * accidentally discarded and a wall rebound remains intact.
 */
(function(g){
'use strict';
const PI=Math.PI;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,f=0)=>Number.isFinite(n)?n:f;
function enabled(p){
 if(!p||p.hp<=0||p.manualTower)return false;
 // The Ancient One is a giant background body/arm, not a moving ball.
 if(g.ArenaTower?.active&&g.ArenaTower?.state?.ancient&&p.towerEnemy)return false;
 return true;
}
function scripted(p){
 return !!(p.forgeDash>0||p.movementOnlyFrames>0||p._scratchMove||
   (p._pinballRewindUntil||0)>(p._forgeActionClock||0)||
   p.forgeCharge?.phase==='charging'||p.forgePhase?.time>0||
   p.jumpState&&p.jumpState!=='ground'||
   // A real temporary 'mad bull' charge is allowed to home in on the target.
   p.id==='choi'&&p.suneungState==='success');
}
function begin(p){
 if(!enabled(p))return null;
 return {vx:finite(p.vx),vy:finite(p.vy),scripted:scripted(p)};
}
function baseSpeed(p){
 // Ordinary fighter type alters only movement SPEED, never AI direction.
 const forge=Number(p.forge?.speed);
 if(Number.isFinite(forge)&&forge>0)return clamp(forge*1.13,1.4,5.25);
 return p.id==='oh'?(p.mode==='boin'?4.05:2.65):p.id==='choi'?3.06:p.id==='park'?3.12:3.18;
}
function initialDirection(p){
 // Distinct, deterministic launch headings, independent of opponents.
 const slot=Number(p.playerNum)||1;
 const id=String(p.id||p.forge?.name||p.name||'ball');
 let hash=0;
 for(let i=0;i<id.length;i++)hash=(hash*33+id.charCodeAt(i))%10007;
 const phase=(slot*.61803398875+hash*.000118)%1;
 const a=phase*PI*2;
 return {x:Math.cos(a),y:Math.sin(a)};
}
function end(p,before){
 if(!enabled(p))return false;
 // Never override an authored skill's deliberate movement or the physics
 // of a character currently jumping, teleporting, or dashing.
 if(!before||before.scripted||scripted(p))return false;
 // During the Space God's zero-G phase, inertia is conserved: no ordinary
 // cruise-speed convergence, chasing, or forced steering between collisions.
 if(p._towerSpaceZeroG>0){
   p.vx=before.vx;p.vy=before.vy;p.aiManeuver='zero-gravity';
   return true;
 }
 let x=before.vx,y=before.vy,magnitude=Math.hypot(x,y);
 const cruise=baseSpeed(p);
 if(magnitude<.04||!Number.isFinite(magnitude)){
  const direction=initialDirection(p);
  x=direction.x*cruise;y=direction.y*cruise;magnitude=cruise;
 }else{
  // Slowly restore ordinary rolling speed without changing the heading.
  // Preserve real contact/bumper impulse for multiple frames.
  const weight=magnitude>cruise?(p._pinballReboundHold>0?.006:.014):.060;
  const next=clamp(magnitude+(cruise-magnitude)*weight,.65,11.4);
  x=x/magnitude*next;y=y/magnitude*next;
 }
 p.vx=x;p.vy=y;
 p.aiManeuver='pinball';p.aiDanger=0;
 return true;
}
g.ArenaPinballMotion=Object.freeze({enabled,scripted,begin,end,baseSpeed,initialDirection});
})(typeof window!=='undefined'?window:globalThis);
