/* PvE tower tactical orders. Only alters the tower hero's auto-AI posture;
 * never simulates extra attacks, grants damage, or controls PvP fighters.
 * Uses simulation ticks, so pause/speed controls work naturally. */
(function(g){
'use strict';
const OPTIONS=Object.freeze({
 attack:{name:'슬링샷',hint:'현재 진행 방향으로 한 번 강하게 가속 · 기세 +8',icon:'⚔'},
 evade:{name:'긴급 회피',hint:'현재 이동에 수직으로 튕기며 약 0.35초 피해 방지',icon:'🛡'},
 hold:{name:'앵커',hint:'3초 동안 물리 충돌에 강한 무게 중심 · 짧은 방호',icon:'◎'}
});
const LIMIT=2,DURATION=300;
let used=0,mode='',left=0,host=null;
function state(){return {used,remaining:Math.max(0,LIMIT-used),mode,left};}
function allowed(){return g.ArenaTower?.active&&g.ArenaTower?.stage==='fighting';}
function update(){
 if(!host)return;
 host.hidden=!allowed();
 const status=host.querySelector('[data-tactics-status]');
 if(status)status.textContent='전술 명령 '+Math.max(0,LIMIT-used)+' / '+LIMIT+
   (mode&&left>0?' · '+OPTIONS[mode].name+' '+(left/60).toFixed(1)+'초':' · 명령 대기');
 for(const b of host.querySelectorAll('[data-tactical-order]')){
  b.disabled=!allowed()||used>=LIMIT;
  b.setAttribute('aria-pressed',String(mode===b.dataset.tacticalOrder&&left>0));
 }
}
function mount(){
 if(!g.document)return;
 const parent=g.document.getElementById('tower-arena-slot');
 if(!parent)return;
 host=parent.querySelector('#tower-tactics');
 if(!host){
  host=g.document.createElement('section');
  host.id='tower-tactics';host.className='tower-tactics';
  host.setAttribute('aria-label','자동전투 전술 명령');host.hidden=true;
  const caption=g.document.createElement('div');caption.className='tower-tactics-caption';
  const title=g.document.createElement('strong');title.textContent='전술 지휘';
  const status=g.document.createElement('span');status.dataset.tacticsStatus='';status.setAttribute('role','status');
  caption.append(title,status);host.append(caption);
  const actions=g.document.createElement('div');actions.className='tower-tactics-actions';
  for(const [id,option] of Object.entries(OPTIONS)){
   const b=g.document.createElement('button');b.type='button';b.dataset.tacticalOrder=id;
   b.title=option.hint;b.textContent=option.icon+' '+option.name;actions.append(b);
  }
  host.append(actions);
  host.addEventListener('click',e=>{const button=e.target.closest('[data-tactical-order]');
   if(button)choose(button.dataset.tacticalOrder);});
  parent.prepend(host);
 }
 update();
}
function reset(){used=0;mode='';left=0;update();}
function choose(id){
 if(!allowed()||!OPTIONS[id]||used>=LIMIT)return false;
 const p=g.players?.[0];
 if(p&&p.hp>0&&p.towerHero&&!p.manualTower){
  const vx=Number(p.vx)||0,vy=Number(p.vy)||0,mag=Math.hypot(vx,vy)||1;
  const x=mag>1?vx/mag:1,y=mag>1?vy/mag:0;
  if(id==='attack'){
   const speed=Math.min(9.5,Math.max(4.4,mag*1.38+1));
   p.vx=x*speed;p.vy=y*speed;
   p._pinballReboundHold=Math.max(p._pinballReboundHold||0,25);
   g.BounceMomentum?.add?.(p,8,'tactic');
  }else if(id==='evade'){
   p.vx=Math.max(-9,Math.min(9,(vx||x)*.55-y*4.1));
   p.vy=Math.max(-9,Math.min(9,(vy||y)*.55+x*4.1));
   p.invincible=Math.max(p.invincible||0,21);
   p._pinballReboundHold=Math.max(p._pinballReboundHold||0,21);
  }else{
   p._tacticalAnchorUntil=(Number(p._forgeActionClock)||0)+180;
   p.invincible=Math.max(p.invincible||0,12);
  }
  g.addFloatingText?.(OPTIONS[id].name,p.x,p.y-(p.radius||30)-18,'#e2f5ff',17);
 }
 used++;mode=id;left=DURATION;update();return true;
}
function tick(){
 if(!allowed()||left<=0)return;
 left--;if(!left)mode='';
 if(left%30===0||!left)update();
}
function modeFor(p){return p?.towerHero&&allowed()&&left>0?mode:'';}
g.ArenaTowerTactics=Object.freeze({OPTIONS,LIMIT,DURATION,reset,mount,choose,tick,modeFor,update,get state(){return state();}});
})(typeof window!=='undefined'?window:globalThis);
