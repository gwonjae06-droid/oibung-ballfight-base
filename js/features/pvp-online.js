/* Online PvP: choose auto/manual BEFORE joining an actual WebSocket queue.
 * Separate spectator canvas; existing Tower and offline battle engines untouched. */
(function(global){
'use strict';
const doc=global.document,screen=doc?.getElementById('screen-pvp');
if(!screen)return;
const host=doc.createElement('div');host.id='pvp-app';host.className='pvp-app';
host.innerHTML='<section class="pvp-lobby" id="pvp-lobby">'
  +'<div class="pvp-intro"><span class="eyebrow">ONLINE MATCH / 1 VS 1</span>'
  +'<h3>나만의 파이터로 대결</h3><p>캐릭터와 전투 방식을 선택하세요. 자동·직접 조종 플레이어 모두 랜덤 매칭됩니다.</p></div>'
  +'<label class="pvp-label" for="pvp-fighter">출전 캐릭터</label><select id="pvp-fighter"></select>'
  +'<fieldset class="pvp-mode-list"><legend>전투 방식 · 매칭 전에 선택</legend>'
  +'<label><input type="radio" name="pvp-mode" value="auto" checked><span><strong>자동 전투</strong><small>AI가 내 캐릭터를 조종합니다. 직접 조종 상대와도 만날 수 있습니다.</small></span></label>'
  +'<label><input type="radio" name="pvp-mode" value="manual"><span><strong>클래식 직접 조종</strong><small>WASD 이동과 Q/E/R/F 스킬</small></span></label>'
  +'<label><input type="radio" name="pvp-mode" value="blitz"><span><strong>블리츠 배틀 · NEW</strong><small>3초간 행동 2개를 고른 뒤 동시에 실행하는 초고속 전략전</small></span></label></fieldset>'
  +'<details class="pvp-network" hidden><summary>온라인 서버 연결 설정</summary>'
  +'<label for="pvp-server">PvP 서버 주소 (wss://)</label>'
  +'<div class="pvp-server-row"><input id="pvp-server" inputmode="url" type="url" spellcheck="false" placeholder="wss://your-worker.workers.dev">'
  +'<button type="button" id="pvp-save-server">주소 저장</button></div>'
  +'<small>이전 Cloudflare 서버 연결 설정(현재 Supabase 사용)</small></details>'
  +'<div class="pvp-lobby-actions"><button id="pvp-search" type="button">랜덤 매칭 시작</button>'
  +'<button id="pvp-cancel" type="button" hidden>매칭 취소</button></div>'
  +'<p class="pvp-status" id="pvp-status" role="status" aria-live="polite">자동 또는 직접 조종을 선택하세요.</p>'
  +'<p class="pvp-balance-note">PvP 베타: 자동·직접 조종 혼합 매칭, 실제 제작한 1~4개 스킬 및 최대 3개 연계 동작을 사용합니다. 원래 전투 엔진의 스킬과 연계를 사용합니다. 전투 계산은 한 플레이어 기기에서 수행하므로 랭킹전용 치트 방지는 지원하지 않습니다.</p></section>'
  +'<section class="pvp-match" id="pvp-match" hidden aria-label="실시간 온라인 PvP 전투">'
  +'<div class="pvp-match-header"><div><small id="pvp-match-type">자동 전투</small><strong id="pvp-round-state">온라인 경기</strong></div>'
  +'<span id="pvp-clock">2:00</span><button type="button" id="pvp-forfeit">경기 포기</button></div>'
  +'<div class="pvp-vitals" hidden aria-hidden="true"><div><span id="pvp-name-0">Player 1</span><div class="pvp-hp"><i id="pvp-hp-0"></i></div>'
  +'<small id="pvp-hp-text-0">240/240</small></div>'
  +'<div><span id="pvp-name-1">Player 2</span><div class="pvp-hp pvp-hp-foe"><i id="pvp-hp-1"></i></div>'
  +'<small id="pvp-hp-text-1">240/240</small></div></div>'
  +'<canvas id="pvp-canvas" width="680" height="460" aria-label="PvP 전장"></canvas>'
  +'<div class="pvp-input" id="pvp-input" hidden><div class="pvp-pad-wrap">'
  +'<div class="pvp-pad" id="pvp-pad" role="application" aria-label="이동 조이스틱"><span id="pvp-stick"></span></div><small>이동</small></div>'
  +'<div id="pvp-skills" class="pvp-skills"></div></div>'
  +'<section id="pvp-blitz" class="pvp-blitz" hidden aria-label="블리츠 행동 선택">'
  +'<div class="pvp-blitz-heading"><strong>⚡ 블리츠 · 동시 행동 선택</strong><span id="pvp-blitz-time"></span></div>'
  +'<div class="pvp-blitz-choices"><label>기동<select id="pvp-blitz-move"><option value="approach">접근</option>'
  +'<option value="retreat">후퇴</option><option value="left">좌측 우회</option>'
  +'<option value="right">우측 우회</option><option value="hold">방어</option></select></label>'
  +'<label>첫 번째 스킬<select id="pvp-blitz-first"></select></label>'
  +'<label>연계 스킬<select id="pvp-blitz-second"></select></label></div>'
  +'<button type="button" id="pvp-blitz-lock">이 행동 확정</button>'
  +'<p id="pvp-blitz-note" role="status" aria-live="polite">상대에게 행동은 공개되지 않습니다.</p></section>'
  +'<p class="pvp-result" id="pvp-result" hidden role="status"></p>'
  +'<button type="button" id="pvp-again" hidden>다른 상대 찾기</button></section>';
screen.append(host);
const $=id=>doc.getElementById(id);
const buttons=[],HOTKEYS=['q','e','r','f'],keys=new Set();
const visualEffects=[],flecks=[],lastHealth=[null,null];
let fxClock=0;
const pad=$('pvp-pad'),knob=$('pvp-stick');
let socket=null,searching=false,matched=false,mode='auto',side=0,latest=null,view=null,
  frame=null,sendLoop=null,active=true,pointer=null,touchX=0,touchY=0,lastServer='';
let lastSentX=NaN,lastSentY=NaN,lastInputAt=0,blitzRound=-1,blitzLocked=false;
function status(text){$('pvp-status').textContent=text;}
function savedServer(){
  try{return global.localStorage?.getItem('oibung-pvp-server')||'';}catch(_){return '';}
}
function endpoint(){
  const raw=String($('pvp-server').value||'').trim().replace(/\/+$/,'');
  const valid=/^wss:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[\w/-]*)?$/i.test(raw)||
    /^ws:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/[\w/-]*)?$/i.test(raw);
  return valid?raw:null;
}
$('pvp-server').value=savedServer()||global.OIBUNG_PVP_SERVER_URL||'';
$('pvp-save-server').addEventListener('click',()=>{
  const value=endpoint();
  if(!value)return status('유효한 wss:// 주소 또는 로컬 테스트용 ws://localhost 주소가 필요합니다.');
  try{global.localStorage?.setItem('oibung-pvp-server',value);}catch(_){}
  status('서버 주소가 저장되었습니다. 연결하려면 랜덤 매칭 시작을 누르세요.');
});
function roster(){
  const value=$('pvp-fighter').value;
  $('pvp-fighter').replaceChildren();
  for(const d of [...CHARACTER_DEFS,...CUSTOM_DEFS]){
    const option=doc.createElement('option');option.value=d.id;option.textContent=d.name;
    $('pvp-fighter').append(option);
  }
  if([...CHARACTER_DEFS,...CUSTOM_DEFS].some(d=>d.id===value))$('pvp-fighter').value=value;
}
function profile(){
  const def=[...CHARACTER_DEFS,...CUSTOM_DEFS].find(d=>d.id===$('pvp-fighter').value);
  if(!def)return null;
  return global.PvpOriginalEngine.pack(def);
}
function clearInput(){
  keys.clear();touchX=touchY=0;pointer=null;
  if(knob)knob.style.transform='translate(0px,0px)';
  if(matched&&mode==='manual')pushDirection(true);
}
function send(msg){
  if(socket?.readyState!==1)return false;
  try{socket.send(JSON.stringify(msg));return true;}catch(_){return false;}
}
function cleanup(){
  if(sendLoop){global.clearInterval(sendLoop);sendLoop=null;}
  if(frame!==null&&global.cancelAnimationFrame)global.cancelAnimationFrame(frame);
  frame=null;clearInput();
  lastSentX=NaN;lastSentY=NaN;lastInputAt=0;blitzRound=-1;blitzLocked=false;
}
function closeConnection(message=''){
  if(socket){
    const current=socket;socket=null;
    if(current.readyState===1&&matched)try{current.send(JSON.stringify({type:'forfeit'}));}catch(_){}
    try{current.close();}catch(_){}
  }
  cleanup();searching=false;matched=false;latest=null;view=null;
  visualEffects.length=0;flecks.length=0;lastHealth.fill(null);
  $('pvp-lobby').hidden=false;$('pvp-match').hidden=true;
  $('pvp-search').hidden=false;$('pvp-cancel').hidden=true;
  $('pvp-fighter').disabled=false;
  for(const input of doc.querySelectorAll('input[name="pvp-mode"]'))input.disabled=false;
  if(message)status(message);
}
function showMatch(data){
  searching=false;matched=true;side=data.you===1?1:0;
  $('pvp-lobby').hidden=true;$('pvp-match').hidden=false;
  $('pvp-match-type').textContent=mode==='auto'?'자동 조종 · PvP':mode==='blitz'?'블리츠 배틀 · PvP':'클래식 직접 조종 · PvP';
  $('pvp-result').hidden=true;$('pvp-again').hidden=true;
  $('pvp-input').hidden=mode!=='manual';
  $('pvp-blitz').hidden=mode!=='blitz';
  $('pvp-round-state').textContent='상대 발견 · 경기 진행';
  $('pvp-forfeit').hidden=false;
  visualEffects.length=0;flecks.length=0;lastHealth.fill(null);
  if(mode==='manual')startSending();
  global.PvpOriginalEngine.show();
  animate();
}
function fillBlitzOptions(skills){
 const first=$('pvp-blitz-first'),second=$('pvp-blitz-second');
 for(const select of [first,second]){
  select.replaceChildren();
  const option=doc.createElement('option');option.value='-1';option.textContent='사용 안 함';select.append(option);
  skills.slice(0,4).forEach((skill,i)=>{
   const o=doc.createElement('option');o.value=String(i);o.textContent=(i+1)+'. '+skill.name;select.append(o);
  });
 }
 first.value=skills.length?'0':'-1';second.value=skills.length>1?'1':'-1';
}
function submitBlitz(){
 if(!matched||mode!=='blitz'||blitzLocked||latest?.blitz?.phase!=='plan')return false;
 const b=latest.blitz,slots=[$('pvp-blitz-first').value,$('pvp-blitz-second').value]
  .map(Number).filter((v,i,all)=>v>=0&&all.indexOf(v)===i);
 const ok=send({type:'plan',round:b.round,move:$('pvp-blitz-move').value,slots});
 if(ok){blitzLocked=true;$('pvp-blitz-note').textContent='✓ 행동 확정 · 상대 선택 대기 중';}
 return ok;
}
$('pvp-blitz-lock').addEventListener('click',submitBlitz);
function renderBlitz(data,own){
 if(mode!=='blitz')return;
 const b=data.blitz;
 if(!b){$('pvp-blitz-note').textContent='블리츠 동기화를 확인하는 중입니다.';return;}
 if(blitzRound!==b.round){
  blitzRound=b.round;blitzLocked=false;fillBlitzOptions(own?.skills||[]);
 }
 const planning=b.phase==='plan';
 const committed=!!b.submitted?.[side];
 if(committed)blitzLocked=true;
 const locked=!planning||blitzLocked;
 for(const id of ['pvp-blitz-move','pvp-blitz-first','pvp-blitz-second','pvp-blitz-lock'])
  $(id).disabled=locked;
 $('pvp-blitz-time').textContent=b.round+'라운드 · '+(planning?'선택':'실행')+' '+(b.remainingMs/1000).toFixed(1)+'초';
 $('pvp-blitz-note').textContent=planning?(blitzLocked?'✓ 내 행동 확정 · 상대 선택 대기 중':'기동과 스킬을 골라 확정하세요. 상대 계획은 비공개입니다.'):'⚔ 두 캐릭터가 동시에 행동 실행 중';
}
function renderState(data){
  if(data.events?.length)spawnEffects(data.events,data.players);
  latest=data;
  if(data.finished)global.PvpOriginalEngine.paint();
  const theirs=data.players?.[1-side]?.mode==='auto'?'자동':'직접';
  $('pvp-round-state').textContent='내 '+(mode==='auto'?'자동':'직접')+' VS 상대 '+theirs;
  $('pvp-clock').textContent=Math.floor(Math.max(0,data.clock)/60)+':'+
    String(Math.floor(Math.max(0,data.clock)%60)).padStart(2,'0');
  const own=data.players[side],other=data.players[1-side];
  renderBlitz(data,own);
  for(const [i,p] of [[0,own],[1,other]]){
    if(!p)continue;
    $('pvp-name-'+i).textContent=p.name;
    $('pvp-hp-'+i).style.width=Math.max(0,p.hp/p.maxHp*100).toFixed(1)+'%';
    $('pvp-hp-text-'+i).textContent=Math.ceil(p.hp)+' / '+p.maxHp;
  }
  if(!view)view=data.players.map(p=>({x:p.x,y:p.y}));
  // Never pad skills: one authored skill means exactly one visible button.
  $('pvp-skills').style.setProperty('--pvp-skill-count',String(Math.max(1,own?.skills?.length||1)));
  for(let i=0;i<buttons.length;i++){
    const button=buttons[i],skill=own?.skills?.[i];
    button.hidden=!skill;
    if(!skill)continue;
    const cd=own.cooldowns?.[i]||0;
    button.children[1].textContent=skill.name;
    button.children[2].textContent=cd>0?cd.toFixed(1)+'s':'준비';
    button.disabled=cd>0||!matched;
    button.setAttribute('aria-label',HOTKEYS[i].toUpperCase()+' '+skill.name+
      (cd>0?' 재사용 '+cd.toFixed(1)+'초':' 사용 가능'));
  }
}
function finish(winner,reason){
  matched=false;searching=false;cleanup();
  $('pvp-result').hidden=false;
  $('pvp-result').textContent=reason||(winner===-1?'무승부':winner===side?'승리!':'패배');
  $('pvp-round-state').textContent='경기 종료';
  $('pvp-forfeit').hidden=true;
  $('pvp-input').hidden=true;$('pvp-blitz').hidden=true;
  $('pvp-again').hidden=false;
}
function onMessage(event){
  let data;try{data=JSON.parse(event.data);}catch(_){return;}
  if(data.type==='connected'){send({type:'queue',mode,profile:profile()});}
  else if(data.type==='queued')status('매칭 대기 중 · 자동·직접 조종 모든 사용자를 찾고 있습니다.');
  else if(data.type==='matched'){showMatch(data);}
  else if(data.type==='state'){if(!matched&&data.finished!==true)return;renderState(data);if(data.finished)finish(data.winner);}
  else if(data.type==='result'){if(matched)finish(data.winner);}
  else if(data.type==='disconnect'){if(matched)finish(1-side,'상대 연결 종료 · 승리');}
  else if(data.type==='error')status(data.message||'서버 오류');
}
function startSearch(){
  if(searching||matched)return;
  roster();
  if(!profile())return status('출전할 캐릭터가 없습니다.');
  if(typeof global.SupabasePvpTransport!=='function')
    return status('Supabase PvP 연결 모듈을 불러오지 못했습니다.');
  const selectedMode=doc.querySelector('input[name="pvp-mode"]:checked')?.value;
  mode=['auto','manual','blitz'].includes(selectedMode)?selectedMode:'auto';
  searching=true;lastServer='Supabase 무료 Realtime';
  $('pvp-search').hidden=true;$('pvp-cancel').hidden=false;
  $('pvp-fighter').disabled=true;
  for(const radio of doc.querySelectorAll('input[name="pvp-mode"]'))radio.disabled=true;
  status('무료 Supabase 서버 인증 및 매칭 연결 중…');
  try{
    socket=new global.SupabasePvpTransport();
    const thisSocket=socket;
    socket.onmessage=e=>{if(socket===thisSocket)onMessage(e);};
    socket.onerror=()=>{if(socket===thisSocket)status('연결 실패 · 서버 배포 상태나 주소를 확인하세요.');};
    socket.onclose=()=>{
      if(socket!==thisSocket)return;
      const wasFighting=matched;
      socket=null;closeConnection(thisSocket.lastError|| (wasFighting?'서버 연결이 끊겼습니다. 전적은 저장되지 않습니다.':'연결이 종료됐습니다. 서버 주소를 확인하세요.'));
    };
  }catch(e){closeConnection('연결을 시작할 수 없습니다. 서버 주소를 확인하세요.');}
}
$('pvp-search').addEventListener('click',startSearch);
$('pvp-cancel').addEventListener('click',()=>closeConnection('매칭을 취소했습니다.'));
$('pvp-forfeit').addEventListener('click',()=>{send({type:'forfeit'});});
$('pvp-again').addEventListener('click',()=>{closeConnection();startSearch();});
for(let i=0;i<4;i++){
  const button=doc.createElement('button');button.type='button';
  button.className='pvp-skill';button.innerHTML='<kbd>'+HOTKEYS[i].toUpperCase()+'</kbd><strong>스킬 '+(i+1)+'</strong><small>준비</small>';
  let touchAt=-Infinity;
  button.hidden=true;
  button.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
    e.preventDefault?.();touchAt=Date.now();
    if(!button.hidden&&!button.disabled&&matched&&mode==='manual')send({type:'cast',slot:i});
  });
  button.addEventListener('click',()=>{
    if(Date.now()-touchAt>650&&!button.hidden&&!button.disabled&&matched&&mode==='manual')
      send({type:'cast',slot:i});
  });
  $('pvp-skills').append(button);buttons.push(button);
}
function direction(){
  const x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+touchX;
  const y=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))+touchY;
  const length=Math.hypot(x,y);
  return {type:'input',x:length>1?x/length:x,y:length>1?y/length:y};
}
function pushDirection(force=false){
  if(!matched||mode!=='manual')return;
  const input=direction(),now=Date.now();
  const changed=input.x!==lastSentX||input.y!==lastSentY;
  // Immediate changes keep keyboard movement responsive; a small regular
  // heartbeat prevents stale input without flooding Supabase Free messages.
  if(!force&&changed&&now-lastInputAt<34)return;
  if(!force&&!changed&&now-lastInputAt<220)return;
  if(send(input)){
    lastSentX=input.x;lastSentY=input.y;lastInputAt=now;
  }
}
function startSending(){
  if(sendLoop)global.clearInterval(sendLoop);
  lastSentX=NaN;lastSentY=NaN;lastInputAt=0;
  pushDirection(true);
  sendLoop=global.setInterval(()=>{if(matched&&mode==='manual')pushDirection();},50);
}
function inputKey(event,down){
  if(!matched||global.ArenaScreenRouter?.active!=='pvp')return;
  if(mode==='blitz'){
   if(!down||event.repeat||event.ctrlKey||event.altKey||event.metaKey||
     event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
   const k=String(event.key||'').toLowerCase();
   if(k==='enter'){submitBlitz();event.preventDefault?.();}
   const slot=HOTKEYS.indexOf(k);
   if(slot>=0&&!$('pvp-blitz-first').disabled&&$('pvp-blitz-first').options.length>slot+1){
    $('pvp-blitz-first').value=String(slot);event.preventDefault?.();
   }
   return;
  }
  if(mode!=='manual')return;
  if(event.ctrlKey||event.metaKey||event.altKey||
     event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  const key=/^Key[A-Z]$/.test(event.code||'')?event.code.slice(3).toLowerCase():String(event.key||'').toLowerCase();
  if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)){
    if(down)keys.add(key);else keys.delete(key);
    pushDirection(true);
    event.preventDefault?.();
  }
  const i=HOTKEYS.indexOf(key);
  if(i>=0){
    if(down&&!event.repeat&&!buttons[i].hidden&&!buttons[i].disabled)send({type:'cast',slot:i});
    event.preventDefault?.();
  }
}
global.addEventListener('keydown',e=>inputKey(e,true));
global.addEventListener('keyup',e=>inputKey(e,false));
global.addEventListener('blur',clearInput);
doc.addEventListener('visibilitychange',()=>{if(doc.hidden)clearInput();});
function point(e){
  const rect=pad.getBoundingClientRect(),mx=rect.left+rect.width/2,my=rect.top+rect.height/2;
  const cap=Math.min(rect.width,rect.height)*.32||1;
  const dx=e.clientX-mx,dy=e.clientY-my,m=Math.hypot(dx,dy)||1;
  const x=dx*Math.min(1,cap/m),y=dy*Math.min(1,cap/m);
  touchX=x/cap;touchY=y/cap;
  pushDirection();
  knob.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
}
pad.addEventListener('pointerdown',e=>{
  if(!matched||mode!=='manual'||pointer!==null)return;
  pointer=e.pointerId;pad.setPointerCapture?.(pointer);point(e);e.preventDefault?.();
});
pad.addEventListener('pointermove',e=>{if(e.pointerId===pointer){point(e);e.preventDefault?.();}});
function release(e){if(e.pointerId===pointer){pointer=null;touchX=touchY=0;
  pushDirection(true);
  knob.style.transform='translate(0px,0px)';}}
