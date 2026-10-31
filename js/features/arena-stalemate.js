/* Combat overtime: every fighter takes the same percentage of THEIR maximum
 * health per pulse, regardless of build HP. All timing uses 60 Hz simulation
 * ticks, paused battles do not advance it. Recovery remains possible.
 * A hard draw deadline prevents permanent healing/shield loops. */
(function(g){
'use strict';
const LIMITS=Object.freeze({
 regular:120*60,tower:170*60,stagnant:38*60,towerStagnant:55*60,
 pulse:120,deadline:240*60
});
let elapsed=0,lastProgress=0,pressureStart=-1,before=new Map(),notice=false,expired=false,pulses=0;
let display=0;
const fraction=p=>Math.max(0,Number(p.hp)||0)/Math.max(1,Number(p.maxHp)||1);
function status(visible,pct){
 const banner=g.document?.getElementById?.('arena-overtime-banner');
 if(!banner)return;
 banner.hidden=!visible;
 if(visible){
  const rate=banner.querySelector?.('.arena-overtime-rate');
  if(rate)rate.textContent='모든 캐릭터에게 '+pct.toFixed(2)+'% 최대 HP 피해 / 2초';
 }
}
function reset(){
 elapsed=0;lastProgress=0;pressureStart=-1;before=new Map();
 notice=false;expired=false;pulses=0;display=0;
 g.BackgroundMusic?.setOvertime?.(false);
 status(false,0);
}
function pulseRate(overdue){
 // 1.25% per 2s initially, gradually rising to 4.0%.
 return Math.min(4,1.25+Math.floor(overdue/(30*60))*.35);
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
  status(true,pulseRate(0));
 }
 if(pressureStart<0)return false;
 const overdue=elapsed-pressureStart;
 if(overdue>0&&overdue%LIMITS.pulse===0){
  const percentage=pulseRate(overdue),amount=percentage/100;
  pulses++;display=percentage;
  for(const p of roster){
   if(!p||p.hp<=0)continue;
   // Guaranteed neutral environmental damage. Ignores shield and
   // invulnerability; neither max HP nor flat current HP buys immunity.
   const damage=Math.max(.01,Math.max(1,p.maxHp)*amount);
   p.hp=Math.max(0,p.hp-damage);
   g.addFloatingText?.('-'+percentage.toFixed(2)+'%',p.x,p.y-35,'#ff9177',15);
  }
  status(true,percentage);
 }
 // Even extreme 100%/s healing must not run forever. If nobody has won
 // through normal combat or % damage by this point, resolve as a draw.
 if(overdue>=LIMITS.deadline)expired=true;
 return true;
}
g.ArenaStalemate=Object.freeze({tick,reset,pulseRate,
 get state(){return {elapsed,lastProgress,pressureStart,active:pressureStart>=0,notice,
   expired,pulses,percentage:display};},
 LIMITS});
})(globalThis);