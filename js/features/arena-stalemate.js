/* Combat overtime rewards successful attacks without invalidating the shield,
 * healing, CC and regeneration strategies players can invent.
 * Late fights also suffer equal max-HP percentage true damage. This ignores
 * shields and invulnerability, but healing can counter the pressure. A fixed
 * deadline ends otherwise immortal bouts as a neutral draw. */
(function(g){
'use strict';
const LIMITS=Object.freeze({
 regular:300*60,tower:105*60,stagnant:150*60,towerStagnant:65*60,
 pulse:120,deadline:300*60,towerDeadline:85*60
});
let elapsed=0,lastProgress=0,pressureStart=-1,before=new Map(),notice=false,expired=false,pulses=0,bonus=0;
const fraction=p=>Math.max(0,Number(p.hp)||0)/Math.max(1,Number(p.maxHp)||1);
function pulseRate(overdue){
 // Modest ramp every 20 seconds: 1.25% → 4.50% at the 120s draw cap.
 return Math.min(6.5,1.25+Math.floor(Math.max(0,overdue)/(20*60))*.65);
}
function attackFactor(){
 if(pressureStart<0||expired)return 1;
 const overdue=Math.max(0,elapsed-pressureStart);
 // Gentle damage escalation: +8% on activation; +7% per 30s, max +50%.
 // This multiplies only actual offensive hits; invincibility and heals work.
 return 1+Math.min(.50,.08+Math.floor(overdue/(30*60))*.07);
}
function status(visible){
 const banner=g.document?.getElementById?.('arena-overtime-banner');
 if(!banner)return;
 banner.hidden=!visible;
 if(visible){
  const rate=banner.querySelector?.('.arena-overtime-rate');
  if(rate)rate.textContent='2초마다 최대 HP '+pulseRate(elapsed-pressureStart).toFixed(2)+'% 피해 · 공격 +'+Math.round((attackFactor()-1)*100)+'%';
 }
}
function reset(){
 elapsed=0;lastProgress=0;pressureStart=-1;before=new Map();
 notice=false;expired=false;pulses=0;bonus=0;
 g.BackgroundMusic?.setOvertime?.(false);
 status(false);
}
function tick(roster,tower=false){
 if(!Array.isArray(roster)||roster.filter(p=>p&&p.hp>0).length<2)return false;
 elapsed++;
 let progress=false;
 for(const p of roster){
  if(!p||p.hp<=0)continue;
  const ratio=fraction(p),previous=before.get(p);
  if(previous!==undefined&&ratio<previous-.005)progress=true;
  before.set(p,ratio);
 }
 if(progress)lastProgress=elapsed;
 const period=tower?LIMITS.tower:LIMITS.regular,
       dormant=tower?LIMITS.towerStagnant:LIMITS.stagnant;
 if(pressureStart<0&&(elapsed>=period||elapsed-lastProgress>=dormant)){
  pressureStart=elapsed;notice=true;
  g.addFloatingText?.('⚔ 결전 시작!',250,80,'#ff9763',19);
  g.BackgroundMusic?.setOvertime?.(true);
  status(true);
 }
 if(pressureStart<0)return false;
 const overdue=elapsed-pressureStart;
 // Neutral percentage damage hits every living fighter equally, regardless
 // of absolute HP, invulnerability or a shield. Lifesteal and heals can still
 // respond on subsequent ticks. Zero damage does not postpone the deadline.
 if(overdue>0&&overdue%LIMITS.pulse===0){
  const pct=pulseRate(overdue),fraction=pct/100;
  pulses++;bonus=Math.round((attackFactor()-1)*100);
  for(const p of roster){
   if(!p||!(p.hp>0))continue;
   const maxHp=Math.max(1,Number(p.maxHp)||1);
   p.hp=Math.max(0,p.hp-maxHp*fraction);
   g.addFloatingText?.('-'+pct.toFixed(2)+'%',p.x,p.y-35,'#ff9177',15);
  }
  status(true);
 }
 // If healing remains stronger than the pressure, finish as a DRAW: never
 // decide the outcome merely by absolute or remaining health.
 if(overdue>=(tower?LIMITS.towerDeadline:LIMITS.deadline))expired=true;
 return true;
}
function finish(){status(false);g.BackgroundMusic?.setOvertime?.(false);}
g.ArenaStalemate=Object.freeze({tick,reset,finish,attackFactor,pulseRate,
 get state(){return {elapsed,lastProgress,pressureStart,active:pressureStart>=0,notice,
   expired,pulses,bonus,percentage:pressureStart<0?0:pulseRate(elapsed-pressureStart)};},
 LIMITS});
})(globalThis);