pad.addEventListener('pointerup',release);pad.addEventListener('pointercancel',release);
pad.addEventListener('lostpointercapture',release);
const canvas=$('pvp-canvas'),ctx=canvas.getContext('2d');
function animate(){
  if(frame!==null||typeof global.requestAnimationFrame!=='function')return;
  const loop=()=>{
    if(!matched){frame=null;return;}
    global.PvpOriginalEngine.paint();
    frame=global.requestAnimationFrame(loop);
  };
  frame=global.requestAnimationFrame(loop);
}

function spawnEffects(events,players){
  const now=Date.now();
  for(const event of events){
    let x=Number(event.x),y=Number(event.y);
    const person=players?.[event.caster??event.target];
    if(!Number.isFinite(x))x=person?.x??340;
    if(!Number.isFinite(y))y=person?.y??230;
    const color=players?.[event.caster]?.color||'#f7d28c';
    if(event.type==='cast'){
      visualEffects.push({type:'cast',kind:event.kind,style:event.style,
        x,y,targetX:event.targetX??x,targetY:event.targetY??y,
        radius:Math.max(50,Math.min(260,Number(event.range)||90)),
        color,at:now,life:Math.max(300,event.kind==='beam'?450:540)});
      if(event.kind==='wave'||event.kind==='melee'||event.kind==='beam'){
        for(let i=0;i<9;i++){
          const a=Math.random()*Math.PI*2,v=2+Math.random()*4;
          flecks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,
            at:now,life:300+Math.random()*220,color});
        }
      }
    }
    if(event.type==='hit'||event.type==='blocked'){
      visualEffects.push({type:'hit',x,y,at:now,life:410,
        text:event.type==='blocked'?'BLOCK':'-'+Math.ceil(event.amount||0),
        color:event.type==='blocked'?'#f3e4a7':'#fff6ef'});
      if(event.type==='hit')for(let i=0;i<15;i++){
        const a=Math.random()*Math.PI*2,v=2+Math.random()*5;
        flecks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,
          at:now,life:260+Math.random()*260,color:'#ffb287'});
      }
    }
    if(event.type==='heal'||event.type==='stun')
      visualEffects.push({type:'status',x,y,at:now,life:720,
        color:event.type==='heal'?'#8dfabb':'#ffe48a',text:event.type==='heal'?'+HP':'STUN'});
    if(event.type==='dash')visualEffects.push({type:'dash',
      x,y,fromX:event.fromX,fromY:event.fromY,at:now,life:380,color});
  }
  if(visualEffects.length>60)visualEffects.splice(0,visualEffects.length-60);
  if(flecks.length>220)flecks.splice(0,flecks.length-220);
}
function paintEffects(){
  const now=Date.now();fxClock++;
  for(let i=visualEffects.length-1;i>=0;i--){
    const e=visualEffects[i],t=Math.min(1,(now-e.at)/e.life);
    if(t>=1){visualEffects.splice(i,1);continue;}
    ctx.save();ctx.globalAlpha=Math.max(0,1-t);
    ctx.strokeStyle=e.color||'#f0d3a2';ctx.lineWidth=4-t*2;
    ctx.shadowColor=e.color||'#f2d9ae';ctx.shadowBlur=11;
    if(e.type==='cast'){
      const r=e.kind==='melee'?50:e.radius;
      if(e.kind==='beam'){
        ctx.lineWidth=16*(1-t)+2;ctx.beginPath();
        ctx.moveTo(e.x,e.y);ctx.lineTo(e.targetX,e.targetY);ctx.stroke();
        ctx.strokeStyle='#fffae5';ctx.lineWidth=5*(1-t);
        ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.targetX,e.targetY);ctx.stroke();
      }else if(e.kind==='melee'){
        const heading=Math.atan2(e.targetY-e.y,e.targetX-e.x);
        ctx.beginPath();ctx.arc(e.x,e.y,r+18*t,heading-1.2,heading+1.2);
        ctx.lineWidth=9*(1-t)+1;ctx.stroke();
      }else if(e.kind==='wave'||e.kind==='stun'){
        ctx.beginPath();ctx.arc(e.x,e.y,18+(r-18)*Math.min(1,t*1.75),0,Math.PI*2);
        ctx.lineWidth=8*(1-t)+1;ctx.stroke();
        ctx.setLineDash([10,6]);ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(e.x,e.y,r*.7*t+4,0,Math.PI*2);ctx.stroke();
      }else if(e.kind==='shield'||e.kind==='heal'||e.kind==='haste'){
        ctx.beginPath();ctx.arc(e.x,e.y,30+55*t,0,Math.PI*2);ctx.stroke();
      }else if(e.kind==='shot'){
        ctx.beginPath();ctx.arc(e.x,e.y,14+25*t,0,Math.PI*2);ctx.stroke();
      }else{
        ctx.beginPath();ctx.arc(e.x,e.y,20+42*t,0,Math.PI*2);ctx.stroke();
      }
    }else if(e.type==='dash'){
      ctx.lineWidth=10*(1-t)+1;
      ctx.beginPath();ctx.moveTo(e.fromX,e.fromY);ctx.lineTo(e.x,e.y);ctx.stroke();
    }else{
      ctx.beginPath();ctx.arc(e.x,e.y,12+55*t,0,Math.PI*2);ctx.stroke();
      ctx.font='900 24px system-ui,sans-serif';
      ctx.lineWidth=3;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.strokeStyle='#243042';ctx.strokeText(e.text,e.x,e.y-25-t*40);
      ctx.fillStyle=e.color;ctx.fillText(e.text,e.x,e.y-25-t*40);
    }
    ctx.restore();
  }
  for(let i=flecks.length-1;i>=0;i--){
    const f=flecks[i],t=(now-f.at)/f.life;
    if(t>=1){flecks.splice(i,1);continue;}
    ctx.save();ctx.globalAlpha=1-t;ctx.fillStyle=f.color;
    ctx.beginPath();ctx.arc(f.x+f.vx*t*22,f.y+f.vy*t*22,3.5*(1-t)+1,0,Math.PI*2);
    ctx.fill();ctx.restore();
  }
}
function draw(){
  if(!latest||!ctx||!latest.players?.length)return;
  const w=canvas.width,h=canvas.height;
  // Reuse the *actual Tower's cached 2D dojo scenery* rather than a blank
  // white grid. The separate multiplayer simulation stays isolated.
  if(!global.ArenaTowerScenes?.paint?.(ctx,w,h,1)){
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#62564e';ctx.fillRect(0,0,w,h);
  }
  ctx.strokeStyle='#eed6ab66';ctx.lineWidth=2;ctx.setLineDash([10,11]);
  ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();ctx.setLineDash([]);
  latest.players.forEach((p,i)=>{
    if(!view[i])view[i]={x:p.x,y:p.y};
    view[i].x+=(p.x-view[i].x)*.26;view[i].y+=(p.y-view[i].y)*.26;
    const x=view[i].x,y=view[i].y;
    ctx.save();ctx.fillStyle='rgba(24,37,55,.16)';ctx.beginPath();ctx.ellipse(x,y+26,26,8,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=i===side?'#2d76c6':'#a45165';ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(x,y,33,0,Math.PI*2);ctx.stroke();
    if(p.shield){ctx.strokeStyle='#e8b15e';ctx.lineWidth=5;ctx.beginPath();ctx.arc(x,y,40,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle=p.color;ctx.strokeStyle='#253142';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(x,y,25,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='900 18px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(p.name||'P')[0],x,y+1);
    ctx.fillStyle='#fdf3df';ctx.strokeStyle='#202832';ctx.lineWidth=3;ctx.font='bold 14px sans-serif';
    ctx.strokeText(i===side?'YOU':'RIVAL',x,y-49);ctx.fillText(i===side?'YOU':'RIVAL',x,y-49);
    if(p.stunned){ctx.fillStyle='#f9db77';ctx.font='bold 13px sans-serif';ctx.fillText('★',x,y-70);}
    if(p.haste){ctx.strokeStyle='#75e7ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,38,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  });
  for(const b of latest.bullets||[]){
    ctx.save();ctx.shadowColor=b.owner===side?'#63e9ff':'#ff9c7a';ctx.shadowBlur=14;
    ctx.beginPath();ctx.arc(b.x,b.y,9,0,Math.PI*2);
    ctx.fillStyle=b.owner===side?'#5fe9ff':'#fda58f';ctx.fill();
    ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
  }
  paintEffects();
}
function onRoute(open){
  active=!!open;
  if(open){roster();return;}
  if(socket||searching||matched)closeConnection();
}
global.ArenaPvp={onRoute,close:closeConnection,get state(){return {searching,matched,mode,side,server:lastServer};}};
onRoute(global.ArenaScreenRouter?.active==='pvp');
})(window);
