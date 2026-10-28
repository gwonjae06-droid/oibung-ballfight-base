/* 10-floor PvE challenge layered over the real, existing 2-fighter engine.
 * Uses transient SkillForge definitions; never persists an enemy or modifies
 * a saved hero profile. Tower records are strictly browser-local. */
(function(global){
'use strict';
const KEY='oibung-tower-v1',FINISH=10;
const FLOOR_RULES=[
  ['훈련의 문','기본 투사체를 사용하는 상대','shot'],
  ['파동 회랑','넓은 범위의 충격파','wave'],
  ['질주의 방','돌진과 근접 연계','dash'],
  ['폭염의 방','화상 속성을 띤 폭발','nova'],
  ['철갑의 파수꾼','보호막과 강한 어퍼컷 · 보스','uppercut'],
  ['독성의 방','장판형 지속 공격','zone'],
  ['저격의 방','유도탄과 원거리 견제','homing'],
  ['시간의 방','시간 정지와 순간이동','timestop'],
  ['별의 회랑','운석과 별비가 떨어지는 전장','meteor'],
  ['공허의 지배자','블랙홀과 별비 · 최종 보스','blackhole']
];
// Floor identity is visible in BOTH the pre-battle panel and the live Canvas.
// The first two floors teach the player with 2 independently timed skills.
// From floor 3 onward each opponent equips exactly four independent skills.
const THEMES=['dojo','tidal','wind','ember','iron','venom','scope','clock','astral','void'];
const ABILITIES=[
  [['견습 사격','shot'],['입문 방호','shield']],
  [['파도 충격','wave'],['해류의 화살','shot']],
  [['바람 돌진','dash'],['공중 어퍼컷','uppercut'],['휘몰아치는 참격','slash'],['질풍 가속','haste']],
  [['화염 폭발','nova'],['용암 지대','zone'],['불꽃 탄환','shot'],['열기 방호','shield']],
  [['강철 어퍼컷','uppercut'],['철갑 방패','shield'],['불굴의 갑옷','fortify'],['철륜 회전베기','spinslash']],
  [['맹독 장판','zone'],['흡수의 늪','drain'],['포자 함정','trap'],['늪지 재생','regen']],
  [['추적 사격','homing'],['관통탄','pierce'],['곡사탄','arcshot'],['조준 거리 확보','retreat']],
  [['시간 정지','timestop'],['시간 가속','timeburst'],['순간이동','blink'],['시간 되감기','rewind']],
  [['운석 낙하','meteor'],['별비','starfall'],['행성 궤도','orbit'],['성운 번개','bolt']],
  [['공허의 블랙홀','blackhole'],['심연의 별비','starfall'],['공허 장막','shield'],['중력 시간왜곡','timeburst']]
];
const cap=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
function floor(n){
  const number=Math.round(cap(n,1,FINISH));
  const [name,description,main]=FLOOR_RULES[number-1],boss=number%5===0;
  return {number,name,description,main,boss,scene:THEMES[number-1],
    skills:ABILITIES[number-1].map(([label,type])=>({label,type})),
    skillCount:ABILITIES[number-1].length,
    hp:Math.min(500,180+number*19+(boss?80:0)),
    speed:Math.min(4.5,1.15+number*.20),
    damage:Math.min(65,12+number*3+(boss?7:0)),
    cooldown:Math.max(.75,3.3-number*.17)};
}
function action(type,damage,extra={}){
  return {type,pattern:'direct',target:'nearest',damage,radius:112,count:1,
    speed:5,duration:1.7,status:'none',knockback:2,delay:0,link:'and',...extra};
}
function makeEnemy(n){
  const f=floor(n);
  const skills=ABILITIES[f.number-1].map(([name,type],i)=>{
    const isMovement=['dash','blink','retreat'].includes(type);
    const isSupport=['shield','fortify','haste','regen','rewind','timestop','timeburst'].includes(type);
    const attack=action(type,isMovement||isSupport?0:Math.round(f.damage*(i===0?1:.7)),{
      radius:type==='starfall'||type==='blackhole'?155:112,
      speed:type==='dash'?8:5,
      duration:type==='dash'?.5:type==='starfall'?2.5:1.7,
      count:type==='starfall'?5:1,
      status:(f.number===4&&['nova','zone','shot'].includes(type))?'fire':
        f.number===6&&['zone','trap','drain'].includes(type)?'poison':'none'
    });
    return {name,cooldown:Number((f.cooldown+i*.55+(isSupport?.7:0)).toFixed(2)),
      trigger:'auto',threshold:40,actions:[attack]};
  });
  return {name:f.name,color:f.boss?'#7f5cce':'#b26b73',
    effectColor:f.boss?'#9457e2':'#d96c6e',
    hp:f.hp,speed:f.speed,skills};
}
function read(storage){
  try{
    const o=JSON.parse(storage?.getItem(KEY)||'null');
    return o&&typeof o==='object'&&!Array.isArray(o)&&o.records&&typeof o.records==='object'
      ?{records:o.records,last:o.last||null}:{records:{},last:null};
  }catch(_){return {records:{},last:null};}
}
function key(def){
  const v=def?.forgeData?.artKey||def?.id||'';
  return String(v).replace(/[^a-z0-9_-]/ig,'').slice(0,60)||'unknown';
}
function updateRecord(store,who,cleared,won=false){
  const v=read(store),id=key(who),old=v.records[id]||{};
  v.records[id]={name:String(who?.name||'파이터').slice(0,30),
    best:Math.max(cap(old.best,0,FINISH),cap(cleared,0,FINISH)),
    attempts:Math.floor(cap(old.attempts,0,1000000))+(won?0:1),
    victories:Math.floor(cap(old.victories,0,1000000))+(won?1:0)};
  v.last={id,cleared:Math.floor(cap(cleared,0,FINISH)),at:Date.now()};
  try{store?.setItem(KEY,JSON.stringify(v));}catch(_){}
  return v.records[id];
}
function install(){
  if(!global.document)return null;
  const doc=global.document,screen=doc.getElementById('screen-tower');
  if(!screen)return null;
  const mount=doc.getElementById('tower-mode-slot')||screen;
  const panel=doc.createElement('section');panel.id='tower-challenge';panel.className='tower-challenge';
  panel.innerHTML='<div class="tower-head"><div><span class="eyebrow">PVE CHALLENGE / 10 FLOORS</span>'
   +'<h2>도전의 탑 <span id="tower-floor">1 / 10F</span></h2>'
   +'<p id="tower-rule">층을 선택해 도전을 시작하세요.</p></div>'
   +'<strong id="tower-best">최고 기록 0F</strong></div>'
   +'<div class="tower-floor-track" aria-label="도전의 탑 10개 층 진행도">'
   +Array.from({length:FINISH},(_,i)=>'<div class="tower-floor-chip" id="tower-chip-'+(i+1)+'"'
   +' aria-label="'+(i+1)+'층'+((i+1)%5===0?' 보스':'')+'"><strong>'
   +(i+1)+'F</strong>'+((i+1)%5===0?'<small>보스</small>':'<small>층</small>')+'</div>').join('')
   +'</div>'
   +'<div class="tower-scene-identity"><span id="tower-scene-name">황혼의 수련장</span><span id="tower-skill-count">2개 독립 스킬</span></div>'
   +'<div class="tower-fighter-pick"><label for="tower-hero">출전 캐릭터'
   +'<select id="tower-hero"></select></label>'
   +'<div class="tower-enemy"><strong id="tower-enemy">훈련의 문</strong><span id="tower-enemy-info">첫 도전을 준비하세요.</span>'
   +'<div class="tower-enemy-skills" id="tower-enemy-skills" aria-label="이번 층 적 스킬"></div></div></div>'
   +'<div class="tower-buttons"><button id="tower-start" type="button">1층 도전 시작</button>'
   +'<button id="tower-pause" type="button" hidden>⏸ 일시정지</button>'
   +'<button id="tower-abandon" type="button" hidden>도전 포기</button></div>'
   +'<p class="tower-feedback" id="tower-feedback" role="status" aria-live="polite">나만의 파이터가 어디까지 도달할지 도전해 보세요.</p>'
   +'<div id="tower-rewards" class="tower-rewards" hidden aria-label="층 클리어 보상 선택">'
   +'<h3>층 클리어! 보상을 하나 선택하세요.</h3><div class="tower-reward-grid">'
   +'<button type="button" data-tower-reward="gold">G 보상 받기</button>'
   +'<button type="button" data-tower-reward="hp">다음 층 최대 HP +40</button>'
   +'<button type="button" data-tower-reward="speed">다음 층 이동 +12%</button>'
   +'</div></div>';
  mount.append(panel);
  const el=id=>doc.getElementById(id),hero=el('tower-hero'),message=el('tower-feedback'),
    start=el('tower-start'),pause=el('tower-pause'),abandon=el('tower-abandon'),rewards=el('tower-rewards');
  let active=false,stage='ready',level=1,cleared=0,selected=null,temporary=null;
  let bonus={hp:0,speed:0},lastWinner=null;
  const pool=()=>[...CHARACTER_DEFS,...CUSTOM_DEFS];
  function selectedDef(){return pool().find(d=>d.id===hero.value)||pool()[0]||null;}
  function current(){return {active,stage,level,cleared,boss:floor(level).boss,selected:key(selected)};}
  function refreshHero(){
    const previous=hero.value;
    hero.replaceChildren();
    for(const d of pool()){
      const option=doc.createElement('option');option.value=d.id;option.textContent=d.name;hero.append(option);
    }
    if(pool().some(d=>d.id===previous))hero.value=previous;
    else if(selected&&pool().includes(selected))hero.value=selected.id;
  }
  function show(){
    refreshHero();
    const f=floor(level),best=read(global.localStorage).records[key(selectedDef())]?.best||0;
    el('tower-floor').textContent=level+' / '+FINISH+'F';
    el('tower-rule').textContent=f.description;
    el('tower-enemy').textContent=(f.boss?'👑 ':'')+f.name;
    el('tower-enemy-info').textContent=f.hp+' HP · 이동 '+f.speed.toFixed(1)+' · '+f.damage+' 기본 공격력';
    el('tower-best').textContent='최고 기록 '+best+'F (내 브라우저)';
    screen.dataset.towerTheme=f.scene;
    el('tower-scene-name').textContent=global.ArenaTowerScenes?.SCENES[level-1]?.name||f.name;
    el('tower-skill-count').textContent=f.skillCount+'개 독립 스킬';
    const skillHost=el('tower-enemy-skills');
    skillHost.replaceChildren();
    for(const entry of f.skills){
      const badge=doc.createElement('span');
      badge.className='tower-enemy-skill';
      badge.textContent=entry.label;
      badge.title=entry.label+' · '+(global.SkillForge?.TYPE?.[entry.type]||entry.type);
      skillHost.append(badge);
    }
    for(let i=1;i<=FINISH;i++){
      const chip=el('tower-chip-'+i);
      if(!chip)continue;
      chip.className='tower-floor-chip'+(i<=cleared?' is-cleared':'')+
        (i===level?' is-current':'');
      chip.setAttribute('aria-current',String(i===level));
      chip.setAttribute('data-boss',String(i%5===0));
    }
    start.textContent=stage==='won'?'새로운 도전 시작':'1층 도전 시작';
    start.hidden=stage==='fighting'||stage==='reward';
    pause.hidden=stage!=='fighting';
    pause.textContent=isPlaying?'⏸ 일시정지':'▶ 전투 계속';
    abandon.hidden=!active;
    rewards.hidden=stage!=='reward';
    hero.disabled=active;
  }
  function cleanup(){
    if(temporary){delete BEHAVIORS[temporary.id];temporary=null;}
  }
  function giveGold(value){
    const n=Math.max(0,Math.floor(value)),before=coins;
    coins=Math.min(1e9,coins+n);
    if(!saveEconomyState()){coins=before;return false;}
    renderEconomyUI();
    return true;
  }
  function buildEnemy(){
    cleanup();
    // SkillForge's trusted registration produces the exact battle-ready AI
    // instance/behavior used by saved custom characters. Immediately detach
    // the transient definition from CUSTOM_DEFS so it never appears as a
    // saved/shared character or changes the user's roster.
    const id=global.SkillForge.register(makeEnemy(level));
    const i=CUSTOM_DEFS.findIndex(d=>d.id===id);
    if(i<0)throw Error('적 캐릭터 생성 실패');
    const def=CUSTOM_DEFS.splice(i,1)[0];
    temporary={id,def};
    return def;
  }
  function startFight(){
    const enemy=buildEnemy();
    if(!selected||!pool().includes(selected))throw Error('출전 캐릭터를 다시 선택하세요.');
    if(!setMatchCount(2))throw Error('2인 대전 변경 실패');
    if(!reRollMatch([selected,enemy]))throw Error('대진 구성 실패');
    const p=players[0];
    // Buffs exist only on this freshly created run instance.
    p.maxHp+=bonus.hp;p.hp=p.maxHp;
    p.speedMultiplier=(p.speedMultiplier||1)*(1+bonus.speed);
    if(bonus.speed){p.vx*=1+bonus.speed;p.vy*=1+bonus.speed;}
    const wager=el('wager-input');if(wager)wager.value='0';
    stage='fighting';message.textContent=level+'층 전투 진행 중 · '+floor(level).name;
    if(!isPlaying)togglePlay();
    show();
    global.ArenaScreenRouter?.showArena?.();
  }
  function begin(){
    if(active||stage==='fighting')return false;
    const who=selectedDef();
    if(!who){message.textContent='캐릭터가 없습니다. 캐릭터 설계에서 먼저 만들어 주세요.';return false;}
    if(roundStarted&&!isGameOver){message.textContent='진행 중인 자유 대전을 먼저 종료해 주세요.';return false;}
    selected=who;active=true;stage='ready';level=1;cleared=0;bonus={hp:0,speed:0};
    try{startFight();return true;}
    catch(e){active=false;stage='ready';cleanup();message.textContent=e.message;show();return false;}
  }
  function onBattleEnd(winner,reason){
    if(!active||stage!=='fighting')return false;
    if(reason==='stopped'||!winner||winner.playerNum!==1){
      const old=selected;active=false;stage='lost';
      updateRecord(global.localStorage,old,cleared,false);cleanup();
      message.textContent='도전 종료 · '+cleared+'층 클리어. 최고 기록이 저장됐습니다.';
      show();global.ArenaScreenRouter?.refresh?.();return true;
    }
    cleared=level;lastWinner=winner;
    updateRecord(global.localStorage,selected,cleared,true);
    if(level>=FINISH){
      active=false;stage='won';cleanup();
      message.textContent='🏆 10층 정복 성공! 최종 우승 기록이 저장됐습니다.';
      show();global.ArenaScreenRouter?.refresh?.();return true;
    }
    stage='reward';
    const rewardGold=40+level*15;
    rewards.querySelector('[data-tower-reward="gold"]').textContent=rewardGold+' G 받기';
    message.textContent=level+'층 승리! 세 가지 보상 중 하나를 선택하면 다음 층으로 진행합니다.';
    show();global.ArenaScreenRouter?.refresh?.();return true;
  }
  function chooseReward(type){
    if(stage!=='reward'||!active)return false;
    if(type==='gold'){
      if(!giveGold(40+level*15)){message.textContent='포인트 저장 실패. 다시 시도하세요.';return false;}
    }else if(type==='hp')bonus.hp=Math.min(200,bonus.hp+40);
    else if(type==='speed')bonus.speed=Math.min(.6,bonus.speed+.12);
    else return false;
    level++;
    try{startFight();return true;}
    catch(e){message.textContent='다음 층 준비 실패: '+e.message;return false;}
  }
  function forfeit(){
    if(!active)return false;
    if(stage==='fighting'&&roundStarted&&!isGameOver){stopMatch();return true;}
    active=false;stage='lost';updateRecord(global.localStorage,selected,cleared,false);
    cleanup();message.textContent='도전을 포기했습니다. '+cleared+'층까지의 기록을 저장했습니다.';show();return true;
  }
  function records(){
    return Object.entries(read(global.localStorage).records).map(([id,r])=>({
      id,name:String(r.name||id),best:cap(r.best,0,10),attempts:cap(r.attempts,0,100000),
      victories:cap(r.victories,0,100000)})).sort((a,b)=>b.best-a.best);
  }
  function isTransientDef(d){return Boolean(temporary&&temporary.def===d&&active);}
  function pauseAway(){
    if(active&&stage==='fighting'&&isPlaying)togglePlay();
  }
  start.addEventListener('click',begin);
  pause.addEventListener('click',()=>{
    if(stage==='fighting'&&roundStarted&&!isGameOver){togglePlay();show();}
  });
  abandon.addEventListener('click',forfeit);
  hero.addEventListener('change',show);
  rewards.addEventListener('click',event=>{
    const button=event.target.closest('[data-tower-reward]');
    if(button)chooseReward(button.dataset.towerReward);
  });
  show();
  function paintBackground(ctx,canvas){
    if(!['fighting','reward','lost','won'].includes(stage)||screen.dataset.battleMode==='free')return false;
    return global.ArenaTowerScenes?.paint?.(ctx,canvas.width,canvas.height,level)||false;
  }
  const api={floor,makeEnemy,read,updateRecord,records,begin,forfeit,paintBackground,
    chooseReward,onBattleEnd,isTransientDef,pauseAway,refresh:show,get active(){return active;},
    get stage(){return stage;},get state(){return current();}};
  global.ArenaTower=api;return api;
}
global.ArenaTowerModel={floor,makeEnemy,read,updateRecord,key};
if(typeof document!=='undefined')install();
})(window);
