/* Runtime sustain reserves and stable ArenaBalance public API.
 * Pure loadout pressure calculations live in arena-balance-formula.js.
 * This file is intentionally stateful only for each fighter's match-scoped
 * healing/shield resource, without touching stored character profiles.
 */
(function(g){'use strict';
const model=g.ArenaBalanceFormula;
if(!model)throw new Error('arena-balance-formula.js must load before arena-balance.js');
const {summary,skillPressure,actionPressure,defenseSummary,defenseSkillPressure,
 POWER_BUDGET:BUDGET,DEFENSE_BUDGET}=model;
const cap=(n,l,h)=>Math.min(h,Math.max(l,n));
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
// A shared resource controls the fraction of time protective shields can be
// kept up. More shield slots do not create more invulnerability resources.
// The refill is measured in simulated frames: 100x speed cannot bypass it.
function shieldCapacity(p){
 const energyDriven=!!g.BounceMomentum?.enabled?.(p);
 const cds=(p?.forge?.skills||[]).filter(s=>(s.actions||[]).some(a=>a.type==='shield'))
   .map(s=>energyDriven?5:Math.max(.2,n(s.cooldown,3)));
 return cap(Math.round(Math.min(8,...(cds.length?cds:[1]))*60*1.1),48,480);
}
function tickShield(p){
 if(!p?.forge||p.towerEnemy)return;
 const capacity=shieldCapacity(p);
 p._forgeShieldEnergy=Math.min(capacity,(Number.isFinite(p._forgeShieldEnergy)?p._forgeShieldEnergy:capacity)+.7);
}
function shieldWindow(p,desired){
 const frames=Math.max(0,Math.round(n(desired)));
 if(!p?.forge||p.towerEnemy)return Math.max(p?.invincible||0,frames);
 const capacity=shieldCapacity(p);
 const available=Number.isFinite(p._forgeShieldEnergy)?p._forgeShieldEnergy:capacity;
 const current=Math.max(0,p.invincible||0);
 const grant=Math.min(frames,current+Math.floor(available));
 p._forgeShieldEnergy=Math.max(0,available-Math.max(0,grant-current));
 return Math.max(current,grant);
}
// Healing has a burst reserve plus a refilling sustained budget. The separate
// loadout multiplier still applies first. Normal heals retain their full impact;
// indefinite 0.2s healing or overlapping flowers draw from the same reserve.
function healingCapacity(p){return Math.max(140,Math.max(1,n(p?.maxHp,250))*.4);}
function tickHealing(p){
 if(!p?.forge||p.towerEnemy)return;
 const cap=healingCapacity(p);
 p._forgeHealingEnergy=Math.min(cap,(Number.isFinite(p._forgeHealingEnergy)?p._forgeHealingEnergy:cap)+Math.max(1,n(p.maxHp,250))*.24/60);
}
function healingWindow(p,desired){
 const amount=Math.max(0,n(desired));
 if(!p?.forge||p.towerEnemy)return amount;
 const cap=healingCapacity(p);
 const available=Number.isFinite(p._forgeHealingEnergy)?p._forgeHealingEnergy:cap;
 const granted=Math.min(amount,Math.max(0,available));
 p._forgeHealingEnergy=Math.max(0,available-granted);
 return granted;
}
function factorOf(p){return !p?.forge||p.towerEnemy?1:summary(p.forge,!!g.BounceMomentum?.enabled?.(p)).multiplier;}
function defenseFactorOf(p){return !p?.forge||p.towerEnemy?1:defenseSummary(p.forge,!!g.BounceMomentum?.enabled?.(p)).multiplier;}
g.ArenaBalance=Object.freeze({summary,skillPressure,actionPressure,factorOf,
 defenseSummary,defenseSkillPressure,defenseFactorOf,tickShield,shieldWindow,shieldCapacity,
 tickHealing,healingWindow,healingCapacity,
 POWER_BUDGET:BUDGET,DEFENSE_BUDGET});
})(typeof window!=='undefined'?window:globalThis);