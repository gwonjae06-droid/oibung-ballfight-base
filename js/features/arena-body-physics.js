/* Elastic BODY collision impulse; never inflicts damage or invokes hit skills.
 * Velocity belongs to physics, independent of target-aware skill selection.
 * Positional separation and scripted dash exclusions are kept by engine.js. */
(function(g){
'use strict';
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
function mass(p){
 const r=clamp(Number(p?.radius)||28,12,62);
 // Square-radius scaling approximates two-dimensional disc mass.
 // Bosses feel heavier without becoming immovable or unlaunchable.
 const anchored=!!p?.towerHero&&!p?.towerEnemy&&
  (Number(p?._tacticalAnchorUntil)||0)>(Number(p?._forgeActionClock)||0);
 return clamp(Math.pow(r/28,2)*(p?.towerPatternBoss?1.35:anchored?1.65:Number(p?._originalMassBoost)||1),.55,4.2);
}
function pair(a,b,nx,ny){
 const avx=Number(a?.vx)||0,avy=Number(a?.vy)||0;
 const bvx=Number(b?.vx)||0,bvy=Number(b?.vy)||0;
 const approach=(bvx-avx)*nx+(bvy-avy)*ny;
 if(!Number.isFinite(approach)||approach>=-.08)return false;
 const invA=1/mass(a),invB=1/mass(b);
 // Arcade spring, conserving mass-weighted momentum while making
 // genuine head-on hits audibly and visibly punchier. No effects on retreat.
 const speed=-approach;
 const restitution=clamp(1.06+Math.max(0,speed-2)*.019,1.06,1.22);
 const impulse=Math.min(18,-(1+restitution)*approach/(invA+invB));
 const ix=impulse*nx,iy=impulse*ny;
 a.vx=clamp(avx-ix*invA,-12,12);
 a.vy=clamp(avy-iy*invA,-12,12);
 b.vx=clamp(bvx+ix*invB,-12,12);
 b.vy=clamp(bvy+iy*invB,-12,12);
 for(const p of [a,b])p._pinballReboundHold=Math.max(19,p._pinballReboundHold||0);
 return {approach,impulse,massA:mass(a),massB:mass(b)};
}
g.ArenaBodyPhysics=Object.freeze({mass,pair});
})(typeof window!=='undefined'?window:globalThis);
