/* 10-floor PvE challenge layered over the real, existing 2-fighter engine.
 * Uses transient SkillForge definitions; never persists an enemy or modifies
 * a saved hero profile. Tower records are strictly browser-local. */
(function(global){
'use strict';
const KEY='oibung-tower-v1',FINISH=10;
let realmId='time';
const realms=global.ArenaTowerRealms;
const realm=()=>realms?.get(realmId);
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
  const result={number,name,description,main,boss,scene:THEMES[number-1],
    skills:ABILITIES[number-1].map(([label,type])=>({label,type})),
    skillCount:ABILITIES[number-1].length,
    autoSkillCount:number>=5?(boss?4:3):ABILITIES[number-1].length,
    difficulty:'매우 어려움',
    hp:Math.min(500,200+number*24+(boss?140:0)),
    speed:Math.min(4.7,1.25+number*.24),
    damage:Math.min(90,Math.round(18+number*3.8+(boss?12:0))),
    cooldown:Number(Math.max(.8,3.1-number*.21-(boss?.25:0)).toFixed(2))};
  return realms?realms.floor(result,realmId):result;
}
function action(type,damage,extra={}){
  return {type,pattern:'direct',target:'nearest',damage,radius:112,count:1,
    speed:5,duration:1.7,status:'none',knockback:2,delay:0,link:'and',...extra};
}
function makeEnemy(n){
  const f=floor(n);
  const themedSkills=f.boss?[[realm()?.pattern||'방호','shield']]:realms?.enemyLoadout?.(realmId,f.number)||[
    [(realm()?.name||'탑')+' 탄환',({time:'shot',space:'homing',fire:'arcshot',storm:'bolt',ice:'pierce',forest:'dung'})[realmId]],
    ['속성 방호','shield'],
    ...(f.number>=3?[['전술 이동',realmId==='fire'||realmId==='forest'?'dash':'retreat']]:[]),
    ...(f.number>=6?[['속성 궤도','orbit']]:[]),
    ...(f.number>=8?[['고층 포격','arcshot']]:[])
  ];
  const skills=(realms?themedSkills:ABILITIES[f.number-1]).map(([name,type],i)=>{
    const isMovement=['dash','blink','retreat'].includes(type);
    const isSupport=['shield','fortify','haste','regen','rewind','timestop','timeburst'].includes(type);
    const attack=action(type,isMovement||isSupport?0:Math.round(f.damage*(i===0?1:.7)),{
      radius:type==='starfall'||type==='blackhole'?(realmId==='space'?190:155):112,
      speed:type==='dash'?8:5,
      duration:type==='shield'&&f.boss?({time:.28,storm:.25,ice:.58,space:.42,fire:.38,forest:.48}[realmId]||.42):type==='dash'?0.5:type==='starfall'?2.5:type==='summon'&&realmId==='forest'?6:1.7,
      count:type==='starfall'?(realmId==='space'?8:5):type==='chain'?(realmId==='storm'?6:3):type==='summon'&&realmId==='forest'?4:1,
      status:realms?({fire:'fire',ice:'ice',forest:'poison'})[realmId]||'none':(f.number===4&&['nova','zone','shot'].includes(type))?'fire':
        f.number===6&&['zone','trap','drain','dung'].includes(type)?'poison':'none'
    });
    return {name,cooldown:Number(Math.max(.4,(f.cooldown+i*.19+(isSupport?.15:0))*(realmId==='time'?.7:realmId==='storm'?.7:realmId==='forest'?.82:1)).toFixed(2)),
      trigger:f.number>=5&&i>=f.autoSkillCount?(i%2?'lowhp':'damaged'):'auto',
      threshold:70,actions:[attack]};
  });
  return {name:f.name,color:realm()?.color||(f.boss?'#7f5cce':'#b26b73'),
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
function recordKey(who){return realms?realmId+'_'+key(who):key(who);}
function updateRecord(store,who,cleared,won=false){
  const v=read(store),id=recordKey(who),old=v.records[id]||{};
  v.records[id]={name:(realm()?realm().name+' · ':'')+String(who?.name||'파이터').slice(0,30),
    best:Math.max(cap(old.best,0,FINISH),cap(cleared,0,FINISH)),
    attempts:Math.floor(cap(old.attempts,0,1000000))+(realms?(!won||cleared===FINISH?1:0):(won?0:1)),
    victories:Math.floor(cap(old.victories,0,1000000))+(won&&(!realms||cleared===FINISH)?1:0)};
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
  // A compact single flow: floor → fighter/opponent → action. Details stay optional.
  panel.innerHTML='<div class="tower-head">'
   +'<div class="tower-head-current"><span class="tower-kicker">현재 층</span>'
   +'<h2><span id="tower-floor">1 / 10F</span></h2></div>'
   +'<strong id="tower-best">최고 0F</strong></div>'
   +'<p class="tower-rule" id="tower-rule"></p>'
   +'<div class="tower-fighter-pick">'
   +'<label class="tower-hero-choice" for="tower-hero"><span>출전 캐릭터</span><select id="tower-hero"></select></label>'
   +'<details class="tower-opponent" id="tower-enemy-details">'
   +'<summary class="tower-enemy"><span class="tower-opponent-name"><small>상대</small><strong id="tower-enemy">훈련의 문</strong></span>'
   +'<span class="tower-opponent-skills"><span id="tower-skill-count">스킬 2개</span><span class="tower-chevron" aria-hidden="true">⌄</span></span></summary>'
   +'<div class="tower-opponent-detail"><p id="tower-enemy-info"></p>'
   +'<div class="tower-enemy-skills" id="tower-enemy-skills" aria-label="상대 스킬 상세"></div></div></details>'
   +'</div>'
   +'<div class="tower-buttons"><button id="tower-start" type="button">1층 시작</button>'
   +'<button id="tower-pause" type="button" hidden>⏸ 일시정지</button>'
   +'<button id="tower-abandon" type="button" hidden>도전 포기</button></div>'
   +'<p class="tower-feedback" id="tower-feedback" role="status" aria-live="polite" hidden></p>';
  mount.append(panel);
  const doorway=doc.createElement('div');doorway.className='tower-doorway';
  doorway.innerHTML='<button type="button" id="tower-back-selection" class="tower-return">← 다른 탑 선택</button>'
    +'<div class="tower-doorway-symbol" id="tower-doorway-symbol" aria-hidden="true">◷</div>'
    +'<div class="tower-doorway-text"><h2 id="tower-doorway-title">시간의 탑</h2>'
    +'<p id="tower-doorway-subtitle"></p></div>'
    +'<div class="tower-ambient-orb" aria-hidden="true"></div>';
  panel.prepend(doorway);
  let selector=null;
  if(realms){
    selector=doc.createElement('section');selector.className='tower-realm-selector';
    selector.setAttribute('aria-label','도전할 탑 선택');
    // Full panoramic clickable gallery. The six hit regions map to the six
    // 256px sections of the 1536px art, keeping visual and input alignment.
    selector.innerHTML='<div class="tower-panorama-scroll" tabindex="0" role="region" aria-label="여섯 탑 전경. 모바일에서는 좌우로 스와이프하세요.">'
      +'<div class="tower-panorama-world">'
      +'<img class="tower-panorama-art" src="assets/tower-gateway-scene.svg" alt="" draggable="false" decoding="async">'
      +'<div class="tower-realm-heading"><span>THE SIX REALMS</span><h2>도전의 탑</h2><p>탑을 선택해 도전하세요</p></div>'
      +'<div class="tower-realm-grid tower-panorama-targets">'
      +realms.REALMS.map((r,i)=>'<button type="button" data-realm="'+r.id+'" class="tower-realm-card" style="--realm-color:'+r.color+';--tower-index:'+i+'" title="'+r.name+' 도전" aria-label="'+r.name+' 입장">'
         +'<span class="tower-realm-card-caption"><span class="tower-realm-icon" aria-hidden="true">'+r.icon+'</span><strong>'+r.name+'</strong><small class="tower-realm-progress">0 / 10F</small></span></button>').join('')
      +'</div></div></div>'
      +'<p class="tower-panorama-swipe">각 탑을 누르면 해당 탑으로 들어갑니다. <span>모바일에서는 좌우로 밀어서 선택하세요.</span></p>'
      +'<div class="ancient-unlock" data-unlocked="false">'
      +'<div class="ancient-portrait">'
      +'<img class="ancient-portrait-art" src="assets/ancient-one-portrait.svg" loading="lazy" decoding="async" alt="보랏빛 우주에서 깨어난 거대한 고대 존재. 촉수로 뒤덮인 얼굴과 수많은 청록색 눈이 빛난다.">'
      +'<div class="ancient-portrait-aura" aria-hidden="true"></div>'
      +'<div class="ancient-portrait-copy"><span class="ancient-portrait-eyebrow">THE ANCIENT ONE · FINAL ENCOUNTER</span>'
      +'<h3>고대의 존재</h3>'
      +'<p class="ancient-portrait-desc">여섯 탑의 봉인 아래 잠든 존재.<br>마지막 관문을 마주할 준비가 되었는가?</p>'
      +'<p id="ancient-progress" class="ancient-portrait-progress" role="status"></p>'
      +'<button id="ancient-start" type="button" hidden><span aria-hidden="true">⚔</span> 고대의 존재에게 도전 <span aria-hidden="true">↗</span></button>'
      +'<span id="ancient-lock-note" class="ancient-portrait-lock"><span aria-hidden="true">♜</span> 여섯 탑을 정복하면 봉인이 해제됩니다</span>'
      +'</div></div></div>'
      +'<p id="tower-realm-hint" class="tower-gateway-description"></p>';
    mount.prepend(selector);
    selector.addEventListener('click',e=>{const id=e.target.closest?.('[data-realm]')?.dataset.realm;if(id)selectRealm(id);});selector.querySelector('#ancient-start')?.addEventListener('click',beginAncient);
  }
  const el=id=>doc.getElementById(id),hero=el('tower-hero'),message=el('tower-feedback'),
    start=el('tower-start'),pause=el('tower-pause'),abandon=el('tower-abandon');
  // Between floors the new opponents are already built, but the game engine
  // must remain fully stopped until an explicit Start press.
  const clearOverlay=doc.createElement('div');
  clearOverlay.id='tower-clear-overlay';
  clearOverlay.className='tower-clear-overlay';
  clearOverlay.hidden=true;
  clearOverlay.setAttribute('aria-live','polite');
  clearOverlay.innerHTML='<div class="tower-clear-panel">'
    +'<span class="tower-clear-eyebrow">FLOOR CLEARED</span>'
    +'<h3 id="tower-clear-title">층 클리어!</h3>'
    +'<p id="tower-clear-next">다음 층이 준비됐습니다.</p>'
    +'<div id="tower-blessing-choices" class="tower-blessing-choices"></div>'
    +'<button id="tower-next-start" type="button">다음 층 시작</button></div>';
  doc.querySelector?.('#tower-arena-slot .canvas-wrapper')?.append(clearOverlay);

  const nextStart=el('tower-next-start');
  let active=false,stage='ready',level=1,cleared=0,selected=null,temporary=null,mode='auto';
  let blessings=[],offers=[],encounter=null,environment=null,view='selection',ancient=false;
  const pool=()=>[...CHARACTER_DEFS,...CUSTOM_DEFS];
  function selectedDef(){return pool().find(d=>d.id===hero.value)||pool()[0]||null;}
  function current(){return {ancient,active,stage,level,cleared,boss:floor(level).boss,selected:key(selected),mode,realm:realmId,blessings:[...blessings],offers:offers.map(x=>({...x}))};}
  function selectRealm(id){
    if(active||!realms?.REALMS.some(r=>r.id===id))return false;
    ancient=false;realmId=id;view='interior';stage='ready';level=1;cleared=0;blessings=[];offers=[];encounter=null;environment?.clear?.();environment=null;
    message.textContent='';show();return true;
  }
  function allRealmsCleared(){const records=read(global.localStorage).records;return !!realms&&realms.REALMS.every(r=>Object.entries(records).some(([id,v])=>id.startsWith(r.id+'_')&&Number(v.best)>=FINISH));}
  function beginAncient(){if(active||!allRealmsCleared()||!selectRealm('space'))return false;ancient=true;level=10;show();return begin();}
  function openSelection(){
    if(active)return false;
    view='selection';show();return true;
  }
  el('tower-back-selection')?.addEventListener('click',openSelection);
  function chooseBlessing(id){
    if(stage!=='between'||!offers.some(x=>x.id===id))return false;
    blessings.push(id);offers=[];
    realms.apply(players[0],realmId,[id]);
    show();return true;
  }
  el('tower-blessing-choices')?.addEventListener('click',e=>{
    const id=e.target.closest?.('[data-blessing]')?.dataset.blessing;if(id)chooseBlessing(id);
  });
  function setMode(next){return next==='auto'&&!active;}
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
    screen.dataset.manualFocus='false'; // Automatic battles keep their regular HUD.
    screen.dataset.towerPhase=stage;
    screen.dataset.towerView=active?'interior':view;
    screen.dataset.towerRealm=realmId;
    panel.hidden=screen.dataset.towerView==='selection';
    const arenaSlot=el('tower-arena-slot');if(arenaSlot)arenaSlot.hidden=panel.hidden||stage==='ready';

    if(realms){
      const r=realm();
      el('tower-doorway-title').textContent=ancient?'고대의 존재':r.name;
      el('tower-doorway-symbol').textContent=r.icon;
      el('tower-doorway-subtitle').textContent=ancient?'여섯 탑의 봉인 너머 · 마지막 존재':r.subtitle+' · '+r.terrain;
      el('tower-back-selection').hidden=active;
    }
    if(selector){
      selector.hidden=screen.dataset.towerView!=='selection';
      for(const button of selector.querySelectorAll('[data-realm]')){
        button.setAttribute('aria-pressed',String(button.dataset.realm===realmId));
        const records=read(global.localStorage).records;
        const best=Math.max(0,...Object.entries(records)
          .filter(([id])=>id.startsWith(button.dataset.realm+'_'))
          .map(([,value])=>Math.min(FINISH,Number(value.best)||0)));
        const text=button.querySelector('.tower-realm-progress');
        if(text)text.textContent=best===FINISH?'✓ 정복 완료':'최고 '+best+' / 10F';
        button.setAttribute('aria-label',button.title+' · '+(best===FINISH?'정복 완료':'최고 '+best+'층'));
      }
      el('tower-realm-hint').textContent=realm().name+' · '+realm().hint;
      const done=realms.REALMS.filter(r=>Object.entries(read(global.localStorage).records).some(([id,v])=>id.startsWith(r.id+'_')&&Number(v.best)>=FINISH)).length;
      el('ancient-progress').textContent=done+' / 6개 탑 정복'+(done===6?' · 봉인이 해제됐습니다!':' · 모든 탑 10층을 클리어하세요.');
      el('ancient-start').hidden=done!==6;
      el('ancient-lock-note').hidden=done===6;
      const ancientCard=selector.querySelector('.ancient-unlock');
      if(ancientCard)ancientCard.dataset.unlocked=done===6?'true':'false';
      screen.style.setProperty('--realm-color',realm().color);
    }
    const choiceHost=el('tower-blessing-choices');
    if(choiceHost)choiceHost.innerHTML=offers.length?'<strong>기연을 만났습니다 · 하나를 선택하세요</strong>'+offers.map(o=>'<button type="button" data-blessing="'+o.id+'"><b>'+o.name+'</b><small>'+o.description+'</small></button>').join(''):'';
    nextStart.disabled=offers.length>0;
    const f=floor(level),best=read(global.localStorage).records[recordKey(selectedDef())]?.best||0;
    el('tower-floor').textContent=ancient?'최종 보스':level+' / '+FINISH+'F';
    el('tower-rule').textContent=ancient?'보스 HP 3,000 · 팔과 촉수를 공격':realm()?.terrain+(blessings.length?' · 기연 '+blessings.length+'개':'');
    el('tower-enemy').textContent=ancient?'☽ 고대의 존재':(f.boss?'👑 ':'')+f.name;
    el('tower-enemy-info').textContent=ancient?'HP 3,000 · 3페이즈 · 팔·촉수 공격 가능':realms&&f.boss?'HP '+f.hp+' · 패턴 공격 · 2페이즈':'HP '+f.hp+' · 공격 '+f.damage+' · 속도 '+f.speed.toFixed(1);
    el('tower-best').textContent='최고 '+best+'F';
    screen.dataset.towerTheme=f.scene;
    el('tower-skill-count').textContent=ancient?'16종 패턴':realms&&f.boss?'보스 패턴':makeEnemy(level).skills.length+'개 스킬';
    const skillHost=el('tower-enemy-skills');
    skillHost.replaceChildren();
    // Use the same generated enemy profile that is registered for combat:
    // displayed cooldowns, triggers, damage and statuses are never invented.
    if(ancient){const info=doc.createElement('p');info.textContent=global.ArenaAncientOne?.names?.join(' · ')||'차징·격자·연쇄 공격';skillHost.append(info);}
    if(realms&&f.boss&&!ancient){
      const info=doc.createElement('p');
      info.textContent=(global.ArenaEncounter?.patternNames?.(realmId,level)||[realm().pattern]).join(' · ');
      skillHost.append(info);
    }
    for(const ability of (ancient?[]:makeEnemy(level).skills)){
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
    start.textContent=ancient&&stage==='ready'?'▶ 고대의 존재 도전':stage==='between'?'▶ '+level+'층 시작':
      stage==='fighting'?'전투 진행 중':stage==='ready'?'▶ 1층 시작':'▶ 다시 도전';
    start.hidden=stage==='fighting'||stage==='between';
    clearOverlay.hidden=stage!=='between';
    // Feedback is shown only for actionable results and errors.
    message.hidden=stage==='fighting'||stage==='between'||!message.textContent;
    if(stage==='between'){
      el('tower-clear-title').textContent=cleared+'층 클리어!';
      el('tower-clear-next').textContent=level+'층 · '+f.name+' 준비 완료 · 시작을 누르면 전투가 시작됩니다.';
      nextStart.textContent='▶ '+level+'층 시작';
    }
    pause.hidden=stage!=='fighting';
    pause.textContent=isPlaying?'⏸ 일시정지':'▶ 전투 계속';
    abandon.hidden=!active;
    hero.disabled=active;
    // Automatic combat has no movement or turn-selection controls.
  }
  function cleanup(){
    encounter?.spectacle?.clear();
    global.ArenaTowerSpectacle?.page(null);
    environment?.clear?.();environment=null;
    global.ArenaTowerTerrain?.clear?.(typeof players!=='undefined'?players:[]);
    if(temporary){delete BEHAVIORS[temporary.id];temporary=null;}
  }
  function buildEnemy(){
    cleanup();
    // SkillForge's trusted registration produces the exact battle-ready AI
    // instance/behavior used by saved custom characters. Immediately detach
    // the transient definition from CUSTOM_DEFS so it never appears as a
    // saved/shared character or changes the user's roster.
    const id=global.SkillForge.register(ancient?{name:'고대의 존재의 팔',color:'#51256d',effectColor:'#e675ff',hp:500,speed:0.6,skills:[{name:'촉수의 위협',cooldown:99,trigger:'auto',actions:[action('shield',0,{duration:0.2})]}]}:makeEnemy(level),{towerEnemy:true});
    const i=CUSTOM_DEFS.findIndex(d=>d.id===id);
    if(i<0)throw Error('적 캐릭터 생성 실패');
    const def=CUSTOM_DEFS.splice(i,1)[0];
    temporary={id,def};
    return def;
  }
  function prepareFight(){
    encounter=null;
    const enemy=buildEnemy();
    if(!selected||!pool().includes(selected))throw Error('출전 캐릭터를 다시 선택하세요.');
    if(!setMatchCount(2))throw Error('2인 대전 변경 실패');
    if(!reRollMatch([selected,enemy]))throw Error('대진 구성 실패');
    if(realms){
      // Built-in fighters need their authored Forge fallback kit, while saved
      // custom fighters already carry their own authored skill loadout.
      if(!players[0].forge)global.SkillForge.enableManual(players[0]);
      players[0].manualTower=false;players[0].towerHero=true;
      realms.apply(players[0],realmId,blessings);
      players[1].towerPatternBoss=ancient||level%5===0;
      if(ancient){players[1].hp=3000;players[1].maxHp=3000;players[1].x=canvas.width/2;players[1].y=canvas.height*.18;players[1].forgeLastHp=3000;}
      players[1].towerRealm=realmId;
      players[1].towerEnemyType=(level<=4?level-1:level-2)%3;
      players[1].towerBossTier=level===10?2:level===5?1:0;
      players[1].towerLevel=level;
      if(!ancient)global.ArenaTowerTerrain?.step?.(realmId,level,players,canvas.width,canvas.height,0);
      // Environmental events share Tower's confirmed-hit damage adapter.
      const hazardDamage=(p,amount,z)=>{
        if(p.invincible>0||(p.z||p.jumpHeight||0)>38)return false;
        const status=z?.realm==='fire'?'fire':z?.realm==='forest'?'poison':'none';
        return global.SkillForge.hit(p===players[0]?players[1]:players[0],p,
          {type:'wave',damage:amount,radius:0,knockback:0,status,duration:1.5},
          1,global.AdvancedCombat?.height?.(p));
      };
      environment=!ancient?global.ArenaTowerEnvironment?.create?.({
        realm:realmId,level,width:canvas.width,height:canvas.height,roster:players,damage:hazardDamage
      }):null;
      encounter=(ancient?global.ArenaAncientOne:global.ArenaEncounter)?.create({realm:realmId,level,width:canvas.width,height:canvas.height,
        hero:players[0],boss:players[1],environmentManaged:!!environment,damage(p,amount,z){
          return hazardDamage(p,amount,z);
        }});
    }
    // Fresh combatants; run-local blessings were applied above.
    // reRollMatch leaves isPlaying=false, roundStarted=false, isGameOver=false.
    const wager=el('wager-input');if(wager)wager.value='0';
  }
  function startPrepared(){
    // Start only the already prepared combatants; never reroll them when the
    // player presses "next floor" after inspecting the next enemy's skills.
    if(!isPlaying)togglePlay({towerBattle:true});
    if(!isPlaying||!roundStarted)throw Error('전투 엔진이 시작되지 않았습니다. 자유 대전 상태를 초기화하고 다시 시도해 주세요.');
    stage='fighting';
    message.textContent='';
    show();
    global.ArenaScreenRouter?.showArena?.();
    return true;
  }
  function startFight(){
    prepareFight();
    return startPrepared();
  }
  function begin(){
    if(stage==='between'&&active){
      if(offers.length)return false;
      if(isPlaying||isGameOver)return false;
      try{return startPrepared();}
      catch(e){
        message.textContent=level+'층 시작 실패 · '+(e?.message||'알 수 없는 오류')+' · 다시 시작을 눌러 주세요.';
        show();return false;
      }
    }
    if(active||stage==='fighting')return false;
    const who=selectedDef();
    if(!who){message.textContent='캐릭터가 없습니다. 캐릭터 설계에서 먼저 만들어 주세요.';return false;}
    if(roundStarted&&!isGameOver){message.textContent='진행 중인 자유 대전을 먼저 종료해 주세요.';return false;}
    blessings=[];offers=[];encounter=null;
    message.textContent='';selected=who;active=true;view='interior';stage='ready';level=ancient?10:1;cleared=0;
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
      if(ancient){active=false;stage='lost';cleanup();message.textContent='고대의 존재에게 패배했습니다. 다시 도전할 수 있습니다.';show();return true;}
      const old=selected;active=false;stage='lost';
      updateRecord(global.localStorage,old,cleared,false);cleanup();
      message.textContent='도전 종료 · '+cleared+'층 클리어. 최고 기록이 저장됐습니다.';
      show();global.ArenaScreenRouter?.refresh?.();return true;
    }
    if(ancient){active=false;stage='won';cleanup();try{global.localStorage?.setItem('oibung-ancient-one-clear','true');}catch(_){}message.textContent='☽ 고대의 존재 토벌 성공!';show();global.ArenaScreenRouter?.refresh?.();return true;}
    cleared=level;
    updateRecord(global.localStorage,selected,cleared,true);
    if(level>=FINISH){
      active=false;stage='won';cleanup();
      message.textContent='🏆 10층 정복 성공! 최종 우승 기록이 저장됐습니다.';
      show();global.ArenaScreenRouter?.refresh?.();return true;
    }
    // Next floor is initialized but deliberately NOT started. The win
    // acknowledgement stays on screen until the player presses Start.
    level++;
    try{
      prepareFight();
      stage='between';
      if(realms&&[2,4,7].includes(cleared))offers=realms.choices(realmId,blessings);
      message.textContent='✓ '+cleared+'층 클리어! '+level+'층이 준비됐습니다. 시작 버튼을 눌러 진행하세요.';
      show();global.ArenaScreenRouter?.refresh?.();
      return true;
    }catch(e){
      active=false;stage='lost';cleanup();
      message.textContent='다음 층 준비 실패 · '+(e?.message||'알 수 없는 오류')+' · 처음부터 다시 도전할 수 있습니다.';
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
    global.ArenaTowerSpectacle?.page(null);
    if(active&&stage==='fighting'&&isPlaying)togglePlay();
  }
  start.addEventListener('click',begin);
  nextStart?.addEventListener('click',begin);
  pause.addEventListener('click',()=>{
    if(stage==='fighting'&&roundStarted&&!isGameOver){togglePlay();show();}
  });
  abandon.addEventListener('click',forfeit);
  hero.addEventListener('change',show);
   show();
  function paintBackground(ctx,canvas){
    if(!['ready','fighting','between','lost','won'].includes(stage)||
       global.ArenaScreenRouter?.active!=='tower')return false;
    const painted=global.ArenaTowerScenes?.paint?.(ctx,canvas.width,canvas.height,realm()?.scene||level)||false;
    global.ArenaTowerAtmosphere?.paint?.(ctx,canvas.width,canvas.height,realmId,level);
    if(!ancient)global.ArenaTowerTerrain?.paint?.(ctx,realmId,level,canvas.width,canvas.height,encounter?.tick||0);
    return painted;
  }
  function tickEncounter(){if(active&&stage==='fighting'){
    encounter?.step();
    environment?.step?.();
    if(!ancient)global.ArenaTowerTerrain?.step?.(realmId,level,players,canvas.width,canvas.height,encounter?.tick||0);
  }}
  function drawEncounter(ctx){if(!active||stage!=='fighting')global.ArenaTowerSpectacle?.page(null);if(active&&stage==='fighting'){global.ArenaTowerAtmosphere?.particles?.(ctx,canvas.width,canvas.height,realmId,encounter?.tick||0);environment?.draw?.(ctx);encounter?.draw(ctx,realm()?.color);}}
  const api={beginAncient,allRealmsCleared,selectRealm,openSelection,chooseBlessing,tickEncounter,drawEncounter,get encounter(){return encounter;},get environment(){return environment;},floor,makeEnemy,read,updateRecord,records,begin,forfeit,paintBackground,
    onBattleEnd,isTransientDef,pauseAway,refresh:show,setMode,get mode(){return mode;},get active(){return active;},
    get stage(){return stage;},get view(){return active?'interior':view;},get state(){return current();}};
  global.ArenaTower=api;return api;
}
global.ArenaTowerModel={floor,makeEnemy,read,updateRecord,key,skillDetail};
if(typeof document!=='undefined')install();
})(window);
