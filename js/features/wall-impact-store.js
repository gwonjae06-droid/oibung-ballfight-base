/* Confirmed arena-wall collision telemetry for sentence-authored skills.
 * This module NEVER deals damage, spends energy, or runs user text.
 * Collision source: engine.js physical boundary resolution, after the
 * normal component of the reflected velocity was measured.
 */
(function(g){'use strict';
const MAX_EVENTS=48,COOLDOWN=26,MIN_SPEED=1.15;
const cap=(n,lo,hi,f=lo)=>Number.isFinite(Number(n))?
 Math.max(lo,Math.min(hi,Number(n))):f;
function state(p){return p?._forgeWallImpact||null;}
function serial(p){return state(p)?.serial||0;}
function record(p,speed,source){
 if(!p?.forge||p.forge.signatureVersion!==1||!(p.hp>0)||
    !Number.isFinite(speed)||speed<MIN_SPEED)return false;
 const frame=cap(p._forgeActionClock,0,1e9,0);
 const s=p._forgeWallImpact||=( {serial:0,lastFrame:-1000,events:[]} );
 // A hard time reset (new round) invalidates the old event window.
 if(frame<s.lastFrame){s.events.length=0;s.lastFrame=-1000;}
 if(frame-s.lastFrame<COOLDOWN)return false;
 s.lastFrame=frame;
 const mass=cap(g.ArenaBodyPhysics?.mass?.(p),.55,4.2,1);
 const impulse=cap(speed*mass,0,50,0);
 s.serial=Math.min(Number.MAX_SAFE_INTEGER,s.serial+1);
 s.events.push({seq:s.serial,frame,impulse,
  source:/^wall-(left|right|top|bottom)$/.test(String(source))?source:'wall'});
 if(s.events.length>MAX_EVENTS)s.events.splice(0,s.events.length-MAX_EVENTS);
 return true;
}
function since(p,after,startedAt){
 const list=state(p)?.events||[];
 const serialAfter=cap(after,0,Number.MAX_SAFE_INTEGER,0);
 const frameAfter=cap(startedAt,0,1e9,0);
 return list.filter(e=>e.seq>serialAfter&&e.frame>=frameAfter).slice(0,MAX_EVENTS);
}
g.WallImpactStore=Object.freeze({MAX_EVENTS,COOLDOWN,MIN_SPEED,record,serial,since});
})(typeof window!=='undefined'?window:globalThis);
