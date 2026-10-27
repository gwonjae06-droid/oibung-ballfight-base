/* Walking velocity and external impulse are separate. Base: 2.2 px/tick at the existing 2x setting. */
const MOTION = { base: 2.2, drag: 0.94, wallBounce: 0.7, collisionBounce: 0.7 };
function toggleMode() {
  if(roundStarted&&!isGameOver){setEconomyMessage('경기가 끝난 뒤 모드를 바꿀 수 있습니다.','bad');return;}
  gameMode=gameMode==='1v1'?'1v1v1':'1v1';
  const three=gameMode==='1v1v1';canvas.width=canvas.height=three?650:500;
  document.getElementById('container').classList[three?'add':'remove']('mode-3p');
  document.getElementById('ui-container').classList[three?'add':'remove']('mode-3p');
  document.getElementById('sec-p3').style.display=three?'block':'none';
  document.getElementById('title-text').innerText=three?'🔥 1vs1vs1 3인 난투':'⚔️ 1vs1 랜덤 배틀';
  document.getElementById('btn-mode').innerText=three?'⚔️ 모드: 1vs1vs1':'🔥 모드: 1vs1';
  reRollMatch();
}
function reRollMatch(forcedDef) {
  if(roundStarted&&!isGameOver){setEconomyMessage('진행 중에는 재매칭할 수 없습니다.','bad');return false;}
  const count=gameMode==='1v1'?2:3,pool=[...CHARACTER_DEFS,...CUSTOM_DEFS];
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
    initMotion(p);normalizeWalking(p);players.push(p);
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
  isPlaying=!isPlaying;const b=document.getElementById('btn-start');
  b.innerText=isPlaying?'⏸ 일시정지':'▶ 경기 계속';b.style.background=isPlaying?'#f59e0b':'#22c55e';renderEconomyUI();
}
function initMotion(p) {
  if(!Number.isFinite(p.forceX))p.forceX=0;
  if(!Number.isFinite(p.forceY))p.forceY=0;
}
function walkingSpeed(p) {
  let speed=MOTION.base;
  if(p.id==='oh')speed=p.mode==='boin'?4.8:0.7;
  if(p.id==='lee'&&p.currentRune==='난입')speed=2.8;
  if(p.id==='choi')speed=p.suneungState==='success'?5.5:p.suneungState==='fail'?0.6:MOTION.base;
  if(p.spec){if(p.bfRage>0)speed*=1.5;else if(p.bfTired>0)speed*=0.5;if(p.bfDash>0)speed*=3;}
  if(p.itemLabels&&p.itemLabels.includes(SHOP_ITEMS.speed.label))speed*=1.35;
  return speed;
}
function normalizeWalking(p) {
  const speed=walkingSpeed(p),len=Math.hypot(p.vx,p.vy);
  if(!Number.isFinite(len)||len<0.00001){p.vx=speed;p.vy=0;}
  else{p.vx=p.vx/len*speed;p.vy=p.vy/len*speed;}
}
function moveBody(p) {
  initMotion(p);
  if(p.hp>0&&(!p.jumpState||p.jumpState==='ground')){
    normalizeWalking(p);
    const slow=p.slowTimer>0?p.slowMultiplier:1;
    p.x+=p.vx*slow+p.forceX;p.y+=p.vy*slow+p.forceY;
    containBody(p);
  }
  p.forceX*=MOTION.drag;p.forceY*=MOTION.drag;
  if(Math.abs(p.forceX)<0.01)p.forceX=0;
  if(Math.abs(p.forceY)<0.01)p.forceY=0;
}
function containBody(p) {
  if(p.x<p.radius){p.x=p.radius;p.vx=Math.abs(p.vx);if(p.forceX<0)p.forceX=-p.forceX*MOTION.wallBounce;}
  if(p.x>canvas.width-p.radius){p.x=canvas.width-p.radius;p.vx=-Math.abs(p.vx);if(p.forceX>0)p.forceX=-p.forceX*MOTION.wallBounce;}
  if(p.y<p.radius){p.y=p.radius;p.vy=Math.abs(p.vy);if(p.forceY<0)p.forceY=-p.forceY*MOTION.wallBounce;}
  if(p.y>canvas.height-p.radius){p.y=canvas.height-p.radius;p.vy=-Math.abs(p.vy);if(p.forceY>0)p.forceY=-p.forceY*MOTION.wallBounce;}
}
function updateCharacter(self) {
  if(self.hp<=0)return;
  const b=BEHAVIORS[self.id];
  if(!b||!b.update)return;
  const before=players.filter(p=>p!==self).map(p=>({p,vx:p.vx,vy:p.vy}));
  b.update(self,getClosestAliveEnemy(self));
  before.forEach(({p,vx,vy})=>{
    const dx=p.vx-vx,dy=p.vy-vy;
    if(dx!==0||dy!==0){
      initMotion(p);
      if(self.id==='lee'&&self.currentRune==='빙결'){
        p.slowTimer=Math.max(p.slowTimer||0,60);p.slowMultiplier=Math.min(p.slowMultiplier||1,0.15);
      }else{p.forceX+=dx;p.forceY+=dy;}
      p.vx=vx;p.vy=vy;
    }
  });
}
function handleCombat(a,b) {
  if(a.hp<=0||b.hp<=0)return;
  if((a.jumpState&&a.jumpState!=='ground')||(b.jumpState&&b.jumpState!=='ground'))return;
  const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),radius=a.radius+b.radius;
  if(dist>=radius)return;
  initMotion(a);initMotion(b);
  const nx=dist>0.00001?dx/dist:1,ny=dist>0.00001?dy/dist:0;
  const overlap=(radius-dist+0.01)/2;
  a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
  const sa=a.slowTimer>0?a.slowMultiplier:1,sb=b.slowTimer>0?b.slowMultiplier:1;
  const relative=(b.vx*sb+b.forceX-a.vx*sa-a.forceX)*nx+(b.vy*sb+b.forceY-a.vy*sa-a.forceY)*ny;
  if(relative<0){const impulse=-(1+MOTION.collisionBounce)*relative/2;a.forceX-=nx*impulse;a.forceY-=ny*impulse;b.forceX+=nx*impulse;b.forceY+=ny*impulse;}
  containBody(a);containBody(b);
  [[a,b],[b,a]].filter(([p])=>BEHAVIORS[p.id]&&BEHAVIORS[p.id].onContact)
    .sort((x,y)=>(BEHAVIORS[x[0].id].order||99)-(BEHAVIORS[y[0].id].order||99))
    .forEach(([p,q])=>BEHAVIORS[p.id].onContact(p,q));
}
function update() {
  if(!isPlaying||isGameOver)return;
  players.forEach(p=>{
    initMotion(p);normalizeWalking(p);
    if(p.invincible>0)p.invincible--;
    if(p.slowTimer>0){p.slowTimer--;if(p.slowTimer<=0)p.slowMultiplier=1;}
  });
  if(screenShake>0.5)screenShake*=0.88;
  players.forEach(updateCharacter);players.forEach(moveBody);
  const alive=players.filter(p=>p.hp>0);
  for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++)handleCombat(alive[i],alive[j]);
  for(let i=shockwaves.length-1;i>=0;i--){const sw=shockwaves[i];sw.radius+=5.5;sw.alpha-=0.03;if(sw.alpha<=0||sw.radius>=sw.maxRadius)shockwaves.splice(i,1);}
  const finalAlive=players.filter(p=>p.hp>0);
  if(finalAlive.length<=1){isGameOver=true;isPlaying=false;settleRound(finalAlive.length===1?finalAlive[0]:null);document.getElementById('btn-start').innerText='🔄 새 대진 만들기';document.getElementById('btn-start').style.background='#22c55e';}
  updateUI();
}
function updateUI() {
  players.forEach((p,idx)=>{
    const n=idx+1,el=document.getElementById(`p${n}-name`);if(!el)return;
    el.innerText=p.name;
    document.getElementById(`p${n}-hp-text`).innerText=Math.ceil(p.hp);
    document.getElementById(`p${n}-maxhp`).innerText=p.maxHp;
    document.getElementById(`p${n}-hp-bar`).style.width=(Math.max(0,p.hp)/p.maxHp*100)+'%';
    const tag=p.getTag(),te=document.getElementById(`p${n}-tag`);
    if(tag&&p.hp>0){te.style.display='inline-block';te.innerText=tag.text+(p.itemLabels&&p.itemLabels.length?` · ${p.itemLabels.join(' · ')}`:'');te.style.background=tag.bg;te.style.color=tag.color;te.style.border=`1.5px solid ${tag.border}`;}else te.style.display='none';
  });
}
function gameLoop(){update();draw();requestAnimationFrame(gameLoop);}
