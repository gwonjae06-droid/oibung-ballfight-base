/* Battle engine. Character-specific logic is registered in BEHAVIORS. */
function toggleMode() {
  if(roundStarted&&!isGameOver){const status=document.getElementById('bf-status');if(status)status.textContent='경기가 끝난 뒤 변경할 수 있습니다.';return;}
  gameMode=gameMode==='1v1'?'1v1v1':'1v1';
  const three=gameMode==='1v1v1';
  canvas.width=canvas.height=three?650:500;
  document.getElementById('container').classList[three?'add':'remove']('mode-3p');
  document.getElementById('ui-container').classList[three?'add':'remove']('mode-3p');
  document.getElementById('sec-p3').style.display=three?'block':'none';
  document.getElementById('title-text').innerText=three?'3-WAY BATTLE':'1 VS 1';
  document.getElementById('btn-mode').innerText=three?'3인전':'2인전';
  reRollMatch();
}
function reRollMatch(forcedDef) {
  if(roundStarted&&!isGameOver){setEconomyMessage('진행 중에는 재매칭할 수 없습니다.','bad');return false;}
  const count=gameMode==='1v1'?2:3;
  const pool=[...CHARACTER_DEFS,...CUSTOM_DEFS];
  if(pool.length<count){setEconomyMessage('캐릭터 모듈이 아직 모두 로드되지 않았습니다.','bad');return false;}
  const shuffled=[...pool];
  for(let i=shuffled.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
  }
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
  globalThis.AdvancedCombat?.reset();
  isGameOver=false;isPlaying=false;roundStarted=false;roundStopped=false;roundSettled=false;selectedBetPlayerNum=null;activeBet=null;
  syncStopButton();
  Object.keys(reservedItems).forEach(id=>reservedItems[id]=[]);
  document.getElementById('btn-start').innerText='경기 시작';
  document.getElementById('btn-start').dataset.state='ready';
  updateUI();renderEconomyUI();draw();return true;
}
function togglePlay() {
  if(isGameOver){reRollMatch();return;}
  if(!players.length)return;
  if(!roundStarted){if(!beginRoundEconomy())return;roundStarted=true;}
  isPlaying=!isPlaying;
  syncStopButton();
  const b=document.getElementById('btn-start');
  b.innerText=isPlaying?'일시정지':'경기 계속';
  b.dataset.state=isPlaying?'playing':'paused';
  renderEconomyUI();
}
// Kept separate from pause: this closes the current round without declaring
// the remaining fighters a winner. A stopped bet is returned exactly once.
function syncStopButton(){
  const button=document.getElementById('btn-stop');
  // Keep engine-only regression harnesses safe when optional state is absent.
  const active=typeof roundStarted!=='undefined'&&roundStarted&&
    typeof isGameOver!=='undefined'&&!isGameOver;
  if(button)button.disabled=!active;
}
function stopMatch(){
  if(!roundStarted||isGameOver)return false;
  isPlaying=false;
  isGameOver=true;
  roundStopped=true;
  screenShake=0;
  settleRound(null,'stopped');
  const start=document.getElementById('btn-start');
  start.innerText='다음 경기';
  start.dataset.state='finished';
  syncStopButton();
  if(typeof draw==='function')draw();
  return true;
}
function updateCharacter(self) {
  if(self.hp<=0)return;
  if(globalThis.ForgeExpansion?.blocked(self)){
    // Stun/silence suspends casting, not the independent skill clocks.
    if(self.forge){
      // Stun blocks fresh actions and movement, not effects already created.
      globalThis.SkillForge?.advanceTimers(self);
      globalThis.SkillForge?.advanceWorld(self,getClosestAliveEnemy(self));
    }
    return;
  }
  const b=BEHAVIORS[self.id];
  if(b&&b.update){
    if(globalThis.ForgeExpansion&&!self.forge)globalThis.ForgeExpansion.legacy(self,()=>b.update(self,getClosestAliveEnemy(self)));
    else b.update(self,getClosestAliveEnemy(self));
  }
}

