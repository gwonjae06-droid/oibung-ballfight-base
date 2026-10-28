/* Cosmetic-only rewards. No effect changes damage, cooldown or hit geometry.
 * A user's equipped loadout applies to all custom fighters in future rounds.
 */
(function(global){
'use strict';
const KEY='oibung-cosmetics-v1',PRICE=300,REFUND=100,ITEM_CHANCE=.005,PITY_LIMIT=75;
const OPTIONS={
  border:[
    {id:'border-steel',name:'청은 테두리',color:'#b9ddfb'},
    {id:'border-gold',name:'태양 테두리',color:'#f3bf6e'},
    {id:'border-neon',name:'네온 테두리',color:'#d2a5fc'}
  ],
  tint:[
    {id:'tint-cyan',name:'서리빛 스킬',color:'#63c8ea'},
    {id:'tint-rose',name:'장미빛 스킬',color:'#ef849c'},
    {id:'tint-violet',name:'보랏빛 스킬',color:'#b5a0ed'}
  ],
  trail:[
    {id:'trail-comet',name:'별가루 궤적',color:'#a4cefa'},
    {id:'trail-ribbon',name:'리본 궤적',color:'#f9a8ca'},
    {id:'trail-lightning',name:'전기 궤적',color:'#d3bd6a'}
  ],
  entrance:[
    {id:'entrance-spark',name:'별빛 등장',color:'#f3d18a'},
    {id:'entrance-ring',name:'충격파 등장',color:'#8dd9ee'},
    {id:'entrance-gate',name:'차원문 등장',color:'#a9a0ef'}
  ],
  motion:[
    {id:'motion-rune',name:'룬 시전 모션',color:'#a1d6ff'},
    {id:'motion-echo',name:'잔상 시전 모션',color:'#d8adee'},
    {id:'motion-burst',name:'폭발 시전 모션',color:'#ffd18f'}
  ]
};
const NAMES={border:'캐릭터 테두리',tint:'스킬 색상',trail:'공격·이동 궤적',entrance:'등장 연출',motion:'특수 스킬 모션'};
const all=Object.values(OPTIONS).flat();
const lookup=Object.fromEntries(all.map(item=>[item.id,item]));
function load(){
  try{
    const d=JSON.parse(localStorage.getItem(KEY)||'null')||{};
    const owned=Array.isArray(d.owned)?[...new Set(d.owned.filter(id=>lookup[id]))]:[];
    const equipped={};
    for(const [category,items] of Object.entries(OPTIONS)){
      const id=d.equipped?.[category];
      equipped[category]=owned.includes(id)&&items.some(v=>v.id===id)?id:null;
    }
    return {owned,equipped,misses:Math.min(74,Math.max(0,Math.floor(Number(d.misses)||0))),draws:Math.max(0,Math.floor(Number(d.draws)||0))};
  }catch(_){return {owned:[],equipped:{},misses:0,draws:0};}
}
const state=load();
const effects=[];
let lastDraw=null,spinning=false,lastWheelAngle=0;
const WISDOM=['오늘의 한 걸음이 내일의 거리를 바꾼다.','길이 막히면 속도보다 방향을 먼저 보라.','쉬어 가는 시간도 앞으로 나아가는 과정이다.','넘어진 횟수보다 다시 시작한 횟수를 세자.','작은 성취를 반복하면 큰 변화가 된다.','결과가 전부는 아니지만 경험은 항상 남는다.'];
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));return true;}
  catch(_){return false;}
}
const byId=id=>lookup[id]||null;
function equipped(category){return byId(state.equipped[category]);}
function wallet(){return typeof coins==='number'?coins:0;}
function feedback(message){const el=document.getElementById('cosmetic-result');if(el)el.textContent=message;}
function drawReward(rng=Math.random){
  if(spinning||wallet()<PRICE){if(!spinning)feedback('포인트가 부족합니다. 광산에서 G를 획득하세요.');return null;}
  coins-=PRICE;state.draws++;
  const roll=Math.min(.999999999,Math.max(0,Number(rng())||0));
  const unowned=all.filter(item=>!state.owned.includes(item.id));
  const pity=state.misses>=PITY_LIMIT-1;
  let item=null;
  if(pity){const pool=unowned.length?unowned:all;item=pool[Math.floor(Math.min(.999999999,Math.max(0,Number(rng())||0))*pool.length)];}
  else if(roll<all.length*ITEM_CHANCE)item=all[Math.min(all.length-1,Math.floor(roll/ITEM_CHANCE))];
  if(item){
    if(state.owned.includes(item.id)){
      coins+=REFUND;
      state.misses=unowned.length?Math.min(74,state.misses+1):0;
      lastDraw={kind:'duplicate',item,text:'중복 · '+item.name+' · '+formatGold(REFUND)+' 반환'};
    }else{
      state.owned.push(item.id);
      if(!state.equipped[item.id.split('-')[0]])state.equipped[item.id.split('-')[0]]=item.id;
      state.misses=0;
      lastDraw={kind:'item',item,text:'신규 획득! '+item.name+' · 장착 완료 · 다음 경기부터 적용'};
    }
  }else{
    state.misses++;
    if((Number(rng())||0)<.65){
      const refunds=[20,30,40,50,60,80];
      const amount=refunds[Math.floor(Math.min(.999999999,Math.max(0,Number(rng())||0))*refunds.length)];
      coins+=amount;lastDraw={kind:'coins',amount,text:'소액 반환 · '+formatGold(amount)+' 지급'};
    }else{
      lastDraw={kind:'wisdom',text:WISDOM[Math.floor(Math.min(.999999999,Math.max(0,Number(rng())||0))*WISDOM.length)]};
    }
  }
  save();global.saveEconomyState?.();
  if(typeof renderEconomyUI==='function')renderEconomyUI();
  feedback(lastDraw.text);refresh();return item;
}
function lastResult(){return lastDraw?{...lastDraw}:null;}
function equip(category,id){
  if(!OPTIONS[category])return false;
  if(id!==null&&(!state.owned.includes(id)||!OPTIONS[category].some(x=>x.id===id)))return false;
  state.equipped[category]=id;save();
  feedback((id?lookup[id].name:'기본 '+NAMES[category])+' 선택 완료 · 다음 경기부터 적용');
  refresh();return true;
}
function refresh(){
  const walletEl=document.getElementById('arcade-wallet');
  if(walletEl)walletEl.textContent=formatGold(wallet());
  const btn=document.getElementById('cosmetic-draw');
  if(btn)btn.disabled=spinning||wallet()<PRICE;
  const host=document.getElementById('cosmetic-collections');if(!host)return;
  host.replaceChildren();
  for(const [category,items] of Object.entries(OPTIONS)){
    const row=document.createElement('section');row.className='cosmetic-category';
    const title=document.createElement('div');title.className='cosmetic-category-header';
    const label=document.createElement('strong');label.textContent=NAMES[category];
    const count=document.createElement('small');
    count.textContent=items.filter(item=>state.owned.includes(item.id)).length+' / '+items.length+' 수집';
    title.append(label,count);row.append(title);
    const choices=document.createElement('div');choices.className='cosmetic-options';
    const basic=document.createElement('button');basic.type='button';
    basic.textContent='기본';basic.className='cosmetic-choice';
    basic.setAttribute('aria-pressed',String(!state.equipped[category]));
    basic.addEventListener('click',()=>equip(category,null));choices.append(basic);
    for(const item of items){
      const owned=state.owned.includes(item.id);
      const choice=document.createElement('button');choice.type='button';choice.className='cosmetic-choice';
      choice.textContent=(owned?'◆ ':'◇ ')+item.name;
      choice.style.setProperty('--swatch',item.color);
      choice.disabled=!owned;choice.title=owned?'클릭하여 장착':'가챠에서 획득 가능';
      choice.setAttribute('aria-pressed',String(state.equipped[category]===item.id));
      choice.addEventListener('click',()=>equip(category,item.id));choices.append(choice);
    }
    row.append(choices);host.append(row);
  }
}
function applyToFighter(p){
  if(!p?.forge)return;
  p.cosmetic={
    border:state.equipped.border||null,
    trail:state.equipped.trail||null,
    entrance:state.equipped.entrance||null,
    motion:state.equipped.motion||null
  };
  const item=equipped('tint');
  if(item){
    // Avoid mutating shared profiles, even if two fighters use the same definition.
    p.forge={...p.forge,effectColor:item.color};
    p.effectColor=item.color;
  }
  p.cosmeticTrail=[];
  p.cosmeticShotTrails=[];
  p.cosmeticEntrance=0;
  p.cosmeticAge=0;
}
function borderColor(p){return p?.forge&&p.cosmetic?.border?byId(p.cosmetic.border)?.color:null;}
function borderGlow(p){return borderColor(p)?7:0;}

