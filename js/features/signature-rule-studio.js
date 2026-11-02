/* Sentence-first skill authoring: no dragging, scripts or second editor mode.
 * Rules are authored as ordinary Korean sentences and share the Forge save. */
(function(g){'use strict';
const d=g.document,panel=d?.querySelector('#scratch-beginner'),forge=g.SkillForge;
const R=g.SignatureRuleSkill,parser=g.SignaturePromptCompiler;
let promptDraft='',proposal=null;
if(!panel||!forge||!R)return;
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const choices=(items,chosen)=>Object.entries(items).map(([key,label])=>'<option value="'+E(key)+'"'+(String(key)===String(chosen)?' selected':'')+'>'+E(label)+'</option>').join('');
const types=Object.fromEntries([...R.TYPES,...Object.keys(forge.TYPE)].filter((id,i,all)=>all.indexOf(id)===i&&forge.TYPE[id]).map(id=>[id,forge.TYPE[id]]));
const templates=[
 {id:'split',name:'💎 끝없이 증식하는 탄막',desc:'분열탄이 다시 분열하고, 분열 소리가 새로운 발사를 부릅니다',
  window:12,rules:[{when:'pulse',interval:.65,fracture:3,action:{type:'splitshot',damage:16,count:5,radius:145}},
   {when:'split',interval:1.4,action:{type:'shot',damage:8,count:3,radius:155}}]},
 {id:'speed',name:'⚡ 벽에 튕길수록 광속',desc:'가속을 쌓아 최고속도로 질주하고 충돌로 충격파 발생',
  window:15,rules:[{when:'pulse',interval:1,action:{type:'haste',damage:0,duration:1.7}},
   {when:'wall',interval:.5,action:{type:'timeburst',damage:0,duration:1.5}},
   {when:'contact',interval:.65,action:{type:'wave',damage:25,radius:130}}]},
 {id:'slam',name:'☄️ 점프 · 낙하 · 다시 점프',desc:'하늘로 뛰어올라 착지할 때마다 폭발적인 낙하 공격',
  window:16,rules:[{when:'pulse',interval:2.3,action:{type:'leap',damage:0}},
   {when:'land',interval:.55,action:{type:'dive',damage:38,radius:175}}]},
 {id:'storm',name:'🌪️ 벽 반사 연쇄 폭풍',desc:'벽을 만나면 번개를 쏘고, 명중하면 추가 충격파',
  window:11,rules:[{when:'wall',interval:.4,action:{type:'bolt',damage:28}},
   {when:'hit',interval:.7,action:{type:'wave',damage:22,radius:150}},
   {when:'pulse',interval:2,action:{type:'dash',damage:0}}]}
];
function fighter(){return forge.getDraft();}
function read(){return fighter().skills?.[0]?.ruleSet||null;}
function confirmReplace(){
 const p=fighter(),s=p.skills[0];
 if(read())return true;
 if(p.signatureVersion===0)return g.confirm?.('이전 캐릭터의 스킬을 규칙형 고유 스킬로 전환할까요? 이전 스킬은 원본 백업으로 보존합니다.')!==false;
 if(Array.isArray(s.program)||s.actions?.some(a=>a.type!=='wave'||a.damage!==18))
  return g.confirm?.('현재 설계한 고유 스킬을 규칙형으로 바꿀까요? 저장된 원본 캐릭터는 다시 저장하기 전까지 그대로입니다.')!==false;
 return true;
}
function write(value,message,generatedName){
 const current=fighter(),recipe=R.normalize(value);
 if(!recipe.rules.length){status('동작 규칙을 하나 이상 추가해야 합니다.');return false;}
 if(!read()&&!confirmReplace())return false;
 const p=current.signatureVersion===1?current:g.SignatureProgram.migrate(current);
 const s=p.skills[0],next={...p,signatureVersion:1,skills:[{
  ...s,name:generatedName||s.name,program:undefined,ruleSet:recipe,actions:R.preview(recipe),trigger:'auto'
 }]};
 try{
  forge.setDraft(next);
  g.CharacterStudioWorkspace?.refresh?.();
  render();status(message||'규칙을 저장 전 초안에 반영했습니다.');
  return true;
 }catch(err){status(err.message);return false;}
}
function status(message){const node=panel.querySelector('#rule-feedback');if(node)node.textContent=message;}
function ruleRow(r,i,n){
 const a=r.action;
 const special=a.type==='splitshot',last=n.length;
 return '<article class="rule-row" data-rule-index="'+i+'"><div class="rule-row-heading"><strong>규칙 '+(i+1)+'</strong>'
  +'<span class="rule-row-controls"><button type="button" data-rule-command="up" data-index="'+i+'" '+(i===0?'disabled':'')+' aria-label="규칙 위로">↑</button>'
  +'<button type="button" data-rule-command="down" data-index="'+i+'" '+(i===last-1?'disabled':'')+' aria-label="규칙 아래로">↓</button>'
  +'<button type="button" data-rule-command="duplicate" data-index="'+i+'" aria-label="복제">복제</button>'
  +'<button type="button" data-rule-command="remove" data-index="'+i+'" aria-label="삭제">×</button></span></div>'
  +'<div class="rule-sentence"><label><span>언제</span><select data-rule-index="'+i+'" data-rule-field="when">'+choices(R.WHEN,r.when)+'</select></label>'
  +'<label><span>무엇을</span><select data-rule-index="'+i+'" data-rule-field="type">'+choices(types,a.type)+'</select></label>'
  +'<label><span>반복 간격</span><span class="rule-number"><input type="number" min=".35" max="4" step=".05" data-rule-index="'+i+'" data-rule-field="interval" value="'+r.interval+'"> 초</span></label></div>'
  +'<div class="rule-tuners"><label>위력<input type="number" min="0" max="120" step="1" data-rule-index="'+i+'" data-rule-field="damage" value="'+a.damage+'"></label>'
  +'<label>범위<input type="number" min="30" max="300" step="5" data-rule-index="'+i+'" data-rule-field="radius" value="'+a.radius+'"></label>'
  +'<label>개수<input type="number" min="1" max="8" step="1" data-rule-index="'+i+'" data-rule-field="count" value="'+a.count+'"></label>'
  +'<label>지속시간<input type="number" min=".2" max="8" step=".1" data-rule-index="'+i+'" data-rule-field="duration" value="'+a.duration+'"></label>'
  +(special?'<label>연쇄 분열<select data-rule-index="'+i+'" data-rule-field="fracture">'+choices({1:'1세대',2:'2세대',3:'3세대'},r.fracture)+'</select></label>':'')
  +'</div></article>';
}
function render(){
 const p=fighter(),s=p.skills[0],original=read(),recipe=R.normalize(original||{
   window:10,rules:[{when:'pulse',interval:1,action:s.actions[0]}]
 });
 panel.classList.add('rule-studio');
 const summary=proposal?.ok?'<section class="rule-proposal" aria-label="문장 해석 미리보기">'
  +'<strong>이렇게 이해했어요: '+E(proposal.name)+'</strong>'
  +'<p>'+proposal.recipe.rules.map(r=>E(R.WHEN[r.when]+' → '+(forge.TYPE[r.action.type]||r.action.type)
   +' ('+r.interval+'초 간격)')).join(' · ')+'</p>'
  +(proposal.notes.length?'<ul>'+proposal.notes.map(x=>'<li>'+E(x)+'</li>').join('')+'</ul>':'')
  +'<div class="rule-proposal-buttons"><button type="button" data-rule-command="apply">✓ 규칙에 적용하고 실험하기</button>'
  +'<button type="button" data-rule-command="dismiss">취소</button></div></section>':
  proposal?.error?'<p class="rule-prompt-error" role="alert">'+E(proposal.error)+'</p>':'';
 panel.innerHTML='<div class="rule-hero"><span>OIBUNG / RULE MAKER</span><h3>상상한 기술을 규칙으로 만들기</h3>'
  +'<p>블록을 조립하지 않아도 됩니다. “언제 · 무엇을 · 얼마나 자주”를 문장으로 설정하면 전투에서 계속 작동합니다.</p></div>'
  +'<div class="rule-main"><section class="rule-prompt-box"><div class="rule-prompt-title"><div>'
  +'<span class="rule-prompt-step">01 · 상상하기</span><h4>어떤 미친 스킬을 만들고 싶나요?</h4>'
  +'<p>예: “분열탄을 3개씩 계속 쏘고 분열할 때마다 추가로 발사해”</p></div>'
  +'<span class="rule-offline-mark">무료 · 오프라인 문장 해석</span></div>'
  +'<label for="rule-prompt" class="rule-prompt-label">자유로운 스킬 설명</label>'
  +'<textarea id="rule-prompt" maxlength="300" rows="3" spellcheck="false" placeholder="예: 벽에 튕길 때마다 가속해서 엄청 빨라지고 상대와 부딪히면 충격파 발사">'
  +E(promptDraft)+'</textarea><div class="rule-prompt-bottom"><p>로그인이나 API 키 없이 작동합니다. 현재는 AI 서버가 아닌 게임 동작 사전 기반 문장 해석기로 지원 가능한 규칙만 생성합니다.</p>'
  +'<button type="button" data-rule-command="generate">⚡ 문장에서 기술 생성</button></div>'+summary+'</section>'
  +'<div class="rule-flow-arrow">↓ <span>02 · 자동 생성된 규칙 수정</span></div>'
  +'<div class="rule-meta"><label>기술 이름<input type="text" id="rule-name" maxlength="18" value="'+E(s.name)+'"></label>'
  +'<label>폭주 유지 시간 <span class="rule-number"><input id="rule-window" type="number" min="4" max="18" step=".5" value="'+recipe.window+'"> 초</span></label></div>'
  +(!original?'<div class="rule-intro"><strong>새로운 규칙 설계가 준비됐습니다.</strong><p>예전 캐릭터는 그대로 보존됩니다. 아래 예시를 고르거나 ‘현재 기술을 규칙으로 시작’으로 전환하세요.</p>'
    +'<button type="button" data-rule-command="start">현재 기술을 규칙으로 시작</button></div>':'')
  +'<div class="rule-row-list">'+recipe.rules.map(ruleRow).join('')+'</div>'
  +'<div class="rule-flow-arrow">↓ <span>03 · 핀볼 실험장에서 확인</span></div>'
  +'<div class="rule-toolbar"><button type="button" data-rule-command="add" '+(recipe.rules.length>=8?'disabled':'')+'>+ 새로운 규칙 추가</button>'
  +'<button type="button" data-rule-command="preview">▶ 미니 핀볼 실험장에서 보기</button></div>'
  +'<div class="rule-templates"><h4>한 번에 시작하는 미친 기술들</h4><p>선택한 뒤 모든 규칙을 마음대로 바꿀 수 있습니다.</p><div class="rule-template-grid">'+templates.map(t=>
   '<button type="button" data-rule-template="'+t.id+'"><strong>'+E(t.name)+'</strong><small>'+E(t.desc)+'</small></button>').join('')+'</div></div>'
  +'<p class="rule-explain">⚡ 기세 100이 되면 폭주가 시작됩니다. 반복·충돌·착지·분열 반응은 폭주 중에만 작동합니다. '
  +'연속 동작은 실제 전투 시간에 걸쳐 실행되며, 피해량·방어·기세·탄환 개수는 전투 엔진이 자동 조절합니다.</p>'
  +'<p id="rule-feedback" role="status" aria-live="polite">동작 규칙을 고르거나 수정하세요.</p></div>';
}
panel.addEventListener('click',e=>{
 const template=e.target.closest('[data-rule-template]'),button=e.target.closest('[data-rule-command]');
 if(template){
  const recipe=templates.find(t=>t.id===template.dataset.ruleTemplate);
  if(recipe)write(recipe,'폭주 조합을 적용했습니다. 규칙을 바꾸어 나만의 기술로 만드세요.');
  return;
 }
 if(!button)return;
 const cmd=button.dataset.ruleCommand;
 if(cmd==='generate'){
  promptDraft=panel.querySelector('#rule-prompt')?.value||'';
  proposal=parser?.parse(promptDraft)||{ok:false,error:'문장 해석기를 사용할 수 없습니다.'};
  render();
  if(proposal.ok)status('규칙을 만들었습니다. 아래 제안 내용을 확인한 뒤 적용하세요.');
  else status(proposal.error);
  return;
 }
 if(cmd==='dismiss'){proposal=null;render();return;}
 if(cmd==='apply'){
  if(!proposal?.ok)return;
  const candidate=proposal;
  if(write(candidate.recipe,'문장에서 생성한 규칙을 초안에 적용했습니다. 왼쪽 핀볼 실험장을 확인하세요.',candidate.name)){
   proposal=null;
   g.CharacterStudioWorkspace?.selectPreviewSkill?.('all');
   d.getElementById('studio-motion-fire')?.click?.();
  }
  return;
 }
 if(cmd==='preview'){g.CharacterStudioWorkspace?.selectPreviewSkill?.('all');d.getElementById('studio-motion-fire')?.click?.();status('왼쪽 미니 핀볼 실험장에서 규칙이 반복되는 모습을 확인하세요.');return;}
 const current=R.normalize(read()||{window:10,rules:[{when:'pulse',interval:1,action:fighter().skills[0].actions[0]}]});
 if(cmd==='start')write(current,'이제 언제·무엇을·반복할지를 자유롭게 수정할 수 있습니다.');
 if(cmd==='add'){
  if(current.rules.length>=8){status('규칙은 최대 8개입니다. 동작 실행 횟수는 별도로 안전하게 관리됩니다.');return;}
  current.rules.push(R.fallback());write(current,'규칙을 추가했습니다.');
 }
 const i=Number(button.dataset.index);
 if(['up','down','duplicate','remove'].includes(cmd)&&i>=0&&i<current.rules.length){
  if(cmd==='remove'&&current.rules.length===1){status('최소 한 개의 규칙이 필요합니다.');return;}
  if(cmd==='remove')current.rules.splice(i,1);
  if(cmd==='duplicate'&&current.rules.length<8)current.rules.splice(i+1,0,{...current.rules[i],action:{...current.rules[i].action}});
  if(cmd==='up'&&i>0)[current.rules[i-1],current.rules[i]]=[current.rules[i],current.rules[i-1]];
  if(cmd==='down'&&i<current.rules.length-1)[current.rules[i+1],current.rules[i]]=[current.rules[i],current.rules[i+1]];
  write(current,'규칙 구성을 변경했습니다.');
 }
});
panel.addEventListener('input',e=>{if(e.target.id==='rule-prompt')promptDraft=e.target.value;});
panel.addEventListener('change',e=>{
 const input=e.target;
 if(input.id==='rule-name'){
  const p=fighter(),s=p.skills[0];
  forge.setDraft({...p,skills:[{...s,name:input.value.slice(0,18)}]});
  g.CharacterStudioWorkspace?.refresh?.();status('기술 이름을 변경했습니다.');return;
 }
 const base=R.normalize(read()||{window:10,rules:[{when:'pulse',interval:1,action:fighter().skills[0].actions[0]}]});
 if(input.id==='rule-window'){base.window=Number(input.value);write(base,'폭주 유지 시간을 변경했습니다.');return;}
 const i=Number(input.dataset.ruleIndex),field=input.dataset.ruleField;
 if(!field||!Number.isInteger(i)||i<0||i>=base.rules.length)return;
 const r=base.rules[i],value=input.value;
 if(field==='when'||field==='type')field==='when'?r.when=value:r.action.type=value;
 else if(field==='fracture')r.fracture=Number(value);
 else if(field==='interval')r.interval=Number(value);
 else if(['damage','radius','count','duration'].includes(field))r.action[field]=Number(value);
 write(base,'규칙을 반영했습니다.');
});
const prior=g.ScratchStudio?.onChange;
if(g.ScratchStudio)g.ScratchStudio.onChange=()=>{if(!panel.classList.contains('rule-studio'))prior?.();render();};
g.addEventListener?.('studio:open',render);
render();
g.SignatureRuleStudio={render};
})(window);
