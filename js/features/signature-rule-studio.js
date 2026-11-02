/* Natural-language-first skill creation. Visual programming UI is retired,
 * but the validated legacy Scratch / ruleSet execution engines remain playable.
 * No LLM/key/network dependencies: compiled meaning is always shown before save.
 */
(function(g){'use strict';
const panel=g.document?.querySelector('#scratch-beginner'),forge=g.SkillForge;
const rules=g.SignatureRuleSkill,compiler=g.SignaturePromptCompiler;
if(!panel||!forge||!rules)return;
let promptDraft='',proposal=null,lastDraftKey='';
 // The optional old block editor relocates children into a hidden panel.
 // Restore sentence composition to the visible direct-authoring workspace.
 const compose=g.document?.getElementById('studio-mode-compose');
 if(compose&&panel.closest?.('#studio-expert-panel'))compose.append(panel);
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const skill=()=>forge.getDraft()?.skills?.[0]||{};
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
 const key=JSON.stringify([forge.getDraft()?.name,skill().name,current,skill().ruleSet]);
 if(force||key!==lastDraftKey){
  if(force||!proposal)promptDraft=current;
  lastDraftKey=key;
 }
}
function confirmReplace(){
 const p=forge.getDraft(),s=skill();
 if(s.ruleSet)return true;
 if(p.signatureVersion!==1)return g.confirm?.(
  '기존 캐릭터 스킬을 문장형 고유 스킬로 전환할까요? 기존 스킬은 원본 백업으로 유지됩니다.')!==false;
 if(s.program||s.actions?.some(a=>a.type!=='wave'||a.damage!==18))
  return g.confirm?.('기존 고유 스킬을 새 문장으로 교체할까요? 저장하기 전까지 원본 캐릭터는 그대로입니다.')!==false;
 return true;
}
function apply(result){
 if(!result?.ok)return false;
 if(!skill().ruleSet&&!confirmReplace())return false;
 const current=forge.getDraft();
 const p=current.signatureVersion===1?current:g.SignatureProgram?.migrate?.(current);
 if(!p)return false;
 const s=p.skills[0],recipe=rules.normalize(result.recipe);
 if(!recipe.rules.length)return false;
 const name=(panel.querySelector('#rule-name')?.value||'').trim().slice(0,18)||
   result.name||s.name;
 const replacement={...s,name,promptText:result.sourceText||promptDraft,
  program:undefined,ruleSet:recipe,actions:rules.preview(recipe),trigger:'auto'};
 try{
  forge.setDraft({...p,signatureVersion:1,allAbilities:false,
   skills:[replacement]});
  proposal=null;
  syncPrompt(true);
  g.CharacterStudioWorkspace?.refresh?.();
  render();
  feedback('문장을 스킬로 적용했습니다. 미니 핀볼에서 시연한 후 캐릭터 저장 · 출전을 눌러 확정하세요.');
  g.CharacterStudioWorkspace?.selectPreviewSkill?.('all');
  g.document.getElementById('studio-motion-fire')?.click?.();
  return true;
 }catch(error){feedback(error?.message||'스킬 적용 실패');return false;}
}
function resultHTML(result){
 if(result?.error)return '<section class="sentence-error" role="alert"><strong>이 문장은 아직 구현하지 못했어요.</strong><p>'+
   E(result.error)+'</p><p>동작·발동 조건·외형을 구체적으로 적으면 해석하기 쉽습니다. 예: “벽에 튕길 때마다 붉은 충격파를 쏜다”.</p></section>';
 if(!result?.ok)return '';
 const rows=result.summary?.length?result.summary:summaryOf(result.recipe);
 const limitations=[...new Set(result.limitations||[])];
 return '<section class="sentence-interpretation" aria-label="문장 해석 결과">'
 +'<h4>이 문장을 이렇게 구현합니다</h4>'
 +'<div class="sentence-understood">'+rows.map((r,i)=>
   '<div class="sentence-understood-row"><span>'+String(i+1).padStart(2,'0')+'</span>'
   +'<div><strong>'+E(r.when)+' → '+E(r.action)+'</strong>'
   +'<small>발동 최소 간격 '+E(r.interval)+'초'+(r.visual?' · '+E(r.visual)+' 연출':'')+'</small></div></div>'
  ).join('')+'</div>'
 +(limitations.length?'<div class="sentence-limitations"><strong>현재 구현 범위 안내</strong><ul>'
  +limitations.map(n=>'<li>'+E(n)+'</li>').join('')+'</ul></div>':'')
 +((result.notes||[]).length?'<details class="sentence-more"><summary>해석과 안전 제한 자세히</summary><ul>'
 +(result.notes||[]).map(x=>'<li>'+E(x)+'</li>').join('')+'</ul></details>':'')
 +'<p class="sentence-local-note">이 결과는 오프라인 동작 사전과 실행 규칙으로 구성됩니다. 새로운 물리 능력이나 연출을 무조건 생성하는 AI는 아닙니다.</p>'
 +'<button type="button" data-rule-command="apply" class="sentence-apply">✓ 이 해석으로 스킬 적용하고 실험하기</button></section>';
}
function currentHTML(){
 const s=skill();
 if(!s.ruleSet)return '<p class="sentence-current-empty">아직 문장으로 만든 스킬이 없습니다. 기술을 자유롭게 설명해 주세요.</p>';
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
 +'<p>블록을 조립할 필요 없습니다. 비유, 외형, 조건, 공격 순서를 자유롭게 설명하세요.</p></header>'
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
 +'<section class="sentence-current-section"><h4>현재 스킬</h4>'+currentHTML()
 +'<button type="button" data-rule-command="preview" class="sentence-preview">▶ 미니 핀볼에서 현재 스킬 보기</button></section>'
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
 const command=event.target.closest?.('[data-rule-command]')?.dataset.ruleCommand;
 if(command==='generate'){
  promptDraft=panel.querySelector('#rule-prompt')?.value||'';
  const parser=g.SkillSentenceEngine?.parse||compiler?.parse;
  proposal=parser?.(promptDraft)||{ok:false,error:'문장 해석기를 불러오지 못했습니다.'};
  render();
  feedback(proposal.ok?'구현할 동작을 확인한 후 적용하고 실험해 보세요.':
   proposal.error);
  return;
 }
 if(command==='apply'){apply(proposal);return;}
 if(command==='preview'){
  g.CharacterStudioWorkspace?.selectPreviewSkill?.('all');
  g.document.getElementById('studio-motion-fire')?.click?.();
  feedback('현재 스킬을 미니 핀볼에서 시연하고 있습니다.');
 }
});
g.addEventListener?.('studio:open',()=>{syncPrompt(true);render();});
render();
g.SignatureRuleStudio={render,apply};
})(window);
