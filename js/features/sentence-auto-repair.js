/* Conservative deterministic repair pass for Korean sentence skills.
 * One bounded declarative refinement AFTER compilation and palette selection.
 * It patches only an existing, unambiguous physical shot. Never invent a
 * projectile, rule, hit, target, power, JavaScript or browser capability.
 */
(function(g){'use strict';
const MAX_FIXES=4;
const clamp=(v,lo,hi,otherwise)=>Number.isFinite(Number(v))?
 Math.max(lo,Math.min(hi,Math.round(Number(v)))):otherwise;
const deny={
 homing:/(?:추적|유도|따라가|쫓아가|뒤쫓).{0,12}(?:하지\s*않|지\s*않|안\s*하|않는|말아|못\s*하)/,
 split:/(?:분열|갈라지|깨지|부서지|쪼개).{0,12}(?:하지\s*않|지\s*않|안\s*하|않는|말아)/,
 burst:/(?:폭발|폭파|터지|터뜨).{0,12}(?:하지\s*않|지\s*않|안\s*하|않는|말아)/
};
const publicProof=proof=>({
 requested:[...(proof?.requested||[])],
 matched:[...(proof?.matched||[])],
 missing:[...(proof?.missing||[])]
});
function repair(input,original){
 const raw=String(input||'').normalize('NFC').trim().slice(0,300);
 const verifier=g.SemanticIntentComposer, rules=g.SignatureRuleSkill;
 const fallback={recipe:original,report:{status:'skipped',applied:[],
  before:{requested:[],matched:[],missing:[]},
  after:{requested:[],matched:[],missing:[]},reasons:[],attempts:0}};
 if(!verifier?.verify||!verifier?.analyze||!rules?.normalize||
  !g.ConceptFusion?.normalize||!g.ActionRegistry?.get||!raw||!original?.rules?.length)
  return fallback;
 const intent=verifier.analyze(raw),before=verifier.verify(intent,original);
 const prior=publicProof(before);
 const result=(recipe,status,applied=[],reasons=[],after=prior,attempts=0)=>({
  recipe,report:{status,applied,before:prior,after,reasons,attempts}
 });
 if(intent.unsupported?.length)
  return result(original,'skipped',[],['지원하지 않거나 모호한 문장의 자동 수정은 허용하지 않습니다.']);
 if(!before.missing.length)return result(original,'already-complete');
 // Retain the original action graph when there are staged casts or more
 // than one root shot. A demonstrative cannot choose a family by guess.
 const shots=[];
 for(let i=0;i<original.rules.length;i++){
  const rule=original.rules[i];
  if(rule?.action?.type==='shot'&&!rule.steps?.length&&rule.when==='pulse')
   shots.push(i);
 }
 if(shots.length!==1)
  return result(original,'unresolved',[],[
   shots.length?'분열·투사체 대상이 여러 개이므로 수정하지 않았습니다.':
    '수정 가능한 단일 투사체가 없어 새 공격을 만들지 않았습니다.']);
 const index=shots[0],base=original.rules[index].action;
 if(!g.ActionRegistry.get(base.type))
  return result(original,'unresolved',[],['등록되지 않은 공격 동작은 수정할 수 없습니다.']);
 const missing=new Set(before.missing),applied=[],reasons=[];
 let f={...(base.fusion||{}),form:'projectile'};
 if(!f.element)f.element='none';
 if(!f.impact)f.impact='none';
 const values=g.KoreanSkillParameters?.analyze?.(raw)?.values||{};
 function fix(key,predicate,apply,label){
  if(!missing.has(key)||applied.length>=MAX_FIXES)return;
  if(!predicate){reasons.push(label+'은(는) 충돌·문맥·부정 표현으로 안전하게 수정할 수 없습니다.');return;}
  apply();applied.push(key);
 }
 const negativeSplit=deny.split.test(raw),negativeHoming=deny.homing.test(raw),
  negativeBurst=deny.burst.test(raw);
 fix('split',!negativeSplit&&!!intent.split,()=>{
  f.split=true;f.fragments=clamp(values.fragmentCount,2,4,
   clamp(base.fusion?.fragments,2,4,3));
 },'파편 분열');
 fix('hitSplit',!negativeSplit&&!!intent.hitSplit&&
  (f.split||intent.split||intent.hitSplit)&&!f.splitTrigger,()=>{
  f.split=true;f.splitTrigger='hit';
  f.fragments=clamp(values.fragmentCount,2,4,clamp(f.fragments,2,4,3));
 },'명중 순간 분열');
 fix('homing',!negativeHoming&&!!intent.homing&&
  (!intent.childOnly||f.split),()=>{
  if(intent.childOnly)f.childHoming=true;
  else f.homing=true;
 },'추적 이동');
 fix('terminalBurst',!negativeBurst&&!!intent.terminalBurst&&!!f.split,()=>{
  f.finalBurst=true;
 },'파편 소멸 후 폭발');
 fix('hitExplosion',!negativeBurst&&!!intent.hitExplosion&&
  f.impact==='none',()=>{f.impact='burst';},'명중 폭발');
 if(!applied.length)
  return result(original,'unresolved',[],reasons.length?reasons:[
   '기존 등록된 스킬의 물리 속성만으로 누락 요소를 복구할 수 없습니다.']);
 const fusion=g.ConceptFusion.normalize(f);
 if(!fusion)return result(original,'unresolved',[],['물리 조합 데이터 검증 실패']);
 const rulesData=original.rules.map((rule,i)=>i===index?
  {...rule,action:{...rule.action,fusion}}:rule);
 const candidate=rules.normalize({...original,rules:rulesData});
 const after=verifier.verify(intent,candidate),proof=publicProof(after);
 // Strict improvement: all previously matched semantics must survive.
 // No silent changes to action type, damage, visual/palette, triggers, or
 // independently authored rule steps.
 const gained=before.missing.filter(key=>!proof.missing.includes(key));
 const regressed=before.matched.filter(key=>!proof.matched.includes(key));
 const shapeOk=candidate.rules.length===original.rules.length&&
  candidate.rules[index]?.action.type===base.type&&
  candidate.rules[index]?.when===original.rules[index].when&&
  candidate.rules[index]?.action.damage===base.damage&&
  JSON.stringify(candidate.rules[index]?.action.visual)===JSON.stringify(base.visual);
 if(!gained.length||regressed.length||!shapeOk)
  return result(original,'unresolved',[],['검증된 개선이 없거나 다른 행동의 의미가 달라져 원본을 보존했습니다.'],prior,1);
 const accepted=applied.filter(key=>gained.includes(key));
 return result(candidate,accepted.length?'repaired':'unresolved',accepted,
  proof.missing.length?[...reasons,'나머지 요구 '+proof.missing.join(', ')+'은(는) 구현되지 않았습니다.']:reasons,
  proof,1);
}
g.SentenceAutoRepair=Object.freeze({repair,MAX_FIXES});
})(typeof window!=='undefined'?window:globalThis);
