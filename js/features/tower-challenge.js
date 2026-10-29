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
// Floors 1–2 use 2 skills, floors 3–4 use 4, floors 6–9 use 5.
// Both bosses (5F and 10F) use 6 independent skills. On floors 5+,
// at least 3 skills are periodic and the rest react to battle conditions.
const THEMES=['dojo','tidal','wind','ember','iron','venom','scope','clock','astral','void'];
const ABILITIES=[
  [['견습 사격','shot'],['입문 방호','shield']],
  [['파도 충격','wave'],['해류의 화살','shot']],
  [['바람 돌진','dash'],['공중 어퍼컷','uppercut'],['휘몰아치는 참격','slash'],['질풍 가속','haste']],
  [['화염 폭발','nova'],['용암 지대','zone'],['불꽃 탄환','shot'],['열기 방호','shield']],
  [['강철 어퍼컷','uppercut'],['철갑 방패','shield'],['불굴의 갑옷','fortify'],['철륜 회전베기','spinslash'],['강철 붕괴','erupt'],['요새 장벽','wall']],
  [['맹독 장판','zone'],['흡수의 늪','drain'],['포자 함정','trap'],['늪지 재생','regen'],['맹독 포자탄','dung']],
  [['추적 사격','homing'],['관통탄','pierce'],['곡사탄','arcshot'],['조준 거리 확보','retreat'],['집중 광선','beam']],
  [['시간 정지','timestop'],['시간 가속','timeburst'],['순간이동','blink'],['시간 되감기','rewind'],['시계 바늘 충격파','wave']],
  [['운석 낙하','meteor'],['별비','starfall'],['행성 궤도','orbit'],['성운 번개','bolt'],['성운 연쇄 낙뢰','chain']],
  [['공허의 블랙홀','blackhole'],['심연의 별비','starfall'],['공허 장막','shield'],['중력 시간왜곡','timeburst'],['공허 소환수','summon'],['심연 폭발','nova']]
];
// Actual combat semantics; names alone do not explain whether a skill attacks.
const SKILL_DETAILS={
  shot:'대상을 향해 직선 투사체를 발사합니다. 실제 탄환이 몸에 닿아야 피해가 적용됩니다.',
  shield:'지속 시간 동안 직접 공격을 막는 보호막을 사용합니다. 피해를 주는 스킬이 아닙니다.',
  wave:'대상 주변에 충격파를 발생시켜 범위 안의 적을 공격합니다.',
  dash:'상대 방향으로 돌진해 거리를 좁힙니다. 돌진 자체로는 피해를 주지 않습니다.',
  uppercut:'전방의 짧은 사거리에서 준비 동작 후 주먹으로 공격하고 상대를 띄웁니다.',
  slash:'전방을 검으로 베며, 실제 칼날이 지나가는 범위에만 피해를 줍니다.',
  haste:'일정 시간 자신의 이동 속도를 60% 높입니다. 직접 피해는 없습니다.',
  nova:'자신을 중심으로 폭발을 일으켜 주변 적을 공격합니다.',
  zone:'대상 위치에 지속 장판을 만듭니다. 생성 순간과 이후 주기적으로 범위 피해를 줍니다.',
  fortify:'일정 시간 받는 직접 공격 피해를 45% 줄입니다. 완전 무적은 아닙니다.',
  spinslash:'자신 주변을 회전하며 근접 공격합니다. 공격 범위에 들어와야 맞습니다.',
  erupt:'도약한 뒤 착지하며 주변 지면에 충격을 줍니다.',
  wall:'상대와 자신의 사이에 장애물을 설치합니다. 투사체를 막지만 직접 피해를 주지 않습니다.',
  drain:'사거리 안의 적에게 피해를 주고 실제로 뺏은 체력의 50%를 회복합니다.',
  trap:'바닥에 함정을 설치합니다. 설치 후 적이 닿으면 발동합니다.',
  regen:'지속 시간 동안 0.5초마다 체력을 조금씩 회복합니다. 직접 공격은 아닙니다.',
  dung:'중독 폭탄 투사체를 발사해 명중한 적을 둔화시키고 지속 피해를 줍니다.',
  homing:'대상을 추적하는 투사체를 발사합니다. 직접 명중해야 피해가 발생합니다.',
  pierce:'적을 관통하는 투사체를 발사하며, 대상 하나당 한 번만 피해를 줍니다.',
  arcshot:'포물선으로 날아가 표시된 지점에 착지할 때 폭발합니다.',
  retreat:'적에게서 멀어지도록 후퇴합니다. 이동 자체로는 피해가 없습니다.',
  beam:'대상 방향으로 직선 광선을 발사하며 광선 경로에 있는 적을 공격합니다.',
  timestop:'범위 안 적의 이동과 스킬 사용을 일시 정지시킵니다. 직접 피해는 없습니다.',
  timeburst:'일정 시간 자신의 스킬 충전 속도를 2배로 높입니다. 직접 피해는 없습니다.',
  blink:'대상 근처로 순간이동합니다. 순간이동 자체로는 피해가 없습니다.',
  rewind:'자신의 체력과 위치를 일정 시간 전 상태로 복원합니다.',
  meteor:'지면에 떨어지는 운석을 생성합니다. 낙하 지점에서 실제 착지할 때 범위 피해를 줍니다.',
  starfall:'대상 주변에 여러 개의 별을 차례로 떨어뜨립니다. 각 착지 지점에서 피해를 줍니다.',
  orbit:'자신 주변에 회전하는 구체를 생성합니다. 구체와 실제로 닿을 때 피해가 발생합니다.',
  bolt:'대상 주변에 낙뢰 위치를 예고하고 잠시 뒤 범위 피해를 줍니다.',
  chain:'사거리 안의 적에게 연쇄 낙뢰를 가합니다. 최대 타격 수는 스킬의 개수 설정을 따릅니다.',
  blackhole:'대상 위치에 중력장을 생성해 주변 적을 끌어당기고 주기적으로 피해를 줍니다.',
  summon:'상대를 추적하며 접촉 공격하는 소환수를 만듭니다.'
};
const CONDITION_TEXT={auto:'주기 발동',damaged:'피격 시',lowhp:'체력 조건',contact:'접촉 시'};
const STATUS_TEXT={fire:'화상 · 지속 피해',poison:'중독 · 지속 피해',ice:'둔화'};
const NO_DIRECT_DAMAGE=new Set(['dash','shield','haste','fortify','wall','regen','retreat','timestop','timeburst','blink','rewind']);
function skillDetail(skill){
  const a=skill.actions[0],condition=skill.trigger==='lowhp'?'HP '+skill.threshold+'% 이하':(CONDITION_TEXT[skill.trigger]||skill.trigger);
  const tags=[condition,'쿨타임 '+skill.cooldown.toFixed(2)+'초'];
  if(!NO_DIRECT_DAMAGE.has(a.type))tags.push('기본 위력 '+a.damage);
  else tags.push('직접 피해 없음');
  if(['shot','homing','pierce','dung','arcshot','starfall','orbit','chain','bolt','zone','nova','wave','beam','blackhole','trap','erupt','wall'].includes(a.type))
    tags.push('설정 범위 '+a.radius);
  if(a.count>1)tags.push('개수 '+a.count);
  if(a.status&&a.status!=='none')tags.push(STATUS_TEXT[a.status]||a.status);
  if(['shield','haste','fortify','regen','timeburst','rewind','timestop','zone','blackhole','orbit','summon','wall'].includes(a.type))
    tags.push('지속 '+a.duration.toFixed(1)+'초');
  return {name:skill.name,type:a.type,description:SKILL_DETAILS[a.type]||'스킬 동작을 실행합니다.',condition,tags};
}
const cap=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
function floor(n){
  const number=Math.round(cap(n,1,FINISH));
  const [name,description,main]=FLOOR_RULES[number-1],boss=number%5===0;
  return {number,name,description,main,boss,scene:THEMES[number-1],
    skills:ABILITIES[number-1].map(([label,type])=>({label,type})),
    skillCount:ABILITIES[number-1].length,
    autoSkillCount:number>=5?(boss?4:3):ABILITIES[number-1].length,
    difficulty:'매우 어려움',
    hp:Math.min(500,200+number*24+(boss?140:0)),
    speed:Math.min(4.7,1.25+number*.24),
    damage:Math.min(90,Math.round(18+number*3.8+(boss?12:0))),
    cooldown:Number(Math.max(.8,3.1-number*.21-(boss?.25:0)).toFixed(2))};
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
      duration:type==='dash'?0.5:type==='starfall'?2.5:1.7,
      count:type==='starfall'?5:type==='chain'?3:1,
      status:(f.number===4&&['nova','zone','shot'].includes(type))?'fire':
        f.number===6&&['zone','trap','drain','dung'].includes(type)?'poison':'none'
    });
    return {name,cooldown:Number((f.cooldown+i*.32+(isSupport?.55:0)).toFixed(2)),
      trigger:f.number>=5&&i>=f.autoSkillCount?(i%2?'lowhp':'damaged'):'auto',
      threshold:70,actions:[attack]};
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
   +'<div class="tower-enemy-skills" id="tower-enemy-skills" aria-label="이번 층 적 스킬 상세"></div>'
   +'<p class="tower-skill-hint">스킬을 누르면 상세 능력을 볼 수 있습니다. 보호막·무적 상태와 공중 회피 중에는 일부 공격의 피해가 적용되지 않습니다.</p></div></div>'
   +'<div class="tower-buttons"><button id="tower-start" type="button">1층 도전 시작</button>'
   +'<button id="tower-pause" type="button" hidden>⏸ 일시정지</button>'
   +'<button id="tower-abandon" type="button" hidden>도전 포기</button></div>'
   +'<p class="tower-feedback" id="tower-feedback" role="status" aria-live="polite">승리하면 보상 선택 없이 다음 층으로 자동 진입합니다.</p>';
  mount.append(panel);
  const el=id=>doc.getElementById(id),hero=el('tower-hero'),message=el('tower-feedback'),
    start=el('tower-start'),pause=el('tower-pause'),abandon=el('tower-abandon');
  let active=false,stage='ready',level=1,cleared=0,selected=null,temporary=null,speed=1;
  // Tower-only transparent 1×/2×/3× control on the actual battle canvas.
  const canvasWrap=doc.querySelector?.('#tower-arena-slot .canvas-wrapper');
  const speedButton=doc.createElement('button');
  speedButton.id='tower-speed';
  speedButton.type='button';
  speedButton.className='tower-speed-control';
  speedButton.hidden=true;
  function setSpeed(value){
    speed=Math.max(1,Math.min(3,Math.round(Number(value)||1)));
    speedButton.textContent='⏩ '+speed+'×';
    speedButton.title='도전의 탑 전용 · 누르면 '+(speed%3+1)+'배속';
    speedButton.setAttribute('aria-label','도전의 탑 '+speed+'배속, 누르면 '+(speed%3+1)+'배속');
    speedButton.dataset.speed=String(speed);
    return speed;
  }
  speedButton.addEventListener('click',()=>setSpeed(speed%3+1));
  canvasWrap?.append(speedButton);
  setSpeed(1);
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
    el('tower-rule').textContent=f.difficulty+' · '+f.description;
    el('tower-enemy').textContent=(f.boss?'👑 ':'')+f.name;
    el('tower-enemy-info').textContent=f.difficulty+' · '+f.hp+' HP · 이동 '+f.speed.toFixed(1)+' · '+f.damage+' 기본 공격력';
    el('tower-best').textContent='최고 기록 '+best+'F (내 브라우저)';
    screen.dataset.towerTheme=f.scene;
    el('tower-scene-name').textContent=global.ArenaTowerScenes?.SCENES[level-1]?.name||f.name;
    el('tower-skill-count').textContent=f.skillCount+'개 독립 스킬 · 주기 발동 '+f.autoSkillCount+'개';
    const skillHost=el('tower-enemy-skills');
    skillHost.replaceChildren();
    // Use the same generated enemy profile that is registered for combat:
    // displayed cooldowns, triggers, damage and statuses are never invented.
    for(const ability of makeEnemy(level).skills){
      const info=skillDetail(ability);
      const card=doc.createElement('details');
      card.className='tower-enemy-skill';
      const summary=doc.createElement('summary');
      const name=doc.createElement('strong');name.textContent=info.name;
      const condition=doc.createElement('small');condition.textContent=info.condition+' · '+ability.cooldown.toFixed(2)+'초';
      summary.append(name,condition);
      const body=doc.createElement('div');body.className='tower-enemy-skill-body';
      const explanation=doc.createElement('p');explanation.textContent=info.description;
      const metadata=doc.createElement('p');metadata.className='tower-enemy-skill-meta';
      metadata.textContent=info.tags.join(' · ');
      body.append(explanation,metadata);card.append(summary,body);skillHost.append(card);
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
    start.hidden=stage==='fighting';
    pause.hidden=stage!=='fighting';
    pause.textContent=isPlaying?'⏸ 일시정지':'▶ 전투 계속';
    abandon.hidden=!active;
    speedButton.hidden=stage!=='fighting';
    hero.disabled=active;
  }
  function cleanup(){
    if(temporary){delete BEHAVIORS[temporary.id];temporary=null;}
  }
  function buildEnemy(){
    cleanup();
    // SkillForge's trusted registration produces the exact battle-ready AI
    // instance/behavior used by saved custom characters. Immediately detach
    // the transient definition from CUSTOM_DEFS so it never appears as a
    // saved/shared character or changes the user's roster.
    const id=global.SkillForge.register(makeEnemy(level),{towerEnemy:true});
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
    // New floor, fresh fighter: no between-floor reward or stat bonus.
    const wager=el('wager-input');if(wager)wager.value='0';
    // Confirm that the actual engine has entered a live round before hiding
    // the start control. Otherwise the canvas stays on "대기 중" indefinitely.
    if(!isPlaying)togglePlay({towerBattle:true});
    if(!isPlaying||!roundStarted)throw Error('전투 엔진이 시작되지 않았습니다. 자유 대전 상태를 초기화하고 다시 시도해 주세요.');
    stage='fighting';
    message.textContent=level+'층 전투 진행 중 · '+floor(level).name;
    show();
    global.ArenaScreenRouter?.showArena?.();
  }
  function begin(){
    if(active||stage==='fighting')return false;
    const who=selectedDef();
    if(!who){message.textContent='캐릭터가 없습니다. 캐릭터 설계에서 먼저 만들어 주세요.';return false;}
    if(roundStarted&&!isGameOver){message.textContent='진행 중인 자유 대전을 먼저 종료해 주세요.';return false;}
    selected=who;active=true;stage='ready';level=1;cleared=0;setSpeed(1);
    try{startFight();return true;}
    catch(e){
      active=false;stage='ready';cleanup();
      message.textContent='도전 시작 실패 · '+(e?.message||'알 수 없는 오류');
      show();return false;
    }
  }
  function onBattleEnd(winner,reason){
    if(!active||stage!=='fighting')return false;
    if(reason==='stopped'||!winner||winner.playerNum!==1){
      const old=selected;active=false;stage='lost';
      updateRecord(global.localStorage,old,cleared,false);cleanup();
      message.textContent='도전 종료 · '+cleared+'층 클리어. 최고 기록이 저장됐습니다.';
      show();global.ArenaScreenRouter?.refresh?.();return true;
    }
    cleared=level;
    updateRecord(global.localStorage,selected,cleared,true);
    if(level>=FINISH){
      active=false;stage='won';cleanup();
      message.textContent='🏆 10층 정복 성공! 최종 우승 기록이 저장됐습니다.';
      show();global.ArenaScreenRouter?.refresh?.();return true;
    }
    // Advance immediately when a floor is won, with no reward menu or buffs.
    level++;
    try{
      startFight();
      global.ArenaScreenRouter?.refresh?.();
      return true;
    }catch(e){
      active=false;stage='lost';cleanup();
      message.textContent='다음 층 시작 실패 · '+(e?.message||'알 수 없는 오류')+' · 처음부터 다시 도전할 수 있습니다.';
      show();global.ArenaScreenRouter?.refresh?.();
      return false;
    }
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
   show();
  function paintBackground(ctx,canvas){
    if(!['fighting','lost','won'].includes(stage)||screen.dataset.battleMode==='free')return false;
    return global.ArenaTowerScenes?.paint?.(ctx,canvas.width,canvas.height,level)||false;
  }
  const api={floor,makeEnemy,read,updateRecord,records,begin,forfeit,paintBackground,
    onBattleEnd,isTransientDef,pauseAway,refresh:show,setSpeed,get speed(){return speed;},get active(){return active;},
    get stage(){return stage;},get state(){return current();}};
  global.ArenaTower=api;return api;
}
global.ArenaTowerModel={floor,makeEnemy,read,updateRecord,key,skillDetail};
if(typeof document!=='undefined')install();
})(window);
