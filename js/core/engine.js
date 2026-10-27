/* Battle engine. Character-specific logic is registered in BEHAVIORS. */
function toggleMode() {
  if(roundStarted&&!isGameOver){setEconomyMessage('경기가 끝난 뒤 모드를 바꿀 수 있습니다.','bad');return;}
  gameMode=gameMode==='1v1'?'1v1v1':'1v1';
  const three=gameMode==='1v1v1';
  canvas.width=canvas.height=three?650:500;
  document.getElementById('container').classList[three?'add':'remove']('mode-3p');
  document.getElementById('ui-container').classList[three?'add':'remove']('mode-3p');
  document.getElementById('sec-p3').style.display=three?'block':'none';
  document.getElementById('title-text').innerText=three?'🔥 1vs1vs1 3인 난투':'⚔️ 1vs1 랜덤 배틀';
  document.getElementById('btn-mode').innerText=three?'⚔️ 모드: 1vs1vs1':'🔥 모드: 1vs1';
  reRollMatch();
}
function reRollMatch(forcedDef) {
  if(roundStarted&&!isGameOver){setEconomyMessage('진행 중에는 재매칭할 수 없습니다.','bad');return false;}
  const count=gameMode==='1v1'?2:3;
  const pool=[...CHARACTER_DEFS,...CUSTOM_DEFS];
  if(pool.length<count){setEconomyMessage('캐릭터 모듈이 아직 모두 로드되지 않았습니다.','bad');return false;}
  let shuffled=[...pool].sort(()=>Math.random()-0.5);
  if(forcedDef&&pool.includes(forcedDef))shuffled=[forcedDef,...shuffled.filter(d=>d!==forcedDef)];
  players=[];
  for(let i=0;i<count;i++) {
    const p=shuffled[i].createInstance(i+1);
    if(count===2){p.x=i===0?130:370;p.y=250;p.vx=i===0?1.1:-1.1;p.vy=i===0?0.9:-0.9;}
    else if(i===0){p.x=325;p.y=150;p.vx=(Math.random()-0.5)*2;p.vy=1;}
    else if(i===1){p.x=490;p.y=480;p.vx=-1;p.vy=-0.8;}
    else{p.x=160;p.y=480;p.vx=1;p.vy=-0.8;}
    players.push(p);
  }
  particles=[];floatingTexts=[];shockwaves=[];screenShake=0;
  isGameOver=false;isPlaying=false;roundStarted=false;roundSettled=false;selectedBetPlayerNum=null;activeBet=null;
  Object.keys(reservedItems).forEach(id=>reservedItems[id]=[]);
  document.getElementById('btn-start').innerText='▶ 경기 시작';
  document.getElementById('btn-start').style.background='#22c55e';
  updateUI();renderEconomyUI();draw();return true;
}
function togglePlay() {
  if(isGameOver){reRollMatch();setEconomyMessage('새 대진입니다. 베팅과 아이템을 설정하세요.');return;}
  if(!players.length)return;
  if(!roundStarted){if(!beginRoundEconomy())return;roundStarted=true;}
  isPlaying=!isPlaying;
  const b=document.getElementById('btn-start');
  b.innerText=isPlaying?'⏸ 일시정지':'▶ 경기 계속';
  b.style.background=isPlaying?'#f59e0b':'#22c55e';
  renderEconomyUI();
}
function updateCharacter(self) {
  if(self.hp<=0)return;
  const b=BEHAVIORS[self.id];
  if(b&&b.update)b.update(self,getClosestAliveEnemy(self));
}
function handleCombat(pA,pB) {
  if(pA.hp<=0||pB.hp<=0)return;
  if(pA.jumpState&&pA.jumpState!=='ground')return;
  if(pB.jumpState&&pB.jumpState!=='ground')return;
  const dist=Math.hypot(pA.x-pB.x,pA.y-pB.y);
  if(dist>=pA.radius+pB.radius)return;
  // Preserve original collision response, including its B y-direction sign.
  const nx=(pB.x-pA.x)/dist,ny=(pB.y-pA.y)/dist;
  pA.vx-=nx*1.8;pA.vy-=ny*1.8;pB.vx+=nx*1.8;pB.vy-=ny*1.8;
  [[pA,pB],[pB,pA]]
    .filter(([a])=>BEHAVIORS[a.id]&&BEHAVIORS[a.id].onContact)
    .sort((x,y)=>(BEHAVIORS[x[0].id].order||99)-(BEHAVIORS[y[0].id].order||99))
    .forEach(([a,b])=>BEHAVIORS[a.id].onContact(a,b));
}
function update() {
  if(!isPlaying||isGameOver)return;
  players.forEach(p=>{
    if(p.invincible>0)p.invincible--;
    if(p.slowTimer>0){p.slowTimer--;if(p.slowTimer<=0)p.slowMultiplier=1;}
  });
  if(screenShake>0.5)screenShake*=0.88;
  players.forEach(updateCharacter);
  players.forEach(p=>{
    if(p.hp>0&&(!p.jumpState||p.jumpState==='ground')){
      const m=p.slowTimer>0?p.slowMultiplier:1;
      p.x+=p.vx*m;p.y+=p.vy*m;
      if(p.x-p.radius<0){p.x=p.radius;p.vx*=-1;}
      if(p.x+p.radius>canvas.width){p.x=canvas.width-p.radius;p.vx*=-1;}
      if(p.y-p.radius<0){p.y=p.radius;p.vy*=-1;}
      if(p.y+p.radius>canvas.height){p.y=canvas.height-p.radius;p.vy*=-1;}
    }
  });
  const alive=players.filter(p=>p.hp>0);
  for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++)handleCombat(alive[i],alive[j]);
  for(let i=shockwaves.length-1;i>=0;i--){const sw=shockwaves[i];sw.radius+=5.5;sw.alpha-=0.03;if(sw.alpha<=0||sw.radius>=sw.maxRadius)shockwaves.splice(i,1);}
  const finalAlive=players.filter(p=>p.hp>0);
  if(finalAlive.length<=1){isGameOver=true;isPlaying=false;settleRound(finalAlive.length===1?finalAlive[0]:null);document.getElementById('btn-start').innerText='🔄 새 대진 만들기';document.getElementById('btn-start').style.background='#22c55e';}
  updateUI();
}
function updateUI() {
  players.forEach((p,idx)=>{
    const n=idx+1,el=document.getElementById(`p${n}-name`);
    if(!el)return;
    el.innerText=p.name;
    document.getElementById(`p${n}-hp-text`).innerText=Math.ceil(p.hp);
    document.getElementById(`p${n}-maxhp`).innerText=p.maxHp;
    document.getElementById(`p${n}-hp-bar`).style.width=(Math.max(0,p.hp)/p.maxHp*100)+'%';
    const tag=p.getTag(),te=document.getElementById(`p${n}-tag`);
    if(tag&&p.hp>0){te.style.display='inline-block';te.innerText=tag.text+(p.itemLabels&&p.itemLabels.length?` · ${p.itemLabels.join(' · ')}`:'');te.style.background=tag.bg;te.style.color=tag.color;te.style.border=`1.5px solid ${tag.border}`;}
    else te.style.display='none';
  });
}
function gameLoop(){update();draw();requestAnimationFrame(gameLoop);}
