/* Beginner-first skill designer, backed entirely by the existing SkillForge
 * and BlockForge. Expert parameters are not duplicated or discarded. */
(function(global){
'use strict';
const forge=global.SkillForge,blocks=global.BlockForge;
if(!forge||!blocks)return;
const PLANS=Object.freeze({
  balanced:{name:'균형형',icon:'⚖️',hint:'공격·보호·원거리·회복을 골고루 사용',skills:[
    ['파동 타격','wave',24,2.5],['긴급 보호','shield',0,5],['원거리 견제','shot',20,3],['응급 회복','heal',30,5]]},
  assault:{name:'공격형',icon:'⚔️',hint:'여러 공격을 연결해 빠르게 승부',skills:[
    ['속사','shot',26,2],['강타','wave',39,3.5],['낙뢰','bolt',31,4],['돌진','dash',0,4]]},
  guardian:{name:'수호형',icon:'🛡️',hint:'보호막·회복을 중심으로 버티기',skills:[
    ['방어막','shield',0,3.5],['자가 회복','heal',35,4],['방어 태세','fortify',0,5],['반격 파동','wave',25,4]]},
  control:{name:'제어형',icon:'❄️',hint:'장판과 상태이상으로 상대 움직임 제한',skills:[
    ['빙결 파동','wave',17,3],['독 장판','zone',15,4],['속박 지뢰','mine',16,5],['집중 낙뢰','bolt',24,4]]},
  agile:{name:'기동형',icon:'💨',hint:'이동과 회피를 활용한 전술',skills:[
    ['순간 이동','blink',0,4],['원거리 공격','shot',22,2.5],['후퇴','retreat',0,4],['회전 구슬','orbit',16,5]]}
});
const QUICK={
  '공격':['wave','shot','bolt','beam','slash','chain','nova','arcshot'],
  '방어·회복':['shield','heal','regen','fortify','cleanse'],
  '이동':['dash','blink','retreat','leap'],
  '특수':['zone','orbit','summon','timestop','trap','blackhole']
};
const E=val=>String(val==null?'':val).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readBasics(){
 const d=forge.getDraft();
 for(const [key,id] of Object.entries({name:'bf-name',blurb:'bf-text',hp:'forge-hp',speed:'forge-speed',
   color:'forge-color',effectColor:'forge-effect-color'})){
   const el=global.document?.getElementById?.(id);
   if(el)d[key]=el.type==='number'?Number(el.value):el.value;
 }
 return d;
}
function presetPlan(kind,profile){
 const p=PLANS[kind];if(!p)throw Error('전투 스타일을 선택하세요.');
 const result={...profile,allAbilities:false,skills:p.skills.map(([name,type,damage,cooldown])=>{
   const a=blocks.action(type);
   a.damage=damage;
   if(type==='shield')a.duration=1.8;
   if(type==='zone'){a.status='poison';a.duration=3;}
   if(type==='mine')a.status='ice';
   if(type==='wave'&&kind==='control')a.status='ice';
   if(type==='regen')a.duration=3;
   if(type==='fortify')a.duration=2;
   return {name,trigger:'auto',cooldown,threshold:40,actions:[a]};
 })};
 return forge.normalize(result);
}
function change(profile,kind,skill,value){
 const si=Number(skill);
 if(kind==='new-skill')return blocks.modify(profile,{kind:'new-skill',type:'wave'});
 if(kind==='remove-skill')return blocks.modify(profile,{kind:'remove-skill',skill:si});
 if(kind==='type')return blocks.modify(profile,{kind:'type',skill:si,index:0,type:value});
 if(['name','trigger','cooldown','threshold'].includes(kind))
   return blocks.modify(profile,{kind:'meta',skill:si,key:kind,value});
 throw Error('설정할 수 없는 항목입니다.');
}
const api={PLANS,presetPlan,change,refresh:()=>{},showAdvanced:()=>{}};
global.StudioEasyDesigner=api;
const doc=global.document;
if(!doc)return;
const view=doc.getElementById('studio-mode-compose');
if(!view||!view.querySelector('.block-forge'))return;
const heading=view.querySelector('.studio-compose-heading'),bar=view.querySelector('.studio-mode-toolbar');
const original=Array.from(view.children).filter(el=>el!==heading&&el!==bar);
const switcher=doc.createElement('div');
switcher.className='studio-easy-tabs';switcher.setAttribute('role','group');
switcher.setAttribute('aria-label','스킬 제작 난이도');
switcher.innerHTML='<button type="button" class="studio-easy-tab" data-designer-mode="simple" aria-pressed="true">✨ 쉬운 설계</button>'
 +'<button type="button" class="studio-easy-tab" data-designer-mode="expert" aria-pressed="false">⚙ 전문가 설정</button>';
const simple=doc.createElement('section');
simple.id='studio-easy-panel';simple.className='studio-easy-panel';
simple.setAttribute('aria-label','쉬운 스킬 설계');
const advanced=doc.createElement('section');
advanced.id='studio-expert-panel';advanced.className='studio-expert-panel';advanced.hidden=true;
advanced.innerHTML='<div class="studio-expert-intro"><strong>⚙ 전문가 설정</strong>'
 +'<p>스킬의 동작 순서·연결사·피해량·범위·발동 지연·상태이상까지 직접 조절합니다. 변경 내용은 쉬운 설계 화면에도 반영됩니다.</p>'
 +'<button type="button" data-designer-mode="simple">← 쉬운 설계로 돌아가기</button></div>';
original.forEach(node=>advanced.append(node));
heading.innerHTML='<h3>나만의 전투 스타일 만들기</h3>'
 +'<p>① 원하는 스타일을 고르고 ② 스킬을 바꿔 본 뒤 ③ 왼쪽에서 움직임을 확인하고 ④ 저장하세요. 복잡한 설정은 전문가 설정에 있습니다.</p>';
view.append(switcher,simple,advanced);
let mode='simple',lastStyle='';
function typeOptions(value){
 let seen=false;
 let html=Object.entries(QUICK).map(([group,types])=>'<optgroup label="'+E(group)+'">'+
   types.filter(type=>forge.TYPE[type]).map(type=>{
    if(type===value)seen=true;
    return '<option value="'+E(type)+'"'+(type===value?' selected':'')+'>'+E(forge.TYPE[type])+'</option>';
   }).join('')+'</optgroup>').join('');
 if(!seen&&forge.TYPE[value])html='<option value="'+E(value)+'" selected>'+E(forge.TYPE[value])+' (세부 설정)</option>'+html;
 return html;
}
function triggerOptions(value){
 return Object.entries(forge.TRIGGER).map(([id,label])=>'<option value="'+E(id)+'"'+(id===value?' selected':'')+'>'+E(label)+'</option>').join('');
}
function makeCard(s,i){
 const a=s.actions[0],extra=s.actions.slice(1).map(v=>forge.TYPE[v.type]||v.type).join(' → ');
 const rest=extra?' · 연결: '+E(extra):'';
 return '<article class="studio-easy-card" aria-label="스킬 '+(i+1)+'">'
   +'<header class="studio-easy-card-head"><span class="studio-easy-number">스킬 '+String(i+1).padStart(2,'0')+'</span>'
   +'<button type="button" data-easy-detail="'+i+'" aria-label="'+E(s.name)+' 모든 수치 자세히 설정">⚙ 세부 조정</button></header>'
   +'<label class="studio-easy-name">스킬 이름<input type="text" maxlength="18" data-easy-key="name" data-skill="'+i+'" value="'+E(s.name)+'"></label>'
   +'<div class="studio-easy-fields">'
   +'<label>어떤 행동을 하나요?<select data-easy-key="type" data-skill="'+i+'">'+typeOptions(a.type)+'</select></label>'
   +'<label>언제 사용하나요?<select data-easy-key="trigger" data-skill="'+i+'">'+triggerOptions(s.trigger)+'</select></label>'
   +'<label>몇 초마다 사용하나요?<span class="studio-easy-unit"><input type="number" min=".2" max="30" step=".1" inputmode="decimal" data-easy-key="cooldown" data-skill="'+i+'" value="'+E(s.cooldown)+'"><span>초</span></span></label>'
   +(s.trigger==='lowhp'?'<label>HP가 몇 % 이하일 때?<input type="number" min="5" max="95" step="5" data-easy-key="threshold" data-skill="'+i+'" value="'+E(s.threshold)+'"></label>':'')
   +'</div><div class="studio-easy-card-footer"><span>'+E(forge.TYPE[a.type]||a.type)+rest
   +' · 총 '+s.actions.length+'개 동작</span>'
   +(i>0?'<button type="button" class="studio-easy-remove" data-easy-remove="'+i+'">스킬 삭제</button>':'')
   +'</div></article>';
}
function refresh(){
 const profile=forge.getDraft(),styles=Object.entries(PLANS).map(([key,p])=>
   '<button type="button" class="studio-easy-preset'+(lastStyle===key?' is-active':'')+'" data-easy-preset="'+key+'" aria-pressed="'+String(lastStyle===key)+'">'
   +'<span aria-hidden="true">'+p.icon+'</span><strong>'+E(p.name)+'</strong><small>'+E(p.hint)+'</small></button>').join('');
 simple.innerHTML='<div class="studio-easy-step"><div class="studio-easy-step-title"><b>1</b>'
   +'<div><h4>전투 스타일 선택 <small>선택 사항</small></h4><p>처음이라면 추천 조합으로 시작하세요. 선택하면 현재 4개 스킬이 교체됩니다.</p></div></div>'
   +'<div class="studio-easy-presets">'+styles+'</div></div>'
   +'<div class="studio-easy-step"><div class="studio-easy-step-title"><b>2</b>'
   +'<div><h4>스킬 설정 <small>'+profile.skills.length+' / 4</small></h4>'
   +'<p>각 스킬의 행동과 사용 시점을 고르세요. 범위·연계·상태이상은 각 스킬의 세부 조정에서 바꿀 수 있습니다.</p></div></div>'
   +(profile.allAbilities?'<p class="studio-easy-all">현재 모든 능력 모드입니다. 전문가 설정에서 일반 스킬 조합으로 변경할 수 있습니다.</p>':'')
   +'<div class="studio-easy-cards">'+profile.skills.map(makeCard).join('')+'</div>'
   +'<button class="studio-easy-add" type="button" data-easy-add'+(profile.skills.length>=4?' disabled':'')+'>+ 스킬 하나 추가 ('+profile.skills.length+'/4)</button></div>'
   +'<div class="studio-easy-step studio-easy-finish"><div class="studio-easy-step-title"><b>3</b>'
   +'<div><h4>움직임 확인하고 저장하기</h4><p>왼쪽 미리보기로 확인한 후 캐릭터 생성·변경 내용 저장 버튼을 누르세요.</p></div></div>'
   +'<div class="studio-easy-finish-actions"><button type="button" data-designer-mode="expert">⚙ 모든 세부 설정 보기</button>'
   +'<button type="button" data-easy-save>저장 버튼으로 이동 ↓</button></div></div>';
}
function selectMode(next){
 mode=next==='expert'?'expert':'simple';
 simple.hidden=mode!=='simple';advanced.hidden=mode!=='expert';
 for(const btn of switcher.querySelectorAll('[data-designer-mode]'))
  btn.setAttribute('aria-pressed',String(btn.dataset.designerMode===mode));
 if(mode==='simple')refresh();
 else blocks.refresh?.();
}
function commit(result){
 forge.setDraft(result);global.CharacterStudioWorkspace?.refresh?.();
 lastStyle='';refresh();
}
switcher.addEventListener('click',e=>{
 const button=e.target.closest('button[data-designer-mode]');
 if(button)selectMode(button.dataset.designerMode);
});
advanced.addEventListener('click',e=>{
 const button=e.target.closest('button[data-designer-mode]');
 if(button)selectMode(button.dataset.designerMode);
});
simple.addEventListener('click',e=>{
 const p=e.target.closest('[data-easy-preset]');
 if(p){
  const current=forge.getDraft();
  if((current.skills.length>1||current.skills[0]?.name!=='새 스킬')&&
     typeof global.confirm==='function'&&!global.confirm('현재 스킬 구성을 선택한 스타일의 4개 스킬로 교체할까요?'))return;
  try{forge.setDraft(presetPlan(p.dataset.easyPreset,readBasics()));lastStyle=p.dataset.easyPreset;
   global.CharacterStudioWorkspace?.refresh?.();refresh();}catch(err){global.alert?.(err.message);}
  return;
 }
 const add=e.target.closest('[data-easy-add]'),remove=e.target.closest('[data-easy-remove]');
 if(add||remove){
  try{commit(change(readBasics(),add?'new-skill':'remove-skill',remove?.dataset.easyRemove,undefined));}
  catch(err){global.alert?.(err.message);}
  return;
 }
 const detail=e.target.closest('[data-easy-detail]');
 if(detail){
  selectMode('expert');
  blocks.inspectSkill?.(Number(detail.dataset.easyDetail),0);
  advanced.scrollIntoView?.({block:'start',behavior:'smooth'});
  return;
 }
 if(e.target.closest('[data-easy-save]')){
  const save=doc.getElementById('bf-create');
  save?.scrollIntoView?.({block:'center',behavior:'smooth'});save?.focus?.({preventScroll:true});
  return;
 }
 if(e.target.closest('[data-designer-mode="expert"]'))selectMode('expert');
});
simple.addEventListener('change',e=>{
 const el=e.target.closest('[data-easy-key]');if(!el)return;
 try{commit(change(readBasics(),el.dataset.easyKey,el.dataset.skill,el.value));}
 catch(err){global.alert?.(err.message);refresh();}
});
api.refresh=()=>{if(mode==='simple')refresh();};
api.showAdvanced=si=>{selectMode('expert');if(Number.isInteger(si))blocks.inspectSkill?.(si,0);};
api.selectMode=selectMode;
selectMode('simple');
})(window);