/* Three distinct animated metallic/neon borders, drawn in local character
 * coordinates AFTER the photo clip. Purely decorative; no collision changes. */
function drawBorder(ctx,p,r){
  const type=p.cosmetic?.border;
  const item=byId(type);if(!item)return false;
  const age=p.cosmeticAge||0,phase=age*.045;
  const reduced=!!global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const spin=reduced?0:phase,TAU=Math.PI*2;
  ctx.save();ctx.lineCap='round';
  const main=item.color;
  ctx.shadowColor=main;ctx.shadowBlur=reduced?3:10;
  const gradient=ctx.createLinearGradient(-r,-r,r,r);
  gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.27,main);
  gradient.addColorStop(.55,'#334c63');gradient.addColorStop(.78,main);
  gradient.addColorStop(1,'#f8f2df');
  ctx.strokeStyle=gradient;ctx.lineWidth=3.6;
  ring(ctx,0,0,r+2);
  ctx.shadowBlur=reduced?0:15;
  if(type==='border-steel'){
    for(let i=0;i<4;i++){
      const angle=spin*.55+i*Math.PI/2;
      ctx.strokeStyle=i%2?'#7aabc9':'#e8f9ff';ctx.lineWidth=i%2?2.5:3.8;
      ctx.beginPath();ctx.arc(0,0,r+6,angle,angle+.65);ctx.stroke();
    }
    for(let i=0;i<8;i++){
      const a=i*TAU/8-spin*.2,x=Math.cos(a)*(r+8),y=Math.sin(a)*(r+8);
      ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/4);
      ctx.fillStyle='#d6f6ff';ctx.fillRect(-2.5,-2.5,5,5);ctx.restore();
    }
  }else if(type==='border-gold'){
    for(let i=0;i<12;i++){
      const a=i*TAU/12+spin*.2,inner=r+3,outer=r+11+(i%3)*3;
      ctx.strokeStyle=i%2?'#f7d58c':'#a9792a';ctx.lineWidth=i%3===0?3.4:2;
      ctx.beginPath();ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);
      ctx.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);ctx.stroke();
    }
    for(let i=0;i<4;i++){
      const a=spin*.7+i*Math.PI/2;
      ctx.strokeStyle='#fff1c5';ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(0,0,r+9,a,a+.38);ctx.stroke();
    }
  }else if(type==='border-neon'){
    ctx.lineWidth=3.5;ctx.strokeStyle='#e68cfa';
    ctx.setLineDash([Math.max(5,r*.42),9]);
    ctx.lineDashOffset=-spin*16;ring(ctx,0,0,r+8);ctx.setLineDash([]);
    ctx.lineWidth=2;ctx.strokeStyle='#6dcbff';
    ctx.beginPath();ctx.arc(0,0,r+13,-spin*.6,-spin*.6+Math.PI*1.55);ctx.stroke();
    for(let i=0;i<6;i++){
      const a=spin*1.3+i*TAU/6;
      ctx.fillStyle=i%2?'#f3a6ff':'#a9ecff';
      ctx.beginPath();ctx.arc(Math.cos(a)*(r+10),Math.sin(a)*(r+10),2.5,0,TAU);ctx.fill();
    }
  }
  ctx.restore();return true;
}

