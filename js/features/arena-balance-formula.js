/* Immutable profile pressure formulas. No DOM, mutable match state, or storage.
 * The public API is composed by arena-balance.js for compatibility.
 */
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
function skillPressure(s,signatureMomentum=false){
 const actions=(s?.actions||[]).slice(0,12),charge=actions.find(a=>a.type==='charge');
 const base=s?.ruleSet&&g.SignatureRuleSkill?.pressure?
   g.SignatureRuleSkill.pressure(s.ruleSet,actionPressure):
   Array.isArray(s?.program)&&g.SignatureScratch?.worstPressure?
   g.SignatureScratch.worstPressure(s.program,actionPressure):
   actions.reduce((sum,a)=>sum+actionPressure(a),0);
 const raw=base*(charge?1+Math.min(.48,cap(n(charge.duration,1.2),.2,8)*.12):1);
 const cd=Math.max(.2,signatureMomentum?5:cap(n(s?.cooldown,3),.2,30),
    charge?Math.min(3,cap(n(charge.duration,1.2),.2,8))+.18:0);
 const availability=s?.trigger==='lowhp'?.7+.3*cap((n(s.threshold,40)-40)/55,0,1):s?.trigger==='damaged'?.65:s?.trigger==='contact'?.7:1;
 return raw/cd*availability;
}
function accelerationUptime(skills,signatureMomentum=false){
 return cap(skills.reduce((uptime,s)=>{
  const bursts=(s.actions||[]).filter(a=>a.type==='timeburst'||a.type==='haste');
  if(!bursts.length)return uptime;
  // Accelerated energy is also an offensive advantage for custom skills.
  // A 1.25x haste is weighted less than a 1.75x timeburst and the two never
  // multiply together in the live momentum engine.
  const weighted=Math.max(...bursts.map(a=>
    (a.type==='timeburst'?1:1/3)*Math.min(1,n(a.duration,1.5)/
      (signatureMomentum?5:Math.max(.2,n(s.cooldown,3))))));
  return uptime+weighted;
 },0),0,1);
}
function summary(profile,momentumDriven=false){
 const skills=profile?.allAbilities&&g.SkillForge?.allSkillset?g.SkillForge.allSkillset():profile?.skills||[];
 const energy=profile?.signatureVersion===1||momentumDriven;
 const perSkill=skills.map(s=>skillPressure(s,energy));
 const charges=skills.flatMap(s=>s.actions||[]).filter(a=>a.type==='charge');
 // A separately authored charge skill also benefits other offensive slots,
 // so factor that benefit into the shared offensive budget.
 const bonus=charges.length?1+Math.min(.4,
   Math.max(...charges.map(a=>cap(n(a.duration,1.2),.2,8)))*.11):1;
 // Time acceleration now multiplies momentum gain for signature fighters,
 // not independent cooldown progression. Charge-up is bounded and the
 // estimated duration is measured against a 100-point energy cycle.
 const signature=profile?.signatureVersion===1;
 const timeAcceleration=accelerationUptime(skills,energy);
 // Legacy saved loadouts now cast ONE rotating skill per filled 100 energy,
 // not 4 simultaneous .2s cooldown attacks. Budget their average active
 // skill rather than summing all four imaginary cooldown frequencies.
 const rotation=momentumDriven&&!signature?Math.max(1,skills.length):1;
 const pressure=perSkill.reduce((sum,x)=>sum+x,0)/rotation*bonus*
  (1+timeAcceleration*(energy?0.75:1));
 const multiplier=cap(pressure>BUDGET?Math.pow(BUDGET/pressure,.82):1,.18,1);
 return {pressure:Number(pressure.toFixed(1)),budget:BUDGET,
  percent:Math.round(multiplier*100),multiplier:Number(multiplier.toFixed(4)),
  excess:pressure>BUDGET,perSkill:perSkill.map(x=>Number(x.toFixed(1)))};
}
// A SEPARATE defensive budget: only extreme repeated sustain is softened.
// Raw authored values, cooldowns, targets, and the ability to build near-
// permanent shields remain available. No blanket healing or immunity ban.
const DEFENSE_BUDGET=90;
function defenseSkillPressure(s,signatureMomentum=false){
 const cd=Math.max(.2,signatureMomentum?5:cap(n(s?.cooldown,3),.2,30));
 const availability=s?.trigger==='lowhp'?.7+.3*cap((n(s.threshold,40)-40)/55,0,1):s?.trigger==='damaged'?.65:s?.trigger==='contact'?.7:1;
 const perAction=a=>{
  const duration=cap(n(a.duration,1.5),.2,8),power=cap(n(a.damage),0,120);
  switch(a.type){
   case 'heal':return power/cd;
   case 'shield':return 105*duration/cd;
   case 'regen':return (power*.50)*Math.min(1,duration/cd);
   case 'lifebloom':return power*.47*duration/cd;
   case 'fortify':return 40*duration/cd;
   case 'drain':return power*.25/cd;
   case 'rewind':return 25*duration/cd;
   default:return 0;
  }
 };
 const pressure=s?.ruleSet&&g.SignatureRuleSkill?.pressure?
   g.SignatureRuleSkill.pressure(s.ruleSet,perAction):
   Array.isArray(s?.program)&&g.SignatureScratch?.worstPressure?
   g.SignatureScratch.worstPressure(s.program,perAction):
   (s?.actions||[]).slice(0,12).reduce((sum,a)=>sum+perAction(a),0);
 return pressure*availability;
}
function defenseSummary(profile,momentumDriven=false){
 const skills=profile?.allAbilities&&g.SkillForge?.allSkillset?g.SkillForge.allSkillset():profile?.skills||[];
 const energy=profile?.signatureVersion===1||momentumDriven;
 const rotation=momentumDriven&&profile?.signatureVersion!==1?Math.max(1,skills.length):1;
 const perSkill=skills.map(s=>defenseSkillPressure(s,energy)),
  pressure=perSkill.reduce((a,b)=>a+b,0)/rotation*
   (1+accelerationUptime(skills,energy)*(energy?0.75:1));
 // A gentle soft curve, with a floor instead of a hard cap. Even very long
 // shields can overlap; that is a legitimate authored defense strategy.
 const multiplier=cap(pressure>DEFENSE_BUDGET?
   Math.pow(DEFENSE_BUDGET/pressure,.48):1,.38,1);
 return {pressure:Number(pressure.toFixed(1)),budget:DEFENSE_BUDGET,
  multiplier:Number(multiplier.toFixed(4)),percent:Math.round(multiplier*100),
  excess:pressure>DEFENSE_BUDGET,perSkill:perSkill.map(v=>Number(v.toFixed(1)))};
}

g.ArenaBalanceFormula=Object.freeze({summary,skillPressure,actionPressure,
 defenseSummary,defenseSkillPressure,POWER_BUDGET:BUDGET,DEFENSE_BUDGET});
})(typeof window!=='undefined'?window:globalThis);
