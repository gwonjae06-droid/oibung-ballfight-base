/* Tower-only manual input. Keeps one shared physics/skill pipeline.
 * Keyboard for PC, analogue pointer joystick + skill buttons for touch. */
(function(global){
'use strict';
const doc=global.document,slot=doc?.getElementById('tower-arena-slot');
if(!slot||!global.ArenaTower)return;
const controls=doc.createElement('section');
controls.id='tower-manual-controls';
controls.className='tower-manual-controls';
controls.hidden=true;
controls.setAttribute('aria-label','도전의 탑 직접 조종');
controls.innerHTML='<div class="tower-manual-head"><strong>직접 조종</strong><span>PC: WASD/방향키 이동 · Q/E/R/F 스킬</span></div>'
  +'<div class="tower-manual-layout">'
  +'<div class="tower-joystick-area"><div class="tower-joystick" id="tower-joystick" role="application" aria-label="모바일 방향 조이스틱">'
  +'<span class="tower-joystick-knob" id="tower-joystick-knob" aria-hidden="true"></span></div><small>이동</small></div>'
  +'<div class="tower-manual-abilities" id="tower-manual-abilities"></div></div>'
  +'<p class="tower-manual-hint" id="tower-manual-hint" role="status" aria-live="polite">스킬 사용 시 기존 쿨타임과 전투 판정이 그대로 적용됩니다.</p>';
slot.append(controls);
// Dedicated, compact battle HUD above the canvas. The original Tower
// configuration panel and large per-fighter cards remain intact for auto
// battles and all intermissions, but do not obscure manual gameplay.
const hud=doc.createElement('section');
hud.id='tower-manual-hud';hud.className='tower-manual-hud';hud.hidden=true;
hud.setAttribute('aria-label','도전의 탑 전투 정보와 조작');
hud.innerHTML='<div class="tower-manual-hud-title"><span id="tower-manual-floor">1층</span><strong id="tower-manual-opponent">전투 준비</strong></div>'
  +'<div class="tower-manual-vitals">'
  +'<div class="tower-manual-vital"><div><span id="tower-manual-player-name">내 캐릭터</span><strong id="tower-manual-player-hp">0 / 0</strong></div><div class="tower-manual-hp-track"><span id="tower-manual-player-bar"></span></div></div>'
  +'<div class="tower-manual-vital tower-manual-enemy"><div><span>상대 HP</span><strong id="tower-manual-enemy-hp">0 / 0</strong></div><div class="tower-manual-hp-track"><span id="tower-manual-enemy-bar"></span></div></div></div>'
  +'<div class="tower-manual-hud-actions"><button type="button" id="tower-manual-pause" aria-label="도전의 탑 일시정지 또는 재개">⏸ 일시정지</button>'
  +'<button type="button" id="tower-manual-leave" aria-label="도전의 탑 포기">도전 포기</button></div>';
if(typeof slot.prepend==='function')slot.prepend(hud);
else slot.append(hud);
const stick=doc.getElementById('tower-joystick'),knob=doc.getElementById('tower-joystick-knob'),
  list=doc.getElementById('tower-manual-abilities'),hint=doc.getElementById('tower-manual-hint');
const hudEl=id=>doc.getElementById(id);
hudEl('tower-manual-pause')?.addEventListener('click',()=>{
  if(!visible())return;
  doc.getElementById('tower-pause')?.click?.();refresh();
});
hudEl('tower-manual-leave')?.addEventListener('click',()=>{
  if(!visible())return;
  tower()?.forfeit?.();refresh();
});
const keys=new Set(),buttons=[],HOTKEYS=['Q','E','R','F'];
let owner=null,pointer=null,touchX=0,touchY=0,frame=0;
let lastView=null,viewX=null,viewY=null,lastHp=null;
for(let i=0;i<4;i++){
  const button=doc.createElement('button');
  button.type='button';button.className='tower-manual-skill';button.dataset.skill=String(i);
  button.innerHTML='<kbd>'+HOTKEYS[i]+'</kbd><strong>스킬 '+(i+1)+'</strong><small>준비 중</small>';
  // Independent touch pointers: the left thumb can keep dragging while a
  // second finger activates a skill. Ignore the following synthetic click.
  let lastPointerCast=-Infinity;
  button.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'&&event.pointerType!=='pen')return;
    if(!running())return;
    event.preventDefault?.();
    lastPointerCast=Date.now();
    cast(i);
  });
  button.addEventListener('click',()=>{
    if(Date.now()-lastPointerCast<650)return;
    cast(i); // Mouse and keyboard retain native click accessibility.
  });
  list.append(button);buttons.push(button);
}
const tower=()=>global.ArenaTower;
function visible(){
  return tower()?.active===true&&tower()?.mode==='manual'&&tower()?.stage==='fighting'&&
    global.ArenaScreenRouter?.active==='tower'&&global.ArenaScreenRouter?.activeTowerTab==='tower';
}
function running(){
  return visible()&&typeof isPlaying!=='undefined'&&isPlaying&&
    typeof isGameOver!=='undefined'&&!isGameOver;
}
function resetInput(){
  keys.clear();pointer=null;touchX=0;touchY=0;
  if(knob)knob.style.transform='translate(0px,0px)';
}
// Gentle camera tracking enlarges the playable world without changing its
// coordinates, collisions, or arena dimensions. Effects use the same view.
function camera(width,height){
  if(!visible()||!owner)return lastView=null;
  const enemy=typeof players!=='undefined'?players.find(p=>p!==owner&&p.hp>0):null;
  const distance=enemy?Math.hypot(enemy.x-owner.x,enemy.y-owner.y):width;
  const zoom=Math.max(1.08,Math.min(1.20,1.27-distance/1700));
  const halfW=width/(zoom*2),halfH=height/(zoom*2);
  const targetX=owner.x*.66+(enemy?.x??owner.x)*.34;
  const targetY=owner.y*.66+(enemy?.y??owner.y)*.34;
  const x=Math.max(halfW,Math.min(width-halfW,targetX));
  const y=Math.max(halfH,Math.min(height-halfH,targetY));
  viewX=viewX===null?x:viewX+(x-viewX)*.14;
  viewY=viewY===null?y:viewY+(y-viewY)*.14;
  return lastView={zoom,x:viewX,y:viewY,width,height};
}
function applyView(ctx,view=lastView){
  if(!view)return;
  ctx.translate(view.width/2,view.height/2);
  ctx.scale(view.zoom,view.zoom);
  ctx.translate(-view.x,-view.y);
}
function refresh(){
  const active=visible();
  controls.hidden=!active;
  hud.hidden=!active;
  if(!active){resetInput();lastHp=null;lastView=null;viewX=null;viewY=null;return;}
  if(!running())resetInput();
  const p=typeof players!=='undefined'?players[0]:null;
  if(!p?.manualTower)return;
  const blocked=!!global.ForgeExpansion?.blocked(p);
  const live=running();
  const enemy=typeof players!=='undefined'?players[1]:null;
  const stage=tower()?.state,level=stage?.level||1;
  hudEl('tower-manual-floor').textContent=level+' / 10F';
  hudEl('tower-manual-opponent').textContent=tower()?.floor?.(level)?.name||'적과 전투 중';
  hudEl('tower-manual-player-name').textContent=p.name||'내 캐릭터';
  hudEl('tower-manual-player-hp').textContent=Math.ceil(Math.max(0,p.hp))+' / '+p.maxHp;
  if(lastHp!==null&&p.hp<lastHp){
    hud.animate?.([{filter:'brightness(1.5)',borderColor:'#ff9c9c'},
      {filter:'brightness(1)',borderColor:'#687a8d'}],
      {duration:190,iterations:1});
  }
  lastHp=p.hp;
  hudEl('tower-manual-player-bar').style.width=(Math.max(0,Math.min(100,p.hp/p.maxHp*100))||0).toFixed(1)+'%';
  if(enemy){
    hudEl('tower-manual-enemy-hp').textContent=Math.ceil(Math.max(0,enemy.hp))+' / '+enemy.maxHp;
    hudEl('tower-manual-enemy-bar').style.width=(Math.max(0,Math.min(100,enemy.hp/enemy.maxHp*100))||0).toFixed(1)+'%';
  }
  hudEl('tower-manual-pause').textContent=live?'⏸ 일시정지':'▶ 계속';
  for(let i=0;i<buttons.length;i++){
    const b=buttons[i],s=p.forge.skills[i];
    b.hidden=!s;
    if(!s)continue;
    const cd=global.SkillForge.cooldownFrames(p,s),ticks=Math.min(cd,p.forgeTicks[i]||0);
    const remain=Math.max(0,(cd-ticks)/60),ready=ticks>=cd;
    b.children[1].textContent=s.name;
    b.children[2].textContent=ready?'준비 완료':remain.toFixed(1)+'초';
    b.dataset.ready=String(ready&&live&&!blocked);
    b.disabled=!live||blocked||!ready;
    b.setAttribute('aria-label',HOTKEYS[i]+' '+s.name+' '+(ready?'사용 가능':remain.toFixed(1)+'초 남음'));
  }
}
function prepare(p){
  resetInput();owner=null;frame=0;viewX=null;viewY=null;lastView=null;lastHp=null;
  if(!global.SkillForge?.enableManual?.(p))return false;
  owner=p;return true;
}
function cast(i){
  if(!running()||!owner||owner!==players[0])return false;
  const target=typeof getClosestAliveEnemy==='function'?getClosestAliveEnemy(owner):null;
  const success=!!global.SkillForge?.manualCast?.(owner,i,target);
  if(success){
    hint.textContent=owner.forge.skills[i].name+' 발동';
    buttons[i]?.animate?.([{transform:'scale(.92)',filter:'brightness(1.6)'},
      {transform:'scale(1)',filter:'brightness(1)'}],{duration:145,iterations:1});
    // Browsers without vibration support simply ignore the tactile cue.
    if(!global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
      global.navigator?.vibrate?.(9);
    refresh();
  }
  return success;
}
function update(p,target){
  if(!running()||p!==owner||!p.manualTower)return false;
  const horizontal=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
  const vertical=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
  let dx=horizontal+touchX,dy=vertical+touchY;
  const length=Math.hypot(dx,dy);
  if(length>1){dx/=length;dy/=length;}
  if((p.forgeDash||0)<=0){
    const speed=Math.min(5,Math.max(.6,Number(p.forge?.speed)||2.2))*(p.speedMultiplier||1);
    p.vx=dx*speed;p.vy=dy*speed;
  }
  global.SkillForge?.manualUpdate?.(p,target);
  if(++frame%8===0)refresh();
  return true;
}
function inputKey(e,pressed){
  const key=String(e.key||'').toLowerCase();
  if(!visible())return;
  if(e.ctrlKey||e.altKey||e.metaKey||e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){
    if(pressed)keys.add(key);else keys.delete(key);
    e.preventDefault?.();
    return;
  }
  const i=HOTKEYS.findIndex(k=>k.toLowerCase()===key);
  if(i>=0){if(pressed&&!e.repeat)cast(i);e.preventDefault?.();}
}
global.addEventListener?.('keydown',e=>inputKey(e,true));
global.addEventListener?.('keyup',e=>inputKey(e,false));
global.addEventListener?.('blur',resetInput);
doc.addEventListener?.('visibilitychange',()=>{if(doc.hidden)resetInput();});
function point(e){
  const rect=stick.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  const max=Math.max(1,Math.min(rect.width,rect.height)*.34),dx=e.clientX-cx,dy=e.clientY-cy;
  const distance=Math.hypot(dx,dy),scale=distance>max?max/distance:1;
  const x=dx*scale,y=dy*scale;
  touchX=Math.abs(x)<max*.12?0:x/max;
  touchY=Math.abs(y)<max*.12?0:y/max;
  knob.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
}
stick.addEventListener('pointerdown',e=>{
  if(!running()||pointer!==null)return;
  pointer=e.pointerId;stick.setPointerCapture?.(pointer);point(e);e.preventDefault?.();
});
stick.addEventListener('pointermove',e=>{if(e.pointerId===pointer){point(e);e.preventDefault?.();}});
function end(e){
  if(e.pointerId!==pointer)return;
  pointer=null;touchX=0;touchY=0;knob.style.transform='translate(0px,0px)';
}
stick.addEventListener('pointerup',end);
stick.addEventListener('pointercancel',end);
stick.addEventListener('lostpointercapture',end);
global.ArenaTowerControls={prepare,update,cast,refresh,resetInput,camera,applyView,
  get view(){return lastView;},get owner(){return owner;},
  get input(){return {touchX,touchY,keys:[...keys],pointer};}};
refresh();
})(window);
