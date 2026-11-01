/* Momentum-based bouncy arena skills. Fixed 60 fps physics ticks; no timers,
 * new direct damage, or velocity manipulation. One signature cast per 100 momentum.
 * Legacy four-slot player characters and manual control remain untouched.
 * Every Tower enemy, including normal-floor minions, shares one 100-point
 * meter for authored skills. Bosses also spend it on scripted patterns. */
(function(g){
'use strict';
const MAX=100, PASSIVE=.17, CONTACT=16, WALL=9, BASIC_HIT=3;
// Authored time skills modify this one meter, not a second cooldown clock.
// Time acceleration magnifies positive recharge, but never instantly casts
// another skill. Time stop disables the victim's recharge while it lasts.
const TIME_ACCEL=1.75,TIME_HASTE=1.25,TIME_STEAL_CAP=20;
const clamp=n=>Math.max(0,Math.min(MAX,Number.isFinite(n)?n:0));
function isBoss(p){return !!p?.forge&&p.towerEnemy&&p.towerPatternBoss&&!p.manualTower;}
function isMinion(p){return !!p?.forge&&p.towerEnemy&&!p.towerPatternBoss&&!p.manualTower;}
function enabled(p){
 // All automatic combatants share one 100 energy gauge: original five,
 // legacy saved custom multi-skill profiles, new signatures and tower foes.
 return !!p&&!p.manualTower&&(!!p.forge||!!g.ArenaOriginalMomentum?.isOriginal?.(p));
}
function meter(p){return enabled(p)?clamp(p._bounceMomentum||0):null;}
function add(p,amount,kind){
 if(!enabled(p)||p.hp<=0||!Number.isFinite(amount)||amount<=0)return false;
 const timed=kind==='passive'||kind==='contact'||kind==='wall'||kind==='damage';
 if(timed&&g.ForgeExpansion?.active?.(p,'momentumStasis'))return false;
 if(timed){
   // The strongest temporary time effect wins; combining two speed blocks
   // cannot multiply the same recharge twice in one physics tick.
   if(g.ForgeExpansion?.active?.(p,'timeburst'))amount*=TIME_ACCEL;
   else if(g.ForgeExpansion?.active?.(p,'haste'))amount*=TIME_HASTE;
 }
 // +15% per Tower haste blessing (max 2 stacks, +32.25% total).
 // Counts only naturally earned energy, never synthetic time-steal refunds;
 // the existing 100 cap, wall/contact cooldowns, and time-effect priority stay.
 if(timed&&!p.towerEnemy&&p.towerHero&&Number.isFinite(p._towerMomentumBoost))
   amount*=Math.max(1,Math.min(1.3225,p._towerMomentumBoost));
 const clock=Number(p._forgeActionClock)||Number(p._combat2Tick)||0;
 const gaps={contact:34,wall:26,basic:23};
 const name='_bounceLast_'+kind;
 // Clock 0 is valid (the first simulation tick); do not treat it as
 // missing and accidentally reward repeated overlap/rebounds at match start.
 if(gaps[kind]&&Number.isFinite(p[name])&&clock-p[name]<gaps[kind])return false;
 if(gaps[kind])p[name]=clock;
 if(kind==='contact'||kind==='wall')g.SignatureLive?.record?.(p,kind);
 const previous=meter(p);
 p._bounceMomentum=clamp(previous+amount);
 if(previous<70&&p._bounceMomentum>=70)
   g.ArenaBattleDirector?.charge?.(p,70);
 if(previous<MAX&&p._bounceMomentum===MAX){
  p._bounceReadyAt=clock;
  g.ArenaBattleDirector?.charge?.(p,100);
  g.addFloatingText?.('⚡ 기세 충전!',p.x,p.y-(p.radius||32)-18,p.forge?.effectColor||p.tagColor||'#afdcff',15);
  if(p.playerNum===1&&g.ArenaCombatV2?.eligible?.(p)&&g.ArenaCombatV2.timing(p.forge)!=='instant')g.BattleFX?.sound?.('signature-ready',.37);
 }
 return p._bounceMomentum>previous;
}
function contact(a,b,approach){
 if(!Number.isFinite(approach)||approach> -1.15)return false;
 const speed=Math.min(5,Math.max(0,-approach-1.15));
 // Stronger collisions reward a little more, but all gains are bounded.
 const boost=CONTACT+Math.round(speed*.7);
 const beforeA=a?._bounceLast_contact,beforeB=b?._bounceLast_contact;
 const first=add(a,boost,'contact'),second=add(b,boost,'contact');
 // Full 100 energy cannot gain more, but a genuine new physical rebound
 // still contributes to the spectacle. The gauge's 34-frame anti-spam
 // timestamp changes only on accepted contacts, even when energy is capped.
 if(first||a?._bounceLast_contact!==beforeA)
   g.ArenaCombatV2?.afterEnergy?.(a,'contact',-approach);
 if(second||b?._bounceLast_contact!==beforeB)
   g.ArenaCombatV2?.afterEnergy?.(b,'contact',-approach);
 return first||second;
}
function wall(p,speed,kind='wall'){
 if(!Number.isFinite(speed)||speed<1.15)return false;
 const before=p?._bounceLast_wall;
 const gained=add(p,WALL,'wall');
 if(gained||p?._bounceLast_wall!==before)
   g.ArenaCombatV2?.afterEnergy?.(p,'wall',speed,kind);
 return gained;
}
// Time stop is a non-damaging momentum swing. Only a real CC application
// may steal; an immune target or old four-slot fighter contributes nothing.
function timeSteal(caster,victim,cap=TIME_STEAL_CAP){
 if(!enabled(caster)||!enabled(victim)||caster===victim||
    caster.hp<=0||victim.hp<=0)return 0;
 const taken=Math.min(clamp(cap),TIME_STEAL_CAP,meter(victim));
 if(taken<=0)return 0;
 victim._bounceMomentum=clamp(meter(victim)-taken);
 // Give back only half: stasis is powerful without granting free immediate
 // 100-energy chains. The remainder is removed from the encounter.
 add(caster,taken*.5,'timeSteal');
 return taken;
}
function basicHit(p){return false;} // retired automatic basic attacks
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
g.BounceMomentum=Object.freeze({MAX,PASSIVE,CONTACT,WALL,BASIC_HIT,TIME_ACCEL,TIME_HASTE,TIME_STEAL_CAP,timeSteal,isBoss,isMinion,bossPhase,bossCan,bossSpend,damageTaken,enabled,meter,add,contact,wall,basicHit,tick,ready,spend});
})(typeof window!=='undefined'?window:globalThis);
