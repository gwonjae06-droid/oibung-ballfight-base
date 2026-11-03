/* Concept Fusion v1: offline, declarative semantic composition.
 * Existing action TYPES become primitives, NOT standalone must-cast skills.
 * A single projectile may seek, split, carry an element and react on impact.
 * Everything emitted is bounded data, executed by trusted runtime modules.
 */
(function(g){'use strict';
const cap=(n,l,h,d=l)=>Number.isFinite(Number(n))?Math.max(l,Math.min(h,Number(n))):d;
const ELEMENTS=Object.freeze({
 fire:{label:'화염',re:/화염|화상|불꽃|불덩|불길|작열|용암|불타|타오르|불로\s*된/,status:'fire'},
 ice:{label:'빙결',re:/얼음|빙결|빙하|서리|냉기|동결|얼려|얼어붙/,status:'ice'},
 poison:{label:'독',re:/중독|맹독|독성|독구름|독액|독가스|독을|독이|독으로/,status:'poison'},
 lightning:{label:'번개',re:/번개|전기|낙뢰|전류|벼락|뇌전/,status:'none'},
 gravity:{label:'중력',re:/중력|블랙홀|흡인력|인력/,status:'none'},
 shadow:{label:'암흑',re:/어둠|암흑|검은|그림자|심연|흑염|멘헤라/,status:'none'},
 nature:{label:'자연',re:/덩굴|뿌리|꽃잎|나무|가시|숲/,status:'none'},
 water:{label:'물',re:/물결|물방울|바닷물|해일|파도|수류/,status:'none'},
 wind:{label:'바람',re:/바람|돌풍|폭풍|태풍|칼바람/,status:'none'}
});
const FORMS=Object.freeze({
 chain:{label:'사슬·속박',re:/사슬|쇠줄|밧줄|포박|속박|묶어|휘감|낚아채|붙잡|촉수/},
 projectile:{label:'투사체',re:/탄환|총알|투사체|구슬|미사일|화살|탄알|탄막|에너지탄|발사체|빛구슬/},
 beam:{label:'광선',re:/레이저|광선|빛줄기|멘헤라빔|에너지빔/},
 wave:{label:'파동',re:/충격파|파동|진동파|공명파/},
 field:{label:'장판·영역',re:/장판|구역|영역|독구름|기류|결계/},
 vortex:{label:'회오리',re:/소용돌이|회오리|블랙홀|회전장/}
});
const IMPACTS=Object.freeze({none:'없음',burst:'충돌 폭발',pull:'충돌 흡인',repulse:'충돌 반발',vortex:'충돌 소용돌이'});
const fusionKeys=new Set(['none',...Object.keys(IMPACTS)]);
const HEX=/^#[0-9a-f]{6}$/i;
const safeTint=v=>typeof v==='string'&&HEX.test(v)?v.toLowerCase():undefined;
// Only references to shards produced by THIS shot can receive child-only motion.
const shardAnaphora=raw=>/(?:그|이|해당|남은|분열된|생성된|방금\s*생긴)\s*(?:파편|조각|부스러기)(?:들)?(?:은|는|이|가|을|를|도)?/.test(String(raw||''));
const childChase=raw=>/(?:그|이|해당|남은|분열된|생성된|방금\s*생긴)\s*(?:파편|조각|부스러기)(?:들)?(?:은|는|이|가|을|를|도)?.{0,32}?(?:추적|유도|뒤쫓|쫓아가|따라가|따라붙)/.test(String(raw||''));
// One recognized temporal chain: after the LAST real child projectile is
// retired (hit, obstruction, lifetime or perimeter), trigger an area burst.
// Merely naming shards or explosions does NOT imply this ordered event.
function terminalIntent(text){
 const raw=String(text||'').normalize('NFC').slice(0,300);
 const shards=/(?:마지막|최후의|모든|전부|모두|남은).{0,14}(?:파편|조각|부스러기)|(?:파편|조각|부스러기)(?:들)?.{0,16}(?:모두|전부|마지막|남은)/.test(raw);
 const ending=/(?:사라지|소멸|없어지|소진|다\s*떨어지|수명.{0,8}끝나).{0,45}(?:폭발|폭파|터지|터뜨|충격파)/.test(raw);
 const negated=/(?:폭발|폭파|터지|터뜨).{0,8}(?:하지\s*않|지\s*않|안\s*하|않는|않는다|하지\s*마)/.test(raw);
 return shards&&ending&&!negated;
}
// A post-fracture condition, not a timer or an on-hit shield.
function terminalShieldIntent(text){
 const raw=String(text||'').normalize('NFC').slice(0,300);
 const family=/(?:마지막|최후의|모든|전부|모두|남은).{0,14}(?:파편|조각|부스러기)|(?:파편|조각|부스러기)(?:들)?.{0,15}(?:모두|전부|마지막|남은)/;
 const after=/(?:사라지|소멸|없어지|소진|수명.{0,8}끝나).{0,65}?(?:보호막|방어막|실드|배리어).{0,22}?(?:생성|만들|두르|치|펼치|씌우|형성|얻)/;
 const negated=/(?:보호막|방어막|실드|배리어).{0,28}(?:생성|만들|두르|치|펼치|형성).{0,10}(?:하지\s*않|지\s*않|안\s*하|않는|말)/;
 return family.test(raw)&&after.test(raw)&&!negated.test(raw);
}
const normalize=v=>{
 if(!v||typeof v!=='object'||Array.isArray(v))return undefined;
 const impact=fusionKeys.has(v.impact)?v.impact:'none';
 const element=Object.hasOwn(ELEMENTS,v.element)?v.element:'none';
 const form=Object.hasOwn(FORMS,v.form)?v.form:'none';
 const homing=v.homing===true,split=v.split===true;
 const terminalChain=split?g.TerminalEventChain?.normalize?.(v.terminalChain):undefined;
 if(!homing&&!split&&impact==='none'&&element==='none')return undefined;
 return {version:1,element,form,homing,split,
  fragments:Math.round(cap(v.fragments,2,4,3)),
  // Pre-existing skills default to the original 12-tick midair fracture.
  ...(split&&v.splitTrigger==='hit'?{splitTrigger:'hit'}:{}),
  ...(split&&v.finalBurst===true?{finalBurst:true}:{}),
  ...(split&&v.finalShield===true?{finalShield:true}:{}),
  ...(terminalChain?{terminalChain}:{}),
  ...(split&&v.childHoming===true?{childHoming:true}:{}),
  ...(split&&safeTint(v.childColor)?{childColor:safeTint(v.childColor)}:{}),
  ...(split&&v.finalBurst===true&&safeTint(v.finalColor)?{finalColor:safeTint(v.finalColor)}:{}),
  impact,radius:cap(v.radius,35,160,85)};
};
function analyze(input){
 const raw=String(input||'').normalize('NFC').trim().slice(0,300);
 const elements=Object.entries(ELEMENTS).filter(([,v])=>v.re.test(raw)).map(([id])=>id);
 const forms=Object.entries(FORMS).filter(([,v])=>v.re.test(raw)).map(([id])=>id);
 const home=/추적|유도|뒤쫓|따라가|쫓아가|따라붙|목표를\s*좇|적을\s*좇/.test(raw);
 const split=/분열|갈라지|쪼개지|부서지|깨지|여러\s*개로\s*나뉘|산산이\s*흩어/.test(raw);
 const finalBurst=terminalIntent(raw);
 const finalShield=terminalShieldIntent(raw);
 const terminalChain=g.TerminalEventChain?.parse?.(raw)?.steps;
 const sequence=/그\s*다음|그러고\s*나서|뒤이어|이어서|그\s*후|그\s*뒤|(?:하|한|하고)\s*뒤에|순서대로/.test(raw);
 const hitExplosion=(!finalBurst||/(?:명중|적중|착탄|맞으면|닿으면).{0,18}(?:폭발|터지|터뜨)/.test(raw))&&
  /(?:맞|적중|명중|닿|충돌|부딪|접촉|도달|착탄|피격|명중시).{0,22}(?:폭발|터지|터뜨|터져)|(?:맞으면|닿으면|충돌하면|명중하면|적중하면).{0,22}(?:폭발|퍼지|퍼뜨)|(?:폭발하는|터지는|폭발성|충돌\s*폭발|착탄\s*폭발)/.test(raw);
 const impact=hitExplosion?'burst':
  /(?:맞|닿|적중|충돌).{0,18}(?:끌어당|흡입|빨아들|중력장)/.test(raw)?'pull':
  /(?:맞|닿|적중|충돌).{0,18}(?:밀쳐|밀어내|튕겨내)/.test(raw)?'repulse':
  /(?:맞|닿|적중|충돌).{0,18}(?:소용돌이|휘말리)/.test(raw)?'vortex':
  elements.includes('gravity')&&forms.includes('projectile')?'pull':'none';
 const numeric=g.KoreanSkillParameters?.analyze?.(raw)?.values;
 const namedCount=numeric?.count;
 const namedFragments=numeric?.fragmentCount;
 const isProjectile=forms.includes('projectile')||/분열탄|추적탄|유도탄/.test(raw);
 const chain=forms.includes('chain')&&/(?:묶|끌어당|휘감|붙잡|포박|낚아채|감싸|속박)/.test(raw);
 const main=chain?'tether':
  isProjectile&&(split||home||impact!=='none')?'shot':null;
 // Distinguish descriptive properties from independent action verbs.
 // "번개로 된 화살" is one projectile with lightning art; "번개를
 // 내리친 뒤 화살을 쏜다" remains two explicit stages.
 const lightningModifier=elements.includes('lightning')&&
  /(번개|전기|뇌전).{0,12}(?:로\s*된|로\s*만든|를\s*두른|가\s*흐르는|사슬|탄환|화살|구슬|투사체|미사일)/.test(raw);
 const splitModifier=split&&isProjectile;
 const homeModifier=home&&isProjectile;
 const childOnly=splitModifier&&childChase(raw);
 const impactModifier=impact!=='none'&&!sequence;
 const fused=!!(main||elements.length&&forms.length||splitModifier||homeModifier||impactModifier);
 const chosenElement=elements[0]||'none';
 const fusion=normalize({element:chosenElement,form:chain?'chain':
  isProjectile?'projectile':forms[0]||'none',
  homing:homeModifier&&!childOnly,split:splitModifier,
  childHoming:childOnly,
  finalBurst:splitModifier&&finalBurst,
  finalShield:splitModifier&&finalShield,
  terminalChain:splitModifier?terminalChain:undefined,
  fragments:namedFragments??namedCount??3,
  impact:impactModifier?impact:'none',
  radius:g.KoreanSkillParameters?.analyze?.(raw)?.values?.radius||85});
 return {elements,forms,main,homing:homeModifier,split:splitModifier,
  childOnly,finalBurst:!!fusion?.finalBurst,finalShield:!!fusion?.finalShield,
  terminalChain:fusion?.terminalChain||null,
  impact:impactModifier?impact:'none',lightningModifier,sequence,fused,fusion,
  labels:[
   ...elements.map(id=>ELEMENTS[id].label),
   ...forms.map(id=>FORMS[id].label),
   ...(homeModifier?['목표 추적']:[]),
   ...(splitModifier?['탄환 분열']:[]),
   ...(impactModifier?[IMPACTS[impact]]:[]),
   ...(fusion?.finalBurst?['마지막 파편 소멸 시 폭발']:[]),
   ...(fusion?.finalShield?['마지막 파편 소멸 시 시전자 보호막']:[]),
   ...(fusion?.terminalChain?['파편 종료 후 '+fusion.terminalChain.length+'단계 순차 실행']:[])
  ].slice(0,12)};
}
function visualOf(action,raw,concepts){
 const fx=g.SkillFXComposer?.infer?.(raw);
 if(!fx&&!action?.visual)return action?.visual;
 const prev=action?.visual;
 const byKind=new Map();
 for(const layer of [...(fx?.layers||[]),...(prev?.layers||[])])if(!byKind.has(layer.kind))
  byKind.set(layer.kind,layer);
 if(concepts?.impact==='burst'&&!byKind.has('burst'))
  byKind.set('burst',{kind:'burst',color:fx?.color||'#ff954b',power:1.2,spin:1});
 if(concepts?.homing&&!byKind.has('trail'))
  byKind.set('trail',{kind:'trail',color:fx?.color||'#b4a3ff',power:1,spin:1});
 if(concepts?.split&&!byKind.has('shards'))
  byKind.set('shards',{kind:'shards',color:fx?.color||'#b4a3ff',power:1,spin:1});
 const value={shape:prev?.shape||'aura',color:prev?.color||fx?.color||'#b4a3ff',
  scale:Math.max(prev?.scale||1,fx?.scale||1.4),
  charge:!!prev?.charge||!!fx?.charge,layers:[...byKind.values()].slice(0,5)};
 return g.MetaphorVisuals?.normalize?.(value)||value;
}
function weave(value,input){
 const concepts=analyze(input),model=g.SignatureRuleSkill;
 if(!concepts.fused||!model)return {recipe:value,concepts,changed:false};
 let recipe=model.normalize(value);
 const rows=recipe.rules.slice();
 if(!rows.length)return {recipe,concepts,changed:false};
 const has=(type)=>rows.some(r=>r.action.type===type)||
  rows.some(r=>(r.steps||[]).some(s=>s.kind==='cast'&&s.action?.type===type));
 let primary=concepts.main;
 if(!primary||!has(primary)){
  if(concepts.main==='shot'&&has('splitshot'))primary='splitshot';
  else if(concepts.main==='tether'&&has('pull'))primary='pull';
  else primary=null;
 }
 if(!primary){
  primary=rows.find(r=>g.ActionRegistry?.get?.(r.action.type)?.offense)?.action.type||
   rows[0].action.type;
 }
 const chosen=rows.find(r=>r.action.type===primary)||rows[0];
 // The projectile itself must still launch on a normal pulse. 'On hit'
 // is a property of its payload, not its own activation condition.
 if(concepts.main==='shot'&&concepts.impact!=='none'&&chosen.when==='hit')chosen.when='pulse';
 const canProjectile=['shot','homing','pierce','boomerang','arcshot','splitshot'].includes(primary);
 if(concepts.main==='shot'&&canProjectile&&g.ActionRegistry?.get?.('shot'))
  chosen.action.type='shot';
 else if(concepts.main==='tether'&&g.ActionRegistry?.get?.('tether'))
  chosen.action.type='tether';
 const fusedAction=action=>{
  if(!action)return action;
  const base={...action};
  const fusion=concepts.fusion;
  if(fusion){
   const permitted=['shot','tether','wave','repulse','vortex','zone','beam','pull'].includes(base.type);
   const adjusted=normalize({...fusion,
    homing:base.type==='shot'?fusion.homing:false,
    split:base.type==='shot'?fusion.split:false,
    childHoming:base.type==='shot'?fusion.childHoming:false,
    impact:permitted?fusion.impact:'none'});
   if(adjusted)base.fusion=adjusted;
  }
  const element=ELEMENTS[concepts.fusion?.element];
  if(element?.status!=='none'&&element?.status&&
     (g.SkillForge?.STATUS?.[element.status]||['fire','ice','poison'].includes(element.status)))
   base.status=element.status;
  base.visual=visualOf(base,input,concepts);
  return base;
 };
 chosen.action=fusedAction(chosen.action);
 // Literal verb sequences keep separate ordered casts. Modifiers do not
 // become extra casts of "bolt" or "haste" when describing another object.
 if(!concepts.sequence){
  const modifiers=new Set();
  if(concepts.lightningModifier&&primary!=='bolt')modifiers.add('bolt');
  if(concepts.split&&concepts.main==='shot')modifiers.add('splitshot');
  if(concepts.homing&&concepts.main==='shot')modifiers.add('homing');
  if(concepts.impact==='burst')for(const t of ['wave','nova'])if(primary!==t)modifiers.add(t);
  if(concepts.impact==='pull')for(const t of ['pull','blackhole'])if(primary!==t)modifiers.add(t);
  if(concepts.fusion?.element==='gravity'&&concepts.main==='shot')modifiers.add('blackhole');
  for(let i=rows.length-1;i>=0;i--)
   if(rows[i]!==chosen&&modifiers.has(rows[i].action.type)&&
      (rows[i].when==='pulse'||rows[i].when==='hit'&&concepts.impact==='burst'))
    rows.splice(i,1);
  for(const row of rows)if(row.steps?.length){
   row.steps=row.steps.filter(s=>s.kind!=='cast'||!modifiers.has(s.action?.type));
   if(!row.steps.some(s=>s.kind==='cast'))delete row.steps;
  }
 }
 // Graph cast instructions carry their own fully normalized payload.
 for(const row of rows)if(row.steps?.length){
  const stage=row.steps.find(s=>s.kind==='cast'&&
   (s.action.type===primary||s.action.type===chosen.action.type));
  if(stage)stage.action=fusedAction({...stage.action,type:chosen.action.type});
  else if(row===chosen&&!concepts.sequence)row.steps.unshift({kind:'cast',action:chosen.action});
 }
 // Keep truly independent action verbs (e.g. "chain and then explode").
 // Only recognized modifiers above are folded into the primary object.
 recipe=model.normalize({...recipe,rules:rows});
 return {recipe,concepts,changed:true};
}
function impact(attacker,victim,action,api={}){
 const fusion=normalize(action?.fusion);
 if(!fusion||fusion.impact==='none'||!attacker||!victim)return false;
 const frame=Number(attacker._forgeActionClock)||0;
 const stat=attacker._fusionImpactFrame===frame?attacker._fusionImpactCount||0:0;
 if(stat>=5)return false; // bound splash bursts in 100-skill loadouts
 attacker._fusionImpactFrame=frame;attacker._fusionImpactCount=stat+1;
 const nearby=typeof api.enemies==='function'?api.enemies(attacker):[];
 const targets=Array.isArray(nearby)?nearby.filter(e=>e&&e!==attacker&&e.hp>0):[];
 const radius=cap(fusion.radius,35,160,85);
 const x=victim.x,y=victim.y;
 const otherAction={...action,type:'wave',fusion:undefined,
  damage:Math.max(1,Math.round((Number(action.damage)||0)*.32)),
  radius,status:action.status||'none',knockback:0};
 if(fusion.impact==='burst'){
  g.BattleFX?.cast?.(attacker,'wave',{x,y,radius,color:action.visual?.color||
    attacker.forge?.effectColor||'#b4a3ff'});
  for(const e of targets){
   if(e===victim||Math.hypot(e.x-x,e.y-y)>radius+(e.radius||0))continue;
   api.hit?.(attacker,e,otherAction,.75);
  }
 }else{
  for(const e of targets){
   const dx=x-e.x,dy=y-e.y,d=Math.hypot(dx,dy)||1;
   if(d>radius+(e.radius||0))continue;
   const strength=1.9*(1-Math.min(.85,d/(radius+(e.radius||0))));
   const sign=fusion.impact==='repulse'?-1:1;
   e.vx=cap((Number(e.vx)||0)+dx/d*strength*sign,-18,18,0);
   e.vy=cap((Number(e.vy)||0)+dy/d*strength*sign,-18,18,0);
   if(fusion.impact==='vortex'){
    e.vx=cap(e.vx-dy/d*.8,-18,18,0);
    e.vy=cap(e.vy+dx/d*.8,-18,18,0);
   }
  }
  g.BattleFX?.mark?.('wave',x,y,action.visual?.color||'#b4a3ff',18);
 }
 return true;
}
g.ConceptFusion=Object.freeze({ELEMENTS,FORMS,IMPACTS,normalize,analyze,weave,impact,terminalIntent,terminalShieldIntent,shardAnaphora,childChase});
})(typeof window!=='undefined'?window:globalThis);
