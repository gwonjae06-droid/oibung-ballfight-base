/* Simulation-observed battle commentary and defeat evidence.
 * No combat damage, cooldown or RNG is changed by commentary. */
(function(g){'use strict';
let frame=0,lastNarrated=-200,roster=[],history=new Map(),overTimeWas=false,ended=false;
let queue=[],recent=[],lastSentence='',phraseSerial=0,actionNames=new WeakMap(),lastSkillUsed=new WeakMap();
let skillTotals=new Map(),confirmedHits=0;
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
// 576 authored-context combinations (nine events × eight leads × eight
// outcomes), in addition to the short legacy lines. Dynamic slots only use
// measured actors, skill names, damage and actual status information.
const COMMENTARY_COMBINATIONS={
 cast:{start:[
  (n,s)=>`${n}이(가) ${s}을(를) 꺼냅니다.`,
  (n,s)=>`이번에 선택한 기술은 ${s}, 사용하는 쪽은 ${n}입니다.`,
  (n,s)=>`${n}, ${s} 시전!`,
  (n,s)=>`${n}의 ${s}이(가) 시작됐습니다.`,
  (n,s)=>`움직임을 바꾸는 ${n}! ${s} 사용입니다.`,
  (n,s)=>`${s}을(를) 준비한 ${n}.`,
  (n,s)=>`${n}이(가) 지금 ${s}을(를) 전개합니다.`,
  (n,s)=>`눈길을 끄는 ${n}의 ${s}!`],
 end:['공격이 어디로 이어질지 지켜보죠.','상대가 어떤 반응을 보일지 궁금합니다.','다음 명중 판정이 중요합니다.','상대의 대응도 주목할 부분입니다.','기술의 결과는 아직 결정되지 않았습니다.','곧 전황에 변화가 생길 수 있습니다.','이제 실제 타격을 확인해야겠군요.','공들의 움직임에 시선이 갑니다.']},
 impact:{start:[
  (n,s,t,d)=>`${n}의 ${s}, ${t}에게 적중했습니다!`,
  (n,s,t,d)=>`${s}이(가) 맞았습니다. ${n}의 공격입니다!`,
  (n,s,t,d)=>`${t}이(가) ${s}에 피격됐습니다!`,
  (n,s,t,d)=>`정확히 맞힌 ${n}! ${s}의 결과입니다.`,
  (n,s,t,d)=>`${n}의 ${s}이(가) ${t}을(를) 잡아냈습니다.`,
  (n,s,t,d)=>`${t}에게 연결되는 ${s}!`,
  (n,s,t,d)=>`유효타를 만든 ${n}, 기술은 ${s}입니다.`,
  (n,s,t,d)=>`${s} 적중! ${n}의 타격이 성공했습니다.`],
 end:['${d} 피해가 확인됐습니다.','이번 피해량은 ${d}입니다.','체력이 ${d}만큼 줄었습니다.','피해 수치 ${d}, 무시할 수 없겠네요.','실제로 ${d} HP를 깎았습니다.','상대 체력에 ${d}의 손실이 생겼습니다.','한 번에 ${d} 피해입니다.','기록된 명중 피해는 ${d}입니다.']},
 control:{start:[
  (n,s,t,st)=>`${n}의 ${s}에 ${t}이(가) 당했습니다.`,
  (n,s,t,st)=>`${s} 적중! ${t}의 행동이 제한됩니다.`,
  (n,s,t,st)=>`${t}에게 걸린 ${s}!`,
  (n,s,t,st)=>`상태이상을 연결한 ${n}!`,
  (n,s,t,st)=>`${s}이(가) 흐름을 끊습니다.`,
  (n,s,t,st)=>`${n}이(가) 제어 기술을 적중시켰습니다.`,
  (n,s,t,st)=>`${t}, ${s}에 걸렸습니다.`,
  (n,s,t,st)=>`지금 ${n}의 ${s}!`],
 end:['현재 효과는 ${st}입니다.','${st}이(가) 적용된 상태입니다.','${st} 때문에 움직임이 달라지겠네요.','${st} 상태가 전황에 영향을 줄 수 있습니다.','${st}에 걸렸으니 다음 반응을 보시죠.','상태 효과 ${st}, 결과가 궁금합니다.','${st}을(를) 버텨야 합니다.','지금의 제어 효과는 ${st}입니다.']},
 low:{start:[(n)=>`${n}의 남은 체력이 위험합니다.`,(n)=>`${n}이(가) 빈사 상태에 들어섰습니다.`,(n)=>`${n}, 체력 게이지가 바닥을 보입니다.`,(n)=>`${n}이(가) 궁지에 몰렸군요.`,(n)=>`위기 속의 ${n}!`,(n)=>`${n}에게 더는 여유가 없습니다.`,(n)=>`${n}, 다음 교전이 고비입니다.`,(n)=>`급격히 위험해진 ${n}의 상황.`],
 end:['회복이나 회피가 필요해 보입니다.','이제 작은 타격도 치명적일 수 있습니다.','마지막 한 방에 승부가 갈릴까요?','상대의 다음 기술이 중요합니다.','반격할 틈을 만들어야겠죠.','이대로 끝나지는 않을지 지켜봅니다.','아직 역전 가능성은 남아 있습니다.','끝까지 살아남을 수 있을까요?']},
 heavy:{start:[(n,d)=>`${n}이(가) 큰 충격을 받았습니다!`,(n,d)=>`${n}에게 강한 공격이 들어갑니다!`,(n,d)=>`묵직한 타격을 버티는 ${n}!`,(n,d)=>`${n}의 체력이 크게 떨어집니다.`,(n,d)=>`한 번의 교전에서 크게 밀린 ${n}!`,(n,d)=>`${n}, 이번 피해는 큽니다.`,(n,d)=>`무거운 공격을 피하지 못한 ${n}.`,(n,d)=>`${n}에게 예상보다 큰 손실이 생겼습니다.`],
 end:['감소량은 ${d} HP입니다.','${d} 피해를 한 번에 받았습니다.','체력이 ${d}나 빠졌습니다.','이번에 ${d} 피해가 기록됐습니다.','${d}의 체력 손실이 확인됩니다.','피해 수치는 ${d}입니다.','한 번에 ${d}만큼 깎였습니다.','총 ${d} HP가 줄어든 장면입니다.']},
 lead:{start:[(n)=>`${n}이(가) 체력 면에서 앞섭니다.`,(n)=>`현재 흐름은 ${n} 쪽입니다.`,(n)=>`${n}이(가) 생존력에서 우세합니다.`,(n)=>`유리한 입장은 ${n}입니다.`,(n)=>`${n}, 지금까지의 체력 교환이 좋군요.`,(n)=>`체력 게이지로 보면 ${n}의 우세입니다.`,(n)=>`${n}이(가) 조금 더 여유가 있습니다.`,(n)=>`이번 대치는 ${n} 쪽으로 기웁니다.`],
 end:['하지만 한 번의 충돌로 바뀔 수 있죠.','상대의 역전 기술을 조심해야 합니다.','아직 마지막 승자는 아닙니다.','다음 공격 기회가 중요합니다.','무리한 돌진은 오히려 위험하겠네요.','지금의 차이를 지킬 수 있을까요?','끝까지 버텨야 승리입니다.','변수는 여전히 많습니다.']},
 overtime:{start:[()=>`결전 상태가 시작됐습니다!`,()=>`시간이 길어지자 결전 규칙이 발동합니다.`,()=>`장기전은 여기까지, 결전에 돌입합니다!`,()=>`더는 버티기만 할 수 없는 전장입니다.`,()=>`결전 경고! 양쪽 모두 압박을 받습니다.`,()=>`전투가 마지막 국면으로 접어듭니다.`,()=>`공들이 서로 결론을 내야 할 때입니다.`,()=>`정체된 전투가 결전으로 전환됩니다.`],
 end:['최대 체력에 비례한 피해가 시작됩니다.','두 선수 모두 체력을 잃게 됩니다.','승부를 마무리할 시간이군요.','방어만으로는 오래 버티기 어렵습니다.','지금부터는 적극적인 공격이 유리할 수 있습니다.','회복과 공격의 균형이 중요합니다.','이제 시간도 적입니다.','끝까지 남는 쪽이 승리합니다.']},
 recovery:{start:[(n,d)=>`${n}이(가) 체력을 회복했습니다.`,(n,d)=>`위기에서 버티는 ${n}, 회복 성공!`,(n,d)=>`${n}에게 회복 효과가 들어옵니다.`,(n,d)=>`다시 힘을 얻는 ${n}!`,(n,d)=>`${n}의 체력 바가 올라갑니다.`,(n,d)=>`지금 ${n}에게 필요한 회복이 들어왔습니다.`,(n,d)=>`${n}이(가) 버티기에 성공합니다.`,(n,d)=>`생존을 노리는 ${n}의 회복!`],
 end:['회복량은 ${d} HP입니다.','${d} 체력을 돌려받습니다.','다시 ${d} HP를 채웠습니다.','체력 상승량은 ${d}입니다.','${d}만큼 생존력이 돌아왔습니다.','기록된 회복은 ${d}입니다.','${d} HP 회복, 반격의 기회입니다.','${d}만큼 회복했습니다.']},
 comeback:{start:[(n)=>`${n}이(가) 다시 반격을 준비합니다.`,(n)=>`재정비한 ${n}이(가) 움직입니다.`,(n)=>`${n}, 위기를 넘기고 돌아옵니다.`,(n)=>`${n}의 흐름이 조금씩 살아납니다.`,(n)=>`한 번 버틴 ${n}, 다음 공격을 노립니다.`,(n)=>`${n}이(가) 전세를 뒤집으려 합니다.`,(n)=>`다시 싸울 힘을 얻은 ${n}!`,(n)=>`${n}, 아직 경기가 끝나지 않았습니다.`],
 end:['다음 타격에 주목하죠.','회복 뒤의 판단이 중요합니다.','이제 공격 타이밍을 잡아야 합니다.','곧 반격이 나올 수도 있습니다.','다음 충돌이 관건이겠네요.','상대의 대응도 중요합니다.','이 흐름을 이어 갈 수 있을까요?','승부는 여전히 열려 있습니다.']}
};
// Expand only contexts for which we have real observations; 9×64 = 576.
for(const [kind,parts] of Object.entries(COMMENTARY_COMBINATIONS)){
 const generated=[];
 for(let i=0;i<8;i++)for(let j=0;j<8;j++){
  generated.push((...args)=>parts.start[i](...args)+' '+parts.end[j].replace(/\$\{(\w+)\}/g,(_,key)=>String(args[{n:0,s:1,t:2,d:3,st:3}[key]]??'')));
 }
 variants[kind].push(...generated);
}
const catalogSize=Object.values(COMMENTARY_COMBINATIONS).reduce((n,v)=>n+v.start.length*v.end.length,0);
function phrase(kind,args=[]){const list=variants[kind]||[];if(!list.length)return '';
 const index=phraseSerial++%list.length;
 let sentence=typeof list[index]==='function'?list[index](...args):list[index];
 if(sentence===lastSentence){const alt=list[(index+1)%list.length];sentence=typeof alt==='function'?alt(...args):alt;}
 return sentence;
}
function installAvatar(){const panel=g.document?.getElementById?.('arena-commentary');if(!panel||typeof panel.querySelector!=='function'||typeof g.document?.createElement!=='function'||panel.querySelector('.commentator-face'))return false;
 const img=g.document.createElement('img');img.id='arena-commentator-face';img.className='commentator-face';
 img.src='assets/commentator-neutral.svg';img.alt='경기 해설자';img.setAttribute('aria-hidden','true');
 panel.prepend(img);return true;
}
if(!installAvatar())g.document?.addEventListener?.('DOMContentLoaded',installAvatar,{once:true});
const EXPRESSIONS=Object.freeze({start:'neutral',cast:'talk',impact:'talk',control:'surprise',low:'surprise',heavy:'surprise',lead:'neutral',overtime:'grim',recovery:'talk',comeback:'talk'});
function expression(kind){const img=g.document?.getElementById?.('arena-commentator-face');if(!img)return;
 const mood=EXPRESSIONS[kind]||'neutral';img.src='assets/commentator-'+mood+'.svg';
 img.alt='해설자 '+({neutral:'기본',talk:'열정',surprise:'놀람',grim:'긴장'}[mood]||'기본')+' 표정';
 img.classList?.toggle?.('exclaim',mood==='surprise');
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
 expression(choice.kind);
 if(speak(sentence)){
  lastNarrated=frame;recent.push({key:choice.key,frame});if(recent.length>15)recent.shift();
 }
}
function reset(players=[]){
 expression('start');
 frame=0;lastNarrated=0;roster=players.slice();history=new Map();overTimeWas=false;ended=false;
 queue=[];recent=[];actionNames=new WeakMap();lastSkillUsed=new WeakMap();skillTotals=new Map();confirmedHits=0;
 for(const p of roster)history.set(p,{previous:sample(p),lost:0,healed:0,biggest:0,last:0,low:false,controlled:false});
 const panel=g.document?.getElementById?.('arena-defeat-analysis');if(panel){panel.hidden=true;panel.replaceChildren();}
 // Tower enemies are already prepared in the intermission. Narrate only
 // once the player presses Next Floor and the actual countdown begins.
 if(!g.ArenaTower?.active)speak(phrase('start'));
}
function floorReady(level,realm){
 const lv=Math.max(1,Number(level)||1),name=String(realm||'탑');
 const intros=[`${lv}층 시작! ${name}의 다음 상대가 나옵니다.`,
  `${lv}층입니다! 카운트다운이 끝나면 대결이 시작됩니다.`,
  `${name} ${lv}층 도전! 어떤 기술이 통할까요?`,
  `${lv}층 준비 완료. 이번 충돌도 지켜보시죠.`,
  `${lv}층에 도착했습니다. 상대의 움직임을 보겠습니다.`,
  `${name} ${lv}층, 새로운 대결을 준비합니다.`];
 return speak(intros[(lv+phraseSerial++)%intros.length]);
}
function skillUsed(attacker,target,action,skillName){
 if(ended||!attacker||!action)return;
 const label=String(skillName||knownAction(action)).slice(0,28);
 if(typeof action==='object')actionNames.set(action,label);
 lastSkillUsed.set(attacker,{label,type:action.type,frame});
 // When a multi-block combo hits, report the result ahead of mere casting.
 offer('cast',[name(attacker),label,name(target)],1,`cast:${attacker.playerNum}:${label}`);
}
function legacyHit(attacker,target,damage,type='일반 공격'){
 if(ended||!attacker||!target||!(damage>0))return;
 let map=skillTotals.get(attacker);if(!map){map=new Map();skillTotals.set(attacker,map);}
 const label=String(ACTION[type]||type||'기본 공격').slice(0,28);
 const row=map.get(label)||{name:label,damage:0,hits:0,statuses:{}};
 row.damage+=Math.round(damage);row.hits++;map.set(label,row);
}
function constructHit(shooterNum,obj,damage){
 // A destructible summon is not a fighter and cannot determine match victory.
 const attacker=roster.find(p=>p.playerNum===shooterNum);if(!attacker||ended)return;
 let map=skillTotals.get(attacker);if(!map){map=new Map();skillTotals.set(attacker,map);}
 const label='소환체·설치물 파괴';
 const row=map.get(label)||{name:label,damage:0,hits:0,statuses:{}};
 row.damage+=Math.min(Math.max(0,obj.maxHp||0),Math.round(damage));row.hits++;map.set(label,row);
}
function skillHit(attacker,target,action,damage,status='none'){
 if(ended||!attacker||!target||!action)return;
 const last=lastSkillUsed.get(attacker);
 const label=actionNames.get(action)||(last&&frame-last.frame<120&&last.type===action.type?last.label:knownAction(action));
 const n=name(attacker),t=name(target),d=Math.round(Math.max(0,Number(damage)||0));
 if(d>0||status!=='none'){
  let fighter=skillTotals.get(attacker);if(!fighter){fighter=new Map();skillTotals.set(attacker,fighter);}
  const entry=fighter.get(label)||{name:label,damage:0,hits:0,statuses:{}};
  if(d>0){entry.damage+=d;entry.hits++;confirmedHits++;}
  if(status!=='none')entry.statuses[status]=(entry.statuses[status]||0)+1;
  fighter.set(label,entry);
 }
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
 if(!summaries.length)summaries.push('동시에 쓰러졌거나 승자가 없어 무승부입니다.');
 return summaries;
}
function reportLines(players=[]){
 const lines=[];
 for(const fighter of players){
  const row=history.get(fighter),group=skillTotals.get(fighter);
  const total=[...(group?.values()||[])].reduce((sum,value)=>sum+value.damage,0);
  lines.push(name(fighter)+' · 확인된 기술 피해 '+total+' HP / 회복 '+Math.round(row?.healed||0)+' HP / 받은 피해 '+Math.round(row?.lost||0)+' HP');
  for(const info of [...(group?.values()||[])].sort((a,b)=>b.damage-a.damage))
   lines.push(info.name+': '+info.damage+' 피해 / '+info.hits+'회 유효타'+
    (Object.keys(info.statuses).length?' / 상태이상 '+Object.entries(info.statuses).map(([key,n])=>key+' '+n+'회').join(', '):''));
 }
 lines.push('기술별 수치는 확인된 명중만 포함합니다. 낙하·지속 피해 등은 기술별 합계에서 누락될 수 있습니다.');
 return lines;
}
function finish(players,winner=null,reason=''){
 if(ended)return;ended=true;queue=[];
 const lines=explanations(players,winner,reason);
 const panel=g.document?.getElementById?.('arena-defeat-analysis');
 if(panel){panel.replaceChildren();const h=g.document.createElement('h3');h.textContent='승부 원인 분석';panel.append(h);
  for(const line of lines){const p=g.document.createElement('p');p.textContent=line;panel.append(p);}
  for(const fighter of players){
   const row=history.get(fighter),group=skillTotals.get(fighter);
   const sub=g.document.createElement('h4');sub.textContent=name(fighter)+' · 피해 및 생존 분석';panel.append(sub);
   const stat=g.document.createElement('p');stat.textContent=
    '확인된 기술 피해 '+[...(group?.values()||[])].reduce((s,x)=>s+x.damage,0)+' HP · '
    +'관측 회복 '+Math.round(row?.healed||0)+' HP · 받은 피해 '+Math.round(row?.lost||0)+' HP';panel.append(stat);
   for(const info of [...(group?.values()||[])].sort((a,b)=>b.damage-a.damage)){
    const line=g.document.createElement('p');
    line.textContent=info.name+': '+info.damage+' 피해 / '+info.hits+'회 유효타'+
      (Object.keys(info.statuses).length?' / 상태이상 '+Object.entries(info.statuses).map(([key,n])=>key+' '+n+'회').join(', '):'');
    panel.append(line);
   }
  }
  const note=g.document.createElement('small');note.textContent='기술별 피해는 확인된 커스텀 공격만 집계합니다. 기본 챔피언 공격, 낙하, 지속 피해, 결전 피해는 기술별 합계에서 제외될 수 있습니다. 회복·받은 피해는 체력 변화 관측치입니다.';panel.append(note);panel.hidden=false;}
 speak(winner?`${name(winner)} 승리! 전투가 종료됐습니다.`:'무승부! 치열한 경기가 마무리됐습니다.');
 return lines;
}
g.ArenaBattleDirector=Object.freeze({reset,observe,finish,reportLines,explanations,skillUsed,skillHit,legacyHit,constructHit,floorReady,get skillTotals(){return skillTotals;},get frame(){return frame;},catalogSize});
})(typeof window!=='undefined'?window:globalThis);
