/* Loadout-wide soft budget: preserve authored numbers while penalizing high-frequency
   multi-skill damage combinations. Shared in tower, free battle and PvP. */
(function(g){'use strict';
// Movement and protective walls do not do damage. Charge/timeburst affect only relevant budgets.
const TYPES=new Set('wave shot beam bolt pull orbit zone homing pierce boomerang chain nova meteor mine drain blackhole starfall dung flight burrow dive uppercut slash spinslash thrust aircombo arcshot splitshot summon turret trap burrowdash erupt'.split(' '));
const REPEAT=new Set('zone orbit mine blackhole starfall dung turret summon trap'.split(' '));
const cap=(n,l,h)=>Math.min(h,Math.max(l,n)),n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const BUDGET=65;
function actionPressure(a){
 if(!a||!TYPES.has(a.type))return 0;
 const damage=cap(n(a.damage),0,120),count=cap(n(a.count,1),1,8);
 const radius=cap(n(a.radius,120),30,300),duration=cap(n(a.duration,1.5),.2,8);
 return damage*(1+(count-1)*.13)*(1+Math.max(0,radius-125)/420)*
  (REPEAT.has(a.type)?1+Math.min(1.1,duration*.13):1)*
  (a.status&&a.status!=='none'?1.13:1);
}
function skillPressure(s){
 const actions=(s?.actions||[]).slice(0,3),charge=actions.find(a=>a.type==='charge');
 const raw=actions.reduce((sum,a)=>sum+actionPressure(a),0)*
   (charge?1+Math.min(.48,cap(n(charge.duration,1.2),.2,8)*.12):1);
 const cd=Math.max(.2,cap(n(s?.cooldown,3),.2,30),
    charge?Math.min(3,cap(n(charge.duration,1.2),.2,8))+.18:0);
 const availability=s?.trigger==='lowhp'?.7+.3*cap((n(s.threshold,40)-40)/55,0,1):s?.trigger==='damaged'?.65:s?.trigger==='contact'?.7:1;
 return raw/cd*availability;
}
function accelerationUptime(skills){
 return cap(skills.reduce((uptime,s)=>{
  const bursts=(s.actions||[]).filter(a=>a.type==='timeburst');
  if(!bursts.length)return uptime;
  const duration=Math.max(...bursts.map(a=>n(a.duration,1.5)));
  return uptime+Math.min(1,duration/Math.max(.2,n(s.cooldown,3)));
 },0),0,1);
}
function summary(profile){
 const skills=profile?.allAbilities&&g.SkillForge?.allSkillset?g.SkillForge.allSkillset():profile?.skills||[];
 const perSkill=skills.map(skillPressure);
 const charges=skills.flatMap(s=>s.actions||[]).filter(a=>a.type==='charge');
 // A separately authored charge skill also benefits other offensive slots,
 // so factor that benefit into the shared offensive budget.
 const bonus=charges.length?1+Math.min(.4,
   Math.max(...charges.map(a=>cap(n(a.duration,1.2),.2,8)))*.11):1;
 // Time acceleration doubles cooldown progression, not only its visuals. Estimate
 // the upkeep across independently recharging skills when computing damage.
 const timeAcceleration=accelerationUptime(skills);
 const pressure=perSkill.reduce((sum,x)=>sum+x,0)*bonus*(1+timeAcceleration);
 const multiplier=cap(pressure>BUDGET?Math.pow(BUDGET/pressure,.82):1,.18,1);
 return {pressure:Number(pressure.toFixed(1)),budget:BUDGET,
  percent:Math.round(multiplier*100),multiplier:Number(multiplier.toFixed(4)),
  excess:pressure>BUDGET,perSkill:perSkill.map(x=>Number(x.toFixed(1)))};
}
// A SEPARATE defensive budget: only extreme repeated sustain is softened.
// Raw authored values, cooldowns, targets, and the ability to build near-
// permanent shields remain available. No blanket healing or immunity ban.
const DEFENSE_BUDGET=90;
function defenseSkillPressure(s){
 const cd=Math.max(.2,cap(n(s?.cooldown,3),.2,30));
 const availability=s?.trigger==='lowhp'?.7+.3*cap((n(s.threshold,40)-40)/55,0,1):s?.trigger==='damaged'?.65:s?.trigger==='contact'?.7:1;
 const pressure=(s?.actions||[]).slice(0,3).reduce((sum,a)=>{
  const duration=cap(n(a.duration,1.5),.2,8),power=cap(n(a.damage),0,120);
  switch(a.type){
   case 'heal':return sum+power/cd;
   case 'shield':return sum+105*duration/cd;
   case 'regen':return sum+(power*.50)*Math.min(1,duration/cd);
   case 'lifebloom':return sum+power*.47*duration/cd;
   case 'fortify':return sum+40*duration/cd;
   case 'drain':return sum+power*.25/cd;
   case 'rewind':return sum+25*duration/cd;
   default:return sum;
  }
 },0);
 return pressure*availability;
}
function defenseSummary(profile){
 const skills=profile?.allAbilities&&g.SkillForge?.allSkillset?g.SkillForge.allSkillset():profile?.skills||[];
 const perSkill=skills.map(defenseSkillPressure),pressure=perSkill.reduce((a,b)=>a+b,0)*(1+accelerationUptime(skills));
 // A gentle soft curve, with a floor instead of a hard cap. Even very long
 // shields can overlap; that is a legitimate authored defense strategy.
 const multiplier=cap(pressure>DEFENSE_BUDGET?
   Math.pow(DEFENSE_BUDGET/pressure,.48):1,.38,1);
 return {pressure:Number(pressure.toFixed(1)),budget:DEFENSE_BUDGET,
  multiplier:Number(multiplier.toFixed(4)),percent:Math.round(multiplier*100),
  excess:pressure>DEFENSE_BUDGET,perSkill:perSkill.map(v=>Number(v.toFixed(1)))};
}
// A shared resource controls the fraction of time protective shields can be
// kept up. More shield slots do not create more invulnerability resources.
// The refill is measured in simulated frames: 100x speed cannot bypass it.
function shieldCapacity(p){
 const cds=(p?.forge?.skills||[]).filter(s=>(s.actions||[]).some(a=>a.type==='shield')).map(s=>Math.max(.2,n(s.cooldown,3)));
 return cap(Math.round(Math.min(8,...(cds.length?cds:[1]))*60*1.1),48,480);
}
function tickShield(p){
 if(!p?.forge||p.towerEnemy)return;
 const capacity=shieldCapacity(p);
 p._forgeShieldEnergy=Math.min(capacity,(Number.isFinite(p._forgeShieldEnergy)?p._forgeShieldEnergy:capacity)+.7);
}
function shieldWindow(p,desired){
 const frames=Math.max(0,Math.round(n(desired)));
 if(!p?.forge||p.towerEnemy)return Math.max(p?.invincible||0,frames);
 const capacity=shieldCapacity(p);
 const available=Number.isFinite(p._forgeShieldEnergy)?p._forgeShieldEnergy:capacity;
 const current=Math.max(0,p.invincible||0);
 const grant=Math.min(frames,current+Math.floor(available));
 p._forgeShieldEnergy=Math.max(0,available-Math.max(0,grant-current));
 return Math.max(current,grant);
}
// Healing has a burst reserve plus a refilling sustained budget. The separate
// loadout multiplier still applies first. Normal heals retain their full impact;
// indefinite 0.2s healing or overlapping flowers draw from the same reserve.
function healingCapacity(p){return Math.max(140,Math.max(1,n(p?.maxHp,250))*.4);}
function tickHealing(p){
 if(!p?.forge||p.towerEnemy)return;
 const cap=healingCapacity(p);
 p._forgeHealingEnergy=Math.min(cap,(Number.isFinite(p._forgeHealingEnergy)?p._forgeHealingEnergy:cap)+Math.max(1,n(p.maxHp,250))*.24/60);
}
function healingWindow(p,desired){
 const amount=Math.max(0,n(desired));
 if(!p?.forge||p.towerEnemy)return amount;
 const cap=healingCapacity(p);
 const available=Number.isFinite(p._forgeHealingEnergy)?p._forgeHealingEnergy:cap;
 const granted=Math.min(amount,Math.max(0,available));
 p._forgeHealingEnergy=Math.max(0,available-granted);
 return granted;
}
function factorOf(p){return !p?.forge||p.towerEnemy?1:summary(p.forge).multiplier;}
function defenseFactorOf(p){return !p?.forge||p.towerEnemy?1:defenseSummary(p.forge).multiplier;}
g.ArenaBalance=Object.freeze({summary,skillPressure,actionPressure,factorOf,
 defenseSummary,defenseSkillPressure,defenseFactorOf,tickShield,shieldWindow,shieldCapacity,
 tickHealing,healingWindow,healingCapacity,
 POWER_BUDGET:BUDGET,DEFENSE_BUDGET});
})(typeof window!=='undefined'?window:globalThis);