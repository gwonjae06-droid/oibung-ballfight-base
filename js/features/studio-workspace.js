/* Studio workspace: concise Skills/Appearance tabs and a small live, read-only
 * motion sketch. It previews the validated ability draft; it never casts,
 * mutates battle players, starts matches, or stores a character. */
(function(global){
'use strict';
const dialog=document.getElementById('character-studio-dialog');
const studio=dialog?.querySelector('.forge-studio');
const shell=dialog?.querySelector('.character-studio-shell');
const content=dialog?.querySelector('.character-studio-content');
if(!dialog||!studio||!shell||!content||!global.SkillForge)return;
const pick=selector=>studio.querySelector(selector);
const random=pick('.forge-random-entry'),name=pick('.forge-name');
const blocks=pick('.block-forge'),tuning=pick('.forge-tuning'),library=pick('.forge-library');
const appearance=pick('.character-art-editor');
const basics=Array.from(studio.children).find(n=>n.tagName==='DETAILS'&&n.querySelector('summary')?.textContent.includes('외형'));
const create=pick('.forge-primary-actions'),saved=pick('.forge-saved');
// The existing roster lived inside a collapsed JSON/share drawer, so even
// saved fighters had no visible delete control. Move the original, already
// event-bound list into a compact always-visible section near the top.
const owned=pick('#bf-custom-list'),feedback=pick('#bf-result');
const manager=document.createElement('section');
manager.className='studio-roster-manager';
manager.setAttribute('aria-label','커스텀 캐릭터 삭제 및 관리');
manager.innerHTML='<div class="studio-roster-heading"><strong>내 커스텀 캐릭터</strong>'
  +'<span id="forge-custom-count" aria-label="저장한 캐릭터 수"></span></div>'
  +'<label class="studio-roster-search" for="forge-roster-filter"><span>캐릭터 이름 검색</span>'
  +'<input id="forge-roster-filter" type="search" placeholder="이름으로 찾기" autocomplete="off" aria-describedby="forge-roster-filter-status"></label>'
  +'<span id="forge-roster-filter-status" class="studio-roster-search-status" role="status" aria-live="polite"></span>'
  +'<span class="studio-roster-guide">스킬 수정으로 언제든 재편집 · 삭제는 확인 후 진행</span>';
if(owned)manager.append(owned);
if(feedback)manager.append(feedback);
const rest=Array.from(studio.children).filter(n=>![random,name,blocks,tuning,library,appearance,basics,create,saved].includes(n));
const tabs=document.createElement('div');
tabs.className='studio-category-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','캐릭터 제작 카테고리');
tabs.innerHTML='<button type="button" id="studio-tab-skills" role="tab" aria-selected="true" aria-controls="studio-panel-skills" tabindex="0">⚡ 스킬 코딩</button>'
  +'<button type="button" id="studio-tab-appearance" role="tab" aria-selected="false" aria-controls="studio-panel-appearance" tabindex="-1">🎨 외형 꾸미기</button>';
const skills=document.createElement('section'),looks=document.createElement('section');
skills.id='studio-panel-skills';looks.id='studio-panel-appearance';
skills.className='studio-category-panel';looks.className='studio-category-panel';
skills.setAttribute('role','tabpanel');looks.setAttribute('role','tabpanel');
skills.setAttribute('aria-labelledby','studio-tab-skills');
looks.setAttribute('aria-labelledby','studio-tab-appearance');
looks.hidden=true;
[blocks,random,tuning,library,...rest].filter(Boolean).forEach(node=>skills.append(node));
[basics,appearance].filter(Boolean).forEach(node=>looks.append(node));
// Keep live code blocks at the beginning of the editing column. The saved
// fighter manager stays accessible below the primary Save action.
studio.replaceChildren(...[name,tabs,skills,looks,create,manager,saved].filter(Boolean));
// Refresh the count and rows after moving their original DOM container.
global.SkillForge.refreshList?.();
let motion=null;
function selectTab(tab,focus=false){
  const showLooks=tab==='appearance';
  looks.hidden=!showLooks;skills.hidden=showLooks;
  motion?.setVisible?.(!showLooks);
  tabs.querySelectorAll('[role="tab"]').forEach((button,index)=>{
    const active=showLooks?index===1:index===0;
    button.setAttribute('aria-selected',String(active));
    button.tabIndex=active?0:-1;
    if(active&&focus)button.focus();
  });
}
tabs.addEventListener('click',event=>{
  const button=event.target.closest('[role="tab"]');if(!button)return;
  selectTab(button.id==='studio-tab-appearance'?'appearance':'skills');
});
tabs.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const current=looks.hidden?'skills':'appearance';
  const next=event.key==='Home'?'skills':event.key==='End'?'appearance':
    current==='skills'?'appearance':'skills';
  selectTab(next,true);
});


