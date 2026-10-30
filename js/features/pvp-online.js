/* Online PvP: automatic fighter battles only, with a spectator canvas. */
(function(global){
'use strict';
const doc=global.document,screen=doc?.getElementById('screen-pvp');
if(!screen)return;
const host=doc.createElement('div');host.id='pvp-app';host.className='pvp-app';
host.innerHTML='<section class="pvp-lobby" id="pvp-lobby">'
  +'<div class="pvp-intro"><span class="eyebrow">ONLINE MATCH / 1 VS 1</span>'
  +'<h3>나만의 파이터로 대결</h3><p>파이터를 선택하면 AI가 실시간으로 싸웁니다. 전투 전략은 캐릭터와 제작한 스킬로 결정하세요.</p></div>'
  +'<label class="pvp-label" for="pvp-fighter">출전 캐릭터</label><select id="pvp-fighter"></select>'
  +'<details class="pvp-network" hidden><summary>온라인 서버 연결 설정</summary>'
  +'<label for="pvp-server">PvP 서버 주소 (wss://)</label>'
  +'<div class="pvp-server-row"><input id="pvp-server" inputmode="url" type="url" spellcheck="false" placeholder="wss://your-worker.workers.dev">'
  +'<button type="button" id="pvp-save-server">주소 저장</button></div>'
  +'<small>이전 Cloudflare 서버 연결 설정(현재 Supabase 사용)</small></details>'
  +'<div class="pvp-lobby-actions"><button id="pvp-search" type="button">랜덤 매칭 시작</button>'
  +'<button id="pvp-cancel" type="button" hidden>매칭 취소</button></div>'
  +'<p class="pvp-status" id="pvp-status" role="status" aria-live="polite">출전 파이터를 선택하고 자동전투 매칭을 시작하세요.</p>'
  +'<p class="pvp-balance-note">PvP 베타: 자동전투 전용 매칭, 실제 제작한 1~4개 스킬 및 최대 3개 연계 동작을 사용합니다. 원래 전투 엔진의 스킬과 연계를 사용합니다. 전투 계산은 한 플레이어 기기에서 수행하므로 랭킹전용 치트 방지는 지원하지 않습니다.</p></section>'
  +'<section class="pvp-match" id="pvp-match" hidden aria-label="실시간 온라인 PvP 전투">'
  +'<div class="pvp-match-header"><div><small id="pvp-match-type">자동 전투</small><strong id="pvp-round-state">온라인 경기</strong></div>'
  +'<span id="pvp-clock">2:00</span><button type="button" id="pvp-forfeit">경기 포기</button></div>'
  +'<div class="pvp-vitals" hidden aria-hidden="true"><div><span id="pvp-name-0">Player 1</span><div class="pvp-hp"><i id="pvp-hp-0"></i></div>'
  +'<small id="pvp-hp-text-0">240/240</small></div>'
  +'<div><span id="pvp-name-1">Player 2</span><div class="pvp-hp pvp-hp-foe"><i id="pvp-hp-1"></i></div>'
  +'<small id="pvp-hp-text-1">240/240</small></div></div>'
  +'<canvas id="pvp-canvas" width="680" height="460" aria-label="PvP 전장"></canvas>'
  +'<p class="pvp-result" id="pvp-result" hidden role="status"></p>'
  +'<button type="button" id="pvp-again" hidden>다른 상대 찾기</button></section>';
screen.append(host);
const $=id=>doc.getElementById(id);
const visualEffects=[],flecks=[],lastHealth=[null,null];
let fxClock=0;
let socket=null,searching=false,matched=false,mode='auto',side=0,latest=null,view=null,
  frame=null,active=true,lastServer='';
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
function send(msg){
  if(socket?.readyState!==1)return false;
  try{socket.send(JSON.stringify(msg));return true;}catch(_){return false;}
}
function cleanup(){
 if(frame!==null&&global.cancelAnimationFrame)global.cancelAnimationFrame(frame);
 frame=null;
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
  if(message)status(message);
}
function showMatch(data){
  searching=false;matched=true;side=data.you===1?1:0;
  $('pvp-lobby').hidden=true;$('pvp-match').hidden=false;
  $('pvp-match-type').textContent='자동전투 · PvP';
  $('pvp-result').hidden=true;$('pvp-again').hidden=true;
  $('pvp-round-state').textContent='상대 발견 · 경기 진행';
  $('pvp-forfeit').hidden=false;
  visualEffects.length=0;flecks.length=0;lastHealth.fill(null);
  global.PvpOriginalEngine.show();
  animate();
}
function renderState(data){
  if(data.events?.length)spawnEffects(data.events,data.players);
  latest=data;
  if(data.finished)global.PvpOriginalEngine.paint();
  $('pvp-round-state').textContent='AI 자동전투 · 실시간 대결';
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

}
function finish(winner,reason){
  matched=false;searching=false;cleanup();
  $('pvp-result').hidden=false;
  $('pvp-result').textContent=reason||(winner===-1?'무승부':winner===side?'승리!':'패배');
  $('pvp-round-state').textContent='경기 종료';
  $('pvp-forfeit').hidden=true;
  $('pvp-again').hidden=false;
}
function onMessage(event){
  let data;try{data=JSON.parse(event.data);}catch(_){return;}
  if(data.type==='connected'){send({type:'queue',mode,profile:profile()});}
  else if(data.type==='queued')status('매칭 대기 중 · 자동전투 상대를 찾고 있습니다.');
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
  mode='auto';
  searching=true;lastServer='Supabase 무료 Realtime';
  $('pvp-search').hidden=true;$('pvp-cancel').hidden=false;
  $('pvp-fighter').disabled=true;
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
