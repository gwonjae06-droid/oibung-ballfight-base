/* Pinball Combat 2.0.
 * Physical collision-only grades and alternating ricochet combos.
 * Adds bounded energy and a ONE-COMBO, ONE-SIGNATURE damage bonus. No
 * automatic hit damage; never modifies collision impulse or saved profiles.
 * Fixed simulation-clock inputs => equal outcomes at 1x and 100x.
 */
(function(g){'use strict';
const cap=(n,a,b)=>Math.max(a,Math.min(b,n));
const TIMINGS=Object.freeze({instant:'기세 100 즉시 발동',contact:'충전 후 다음 충돌',danger:'위험 패턴 예고 시'});
const WAIT=138,COMBO_GAP=115;
function eligible(p){
 return !!p?.forge&&p.forge.signatureVersion===1&&!p.towerEnemy&&!p.manualTower&&
   g.ArenaScreenRouter?.active!=='pvp';
}
function clock(p){return Number(p?._forgeActionClock)||0;}
function grade(speed){return speed>=7?'perfect':speed>=3.8?'heavy':'normal';}
function signal(p,kind,speed){
 if(!eligible(p)||!(speed>=1.15)||!['wall','bumper','contact'].includes(kind))return false;
 const now=clock(p),prior=p._combat2Combo||null;
 // The core energy gauge is the primary anti-farm gate. This second
 // independent guard protects combo progress if another callback duplicates.
 if(prior&&now-prior.last<20)return false;
 const chain=prior&&prior.kind!==kind&&now-prior.last<=COMBO_GAP?
  Math.min(4,prior.chain+1):1;
 const quality=grade(speed);
 p._combat2Combo={chain,kind,last:now,quality};
 if(quality==='perfect'&&chain!==3&&p.playerNum===1)g.BattleFX?.sound?.('bounce-perfect',.42);
 p._combat2Flash={text:(quality==='perfect'?'완벽 충돌!':quality==='heavy'?'강타!':'반사!')+
   (chain>=2?' · 콤보 ×'+chain:''),until:now+54};
 if(chain===3){
   // Bonus is capped and spent by a normal 100-energy signature.
   // This does not stack up with rapid repeated collisions.
   p._combat2NextBoost=Math.max(p._combat2NextBoost||1,1.10);
   g.BounceMomentum?.add?.(p,6,'ricochet');
   if(p.playerNum===1)g.BattleFX?.sound?.('bounce-combo',.55);
 }
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
function reset(){const el=g.document?.getElementById?.('arena-combo-status');if(el)el.hidden=true;}
function ui(p){
 const doc=g.document;if(!doc||!p||p.playerNum!==1)return;
 let el=doc.getElementById?.('arena-combo-status');
 if(!el){
  const header=doc.querySelector?.('.battle-screen .arena-heading');
  if(!header||!doc.createElement)return;
  el=doc.createElement('div');el.id='arena-combo-status';el.className='arena-combo-status';
  el.setAttribute('aria-live','off');header.append(el);
 }
 if(!eligible(p)){el.hidden=true;return;}
 if(clock(p)%12!==0)return;
 const combo=p._combat2Combo,now=clock(p);
 if(!combo||now-combo.last>COMBO_GAP){el.hidden=true;return;}
 el.hidden=false;
 const gradeName=combo.quality==='perfect'?'완벽 충돌':combo.quality==='heavy'?'강타':'일반 충돌';
 el.textContent='⚡ '+gradeName+' · 연속 반사 ×'+combo.chain+
  ((p._combat2NextBoost||1)>1?' · 다음 필살기 +10%':'');
}
g.ArenaCombatV2=Object.freeze({TIMINGS,WAIT,COMBO_GAP,grade,signal,afterEnergy,
 eligible,timing,shouldCast,onCast,damageFactor,ui,reset});
})(typeof window!=='undefined'?window:globalThis);
