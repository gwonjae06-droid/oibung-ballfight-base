/* Semantic Intent Composer v2: verbs/relations outrank subject nouns.
 * Every plan is safe DATA lowered to already-registered actions, force laws
 * and reusable VFX. No generated JavaScript, API, dynamic eval or networking.
 * Audit returns omissions instead of treating "compiled" as "understood".
 */
(function(g){'use strict';
const cap=(v,a,b,f=a)=>Number.isFinite(Number(v))?Math.max(a,Math.min(b,Number(v))):f;
const PATTERNS=Object.freeze({
 homing:/추적|유도탄|유도\s*(?:미사일|탄환|투사체|로켓)|(?:적|상대|목표).{0,12}(?:따라가|쫓아가|뒤쫓|좇|따라붙)/,
 orbit:/공전|원궤도|궤도를\s*돌|시계\s*방향.{0,14}(?:돌|회전)|위성처럼\s*돌|주위를\s*돌/,
 spin:/회전시키|회전력|빙빙|휘말리|소용돌이/,
 attract:/끌어당|당기|흡인|인력|중력|자기력/,
 repel:/밀어내|밀쳐|튕겨내|반발|척력|밀어낸/,
 tether:/속박|구속|결박|포박|(?:사슬|실|밧줄|촉수).{0,18}(?:붙잡|묶|휘감|결박)|붙잡.{0,8}휘감/,
 heal:/회복|치유|재생|치료|고쳐/,
 shield:/보호막|방어막|실드|장벽|방벽|방어\s*막|보호해/,
 teleport:/순간이동|텔레포트|공간이동|워프하여/,
 damage:/공격|피해|타격|찌르|베어|폭발|발사|쏘|후려|브레스|내리찍|때리/,
 split:/분열|갈라지|쪼개|조각으로\s*나뉘|산산이\s*(?:깨지|부서)|파편으로\s*(?:깨지|부서)/,
 area:/영역|구역|장판|범위|반경\s*\d|주변|퍼지|퍼진/,
 hitExplosion:/(?:명중|맞|적중|착탄|충돌|닿).{0,26}(?:폭발|터지|터뜨|터져)/,
 hitSplit:/(?:명중|맞|적중|착탄|충돌|닿).{0,35}(?:분열|갈라지|쪼개|깨지|부서지|조각|산산이)/,
 wallStore:/(?:벽|벽면).{0,48}(?:충격|운동량|에너지).{0,34}(?:저장|축적|모아|모은|쌓)/,
 fade:/점점\s*약|서서히\s*약|시간이\s*지날수록\s*약|시간에\s*따라.{0,10}약/,
 law:/물리\s*법칙|새로운?\s*법칙|힘의\s*법칙|힘의\s*장|중력장|자기장|역중력/,
 force:/마찰|중력|자기장|자기력|끌어당|밀어내|회전력|공전|탄성|용수철|진동|파동|인력|척력|가속|감속/,
 requestedTurret:/포탑|터렛|센트리|자동\s*포대/,
 relayNoun:/운동량|충격량|에너지|마력|동력|전력/,
 relayAbsorb:/흡수|저장|모아|축적/,
 relayRelease:/방출|되돌|발산|내보내|반사|폭발/
});
const LABELS=Object.freeze({
 homing:'목표 추적',orbit:'실제 궤도 운동',attract:'흡인력',spin:'회전력',
 repel:'밀어내기',tether:'실제 속박',heal:'회복',shield:'보호막',
 teleport:'순간이동',damage:'피해 판정',split:'탄환 분열',
 area:'영역 동작',hitExplosion:'명중 시 폭발',hitSplit:'명중 순간 분열',
 fade:'시간에 따른 힘 감쇠',relay:'운동량 흡수·저장·방출',
 wallStore:'벽 충돌 에너지 누적 후 조건부 방출',
 opposed:'서로 반대 방향의 힘'
});
const UNSUPPORTED=Object.freeze([
 {label:'웹페이지·브라우저·다른 컴퓨터의 실제 조작',
  re:/(?:웹페이지|브라우저|컴퓨터|PC|탭).{0,35}(?:해킹|조종|멈추|얼리|열어|닫아)|(?:해킹|조종).{0,25}(?:웹페이지|브라우저|컴퓨터|PC)/},
 {label:'적의 기억·정신·존재를 직접 개조',
  re:/(?:기억|생각|정신|의식|의지|존재).{0,25}(?:삭제|지우|조종|통제|개조|바꾸|바꿔|읽어)|(?:상대|적).{0,15}기억.{0,15}(?:지우|조작)/},
 {label:'상대가 사용한 기술을 실시간 학습·완전 복제',
  re:/(?:스킬|능력|기술).{0,20}(?:학습|훔쳐|복사|복제)|(?:학습|복제).{0,15}(?:스킬|능력|기술)/},
 {label:'아직 진행되지 않은 경기 결과의 예지·변조',
  re:/(?:다음\s*판|다음\s*경기|미래의\s*결과|결과를\s*미리).{0,35}(?:결과|계산|뒤집|변조|조작|예측)/},
 {label:'무제한 영구·절대 무적 상태',
  re:/(?:영원히|영구|무한대|무한히).{0,22}(?:무적|절대\s*방어|영구\s*보호|무한히\s*커)|(?:절대\s*무적|영구\s*무적|무한\s*증식)/},
 {label:'차원의 물리적 접기와 4차원 이상의 객체 조작',
  re:/\d{1,2}차원.{0,22}(?:접|비틀|구부리|충돌|변형)|(?:접|뒤집).{0,12}\d{1,2}차원/}
]);
function analyze(input){
 const raw=String(input||'').normalize('NFC').trim().slice(0,300);
 const intent=Object.fromEntries(Object.entries(PATTERNS).map(([id,re])=>[id,re.test(raw)]));
 // True storage/release requires both phases. "absorbs damage" alone
 // must not be mislabeled as a kinetic battery.
 intent.relay=intent.relayNoun&&intent.relayAbsorb&&intent.relayRelease;
 // A stored wall impact is not an enemy projectile's on-hit burst.
 // Distinguish a separately named victim hit from a boundary collision.
 if(intent.wallStore&&!/(?:명중|적중|착탄|맞으면|적에게\s*닿)/.test(raw))
  intent.hitExplosion=false;
 intent.opposed=/반대\s*방향|서로\s*반대|정반대로/.test(raw)&&
  /중력/.test(raw)&&/(?:전자석|자기력|자기장|자석)/.test(raw);
 intent.noEffect=/아무\s*(?:효과|기술|스킬|행동).{0,18}(?:않|안|없)|가만히\s*있는다/.test(raw);
 intent.unsupported=UNSUPPORTED.filter(def=>def.re.test(raw)).map(x=>x.label);
 // Storage-only/negated releases must not silently invent an attack.
 if(intent.wallStore){
  const discharge=/(?:방출|발산|폭발|터뜨|터지|내보내)/.test(raw);
  const negated=/(?:방출|폭발|터뜨|터지|내보내).{0,6}(?:하지\s*않|안\s*하|않는|않는다|하지\s*마)/.test(raw);
  if(!discharge||negated)
   intent.unsupported.push('누적 충격의 유효한 방출 동작이 지정되지 않음');
 }
 if(intent.noEffect&&!/대신|그러나|그\s*후|다음에/.test(raw))
  intent.unsupported.push('아무 행동도 하지 않는 선택은 공격 스킬이 아닙니다');
 // A vague fading "law" without an operator has no physical direction.
 if(intent.law&&intent.fade&&!intent.force)
  intent.unsupported.push('시간에 따라 약해질 힘의 종류와 방향이 지정되지 않음');
 const requested=[
  ...['homing','orbit','attract','spin','repel','tether','heal','shield',
   'teleport','damage','split','area','hitExplosion','hitSplit','fade','relay','opposed','wallStore']
   .filter(k=>intent[k])
 ];
 const priority=!!(intent.wallStore||intent.relay||intent.orbit||intent.homing||intent.tether||
  intent.repel||(intent.heal&&intent.shield)||(intent.teleport&&intent.damage)||
  intent.opposed||(intent.law&&intent.fade)||(intent.hitSplit)||
  intent.split||(intent.area&&/(?:적|상대).{0,22}피해|(?:피해|공격).{0,15}(?:적|상대)/.test(raw)));
 return {...intent,requested,priority,raw};
}
function flatten(recipe){
 const out=[];
 const walk=steps=>{for(const s of steps||[]){
  if(s.action&&s.kind==='cast')out.push(s.action);
  walk(s.body);walk(s.then);walk(s.else);
 }};
 for(const r of recipe?.rules||[]){
  if(r.steps?.length)walk(r.steps);
  else if(r.action)out.push(r.action);
 }
 return out;
}
function verify(input,recipe){
 const intent=typeof input==='string'?analyze(input):input;
 const actions=flatten(recipe);
 const has=(type)=>actions.some(a=>a.type===type);
 const terms=ops=>actions.some(a=>a.type==='phenomenon'&&
  (a.law?.terms||[]).some(t=>ops.includes(t.op)));
 const shot=actions.some(a=>a.type==='shot'&&a.fusion?.homing);
 const bits=Object.create(null);
 bits.homing=shot||has('homing');
 bits.orbit=has('orbit')||terms(['orbit']);
 bits.attract=has('tether')||has('pull')||has('vortex')||terms(['attract','gravity','orbit']);
 bits.spin=has('vortex')||terms(['spin','orbit']);
 bits.repel=has('repulse')||terms(['repel']);
 bits.tether=has('tether');
 bits.heal=has('heal')||has('regen')||has('lifebloom');
 bits.shield=has('shield')||has('fortify');
 bits.teleport=has('blink')||has('portal')||has('swap');
 bits.damage=actions.some(a=>a.damage>0&&g.ActionRegistry?.get?.(a.type)?.offense);
 bits.split=actions.some(a=>a.type==='splitshot'||a.type==='shot'&&a.fusion?.split);
 bits.area=actions.some(a=>['zone','wave','nova','phenomenon','blackhole','vortex'].includes(a.type));
 bits.hitExplosion=actions.some(a=>a.fusion?.impact==='burst');
 // Actual contact-triggered physical fracture is distinct from timed fracture.
 bits.hitSplit=actions.some(a=>a.type==='shot'&&
  a.fusion?.split===true&&a.fusion?.splitTrigger==='hit');
 bits.fade=actions.some(a=>a.type==='phenomenon'&&a.law?.decay==='fade');
 bits.relay=has('kinetic_relay');
 bits.wallStore=(recipe?.rules||[]).some(r=>r.when==='wallStored'&&
  r.action?.type==='nova'&&Number(r.wallHits)>=2);
 bits.opposed=actions.some(a=>a.type==='phenomenon'&&
  (a.law?.terms||[]).some(t=>['attract','gravity'].includes(t.op))&&
  (a.law?.terms||[]).some(t=>t.op==='repel'));
 // Some intents are actor properties, not semantic constraints for a
 // particular phrase ("relay" naturally creates inward motion).
 const requested=intent.requested||[];
 const matched=requested.filter(k=>bits[k]),missing=requested.filter(k=>!bits[k]);
 const approximations=[];
 if(intent.requestedTurret&&bits.homing&&has('shot')&&!has('turret'))
  approximations.push('포탑 형태는 기존 회로·기계 이펙트로 근사합니다. 추적탄은 실제 발사체로 구현하지만 자동 포탑 본체가 발사하는 연동 구조는 아닙니다.');
 if(/레일건|레이저|광선|빔/.test(intent.raw||'')&&bits.homing&&has('shot'))
  approximations.push('광선·레일건의 즉시 명중 대신 실제 추적 가능한 탄환을 사용합니다. 원래 무기의 작동 방식과 완전히 같지는 않습니다.');
 if(intent.hitSplit&&!bits.hitSplit)
  approximations.push('요청한 명중 순간 분열을 전투 실행 계획에서 확인하지 못했습니다.');
 const conceptMatches=g.SemanticConceptAtlas?.match?.(intent.raw||'')||[];
 const named=g.ImaginationConcepts?.CATALOG?.some(d=>d.re.test(intent.raw||''))||false;
 if(!named&&!conceptMatches.length&&/(?:의\s*(?:역설|지평선|중력|인과율|마찰|지문|질량)|불가능한\s*|철학적\s*|추억의\s*|서사의\s*)/.test(intent.raw||''))
  approximations.push('입력한 고유 추상 개념의 독자적 법칙은 미정의입니다. 명시한 행동만 기존 물리와 공용 이펙트로 표현합니다.');
 return {requested,matched,missing,approximations,
  complete:missing.length===0&&approximations.length===0,
  hasAction:actions.length>0,
  actions:actions.map(a=>a.type)};
}
function compose(input){
 const intent=analyze(input),raw=intent.raw;
 if(!raw)return null;
 if(intent.unsupported.length)return {ok:false,method:'offline-intent-validation',
  error:'이 문장의 일부 요구는 실제 구현할 수 없습니다: '+intent.unsupported.join(' / ')+
   '. 지원하는 전투 안의 행동과 표현으로 다시 설명해 주세요.'};
 if(!intent.priority)return null;
 // Existing compilers remain authoritative when they already implement
 // every explicit action/relationship, preserving legacy and saved skills.
 const prior=g.ImaginationConcepts?.interpret?.(raw)||
  g.PhysicsLawEngine?.interpret?.(raw);
 if(prior?.ok){
  const proof=verify(intent,prior.recipe);
  if(proof.complete)return null;
 }
 const atlas=g.SemanticConceptAtlas?.match?.(raw,8)||[];
 const legacy=g.ImaginationConcepts?.CATALOG?.filter(d=>d.re.test(raw))||[];
 const concepts=[...legacy,...atlas].slice(0,10);
 const fx=g.SkillFXComposer?.infer?.(raw),older=prior?.recipe?.rules?.[0]?.action;
 const motifs=[...new Set([
  ...concepts.map(c=>c.visual?.[0]).filter(Boolean),
  ...(older?.visual?.layers||[]).map(x=>x.kind),
  ...(fx?.layers||[]).map(x=>x.kind),
  ...(intent.orbit?['orbit','coil']:intent.relay?['rings','coil']:
    intent.tether?['chains','coil']:intent.homing?['trail']:intent.area?['rings']:[])
 ])].slice(0,5);
 if(!motifs.length)motifs.push('rings');
 const theme=older?.visual?.color||fx?.color||'#a89fe3';
 const visual=g.MetaphorVisuals?.normalize?.({
  shape:g.MetaphorVisuals?.shapeFor?.(raw)||'aura',color:theme,scale:fx?.scale||1.55,
  charge:!!fx?.charge||intent.relay,
  layers:motifs.map(kind=>({kind,color:theme,power:1.15,spin:1}))
 });
 const numeric=g.KoreanSkillParameters?.analyze?.(raw),values=numeric?.values||{};
 const count=values.count??(raw.match(/(\d+)\s*(?:발|개|개의\s*탄환)/)?.[1]||
  (/세\s*(?:개|발)/.test(raw)?3:/네\s*(?:개|발)/.test(raw)?4:
    /두\s*(?:개|발)/.test(raw)?2:1));
 const damage=cap(values.damage,0,120,23),radius=cap(values.radius,30,300,155),
  duration=cap(values.duration,.2,8,2);
 const speed=cap(values.speed,2,14,6);
 const status=older?.status||'none';
 const make=(type,override={})=>g.SignatureScratch?.safeAction?.({
  type,target:'nearest',pattern:'direct',damage,
  count,radius,duration,speed,knockback:1.8,
  status,visual,...override
 });
 if(!g.SignatureScratch||!g.SignatureRuleSkill)return null;
 const actions=[],notes=['문장 속 행동·조건을 개념 명사보다 먼저 분해하여 실행 동작을 선택했습니다.'];
 if(intent.wallStore){
  // This 100-momentum activation arms a real collision-reactive window;
  // only the boundary solver generates events, and no normal attack occurs.
  const wallHits=cap(values.wallHits,2,6,3);
  const action=make('nova',{status:'none',damage,count:1,visual});
  if(action.type!=='nova'||!g.ActionRegistry?.get?.('nova'))
   return {ok:false,error:'누적 충격을 실제 범위 피해로 방출하는 동작이 없습니다.'};
  const recipe=g.SignatureRuleSkill.normalize({window:18,
   rules:[{when:'wallStored',wallHits,interval:.35,action}]});
  return {ok:true,name:'충격 저장 후 방출',recipe,
   method:'offline-verb-first-semantic-composer',
   plan:{strategy:'reuse',genre:'causal',domains:['physics'],
    conceptIds:['wall-impulse-storage'],action:'nova',visualKinds:motifs,
    explanation:'기세 100 발동 후 벽의 실제 반사 충격량을 '+wallHits+'회 누적하고 자신 중심에서 범위 피해를 줍니다.'},
   notes:['충격 누적은 기세 발동 이후 18초 동안 적용되며 충돌 26프레임 중복 방지와 2~6회 상한을 사용합니다.',
    '시전자 중심의 범위 피해와 명시한 폭발 색상을 기존 전투 이펙트로 출력합니다.'],
   semanticVerification:verify(intent,recipe)};
 }else if(intent.heal&&intent.shield){
  actions.push(make('regen',{damage:0}),make('shield',{damage:0}));
 }else if(intent.relay){
  actions.push(make('kinetic_relay',{relay:g.ImaginationConcepts?.normalizeRelay?.({
   charge:.8,release:.6,radius}),damage}));
  notes.push('운동량을 흡수해 저장했다가 방출하는 실전 물리 동작을 재사용합니다.');
 }else if(intent.orbit||intent.opposed||intent.attract&&intent.spin||intent.law&&intent.force||
   intent.fade&&intent.force){
  let ops;
  if(intent.opposed)ops=['gravity','repel'];
  else if(intent.orbit)ops=['orbit'];
  else {
   ops=[intent.attract?'attract':null,intent.repel?'repel':null,
    intent.spin?'spin':null].filter(Boolean);
   if(!ops.length&&intent.force)ops=[/마찰|감속/.test(raw)?'drag':
    /진동|파동/.test(raw)?'pulse':'attract'];
  }
  const law=g.PhysicsLawEngine?.normalize?.({
   anchor:/적\s*주변|상대\s*주변/.test(raw)?'target':'caster',
   radius,duration,damage,
   decay:intent.fade?'fade':/점점\s*강|서서히\s*강/.test(raw)?'grow':'steady',
   terms:ops.map(op=>({op,strength:2.3,falloff:'linear',rest:90,
    sign:/시계\s*방향/.test(raw)&&op==='orbit'?-1:1}))
  });
  if(!law)return {ok:false,error:'지정한 힘을 실행 가능한 물리 연산자로 바꾸지 못했습니다.'};
  actions.push(make('phenomenon',{law,damage}));
  if(intent.orbit)notes.push('공전은 전투 상대를 움직이는 궤도력으로 구현합니다. 발사체 자체가 공전하는 것은 아닙니다.');
 }else if(intent.tether){
  actions.push(make('tether'));
 }else if(intent.repel){
  actions.push(make('repulse'));
 }else if(intent.homing||intent.split||intent.hitSplit){
  const existing=g.ConceptFusion?.analyze?.(raw);
  actions.push(make('shot',{
   fusion:g.ConceptFusion?.normalize?.({
    element:existing?.fusion?.element||'none',form:'projectile',
    homing:intent.homing,split:intent.split||intent.hitSplit,
    splitTrigger:intent.hitSplit?'hit':'age',
    fragments:cap(count,2,4,3),
    impact:intent.hitExplosion?'burst':existing?.impact||'none',
    radius:cap(radius,35,160,90)
   })
  }));
  if(intent.homing&&/레일건|레이저|광선|빔|포탑/.test(raw))
   notes.push('추적 기능을 살리기 위해 광선·포탑 공격을 추적 투사체로 근사합니다. 원래 무기의 정확한 발사 구조는 아닙니다.');
 }else if(intent.teleport&&intent.damage){
  const blink=make('blink',{damage:0});
  const strike=make('wave',{damage});
  const interval=Math.max(.8,Math.min(4,duration));
  const recipe=g.SignatureRuleSkill.normalize({window:Math.max(4,duration+2),
   rules:[{when:'pulse',interval,action:blink,steps:g.FantasySkillGraph?.normalize?.([
    {kind:'cast',action:blink},{kind:'wait',seconds:.15},{kind:'cast',action:strike}
   ])}]});
  if(!recipe?.rules?.length)return null;
  const semantic=verify(intent,recipe);
  return {ok:true,name:'문장 복합 동작',recipe,
   method:'offline-verb-first-semantic-composer',
   plan:{strategy:'reuse',genre:'semantic',domains:[],conceptIds:concepts.map(c=>c.id),
    action:blink.type,visualKinds:motifs,explanation:'순간이동 후 이동 보호 시간이 끝나면 후속 공격 실행'},
   notes,semanticVerification:semantic};
 }else if(intent.area)actions.push(make('zone'));
 else return null;
 if(!actions.length||actions.some(a=>!g.ActionRegistry?.get?.(a.type)))
  return {ok:false,error:'기존 엔진에 해당 행동이 없어 안전하게 생성하지 못했습니다.'};
 // One skill, multiple rules. All casts are normalized/limited by
 // SignatureRuleLive and counted in automatic balance estimation.
 const interval=Math.max(.8,Math.min(4,duration));
 const recipe=g.SignatureRuleSkill.normalize({window:Math.max(4,duration+2),
  rules:actions.map(action=>({when:'pulse',interval,action}))});
 const semantic=verify(intent,recipe);
 return {ok:true,name:concepts[0]?.name?concepts[0].name+' 조합 기술':'문장 의미 조합 기술',
  recipe,method:'offline-verb-first-semantic-composer',
  concepts:{fused:concepts.length>1,labels:concepts.map(c=>c.name),
   genre:'semantic',domains:[...new Set(concepts.map(c=>c.domainName||c.genre))]},
  plan:{strategy:'reuse',genre:'semantic',domains:[],conceptIds:concepts.map(c=>c.id),
   action:actions[0].type,visualKinds:motifs,
   explanation:'문장 행동·관계를 우선 분석한 뒤 기존 물리와 이펙트로 조합'},
  notes:[...notes,...(numeric?.warnings||[])],
  semanticVerification:semantic};
}
g.SemanticIntentComposer=Object.freeze({PATTERNS,LABELS,analyze,flatten,verify,compose,UNSUPPORTED});
})(typeof window!=='undefined'?window:globalThis);
