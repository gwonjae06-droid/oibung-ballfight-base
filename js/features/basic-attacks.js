/* Class basic attacks: independent, modest damage while the custom signature
 * skill recharges. The same hit/projectile engine owns damage and collision.
 * Legacy fighters, transient tower enemies and manual fighters are untouched. */
(function(g){
'use strict';
const CONFIG=Object.freeze({
 melee:{name:'근거리형',icon:'⚔️',style:{balanced:'연속 타격',sweep:'넓게 베기',heavy:'강한 일격'},damage:16,frames:88,reach:94,type:'wave',radius:72},
 ranged:{name:'원거리형',icon:'🎯',style:{balanced:'마력탄',homing:'유도탄',pierce:'관통탄',split:'분열탄'},damage:14,frames:108,reach:255,type:'shot',radius:150},
 defense:{name:'방어형',icon:'🛡️',style:{balanced:'묵직한 타격',push:'넉백 타격',shock:'충격파',counter:'방어 반격'},damage:18,frames:132,reach:110,type:'wave',radius:84},
 mobility:{name:'기동형',icon:'💨',style:{balanced:'빠른 찌르기',double:'2연속 공격',lunge:'접근 타격',evade:'회피 강화'},damage:11,frames:70,reach:110,type:'wave',radius:76},
 control:{name:'군중제어형',icon:'❄️',style:{balanced:'둔화 구슬',root:'속박 구슬',spread:'확산 구슬'},damage:11,frames:116,reach:238,type:'shot',radius:150}
});
const EFFECTS=Object.freeze({none:'강한 기본 피해',slow:'약한 둔화',leech:'소량 흡혈'});
const TEMPOS=Object.freeze({fast:'빠르게',balanced:'균형',heavy:'강하게'});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function normalize(raw,role){
 const def=CONFIG[role];if(!def)return null;
 const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 return {style:own(def.style,src.style)?src.style:'balanced',
  effect:own(EFFECTS,src.effect)?src.effect:'none',
  tempo:own(TEMPOS,src.tempo)?src.tempo:'balanced'};
}
function blueprint(role,config){
 const base=CONFIG[role],choice=normalize(config,role);
 if(!base)return null;
 const a={type:base.type,pattern:'direct',target:'nearest',damage:base.damage,
  radius:base.radius,count:1,speed:6,duration:1.2,status:'none',knockback:0,
  link:'and',basicAttack:true,basicLifesteal:false};
 let frames=base.frames,reach=base.reach;
 if(role==='melee'){
  if(choice.style==='sweep'){a.radius=112;a.damage*=.76;frames*=1.18;reach=128;}
  if(choice.style==='heavy'){a.damage*=1.36;frames*=1.36;a.knockback=1.3;}
 }else if(role==='ranged'){
  if(choice.style==='homing'){a.type='homing';a.damage*=.85;frames*=1.1;}
  if(choice.style==='pierce'){a.type='pierce';a.damage*=.84;frames*=1.17;}
  if(choice.style==='split'){a.type='splitshot';a.damage*=.64;frames*=1.25;a.count=3;}
 }else if(role==='defense'){
  if(choice.style==='push'){a.knockback=3;a.damage*=.87;}
  if(choice.style==='shock'){a.radius=126;a.damage*=.72;reach=139;frames*=1.2;}
  if(choice.style==='counter'){a.damage*=.9;}
 }else if(role==='mobility'){
  if(choice.style==='double'){a.damage*=.65;frames*=1.25;}
  if(choice.style==='lunge'){a.radius=95;reach=120;frames*=1.15;}
  if(choice.style==='evade'){a.damage*=.9;frames*=1.18;}
 }else if(role==='control'){
  a.status='ice';a.damage*=.72;
  if(choice.style==='root'){a.status='root';a.damage*=.7;frames*=1.4;}
  if(choice.style==='spread'){a.count=3;a.damage*=.57;frames*=1.32;}
 }
 if(choice.effect==='slow'){a.status='ice';a.damage*=.77;frames*=1.07;}
 if(choice.effect==='leech'){a.basicLifesteal=true;a.damage*=.84;frames*=1.12;}
 if(choice.effect==='none'&&role!=='control')a.damage*=1.04;
 if(choice.tempo==='fast'){a.damage*=.74;frames*=.8;}
 if(choice.tempo==='heavy'){a.damage*=1.27;frames*=1.3;}
 a.damage=Math.max(4,Math.min(28,Math.round(a.damage)));
 frames=Math.max(43,Math.min(220,Math.round(frames)));
 return {action:a,frames,reach,role,style:choice.style,effect:choice.effect,tempo:choice.tempo};
}
function tick(p,target,api){
 if(!p?.forge||p.towerEnemy||p.manualTower||p.hp<=0||!target||target.hp<=0)return false;
 const role=p.forge.archetype,config=p.forge.basicAttack;
 const attack=blueprint(role,config);if(!attack)return false;
 // Update only on normal combat ticks; no bypass through silence/stun/charge.
 if(g.ForgeExpansion?.blocked?.(p)||p.forgeCharge?.phase==='charging')return false;
 const clock=p._basicAttackClock=(p._basicAttackClock??Math.round(attack.frames*.42))+1;
 const pending=p._basicAttackFollowup;
 if(pending&&clock>=pending.at){
  p._basicAttackFollowup=null;
  if(target.hp>0&&Math.hypot(p.x-target.x,p.y-target.y)<=pending.reach+(target.radius||0)){
   api.execute(p,{...pending.action},target);return true;
  }
 }
 if(clock<attack.frames)return false;
 const distance=Math.hypot((p.x||0)-(target.x||0),(p.y||0)-(target.y||0));
 if(distance>attack.reach+(target.radius||0))return false;
 p._basicAttackClock=0;
 const a={...attack.action};
 if(attack.role==='defense'&&attack.style==='counter'){
  const guard=p._scratchEvents?.guard;
  if(guard&&guard.frame>=(Number(p._forgeActionClock)||0)-125){a.damage=Math.min(32,Math.round(a.damage*1.45));}
 }
 if(attack.role==='mobility'&&attack.style==='evade'&&p._forgeDodgeWindow>(p._forgeActionClock||0)){
  a.damage=Math.min(29,Math.round(a.damage*1.4));
 }
 if(attack.role==='mobility'&&attack.style==='lunge'&&distance>70){
  const dx=(target.x-p.x)/(distance||1),dy=(target.y-p.y)/(distance||1);
  p.vx=(p.vx||0)+dx*.7;p.vy=(p.vy||0)+dy*.7;
 }
 api.execute(p,a,target);
 if(attack.role==='mobility'&&attack.style==='double'){
  p._basicAttackFollowup={at:18,action:{...a,damage:Math.max(3,Math.round(a.damage*.75))},reach:attack.reach};
 }
 return true;
}
g.BasicAttacks=Object.freeze({CONFIG,EFFECTS,TEMPOS,normalize,blueprint,tick});
})(typeof window!=='undefined'?window:globalThis);
