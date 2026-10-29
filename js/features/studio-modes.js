/* Separate the custom studio's random-four generator and detailed block editor.
 * Reuse the original forge draft, preview canvas, save button and roster. */
(function(global){
'use strict';
const dialog=document.getElementById('character-studio-dialog');
const studio=dialog?.querySelector('.forge-studio');
const shell=dialog?.querySelector('.character-studio-shell');
const skills=studio?.querySelector('#studio-panel-skills');
const looks=studio?.querySelector('#studio-panel-appearance');
const workspace=global.CharacterStudioWorkspace;
const forge=global.SkillForge;
if(!dialog||!studio||!shell||!skills||!looks||!workspace||!forge)return;

const name=studio.querySelector('.forge-name');
const create=studio.querySelector('.forge-primary-actions');
const manager=studio.querySelector('.studio-roster-manager');
const saved=studio.querySelector('.forge-saved');
const preview=shell.querySelector('.studio-motion-preview');
const tabs=studio.querySelector('.studio-category-tabs');
const randomEntry=skills.querySelector('.forge-random-entry');
const blocks=skills.querySelector('.block-forge');
const tuning=skills.querySelector('.forge-tuning');
const library=skills.querySelector('.forge-library');
const helper=studio.querySelector('#studio-clarity-steps');
const saveHint=studio.querySelector('.studio-save-purpose');
const other=Array.from(skills.children).filter(n=>![randomEntry,blocks,tuning,library].includes(n));

const picker=document.createElement('section');
picker.id='studio-mode-picker';
picker.className='studio-mode-picker';
picker.setAttribute('aria-label','캐릭터 스킬 제작 방법 선택');
picker.innerHTML='<div class="studio-mode-intro"><span class="eyebrow">SKILL WORKSHOP</span><h3>어떤 방식으로 스킬을 만들까요?</h3><p>무작위로 네 가지 스킬을 뽑거나, 블록을 직접 연결해 나만의 기술을 설계하세요.</p></div>'
  +'<div class="studio-mode-choices">'
  +'<button type="button" data-studio-open="random" class="studio-mode-choice"><span class="studio-mode-icon" aria-hidden="true">🎲</span><strong>랜덤 생성기</strong><small>전체 동작을 섞어 스킬 4개 자동 생성<br>언제든 다시 뽑기 · 왼쪽 동작 시연</small><span class="studio-mode-cta">랜덤 스킬 만들기</span></button>'
  +'<button type="button" data-studio-open="compose" class="studio-mode-choice"><span class="studio-mode-icon" aria-hidden="true">⚡</span><strong>스킬 조합하기</strong><small>블록과 발동 조건을 직접 편집<br>연속 동작 · 세부 수치 · 왼쪽 실시간 미리보기</small><span class="studio-mode-cta">직접 조합하기</span></button></div>';

const randomView=document.createElement('section');
randomView.id='studio-mode-random';
randomView.className='studio-mode-screen studio-random-screen';
randomView.hidden=true;
randomView.innerHTML='<div class="studio-mode-toolbar"><button type="button" data-studio-back>← 제작 방법 선택</button><span>RANDOM GENERATOR</span></div>'
  +'<h3>완전 랜덤 · 스킬 4개</h3><p class="studio-mode-description">전체 동작에서 무작위 스킬 4개를 생성합니다. 왼쪽에서 자동으로 시연하며, 원하는 만큼 다시 뽑을 수 있습니다.</p>'
  +'<button type="button" id="studio-roll-four" class="studio-roll-four">🎲 네 가지 스킬 다시 생성</button>'
  +'<div id="studio-roll-status" class="studio-roll-status" role="status" aria-live="polite"></div>'
  +'<div id="studio-random-results" class="studio-random-results" aria-label="생성한 네 가지 스킬"></div>'
  +'<button type="button" class="studio-switch-to-compose" data-studio-open="compose">이 조합을 직접 수정하기</button>';
// Retain legacy handlers and import/share integrations without showing duplicate random controls.
if(randomEntry){randomEntry.hidden=true;randomView.append(randomEntry);}

const composeView=document.createElement('section');
composeView.id='studio-mode-compose';
composeView.className='studio-mode-screen studio-compose-screen';
composeView.hidden=true;
const bar=document.createElement('div');
bar.className='studio-mode-toolbar';
bar.innerHTML='<button type="button" data-studio-back>← 제작 방법 선택</button><span>BLOCK SKILL EDITOR</span>';
const heading=document.createElement('div');
heading.className='studio-compose-heading';
heading.innerHTML='<h3>스킬 조합하기</h3><p>오른쪽에서 기술을 만들고, 왼쪽에서 실제 동작과 연계를 확인하세요.</p>';
composeView.append(bar,heading);
[blocks,tuning,library,...other].filter(Boolean).forEach(node=>composeView.append(node));
skills.replaceChildren(picker,randomView,composeView);

const baseSelect=workspace.selectTab.bind(workspace);
const basePreview=workspace.previewSkill.bind(workspace);
let mode='choose',hasRolled=false;
const results=randomView.querySelector('#studio-random-results');
const rollStatus=randomView.querySelector('#studio-roll-status');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actionName=a=>forge.TYPE[a.type]||a.type||'동작';

function showMode(next,{keepTab=false}={}){
  mode=['random','compose','appearance'].includes(next)?next:'choose';
  const appearance=mode==='appearance';
  if(!keepTab)baseSelect(appearance?'appearance':'skills');
  shell.dataset.studioMode=mode;
  studio.dataset.studioMode=mode;
  picker.hidden=mode!=='choose';
  randomView.hidden=mode!=='random';
  composeView.hidden=mode!=='compose';
  name.hidden=mode==='choose';
  create.hidden=mode==='choose';
  saved.hidden=mode==='choose';
  if(helper)helper.hidden=mode!=='compose';
  if(saveHint)saveHint.hidden=mode==='choose';
  // One original motion renderer, only mounted for the two skill workspaces.
  preview.hidden=mode==='choose'||appearance;
  workspace.setPreviewVisible?.(!preview.hidden);
  if(mode==='random'){
    if(!hasRolled)rollFour();
    else workspace.selectPreviewSkill?.('all');
  }else if(mode==='compose')workspace.selectPreviewSkill?.(0);
  else if(mode==='choose')picker.querySelector('[data-studio-open]')?.focus?.({preventScroll:true});
}
function renderResults(profile){
  results.replaceChildren();
  const heading=document.createElement('p');
  heading.className='studio-result-heading';
  heading.textContent='생성된 스킬 '+profile.skills.length+'개 · 스킬을 누르면 왼쪽에서 해당 동작을 시연합니다.';
  results.append(heading);
  profile.skills.forEach((s,i)=>{
    const card=document.createElement('button');
    card.type='button';
    card.className='studio-random-skill';
    card.dataset.previewSkill=String(i);
    card.setAttribute('aria-pressed','false');
    const title=document.createElement('strong');
    title.textContent=String(i+1).padStart(2,'0')+' · '+s.name;
    const desc=document.createElement('span');
    desc.textContent=s.actions.map(actionName).join(' → ');
    const meta=document.createElement('small');
    meta.textContent=(forge.TRIGGER[s.trigger]||'자동')+' · 쿨타임 '+s.cooldown+'초';
    card.append(title,desc,meta);
    results.append(card);
  });
}
function selectRandomPreview(index){
  workspace.selectPreviewSkill?.(index);
  results.querySelectorAll('[data-preview-skill]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.previewSkill===String(index)));
  });
}
function rollFour(){
  // Explicit four-skill mode; keep normal randomProfile callers backwards compatible.
  const rolled=forge.randomProfile('any',Math.random,4);
  const previous=forge.getDraft();
  const value=id=>document.getElementById(id)?.value;
  const next={...previous,allAbilities:false,skills:rolled.skills,
    name:value('bf-name')||previous.name,
    blurb:value('bf-text')??previous.blurb,
    color:value('forge-color')||previous.color,
    effectColor:value('forge-effect-color')||previous.effectColor,
    hp:Number(value('forge-hp'))||previous.hp,
    speed:Number(value('forge-speed'))||previous.speed};
  forge.setDraft(next); // draft only: never register, persist, or start a match
  hasRolled=true;
  renderResults(forge.getDraft());
  workspace.refresh?.();
  selectRandomPreview('all');
  rollStatus.textContent='스킬 4개 생성 완료 · 저장 전 초안입니다. 다시 생성하면 현재 스킬 4개가 교체됩니다.';
  return forge.getDraft();
}

picker.addEventListener('click',e=>{
  const target=e.target.closest('[data-studio-open]');
  if(target)showMode(target.dataset.studioOpen);
});
for(const view of [randomView,composeView]){
  view.addEventListener('click',e=>{
    if(e.target.closest('[data-studio-back]'))showMode('choose');
    const target=e.target.closest('[data-studio-open]');
    if(target)showMode(target.dataset.studioOpen);
  });
}
randomView.querySelector('#studio-roll-four').addEventListener('click',rollFour);
results.addEventListener('click',e=>{
  const button=e.target.closest('[data-preview-skill]');
  if(button)selectRandomPreview(button.dataset.previewSkill);
});
preview.querySelector('#studio-motion-select')?.addEventListener('change',e=>{
  if(mode==='random')selectRandomPreview(e.target.value);
});
// The global router and existing block inspector still speak the old workspace API.
workspace.selectTab=(tab,focus=false)=>{
  baseSelect(tab,focus);
  showMode(tab==='appearance'?'appearance':'choose',{keepTab:true});
};
workspace.previewSkill=(si,index)=>{
  if(mode!=='compose')showMode('compose');
  return basePreview(si,index);
};
tabs?.addEventListener('click',()=>{
  showMode(looks.hidden?'choose':'appearance',{keepTab:true});
});
tabs?.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key))
    showMode(looks.hidden?'choose':'appearance',{keepTab:true});
});
global.addEventListener?.('studio:open',()=>{
  // The screen router selects the appropriate tab before dispatching this event.
  if(!looks.hidden)showMode('appearance',{keepTab:true});
  else showMode('choose',{keepTab:true});
});
global.addEventListener?.('studio:close',()=>showMode('choose'));
showMode('choose',{keepTab:true});
global.CharacterStudioModes={
  select:showMode,rollFour,get mode(){return mode;},get hasRolled(){return hasRolled;}
};
})(window);
