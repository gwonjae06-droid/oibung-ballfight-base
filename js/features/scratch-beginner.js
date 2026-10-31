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
 {id:'zone',icon:'❄️',name:'얼음 장판',tip:'적의 움직임을 느리게 해요',group:'special',damage:12,status:'ice'}
].filter(a=>forge.TYPE[a.id]);
const starters=[
 {id:'auto',icon:'⚔️',name:'싸우는 동안',tip:'준비되면 자동으로 사용'},
 {id:'lowhp',icon:'❤️',name:'체력이 적을 때',tip:'위험할 때 기술 사용'},
 {id:'danger',icon:'🚨',name:'보스가 공격할 때',tip:'보스의 큰 공격을 보고 반응'},
 {id:'dodge',icon:'💨',name:'보스 공격을 피한 뒤',tip:'회피 성공 후 반격'}
];
const templates=[
 {id:'brawler',icon:'⚔️',name:'달려가서 공격!',desc:'돌진 → 베기 → 충격파',trigger:'auto',sequence:['dash','slash','wave']},
 {id:'sniper',icon:'🎯',name:'멀리서 연속 공격!',desc:'구슬 → 번개 → 구슬',trigger:'auto',sequence:['shot','bolt','shot']},
 {id:'guardian',icon:'🛡️',name:'위험할 때 보호!',desc:'보호막 → 회복 → 충격파',trigger:'lowhp',sequence:['shield','heal','wave']},
 {id:'frost',icon:'❄️',name:'얼려서 공격!',desc:'얼음 장판 → 번개',trigger:'auto',sequence:['zone','bolt']},
 {id:'evasion',icon:'💫',name:'피한 뒤 반격!',desc:'회피 성공 → 순간이동 → 공격',trigger:'dodge',sequence:['blink','wave']}
];
const nodeOf=(id)=>{const item=actions.find(a=>a.id===id);
 const d={type:id,damage:item?.damage??20,radius:id==='wave'?130:120,
  speed:5,duration:id==='shield'?1.4:1.5,status:item?.status||'none',link:'after'};
 return {kind:'action',action:compiler.safeAction(d)};
};
const panel=doc.createElement('section');panel.id='scratch-beginner';panel.className='scratch-beginner';
panel.setAttribute('aria-label','쉬운 고유 스킬 만들기');
panel.innerHTML='<div class="kid-top"><div><span class="kid-overline">MY SPECIAL MOVE</span><h3>내 필살기 만들기 ✨</h3><p>원하는 색깔 블록을 누르면 기술이 만들어져요. 순서대로 골라 보세요!</p></div><div class="kid-display" role="group" aria-label="코딩 화면 보기 선택"><button type="button" data-kid-view="easy" aria-pressed="true">😊 쉽게 만들기</button><button type="button" data-kid-view="advanced" aria-pressed="false">🧩 블록 자세히 보기</button></div></div>'
 +'<div class="kid-legacy" hidden><strong>이 캐릭터는 예전 스킬을 사용하고 있어요.</strong><p>기존 기술은 그대로 보관돼요. 새 필살기 방식으로 바꾸고 싶을 때만 선택하세요.</p><button type="button" data-kid-command="convert">한 가지 필살기로 바꾸기</button></div>'
 +'<div class="kid-easy-body">'
 +'<section class="kid-section" aria-labelledby="kid-step-one"><div class="kid-step-heading"><span class="kid-step-no">1</span><div><h4 id="kid-step-one">언제 기술을 쓸까?</h4><p>기술을 쓸 순간을 정해요.</p></div></div><div class="kid-trigger-options"></div></section>'
 +'<section class="kid-section" aria-labelledby="kid-step-two"><div class="kid-step-heading"><span class="kid-step-no">2</span><div><h4 id="kid-step-two">무엇을 할까?</h4><p>블록을 누르면 내 기술에 차례대로 추가돼요.</p></div></div><div class="kid-action-grid"></div></section>'
 +'<section class="kid-section kid-plan-section" aria-labelledby="kid-step-three"><div class="kid-step-heading"><span class="kid-step-no">3</span><div><h4 id="kid-step-three">완성한 기술 확인하기</h4><p>위에서 아래로 순서대로 실행돼요.</p></div></div>'
 +'<div class="kid-skill-summary"><div class="kid-plan"></div><div class="kid-count"></div></div>'
 +'<div class="kid-tempo"><strong>얼마나 자주 사용할까?</strong><div role="group" class="kid-tempo-options"><button type="button" data-kid-cooldown="3">⚡ 자주</button><button type="button" data-kid-cooldown="5">⚖️ 보통</button><button type="button" data-kid-cooldown="8">🌙 가끔</button></div></div>'
 +'<button type="button" class="kid-preview-action" data-kid-command="preview">▶ 내 기술 움직임 보기</button></section>'
 +'<section class="kid-templates" aria-labelledby="kid-templates-title"><div class="kid-templates-heading"><h4 id="kid-templates-title">무엇부터 만들지 모르겠나요?</h4><p>마음에 드는 예시를 누르면 블록이 자동으로 채워져요. 나중에 바꿀 수도 있어요.</p></div><div class="kid-template-grid"></div><button type="button" class="kid-random" data-kid-command="random">🎲 아무거나 재미있는 기술 만들기</button></section>'
 +'</div><div class="kid-feedback" role="status" aria-live="polite">① 기술을 쓸 순간을 고르고, ② 행동 블록을 눌러 보세요.</div>';
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
 if(code.length>=compiler.MAX_NODES){tell('블록이 너무 많아요. 몇 개를 빼고 다시 추가해 보세요.');return;}
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
  result+='<div class="kid-plan-item kid-plan-'+(n.kind==='action'?'action':'control')+'" style="--kid-indent:'+Math.min(depth,3)+'"><span aria-hidden="true">'+icon+'</span><span>'+escape(caption)+'</span>'
   +(depth===0?'<button type="button" data-kid-delete="'+i+'" aria-label="'+escape(caption)+' 블록 삭제">×</button>':'')+'</div>';
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
 $('.kid-trigger-options').innerHTML=starters.map(s=>
  '<button type="button" class="kid-trigger" data-kid-trigger="'+s.id+'" aria-pressed="'+(fighter.skills[0].trigger===s.id)+'"><span class="kid-trigger-icon" aria-hidden="true">'+s.icon+'</span><strong>'+s.name+'</strong><small>'+s.tip+'</small></button>').join('');
 $('.kid-action-grid').innerHTML=actions.map(a=>'<button type="button" class="kid-action kid-action-'+a.group+'" data-kid-add="'+a.id+'" title="'+escape(a.tip)+'">'
   +'<span class="kid-action-icon" aria-hidden="true">'+a.icon+'</span><strong>'+a.name+'</strong><small>'+a.tip+'</small><span class="kid-action-plus" aria-hidden="true">＋</span></button>').join('');
 const code=program();$('.kid-plan').innerHTML=code.length?displayPlan(code):'<div class="kid-empty">아직 블록이 없어요. 왼쪽(또는 위)의 색깔 블록을 눌러 주세요!</div>';
 $('.kid-count').textContent='현재 '+code.length+'개 블록 · 기술당 최대 '+compiler.LIMIT+'회 행동';
 const cooldown=fighter.skills[0].cooldown;
 for(const button of panel.querySelectorAll('[data-kid-cooldown]'))
  button.setAttribute('aria-pressed',String(Math.abs(Number(button.dataset.kidCooldown)-cooldown)<1.3));
}
$('.kid-template-grid').innerHTML=templates.filter(t=>t.sequence.every(id=>forge.TYPE[id]))
 .map(t=>'<button type="button" class="kid-template" data-kid-template="'+t.id+'"><span aria-hidden="true">'+t.icon+'</span><strong>'+t.name+'</strong><small>'+t.desc+'</small></button>').join('');
