/* Momentum-based bouncy arena skills. Fixed 60 fps physics ticks; no timers,
 * new direct damage, or velocity manipulation. One signature cast per 100 momentum.
 * Legacy four-slot player characters and manual control remain untouched.
 * Every Tower enemy, including normal-floor minions, shares one 100-point
 * meter for authored skills. Bosses also spend it on scripted patterns. */
(function(g){
'use strict';
const MAX=100, PASSIVE=.17, CONTACT=16, WALL=9, BASIC_HIT=3;
const clamp=n=>Math.max(0,Math.min(MAX,Number.isFinite(n)?n:0));
function isBoss(p){return !!p?.forge&&p.towerEnemy&&p.towerPatternBoss&&!p.manualTower;}
function isMinion(p){return !!p?.forge&&p.towerEnemy&&!p.towerPatternBoss&&!p.manualTower;}
function enabled(p){
 return !!p?.forge&&!p.manualTower&&
  (isBoss(p)||isMinion(p)||(p.forge.signatureVersion===1&&!p.towerEnemy));
}
function meter(p){return enabled(p)?clamp(p._bounceMomentum||0):null;}
function add(p,amount,kind){
 if(!enabled(p)||p.hp<=0||!Number.isFinite(amount)||amount<=0)return false;
 const clock=Number(p._forgeActionClock)||0;
 const gaps={contact:34,wall:26,basic:23};
 const name='_bounceLast_'+kind;
 // Clock 0 is valid (the first simulation tick); do not treat it as
 // missing and accidentally reward repeated overlap/rebounds at match start.
 if(gaps[kind]&&Number.isFinite(p[name])&&clock-p[name]<gaps[kind])return false;
 if(gaps[kind])p[name]=clock;
 if(kind==='contact'||kind==='wall')g.SignatureLive?.record?.(p,kind);
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
 const first=add(a,boost,'contact'),second=add(b,boost,'contact');
 return first||second;
}
function wall(p,speed){
 return Number.isFinite(speed)&&speed>=1.15&&add(p,WALL,'wall');
}
function basicHit(p){return add(p,BASIC_HIT,'basic');}
function damageTaken(p,damage){
 if(!(isBoss(p)||isMinion(p))||!Number.isFinite(damage)||damage<=0)return false;
 // Only confirmed positive-damage hits count, never shielded/blocked hits.
 // Normal foes earn a little less than bosses to avoid crowding the screen.
 const boost=isBoss(p)?Math.min(14,Math.max(3,Math.round(Math.sqrt(damage)*1.7))):
  Math.min(7,Math.max(2,Math.round(Math.sqrt(damage)*.85)));
 return add(p,boost,'damage');
}
function bossPhase(p){return isBoss(p)?p._bossMomentumPhase||'pattern':null;}
function bossCan(p,kind){return isBoss(p)&&ready(p)&&bossPhase(p)===kind;}
function bossSpend(p,kind){
 if(!bossCan(p,kind)||!spend(p))return false;
 // A single meter funds every boss move. Specials remain telegraphed and
 // are never added on a separate timer while the gauge is below 100.
 p._bossMomentumPhase=p._ancientEnergyOnly?'pattern':
  kind==='pattern'?'skill':kind==='skill'?'spectacle':'pattern';
 if(kind==='skill')p._bossEnergyCursor=(p._bossEnergyCursor||0)+1;
 return true;
}
function tick(p,target){
 if(!enabled(p)||p.hp<=0||!target||target.hp<=0)return;
 add(p,isBoss(p)?PASSIVE*1.75:isMinion(p)?PASSIVE*.95:PASSIVE,'passive');
}
function ready(p){return enabled(p)&&meter(p)>=MAX;}
function spend(p){
 if(!ready(p))return false;
 p._bounceMomentum=0;
 p._bounceCasts=(p._bounceCasts||0)+1;
 return true;
}
g.BounceMomentum=Object.freeze({MAX,PASSIVE,CONTACT,WALL,BASIC_HIT,isBoss,isMinion,bossPhase,bossCan,bossSpend,damageTaken,enabled,meter,add,contact,wall,basicHit,tick,ready,spend});
})(typeof window!=='undefined'?window:globalThis);
