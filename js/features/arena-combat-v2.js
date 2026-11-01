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
let featured=null;
let best=0;
function eligible(p){
 return !!p?.forge&&p.forge.signatureVersion===1&&!p.towerEnemy&&!p.manualTower&&
   g.ArenaScreenRouter?.active!=='pvp';
}
function clock(p){return Number(p?._forgeActionClock)||Number(p?._combat2Tick)||0;}
// Score all visible local automatic PvE fighters, not only signature profiles.
// eligible() remains signature-only: older fighters get spectacle, NOT new damage or energy.
function trackable(p){return !!p&&Number(p.playerNum)>0&&p.hp>0&&!p.towerEnemy&&
 !p.manualTower&&g.ArenaScreenRouter?.active!=='pvp';}
function validSource(kind){return kind==='contact'||kind==='wall'||kind==='bumper'||
 /^wall-(left|right|top|bottom)$/.test(kind)||/^bumper-\d+$/.test(kind);}
function grade(speed){return speed>=7?'perfect':speed>=3.8?'heavy':'normal';}
function signal(p,kind,speed){
 if(!trackable(p)||!(speed>=1.15)||!validSource(kind))return false;
 const now=clock(p),prior=p._combat2Combo||null;
 // Genuine momentum-gated collisions only. Within 18 ticks, duplicate
 // overlap/wall loops never multiply the number or celebration.
 if(prior&&now-prior.last<18)return false;
 const continued=prior&&prior.kind!==kind&&now-prior.last<=COMBO_GAP;
 const chain=continued?Math.min(99,prior.chain+1):1;
 const quality=grade(speed);
 const old=prior?.chain||0;
 p._combat2Combo={chain,kind,last:now,quality};
 // One global HUD shows the strongest live chain; a second fighter's
 // smaller 1-hit bounce must not overwrite a player's existing 3-combo.
 const shown=featured?._combat2Combo;
 if(!featured||!trackable(featured)||!shown||
    clock(featured)-shown.last>COMBO_GAP||chain>shown.chain)featured=p;
 best=Math.max(best,chain);
 p._combat2Flash={text:(quality==='perfect'?'완벽 충돌!':quality==='heavy'?'강타!':'반사!')+
   (chain>=2?' · 콤보 ×'+chain:''),until:now+54};
 // Bonus is a reward for a real three-hit route, never an extra attack.
 // Four genuine milestones total can grant 16 energy, one 10% signature
 // bonus (not 10% per hit) and nothing more even with a long combo.
 if(chain>=3&&[3,5,8,12,20,30,50].includes(chain))
   g.ArenaBattleDirector?.combo?.(p,chain);
 if(eligible(p)&&chain>=3&&chain<=12&&chain%3===0){
   p._combat2NextBoost=Math.max(p._combat2NextBoost||1,1.10);
   g.BounceMomentum?.add?.(p,4,'ricochet');
 }
 if(chain>old&&chain>=2)
     g.BattleFX?.sound?.(chain>=6?'combo-streak':chain>=3?'bounce-combo':'combo-step',
       chain>=6?.62:chain>=3?.54:.35);
 else if(quality==='perfect')g.BattleFX?.sound?.('bounce-perfect',.38);
 ui(p,featured===p);
 return true;
}
function afterEnergy(p,kind,speed,wallKind){
 return signal(p,kind==='contact'?'contact':wallKind||'wall',speed);
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
 featured=null;best=0;
 const el=ensure();if(!el)return;
 el.classList?.remove?.('combo-burst');
 displayZero(el);
}
function ensure(){
 const doc=g.document;
 if(!doc?.getElementById||!doc.createElement)return null;
 let el=doc.getElementById('arena-combo-status');
 if(el)return el;
 // Tower intentionally hides .arena-heading (duplicate title). The combo
 // used to be appended INSIDE that hidden node, so no animation or counter
 // could ever be visible in Tower even while real collision math was correct.
 // Render it as a sibling directly under the shared battle screen instead.
 const screen=doc.querySelector?.('.battle-screen');
 const top=doc.querySelector?.('.battle-screen .arena-heading');
 if(!screen&&!top)return null;
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
 if(screen?.insertBefore){
   // Above commentary / field, never an overlay blocking boss danger zones.
   const anchor=screen.querySelector?.('#arena-commentary')||
     screen.querySelector?.('.canvas-wrapper')||null;
   screen.insertBefore(el,anchor);
 }else if(screen?.prepend){
   screen.prepend(el);
 }else{
   // Minimal DOM shims used in existing engine unit tests.
   top.append(el);
 }
 return el;
}
function displayZero(el){
 el.hidden=false;el.dataset.combo='0';el.dataset.best=String(best);el.dataset.tier='base';
 const number=el.querySelector?.('.combo-number');if(number)number.textContent='0';
 const message=el.querySelector?.('.combo-message');if(message)message.textContent=best>0?'연계 종료 · 최고 '+best+'콤보':'첫 충돌을 기다리는 중';
 const progress=el.querySelector?.('.combo-progress');if(progress)progress.style.width='0%';
 el.setAttribute?.('aria-label','현재 연속 반사 0콤보 · '+(best>0?'최고 '+best+'콤보':'첫 충돌 대기'));
 el.classList?.remove?.('combo-burst');
}
function ui(p,burst=false){
 // The arena has just one top HUD: show the last real PvE fighter to
 // ricochet, instead of silently ignoring every fighter other than P1.
 const actor=featured&&trackable(featured)?featured:p;
 if(!actor||!trackable(actor))return;
 const el=ensure();if(!el)return;
 const combo=actor._combat2Combo,now=clock(actor),alive=combo&&now-combo.last<=COMBO_GAP;
 if(!alive){
   if(el.hidden||el.dataset.combo!=='0')displayZero(el);
   return;
 }
 if(!burst&&now%8!==0)return;
 el.hidden=false;
 const tier=combo.chain>=12?'legend':combo.chain>=8?'epic':combo.chain>=5?'hot':combo.chain>=3?'rise':'base';
 const rank=combo.quality==='perfect'?'완벽 충돌':combo.quality==='heavy'?'강한 충돌':'일반 충돌';
 const bonus=(actor._combat2NextBoost||1)>1?' · 다음 필살기 강화 준비':'';
 const caption=el.querySelector?.('.combo-caption'),number=el.querySelector?.('.combo-number'),
   message=el.querySelector?.('.combo-message'),progress=el.querySelector?.('.combo-progress');
 if(caption)caption.textContent='연속 반사';
 if(number)number.textContent=String(combo.chain);
 if(message)message.textContent='P'+actor.playerNum+' · '+rank+bonus;
 if(progress)progress.style.width=Math.max(0,100-(now-combo.last)/COMBO_GAP*100).toFixed(1)+'%';
 el.dataset.tier=tier;
 el.dataset.combo=String(combo.chain);
 el.dataset.best=String(best);
 el.setAttribute('aria-label','P'+actor.playerNum+' 연속 반사 '+combo.chain+'콤보 · '+rank+bonus);
 if(burst){
   // Replaying the motion only on actual accepted collision events prevents
   // animations resetting every frame, even at 100x simulation.
   el.classList?.remove?.('combo-burst');
   void el.offsetWidth;
   el.classList?.add?.('combo-burst');
 }
}
g.ArenaCombatV2=Object.freeze({TIMINGS,WAIT,COMBO_GAP,grade,signal,afterEnergy,
 eligible,trackable,timing,shouldCast,onCast,damageFactor,ui,reset});
})(typeof window!=='undefined'?window:globalThis);
