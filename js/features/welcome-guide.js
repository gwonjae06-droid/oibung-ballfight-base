/* Onboarding poster appears once for each browser profile using this site.
 * The guide can always be reopened from the navigation. */
(function(global){
'use strict';
const KEY='oibung-first-visit-guide-v1';
const SECRET_KEY='oibung-guide-12-clicks-v1',SECRET_COUNT=12,SECRET_GOLD=10000;
function storage(){try{return global.localStorage;}catch(_){return null;}}
function seen(storage){
  try{return storage?.getItem(KEY)==='seen';}catch(_){return false;}
}
function markSeen(storage){
  try{storage?.setItem(KEY,'seen');return true;}catch(_){return false;}
}
// Count explicit Help-button clicks (not the automatic first-visit display).
// The persisted claim marker prevents repeated rewards after reloads.
function secretProgress(store){
  try{
    const raw=store?.getItem(SECRET_KEY);
    if(raw==='claimed')return {count:SECRET_COUNT,claimed:true};
    return {count:Math.max(0,Math.min(SECRET_COUNT-1,Math.trunc(Number(raw)||0))),claimed:false};
  }catch(_){return {count:0,claimed:false};}
}
function secretClick(store,credit){
  const prior=secretProgress(store);
  if(prior.claimed)return {awarded:false,count:SECRET_COUNT,claimed:true};
  if(!store||typeof store.setItem!=='function')return {awarded:false,count:prior.count,claimed:false};
  const next=prior.count+1;
  if(next<SECRET_COUNT){
    try{store.setItem(SECRET_KEY,String(next));return {awarded:false,count:next,claimed:false};}
    catch(_){return {awarded:false,count:prior.count,claimed:false};}
  }
  // Mark first, then persist the wallet; roll back if wallet storage fails.
  try{
    store.setItem(SECRET_KEY,'claimed');
    if(credit()===false)throw Error('Wallet not saved');
    return {awarded:true,count:SECRET_COUNT,claimed:true,amount:SECRET_GOLD};
  }catch(_){
    try{store.setItem(SECRET_KEY,String(SECRET_COUNT-1));}catch(_){}
    return {awarded:false,count:SECRET_COUNT-1,claimed:false};
  }
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
    +'<p id="arena-welcome-secret" class="arena-welcome-secret" role="status" aria-live="polite" hidden></p>'
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
  const secretMessage=dialog.querySelector('#arena-welcome-secret');
  trigger.addEventListener('click',()=>{
    const result=secretClick(storage(),()=>{
      if(typeof coins!=='number'||!Number.isFinite(coins)||typeof global.saveEconomyState!=='function')return false;
      coins+=SECRET_GOLD;
      if(global.saveEconomyState()!==true){coins-=SECRET_GOLD;return false;}
      global.renderEconomyUI?.();
      global.CosmeticArcade?.refresh?.();
      global.PointMarket?.refresh?.();
      return true;
    });
    if(result.awarded){
      secretMessage.textContent='🎁 숨겨진 보상 발견! +10,000 G가 지급되었습니다.';
      secretMessage.hidden=false;
    }
    open();
  });
  if(!seen(storage()))open();
  global.ArenaWelcome={open,close,KEY};
  return dialog;
}
global.ArenaWelcomeGuide={KEY,SECRET_KEY,SECRET_COUNT,SECRET_GOLD,seen,markSeen,secretProgress,secretClick,install};
if(typeof document!=='undefined')install();
})(window);
