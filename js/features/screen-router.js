/* Single-page game hub, constructed from EXISTING DOM nodes.
 * All original listeners, audio controls, timers and saved player data live on.
 * Screen switching neither clones widgets nor reloads the document. */
(function(global){
'use strict';
const ROUTES=['lobby','tower','character','ranking','mine','stock'];
const NAMES={lobby:'메인 로비',tower:'도전의 탑',character:'캐릭터 설계',
 ranking:'캐릭터 랭킹',mine:'광산',stock:'주식'};
const ICONS={tower:'⚔',character:'✦',ranking:'★',mine:'⛏',stock:'▥'};
function install(){
  const doc=global.document,main=doc?.getElementById('container');
  if(!main||main.dataset.screenRouter==='ready')return null;
  const arena=main.querySelector('.battle-screen'),tools=main.querySelector('.bf-tools');
  const finance=main.querySelector('#point-finance');
  if(!arena||!tools||!finance)return null;
  main.dataset.screenRouter='ready';
  const header=main.querySelector('.page-header');
  const oldNav=main.querySelector('.arena-category-nav');
  const oldPurpose=main.querySelector('.arena-purpose');
  const wager=main.querySelector('.bf-fold'),cosmetic=main.querySelector('#cosmetic-arcade');
  const market=finance.querySelector('.finance-market'),mine=finance.querySelector('.finance-mine');
  const ranking=doc.getElementById('community-power-ranking');
  const studio=doc.getElementById('character-studio-dialog');
  const screens={};let active='lobby',subtab='tower',charTab='design';
  const node=(tag,cls)=>{const e=doc.createElement(tag);if(cls)e.className=cls;return e;};
  const mount=doc.createElement('div');mount.id='arena-screen-stack';
  const lobby=node('section','arena-screen lobby-screen');
  lobby.id='screen-lobby';
  lobby.setAttribute('aria-label','오이붕 아레나 메인 로비');
  const top=node('div','lobby-top');
  if(header)top.append(header);
  const wallet=node('div','lobby-wallet');wallet.innerHTML='<small>보유 포인트</small><strong id="lobby-wallet-amount">1,000 G</strong>';
  top.append(wallet);
  const guide=oldNav?.querySelector('.arena-guide-reopen');if(guide)top.append(guide);
  lobby.append(top);
  const hero=node('div','lobby-hero');
  hero.innerHTML='<div class="lobby-hero-main"><span class="eyebrow">OIBUNG ARENA / CHALLENGE</span>'
   +'<h2>내 파이터로<br><em>도전의 탑</em>을 정복하라!</h2>'
   +'<p>스킬을 직접 설계하고 전투를 거듭해 최고 층을 갱신하세요.</p>'
   +'<button type="button" data-screen="tower" class="lobby-featured-button">도전의 탑 입장 <span aria-hidden="true">→</span></button></div>'
   +'<div class="lobby-hero-art" aria-hidden="true"><div class="lobby-hero-orbit"><div class="lobby-hero-ball">오</div></div><span>THE TOWER</span></div>';
  lobby.append(hero);
  const cards=node('div','lobby-cards');
  cards.innerHTML=[
   ['character','캐릭터 설계','블록으로 스킬을 만들고 외형을 꾸며 보세요.','스킬 코드 · 미리보기 · 가챠'],
   ['ranking','캐릭터 랭킹','공유 파이터와 내 탑 기록을 확인하세요.','파워랭킹 · 기록 · 공유'],
   ['mine','포인트 광산','광석을 터치해 게임 재화 G를 획득하세요.','터치 채굴 · 누적 기록'],
   ['stock','모의 주식','5개 가상 종목의 가격 변화를 이용하세요.','가상 투자 · 3초 시세']
  ].map(([id,name,desc,meta])=>'<button type="button" class="lobby-card lobby-'+id+'" data-screen="'+id+'">'
    +'<span class="lobby-card-icon" aria-hidden="true">'+ICONS[id]+'</span>'
    +'<span class="lobby-card-copy"><strong>'+name+'</strong><small>'+desc+'</small><span>'+meta+'</span></span>'
    +'<span class="lobby-card-arrow" aria-hidden="true">↗</span></button>').join('');
  lobby.append(cards);
  const summary=node('div','lobby-summary');
  summary.innerHTML='<div><small>대표 파이터</small><strong id="lobby-hero-fighter">파이터 선택 전</strong></div>'
    +'<div><small>도전의 탑 최고 기록</small><strong id="lobby-highest-floor">0층</strong></div>'
    +'<div><small>최근 도전</small><strong id="lobby-recent-run">아직 기록 없음</strong></div>';
  lobby.append(summary);
  screens.lobby=lobby;mount.append(lobby);
  for(const id of ROUTES.slice(1)){
    const page=node('section','arena-screen game-screen');page.id='screen-'+id;
    page.setAttribute('aria-labelledby','heading-'+id);
    const bar=node('header','screen-heading');
    bar.innerHTML='<button type="button" data-screen="lobby" class="screen-home">← 메인 로비</button>'
      +'<div><span class="eyebrow">OIBUNG / '+id.toUpperCase()+'</span>'
      +'<h2 id="heading-'+id+'">'+ICONS[id]+' '+NAMES[id]+'</h2></div>'
      +'<strong class="screen-wallet" data-wallet>1,000 G</strong>';
    page.append(bar);
    screens[id]=page;mount.append(page);
  }
  main.prepend(mount);
  // Keep a disconnected-looking legacy metadata container for the existing
  // nav/status modules. It is not displayed or independently interactive.
  const legacy=node('div','legacy-ui');
  legacy.hidden=true;legacy.style.display='none';
  if(oldNav)legacy.append(oldNav);
  if(oldPurpose)legacy.append(oldPurpose);
  main.append(legacy);
  const tower=screens.tower;
  const towerTabs=node('nav','screen-tabs');
  towerTabs.setAttribute('aria-label','도전의 탑 모드');
  towerTabs.innerHTML='<button type="button" data-tower-tab="tower">도전의 탑</button>'
    +'<button type="button" data-tower-tab="free">자유 대전 · 실험 전투</button>';
  tower.append(towerTabs);
  const slot=node('div','tower-mode-slot');slot.id='tower-mode-slot';tower.append(slot);
  const arenaSlot=node('div','tower-arena-slot');arenaSlot.id='tower-arena-slot';arenaSlot.append(arena);tower.append(arenaSlot);
  const free=node('div','tower-free-slot');free.id='tower-free-slot';
  free.append(tools);if(wager)free.append(wager);
  tower.append(free);
  const designTabs=node('nav','screen-tabs character-route-tabs');
  designTabs.setAttribute('aria-label','캐릭터 설계 메뉴');
  designTabs.innerHTML='<button type="button" data-character-tab="design">스킬 코딩 · 미리보기</button>'
    +'<button type="button" data-character-tab="cosmetics">외형 꾸미기 · 가챠</button>';
  screens.character.append(designTabs);
  const designSlot=node('div','character-design-slot');designSlot.id='character-design-slot';
  if(studio)designSlot.append(studio);screens.character.append(designSlot);
  const cosmeticSlot=node('div','character-cosmetic-slot');cosmeticSlot.id='character-cosmetic-slot';
  if(cosmetic)cosmeticSlot.append(cosmetic);
  screens.character.append(cosmeticSlot);
  const score=node('section','tower-record-panel');score.id='tower-record-panel';
  score.innerHTML='<h3>내 브라우저 도전 기록</h3><p>온라인 기록이 아닙니다. 이 기기에 저장된 캐릭터별 최고 층입니다.</p>'
    +'<div id="tower-record-list" role="list">아직 도전 기록이 없습니다.</div>';
  screens.ranking.append(score);
  if(ranking)screens.ranking.append(ranking);
  const mineFrame=node('div','single-economy-slot');mineFrame.id='mine-screen-slot';
  if(mine)mineFrame.append(mine);screens.mine.append(mineFrame);
  const stockFrame=node('div','single-economy-slot');stockFrame.id='stock-screen-slot';
  if(market)stockFrame.append(market);screens.stock.append(stockFrame);
  // Keep the legacy wallet IDs and finance shell mounted; their backing
  // code accesses them via document.getElementById.
  finance.hidden=true;finance.style.display='none';main.append(finance);
  function walletText(){return typeof global.formatGold==='function'?global.formatGold(coins):String(coins)+' G';}
  function refresh(){
    const w=walletText();
    doc.getElementById('lobby-wallet-amount').textContent=w;
    for(const el of doc.querySelectorAll('[data-wallet]'))el.textContent=w;
    doc.getElementById('lobby-hero-fighter').textContent=
      (typeof players!=='undefined'&&players[0]?.name)||'파이터 선택 전';
    const records=global.ArenaTower?.records?.()||[];
    doc.getElementById('lobby-highest-floor').textContent=
      (records.length?records[0].best:0)+'층';
    let last=null;try{last=global.ArenaTowerModel?.read(global.localStorage).last;}catch(_){}
    const recent=records.find(r=>r.id===last?.id);
    doc.getElementById('lobby-recent-run').textContent=last?
      (recent?.name||'파이터')+' · '+last.cleared+'층':'아직 기록 없음';
    const list=doc.getElementById('tower-record-list');if(list){
      list.replaceChildren();
      for(const record of records){
        const e=node('div','tower-record-entry');e.setAttribute('role','listitem');
        const name=node('strong');name.textContent=record.name;
        const value=node('span');value.textContent='최고 '+record.best+'층 · 승리 '+record.victories+'회';
        e.append(name,value);list.append(e);
      }
      if(!records.length)list.textContent='아직 도전 기록이 없습니다.';
    }
  }
  function towerTab(id){
    subtab=id==='free'?'free':'tower';
    const challenge=doc.getElementById('tower-mode-slot');
    challenge.hidden=subtab!=='tower';
    free.hidden=subtab!=='free';
    for(const btn of towerTabs.querySelectorAll('button')){
      btn.setAttribute('aria-pressed',String(btn.dataset.towerTab===subtab));
    }
    tower.dataset.battleMode=subtab;
    const canControl=subtab==='free'||global.ArenaTower?.stage==='fighting';
    const legacyControls=doc.querySelector('.arena-setup-controls');
    if(legacyControls)legacyControls.hidden=!canControl;
    if(subtab==='free'&&global.ArenaTower?.active){
      // Never switch the same live battle engine into free mode mid-run.
      towerTab('tower');return;
    }
  }
  function characterTab(id){
    charTab=id==='cosmetics'?'cosmetics':'design';
    designSlot.hidden=charTab!=='design';cosmeticSlot.hidden=charTab!=='cosmetics';
    for(const btn of designTabs.querySelectorAll('button')){
      btn.setAttribute('aria-pressed',String(btn.dataset.characterTab===charTab));
    }
    if(charTab==='design'&&active==='character'){
      const d=doc.getElementById('character-studio-dialog');
      if(d&&!d.open)d.setAttribute('open','');
      global.dispatchEvent?.(new global.Event('studio:open'));
    }else global.dispatchEvent?.(new global.Event('studio:close'));
  }
  function go(where){
    if(!ROUTES.includes(where))where='lobby';
    if(active==='tower'&&where!=='tower')global.ArenaTower?.pauseAway?.();
    if(active==='character'&&where!=='character'){
      const dialog=doc.getElementById('character-studio-dialog');
      if(dialog?.open)dialog.removeAttribute('open');
      global.dispatchEvent?.(new global.Event('studio:close'));
    }
    active=where;
    for(const [id,page] of Object.entries(screens)){
      page.hidden=id!==where;
      page.setAttribute('aria-hidden',String(id!==where));
    }
    main.dataset.route=where;doc.body.dataset.arenaScreen=where;
    if(where==='character'){
      const dialog=doc.getElementById('character-studio-dialog');
      if(dialog&&!dialog.open)dialog.setAttribute('open','');
      characterTab(charTab);
    }else if(where==='tower'){
      global.ArenaTower?.refresh?.();towerTab(subtab);
    }
    refresh();
    global.scrollTo?.({top:0,behavior:'instant'});
    return where;
  }
  function showArena(){doc.querySelector('.battle-screen')?.scrollIntoView?.({block:'start',behavior:'smooth'});}
  mount.addEventListener('click',event=>{
    const b=event.target.closest('[data-screen],[data-tower-tab],[data-character-tab]');
    if(!b||!mount.contains(b))return;
    if(b.dataset.screen)go(b.dataset.screen);
    else if(b.dataset.towerTab)towerTab(b.dataset.towerTab);
    else if(b.dataset.characterTab)characterTab(b.dataset.characterTab);
  });
  // Custom studio save/reopen retains its old events and the one DOM tree.
  const initial=global.location?.hash.replace('#','');
  go(ROUTES.includes(initial)?initial:'lobby');
  global.addEventListener?.('hashchange',()=>{
    const next=global.location.hash.replace('#','');
    if(ROUTES.includes(next))go(next);
  });
  const api={go,refresh,showArena,towerTab,characterTab,get enabled(){return true;},
    get active(){return active;},get towerTab(){return subtab;}};
  global.ArenaScreenRouter=api;
  return api;
}
global.ArenaScreenRouter={install,enabled:false};
if(typeof document!=='undefined')install();
})(window);
