/* Onboarding poster appears once for each browser profile using this site.
 * The guide can always be reopened from the navigation. */
(function(global){
'use strict';
const KEY='oibung-first-visit-guide-v1';
function storage(){try{return global.localStorage;}catch(_){return null;}}
function seen(storage){
  try{return storage?.getItem(KEY)==='seen';}catch(_){return false;}
}
function markSeen(storage){
  try{storage?.setItem(KEY,'seen');return true;}catch(_){return false;}
}
function install(){
  const doc=global.document,nav=doc?.getElementById('arena-category-nav');
  if(!doc||!nav||doc.getElementById('arena-welcome-guide'))return null;
  const trigger=doc.createElement('button');
  trigger.type='button';
  trigger.className='arena-guide-reopen';
  trigger.textContent='? 이용 안내';
  trigger.setAttribute('aria-label','처음 방문 안내 이미지 다시 보기');
  nav.appendChild(trigger);
  const dialog=doc.createElement('dialog');
  dialog.id='arena-welcome-guide';
  dialog.className='arena-welcome-guide';
  dialog.setAttribute('aria-labelledby','arena-welcome-title');
  dialog.setAttribute('aria-describedby','arena-welcome-description');
  dialog.innerHTML='<div class="arena-welcome-frame">'
    +'<h2 id="arena-welcome-title" class="sr-only">오이붕 아레나 처음 방문 안내</h2>'
    +'<p id="arena-welcome-description" class="sr-only">커스텀 캐릭터는 상단 커스텀 캐릭터 만들기에서 제작합니다. GitHub 공유하기는 캐릭터 저장 후 공유 캐릭터 둘러보기 메뉴에서 눌러 공개글을 등록할 수 있습니다. 가챠는 전투력을 올리는 기능이 아니라 테두리, 스킬 색상, 공격 궤적, 등장 연출 등 꾸미기를 모으는 기능입니다.</p>'
    +'<img class="arena-welcome-poster" src="assets/welcome-guide.webp" alt="처음 오셨나요? 1. 상단 커스텀 캐릭터 만들기에서 캐릭터 제작하기. 2. 저장한 뒤 공유 캐릭터 둘러보기에서 GitHub 공유하기를 눌러 공개하기. 3. 가챠로 테두리, 스킬 색상, 공격 궤적, 등장 연출 꾸미기 아이템 모으기." decoding="async">'
    +'<div class="arena-welcome-fallback" hidden><strong>처음 오셨나요?</strong><p>① 커스텀 캐릭터 만들기에서 나만의 캐릭터를 제작하세요.</p><p>② 저장 후 공유 캐릭터 둘러보기에서 GitHub에 공유하세요.</p><p>③ 가챠는 전투력 강화가 아닌 꾸미기 요소를 수집하는 기능입니다.</p></div>'
    +'<div class="arena-welcome-actions"><span>이 안내는 이 브라우저의 첫 방문에만 자동 표시됩니다.</span><button id="arena-welcome-confirm" type="button">확인 · 게임 시작</button></div></div>';
  doc.body.appendChild(dialog);
  const poster=dialog.querySelector('img');
  const fallback=dialog.querySelector('.arena-welcome-fallback');
  poster.addEventListener('error',()=>{poster.hidden=true;fallback.hidden=false;});
  function open(){
    if(dialog.open)return;
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
    doc.body.classList.add('arena-welcome-open');
  }
  function close(){
    // Persist only after dismissing the tutorial, not merely while loading it.
    markSeen(storage());
    if(typeof dialog.close==='function')dialog.close();
    else dialog.removeAttribute('open');
    doc.body.classList.remove('arena-welcome-open');
    trigger.focus?.();
  }
  dialog.querySelector('#arena-welcome-confirm').addEventListener('click',close);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('close',()=>doc.body.classList.remove('arena-welcome-open'));
  // Native <dialog> focus/inert background is retained; no close-on-backdrop
  // because a first-time visitor should confirm the short tutorial.
  trigger.addEventListener('click',open);
  if(!seen(storage()))open();
  global.ArenaWelcome={open,close,KEY};
  return dialog;
}
global.ArenaWelcomeGuide={KEY,seen,markSeen,install};
if(typeof document!=='undefined')install();
})(window);
