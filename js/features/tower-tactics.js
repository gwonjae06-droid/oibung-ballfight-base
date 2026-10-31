/* PvE tower tactical orders. Only alters the tower hero's auto-AI posture;
 * never simulates extra attacks, grants damage, or controls PvP fighters.
 * Uses simulation ticks, so pause/speed controls work naturally. */
(function(g){
'use strict';
const OPTIONS=Object.freeze({
 attack:{name:'집중 공격',hint:'AI가 적에게 접근하며 공격 거리를 적극 확보',icon:'⚔'},
 evade:{name:'위험 회피',hint:'AI가 물러나며 위험 지대를 우선 회피',icon:'🛡'},
 hold:{name:'거리 유지',hint:'AI가 현재 스킬 사거리를 유지하며 측면 이동',icon:'◎'}
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
