/* Registered combat events -> bounded follow-up action graph.
 * A graph is armed by one actual 100-momentum skill activation. It cannot
 * fabricate a hit, successful dodge, guard or HP delta and never runs itself.
 * All actions are lowered through SignatureRuleSkill/FantasySkillGraph into
 * the existing Forge execution queue. No eval, timers or new attack system.
 */
(function(g){'use strict';
const EVENTS=Object.freeze({
 hit:'실제 공격 명중',
 dodge:'실제 회피 성공',
 guard:'실제 보호막 방어 성공',
 hpDrop:'실제 체력 감소',
 hpGain:'실제 체력 회복'
});
const ACTIONS=Object.freeze({
 shield:'시전자 보호막',
 heal:'시전자 회복',
 wave:'충격파 공격',
 tether:'적 속박'
});
const EVENT_IDS=Object.keys(EVENTS),ACTION_IDS=Object.keys(ACTIONS);
const MAX_STAGES=3,MAX_FIRES=1,WINDOW=8;
const eventPatterns=[
 ['hit',/(?:공격|투사체|탄환|스킬|기술)(?:이|가|을|를)?\s*.{0,15}?(?:적중|명중|맞히|맞추)(?:하|했|되)?(?:면|다면|때)|(?:적|상대|목표)(?:을|를|에게)\s*.{0,9}?(?:맞히|맞추|적중시키|명중시키)(?:면|다면|때)/],
 ['dodge',/(?:위험|공격|상대의\s*공격|적의\s*공격)(?:을|를)?\s*.{0,12}?(?:회피|피하|피했)(?:면|다면|때)|회피에\s*성공하(?:면|거나|였을\s*때)/],
 ['guard',/(?:공격|피해|타격)(?:을|를)?\s*.{0,14}?(?:막아내|막|방어하|막았)(?:면|다면|을\s*때)|방어에\s*성공하(?:면|였을\s*때)|보호막(?:으로|이)\s*.{0,9}?(?:막|방어)(?:으면|하면)/],
 ['hpDrop',/(?:(?:내|자신의|시전자의)\s*)?체력(?:이|을)?\s*.{0,12}?(?:줄어들|감소하|깎이|떨어지|잃|줄었)(?:면|다면|을\s*때)|(?:내가\s*)?(?:피격하|피해를\s*입)(?:면|다면|였을\s*때)|(?:공격|타격)(?:을|를)\s*맞(?:으)?면/],
 ['hpGain',/(?:(?:내|자신의|시전자의)\s*)?체력(?:이|을)?\s*.{0,12}?(?:회복되|증가하|차오르|늘어나)(?:면|다면|을\s*때)/]
];
const actionPatterns=[
 ['shield',/(?:보호막|방어막|실드|배리어)/g],
 ['heal',/(?:회복|치유)/g],
 ['wave',/(?:충격파|파동|폭발)/g],
 ['tether',/(?:속박|구속|결박|포박)/g]
];
const forbidden=/(?:하지\s*않|안\s*하|못\s*하|말아|마라|않는다|금지|무한|영원히|영구히)/;
// Only N real hits since activation AND a live caster HP percent is supported.
// Never treat an omitted or malformed threshold as a success.
const hpPercentPattern=/(?:내|나의|자신의|시전자의)?\s*체력(?:이|은|도)?\s*(\d{1,3})\s*(?:%|퍼센트)\s*(?:이하|미만|아래)(?:라면|이라면|라|이면|일\s*때)?/;
const hitCountPattern=/(?:공격|투사체|탄환|기술|스킬|적|상대)(?:을|를|이|가|에게)?[\s\S]{0,44}?(두|세|네|[2-4])\s*(?:번|회)\s*(?:.{0,13})?(?:명중|적중|맞히|맞추)/;
const secondaryConditional=/(?:그\s*다음|그\s*뒤|이어서|한\s*뒤|그\s*후|그리고).{0,40}?(?:하면|이라면|때만|때마다)/;
function normalize(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
  !Object.hasOwn(EVENTS,value.trigger)||!Array.isArray(value.actions)||
  value.actions.length<1||value.actions.length>MAX_STAGES)return undefined;
 const count=value.minCount===undefined?1:value.minCount;
 const threshold=value.hpBelow;
 if(!Number.isInteger(count)||count<1||count>4)return undefined;
 if(threshold!==undefined&&(!Number.isInteger(threshold)||
  threshold<10||threshold>90))return undefined;
 if((count>1||threshold!==undefined)&&value.trigger!=='hit')return undefined;
 if(threshold!==undefined&&count<2)return undefined;
 const seen=new Set(),actions=[];
 for(const id of value.actions){
  if(typeof id!=='string'||!Object.hasOwn(ACTIONS,id)||seen.has(id))return undefined;
  seen.add(id);actions.push(id);
 }
 return {version:1,trigger:value.trigger,actions,
  ...(count>1?{minCount:count}:{}),
  ...(threshold!==undefined?{hpBelow:threshold}:{})};
}
function parse(text){
 const raw=String(text||'').normalize('NFC').trim().slice(0,300);
 const threshold=hpPercentPattern.exec(raw),hitCount=hitCountPattern.exec(raw);
 let compound=null;
 if(threshold){
  const count=hitCount?({두:2,세:3,네:4}[hitCount[1]]||Number(hitCount[1])):null;
  if(!hitCount||hitCount.index+hitCount[0].length>threshold.index||
   count<2||count>4||Number(threshold[1])<10||Number(threshold[1])>90)
   return {error:'복합 조건은 “공격을 2~4회 명중시키고 내 체력이 10~90% 이하라면” 형식만 지원합니다.'};
  compound={minCount:count,hpBelow:Number(threshold[1]),
   end:threshold.index+threshold[0].length};
 }
 const matches=[];
 for(const [trigger,re] of eventPatterns){
  const m=re.exec(raw);
  if(m)matches.push({trigger,index:m.index,end:m.index+m[0].length,text:m[0]});
 }
 if(!matches.length&&!compound)return null;
 matches.sort((a,b)=>a.index-b.index||a.end-b.end);
 const first=compound?{trigger:'hit',index:hitCount.index,
  end:compound.end}:matches[0];
 const tail=raw.slice(first.end);
 if(matches.some(m=>m.trigger!==first.trigger))
  return {error:'서로 다른 사건이 한 문장에서 섞여 있어 실행 순서를 확정할 수 없습니다.'};
 if(forbidden.test(tail))
  return {error:'부정·무한 반복을 포함한 사건 연쇄는 자동 실행하지 않습니다.'};
 if(secondaryConditional.test(tail)||/(?:피해가\s*들어가면|적이\s*가까우면|체력이\s*낮으면)/.test(tail))
  return {error:'후속 단계의 추가 조건은 이 사건 연쇄에서는 아직 지원하지 않습니다.'};
 const tokens=[];
 for(const [type,re] of actionPatterns){
  const pattern=new RegExp(re.source,'g');let m;
  while((m=pattern.exec(tail))!==null&&tokens.length<16)
   tokens.push({type,index:m.index,end:pattern.lastIndex});
 }
 tokens.sort((a,b)=>a.index-b.index||a.end-b.end);
 if(!tokens.length)return {error:'사건 뒤에 실제로 수행할 보호막·회복·충격파·속박 중 하나를 적어 주세요.'};
 if(tokens.length>MAX_STAGES)
  return {error:'사건 하나에 연결할 후속 행동은 최대 3개입니다.'};
 const graph=normalize({trigger:first.trigger,actions:tokens.map(x=>x.type),
  ...(compound?{minCount:compound.minCount,hpBelow:compound.hpBelow}:{})});
 return graph?{graph}:{
  error:'중복되거나 모호한 후속 행동을 안전하게 하나의 연쇄로 연결할 수 없습니다.'};
}
function toSteps(input){
 const v=normalize(input);
 if(!v||!g.SignatureScratch?.safeAction||!g.FantasySkillGraph?.normalize)return [];
 const defaults={
  shield:{damage:0,duration:1.2,target:'self'},
  heal:{damage:18,duration:1,target:'self'},
  wave:{damage:22,radius:125,target:'nearest'},
  tether:{damage:9,radius:125,duration:1,target:'nearest'}
 };
 const steps=[];
 v.actions.forEach((type,i)=>{
  if(i)steps.push({kind:'wait',seconds:.12});
  steps.push({kind:'cast',action:g.SignatureScratch.safeAction({
   type,count:1,knockback:0,status:'none',...defaults[type]
  })});
 });
 return g.FantasySkillGraph.normalize(steps);
}
function pack(input){
 const graph=normalize(input);
 return graph?[EVENT_IDS.indexOf(graph.trigger),
  ...graph.actions.map(x=>ACTION_IDS.indexOf(x)),
  ...(graph.minCount?[-1,graph.minCount,graph.hpBelow??null]:[])]:null;
}
function unpack(value){
 if(!Array.isArray(value)||value.length<2||value.length>1+MAX_STAGES+3)return undefined;
 const index=value.indexOf(-1),tail=index<0?[]:value.slice(index+1);
 const actionIds=index<0?value.slice(1):value.slice(1,index);
 if(!Number.isInteger(value[0])||actionIds.length<1||
  actionIds.length>MAX_STAGES||!actionIds.every(x=>Number.isInteger(x))||
  (index>=0&&(tail.length!==2||!Number.isInteger(tail[0])||
   !(tail[1]===null||Number.isInteger(tail[1])))))return undefined;
 return normalize({trigger:EVENT_IDS[value[0]],
  actions:actionIds.map(x=>ACTION_IDS[x]),
  ...(index>=0?{minCount:tail[0],
   ...(tail[1]!==null?{hpBelow:tail[1]}:{})}:{})});
}
// Authorized HP events are derived from actual fighter state, never from
// damage text, particles or unconfirmed damage estimates.
function observeHealth(p,previous,current){
 if(typeof previous!=='number'||typeof current!=='number'||
  !Number.isFinite(previous)||!Number.isFinite(current))return null;
 const before=previous,after=current;
 if(before<0||after<0||before===after)return null;
 const type=after<before?'hpDrop':'hpGain';
 g.SignatureLive?.record?.(p,type);
 return type;
}
function verify(input,recipe){
 const gph=normalize(input);
 if(!gph)return false;
 return !!(recipe?.rules||[]).some(rule=>{
  const compiled=normalize(rule.eventGraph);
  if(!compiled||JSON.stringify(compiled)!==JSON.stringify(gph)||
    rule.when!==gph.trigger)return false;
  const stages=(rule.steps||[]).filter(x=>x.kind==='cast').map(x=>x.action?.type);
  return stages.join('|')===gph.actions.join('|');
 });
}
g.CombatEventGraph=Object.freeze({EVENTS,ACTIONS,MAX_STAGES,MAX_FIRES,WINDOW,
 normalize,parse,toSteps,pack,unpack,verify,observeHealth});
})(typeof window!=='undefined'?window:globalThis);
