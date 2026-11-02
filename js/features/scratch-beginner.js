/* One visual signature skill editor. Every field is visible on its own action
 * card: no easy/expert tabs, collapsed workbenches, or second saved format.
 * Existing complex ASTs remain unchanged until the owner opts to simplify. */
(function(g){'use strict';
const doc=g.document,studio=doc?.querySelector('#character-studio-dialog .forge-studio');
const workspace=doc?.querySelector('#scratch-workbench'),forge=g.SkillForge;
const S=g.ScratchStudio,compiler=g.SignatureScratch,conds=g.SignatureProgram;
const builder=g.SignatureSimpleDesigner;
if(!studio||!workspace||!forge||!S||!compiler||!conds||!builder)return;
const escape=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actions=[
 {id:'slash',icon:'⚔️',name:'가까이 베기',tip:'가까운 적 공격',group:'attack',damage:31},
 {id:'wave',icon:'💥',name:'충격파',tip:'주변을 넓게 공격',group:'attack',damage:30},
 {id:'shot',icon:'✨',name:'구슬 발사',tip:'원거리 공격',group:'attack',damage:27},
 {id:'bolt',icon:'⚡',name:'번개 공격',tip:'적 위치에 낙뢰',group:'attack',damage:24},
 {id:'dash',icon:'💨',name:'빠르게 돌진',tip:'적에게 다가가기',group:'move',damage:0},
 {id:'blink',icon:'🌟',name:'순간이동',tip:'위치 바꾸기',group:'move',damage:0},
 {id:'retreat',icon:'↩️',name:'뒤로 피하기',tip:'거리 벌리기',group:'move',damage:0},
 {id:'shield',icon:'🛡️',name:'보호막',tip:'공격 막기',group:'defense',damage:0},
 {id:'heal',icon:'💚',name:'체력 회복',tip:'내 체력 회복',group:'defense',damage:22},
 {id:'zone',icon:'❄️',name:'얼음 장판',tip:'상대 움직임 제한',group:'special',damage:12,status:'ice'},
 {id:'timestop',icon:'🕰️',name:'시간 정지',tip:'상대의 이동을 잠시 정지',group:'special',damage:0},
 {id:'timeburst',icon:'⏩',name:'시간 가속',tip:'충돌 기세 충전 증가',group:'special',damage:0},
 {id:'rewind',icon:'⏪',name:'시간 되감기',tip:'이전 위치 복원',group:'special',damage:0},
 {id:'pull',icon:'🧲',name:'끌어당기기',tip:'공을 가까이 당기기',group:'special',damage:16},
 {id:'wall',icon:'🧱',name:'벽 세우기',tip:'반사 벽 설치',group:'special',damage:0},
 {id:'homing',icon:'🎯',name:'유도탄',tip:'상대를 따라가는 탄환',group:'attack',damage:17},
 {id:'splitshot',icon:'💎',name:'분열탄',tip:'탄환이 여러 개로 분열',group:'attack',damage:15}
].filter(a=>forge.TYPE[a.id]);
const templates=[
 {id:'brawler',icon:'⚔️',name:'돌진 연타',sequence:['dash','slash','wave']},
 {id:'sniper',icon:'🎯',name:'원거리 콤보',sequence:['shot','bolt','shot']},
 {id:'guardian',icon:'🛡️',name:'수호자',sequence:['shield','heal','wave']},
 {id:'frost',icon:'❄️',name:'빙결 콤보',sequence:['zone','bolt']},
 {id:'evasion',icon:'💫',name:'회피 반격',sequence:['blink','wave']},
 {id:'pinball',icon:'🎱',name:'벽 반사 공격',sequence:['dash','wave']},
 {id:'chrono',icon:'🕰️',name:'시간 연계',sequence:['timeburst','pull','wave']}
];
const TIMINGS={instant:'충전 즉시',contact:'다음 충돌',danger:'보스 공격 예고 시'};
const TARGETS={nearest:'가까운 적',lowest:'체력 적은 적',random:'무작위 적'};
const LINKS={after:'앞 행동 다음',with:'앞 행동과 동시',and:'함께 실행'};
const STATUSES={none:'없음',ice:'둔화',fire:'화상',poison:'중독'};
const makeStep=id=>{
 const a=actions.find(x=>x.id===id);
 return {action:compiler.safeAction({type:id,damage:a?.damage||0,radius:id==='wave'?130:120,
  speed:5,duration:id==='shield'?1.4:1.5,status:a?.status||'none',link:'after'}),condition:'always',repeat:1};
};
const panel=doc.createElement('section');
panel.id='scratch-beginner';panel.className='scratch-beginner';
panel.setAttribute('aria-label','단일 고유 스킬 설계');
panel.innerHTML='<div class="kid-top"><div><span class="kid-overline">ONE SKILL · ONE EDITOR</span><h3>나만의 전투 기술 설계</h3><p>행동을 누르고, 바로 아래 카드에서 조건·반복·연계·대상·수치를 변경하세요. 모든 조작은 한 화면에서 끝납니다.</p></div>'
 +'<strong class="kid-limit-pill">최대 4단계 · 실행 6회 · 위력 170</strong></div>'
 +'<div class="kid-legacy" hidden><strong>예전 4스킬 캐릭터입니다.</strong><p>기존 스킬은 그대로 보존됩니다. 원할 때만 하나의 필살기로 전환하세요.</p><button type="button" data-kid-command="convert">고유 스킬로 전환</button></div>'
 +'<div class="kid-easy-body">'
 +'<section class="kid-section kid-start-section"><div class="kid-step-heading"><span class="kid-step-no">1</span><div><h4>① 기세가 100이 되면</h4><p>기술의 발동 시점을 선택하세요.</p></div></div><div class="kid-trigger-options"></div></section>'
 +'<section class="kid-section kid-library-section"><div class="kid-step-heading"><span class="kid-step-no">2</span><div><h4>② 행동을 최대 4개 선택</h4><p>색깔 행동을 눌러 기술에 추가하세요.</p></div></div><div class="kid-action-grid"></div></section>'
 +'<section class="kid-section kid-plan-section"><div class="kid-step-heading"><span class="kid-step-no">3</span><div><h4>③ 순서와 연계 편집</h4><p>조건·반복·대상·위력까지 행동마다 바로 설정합니다.</p></div></div>'
 +'<label class="kid-name-label">내 필살기 이름<input id="kid-skill-name" type="text" maxlength="18" placeholder="예: 번개 돌진"></label>'
 +'<div class="kid-skill-summary"><div class="kid-plan"></div><div class="kid-count"></div></div>'
 +'<p class="kid-momentum-guide">⚡ 최대 4단계 · 한 행동당 반복 최대 2회 · 실제 실행 최대 6회 · 합계 위력 170 이하</p>'
 +'<button type="button" class="kid-preview-action" data-kid-command="preview">▶ 미니 핀볼 실험장에서 동작 확인</button></section>'
 +'<section class="kid-templates"><div class="kid-templates-heading"><h4>추천 조합에서 시작하기</h4><p>예시를 선택해도 이 화면에서 모든 항목을 수정할 수 있습니다.</p></div>'
 +'<div class="kid-template-grid"></div><button type="button" class="kid-random" data-kid-command="random">🎲 무작위 기술 조합</button></section>'
 +'</div><div class="kid-feedback" role="status" aria-live="polite">행동을 선택하면 카드가 생깁니다. 바로 수정해 보세요.</div>';
const work=studio.querySelector('#studio-panel-skills');work.insertBefore(panel,workspace);
studio.classList.add('scratch-friendly-mode');
const $=sel=>panel.querySelector(sel),get=()=>forge.getDraft();
const nav=studio.querySelector('.scratch-main-nav');
const codeTab=nav?.querySelector('[data-scratch-tab="code"]');
const looksTab=nav?.querySelector('[data-scratch-tab="looks"]');
if(codeTab)codeTab.textContent='✏️ 스킬 만들기';
if(looksTab)looksTab.textContent='🎨 외형 꾸미기';
function tell(message){$('.kid-feedback').textContent=message;}
function safeConfirm(q){return typeof g.confirm!=='function'||g.confirm(q);}
function migrate(){
 const old=get();if(old.signatureVersion===1)return true;
 if(!safeConfirm('기존 4개 스킬을 하나로 바꿀까요? 원본 스킬은 백업됩니다.'))return false;
 forge.setDraft(conds.migrate(old));S.render();return true;
}
function program(){return S.getProgram();}
function stepsOrWarn(){
 const steps=builder.read(program());
 if(!steps)tell('기존 복합 스킬이 있습니다. 저장된 코드는 유지됩니다. 확인 후 4단계로 정리할 수 있습니다.');
 return steps;
}
function applySteps(steps,message){
 try{
  S.applyProgram(builder.build(steps),{},message);
  tell(message);
  g.CharacterStudioWorkspace?.selectPreviewSkill?.('all');
  return true;
 }catch(err){tell(err.message);return false;}
}
function selectOptions(values,selected){
 return Object.entries(values).map(([v,label])=>'<option value="'+escape(v)+'"'+(String(v)===String(selected)?' selected':'')+'>'+escape(label)+'</option>').join('');
}
function stepCard(step,index,total){
 const a=step.action,kind=actions.find(x=>x.id===a.type);
 const repeatAllowed=total.reduce((sum,s,i)=>sum+(i===index?2:s.repeat),0)<=builder.MAX_ACTIONS;
 const reps={1:'한 번 실행',...(repeatAllowed||step.repeat===2?{2:'두 번 반복'}:{})};
 const field=(label,key,html)=>'<label>'+label+html.replace(' data-key=',' data-kid-edit="'+index+'" data-kid-key="'+key+'" ')+'</label>';
 const select=(label,key,vals,current)=>field(label,key,'<select data-key=>'+selectOptions(vals,current)+'</select>');
 const number=(label,key,value,max,min=0,step=1)=>field(label,key,
  '<input type="number" inputmode="numeric" min="'+min+'" max="'+max+'" step="'+step+'" data-key= value="'+Math.min(max,Math.max(min,Number(value)||0))+'">');
 return '<article class="kid-step-card" aria-label="'+(index+1)+'번 행동">'
  +'<header class="kid-step-card-head"><strong><span class="kid-step-index">'+(index+1)+'</span> '+(kind?.icon||'✨')+' '+escape(kind?.name||forge.TYPE[a.type]||a.type)+'</strong>'
  +'<span class="kid-item-controls"><button type="button" data-kid-move="'+index+'" data-kid-dir="-1" '+(index===0?'disabled':'')+' aria-label="위로 이동">↑</button>'
  +'<button type="button" data-kid-move="'+index+'" data-kid-dir="1" '+(index===total.length-1?'disabled':'')+' aria-label="아래로 이동">↓</button>'
  +'<button type="button" data-kid-delete="'+index+'" aria-label="삭제">×</button></span></header>'
  +'<div class="kid-action-fields">'
  +select('행동','type',Object.fromEntries(actions.map(v=>[v.id,v.name])),a.type)
  +select('실행 조건','condition',builder.CONDITIONS,step.condition)
  +select('반복','repeat',reps,step.repeat)
  +select('연계','link',LINKS,a.link||'after')
  +select('대상','target',TARGETS,a.target||'nearest')
  +select('상태이상','status',STATUSES,a.status||'none')
  +number('위력 (0~65)','damage',a.damage,65)
  +number('범위 (30~240)','radius',a.radius,240,30,5)
  +'</div></article>';
}
function refresh(){
 const draft=get(),legacy=draft.signatureVersion!==1;
 $('.kid-legacy').hidden=!legacy;$('.kid-easy-body').hidden=legacy;
 if(legacy)return;
 $('.kid-trigger-options').innerHTML=Object.entries(TIMINGS).map(([id,label])=>
  '<button type="button" class="kid-timing" data-kid-timing="'+id+'" aria-pressed="'+String((draft.signatureTiming||'instant')===id)+'">'+escape(label)+'</button>').join('')
  +'<p class="kid-timing-help">최대 약 2.3초 대기 후 자동으로 발동합니다.</p>';
 $('.kid-action-grid').innerHTML=actions.map(a=>
  '<button type="button" class="kid-action kid-action-'+a.group+'" data-kid-add="'+a.id+'" title="'+escape(a.tip)+'"><span class="kid-action-icon" aria-hidden="true">'+a.icon+'</span><strong>'+a.name+'</strong><small>'+a.tip+'</small><span class="kid-action-plus" aria-hidden="true">＋</span></button>').join('');
 $('#kid-skill-name').value=draft.skills[0].name;
 const steps=builder.read(program());
 if(!steps){
  $('.kid-plan').innerHTML='<div class="kid-existing-program"><strong>예전에 만든 복합 코딩이 있습니다.</strong><p>중첩 조건·복잡한 반복·기다리기 블록은 자동으로 삭제하지 않습니다. 확인하고 간단한 설계로 정리할 수 있습니다.</p><button type="button" data-kid-command="simplify">4단계 설계로 정리</button></div>';
  $('.kid-count').textContent='기존 프로그램 유지 · 변경하려면 확인이 필요합니다';
 }else{
  $('.kid-plan').innerHTML=steps.length?steps.map((s,i)=>stepCard(s,i,steps)).join(''):
   '<div class="kid-empty">색깔 행동을 눌러 기술에 추가하세요.</div>';
  const state=builder.inspect(steps);
  $('.kid-count').textContent=steps.length+'/4단계 · 실행 '+state.count+'/6회 · 위력 '+state.power+'/170'+(state.ok?'':' · 기존 초안은 한도 밖입니다');
 }
}
$('.kid-template-grid').innerHTML=templates.filter(t=>t.sequence.every(id=>forge.TYPE[id])).map(t=>
 '<button type="button" class="kid-template" data-kid-template="'+t.id+'"><span aria-hidden="true">'+t.icon+'</span><strong>'+t.name+'</strong></button>').join('');
function preset(t,random=false){
 if(!t||!migrate())return;
 if(program().length>1&&!safeConfirm('작성 중인 기술을 새 예시로 바꿀까요? 저장 전에는 기존 캐릭터가 유지됩니다.'))return;
 const types=random?[...t.sequence].sort(()=>Math.random()-.5):t.sequence;
 const steps=types.slice(0,4).map(makeStep);
 if(applySteps(steps,'예시 기술을 만들었습니다. 모든 설정을 아래에서 바로 수정할 수 있어요.'))
  S.applyFields({name:random?'깜짝 필살기':t.name},'이름을 설정했습니다.');
}
panel.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 const timing=button.dataset.kidTiming;
 if(timing){
  if(!TIMINGS[timing]||!migrate())return;
  forge.setDraft({...get(),signatureTiming:timing});S.render();tell('발동 시점을 설정했습니다.');return;
 }
 const add=button.dataset.kidAdd;
 if(add){
  if(!migrate())return;const steps=stepsOrWarn();if(!steps)return;
  if(steps.length>=builder.MAX_STEPS){tell('최대 4개 행동을 연결할 수 있습니다.');return;}
  applySteps([...steps,makeStep(add)],'행동을 추가했습니다.');return;
 }
 if(button.dataset.kidTemplate){preset(templates.find(t=>t.id===button.dataset.kidTemplate));return;}
 const dir=button.dataset.kidDir;
 if(button.dataset.kidMove!==undefined){
  if(!migrate())return;const steps=stepsOrWarn();if(!steps)return;
  const from=Number(button.dataset.kidMove),to=from+Number(dir);
  if(to>=0&&to<steps.length){[steps[from],steps[to]]=[steps[to],steps[from]];applySteps(steps,'순서를 바꿨습니다.');}return;
 }
 if(button.dataset.kidDelete!==undefined){
  if(!migrate())return;const steps=stepsOrWarn();if(!steps)return;
  const i=Number(button.dataset.kidDelete);if(i>=0&&i<steps.length){steps.splice(i,1);applySteps(steps,'행동을 삭제했습니다.');}return;
 }
 const command=button.dataset.kidCommand;
 if(command==='random')preset(templates[Math.floor(Math.random()*templates.length)],true);
 if(command==='preview'){g.CharacterStudioWorkspace?.selectPreviewSkill?.('all');tell('미니 핀볼 실험장에서 기술의 움직임을 확인하세요.');}
 if(command==='convert')migrate();
 if(command==='simplify'){
  if(!safeConfirm('기존 복합 코딩을 4단계 기본 설계로 정리할까요? 현재 저장된 캐릭터는 다시 저장하기 전까지 유지됩니다.'))return;
  applySteps(builder.flatten(program()),'4단계 설계로 정리했습니다.');
 }
});
panel.addEventListener('change',event=>{
 const input=event.target.closest('[data-kid-edit]');
 if(input){
  if(!migrate())return;const steps=stepsOrWarn();if(!steps)return;
  const i=Number(input.dataset.kidEdit),key=input.dataset.kidKey;
  if(i<0||i>=steps.length)return;
  const value=input.value,a={...steps[i].action};
  if(key==='condition'){if(!builder.CONDITIONS[value])return;steps[i].condition=value;}
  else if(key==='repeat')steps[i].repeat=Number(value);
  else{
   if(key==='type'&&!actions.some(v=>v.id===value))return;
   a[key]=key==='damage'?Math.max(0,Math.min(65,Number(value)||0)):
      key==='radius'?Math.max(30,Math.min(240,Number(value)||120)):value;
   if(key==='type'&&['dash','blink','retreat'].includes(value)){
    a.damage=0;a.status='none';a.knockback=0;
   }
   steps[i].action=compiler.safeAction(a);
  }
  if(!applySteps(steps,'설정을 변경했습니다.'))refresh();
  return;
 }
 if(event.target.id==='kid-skill-name'){
  if(!migrate())return;
  S.applyFields({name:event.target.value.trim()||'나만의 필살기'},'이름을 바꿨습니다.');
  tell('이름을 변경했습니다.');
 }
});
S.onChange=refresh;
refresh();
g.ScratchBeginner={refresh,get mode(){return 'single';}};
})(window);
