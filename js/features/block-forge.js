/* Block-based fighter abilities: the same validated SkillForge recipe powers UI and combat.
 * Connective blocks explicitly select simultaneous, chained, delayed or independent skills.
 * Mouse dragging is optional; all moves have click/keyboard/mobile alternatives. */
(function(global){
'use strict';
const forge=global.SkillForge;
if(!forge)return;
const TYPES=forge.TYPE,THEMES=forge.THEMES,TRIGGER=forge.TRIGGER,STATUS=forge.STATUS;
const LINKS={and:'하고 · 이어서',after:'한 뒤 · 순차',with:'와/과 동시에',separate:'별도 스킬로 분리'};
const CONDITIONS=global.SignatureProgram?.CONDITIONS||{always:'항상 실행'};
const TARGETS=global.AbilityAtlas?.TARGETS||{nearest:'가장 가까운 적',farthest:'가장 먼 적',lowest:'체력이 낮은 적',highest:'체력이 높은 적',random:'무작위 적'};
const GROUPS=global.ActionRegistry?.GROUPS||{
  attacks:{name:'공격',types:['wave','shot','beam','bolt','slash','spinslash','thrust','aircombo','arcshot','splitshot','uppercut','nova','chain','meteor','starfall','dung','dive','flight','burrow','burrowdash','erupt']},
  mobility:{name:'이동 · 피해 없음',types:['dash','blink','leap','hover','glide','swap','retreat','portal']},
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
  const signature=d.signatureVersion===1,limit=signature?12:3;
  const i=Number(op.skill),j=Number(op.index);
  switch(op.kind){
    case 'migrate-signature':return clone(global.SignatureProgram.migrate(d));
    case 'restore-legacy':return clone(global.SignatureProgram.restore(d));
    case 'condition':{
      if(!signature||!idOk(skills,i)||!idOk(skills[i].actions,j))throw Error('조건 블록을 찾지 못했습니다.');
      skills[i].actions[j].condition=global.SignatureProgram.validCondition(op.value);break;
    }
    case 'enable':
      d.allAbilities=false;break;
    case 'add':{
      if(!TYPES[op.type])throw Error('등록할 수 없는 동작입니다.');
      if(!idOk(skills,i))throw Error('먼저 스킬을 선택하세요.');
      if(skills[i].actions.length>=limit)throw Error('고유 스킬에는 행동 블록을 최대 '+limit+'개 연결할 수 있습니다.');
      const at=Number.isInteger(Number(op.at))?Math.max(0,Math.min(skills[i].actions.length,Number(op.at))):skills[i].actions.length;
      skills[i].actions.splice(at,0,action(op.type));
      if(at===0)skills[i].actions[0].link='and';
      break;
    }
    case 'new-skill':
      if(signature)throw Error('고유 스킬은 한 개만 만들 수 있습니다. 행동 블록을 추가하세요.');
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
      if(op.value==='separate'){
        if(signature)throw Error('고유 스킬은 분리할 수 없습니다.');
        return modify(d,{kind:'split',skill:i,index:j});
      }
      if(!allowedLinks.has(op.value))throw Error('연결 방식을 선택해 주세요.');
      skills[i].actions[j].link=op.value;break;
    }
    case 'split':{
      if(signature)throw Error('한 개의 고유 스킬 안에서 연결 방식을 선택하세요.');
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
      if(!forge.supportedParameter(skills[i].actions[j].type,op.key))throw Error('이 동작에서 지원하지 않는 설정입니다.');
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
let selectedSkill=0,selectedAction=0,inspectorOpen=false,filter='attacks',root=null,status=null,workspace=null,movePicker=null;
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
    const after=modify(readDraft(),op);
    if(op.kind==='new-skill'||op.kind==='split'||op.kind==='add')selectedAction=0;
    if(op.kind==='new-skill')selectedSkill=after.skills.length-1;
    else if(op.kind==='split')selectedSkill=Math.min(after.skills.length-1,Number(op.skill)+1);
    else if(op.kind==='merge')selectedSkill=Math.max(0,Number(op.skill)-1);
    else if(op.kind==='add')selectedSkill=Math.min(after.skills.length-1,Number(op.skill));
    else selectedSkill=Math.min(selectedSkill,after.skills.length-1);
    if(op.kind==='add')selectedAction=after.skills[selectedSkill].actions.length-1;
    selectedAction=Math.max(0,Math.min(selectedAction,after.skills[selectedSkill].actions.length-1));
    forge.setDraft(after);
    global.CharacterStudioWorkspace?.refresh?.();
    announce('스킬 초안에 반영했습니다. 캐릭터를 추가하려면 아래 저장 버튼을 누르세요.');
    return true;
  }catch(e){announce(e.message);return false;}
}
// Registry metadata drives the visible shape, type and editable values;
// this inspector edits the *same* validated SkillForge draft as the blocks.
const CATEGORY_ICON={attacks:'⚔',mobility:'➤',defense:'◇',special:'✦'};
const PARAM_META={
  damage:['피해량',0,120,1],radius:['범위',30,300,5],
  count:['개수',1,8,1],speed:['속도',2,14,.5],
  duration:['지속시간(초)',.2,8,.1],knockback:['밀치기',0,9,.5],
  delay:['발동 지연(초)',0,2,.1]
};
const selectValues=key=>key==='target'?TARGETS:
  key==='pattern'?(global.AbilityAtlas?.PATTERNS||{direct:'직접',fan:'부채꼴',ring:'원형'}):
  key==='status'?STATUS:null;
function inspector(skill,i){
  const j=Math.max(0,Math.min(selectedAction,skill.actions.length-1));
  const action=skill.actions[j],entry=global.ActionRegistry?.get(action.type);
  const allowed=['target','pattern','damage','radius','count','speed','duration','status','knockback','delay']
    .filter(key=>forge.supportedParameter(action.type,key));
  const controls=allowed.map(key=>{
    const vals=selectValues(key),m=PARAM_META[key];
    const label=action.type==='charge'&&key==='duration'?'차징 시간(초)':
      m?.[0]||{target:'대상',pattern:'공격 형태',status:'상태이상'}[key]||key;
    const field=vals
      ?'<select data-edit="param" data-skill="'+i+'" data-index="'+j+'" data-key="'+key+'" aria-label="'+label+'">'+options(vals,action[key])+'</select>'
      :'<input type="number" min="'+m[1]+'" max="'+m[2]+'" step="'+m[3]+'" value="'+escape(action[key])+'" data-edit="param" data-skill="'+i+'" data-index="'+j+'" data-key="'+key+'" aria-label="'+label+'">';
    return '<label>'+label+field+'</label>';
  }).join('');
  const typelist=Object.fromEntries(Object.entries(GROUPS).flatMap(([_,g])=>
    g.types.filter(id=>TYPES[id]).map(id=>[id,TYPES[id]])));
  return '<details class="block-action-inspector" aria-label="선택한 동작 직접 설정"'+(inspectorOpen?' open':'')+'>'
    +'<summary class="block-inspector-toggle"><span>⚙ 선택 동작 세부 조정</span><small>'+escape(TYPES[action.type]||'동작')+' · 펼쳐서 수정</small></summary>'
    +'<div class="block-inspector-body">'
    +'<div class="block-inspector-heading"><div><span class="eyebrow">ACTION INSPECTOR · '+(j+1)+' / '+skill.actions.length+'</span>'
    +'<strong>'+(CATEGORY_ICON[entry?.category]||'✧')+' '+escape(TYPES[action.type])+' 세부 설정</strong></div>'
    +'<button type="button" data-op="preview" data-skill="'+i+'" data-index="'+j+'">▶ 이 동작 시연</button></div>'
    +'<div class="block-inspector-grid"><label class="block-inspector-type">동작 변경'
    +'<select data-edit="type" data-skill="'+i+'" data-index="'+j+'" aria-label="선택한 블록 동작 변경">'+options(typelist,action.type)+'</select></label>'
    +controls+'</div>'
    +'<p class="block-inspector-hint">'+(action.type==='charge'?
       '힘을 모으며 떨고 반짝인 뒤 다음 피해 동작 1회가 강화됩니다. 길게 모을수록 위력과 넉백이 증가하지만 공격 전에 무방비로 기다려야 합니다. 다른 차징과 중첩되지 않습니다.':
       entry?.movementOnly?'순수 이동은 피해·상태이상·밀치기를 발생시키지 않습니다.'
      :'수치는 실제 전투에 반영됩니다. 공격 판정과 피해량은 기존 엔진의 설정을 따릅니다.')
    +' · 변경 후 아래에서 캐릭터를 저장하세요.</p></div></details>';
}
function actionRow(a,i,j,count,signature=false){
  const type=TYPES[a.type]||'동작',definition=global.ActionRegistry?.get(a.type);
  const category=definition?.category||'attacks',icon=CATEGORY_ICON[category]||'✧';
  const chosen=i===selectedSkill&&j===selectedAction;
  const stats=definition?.movementOnly?'피해 없음':
    a.type==='charge'?'⚡ '+Number(a.duration)+'초 모으기 → 다음 공격 강화':
    forge.supportedParameter(a.type,'damage')?Number(a.damage)+' 피해':
    category==='defense'?'보호·회복':'특수 동작';
  return (signature?'<div class="signature-condition"><label>만약 · 실행 조건</label><select data-edit="condition" data-skill="'+i+'" data-index="'+j+'" aria-label="'+(j+1)+'번 블록 조건">'+options(CONDITIONS,a.condition||'always')+'</select></div>':'')
    +(j?'<div class="block-quick-link"><span aria-hidden="true">↓</span><select data-edit="link" data-skill="'+i+'" data-index="'+j+'" aria-label="앞 동작과 연결 방식">'+options(signature?{and:LINKS.and,after:LINKS.after,with:LINKS.with}:LINKS,a.link||'and')+'</select></div>':'')
    +'<div class="block-quick-action block-family-'+category+(chosen?' is-inspected':'')+'" style="--block-accent:'+escape(definition?.visual?.color||'#8396ab')+'"'+(signature?' draggable="true" data-draggable-skill="'+i+'" data-draggable-index="'+j+'"':'')+'>'
    +'<button type="button" class="block-quick-inspect" data-op="inspect" data-skill="'+i+'" data-index="'+j+'" aria-pressed="'+String(chosen)+'" aria-label="'+escape(type)+' 세부 능력 편집">'
    +'<span class="block-quick-icon" aria-hidden="true">'+icon+'</span>'
    +'<span class="block-quick-name"><strong>'+escape(type)+'</strong><small>'+escape(stats)+'</small></span></button>'
    +'<div class="block-quick-tools">'
    +'<button type="button" class="block-quick-preview" data-op="preview" data-skill="'+i+'" data-index="'+j+'" aria-label="'+escape(type)+' 동작 미리보기">▶</button>'
    +'<button type="button" data-op="move" data-direction="-1" data-skill="'+i+'" data-index="'+j+'" aria-label="'+escape(type)+' 앞쪽으로 이동" '+(!j?'disabled':'')+'>↑</button>'
    +'<button type="button" data-op="move" data-direction="1" data-skill="'+i+'" data-index="'+j+'" aria-label="'+escape(type)+' 뒤쪽으로 이동" '+(j===count-1?'disabled':'')+'>↓</button>'
    +'<button type="button" data-op="remove" data-skill="'+i+'" data-index="'+j+'" aria-label="'+escape(type)+' 삭제" '+(count===1?'disabled':'')+'>×</button>'
    +'</div></div>';
}
function draw(){
  if(!workspace)return;
  const d=forge.getDraft(),skills=d.skills||[];
  if(!skills.length)return;
  const signature=d.signatureVersion===1;
  selectedSkill=Math.max(0,Math.min(selectedSkill,skills.length-1));
  selectedAction=Math.max(0,Math.min(selectedAction,skills[selectedSkill].actions.length-1));
  const allNotice=d.allAbilities?'<p class="block-quick-note">전체 능력 모드입니다. <button type="button" data-op="enable">일반 스킬 조합으로 전환</button></p>':'';
  const budget=global.ArenaBalance?.summary(d);
  const defense=global.ArenaBalance?.defenseSummary?.(d);
  const example=d.skills.flatMap(s=>s.actions).find(a=>global.ArenaBalance?.actionPressure(a)>0);
  const preview=example?' · 예: '+example.damage+' 입력 피해 → 약 '+Math.round(example.damage*(budget?.multiplier??1))+' 적용':'';
  const balanceNotice=budget?'<div class="block-power-budget" role="status" aria-label="스킬 밸런스">'
    +'<strong>⚖ 스킬 화력 밸런스</strong><span>설계 화력 지수 '+budget.pressure+' / 기준 '+budget.budget+'</span>'
    +'<div class="block-power-meter"><i style="width:'+Math.round(Math.min(100,budget.pressure/budget.budget*100))+'%"></i></div>'
    +'<p>'+(budget.excess?'과도한 화력이 겹쳐 실제 피해가 약 '+budget.percent+'% 적용됩니다.':'기본 피해가 100% 적용됩니다.')
    +preview+'. 설정값은 그대로 저장됩니다. 0.6초 이하 주기 공격은 0.1초마다 보조 이펙트가 재생되지만, 실제 피해·회복은 별도로 계산됩니다. 실제 DPS는 명중률에 따라 달라집니다.</p></div>':'';
  const defensiveNotice=defense&&defense.pressure>0?
    '<div class="block-power-budget" role="status" aria-label="회복·보호 밸런스">'
    +'<strong>🛡 회복·보호 밸런스</strong><span>유지력 지수 '+defense.pressure+' / 기준 '+defense.budget+'</span>'
    +'<p>'+(defense.excess?'회복량·보호막 지속시간·방어 효율에 약 '+defense.percent+'%가 적용됩니다.':'유지력 효과가 100% 적용됩니다.')
    +' 스킬 설정값은 그대로 저장되며, 방어형 조합과 지속 보호막은 계속 사용할 수 있습니다.</p></div>':'';
  const signatureHeader=signature?'<div class="signature-program-intro"><strong>🧩 나만의 고유 스킬 · 1 / 1</strong><p>블록을 원하는 순서로 연결하고, 각 행동 앞에 조건을 넣어 자동전투를 코딩하세요. 조건이 거짓이면 해당 행동은 발동하지 않습니다. 최대 12블록 · 하나의 쿨타임을 공유합니다.</p></div>':'<div class="signature-program-legacy"><strong>기존 캐릭터의 독립 스킬</strong><p>기존 캐릭터는 변함없이 전투합니다. 새 고유 스킬 방식으로 전환하면 행동들을 하나로 합치고 공통 쿨타임을 사용합니다. 저장 전에는 원래 스킬을 복구할 수 있습니다.</p><button type="button" data-op="migrate-signature">고유 스킬 1개로 전환</button></div>';
  workspace.innerHTML=signatureHeader+allNotice+balanceNotice+defensiveNotice+skills.map((s,i)=>
    '<section class="block-quick-skill '+(i===selectedSkill?'is-selected':'')+(signature?' signature-single':'')+'">'
    +'<div class="block-quick-skill-head">'
    +'<button type="button" class="block-quick-select" data-op="select" data-skill="'+i+'" aria-pressed="'+String(i===selectedSkill)+'">'+(i===selectedSkill?'◆ ':'◇ ')+(signature?'고유 스킬':'스킬 '+(i+1))+'</button>'
    +'<input type="text" maxlength="18" data-edit="meta" data-key="name" data-skill="'+i+'" aria-label="스킬 이름" value="'+escape(s.name)+'">'
    +(signature?'':'<button type="button" data-op="remove-skill" data-skill="'+i+'" aria-label="스킬 삭제" '+(skills.length===1?'disabled':'')+'>삭제</button>')+'</div>'
    +'<div class="block-quick-facts"><span>'+escape(TRIGGER[s.trigger]||TRIGGER.auto)+'</span><span>↻ '+escape(s.cooldown)+'초</span><span>'+s.actions.length+'개 동작</span></div>'
    +'<div class="block-quick-stack">'+s.actions.map((a,j)=>actionRow(a,i,j,s.actions.length,signature)).join('')+'</div>'
    +(i===selectedSkill?inspector(s,i):'')
    +'<p class="block-quick-description">'+escape(phrase(s))+'</p>'
    +'<details class="block-quick-settings"><summary>발동 조건 · 쿨타임</summary><div class="block-quick-settings-grid">'
    +'<label>발동<select data-edit="meta" data-key="trigger" data-skill="'+i+'">'+options(TRIGGER,s.trigger)+'</select></label>'
    +'<label>쿨타임(초)<input type="number" min=".2" max="30" step=".1" data-edit="meta" data-key="cooldown" data-skill="'+i+'" value="'+escape(s.cooldown)+'"></label>'
    +(s.trigger==='lowhp'?'<label>HP 조건(%)<input type="number" min="5" max="95" step="5" data-edit="meta" data-key="threshold" data-skill="'+i+'" value="'+escape(s.threshold)+'"></label>':'')
    +'</div></details>'
    +(!signature&&i>0?'<button type="button" class="block-quick-merge" data-op="merge" data-skill="'+i+'" '+(skills[i-1].actions.length+s.actions.length>3?'disabled':'')+'>↑ 이전 스킬과 합치기</button>':'')
    +'</section>').join('')
    +(signature?'<p class="signature-execution">기본 전투 유형은 자동 이동·기본 공격을 맡고, 이 한 개의 고유 스킬이 상황에 따라 반격·이동·방어·공격을 연계합니다.</p>':
      '<button type="button" class="block-quick-new" data-op="new-skill" '+(skills.length>=4?'disabled':'')+'>+ 별도 스킬 만들기 ('+skills.length+'/4)</button>');
}
function refreshTypes(){
  if(!movePicker)return;
  const values=GROUPS[filter]?.types||Object.keys(TYPES);
  movePicker.innerHTML=options(Object.fromEntries(values.filter(type=>TYPES[type]).map(type=>[type,TYPES[type]])),movePicker.value);
}
function mount(){
  const studio=document.querySelector('.forge-studio');
  if(!studio||!document.getElementById('forge-skills'))return;
  root=document.createElement('section');root.className='block-forge block-forge-simple';root.id='block-forge';
  root.setAttribute('aria-label','간단 스킬 조합기');
  root.innerHTML='<div class="block-editor-head"><span class="eyebrow">TACTICAL WORKBENCH / ACTION BUILDER</span><h3>고유 스킬 블록 코딩</h3><p>스크래치처럼 조건과 행동을 연결하세요. 블록은 ↑↓ 버튼으로 재배치하고, 전문가 설정에서 수치를 수정할 수 있습니다.</p></div>'
    +'<div class="block-quick-picker"><label>종류<select class="block-quick-group" aria-label="스킬 계열">'+options(Object.fromEntries(Object.entries(GROUPS).map(([id,g])=>[id,g.name])),filter)+'</select></label>'
    +'<label>동작<select class="block-quick-type" aria-label="추가할 동작"></select></label>'
    +'<button type="button" class="block-quick-add" data-op="add">+ 동작 붙이기</button></div>'
    +'<p class="block-quick-help"><strong>사용 순서</strong> ① 행동 붙이기 → ② 조건 설정 → ③ 순서·동시 실행 설정 → ④ 미리보기 → ⑤ 저장</p>'
    +'<div class="block-workspace" aria-label="스킬 조합 영역"></div>'
    +'<p class="block-status" role="status" aria-live="polite"></p>';
  const target=studio.querySelector('.forge-primary-actions');
  if(target)studio.insertBefore(root,target);else studio.append(root);
  workspace=root.querySelector('.block-workspace');status=root.querySelector('.block-status');
  movePicker=root.querySelector('.block-quick-type');
  refreshTypes();draw();
  root.querySelector('.block-quick-group').addEventListener('change',e=>{filter=e.target.value;refreshTypes();});
  root.addEventListener('click',e=>{
    if(e.target.closest('.block-inspector-toggle')){
      inspectorOpen=!inspectorOpen;
      return;
    }
    const b=e.target.closest('button[data-op]');if(!b||!root.contains(b))return;
    const op=b.dataset.op,si=Number(b.dataset.skill),ai=Number(b.dataset.index);
    if(op==='select'){selectedSkill=si;selectedAction=0;draw();global.CharacterStudioWorkspace?.previewSkill?.(si,-1);return;}
    if(op==='inspect'){selectedSkill=si;selectedAction=ai;inspectorOpen=true;draw();global.CharacterStudioWorkspace?.previewSkill?.(si,ai);return;}
    if(op==='preview'){selectedSkill=si;selectedAction=ai;draw();global.CharacterStudioWorkspace?.previewSkill?.(si,ai);return;}
    if(op==='add'){apply({kind:'add',skill:selectedSkill,type:movePicker.value});global.CharacterStudioWorkspace?.previewSkill?.(selectedSkill,selectedAction);return;}
    if(op==='enable'){apply({kind:'enable'});return;}
    if(op==='migrate-signature'){
      if(typeof global.confirm==='function'&&!global.confirm('기존 4개 스킬을 하나의 고유 스킬로 합치겠습니까? 쿨타임이 하나로 통합됩니다.'))return;
      apply({kind:'migrate-signature'});return;
    }
    if(op==='new-skill'){apply({kind:'new-skill',type:movePicker.value});return;}
    if(op==='remove-skill'){apply({kind:'remove-skill',skill:si});return;}
    if(op==='remove'){apply({kind:'remove',skill:si,index:ai});return;}
    if(op==='merge'){apply({kind:'merge',skill:si});return;}
    if(op==='split'){apply({kind:'split',skill:si,index:ai});return;}
    if(op==='move'){
      const dir=Number(b.dataset.direction);
      apply({kind:'move',fromSkill:si,fromIndex:ai,skill:si,at:ai+(dir<0?-1:2)});
    }
  });
  // Desktop: drag an action block to reorder. The existing up/down buttons
  // provide the same behavior via keyboard, touch screens, and screen readers.
  let dragSource=null;
  const clearDrop=()=>root.querySelectorAll('.signature-drop-target').forEach(n=>n.classList.remove('signature-drop-target'));
  root.addEventListener('dragstart',e=>{
    const item=e.target.closest?.('[data-draggable-index]');
    if(!item||forge.getDraft().signatureVersion!==1)return;
    dragSource={skill:Number(item.dataset.draggableSkill),index:Number(item.dataset.draggableIndex)};
    e.dataTransfer?.setData('text/plain','signature-action');
    if(e.dataTransfer)e.dataTransfer.effectAllowed='move';
  });
  root.addEventListener('dragover',e=>{
    const item=e.target.closest?.('[data-draggable-index]');
    if(!dragSource||!item||Number(item.dataset.draggableSkill)!==dragSource.skill)return;
    e.preventDefault();clearDrop();item.classList.add('signature-drop-target');
  });
  root.addEventListener('drop',e=>{
    const item=e.target.closest?.('[data-draggable-index]');
    if(!dragSource||!item)return;
    e.preventDefault();clearDrop();
    const dest=Number(item.dataset.draggableIndex),src=dragSource;
    dragSource=null;
    if(src.index===dest)return;
    apply({kind:'move',fromSkill:src.skill,fromIndex:src.index,skill:src.skill,at:src.index<dest?dest+1:dest});
  });
  root.addEventListener('dragend',()=>{dragSource=null;clearDrop();});
  root.addEventListener('change',e=>{
    const el=e.target;if(!el.dataset.edit)return;
    const skill=Number(el.dataset.skill),index=Number(el.dataset.index);
    if(el.dataset.edit==='link'){
      // '별도 스킬로 분리' remains an option in the compact connector menu.
      apply({kind:'link',skill,index,value:el.value});
    }else if(el.dataset.edit==='condition')apply({kind:'condition',skill,index,value:el.value});
    else if(el.dataset.edit==='meta')apply({kind:'meta',skill,key:el.dataset.key,value:el.value});
    else if(el.dataset.edit==='type'){selectedSkill=skill;selectedAction=index;apply({kind:'type',skill,index,type:el.value});global.CharacterStudioWorkspace?.previewSkill?.(skill,index);}
    else if(el.dataset.edit==='param'){selectedSkill=skill;selectedAction=index;apply({kind:'param',skill,index,key:el.dataset.key,value:el.value});global.CharacterStudioWorkspace?.previewSkill?.(skill,index);}
  });
}
global.BlockForge={modify,action,josa,phrase,
  inspectSkill:(si,ai=0)=>{const d=forge.getDraft();
    selectedSkill=Math.max(0,Math.min(Number(si)||0,d.skills.length-1));
    selectedAction=Math.max(0,Math.min(Number(ai)||0,d.skills[selectedSkill].actions.length-1));
    inspectorOpen=true;draw();
    global.CharacterStudioWorkspace?.selectPreviewSkill?.(selectedSkill,selectedAction);
  },
  refresh:()=>{refreshTypes();draw();}};
if(typeof document!=='undefined'&&document.querySelector('.forge-studio'))mount();
})(window);
