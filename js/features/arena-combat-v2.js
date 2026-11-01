/* Pinball Combat 2.0.
 * Physical collision-only grades and alternating ricochet combos.
 * Adds bounded energy and a ONE-COMBO, ONE-SIGNATURE damage bonus. No
 * automatic hit damage; never modifies collision impulse or saved profiles.
 * Fixed simulation-clock inputs => equal outcomes at 1x and 100x.
 */
(function(g){'use strict';
const cap=(n,a,b)=>Math.max(a,Math.min(b,n));
const TIMINGS=Object.freeze({instant:'기세 100 즉시 발동',contact:'충전 후 다음 충돌',danger:'위험 패턴 예고 시'});
const WAIT=138,COMBO_GAP=150;
function eligible(p){
 return !!p?.forge&&p.forge.signatureVersion===1&&!p.towerEnemy&&!p.manualTower&&
   g.ArenaScreenRouter?.active!=='pvp';
}
function clock(p){return Number(p?._forgeActionClock)||0;}
function grade(speed){return speed>=7?'perfect':speed>=3.8?'heavy':'normal';}
function signal(p,kind,speed){
 if(!eligible(p)||!(speed>=1.15)||!['wall','bumper','contact'].includes(kind))return false;
 const now=clock(p),prior=p._combat2Combo||null;
 // Genuine momentum-gated collisions only. Within 18 ticks, duplicate
 // overlap/wall loops never multiply the number or celebration.
 if(prior&&now-prior.last<18)return false;
 const continued=prior&&prior.kind!==kind&&now-prior.last<=COMBO_GAP;
 const chain=continued?Math.min(99,prior.chain+1):1;
 const quality=grade(speed);
 const old=prior?.chain||0;
 p._combat2Combo={chain,kind,last:now,quality};
 p._combat2Flash={text:(quality==='perfect'?'완벽 충돌!':quality==='heavy'?'강타!':'반사!')+
   (chain>=2?' · 콤보 ×'+chain:''),until:now+54};
 // Bonus is a reward for a real three-hit route, never an extra attack.
 // Four genuine milestones total can grant 16 energy, one 10% signature
 // bonus (not 10% per hit) and nothing more even with a long combo.
 if(chain>=3&&chain<=12&&chain%3===0){
   p._combat2NextBoost=Math.max(p._combat2NextBoost||1,1.10);
   g.BounceMomentum?.add?.(p,4,'ricochet');
 }
 if(p.playerNum===1){
   if(chain>old&&chain>=2)
     g.BattleFX?.sound?.(chain>=6?'combo-streak':chain>=3?'bounce-combo':'combo-step',
       chain>=6?.62:chain>=3?.54:.35);
   else if(quality==='perfect')g.BattleFX?.sound?.('bounce-perfect',.38);
 }
 ui(p,true);
 return true;
}
function afterEnergy(p,kind,speed,wallKind){
 return signal(p,kind==='contact'?'contact':wallKind==='bumper'?'bumper':'wall',speed);
}
function timing(profile){return Object.hasOwn(TIMINGS,profile?.signatureTiming)?
 profile.signatureTiming:'instant';}
function shouldCast(p,target){
 if(!eligible(p))return true;
 const choice=timing(p.forge);
 if(choice==='instant')return true;
 const now=clock(p),ready=Number.isFinite(p._bounceReadyAt)?p._bounceReadyAt:now;
 if(now-ready>=WAIT)return true; // guaranteed fallback: no softlock
 if(choice==='contact'){
  const evt=p._scratchEvents?.contact;
  return Number.isFinite(evt?.frame)&&evt.frame>ready&&evt.frame<=now;
 }
 return !!g.SignatureProgram?.danger?.(p,target);
}
function onCast(p){
 if(!eligible(p))return;
 p._combat2CastBoost=cap(p._combat2NextBoost||1,1,1.10);
 p._combat2CastUntil=clock(p)+420;
 p._combat2NextBoost=1;
 if(p.playerNum===1)g.BattleFX?.sound?.('signature-launch',.55);
}
function damageFactor(p){
 return eligible(p)&&clock(p)<=Number(p._combat2CastUntil||-1)?
  cap(p._combat2CastBoost||1,1,1.10):1;
}
function reset(){
 const el=g.document?.getElementById?.('arena-combo-status');
 if(el){el.hidden=true;el.dataset.combo='0';}
}
function ensure(){
 const doc=g.document;
 if(!doc?.getElementById||!doc.createElement)return null;
 let el=doc.getElementById('arena-combo-status');
 if(el)return el;
 const top=doc.querySelector?.('.battle-screen .arena-heading');
 if(!top)return null;
 el=doc.createElement('div');
 el.id='arena-combo-status';el.className='arena-combo-status';
 el.setAttribute('role','group');
 el.setAttribute('aria-label','연속 반사 콤보');
 el.setAttribute('aria-live','off');el.hidden=true;
 // Static decorative elements. No text or user data is interpreted as HTML.
 el.innerHTML='<span class="combo-echo" aria-hidden="true">COMBO!</span>'+
   '<span class="combo-caption" aria-hidden="true">연속 반사</span>'+
   '<span class="combo-number" aria-hidden="true">0</span>'+
   '<span class="combo-times" aria-hidden="true">×</span>'+
   '<span class="combo-message" aria-hidden="true"></span>'+
   '<span class="combo-sparks" aria-hidden="true">'+
   '<i></i><i></i><i></i><i></i><i></i><i></i></span>'+
   '<span class="combo-progress" aria-hidden="true"></span>';
 top.append(el);return el;
}
function ui(p,burst=false){
 if(!p||p.playerNum!==1)return;
 const el=ensure();if(!el)return;
 if(!eligible(p)){el.hidden=true;return;}
 const combo=p._combat2Combo,now=clock(p),alive=combo&&now-combo.last<=COMBO_GAP;
 if(!alive){
   if(!el.hidden){el.hidden=true;el.dataset.combo='0';}
   return;
 }
 if(!burst&&now%8!==0)return;
 el.hidden=false;
 const tier=combo.chain>=12?'legend':combo.chain>=8?'epic':combo.chain>=5?'hot':combo.chain>=3?'rise':'base';
 const rank=combo.quality==='perfect'?'완벽 충돌':combo.quality==='heavy'?'강한 충돌':'일반 충돌';
 const bonus=(p._combat2NextBoost||1)>1?' · 다음 필살기 강화 준비':'';
 const caption=el.querySelector?.('.combo-caption'),number=el.querySelector?.('.combo-number'),
   message=el.querySelector?.('.combo-message'),progress=el.querySelector?.('.combo-progress');
 if(caption)caption.textContent='연속 반사';
 if(number)number.textContent=String(combo.chain);
 if(message)message.textContent=rank+bonus;
 if(progress)progress.style.width=Math.max(0,100-(now-combo.last)/COMBO_GAP*100).toFixed(1)+'%';
 el.dataset.tier=tier;
 el.dataset.combo=String(combo.chain);
 el.setAttribute('aria-label','연속 반사 '+combo.chain+'콤보 · '+rank+bonus);
 if(burst){
   // Replaying the motion only on actual accepted collision events prevents
   // animations resetting every frame, even at 100x simulation.
   el.classList?.remove?.('combo-burst');
   void el.offsetWidth;
   el.classList?.add?.('combo-burst');
 }
}
g.ArenaCombatV2=Object.freeze({TIMINGS,WAIT,COMBO_GAP,grade,signal,afterEnergy,
 eligible,timing,shouldCast,onCast,damageFactor,ui,reset});
})(typeof window!=='undefined'?window:globalThis);
