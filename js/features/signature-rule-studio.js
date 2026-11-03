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
function apply(result,mode='add'){
 if(!result?.ok)return false;
 const current=forge.getDraft();
 const p={...current,signatureVersion:1,allAbilities:false};
 const existing=skill();
 const starter=p.skills.length===1&&selectedIndex===0&&!existing.ruleSet&&
   !existing.program&&existing.actions?.length===1&&
   ['wave','shot'].includes(existing.actions[0].type)&&
   Number(existing.actions[0].damage)===18;
 const replace=mode==='replace'||starter;
 if(mode==='replace'&&!starter&&typeof g.confirm==='function'&&
    !g.confirm('선택한 스킬을 새 문장으로 바꿀까요? 다른 스킬은 유지됩니다.'))return false;
 const ir=g.SkillIR?.fromRecipe?.(result.recipe);
 const recipe=ir?g.SkillIR.toRecipe(ir):rules.normalize(result.recipe);
 if(!recipe.rules.length)return false;
 const typedName=(panel.querySelector('#rule-name')?.value||'').trim().slice(0,18);
 const name=typedName||result.name||existing.name||'새 스킬';
 const next=p.skills.slice(),index=replace&&selectedIndex>=0?selectedIndex:next.length;
 const replacement={...(replace?existing:{}),name,
    promptText:result.sourceText||promptDraft,program:undefined,ruleSet:recipe,
    ir:ir||undefined,actions:rules.preview(recipe),
    trigger:'auto',cooldown:5,threshold:40};
 if(replace&&selectedIndex>=0)next[index]=replacement;
 else next.push(replacement);
 try{
   forge.setDraft({...p,skills:next});
   selectedIndex=index;proposal=null;lastDraftKey='';syncPrompt(true);
   g.CharacterStudioWorkspace?.refresh?.();render();
   const budget=g.ArenaBalance?.summary?.(forge.getDraft());
   feedback('독립 스킬 '+next.length+'개 · '+(budget?
     '현재 화력 보정 약 '+budget.percent+'% · ':'')+
     '기세 100마다 하나씩 순환 발동합니다. 저장하여 확정하세요.');
   g.CharacterStudioWorkspace?.selectPreviewSkill?.(selectedIndex);
   g.document.getElementById('studio-motion-fire')?.click?.();
   return true;
 }catch(error){feedback(error?.message||'스킬 적용 실패');return false;}
}
function collectionHTML(){
 const p=forge.getDraft(),skills=p?.skills||[],budget=g.ArenaBalance?.summary?.(p);
 const defense=g.ArenaBalance?.defenseSummary?.(p);
 return '<section class="sentence-collection"><div class="sentence-collection-header">'
   +'<strong>보유 스킬 '+skills.length+'개 · 개수 제한 없음</strong>'
   +'<button type="button" data-rule-command="new">+ 새 스킬 구상하기</button></div>'
   +'<p class="sentence-local-note">기세 100마다 스킬 하나가 순서대로 발동합니다. 여러 스킬이 동시에 자동 발동하지 않습니다.</p>'
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
 +'<div class="sentence-understood">'+rows.map((r,i)=>
   '<div class="sentence-understood-row"><span>'+String(i+1).padStart(2,'0')+'</span>'
   +'<div><strong>'+E(r.when)+' → '+E(r.action)+'</strong>'
   +'<small>발동 최소 간격 '+E(r.interval)+'초'+(r.visual?' · '+E(r.visual)+' 연출':'')+'</small></div></div>'
  ).join('')+'</div>'
 +(limitations.length?'<div class="sentence-limitations"><strong>현재 구현 범위 안내</strong><ul>'
  +limitations.map(n=>'<li>'+E(n)+'</li>').join('')+'</ul></div>':'')
 +grammarPreview+auditView+sandboxView+physicsView
 +((result.notes||[]).length?'<details class="sentence-more"><summary>해석과 안전 제한 자세히</summary><ul>'
 +(result.notes||[]).map(x=>'<li>'+E(x)+'</li>').join('')+'</ul></details>':'')
 +'<p class="sentence-local-note">이 결과는 오프라인 동작 사전과 실행 규칙으로 구성됩니다. 새로운 물리 능력이나 연출을 무조건 생성하는 AI는 아닙니다.</p>'
 +'<button type="button" data-rule-command="apply" class="sentence-apply">✓ 독립 스킬로 추가하고 실험하기</button>'
 +(selectedIndex>=0?'<button type="button" data-rule-command="replace" class="sentence-preview">↻ 선택한 스킬 덮어쓰기</button>':'')+'</section>';
}
function currentHTML(){
 const s=skill();
 if(!s.ruleSet)return '<p class="sentence-current-empty">'+(selectedIndex<0?'새 스킬을 구상 중입니다. 문장을 입력하면 독립 기술로 추가됩니다.':'선택한 스킬은 아직 문장으로 만든 기술이 아닙니다.')+'</p>';
 return '<div class="sentence-current">'
 +'<strong>현재 초안 · '+E(s.name||'나만의 고유 스킬')+'</strong>'
 +'<div>'+summaryOf(s.ruleSet).map(x=>'<p>'+E(x.when)+' · '+E(x.action)+'</p>').join('')+'</div>'
 +(s.promptText?'<small>원문: '+E(s.promptText)+'</small>':
   '<small>이 기술은 이전 편집기에서 만들어졌습니다. 새 문장으로 변경해도 저장된 원본은 유지됩니다.</small>')
 +'</div>';
}
function render(){
 syncPrompt();
 panel.classList.add('rule-studio','sentence-only-studio');
 const name=skill().name||'';
 panel.innerHTML='<header class="sentence-hero"><span>OIBUNG / IMAGINATION TO SKILL</span>'
 +'<h3>상상하는 스킬을 문장으로 적어 보세요</h3>'
 +'<p>블록을 조립할 필요 없습니다. 문장 하나로 독립 스킬을 만들고 여러 기술을 모으세요.</p></header>'
 +collectionHTML()
 +'<div class="sentence-box"><label for="rule-prompt"><strong>어떤 기술을 만들고 싶나요?</strong>'
 +'<small>조건·행동·외형을 자연스럽게 쓰세요. 최대 300자.</small></label>'
 +'<textarea id="rule-prompt" maxlength="300" rows="6" spellcheck="false" placeholder="예: 거대한 턱이 공의 한 부분에서 솟아나 상대를 후려치고, 그 다음 어두운 멘헤라 에너지를 모아 두꺼운 레이저를 발사한다.">'
 +E(promptDraft)+'</textarea>'
 +'<div class="sentence-examples"><span>예문을 눌러 문장에 넣기</span>'
 +'<button type="button" data-rule-example="jaw">🐉 거대한 턱</button>'
 +'<button type="button" data-rule-example="beam">🌑 멘헤라빔</button>'
 +'<button type="button" data-rule-example="chain">💎 연쇄 분열</button>'
 +'<button type="button" data-rule-example="wall">⚡ 벽 충돌 가속</button></div>'
 +'<label class="sentence-name" for="rule-name">기술 이름 (선택 사항)'
 +'<input id="rule-name" maxlength="18" type="text" value="'+E(name)+'" placeholder="문장을 해석해 자동으로 이름 붙이기"></label>'
 +'<button type="button" data-rule-command="generate" class="sentence-generate">✨ 문장에서 스킬 구현하기</button>'
 +'<p class="sentence-local-note">무료 · 로그인 불필요 · 로컬 문장 해석. 지원하지 않는 행동은 명확하게 알려드립니다.</p></div>'
 +resultHTML(proposal)
 +'<section class="sentence-current-section"><h4>선택한 스킬</h4>'+currentHTML()
 +'<button type="button" data-rule-command="preview" class="sentence-preview">▶ 미니 핀볼에서 선택 스킬 보기</button>'
 +(forge.getDraft()?.skills?.length>1&&selectedIndex>=0?'<button type="button" data-rule-command="delete" class="sentence-preview">스킬 삭제</button>':'')+'</section>'
 +'<div id="rule-feedback" role="status" aria-live="polite"></div>';
}
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
   wall:'벽에 튕길 때마다 몸의 속도가 빨라지고 상대와 부딪히면 충격파를 발사합니다.'
  };
  promptDraft=samples[example.dataset.ruleExample]||promptDraft;
  proposal=null;render();panel.querySelector('#rule-prompt')?.focus?.();return;
 }
 const picked=event.target.closest?.('[data-rule-skill-index]');
 if(picked){selectedIndex=Number(picked.dataset.ruleSkillIndex);proposal=null;lastDraftKey='';syncPrompt(true);render();return;}
 const command=event.target.closest?.('[data-rule-command]')?.dataset.ruleCommand;
 if(command==='new'){selectedIndex=-1;proposal=null;promptDraft='';lastDraftKey='';render();return;}
 if(command==='delete'){
   const current=forge.getDraft();
   if(selectedIndex<0||current.skills.length<2)return;
   if(typeof g.confirm==='function'&&!g.confirm('선택한 스킬을 삭제할까요?'))return;
   const skills=current.skills.slice();skills.splice(selectedIndex,1);
   forge.setDraft({...current,skills});selectedIndex=Math.min(selectedIndex,skills.length-1);
   proposal=null;lastDraftKey='';syncPrompt(true);render();return;
 }
 if(command==='generate'){
  promptDraft=panel.querySelector('#rule-prompt')?.value||'';
  const parser=g.SkillSentenceEngine?.parse||compiler?.parse;
  proposal=parser?.(promptDraft)||{ok:false,error:'문장 해석기를 불러오지 못했습니다.'};
  render();
  feedback(proposal.ok?'구현할 동작을 확인한 후 적용하고 실험해 보세요.':
   proposal.error);
  return;
 }
 if(command==='apply'){apply(proposal,'add');return;}
 if(command==='replace'){apply(proposal,'replace');return;}
 if(command==='preview'){
  g.CharacterStudioWorkspace?.selectPreviewSkill?.(selectedIndex<0?'all':selectedIndex);
  g.document.getElementById('studio-motion-fire')?.click?.();
  feedback('현재 스킬을 미니 핀볼에서 시연하고 있습니다.');
 }
});
g.addEventListener?.('studio:open',()=>{syncPrompt(true);render();});
render();
g.SignatureRuleStudio={render,apply};
})(window);
