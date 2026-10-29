/* Online PvP: choose auto/manual BEFORE joining an actual WebSocket queue.
 * Separate spectator canvas; existing Tower and offline battle engines untouched. */
(function(global){
'use strict';
const doc=global.document,screen=doc?.getElementById('screen-pvp');
if(!screen)return;
const host=doc.createElement('div');host.id='pvp-app';host.className='pvp-app';
host.innerHTML='<section class="pvp-lobby" id="pvp-lobby">'
  +'<div class="pvp-intro"><span class="eyebrow">ONLINE MATCH / 1 VS 1</span>'
  +'<h3>나만의 파이터로 대결</h3><p>캐릭터와 전투 방식을 선택하고 같은 모드의 다른 플레이어를 찾습니다.</p></div>'
  +'<label class="pvp-label" for="pvp-fighter">출전 캐릭터</label><select id="pvp-fighter"></select>'
  +'<fieldset class="pvp-mode-list"><legend>전투 방식 · 매칭 전에 선택</legend>'
  +'<label><input type="radio" name="pvp-mode" value="auto" checked><span><strong>자동 전투</strong><small>AI가 이동·스킬을 사용합니다. 같은 자동 전투 상대만 매칭됩니다.</small></span></label>'
  +'<label><input type="radio" name="pvp-mode" value="manual"><span><strong>직접 조종</strong><small>WASD/방향키·Q/E/R/F 또는 모바일 조이스틱으로 조작합니다.</small></span></label></fieldset>'
  +'<details class="pvp-network"><summary>온라인 서버 연결 설정</summary>'
  +'<label for="pvp-server">PvP 서버 주소 (wss://)</label>'
  +'<div class="pvp-server-row"><input id="pvp-server" inputmode="url" type="url" spellcheck="false" placeholder="wss://your-worker.workers.dev">'
  +'<button type="button" id="pvp-save-server">주소 저장</button></div>'
  +'<small>실제 온라인 매칭 서버가 배포되어 있어야 연결할 수 있습니다. 연결하지 않은 상태에서 가짜 상대를 표시하지 않습니다.</small></details>'
  +'<div class="pvp-lobby-actions"><button id="pvp-search" type="button">랜덤 매칭 시작</button>'
  +'<button id="pvp-cancel" type="button" hidden>매칭 취소</button></div>'
  +'<p class="pvp-status" id="pvp-status" role="status" aria-live="polite">자동 또는 직접 조종을 선택하세요.</p>'
  +'<p class="pvp-balance-note">PvP 1차 버전은 고정 HP와 서버가 검증하는 축약형 스킬 규칙을 사용합니다. 도전의 탑 스킬 효과와 일부 다를 수 있으며 랭킹전은 지원하지 않습니다.</p></section>'
  +'<section class="pvp-match" id="pvp-match" hidden aria-label="실시간 온라인 PvP 전투">'
  +'<div class="pvp-match-header"><div><small id="pvp-match-type">자동 전투</small><strong id="pvp-round-state">온라인 경기</strong></div>'
  +'<span id="pvp-clock">2:00</span><button type="button" id="pvp-forfeit">경기 포기</button></div>'
  +'<div class="pvp-vitals"><div><span id="pvp-name-0">Player 1</span><div class="pvp-hp"><i id="pvp-hp-0"></i></div>'
  +'<small id="pvp-hp-text-0">240/240</small></div>'
  +'<div><span id="pvp-name-1">Player 2</span><div class="pvp-hp pvp-hp-foe"><i id="pvp-hp-1"></i></div>'
  +'<small id="pvp-hp-text-1">240/240</small></div></div>'
  +'<canvas id="pvp-canvas" width="680" height="460" aria-label="PvP 전장"></canvas>'
  +'<div class="pvp-input" id="pvp-input" hidden><div class="pvp-pad-wrap">'
  +'<div class="pvp-pad" id="pvp-pad" role="application" aria-label="이동 조이스틱"><span id="pvp-stick"></span></div><small>이동</small></div>'
  +'<div id="pvp-skills" class="pvp-skills"></div></div>'
  +'<p class="pvp-result" id="pvp-result" hidden role="status"></p>'
  +'<button type="button" id="pvp-again" hidden>다른 상대 찾기</button></section>';
screen.append(host);
const $=id=>doc.getElementById(id);
const buttons=[],HOTKEYS=['q','e','r','f'],keys=new Set();
const pad=$('pvp-pad'),knob=$('pvp-stick');
let socket=null,searching=false,matched=false,mode='auto',side=0,latest=null,view=null,
  frame=null,sendLoop=null,active=true,pointer=null,touchX=0,touchY=0,lastServer='';
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
  const data=def.forgeData;
  return {id:def.id,name:def.name,color:data?.color||def.themeColor||'#4f86c6',
    skills:data?.skills?.slice(0,4).map(s=>({name:s.name,type:s.actions?.[0]?.type||'shot'}))||[]};
}
function clearInput(){
  keys.clear();touchX=touchY=0;pointer=null;
  if(knob)knob.style.transform='translate(0px,0px)';
}
function send(msg){
  if(socket?.readyState!==1)return false;
  try{socket.send(JSON.stringify(msg));return true;}catch(_){return false;}
}
function cleanup(){
  if(sendLoop){global.clearInterval(sendLoop);sendLoop=null;}
  if(frame!==null&&global.cancelAnimationFrame)global.cancelAnimationFrame(frame);
  frame=null;clearInput();
}
function closeConnection(message=''){
  if(socket){
    const current=socket;socket=null;
    if(current.readyState===1&&matched)try{current.send(JSON.stringify({type:'forfeit'}));}catch(_){}
    try{current.close();}catch(_){}
  }
  cleanup();searching=false;matched=false;latest=null;view=null;
  $('pvp-lobby').hidden=false;$('pvp-match').hidden=true;
  $('pvp-search').hidden=false;$('pvp-cancel').hidden=true;
  $('pvp-fighter').disabled=false;
  for(const input of doc.querySelectorAll('input[name="pvp-mode"]'))input.disabled=false;
  if(message)status(message);
}
function showMatch(data){
  searching=false;matched=true;side=data.you===1?1:0;
  $('pvp-lobby').hidden=true;$('pvp-match').hidden=false;
  $('pvp-match-type').textContent=mode==='auto'?'자동 전투 · 관전':'직접 조종 · PvP';
  $('pvp-result').hidden=true;$('pvp-again').hidden=true;
  $('pvp-input').hidden=mode!=='manual';
  $('pvp-round-state').textContent='상대 발견 · 경기 진행';
  if(mode==='manual')startSending();
  animate();
}
function renderState(data){
  latest=data;
  $('pvp-clock').textContent=Math.floor(Math.max(0,data.clock)/60)+':'+
    String(Math.floor(Math.max(0,data.clock)%60)).padStart(2,'0');
  const own=data.players[side],other=data.players[1-side];
  for(const [i,p] of [[0,own],[1,other]]){
    if(!p)continue;
    $('pvp-name-'+i).textContent=p.name;
    $('pvp-hp-'+i).style.width=Math.max(0,p.hp/p.maxHp*100).toFixed(1)+'%';
    $('pvp-hp-text-'+i).textContent=Math.ceil(p.hp)+' / '+p.maxHp;
  }
  if(!view)view=data.players.map(p=>({x:p.x,y:p.y}));
  if(own?.skills)for(let i=0;i<4;i++){
    const button=buttons[i],skill=own.skills[i];
    if(!skill)continue;
    const cd=own.cooldowns[i]||0;
    button.children[1].textContent=skill.name;
    button.children[2].textContent=cd>0?cd.toFixed(1)+'s':'준비';
    button.disabled=cd>0||!matched;
  }
}
function finish(winner,reason){
  matched=false;searching=false;cleanup();
  $('pvp-result').hidden=false;
  $('pvp-result').textContent=reason||(winner===-1?'무승부':winner===side?'승리!':'패배');
  $('pvp-round-state').textContent='경기 종료';
  $('pvp-forfeit').hidden=true;
  $('pvp-input').hidden=true;
  $('pvp-again').hidden=false;
}
function onMessage(event){
  let data;try{data=JSON.parse(event.data);}catch(_){return;}
  if(data.type==='connected'){send({type:'queue',mode,profile:profile()});}
  else if(data.type==='queued')status('매칭 대기 중 · '+(mode==='auto'?'자동 전투':'직접 조종')+' 상대를 찾고 있습니다.');
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
  const url=endpoint();
  if(!url)return status('온라인 PvP 서버가 연결되지 않았습니다. 서버 설정을 열어 배포된 wss:// 주소를 입력하세요.');
  if(typeof global.WebSocket!=='function')return status('이 브라우저는 WebSocket을 지원하지 않습니다.');
  mode=doc.querySelector('input[name="pvp-mode"]:checked')?.value==='manual'?'manual':'auto';
  searching=true;lastServer=url;
  $('pvp-search').hidden=true;$('pvp-cancel').hidden=false;
  $('pvp-fighter').disabled=true;
  for(const radio of doc.querySelectorAll('input[name="pvp-mode"]'))radio.disabled=true;
  status('온라인 서버에 연결 중…');
  try{
    socket=new global.WebSocket(url+'/match');
    const thisSocket=socket;
    socket.onmessage=e=>{if(socket===thisSocket)onMessage(e);};
    socket.onerror=()=>{if(socket===thisSocket)status('연결 실패 · 서버 배포 상태나 주소를 확인하세요.');};
    socket.onclose=()=>{
      if(socket!==thisSocket)return;
      const wasFighting=matched;
      socket=null;closeConnection(wasFighting?'서버 연결이 끊겼습니다. 전적은 저장되지 않습니다.':'연결이 종료됐습니다. 서버 주소를 확인하세요.');
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
  button.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
    e.preventDefault?.();touchAt=Date.now();if(matched&&mode==='manual')send({type:'cast',slot:i});
  });
  button.addEventListener('click',()=>{
    if(Date.now()-touchAt>650&&matched&&mode==='manual')send({type:'cast',slot:i});
  });
  $('pvp-skills').append(button);buttons.push(button);
}
function direction(){
  const x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+touchX;
  const y=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))+touchY;
  const length=Math.hypot(x,y);
  return {type:'input',x:length>1?x/length:x,y:length>1?y/length:y};
}
function startSending(){
  if(sendLoop)global.clearInterval(sendLoop);
  sendLoop=global.setInterval(()=>{if(matched&&mode==='manual')send(direction());},66);
}
function inputKey(event,down){
  if(!matched||mode!=='manual'||global.ArenaScreenRouter?.active!=='pvp')return;
  if(event.ctrlKey||event.metaKey||event.altKey||
     event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  const key=String(event.key||'').toLowerCase();
  if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)){
    if(down)keys.add(key);else keys.delete(key);
    event.preventDefault?.();
  }
  const i=HOTKEYS.indexOf(key);
  if(i>=0){if(down&&!event.repeat)send({type:'cast',slot:i});event.preventDefault?.();}
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
  knob.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
}
pad.addEventListener('pointerdown',e=>{
  if(!matched||mode!=='manual'||pointer!==null)return;
  pointer=e.pointerId;pad.setPointerCapture?.(pointer);point(e);e.preventDefault?.();
});
pad.addEventListener('pointermove',e=>{if(e.pointerId===pointer){point(e);e.preventDefault?.();}});
function release(e){if(e.pointerId===pointer){pointer=null;touchX=touchY=0;
  knob.style.transform='translate(0px,0px)';}}
