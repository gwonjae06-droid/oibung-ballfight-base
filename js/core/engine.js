/* Battle engine. Character-specific logic is registered in BEHAVIORS. */
// Dynamic 2–10 fighter rounds. Logical canvas dimensions grow with the
// roster; CSS handles the smooth visual transition in the main layout.
// One gentle oblique impulse per fighter pair prevents perfectly vertical ping-pong.
let openingCollisionPairs=new Set();
function arenaDimensions(count){
  const n=Math.max(2,Math.min(10,Math.round(count)||2));
  const w=500+(n-2)*82;
  const h=Math.round(w*(1+(n-2)*.022));
  return {width:w,height:h};
}
function setMatchCount(count){
  if(roundStarted&&!isGameOver){
    const status=document.getElementById('bf-status');
    if(status)status.textContent='경기가 끝난 뒤 인원수를 변경할 수 있습니다.';
    const menu=document.getElementById('arena-player-count');
    if(menu)menu.value=String(matchCount);
    return false;
  }
  matchCount=Math.max(2,Math.min(10,Math.round(Number(count))||2));
  gameMode=matchCount===2?'1v1':matchCount===3?'1v1v1':matchCount+'-way';
  const dimensions=arenaDimensions(matchCount);
  canvas.width=dimensions.width;canvas.height=dimensions.height;
  const container=document.getElementById('container');
  if(container)container.dataset.fighterCount=String(matchCount);
  const wrapper=document.querySelector('.canvas-wrapper');
  if(wrapper)wrapper.style.aspectRatio=dimensions.width+' / '+dimensions.height;
  const title=document.getElementById('title-text');
  if(title)title.innerText=matchCount===2?'1 VS 1':matchCount+'인 자유 대전';
  const selector=document.getElementById('arena-player-count');
  if(selector)selector.value=String(matchCount);
  return reRollMatch();
}
function toggleMode(){return setMatchCount(matchCount>=10?2:matchCount+1);}
function placeFighters(defs){
  const count=defs.length,centerX=canvas.width/2,centerY=canvas.height/2;
  // Evenly spaced on an ellipse, so everyone has comparable room and
  // nobody spawns on top of another in a 10-fighter melee.
  return defs.map((def,i)=>{
    const angle=-Math.PI/2+i*Math.PI*2/count;
    const distanceX=Math.min(canvas.width*.36,canvas.width/2-45);
    const distanceY=Math.min(canvas.height*.34,canvas.height/2-45);
    const p=def.createInstance(i+1);
    globalThis.CosmeticArcade?.applyToFighter?.(p);
    // Only two-player matches: smaller silhouettes AND precise collision bodies.
    // Keep a separate base radius so temporary grow/shrink restores correctly.
    if(count===2){
      p.radius=Math.max(12,Math.round((p.radius||34)*.85*10)/10);
      p.baseRadius=p.radius;
    }
    p.x=centerX+Math.cos(angle)*distanceX;
    p.y=centerY+Math.sin(angle)*distanceY;
    const towards=Math.atan2(centerY-p.y,centerX-p.x);
    p.vx=Math.cos(towards)*1.3;p.vy=Math.sin(towards)*1.3;
    return p;
  });
}
function reRollMatch(forcedDef) {
  if(roundStarted&&!isGameOver){setEconomyMessage('진행 중에는 재매칭할 수 없습니다.','bad');return false;}
  const count=matchCount;
  const pool=[...CHARACTER_DEFS,...CUSTOM_DEFS];
  if(!pool.length){setEconomyMessage('캐릭터 모듈이 로드되지 않았습니다.','bad');return false;}
  let defs;
  if(Array.isArray(forcedDef)){
    if(forcedDef.length!==count||forcedDef.some(d=>!pool.includes(d)&&!globalThis.ArenaTower?.isTransientDef?.(d)))return false;
    defs=forcedDef.slice(); // mirror matches allow repeated character definitions
  }else{
    const shuffled=pool.slice().sort(()=>Math.random()-.5);
    if(forcedDef&&pool.includes(forcedDef)){
      shuffled.splice(shuffled.indexOf(forcedDef),1);shuffled.unshift(forcedDef);
    }
    defs=Array.from({length:count},(_,i)=>shuffled[i%shuffled.length]);
  }
  players=placeFighters(defs);
  globalThis.ArenaStalemate?.reset?.();
  openingCollisionPairs.clear();
  particles=[];floatingTexts=[];shockwaves=[];screenShake=0;
  globalThis.ImpactPhysics?.reset?.();
  globalThis.AdvancedCombat?.reset();
  isGameOver=false;isPlaying=false;roundStarted=false;roundStopped=false;roundSettled=false;selectedBetPlayerNum=null;activeBet=null;
  globalThis.BackgroundMusic?.setBattle(false);
  syncStopButton();
  Object.keys(reservedItems).forEach(id=>reservedItems[id]=[]);
  const start=document.getElementById('btn-start');if(start){start.innerText='경기 시작';start.dataset.state='ready';}
  updateUI();renderEconomyUI();draw();return true;
}
function togglePlay({towerBattle=false}={}) {
  // A waiting Tower floor can only be started from its dedicated Start
  // control. The shared free-battle button must not bypass the intermission.
  if(globalThis.ArenaTower?.active&&globalThis.ArenaTower.stage==='between'&&!towerBattle)return false;
  if(isGameOver){reRollMatch();return false;}
  if(!players.length)return false;
  if(!roundStarted){
    if(towerBattle){
      // Tower fights have no wager or shop reservations. Do not block their
      // start on hidden free-battle economy inputs or betting validation.
      const wager=document.getElementById('wager-input');
      if(wager)wager.value='0';
      selectedBetPlayerNum=null;activeBet=null;roundSettled=false;
      Object.keys(reservedItems).forEach(id=>reservedItems[id]=[]);
    }else if(!beginRoundEconomy())return false;
    roundStarted=true;
    globalThis.CosmeticArcade?.startRound?.(players);
  }
  isPlaying=!isPlaying;
  globalThis.BackgroundMusic?.setBattle(true,!isPlaying);
  syncStopButton();
  const b=document.getElementById('btn-start');
  if(b){b.innerText=isPlaying?'일시정지':'경기 계속';b.dataset.state=isPlaying?'playing':'paused';}
  renderEconomyUI();
  return isPlaying;
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
  globalThis.BackgroundMusic?.setBattle(false);
  screenShake=0;
  settleRound(null,'stopped');
  const start=document.getElementById('btn-start');
  start.innerText='다음 경기';
  start.dataset.state='finished';
  syncStopButton();
  globalThis.ArenaTower?.onBattleEnd?.(null,'stopped');
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
  // Arena combat is AI-controlled in every playable mode.  if(globalThis.ArenaTower?.active&&self.towerPatternBoss){self.vx=0;self.vy=0;return;}
  if(globalThis.ArenaTower?.active&&self.towerHero&&self.forge){
    globalThis.SkillForge?.autoUpdate?.(self,getClosestAliveEnemy(self));return;
  }
  const b=BEHAVIORS[self.id],foe=getClosestAliveEnemy(self);
  if(b&&b.update){
    if(globalThis.ForgeExpansion&&!self.forge)globalThis.ForgeExpansion.legacy(self,()=>b.update(self,foe));
    else b.update(self,foe);
  }
  // Built-in fighters retain their original attacks/movement. Only add
  // a bounded evasive steering correction if a visible threat is approaching.
  if(!self.forge&&!self.towerPatternBoss)
    globalThis.ArenaAutoAI?.react?.(self,foe);
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
  const movingA=(pA.forgeDash||0)>0||(pA.movementOnlyFrames||0)>0;
  const movingB=(pB.forgeDash||0)>0||(pB.movementOnlyFrames||0)>0;
  const clampX=(value,r)=>Math.max(r,Math.min(canvas.width-r,value));
  const clampY=(value,r)=>Math.max(r,Math.min(canvas.height-r,value));
  const overlap=minDistance-distance+.01;
  // During pure movement, separate overlapping bodies without imparting
  // any velocity to the target. This lets a dash reach melee distance.
  if(movingA!==movingB){
    const mover=movingA?pA:pB,sign=movingA?-1:1;
    mover.x=clampX(mover.x+nx*overlap*sign,mover.radius);
    mover.y=clampY(mover.y+ny*overlap*sign,mover.radius);
  }else{
    pA.x=clampX(pA.x-nx*overlap*.5,pA.radius);
    pA.y=clampY(pA.y-ny*overlap*.5,pA.radius);
    pB.x=clampX(pB.x+nx*overlap*.5,pB.radius);
    pB.y=clampY(pB.y+ny*overlap*.5,pB.radius);
  }
  if(movingA||movingB)return;
  const approach=((pB.vx||0)+(pB.impactVX||0)*.4-(pA.vx||0)-(pA.impactVX||0)*.4)*nx+
    ((pB.vy||0)+(pB.impactVY||0)*.4-(pA.vy||0)-(pA.impactVY||0)*.4)*ny;
  if(approach<0){
    const impulse=Math.min(5,Math.max(1.8,-approach*.58));
    pA.vx-=nx*impulse;pA.vy-=ny*impulse;
    pB.vx+=nx*impulse;pB.vy+=ny*impulse;
    const pair=[pA.playerNum,pB.playerNum].sort((a,b)=>a-b).join(':');
    if(!openingCollisionPairs.has(pair)&&approach<-.2){
      openingCollisionPairs.add(pair);
      const glance=Math.min(1.25,Math.max(.7,-approach*.21));
      const side=pA.playerNum<=pB.playerNum?1:-1;
      const tx=-ny*glance*side,ty=nx*glance*side;
      pA.vx+=tx;pA.vy+=ty;
      pB.vx-=tx;pB.vy-=ty;
    }
  }
  // Collisions caused by another successful hit are not bonus attacks.
  if((pA.impactSpeed||0)>4||(pB.impactSpeed||0)>4)return;
  [[pA,pB],[pB,pA]]
    .filter(([a])=>!a.manualTower&&!globalThis.ForgeExpansion?.blocked(a)&&BEHAVIORS[a.id]&&BEHAVIORS[a.id].onContact)
    .sort((x,y)=>(BEHAVIORS[x[0].id].order||99)-(BEHAVIORS[y[0].id].order||99))
    .forEach(([a,b])=>{
      const hp=b.hp;
      if(globalThis.ForgeExpansion&&!a.forge)globalThis.ForgeExpansion.legacy(a,()=>BEHAVIORS[a.id].onContact(a,b));
      else BEHAVIORS[a.id].onContact(a,b);
      if(b.hp<hp)globalThis.SkillVisuals?.contact?.(a,b);
    });
}
function update() {
  if(!isPlaying||isGameOver)return;
  const healthAtStart=players.map(p=>p.hp);
  players.forEach(p=>{
    if(p.movementOnlyFrames>0)p.movementOnlyFrames--;
    globalThis.ForgeExpansion?.tick(p);
    if(p.invincible>0)p.invincible--;
    if(p.slowTimer>0){p.slowTimer--;if(p.slowTimer<=0)p.slowMultiplier=1;}
  });
  if(screenShake>0.5)screenShake*=0.88;
  globalThis.ImpactPhysics?.tick?.();
  players.forEach(updateCharacter);
  players.forEach(p=>{
    if(p.hp>0&&(!p.jumpState||p.jumpState==='ground')){
      const m=(p.slowTimer>0?p.slowMultiplier:1)*(globalThis.ForgeExpansion?.movement(p)??1);
      const velocity=Math.hypot(p.vx,p.vy);
      if(!Number.isFinite(velocity)){p.vx=p.playerNum%2?1.4:-1.4;p.vy=0.9;}
      else if(velocity>12){p.vx=p.vx/velocity*12;p.vy=p.vy/velocity*12;}
      p.x+=p.vx*m;p.y+=p.vy*m;
      // Hit force is separate from AI locomotion: normal movement retains
      // its 12px cap, but a confirmed blow can burst >40px on its first tick.
      globalThis.ImpactPhysics?.integrate?.(p);
      let bounceX=false,bounceY=false;
      if(p.x-p.radius<0){p.x=p.radius;p.vx=Math.abs(p.vx);bounceX=true;}
      if(p.x+p.radius>canvas.width){p.x=canvas.width-p.radius;p.vx=-Math.abs(p.vx);bounceX=true;}
      if(p.y-p.radius<0){p.y=p.radius;p.vy=Math.abs(p.vy);bounceY=true;}
      if(p.y+p.radius>canvas.height){p.y=canvas.height-p.radius;p.vy=-Math.abs(p.vy);bounceY=true;}
      if(bounceX||bounceY){
        // Subtle, bounded wall energy and a tiny off-axis nudge: no
        // repeated sticking on straight corridors and no runaway speed.
        const before=Math.hypot(p.vx,p.vy);
        if(bounceX)p.vy+=(p.vy<0?-1:1)*.09;
        if(bounceY)p.vx+=(p.playerNum%2===0?-1:1)*.09;
        const after=Math.hypot(p.vx,p.vy);
        const newSpeed=Math.min(12,Math.max(after,Math.min(12,before*1.035+.03)));
        if(after>0){p.vx=p.vx/after*newSpeed;p.vy=p.vy/after*newSpeed;}
      }
    }else if(p.hp>0){
      // Airborne targets can still be hurled by an actual grounded hit.
      globalThis.ImpactPhysics?.integrate?.(p);
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
        globalThis.ImpactPhysics?.hit?.(attacker,defender,value,{knockback:action.knockback||0,type:action.type});
      }
      if(action.status==='ice'){defender.slowTimer=Math.max(defender.slowTimer||0,90);defender.slowMultiplier=.5;}
      if(action.status==='fire'||action.status==='poison')defender.bfDot=Math.max(defender.bfDot||0,Math.round((action.duration||2)*60));
      return true;
    }
  });
  globalThis.ArenaTower?.tickEncounter?.();
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
  // Long heal/shield loops and zero-offense builds must eventually conclude.
  // Only active physics ticks count; paused matches never advance overtime.
  globalThis.ArenaStalemate?.tick?.(players,!!globalThis.ArenaTower?.active);
  // Track actual lost HP once per physics tick, even at 100x when HUD writes
  // are batched. This includes DoT and fair percentage overtime damage.
  players.forEach((p,i)=>{
    const lost=Math.max(0,(healthAtStart[i]||0)-(p.hp||0));
    if(lost>0.001){
      p._hudHitSerial=(p._hudHitSerial||0)+1;
      p._hudLastHit=Math.min(1,lost/Math.max(1,p.maxHp||1));
    }
  });
  const finalAlive=players.filter(p=>p.hp>0);
  const expired=!!globalThis.ArenaStalemate?.state?.expired;
  if(finalAlive.length<=1||expired){
    isGameOver=true;isPlaying=false;
    if(expired&&finalAlive.length>1)roundStopped=true;
    globalThis.BackgroundMusic?.setBattle(false);
    const winner=finalAlive.length===1?finalAlive[0]:null;
    settleRound(winner,expired?'timeout':undefined);
    const startButton=document.getElementById('btn-start');
    if(startButton){startButton.innerText='다음 경기';startButton.dataset.state='finished';}
    syncStopButton();
    globalThis.ArenaTower?.onBattleEnd?.(winner,expired?'timeout':undefined);
  }
  if(!globalThis.ArenaSpeedControl?.deferUI)updateUI();
}
// Identical fighters are distinguished by their match slot, not by
// permanent renaming or ranking. Supports mirror fights in 1v1 and 3-player.
function getArenaFighterName(p){
  const group=players.filter(e=>e.name===p.name);
  if(group.length<2)return p.name;
  const ordinal=group.indexOf(p)+1;
  return p.name+' '+ordinal;
}
function updateUI() {
  // HUD cards are generated for the exact active roster, including up to
  // ten independently tracked cooldown panels.
  const hudContainer=document.getElementById('ui-container');
  if(hudContainer&&typeof hudContainer.replaceChildren==='function'&&hudContainer.children?.length!==players.length){
    hudContainer.replaceChildren();
    players.forEach((_,index)=>{
      const n=index+1,section=document.createElement('div');
      section.className='player-section';section.id='sec-p'+n;
      section.innerHTML='<div class="player-header"><div class="fighter-name"><span class="fighter-number">P'+n+'</span><span class="player-title" id="p'+n+'-name"></span></div>'+
        '<span class="hp-text"><span id="p'+n+'-hp-text"></span><span class="hp-max"> / <span id="p'+n+'-maxhp"></span></span></span></div>'+
        '<div class="hp-bar-track"><div id="p'+n+'-hp-trail" class="hp-bar-trail"></div><div id="p'+n+'-hp-bar" class="hp-bar-fill"></div></div>'+
        '<span id="p'+n+'-tag" class="mode-tag" style="display:none"></span>';
      hudContainer.append(section);
    });
  }
  if(hudContainer?.dataset)hudContainer.dataset.count=String(players.length);
  players.forEach((p,idx)=>{
    const n=idx+1,el=document.getElementById(`p${n}-name`);
    if(!el)return;
    el.innerText=getArenaFighterName(p);
    document.getElementById(`p${n}-hp-text`).innerText=Math.ceil(p.hp);
    document.getElementById(`p${n}-maxhp`).innerText=p.maxHp;
    const hpPct=Math.max(0,Math.min(100,p.hp/Math.max(1,p.maxHp)*100));
    document.getElementById(`p${n}-hp-bar`).style.width=hpPct+'%';
    const trail=document.getElementById(`p${n}-hp-trail`);
    if(trail)trail.style.width=hpPct+'%';
    const tag=p.getTag(),te=document.getElementById(`p${n}-tag`);
    if(tag&&p.hp>0){te.style.display='inline-block';te.textContent=tag.text+(p.itemLabels&&p.itemLabels.length?` · ${p.itemLabels.join(' · ')}`:'');}
    else te.style.display='none';
    const hud=document.getElementById('sec-p'+n);
    if(hud?.dataset&&hud?.classList){
      const current=String(p._hudHitSerial||0);
      if(hud.dataset.hitSerial!==current){
        hud.dataset.hitSerial=current;
        if(p._hudHitSerial){
          hud.classList.remove('hp-impact-0','hp-impact-1','hp-impact-2');
          hud.classList.add('hp-impact-'+(p._hudHitSerial%3));
          hud.style.setProperty('--hp-hit-scale',String(Math.min(1.8,.65+(p._hudLastHit||.05)*7)));
        }
      }
    }
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
