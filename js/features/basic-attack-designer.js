/* Child-friendly basic attack modifier cards. Five classes each retain a
 * distinctive automatic attack; all settings persist with forgeData. */
(function(g){
'use strict';
const doc=g.document,forge=g.SkillForge,engine=g.BasicAttacks,S=g.ScratchStudio;
const studio=doc?.querySelector('#character-studio-dialog .forge-studio');
const beginner=studio?.querySelector('#scratch-beginner');
if(!studio||!beginner||!forge||!engine||!S)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=doc.createElement('section');el.id='basic-attack-designer';el.className='basic-attack-designer';
el.setAttribute('aria-label','기본 공격 변형 만들기');
el.innerHTML='<header class="base-head"><div><span class="base-step">나의 첫 번째 기술</span><h3>⚔️ 기본 공격 꾸미기</h3><p>가만히 있어도 자동으로 공격해요. 3가지만 골라서 나만의 전투 방식을 만들어 보세요!</p></div><span class="base-counter">STEP 1 / 2</span></header>'
 +'<section class="base-no-role" hidden>캐릭터의 전투 유형을 고르면 자동 기본 공격을 꾸밀 수 있어요. 이전 방식 캐릭터는 그대로 유지됩니다.</section>'
 +'<div class="base-body"><div class="base-main"><div class="base-role-title"></div>'
 +'<div class="base-choices"><div class="base-choice"><h4>① 어떤 공격 방식이 좋을까?</h4><div class="base-style-options"></div></div>'
 +'<div class="base-choice"><h4>② 특별한 효과는?</h4><div class="base-effect-options"></div></div>'
 +'<div class="base-choice"><h4>③ 빠르게? 강하게?</h4><div class="base-tempo-options"></div></div></div></div>'
 +'<aside class="base-preview"><div class="base-preview-label">완성된 기본 공격</div><div class="base-preview-icon">✨</div>'
 +'<strong class="base-preview-name"></strong><p class="base-preview-hint"></p>'
 +'<div class="base-preview-stats"><span>한 번 피해량 <strong data-base-stat="damage"></strong></span><span>공격 간격 <strong data-base-stat="time"></strong></span><span>공격 범위 <strong data-base-stat="reach"></strong></span></div>'
 +'<p class="base-preview-notice">기본 공격은 자동으로 실행되고, 아래의 고유 스킬은 별도로 작동해요.</p></aside></div>'
 +'<div class="base-bridge">✨ 이제 아래에서 <strong>특별한 필살기</strong>를 만들어 보세요! 기본 공격이 적을 맞힌 후에 발동하는 필살기도 만들 수 있어요.</div>';
beginner.parentNode.insertBefore(el,beginner);
const $=sel=>el.querySelector(sel);
const icon={melee:'⚔️',ranged:'🎯',defense:'🛡️',mobility:'💨',control:'❄️'};
const tradeoff={
 balanced:'공격 유형의 기본 특징을 살려요.',
 sweep:'넓게 공격하지만 한 번의 피해는 줄어들어요.',
 heavy:'강하게 공격하지만 다음 공격까지 오래 걸려요.',
 homing:'적을 따라가지만 한 발의 피해가 줄어요.',
 pierce:'여러 적을 통과하지만 공격이 느려져요.',
 split:'탄환을 나누지만 한 발이 약해져요.',
 push:'적을 밀어내지만 피해는 조금 줄어요.',
 shock:'넓은 충격파를 내지만 공격 간격이 길어져요.',
 counter:'막은 직후에는 더 강한 반격을 해요.',
 double:'두 번 때리지만 한 대의 피해는 작아요.',
 lunge:'조금 다가가 공격하지만 공격 간격이 길어요.',
 evade:'회피 성공 직후 타격이 강해져요.',
 root:'속박시키지만 발사 속도가 느려져요.',
 spread:'여러 구슬을 쏘지만 각각의 피해는 작아요.'
};
let prevRole=null;
function buttons(items,key,selected){
 return Object.entries(items).map(([id,label])=>
  '<button type="button" data-base-'+key+'="'+id+'" aria-pressed="'+String(selected===id)+'"><span>'+esc(label)+'</span><small>'+esc(key==='style'?tradeoff[id]||'':key==='effect'?id==='none'?'피해를 유지해요':id==='slow'?'적을 느리게 하지만 피해가 줄어요':'맞히면 조금 회복하지만 피해가 줄어요':id==='fast'?'자주 때리지만 약해요':id==='heavy'?'강하지만 느려요':'속도와 피해의 균형')+'</small></button>').join('');
}
function refresh(){
 const p=forge.getDraft(),role=p.archetype,base=engine.CONFIG[role];
 $('.base-no-role').hidden=!!base;$('.base-body').hidden=!base;
 $('.base-bridge').hidden=!base;
 if(!base)return;
 const config=engine.normalize(p.basicAttack,role),b=engine.blueprint(role,config);
 $('.base-role-title').innerHTML='<span aria-hidden="true">'+icon[role]+'</span><strong>'+esc(base.name)+' 기본 공격</strong><small>위에서 전투 유형을 바꾸면 공격도 함께 바뀌어요.</small>';
 $('.base-style-options').innerHTML=buttons(base.style,'style',config.style);
 $('.base-effect-options').innerHTML=buttons(engine.EFFECTS,'effect',config.effect);
 $('.base-tempo-options').innerHTML=buttons(engine.TEMPOS,'tempo',config.tempo);
 $('.base-preview-icon').textContent=icon[role];
 $('.base-preview-name').textContent=base.style[config.style]+' · '+engine.EFFECTS[config.effect];
 $('.base-preview-hint').textContent=tradeoff[config.style]||'꾸준하게 상대를 공격해요.';
 $('[data-base-stat="damage"]').textContent=b.action.damage;
 $('[data-base-stat="time"]').textContent=(b.frames/60).toFixed(1)+'초';
 $('[data-base-stat="reach"]').textContent=b.reach;
 prevRole=role;
}
el.addEventListener('click',e=>{
 const button=e.target.closest('button');if(!button)return;
 const key=['style','effect','tempo'].find(k=>button.hasAttribute('data-base-'+k));if(!key)return;
 const role=forge.getDraft().archetype;
 if(!engine.CONFIG[role])return;
 const config=engine.normalize(forge.getDraft().basicAttack,role);
 config[key]=button.getAttribute('data-base-'+key);
 // Mutate only the draft, never an existing saved fighter until Save is pressed.
 forge.setDraft({...forge.getDraft(),basicAttack:config});
 S.render();refresh();
});
const previous=S.onChange;
S.onChange=()=>{previous?.();refresh();};
studio.querySelector('#forge-role-picker')?.addEventListener('click',()=>{g.requestAnimationFrame?.(refresh);});
g.addEventListener?.('studio:open',refresh);
refresh();
g.BasicAttackDesigner={refresh};
})(window);
