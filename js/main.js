/* Match selection and local photos; ability construction lives in skill-forge.js. */
(function () {
  const $ = id => document.getElementById(id);
  const pool = () => [...CHARACTER_DEFS, ...CUSTOM_DEFS];
  const locked = () => roundStarted && !isGameOver;
  const originalRoll = reRollMatch, originalUpdate = update;
  const panel = document.createElement('section');
  panel.className = 'bf-tools';
  panel.setAttribute('aria-label', '대진 설정');
  panel.innerHTML = "\n    <div class=\"panel-heading\">\n      <span class=\"eyebrow\">MATCH SETUP</span>\n      <h2>대진 설정</h2>\n    </div>\n    <div class=\"bf-picks\" id=\"bf-picks\" aria-label=\"출전 캐릭터 선택\"></div>\n    <div class=\"bf-actions\">\n      <button type=\"button\" id=\"bf-apply\">대진 적용</button>\n    </div>\n    <div id=\"bf-status\" class=\"bf-notice\" role=\"status\" aria-live=\"polite\"></div>\n    <details class=\"bf-details\"><summary>커스텀 캐릭터</summary><div class=\"bf-details-body\"></div></details>";
  document.querySelector('.battle-screen').after(panel);

  const economy = document.querySelector('.economy-card');
  const fold = document.createElement('details');
  fold.className = 'bf-fold';
  const summary = document.createElement('summary');
  const summaryName = document.createElement('span');
  summaryName.textContent = '베팅 · 아이템';
  summary.append(summaryName, document.getElementById('coin-balance'));
  economy.before(fold);
  fold.append(summary, economy);
  document.getElementById('wager-input').value = '0';
  const notice = text => { $('bf-status').textContent = text; };
  const allowed = () => { if (locked()) { notice('경기 중에는 변경할 수 없습니다.'); return false; } return true; };
  function options(select, value) {
    select.replaceChildren();
    pool().forEach(d => { const o=document.createElement('option');o.value=d.id;o.textContent=d.name;select.appendChild(o); });
    if (pool().some(d=>d.id===value)) select.value=value;
  }
  function refreshPicks() {
    const box=$('bf-picks');box.replaceChildren();
    for(let i=0;i<(gameMode==='1v1'?2:3);i++) {
      const label=document.createElement('label');label.textContent=`P${i+1}`;
      const select=document.createElement('select');select.id=`bf-pick-${i}`;
      options(select,players[i]&&players[i].id);label.appendChild(select);box.appendChild(label);
    }
    if(window.SkillForge)SkillForge.refreshList();
  }
  reRollMatch = function (forcedDef) {
    if(!allowed())return false;
    const ok=originalRoll(forcedDef);
    if(ok){$('wager-input').value='0';renderEconomyUI();refreshPicks();notice('');}
    return ok;
  };
  function applyPicks() {
    if(!allowed())return;
    const defs=Array.from({length:gameMode==='1v1'?2:3},(_,i)=>pool().find(d=>d.id===($(`bf-pick-${i}`)||{}).value));
    if(defs.some(d=>!d)){notice('출전 캐릭터를 모두 선택하세요.');return;}
    if(!originalRoll())return;
    players=defs.map((d,i)=>{
      const old=players[i],p=d.createInstance(i+1);
      Object.assign(p,{x:old.x,y:old.y,vx:old.vx,vy:old.vy});return p;
    });
    $('wager-input').value='0';updateUI();renderEconomyUI();draw();refreshPicks();notice('대진 적용 완료');
  }
  $('bf-apply').onclick=applyPicks;
  update=function(){
    if(isPlaying&&!isGameOver)players.forEach(p=>{if(p.bfDot>0&&p.hp>0){p.bfDot--;if(p.bfDot%30===0){const amount=Math.max(1,Math.min(6,p.bfDotDamage||2));p.hp=Math.max(0,p.hp-amount);addFloatingText('-'+amount,p.x,p.y-30,'#a75f2b',14);}}});
    originalUpdate();
  };
  // The single fixed-step game loop starts once effects are installed.
  reRollMatch();
  setEconomyMessage('');
})();
