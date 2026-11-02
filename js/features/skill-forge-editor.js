/* Forge editor adapter. Owns legacy form/roster DOM only.
 * Skill normalization, persistence and battle execution remain in SkillForge.
 * Inject shared state and actions to avoid duplicate data sources.
 */
(function(global){'use strict';
global.SkillForgeEditorFactory=function({state,normalize,skill,stage,allSkillset,
 supportedParameter,TYPE,TRIGGER,STATUS,MOVEMENT_ONLY,register,remove,persist}){
const escape=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(values,selected)=>Object.entries(values).map(([k,v])=>'<option value="'+k+'"'+(k===selected?' selected':'')+'>'+v+'</option>').join('');
function field(key,value,attrs){
  return '<input data-field="'+key+'" '+attrs+' value="'+escape(value)+'">';
}
function choice(key,values,value,attrs){
  return '<select data-field="'+key+'" '+attrs+'>'+options(values,value)+'</select>';
}
function render(){
  const place=document.getElementById('forge-skills');if(!place)return;
  place.innerHTML=state.draft.allAbilities?
    '<section class="forge-skill"><div class="forge-top"><span>ALL ABILITIES</span></div>'+
    '<p class="forge-physics-note">총 '+allSkillset().length+
    '종류의 능력을 모두 보유합니다. 각 스킬은 별도 타이머로 충전되며 전투 중 순서대로 발동합니다.</p>'+
    '<p class="bf-helper">'+escape(allSkillset().map(s=>s.name).join(' · '))+'</p>'+
    '<button type="button" class="forge-delete" data-command="disable-all">일반 스킬 편집으로 돌아가기</button></section>'
    :state.draft.skills.map((s,i)=>{
    const si='data-skill="'+i+'"';
    const parts=s.actions.map((a,j)=>{
      const aj=si+' data-stage="'+j+'"';
      const box=(title,html,key)=>key&&!supportedParameter(a.type,key)?'':'<label>'+title+html+'</label>';
      return '<section class="forge-action">'
      +'<div class="forge-top"><span>ACTION '+(j+1)+'</span><button type="button" class="forge-delete" data-command="remove-action" '+aj+'>제거</button></div>'
      +'<div class="forge-grid">'
      +(state.draft.signatureVersion===1?'<label>조건 블록'+choice('condition',global.SignatureProgram?.CONDITIONS||{always:'항상 실행'},a.condition||'always',aj)+'</label>':'')
      +box('동작',choice('type',TYPE,a.type,aj))
      +box('공격 배치',choice('pattern',global.AbilityAtlas?.PATTERNS||{direct:'직선 집중'},a.pattern||'direct',aj),'pattern')
      +box('대상 우선순위',choice('target',global.AbilityAtlas?.TARGETS||{nearest:'가장 가까운 적'},a.target||'nearest',aj),'target')
      +box('위력',field('damage',a.damage,'type="number" min="0" max="120" step="1" '+aj),'damage')
      +box('범위',field('radius',a.radius,'type="number" min="30" max="300" step="5" '+aj),'radius')
      +box('개수',field('count',a.count,'type="number" min="1" max="8" step="1" '+aj),'count')
      +box('속도',field('speed',a.speed,'type="number" min="2" max="14" step=".5" '+aj),'speed')
      +box('지속 (초)',field('duration',a.duration,'type="number" min=".2" max="8" step=".2" '+aj),'duration')
      +box('상태이상',choice('status',STATUS,a.status,aj),'status')
      +box('넉백',field('knockback',a.knockback,'type="number" min="0" max="9" step=".5" '+aj),'knockback')
      +box('발동 지연',field('delay',a.delay,'type="number" min="0" max="2" step=".1" '+aj),'delay')
      +'</div>'
      +'<p class="forge-parameter-note">동작에 실제 적용되는 설정만 표시됩니다 · 발동 지연은 모든 동작에 적용</p>'
      +(MOVEMENT_ONLY.has(a.type)?'<p class="forge-physics-note">이동 전용 · 피해·상태이상·넉백 없음. 공격은 별도 공격 블록을 연결하세요.</p>':'')
      +(global.AdvancedCombat?.DESCRIPTIONS?.[a.type]
        ?'<p class="forge-physics-note">'+escape(global.AdvancedCombat.DESCRIPTIONS[a.type])+'</p>':'')
      +'</section>';
    }).join('');
    return '<section class="forge-skill">'
      +'<div class="forge-top"><span>'+(state.draft.signatureVersion===1?'고유 스킬 1 / 1':'SKILL '+String(i+1).padStart(2,'0'))+'</span>'+(state.draft.signatureVersion===1?'':'<button type="button" class="forge-delete" data-command="remove-skill" '+si+'>스킬 삭제</button>')+'</div>'
      +'<label>스킬 이름'+field('name',s.name,si+' maxlength="18"')+'</label>'
      +'<div class="forge-grid">'
      +'<label>발동 조건'+choice('trigger',TRIGGER,s.trigger,si)+'</label>'
      +'<label>쿨타임 (초)'+field('cooldown',s.cooldown,'type="number" min=".2" max="30" step=".1" '+si)+'</label>'
      +(s.trigger==='lowhp'?'<label>HP 조건 (%)'+field('threshold',s.threshold,'type="number" min="5" max="95" step="5" '+si)+'</label>':'')
      +'</div><div class="forge-action-list">'+parts+'</div>'
      +'<button type="button" class="forge-add" data-command="add-action" '+si+' '+(s.actions.length>=(state.draft.signatureVersion===1?12:3)?'disabled':'')+'>+ 행동 블록 연결 ('+s.actions.length+'/'+(state.draft.signatureVersion===1?12:3)+')</button>'
      +'</section>';
  }).join('');
  document.getElementById('forge-add-skill').disabled=state.draft.signatureVersion===1||state.draft.allAbilities||state.draft.skills.length>=4;
  document.getElementById('forge-add-skill').hidden=state.draft.signatureVersion===1;
}
function initializeUI(){
  const panel=document.querySelector('.bf-tools');
  if(!panel)return;
  const detail=Array.from(panel.querySelectorAll('details')).find(d=>d.querySelector('summary')?.textContent.includes('커스텀'));
  if(!detail)return;
  const body=detail.querySelector('.bf-details-body');
  body.innerHTML=''
  +'<p class="bf-helper">캐릭터를 랜덤으로 생성하거나 원하는 계열을 선택하세요. 직접 조정하려면 외형과 스킬 설정을 열어 주세요.</p>'
  +'<div class="forge-grid">'
  +'<label>캐릭터 이름<input id="bf-name" maxlength="14" placeholder="나만의 파이터"></label>'
  +'<label>캐릭터 색상<input id="forge-color" type="color" value="#a78bfa"></label>'
  +'<label>이펙트 색상<input id="forge-effect-color" type="color" value="#a78bfa"></label>'
  +'<label>체력<input id="forge-hp" type="number" min="140" max="500" value="250"></label>'
  +'<label>기본 속도<input id="forge-speed" type="number" min=".6" max="5" step=".1" value="1.8"></label>'
  +'</div>'
  +'<label>캐릭터 설명 (게임 수치와 무관)<textarea id="bf-text" maxlength="90" rows="2" placeholder="캐릭터 설정"></textarea></label>'
  +'<div id="forge-skills" class="forge-skills"></div>'
  +'<button id="forge-add-skill" class="forge-add" type="button">+ 스킬 추가</button>'
  +'<div class="bf-btn-row"><button type="button" id="bf-analyze">능력 미리보기</button><button type="button" id="bf-create">캐릭터 생성</button></div>'
  +'<div id="bf-result" class="bf-result" role="status" aria-live="polite"></div>'
  +'<div id="bf-custom-list" class="bf-custom-list"></div><button id="forge-cancel-edit" type="button" hidden>편집 취소</button>'
  +'<details class="forge-json"><summary>설정 JSON 가져오기 · 내보내기</summary>'
  +'<p class="bf-helper">다른 사람의 설정도 불러올 수 있습니다. 코드는 실행되지 않습니다.</p>'
  +'<textarea id="forge-json-text" rows="4" placeholder="JSON 붙여넣기"></textarea>'
  +'<div class="bf-btn-row"><button type="button" id="forge-export">JSON 내보내기</button><button type="button" id="forge-import">JSON 불러오기</button></div></details>';
  const $=id=>document.getElementById(id);
  function sync(){
    state.draft.name=$('bf-name').value;state.draft.blurb=$('bf-text').value;
    state.draft.color=$('forge-color').value;state.draft.effectColor=$('forge-effect-color').value;state.draft.hp=Number($('forge-hp').value);
    state.draft.speed=Number($('forge-speed').value);
  }
  function refreshBasics(){
    $('bf-name').value=state.draft.name;$('bf-text').value=state.draft.blurb;
    $('forge-color').value=state.draft.color;$('forge-effect-color').value=state.draft.effectColor||state.draft.color;$('forge-hp').value=state.draft.hp;
    $('forge-speed').value=state.draft.speed;
    const fixed=!!global.ForgeArchetypes?.get?.(state.draft.archetype);
    $('forge-hp').readOnly=fixed;$('forge-speed').readOnly=fixed;
    $('forge-hp').title=fixed?'전투 유형에 따라 결정되는 고정 능력치입니다.':'';
    $('forge-speed').title=fixed?'전투 유형에 따라 결정되는 고정 능력치입니다.':'';
    global.CharacterStudioArchetypes?.refresh?.();
  }
  function report(t){$('bf-result').textContent=t;}
  function roster(){
    const target=$('bf-custom-list');if(!target)return;
    const owned=CUSTOM_DEFS.filter(d=>d.forgeData);
    const count=$('forge-custom-count');
    if(count)count.textContent=owned.length+'명 저장됨';
    const search=String($('forge-roster-filter')?.value||'').trim().toLocaleLowerCase();
    const visible=search?owned.filter(d=>d.name.toLocaleLowerCase().includes(search)):owned;
    const result=$('forge-roster-filter-status');
    if(result)result.textContent=search?visible.length+'명 검색됨':'';
    global.CosmeticArcade?.refreshStudio?.();
    target.replaceChildren();
    if(!owned.length){
      const empty=document.createElement('p');empty.className='forge-roster-empty';
      empty.textContent='저장한 캐릭터가 없습니다. 아래에서 캐릭터를 만들어 보세요.';
      target.appendChild(empty);
      return;
    }
    if(!visible.length){
      const empty=document.createElement('p');empty.className='forge-roster-empty';
      empty.textContent='검색 결과가 없습니다. 다른 이름으로 검색해 보세요.';
      target.appendChild(empty);return;
    }
    for(const def of visible){
      const row=document.createElement('div');row.className='forge-saved-row';
      const name=document.createElement('span');name.className='forge-saved-name';name.textContent=def.name;
      const actions=document.createElement('div');actions.className='forge-saved-actions';
      const edit=document.createElement('button');edit.type='button';edit.textContent='✎ 스킬 수정';
      edit.dataset.editForgeId=def.id;edit.className='forge-saved-edit';
      edit.setAttribute('aria-label',def.name+' 스킬 수정');
      const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';
      remove.dataset.forgeId=def.id;remove.className='forge-saved-remove';
      remove.setAttribute('aria-label',def.name+' 삭제');
      actions.append(edit,remove);row.append(name,actions);target.appendChild(row);
    }
  }
  state.refreshList=roster;
  $('forge-roster-filter')?.addEventListener('input',roster);
  state.refreshForm=()=>{refreshBasics();render();};
   function cancelEdit(){state.editingId=null;state.draft=normalize({name:'',color:'#a78bfa',effectColor:'#a78bfa',archetype:'melee',signatureVersion:1,skills:[skill()]});state.refreshForm();global.BlockForge?.refresh?.();$('bf-create').textContent='캐릭터 생성';$('forge-cancel-edit').hidden=true;}
   $('forge-cancel-edit').addEventListener('click',()=>{cancelEdit();report('편집 취소');});
  $('bf-custom-list').addEventListener('click',e=>{
    const editId=e.target.closest('button')?.dataset.editForgeId;
     if(editId){const d=CUSTOM_DEFS.find(d=>d.id===editId&&d.forgeData);if(!d)return;state.editingId=editId;state.draft=normalize(d.forgeData);state.refreshForm();global.BlockForge?.refresh?.();global.CharacterStudioModes?.select?.('compose');
       global.StudioEasyDesigner?.selectMode?.('simple');global.StudioEasyDesigner?.refresh?.();
       $('bf-create').textContent='변경 내용 저장';$('forge-cancel-edit').hidden=false;
       report(d.name+'의 스킬을 불러왔습니다. 아래에서 스킬을 수정하고 변경 내용을 저장하세요.');
       document.getElementById('studio-mode-compose')?.scrollIntoView?.({block:'nearest',behavior:'smooth'});
       return;}
     const id=e.target.dataset.forgeId;
    if(!id)return;
    if(roundStarted&&!isGameOver){report('경기 종료 후 삭제할 수 있습니다.');return;}
    const selected=CUSTOM_DEFS.find(d=>d.id===id&&d.forgeData);
    if(!selected)return;
    if(!confirm(selected.name+' 캐릭터를 삭제하시겠습니까?'))return;
    if(remove(id)){if(state.editingId===id)cancelEdit();reRollMatch();roster();report(selected.name+' 캐릭터를 삭제했습니다.');}
  });
  $('forge-skills').addEventListener('input',e=>{
    const key=e.target.dataset.field;
    if(!key)return;
    const i=Number(e.target.dataset.skill),j=e.target.dataset.stage;
    const obj=j===undefined?state.draft.skills[i]:state.draft.skills[i]?.actions[Number(j)];
    if(obj)obj[key]=e.target.type==='number'?Number(e.target.value):e.target.value;
    global.NaturalForge?.refreshGenerated?.(state.draft);
  });
  $('forge-skills').addEventListener('change',e=>{
    if(['type','trigger'].includes(e.target.dataset.field))render();
  });
  $('forge-skills').addEventListener('click',e=>{
    const button=e.target.closest('button[data-command]');
    if(!button)return;
    sync();const i=Number(button.dataset.skill),j=Number(button.dataset.stage);
    const action=button.dataset.command;
    if(action==='disable-all'){state.draft.allAbilities=false;render();return;}
    if(action==='remove-skill'&&state.draft.skills.length>1)state.draft.skills.splice(i,1);
    if(action==='add-action'&&state.draft.skills[i].actions.length<(state.draft.signatureVersion===1?12:3))state.draft.skills[i].actions.push(stage());
    if(action==='remove-action'&&state.draft.skills[i].actions.length>1)state.draft.skills[i].actions.splice(j,1);
    render();global.NaturalForge?.refreshGenerated?.(state.draft);
  });
  $('forge-add-skill').addEventListener('click',()=>{
    sync();if(state.draft.signatureVersion!==1&&!state.draft.allAbilities&&state.draft.skills.length<4){state.draft.skills.push(skill());render();global.NaturalForge?.refreshGenerated?.(state.draft);}
  });
  $('bf-analyze').addEventListener('click',()=>{
    try{
      sync();const d=normalize(state.draft);
      const budget=global.ArenaBalance?.summary(d);
      report((budget?'설계 화력 지수 '+budget.pressure+' / '+budget.budget+
        ' · 실제 피해 적용 약 '+budget.percent+'%\n':'')+
        d.skills.map((s,i)=>(i+1)+'. '+s.name+' · '+TRIGGER[s.trigger]+' / '+s.cooldown+'초'
        +'\n   '+s.actions.map(a=>TYPE[a.type]+' / '+(global.AbilityAtlas?.PATTERNS[a.pattern]||'직선 집중')+' / '+(global.AbilityAtlas?.TARGETS[a.target]||'가장 가까운 적')+' ('+a.damage+'위력, '+a.radius+'범위, '+STATUS[a.status]+')').join(' → ')).join('\n'));
    }catch(e){report(e.message);}
  });
  $('bf-create').addEventListener('click',()=>{
    try{
      sync();const config=normalize(state.draft),old=state.editingId?CUSTOM_DEFS.find(d=>d.id===state.editingId&&d.forgeData):null;
       if(state.editingId&&!old)throw Error('수정할 캐릭터가 없습니다.');
       const id=old?old.id:register(config);
       if(old)old.updateProfile(config);
      persist();
      if(!old)global.CharacterStudioArt?.commit?.(id);
      const fighting=typeof roundStarted!=='undefined'&&roundStarted&&!isGameOver;
      // Never reroll fighters or replace active AI/HP in a live Tower battle.
      if(!fighting){
        reRollMatch();
        const first=$('bf-pick-0');
        if(first){first.value=id;globalThis.applyFighterPicks?.();}
      }
      const budget=global.ArenaBalance?.summary(config);
      roster();report(config.name+(old?' 수정 완료':' 생성 완료')+
        (fighting?' · 진행 중인 전투는 그대로 유지되며 다음 경기부터 적용됩니다.':' · 다음 경기 P1에 적용')+
        (budget?.excess?' · 실제 피해 약 '+budget.percent+'% 적용 (입력값은 보존됨)':''));
      if(old)cancelEdit();global.ArenaCategories?.hideStudio?.();
    }catch(e){report(e.message);}
  });
  $('forge-export').addEventListener('click',()=>{
    try{sync();$('forge-json-text').value=JSON.stringify(normalize(state.draft),null,2);report('설정 JSON을 복사해 보관하세요.');}catch(e){report(e.message);}
  });
  $('forge-import').addEventListener('click',()=>{
    try{state.draft=normalize(JSON.parse($('forge-json-text').value));refreshBasics();render();global.BlockForge?.refresh?.();report('설정 불러오기 완료');}
    catch(e){report('JSON 오류: '+e.message);}
  });
  refreshBasics();render();roster();
}

return Object.freeze({initializeUI,render,refreshEditor:()=>state.refreshForm()});
};
})(typeof window!=='undefined'?window:globalThis);