pad.addEventListener('pointerup',release);pad.addEventListener('pointercancel',release);
pad.addEventListener('lostpointercapture',release);
const canvas=$('pvp-canvas'),ctx=canvas.getContext('2d');
function animate(){
  if(frame!==null||typeof global.requestAnimationFrame!=='function')return;
  const loop=()=>{
    if(!matched){frame=null;return;}
    draw();
    frame=global.requestAnimationFrame(loop);
  };
  frame=global.requestAnimationFrame(loop);
}
function draw(){
  if(!latest||!ctx)return;
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#f0f3f5';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#dce3e8';ctx.lineWidth=1;
  for(let x=20;x<w;x+=34){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=20;y<h;y+=34){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.setLineDash([9,12]);ctx.strokeStyle='#c2cdda';ctx.lineWidth=2;
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
    ctx.fillStyle='#213142';ctx.font='bold 13px sans-serif';ctx.fillText(i===side?'YOU':'RIVAL',x,y-47);
    ctx.restore();
  });
  for(const b of latest.bullets){
    ctx.beginPath();ctx.arc(b.x,b.y,7,0,Math.PI*2);ctx.fillStyle=b.owner===side?'#398ac9':'#b85c6a';ctx.fill();
    ctx.strokeStyle='#263849';ctx.lineWidth=2;ctx.stroke();
  }
}
function onRoute(open){
  active=!!open;
  if(open){roster();return;}
  if(socket||searching||matched)closeConnection();
}
global.ArenaPvp={onRoute,close:closeConnection,get state(){return {searching,matched,mode,side,server:lastServer};}};
onRoute(global.ArenaScreenRouter?.active==='pvp');
})(window);
