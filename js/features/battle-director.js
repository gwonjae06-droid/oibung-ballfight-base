/* Simulation-observed battle commentary and defeat evidence.
 * No combat damage, cooldown or RNG is changed by commentary. */
(function(g){'use strict';
let frame=0,lastNarrated=-200,roster=[],history=new Map(),overTimeWas=false,ended=false;
let queue=[],recent=[],lastSentence='',phraseSerial=0,actionNames=new WeakMap(),lastSkillUsed=new WeakMap();
const name=p=>String(p?.name||'파이터').slice(0,24);
const sample=p=>({hp:Number(p?.hp)||0,maxHp:Math.max(1,Number(p?.maxHp)||1),
 status:Object.keys(p?.forgeEffects||{}).filter(key=>p.forgeEffects[key]?.time>0),
 dot:Number(p?.bfDot)||0});
const state=p=>history.get(p);
const STATUS={ice:'빙결 둔화',freeze:'빙결',stun:'기절',root:'속박',silence:'침묵',
 fire:'화상',poison:'중독',bleed:'출혈',shock:'감전',blind:'실명',
 curse:'저주',fear:'공포',charm:'매혹',timestop:'시간 정지',slow:'둔화'};
const ACTION={wave:'충격파',shot:'탄환',beam:'광선',nova:'폭발',pierce:'관통탄',homing:'유도탄',
 arcshot:'곡사탄',splitshot:'분열탄',turret:'포탑',summon:'소환',chain:'연쇄 공격',
 bolt:'낙뢰',starfall:'별비',meteor:'운석',zone:'장판',trap:'함정',
 dash:'돌진',leap:'도약',blink:'순간이동',uppercut:'어퍼컷',aircombo:'공중 연타',
 slash:'베기',spinslash:'회전베기',thrust:'찌르기',drain:'흡혈',
 heal:'치유',regen:'재생',shield:'방어막',timeburst:'시간 가속',timestop:'시간 정지',
 blackhole:'블랙홀',orbit:'공전탄',fortify:'강화',haste:'가속',
 dive:'급강하',erupt:'분출',wall:'장벽',portal:'포탈'};
const knownAction=a=>ACTION[a?.type]||String(a?.type||'기술').slice(0,12);
const variants={
 start:['경기 시작! 튕겨 나가는 공들의 첫 충돌을 기대해 봅니다!',
   '전투 개시! 어떤 기술 조합이 먼저 흐름을 잡을까요?'],
 cast:[
  (n,s,t)=>`${n}, ${s} 발동! ${t}의 움직임을 지켜봅니다.`,
  (n,s)=>`${n}의 ${s}! 이번에는 어떤 결과가 나올까요?`,
  (n,s)=>`공세를 시작하는 ${n}! ${s}을(를) 꺼냈습니다.`,
  (n,s)=>`${s} 전개! ${n}이(가) 주도권을 노립니다.`,
  (n,s)=>`${n}의 기술 ${s}, 지금 발동합니다!`,
  (n,s)=>`기술을 펼치는 ${n}! 선택은 ${s}입니다.`],
 impact:[
  (n,s,t,d)=>`${n}의 ${s} 명중! ${t}에게 ${d} 피해!`,
  (n,s,t,d)=>`${s}이(가) 제대로 들어갔습니다! ${t}, ${d} HP 감소!`,
  (n,s,t,d)=>`${n}의 공격이 적중! ${t}이(가) ${d} 피해를 받았습니다!`,
  (n,s,t,d)=>`지금 ${s}! ${t}의 체력이 ${d}만큼 줄어듭니다!`,
  (n,s,t,d)=>`${t}에게 ${d} 피해! ${n}의 ${s}이(가) 효과를 냈습니다.`,
  (n,s,t,d)=>`${n}의 ${s}이(가) 흐름을 바꿉니다. 명중 피해 ${d}!`],
 control:[
  (n,s,t,st)=>`${n}의 ${s}! ${t}에게 ${st} 효과가 적용됐습니다!`,
  (n,s,t,st)=>`${t}, ${st} 상태! ${n}의 ${s}이(가) 적중했습니다.`,
  (n,s,t,st)=>`제어 기술 적중! ${t}에게 ${st}, 움직임에 주목하세요.`,
  (n,s,t,st)=>`${s}으로 ${st} 유발! ${t}이(가) 반격할 수 있을까요?`],
 low:[(n)=>`${n}의 체력이 위험합니다! 역전할 수 있을까요?`,
  (n)=>`${n}, 빈사 상태! 다음 공격이 승부를 가를 수 있습니다.`,
  (n)=>`위기의 ${n}! 남은 체력이 많지 않습니다.`],
 heavy:[(n,d)=>`${n}에게 강력한 일격! 체력 ${d} 감소!`,
  (n,d)=>`묵직한 타격! ${n}이(가) 순식간에 ${d} 피해를 받았습니다.`,
  (n,d)=>`이번 충격은 큽니다! ${n}의 체력 ${d} 감소.`],
 lead:[(n)=>`${n}이(가) 체력 비율에서 앞섭니다. 한 번의 충돌로 뒤집힐 수 있죠!`,
  (n)=>`현재 체력 우세는 ${n}! 하지만 아직 승부를 예측하기 어렵습니다.`,
  (n)=>`${n}이(가) 버티고 있습니다. 다음 교전이 중요해 보입니다!`],
 overtime:[()=>`결전 상태 돌입! 모두에게 압박 피해가 시작됩니다.`,
  ()=>`결전 개시! 이제 오래 버티기만 해서는 승리하기 어렵습니다.`,
  ()=>`승부를 끝낼 시간! 결전의 체력 압박이 시작됩니다.`],
 recovery:[(n,d)=>`${n}, ${d} HP를 회복하며 다시 버팁니다!`,
  (n,d)=>`체력 회복에 성공한 ${n}! ${d} HP를 되찾습니다.`,
  (n,d)=>`위기를 넘기려는 ${n}, 회복량 ${d}!`],
 comeback:[(n)=>`${n}이(가) 다시 체력을 채우며 반격을 준비합니다!`,
  (n)=>`회복 후 다시 움직이는 ${n}! 전세가 달라질까요?`]
};
function phrase(kind,args=[]){const list=variants[kind]||[];if(!list.length)return '';
 const index=phraseSerial++%list.length;
 let sentence=typeof list[index]==='function'?list[index](...args):list[index];
 if(sentence===lastSentence){const alt=list[(index+1)%list.length];sentence=typeof alt==='function'?alt(...args):alt;}
 return sentence;
}
function speak(text){
 if(!text||text===lastSentence)return false;
 lastSentence=text;
 const line=g.document?.getElementById?.('arena-commentary-line');
 if(line){line.textContent=text;line.dataset.pulse=String(frame);line.classList.remove('director-pop');void line.offsetWidth;line.classList.add('director-pop');}
 const live=g.document?.getElementById?.('arena-commentary');
 if(live)live.dataset.event=String(frame);
 if(g.document?.getElementById?.('arena-commentary-voice')?.checked&&g.speechSynthesis&&g.SpeechSynthesisUtterance){
  try{g.speechSynthesis.cancel();const u=new g.SpeechSynthesisUtterance(text);u.lang='ko-KR';u.rate=1.18;g.speechSynthesis.speak(u);}catch(_){}
 }
 return true;
}
function offer(kind,args,priority=2,key=kind){
 if(ended)return;
 if(queue.length>=20)queue.shift();
 // Only one queued entry for an identical skill-target context; repeated
 // 0.2s skills cannot fill the voice queue or drown out actual outcomes.
 if(queue.some(e=>e.key===key))return;
 queue.push({kind,args,priority,key,at:frame});
}
function dispatch(){
 if(frame-lastNarrated<115||!queue.length)return;
 queue=queue.filter(e=>frame-e.at<320&&!recent.some(r=>r.key===e.key&&frame-r.frame<240));
 if(!queue.length)return;
 queue.sort((a,b)=>b.priority-a.priority||a.at-b.at);
 const choice=queue.shift(),sentence=phrase(choice.kind,choice.args);
 if(speak(sentence)){
  lastNarrated=frame;recent.push({key:choice.key,frame});if(recent.length>15)recent.shift();
 }
}
function reset(players=[]){
 frame=0;lastNarrated=0;roster=players.slice();history=new Map();overTimeWas=false;ended=false;
 queue=[];recent=[];lastSentence='';phraseSerial=0;actionNames=new WeakMap();lastSkillUsed=new WeakMap();
 for(const p of roster)history.set(p,{previous:sample(p),lost:0,healed:0,biggest:0,last:0,low:false,controlled:false});
 const panel=g.document?.getElementById?.('arena-defeat-analysis');if(panel){panel.hidden=true;panel.replaceChildren();}
 speak(phrase('start'));
}
function skillUsed(attacker,target,action,skillName){
 if(ended||!attacker||!action)return;
 const label=String(skillName||knownAction(action)).slice(0,28);
 if(typeof action==='object')actionNames.set(action,label);
 lastSkillUsed.set(attacker,{label,type:action.type,frame});
 // When a multi-block combo hits, report the result ahead of mere casting.
 offer('cast',[name(attacker),label,name(target)],1,`cast:${attacker.playerNum}:${label}`);
}
function skillHit(attacker,target,action,damage,status='none'){
 if(ended||!attacker||!target||!action)return;
 const last=lastSkillUsed.get(attacker);
 const label=actionNames.get(action)||(last&&frame-last.frame<120&&last.type===action.type?last.label:knownAction(action));
 const n=name(attacker),t=name(target),d=Math.round(Math.max(0,Number(damage)||0));
 if(status!=='none'&&STATUS[status])offer('control',[n,label,t,STATUS[status]],5,
   `control:${attacker.playerNum}:${target.playerNum}:${status}:${label}`);
 else if(d>0)offer('impact',[n,label,t,d],d>=Math.max(24,(target.maxHp||100)*.12)?5:3,
   `hit:${attacker.playerNum}:${target.playerNum}:${label}`);
}
function observe(players,options={}){
 if(ended)return;
 frame++;
 if(!roster.length||roster.some(p=>!history.has(p)))reset(players);
 const overtime=!!options.overtime;
 for(const p of players){
  let row=history.get(p);if(!row){row={previous:sample(p),lost:0,healed:0,biggest:0,last:0,low:false,controlled:false};history.set(p,row);}
  const next=sample(p),diff=row.previous.hp-next.hp;
  if(diff>0){row.lost+=diff;row.biggest=Math.max(row.biggest,diff);row.last=diff;}
  if(diff<0){row.healed-=diff;if(-diff>next.maxHp*.06)offer('recovery',[name(p),Math.round(-diff)],3,`heal:${p.playerNum}`);}
  if(!row.low&&next.hp>0&&next.hp/next.maxHp<.27){row.low=true;offer('low',[name(p)],6,`low:${p.playerNum}`);}
  if(!row.controlled&&next.status.some(k=>['freeze','stun','silence','root','timestop'].includes(k))){
    row.controlled=true;offer('control',['상대','상태이상',name(p),'제어'],4,`controlled:${p.playerNum}`);
  }
  if(diff>=next.maxHp*.18&&next.hp>0)offer('heavy',[name(p),Math.ceil(diff)],4,`heavy:${p.playerNum}`);
  row.previous=next;
 }
 if(overtime&&!overTimeWas)offer('overtime',[],10,'overtime');
 overTimeWas=overtime;
 if(frame%480===0){const sorted=players.filter(p=>p.hp>0).sort((a,b)=>b.hp/Math.max(1,b.maxHp)-a.hp/Math.max(1,a.maxHp));
   if(sorted.length>=2)offer('lead',[name(sorted[0])],1,'lead');}
 dispatch();
}
function explanations(players,winner=null,reason=''){
 if(reason==='stopped'||reason==='timeout')return [reason==='stopped'?'경기 중지로 무승부 처리됐습니다.':'결전 종료까지 승부가 나지 않아 무승부입니다.'];
 const fallen=players.filter(p=>p.hp<=0),summaries=[];
 for(const p of fallen){const row=state(p),start=row?.previous;
  const parts=[`${name(p)}: 체력이 0이 되어 탈락했습니다.`];
  if(row?.last>0)parts.push(`마지막 관측 구간에서 약 ${Math.round(row.last)} HP를 잃었습니다.`);
  if(row?.biggest>0)parts.push(`기록된 최대 단일 구간 피해는 약 ${Math.round(row.biggest)} HP입니다.`);
  if(start?.status.length)parts.push(`종료 시점 상태이상: ${start.status.slice(0,3).join(', ')}`);
  else if(start?.dot)parts.push('종료 직전 지속 피해 효과가 활성화되어 있었습니다.');
  if(overTimeWas)parts.push('결전의 최대 체력 비례 피해도 전투에 적용됐습니다.');
  summaries.push(parts.join(' '));
 }
 if(!summaries.length&&winner)return [`${name(winner)}이(가) 마지막까지 생존했습니다. 정확한 결정타는 기록되지 않았습니다.`];
 if(!summaries.length)return ['동시에 쓰러졌거나 승자가 없어 무승부입니다.'];
 return summaries;
}
function finish(players,winner=null,reason=''){
 if(ended)return;ended=true;queue=[];
 const lines=explanations(players,winner,reason);
 const panel=g.document?.getElementById?.('arena-defeat-analysis');
 if(panel){panel.replaceChildren();const h=g.document.createElement('h3');h.textContent='승부 원인 분석';panel.append(h);
  for(const line of lines){const p=g.document.createElement('p');p.textContent=line;panel.append(p);}
  const note=g.document.createElement('small');note.textContent='관측된 체력·상태 변화 기준입니다. 기록되지 않은 공격의 가해자는 추정하지 않습니다.';panel.append(note);panel.hidden=false;}
 speak(winner?`${name(winner)} 승리! 전투가 종료됐습니다.`:'무승부! 치열한 경기가 마무리됐습니다.');
 return lines;
}
g.ArenaBattleDirector=Object.freeze({reset,observe,finish,explanations,skillUsed,skillHit,get frame(){return frame;}});
})(typeof window!=='undefined'?window:globalThis);
