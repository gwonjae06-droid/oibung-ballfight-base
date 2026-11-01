/* One-screen beginner builder that edits the SAME Scratch AST as the expert
 * editor. No new combat format, no untrusted code execution, no forced save migration. */
(function(g){
'use strict';
const doc=g.document,studio=doc?.querySelector('#character-studio-dialog .forge-studio');
const workspace=doc?.querySelector('#scratch-workbench'),forge=g.SkillForge;
if(!studio||!workspace||!forge||!g.ScratchStudio||!g.SignatureScratch)return;
const S=g.ScratchStudio,compiler=g.SignatureScratch,conds=g.SignatureProgram;
const escape=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
const actions=[
 {id:'slash',icon:'⚔️',name:'가까이 베기',tip:'가까운 적을 때려요',group:'attack',damage:26},
 {id:'wave',icon:'💥',name:'충격파',tip:'주변을 넓게 공격해요',group:'attack',damage:22},
 {id:'shot',icon:'✨',name:'구슬 발사',tip:'멀리 있는 적을 공격해요',group:'attack',damage:21},
 {id:'bolt',icon:'⚡',name:'번개 공격',tip:'적 위치에 번개를 떨어뜨려요',group:'attack',damage:24},
 {id:'dash',icon:'💨',name:'빠르게 돌진',tip:'적에게 빠르게 다가가요',group:'move',damage:0},
 {id:'blink',icon:'🌟',name:'순간이동',tip:'다른 위치로 이동해요',group:'move',damage:0},
 {id:'retreat',icon:'↩️',name:'뒤로 피하기',tip:'적과 거리를 벌려요',group:'move',damage:0},
 {id:'shield',icon:'🛡️',name:'보호막',tip:'공격을 잠시 막아요',group:'defense',damage:0},
 {id:'heal',icon:'💚',name:'체력 회복',tip:'내 체력을 회복해요',group:'defense',damage:22},
 {id:'zone',icon:'❄️',name:'얼음 장판',tip:'공이 미끄러지는 지역을 만들어요',group:'special',damage:12,status:'ice'},
 {id:'timestop',icon:'🕰️',name:'시간 정지',tip:'적의 굴러감과 기세 충전을 잠깐 멈춰요',group:'special',damage:0},
 {id:'timeburst',icon:'⏩',name:'시간 가속',tip:'공 충돌·벽 반사로 얻는 기세가 1.75배',group:'special',damage:0},
 {id:'rewind',icon:'⏪',name:'시간 되감기',tip:'이전 위치·속도·기세 일부 복원',group:'special',damage:0},
 {id:'pull',icon:'🧲',name:'끌어당기기',tip:'공을 끌어와 충돌을 유도해요',group:'special',damage:16},
 {id:'wall',icon:'🧱',name:'벽 세우기',tip:'새로운 반사 벽을 만들어요',group:'special',damage:0},
 {id:'homing',icon:'🎯',name:'유도탄',tip:'상대를 찾아가는 투사체를 발사해요',group:'attack',damage:17},
 {id:'splitshot',icon:'💎',name:'분열탄',tip:'날아가는 중 여러 탄환으로 분열해요',group:'attack',damage:15}
].filter(a=>forge.TYPE[a.id]);
const starters=[
 {id:'auto',icon:'⚡',name:'기세가 가득 차면',tip:'충돌로 기세 100을 모으면 자동 발동'}, 
 {id:'lowhp',icon:'❤️',name:'체력이 적을 때',tip:'위험할 때 기술 사용'},
 {id:'danger',icon:'🚨',name:'보스가 공격할 때',tip:'보스의 큰 공격을 보고 반응'},
 {id:'dodge',icon:'💨',name:'보스 공격을 피한 뒤',tip:'회피 성공 후 반격'},
 {id:'contact',icon:'🎱',name:'공끼리 부딪힌 뒤',tip:'충돌로 얻은 기세를 판단'},
 {id:'wall',icon:'🧱',name:'벽에 튕긴 뒤',tip:'벽 반사 후 동작을 조합'}
];
const templates=[
 {id:'brawler',icon:'⚔️',name:'달려가서 공격!',desc:'돌진 → 베기 → 충격파',trigger:'auto',sequence:['dash','slash','wave']},
 {id:'sniper',icon:'🎯',name:'멀리서 연속 공격!',desc:'구슬 → 번개 → 구슬',trigger:'auto',sequence:['shot','bolt','shot']},
 {id:'guardian',icon:'🛡️',name:'위험할 때 보호!',desc:'보호막 → 회복 → 충격파',trigger:'lowhp',sequence:['shield','heal','wave']},
 {id:'frost',icon:'❄️',name:'얼려서 공격!',desc:'얼음 장판 → 번개',trigger:'auto',sequence:['zone','bolt']},
 {id:'evasion',icon:'💫',name:'피한 뒤 반격!',desc:'회피 성공 → 순간이동 → 공격',trigger:'dodge',sequence:['blink','wave']},
 {id:'pinball',icon:'🎱',name:'벽 반사 돌격!',desc:'돌진 → 충격파',trigger:'auto',sequence:['dash','wave']},
 {id:'chrono',icon:'🕰️',name:'시간 튕김 조합!',desc:'시간 가속 → 끌어당기기 → 충격파',trigger:'auto',sequence:['timeburst','pull','wave']}
];
const nodeOf=(id)=>{const item=actions.find(a=>a.id===id);
 const d={type:id,damage:item?.damage??20,radius:id==='wave'?130:120,
  speed:5,duration:id==='shield'?1.4:id==='timestop'?1.2:id==='rewind'?2.5:1.5,status:item?.status||'none',link:'after'};
 return {kind:'action',action:compiler.safeAction(d)};
};
const panel=doc.createElement('section');panel.id='scratch-beginner';panel.className='scratch-beginner';
panel.setAttribute('aria-label','중급 고유 스킬 설계 작업실');
panel.innerHTML='<div class="kid-top"><div><span class="kid-overline">MY SPECIAL MOVE</span><h3>나만의 전투 기술 설계</h3><p>전투 유형을 고르고 행동 4개를 조립하세요. 순서·대상·연계·위력을 직접 수정할 수 있습니다.</p></div><div class="kid-display" role="group" aria-label="코딩 화면 보기 선택"><button type="button" data-kid-view="easy" aria-pressed="true">✏️ 기본 설계</button><button type="button" data-kid-view="advanced" aria-pressed="false">⚙ 고급 코딩</button></div></div>'
 +'<div class="kid-legacy" hidden><strong>이 캐릭터는 예전 스킬을 사용하고 있어요.</strong><p>기존 기술은 그대로 보관돼요. 새 필살기 방식으로 바꾸고 싶을 때만 선택하세요.</p><button type="button" data-kid-command="convert">한 가지 필살기로 바꾸기</button></div>'
 +'<div class="kid-easy-body">'
 +'<section class="kid-section" aria-labelledby="kid-step-one"><div class="kid-step-heading"><span class="kid-step-no">1</span><div><h4 id="kid-step-one">① 기세가 100이 되면</h4><p>⚡ 기세가 100이 되면 자동 사용! 발동 시점은 모두 같아요.</p></div></div><div class="kid-trigger-options"></div></section>'
 +'<section class="kid-section" aria-labelledby="kid-step-two"><div class="kid-step-heading"><span class="kid-step-no">2</span><div><h4 id="kid-step-two">② 행동을 최대 4개 선택</h4><p>블록을 누르면 내 기술에 차례대로 추가돼요.</p></div></div><div class="kid-action-grid"></div></section>'
 +'<section class="kid-section kid-plan-section" aria-labelledby="kid-step-three"><div class="kid-step-heading"><span class="kid-step-no">3</span><div><h4 id="kid-step-three">③ 순서와 연계 편집</h4><p>위에서 아래로 순서대로 실행돼요.</p></div></div>'
 +'<label class="kid-name-label">내 필살기 이름<input id="kid-skill-name" type="text" maxlength="18" placeholder="예: 번개 돌진"></label><div class="kid-skill-summary"><div class="kid-plan"></div><div class="kid-count"></div></div>'
 +'<div class="kid-tempo kid-momentum-guide"><strong>⚡ 필살기는 기세가 100이 되면 준비돼요</strong><p>상대와 부딪히거나 벽에 튕기면 빨리 충전돼요. 충돌과 벽 반사로 쌓이고, 전투 중에는 천천히 자동 충전돼요.</p></div>'
 +'<button type="button" class="kid-preview-action" data-kid-command="preview">▶ 스킬 동작 시연 (승률 예측 아님)</button></section>'
 +'<section class="kid-templates" aria-labelledby="kid-templates-title"><div class="kid-templates-heading"><h4 id="kid-templates-title">무엇부터 만들지 모르겠나요?</h4><p>마음에 드는 예시를 누르면 블록이 자동으로 채워져요. 나중에 바꿀 수도 있어요.</p></div><div class="kid-template-grid"></div><button type="button" class="kid-random" data-kid-command="random">🎲 아무거나 재미있는 기술 만들기</button></section>'
 +'</div><div class="kid-feedback" role="status" aria-live="polite">기세 100이 되면 기술이 발동해요. 원하는 행동 블록을 골라 보세요.</div>';
const work=studio.querySelector('#studio-panel-skills');work.insertBefore(panel,workspace);
studio.classList.add('scratch-friendly-mode');
// Preserve access to appearance editing even when the code panel is hidden.
const nav=studio.querySelector('.scratch-main-nav');
const codeTab=nav?.querySelector('[data-scratch-tab="code"]');
const looksTab=nav?.querySelector('[data-scratch-tab="looks"]');
if(codeTab)codeTab.textContent='✏️ 스킬 만들기';
if(looksTab)looksTab.textContent='🎨 외형 꾸미기';
const $=sel=>panel.querySelector(sel),get=()=>forge.getDraft();
let mode='easy';
function tell(text){$('.kid-feedback').textContent=text;}
function safeConfirm(question){return typeof g.confirm!=='function'||g.confirm(question);}
function migrate(){
 const old=get();
 if(old.signatureVersion===1)return true;
 if(!safeConfirm('이 캐릭터의 기존 4개 스킬을 한 개의 필살기로 바꿀까요? 원래 기술은 백업됩니다.'))return false;
 const converted=conds.migrate(old);
 forge.setDraft(converted);S.render();return true;
}
function program(){return S.getProgram();}
function setProgram(next,fields={},message='내 필살기에 적용했어요!'){
 S.applyProgram(next,fields,message);
 tell(message);
}
function changeFields(fields){if(!migrate())return;S.applyFields(fields,'기술을 쓸 때를 바꿨어요!');tell('좋아요! 발동 순간을 선택했어요.');}
function add(id){
 if(!migrate())return;
 const code=program();
 if(code.length>=4||compiler.preview(code).length>=4){tell('기본 설계는 행동 4개까지 가능합니다. 더 복잡한 조건·반복은 고급 코딩에서 수정하세요.');return;}
 code.push(nodeOf(id));
 setProgram(code,{},'좋아요! '+(actions.find(x=>x.id===id)?.name||'행동')+' 블록을 추가했어요.');
 g.CharacterStudioWorkspace?.selectPreviewSkill?.('all');
}
function displayPlan(nodes,depth=0){
 let result='';
 for(let i=0;i<nodes.length;i++){
  const n=nodes[i],type=n.action?.type,action=actions.find(x=>x.id===type);
  const caption=n.kind==='action'?(action?.name||forge.TYPE[type]||'행동'):
   n.kind==='if'?'만약 '+(conds.CONDITIONS[n.condition]||'조건')+'라면':
   n.kind==='repeat'?'아래 행동을 '+n.times+'번 반복':
   n.kind==='wait'?(n.seconds||0)+'초 기다리기':
   n.kind==='waitUntil'?(conds.CONDITIONS[n.condition]||'조건')+'까지 기다리기':
   n.kind==='repeatUntil'?'조건이 맞을 때까지 반복':
   n.kind==='set'?'충전 숫자를 '+n.value+'로 정하기':
   n.kind==='change'?'충전 숫자 '+n.value+' 바꾸기':'동작';
  const icon=n.kind==='action'?(action?.icon||'✨'):n.kind==='if'?'❓':n.kind==='repeat'||n.kind==='repeatUntil'?'🔁':n.kind==='wait'||n.kind==='waitUntil'?'⏳':'🔢';
  const basic=depth===0&&n.kind==='action',a=n.action||{};
  const option=(vals,val)=>Object.entries(vals).map(([k,v])=>'<option value="'+escape(k)+'"'+(k===val?' selected':'')+'>'+escape(v)+'</option>').join('');
  const typeOptions=actions.map(t=>'<option value="'+escape(t.id)+'"'+(t.id===a.type?' selected':'')+'>'+escape(t.name)+'</option>').join('');
  result+='<div class="kid-plan-item kid-plan-'+(n.kind==='action'?'action':'control')+'" style="--kid-indent:'+Math.min(depth,3)+'"><span aria-hidden="true">'+icon+'</span><span>'+escape(caption)+'</span>'
   +(depth===0?'<span class="kid-item-controls"><button type="button" data-kid-move="'+i+'" data-kid-dir="-1" '+(i===0?'disabled':'')+' aria-label="위로 이동">↑</button>'
    +'<button type="button" data-kid-move="'+i+'" data-kid-dir="1" '+(i===nodes.length-1?'disabled':'')+' aria-label="아래로 이동">↓</button>'
    +'<button type="button" data-kid-delete="'+i+'" aria-label="'+escape(caption)+' 삭제">×</button></span>':'')+'</div>';
  if(basic)result+='<details class="kid-action-settings"><summary>⚙ '+(i+1)+'번 행동 상세 설정</summary><div class="kid-action-fields">'
   +'<label>동작<select data-kid-edit="'+i+'" data-kid-key="type">'+typeOptions+'</select></label>'
   +'<label>대상<select data-kid-edit="'+i+'" data-kid-key="target">'+option(g.AbilityAtlas?.TARGETS||{nearest:'가장 가까운 적',lowest:'체력이 낮은 적',random:'무작위 적'},a.target||'nearest')+'</select></label>'
   +'<label>연계<select data-kid-edit="'+i+'" data-kid-key="link">'+option({after:'앞 동작 다음에',with:'앞 동작과 동시에',and:'함께 실행'},a.link||'after')+'</select></label>'
   +'<label>위력<input type="number" min="0" max="120" step="1" data-kid-edit="'+i+'" data-kid-key="damage" value="'+Number(a.damage||0)+'"></label>'
   +'<label>범위<input type="number" min="30" max="300" step="5" data-kid-edit="'+i+'" data-kid-key="radius" value="'+Number(a.radius||120)+'"></label>'
   +'<label>상태 효과<select data-kid-edit="'+i+'" data-kid-key="status">'+option({none:'없음',ice:'둔화',fire:'화상',poison:'중독'},a.status||'none')+'</select></label></div></details>';
  if(n.kind==='if'){
   if(n.then?.length)result+='<div class="kid-plan-subtitle">그러면</div>'+displayPlan(n.then,depth+1);
   if(n.else?.length)result+='<div class="kid-plan-subtitle">아니면</div>'+displayPlan(n.else,depth+1);
  }
  if((n.kind==='repeat'||n.kind==='repeatUntil')&&n.body?.length)
    result+=displayPlan(n.body,depth+1);
 }
 return result;
}
function refresh(){
 const fighter=get(),legacy=fighter.signatureVersion!==1;
 $('.kid-legacy').hidden=!legacy;
 const easy=$('.kid-easy-body');easy.hidden=legacy;
 if(legacy)return;
 $('.kid-trigger-options').innerHTML='<div class="kid-fixed-trigger" role="note"><strong>⚡ 기세 100 → 필살기 자동 발동</strong><p>상대와 충돌하거나 벽에 튕길수록 빨라져요. 보스 위험·회피·벽 반사 등의 판단은 자세히 보기에서 <b>만약</b> 블록으로 설정해요.</p></div>';
 $('.kid-action-grid').innerHTML=actions.map(a=>'<button type="button" class="kid-action kid-action-'+a.group+'" data-kid-add="'+a.id+'" title="'+escape(a.tip)+'">'
   +'<span class="kid-action-icon" aria-hidden="true">'+a.icon+'</span><strong>'+a.name+'</strong><small>'+a.tip+'</small><span class="kid-action-plus" aria-hidden="true">＋</span></button>').join('');
 $('#kid-skill-name').value=fighter.skills[0].name;
 const code=program();$('.kid-plan').innerHTML=code.length?displayPlan(code):'<div class="kid-empty">아직 블록이 없어요. 왼쪽(또는 위)의 색깔 블록을 눌러 주세요!</div>';
 $('.kid-count').textContent='기본 설계 '+code.length+'/4개 행동 · 고급 코딩은 별도';
 // Signature fighters now earn their casts through contact and rebounds.
 // Legacy cooldown values remain in their saved JSON for compatibility.
}
$('.kid-template-grid').innerHTML=templates.filter(t=>t.sequence.every(id=>forge.TYPE[id]))
 .map(t=>'<button type="button" class="kid-template" data-kid-template="'+t.id+'"><span aria-hidden="true">'+t.icon+'</span><strong>'+t.name+'</strong><small>'+t.desc+'</small></button>').join('');
function replaceWithTemplate(t,random=false){
 if(!t||!migrate())return;
 if(program().length>1&&!safeConfirm('현재 만든 블록을 새 예시로 바꿀까요? 이전 내용은 되돌릴 수 있어요.'))return;
 const sequence=random?[...t.sequence].sort(()=>Math.random()-.5):t.sequence;
 const code=[];
 for(let i=0;i<sequence.length;i++){
  const id=sequence[i];
  if(i>0&&['dash','blink','retreat'].includes(sequence[i-1]))
   code.push({kind:'waitUntil',condition:'move',timeout:3});
  code.push(nodeOf(id));
 }
 const name=random?'깜짝 필살기':t.name.replace(/[!]/g,'');
 setProgram(code,{trigger:t.trigger,name,cooldown:5},'짜잔! '+name+'를 만들었어요. 블록을 더 눌러 바꿀 수도 있어요.');
 g.CharacterStudioWorkspace?.selectPreviewSkill?.('all');
}
function chooseMode(next){
 mode=next==='advanced'?'advanced':'easy';
 studio.classList.toggle('scratch-friendly-advanced',mode==='advanced');
 for(const b of panel.querySelectorAll('[data-kid-view]'))b.setAttribute('aria-pressed',String(b.dataset.kidView===mode));
 if(mode==='advanced')S.render();
 tell(mode==='advanced'?'블록을 옮기고, 만약·반복 같은 코딩도 해보세요.':'행동 4개를 고르고 카드에서 연계·대상·위력을 조정하세요!');
}
panel.addEventListener('click',e=>{
 const button=e.target.closest('button');if(!button)return;
 const trigger=button.dataset.kidTrigger,addId=button.dataset.kidAdd,templateId=button.dataset.kidTemplate;
 if(button.dataset.kidView){chooseMode(button.dataset.kidView);return;}
 if(trigger){return;}
 if(addId){add(addId);return;}
 if(templateId){replaceWithTemplate(templates.find(t=>t.id===templateId));return;}
 if(button.dataset.kidMove!==undefined){
  if(!migrate())return;
  const code=program(),i=Number(button.dataset.kidMove),to=i+Number(button.dataset.kidDir);
  if(i>=0&&to>=0&&to<code.length){[code[i],code[to]]=[code[to],code[i]];
   setProgram(code,{},'행동 순서를 변경했습니다.');}return;
 }
 if(button.dataset.kidDelete!==undefined){if(!migrate())return;const code=program(),index=Number(button.dataset.kidDelete);if(index>=0&&index<code.length){code.splice(index,1);setProgram(code,{},'블록 하나를 지웠어요. 다시 추가할 수 있어요.');}return;}
 const command=button.dataset.kidCommand;
 if(command==='random'){replaceWithTemplate(templates[Math.floor(Math.random()*templates.length)],true);return;}
 if(command==='preview'){g.CharacterStudioWorkspace?.selectPreviewSkill?.('all');tell('왼쪽 미니 핀볼 실험장에서 벽 반사와 스킬을 확인해 보세요.');return;}
 if(command==='convert')migrate();
});
panel.addEventListener('change',event=>{
 const input=event.target.closest('[data-kid-edit]');
 if(input){
  if(!migrate())return;
  const code=program(),i=Number(input.dataset.kidEdit),key=input.dataset.kidKey;
  if(i<0||i>=code.length||code[i].kind!=='action')return;
  const action={...code[i].action};
  let val=input.value;
  if(key==='damage'||key==='radius')val=Number(val);
  if(key==='type'&&!forge.TYPE[val])return;
  action[key]=val;
  if(key==='type'&&['dash','blink','retreat','leap','portal','swap','hover','glide'].includes(val)){
   action.damage=0;action.status='none';action.knockback=0;
  }
  code[i]={...code[i],action:compiler.safeAction(action)};
  setProgram(code,{},'행동 설정을 변경했습니다.');return;
 }
 if(event.target.id!=='kid-skill-name')return;
 if(!migrate())return;
 S.applyFields({name:event.target.value.trim()||'나만의 필살기'},'필살기 이름을 바꿨어요!');
 tell('멋진 이름이에요! 이제 기술을 시험해 보세요.');
});
S.onChange=refresh;
refresh();chooseMode('easy');
g.ScratchBeginner={refresh,chooseMode,get mode(){return mode;}};
})(window);
