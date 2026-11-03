/* Imagination Concept Materializer v1
 * Fantasy and machinery are concepts, not a growing catalogue of bespoke
 * spells. First try a registered action + existing physics + layered Canvas FX.
 * Only genuinely stateful effects introduce a trusted runtime primitive.
 * User text is never interpreted as JS, and all emitted data is validated.
 */
(function(g){'use strict';
const cap=(x,a,b,f=a)=>Number.isFinite(Number(x))?Math.max(a,Math.min(b,Number(x))):f;
const CATALOG=Object.freeze([
 {id:'dragon',name:'용·드래곤',genre:'fantasy',re:/드래곤|화룡|빙룡|용의\s*(?:숨결|브레스)|용\s*브레스/,
  visual:['embers','wind','runes'],base:'wave'},
 {id:'phoenix',name:'불사조',genre:'fantasy',re:/불사조|피닉스/,
  visual:['feathers','embers','rings'],base:'regen'},
 {id:'rune',name:'룬·마법진',genre:'fantasy',re:/룬|마법진|주문진|봉인진/,
  visual:['runes','rings','stars'],base:'zone'},
 {id:'specter',name:'영혼·유령',genre:'fantasy',re:/영혼|유령|망령|원혼|사령/,
  visual:['mist','shadow','stars'],base:'drain'},
 {id:'curse',name:'저주',genre:'fantasy',re:/저주|주술|흑마법|사악한\s*계약/,
  visual:['shadow','runes','chains'],base:'zone'},
 {id:'golem',name:'골렘·암석',genre:'fantasy',re:/골렘|돌거인|암석\s*수호/,
  visual:['shards','runes','rings'],base:'summon'},
 {id:'angel',name:'천사·신성',genre:'fantasy',re:/천사|신성|성스러운|성광|신의\s*심판/,
  visual:['feathers','runes','stars'],base:'shield'},
 {id:'fairy',name:'요정·정령',genre:'fantasy',re:/요정|정령|실프/,
  visual:['petals','stars','wind'],base:'summon'},
 {id:'crystal',name:'마력 결정',genre:'fantasy',re:/마력\s*수정|마나\s*결정|마석|크리스탈/,
  visual:['shards','runes','stars'],base:'shot'},
 {id:'enchanted_blade',name:'마검·마법검',genre:'fantasy',re:/마검|마법검|룬검|마력\s*검/,
  visual:['runes','shards','trail'],base:'slash'},
 {id:'magic_chain',name:'마법 사슬',genre:'fantasy',re:/사슬\s*마법|마법\s*사슬|구속\s*사슬/,
  visual:['chains','runes','coil'],base:'tether'},
 {id:'time_magic',name:'시간 마법',genre:'fantasy',re:/시간\s*마법|시공\s*마법|시간을\s*(?:멈|되감)/,
  visual:['runes','rings','orbit'],base:'timestop'},
 {id:'railgun',name:'레일건·전자기포',genre:'machine',re:/레일건|전자기\s*포|코일건|가우스포/,
  visual:['plasma','circuit','trail'],base:'beam'},
 {id:'missile',name:'유도 미사일',genre:'machine',re:/미사일|로켓탄|유도탄|어뢰/,
  visual:['trail','circuit','burst'],base:'shot'},
 {id:'laser',name:'레이저 발진기',genre:'machine',re:/레이저\s*(?:포|대포|발진|캐논)|광학\s*포|빔\s*캐논/,
  visual:['plasma','hologram','rings'],base:'beam'},
 {id:'tesla',name:'테슬라 코일',genre:'machine',re:/테슬라|고전압\s*코일|전격\s*장치|방전\s*탑/,
  visual:['lightning','plasma','circuit'],base:'chain'},
 {id:'gear',name:'기어·톱니바퀴',genre:'machine',re:/기어|톱니바퀴|태엽|회전톱|기계톱/,
  visual:['gears','shards','trail'],base:'orbit'},
 {id:'engine',name:'증기·피스톤 기관',genre:'machine',re:/증기\s*기관|스팀\s*엔진|피스톤|유압|보일러|압축기/,
  visual:['steam','gears','rings'],base:'repulse'},
 {id:'drone',name:'자동 드론',genre:'machine',re:/드론|무인\s*비행체|자동\s*비행\s*병기/,
  visual:['circuit','hologram','orbit'],base:'summon'},
 {id:'turret',name:'자동 포탑',genre:'machine',re:/자동\s*포탑|포탑|기관포|터렛|센트리/,
  visual:['circuit','gears','plasma'],base:'turret'},
 {id:'nano',name:'나노머신',genre:'machine',re:/나노\s*머신|나노봇|미세\s*로봇|나노기계/,
  visual:['circuit','shards','mist'],base:'regen'},
 {id:'hologram',name:'홀로그램',genre:'machine',re:/홀로그램|입체\s*투영|가상\s*영상|디지털\s*분신/,
  visual:['hologram','circuit','stars'],base:'summon'},
 {id:'reactor',name:'동력원·반응로',genre:'machine',re:/반응로|핵융합\s*로|동력로|축전기|에너지\s*코어/,
  visual:['gears','plasma','rings'],base:'nova'},
 {id:'magnet',name:'전자석·자기장',genre:'machine',re:/전자석|자기장|자력|자석|전자기장/,
  visual:['plasma','circuit','orbit'],base:'phenomenon'},
 {id:'mech',name:'로봇·기계병기',genre:'machine',re:/전투\s*로봇|거대\s*로봇|메카|기계\s*병기|기계병사/,
  visual:['gears','circuit','steam'],base:'summon'},
 {id:'emp',name:'전자기 펄스',genre:'machine',re:/EMP\b|전자기\s*펄스|전자기파\s*폭발/,
  visual:['circuit','plasma','rings'],base:'wave'}
]);
const AMBIGUOUS=Object.freeze([
 {name:'미지원: 대상의 기억·의지를 완전히 조작',re:/기억을\s*(?:삭제|조작|개조)|상대의\s*의지.*조종|적의\s*생각.*읽/},
 {name:'미지원: 현실 브라우저·기기 해킹',re:/실제\s*컴퓨터.*해킹|웹페이지.*해킹|브라우저.*해킹|상대\s*PC.*조종/}
]);
const STATUS=[['fire',/불꽃|화염|타오르|불타|용암|드래곤\s*브레스/],
 ['ice',/빙결|얼음|서리|냉기|얼려/],
 ['poison',/독|중독|맹독|부식|저주|맹독성/]];
const HEX=/^#[0-9a-f]{6}$/i;
const relayFields=new WeakMap();
const MAX_RELAY=4;
function normalizeRelay(v){
 if(!v||typeof v!=='object'||Array.isArray(v))return undefined;
 return {version:1,charge:cap(v.charge,.2,2,.8),
  release:cap(v.release,.2,2,.7),
  absorb:cap(v.absorb,.05,.45,.23),
  radius:cap(v.radius,35,260,140)};
}
function relayBegin(p,a){
 if(!p||!a)return false;
 const spec=normalizeRelay(a.relay)||normalizeRelay({});
 const pool=relayFields.get(p)||[];
 const total=Math.round((spec.charge+spec.release)*60);
 pool.push({spec,action:a,clock:0,stored:0,launched:false,total,
   origin:{x:Number(p.x)||0,y:Number(p.y)||0}});
 if(pool.length>MAX_RELAY)pool.shift();
 relayFields.set(p,pool);
 return true;
}
function relayTick(p,enemies,hit){
 const pool=relayFields.get(p);
 if(!pool?.length)return;
 const targets=Array.isArray(enemies)?enemies:[];
 for(let i=pool.length-1;i>=0;i--){
  const field=pool[i],s=field.spec,action=field.action;
  field.clock++;
  const chargeFrames=Math.round(s.charge*60);
  if(field.clock<=chargeFrames){
   for(const e of targets){
    if(!e||e===p||e.hp<=0||!Number.isFinite(e.x)||!Number.isFinite(e.y)||
      Math.hypot(e.x-p.x,e.y-p.y)>s.radius+(e.radius||0))continue;
    const vx=Number(e.vx)||0,vy=Number(e.vy)||0;
    const take=Math.min(1.6,Math.hypot(vx,vy)*s.absorb);
    if(take>0){e.vx=vx*(1-s.absorb);e.vy=vy*(1-s.absorb);}
    field.stored=Math.min(20,field.stored+take*.06);
   }
  }else if(!field.launched){
   field.launched=true;
   // Power is based on measured absorbed motion; emit a small reliable
   // pulse even if all targets have zero velocity. No infinite storage.
   const force=cap(1.1+field.stored*1.2,1.1,9,1.1);
   const blow={...action,type:'kinetic_relay',relay:undefined,knockback:0,
    damage:Math.round(cap(action.damage,0,120,15))};
   for(const e of targets){
    if(!e||e===p||e.hp<=0||!Number.isFinite(e.x)||!Number.isFinite(e.y))continue;
    const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy)||1;
    if(d>s.radius+(e.radius||0))continue;
    const scale=force*Math.max(.22,1-d/(s.radius+(e.radius||0)));
    e.vx=cap((Number(e.vx)||0)+dx/d*scale,-18,18,0);
    e.vy=cap((Number(e.vy)||0)+dy/d*scale,-18,18,0);
    if(typeof hit==='function'&&blow.damage>0)hit(p,e,blow);
   }
   g.BattleFX?.cast?.(p,'wave',{radius:s.radius,
    color:HEX.test(action.visual?.color)?action.visual.color:'#a8abff'});
  }
  if(field.clock>=field.total)pool.splice(i,1);
 }
}
function relayReport(p){
 return (relayFields.get(p)||[]).map(f=>({charge:f.clock<=f.spec.charge*60,
  stored:f.stored,clock:f.clock,total:f.total,launched:f.launched}));
}
const inferredStatus=raw=>STATUS.find(([,re])=>re.test(raw))?.[0]||'none';
const supported=type=>!!g.ActionRegistry?.get?.(type);
function visual(raw,selected){
 const inferred=g.SkillFXComposer?.infer?.(raw);
 // Each distinct concept contributes at least its primary motif before
 // decorative extras. Rune + drone must show BOTH runes and circuitry.
 const names=[...new Set([...selected.map(x=>x.visual[0]),
  ...selected.flatMap(x=>x.visual.slice(1)),
  ...(inferred?.layers||[]).map(l=>l.kind)])].slice(0,5);
 const color=inferred?.color||
  (selected.some(x=>x.genre==='machine')?'#66d7f0':'#c4a7ff');
 return g.MetaphorVisuals?.normalize?.({
  shape:'aura',color,scale:inferred?.scale||1.55,
  charge:/충전|축적|응축|차징|모아|흡수/.test(raw),
  layers:names.map(kind=>({kind,color,power:1.2,spin:1}))
 });
}
function chooseAction(raw,selected){
 const primary=selected[0];
 // More specific nouns and explicit verbs override genre-based defaults.
 if(/회복|치유|재생|수리|복구/.test(raw))return 'regen';
 if(/방어|보호|막아|장벽|보호막|실드|방벽/.test(raw))return 'shield';
 if(/레이저|빔|광선|레일건|가우스포|전자기\s*포/.test(raw))return 'beam';
 if(/포탑|터렛|센트리/.test(raw))return 'turret';
 if(/유도탄|미사일|로켓탄|추적탄|발사체|탄환|화살|투사체/.test(raw))return 'shot';
 if(/사슬|속박|포박|구속|휘감아\s*묶|잡아당|붙잡/.test(raw))return supported('tether')?'tether':'pull';
 if(/베어|베기|절단|가르|참격|회전톱/.test(raw))return 'slash';
 if(/끌어당|전자석|자기장|자력/.test(raw))return supported('phenomenon')?'phenomenon':'pull';
 if(/폭발|폭파|터뜨|터지|방사|충격파|분출|브레스/.test(raw))return 'wave';
 if(/소환|분신|드론|골렘|요정/.test(raw))return 'summon';
 if(/주변에\s*퍼|영역|장판|지속\s*구역|마법진/.test(raw))return 'zone';
 return primary?.base||'wave';
}
function interpret(rawInput){
 const raw=String(rawInput||'').normalize('NFC').trim();
 if(!raw||raw.length>300)return null;
 const chosen=CATALOG.filter(def=>def.re.test(raw));
 if(!chosen.length)return null;
 const warnings=AMBIGUOUS.filter(x=>x.re.test(raw)).map(x=>x.name);
 if(warnings.length)return {ok:false,error:warnings.join(' / ')+'. 전투 안에서 실행할 행동을 설명해 주세요.'};
 const effects=visual(raw,chosen),names=chosen.map(x=>x.name);
 const motion=/추적|유도|따라가|뒤쫓/.test(raw);
 const split=/분열|갈라지|나뉘|쪼개/.test(raw);
 const explode=/(?:명중|적중|맞|부딪|충돌|닿).{0,24}(?:폭발|터지|터뜨)|착탄\s*폭발/.test(raw);
 const fusionData=g.ConceptFusion?.normalize?.({
  element:/번개|전기|전류|전격|테슬라/.test(raw)?'lightning':
   /화염|불꽃|드래곤|불사조/.test(raw)?'fire':
   /얼음|빙결|서리/.test(raw)?'ice':
   /독|저주/.test(raw)?'poison':'none',
  form:'projectile',homing:motion,split,fragments:3,
  impact:explode?'burst':'none',radius:95});
 const numeric=g.KoreanSkillParameters?.analyze?.(raw);
 const explicitCount=numeric?.values?.count;
 const explicitDamage=numeric?.values?.damage;
 const explicitRadius=numeric?.values?.radius;
 const explicitDuration=numeric?.values?.duration;
 const needsRelay=/(?:운동량|충격량|동력|마력|에너지|전력|충격).{0,18}(?:흡수|모아|축적|저장).{0,30}(?:방출|발산|되돌|반사|폭발)|(?:흡수|축적|저장).{0,18}(?:운동량|충격량|동력|마력|에너지|전력|충격).{0,25}(?:방출|발산|되돌|반사|폭발)/.test(raw);
 let type=needsRelay?'kinetic_relay':chooseAction(raw,chosen);
 if(!supported(type))type=chosen.find(d=>supported(d.base))?.base||'wave';
 const isNovel=needsRelay&&type==='kinetic_relay';
 const base={type,target:'nearest',pattern:'direct',
  damage:explicitDamage??(type==='shield'||type==='regen'?0:23),
  count:explicitCount??1,radius:explicitRadius??150,
  duration:explicitDuration??2,speed:6,knockback:1.6,status:inferredStatus(raw),
  visual:effects};
 const notes=['해석한 개념: '+names.join(' + ')+'.'];
 if(type==='phenomenon'){
  // An electromagnet is a spatial field, not a decorative "pull" label.
  const ops=/(반발|밀어내|척력)/.test(raw)?['repel']:
   ['attract'];
  if(/회전|빙빙|궤도/.test(raw))ops.push('spin');
  base.law=g.PhysicsLawEngine?.normalize?.({
   anchor:/적\s*주변|상대\s*주변/.test(raw)?'target':'caster',
   radius:base.radius,duration:base.duration,damage:base.damage,
   terms:ops.map(op=>({op,strength:2.4,falloff:'linear'}))
  });
  if(!base.law)type='pull';
 }
 if(type==='shot'){
  base.count=explicitCount??(/다발|연속\s*발사/.test(raw)?4:1);
  if(fusionData)base.fusion=fusionData;
  if(/벽.*튕|도탄|반사탄/.test(raw))base.ricochet=2;
 }
 if(['wave','beam','tether','zone','chain'].includes(type)&&fusionData?.impact!=='none')
  base.fusion=g.ConceptFusion?.normalize?.({...fusionData,homing:false,split:false});
 if(type==='shield'||type==='regen')base.damage=type==='regen'?24:0;
 if(isNovel){
  base.relay=normalizeRelay({charge:.8,release:.6,radius:base.radius});
  notes.push('신규 최소 물리 요소: 운동량 축적→지연 방출. 실제 전투에서 속도를 흡수하고 피해 판정과 함께 재방출합니다.');
  notes.push('문장의 마력·에너지는 별도 자원이 아니라 실제 이동 운동량으로 근사합니다.');
 }else notes.push('기존 동작과 재사용 가능한 이펙트 조합: '+(g.ActionRegistry?.get?.(type)?.label||type)+
  ' + '+(effects?.layers||[]).map(l=>g.SkillFXComposer?.KINDS?.[l.kind]||l.kind).join(' + ')+'.');
 if(!supported(type))return {ok:false,error:'이 개념을 실행할 수 있는 동작을 찾지 못했습니다.'};
 base.type=type;
 const action=g.SignatureScratch?.safeAction?.(base)||base;
 const interval=numeric?.interval||Math.min(4,Math.max(.6,action.duration||1.5));
 const recipe=g.SignatureRuleSkill?.normalize?.({window:Math.min(18,Math.max(4,(action.duration||2)+2)),
  rules:[{when:'pulse',interval,action}]});
 if(!recipe?.rules?.length)return null;
 const genre=chosen.some(x=>x.genre==='machine')?'machine':'fantasy';
 return {ok:true,name:chosen[0].name+' 조합 기술',recipe,recognized:[type],
  method:'offline-concept-materializer',
  concepts:{fused:true,labels:names,genre},
  plan:{strategy:isNovel?'new-primitive':'reuse',genre,conceptIds:chosen.map(x=>x.id),
   action:type,visualKinds:(effects?.layers||[]).map(l=>l.kind),
   explanation:isNovel?'운동량 보존 상태를 가지는 신규 물리 동작':
    '기존 물리 동작과 그래픽 레이어를 조합'},
  notes:[...notes,...numeric?.warnings||[]]};
}
if(g.ActionRegistry?.register&&!g.ActionRegistry.get('kinetic_relay')){
 g.ActionRegistry.register({id:'kinetic_relay',label:'운동량 축적·방출',category:'attacks',
  executor:'custom',family:'wave',physics:'contact',offense:true,
  parameters:['target','damage','radius','duration','status'],
  visual:{motif:'ripples',color:'#7dbbd5'},audio:{cast:'energy',impact:'hit'},
  preview:{duration:1500,pose:'wave',anchor:'caster'},execute:relayBegin});
}
g.ImaginationConcepts=Object.freeze({CATALOG,interpret,normalizeRelay,
 relayBegin,relayTick,relayReport,MAX_RELAY});
})(typeof window!=='undefined'?window:globalThis);
