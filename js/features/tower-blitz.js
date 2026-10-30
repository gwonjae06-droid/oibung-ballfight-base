/* Blitz tower: timed simultaneous plans using the existing Forge combat pipeline.
 * No changes to saved fighters, rankings, auto-battle or original manual mode. */
(function(global){
'use strict';
const doc=global.document,slot=doc?.getElementById('tower-arena-slot');
if(!slot)return;
const ui=doc.createElement('section');
ui.id='tower-blitz';ui.className='tower-blitz';ui.hidden=true;
ui.setAttribute('aria-label','블리츠 동시 행동 선택');
ui.innerHTML='<div class="tower-blitz-head"><strong>⚡ BLITZ BATTLE</strong><span id="tower-blitz-clock">전투 준비</span></div>'
  +'<div id="tower-blitz-vitals">내 HP — · 적 HP —</div>'
  +'<div class="tower-blitz-fields"><label>기동<select id="tower-blitz-move">'
  +'<option value="approach">접근</option><option value="retreat">후퇴</option>'
  +'<option value="left">좌측 우회</option><option value="right">우측 우회</option>'
  +'<option value="hold">방어</option></select></label>'
  +'<label>첫 스킬<select id="tower-blitz-first"></select></label>'
  +'<label>연계 스킬<select id="tower-blitz-second"></select></label></div>'
  +'<button id="tower-blitz-lock" type="button">이 행동 확정</button>'
  +'<p id="tower-blitz-message" aria-live="polite">기동과 스킬을 선택하세요.</p>';
slot.append(ui);
const el=id=>doc.getElementById(id);
let hero=null,foe=null,phase='idle',round=0,deadline=0,locked=false,
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
 hero=a;foe=b;phase='idle';round=0;locked=false;plan=null;foePlan=null;
 if(!hero?.forge||!foe?.forge)return false;
 if(!global.SkillForge?.enableManual?.(hero)||!global.SkillForge?.enableManual?.(foe))return false;
 fill();refresh();return true;
}
function start(){
 if(!hero||!foe)return false;
 phase='plan';round=1;deadline=Date.now()+4500;locked=false;plan=null;foePlan=null;
 refresh();return true;
}
function choose(){
 if(!running()||phase!=='plan'||locked)return false;
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
 if(!plan)choose();
 plan||={move:'hold',slots:[]};
 foePlan=autoSelect();
 phase='execute';executionFrames=0;
 for(const [p,e,choice] of [[hero,foe,plan],[foe,hero,foePlan]]){
  const d=Math.hypot(e.x-p.x,e.y-p.y)||1,dx=(e.x-p.x)/d,dy=(e.y-p.y)/d;
  const move=choice.move,sign=move==='retreat'?-1:move==='hold'?0:1;
  p.blitzX=move==='left'?-dy:move==='right'?dy:dx*sign;
  p.blitzY=move==='left'?dx:move==='right'?-dx:dy*sign;
  if(move==='hold')p.invincible=Math.max(p.invincible||0,18);
  if(choice.slots.length)global.SkillForge.manualCast(p,choice.slots[0],e);
 }
 refresh();
}
function beforeStep(){
 if(!running())return false;
 if(phase==='plan'){
  if(locked||Date.now()>=deadline)beginExecution();
  else{refresh();return false;}
 }
 if(phase!=='execute')return false;
 executionFrames++;
 if(executionFrames===40){
  for(const [p,e,choice] of [[hero,foe,plan],[foe,hero,foePlan]])
   if(choice?.slots?.length>1)global.SkillForge.manualCast(p,choice.slots[1],e);
 }
 if(executionFrames>=96){
  phase='plan';round++;deadline=Date.now()+3300;locked=false;plan=null;foePlan=null;
  for(const p of [hero,foe])if(p){p.blitzX=0;p.blitzY=0;p.vx=0;p.vy=0;}
  fill();refresh();return false;
 }
 if(executionFrames%8===0)refresh();
 return true;
}
function update(p,target){
 if(!running()||phase!=='execute'||(p!==hero&&p!==foe))return false;
 const speed=Math.max(.6,Math.min(5,Number(p.forge?.speed)||2.4))*(p.speedMultiplier||1);
 if(p.towerPatternBoss){p.vx=0;p.vy=0;}
 else if(!(p.forgeDash>0)){p.vx=p.blitzX*speed;p.vy=p.blitzY*speed;}
 global.SkillForge.manualUpdate(p,target);
 return true;
}
function stop(){phase='idle';hero=null;foe=null;plan=null;locked=false;ui.hidden=true;}
function refresh(){
 const visible=ready()&&phase!=='idle';
 ui.hidden=!visible;
 if(!visible)return;
 const active=phase==='plan',disabled=!active||locked||!running();
 for(const id of ['tower-blitz-move','tower-blitz-first','tower-blitz-second','tower-blitz-lock'])el(id).disabled=disabled;
 el('tower-blitz-clock').textContent=round+'라운드 · '+(active?'선택 '+Math.max(0,(deadline-Date.now())/1000).toFixed(1)+'초':'동시 실행');
 el('tower-blitz-message').textContent=active?(locked?'✓ 행동 확정 · 실행 준비 중':'이동과 스킬을 골라 확정하세요. 미선택 시 방어합니다.'):'⚔ 양쪽 행동 동시 실행 · 다음 라운드 준비';
 el('tower-blitz-vitals').textContent='내 HP '+Math.ceil(Math.max(0,hero?.hp||0))+' / '+(hero?.maxHp||0)
  +'  ·  적 HP '+Math.ceil(Math.max(0,foe?.hp||0))+' / '+(foe?.maxHp||0);
 const skillSet=skills(hero);
 for(const id of ['tower-blitz-first','tower-blitz-second']){
  const select=el(id);
  for(const option of select.options){
   const index=Number(option.value);
   if(index<0){option.disabled=false;continue;}
   const skill=skillSet[index],cd=global.SkillForge.cooldownFrames(hero,skill);
   option.disabled=!!skill&&((hero.forgeTicks[index]||0)<cd);
  }
 }
}
global.ArenaBlitzTower={prepare,start,choose,stop,refresh,beforeStep,update,get phase(){return phase;},get round(){return round;}};
})(window);
