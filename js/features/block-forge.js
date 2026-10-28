/* Visual, grammar-aware ability blocks. Safe recipes only: no user-authored JavaScript. */
(function(global){
'use strict';
const forge=global.SkillForge;
const studio=document.querySelector('.forge-studio');
if(!forge||!studio)return;
const TYPES=forge.TYPE, STATUSES=forge.STATUS, TRIGGERS=forge.TRIGGER;
const TARGETS=global.AbilityAtlas?.TARGETS||{nearest:'가장 가까운 적'};
const PATTERNS=global.AbilityAtlas?.PATTERNS||{direct:'직선 집중'};
const GROUPS={
  '공격':['wave','shot','beam','bolt','homing','pierce','boomerang','chain','nova','meteor','starfall','dung','arcshot','splitshot','slash','spinslash','thrust','uppercut','aircombo','dive','erupt'],
  '이동':['dash','blink','swap','retreat','flight','burrow','leap','hover','glide','burrowdash','portal'],
  '방어·회복':['heal','shield','drain','cleanse','haste','regen','fortify','lifebloom','resurrect','rewind'],
  '제어·소환':['pull','orbit','zone','mine','blackhole','timestop','timeburst','wall','summon','turret','trap','grow','shrink']
};
const SELF=new Set(['heal','shield','cleanse','haste','regen','fortify','lifebloom','resurrect','rewind','timeburst','leap','hover','glide','grow','shrink']);
const MODES={after:'한 뒤',together:'와/과 함께',delay:'초 후에'};
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const options=(map,value)=>Object.entries(map).map(([k,v])=>'<option value="'+esc(k)+'"'+(k===value?' selected':'')+'>'+esc(v)+'</option>').join('');
const pad=(skill)=>{
  if(!Array.isArray(skill.links))skill.links=[];
  skill.links=skill.actions.slice(1).map((_,i)=>skill.links[i]||{mode:'after',delay:0});
  return skill;
};
function particle(word,consonant,vowel,rRule=false){
  const chars=Array.from(String(word).trim());
  const code=chars.length?chars[chars.length-1].charCodeAt(0)-0xac00:-1;
  if(code<0||code>11171)return vowel;
  const tail=code%28;
  return tail===0||(rRule&&tail===8)?vowel:consonant;
}
function phrase(a){
  const name=TYPES[a.type]||'동작';
  const target=SELF.has(a.type)?'자신':(TARGETS[a.target]||'가장 가까운 적');
  return target+'에게 '+name+particle(name,'을','를')+' 사용';
}
function describe(s){
  if(!s.actions.length)return '동작을 추가하세요.';
  const actions=s.actions;let sentence=phrase(actions[0]);
  for(let i=1;i<actions.length;i++){
    const link=s.links?.[i-1]||{mode:'after',delay:0};
    if(link.mode==='together')sentence+='하면서 동시에 '+phrase(actions[i]);
    else if(link.mode==='delay')sentence+='하고 '+Number(link.delay||0).toFixed(1)+'초 뒤 '+phrase(actions[i]);
    else sentence+='한 뒤 '+phrase(actions[i]);
  }
  return sentence+'한다.';
}
const createAction=type=>({
  type,pattern:'direct',target:'nearest',damage:18,radius:120,count:1,
  speed:5,duration:1.5,status:'none',knockback:2,delay:0
});
function current(){
  const d=forge.getDraft();
  const byId=id=>document.getElementById(id);
  if(byId('bf-name'))d.name=byId('bf-name').value;
  if(byId('bf-text'))d.blurb=byId('bf-text').value;
  if(byId('forge-color'))d.color=byId('forge-color').value;
  if(byId('forge-effect-color'))d.effectColor=byId('forge-effect-color').value;
  if(byId('forge-hp'))d.hp=Number(byId('forge-hp').value);
  if(byId('forge-speed'))d.speed=Number(byId('forge-speed').value);
  d.skills.forEach(pad);
  return d;
}
let active=0,group='공격',query='',dragFrom=null;
const wrapper=document.createElement('details');
wrapper.className='block-forge';
const summary=document.createElement('summary');
summary.textContent='🧩 블록으로 스킬 직접 만들기';
const help=document.createElement('p');help.className='block-forge-help';
help.textContent='동작 블록을 추가·이동하고 조사와 연결 방식을 골라 기술을 조립하세요. 만든 구성은 저장·출전 시 실제 전투에 반영됩니다.';
const root=document.createElement('div');root.className='block-forge-content';
const feedback=document.createElement('p');
feedback.className='block-forge-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
wrapper.append(summary,help,root,feedback);
const basics=Array.from(studio.children).find(el=>el.tagName==='DETAILS'&&el.querySelector('summary')?.textContent.includes('외형'));
const create=studio.querySelector('.forge-primary-actions');
studio.insertBefore(wrapper,create||basics?.nextSibling||null);
const notify=message=>{feedback.textContent=message;};
function update(fn,message){
  if(current().allAbilities){notify('전체 능력 모드를 해제하고 편집해 주세요.');return;}
  const d=current();d.skills.forEach(pad);
  const ok=fn(d);
  if(ok===false)return;
  forge.setDraft(d);
  render();
  if(message)notify(message);
}
function fields(a,j){
  const aKey=' data-action="'+j+'"';
  const label=(name,key,value,opts)=>{
    if(!forge.supportedParameter(a.type,key))return '';
    const control=opts
      ?'<select data-action-field="'+key+'"'+aKey+'>'+options(opts,value)+'</select>'
      :'<input type="number" data-action-field="'+key+'"'+aKey+' value="'+esc(value)+'" '+({
        damage:'min="0" max="120" step="1"',radius:'min="30" max="300" step="5"',
        count:'min="1" max="8" step="1"',speed:'min="2" max="14" step=".5"',
        duration:'min=".2" max="8" step=".2"',knockback:'min="0" max="9" step=".5"',
        delay:'min="0" max="2" step=".1"'
      }[key]||'')+'>';
    return '<label>'+name+control+'</label>';
  };
  return [
    forge.supportedParameter(a.type,'target')?fieldsForName('대상',a.target,'target',TARGETS,aKey):'',
    forge.supportedParameter(a.type,'status')?fieldsForName('상태',a.status,'status',STATUSES,aKey):'',
    label('위력','damage',a.damage),label('배치','pattern',a.pattern,PATTERNS),
    label('범위','radius',a.radius),label('개수','count',a.count),
    label('속도','speed',a.speed),label('지속 초','duration',a.duration),
    label('넉백','knockback',a.knockback),label('발동 지연','delay',a.delay)
  ].join('');
}
function fieldsForName(title,value,key,map,attrs){
  return '<label>'+title+'<select data-action-field="'+key+'"'+attrs+'>'+options(map,value)+'</select></label>';
}
function actionHtml(a,j,s){
  const title=TYPES[a.type]||'동작';
  const target=SELF.has(a.type)?'자신':(TARGETS[a.target]||'가장 가까운 적');
  return '<article class="block-action" data-drop-index="'+j+'">'
    +'<div class="block-action-head"><button type="button" class="block-grab" draggable="true" data-drag-index="'+j+'" aria-label="'+(j+1)+'번 블록 끌어 이동" title="끌어서 위치 변경">⠿</button>'
    +'<span class="block-order">'+(j+1)+'번 동작</span>'
    +'<div class="block-action-tools"><button type="button" data-command="up" data-index="'+j+'" '+(j===0?'disabled':'')+' aria-label="위로 이동">↑</button>'
    +'<button type="button" data-command="down" data-index="'+j+'" '+(j===s.actions.length-1?'disabled':'')+' aria-label="아래로 이동">↓</button>'
    +'<button type="button" data-command="remove" data-index="'+j+'" '+(s.actions.length===1?'disabled':'')+' aria-label="동작 삭제">×</button></div></div>'
    +'<div class="block-sentence"><span class="block-token block-target">'+esc(target)+'에게</span>'
    +'<select class="block-type-select" data-action-field="type" data-action="'+j+'" aria-label="동작 종류">'+options(TYPES,a.type)+'</select>'
    +'<span class="block-token block-particle">'+particle(title,'을','를')+'</span><span class="block-verb">사용</span></div>'
    +'<details class="block-params"><summary>이 동작의 세부 능력 조절</summary><div class="block-params-grid">'+fields(a,j)+'</div></details>'
    +'</article>';
}
function linkHtml(link,j,s){
  const currentName=TYPES[s.actions[j].type]||'동작';
  const nextName=TYPES[s.actions[j+1].type]||'동작';
  return '<div class="block-join"><span class="block-join-line" aria-hidden="true"></span>'
    +'<span class="block-join-caption">'+esc(currentName)+particle(currentName,'과','와')+' '+esc(nextName)+' 연결</span>'
    +'<select data-link="'+j+'" aria-label="'+(j+1)+'번과 '+(j+2)+'번 동작 연결 방식">'
    +options({'after':'사용한 뒤 (순서대로)','together':'와/과 함께 (동시에)','delay':'지정한 시간 후에'},link.mode||'after')+'</select>'
    +(link.mode==='delay'?'<label class="block-link-delay">간격 <input type="number" data-link-delay="'+j+'" min="0" max="2" step=".1" value="'+esc(link.delay||0)+'">초</label>':'')
    +'<button type="button" data-command="split" data-index="'+j+'" title="이 지점부터 별도 쿨타임을 가진 스킬로 분리">여기서 분리</button>'
    +'</div>';
}
function paletteHtml(){
  const allowed=(GROUPS[group]||[]).filter(t=>TYPES[t]);
  const matching=Object.entries(TYPES).filter(([k,v])=>(!query||v.includes(query)||k.includes(query))&&(!query?allowed.includes(k):true));
  return '<div class="block-palette-items">'+matching.map(([type,name])=>
    '<button class="block-palette-item" type="button" data-add-type="'+esc(type)+'">+ '+esc(name)+'</button>').join('')+
    (!matching.length?'<p class="bf-helper">찾는 동작이 없습니다.</p>':'')+'</div>';
}
function renderPalette(){
  const box=root.querySelector('.block-palette-items');
  if(box){const fragment=document.createElement('div');fragment.innerHTML=paletteHtml();box.replaceWith(fragment.firstElementChild);}
}
function render(){
  if(!wrapper.open)return;
  const d=current();
  active=Math.min(Math.max(0,active),d.skills.length-1);
  const s=pad(d.skills[active]);
  const full=s.actions.length>=3;
  root.innerHTML='<div class="block-skill-tabs" role="group" aria-label="편집할 스킬">'
    +d.skills.map((item,i)=>'<button type="button" class="'+(i===active?'is-active':'')+'" data-skill-tab="'+i+'" aria-pressed="'+(i===active)+'">'+(i+1)+'. '+esc(item.name)+'</button>').join('')
    +'<button type="button" data-command="new-skill" '+(d.skills.length>=4||d.allAbilities?'disabled':'')+'>+ 새 스킬</button></div>'
    +(d.allAbilities?'<p class="bf-helper">전체 능력 사용 설정에서는 개별 편집이 불가능합니다. 스킬 세부 설정에서 일반 편집으로 돌아가 주세요.</p>':''
    +'<div class="block-skill-settings"><label>기술 이름<input type="text" data-skill-field="name" maxlength="18" value="'+esc(s.name)+'"></label>'
    +'<label>발동 조건<select data-skill-field="trigger">'+options(TRIGGERS,s.trigger)+'</select></label>'
    +'<label>독립 쿨타임(초)<input type="number" data-skill-field="cooldown" min=".2" max="30" step=".1" value="'+esc(s.cooldown)+'"></label>'
    +(s.trigger==='lowhp'?'<label>체력 조건(%)<input type="number" data-skill-field="threshold" min="5" max="95" step="5" value="'+esc(s.threshold)+'"></label>':'')
    +'</div><div class="block-workspace"><div class="block-stack">'
    +s.actions.map((a,j)=> (j?linkHtml(s.links[j-1],j-1,s):'')+actionHtml(a,j,s)).join('')
    +'<p class="block-limit">스킬당 최대 3개 동작 · 스킬별 쿨타임 독립</p></div>'
    +'<aside class="block-palette"><strong>동작 블록 추가</strong>'
    +'<div class="block-groups">'+Object.keys(GROUPS).map(k=>'<button type="button" data-group="'+esc(k)+'" class="'+(group===k?'is-active':'')+'">'+esc(k)+'</button>').join('')+'</div>'
    +'<label class="block-search-label">동작 검색<input type="search" data-palette-search placeholder="기술 이름 검색" value="'+esc(query)+'"></label>'
    +paletteHtml()+'<small>블록을 누르면 현재 스킬의 마지막에 붙습니다.</small></aside></div>'
    +'<div class="block-edit-actions"><button type="button" data-command="merge" '+(active>=d.skills.length-1||s.actions.length+(d.skills[active+1]?.actions.length||0)>3?'disabled':'')+'>다음 스킬과 합치기</button>'
    +'<button type="button" data-command="delete-skill" '+(d.skills.length===1?'disabled':'')+'>현재 스킬 삭제</button>'
    +'</div><p class="block-preview-label">조립한 능력 미리보기</p><output class="block-preview">'+esc(describe(s))+'</output>'
    +'<p class="block-semantic-note">‘사용한 뒤’는 차례대로, ‘함께’는 같은 시점에, ‘시간 후’는 지정한 간격으로 실행합니다. 스킬을 분리하면 쿨타임도 따로 계산됩니다. 합치면 앞쪽 스킬 설정을 따릅니다.</p>');
}
wrapper.addEventListener('toggle',()=>{if(wrapper.open)render();});
root.addEventListener('input',e=>{
  if(e.target.matches('[data-palette-search]')){query=e.target.value;renderPalette();}
});
root.addEventListener('change',e=>{
  const el=e.target;
  if(el.dataset.skillField){
    update(d=>{d.skills[active][el.dataset.skillField]=el.type==='number'?Number(el.value):el.value;});
  }else if(el.dataset.actionField!==undefined){
    const j=Number(el.dataset.action),field=el.dataset.actionField;
    update(d=>{d.skills[active].actions[j][field]=el.type==='number'?Number(el.value):el.value;});
  }else if(el.dataset.link!==undefined){
    const j=Number(el.dataset.link);
    update(d=>{d.skills[active].links[j].mode=el.value;},'연결 방식이 실제 전투 실행 순서에 반영됩니다.');
  }else if(el.dataset.linkDelay!==undefined){
    const j=Number(el.dataset.linkDelay);
    update(d=>{d.skills[active].links[j].delay=Number(el.value);});
  }
});
root.addEventListener('click',e=>{
  const el=e.target.closest('button');if(!el)return;
  if(el.dataset.skillTab!==undefined){active=Number(el.dataset.skillTab);render();return;}
  if(el.dataset.group!==undefined){group=el.dataset.group;query='';render();return;}
  if(el.dataset.addType){
    update(d=>{
      const s=d.skills[active];if(s.actions.length>=3){notify('한 스킬에는 동작을 3개까지 붙일 수 있습니다. 새 스킬을 만들거나 분리해 주세요.');return false;}
      pad(s);s.links.push({mode:'after',delay:0});s.actions.push(createAction(el.dataset.addType));
    },'동작 블록을 연결했습니다.');return;
  }
  const cmd=el.dataset.command,j=Number(el.dataset.index);
  if(!cmd)return;
  if(cmd==='new-skill')update(d=>{
    if(d.skills.length>=4)return false;
    d.skills.push({name:'새 스킬',trigger:'auto',cooldown:3,threshold:40,actions:[createAction('shot')],links:[]});
    active=d.skills.length-1;
  },'새 스킬의 쿨타임은 다른 스킬과 독립적입니다.');
  if(cmd==='delete-skill')update(d=>{
    if(d.skills.length<=1)return false;d.skills.splice(active,1);active=Math.min(active,d.skills.length-1);
  },'스킬을 삭제했습니다.');
  if(cmd==='remove')update(d=>{
    const s=d.skills[active];if(s.actions.length<=1)return false;
    s.actions.splice(j,1);s.links.splice(j===0?0:j-1,1);
  },'동작을 분리해 제거했습니다.');
  if(cmd==='up'||cmd==='down')update(d=>{
    const s=d.skills[active],k=cmd==='up'?j-1:j+1;
    if(k<0||k>=s.actions.length)return false;
    [s.actions[j],s.actions[k]]=[s.actions[k],s.actions[j]];
  },'블록 순서를 변경했습니다.');
  if(cmd==='split')update(d=>{
    const s=d.skills[active];
    if(d.skills.length>=4){notify('스킬은 4개까지 만들 수 있습니다.');return false;}
    const tail=s.actions.splice(j+1),tailLinks=s.links.splice(j+1);
    s.links.splice(j);
    const newSkill={name:(TYPES[tail[0].type]||'기술')+' 연계',trigger:s.trigger,cooldown:s.cooldown,threshold:s.threshold,actions:tail,links:tailLinks};
    d.skills.splice(active+1,0,newSkill);
    active++;
  },'분리한 스킬은 고유 쿨타임으로 실행됩니다.');
  if(cmd==='merge')update(d=>{
    const a=d.skills[active],b=d.skills[active+1];
    if(!b||a.actions.length+b.actions.length>3){notify('합치려면 동작의 합이 3개 이하여야 합니다.');return false;}
    a.links=[...a.links,{mode:'after',delay:0},...pad(b).links];
    a.actions.push(...b.actions);d.skills.splice(active+1,1);
  },'스킬을 합쳤습니다. 앞쪽 스킬의 발동 조건과 쿨타임이 적용됩니다.');
});
root.addEventListener('dragstart',e=>{
  const handle=e.target.closest('[data-drag-index]');
  if(!handle)return;
  dragFrom=Number(handle.dataset.dragIndex);
  if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(dragFrom));}
});
root.addEventListener('dragover',e=>{
  if(dragFrom===null||!e.target.closest('[data-drop-index]'))return;
  e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';
});
root.addEventListener('drop',e=>{
  const target=e.target.closest('[data-drop-index]');
  if(!target||dragFrom===null)return;
  e.preventDefault();
  const from=dragFrom,to=Number(target.dataset.dropIndex);dragFrom=null;
  if(from===to)return;
  update(d=>{
    const list=d.skills[active].actions;
    if(from<0||to<0||from>=list.length||to>=list.length)return false;
    list.splice(to,0,list.splice(from,1)[0]);
  },'블록을 새 위치로 옮겼습니다.');
});
root.addEventListener('dragend',()=>{dragFrom=null;});
global.addEventListener('forge:draftchange',()=>{if(wrapper.open)render();});
global.BlockForge={particle,describe,get connectorModes(){return MODES;}};
})(window);
