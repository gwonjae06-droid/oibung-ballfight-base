/* The arena stays on the main page; creating a fighter uses one dedicated
 * full-screen studio dialog. Existing forge modules retain their DOM nodes
 * and event handlers when the studio is moved here. */
(function(global){
'use strict';
const main=document.querySelector('.bf-tools');
const nav=document.getElementById('arena-category-nav');
const arena=document.querySelector('.battle-screen');
if(!main||!nav||!arena)return;
const creator=Array.from(main.querySelectorAll(':scope > details.bf-details'))
  .find(x=>x.querySelector('summary')?.textContent.includes('커스텀'));
if(!creator)return;

arena.id='arena-stage';
main.id='match-setup';
main.classList.add('arena-match-setup');
const wager=document.querySelector('.bf-fold');
if(wager)wager.id='economy-section';

const openButton=document.createElement('button');
openButton.type='button';openButton.id='open-character-studio';
openButton.className='open-character-studio';
openButton.textContent='+ 커스텀 캐릭터 만들기';
openButton.setAttribute('aria-haspopup','dialog');
const hint=document.createElement('p');hint.className='arena-match-hint';
hint.textContent='랜덤 생성과 계열 선택 생성은 커스텀 캐릭터 제작 화면에서 사용할 수 있습니다.';
const openArea=document.createElement('div');
openArea.className='arena-match-creator-shortcut';
openArea.append(openButton,hint);
main.append(openArea);

const dialog=document.createElement('dialog');
dialog.id='character-studio-dialog';dialog.className='character-studio-dialog';
dialog.setAttribute('aria-label','커스텀 캐릭터 제작');
const shell=document.createElement('div');shell.className='character-studio-shell';
const head=document.createElement('header');head.className='character-studio-head';
const heading=document.createElement('div');
const kicker=document.createElement('span');kicker.className='eyebrow';kicker.textContent='CUSTOM FIGHTER STUDIO';
const title=document.createElement('h2');title.textContent='캐릭터 만들기';
const subtitle=document.createElement('p');subtitle.textContent='랜덤으로 생성하거나 블록을 조합하여 원하는 스킬을 직접 만드세요.';
heading.append(kicker,title,subtitle);
const close=document.createElement('button');close.type='button';close.id='close-character-studio';
close.className='character-studio-close';close.textContent='✕ 닫기';
close.setAttribute('aria-label','제작 창 닫기');
head.append(heading,close);
const content=document.createElement('div');content.className='character-studio-content';
creator.open=true;creator.classList.add('character-studio-original');
content.append(creator);
shell.append(head,content);dialog.append(shell);
document.body.append(dialog);

const studio=creator.querySelector('.forge-studio');
if(studio){
  const children=Array.from(studio.children);
  const find=fn=>children.find(fn);
  const intro=find(el=>el.classList?.contains('forge-heading'));
  const random=find(el=>el.classList?.contains('forge-random-entry'));
  const name=find(el=>el.classList?.contains('forge-name'));
  const blocks=find(el=>el.classList?.contains('block-forge'));
  const create=find(el=>el.classList?.contains('forge-primary-actions'));
  const basics=find(el=>el.tagName==='DETAILS'&&el.querySelector('summary')?.textContent.includes('외형'));
  const tuning=find(el=>el.classList?.contains('forge-tuning'));
  const library=find(el=>el.classList?.contains('forge-library'));
  const themes=find(el=>el.classList?.contains('forge-optional')&&el.querySelector('summary')?.textContent.includes('랜덤 테마'));
  const saved=find(el=>el.classList?.contains('forge-saved'));
  const ordered=[intro,random,name,basics,blocks,create,tuning,library,themes,saved].filter(Boolean);
  for(const node of ordered)studio.append(node);
  if(intro)intro.hidden=true;
  if(basics){
    basics.open=true;
    const summary=basics.querySelector(':scope > summary');
    if(summary)summary.textContent='외형 · 색상 · 능력치';
  }
  if(tuning){
    const summary=tuning.querySelector(':scope > summary');
    if(summary)summary.textContent='스킬 직접 편집 · 상세 설정';
  }
  if(saved){
    const summary=saved.querySelector(':scope > summary');
    if(summary)summary.textContent='JSON 가져오기 · 내보내기';
  }
}
let lastFocus=null;
function show(){
  lastFocus=document.activeElement;
  if(!dialog.open){
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
  }
  if(typeof global.dispatchEvent==='function'&&typeof global.Event==='function')
    global.dispatchEvent(new global.Event('studio:open'));
  close.focus();
}
function hide(){
  if(typeof dialog.close==='function')dialog.close();
  else dialog.removeAttribute('open');
  if(typeof global.dispatchEvent==='function'&&typeof global.Event==='function')
    global.dispatchEvent(new global.Event('studio:close'));
  if(lastFocus&&typeof lastFocus.focus==='function')lastFocus.focus();
}
openButton.addEventListener('click',show);
close.addEventListener('click',hide);
dialog.addEventListener('click',event=>{
  if(event.target===dialog)hide();
});
const go=(category)=>{
  for(const a of nav.querySelectorAll('[data-category]')){
    if(a.dataset.category===category)a.setAttribute('aria-current','location');
    else a.removeAttribute('aria-current');
  }
};
nav.addEventListener('click',event=>{
  const link=event.target.closest('[data-category]');
  if(!link||!nav.contains(link))return;
  const category=link.dataset.category;
  if(!['arena','match','creator','economy'].includes(category))return;
  event.preventDefault();
  go(category);
  if(category==='creator'){show();return;}
  const target=category==='arena'?arena:category==='match'?main:wager;
  if(category==='economy'&&wager)wager.open=true;
  target?.scrollIntoView?.({block:'start',behavior:'auto'});
});
dialog.addEventListener('close',()=>{
  if(lastFocus&&typeof lastFocus.focus==='function')lastFocus.focus();
});
global.ArenaCategories={showStudio:show,hideStudio:hide,get active(){return dialog.open?'creator':'match';}};
})(window);
