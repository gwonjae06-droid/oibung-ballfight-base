/* Impact squash-and-stretch for the original bouncing go-stone fighters.
 * PURELY visual: no collision radii, HP, knockback or velocities are modified. */
(function(g){
'use strict';
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
function impulse(p,energy,nx,ny){
 if(!p||p.hp<=0||!Number.isFinite(energy)||energy<1.15)return false;
 const old=p._ballSquash;
 if(old&&old.age<5)return false; // one impact, one compression; no jitter storms
 const strength=cap((energy-1.1)/13,.20,.88);
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
 if(data.age>=19)delete p._ballSquash;
}
function pose(p){
 const s=p?._ballSquash;
 if(!s)return {sx:1,sy:1,angle:0,compression:0};
 const t=s.age;
 let delta;
 if(t<=3)delta=s.strength*.24*Math.sin(Math.PI*.5*t/3);
 else if(t<=8)delta=-s.strength*.13*Math.sin(Math.PI*(t-3)/5);
 else delta=s.strength*.085*Math.exp(-(t-8)/4)*Math.sin((t-8)*1.3);
 return {sx:cap(1-delta,.78,1.17),sy:cap(1+delta,.83,1.23),angle:s.angle,compression:delta};
}
g.ArenaBallSquash=Object.freeze({pair,wall,tick,pose});
})(typeof window!=='undefined'?window:globalThis);
