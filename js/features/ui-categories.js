/* Category navigation: preserves game state and all existing controls while
 * organizing them into focused workspaces. Initialized after feature installers. */
(function(global){
'use strict';
const panel=document.querySelector('.bf-tools');
const nav=document.getElementById('arena-category-nav');
if(!panel||!nav)return;
const battle=document.querySelector('.battle-screen');
const wager=document.querySelector('.bf-fold');
const guide=document.querySelector('.roster-card');
if(!battle||!wager||!guide)return;

battle.id='arena-stage';
panel.id='category-workspace';
panel.classList.add('categorized-tools');
wager.id='economy-section';
guide.id='roster-guide';

const heading=panel.querySelector(':scope > .panel-heading');
const picks=document.getElementById('bf-picks');
const apply=panel.querySelector(':scope > .bf-actions');
const status=document.getElementById('bf-status');
const detailNodes=Array.from(panel.querySelectorAll(':scope > details.bf-details'));
const photo=detailNodes.find(x=>x.querySelector('summary')?.textContent.includes('사진'));
const creator=detailNodes.find(x=>x.querySelector('summary')?.textContent.includes('커스텀'));
if(!heading||!picks||!apply||!status||!photo||!creator)return;

function element(tag,className,text){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=text;
  return el;
}
const localTabs=element('div','category-local-tabs');
localTabs.setAttribute('role','tablist');
localTabs.setAttribute('aria-label','대진 및 캐릭터 도구');
const panels={};
const tabNodes={};
const categories=[
  ['match','대진 선택','경기에 나갈 파이터를 선택합니다.'],
  ['creator','캐릭터 제작','문장으로 설계하거나 완전 랜덤으로 생성합니다.'],
  ['photo','사진·꾸미기','파이터의 사진을 변경합니다.']
];
for(const [id,name,desc] of categories){
  const tab=element('button','category-local-tab',name);
  tab.type='button';tab.id='category-tab-'+id;tab.setAttribute('role','tab');
  tab.setAttribute('aria-controls','category-pane-'+id);
  tab.setAttribute('aria-selected','false');tab.tabIndex=-1;
  localTabs.append(tab);tabNodes[id]=tab;
  const pane=element('section','category-pane');
  pane.id='category-pane-'+id;pane.setAttribute('role','tabpanel');
  pane.setAttribute('aria-labelledby',tab.id);
  pane.hidden=true;panels[id]=pane;
  const hint=element('p','category-pane-description',desc);
  if(id!=='match')pane.append(hint);
}
panels.match.append(heading,picks,apply,status);
const direct=element('div','category-shortcut');
direct.append(element('span','category-shortcut-copy','새 파이터를 만들고 싶나요?'));
const toCreator=element('button','category-shortcut-button','캐릭터 제작 · 랜덤 생성');
toCreator.type='button';direct.append(toCreator);panels.match.append(direct);

// Open the original details but hide only their redundant summary in the
// categorized view. The actual feature DOM nodes are moved, never recreated.
photo.open=true;creator.open=true;
photo.classList.add('category-detail');
creator.classList.add('category-detail');
panels.photo.append(photo);
panels.creator.append(creator);
panel.append(localTabs,panels.match,panels.creator,panels.photo);

// Place the most common creation method first; less frequently used settings
// live under descriptive, independently collapsible categories.
const studio=creator.querySelector('.forge-studio');
if(studio){
  const directChildren=Array.from(studio.children);
  const find=(s)=>directChildren.find(s);
  const intro=find(x=>x.classList?.contains('forge-heading'));
  const random=find(x=>x.classList?.contains('forge-random-entry'));
  const name=find(x=>x.classList?.contains('forge-name'));
  const prompt=find(x=>x.classList?.contains('forge-prompt'));
  const create=find(x=>x.classList?.contains('forge-primary-actions'));
  const basic=find(x=>x.tagName==='DETAILS'&&x.querySelector('summary')?.textContent.includes('외형'));
  const tuning=find(x=>x.classList?.contains('forge-tuning'));
  const library=find(x=>x.classList?.contains('forge-library'));
  const themes=find(x=>x.classList?.contains('forge-optional')&&x.querySelector('summary')?.textContent.includes('랜덤 테마'));
  const saved=find(x=>x.classList?.contains('forge-saved'));
  const ordered=[intro,random,name,prompt,create,basic,tuning,library,themes,saved].filter(Boolean);
  ordered.forEach(node=>studio.append(node));
  if(prompt){
    const editorTitle=element('div','studio-section-heading','능력 설명 · 자동 분석');
    studio.insertBefore(editorTitle,prompt);
  }
  if(saved){
    const savedTitle=saved.querySelector(':scope > summary');
    if(savedTitle)savedTitle.textContent='내 캐릭터 · 공유 및 데이터';
  }
  if(tuning){
    const tuningTitle=tuning.querySelector(':scope > summary');
    if(tuningTitle)tuningTitle.textContent='고급 · 스킬과 수치 직접 편집';
  }
}

// Betting is shown first; shopping has a separate, independently opened shelf.
const economy=wager.querySelector('.economy-card');
if(economy){
  const shopGrid=economy.querySelector('.shop-grid');
  const reserve=economy.querySelector('.reserved-list');
  const divider=economy.querySelector('.economy-divider');
  const title=Array.from(economy.querySelectorAll(':scope > .economy-title'))
    .find(x=>x.textContent.trim()==='아이템');
  if(shopGrid&&reserve&&title){
    const shop=element('details','category-shop-details');
    shop.id='item-shop';
    const summary=element('summary','category-shop-summary');
    summary.append(element('strong','', '아이템 상점'),
      element('small','', '능력 강화 · 체력 · 속도'));
    shop.append(summary);
    const body=element('div','category-shop-body');
    if(divider)body.append(divider);
    body.append(title,shopGrid,reserve);
    shop.append(body);
    economy.append(shop);
  }
}
let active='match';
function setCurrent(category){
  for(const link of nav.querySelectorAll('[data-category]')){
    if(link.dataset.category===category)link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  }
}
function activate(id,{focus=false,scroll=false}={}){
  if(!panels[id])return false;
  active=id;
  for(const [key,pane] of Object.entries(panels)){
    const selected=key===id;
    pane.hidden=!selected;
    const tab=tabNodes[key];
    tab.setAttribute('aria-selected',String(selected));
    tab.tabIndex=selected?0:-1;
  }
  setCurrent(id);
  if(focus)tabNodes[id].focus();
  if(scroll)panel.scrollIntoView({behavior:'auto',block:'start'});
  return true;
}
for(const [id,tab] of Object.entries(tabNodes)){
  tab.addEventListener('click',()=>activate(id));
  tab.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const keys=Object.keys(tabNodes);
    const next=event.key==='Home'?0:event.key==='End'?keys.length-1:
      (keys.indexOf(id)+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
    activate(keys[next],{focus:true});
  });
}
toCreator.addEventListener('click',()=>activate('creator',{scroll:true}));
nav.addEventListener('click',event=>{
  const link=event.target.closest('[data-category]');
  if(!link||!nav.contains(link))return;
  const key=link.dataset.category;
  if(!['arena','match','creator','photo','economy','guide'].includes(key))return;
  event.preventDefault();
  if(panels[key]){activate(key,{scroll:true});return;}
  if(key==='economy'){wager.open=true;setCurrent(key);wager.scrollIntoView({block:'start'});return;}
  if(key==='guide'){guide.open=true;setCurrent(key);guide.scrollIntoView({block:'start'});return;}
  setCurrent(key);battle.scrollIntoView({block:'start'});
});
activate('match');
global.ArenaCategories={activate,get active(){return active;},get tabs(){return Object.keys(tabNodes);}};
})(window);
