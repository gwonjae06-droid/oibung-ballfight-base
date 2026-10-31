/* Deterministic match anti-stalemate supervisor. All clocks measure simulated
 * 60 Hz physics ticks, so pause and 1x–100x behave consistently.
 * Does not change authored damage or skills. Only prolonged stalemates get
 * a visible overtime life cap that healing/shields cannot reset. */
(function(g){
'use strict';
const LIMITS={regular:120*60,tower:170*60,stagnant:38*60,towerStagnant:55*60,pressure:76*60};
let elapsed=0,lastProgress=0,pressureStart=-1,before=new Map(),notice=false;
const fraction=p=>Math.max(0,Number(p.hp)||0)/Math.max(1,Number(p.maxHp)||1);
function reset(){
 elapsed=0;lastProgress=0;pressureStart=-1;before=new Map();notice=false;
}
function tick(roster,tower=false){
 if(!Array.isArray(roster)||roster.filter(p=>p&&p.hp>0).length<2)return false;
 elapsed++;
 let progress=false;
 for(const p of roster){
  if(!p||p.hp<=0)continue;
  const ratio=fraction(p),previous=before.get(p);
  // True sustained net HP reductions count as progress. Healing/overhealing,
  // barrier refresh and harmless movement cannot postpone overtime forever.
  if(previous!==undefined&&ratio<previous-.005)progress=true;
  before.set(p,ratio);
 }
 if(progress)lastProgress=elapsed;
 const period=tower?LIMITS.tower:LIMITS.regular,
       dormant=tower?LIMITS.towerStagnant:LIMITS.stagnant;
 if(pressureStart<0&&(elapsed>=period||elapsed-lastProgress>=dormant)){
  pressureStart=elapsed;notice=true;
  g.addFloatingText?.('⚠ 결전: 시간이 갈수록 회복 가능한 체력 감소',250,80,'#ff9763',17);
 }
 if(pressureStart<0)return false;
 const overdue=elapsed-pressureStart;
 // The overtime cap always reaches zero in finite simulation time,
 // even for invincible or continuously healing fighters.
 const cap=Math.max(0,1-overdue/LIMITS.pressure);
 for(const p of roster){
  if(!p||p.hp<=0)continue;
  p.hp=Math.max(0,Math.min(p.hp,p.maxHp*cap));
 }
 return true;
}
g.ArenaStalemate=Object.freeze({tick,reset,
 get state(){return{elapsed,lastProgress,pressureStart,active:pressureStart>=0,notice};},
 LIMITS:Object.freeze(LIMITS)});
})(globalThis);
