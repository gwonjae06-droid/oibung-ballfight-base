/* Momentum-based bouncy arena skills. Fixed 60 fps physics ticks; no timers,
 * new direct damage, or velocity manipulation. One signature cast per 100 momentum.
 * Enemy/boss scripts, legacy four-slot characters, and manual control untouched. */
(function(g){
'use strict';
const MAX=100, PASSIVE=.17, CONTACT=16, WALL=9, BASIC_HIT=3;
const clamp=n=>Math.max(0,Math.min(MAX,Number.isFinite(n)?n:0));
function enabled(p){
 return !!p?.forge&&p.forge.signatureVersion===1&&!p.towerEnemy&&!p.manualTower;
}
function meter(p){return enabled(p)?clamp(p._bounceMomentum||0):null;}
function add(p,amount,kind){
 if(!enabled(p)||p.hp<=0||!Number.isFinite(amount)||amount<=0)return false;
 const clock=Number(p._forgeActionClock)||0;
 const gaps={contact:34,wall:26,basic:23};
 const name='_bounceLast_'+kind;
 if(gaps[kind]&&clock-(Number(p[name])||-1000)<gaps[kind])return false;
 if(gaps[kind])p[name]=clock;
 const previous=meter(p);
 p._bounceMomentum=clamp(previous+amount);
 if(previous<MAX&&p._bounceMomentum===MAX){
  p._bounceReadyAt=clock;
  g.addFloatingText?.('⚡ 기세 충전!',p.x,p.y-(p.radius||32)-18,p.forge.effectColor||'#afdcff',15);
 }
 return p._bounceMomentum>previous;
}
function contact(a,b,approach){
 if(!Number.isFinite(approach)||approach> -1.15)return false;
 const speed=Math.min(5,Math.max(0,-approach-1.15));
 // Stronger collisions reward a little more, but all gains are bounded.
 const boost=CONTACT+Math.round(speed*.7);
 return add(a,boost,'contact')||add(b,boost,'contact');
}
function wall(p,speed){
 return Number.isFinite(speed)&&speed>=1.15&&add(p,WALL,'wall');
}
function basicHit(p){return add(p,BASIC_HIT,'basic');}
function tick(p,target){
 if(!enabled(p)||p.hp<=0||!target||target.hp<=0)return;
 add(p,PASSIVE,'passive');
}
function ready(p){return enabled(p)&&meter(p)>=MAX;}
function spend(p){
 if(!ready(p))return false;
 p._bounceMomentum=0;
 p._bounceCasts=(p._bounceCasts||0)+1;
 return true;
}
g.BounceMomentum=Object.freeze({MAX,PASSIVE,CONTACT,WALL,BASIC_HIT,enabled,meter,add,contact,wall,basicHit,tick,ready,spend});
})(typeof window!=='undefined'?window:globalThis);
