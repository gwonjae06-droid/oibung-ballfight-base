/* Korean semantic ability parser: aliases -> meaning -> safe Forge actions.
 * Offline grammar fallback; optional on-device AI can also produce validated recipes. */
(function(global){
'use strict';
const CAPABILITIES={
  bolt:{name:'낙뢰',lex:/번개|낙뢰|벼락|천둥|전격|뇌격|뇌전|전기\s*(?:공격|스킬)|라이트닝|lightning/gi},
  beam:{name:'광선',lex:/레이저|광선|빔|빛줄기|열선|laser|beam/gi},
  wave:{name:'충격파',lex:/충격파|파동|폭발|폭풍|진동|지진|음파|소닉붐|폭쇄/gi},
  shot:{name:'투사체',lex:/화살|탄막|구슬|투사체|미사일|발사|연발|총알|얼음창|불덩|검기|사격|쏘(?:다|아|고|는|면)?|발포|투척/gi},
  dash:{name:'돌진',lex:/돌진|돌격|급습|박치기|태클|질주|달려들|달려가|뛰어들/gi},
  blink:{name:'텔레포트',lex:/순간\s*이동|텔레포트|텔포|점멸|워프|공간\s*이동|위치\s*교환|뒤(?:로|에)\s*(?:이동|나타)|이동(?!\s*(?:속도|속력|속성|량|중))/gi},
  heal:{name:'회복',lex:/회복|치유|재생|힐(?:링)?|체력을?\s*(?:채우|회복)/gi},
  shield:{name:'보호막',lex:/방어막|보호막|실드|쉴드|무적|배리어|방패(?:를?\s*펼치)?/gi},
  pull:{name:'흡입',lex:/끌어당|흡입|중력|빨아들|끌어오|블랙홀|당겨오/gi},
  orbit:{name:'회전 소환체',lex:/소환|주변을\s*돌|회전(?:체|구체)|드론|분신|궤도/gi},
  zone:{name:'지속 장판',lex:/장판|영역|오라|독안개|불바다|필드|독(?!특|점|립|서)|도트\s*(?:딜|데미지|대미지|뎀|피해)|독\s*(?:딜|데미지|대미지|피해)|독딜|dot(?:\s*(?:damage|dmg))?|지속\s*(?:피해|딜|데미지|대미지)|초당\s*(?:피해|데미지|대미지)|틱(?:딜|뎀)|중독시키|중독|독(?:을|으로)\s*(?:걸|입히|묻히)/gi}
};
const EFFECTS={
  ice:/빙결|얼음|서리|냉기|둔화|슬로우|slow/gi,
  fire:/화염|불꽃|화상|불길|용암|폭염|burn/gi,
  poison:/맹독|중독|독(?!특|점|립|서)|독딜|독\s*(?:딜|피해|데미지|대미지)|도트\s*(?:데미지|대미지|딜|피해|뎀)|dot(?:\s*(?:damage|dmg))?|지속\s*(?:피해|딜|데미지|대미지)|초당\s*(?:데미지|피해)|틱(?:뎀|딜)|poison|독(?:을|으로)\s*(?:걸|입히|묻히)/gi
};
const CONVENTIONS=[
  [/순간\s*이동|텔포|텔레포트|점멸|워프|(?:이동(?!\s*(?:속도|속력|속성|량|중)))/i,'이동 표현 → 텔레포트'],
  [/번개|벼락|천둥|전격|라이트닝/i,'번개 계열 → 낙뢰'],
  [/도트\s*(?:데미지|대미지|딜|피해)|독딜|독\s*피해|지속\s*피해|초당\s*피해|중독|독(?:을|이|으로|\s|$)/i,'지속 피해 표현 → 독 DoT']
];
const pickNum=(s,re,def)=>{const m=String(s).match(re);return m?Number(m[1]):def;};
const cap=(n,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(n)?n:lo));
const test=(re,s)=>{re.lastIndex=0;return re.test(s);};
const status=(s)=>{
  // A named element beats a generic DoT synonym.
  if(test(EFFECTS.ice,s))return 'ice';
  if(test(EFFECTS.fire,s))return 'fire';
  if(test(EFFECTS.poison,s))return 'poison';
  return 'none';
};
const isDot=s=>test(/도트\s*(?:데미지|대미지|딜|뎀|피해)|독\s*(?:딜|데미지|대미지|피해)|독딜|dot(?:\s*(?:damage|dmg))?|지속\s*(?:피해|딜|데미지|대미지)|초당\s*(?:피해|데미지)|틱(?:뎀|딜)|중독/i,s);
function placement(s){
  if(/부채꼴|산탄|넓게\s*퍼|전방으로\s*퍼/.test(s))return 'fan';
  if(/원형|방사형|사방|360도|전방위|원\s*둘레/.test(s))return 'radial';
  if(/일렬|한\s*줄|직선상|줄지어|열을\s*지어/.test(s))return 'line';
  if(/십자|교차|크로스/.test(s))return 'cross';
  if(/나선|소용돌이|회오리|빙글빙글/.test(s))return 'spiral';
  if(/무작위|랜덤\s*위치|산개|불규칙|아무\s*곳/.test(s))return 'scatter';
  return 'direct';
}
function selectTarget(s){
  if(/가장\s*멀|멀리\s*있는|먼\s*적|최원거리/.test(s))return 'farthest';
  if(/체력(?:이|가)?\s*가장\s*낮|HP\s*가장\s*낮|약한\s*적|피가\s*적/.test(s))return 'lowest';
  if(/체력(?:이|가)?\s*가장\s*높|HP\s*가장\s*높|강한\s*적|피가\s*많/.test(s))return 'highest';
  if(/무작위\s*적|랜덤\s*적|임의의\s*적/.test(s))return 'random';
  if(/모여\s*있는|뭉친\s*적|여럿\s*모|밀집|군집/.test(s))return 'cluster';
  return 'nearest';
}
function matchActions(piece){
  const hits=[];
  for(const [type,info] of Object.entries(CAPABILITIES)){
    const re=new RegExp(info.lex.source,'gi');let m;
    while((m=re.exec(piece))!==null){
      // Not performing an ability is not a positive activation.
      const tail=piece.slice(m.index+m[0].length,m.index+m[0].length+14);
      if(/^(?:하지\s*않|하지\s*마|못\s*하|없|금지|제외)/.test(tail))continue;
      hits.push({type,start:m.index,word:m[0],end:m.index+m[0].length});
    }
  }
  hits.sort((a,b)=>a.start-b.start || (b.end-b.start)-(a.end-a.start));
  // Nested synonyms such as 순간이동/이동 and 독딜/독 damage describe one action.
  const distinct=[];
  for(const hit of hits){
    if(distinct.some(h=>hit.start>=h.start&&hit.end<=h.end))continue;
    if(!distinct.some(h=>h.type===hit.type))distinct.push(hit);
  }
  // "낙뢰에 독딜을 묻힌다": one poisonous bolt, not a redundant poison puddle.
  const physical=distinct.some(h=>h.type!=='zone');
  if(physical && isDot(piece) && !/장판|독안개|영역|필드|바닥/.test(piece)){
    return distinct.filter(h=>h.type!=='zone');
  }
  return distinct;
}
function actionOf(type,fragment,whole,step){
  const form=placement(fragment)!=='direct'?placement(fragment):placement(whole);
  const target=selectTarget(fragment)!=='nearest'?selectTarget(fragment):selectTarget(whole);
  const countDefault=form==='direct'?1:5;
  const count=pickNum(fragment,/(?:총|동시에|연속|한\s*번에)\s*(\d+)\s*(?:개|발|번|마리|줄기)?/,
    pickNum(fragment,/(\d+)\s*(?:발|줄기|개)\s*(?:의|를|을)?/,countDefault));
  const power=pickNum(fragment,/(?:피해량|데미지|대미지|공격력|피해|위력|독딜|도트딜|도트데미지)\s*(?:가|는|을|:|=)?\s*(\d{1,3})(?![\d.]|\s*초)/,
    pickNum(fragment,/(\d{1,3})\s*(?:피해|데미지|대미지|딜|대미지를|데미지를)/,/강력|거대|필살|초강력/.test(fragment)?48:18));
  return {
    type,pattern:form,target,
    damage:cap(power,0,120),
    radius:cap(pickNum(fragment,/(?:범위|반경|사거리|거리)\s*(?:는|를|:|=)?\s*(\d{2,3})/,130),30,300),
    count:cap(Math.round(count),1,8),
    speed:cap(pickNum(fragment,/(?:탄속|투사체\s*속도|스킬\s*속도)\s*(?:는|를|:|=)?\s*(\d+(?:\.\d+)?)/,5),2,14),
    duration:cap(pickNum(fragment,/(?:지속|유지|동안)\s*(?:은|:|=)?\s*(\d+(?:\.\d+)?)\s*초/,
      pickNum(fragment,/(\d+(?:\.\d+)?)\s*초\s*(?:간|동안|유지|지속)/,1.8)),.2,8),
    status:status(fragment),
    knockback:cap(pickNum(fragment,/넉백\s*(\d+(?:\.\d+)?)/,2),0,9),
    delay:cap(pickNum(fragment,/(\d+(?:\.\d+)?)\s*초\s*후/,step*.25),0,8)
  };
}
function parse(text,name=''){
  const original=String(text||'').trim();
  if(original.length<4)throw Error('능력을 구체적으로 적어 주세요.');
  if(original.length>1400)throw Error('능력 설명은 1,400자 이하로 작성하세요.');
  const sentences=original.split(/\.(?!\d)|[\n!?。]+|(?:그리고|또한|추가로)(?=\s*\S)/).map(s=>s.trim()).filter(Boolean);
  const skills=[],unmapped=[],aliases=new Set();
  for(const [re,msg] of CONVENTIONS)if(test(re,original))aliases.add(msg);
  for(const sentence of sentences.slice(0,14)){
    if(skills.length>=4)break;
    // Connectors define ordering. Plain co-occurrences follow first mention.
    // Keep "3초 후" together for precise timing, but split
    // "이동 후 독딜" and "텔레포트하고 독딜" into distinct actions.
    const segmented=sentence
      .replace(/(순간\s*이동|텔레포트|텔포|점멸|워프|이동|낙뢰|번개|벼락|충격파|돌진)\s*후\s*/g,'$1 → ')
      .replace(/(순간\s*이동|텔레포트|텔포|점멸|워프|이동|낙뢰|번개|벼락|충격파|돌진)하고\s*/g,'$1 → ')
      .replace(/\s+하고\s+/g,' → ')
      .replace(/(?:걸고|입히고|뿌리고|시키고|던지고|발사하고)\s*,?\s*(?=\S)/g,' → ');
    const fragments=segmented.split(/(?:그\s*후|그다음|그\s*다음|뒤이어|이어서|이후|한\s*뒤|한\s*후|하고\s*나서|→|->)+/).map(s=>s.trim()).filter(Boolean);
    const actions=[];
    for(const fragment of fragments){
      const matches=matchActions(fragment);
      if(!matches.length){
        if(!/^(?:체력|HP|쿨타임|매\s*\d|주기|공격력|속도|이동\s*속도|기본\s*체력|최대\s*체력)/i.test(fragment))unmapped.push(fragment.slice(0,70));
        continue;
      }
      for(const match of matches) {
        if(actions.length>=3)break;
        const act=actionOf(match.type,fragment,sentence,actions.length);
        // A continuation usually describes the next action, not a second cooldown.
        actions.push(act);
      }
    }
    if(!actions.length)continue;
    // Only explicit standalone continuation after punctuation merges into an earlier combo.
    if(skills.length && /^(?:그\s*후|그다음|그\s*다음|이어서|뒤이어|다음으로)/.test(sentence)){
      const prev=skills[skills.length-1];
      for(const a of actions.slice(0,Math.max(0,3-prev.actions.length))){
        a.delay=cap(Math.max(a.delay,prev.actions.length*.25),0,8);
        prev.actions.push(a);
      }
      continue;
    }
    const low=sentence.match(/(?:체력|HP)\s*(\d{1,2})\s*%\s*(?:이하|미만|남으면|떨어지면|아래)/i);
    const trig=low?'lowhp':/피격|공격을\s*받|맞을\s*때|맞으면/.test(sentence)?'damaged':/접촉|부딪|충돌/.test(sentence)?'contact':'auto';
    const cooldown=cap(pickNum(sentence,/(?:쿨타임|재사용\s*대기|매|마다|주기)\s*(\d+(?:\.\d+)?)\s*초/,
       pickNum(sentence,/(\d+(?:\.\d+)?)\s*초\s*마다/,/연속|난사|빠르게/.test(sentence)?1:3)),.2,30);
    skills.push({
      name:sentence.slice(0,18),trigger:trig,cooldown,threshold:low?Number(low[1]):40,
      actions:actions.slice(0,3)
    });
  }
  if(!skills.length)throw Error('전투 동작을 찾지 못했습니다. 예: "3초마다 텔레포트 후 독딜을 건다"');
  const cfg=SkillForge.normalize({
    name:name||'나만의 캐릭터',blurb:original.slice(0,90),
    color:status(original)==='fire'?'#a94f26':status(original)==='ice'?'#3d7da7':'#756483',
    hp:pickNum(original,/(?:기본\s*체력|최대\s*체력|HP)\s*(?:은|:|=)?\s*(\d{2,4})/,250),
    speed:pickNum(original,/(?:기본\s*속도|이동\s*속도)\s*(?:는|:|=)?\s*(\d+(?:\.\d+)?)/,1.8),
    skills
  });
  return {profile:cfg,unmapped:[...new Set(unmapped)],aliases:[...aliases],mode:'grammar'};
}
async function analyze(text,name){
  // An unfamiliar description must still reach the language model; do not
  // reject it merely because the offline fallback lacks a keyword.
  const LM=global.LanguageModel;
  if(LM&&typeof LM.availability==='function'){
    try{
      const settings={expectedInputs:[{type:'text',languages:['ko']}],expectedOutputs:[{type:'text',languages:['ko']}]};
      if(await LM.availability(settings)==='available'){
        const model=await LM.create(settings);
        try{
          const prompt='Interpret Korean combat abilities semantically, including colloquial synonyms. 이동/순간이동/텔포/점멸 = blink (unless 이동속도); 번개/벼락/낙뢰 = bolt; 독딜/도트데미지/지속피해 = poison DoT. Convert into JSON with name,hp,speed,color,skills and each skill name,trigger,cooldown,threshold,actions. Every action uses type,pattern,target,damage,radius,count,speed,duration,status,knockback,delay. Allowed type wave,shot,beam,bolt,dash,blink,heal,shield,pull,orbit,zone; pattern direct,fan,radial,line,cross,spiral,scatter; target nearest,farthest,lowest,highest,random,cluster; status none,ice,fire,poison. Up to 4 skills and 3 sequential actions per skill. Only JSON, no code. Name: '+name+' Description: '+text;
          const raw=await model.prompt(prompt);
          const parsed=JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g,'').trim());
          const p=SkillForge.normalize(parsed);p.name=name||p.name;p.blurb=String(text).slice(0,90);
          return {profile:p,unmapped:[],aliases:[],mode:'on-device-ai'};
        }finally{model.destroy?.();}
      }
    }catch(_){/* unavailable model / unsupported input -> deterministic fallback */}
  }
  return parse(text,name);
}

