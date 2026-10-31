/* One unified Scratch-like custom fighter studio. This is a visual,
 * accessible editor for SignatureScratch data, not a JavaScript executor. */
(function(g){
'use strict';
const doc=g.document,forge=g.SkillForge,engine=g.SignatureScratch;
const studio=doc?.querySelector('#character-studio-dialog .forge-studio');
const skills=studio?.querySelector('#studio-panel-skills');
if(!studio||!skills||!forge||!engine)return;
const make=(tag,className,html)=>{const n=doc.createElement(tag);n.className=className||'';if(html!=null)n.innerHTML=html;return n;};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const encode=path=>encodeURIComponent(JSON.stringify(path));
const decode=s=>{try{const p=JSON.parse(decodeURIComponent(s));return Array.isArray(p)?p:[];}catch(_){return [];}};
const actionName=id=>forge.TYPE[id]||id||'동작';
const groupDefs=[
 {id:'control',label:'제어',color:'control',items:[['if','만약 / 아니면'],['repeat','반복하기'],['wait','기다리기']]},
 {id:'attacks',label:'공격',color:'attacks'}, {id:'mobility',label:'이동',color:'mobility'},
 {id:'defense',label:'방어',color:'defense'}, {id:'special',label:'특수',color:'special'}
];
const fallbackGroups={attacks:['wave','shot','bolt','beam','slash','nova','chain','meteor'],
 mobility:['dash','blink','retreat','leap','portal'],
 defense:['shield','heal','regen','fortify'],
 special:['zone','orbit','summon','timestop','blackhole']};
const registry=g.ActionRegistry?.GROUPS||{};
const typesFor=id=>(registry[id]?.types||fallbackGroups[id]||[]).filter(type=>forge.TYPE[type]);
let category='control',query='',activeList=[],activeIndex=0,drag=null,undo=[],redo=[],lastChecksum='';
const header=make('nav','scratch-main-nav','<button type="button" data-scratch-tab="code" aria-pressed="true">🧩 고유 스킬 코딩</button><button type="button" data-scratch-tab="looks" aria-pressed="false">🎨 외형 꾸미기</button>');
const root=make('section','scratch-workbench');
root.id='scratch-workbench';root.setAttribute('aria-label','고유 스킬 블록 프로그래밍 작업실');
root.innerHTML='<div class="scratch-heading"><div><span class="scratch-eyebrow">OIBUNG / BLOCK PROGRAMMING</span><h3>고유 스킬 코딩</h3><p>왼쪽 블록을 끌어다 가운데 코드에 끼워 보세요. 클릭하거나 ↑↓로도 조립할 수 있습니다.</p></div><div class="scratch-heading-actions"><button type="button" data-scratch-command="random">🎲 랜덤 블록 생성</button><button type="button" data-scratch-command="undo" aria-label="블록 되돌리기">↶</button><button type="button" data-scratch-command="redo" aria-label="블록 다시하기">↷</button></div></div>'
 +'<div class="scratch-layout">'
 +'<aside class="scratch-library" aria-label="블록 팔레트"><div class="scratch-library-title">블록 팔레트</div>'
 +'<div class="scratch-categories" role="group" aria-label="블록 종류"></div>'
 +'<label class="scratch-search-label">블록 검색<input type="search" id="scratch-search" placeholder="이름으로 검색" autocomplete="off"></label>'
 +'<div class="scratch-palette" aria-label="끌어다 놓을 블록"></div></aside>'
 +'<main class="scratch-editor" aria-label="스크래치 스킬 코딩 영역"><div class="scratch-script-top">'
 +'<label>고유 스킬 이름<input id="scratch-skill-name" maxlength="18" type="text"></label>'
 +'<label>재사용 대기시간(초)<input id="scratch-cooldown" type="number" min=".2" max="30" step=".1"></label></div>'
 +'<div class="scratch-hat"><span>⚑ 언제 실행할까?</span><select id="scratch-trigger" aria-label="고유 스킬 발동 조건"></select></div>'
 +'<div class="scratch-script" aria-label="조립한 스킬 블록"><div class="scratch-block-tree"></div></div>'
 +'<div class="scratch-footer"><span class="scratch-counter" aria-live="polite"></span><button type="button" data-scratch-command="clear">프로그램 비우기</button></div></main>'
 +'<aside class="scratch-help" aria-label="사용 안내"><strong>코딩 도움말</strong><p>노란색: 조건에 따라 실행</p><p>주황색: 반복과 기다리기</p><p>파란색: 이동 / 보라색: 공격</p><p>조건 블록 속에 다른 블록을 넣으면 해당 조건에서만 실행됩니다.</p><div class="scratch-status" role="status" aria-live="polite">블록을 추가해 보세요.</div></aside></div>';
skills.prepend(root);studio.insertBefore(header,studio.querySelector('.studio-category-tabs'));
studio.classList.add('scratch-studio-active');
const $=selector=>root.querySelector(selector);
const current=()=>forge.getDraft();
const getSkill=()=>current().skills[0];
function listAt(program,path){
 let list=program;
 for(let i=0;i<path.length;i+=2){
  if(!Array.isArray(list)||!list[path[i]]||!['then','else','body'].includes(path[i+1]))throw Error('블록 위치를 다시 선택해 주세요.');
  list=list[path[i]][path[i+1]];
 }
 if(!Array.isArray(list))throw Error('잘못된 블록 위치입니다.');
 return list;
}
function nodeAt(program,path){
 const list=listAt(program,path.slice(0,-1)),index=path.at(-1);
 if(!Number.isInteger(index)||!list[index])throw Error('블록을 찾지 못했습니다.');
 return list[index];
}
function programOf(p){
 const skill=p.skills[0];
 return Array.isArray(skill?.program)?engine.normalize(skill.program):engine.fromActions(skill?.actions||[]);
}
function feedback(message){const el=$('.scratch-status');if(el)el.textContent=message;}
function setProfile(program,skillFields={},message='블록 코딩이 반영되었습니다.'){
 const old=current(),prev=old.skills[0];
 const normalized=engine.normalize(program),preview=engine.preview(normalized);
 const actions=preview.length?preview:[{type:'wave',damage:18,status:'none',link:'and'}];
 const next={...old,signatureVersion:1,allAbilities:false,skills:[{
  ...prev,program:normalized,actions,
  ...skillFields
 }]};
 forge.setDraft(next);
 feedback(message);render();
 g.CharacterStudioWorkspace?.refresh?.();
}
function commit(mutator,message){
 try{
  const before=current(),original=programOf(before),program=JSON.parse(JSON.stringify(original));
  mutator(program);
  const result=engine.normalize(program);
  if(JSON.stringify(result)===JSON.stringify(original))return;
  undo.push(JSON.stringify(before));if(undo.length>30)undo.shift();redo=[];
  setProfile(result,{},message);
 }catch(err){feedback(err.message);}
}
function restore(snapshot){
 try{const p=JSON.parse(snapshot);forge.setDraft(p);render();g.CharacterStudioWorkspace?.refresh?.();}
 catch(err){feedback(err.message);}
}
function getNode(kind,type){
 if(kind==='action')return {kind:'action',action:engine.safeAction({type,damage:18,link:'after'})};
 if(kind==='wait')return {kind:'wait',seconds:.4};
 if(kind==='repeat')return {kind:'repeat',times:2,body:[]};
 return {kind:'if',condition:'danger',then:[],else:[]};
}
const blockLabel=n=>n.kind==='action'?actionName(n.action.type):({if:'만약 / 아니면',repeat:'반복하기',wait:'기다리기'})[n.kind];
function renderPalette(){
 const cat=$('.scratch-categories');
 cat.innerHTML=groupDefs.map(d=>'<button type="button" data-scratch-category="'+d.id+'" aria-pressed="'+String(category===d.id)+'" class="scratch-category scratch-color-'+d.id+'">'+d.label+'</button>').join('');
 const palette=$('.scratch-palette');let blocks=[];
 if(category==='control')blocks=groupDefs[0].items.map(([kind,label])=>({kind,label}));
 else blocks=typesFor(category).map(type=>({kind:'action',type,label:actionName(type)}));
 if(query.trim())blocks=blocks.filter(b=>b.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 palette.innerHTML=blocks.map(({kind,label,type})=>'<button type="button" class="scratch-palette-block scratch-kind-'+kind+' scratch-color-'+category+'" data-palette-kind="'+kind+'" '+(type?'data-palette-type="'+esc(type)+'"':'')+' draggable="true" title="드래그하거나 눌러 추가"><span class="scratch-palette-glyph" aria-hidden="true">⊕</span>'+esc(label)+'</button>').join('')||'<p class="scratch-no-blocks">이름에 맞는 블록이 없습니다.</p>';
}
function selectOptions(options,chosen){
 return Object.entries(options).map(([id,label])=>'<option value="'+esc(id)+'"'+(id===chosen?' selected':'')+'>'+esc(label)+'</option>').join('');
}
function slot(path,title){
 const encoded=encode(path),selected=JSON.stringify(path)===JSON.stringify(activeList);
 return '<div class="scratch-slot'+(selected?' scratch-slot-active':'')+'" data-scratch-list="'+encoded+'">'
  +'<button type="button" class="scratch-slot-add" data-scratch-target="'+encoded+'" data-scratch-at="end" aria-label="'+esc(title)+'에 블록 추가">＋ '+esc(title)+'</button></div>';
}
function insertGap(path,index){
 const enc=encode(path);
 return '<div class="scratch-insert-zone" data-scratch-target="'+enc+'" data-scratch-at="'+index+'" title="여기로 블록 끼우기"><span>여기에 끼우기</span></div>';
}
function block(n,path,depth){
 const encoded=encode(path),kind=n.kind;
 let inside='';
 if(kind==='action'){
  const type=n.action.type;
  const permitted=key=>forge.supportedParameter?.(type,key)??true;
  const num=(key,label,min,max,step)=>permitted(key)?'<label>'+label+'<input data-scratch-field="'+key+'" data-scratch-node="'+encoded+'" type="number" min="'+min+'" max="'+max+'" step="'+step+'" value="'+Number(n.action[key]||0)+'"></label>':'';
  const choice=(key,label,opts)=>permitted(key)?'<label>'+label+'<select data-scratch-field="'+key+'" data-scratch-node="'+encoded+'">'+selectOptions(opts,n.action[key])+'</select></label>':'';
  inside='<span class="scratch-block-title">'+esc(actionName(type))+'</span>'
   +num('damage','위력',0,120,1)+num('radius','범위',30,300,5)
   +'<details class="scratch-advanced" draggable="false"><summary title="추가 설정">⚙ 세부 조정</summary><div class="scratch-advanced-fields">'
   +'<label>행동<select data-scratch-field="type" data-scratch-node="'+encoded+'">'+selectOptions(forge.TYPE,type)+'</select></label>'
   +choice('pattern','공격 형태',g.AbilityAtlas?.PATTERNS||{direct:'직접'})
   +choice('target','대상',g.AbilityAtlas?.TARGETS||{nearest:'가장 가까운 적'})
   +choice('status','상태이상',forge.STATUS)
   +num('count','개수',1,8,1)+num('speed','속도',2,14,.5)
   +num('duration','지속',.2,8,.1)+num('knockback','넉백',0,9,.5)
   +num('delay','발동 지연',0,2,.1)
   +'</div></details>';
 }else if(kind==='wait'){
  inside='<span>기다리기</span><label><input data-scratch-field="seconds" data-scratch-node="'+encoded+'" type="number" min=".1" max="2" step=".1" value="'+Number(n.seconds)+'"> 초</label>';
 }else if(kind==='repeat'){
  inside='<span>반복하기</span><label><select data-scratch-field="times" data-scratch-node="'+encoded+'">'+selectOptions({'2':'2번','3':'3번'},String(n.times))+'</select></label>';
 }else{
  inside='<span>만약</span><label><select data-scratch-field="condition" data-scratch-node="'+encoded+'" aria-label="조건">'+selectOptions(g.SignatureProgram?.CONDITIONS||{always:'항상 실행'},n.condition)+'</select></label>';
 }
 const controls='<span class="scratch-node-controls"><button type="button" data-scratch-command="up" data-scratch-node="'+encoded+'" title="위로">↑</button><button type="button" data-scratch-command="down" data-scratch-node="'+encoded+'" title="아래로">↓</button><button type="button" data-scratch-command="remove" data-scratch-node="'+encoded+'" title="삭제">×</button></span>';
 let nested='';
 if(kind==='if'){
  nested='<div class="scratch-cavity"><div class="scratch-cavity-label">참이면 실행</div>'+drawList(n.then,[...path,'then'],depth+1)
   +'<div class="scratch-cavity-label">아니면 실행</div>'+drawList(n.else,[...path,'else'],depth+1)+'</div>';
 }else if(kind==='repeat'){
  nested='<div class="scratch-cavity"><div class="scratch-cavity-label">반복할 블록</div>'+drawList(n.body,[...path,'body'],depth+1)+'</div>';
 }
 return '<div class="scratch-node scratch-node-'+kind+(kind==='action'?' scratch-action-'+esc(n.action.type):'')+'" draggable="true" data-scratch-node="'+encoded+'" data-scratch-depth="'+depth+'">'
 +'<div class="scratch-node-line"><span class="scratch-drag-grip" title="블록 잡아 이동" aria-hidden="true">⠿</span>'+inside+controls+'</div>'+nested+'</div>';
}
function drawList(list,path,depth){
 let result='<div class="scratch-code-list" data-scratch-list="'+encode(path)+'">';
 for(let i=0;i<list.length;i++)result+=insertGap(path,i)+block(list[i],[...path,i],depth);
 result+=insertGap(path,list.length);
 return result+(!list.length?slot(path,'블록 넣기'):'')+'</div>';
}
function render(){
 const p=current(),skill=p.skills[0],legacy=p.signatureVersion!==1;
 const program=programOf(p);
 root.dataset.legacy=String(legacy);
 if(legacy){
  $('.scratch-block-tree').innerHTML='<section class="scratch-legacy"><strong>이전 방식의 캐릭터입니다.</strong><p>저장된 '+p.skills.length+'개의 독립 스킬은 그대로 유지됩니다. 변경하려면 고유 스킬 1개로 변환하세요. 원래 구성은 백업됩니다.</p><button type="button" data-scratch-command="convert">고유 스킬 편집기로 전환</button></section>';
 }else $('.scratch-block-tree').innerHTML=drawList(program,[],0);
 $('#scratch-skill-name').value=skill.name;
 $('#scratch-cooldown').value=skill.cooldown;
 $('#scratch-trigger').innerHTML=selectOptions(forge.TRIGGER,skill.trigger);
 const n=engine.preview(program).length;
 $('.scratch-counter').textContent='블록 '+engine.normalize(program).length+'개 · 예상 실행 행동 '+n+'/'+engine.LIMIT+'개 (반복 포함)';
 root.querySelector('[data-scratch-command="undo"]').disabled=!undo.length;
 root.querySelector('[data-scratch-command="redo"]').disabled=!redo.length;
 $('.scratch-heading').querySelector('[data-scratch-command="random"]').textContent='🎲 랜덤 블록 생성';
 lastChecksum=JSON.stringify(program);
}
function insert(kind,type,where=activeList,index=activeIndex){
 commit(p=>{
  const target=listAt(p,where);
  target.splice(Math.max(0,Math.min(target.length,index)),0,getNode(kind,type));
  activeList=where;activeIndex=Math.min(index+1,target.length);
 },'새 블록을 프로그램에 끼웠습니다.');
}
function dropBlock(destination,index){
 if(!drag)return;
 const source=drag;drag=null;
 if(source.kind){
  insert(source.kind,source.type,destination,index);return;
 }
 const from=source.path,fromList=from.slice(0,-1),sourceIndex=from.at(-1);
 const recursive=destination.length>=from.length&&from.every((part,i)=>destination[i]===part);
 if(recursive){feedback('블록을 자기 자신 속으로 넣을 수 없습니다.');return;}
 commit(p=>{
  // Resolve both live arrays before removing an ancestor/sibling: removing
  // a root node shifts indices but must not invalidate the destination slot.
  const sourceList=listAt(p,fromList),dest=listAt(p,destination);
  const take=sourceList.splice(sourceIndex,1)[0];
  const adjusted=JSON.stringify(fromList)===JSON.stringify(destination)&&sourceIndex<index?index-1:index;
  dest.splice(Math.min(dest.length,Math.max(0,adjusted)),0,take);
  activeList=destination;activeIndex=adjusted+1;
 },'블록을 새 위치에 끼웠습니다.');
}
root.addEventListener('click',e=>{
 const palette=e.target.closest('[data-palette-kind]');
 if(palette){insert(palette.dataset.paletteKind,palette.dataset.paletteType);return;}
 const categoryButton=e.target.closest('[data-scratch-category]');
 if(categoryButton){category=categoryButton.dataset.scratchCategory;renderPalette();return;}
 const target=e.target.closest('[data-scratch-target]');
 if(target){activeList=decode(target.dataset.scratchTarget);activeIndex=target.dataset.scratchAt==='end'?listAt(programOf(current()),activeList).length:Number(target.dataset.scratchAt);render();feedback('선택한 위치에 팔레트의 블록을 클릭해 추가하세요.');return;}
 const button=e.target.closest('[data-scratch-command]');if(!button)return;
 const cmd=button.dataset.scratchCommand;
 if(cmd==='random'){
  if(programOf(current()).length>1&&!g.confirm?.('현재 블록 구성을 랜덤 조합으로 바꿀까요? 되돌리기로 복구할 수 있습니다.'))return;
  const base=current();
  if(base.signatureVersion!==1){
   const converted=g.SignatureProgram.migrate(base);
   forge.setDraft(converted);
  }
  commit(p=>{p.splice(0,p.length,...engine.random());activeList=[];activeIndex=p.length;},'랜덤으로 조건·반복·행동 블록을 조합했습니다.');
  return;
 }
 if(cmd==='convert'){
  if(!g.confirm?.('기존 독립 스킬을 고유 스킬 하나로 합칠까요? 쿨타임이 바뀌며 원본은 백업됩니다.'))return;
  const result=g.SignatureProgram.migrate(current());
  forge.setDraft(result);undo=[];redo=[];render();feedback('기존 스킬을 한 개의 고유 스킬로 전환했습니다.');return;
 }
 if(cmd==='undo'&&undo.length){const old=undo.pop();redo.push(JSON.stringify(current()));restore(old);return;}
 if(cmd==='redo'&&redo.length){const next=redo.pop();undo.push(JSON.stringify(current()));restore(next);return;}
 if(cmd==='clear'){if(g.confirm?.('블록을 모두 비울까요?'))commit(p=>p.splice(0,p.length),'블록을 비웠습니다.');return;}
 if(!button.dataset.scratchNode)return;
 const path=decode(button.dataset.scratchNode);
 if(cmd==='remove')commit(p=>listAt(p,path.slice(0,-1)).splice(path.at(-1),1),'블록을 삭제했습니다.');
 if(cmd==='up'||cmd==='down')commit(p=>{
  const list=listAt(p,path.slice(0,-1)),from=path.at(-1),to=from+(cmd==='up'?-1:1);
  if(to<0||to>=list.length)return;
  [list[from],list[to]]=[list[to],list[from]];
 },'블록 순서를 변경했습니다.');

});
root.addEventListener('change',e=>{
 const input=e.target,field=input.dataset.scratchField;
 if(field){
  const path=decode(input.dataset.scratchNode);
  commit(program=>{
   const node=nodeAt(program,path);
   if(field==='condition')node.condition=input.value;
   else if(field==='times')node.times=Number(input.value);
   else if(field==='seconds')node.seconds=Number(input.value);
   else if(node.kind==='action')node.action[field]=['type','status','target','pattern'].includes(field)?input.value:Number(input.value);
  },'블록 수치를 조정했습니다.');
  return;
 }
 if(input.id==='scratch-skill-name'||input.id==='scratch-cooldown'||input.id==='scratch-trigger'){
  const fields={};
  if(input.id==='scratch-skill-name')fields.name=input.value;
  if(input.id==='scratch-cooldown')fields.cooldown=Number(input.value);
  if(input.id==='scratch-trigger')fields.trigger=input.value;
  setProfile(programOf(current()),fields,'고유 스킬 설정을 변경했습니다.');
 }
});
$('#scratch-search').addEventListener('input',e=>{query=e.target.value;renderPalette();});
root.addEventListener('dragstart',e=>{
 const item=e.target.closest('[data-palette-kind]'),node=e.target.closest('[data-scratch-node]');
 if(item)drag={kind:item.dataset.paletteKind,type:item.dataset.paletteType};
 else if(node)drag={path:decode(node.dataset.scratchNode)};
 else return;
 e.dataTransfer?.setData('text/plain','scratch-block');
 if(e.dataTransfer)e.dataTransfer.effectAllowed=item?'copy':'move';
});
root.addEventListener('dragover',e=>{
 const slot=e.target.closest('[data-scratch-target]');
 if(slot&&drag){e.preventDefault();slot.classList.add('scratch-drop-hover');}
});
root.addEventListener('dragleave',e=>{e.target.closest('[data-scratch-target]')?.classList.remove('scratch-drop-hover');});
root.addEventListener('drop',e=>{
 const slot=e.target.closest('[data-scratch-target]');
 if(!slot||!drag)return;
 e.preventDefault();
 const where=decode(slot.dataset.scratchTarget);
 const index=slot.dataset.scratchAt==='end'?listAt(programOf(current()),where).length:Number(slot.dataset.scratchAt);
 dropBlock(where,index);
 root.querySelectorAll('.scratch-drop-hover').forEach(n=>n.classList.remove('scratch-drop-hover'));
});
root.addEventListener('dragend',()=>{drag=null;root.querySelectorAll('.scratch-drop-hover').forEach(n=>n.classList.remove('scratch-drop-hover'));});
function openTab(tab){
 const looks=tab==='looks';
 g.CharacterStudioWorkspace?.selectTab?.(looks?'appearance':'skills');
 // Legacy mode controller still owns the shared save/name/preview visibility.
 // Keep it in compose mode while hiding its old redundant 4-skill UI.
 originalSelect?.(looks?'appearance':'compose',{keepTab:true});
 if(!looks){const pv=doc.querySelector('.studio-motion-preview');if(pv)pv.hidden=false;g.CharacterStudioWorkspace?.setPreviewVisible?.(true);}
 header.querySelectorAll('[data-scratch-tab]').forEach(b=>b.setAttribute('aria-pressed',String((looks?'looks':'code')===b.dataset.scratchTab)));
}
header.addEventListener('click',e=>{const tab=e.target.closest('[data-scratch-tab]');if(tab)openTab(tab.dataset.scratchTab);});
const originalSelect=g.CharacterStudioModes?.select;
if(originalSelect)g.CharacterStudioModes.select=(mode,opts)=>{
 const result=originalSelect(mode==='appearance'?'appearance':'compose',opts);
 openTab(mode==='appearance'?'looks':'code');render();return result;
};
doc.getElementById('bf-custom-list')?.addEventListener('click',e=>{
 if(e.target.closest('[data-edit-forge-id]')){render();openTab('code');}
});
// Do not persist a blank program: it would display a valid fighter with a
// never-executing unique skill. Keep editing available, including Undo.
const hasAction=blocks=>blocks.some(n=>n.kind==='action'||(n.kind==='if'&&(hasAction(n.then)||hasAction(n.else)))||(n.kind==='repeat'&&hasAction(n.body)));
doc.getElementById('bf-create')?.addEventListener('click',e=>{
 const p=current();
 if(p.signatureVersion===1&&!hasAction(programOf(p))){
  e.preventDefault();e.stopImmediatePropagation();
  feedback('최소한 하나의 행동 블록을 연결해야 저장할 수 있습니다.');
 }
},true);
g.addEventListener?.('studio:open',()=>{render();openTab('code');});
renderPalette();render();openTab('code');
g.ScratchStudio={render,openTab,insert,get activeCategory(){return category;}};
})(window);
