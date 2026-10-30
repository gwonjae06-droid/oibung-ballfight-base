/* Blitz tower: alternating turn actions using the existing Forge combat pipeline.
 * No changes to saved fighters, rankings, auto-battle or original manual mode. */
(function(global){
'use strict';
const doc=global.document,slot=doc?.getElementById('tower-arena-slot');
if(!slot)return;
const ui=doc.createElement('section');
ui.id='tower-blitz';ui.className='tower-blitz';ui.hidden=true;
ui.setAttribute('aria-label','블리츠 턴제 전투');
ui.innerHTML='<div class="tower-blitz-head"><strong>⚡ 블리츠 턴제</strong><span id="tower-blitz-clock">전투 준비</span></div>'
  +'<div id="tower-blitz-vitals">내 HP — · 적 HP —</div>'
  +'<div class="tower-blitz-fields"><label>기동<select id="tower-blitz-move">'
  +'<option value="approach">접근</option><option value="retreat">후퇴</option>'
  +'<option value="left">좌측 우회</option><option value="right">우측 우회</option>'
  +'<option value="hold">방어</option></select></label>'
  +'<label>첫 스킬<select id="tower-blitz-first"></select></label>'
  +'<label>연계 스킬<select id="tower-blitz-second"></select></label></div>'
  +'<button id="tower-blitz-lock" type="button">이 행동 확정</button>'
  +'<p id="tower-blitz-message" aria-live="polite">내 턴에 기동과 스킬을 선택하세요.</p>'
  +'<small>PC: 1~5 기동 · Q/E/R/F 첫 스킬 · Shift+Q/E/R/F 연계 · Enter 확정</small>';
slot.append(ui);
const el=id=>doc.getElementById(id);
let hero=null,foe=null,phase='idle',round=0,activeSide=0,locked=false,
    executionFrames=0,plan=null,foePlan=null;
const ready=()=>global.ArenaTower?.active&&global.ArenaTower?.mode==='blitz'&&
 global.ArenaTower?.stage==='fighting'&&global.ArenaScreenRouter?.active==='tower'&&
 global.ArenaScreenRouter?.activeTowerTab==='tower';
const running=()=>ready()&&typeof isPlaying!=='undefined'&&isPlaying&&
 typeof isGameOver!=='undefined'&&!isGameOver;
function skills(p){return p?.forge?.skills?.slice(0,4)||[];}
function fill(){
 for(const id of ['tower-blitz-first','tower-blitz-second']){
  const select=el(id);select.replaceChildren();
  const none=doc.createElement('option');none.value='-1';none.textContent='사용 안 함';select.append(none);
  skills(hero).forEach((skill,i)=>{
   const option=doc.createElement('option');option.value=String(i);
   option.textContent=(i+1)+'. '+skill.name;select.append(option);
  });
 }
 el('tower-blitz-first').value=skills(hero).length?'0':'-1';
 el('tower-blitz-second').value=skills(hero).length>1?'1':'-1';
}
function prepare(a,b){
 hero=a;foe=b;phase='idle';round=0;activeSide=0;locked=false;plan=null;foePlan=null;
 if(!hero?.forge||!foe?.forge)return false;
 if(!global.SkillForge?.enableManual?.(hero)||!global.SkillForge?.enableManual?.(foe))return false;
 fill();refresh();return true;
}
function start(){
 if(!hero||!foe)return false;
 phase='plan';round=1;activeSide=0;locked=false;plan=null;foePlan=null;
 refresh();return true;
}
function choose(){
 if(!running()||phase!=='plan'||activeSide!==0||locked)return false;
 const slots=[el('tower-blitz-first').value,el('tower-blitz-second').value]
  .map(Number).filter((n,i,all)=>Number.isInteger(n)&&n>=0&&n<skills(hero).length&&all.indexOf(n)===i);
 plan={move:el('tower-blitz-move').value,slots};
 locked=true;refresh();return true;
}
el('tower-blitz-lock').addEventListener('click',choose);
function autoSelect(){
 const d=Math.hypot(foe.x-hero.x,foe.y-hero.y);
 const slots=skills(foe).map((s,i)=>({i,ok:(foe.forgeTicks[i]||0)>=global.SkillForge.cooldownFrames(foe,s)}))
  .filter(v=>v.ok).slice(0,2).map(v=>v.i);
 return {move:foe.towerPatternBoss?'hold':d<85?'retreat':'approach',slots};
}
function beginExecution(){
 const p=activeSide===0?hero:foe,e=activeSide===0?foe:hero;
 const choice=activeSide===0?(plan||{move:'hold',slots:[]}):autoSelect();
 if(activeSide===1)foePlan=choice;
 phase='execute';executionFrames=0;
 for(const fighter of [hero,foe]){
  fighter.blitzX=fighter.blitzY=0;fighter.vx=fighter.vy=0;
 }
 const d=Math.hypot(e.x-p.x,e.y-p.y)||1,dx=(e.x-p.x)/d,dy=(e.y-p.y)/d;
 const move=choice.move,sign=move==='retreat'?-1:move==='hold'?0:1;
 p.blitzX=move==='left'?-dy:move==='right'?dy:dx*sign;
 p.blitzY=move==='left'?dx:move==='right'?-dx:dy*sign;
 if(move==='hold')p.invincible=Math.max(p.invincible||0,18);
 if(choice.slots.length)global.SkillForge.manualCast(p,choice.slots[0],e);
 refresh();
}
function beforeStep(){
 if(!running())return false;
 if(phase==='plan'){
  if(activeSide===0&&!locked){refresh();return false;}
  beginExecution();
 }
 if(phase!=='execute')return false;
 executionFrames++;
 const p=activeSide===0?hero:foe,e=activeSide===0?foe:hero;
 const choice=activeSide===0?plan:foePlan;
 if(executionFrames===34&&choice?.slots?.length>1)
  global.SkillForge.manualCast(p,choice.slots[1],e);
 if(executionFrames>=84){
  phase='plan';round++;activeSide=1-activeSide;locked=false;plan=null;foePlan=null;
  for(const fighter of [hero,foe]){
   fighter.blitzX=fighter.blitzY=0;fighter.vx=fighter.vy=0;
  }
  if(activeSide===0)fill();
  refresh();return false;
 }
 if(executionFrames%8===0)refresh();
 return true;
}
function update(p,target){
 if(!running()||phase!=='execute'||(p!==hero&&p!==foe))return false;
 const active=p===(activeSide===0?hero:foe);
 const speed=Math.max(.6,Math.min(5,Number(p.forge?.speed)||2.4))*(p.speedMultiplier||1);
 if(!active||p.towerPatternBoss){p.vx=0;p.vy=0;}
 else if(!(p.forgeDash>0)){p.vx=p.blitzX*speed;p.vy=p.blitzY*speed;}
 global.SkillForge.manualUpdate(p,target);
 return true;
}
function stop(){phase='idle';hero=null;foe=null;plan=null;locked=false;activeSide=0;ui.hidden=true;}
function refresh(){
 const visible=ready()&&phase!=='idle';
 ui.hidden=!visible;if(!visible)return;
 const myTurn=activeSide===0,planning=phase==='plan';
 const disabled=!myTurn||!planning||locked||!running();
 for(const id of ['tower-blitz-move','tower-blitz-first','tower-blitz-second','tower-blitz-lock'])
  el(id).disabled=disabled;
 el('tower-blitz-clock').textContent=round+'턴 · '+(myTurn?'내 턴':'적 턴')+
  ' · '+(planning?'행동 선택':'실행 중');
 el('tower-blitz-message').textContent=!planning?
  (myTurn?'⚔ 내 행동 실행 중':'⚔ 적이 행동하고 있습니다.'):
  !myTurn?'적의 차례입니다. 다음 내 턴을 준비하세요.':
  locked?'✓ 행동 확정 · 실행 준비 중':
  '내 턴입니다. 천천히 기동과 스킬을 선택하세요.';
 el('tower-blitz-vitals').textContent='내 HP '+Math.ceil(Math.max(0,hero?.hp||0))+' / '+(hero?.maxHp||0)
  +'  ·  적 HP '+Math.ceil(Math.max(0,foe?.hp||0))+' / '+(foe?.maxHp||0);
 const kit=skills(hero);
 for(const id of ['tower-blitz-first','tower-blitz-second']){
  for(const option of el(id).options){
   const index=Number(option.value);
   if(index<0){option.disabled=false;continue;}
   const skill=kit[index];
   option.disabled=!!skill&&((hero.forgeTicks[index]||0)<global.SkillForge.cooldownFrames(hero,skill));
  }
 }
}
global.ArenaBlitzTower={prepare,start,choose,stop,refresh,beforeStep,update,get phase(){return phase;},get round(){return round;},get activeSide(){return activeSide;}};
})(window);
