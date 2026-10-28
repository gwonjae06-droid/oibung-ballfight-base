/* Block-based fighter abilities: the same validated SkillForge recipe powers UI and combat.
 * Connective blocks explicitly select simultaneous, chained, delayed or independent skills.
 * Mouse dragging is optional; all moves have click/keyboard/mobile alternatives. */
(function(global){
'use strict';
const forge=global.SkillForge;
if(!forge)return;
const TYPES=forge.TYPE,THEMES=forge.THEMES,TRIGGER=forge.TRIGGER,STATUS=forge.STATUS;
const LINKS={and:'하고 · 이어서',after:'한 뒤 · 순차',with:'와/과 동시에',separate:'별도 스킬로 분리'};
const TARGETS=global.AbilityAtlas?.TARGETS||{nearest:'가장 가까운 적',farthest:'가장 먼 적',lowest:'체력이 낮은 적',highest:'체력이 높은 적',random:'무작위 적'};
const GROUPS={
  attacks:{name:'공격',types:['wave','shot','beam','bolt','slash','spinslash','thrust','aircombo','arcshot','splitshot','uppercut','nova','chain','meteor','starfall','dung']},
  mobility:{name:'이동',types:['dash','blink','leap','hover','glide','dive','flight','burrow','burrowdash','erupt','swap','retreat','portal']},
  defense:{name:'보호 · 회복',types:['heal','shield','cleanse','regen','fortify','lifebloom','resurrect','haste','rewind']},
  special:{name:'소환 · 제어',types:['orbit','zone','pull','homing','pierce','boomerang','mine','blackhole','drain','timestop','timeburst','summon','turret','trap','wall','grow','shrink']}
};
const allowedLinks=new Set(['and','after','with']);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const idOk=(arr,i)=>Number.isInteger(i)&&i>=0&&i<arr.length;
function josa(word,withFinal,withoutFinal){
  const chars=String(word??'').trim(),last=chars.charCodeAt(chars.length-1);
  const jong=last>=0xAC00&&last<=0xD7A3&&(last-0xAC00)%28!==0;
  return chars+(jong?withFinal:withoutFinal);
}
function action(type){
  if(!TYPES[type])throw Error('지원하지 않는 동작입니다.');
  return {type,pattern:'direct',target:'nearest',damage:18,radius:130,count:1,speed:5,
    duration:1.8,status:'none',knockback:2,delay:0,link:'and'};
}
function clone(profile){return forge.normalize(profile);}
function modify(profile,op){
  const d=clone(profile),skills=d.skills;
  const i=Number(op.skill),j=Number(op.index);
  switch(op.kind){
    case 'enable':
      d.allAbilities=false;break;
    case 'add':{
      if(!TYPES[op.type])throw Error('등록할 수 없는 동작입니다.');
      if(!idOk(skills,i))throw Error('먼저 스킬을 선택하세요.');
      if(skills[i].actions.length>=3)throw Error('스킬 하나에는 동작을 최대 3개 연결할 수 있습니다. 새 스킬을 추가하세요.');
      const at=Number.isInteger(Number(op.at))?Math.max(0,Math.min(skills[i].actions.length,Number(op.at))):skills[i].actions.length;
      skills[i].actions.splice(at,0,action(op.type));
      if(at===0)skills[i].actions[0].link='and';
      break;
    }
    case 'new-skill':
      if(skills.length>=4)throw Error('독립 스킬은 최대 4개까지 만들 수 있습니다.');
      skills.push({name:'새 스킬 '+(skills.length+1),trigger:'auto',cooldown:3,threshold:40,actions:[action(op.type&&TYPES[op.type]?op.type:'wave')]});break;
    case 'remove-skill':
      if(!idOk(skills,i))throw Error('존재하지 않는 스킬입니다.');
      if(skills.length<=1)throw Error('스킬은 적어도 하나 필요합니다.');
      skills.splice(i,1);break;
    case 'remove':
      if(!idOk(skills,i)||!idOk(skills[i].actions,j))throw Error('존재하지 않는 블록입니다.');
      if(skills[i].actions.length===1)throw Error('마지막 블록은 삭제할 수 없습니다. 스킬 자체를 삭제하세요.');
      skills[i].actions.splice(j,1);skills[i].actions[0].link='and';break;
    case 'type':
      if(!TYPES[op.type]||!idOk(skills,i)||!idOk(skills[i].actions,j))throw Error('동작을 확인해 주세요.');
      skills[i].actions[j].type=op.type;break;
    case 'link':{
      if(!idOk(skills,i)||!idOk(skills[i].actions,j)||j===0)throw Error('첫 동작에는 연결사가 없습니다.');
      if(op.value==='separate')return modify(d,{kind:'split',skill:i,index:j});
      if(!allowedLinks.has(op.value))throw Error('연결 방식을 선택해 주세요.');
      skills[i].actions[j].link=op.value;break;
    }
    case 'split':{
      if(!idOk(skills,i)||j<=0||!idOk(skills[i].actions,j))throw Error('분리할 동작을 골라 주세요.');
      if(skills.length>=4)throw Error('독립 스킬은 최대 4개까지 만들 수 있습니다.');
      const separated=skills[i].actions.splice(j);
      separated[0].link='and';
      skills.splice(i+1,0,{name:(skills[i].name+' 후속').slice(0,18),
        trigger:'auto',cooldown:skills[i].cooldown,threshold:40,actions:separated});
      break;
    }
    case 'merge':{
      if(i<=0||!idOk(skills,i))throw Error('합칠 이전 스킬이 없습니다.');
      if(skills[i-1].actions.length+skills[i].actions.length>3)throw Error('합친 스킬의 동작은 3개를 넘길 수 없습니다.');
      skills[i].actions[0].link='and';
      skills[i-1].actions.push(...skills[i].actions);skills.splice(i,1);break;
    }
    case 'move-skill':{
      const target=i+Number(op.direction);
      if(!idOk(skills,i)||!idOk(skills,target))throw Error('이동할 수 없는 위치입니다.');
      const tmp=skills[i];skills[i]=skills[target];skills[target]=tmp;break;
    }
    case 'move':{
      let src=Number(op.fromSkill),from=Number(op.fromIndex),dst=i,at=Number(op.at);
      if(!idOk(skills,src)||!idOk(skills[ src ].actions,from)||!idOk(skills,dst))throw Error('이동할 블록을 찾지 못했습니다.');
      if(!Number.isInteger(at)||at<0||at>skills[dst].actions.length)throw Error('잘못된 블록 위치입니다.');
      if(src===dst){
        const moved=skills[src].actions.splice(from,1)[0];
        if(at>from)at--;
        skills[src].actions.splice(at,0,moved);
        skills[src].actions[0].link='and';
      }else{
        if(skills[dst].actions.length>=3)throw Error('대상 스킬에 블록을 최대 3개만 넣을 수 있습니다.');
        const moved=skills[src].actions.splice(from,1)[0];
        if(!skills[src].actions.length){
          skills.splice(src,1);
          if(dst>src)dst--;
        }else skills[src].actions[0].link='and';
        skills[dst].actions.splice(at,0,moved);
        skills[dst].actions[0].link='and';
      }
      break;
    }
    case 'meta':{
      if(!idOk(skills,i)||!['name','trigger','cooldown','threshold'].includes(op.key))throw Error('잘못된 스킬 설정입니다.');
      skills[i][op.key]=op.value;break;
    }
    case 'param':{
      if(!idOk(skills,i)||!idOk(skills[i].actions,j))throw Error('동작을 찾지 못했습니다.');
      if(!['target','damage','status','radius','pattern','count','speed','duration','knockback','delay'].includes(op.key))
        throw Error('지원되지 않는 동작 설정입니다.');
      skills[i].actions[j][op.key]=op.value;break;
    }
    default:throw Error('지원되지 않는 블록 조작입니다.');
  }
  return clone(d);
}
function phrase(skill){
  const acts=skill.actions||[];
  if(!acts.length)return '연결된 행동이 없습니다.';
  const verb=a=>josa(TYPES[a.type]||'행동','을','를');
  let result=verb(acts[0])+' 사용';
  for(let n=1;n<acts.length;n++){
    const a=acts[n],before=acts[n-1],link=allowedLinks.has(a.link)?a.link:'and';
    if(link==='with')result+=' · '+josa(TYPES[before.type],'과','와')+' '+verb(a)+' 동시에 사용';
    else if(link==='after')result+='한 뒤 → '+verb(a)+' 사용';
    else result+='하고 → '+verb(a)+' 사용';
  }
  return result+' · '+(TRIGGER[skill.trigger]||TRIGGER.auto)+' / '+skill.cooldown+'초 쿨타임';
}
function options(values,selected){return Object.entries(values).map(([key,value])=>
  '<option value="'+escape(key)+'"'+(key===selected?' selected':'')+'>'+escape(value)+'</option>').join('');}
let selectedSkill=0,filter='all',query='',root=null,status=null,palette=null,workspace=null;
function readDraft(){
  const d=forge.getDraft();
  const map={name:'bf-name',blurb:'bf-text',color:'forge-color',
    effectColor:'forge-effect-color',hp:'forge-hp',speed:'forge-speed'};
  for(const [key,id] of Object.entries(map)){
    const field=document.getElementById(id);
    if(field)d[key]=field.type==='number'?Number(field.value):field.value;
  }
  return forge.normalize(d);
}
function announce(msg){if(status)status.textContent=msg;}
function apply(op){
  try{
    const before=readDraft(),after=modify(before,op);
    if(op.kind==='new-skill')selectedSkill=after.skills.length-1;
    else if(op.kind==='split')selectedSkill=Math.min(after.skills.length-1,Number(op.skill)+1);
    else if(op.kind==='merge')selectedSkill=Math.max(0,Number(op.skill)-1);
    else if(op.kind==='move-skill')selectedSkill=Number(op.skill)+Number(op.direction);
    else if(op.kind==='add'||op.kind==='move')selectedSkill=Math.min(after.skills.length-1,Number(op.skill));
    else selectedSkill=Math.min(selectedSkill,after.skills.length-1);
    forge.setDraft(after); // Uses the existing storage/save validation and updates the fine-tuning editor.
    announce('블록 구성이 반영되었습니다. 저장 · 출전 버튼으로 등록하세요.');
    return true;
  }catch(e){announce(e.message);return false;}
}
function makePalette(){
  if(!palette)return;
  const entries=Object.entries(TYPES).filter(([id,name])=>{
    if(filter!=='all' && !(GROUPS[filter]?.types||THEMES[filter]?.types||[]).includes(id))return false;
    return !query||name.toLowerCase().includes(query)||id.includes(query);
  });
  palette.innerHTML=entries.length?entries.map(([id,name])=>
    '<button type="button" class="block-chip" draggable="true" data-pick-type="'+escape(id)+'" data-drag-kind="palette" data-drag-type="'+escape(id)+'" title="누르거나 스킬에 드래그해 추가">'+escape(name)+' <span>＋</span></button>').join(''):
    '<p class="block-empty">찾는 동작이 없습니다.</p>';
}
function blockAction(a,si,ai,total){
  const required=ai>0;
  const link=required?
    '<div class="block-join"><span class="block-join-label">연결</span><select aria-label="앞 동작과의 연결 방식" data-edit="link" data-skill="'+si+'" data-index="'+ai+'">'+options(LINKS,a.link||'and')+'</select></div>':'';
  const fields='<label>대상<select data-edit="param" data-key="target" data-skill="'+si+'" data-index="'+ai+'">'+options(TARGETS,a.target||'nearest')+'</select></label>'+
    '<label>위력<input aria-label="동작 위력" type="number" min="0" max="120" step="1" data-edit="param" data-key="damage" data-skill="'+si+'" data-index="'+ai+'" value="'+escape(a.damage)+'"></label>'+
    '<label>효과<select data-edit="param" data-key="status" data-skill="'+si+'" data-index="'+ai+'">'+options(STATUS,a.status||'none')+'</select></label>';
  return link+'<div class="block-drop" data-drop-skill="'+si+'" data-drop-index="'+ai+'" tabindex="0" aria-label="여기에 블록 놓기"></div>'+
    '<article class="block-action" draggable="true" data-drag-kind="action" data-drag-skill="'+si+'" data-drag-index="'+ai+'">'+
      '<div class="block-action-head"><span class="block-action-grip" aria-hidden="true">⠿</span><strong>'+escape(TYPES[a.type])+'</strong>'+
      '<div class="block-action-tools"><button type="button" data-op="move" data-direction="-1" data-skill="'+si+'" data-index="'+ai+'" title="앞으로 이동" aria-label="블록 앞으로 이동" '+(!ai?'disabled':'')+'>↑</button>'+
      '<button type="button" data-op="move" data-direction="1" data-skill="'+si+'" data-index="'+ai+'" title="뒤로 이동" aria-label="블록 뒤로 이동" '+(ai===total-1?'disabled':'')+'>↓</button>'+
      '<button type="button" data-op="split" data-skill="'+si+'" data-index="'+ai+'" '+(!ai?'disabled':'')+' title="여기서부터 별도 스킬">분리</button>'+
      '<button type="button" data-op="remove" data-skill="'+si+'" data-index="'+ai+'" title="블록 제거">×</button></div></div>'+
      '<div class="block-params">'+fields+'</div></article>';
}
function draw(){
  if(!workspace)return;
  const d=forge.getDraft(),skills=d.skills||[];
  if(!skills.length)return;
  selectedSkill=Math.max(0,Math.min(selectedSkill,skills.length-1));
  const allNotice=d.allAbilities?'<div class="block-all-warning">모든 능력 모드입니다. 블록으로 편집하려면 <button type="button" data-op="enable">일반 스킬 편집으로 전환</button>을 누르세요.</div>':'';
  const cards=skills.map((s,i)=>
    '<section class="block-skill '+(i===selectedSkill?'is-active':'')+'" data-card-skill="'+i+'">'+
    '<div class="block-skill-head"><button type="button" class="block-select" data-op="select" data-skill="'+i+'" aria-pressed="'+String(i===selectedSkill)+'">스킬 '+(i+1)+' '+(i===selectedSkill?'●':'○')+'</button>'+
    '<div class="block-skill-tools"><button type="button" data-op="move-skill" data-direction="-1" data-skill="'+i+'" '+(!i?'disabled':'')+' title="스킬 순서 올리기">↑</button>'+
    '<button type="button" data-op="move-skill" data-direction="1" data-skill="'+i+'" '+(i===skills.length-1?'disabled':'')+' title="스킬 순서 내리기">↓</button>'+
    '<button type="button" data-op="merge" data-skill="'+i+'" '+(!i||skills[i-1].actions.length+s.actions.length>3?'disabled':'')+'>이전 스킬과 합치기</button>'+
    '<button type="button" data-op="remove-skill" data-skill="'+i+'" '+(skills.length===1?'disabled':'')+'>삭제</button></div></div>'+
    '<div class="block-meta"><label>스킬 이름<input type="text" maxlength="18" data-edit="meta" data-key="name" data-skill="'+i+'" value="'+escape(s.name)+'"></label>'+
    '<label>발동 조건<select data-edit="meta" data-key="trigger" data-skill="'+i+'">'+options(TRIGGER,s.trigger)+'</select></label>'+
    '<label>쿨타임(초)<input type="number" min=".2" max="30" step=".1" data-edit="meta" data-key="cooldown" data-skill="'+i+'" value="'+escape(s.cooldown)+'"></label>'+
    (s.trigger==='lowhp'?'<label>HP 조건(%)<input type="number" min="5" max="95" data-edit="meta" data-key="threshold" data-skill="'+i+'" value="'+escape(s.threshold)+'"></label>':'')+
    '</div>'+
    '<div class="block-action-stack">'+s.actions.map((a,j)=>blockAction(a,i,j,s.actions.length)).join('')+
      '<div class="block-drop block-drop-last" data-drop-skill="'+i+'" data-drop-index="'+s.actions.length+'" tabindex="0">＋ 여기에 블록 끼우기</div></div>'+
    '<p class="block-grammar" aria-label="동작 조합 미리보기">'+escape(phrase(s))+'</p>'+
    '<div class="block-skill-bottom"><button type="button" data-op="select" data-skill="'+i+'">이 스킬에 추가할 블록 선택</button>'+
      '<span>'+s.actions.length+' / 3개 블록</span></div>'+
    '</section>').join('');
  workspace.innerHTML=allNotice+cards+
    '<button type="button" class="block-new-skill" data-op="new-skill" '+(skills.length>=4?'disabled':'')+'>＋ 독립 스킬 추가 ('+skills.length+'/4)</button>';
}
function mount(){
  const studio=document.querySelector('.forge-studio');
  if(!studio||!document.getElementById('forge-skills'))return;
  root=document.createElement('section');root.className='block-forge';root.id='block-forge';
  root.setAttribute('aria-label','블록 스킬 제작기');
  root.innerHTML='<div class="block-editor-head"><div><span class="eyebrow">ABILITY BLOCK EDITOR</span><h3>블록으로 스킬 조합하기</h3><p>행동을 누르거나 드래그해서 붙이고, <strong>하고 · 한 뒤 · 동시에 · 별도로</strong>를 선택하세요.</p></div></div>'+
    '<div class="block-chooser"><div class="block-chooser-head"><strong>① 행동 블록 고르기</strong><label>검색 <input type="search" class="block-search" placeholder="낙뢰, 회복, 포탈…"></label></div>'+
    '<div class="block-filters" aria-label="행동 계열 필터"></div><div class="block-palette" aria-label="사용 가능한 행동 블록"></div>'+
    '<small>터치: 블록을 눌러 현재 스킬에 추가 · PC: 끌어다 놓기로 이동 및 연결</small></div>'+
    '<div class="block-composer-head"><strong>② 스킬 연결하기</strong><small>최대 4개 독립 스킬 · 스킬당 최대 3개 행동</small></div>'+
    '<div class="block-workspace" aria-label="스킬 조합 영역"></div>'+
    '<div class="block-status" role="status" aria-live="polite"></div>';
  const target=studio.querySelector('.forge-primary-actions');
  if(target)studio.insertBefore(root,target);else studio.append(root);
  palette=root.querySelector('.block-palette');
  workspace=root.querySelector('.block-workspace');
  status=root.querySelector('.block-status');
  const filters=root.querySelector('.block-filters');
  const items=[['all','전체'],...Object.entries(GROUPS).map(([id,g])=>[id,g.name]),...Object.entries(THEMES).map(([id,g])=>[id,g.name])];
  filters.innerHTML=items.map(([id,label])=>'<button type="button" data-filter="'+escape(id)+'" aria-pressed="'+String(id===filter)+'">'+escape(label)+'</button>').join('');
  makePalette();draw();
  root.querySelector('.block-search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();makePalette();});
  filters.addEventListener('click',e=>{
    const b=e.target.closest('button[data-filter]');if(!b)return;
    filter=b.dataset.filter;
    filters.querySelectorAll('button[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    makePalette();
  });
  root.addEventListener('click',e=>{
    const chip=e.target.closest('button[data-pick-type]');
    if(chip){apply({kind:'add',skill:selectedSkill,type:chip.dataset.pickType});return;}
    const b=e.target.closest('button[data-op]');if(!b||!root.contains(b))return;
    const si=Number(b.dataset.skill),ai=Number(b.dataset.index),op=b.dataset.op;
    if(op==='select'){selectedSkill=si;draw();return;}
    if(op==='move'){
      const dir=Number(b.dataset.direction);
      if(apply({kind:'move',fromSkill:si,fromIndex:ai,skill:si,at:ai+(dir<0?-1:2)}))selectedSkill=si;
    }else if(op==='new-skill')apply({kind:'new-skill'});
    else if(op==='enable')apply({kind:'enable'});
    else if(op==='remove-skill')apply({kind:'remove-skill',skill:si});
    else if(op==='move-skill')apply({kind:'move-skill',skill:si,direction:b.dataset.direction});
    else if(op==='split')apply({kind:'split',skill:si,index:ai});
    else if(op==='merge')apply({kind:'merge',skill:si});
    else if(op==='remove')apply({kind:'remove',skill:si,index:ai});
  });
  root.addEventListener('change',e=>{
    const el=e.target;if(!el.dataset.edit)return;
    const skill=Number(el.dataset.skill),index=Number(el.dataset.index);
    if(el.dataset.edit==='link')apply({kind:'link',skill,index,value:el.value});
    else if(el.dataset.edit==='meta')apply({kind:'meta',skill,key:el.dataset.key,value:el.value});
    else if(el.dataset.edit==='param')apply({kind:'param',skill,index,key:el.dataset.key,value:el.value});
  });
  root.addEventListener('dragstart',e=>{
    const b=e.target.closest('[data-drag-kind]');if(!b||!e.dataTransfer)return;
    const payload=b.dataset.dragKind==='palette'?{kind:'palette',type:b.dataset.dragType}:
      {kind:'action',skill:Number(b.dataset.dragSkill),index:Number(b.dataset.dragIndex)};
    e.dataTransfer.effectAllowed=b.dataset.dragKind==='palette'?'copy':'move';
    e.dataTransfer.setData('text/plain',JSON.stringify(payload));
  });
  root.addEventListener('dragover',e=>{
    if(e.target.closest('.block-drop'))e.preventDefault();
  });
  root.addEventListener('drop',e=>{
    const slot=e.target.closest('.block-drop');if(!slot)return;
    e.preventDefault();
    try{
      const raw=e.dataTransfer?.getData('text/plain')||'';
      if(raw.length>250)return;
      const payload=JSON.parse(raw),skill=Number(slot.dataset.dropSkill),at=Number(slot.dataset.dropIndex);
      if(payload.kind==='palette')apply({kind:'add',type:payload.type,skill,at});
      if(payload.kind==='action')apply({kind:'move',fromSkill:payload.skill,fromIndex:payload.index,skill,at});
    }catch(_){announce('이동할 수 없는 블록입니다.');}
  });
  const details=document.getElementById('forge-skills');
  details?.addEventListener('change',()=>draw());
  details?.addEventListener('click',()=>draw());
}
global.BlockForge={modify,action,josa,phrase,refresh:draw};
if(typeof document!=='undefined'&&document.querySelector('.forge-studio'))mount();
})(window);
