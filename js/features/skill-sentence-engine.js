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
  return {when,action:names.join(' → '),interval:r.interval,
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
 return {checks,warnings:[...new Set(warnings)],
  // An offensive delivery is only POTENTIAL damage: collision is simulated.
  hasPotentialDamage:checks.some(c=>c.expectedDamage)};
}
function parse(input){
 const raw=String(input??'').trim();
 const engine=g.SignaturePromptCompiler;
 const grammar=g.KoreanSkillGrammar?.analyze?.(raw,g.SkillForge?.TYPE||g.ActionRegistry?.TYPE||{});
 const result=engine?.parse?.(raw)||{ok:false,error:'문장 해석기를 불러오지 못했습니다.'};
 const unavailable=capabilities.filter(c=>c.re.test(raw)).map(c=>c.label);
 const limitations=unavailable.map(x=>x+'은(는) 아직 완전하게 구현되지 않았습니다.');
 if(result.ok){
  for(const n of result.notes||[])if(/제한|지원하지|맞췄|상한/.test(n))
   limitations.push(n);
  const proof=audit(result.recipe);
  for(const clause of grammar?.clauses||[]){
   if(clause.chosen?.source==='analogy')limitations.push(
    '비유 유추: "'+clause.text+'"는(은) '+
    (g.SkillForge?.TYPE?.[clause.chosen.type]||clause.chosen.type)+
    ' 동작으로 표현했습니다. 새로운 전투 물리까지 구현한 것은 아닙니다.');
  }
  limitations.push(...proof.warnings);
  return {...result,summary:describe(result),grammar,verification:proof,
   limitations:[...new Set(limitations)],sourceText:raw,mode:'offline'};
 }
 return {...result,summary:[],grammar,verification:audit(null),
  limitations:[...new Set(limitations)],sourceText:raw,mode:'offline'};
}
g.SkillSentenceEngine=Object.freeze({parse,describe,audit,labels});
})(typeof window!=='undefined'?window:globalThis);
