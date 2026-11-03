/* Explainable Korean sentence-to-skill adapter.
 * This is offline deterministic composition, not a generative LLM. It never
 * pretends unavailable phenomena are implemented. The interpreter owns no
 * combat physics; the validated ruleSet owns every actual action.
 */
(function(g){'use strict';
const labels=Object.freeze({pulse:'일정 간격',wall:'벽에 튕기면',
 contact:'상대와 충돌하면',hit:'공격이 적중하면',land:'착지하면',
 split:'탄환이 분열하면',guard:'방어에 성공하면',dodge:'회피하면',
 status:'상태이상을 걸면',move:'이동하면',hpLow:'체력이 낮으면',
 near:'상대가 가까우면',far:'상대가 멀면'});
const capabilities=[
 {label:'실제 물리 관절·신체 일부의 독립 충돌',re:/관절|팔이?\s*(?:나오|뻗)|촉수(?:가|로)\s*(?:감싸|묶|붙잡)|턱(?:으로)?\s*(?:물고|붙잡)|손(?:으로)?\s*(?:잡고|붙잡)/},
 {label:'상대 스킬을 학습하거나 완전히 복제',re:/스킬.*(?:훔쳐|배워|복사|복제)|(?:학습|진화).*상대|상대.*능력.*복사/},
 {label:'적을 직접 조종하거나 화면 밖 요소를 조작',re:/상대.*(?:조종|움직이지\s*못하게)|웹페이지|브라우저|화면\s*밖|키보드\s*조작/},
 {label:'무한·영구 효과',re:/영원히|영구적|절대\s*무적|무적\s*무한|무한\s*증식|(?:무한히|끝없이)\s*(?:생성|증식)/}
];
function describe(parsed){
 const recipe=parsed.recipe;
 return (recipe?.rules||[]).map(r=>{
  const names=[];
  if(r.steps?.length){
   const walk=(steps)=>{
    for(const s of steps){
     if(s.kind==='cast')names.push(g.SkillForge?.TYPE?.[s.action?.type]||s.action?.type||'행동');
     if(s.kind==='morph')names.push('형태 변화');
     if(s.kind==='wait')names.push('대기 '+s.seconds+'초');
     if(s.kind==='tune')names.push('능력 변형');
     if(s.kind==='if')names.push('조건 분기');
     if(s.kind==='repeat')names.push('반복 '+s.times+'회');
     if(s.body)walk(s.body);
     if(s.then)walk(s.then);
     if(s.else)walk(s.else);
    }
   };walk(r.steps);
  }else names.push(g.SkillForge?.TYPE?.[r.action?.type]||r.action?.type||'행동');
  const when=labels[r.when]||r.when;
  const styles=[];
  const gather=steps=>{for(const step of steps||[]){
   if(step.action?.visual)styles.push(step.action.visual);
   gather(step.body);gather(step.then);gather(step.else);
  }};
  gather(r.steps);
  if(!styles.length&&r.action?.visual)styles.push(r.action.visual);
  const all=new Set();
  for(const v of styles)for(const layer of v.layers||[])all.add(layer.kind);
  const composite=[...all].map(id=>g.SkillFXComposer?.KINDS?.[id]||id);
  const traits=(r.steps||[]).filter(s=>s.kind==='cast').map(s=>s.action?.fusion)
   .concat([r.action?.fusion]).filter(Boolean);
  const trait=traits[0],fusion=trait?[
   trait.element!=='none'?(g.ConceptFusion?.ELEMENTS?.[trait.element]?.label||trait.element):'',
   trait.homing?'추적':'',trait.split?'분열 '+trait.fragments+'갈래':'',
   trait.impact!=='none'?g.ConceptFusion?.IMPACTS?.[trait.impact]||trait.impact:''
  ].filter(Boolean).join(' + '):'';
  const law=r.action?.law||r.steps?.find(s=>s.kind==='cast'&&s.action?.law)?.action.law;
  const lawDescription=law?.terms?.map(t=>g.PhysicsLawEngine?.OPS?.[t.op]?.label||t.op).join(' + ');
  return {when,action:lawDescription||names.join(' → '),interval:r.interval,fusion,
   law:lawDescription||'',
   visual:composite.length?composite.join(' + '):
    styles[0]?.shape&&styles[0].shape!=='aura'?
      g.MetaphorVisuals?.SHAPES?.[styles[0].shape]||styles[0].shape:null,
   layers:composite};
 });
}
// Compile-time combat readiness check: presentation and damage authorization
// are separate. Does not promise that a distant or defended enemy will be hit.
function audit(recipe){
 const checks=[],warnings=[];
 const inspect=(action,when)=>{
  if(!action?.type)return;
  const id=action.type,registration=g.ActionRegistry?.get?.(id);
  const label=g.SkillForge?.TYPE?.[id]||id;
  const vfx=!!(g.SkillVisuals?.catalog?.[id]||g.ActionRegistry?.visualCatalog?.[id]);
  const damage=Number(action.damage)||0,offense=registration?.offense;
  checks.push({type:id,label,trigger:when,vfx:!!vfx,
   expectedDamage:offense===true&&damage>0,delivery:registration?.physics||'unknown'});
  if(registration&&!vfx)warnings.push(label+'의 이펙트 등록을 확인할 수 없습니다.');
  if(offense===true&&damage<=0)
   warnings.push(label+'은(는) 공격 동작인데 피해량이 0으로 설정됐습니다.');
 };
 const walk=(steps,when)=>{
  for(const item of steps||[]){
   if(item.kind==='cast')inspect(item.action,when);
   walk(item.body,when);walk(item.then,when);walk(item.else,when);
  }
 };
 for(const rule of recipe?.rules||[]){
  if(rule.steps?.length)walk(rule.steps,rule.when);
  else inspect(rule.action,rule.when);
 }
 const sandbox=g.SemanticPhysics?.verifyRecipe?.(recipe)||null;
 for(const probe of sandbox?.probes||[]){
  const check=checks.find(c=>c.type===probe.type);
  if(check)check.sandbox={tested:true,passed:probe.passed,
   nearDamage:probe.near.damage,farDamage:probe.far.damage,
   shieldDamage:probe.shield.damage,displacement:probe.near.displacement};
  if(!probe.passed)warnings.push(probe.type+'의 격리 물리 시험이 통과하지 못했습니다.');
 }
 return {checks,warnings:[...new Set(warnings)],sandbox,
  // A validated collision path is not a promise of hitting a moving enemy.
  hasPotentialDamage:checks.some(c=>c.expectedDamage)};
}
function parse(input){
 const raw=String(input??'').trim();
 const engine=g.SignaturePromptCompiler;
 const grammar=g.KoreanSkillGrammar?.analyze?.(raw,g.SkillForge?.TYPE||g.ActionRegistry?.TYPE||{});
 // The relation composer gets first refusal: a named weapon may not
 // silently replace an explicit verb (homing, orbiting, binding, etc).
 const intentional=g.SemanticIntentComposer?.compose?.(raw);
 const materialized=intentional?null:g.ImaginationConcepts?.interpret?.(raw);
 const generatedLaw=intentional||materialized?null:g.PhysicsLawEngine?.interpret?.(raw);
 const compiled=intentional||materialized||generatedLaw||engine?.parse?.(raw)||{ok:false,error:'문장 해석기를 불러오지 못했습니다.'};
 const colored=compiled.ok?g.SkillColorPolicy?.decorate?.(compiled.recipe,raw):null;
 const result=colored?{...compiled,recipe:colored.recipe,
  colorPriority:colored.priority,explicitColor:colored.explicit}:compiled;
 const unavailable=capabilities.filter(c=>c.re.test(raw)).map(c=>c.label);
 const limitations=unavailable.map(x=>x+'은(는) 아직 완전하게 구현되지 않았습니다.');
 if(result.ok){
  for(const n of result.notes||[])if(/제한|지원하지|맞췄|상한/.test(n))
   limitations.push(n);
  const proof=audit(result.recipe);
  const semantics=g.SemanticIntentComposer?.verify?.(raw,result.recipe)||result.semanticVerification;
  for(const request of semantics?.missing||[])limitations.push(
   '요청 행동 미구현: '+(g.SemanticIntentComposer?.LABELS?.[request]||request)+'.');
  limitations.push(...(semantics?.approximations||[]));
  for(const clause of grammar?.clauses||[]){
   if(clause.chosen?.source==='analogy')limitations.push(
    '비유 유추: "'+clause.text+'"는(은) '+
    (g.SkillForge?.TYPE?.[clause.chosen.type]||clause.chosen.type)+
    ' 동작으로 표현했습니다. 새로운 전투 물리까지 구현한 것은 아닙니다.');
  }
  limitations.push(...proof.warnings);
  return {...result,summary:describe(result),grammar,verification:proof,
   semanticVerification:semantics,
   semanticGraph:g.SemanticRelationshipGraph?.build?.(raw,result.recipe)||null,
   semanticIR:g.SkillIR?.fromSentence?.(raw,result.recipe)||null,
   limitations:[...new Set(limitations)],sourceText:raw,mode:'offline'};
 }
 return {...result,summary:[],grammar,verification:audit(null),
  limitations:[...new Set(limitations)],sourceText:raw,mode:'offline'};
}
/* A paragraph is the authoring unit. "그리고/이어서/그다음" connects
 * actions into one skill; independent sentences/lines are separate skills.
 * This is deterministic Korean text grouping, not an unrestricted NLP model.
 */
function splitIdeas(raw){
 const parts=String(raw||'').normalize('NFC').split(/\n+|;|[.!?](?=\s|$)/)
   .map(x=>x.trim()).filter(Boolean);
 const groups=[];
 for(const part of parts){
  // "드래곤 브레스... . 범위 180, 피해 35" is one skill with a
  // trailing parameter sentence, not a second uncastable skill.
  const numericDetail=/^(?:범위|반경|피해량|피해|데미지|대미지|위력|공격력|지속시간|공격\s*속도|투사체\s*속도|속도|세기|강도|갯수|개수)\s*[:=]?\s*\d/.test(part);
  if(numericDetail&&groups.length){groups[groups.length-1]+=', '+part;continue;}
  const linked=/^(?:그리고|그러고\s*나서|이어서|그\s*다음|그\s*뒤|한\s*뒤|동시에|그와\s*동시에)/.test(part);
  const previous=groups[groups.length-1];
  if(previous&&(linked||/(?:하면|때마다|자마자|한\s*뒤|그\s*후)$/.test(previous)))
   groups[groups.length-1]+=' 그리고 '+part;
  else groups.push(part);
 }
 return groups;
}
function parseBundle(input){
 const raw=String(input??'').trim();
 if(!raw)return {ok:false,error:'만들고 싶은 스킬을 문장으로 입력해 주세요.',skills:[]};
 if(raw.length>2000)return {ok:false,error:'전체 스킬 설명은 2,000자 이하로 작성해 주세요.',skills:[]};
 const ideas=splitIdeas(raw);
 if(ideas.some(x=>x.length>300))return {ok:false,error:'하나의 기술 설명은 300자 이하로 나누어 주세요.',skills:[]};
 const skills=ideas.map(parse);
 const failed=skills.findIndex(s=>!s.ok);
 if(failed>=0)return {ok:false,error:(failed+1)+'번째 문장을 구현하지 못했습니다: '+skills[failed].error,
  skills,sourceText:raw};
 const primary=skills[0];
 return {...primary,sourceText:raw,skills,
  bundleSummary:skills.map((x,i)=>({index:i,name:x.name,
   sourceText:x.sourceText,summary:x.summary,notes:x.notes,
   colorPriority:x.colorPriority,explicitColor:x.explicitColor,
   limitations:x.limitations})),
  notes:[...new Set(skills.flatMap(x=>x.notes||[]))],
  limitations:[...new Set(skills.flatMap(x=>x.limitations||[]))]};
}
g.SkillSentenceEngine=Object.freeze({parse,parseBundle,splitIdeas,describe,audit,labels});
})(typeof window!=='undefined'?window:globalThis);