function handleCombat(pA,pB) {
  if(pA.hp<=0||pB.hp<=0||pA.forgePhase||pB.forgePhase)return;
  if(globalThis.AdvancedCombat&&!AdvancedCombat.canHit(pA,pB))return;
  if(!globalThis.AdvancedCombat&&pA.jumpState&&pA.jumpState!=='ground')return;
  if(!globalThis.AdvancedCombat&&pB.jumpState&&pB.jumpState!=='ground')return;
  const dx=pB.x-pA.x,dy=pB.y-pA.y;
  const distance=Math.hypot(dx,dy),minDistance=pA.radius+pB.radius;
  if(distance>=minDistance)return;
  const nx=distance>0.0001?dx/distance:(pA.playerNum<=pB.playerNum?1:-1);
  const ny=distance>0.0001?dy/distance:0;
  // Positional separation avoids repeated wall/collision acceleration.
  const separation=(minDistance-distance+0.01)/2;
  pA.x=Math.max(pA.radius,Math.min(canvas.width-pA.radius,pA.x-nx*separation));
  pA.y=Math.max(pA.radius,Math.min(canvas.height-pA.radius,pA.y-ny*separation));
  pB.x=Math.max(pB.radius,Math.min(canvas.width-pB.radius,pB.x+nx*separation));
  pB.y=Math.max(pB.radius,Math.min(canvas.height-pB.radius,pB.y+ny*separation));
  const approach=(pB.vx-pA.vx)*nx+(pB.vy-pA.vy)*ny;
  if(approach<0){
    const impulse=Math.min(5,Math.max(1.8,-approach*0.58));
    pA.vx-=nx*impulse;pA.vy-=ny*impulse;
    pB.vx+=nx*impulse;pB.vy+=ny*impulse;
  }
  [[pA,pB],[pB,pA]]
    .filter(([a])=>!globalThis.ForgeExpansion?.blocked(a)&&BEHAVIORS[a.id]&&BEHAVIORS[a.id].onContact)
    .sort((x,y)=>(BEHAVIORS[x[0].id].order||99)-(BEHAVIORS[y[0].id].order||99))
    .forEach(([a,b])=>{
      if(globalThis.ForgeExpansion&&!a.forge)globalThis.ForgeExpansion.legacy(a,()=>BEHAVIORS[a.id].onContact(a,b));
      else BEHAVIORS[a.id].onContact(a,b);
    });
}
function update() {
  if(!isPlaying||isGameOver)return;
  players.forEach(p=>{
    globalThis.ForgeExpansion?.tick(p);
    if(p.invincible>0)p.invincible--;
    if(p.slowTimer>0){p.slowTimer--;if(p.slowTimer<=0)p.slowMultiplier=1;}
  });
  if(screenShake>0.5)screenShake*=0.88;
  players.forEach(updateCharacter);
  players.forEach(p=>{
    if(p.hp>0&&(!p.jumpState||p.jumpState==='ground')){
      const m=(p.slowTimer>0?p.slowMultiplier:1)*(globalThis.ForgeExpansion?.movement(p)??1);
      const velocity=Math.hypot(p.vx,p.vy);
      if(!Number.isFinite(velocity)){p.vx=p.playerNum%2?1.4:-1.4;p.vy=0.9;}
      else if(velocity>12){p.vx=p.vx/velocity*12;p.vy=p.vy/velocity*12;}
      p.x+=p.vx*m;p.y+=p.vy*m;
      if(p.x-p.radius<0){p.x=p.radius;p.vx*=-1;}
      if(p.x+p.radius>canvas.width){p.x=canvas.width-p.radius;p.vx*=-1;}
      if(p.y-p.radius<0){p.y=p.radius;p.vy*=-1;}
      if(p.y+p.radius>canvas.height){p.y=canvas.height-p.radius;p.vy*=-1;}
    }
  });
  if(globalThis.AdvancedCombat)AdvancedCombat.tick({
    hit(attacker,defender,action,multiplier=1,attackZ){
      // Custom fighters must use the exact same resistance, knockback and
      // status rules for delayed high-level attacks as for direct actions.
      if(attacker?.forge&&globalThis.SkillForge?.hit)
        return globalThis.SkillForge.hit(attacker,defender,action,multiplier,attackZ);
      if(!AdvancedCombat.canHit(attacker,defender,attackZ))return false;
      if(defender.invincible>0||defender.hp<=0)return false;
      const value=Math.max(0,Math.round((action.damage||0)*multiplier));
      if(value){
        defender.hp=Math.max(0,defender.hp-value);defender.invincible=12;
        addFloatingText('-'+value,defender.x,defender.y-28,attacker.forge?.color||'#4b5563',17);
        createHitParticles(defender.x,defender.y,attacker.forge?.color||'#58687a',12);
      }
      if(action.status==='ice'){defender.slowTimer=Math.max(defender.slowTimer||0,90);defender.slowMultiplier=.5;}
      if(action.status==='fire'||action.status==='poison')defender.bfDot=Math.max(defender.bfDot||0,Math.round((action.duration||2)*60));
      return true;
    }
  });
  const alive=players.filter(p=>p.hp>0);
  for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++)handleCombat(alive[i],alive[j]);
  for(let i=shockwaves.length-1;i>=0;i--){const sw=shockwaves[i];sw.radius+=5.5;sw.alpha-=0.03;if(sw.alpha<=0||sw.radius>=sw.maxRadius)shockwaves.splice(i,1);}
  // Visual particles follow simulation time and respect pause.
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.alpha-=0.025;
    if(p.alpha<=0)particles.splice(i,1);
  }
  for(let i=floatingTexts.length-1;i>=0;i--){
    const f=floatingTexts[i];f.y+=f.vy;f.alpha-=0.015;
    if(f.alpha<=0)floatingTexts.splice(i,1);
  }
  players.forEach(p=>globalThis.ForgeExpansion?.revive(p));
  const finalAlive=players.filter(p=>p.hp>0);
  if(finalAlive.length<=1){isGameOver=true;isPlaying=false;settleRound(finalAlive.length===1?finalAlive[0]:null);document.getElementById('btn-start').innerText='다음 경기';document.getElementById('btn-start').dataset.state='finished';syncStopButton();}
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
    if(tag&&p.hp>0){te.style.display='inline-block';te.textContent=tag.text+(p.itemLabels&&p.itemLabels.length?` · ${p.itemLabels.join(' · ')}`:'');}
    else te.style.display='none';
    const hud=document.getElementById('sec-p'+n);
    if(p.forge&&hud&&globalThis.SkillForge){
      let meters=hud.querySelector?.('.forge-cooldown-list');
      if(!meters){
        meters=document.createElement('div');
        meters.className='forge-cooldown-list';
        meters.setAttribute('aria-label','스킬별 독립 재사용 대기시간');
        hud.append(meters);
      }
      // The full-catalog fighter owns every cooldown, but only four
      // upcoming actions are shown here so the HUD never becomes 50 rows.
      const total=p.forge.skills.length;
      const visibleIndices=p.forge.allAbilities?
        Array.from({length:Math.min(4,total)},(_,j)=>((p.forgeCursor||0)+j)%total):
        p.forge.skills.map((_,i)=>i);
      meters.dataset.full=p.forge.allAbilities?'전체 '+total+'개 능력 · 다음 발동 순서':'';
      if(meters.children.length!==visibleIndices.length){
        meters.replaceChildren();
        visibleIndices.forEach(()=>{
          const item=document.createElement('div');item.className='forge-cooldown-item';
          const name=document.createElement('span');name.className='forge-cooldown-name';
          const track=document.createElement('span');track.className='forge-cooldown-track';
          const fill=document.createElement('span');fill.className='forge-cooldown-fill';track.append(fill);
          const time=document.createElement('span');time.className='forge-cooldown-time';
          item.append(name,track,time);meters.append(item);
        });
      }
      visibleIndices.forEach((index,j)=>{
        const skill=p.forge.skills[index];
        const max=SkillForge.cooldownFrames(p,skill);
        const ticks=Math.min(max,p.forgeTicks[index]||0),ready=ticks>=max;
        const item=meters.children[j];
        item.children[0].textContent=skill.name;
        item.children[1].firstElementChild.style.width=(ticks/max*100).toFixed(1)+'%';
        item.children[2].textContent=ready?'준비':((max-ticks)/60).toFixed(1)+'s';
        item.dataset.ready=ready?'true':'false';
      });
    }else{
      const meters=hud?.querySelector?.('.forge-cooldown-list');
      meters?.remove();
    }
  });
}
// requestAnimationFrame scheduling is owned by battle-effects.js.
let gameLoop;
