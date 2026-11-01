/* Five balanced base archetypes for player-authored Forge fighters.
 * Legacy profiles and transient tower enemies retain their original stats. */
(function(g){
'use strict';
const TYPES=Object.freeze({
 melee:Object.freeze({name:'근거리형',icon:'⚔️',hint:'벽에 반사되며 강력한 근접 타격',hp:285,speed:2.35,attack:1.12,received:1,control:1,reach:78}),
 ranged:Object.freeze({name:'원거리형',icon:'🎯',hint:'튀어 다니면서 원거리 투사체 공격',hp:240,speed:1.85,attack:1.10,received:1.04,control:1,reach:185}),
 defense:Object.freeze({name:'방어형',icon:'🛡️',hint:'높은 체력과 피해 감소로 버티기',hp:370,speed:1.35,attack:.87,received:.78,control:1,reach:92}),
 mobility:Object.freeze({name:'기동형',icon:'💨',hint:'빠른 속도로 전장을 튕기며 이동',hp:215,speed:3.2,attack:.94,received:1.07,control:1,reach:130}),
 control:Object.freeze({name:'군중제어형',icon:'❄️',hint:'상태이상으로 적 움직임 제한',hp:255,speed:1.8,attack:.91,received:1,control:1.35,reach:160})
});
const get=id=>Object.prototype.hasOwnProperty.call(TYPES,id)?TYPES[id]:null;
const apply=(value,id)=>{
 const role=get(id);
 return role?{...value,archetype:id,hp:role.hp,speed:role.speed}:{...value,archetype:'legacy'};
};
const attack=p=>p?.towerEnemy?1:get(p?.forge?.archetype)?.attack??1;
const received=p=>p?.towerEnemy?1:get(p?.forge?.archetype)?.received??1;
const control=p=>p?.towerEnemy?1:get(p?.forge?.archetype)?.control??1;
g.ForgeArchetypes=Object.freeze({TYPES,get,apply,attack,received,control});
})(typeof window!=='undefined'?window:globalThis);
