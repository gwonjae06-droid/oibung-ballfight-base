/* Loadout-wide soft budget: preserve authored numbers while penalizing high-frequency
   multi-skill damage combinations. Shared in tower, free battle and PvP. */
(function(g){'use strict';
const TYPES=new Set('wave shot beam bolt pull orbit zone homing pierce boomerang chain nova meteor mine drain blackhole starfall dung flight burrow dive uppercut slash spinslash thrust aircombo arcshot splitshot wall summon turret trap burrowdash erupt'.split(' '));
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
 const raw=(s?.actions||[]).slice(0,3).reduce((sum,a)=>sum+actionPressure(a),0);
 const cd=Math.max(.35,cap(n(s?.cooldown,3),.2,30));
 const availability=s?.trigger==='lowhp'?.7:s?.trigger==='damaged'?.65:s?.trigger==='contact'?.7:1;
 return raw/cd*availability;
}
function summary(profile){
 const skills=profile?.allAbilities&&g.SkillForge?.allSkillset?g.SkillForge.allSkillset():profile?.skills||[];
 const perSkill=skills.map(skillPressure);
 const pressure=perSkill.reduce((sum,x)=>sum+x,0);
 const multiplier=cap(pressure>BUDGET?Math.pow(BUDGET/pressure,.82):1,.18,1);
 return {pressure:Number(pressure.toFixed(1)),budget:BUDGET,
  percent:Math.round(multiplier*100),multiplier:Number(multiplier.toFixed(4)),
  excess:pressure>BUDGET,perSkill:perSkill.map(x=>Number(x.toFixed(1)))};
}
function factorOf(p){return !p?.forge||p.towerEnemy?1:summary(p.forge).multiplier;}
g.ArenaBalance=Object.freeze({summary,skillPressure,actionPressure,factorOf,POWER_BUDGET:BUDGET});
})(typeof window!=='undefined'?window:globalThis);