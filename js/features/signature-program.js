/* One programmable signature skill per new custom fighter. Legacy 4-skill
 * saves remain playable and unmodified until the owner explicitly migrates.
 * Condition blocks use real simulation state, not rendered effect guesses. */
(function(g){
'use strict';
const VERSION=1,MAX_ACTIONS=12;
const CONDITIONS=Object.freeze({
 always:'항상 실행',
 danger:'보스 공격이 예고되었다면',
 dodge:'보스 공격을 실제로 피했다면',
 hpLow:'내 체력이 35% 이하라면',
 near:'상대가 140 거리 이내라면',
 far:'상대가 175 거리 밖이라면',
 hit:'이번 스킬이 적을 명중했다면',
 guard:'보호막으로 공격을 막았다면',
 move:'이동 동작이 완료되었다면',
 status:'적에게 상태이상을 적용했다면',
 charge3:'충전 변수가 3 이상이라면',
 basicHit:'기본 공격이 명중했다면',
 basicStatus:'기본 공격으로 상태이상을 걸었다면',
 contact:'상대와 실제로 부딪혔다면',
 wall:'벽에 튕겼다면'
});
function validCondition(value){return Object.prototype.hasOwnProperty.call(CONDITIONS,value)?value:'always';}
function danger(p,target){
 const clock=g.ArenaTower?.encounter?.tick;
 if(Number.isFinite(clock)){
  const zones=g.ArenaTower?.encounter?.zones||[];
  if(zones.some(z=>z?.kind==='boss'&&z.fire>clock&&z.fire-clock<=100))return true;
 }
 return (g.ArenaTelegraph?.preview?.(target)||[]).some(z=>
  Number.isFinite(z.remaining)&&z.remaining>0&&z.remaining<=Math.max(45,z.lead||0));
}
function condition(p,target,id){
 switch(validCondition(id)){
  case 'danger':return danger(p,target);
  case 'dodge':return Number(p?._forgeDodgeWindow)>Number(p?._forgeActionClock||0);
  case 'hpLow':return !!p&&p.maxHp>0&&p.hp/p.maxHp<=.35;
  case 'near':return !!target&&Math.hypot((p?.x||0)-(target.x||0),(p?.y||0)-(target.y||0))<=140;
  case 'far':return !!target&&Math.hypot((p?.x||0)-(target.x||0),(p?.y||0)-(target.y||0))>=175;
  default:return true;
 }
}
function eligible(p,target,skill,loss=0){
 if(!skill)return false;
 const trigger=skill.trigger||'auto';
 if(trigger==='danger')return danger(p,target);
 if(trigger==='dodge')return condition(p,target,'dodge')&&Number(p._forgeDodgeSerial||0)!==Number(p._forgeDodgeConsumed||0);
 if(trigger==='contactEnergy')return (p?._scratchEvents?.contact?.count||0)>(p?._scratchContactConsumed||0)&&
  (p?._forgeActionClock||0)-(p?._scratchEvents?.contact?.frame||0)<=180;
 if(trigger==='wallEnergy')return (p?._scratchEvents?.wall?.count||0)>(p?._scratchWallConsumed||0)&&
  (p?._forgeActionClock||0)-(p?._scratchEvents?.wall?.frame||0)<=180;
 if(trigger==='basicHit')return (p?._scratchEvents?.basicHit?.count||0)>(p?._scratchBasicHitConsumed||0);
 if(trigger==='basicStatus')return (p?._scratchEvents?.basicStatus?.count||0)>(p?._scratchBasicStatusConsumed||0);
 if(trigger==='lowhp')return p.hp/Math.max(1,p.maxHp)*100<=(skill.threshold||40);
 if(trigger==='damaged')return loss>0;
 return trigger==='auto'&&!!target; // Contact handling stays in SkillForge.contact.
}
function migrate(profile){
 if(profile.signatureVersion===VERSION&&profile.skills?.length===1)return profile;
 const original=(profile.skills||[]).map(s=>({...s,actions:(s.actions||[]).map(a=>({...a}))}));
 const actions=original.flatMap(s=>s.actions).slice(0,MAX_ACTIONS).map((a,i)=>({
  ...a,condition:'always',link:i===0?'and':a.link||'after'
 }));
 if(!actions.length)throw Error('고유 스킬로 전환할 행동이 없습니다.');
 return {...profile,allAbilities:false,signatureVersion:VERSION,
  legacySkills:original,legacyAllAbilities:!!profile.allAbilities,
  skills:[{name:'나만의 고유 스킬',trigger:'auto',cooldown:Math.max(3,Math.min(10,
   (original.reduce((total,s)=>total+(Number(s.cooldown)||3),0)/Math.max(1,original.length))*1.5)),
   threshold:40,actions}]};
}
function restore(profile){
 if(!Array.isArray(profile.legacySkills)||!profile.legacySkills.length)return profile;
 const next={...profile,signatureVersion:0,allAbilities:!!profile.legacyAllAbilities,
  skills:profile.legacySkills};
 delete next.legacySkills;delete next.legacyAllAbilities;
 return next;
}
g.SignatureProgram=Object.freeze({VERSION,MAX_ACTIONS,CONDITIONS,validCondition,
 condition,eligible,danger,migrate,restore});
})(typeof window!=='undefined'?window:globalThis);