function startRound(list){
  effects.length=0;
  for(const p of list)if(p.cosmetic?.entrance)p.cosmeticEntrance=84;
}
function onCast(p,action,target){
  if(!p?.forge)return;
  const tint=byId(state.equipped.tint);
  const motion=byId(p.cosmetic?.motion);
  for(const item of [tint,motion]){
    if(!item)continue;
    effects.push({id:item.id,color:item.color,x:p.x,y:p.y,
      targetX:target?.x??p.x+60,targetY:target?.y??p.y,
      age:0,life:item.id.startsWith('tint-')?30:42});
  }
  if(effects.length>44)effects.splice(0,effects.length-44);
}
function tick(list){
  for(const p of list){
    if(!p?.cosmetic)return;
    p.cosmeticAge=(p.cosmeticAge||0)+1;
    if(p.cosmeticEntrance>0)p.cosmeticEntrance--;
    if(p.cosmetic.trail&&p.hp>0){
      p.cosmeticTrail||=[];
      p.cosmeticTrail.unshift({x:p.x,y:p.y});
      if(p.cosmeticTrail.length>12)p.cosmeticTrail.pop();
      // Real projectile positions, not invented trajectories: forge bullets and
      // moving expansion missiles leave independent short-lived streaks.
      p.cosmeticShotTrails||=[];
      for(const point of p.cosmeticShotTrails)point.age++;
      p.cosmeticShotTrails=p.cosmeticShotTrails.filter(point=>point.age<13);
      const active=[...(p.forgeShots||[]),
        ...(p.forgeExtras||[]).filter(b=>['dung','homing','pierce','boomerang'].includes(b.kind))];
      for(const b of active.slice(0,30))
        if(Number.isFinite(b.x)&&Number.isFinite(b.y))
          p.cosmeticShotTrails.push({x:b.x,y:b.y,age:0});
      if(p.cosmeticShotTrails.length>130)p.cosmeticShotTrails.splice(0,p.cosmeticShotTrails.length-130);
    }
  }
  for(let i=effects.length-1;i>=0;i--){effects[i].age++;if(effects[i].age>=effects[i].life)effects.splice(i,1);}
}
const ring=(ctx,x,y,r)=>{ctx.beginPath();ctx.arc(x,y,Math.max(1,r),0,Math.PI*2);ctx.stroke();};
function drawUnder(ctx,list){
  const reduced=!!global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const TAU=Math.PI*2;
  for(const p of list){
    if(!p?.cosmetic?.trail||!p.cosmeticTrail?.length)continue;
    const points=p.cosmeticTrail,c=byId(p.cosmetic.trail)?.color||'#9fc2e3';
    const type=p.cosmetic.trail,phase=(p.cosmeticAge||0)*.15;
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle=c;ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=reduced?0:9;
    if(type==='trail-ribbon'){
      // A layered smooth silk ribbon with an independently oscillating core.
      if(points.length>1){
        for(const [width,alpha] of [[10,.17],[5,.42],[1.7,.85]]){
          ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.beginPath();
          ctx.moveTo(points[0].x,points[0].y);
          for(let i=1;i<points.length;i++){
            const a=points[i],prev=points[i-1];
            const drift=Math.sin(phase-i*.7)*Math.min(8,i*.75);
            ctx.quadraticCurveTo(prev.x+drift,prev.y-drift,(prev.x+a.x)/2,(prev.y+a.y)/2);
          }
          ctx.stroke();
        }
      }
      points.filter((_,i)=>i%3===0).forEach((a,i)=>{
        const r=3+(Math.sin(phase+i)*.5+.5)*3;
        ctx.globalAlpha=.3;
        ctx.beginPath();ctx.ellipse(a.x,a.y,r,r*.4,phase,0,TAU);ctx.stroke();
      });
    }else if(type==='trail-lightning'){
      for(let i=0;i<points.length-1;i++){
        const a=points[i],b=points[i+1],offset=Math.sin(phase+i*13)*7;
        ctx.globalAlpha=(1-i/points.length)*.95;
        ctx.strokeStyle=i%2?'#b8e3f3':'#d8bb72';ctx.lineWidth=i%3===0?3:1.8;
        ctx.beginPath();ctx.moveTo(a.x,a.y);
        ctx.lineTo((a.x+b.x)/2+offset,(a.y+b.y)/2-offset);
        ctx.lineTo(b.x,b.y);ctx.stroke();
        if(!reduced&&i%3===0){
          ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(a.x,a.y);
          ctx.lineTo(a.x+Math.cos(phase+i)*11,a.y+Math.sin(phase+i)*11);ctx.stroke();
        }
      }
    }else{
      // Comet trail uses tapered luminous dust and four-point stars.
      points.forEach((a,i)=>{
        const t=1-i/points.length,r=Math.max(.6,t*5.5);
        ctx.globalAlpha=t*.65;ctx.fillStyle=i%3?'#a7daff':'#fff1c2';
        ctx.beginPath();ctx.arc(a.x,a.y,r,0,TAU);ctx.fill();
        if(!reduced&&i%3===0){
          ctx.globalAlpha=t*.8;ctx.strokeStyle='#d4ebff';ctx.lineWidth=1.2;
          ctx.beginPath();ctx.moveTo(a.x-r*2,a.y);ctx.lineTo(a.x+r*2,a.y);
          ctx.moveTo(a.x,a.y-r*2);ctx.lineTo(a.x,a.y+r*2);ctx.stroke();
        }
      });
    }
    // Actual projectile tracks: drifting particles linked to fired objects.
    for(const a of p.cosmeticShotTrails||[]){
      const t=Math.max(0,1-a.age/13),r=Math.max(1,t*3.9);
      ctx.globalAlpha=t*.66;ctx.shadowBlur=reduced?0:6;
      ctx.fillStyle=a.age%3?'#e1f2ff':c;
      ctx.beginPath();ctx.arc(a.x,a.y,r,0,TAU);ctx.fill();
    }
    ctx.restore();
  }
}
/* Event-based effects: entrance, three signature skill motions, and three
 * tinted casting accents. Runs on existing 60Hz physics; no extra tick loops. */
