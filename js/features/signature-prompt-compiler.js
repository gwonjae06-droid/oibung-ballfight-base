/* Korean natural-language -> safe signature rule recipes.
 * Offline, deterministic interpretation for static GitHub Pages. No API key,
 * server request, eval, unsafe source execution or false LLM claims.
 */
(function(g){'use strict';
const R=g.SignatureRuleSkill;
if(!R)return;
const cap=(n,l,h)=>Math.min(h,Math.max(l,n));
const patterns=[
 {id:'splitshot',match:/분열탄|분열.*탄|탄.*분열|파편탄|산탄|탄막|탄환이.*갈라|탄알이.*갈라/},
 {id:'haste',match:/가속|속도|빨라|빨리|초고속|광속|질주|질풍|스피드|극속/},
 {id:'leap',match:/점프|도약|뛰어올|공중으로|하늘로|높이 뛰|날아올/},
 {id:'dive',match:/낙하|내려찍|찍어내|급강하|내리꽂|착지 공격|착지할 때.*공격/},
 {id:'wave',match:/충격파|파동|주변.*폭발|광역.*폭발|펑펑|사방.*폭발/},
 {id:'bolt',match:/번개|낙뢰|벼락|뇌격/},
 {id:'blackhole',match:/블랙홀|중력장|특이점/},
 {id:'homing',match:/유도탄|추적탄|따라가는 탄|따라붙는 탄/},
 {id:'shot',match:/발사|사격|투사체|총알|화살|에너지탄|탄환|탄알/},
 {id:'dash',match:/돌진|들이받|대시|대쉬/},
 {id:'shield',match:/보호막|방어막|실드|쉴드/},
 {id:'heal',match:/회복|치유|힐링/},
 {id:'timeburst',match:/시간.*가속|시간.*빨라|시간.*배속/},
 {id:'zone',match:/장판|독구름|빙결 구역|얼음 구역/},
 {id:'meteor',match:/운석|메테오/},
 {id:'summon',match:/소환|분신|복제체/},
 {id:'rewind',match:/시간.*되돌|시간.*역행|되감기/},
 {id:'timestop',match:/시간.*멈|시간.*정지/},
 {id:'blink',match:/순간이동|텔레포트/},
 {id:'drain',match:/흡혈|생명.*흡수/},
 {id:'regen',match:/지속.*재생|재생/}
];
const noDamage=new Set(['haste','timeburst','leap','dash','shield','blink','rewind','timestop']);
const defaults={splitshot:16,haste:0,timeburst:0,leap:0,dive:37,wave:26,bolt:24,
 shot:19,homing:19,blackhole:17,dash:0,shield:0,heal:24,zone:14,
 meteor:35,summon:12,rewind:0,timestop:0,blink:0,drain:21,regen:15};
const safeName={splitshot:'증식의 탄막',haste:'광속 폭주',leap:'천공 연타',
 dive:'낙하 분쇄',wave:'폭발 연쇄',bolt:'천둥 폭주',blackhole:'중력 폭풍',
 homing:'추적의 군단',shot:'탄환 폭풍',dash:'광란의 돌진',
 shield:'불멸의 방벽',heal:'재생 폭주',meteor:'운석 소나기'};
const events=[
 {when:'split',pattern:/분열.*(?:하면|할 때|때마다|후|뒤)|(?:분열한|갈라진).*다시|분열.*추가|파편.*다시/},
 {when:'land',pattern:/착지.*(?:하면|할 때|때마다|후|뒤)|내려오.*(?:하면|때마다)|땅에.*닿/},
 {when:'wall',pattern:/벽.*(?:튕|부딪|충돌|닿)|벽에.*(?:맞|박)/},
 {when:'contact',pattern:/상대.*(?:부딪|충돌|접촉)|몸통.*충돌|적과.*부딪/},
 {when:'hit',pattern:/적중.*(?:하면|때마다|할 때)|명중.*(?:하면|때마다|할 때)|맞히.*(?:면|때마다|고)|맞출 때/},
 {when:'guard',pattern:/공격.*(?:막|방어|막았|막을)|방어.*(?:성공|하면|할 때)/},
 {when:'dodge',pattern:/회피.*(?:성공|하면|할 때)|피했을 때|피하면|피할 때/},
 {when:'status',pattern:/상태이상.*(?:걸|성공)|중독.*(?:걸|시키)|얼리면/},
 {when:'move',pattern:/이동.*(?:하면|할 때)|돌진.*(?:후|하면)/},
 {when:'hpLow',pattern:/체력.*(?:낮|적|부족|40%|위험)|피.*(?:적|없|부족)/},
 {when:'near',pattern:/상대.*(?:가까|근접|붙)|적이.*가까/},
 {when:'far',pattern:/상대.*(?:멀|거리)|적이.*멀/}
];
function mergeVisual(base,fx){
 if(!fx)return base;
 const layers=[...(base?.layers||[]),...(fx.layers||[])];
 const unique=[],seen=new Set();
 for(const layer of layers){
  if(!seen.has(layer.kind)){unique.push(layer);seen.add(layer.kind);}
 }
 return g.MetaphorVisuals?.normalize?.({
  shape:base?.shape||'aura',
  color:base?.shape&&base.shape!=='aura'?base.color:fx.color,
  scale:Math.max(Number(base?.scale)||1,Number(fx.scale)||1),
  charge:!!base?.charge||!!fx.charge,
  layers:unique.slice(0,5)
 })||base;
}
function readNumber(text,pattern){const m=text.match(pattern);return m?Number(m[1]):null;}
function parse(input){
 const raw=String(input??'').trim();
 if(!raw)return {ok:false,error:'어떤 능력을 만들고 싶은지 한 문장 이상 적어 주세요.'};
 if(raw.length>300)return {ok:false,error:'설명은 300자 이내로 입력해 주세요.'};
 // A restricted vocabulary prevents invented effects that the game cannot cast.
 // Extend natural-language recognition to EVERY registered Forge action,
 // rather than only the small starter vocabulary listed above.
 const supported=g.SkillForge?.TYPE||g.ActionRegistry?.TYPE||{};
 const grammar=g.KoreanSkillGrammar?.analyze?.(raw,supported);
 const excluded=new Set((grammar?.clauses||[]).filter(c=>c.negated&&c.suppressed)
  .map(c=>c.suppressed.type));
 const understood=(grammar?.clauses||[]).filter(c=>c.chosen)
  .map(c=>({id:c.chosen.type}));
 const recognized=g.NaturalForge?.recognize?.(raw)||[];
 const physicalMatches=g.SemanticPhysics?.matchAll?.(raw,supported)||[];
 const ids=new Set();
 const found=[...patterns.filter(t=>t.match.test(raw)),
   ...recognized.map(x=>({id:x.type})),...understood,
  ...physicalMatches.map(x=>({id:x.type}))].filter(x=>{
     if(excluded.has(x.id))return false;
     if(ids.has(x.id))return false;
     ids.add(x.id);return true;
   });
 if(!found.length&&!g.MetaphorVisuals?.interpret?.(raw))return {ok:false,error:'아직 이해할 수 없는 동작입니다. 분열탄·가속·점프·낙하·충격파·번개 같은 게임 동작을 넣어 주세요.'};
 // A concrete metaphor takes priority over incidental verbs such as
 // "쏩니다" and "때립니다": choose physics first, then render its image.
 const metaphor=g.MetaphorVisuals?.interpret?.(raw);
 const mentioned=found.filter(t=>Object.hasOwn(supported,t.id));
 const activeMetaphor=metaphor&&!excluded.has(metaphor.type)?metaphor:null;
 const physicalTypes=[...new Set([
  ...(grammar?.clauses||[]).filter(c=>c.chosen?.source==='physical-intent'&&!c.negated)
   .map(c=>c.chosen.type),
  ...physicalMatches.filter(c=>!excluded.has(c.type)).map(c=>c.type)
 ])];
 const redundant={tether:['pull'],repulse:['wave'],vortex:['orbit','pull']};
 const replaced=new Set(physicalTypes.flatMap(type=>redundant[type]||[]));
 const mentions=physicalTypes.length?
  [...physicalTypes.map(id=>({id})),...mentioned.filter(x=>
   !physicalTypes.includes(x.id)&&!replaced.has(x.id))]:
  activeMetaphor&&Object.hasOwn(supported,activeMetaphor.type)?
   [{id:activeMetaphor.type}]:mentioned;
 if(!mentions.length)return {ok:false,error:'설명한 동작은 현재 게임에서 실행할 수 없습니다.'};
 const types=new Set(mentions.map(x=>x.id));
 const notes=[];
 const repeat=/무한|계속|연속|반복|끝없이|끊임없이|미친|엄청|마구|초당|난사|폭주/.test(raw);
 // Numeric projectile velocity / fire rate should not invent a haste buff.
 const speed=/가속|광속|스피드|초고속|빨라|(?:몸|나|자신|이동)\s*(?:의)?\s*속도/.test(raw);
 const wall=/벽.*(?:튕|부딪|충돌|닿)/.test(raw);
 const contact=/상대.*(?:부딪|충돌|접촉)|적과.*부딪/.test(raw);
 const split=types.has('splitshot');
 const jump=types.has('leap'),dive=types.has('dive');
 const event=events.filter(x=>x.pattern.test(raw)).map(x=>x.when);
 const intervalRaw=readNumber(raw,/(\d+(?:\.\d+)?)\s*초\s*(?:마다|간격|에\s*(?:한\s*번|1번))/);
 const durationRaw=readNumber(raw,/(\d+(?:\.\d+)?)\s*초\s*(?:동안|간|지속)/);
 const countRaw=readNumber(raw,/(\d+)\s*(?:발|개|갈래|줄기|덩이|번씩)/);
 const damageRaw=readNumber(raw,/(?:위력|피해|데미지|대미지|공격력)\s*(?:은|를|가|:|=)?\s*(\d+)/);
 const radiusRaw=readNumber(raw,/(?:범위|반경)\s*(?:은|를|가|:|=)?\s*(\d+)/);
 const generationsRaw=readNumber(raw,/(\d+)\s*(?:번|회|세대)\s*(?:재분열|분열|반복)/)||
   readNumber(raw,/(?:재분열|분열)\s*(\d+)\s*(?:회|번|세대)/);
 const window=durationRaw!==null?cap(durationRaw,4,18):repeat?15:10;
 const interval=intervalRaw!==null?cap(intervalRaw,.35,4):repeat?.65:1.25;
 if(durationRaw!==null&&durationRaw!==window)notes.push('폭주 유지 시간은 4~18초 범위로 맞췄습니다.');
 if(intervalRaw!==null&&intervalRaw!==interval)notes.push('반복 간격은 0.35~4초 범위로 맞췄습니다.');
 if(countRaw!==null&&(countRaw<1||countRaw>8))notes.push('한 번에 생성하는 개수는 최대 8개로 제한했습니다.');
 if(damageRaw!==null&&(damageRaw<0||damageRaw>120))notes.push('동작 위력은 최대 120으로 제한했습니다.');
 if(radiusRaw!==null&&(radiusRaw<30||radiusRaw>300))notes.push('범위는 30~300으로 제한했습니다.');
 const rows=[],maxRules=8;
 function add(type,when='pulse',pace=interval,adjust={}){
  if(rows.length>=maxRules||!Object.hasOwn(supported,type))return;
  if(rows.some(r=>r.action.type===type&&r.when===when))return;
  const damage=noDamage.has(type)?0:damageRaw!==null?cap(damageRaw,0,120):(defaults[type]??18);
  const status=/빙결|얼음|얼려|냉기|서리/.test(raw)?'ice':
   /화염|화상|불꽃|불태/.test(raw)?'fire':
   /중독|맹독|독가스|독.*피해/.test(raw)?'poison':'none';
  const target=/체력.*낮은.*적|약한.*적/.test(raw)?'lowest':
   /먼.*적|멀리.*적/.test(raw)?'farthest':
   /무작위.*적|랜덤.*대상/.test(raw)?'random':'nearest';
  const pattern=/사방|360도|방사형/.test(raw)?'radial':
   /나선|소용돌이/.test(raw)?'spiral':
   /부채꼴|퍼지.*발사/.test(raw)?'fan':'direct';
  rows.push({when,interval:pace,fracture:type==='splitshot'?cap(generationsRaw||(/다시.*분열|재분열|분열.*분열/.test(raw)?3:2),1,3):1,
   action:{type,visual:activeMetaphor&&activeMetaphor.type===type?activeMetaphor.visual:undefined,
    damage,radius:radiusRaw!==null?cap(radiusRaw,30,300):type==='splitshot'?155:150,
    count:countRaw!==null?cap(countRaw,1,8):type==='splitshot'?5:1,
    pattern,target,status,duration:type==='haste'||type==='timeburst'?1.7:1.5,...adjust}});
 }
 // Some compound patterns are composed first so "점프-착지-재점프"
 // and "벽-가속-충돌" have meaningful reactive rather than generic scripts.
 if(split){
  add('splitshot','pulse',Math.max(.35,interval));
  if(event.includes('split')||/다시.*분열|재분열|분열.*추가/.test(raw))
   add('shot','split',Math.max(.5,interval*1.35),{damage:Math.min(15,damageRaw??9),count:3});
  if(event.includes('hit')&&types.has('wave'))add('wave','hit',Math.max(.6,interval));
 }
 if(speed){
  // "시간 가속" still uses the temporal mechanic, while ordinary speed
  // works through the live stacking haste mechanic.
  // "벽에 튕길 때마다 가속" must not smuggle in a periodic haste.
  // Continuous speed requests without a specified event keep a pulse.
  const speedType=types.has('timeburst')?'timeburst':'haste';
  const eventDriven=wall||contact||event.length>0;
  if(!eventDriven)add(speedType,'pulse',Math.max(.35,interval));
  if(wall)add(speedType,'wall',Math.max(.35,interval*.75));
  if(contact){
    if(types.has('wave'))add('wave','contact',Math.max(.5,interval),{damage:damageRaw??23});
    else add(speedType,'contact',Math.max(.35,interval));
  }
  if(!wall&&!contact&&event.length)add(speedType,event[0],Math.max(.35,interval));
 }
 if(jump||dive){
  if(jump)add('leap',event.length===1&&!dive?event[0]:'pulse',Math.max(1.8,interval*2.5));
  if(dive)add('dive',jump||event.includes('land')?'land':'pulse',Math.max(.45,interval),{
   damage:damageRaw??38,radius:radiusRaw??175});
  // A landing loop can be literal: no unbounded recursion, only event cooldown.
  if(event.includes('land')&&jump&&!dive)add('leap','land',Math.max(.6,interval));
 }
 if(wall&&types.has('bolt'))add('bolt','wall',Math.max(.45,interval));
 if(event.includes('hit')&&types.has('wave'))add('wave','hit',Math.max(.5,interval));
 // Preserve user-mentioned distinct actions and avoid duplicate trigger pairs.
 const picked=[];
 for(const item of mentions){
  if(picked.includes(item.id))continue;picked.push(item.id);
  if(!rows.some(r=>r.action.type===item.id)){
   const best=event.find(e=>e!=='split'&&e!=='land')||
    (event.includes('land')?'land':event.includes('split')?'split':'pulse');
   add(item.id,best,interval);
  }
 }
 // If the user explicitly named one trigger and one action, never add an
 // unsolicited periodic cast. The exact condition should drive the skill.
 if(event.length===1&&rows.length===1&&rows[0].when==='pulse')
  rows[0].when=event[0];
 if(physicalTypes.length)notes.push('신규 물리 동작: '+physicalTypes.map(id=>supported[id]).join(' + ')+'. 거리와 접촉 판정에 따라 실제 힘이 적용됩니다.');
 if(activeMetaphor&&rows.some(r=>r.action.type===activeMetaphor.type))
  notes.unshift('비유 해석: '+activeMetaphor.meaning+'. 공 일부 변형과 빛의 질감은 전투와 미리보기 양쪽에 표시됩니다.');
 if(!rows.length)return {ok:false,error:'전투에서 실행할 수 있는 동작을 찾지 못했습니다.'};
 if(rows.length>=maxRules)notes.push('기술당 규칙은 최대 8개까지 실행됩니다.');
 if(/절대|완전.*무적|무적.*무한|즉사|한방.*죽/.test(raw))
  notes.push('즉사·영구 무적 효과는 지원하지 않아 실제 게임 동작으로만 구성했습니다.');
 if(split)notes.push('분열탄의 세대와 탄환 수는 게임 엔진의 안전 상한 안에서 작동합니다.');
 if(speed)notes.push('속도는 중첩되지만 물리 충돌을 유지하도록 최고속도가 제한됩니다.');
 // Attach each clause's conditional ending to its OWN action, not a random
 // whole-sentence keyword. Do not treat a negated action as a requested cast.
 if(grammar){
  const candidates=grammar.clauses.filter(c=>c.chosen);
  if(grammar.clauses.length>1&&candidates.length){
   for(const clause of candidates){
    const type=clause.chosen.type;
    if(clause.when!=='pulse'){
     const rule=rows.find(r=>r.action.type===type);
     if(rule)rule.when=clause.when;
     else add(type,clause.when,interval);
    }
    const rule=rows.find(r=>r.action.type===type&&r.when===clause.when);
    if(rule&&clause.chosen.visual)rule.action.visual=clause.chosen.visual;
    if(rule&&clause.fx)rule.action.visual=mergeVisual(rule.action.visual,clause.fx);
   }
  }
  if(grammar.clauses.length===1){
   const c=grammar.clauses[0];
   for(const row of rows)if(c.fx&&!c.negated)
    row.action.visual=mergeVisual(row.action.visual,c.fx);
  }
  for(const clause of grammar.clauses){
   if(clause.negated&&clause.suppressed)
    notes.push('부정문: '+clause.suppressed.type+' 동작은 명시된 지시에서 제외했습니다.');
  }
  const intensity=grammar.adverbs;
  if(intensity.includes('intensity')){
   for(const r of rows)if(!noDamage.has(r.action.type))
    r.action.damage=Math.min(120,Math.round(r.action.damage*1.16));
   notes.push('강한 타격 표현은 공격 위력에 반영했습니다.');
  }
  if(intensity.includes('scale')){
   for(const r of rows)r.action.radius=Math.min(300,Math.round(r.action.radius*1.25));
   notes.push('크기 표현은 기술 범위에 반영했습니다.');
  }
  if(intensity.includes('speed')){
   for(const r of rows)if(r.action.speed)r.action.speed=Math.min(14,r.action.speed*1.2);
  }
 }
 // Bind numeric specifications to their matching Korean action clause.
 const params=g.KoreanSkillParameters,whole=params?.analyze?.(raw);
 for(const row of rows){
  const clause=(grammar?.clauses||[]).find(c=>c.chosen?.type===row.action.type&&!c.negated);
  const local=clause?params?.analyze?.(clause.text):null;
  // A separate action's numbers never overwrite a sibling action's values.
  const use=(grammar?.clauses||[]).length>1?local:whole;
  if(use)row.action=params.apply(row.action,use);
  if(local?.interval||whole?.interval)row.interval=local?.interval||whole.interval;
 }
 if(whole?.recognized?.length)
  notes.push('수치 해석: '+whole.recognized.join(', ')+'. 안전한 실제 전투 범위 안에서 적용됩니다.');
 if(whole?.warnings?.length)notes.push(...whole.warnings);
 // A literal sequence becomes one bounded graph, rather than independent
 // simultaneous casts. The existing ruleSet still owns wall/hit triggers.
 let sequence=g.FantasySkillGraph?.fromText?.(raw,{
  types:supported,action:rows[0]?.action});
 // Temporal participles ("휘감다가 폭발한다") form a REAL sequential
 // program. Only when every clause is unconditional: reactive rules stay
 // separately triggered, so wall/contact conditions never turn into pulses.
 if(!sequence?.length&&grammar?.clauses?.length>=2&&grammar.clauses.length<=5){
  const clauses=grammar.clauses.filter(c=>c.chosen&&!c.negated);
  if(clauses.length>=2&&clauses.every(c=>c.when==='pulse')){
   const stage=[];
   for(const c of clauses){
    const r=rows.find(v=>v.action.type===c.chosen.type);
    if(!r)continue;
    const a={...r.action,visual:mergeVisual(r.action.visual,c.fx)};
    if(c.chosen.visual)a.visual=mergeVisual(c.chosen.visual,c.fx);
    stage.push({kind:'cast',action:a});
    if(/(?:다가|고나서|자마자)$/.test(c.text)&&stage.length<10)
     stage.push({kind:'wait',seconds:.25});
   }
   if(stage.filter(v=>v.kind==='cast').length>=2)
    sequence=g.FantasySkillGraph?.normalize?.(stage)||stage;
  }
 }
 // Two physically distinct verbs must stay in the SAME actual cast graph,
 // even when the legacy graph lexicon does not understand their new names.
 if(physicalTypes.length>=2&&!(grammar?.clauses||[]).some(c=>
   c.when!=='pulse'&&c.chosen?.source==='physical-intent')){
  const physicalSteps=physicalTypes.map(type=>{
   const row=rows.find(r=>r.action.type===type);
   return row?{kind:'cast',action:row.action}:null;
  }).filter(Boolean);
  if(physicalSteps.length>=2)sequence=g.FantasySkillGraph?.normalize?.(physicalSteps)||physicalSteps;
 }
 if(sequence?.length>=2){
  const leader=rows.find(r=>r.when==='pulse')||rows[0];
  if(leader){
   leader.steps=sequence;
   // A sequential cast is not also independently cast by a sibling pulse.
   const sequentialTypes=new Set(sequence.filter(v=>v.kind==='cast').map(v=>v.action.type));
   for(let i=rows.length-1;i>=0;i--){
    if(rows[i]!==leader&&rows[i].when==='pulse'&&sequentialTypes.has(rows[i].action.type))
      rows.splice(i,1);
   }
   notes.push('복합 기술은 순서 그래프로 실행됩니다. 반복 횟수·시간·생성 개수에는 안전 제한이 있습니다.');
  }
 }
 // The graph copies action nodes; numeric settings must reach every
 // executable stage, not merely the rule leader's preview action.
 for(const row of rows)for(const step of row.steps||[]){
  if(step.kind!=='cast'||!step.action)continue;
  const matched=rows.find(r=>r.action.type===step.action.type);
  const clause=(grammar?.clauses||[]).find(c=>c.chosen?.type===step.action.type&&!c.negated);
  const local=clause?params?.analyze?.(clause.text):null;
  step.action={...step.action,...(matched?.action||{}),
   ...(local?params.apply({},local):{})};
 }
 const recipe=R.normalize({window,rules:rows});
 const primary=physicalTypes[0]||activeMetaphor?.type|| (types.has('splitshot')?'splitshot':speed?'haste':jump?'leap':mentions[0].id);
 return {ok:true,name:safeName[primary]||'나만의 폭주 기술',recipe,notes,
  recognized:mentions.map(x=>x.id),method:'offline-rule-parser'};
}
g.SignaturePromptCompiler=Object.freeze({parse,patterns:patterns.map(p=>p.id)});
})(typeof window!=='undefined'?window:globalThis);