function install(){
  const holder=document.getElementById('forge-skills');
  if(!holder)return;
  const body=holder.parentElement;
  const box=document.createElement('section');box.className='forge-prompt';
  box.innerHTML='<label for="forge-natural-text">원하는 캐릭터 능력을 문장으로 적어주세요</label>'
    +'<textarea id="forge-natural-text" rows="6" maxlength="1200" placeholder="체력 30% 이하일 때 3초마다 번개 3줄기를 떨어뜨려 피해 45를 준다. 그 후 2초간 보호막을 펼친다."></textarea>'
    +'<button type="button" id="forge-natural-build">문장 분석 · 자동 생성</button>'
    +'<div id="forge-natural-status" role="status" aria-live="polite"></div>';
  body.insertBefore(box,holder);
  const catalogDetail=document.createElement('details');catalogDetail.className='forge-advanced';
  const catalogSummary=document.createElement('summary');
  catalogSummary.textContent='공격 동작 도감 · '+(global.AbilityAtlas?.count||0)+'가지';
  catalogDetail.append(catalogSummary);
  const catalogBody=document.createElement('div');catalogBody.className='atlas-list-wrap';
  catalogBody.innerHTML='<label for="atlas-query">동작 검색</label>'
    +'<input id="atlas-query" type="search" placeholder="예: 낙뢰 / 나선형 / 체력 낮은 적">'
    +'<div id="atlas-list" class="atlas-list"></div>'
    +'<p class="bf-helper">도감의 항목을 선택하면 현재 스킬 초안의 첫 동작으로 적용합니다.</p>';
  catalogDetail.append(catalogBody);
  body.insertBefore(catalogDetail,holder);
  const atlasQuery=catalogBody.querySelector('#atlas-query');
  const atlasList=catalogBody.querySelector('#atlas-list');
  function renderAtlas(){
    atlasList.replaceChildren();
    const term=atlasQuery.value.trim().toLowerCase();
    const items=(global.AbilityAtlas?.catalog||[]).filter(x=>!term||x.name.toLowerCase().includes(term)||x.id.includes(term));
    for(const item of items.slice(0,35)){
      const row=document.createElement('button');
      row.type='button';row.className='atlas-preset';row.textContent=item.name;
      row.onclick=()=>{
        const p=global.SkillForge;
        const current=p.normalize({name:document.getElementById('bf-name').value||'도감 파이터',skills:[{
          name:item.name.slice(0,18),trigger:'auto',cooldown:3,actions:[{
            type:item.type,pattern:item.pattern,target:item.target,
            count:item.pattern==='direct'?1:5,damage:20,radius:150,speed:5,duration:2
          }]
        }]});
        p.setDraft(current);
        document.getElementById('forge-natural-status').textContent='도감 동작 적용 완료: '+item.name;
        catalogDetail.open=false;
      };
      atlasList.append(row);
    }
    if(!items.length)atlasList.textContent='검색 결과가 없습니다.';
  }
  catalogDetail.addEventListener('toggle',()=>{if(catalogDetail.open)renderAtlas();});
  atlasQuery.addEventListener('input',renderAtlas);
  const advanced=document.createElement('details');advanced.className='forge-advanced';
  const sum=document.createElement('summary');sum.textContent='스킬 세부 설정 (선택)';
  body.insertBefore(advanced,holder);advanced.append(sum,holder);
  const add=document.getElementById('forge-add-skill');if(add)advanced.append(add);
  const button=document.getElementById('forge-natural-build'),input=document.getElementById('forge-natural-text'),status=document.getElementById('forge-natural-status');
  let approved='';
  button.addEventListener('click',async()=>{
    button.disabled=true;status.textContent='분석 중';
    try{
      const text=input.value.trim();
      const out=await analyze(text,document.getElementById('bf-name').value.trim());
      SkillForge.setDraft(out.profile);approved=text;
      status.textContent=(out.mode==='on-device-ai'?'기기 내 AI':'의미 분석')+' 완료 · 스킬 '+out.profile.skills.length+'개'
        +(out.aliases?.length?'\n유사 표현 인식: '+out.aliases.join(' / '):'')
        +(out.unmapped.length?'\n구현 확인이 필요한 표현: '+out.unmapped.slice(0,3).join(' / '):'')
        +'\n아래 캐릭터 생성 버튼으로 등록하거나 세부 설정을 수정할 수 있습니다.';
    }catch(e){approved='';status.textContent='분석 실패: '+e.message;}
    button.disabled=false;
  });
  input.addEventListener('input',()=>{approved='';});
  const create=document.getElementById('bf-create');
  create?.addEventListener('click',e=>{
    if(input.value.trim()!==approved&&input.value.trim()){
      e.preventDefault();e.stopImmediatePropagation();status.textContent='변경된 문장을 먼저 분석해 주세요.';
    }
  },true);
}
global.NaturalForge={parse,analyze};
if(typeof document!=='undefined'&&document.getElementById('forge-skills'))install();
})(window);
