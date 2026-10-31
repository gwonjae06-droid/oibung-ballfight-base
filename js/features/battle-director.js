/* Observable battle narration and defeat evidence. Never drives the simulation. */
(function(g){'use strict';
let frame=0,lastNarrated=-200,roster=[],history=new Map(),overTimeWas=false,ended=false;
const name=p=>String(p?.name||'파이터').slice(0,24);
const sample=p=>({hp:Number(p?.hp)||0,maxHp:Math.max(1,Number(p?.maxHp)||1),
 status:Object.keys(p?.forgeEffects||{}).filter(key=>p.forgeEffects[key]?.time>0),
 dot:Number(p?.bfDot)||0});
const state=p=>history.get(p);
function speak(text){
 const line=g.document?.getElementById?.('arena-commentary-line');
 if(line){line.textContent=text;line.dataset.pulse=String(frame);line.classList.remove('director-pop');void line.offsetWidth;line.classList.add('director-pop');}
 const live=g.document?.getElementById?.('arena-commentary');
 if(live)live.dataset.event=String(frame);
 if(g.document?.getElementById?.('arena-commentary-voice')?.checked&&g.speechSynthesis&&g.SpeechSynthesisUtterance){
  try{g.speechSynthesis.cancel();const utterance=new g.SpeechSynthesisUtterance(text);utterance.lang='ko-KR';utterance.rate=1.18;g.speechSynthesis.speak(utterance);}catch(_){}
 }
}
function reset(players=[]){
 frame=0;lastNarrated=-200;roster=players.slice();history=new Map();overTimeWas=false;ended=false;
 for(const p of roster)history.set(p,{previous:sample(p),lost:0,healed:0,biggest:0,last:0,low:false,controlled:false});
 const panel=g.document?.getElementById?.('arena-defeat-analysis');if(panel){panel.hidden=true;panel.replaceChildren();}
 speak('경기가 시작됩니다! 공들의 충돌과 기술 싸움에 주목하세요.');
}
function observe(players,options={}){
 if(ended)return;frame++;
 if(!roster.length||roster.some(p=>!history.has(p)))reset(players);
 const overtime=!!options.overtime;
 let special=null;
 for(const p of players){
  let row=history.get(p);if(!row){row={previous:sample(p),lost:0,healed:0,biggest:0,last:0,low:false,controlled:false};history.set(p,row);}
  const next=sample(p),diff=row.previous.hp-next.hp;
  if(diff>0){row.lost+=diff;row.biggest=Math.max(row.biggest,diff);row.last=diff;}
  if(diff<0)row.healed-=diff;
  if(!row.low&&next.hp>0&&next.hp/next.maxHp<.27){row.low=true;special=`${name(p)}의 체력이 위험합니다! 역전할 수 있을까요?`;}
  if(!row.controlled&&next.status.some(k=>['freeze','stun','silence','root','timestop'].includes(k))){row.controlled=true;special=`${name(p)}에게 제어 효과! 지금이 중요한 공격 기회입니다.`;}
  if(diff>=next.maxHp*.18&&next.hp>0)special=`${name(p)}에게 강력한 일격! 체력 ${Math.ceil(diff)} 감소!`;
  row.previous=next;
 }
 if(overtime&&!overTimeWas)special='결전 상태 돌입! 이제 시간이 지날수록 모두에게 압박 피해가 들어갑니다.';
 overTimeWas=overtime;
 if(special&&frame-lastNarrated>=125){lastNarrated=frame;speak(special);}
 else if(frame%420===0){const sorted=players.filter(p=>p.hp>0).sort((a,b)=>b.hp/Math.max(1,b.maxHp)-a.hp/Math.max(1,a.maxHp));
  if(sorted.length>=2){lastNarrated=frame;speak(`${name(sorted[0])}이(가) 체력 비율에서 앞섭니다. 하지만 한 번의 충돌로 뒤집힐 수 있습니다!`);}}
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
 if(ended)return;ended=true;
 const lines=explanations(players,winner,reason);
 const panel=g.document?.getElementById?.('arena-defeat-analysis');
 if(panel){panel.replaceChildren();const h=g.document.createElement('h3');h.textContent='승부 원인 분석';panel.append(h);
  for(const line of lines){const p=g.document.createElement('p');p.textContent=line;panel.append(p);}
  const note=g.document.createElement('small');note.textContent='관측된 체력·상태 변화 기준입니다. 기록되지 않은 공격의 가해자는 추정하지 않습니다.';panel.append(note);panel.hidden=false;}
 speak(winner?`${name(winner)} 승리! 전투가 종료됐습니다.`:'무승부! 치열한 경기가 마무리됐습니다.');
 return lines;
}
g.ArenaBattleDirector=Object.freeze({reset,observe,finish,explanations,get frame(){return frame;}});
})(typeof window!=='undefined'?window:globalThis);