function drawOver(ctx,list){
  const TAU=Math.PI*2;
  const reduced=!!global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const orb=(x,y,r)=>{ctx.beginPath();ctx.arc(x,y,Math.max(1,r),0,TAU);ctx.fill();};
  const polygon=(x,y,r,n,rot=0)=>{
    ctx.beginPath();
    for(let i=0;i<=n;i++){
      const a=rot+i*TAU/n,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.stroke();
  };
  for(const p of list){
    const remaining=p.cosmeticEntrance||0;
    if(remaining<=0||p.hp<=0)continue;
    const item=byId(p.cosmetic?.entrance);
    if(!item)continue;
    const t=1-remaining/84,unfold=Math.sin(Math.min(1,t)*Math.PI*.8);
    const angle=t*TAU*1.7;
    ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=Math.min(1,remaining/14);
    ctx.shadowColor=item.color;ctx.shadowBlur=reduced?0:17;
    ctx.strokeStyle=item.color;ctx.fillStyle=item.color;ctx.lineWidth=2.5;
    if(item.id==='entrance-spark'){
      // Stargate-like meteor shower converging to the character and then
      // expanding into scattered glints with different parallax positions.
      for(let i=0;i<14;i++){
        const a=i*2.39996+angle*.55;
        const radius=p.radius+14+(1-t)*100+Math.sin(i*2.4+t*5)*7;
        const x=Math.cos(a)*radius,y=Math.sin(a)*radius;
        ctx.globalAlpha=(.35+.55*unfold)*(i%3?.68:1);
        ctx.lineWidth=i%3===0?2.5:1.1;
        ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);
        ctx.moveTo(x,y-5);ctx.lineTo(x,y+5);ctx.stroke();
        orb(x,y,i%4===0?3.5:1.6);
      }
      ctx.globalAlpha=(1-t)*.75;
      ring(ctx,0,0,p.radius+12+t*54);
    }else if(item.id==='entrance-gate'){
      // Counter-rotating portal runes, tall ellipse and discrete seal points.
      ctx.save();ctx.rotate(angle);
      ctx.setLineDash([8,5,2,6]);ctx.lineDashOffset=-t*30;
      ctx.beginPath();ctx.ellipse(0,0,p.radius+20,p.radius+30,0,0,TAU);ctx.stroke();
      ctx.setLineDash([]);polygon(0,0,p.radius+37,8,-Math.PI/8);
      ctx.restore();
      ctx.save();ctx.rotate(-angle*.65);
      ctx.lineWidth=1.4;ctx.strokeStyle='#e1c5ff';
      polygon(0,0,p.radius+11,6,Math.PI/6);ring(ctx,0,0,p.radius+4);
      ctx.restore();
      for(let i=0;i<6;i++){
        const a=i*TAU/6-angle,x=Math.cos(a)*(p.radius+38),y=Math.sin(a)*(p.radius+38);
        ctx.globalAlpha=Math.max(.15,1-t);
        orb(x,y,3);
      }
    }else{
      // Expanding double shockwave with segmented circular tracer.
      ctx.globalAlpha=.9*(1-t);ctx.lineWidth=5;
      ring(ctx,0,0,p.radius+12+t*96);
      ctx.globalAlpha=.5*(1-t);ctx.lineWidth=2;
      ring(ctx,0,0,p.radius+30+t*116);
      ctx.globalAlpha=.9;ctx.lineWidth=2.6;
      for(let i=0;i<9;i++){
        const a=i*TAU/9+angle;
        ctx.beginPath();ctx.arc(0,0,p.radius+17,a,a+.31);ctx.stroke();
      }
      for(let i=0;i<12;i++){
        const a=i*TAU/12,dist=(p.radius+4)+t*72;
        const x=Math.cos(a)*dist,y=Math.sin(a)*dist;
        ctx.globalAlpha=(1-t)*.65;
        ctx.beginPath();ctx.moveTo(x,y);
        ctx.lineTo(x+Math.cos(a)*12,y+Math.sin(a)*12);ctx.stroke();
      }
    }
    ctx.restore();
  }
  for(const e of effects){
    const t=e.age/e.life,fade=Math.min(1,t*9,(1-t)*3);
    if(fade<=0)continue;
    const radius=15+t*67,spin=e.age*.11;
    ctx.save();ctx.translate(e.x,e.y);
    ctx.strokeStyle=e.color;ctx.fillStyle=e.color;
    ctx.globalAlpha=fade*.82;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.shadowColor=e.color;ctx.shadowBlur=reduced?0:13;ctx.lineWidth=2.5;
    if(e.id==='motion-rune'){
      // Multi-ring rotating spell seal + six rotating diamond sigils.
      ctx.save();ctx.rotate(spin);
      polygon(0,0,radius,6,Math.PI/6);
      ring(ctx,0,0,radius*.73);
      ctx.rotate(-spin*2.2);polygon(0,0,radius*.54,3,-Math.PI/2);
      ctx.restore();
      for(let i=0;i<6;i++){
        const a=i*TAU/6-spin,r=radius*.85,x=Math.cos(a)*r,y=Math.sin(a)*r;
        ctx.save();ctx.translate(x,y);ctx.rotate(a);
        polygon(0,0,6,4,Math.PI/4);ctx.restore();
      }
      ctx.lineWidth=1.4;ring(ctx,0,0,radius*.34);
    }else if(e.id==='motion-echo'){
      // Three offsets follow the actual cast vector, with distinct phases.
      const direction=Math.atan2(e.targetY-e.y,e.targetX-e.x),dx=Math.cos(direction),dy=Math.sin(direction);
      for(let i=0;i<4;i++){
        ctx.globalAlpha=fade*(.2+.15*i);
        ctx.strokeStyle=i%2?'#fcceff':e.color;
        ctx.lineWidth=2+i*.6;
        ctx.beginPath();ctx.ellipse(dx*(i*14+t*32),dy*(i*14+t*32),radius*(.63-i*.08),
          radius*(.72-i*.08),direction,0,TAU);ctx.stroke();
      }
      ctx.globalAlpha=fade*.8;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(dx*(radius+40),dy*(radius+40));ctx.stroke();
    }else if(e.id==='motion-burst'){
      ctx.globalAlpha=fade*(1-t*.3);
      for(let i=0;i<16;i++){
        const a=i*TAU/16+spin*.4;
        const begin=radius*.38+Math.sin(i*7.1+t*9)*4,end=radius+(i%4)*8;
        ctx.lineWidth=i%4===0?3.4:1.7;
        ctx.beginPath();ctx.moveTo(Math.cos(a)*begin,Math.sin(a)*begin);
        ctx.lineTo(Math.cos(a)*end,Math.sin(a)*end);ctx.stroke();
        if(i%4===0)orb(Math.cos(a)*end,Math.sin(a)*end,3.3);
      }
      ctx.lineWidth=4.5;ring(ctx,0,0,radius*.52);
    }else if(e.id==='tint-cyan'){
      // Layered snow-crystals and six-point frost rays.
      ctx.strokeStyle='#d0f4ff';ctx.lineWidth=1.5;
      for(let i=0;i<8;i++){
        const a=i*TAU/8+spin*.4,x=Math.cos(a)*radius*.85,y=Math.sin(a)*radius*.85;
        ctx.save();ctx.translate(x,y);ctx.rotate(a);
        polygon(0,0,4+t*5,6,0);ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(8,0);
        ctx.moveTo(0,-8);ctx.lineTo(0,8);ctx.stroke();ctx.restore();
      }
      ring(ctx,0,0,radius*.48);
    }else if(e.id==='tint-rose'){
      // Pink petals emerge independently on curved elliptical paths.
      for(let i=0;i<11;i++){
        const a=i*2.39996+spin*.4,x=Math.cos(a)*radius*.83,y=Math.sin(a)*radius*.83;
        ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/4);
        ctx.beginPath();ctx.ellipse(0,0,4+t*2,9+t*5,0,0,TAU);
        ctx.globalAlpha=fade*(.35+.5*(i%3)/2);ctx.fill();ctx.restore();
      }
      ctx.lineWidth=1.5;ring(ctx,0,0,radius*.62);
    }else if(e.id==='tint-violet'){
      // Twin opposing arcane spirals and arcane stars.
      for(let sign of [-1,1]){
        ctx.beginPath();
        for(let j=0;j<=30;j++){
          const a=sign*(j*.22+spin*1.4),r=j/30*radius;
          const x=Math.cos(a)*r,y=Math.sin(a)*r;
          if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
      ctx.save();ctx.rotate(spin);polygon(0,0,radius*.72,5,-Math.PI/2);ctx.restore();
    }
    ctx.restore();
  }
}
/* Cinematic roulette uses an abstract kinetic wheel. Segments are decorative,
 * never an odds diagram; the prize is resolved and saved BEFORE animation.
 * It uses one requestAnimationFrame loop for a bounded 3.3-second spin. */
const wheel=document.getElementById('cosmetic-roulette');
const wheelCtx=wheel?.getContext?.('2d');
const TAU=Math.PI*2;
function drawWheel(rotation=0,reveal=0){
  if(!wheelCtx||!wheel)return;
  const c=wheelCtx,W=wheel.width,H=wheel.height,cx=W/2,cy=H/2,rad=120;
  c.clearRect(0,0,W,H);
  c.save();
  const aura=c.createRadialGradient(cx,cy,28,cx,cy,147);
  aura.addColorStop(0,'rgba(113,132,190,.20)');aura.addColorStop(.7,'rgba(92,133,169,.18)');
  aura.addColorStop(1,'rgba(26,42,59,0)');
  c.fillStyle=aura;c.beginPath();c.arc(cx,cy,148,0,TAU);c.fill();
  for(let i=0;i<20;i++){
    const angle=i*TAU/20+rotation*.09;
    const r=136+Math.sin(i*3.3+rotation)*5;
    c.fillStyle=['#7e9bb9','#b6c9e2','#d5b48d'][i%3];
    c.globalAlpha=.5+.3*Math.sin(rotation+i*.7)**2;
    c.beginPath();c.arc(cx+Math.cos(angle)*r,cy+Math.sin(angle)*r,(i%3)+1.2,0,TAU);c.fill();
  }
  c.globalAlpha=1;c.translate(cx,cy);
  c.rotate(rotation);
  c.save();
  c.shadowColor=reveal?'#f0c46c':'#92cced';c.shadowBlur=reveal?28:12;
  c.strokeStyle=reveal?'#f2d9a2':'#abcce6';c.lineWidth=5;
  c.beginPath();c.arc(0,0,rad,0,TAU);c.stroke();c.restore();
  const segments=24;
  for(let i=0;i<segments;i++){
    const a=i*TAU/segments-Math.PI/2,b=(i+1)*TAU/segments-Math.PI/2;
    c.beginPath();c.moveTo(0,0);c.arc(0,0,rad-7,a,b);c.closePath();
    c.fillStyle=i%4===0?'#324d68':i%4===1?'#314153':i%4===2?'#584e68':'#385565';c.fill();
    c.strokeStyle='rgba(220,238,255,.22)';c.lineWidth=1.5;c.stroke();
    c.save();c.rotate((a+b)/2);
    c.font='17px system-ui';c.textAlign='center';
    c.fillStyle=i%3===0?'#f0d79f':'#a9daef';
    c.fillText(['✦','◇','✧','◆'][i%4],93,5);
    c.restore();
  }
  c.save();c.rotate(-rotation*1.65);
  for(let i=0;i<10;i++){
    const a=i*TAU/10;
    c.strokeStyle=i%2?'rgba(176,222,247,.65)':'rgba(239,208,151,.76)';
    c.lineWidth=i%2?2:3;
    c.beginPath();c.arc(0,0,66,a+.1,a+.42);c.stroke();
  }
  c.restore();
  const center=c.createRadialGradient(-10,-12,4,0,0,57);
  center.addColorStop(0,reveal?'#f6d895':'#d8ecf8');
  center.addColorStop(.3,reveal?'#bd9260':'#7ea7bd');
  center.addColorStop(.93,'#172d40');center.addColorStop(1,'#0d1d2a');
  c.fillStyle=center;c.beginPath();c.arc(0,0,55,0,TAU);c.fill();
  c.strokeStyle='#cbdfe5';c.lineWidth=2;c.stroke();
  c.rotate(-rotation);
  c.font='900 38px system-ui';c.textAlign='center';c.textBaseline='middle';
  c.fillStyle=reveal?'#ffe0a3':'#e0f2ff';
  c.fillText(reveal?'✦':'◇',0,-2);
  c.restore();
  c.fillStyle='#f6d28d';c.shadowColor='#f7bc69';c.shadowBlur=12;
  c.beginPath();c.moveTo(cx,9);c.lineTo(cx-12,32);c.lineTo(cx+12,32);c.closePath();c.fill();
  c.shadowBlur=0;
  if(reveal>0){
    c.save();c.globalCompositeOperation='lighter';
    for(let i=0;i<40;i++){
      const a=i*2.39996+reveal*2.7,dist=145+(1-reveal)*60+(i%5)*8;
      const x=cx+Math.cos(a)*dist,y=cy+Math.sin(a)*dist;
      c.globalAlpha=Math.max(0,Math.min(1,1-reveal))*(i%3?.6:.9);
      c.fillStyle=i%3?'#93cbed':'#fff0b4';c.beginPath();c.arc(x,y,i%4===0?3:1.5,0,TAU);c.fill();
    }
    c.restore();
  }
}
function beginRoulette(){
  if(spinning)return false;
  const before=state.draws;
  drawReward();
  if(state.draws===before)return false;
  const result=lastResult();
  const reduced=!!global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const headline=document.getElementById('roulette-headline');
  const detail=document.getElementById('roulette-detail');
  const reveal=()=>{
    spinning=false;refresh();
    if(headline)headline.textContent=result.kind==='item'?'✦ 전설적인 등장!':
      result.kind==='duplicate'?'수집품이 돌아왔습니다':result.kind==='coins'?'포인트 반환':'오늘의 한마디';
    if(detail)detail.textContent=result.text;
    feedback(result.text);
    drawWheel(lastWheelAngle,.55);
    const panel=document.querySelector('.roulette-theatre');
    if(panel){panel.classList.remove('roulette-spinning');panel.classList.add('roulette-revealed');
      panel.dataset.reward=result.kind;}
  };
  if(reduced||typeof global.requestAnimationFrame!=='function'){reveal();return true;}
  spinning=true;refresh();
  if(headline)headline.textContent='룰렛 회전 중';
  if(detail)detail.textContent='찬란한 빛 속에서 운명이 결정되고 있습니다';
  feedback('룰렛이 회전하고 있습니다…');
  const panel=document.querySelector('.roulette-theatre');
  if(panel){panel.classList.remove('roulette-revealed');panel.classList.add('roulette-spinning');
    delete panel.dataset.reward;}
  let started=null;
  const duration=3300;
  const finale=6*TAU+(Math.random()*TAU);
  const frame=now=>{
    if(started===null)started=now;
    const t=Math.min(1,(now-started)/duration);
    // Smooth quintic deceleration; no sudden snap at the stop frame.
    const ease=1-(1-t)**5;
    lastWheelAngle=finale*ease;
    drawWheel(lastWheelAngle,t>.78?(t-.78)/.22:0);
    if(t<1)global.requestAnimationFrame(frame);
    else reveal();
  };
  global.requestAnimationFrame(frame);
  return true;
}
drawWheel();

document.getElementById('cosmetic-draw')?.addEventListener('click',()=>beginRoulette());
refresh();
global.CosmeticArcade={drawReward,beginRoulette,lastResult,equip,refresh,applyToFighter,borderColor,borderGlow,startRound,onCast,tick,drawUnder,drawOver,
  getOwned:()=>state.owned.slice(),getEquipped:()=>({...state.equipped}),price:PRICE,drawBorder,};
})(window);
