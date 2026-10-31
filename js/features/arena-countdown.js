/* Shared cinematic ready countdown.
 * Countdown advances in wall-clock milliseconds, independently of arena speed,
 * and never mutates combat actors. The existing game loops drive tick().
 * Local pause freezes it; remote PvP uses host-reported time remaining.
 */
(function(global){
'use strict';
const TOTAL=Math.round(3600/1.3),READY=Math.round(3000/1.3);
let phase='idle',last=0,remaining=TOTAL,root=null,container=null,label=null,subtitle=null,token=0;
const clock=()=>typeof global.performance?.now==='function'?global.performance.now():Date.now();
function render(){
 if(!root)return;
 if(phase==='idle'){root.hidden=true;return;}
 root.hidden=false;
 const next=remaining>Math.round(2600/1.3)?'3':remaining>Math.round(1600/1.3)?'2':remaining>Math.round(600/1.3)?'1':'FIGHT!';
 if(root.dataset.step!==next){
   root.dataset.step=next;
   if(label)label.textContent=next;
   if(subtitle)subtitle.textContent=next==='FIGHT!'?'결전 시작':'전투 준비';
   root.classList.remove('arena-countdown-pop');
   // Reflow a single node only when the number changes; there is no extra RAF.
   void root.offsetWidth;
   root.classList.add('arena-countdown-pop');
 }
 root.dataset.phase=phase;
}
function attach(target){
 if(!target?.appendChild)return;
 if(container===target&&root)return;
 root?.remove?.();
 container=target;
 root=global.document?.createElement?.('div');
 if(!root)return;
 root.className='arena-countdown';
 root.hidden=true;
 root.setAttribute('role','status');
 root.setAttribute('aria-label','전투 시작 카운트다운');
 root.setAttribute('aria-live','off');
 root.innerHTML='<div class="arena-countdown-ring" aria-hidden="true"></div>'
 +'<div class="arena-countdown-content"><span class="arena-countdown-kicker">ARENA / READY</span>'
 +'<strong class="arena-countdown-number">3</strong>'
 +'<span class="arena-countdown-subtitle">전투 준비</span></div>';
 label=root.querySelector('.arena-countdown-number');
 subtitle=root.querySelector('.arena-countdown-subtitle');
 target.appendChild(root);
}
function start(target,at=clock()){
 attach(target);
 remaining=TOTAL;last=at;phase='running';token++;render();
 return token;
}
function pause(at=clock()){
 if(phase!=='running')return;
 remaining=Math.max(0,remaining-Math.max(0,at-last));
 last=at;phase='paused';render();
}
function resume(at=clock()){
 if(phase!=='paused')return;
 last=at;phase='running';render();
}
function cancel(){
 phase='idle';remaining=TOTAL;last=0;token++;render();
}
function tick(at=clock()){
 // Remote spectators drive their own overlay and never block the local engine.
 if(phase==='idle'||phase==='remote')return false;
 if(phase==='paused')return true;
 const delta=Math.max(0,at-last);
 remaining=Math.max(0,remaining-delta);
 last=at;
 if(!remaining){cancel();return false;}
 render();return true;
}
// Online mode: host publishes remainingMs; only correction >0.65s is applied.
// Until a real host-ready state arrives, the guest must not fake a countdown.
function syncRemote(target,remainingMs,at=clock()){
 if(!(remainingMs>0)){if(phase==='remote')cancel();return;}
 attach(target);
 const requested=Math.max(0,Math.min(TOTAL,Number(remainingMs)));
 if(phase!=='remote'){
   phase='remote';remaining=requested;last=at;token++;render();return;
 }
 const expected=Math.max(0,remaining-Math.max(0,at-last));
 if(Math.abs(expected-requested)>650)remaining=requested;
 else remaining=expected;
 last=at;render();
}
function progressRemote(at=clock()){
 if(phase!=='remote')return false;
 remaining=Math.max(0,remaining-Math.max(0,at-last));
 last=at;
 if(remaining<=0){cancel();return false;}
 render();return true;
}
global.ArenaCountdown=Object.freeze({
 start,pause,resume,cancel,tick,syncRemote,progressRemote,
 get active(){return phase==='running'||phase==='paused';},
 get isVisible(){return phase!=='idle';},
 get state(){return {phase,remaining,token};},
 TOTAL,READY
});
})(globalThis);