const preview=document.createElement('section');
preview.className='studio-motion-preview';
preview.setAttribute('aria-label','왼쪽 고정 동작 미리보기 · 실제 전투 데이터와 분리됨');
preview.innerHTML=
  '<div class="studio-motion-header"><strong>동작 미리보기</strong><small>선택한 코드 블록의 동작을 실시간 확인 · 실제 피해 없음</small></div>'
  +'<div class="studio-motion-body"><div class="studio-motion-stage"><canvas id="studio-motion-canvas" width="480" height="180" aria-label="2D 캐릭터가 훈련 더미 앞에서 설정한 스킬을 시연하는 화면"></canvas></div>'
  +'<div class="studio-motion-info"><label for="studio-motion-select">미리볼 스킬</label><select id="studio-motion-select" aria-label="미리보기 스킬 선택"></select>'
  +'<span id="studio-motion-caption" aria-live="off">스킬을 조합하면 동작을 보여줍니다.</span><span id="studio-motion-cooldown"></span></div></div>'
  +'<div class="studio-motion-footer"><div class="studio-motion-buttons"><button id="studio-motion-play" type="button">⏸ 일시정지</button>'
  +'<button id="studio-motion-replay" type="button">↺ 다시보기</button>'
  +'<label>속도 <select id="studio-motion-speed" aria-label="미리보기 속도"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label></div>'
  +'<div class="studio-motion-progress" role="progressbar" aria-label="시연 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="studio-motion-fill"></div></div></div>';
shell.insertBefore(preview,content);
const canvas=preview.querySelector('canvas'),ctx=canvas.getContext('2d');
if(!ctx)return;
const caption=preview.querySelector('#studio-motion-caption');
const cooldown=preview.querySelector('#studio-motion-cooldown');
const choose=preview.querySelector('#studio-motion-select');
const playButton=preview.querySelector('#studio-motion-play');
const replayButton=preview.querySelector('#studio-motion-replay');
const speed=preview.querySelector('#studio-motion-speed');
const fill=preview.querySelector('#studio-motion-fill');
const track=preview.querySelector('.studio-motion-progress');
const TAU=Math.PI*2,WIDTH=480,HEIGHT=180;
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const MOVE=global.ActionRegistry?new Set([...global.ActionRegistry.byGroup('mobility'),'flight','burrow','dive','burrowdash']):new Set(['dash','blink','swap','retreat','flight','burrow','leap','hover','glide','dive','burrowdash','portal']);
const PURE=global.ActionRegistry?.MOVEMENT_ONLY||new Set(['dash','blink','swap','retreat','leap','hover','glide','portal']);
const FIST=global.ActionRegistry?.FAMILIES.fist||new Set(['uppercut','aircombo']);
const PROJECTILE=global.ActionRegistry?new Set(global.ActionRegistry.entries().filter(d=>d.physics==='projectile'||d.id==='beam'||d.id==='chain').map(d=>d.id)):new Set(['shot','homing','pierce','boomerang','arcshot','splitshot','dung','meteor','starfall','bolt','chain','beam']);
const DEFENSE=global.ActionRegistry?new Set([...global.ActionRegistry.byGroup('defense'),'timestop','timeburst','grow','shrink','wall']):new Set(['heal','shield','cleanse','haste','regen','fortify','lifebloom','resurrect','rewind','grow','shrink','timeburst','timestop','wall']);
const EXPLOSION=global.ActionRegistry?.FAMILIES.explosion||new Set(['nova','meteor','mine','erupt','dive']);
const R=global.ActionRegistry;
const belongs=(type,family)=>R?.get(type)?R.get(type).family===family:
    ({movement:MOVE,fist:FIST,projectile:PROJECTILE,explosion:EXPLOSION}[family]?.has(type)||false);
