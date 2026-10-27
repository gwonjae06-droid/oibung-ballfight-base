/* Character selection, local photos, rule-based creator, folding panel and fixed-step speed. */
(function () {
  const $ = id => document.getElementById(id);
  const pool = () => [...CHARACTER_DEFS, ...CUSTOM_DEFS];
  const locked = () => roundStarted && !isGameOver;
  const originalRoll = reRollMatch, originalUpdate = update, originalDrawCharacter = drawCharacter;
  let pendingPhoto = null, draft = null, photoTicket = 0, sequence = 0;
  const css = document.createElement('style');
  css.textContent = `.bf-tools{width:100%;background:#fff;padding:12px;border:2px solid #111;border-radius:10px;margin:12px 0}.bf-tools h2{font-size:16px;margin:0 0 8px}.bf-tools p{font-size:12px;line-height:1.5;color:#475569}.bf-row{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0}.bf-row label{flex:1;min-width:100px;font-size:12px;font-weight:800}.bf-tools select,.bf-tools input,.bf-tools textarea{width:100%;padding:9px;border:1px solid #94a3b8;border-radius:6px;font:inherit;font-size:13px;user-select:text;-webkit-user-select:text}.bf-tools textarea{min-height:90px;resize:vertical}.bf-tools button{font-size:12px;min-height:40px}.bf-preview{width:76px;height:76px;border-radius:50%;object-fit:cover;border:2px solid #111;background:#eee}.bf-notice{font-size:12px;white-space:pre-wrap;line-height:1.6;padding:8px;background:#f1f5f9;border-radius:6px}.bf-fold{width:100%;margin-top:12px}.bf-fold summary{cursor:pointer;font-weight:900;padding:12px;background:#e2e8f0;border-radius:8px}.bf-fold .economy-card{margin-top:0}.bf-rules{font-size:12px;line-height:1.6}.bf-tools [hidden]{display:none!important}`;
  document.head.appendChild(css);
  const panel = document.createElement('section');
  panel.className = 'bf-tools';
  panel.innerHTML = `<h2>캐릭터 선택 · 경기 설정</h2><div class="bf-row" id="bf-picks"></div><div class="bf-row"><button type="button" id="bf-apply">선택한 대진 적용</button><button type="button" id="bf-random">랜덤 대진</button><label>배속<select id="bf-speed"><option value="1" selected>1배속 (기본 속도)</option><option value="2">2배속 (빠르게)</option></select></label></div><p>선택한 대진을 적용한 뒤 경기 시작을 누르세요. 경기 도중에는 사진·캐릭터를 바꿀 수 없습니다. 배속은 경기 중에도 변경할 수 있습니다.</p><div id="bf-status" class="bf-notice" role="status" aria-live="polite"></div><details><summary>사진 지정</summary><p>본인 또는 사용 허락을 받은 사진만 사용하세요. 사진은 서버로 전송하지 않으며 새로고침하면 초기화됩니다. 사진을 고른 뒤 대상 캐릭터에 적용하세요.</p><input type="file" id="bf-photo" accept="image/jpeg,image/png,image/webp" aria-label="사진 선택"><div class="bf-row"><img id="bf-face" class="bf-preview" alt="선택한 사진 미리보기" hidden><label>사진을 넣을 캐릭터<select id="bf-photo-target"></select></label></div><div class="bf-row"><button type="button" id="bf-photo-apply">사진 적용</button><button type="button" id="bf-photo-clear">대상 사진 초기화</button></div><p>오슬우에 적용하면 보인고·멘헤라 두 모드 모두 같은 사진을 사용합니다.</p></details><details><summary>내 캐릭터 만들기 · 내장 해석기</summary><p>AI API가 아닌 한국어 키워드 해석기입니다. 최대 6명, 능력 최대 3개. 입력한 수치와 자유로운 조건 전부를 해석하지는 않습니다. 분석 결과의 실제 규칙을 확인하세요.</p><label>이름<input id="bf-name" maxlength="10" placeholder="최대 10자"></label><label>원하는 능력<textarea id="bf-text" maxlength="300" placeholder="얼음 구슬을 발사하고 체력이 낮아지면 빨라진다"></textarea></label><p>파동 · 투사체 · 오라 · 돌진 · 내려찍기 · 낙뢰 · 순간이동 · 회복 · 방어막 · 끌어당기기 / 화상 · 중독 · 둔화 · 흡혈 · 폭주</p><div class="bf-row"><button type="button" id="bf-analyze">능력 분석</button><button type="button" id="bf-create" disabled>확인하고 생성 · P1 선택</button></div><div id="bf-result" class="bf-notice"></div><p>현재 선택한 사진을 새 캐릭터에도 사용합니다. 캐릭터와 사진은 이번 접속에만 유지됩니다.</p><div id="bf-custom-list" class="bf-rules"></div></details>`;
  const battle = document.querySelector('.battle-screen');
  battle.before(panel);
  const economy = document.querySelector('.economy-card');
  const fold = document.createElement('details');
  fold.className = 'bf-fold';
  const summary = document.createElement('summary');
  summary.textContent = '베팅 · 상점 펼치기 / 접기 (선택 사항)';
  economy.before(fold);fold.append(summary,economy);
  $('wager-input').value = '0';
  economy.querySelector('.economy-help').textContent = '베팅 없이 경기 시작을 눌러도 됩니다. 베팅하려면 캐릭터와 금액을 선택하세요.';
  const notice = text => { $('bf-status').textContent = text; };
  const allowed = () => { if (locked()) { notice('진행 중에는 변경할 수 없습니다. 경기 종료 후 다시 시도하세요.'); return false; } return true; };
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
    $('bf-custom-list').textContent=CUSTOM_DEFS.length?'내 캐릭터: '+CUSTOM_DEFS.map(d=>d.name).join(' · '):'아직 만든 캐릭터가 없습니다.';
  }
  reRollMatch = function (forcedDef) {
    if(!allowed())return false;
    const ok=originalRoll(forcedDef);
    if(ok){$('wager-input').value='0';renderEconomyUI();refreshPicks();notice('대진 준비 완료. 베팅 없이 경기 시작을 누르세요.');}
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
    $('wager-input').value='0';updateUI();renderEconomyUI();draw();refreshPicks();notice('선택한 캐릭터로 대진을 적용했습니다. 경기 시작을 누르세요.');
  }
  $('bf-apply').onclick=applyPicks;
  $('bf-random').onclick=()=>reRollMatch();
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
      pendingPhoto=data;$('bf-face').src=data;$('bf-face').hidden=false;notice('사진 준비 완료. 적용할 캐릭터를 선택하거나 새 캐릭터를 만드세요.');
    } catch(err){if(ticket===photoTicket)notice('사진을 읽을 수 없습니다. 다른 파일을 선택하세요.');}
    finally{URL.revokeObjectURL(url);}
  };
  const photoKeys=id=>id==='oh'?['oh-boin','oh-menhera']:[id];
  $('bf-photo-apply').onclick=()=>{
    if(!allowed())return;if(!pendingPhoto){notice('사진을 먼저 선택하세요.');return;}
    photoKeys($('bf-photo-target').value).forEach(key=>loadPhoto(key,pendingPhoto));notice('대상 캐릭터에 사진을 적용했습니다.');draw();
  };
  $('bf-photo-clear').onclick=()=>{if(!allowed())return;photoKeys($('bf-photo-target').value).forEach(key=>delete CHARACTER_PHOTOS[key]);draw();notice('대상 사진을 초기화했습니다.');};
  const kinds={wave:['충격파',240,22],shot:['투사체',90,11],aura:['오라',45,5],dash:['돌진',300,16],slam:['내려찍기',260,34],lightning:['낙뢰',200,12],blink:['순간이동',270,12],heal:['회복',420,0],shield:['방어막',480,0],pull:['끌어당기기',150,0]};
  const rules=[['lightning',/번개|낙뢰|벼락|천둥/],['slam',/내려찍|도약|점프|메테오/],['blink',/순간이동|순간 이동|점멸|텔레포트/],['dash',/돌진|박치기|돌격/],['wave',/파동|충격파|폭발/],['aura',/오라|장판|영역/],['shot',/발사|투사체|구슬|화살|쏘|쏜|쏴|총알|불덩이/],['heal',/회복|치유|재생/],['shield',/보호막|방어막|무적/],['pull',/끌어당|흡입|매혹/]];
  function parse(text,name) {
    const found=rules.filter(([,r])=>r.test(text)).map(([k])=>k);
    const skills=found.slice(0,3),notes=[];
    if(found.length>3)notes.push('능력은 목록 순서상 앞의 3개만 반영했습니다.');
    if(!skills.length)notes.push('지원 동작을 찾지 못했습니다. 설명을 고쳐 주세요.');
    if(/소환|분신|부활|복사|시간.{0,5}(정지|멈|되돌)|즉사/.test(text))notes.push('소환·분신·부활·복사·시간 조작·즉사는 미지원이며 해당 부분은 반영하지 않습니다.');
    if(/무한|항상|영원|절대/.test(text))notes.push('무한·항상 적용 효과는 지원하지 않습니다. 방어막은 제한 시간만 적용됩니다.');
    notes.push('숫자·자유 조건·부정 표현은 해석하지 않습니다. 아래 규칙만 실제 적용됩니다.');
    const element=/얼음|빙결|둔화|느려지/.test(text)?'ice':/독|중독/.test(text)?'poison':/불꽃|화염|화상|불덩이/.test(text)?'fire':null;
    const rage=/폭주|분노|화나|체력이 낮|체력이 적/.test(text),drain=/흡혈/.test(text);
    const penalty=/지쳐|지침|탈진/.test(text)&&rage;
    const damageScale=skills.length>=3?0.65:skills.length===2?0.8:1;
    return {name,skills,element,rage,drain,penalty,damageScale,notes};
  }
  function describe(s) {
    const lines=['체력 250 / 기본 접촉 피해 8 / 능력 수에 따른 공격 피해 보정 ×'+s.damageScale];
    s.skills.forEach(k=>{const [name,frames,base]=kinds[k],d=Math.max(1,Math.round(base*s.damageScale));
      const info={wave:`반경 175 파동 / 피해 ${d}`,shot:`구슬 1발 / 피해 ${d}`,aura:`반경 105 / 피해 ${d}`,dash:`1.2초 추적 돌진 / 접촉 추가 피해 ${d}`,slam:'공중 도약 후 강타 / 피해 '+Math.round(34*s.damageScale),lightning:`0.6초 범위 예고 후 3곳 낙뢰 / 각 피해 ${d}`,blink:`상대 곁으로 이동 / 주변 피해 ${d}`,heal:'체력 30 회복',shield:'0.6초 무적',pull:'가장 가까운 적 끌어당김'};
      lines.push(`${name}: ${(frames/60).toFixed(2)}초마다 ${info[k]}`);
    });
    if(s.element)lines.push('공격 명중 효과: '+({ice:'1초간 이동 속도 50% 감소',fire:'2초간 0.5초마다 2 화상 피해',poison:'3초간 0.5초마다 2 중독 피해'}[s.element]));
    if(s.rage)lines.push('체력 50% 이하에서 한 번만 5초간 속도 ×1.5'+(s.penalty?', 이후 2초간 속도 ×0.5':''));
    if(s.drain)lines.push('직접 준 피해의 20% 흡혈 (지속 피해 제외)');
    return lines.concat(s.notes.map(n=>'안내: '+n)).join('\n');
  }
  function invalidate(){draft=null;$('bf-create').disabled=true;}
  $('bf-text').oninput=invalidate;$('bf-name').oninput=invalidate;
  $('bf-analyze').onclick=()=>{
    const name=$('bf-name').value.trim().slice(0,10),text=$('bf-text').value.trim();
    if(!name||text.length<4){notice('이름과 구체적인 능력 문장을 입력하세요.');return;}
    draft=parse(text,name);$('bf-result').textContent=describe(draft);$('bf-create').disabled=!draft.skills.length;
  };
  function hit(self,e,amount,skill){
    if(e.hp<=0||e.invincible>0||e.jumpState==='rising'||e.jumpState==='hovering')return;
    const d=Math.max(1,Math.round(amount));const actual=Math.min(e.hp,d);e.hp=Math.max(0,e.hp-d);e.invincible=16;
    createHitParticles(e.x,e.y,self.borderColor,12);addFloatingText('-'+d,e.x,e.y-30,self.borderColor,18);
    if(self.spec.element==='ice'){e.slowTimer=60;e.slowMultiplier=0.5;}
    if(self.spec.element==='fire'||self.spec.element==='poison')e.bfDot=self.spec.element==='fire'?120:180;
    if(self.spec.drain){const h=Math.max(1,Math.round(actual*0.2));self.hp=Math.min(self.maxHp,self.hp+h);}
  }
  function customDef(spec,id){
    const base=CHARACTER_DEFS.find(d=>d.id==='park');
    return {id,name:spec.name,createInstance(n){
      const p=base.createInstance(n);
      Object.assign(p,{id,name:spec.name,hp:250,maxHp:250,themeColor:'#7c3aed',borderColor:'#7c3aed',tagColor:'#c4b5fd',spec,baseDamage:8,skillCooldown:240,jumpCooldown:260,minJumpCooldown:260,bfTicks:spec.skills.map(()=>0),bfShots:[],bfMarks:[],bfRings:[],bfDash:0,bfRage:0,bfRaged:false,bfTired:0});
      p.getImage=()=>CHARACTER_PHOTOS[id]||null;p.getDisplayName=()=>spec.name;
      p.getTag=()=>({text:spec.skills.map(k=>kinds[k][0]).join(' · '),bg:'#ede9fe',color:'#6d28d9',border:'#a78bfa'});
      return p;
    }};
  }
  function customUpdate(p,target){
    const s=p.spec,damage=k=>Math.max(1,Math.round(kinds[k][2]*s.damageScale));
    if(s.rage&&!p.bfRaged&&p.hp<=p.maxHp*0.5){p.bfRaged=true;p.bfRage=300;addFloatingText('폭주!',p.x,p.y-45,'#ef4444',22);}
    let speed=1.42*(p.speedMultiplier||1);
    if(p.bfRage>0){p.bfRage--;speed*=1.5;if(p.bfRage===0&&s.penalty)p.bfTired=120;}else if(p.bfTired>0){p.bfTired--;speed*=0.5;}
    if(p.bfDash>0){p.bfDash--;speed*=3;if(target){const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1;p.vx=dx/d*speed;p.vy=dy/d*speed;}}
    // Recover cruising speed gradually; preserve knockback and item boosts.
    const current=Math.hypot(p.vx,p.vy);
    if(!Number.isFinite(current)||current<0.001){p.vx=speed;p.vy=0;}
    else{
      const blend=current>speed?0.075:0.18;
      const next=current+(speed-current)*blend;
      p.vx=p.vx/current*next;p.vy=p.vy/current*next;
    }
    s.skills.forEach((k,i)=>{
      if(k==='slam'){
        const before=p.hp,orig=players.map(e=>({e,hp:e.hp}));
        BEHAVIORS.park.update(p,target);
        orig.forEach(({e,hp})=>{if(e===p||e.hp>=hp)return;const dealt=hp-e.hp;const scaled=Math.max(1,Math.round(dealt*s.damageScale));e.hp=Math.max(0,hp-scaled);if(s.element==='ice'){e.slowTimer=60;e.slowMultiplier=0.5;}if(s.element==='fire'||s.element==='poison')e.bfDot=s.element==='fire'?120:180;if(s.drain)p.hp=Math.min(p.maxHp,p.hp+Math.round(scaled*0.2));});
        return;
      }
      p.bfTicks[i]++;const interval=k==='heal'||k==='shield'?kinds[k][1]:Math.min(kinds[k][1],p.skillCooldown===60?60:Infinity);
      if(p.bfTicks[i]<interval)return;p.bfTicks[i]=0;
      if(k==='heal'){p.hp=Math.min(p.maxHp,p.hp+30);addFloatingText('+30 HP',p.x,p.y-40,'#22c55e',18);return;}
      if(k==='shield'){p.invincible=Math.max(p.invincible,36);addFloatingText('방어막',p.x,p.y-40,'#38bdf8',18);return;}
      if(!target)return;
      const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1;
      if(k==='shot')p.bfShots.push({x:p.x,y:p.y,vx:dx/d*3.8,vy:dy/d*3.8,t:150});
      if(k==='wave'){p.bfRings.push({x:p.x,y:p.y,r:10,t:72,hit:new Set()});addFloatingText('충격파!',p.x,p.y-40,p.borderColor,18);}
      if(k==='aura')players.filter(e=>e!==p&&Math.hypot(e.x-p.x,e.y-p.y)<105+e.radius).forEach(e=>hit(p,e,damage(k),k));
      if(k==='dash')p.bfDash=72;
      if(k==='pull'){target.vx-=dx/d*3.8;target.vy-=dy/d*3.8;addFloatingText('끌어당김',target.x,target.y-40,p.borderColor,16);}
      if(k==='blink'){const a=Math.atan2(dy,dx);p.x=Math.max(p.radius,Math.min(canvas.width-p.radius,target.x-Math.cos(a)*80));p.y=Math.max(p.radius,Math.min(canvas.height-p.radius,target.y-Math.sin(a)*80));players.filter(e=>e!==p&&Math.hypot(e.x-p.x,e.y-p.y)<80+e.radius).forEach(e=>hit(p,e,damage(k),k));createHitParticles(p.x,p.y,p.borderColor,18);}
      if(k==='lightning')for(let n=0;n<3;n++){const a=Math.random()*Math.PI*2;p.bfMarks.push({x:Math.max(20,Math.min(canvas.width-20,target.x+(n?Math.cos(a)*80:target.vx*20))),y:Math.max(20,Math.min(canvas.height-20,target.y+(n?Math.sin(a)*80:target.vy*20))),t:36+n*6});}
    });
    for(let i=p.bfShots.length-1;i>=0;i--){const b=p.bfShots[i];b.x+=b.vx;b.y+=b.vy;b.t--;const e=players.find(e=>e!==p&&e.hp>0&&e.jumpState!=='rising'&&e.jumpState!=='hovering'&&Math.hypot(e.x-b.x,e.y-b.y)<e.radius+7);if(e){hit(p,e,damage('shot'),'shot');b.t=0;}if(b.t<=0)p.bfShots.splice(i,1);}
    for(let i=p.bfRings.length-1;i>=0;i--){const b=p.bfRings[i];b.r+=2.3;b.t--;players.filter(e=>e!==p&&!b.hit.has(e)&&Math.abs(Math.hypot(e.x-b.x,e.y-b.y)-b.r)<e.radius+10).forEach(e=>{b.hit.add(e);hit(p,e,damage('wave'),'wave');});if(b.t<=0||b.r>=175)p.bfRings.splice(i,1);}
    for(let i=p.bfMarks.length-1;i>=0;i--){const b=p.bfMarks[i];if(--b.t<=0){players.filter(e=>e!==p&&Math.hypot(e.x-b.x,e.y-b.y)<38+e.radius).forEach(e=>hit(p,e,damage('lightning'),'lightning'));createHitParticles(b.x,b.y,'#eab308',18);p.bfMarks.splice(i,1);}}
  }
  function customDraw(p){
    if(!p.spec||p.hp<=0)return;
    ctx.save();ctx.strokeStyle=p.borderColor;ctx.fillStyle=p.borderColor;ctx.lineWidth=3;
    p.bfShots.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,7,0,Math.PI*2);ctx.fill();});
    p.bfRings.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.stroke();});
    if(p.spec.skills.includes('aura')){ctx.beginPath();ctx.arc(p.x,p.y,105,0,Math.PI*2);ctx.globalAlpha=0.12;ctx.fill();ctx.globalAlpha=1;ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);}
    p.bfMarks.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,38,0,Math.PI*2);ctx.fillStyle='rgba(234,179,8,0.2)';ctx.fill();ctx.strokeStyle='#eab308';ctx.stroke();ctx.fillStyle='#854d0e';ctx.font='20px sans-serif';ctx.fillText('⚡',b.x-10,b.y+8);});
    ctx.restore();
  }
  drawCharacter=function(p){customDraw(p);originalDrawCharacter(p);};
  $('bf-create').onclick=()=>{
    if(!allowed()||!draft||!draft.skills.length)return;
    if(CUSTOM_DEFS.length>=6){notice('이번 접속에서 최대 6명까지 만들 수 있습니다.');return;}
    const id='custom_'+(++sequence),s=JSON.parse(JSON.stringify(draft)),def=customDef(s,id);
    BEHAVIORS[id]={order:9,update:customUpdate,onContact(p,e){hit(p,e,8+(p.bfDash>0?Math.round(16*p.spec.damageScale):0),'contact');}};
    CUSTOM_DEFS.push(def);if(pendingPhoto)loadPhoto(id,pendingPhoto);
    refreshPicks();$('bf-pick-0').value=id;applyPicks();invalidate();notice('새 캐릭터를 P1로 적용했습니다. 경기 시작을 누르세요.');
  };
  update=function(){
    if(isPlaying&&!isGameOver)players.forEach(p=>{if(p.bfDot>0&&p.hp>0){p.bfDot--;if(p.bfDot%30===0){p.hp=Math.max(0,p.hp-2);addFloatingText('-2 지속 피해',p.x,p.y-30,'#f97316',14);}}});
    originalUpdate();
  };
  // The single fixed-step game loop starts once effects are installed.
  reRollMatch();
  setEconomyMessage('베팅 없이 바로 시작할 수 있습니다.');
})();