function replaceWithTemplate(t,random=false){
 if(!t||!migrate())return;
 if(program().length>1&&!safeConfirm('현재 만든 블록을 새 예시로 바꿀까요? 이전 내용은 되돌릴 수 있어요.'))return;
 const sequence=random?[...t.sequence].sort(()=>Math.random()-.5):t.sequence;
 const code=sequence.map(nodeOf);
 const name=random?'깜짝 필살기':t.name.replace(/[!]/g,'');
 setProgram(code,{trigger:t.trigger,name,cooldown:5},'짜잔! '+name+'를 만들었어요. 블록을 더 눌러 바꿀 수도 있어요.');
 g.CharacterStudioWorkspace?.selectPreviewSkill?.('all');
}
function chooseMode(next){
 mode=next==='advanced'?'advanced':'easy';
 studio.classList.toggle('scratch-friendly-advanced',mode==='advanced');
 for(const b of panel.querySelectorAll('[data-kid-view]'))b.setAttribute('aria-pressed',String(b.dataset.kidView===mode));
 if(mode==='advanced')S.render();
 tell(mode==='advanced'?'블록을 옮기고, 만약·반복 같은 코딩도 해보세요.':'색깔 블록을 눌러 기술을 만들어 보세요!');
}
panel.addEventListener('click',e=>{
 const button=e.target.closest('button');if(!button)return;
 const trigger=button.dataset.kidTrigger,addId=button.dataset.kidAdd,templateId=button.dataset.kidTemplate;
 if(button.dataset.kidView){chooseMode(button.dataset.kidView);return;}
 if(trigger){changeFields({trigger});return;}
 if(addId){add(addId);return;}
 if(button.dataset.kidCooldown){changeFields({cooldown:Number(button.dataset.kidCooldown)});tell('기술을 사용하는 빠르기를 바꿨어요.');return;}
 if(templateId){replaceWithTemplate(templates.find(t=>t.id===templateId));return;}
 if(button.dataset.kidDelete!==undefined){if(!migrate())return;const code=program(),index=Number(button.dataset.kidDelete);if(index>=0&&index<code.length){code.splice(index,1);setProgram(code,{},'블록 하나를 지웠어요. 다시 추가할 수 있어요.');}return;}
 const command=button.dataset.kidCommand;
 if(command==='random'){replaceWithTemplate(templates[Math.floor(Math.random()*templates.length)],true);return;}
 if(command==='preview'){g.CharacterStudioWorkspace?.selectPreviewSkill?.('all');tell('왼쪽의 훈련 미리보기를 확인해 보세요.');return;}
 if(command==='convert')migrate();
});
S.onChange=refresh;
refresh();chooseMode('easy');
g.ScratchBeginner={refresh,chooseMode,get mode(){return mode;}};
})(window);