const isMoving=type=>R?.get(type)?R.get(type).category==='mobility'||['flight','burrow','dive','burrowdash'].includes(type):MOVE.has(type);
const isRanged=type=>R?.get(type)?R.get(type).physics==='projectile'||R.get(type).id==='beam'||R.get(type).id==='chain':PROJECTILE.has(type);
const isDefense=type=>R?.get(type)?R.get(type).category==='defense'||DEFENSE.has(type):DEFENSE.has(type);
const duration=a=>R?.duration(a.type)||(PROJECTILE.has(a.type)?1050:MOVE.has(a.type)?850:EXPLOSION.has(a.type)?1120:950);
const label=t=>global.SkillForge.TYPE[t]||t||'동작';
let focus=0,profile=null,sequence=null,elapsed=0,raf=0,stamp=null,playing=true,shown=true;
let lastText='',lastPicker='',pickedIndex=-1;
const reduced=()=>!!global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
// Only the preview planner uses these values: no global engine clocks change.
const plan=global.StudioMotionModel.plan;

function circle(x,y,r,fill,stroke){
  ctx.beginPath();ctx.arc(x,y,Math.max(.5,r),0,TAU);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.lineWidth=2;ctx.strokeStyle=stroke;ctx.stroke();}
}
function line(x1,y1,x2,y2,color,width=2){
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
  ctx.lineWidth=width;ctx.strokeStyle=color;ctx.lineCap='round';ctx.stroke();
}
function fighter(x,y,r,color,initial,custom=false){
  ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.clip();
  if(custom&&global.CharacterStudioArt?.hasArtwork&&global.CharacterStudioArt.canvas){
    try{ctx.drawImage(global.CharacterStudioArt.canvas,x-r,y-r,r*2,r*2);}
    catch(_){ctx.fillStyle=color;ctx.fill();}
  }else{
    ctx.fillStyle=color;ctx.fill();
    ctx.fillStyle='#fff';ctx.font='800 15px "Noto Sans KR",sans-serif';
    ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(initial,x,y);
  }
  ctx.restore();
  circle(x,y,r,null,'#edf5fc');
}
function arm(x,y,action,t,color){
  if(!belongs(action.type,'fist')&&!isRanged(action.type))return;
  const fraction=Math.sin(Math.PI*clamp(t*1.15,0,1));
  const angle=action.type==='uppercut'?-.85*fraction:0;
  const reach=14+fraction*(belongs(action.type,'fist')?33:22);
  const handX=x+Math.cos(angle)*reach,handY=y+Math.sin(angle)*reach;
  line(x+8,y,handX,handY,'#263743',9);
  line(x+8,y,handX,handY,color,5);
  circle(handX,handY,6,'#eed3ad','#273341');
}
function render(time){
  if(!sequence)return;
  const events=sequence.events;
  const active=events.filter(e=>time>=e.start&&time<e.end).slice(-3);
  const primary=active.at(-1);
  const a=primary?.action||{type:'wave'},type=a.type;
  const progress=primary?clamp((time-primary.start)/primary.length,0,1):0;
  const color=profile.effectColor||'#ab92da';
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  ctx.fillStyle='#16232e';ctx.fillRect(0,0,WIDTH,HEIGHT);
  for(let i=20;i<WIDTH;i+=40)line(i,0,i,HEIGHT,'rgba(170,200,221,.08)',1);
  line(0,149,WIDTH,149,'#3a5261',1);
  const moving=events.filter(e=>isMoving(e.action.type)&&time>=e.start).at(-1);
  const isMovingNow=Boolean(moving&&time<moving.end);
  const move=moving?clamp((time-moving.start)/moving.length,0,1):0;
  // Retain the destination after a mobility action, so follow-up punches
  // visibly occur next to their target rather than from the old position.
  const direction=moving?.action.type==='retreat'?-1:1;
  const distance=direction*(moving?.action.type==='glide'||moving?.action.type==='hover'?105:206);
  const fraction=clamp(move*1.65,0,1);
  const slide=moving?distance*Math.sin(fraction*Math.PI*.5):0;
  const flight=isMovingNow&&['leap','hover','glide','flight','dive'].includes(moving.action.type)?43*Math.sin(Math.PI*move):0;
  const hx=113+slide,hy=126-flight,tx=366,ty=126;
  circle(tx,151,24,'rgba(0,0,0,.19)');
  circle(hx,151,24,'rgba(0,0,0,.18)');
  fighter(tx,ty,21,'#546e80','적');
  ctx.font='700 11px sans-serif';ctx.textAlign='center';ctx.fillStyle='#bdd5e0';
  ctx.fillText('훈련 더미',tx,87);
  if(isMovingNow&&!reduced()){
    for(let i=3;i>=1;i--){ctx.globalAlpha=.12*i/3;
      circle(hx-distance*.1*i,hy+4*i,21,color);
    }ctx.globalAlpha=1;
  }
  for(const e of active){
    const t=clamp((time-e.start)/e.length,0,1),kind=t<.23?'prepare':t<.7?'cast':'impact';
    const q=kind==='prepare'?t/.23:kind==='cast'?(t-.23)/.47:(t-.7)/.3;
    const skillType=e.action.type;
    const targetSide=R?.get(skillType)?R.get(skillType).preview.anchor==='target':EXPLOSION.has(skillType)||['blackhole','starfall','mine','zone'].includes(skillType);
    const casterSide=isDefense(skillType)||['wave','nova','pull','orbit','timestop','rewind','timeburst'].includes(skillType);
    const x=targetSide?tx:casterSide?hx:hx+35,y=targetSide?ty:casterSide?hy:hy-4;
    if(kind==='prepare'){
      circle(x,y,22+7*q,null,color);
    }else{
      // Reuse the SAME family renderer as live combat, without casting or
      // producing sound/HP/particles in the live simulation.
      global.SkillVisuals?.previewFrame?.(ctx,{type:skillType,phase:kind,progress:q,x,y,
        angle:0,radius:clamp(Number(e.action.radius)||95,35,125),color});
    }
    if(kind==='cast'&&isRanged(skillType)&&!['bolt','meteor','starfall','chain','beam'].includes(skillType)){
      const px=hx+(tx-hx)*q,py=hy+(ty-hy)*q-(skillType==='arcshot'?34:5)*Math.sin(Math.PI*q);
      line(px-18,py+2,px-7,py,'#aacada',2);circle(px,py,6,color);
    }
    if(kind==='impact'&&!R?.isMovement(skillType)&&!PURE.has(skillType)&&!isDefense(skillType))
      circle(tx,ty,5+12*(1-q),'rgba(235,164,100,.35)');
  }
  fighter(hx,hy,21,profile.color||'#8ba4ed',(profile.name||'나')[0],true);
  for(const e of active)arm(hx,hy,e.action,(time-e.start)/e.length,color);
  ctx.fillStyle='rgba(15,28,40,.9)';ctx.fillRect(10,9,WIDTH-20,29);
  ctx.textAlign='left';ctx.font='700 13px "Noto Sans KR",sans-serif';ctx.fillStyle='#f3f7fa';
  const skillText=primary?(primary.skillIndex+1)+'번 · '+label(type):'다음 동작 준비';
  ctx.fillText(skillText,20,28);
  ctx.textAlign='right';ctx.font='700 11px sans-serif';ctx.fillStyle='#aaccdf';
  ctx.fillText(primary?(progress<.23?'예고':progress<.7?'실행':'마무리'):'대기',WIDTH-20,28);
  const text=primary?primary.skillName+' · '+label(type)+' · '+
    (primary.link==='with'?'동시 실행':primary.link==='after'?'순차 실행':'연결 실행'):
    '다음 동작 준비';
  if(text!==lastText){caption.textContent=text;lastText=text;}
  const pct=Math.round(time/sequence.duration*100);
  fill.style.width=pct+'%';track.setAttribute('aria-valuenow',String(pct));
}
function dpi(){
  const ratio=clamp(global.devicePixelRatio||1,1,2);
  if(canvas.width!==WIDTH*ratio||canvas.height!==HEIGHT*ratio){
    canvas.width=WIDTH*ratio;canvas.height=HEIGHT*ratio;
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.imageSmoothingEnabled=true;
  }
}
function draw(ms){dpi();render(clamp(ms,0,sequence?.duration||1));}
function refresh(reset=false){
  const draft=global.SkillForge.getDraft();
  const old=focus;
  profile=draft;
  sequence=plan(draft,focus);
  const options=sequence.skills.map((skill,i)=>String(i)+':'+String(skill.name));
  const pickerKey=options.join('|')+'|'+String(draft.allAbilities);
  if(pickerKey!==lastPicker){
    lastPicker=pickerKey;choose.replaceChildren();
    const add=(value,label)=>{const opt=document.createElement('option');opt.value=value;opt.textContent=label;choose.appendChild(opt);};
    add('all','전체 스킬 · 독립 쿨타임');
    sequence.skills.forEach((skill,i)=>add(String(i),(i+1)+'. '+String(skill.name||'스킬').slice(0,22)));
  }
  choose.value=String(focus);
  if(reset)elapsed=0;
  elapsed=Math.min(elapsed,sequence.duration);
  const selected=sequence.skills[focus]||sequence.skills[0];
  cooldown.textContent=focus==='all'?'스킬 '+sequence.skills.length+'개를 각자의 쿨타임으로 시연합니다.':
    '발동: '+(global.SkillForge.TRIGGER[selected?.trigger]||'자동')+' · 개별 쿨타임 '+(selected?.cooldown||3)+'초';
  draw(elapsed);
}
function stop(){
  if(raf){global.cancelAnimationFrame(raf);raf=0;}
  stamp=null;
}
function frame(timestamp){
  raf=0;
  if(!dialog.open||document.hidden||!shown){stop();return;}
  if(stamp===null)stamp=timestamp;
  const dt=Math.min(65,Math.max(0,timestamp-stamp));stamp=timestamp;
  if(playing&&!reduced()){
    elapsed+=dt*Number(speed.value);
    if(elapsed>=sequence.duration)elapsed%=sequence.duration;
    draw(elapsed);
  }
  if(playing&&!reduced())raf=global.requestAnimationFrame(frame);
}
function start(){
  stop();refresh();
  if(playing&&!reduced()&&dialog.open&&shown&&!document.hidden)
    raf=global.requestAnimationFrame(frame);
}
function setVisible(on){shown=!!on;if(!shown)stop();else start();}
function selectSkill(si,index=-1){
  focus=si==='all'?'all':Number(si)||0;
  elapsed=0;refresh(true);
  const found=sequence.events.find(e=>e.skillIndex===focus&&e.actionIndex===Number(index));
  if(found)elapsed=found.start;
  draw(elapsed);start();
}
function updateToggle(){
  playButton.textContent=playing?'⏸ 일시정지':'▶ 재생';
  playButton.setAttribute('aria-pressed',String(playing));
}
choose.addEventListener('change',()=>selectSkill(choose.value));
playButton.addEventListener('click',()=>{
  playing=!playing;updateToggle();
  if(playing)start();else stop();
});
replayButton.addEventListener('click',()=>{elapsed=0;playing=!reduced();updateToggle();start();});
speed.addEventListener('change',()=>{stamp=null;draw(elapsed);});
preview.addEventListener('click',e=>{if(e.target===canvas){elapsed=0;draw(0);}});
dialog.addEventListener('close',stop);
if(typeof global.addEventListener==='function'){
  global.addEventListener('studio:open',start);
  global.addEventListener('studio:close',stop);
  global.addEventListener('resize',()=>draw(elapsed));
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(dialog.open)start();});
// Also listen to the advanced editor, whose numeric inputs update the draft.
studio.addEventListener('input',()=>refresh());
studio.addEventListener('change',()=>refresh());
playing=!reduced();updateToggle();
refresh(true);
if(dialog.open)start();
motion={setVisible,refresh,selectSkill,plan,get timeline(){return sequence;},get time(){return elapsed;}};
global.CharacterStudioWorkspace={selectTab,refresh:()=>refresh(),
  setPreviewVisible:on=>motion?.setVisible?.(on),
  selectPreviewSkill:(si,index)=>selectSkill(si,index),
  previewSkill:(si,index)=>{selectTab('skills');selectSkill(si,index);},
  planPreview:plan,get activeTab(){return looks.hidden?'skills':'appearance';},
  get previewTimeline(){return sequence;}};

})(window);