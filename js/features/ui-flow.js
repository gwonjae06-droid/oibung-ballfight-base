/* Clarity-first information architecture. Presentation only: never changes
 * combat state, fighter saves, balances, cooldowns, or live matches. */
(function(global){
'use strict';
function phase(state){
  switch(state){
    case 'playing':
      return {active:'battle',past:['setup'],
        label:'전투 진행 중 · 마지막 생존자를 확인하세요.',
        action:'전투 화면 보기',intent:'arena'};
    case 'paused':
      return {active:'battle',past:['setup'],
        label:'경기가 일시정지됐습니다. 계속하려면 경기 계속을 누르세요.',
        action:'경기 계속',intent:'resume'};
    case 'finished':
      return {active:'result',past:['setup','battle'],
        label:'경기가 끝났습니다. 결과를 확인한 뒤 새 대진을 준비하세요.',
        action:'다음 경기 준비',intent:'next'};
    default:
      return {active:'setup',past:[],
        label:'지금 할 일 · 출전할 캐릭터를 선택하세요.',
        action:'대진 설정으로 이동',intent:'match'};
  }
}
let instance=null;
function install(){
  if(instance)return instance;
  const doc=global.document;
  if(!doc)return null;
  const root=doc.getElementById('arena-purpose');
  const next=doc.getElementById('arena-next-label');
  const cta=doc.getElementById('arena-next-action');
  const start=doc.getElementById('btn-start');
  const arena=doc.getElementById('arena-stage')||doc.querySelector('.battle-screen');
  const panel=doc.getElementById('match-setup');
  const nav=doc.getElementById('arena-category-nav');
  if(!root||!next||!cta||!start||!arena||!panel||!nav)return null;

  const steps=Array.from(root.querySelectorAll('[data-ui-step]'));
  // Move the ONE existing controls node; all inline handlers and engine
  // references survive because buttons are not cloned or rebuilt.
  const controls=arena.querySelector('.control-panel');
  const picks=panel.querySelector('#bf-picks');
  if(controls&&picks){
    controls.classList.add('arena-setup-controls');
    controls.setAttribute('aria-label','경기 시작 · 재매칭 · 참가 인원');
    picks.after(controls);
  }
  const heading=panel.querySelector('.panel-heading');
  if(heading&&!panel.querySelector('.arena-setup-tip')){
    const eyebrow=heading.querySelector('.eyebrow');
    if(eyebrow)eyebrow.textContent='STEP 01 / 대진 구성';
    const title=heading.querySelector('h2');
    if(title)title.textContent='출전 파이터 선택';
    const info=doc.createElement('p');
    info.className='arena-setup-tip';
    info.textContent='P1부터 원하는 캐릭터를 고르세요. 선택하면 대진에 바로 반영됩니다.';
    heading.append(info);
  }
  const fold=doc.querySelector('.bf-fold');
  if(fold){
    const summary=fold.querySelector('summary span');
    if(summary)summary.textContent='선택 활동 · 우승 예측 / 아이템 상점';
  }

  // A guide that leaves the creator's original buttons and event handlers in
  // place, instead of rebuilding the fragile studio forms.
  const studio=doc.querySelector('#character-studio-dialog .forge-studio');
  if(studio&&!doc.getElementById('studio-clarity-steps')){
    const guide=doc.createElement('div');
    guide.className='studio-clarity-steps';
    guide.id='studio-clarity-steps';
    guide.setAttribute('aria-label','캐릭터 제작 방법');
    guide.innerHTML='<span><b>01</b> 이름 설정</span>'
      +'<span><b>02</b> 블록 조합 · 미리보기</span>'
      +'<span><b>03</b> 저장 및 출전</span>';
    studio.prepend(guide);
    const save=studio.querySelector('.forge-primary-actions');
    if(save){
      const hint=doc.createElement('p');
      hint.className='studio-save-purpose';
      hint.textContent='마지막 단계 · 저장하면 내 캐릭터 목록에 추가되고 P1에 적용됩니다.';
      save.before(hint);
      const create=save.querySelector('#bf-create');
      if(create)create.textContent='캐릭터 저장하고 대진에 적용';
    }
  }

  const ranking=doc.getElementById('community-power-ranking');
  if(ranking){
    const list=ranking.querySelector('#power-ranking-list');
    if(list&&!ranking.querySelector('#power-ranking-expand')){
      const expand=doc.createElement('button');
      expand.id='power-ranking-expand';
      expand.type='button';
      expand.className='power-ranking-expand';
      expand.setAttribute('aria-expanded','false');
      expand.setAttribute('aria-controls','power-ranking-list');
      expand.textContent='전체 TOP 10 보기';
      list.after(expand);
      list.classList.add('power-ranking-collapsed');
      function syncRanking(){
        const available=list.children.length>3;
        expand.hidden=!available;
        if(!available){list.classList.add('power-ranking-collapsed');expand.setAttribute('aria-expanded','false');expand.textContent='전체 TOP 10 보기';}
      }
      expand.addEventListener('click',()=>{
        const collapsed=list.classList.toggle('power-ranking-collapsed');
        expand.setAttribute('aria-expanded',String(!collapsed));
        expand.textContent=collapsed?'전체 TOP 10 보기':'상위 3명만 보기';
      });
      syncRanking();
      if(global.MutationObserver){
        new global.MutationObserver(syncRanking).observe(list,{childList:true});
      }
    }
  }

  function sync(){
    const current=phase(start.dataset.state);
    root.dataset.uiPhase=current.active;
    next.textContent=current.label;
    cta.textContent=current.action;
    cta.dataset.intent=current.intent;
    for(const step of steps){
      const id=step.dataset.uiStep;
      step.classList.toggle('is-current',id===current.active);
      step.classList.toggle('is-complete',current.past.includes(id));
      if(id===current.active)step.setAttribute('aria-current','step');
      else step.removeAttribute('aria-current');
    }
    return current;
  }
  function act(){
    const intent=cta.dataset.intent;
    if(intent==='next'||intent==='resume'){
      start.click();
      sync();
    }else{
      const target=intent==='arena'?arena:panel;
      target.scrollIntoView?.({block:'start',behavior:'smooth'});
    }
  }
  cta.addEventListener('click',act);
  start.addEventListener('click',()=>global.requestAnimationFrame?.(sync));
  doc.getElementById('btn-stop')?.addEventListener('click',()=>global.requestAnimationFrame?.(sync));
  if(global.MutationObserver){
    new global.MutationObserver(sync).observe(start,{attributes:true,attributeFilter:['data-state']});
  }
  const more=nav.querySelector('.arena-nav-more');
  more?.addEventListener('click',e=>{
    if(e.target.closest('a[data-category]'))more.open=false;
  });
  sync();
  instance={sync,phase,act};
  return instance;
}
global.ArenaUIFlow={phase,install};
if(typeof document!=='undefined')install();
})(window);
