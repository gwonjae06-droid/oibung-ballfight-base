/* Combat overtime rewards successful attacks without invalidating the shield,
 * healing, CC and regeneration strategies players can invent.
 * No forced HP loss, no healing cap, no invincibility bypass.
 * Only simulated physics ticks count; absolute deadline is a neutral draw. */
(function(g){
'use strict';
const LIMITS=Object.freeze({
 regular:120*60,tower:170*60,stagnant:38*60,towerStagnant:55*60,
 pulse:120,deadline:240*60
});
let elapsed=0,lastProgress=0,pressureStart=-1,before=new Map(),notice=false,expired=false,pulses=0,bonus=0;
const fraction=p=>Math.max(0,Number(p.hp)||0)/Math.max(1,Number(p.maxHp)||1);
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
  if(rate)rate.textContent='공격 위력 +'+Math.round((attackFactor()-1)*100)+'% · 회복·보호막 정상 적용';
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
 // Frequency is for visual feedback only, NOT neutral damage pulses.
 if(overdue>0&&overdue%LIMITS.pulse===0){
  pulses++;bonus=Math.round((attackFactor()-1)*100);
  status(true);
 }
 // A duel with two immortal/healing builds is an honorable DRAW, never a
 // victory assigned to whichever build happened to have more HP.
 if(overdue>=LIMITS.deadline)expired=true;
 return true;
}
function finish(){status(false);g.BackgroundMusic?.setOvertime?.(false);}
g.ArenaStalemate=Object.freeze({tick,reset,finish,attackFactor,
 get state(){return {elapsed,lastProgress,pressureStart,active:pressureStart>=0,notice,
   expired,pulses,bonus,percentage:bonus};},
 LIMITS});
})(globalThis);
