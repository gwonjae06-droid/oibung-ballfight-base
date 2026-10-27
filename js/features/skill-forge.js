/* Skill Forge: authored ability sequences, not keyword parsing or arbitrary JS. */
(function(global){
'use strict';
const STORE='oibung-forge-v3', TYPE={wave:'충격파',shot:'투사체',beam:'레이저',bolt:'낙뢰',dash:'돌진',blink:'순간이동',heal:'회복',shield:'방어막',pull:'흡입',orbit:'회전 소환체',zone:'지속 장판'};
const TRIGGER={auto:'주기적으로',lowhp:'체력 이하',contact:'접촉 시',damaged:'피격 시'};
const STATUS={none:'없음',ice:'둔화',fire:'화상',poison:'중독'};
Object.assign(TYPE,global.ForgeExpansion?.TYPES||{});
Object.assign(STATUS,global.ForgeExpansion?.STATUSES||{});
const number=(x,a,b,d=a)=>Number.isFinite(Number(x))?Math.max(a,Math.min(b,Number(x))):d;
const clean=(v,n)=>String(v==null?'':v).replace(/[<>]/g,'').slice(0,n).trim();
const color=(c)=>/^#[0-9a-f]{6}$/i.test(c)?c:'#a78bfa';
const stage=()=>({type:'shot',pattern:'fan',target:'nearest',damage:18,radius:120,count:5,speed:5,duration:1.5,status:'none',knockback:2,delay:0});
const skill=()=>({name:'새 스킬',trigger:'auto',cooldown:3,threshold:40,actions:[stage()]});
function normalize(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('올바른 설정을 입력하세요.');
  if(!Array.isArray(value.skills)||value.skills.length<1)throw Error('스킬을 한 개 이상 추가하세요.');
  return {
    name:clean(value.name,14)||'커스텀 파이터',blurb:clean(value.blurb,90),
    color:color(value.color),hp:Math.round(number(value.hp,140,500,250)),
    speed:number(value.speed,.6,5,1.8),
    skills:value.skills.slice(0,4).map((s,i)=>{
      if(!Array.isArray(s.actions)||!s.actions.length)throw Error((i+1)+'번 스킬에 동작이 없습니다.');
      return {name:clean(s.name,18)||'스킬 '+(i+1),
        trigger:TRIGGER[s.trigger]?s.trigger:'auto',
        cooldown:number(s.cooldown,.2,30,3),threshold:number(s.threshold,5,95,40),
        actions:s.actions.slice(0,3).map(a=>({
          type:TYPE[a.type]?a.type:'wave',
          pattern:global.AbilityAtlas?.PATTERNS[a.pattern]?a.pattern:'direct',
          target:global.AbilityAtlas?.TARGETS[a.target]?a.target:'nearest',
          damage:Math.round(number(a.damage,0,120,18)),
          radius:number(a.radius,30,300,120),count:Math.round(number(a.count,1,8,1)),
          speed:number(a.speed,2,14,5),duration:number(a.duration,.2,8,1.5),
          status:STATUS[a.status]?a.status:'none',
          knockback:number(a.knockback,0,9,2),delay:number(a.delay,0,2,0)
        }))};
    })
  };
}
let sequence=0;
const enemies=p=>players.filter(e=>e!==p&&e.hp>0);
function hit(p,e,action,multiplier=1) {
  if(!e||e===p||e.hp<=0||e.invincible>0||(e.jumpState&&e.jumpState!=='ground'))return false;
  const d=Math.round(action.damage*multiplier*(global.ForgeExpansion?.damageScale(p,e)||1));
  if(d){e.hp=Math.max(0,e.hp-d);e.invincible=12;createHitParticles(e.x,e.y,p.forge.color,12);addFloatingText('-'+d,e.x,e.y-30,p.forge.color,17);}
  if(action.status==='ice'){e.slowTimer=Math.max(e.slowTimer||0,90);e.slowMultiplier=.5;}
  if(action.status==='fire'||action.status==='poison'){
    const seconds=Number.isFinite(action.duration)?action.duration:(action.status==='fire'?2:3);
    // A DoT lasts as long as requested; its half-second damage ticks are
    // handled by the single existing simulation loop.
    e.bfDot=Math.max(e.bfDot||0,Math.max(30,Math.min(480,Math.round(seconds*60))));
    e.bfDotDamage=Math.max(e.bfDotDamage||2,Math.min(6,Math.max(1,Math.round(d*.12))));
  }
  global.ForgeExpansion?.applyStatus(p,e,action);
  if(action.knockback>0){const dx=e.x-p.x,dy=e.y-p.y,dist=Math.hypot(dx,dy)||1;e.vx+=dx/dist*action.knockback;e.vy+=dy/dist*action.knockback;}
  return true;
}
function cast(p,s,target){
  p.forgeQueue.push(...s.actions.map(a=>({timer:Math.round(a.delay*60),a,targetNum:target?.playerNum||null})));
  if(p.forgeQueue.length>30)p.forgeQueue.splice(0,p.forgeQueue.length-30);
  if(global.BattleFX)BattleFX.caption(p,s.name,p.forge.color);
}
function execute(p,a,target) {
  if(global.ForgeExpansion?.execute(p,a,target,{hit,enemies}))return;
  if(global.AbilityAtlas && AbilityAtlas.execute(p,a,target,{hit,enemies}))return;
  const c=p.forge.color,near=target&&target.hp>0?target:getClosestAliveEnemy(p);
  const within=(x,y,r)=>enemies(p).filter(e=>Math.hypot(e.x-x,e.y-y)<r+e.radius);
  const visual=(kind,opts={})=>{if(global.BattleFX)BattleFX.cast(p,kind,Object.assign({color:c},opts));};
  if(a.type==='wave'){visual('wave',{radius:a.radius});within(p.x,p.y,a.radius).forEach(e=>hit(p,e,a));}
  else if(a.type==='shot'){
    if(!near)return;
    visual('shot');const angle=Math.atan2(near.y-p.y,near.x-p.x);
    for(let i=0;i<a.count;i++){const t=angle+(i-(a.count-1)/2)*.19;
      p.forgeShots.push({x:p.x,y:p.y,vx:Math.cos(t)*a.speed,vy:Math.sin(t)*a.speed,life:Math.ceil(a.radius/a.speed*3),a});
    }
    if(p.forgeShots.length>100)p.forgeShots.splice(0,p.forgeShots.length-100);
  } else if(a.type==='beam'){
    if(!near)return;
    const d=Math.hypot(near.x-p.x,near.y-p.y)||1,x=p.x+(near.x-p.x)/d*a.radius*2,y=p.y+(near.y-p.y)/d*a.radius*2;
    if(global.BattleFX)BattleFX.beam(p.x,p.y,x,y,c);
    visual('energy');
    enemies(p).forEach(e=>{const vx=x-p.x,vy=y-p.y,t=Math.max(0,Math.min(1,((e.x-p.x)*vx+(e.y-p.y)*vy)/(vx*vx+vy*vy||1)));if(Math.hypot(e.x-p.x-t*vx,e.y-p.y-t*vy)<e.radius+12)hit(p,e,a);});
  } else if(a.type==='bolt'){
    if(!near)return;
    visual('meteor',{x:near.x,y:near.y,radius:a.radius});
    for(let i=0;i<a.count;i++){const theta=i*2*Math.PI/a.count;p.forgeZones.push({type:'bolt',x:near.x+Math.cos(theta)*a.radius*.4,y:near.y+Math.sin(theta)*a.radius*.4,timer:30+i*5,a,ticks:0});}
  } else if(a.type==='dash'){
    if(!near)return;
    const dx=near.x-p.x,dy=near.y-p.y,d=Math.hypot(dx,dy)||1;
    p.vx=dx/d*a.speed;p.vy=dy/d*a.speed;p.forgeDash=Math.round(a.duration*60);p.forgeDashAction=a;visual('dash');
  } else if(a.type==='blink'){
    if(!near)return;
    visual('blink');const dx=near.x-p.x,dy=near.y-p.y,d=Math.hypot(dx,dy)||1;
    p.x=Math.max(p.radius,Math.min(canvas.width-p.radius,near.x-dx/d*68));
    p.y=Math.max(p.radius,Math.min(canvas.height-p.radius,near.y-dy/d*68));
    visual('blink');within(p.x,p.y,a.radius*.6).forEach(e=>hit(p,e,a));
  } else if(a.type==='heal'){
    if(global.ForgeExpansion)global.ForgeExpansion.heal(p,a.damage);else p.hp=Math.min(p.maxHp,p.hp+a.damage);visual('heal');addFloatingText('+'+a.damage,p.x,p.y-26,'#8bf2af',17);
  } else if(a.type==='shield'){
    p.invincible=Math.max(p.invincible,Math.round(a.duration*60));visual('shield');
  } else if(a.type==='pull'){
    visual('wave',{radius:a.radius});
    within(p.x,p.y,a.radius).forEach(e=>{
      const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
      e.vx+=dx/d*(a.knockback+2);e.vy+=dy/d*(a.knockback+2);
      hit(p,e,Object.assign({},a,{knockback:0}));
    });
  } else if(a.type==='orbit'){
    p.forgeOrbs.push({life:Math.round(a.duration*60),phase:0,ticks:0,a});
    if(p.forgeOrbs.length>3)p.forgeOrbs.shift();visual('shield');
  } else if(a.type==='zone'){
    if(!near)return;visual('meteor',{x:near.x,y:near.y,radius:a.radius});
    p.forgeZones.push({type:'zone',x:near.x,y:near.y,timer:Math.round(a.duration*60),a,ticks:0});
  }
}
function update(p,target){
  global.ForgeExpansion?.update(p,{hit,enemies});
  const loss=p.forgeLastHp-p.hp;p.forgeLastHp=p.hp;
  const cruise=p.forge.speed*(p.speedMultiplier||1),v=Math.hypot(p.vx,p.vy);
  if(p.forgeDash>0){
    p.forgeDash--;
    if(target){const t=Math.atan2(target.y-p.y,target.x-p.x);p.vx+=(Math.cos(t)*p.forgeDashAction.speed-p.vx)*.18;p.vy+=(Math.sin(t)*p.forgeDashAction.speed-p.vy)*.18;}
  }else if(v>.001&&Number.isFinite(v)){const next=v+(cruise-v)*(v>cruise?.075:.16);p.vx=p.vx/v*next;p.vy=p.vy/v*next;}
  else{p.vx=cruise;p.vy=0;}
  p.forge.skills.forEach((s,i)=>{
    if(global.ForgeExpansion?.blocked(p))return;
    p.forgeTicks[i]++;
    const cd=Math.round(s.cooldown*60);
    if(p.skillCooldown===60&&s.trigger==='auto')p.forgeTicks[i]=Math.max(p.forgeTicks[i],cd-60);
    if(p.forgeTicks[i]<cd)return;
    if((s.trigger==='auto'&&target)||(s.trigger==='lowhp'&&p.hp/p.maxHp*100<=s.threshold)||(s.trigger==='damaged'&&loss>0)){
      p.forgeTicks[i]=0;cast(p,s,target);
    }
  });
  for(let i=0;i<p.forgeQueue.length;){
    const q=p.forgeQueue[i];
    if(--q.timer>0){i++;continue;}
    if(!global.ForgeExpansion?.blocked(p))execute(p,q.a,players.find(e=>e.playerNum===q.targetNum&&e.hp>0)||target);
    p.forgeQueue.splice(i,1);
  }
  for(let i=p.forgeShots.length-1;i>=0;i--){
    const b=p.forgeShots[i];b.x+=b.vx;b.y+=b.vy;b.life--;
    const e=enemies(p).find(e=>Math.hypot(e.x-b.x,e.y-b.y)<e.radius+8&&hit(p,e,b.a));
    if(e||b.life<=0||b.x<0||b.y<0||b.x>canvas.width||b.y>canvas.height)p.forgeShots.splice(i,1);
  }
  if(p.forgeZones.length>32)p.forgeZones.splice(0,p.forgeZones.length-32);
  for(let i=p.forgeZones.length-1;i>=0;i--){
    const z=p.forgeZones[i];z.timer--;z.ticks++;
    if(z.type==='bolt'&&z.timer<=0){
      if(global.BattleFX)BattleFX.cast(p,'lightning',{x:z.x,y:z.y,color:p.forge.color});
      enemies(p).filter(e=>Math.hypot(e.x-z.x,e.y-z.y)<z.a.radius*.4+e.radius).forEach(e=>hit(p,e,z.a));
    }
    if(z.type==='zone'&&z.timer>0&&z.ticks%30===0){
      enemies(p).filter(e=>Math.hypot(e.x-z.x,e.y-z.y)<z.a.radius+e.radius).forEach(e=>hit(p,e,z.a,.4));
    }
    if(z.timer<=0)p.forgeZones.splice(i,1);
  }
  for(let i=p.forgeOrbs.length-1;i>=0;i--){
    const o=p.forgeOrbs[i];o.life--;o.phase+=.09;o.ticks++;
    if(o.ticks%28===0)enemies(p).filter(e=>Math.hypot(e.x-p.x,e.y-p.y)<o.a.radius+e.radius).forEach(e=>hit(p,e,o.a,.4));
    if(o.life<=0)p.forgeOrbs.splice(i,1);
  }
}
function contact(p,e){
  if(global.ForgeExpansion?.blocked(p))return;
  if(p.forgeDash>0&&p.forgeDashAction)hit(p,e,p.forgeDashAction);
  p.forge.skills.forEach((s,i)=>{
    if(global.ForgeExpansion?.blocked(p))return;
    if(s.trigger==='contact'&&p.forgeTicks[i]>=s.cooldown*60){p.forgeTicks[i]=0;cast(p,s,e);}
  });
  if(e&&e.invincible===0)hit(p,e,{damage:7,status:'none',knockback:1});
}
function drawFighter(p){
  if(!p.forge||p.hp<=0)return;
  global.ForgeExpansion?.draw(p);
  const c=p.forge.color;ctx.save();ctx.globalCompositeOperation='lighter';
  ctx.shadowColor=c;ctx.shadowBlur=14;ctx.fillStyle=c;ctx.strokeStyle=c;
  p.forgeShots.forEach(b=>{ctx.globalAlpha=.35;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(b.x-b.vx*3,b.y-b.vy*3);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.globalAlpha=1;ctx.beginPath();ctx.arc(b.x,b.y,7,0,2*Math.PI);ctx.fill();});
  p.forgeZones.forEach(z=>{ctx.globalAlpha=z.type==='bolt'?.65:.25;ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(z.x,z.y,z.type==='bolt'?z.a.radius*.4:z.a.radius,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);});
  p.forgeOrbs.forEach(o=>{for(let i=0;i<o.a.count;i++){const t=o.phase+i*2*Math.PI/o.a.count,r=o.a.radius*.75;ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(p.x+Math.cos(t)*r,p.y+Math.sin(t)*r,8,0,2*Math.PI);ctx.fill();}});
  ctx.restore();
}
function register(value){
  if(CUSTOM_DEFS.length>=6)throw Error('캐릭터는 최대 6명까지 만들 수 있습니다.');
  const profile=normalize(value),id='forge_'+(++sequence);
  const def={id,name:profile.name,forgeData:profile,createInstance(n){
    return {id,name:profile.name,playerNum:n,x:0,y:0,vx:1.1,vy:.9,radius:34,
      hp:profile.hp,maxHp:profile.hp,invincible:0,slowTimer:0,slowMultiplier:1,
      borderColor:profile.color,themeColor:profile.color,tagColor:profile.color,
      jumpState:'ground',forge:profile,forgeLastHp:profile.hp,forgeDash:0,
      forgeDashAction:null,forgeTicks:profile.skills.map((s,i)=>Math.round(s.cooldown*15)+i*14),
      forgeQueue:[],forgeShots:[],forgeZones:[],forgeOrbs:[],
      getImage:()=>CHARACTER_PHOTOS[id]||null,
      getDisplayName(){return this.name;},
      getTag(){return {text:profile.skills.map(s=>s.name).join(' · ').slice(0,70)};}
    };
  }};
  CUSTOM_DEFS.push(def);
  BEHAVIORS[id]={order:7,update,onContact:contact};
  return id;
}
function remove(id){
  const index=CUSTOM_DEFS.findIndex(d=>d.id===id&&d.forgeData);
  if(index<0)return false;
  CUSTOM_DEFS.splice(index,1);
  delete BEHAVIORS[id];if(typeof CHARACTER_PHOTOS!=='undefined')delete CHARACTER_PHOTOS[id];
  persist();refreshList();return true;
}
function list(){
  return CUSTOM_DEFS.filter(d=>d.forgeData).map(d=>({id:d.id,profile:normalize(d.forgeData)}));
}
function setDraft(value){
  draft=normalize(value);refreshForm();return draft;
}
function saved(){
  try{const v=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(v)?v.slice(0,6):[];}catch(_){return [];}
}
function persist(){
  try{localStorage.setItem(STORE,JSON.stringify(CUSTOM_DEFS.filter(d=>d.forgeData).map(d=>d.forgeData)));}catch(_){}
}
const escape=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(values,selected)=>Object.entries(values).map(([k,v])=>'<option value="'+k+'"'+(k===selected?' selected':'')+'>'+v+'</option>').join('');
let draft={name:'',blurb:'',color:'#a78bfa',hp:250,speed:1.8,skills:[skill()]};
let refreshList=()=>{}, refreshForm=()=>{};
function field(key,value,attrs){
  return '<input data-field="'+key+'" '+attrs+' value="'+escape(value)+'">';
}
function choice(key,values,value,attrs){
  return '<select data-field="'+key+'" '+attrs+'>'+options(values,value)+'</select>';
}
function render(){
  const place=document.getElementById('forge-skills');if(!place)return;
  place.innerHTML=draft.skills.map((s,i)=>{
    const si='data-skill="'+i+'"';
    const parts=s.actions.map((a,j)=>{
      const aj=si+' data-stage="'+j+'"';
      const box=(title,html)=>'<label>'+title+html+'</label>';
      return '<section class="forge-action">'
      +'<div class="forge-top"><span>ACTION '+(j+1)+'</span><button type="button" class="forge-delete" data-command="remove-action" '+aj+'>제거</button></div>'
      +'<div class="forge-grid">'
      +box('동작',choice('type',TYPE,a.type,aj))
      +box('공격 배치',choice('pattern',global.AbilityAtlas?.PATTERNS||{direct:'직선 집중'},a.pattern||'direct',aj))
      +box('대상 우선순위',choice('target',global.AbilityAtlas?.TARGETS||{nearest:'가장 가까운 적'},a.target||'nearest',aj))
      +box('위력',field('damage',a.damage,'type="number" min="0" max="120" step="1" '+aj))
      +box('범위',field('radius',a.radius,'type="number" min="30" max="300" step="5" '+aj))
      +box('개수',field('count',a.count,'type="number" min="1" max="8" step="1" '+aj))
      +box('속도',field('speed',a.speed,'type="number" min="2" max="14" step=".5" '+aj))
      +box('지속 (초)',field('duration',a.duration,'type="number" min=".2" max="8" step=".2" '+aj))
      +box('상태이상',choice('status',STATUS,a.status,aj))
      +box('넉백',field('knockback',a.knockback,'type="number" min="0" max="9" step=".5" '+aj))
      +box('발동 지연',field('delay',a.delay,'type="number" min="0" max="2" step=".1" '+aj))
      +'</div></section>';
    }).join('');
    return '<section class="forge-skill">'
      +'<div class="forge-top"><span>SKILL '+String(i+1).padStart(2,'0')+'</span><button type="button" class="forge-delete" data-command="remove-skill" '+si+'>스킬 삭제</button></div>'
      +'<label>스킬 이름'+field('name',s.name,si+' maxlength="18"')+'</label>'
      +'<div class="forge-grid">'
      +'<label>발동 조건'+choice('trigger',TRIGGER,s.trigger,si)+'</label>'
      +'<label>쿨타임 (초)'+field('cooldown',s.cooldown,'type="number" min=".2" max="30" step=".1" '+si)+'</label>'
      +(s.trigger==='lowhp'?'<label>HP 조건 (%)'+field('threshold',s.threshold,'type="number" min="5" max="95" step="5" '+si)+'</label>':'')
      +'</div><div class="forge-action-list">'+parts+'</div>'
      +'<button type="button" class="forge-add" data-command="add-action" '+si+' '+(s.actions.length>=3?'disabled':'')+'>+ 동작 연결</button>'
      +'</section>';
  }).join('');
  document.getElementById('forge-add-skill').disabled=draft.skills.length>=4;
}
function initializeUI(){
  const panel=document.querySelector('.bf-tools');
  if(!panel)return;
  const detail=Array.from(panel.querySelectorAll('details')).find(d=>d.querySelector('summary')?.textContent.includes('커스텀'));
  if(!detail)return;
  const body=detail.querySelector('.bf-details-body');
  body.innerHTML=''
  +'<p class="bf-helper">문장으로 자동 생성하고 필요할 때만 세부 설정을 수정하세요. 공격 배치와 대상 선택까지 조합할 수 있습니다.</p>'
  +'<div class="forge-grid">'
  +'<label>캐릭터 이름<input id="bf-name" maxlength="14" placeholder="나만의 파이터"></label>'
  +'<label>테마 색상<input id="forge-color" type="color" value="#a78bfa"></label>'
  +'<label>체력<input id="forge-hp" type="number" min="140" max="500" value="250"></label>'
  +'<label>기본 속도<input id="forge-speed" type="number" min=".6" max="5" step=".1" value="1.8"></label>'
  +'</div>'
  +'<label>캐릭터 설명 (게임 수치와 무관)<textarea id="bf-text" maxlength="90" rows="2" placeholder="캐릭터 설정"></textarea></label>'
  +'<div id="forge-skills" class="forge-skills"></div>'
  +'<button id="forge-add-skill" class="forge-add" type="button">+ 스킬 추가</button>'
  +'<div class="bf-btn-row"><button type="button" id="bf-analyze">능력 미리보기</button><button type="button" id="bf-create">캐릭터 생성</button></div>'
  +'<div id="bf-result" class="bf-result" role="status" aria-live="polite"></div>'
  +'<div id="bf-custom-list" class="bf-custom-list"></div>'
  +'<details class="forge-json"><summary>설정 JSON 가져오기 · 내보내기</summary>'
  +'<p class="bf-helper">다른 사람의 설정도 불러올 수 있습니다. 코드는 실행되지 않습니다.</p>'
  +'<textarea id="forge-json-text" rows="4" placeholder="JSON 붙여넣기"></textarea>'
  +'<div class="bf-btn-row"><button type="button" id="forge-export">JSON 내보내기</button><button type="button" id="forge-import">JSON 불러오기</button></div></details>';
  const $=id=>document.getElementById(id);
  function sync(){
    draft.name=$('bf-name').value;draft.blurb=$('bf-text').value;
    draft.color=$('forge-color').value;draft.hp=Number($('forge-hp').value);
    draft.speed=Number($('forge-speed').value);
  }
  function refreshBasics(){
    $('bf-name').value=draft.name;$('bf-text').value=draft.blurb;
    $('forge-color').value=draft.color;$('forge-hp').value=draft.hp;
    $('forge-speed').value=draft.speed;
  }
  function report(t){$('bf-result').textContent=t;}
  function roster(){
    const target=$('bf-custom-list');if(!target)return;
    target.replaceChildren();
    for(const def of CUSTOM_DEFS.filter(d=>d.forgeData)){
      const row=document.createElement('div');row.className='forge-saved-row';
      const name=document.createElement('span');name.textContent=def.name;
      const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';
      remove.dataset.forgeId=def.id;remove.className='forge-delete';
      row.append(name,remove);target.appendChild(row);
    }
  }
  refreshList=roster;
  refreshForm=()=>{refreshBasics();render();};
  $('bf-custom-list').addEventListener('click',e=>{
    const id=e.target.dataset.forgeId;
    if(!id)return;
    if(roundStarted&&!isGameOver){report('경기 종료 후 삭제할 수 있습니다.');return;}
    if(!confirm('이 캐릭터를 삭제하시겠습니까?'))return;
    if(remove(id)){reRollMatch();roster();report('캐릭터를 삭제했습니다.');}
  });
  $('forge-skills').addEventListener('input',e=>{
    const key=e.target.dataset.field;
    if(!key)return;
    const i=Number(e.target.dataset.skill),j=e.target.dataset.stage;
    const obj=j===undefined?draft.skills[i]:draft.skills[i]?.actions[Number(j)];
    if(obj)obj[key]=e.target.type==='number'?Number(e.target.value):e.target.value;
  });
  $('forge-skills').addEventListener('change',e=>{
    if(['type','trigger'].includes(e.target.dataset.field))render();
  });
  $('forge-skills').addEventListener('click',e=>{
    const button=e.target.closest('button[data-command]');
    if(!button)return;
    sync();const i=Number(button.dataset.skill),j=Number(button.dataset.stage);
    const action=button.dataset.command;
    if(action==='remove-skill'&&draft.skills.length>1)draft.skills.splice(i,1);
    if(action==='add-action'&&draft.skills[i].actions.length<3)draft.skills[i].actions.push(stage());
    if(action==='remove-action'&&draft.skills[i].actions.length>1)draft.skills[i].actions.splice(j,1);
    render();
  });
  $('forge-add-skill').addEventListener('click',()=>{
    sync();if(draft.skills.length<4){draft.skills.push(skill());render();}
  });
  $('bf-analyze').addEventListener('click',()=>{
    try{
      sync();const d=normalize(draft);
      report(d.skills.map((s,i)=>(i+1)+'. '+s.name+' · '+TRIGGER[s.trigger]+' / '+s.cooldown+'초'
        +'\n   '+s.actions.map(a=>TYPE[a.type]+' / '+(global.AbilityAtlas?.PATTERNS[a.pattern]||'직선 집중')+' / '+(global.AbilityAtlas?.TARGETS[a.target]||'가장 가까운 적')+' ('+a.damage+'위력, '+a.radius+'범위, '+STATUS[a.status]+')').join(' → ')).join('\n'));
    }catch(e){report(e.message);}
  });
  $('bf-create').addEventListener('click',()=>{
    if(roundStarted&&!isGameOver){report('경기 종료 후 생성할 수 있습니다.');return;}
    try{
      sync();const config=normalize(draft),id=register(config);
      persist();
      const preview=$('bf-face');
      if(preview&&!preview.hidden&&preview.src)loadPhoto(id,preview.src);
      reRollMatch();
      const first=$('bf-pick-0');
      if(first){first.value=id;$('bf-apply').click();}
      roster();report(config.name+' 생성 완료 · P1 적용');
    }catch(e){report(e.message);}
  });
  $('forge-export').addEventListener('click',()=>{
    try{sync();$('forge-json-text').value=JSON.stringify(normalize(draft),null,2);report('설정 JSON을 복사해 보관하세요.');}catch(e){report(e.message);}
  });
  $('forge-import').addEventListener('click',()=>{
    try{draft=normalize(JSON.parse($('forge-json-text').value));refreshBasics();render();report('설정 불러오기 완료');}
    catch(e){report('JSON 오류: '+e.message);}
  });
  refreshBasics();render();roster();
}
function initialize(){
  saved().forEach(profile=>{try{register(profile);}catch(_){}});
  initializeUI();
  if(CUSTOM_DEFS.length)reRollMatch();
  // Render custom projectiles and glyphs in the same pipeline as normal fighters.
  const oldDraw=drawCharacter;
  drawCharacter=function(p){if(p.forge)drawFighter(p);oldDraw(p);};
}
global.SkillForge={normalize,register,remove,list,setDraft,refreshList:()=>refreshList(),persist,TYPE,TRIGGER,STATUS};
if(typeof document!=='undefined'&&document.querySelector('.bf-tools'))initialize();
})(window);
