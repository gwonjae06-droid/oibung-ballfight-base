/* Fictional point market and click mine. No financial APIs, real money,
 * securities, borrowing, or cash-out. Single long position, optional 5x.
 * Position settlement may create negative G; mining always remains enabled.
 */
(function(global){
'use strict';
const KEY='oibung-market-v1',TICK_MS=3000;
const ASSETS={campus:'이권재 컴퍼니',meteor:'배달의 서준',arcana:'아토믹 성원 박',
  psychology:'오슬우 심리학',repeat:'삼수를각오한최규원'};
const START={campus:100,meteor:150,arcana:72,psychology:85,repeat:125};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function restore(){
  let input={};
  try{input=JSON.parse(localStorage.getItem(KEY)||'null')||{};}catch(_){}
  const prices={},history={};
  for(const id of Object.keys(ASSETS)){
    const raw=Number(input.prices?.[id]);
    prices[id]=Number.isFinite(raw)?clamp(raw,.01,1e7):START[id];
    history[id]=Array.isArray(input.history?.[id])?
      input.history[id].filter(v=>Number.isFinite(v)&&v>0).slice(-24):[];
    if(!history[id].length)history[id]=[prices[id]];
  }
  let position=null;
  const p=input.position;
  if(p&&ASSETS[p.asset]&&Number.isFinite(p.entry)&&p.entry>0&&
      Number.isInteger(p.margin)&&p.margin>=10&&p.margin<=1e9&&[1,5].includes(p.leverage))
    position={asset:p.asset,entry:p.entry,margin:p.margin,leverage:p.leverage};
  return {prices,history,position,
    mined:clamp(Math.floor(Number(input.mined)||0),0,1e10),
    taps:clamp(Math.floor(Number(input.taps)||0),0,1e10),
    lastTick:Number.isFinite(input.lastTick)?Math.max(0,input.lastTick):0};
}
const state=restore();
let selected='campus',lastMineAt=-Infinity;
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));return true;}
  catch(_){return false;}
}
const idEl=id=>document.getElementById(id);
const message=(id,value)=>{const el=idEl(id);if(el)el.textContent=value;};
const balance=()=>typeof coins==='number'?coins:0;
function roundPrice(n){return Math.round(n*100)/100;}
function tickMarket(rng=Math.random){
  state.lastTick=Date.now();
  for(const id of Object.keys(ASSETS)){
    // Volatility is intentionally fictional. Occasional +/-20-30% shocks
    // make leverage lose MORE than its initial collateral after several ticks.
    const rare=rng()<.15;
    const change=rare?(rng()<.5?-1:1)*(.19+rng()*.11):(rng()-.5)*.14;
    const newPrice=roundPrice(clamp(state.prices[id]*(1+change),.01,1e7));
    state.prices[id]=newPrice;
    state.history[id].push(newPrice);
    if(state.history[id].length>24)state.history[id].shift();
  }
  save();refresh();
  return state.prices[selected];
}
function openPosition(asset,amount,leverage){
  if(state.position){message('market-status','먼저 기존 포지션을 청산해 주세요.');return false;}
  const margin=Number(amount),lv=Number(leverage);
  if(!ASSETS[asset]||!Number.isInteger(margin)||margin<10||margin>1e7||![1,5].includes(lv)){
    message('market-status','투자 원금은 10~10,000,000 G 정수로, 레버리지는 1배 또는 5배로 선택하세요.');
    return false;
  }
  if(balance()<margin){
    message('market-status','투자 원금이 부족합니다. 포인트 광산에서 채굴할 수 있습니다.');
    return false;
  }
  coins-=margin;
  state.position={asset,entry:state.prices[asset],margin,leverage:lv};
  save();global.saveEconomyState?.();
  if(typeof renderEconomyUI==='function')renderEconomyUI();
  refresh();message('market-status',ASSETS[asset]+' '+lv+'배 투자 시작 · 원금 '+formatGold(margin)+' 예치');
  return true;
}
function unrealized(){
  const p=state.position;
  if(!p)return 0;
  const growth=state.prices[p.asset]/p.entry-1;
  return Math.round(p.margin*p.leverage*growth);
}
function closePosition(){
  const p=state.position;
  if(!p){message('market-status','청산할 포지션이 없습니다.');return null;}
  const profit=unrealized();
  const payout=p.margin+profit;
  // No artificial stop-out: deliberate 5x losses can make wallet negative.
  coins=clamp(coins+payout,-1e9,1e9);
  state.position=null;save();global.saveEconomyState?.();
  if(typeof renderEconomyUI==='function')renderEconomyUI();
  refresh();
  message('market-status',ASSETS[p.asset]+' 청산 · 손익 '+formatGold(profit)+
    ' · 반환 '+formatGold(payout)+(balance()<0?' · 광산에서 부채를 갚으세요.':''));
  return {profit,payout,balance:balance()};
}
function mine(now=Date.now()){
  // Filter accidental double-taps while allowing sustained fast tapping.
  if(now-lastMineAt<60)return false;
  lastMineAt=now;
  coins=clamp(coins+2,-1e9,1e9);
  state.taps++;state.mined+=2;
  save();global.saveEconomyState?.();
  if(typeof renderEconomyUI==='function')renderEconomyUI();
  refresh();
  message('mine-status',balance()<0?
    '2 G 채굴 · 남은 빚 '+formatGold(-balance()):
    '2 G 채굴 완료 · 총 '+formatGold(state.mined)+' 채굴!');
  return true;
}
function graph(){
  const svg=idEl('market-history');if(!svg)return;
  const data=state.history[selected].slice(-24);
  const low=Math.min(...data),high=Math.max(...data);
  const span=high-low||Math.max(1,high*.05);
  const pts=data.map((v,i)=>{
    const x=8+i*304/Math.max(1,data.length-1);
    const y=79-(v-low)/span*64;
    return x.toFixed(1)+','+y.toFixed(1);
  }).join(' ');
  // Only numeric points from clamped local state enter the SVG.
  svg.innerHTML='<path d="M 6 80 H 314" stroke="#54606b" stroke-width="1" opacity=".6"/>'+
    '<polyline points="'+pts+'" stroke="#aee5b0" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
}
function refresh(){
  message('finance-wallet',formatGold(balance()));
  message('mine-total',formatGold(state.mined));
  const prices=state.history[selected];
  const current=state.prices[selected],previous=prices.length>1?prices[prices.length-2]:current;
  message('market-price',current.toFixed(2)+' G');
  const percent=previous?(current/previous-1)*100:0;
  const change=idEl('market-change');
  if(change){change.textContent=(percent>=0?'+':'')+percent.toFixed(2)+'%';change.dataset.direction=percent>=0?'up':'down';}
  const p=state.position;
  message('market-position',p?
    '보유 '+ASSETS[p.asset]+' · '+p.leverage+'배 · 원금 '+formatGold(p.margin)+
    ' · 평가손익 '+formatGold(unrealized())+' · 청산 후 '+formatGold(p.margin+unrealized()):
    '열려 있는 포지션 없음');
  const open=idEl('market-open'),close=idEl('market-close');
  if(open)open.disabled=!!p||balance()<10;
  if(close)close.disabled=!p;
  graph();
}
idEl('market-asset')?.addEventListener('change',e=>{if(ASSETS[e.target.value])selected=e.target.value;refresh();});
idEl('market-open')?.addEventListener('click',()=>openPosition(idEl('market-asset')?.value,
  Number(idEl('market-margin')?.value),Number(idEl('market-leverage')?.value)));
idEl('market-close')?.addEventListener('click',()=>closePosition());
// One market clock for all five assets. Browser timers may be throttled in
// background tabs; resume one fresh tick on visibility return, not hundreds.
if(typeof global.setInterval==='function')
  global.setInterval(()=>{if(!document.hidden)tickMarket();},TICK_MS);
document.addEventListener?.('visibilitychange',()=>{
  if(!document.hidden&&Date.now()-state.lastTick>=TICK_MS)tickMarket();
});
idEl('mine-hit')?.addEventListener('click',()=>mine());
refresh();
global.PointMarket={openPosition,closePosition,tickMarket,mine,refresh,unrealized,assets:ASSETS,tickMs:TICK_MS,
  getState:()=>JSON.parse(JSON.stringify(state))};
})(window);
