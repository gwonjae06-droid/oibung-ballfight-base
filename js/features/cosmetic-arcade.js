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
let lastDraw=null,spinning=false;
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
}
function borderColor(p){return p?.forge&&p.cosmetic?.border?byId(p.cosmetic.border)?.color:null;}
function borderGlow(p){return borderColor(p)?7:0;}
function startRound(list){
  effects.length=0;
  for(const p of list)if(p.cosmetic?.entrance)p.cosmeticEntrance=84;
}
function onCast(p,action,target){
  if(!p?.forge||!p.cosmetic?.motion)return;
  const item=byId(p.cosmetic.motion);if(!item)return;
  effects.push({id:item.id,color:item.color,x:p.x,y:p.y,
    targetX:target?.x??p.x+60,targetY:target?.y??p.y,age:0,life:34});
  if(effects.length>28)effects.splice(0,effects.length-28);
}
function tick(list){
  for(const p of list){
    if(!p?.cosmetic)return;
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
  for(const p of list){
    if(!p?.cosmetic?.trail||!p.cosmeticTrail?.length)continue;
    const points=p.cosmeticTrail,c=byId(p.cosmetic.trail)?.color||'#9fc2e3';
    ctx.save();ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineCap='round';
    const type=p.cosmetic.trail;
    if(type==='trail-ribbon'){
      ctx.lineWidth=5;ctx.globalAlpha=.48;ctx.beginPath();points.forEach((a,i)=>i?ctx.lineTo(a.x,a.y):ctx.moveTo(a.x,a.y));ctx.stroke();
    }else{
      points.forEach((a,i)=>{
        const alpha=(1-i/points.length)*.55;
        ctx.globalAlpha=alpha;
        if(type==='trail-lightning'&&i<points.length-1){
          const b=points[i+1],off=i%2?5:-5;
          ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(a.x,a.y);
          ctx.lineTo((a.x+b.x)/2+off,(a.y+b.y)/2-off);ctx.lineTo(b.x,b.y);ctx.stroke();
        }else{
          ctx.beginPath();ctx.arc(a.x,a.y,Math.max(1,5-i*.32),0,Math.PI*2);ctx.fill();
        }
      });
    }
    for(const point of p.cosmeticShotTrails||[]){
      ctx.globalAlpha=(1-point.age/13)*.55;
      ctx.fillStyle=c;ctx.beginPath();
      ctx.arc(point.x,point.y,Math.max(1,4-point.age*.22),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
}
function drawOver(ctx,list){
  for(const p of list){
    const tick=p.cosmeticEntrance||0;if(tick<=0||p.hp<=0)continue;
    const item=byId(p.cosmetic?.entrance);if(!item)continue;
    const t=1-tick/84;
    ctx.save();ctx.globalAlpha=Math.min(1,tick/16)*(.75-t*.25);
    ctx.strokeStyle=item.color;ctx.lineWidth=2.5;
    if(item.id==='entrance-spark'){
      for(let j=0;j<7;j++){const a=j*Math.PI*2/7+t*3,r=55*(1-t)+p.radius;
        ctx.fillStyle=item.color;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,3,0,Math.PI*2);ctx.fill();}
    }else if(item.id==='entrance-gate'){
      ctx.setLineDash([7,6]);ring(ctx,p.x,p.y,p.radius+18+t*27);
      ctx.setLineDash([]);ring(ctx,p.x,p.y,p.radius+8+t*12);
    }else{ring(ctx,p.x,p.y,p.radius+10+t*45);ring(ctx,p.x,p.y,p.radius+27+t*37);}
    ctx.restore();
  }
  for(const e of effects){
    const t=e.age/e.life,r=10+t*46;
    ctx.save();ctx.globalAlpha=Math.min(1,(1-t)*1.5)*.75;
    ctx.strokeStyle=e.color;ctx.fillStyle=e.color;ctx.lineWidth=3;
    if(e.id==='motion-rune'){
      for(let j=0;j<6;j++){const a=j*Math.PI/3+t*4;
        const x=e.x+Math.cos(a)*r,y=e.y+Math.sin(a)*r;
        ctx.beginPath();ctx.moveTo(x,y-6);ctx.lineTo(x+5,y+4);ctx.lineTo(x-5,y+4);ctx.closePath();ctx.stroke();}
      ring(ctx,e.x,e.y,r*.65);
    }else if(e.id==='motion-echo'){
      for(let j=0;j<3;j++){ctx.globalAlpha=(1-t)*(.47-j*.1);
        ring(ctx,e.x-12-j*10,e.y+j*3,Math.max(4,r-j*8));}
    }else{
      for(let j=0;j<8;j++){const a=j*Math.PI/4;
        ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*(r*.35),e.y+Math.sin(a)*(r*.35));
        ctx.lineTo(e.x+Math.cos(a)*r,e.y+Math.sin(a)*r);ctx.stroke();}
    }
    ctx.restore();
  }
}
document.getElementById('cosmetic-draw')?.addEventListener('click',()=>beginRoulette());
refresh();
global.CosmeticArcade={drawReward,beginRoulette,lastResult,equip,refresh,applyToFighter,borderColor,borderGlow,startRound,onCast,tick,drawUnder,drawOver,
  getOwned:()=>state.owned.slice(),getEquipped:()=>({...state.equipped}),price:PRICE};
})(window);
