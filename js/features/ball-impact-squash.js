/* Impact squash-and-stretch for the original bouncing go-stone fighters.
 * PURELY visual: no collision radii, HP, knockback or velocities are modified. */
(function(g){
'use strict';
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
function impulse(p,energy,nx,ny){
 if(!p||p.hp<=0||!Number.isFinite(energy)||energy<1.15)return false;
 const old=p._ballSquash;
 if(old&&old.age<4)return false; // one impact, one compression; no jitter storms
 const strength=cap((energy-.85)/11,.28,1);
 p._ballSquash={age:0,strength,angle:Math.atan2(ny||0,nx||1)};
 return true;
}
function pair(a,b,approach,nx,ny){
 if(!(approach<-.65))return false;
 const energy=-approach;
 const first=impulse(a,energy,nx,ny);
 const second=impulse(b,energy,nx,ny);
 return first||second;
}
function wall(p,nx,ny,speed){return impulse(p,Math.abs(speed||0),nx,ny);}
function tick(p){if(!p?._ballSquash)return;const data=p._ballSquash;data.age++;
 if(data.age>=23)delete p._ballSquash;
}
function pose(p){
 const s=p?._ballSquash;
 if(!s)return {sx:1,sy:1,angle:0,compression:0};
 const t=s.age;
 let delta;
 if(t<=3)delta=s.strength*.37*Math.sin(Math.PI*.5*t/3);
 else if(t<=9)delta=-s.strength*.20*Math.sin(Math.PI*(t-3)/6);
 else delta=s.strength*.10*Math.exp(-(t-9)/5)*Math.sin((t-9)*1.12);
 return {sx:cap(1-delta,.68,1.23),sy:cap(1+delta,.81,1.36),angle:s.angle,compression:delta};
}
g.ArenaBallSquash=Object.freeze({pair,wall,tick,pose});
})(typeof window!=='undefined'?window:globalThis);
