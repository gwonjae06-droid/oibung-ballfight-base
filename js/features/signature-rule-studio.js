/* Natural-language-first skill creation. Visual programming UI is retired,
 * but the validated legacy Scratch / ruleSet execution engines remain playable.
 * No LLM/key/network dependencies: compiled meaning is always shown before save.
 */
(function(g){'use strict';
const panel=g.document?.querySelector('#scratch-beginner'),forge=g.SkillForge;
const rules=g.SignatureRuleSkill,compiler=g.SignaturePromptCompiler;
if(!panel||!forge||!rules)return;
let promptDraft='',proposal=null,lastDraftKey='',selectedIndex=0;
 // The optional old block editor relocates children into a hidden panel.
 // Restore sentence composition to the visible direct-authoring workspace.
 const compose=g.document?.getElementById('studio-mode-compose');
 if(compose&&panel.closest?.('#studio-expert-panel'))compose.append(panel);
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const skill=()=>selectedIndex<0?{}:forge.getDraft()?.skills?.[selectedIndex]||{};
const sourceText=()=>String(skill().promptText||'');
const summaryOf=r=>g.SkillSentenceEngine?.describe?.({recipe:r})||
 (r?.rules||[]).map(v=>({when:rules.WHEN[v.when]||v.when,
 action:forge.TYPE?.[v.action?.type]||v.action?.type,interval:v.interval}));
function feedback(message){
 const element=panel.querySelector('#rule-feedback');
 if(element)element.textContent=message;
}
function syncPrompt(force=false){
 const current=sourceText();
 const key=JSON.stringify([selectedIndex,forge.getDraft()?.name,skill().name,current,skill().ruleSet]);
 if(force||key!==lastDraftKey){
  if(force||!proposal)promptDraft=current;
  lastDraftKey=key;
 }
}
function apply(result){
 if(!result?.ok)return false;
 const current=forge.getDraft();
 const list=Array.isArray(result.skills)&&result.skills.length?result.skills:[result];
 const name=(panel.querySelector('#rule-name')?.value||'').trim().slice(0,18);
 const skills=list.map((item,i)=>{
  if(!item?.ok)throw Error((i+1)+'번째 기술을 해석하지 못했습니다.');
  const ir=g.SkillIR?.fromRecipe?.(item.recipe);
  const recipe=ir?g.SkillIR.toRecipe(ir):rules.normalize(item.recipe);
  if(!recipe.rules.length)throw Error((i+1)+'번째 기술에 실행 동작이 없습니다.');
  return {name:list.length===1&&name?name:item.name||'문장 기술 '+(i+1),
   promptText:item.sourceText||'',program:undefined,ruleSet:recipe,
   ir:ir||undefined,actions:rules.preview(recipe),
   trigger:'auto',cooldown:5,threshold:40};
 });
 try{
  // The sentence interpreter owns skill creation. No manual block/slot
  // creation or hidden additional skills: a newly interpreted paragraph
  // replaces the generated draft as one coherent loadout.
  forge.setDraft({...current,signatureVersion:1,allAbilities:false,skills});
  selectedIndex=0;proposal=null;lastDraftKey='';
  syncPrompt(true);
  g.CharacterStudioWorkspace?.refresh?.();render();
  const budget=g.ArenaBalance?.summary?.(forge.getDraft());
  feedback('문장으로 '+skills.length+'개 기술을 만들었습니다. 기세 100에서 함께 시작합니다. '+
    (budget?'피해 보정 약 '+budget.percent+'%. ':'')+'미리보기를 확인하고 외형을 꾸며 저장하세요.');
  g.CharacterStudioWorkspace?.selectPreviewSkill?.('all');
  g.document.getElementById('studio-motion-fire')?.click?.();
  return true;
 }catch(error){feedback(error?.message||'스킬 적용 실패');return false;}
}
function collectionHTML(){
 const p=forge.getDraft(),skills=p?.skills||[],budget=g.ArenaBalance?.summary?.(p);
 const defense=g.ArenaBalance?.defenseSummary?.(p);
 return '<section class="sentence-collection"><div class="sentence-collection-header">'
   +'<strong>보유 스킬 '+skills.length+'개 · 개수 제한 없음</strong>'
   +'<span>문장에서 자동 구성</span></div>'
   +'<p class="sentence-local-note">기세 100마다 생성한 모든 기술이 함께 발동합니다. 스킬이 많아질수록 전체 예상 효율을 기준으로 공격·유지력이 보정됩니다.</p>'
   +(budget?'<p class="sentence-local-note">전체 스킬 화력 지수 '+E(budget.pressure)+' / '+E(budget.budget)+
     ' · 실제 공격 피해 보정 약 '+E(budget.percent)+'%'+
     (defense?' · 회복·보호 보정 약 '+E(defense.percent)+'%':'')+'</p>':'')
   +'<div class="sentence-collection-list" role="group" aria-label="보유 스킬 선택">'
   +skills.map((s,i)=>'<button type="button" data-rule-skill-index="'+i+
      '" aria-pressed="'+String(i===selectedIndex)+'">'+(i+1)+'. '+E(s.name)+
      (s.promptText?' · 문장형':' · 기존')+'</button>').join('')
   +'</div></section>';
}
function resultHTML(result){
 if(result?.error)return '<section class="sentence-error" role="alert"><strong>이 문장은 아직 구현하지 못했어요.</strong><p>'+
   E(result.error)+'</p><p>동작·발동 조건·외형을 구체적으로 적으면 해석하기 쉽습니다. 예: “벽에 튕길 때마다 붉은 충격파를 쏜다”.</p></section>';
 if(!result?.ok)return '';
 const rows=result.summary?.length?result.summary:summaryOf(result.recipe);
 const bundles=result.bundleSummary||[];
 const limitations=[...new Set(result.limitations||[])];
 const verification=result.verification;
 const parts=(result.grammar?.tokens||[]).filter(t=>
   ['verb','noun','adverb'].includes(t.pos)&&t.semantic).slice(0,14);
 const grammarPreview=parts.length?'<details class="sentence-more"><summary>한국어 문장 분석 보기</summary>'
  +'<p>행동 단어·대상 명사·부사와 조사·어미를 이용한 오프라인 분석입니다.</p>'
  +'<ul>'+parts.map(t=>'<li>'+E(t.surface)+' · '+E(t.pos==='noun'?'명사':t.pos==='verb'?'동사':'부사')
   +(t.particle?' · 조사 '+E(t.particle):'')
   +(t.ending?' · 어미 '+E(t.ending):'')
   +(t.prefix?' · 접두사 '+E(t.prefix):'')
   +(t.suffix?' · 접미사 '+E(t.suffix):'')+'</li>').join('')+'</ul></details>':'';
 const ir=g.SkillIR?.fromRecipe?.(result.recipe);
 const physicsView=ir?.events?.length?'<details class="sentence-more"><summary>물리 동작 설계도 (Skill IR)</summary><ul>'+ir.events.map(x=>
   '<li>'+E(x.action?.type)+' · '+E(x.physics.map(v=>v.op).join(' → '))+'</li>').join('')+'</ul></details>':'';
 const probes=verification?.sandbox?.probes||[];
 const sandboxView=probes.length?'<p class="sentence-local-note">격리 물리 시험: '
  +probes.map(p=>E(g.SkillForge?.TYPE?.[p.type]||p.type)+' · '+
    (p.passed?'통과':'점검 필요')+' · 가까운 대상 피해 '+p.near.damage+
    ' / 먼 대상 '+p.far.damage+' / 보호 대상 '+p.shield.damage).join(' / ')
  +'<br>실제 경기의 피해량·명중을 보장하지 않는 별도 거리·보호막 검사입니다.</p>':'';
 const auditView=verification?.checks?.length?
  '<p class="sentence-local-note">전투 실행 확인: '
   +verification.checks.map(c=>E(c.label)+' · '+(c.vfx?'이펙트 등록됨':'이펙트 점검 필요')
    +' · '+(c.expectedDamage?'피해 가능 동작':'이동·방어·기타 동작')).join(' / ')
   +'<br>실제 피해는 명중·거리·방어·무적 판정에 따라 달라집니다.</p>':'';
 return '<section class="sentence-interpretation" aria-label="문장 해석 결과">'
 +'<h4>이 문장을 이렇게 구현합니다</h4>'
 +(result.plan?'<div class="sentence-materialization-plan"><strong>'+
    (result.plan.strategy==='new-primitive'?'✦ 신규 물리 동작 생성':'♻ 기존 동작·효과의 조합')+'</strong><p>'+
    E(result.plan.explanation)+'</p><small>'+E(result.plan.conceptIds.join(' + '))+
    ' · '+E(result.plan.visualKinds.join(' + '))+'</small></div>':'')
 +(result.concepts?.fused?'<div class="sentence-fusion-explainer"><strong>🧩 개념 융합</strong><p>'+
   E(result.concepts.labels.join(' + '))+'</p><small>기존 동작의 속성·형태·물리 특성을 결합합니다. 미지원 기능은 기존 물리로 근사하며, 새로운 엔진 코드를 실시간으로 만드는 것은 아닙니다.</small></div>':'')
 +(bundles.length>1?'<p class="sentence-local-note">의미상 연결된 행동은 합치고, 독립된 문장은 '+bundles.length+'개 기술로 나누었습니다.</p>'+bundles.map((x,i)=>
  '<p><strong>'+(i+1)+'. '+E(x.name)+'</strong> · '+E(x.sourceText)+'</p>').join(''):'')
 +'<div class="sentence-understood">'+rows.map((r,i)=>
   '<div class="sentence-understood-row"><span>'+String(i+1).padStart(2,'0')+'</span>'
   +'<div><strong>'+E(r.when)+' → '+E(r.action)+'</strong>'
   +'<small>발동 최소 간격 '+E(r.interval)+'초'+(r.fusion?' · 개념 융합 '+E(r.fusion):'')+(r.visual?' · '+E(r.visual)+' 연출':'')+'</small></div></div>'
  ).join('')+'</div>'
 +(limitations.length?'<div class="sentence-limitations"><strong>현재 구현 범위 안내</strong><ul>'
  +limitations.map(n=>'<li>'+E(n)+'</li>').join('')+'</ul></div>':'')
 +grammarPreview+auditView+sandboxView+physicsView
 +((result.notes||[]).length?'<details class="sentence-more"><summary>해석과 안전 제한 자세히</summary><ul>'
 +(result.notes||[]).map(x=>'<li>'+E(x)+'</li>').join('')+'</ul></details>':'')
 +'<p class="sentence-local-note">오프라인 개념 해석과 합성 물리 수식을 사용합니다. 지원하지 않는 현상은 설명하며, 모든 상상 속 법칙을 보장하는 범용 AI는 아닙니다.</p>'
 +'<button type="button" data-rule-command="apply" class="sentence-apply">✓ 문장 속 기술을 생성하고 시연하기</button></section>';
}
const NUMERIC=Object.freeze({
 damage:['피해량',0,120,1],count:['투사체 수',1,8,1],
 speed:['이동·투사체 속도',2,14,.5],radius:['범위',30,300,5],
 duration:['지속시간 (초)',.2,8,.1],knockback:['넉백',0,9,.5],
 delay:['발동 지연 (초)',0,2,.1],ricochet:['벽 반사 횟수',0,3,1]});
function tune(skillIndex,ruleIndex,stageIndex,key,value){
 const current=forge.getDraft(),s=current.skills?.[skillIndex];
 if(!s?.ruleSet)return false;
 const ruleSet=JSON.parse(JSON.stringify(s.ruleSet));
 const rule=ruleSet.rules?.[ruleIndex];if(!rule)return false;
 if(key==='name'){
  const skills=current.skills.slice();
  skills[skillIndex]={...s,name:String(value||'').replace(/[<>]/g,'').slice(0,18)||s.name};
  forge.setDraft({...current,skills});return true;
 }
 if(key==='interval'){
  const n=Number(value);if(!Number.isFinite(n))return false;
  rule.interval=Math.max(.35,Math.min(4,n));
 }else{
  const info=NUMERIC[key],numeric=!!info;
  if(!info&&!['status','pattern','target'].includes(key))return false;
  const a=stageIndex>=0?rule.steps?.[stageIndex]?.action:rule.action;
  if(!a)return false;
  if(numeric){
   const n=Number(value);if(!Number.isFinite(n))return false;
   a[key]=Math.max(info[1],Math.min(info[2],n));
  }else a[key]=String(value);
  // The rule and the staged cast are separate data nodes: update the
  // leader when tuning its corresponding step to preserve preview parity.
  if(stageIndex>=0&&rule.action?.type===a.type)rule.action[key]=a[key];
  if(stageIndex<0)for(const step of rule.steps||[])
   if(step.kind==='cast'&&step.action?.type===a.type)step.action[key]=a[key];
 }
 const recipe=rules.normalize(ruleSet),skills=current.skills.slice();
 skills[skillIndex]={...s,ruleSet:recipe,actions:rules.preview(recipe),
   ir:g.SkillIR?.fromRecipe?.(recipe)||undefined};
 forge.setDraft({...current,skills});
 return true;
}
function tuneLaw(skillIndex,ruleIndex,stageIndex,termIndex,field,value){
 const current=forge.getDraft(),src=current.skills?.[skillIndex];
 if(!src?.ruleSet||!['strength','rest'].includes(field))return false;
 const num=Number(value);if(!Number.isFinite(num))return false;
 const config=JSON.parse(JSON.stringify(src.ruleSet));
 const r=config.rules?.[ruleIndex];if(!r)return false;
 const a=stageIndex>=0?r.steps?.[stageIndex]?.action:r.action;
 if(a?.type!=='phenomenon'||!a.law?.terms?.[termIndex])return false;
 a.law.terms[termIndex][field]=field==='strength'?
  Math.max(.05,Math.min(6,num)):Math.max(20,Math.min(240,num));
 if(stageIndex>=0&&r.action?.type===a.type)r.action.law=a.law;
 if(stageIndex<0)for(const step of r.steps||[])
  if(step.kind==='cast'&&step.action?.type===a.type)step.action.law=a.law;
 const recipe=rules.normalize(config),skills=current.skills.slice();
 skills[skillIndex]={...src,ruleSet:recipe,actions:rules.preview(recipe),
  ir:g.SkillIR?.fromRecipe?.(recipe)||undefined};
 forge.setDraft({...current,skills});return true;
}
function lawTuning(a,ri,si){
 const law=g.PhysicsLawEngine?.normalize?.(a?.law);
 if(!law)return '';
 return '<div class="sentence-law-tune"><p><strong>합성 물리 법칙</strong> · '+
   E(law.anchor==='target'?'상대 중심':'캐릭터 중심')+' · '+
   E(law.decay)+' 시간 변화</p>'+
   law.terms.map((t,i)=>{
    const label=g.PhysicsLawEngine?.OPS?.[t.op]?.label||t.op;
    return '<div class="sentence-law-term"><strong>'+E(label)+'</strong>'+
     '<label>힘의 세기<input type="number" min=".05" max="6" step=".05" '+
     'data-law-key="strength" data-law-index="'+i+'" data-tune-rule="'+ri+'" '+
     'data-tune-stage="'+si+'" value="'+E(t.strength)+'"></label>'+
     '<label>기준 거리<input type="number" min="20" max="240" step="5" '+
     'data-law-key="rest" data-law-index="'+i+'" data-tune-rule="'+ri+'" '+
     'data-tune-stage="'+si+'" value="'+E(t.rest)+'"></label></div>';
   }).join('')+'</div>';
}
function actionTuning(a,ruleIndex,stageIndex){
 if(!a)return '';
 const supported=new Set(g.ActionRegistry?.get?.(a.type)?.parameters||[
   'damage','count','speed','radius','duration','status','knockback','delay']);
 const fields=Object.entries(NUMERIC).filter(([key])=>
   supported.has(key)||key==='delay').map(([key,[name,min,max,step]])=>
   '<label>'+name+'<input type="number" data-tune-key="'+key+
   '" data-tune-rule="'+ruleIndex+'" data-tune-stage="'+stageIndex+
   '" min="'+min+'" max="'+max+'" step="'+step+'" value="'+E(a[key]??(key==='damage'?0:min))+'"></label>');
 if(supported.has('status'))fields.push('<label>상태이상<select data-tune-key="status" data-tune-rule="'+
    ruleIndex+'" data-tune-stage="'+stageIndex+'">'+Object.entries(forge.STATUS||{}).map(([id,label])=>
    '<option value="'+E(id)+'"'+(a.status===id?' selected':'')+'>'+E(label)+'</option>').join('')+'</select></label>');
 if(supported.has('pattern'))fields.push('<label>공격 배치<select data-tune-key="pattern" data-tune-rule="'+
    ruleIndex+'" data-tune-stage="'+stageIndex+'">'+Object.entries(g.AbilityAtlas?.PATTERNS||{direct:'직선',radial:'방사형',fan:'부채꼴'}).map(([id,label])=>
    '<option value="'+E(id)+'"'+(a.pattern===id?' selected':'')+'>'+E(label)+'</option>').join('')+'</select></label>');
 return '<div class="sentence-tune-grid">'+fields.join('')+'</div>'+lawTuning(a,ruleIndex,stageIndex);
}
function tuneHTML(s){
 if(!s?.ruleSet)return '';
 return '<details class="sentence-tune"><summary>⚙ 생성한 기술의 수치 자세히 수정하기</summary>'
   +'<p class="sentence-local-note">생성된 동작의 수치만 편집할 수 있습니다. 새로운 동작은 위 한국어 문장에서 다시 생성하세요.</p>'
   +'<label>스킬 이름<input type="text" maxlength="18" data-tune-key="name" value="'+E(s.name)+'"></label>'
   +s.ruleSet.rules.map((r,ri)=>'<section class="sentence-tune-action"><strong>'+
     (ri+1)+'. '+E(forge.TYPE?.[r.action.type]||r.action.type)+'</strong>'
     +'<label>공격 간격 (초)<input type="number" min=".35" max="4" step=".05" data-tune-key="interval" data-tune-rule="'+ri+'" value="'+E(r.interval)+'"></label>'
     +(r.steps?.length?r.steps.map((st,si)=>st.kind==='cast'?
       '<p>'+E(forge.TYPE?.[st.action?.type]||st.action?.type)+'</p>'+actionTuning(st.action,ri,si):'').join(''):
       actionTuning(r.action,ri,-1))
     +'</section>').join('')
   +'</details>';
}
function currentHTML(){
 const s=skill();
 if(!s.ruleSet)return '<p class="sentence-current-empty">'+(selectedIndex<0?'새 스킬을 구상 중입니다. 문장을 입력하면 독립 기술로 추가됩니다.':'선택한 스킬은 아직 문장으로 만든 기술이 아닙니다.')+'</p>';
 return '<div class="sentence-current">'
 +'<strong>현재 초안 · '+E(s.name||'나만의 고유 스킬')+'</strong>'
 +'<div>'+summaryOf(s.ruleSet).map(x=>'<p>'+E(x.when)+' · '+E(x.action)+'</p>').join('')+'</div>'
 +(s.promptText?'<small>원문: '+E(s.promptText)+'</small>':
   '<small>이 기술은 이전 편집기에서 만들어졌습니다. 새 문장으로 변경해도 저장된 원본은 유지됩니다.</small>')
 +tuneHTML(s)+'</div>';
}
function render(){
 syncPrompt();
 panel.classList.add('rule-studio','sentence-only-studio');
 const name=selectedIndex>=0?skill().name||'':'';
 panel.innerHTML='<header class="sentence-hero"><span>OIBUNG / IMAGINATION TO SKILL</span>'
 +'<h3>상상하는 스킬을 문장으로 적어 보세요</h3>'
 +'<p>① 한국어로 기술 설명 → ② 기술 시연 → ③ 캐릭터 외형 꾸미기 → ④ 생성·저장</p></header>'
 +collectionHTML()
 +'<div class="sentence-box"><label for="rule-prompt"><strong>어떤 기술을 만들고 싶나요?</strong>'
 +'<small>피해량, 투사체 개수·속도, 초당 공격 횟수, 범위, 지속시간을 자유롭게 쓰세요. 독립 기술은 새 문장이나 줄로 구분합니다.</small></label>'
 +'<textarea id="rule-prompt" maxlength="2000" rows="8" spellcheck="false" placeholder="예: 거대한 턱이 공의 한 부분에서 솟아나 상대를 후려치고, 그 다음 어두운 멘헤라 에너지를 모아 두꺼운 레이저를 발사한다.">'
 +E(promptDraft)+'</textarea>'
 +'<div class="sentence-examples"><span>예문을 눌러 문장에 넣기</span>'
 +'<button type="button" data-rule-example="jaw">🐉 거대한 턱</button>'
 +'<button type="button" data-rule-example="beam">🌑 멘헤라빔</button>'
 +'<button type="button" data-rule-example="chain">💎 연쇄 분열</button>'
 +'<button type="button" data-rule-example="wall">⚡ 벽 충돌 가속</button>'
 +'<button type="button" data-rule-example="physics">🌀 물리 법칙 만들기</button>'
 +'<button type="button" data-rule-example="fantasy">🐉 판타지</button>'
 +'<button type="button" data-rule-example="machine">⚙ 현대 기계</button>'
 +'<button type="button" data-rule-example="relay">🔋 신규 물리 개념</button></div>'
 +'<label class="sentence-name" for="rule-name">기술 이름 (선택 사항)'
 +'<input id="rule-name" maxlength="18" type="text" value="'+E(name)+'" placeholder="문장을 해석해 자동으로 이름 붙이기"></label>'
 +'<button type="button" data-rule-command="generate" class="sentence-generate">✨ 문장에서 스킬 구현하기</button>'
 +'<p class="sentence-local-note">무료 · 로그인 불필요 · 로컬 문장 해석. 지원하지 않는 행동은 명확하게 알려드립니다.</p></div>'
 +resultHTML(proposal)
 +'<section class="sentence-current-section"><h4>생성된 기술 자세히 조정</h4>'+currentHTML()
 +'<button type="button" data-rule-command="preview" class="sentence-preview">▶ 선택한 스킬 시연</button></section>'
 +'<button type="button" data-rule-command="appearance" class="sentence-apply">③ 기술 확인 완료 · 외형 꾸미기로 이동 →</button>'
 +'<div id="rule-feedback" role="status" aria-live="polite"></div>';
}
panel.addEventListener('change',event=>{
 const lawControl=event.target.closest?.('[data-law-key]');
 if(lawControl){
  const ri=Number(lawControl.dataset.tuneRule||0),si=Number(lawControl.dataset.tuneStage??-1);
  if(tuneLaw(selectedIndex,ri,si,Number(lawControl.dataset.lawIndex),
    lawControl.dataset.lawKey,lawControl.value)){
   g.CharacterStudioWorkspace?.refresh?.();render();
   feedback('생성된 물리 법칙의 힘이 변경되었습니다.');
  }
  return;
 }
 const control=event.target.closest?.('[data-tune-key]');
 if(!control)return;
 const key=control.dataset.tuneKey;
 const ri=Number(control.dataset.tuneRule||0),si=Number(control.dataset.tuneStage??-1);
 if(tune(selectedIndex,ri,si,key,control.value)){
  g.CharacterStudioWorkspace?.refresh?.();
  render();feedback('생성된 기술의 세부 수치가 업데이트되었습니다. 저장하면 확정됩니다.');
 }
});
panel.addEventListener('input',event=>{
 if(event.target.id==='rule-prompt'){
  promptDraft=event.target.value;
  proposal=null;
 }
});
panel.addEventListener('click',event=>{
 const example=event.target.closest?.('[data-rule-example]');
 if(example){
  const samples={
   jaw:'공의 한 부분이 거대한 턱처럼 변한 다음 상대를 후려칩니다.',
   beam:'오슬우의 멘헤라가 응축되어 어두운 두꺼운 멘헤라빔을 발사합니다.',
   chain:'분열탄을 5개로 분열시키고 분열할 때마다 새로운 탄환을 발사합니다.',
   wall:'벽에 튕길 때마다 몸의 속도가 빨라지고 상대와 부딪히면 충격파를 발사합니다.',
   physics:'반경 180의 역중력장에 회전력과 진동을 동시에 적용한다. 세기 3, 4초 동안 점점 약해진다.',
   fantasy:'드래곤이 거대한 화염 브레스를 내뿜고, 적에게 명중하면 폭발한다. 범위 180, 피해 35',
   machine:'레일건에서 전자기 광선을 발사한다. 위력 42, 범위 220',
   relay:'기계식 축전기가 상대의 운동량을 흡수해 저장했다가 충격파로 방출한다.'
  };
  promptDraft=samples[example.dataset.ruleExample]||promptDraft;
  proposal=null;render();panel.querySelector('#rule-prompt')?.focus?.();return;
 }
 const picked=event.target.closest?.('[data-rule-skill-index]');
 if(picked){selectedIndex=Number(picked.dataset.ruleSkillIndex);proposal=null;lastDraftKey='';syncPrompt(true);render();return;}
 const command=event.target.closest?.('[data-rule-command]')?.dataset.ruleCommand;
 if(command==='generate'){
  promptDraft=panel.querySelector('#rule-prompt')?.value||'';
  const parser=g.SkillSentenceEngine?.parseBundle||g.SkillSentenceEngine?.parse||compiler?.parse;
  proposal=parser?.(promptDraft)||{ok:false,error:'문장 해석기를 불러오지 못했습니다.'};
  render();
  feedback(proposal.ok?'구현할 동작을 확인한 후 적용하고 실험해 보세요.':
   proposal.error);
  return;
 }
 if(command==='apply'){apply(proposal);return;}
 if(command==='appearance'){g.CharacterStudioModes?.select?.('appearance');return;}
 if(command==='preview'){
  g.CharacterStudioWorkspace?.selectPreviewSkill?.(selectedIndex<0?'all':selectedIndex);
  g.document.getElementById('studio-motion-fire')?.click?.();
  feedback('선택한 기술을 미니 핀볼에서 시연하고 있습니다.');
 }
});
g.addEventListener?.('studio:open',()=>{syncPrompt(true);render();});
render();
g.SignatureRuleStudio={render,apply,tune,tuneLaw};
})(window);
