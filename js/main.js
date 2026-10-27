/* Match selection and local photos; ability construction lives in skill-forge.js. */
(function () {
  const $ = id => document.getElementById(id);
  const pool = () => [...CHARACTER_DEFS, ...CUSTOM_DEFS];
  const locked = () => roundStarted && !isGameOver;
  const originalRoll = reRollMatch, originalUpdate = update;
  let pendingPhoto = null, photoTicket = 0;
  const panel = document.createElement('section');
  panel.className = 'bf-tools';
  panel.setAttribute('aria-label', '대진 설정');
  panel.innerHTML = "\n    <div class=\"panel-heading\">\n      <span class=\"eyebrow\">MATCH SETUP</span>\n      <h2>대진 설정</h2>\n    </div>\n    <div class=\"bf-picks\" id=\"bf-picks\" aria-label=\"출전 캐릭터 선택\"></div>\n    <div class=\"bf-actions\">\n      <button type=\"button\" id=\"bf-apply\">대진 적용</button>\n    </div>\n    <div id=\"bf-status\" class=\"bf-notice\" role=\"status\" aria-live=\"polite\"></div>\n    <details class=\"bf-details\">\n      <summary>사진 설정</summary>\n      <div class=\"bf-details-body\">\n        <p class=\"bf-helper\">허락받은 사진만 사용하세요. 사진은 기기에만 유지됩니다.</p>\n        <input type=\"file\" id=\"bf-photo\" accept=\"image/jpeg,image/png,image/webp\" aria-label=\"사진 선택\">\n        <div class=\"bf-photo-row\">\n          <img id=\"bf-face\" class=\"bf-preview\" alt=\"선택한 사진 미리보기\" hidden>\n          <label class=\"bf-field\">적용할 캐릭터<select id=\"bf-photo-target\"></select></label>\n        </div>\n        <div class=\"bf-btn-row\">\n          <button type=\"button\" id=\"bf-photo-apply\">사진 적용</button>\n          <button type=\"button\" id=\"bf-photo-clear\">초기화</button>\n        </div>\n      </div>\n    </details>\n    <details class=\"bf-details\"><summary>커스텀 캐릭터</summary><div class=\"bf-details-body\"></div></details>";
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
    const target=$('bf-photo-target'),old=target.value;options(target,old);
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
  $('bf-photo').onchange=async e=>{
    const ticket=++photoTicket,file=e.target.files[0];
    pendingPhoto=null;$('bf-face').hidden=true;
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){notice('JPG·PNG·WebP 이미지 5 MB 이하만 선택하세요.');return;}
    const url=URL.createObjectURL(file);
    try {
      const image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
      const c=document.createElement('canvas');c.width=c.height=192;
      const side=Math.min(image.naturalWidth,image.naturalHeight);
      c.getContext('2d').drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,192,192);
      const data=c.toDataURL('image/jpeg',0.85);
      if(ticket!==photoTicket)return;
      pendingPhoto=data;$('bf-face').src=data;$('bf-face').hidden=false;notice('사진 준비 완료');
    } catch(err){if(ticket===photoTicket)notice('사진을 읽을 수 없습니다. 다른 파일을 선택하세요.');}
    finally{URL.revokeObjectURL(url);}
  };
  const photoKeys=id=>id==='oh'?['oh-boin','oh-menhera']:[id];
  $('bf-photo-apply').onclick=()=>{
    if(!allowed())return;if(!pendingPhoto){notice('사진을 먼저 선택하세요.');return;}
    photoKeys($('bf-photo-target').value).forEach(key=>loadPhoto(key,pendingPhoto));notice('사진 적용 완료');draw();
  };
  $('bf-photo-clear').onclick=()=>{if(!allowed())return;photoKeys($('bf-photo-target').value).forEach(key=>delete CHARACTER_PHOTOS[key]);draw();notice('사진 초기화 완료');};
  update=function(){
    if(isPlaying&&!isGameOver)players.forEach(p=>{if(p.bfDot>0&&p.hp>0){p.bfDot--;if(p.bfDot%30===0){const amount=Math.max(1,Math.min(6,p.bfDotDamage||2));p.hp=Math.max(0,p.hp-amount);addFloatingText('-'+amount,p.x,p.y-30,'#a75f2b',14);}}});
    originalUpdate();
  };
  // The single fixed-step game loop starts once effects are installed.
  reRollMatch();
  setEconomyMessage('');
})();
