/* Korean skill descriptions -> sandboxed SkillForge recipes. */
(function(global){
'use strict';
const patterns=[
 ['bolt',/번개|낙뢰|벼락|천둥|전격|전기|뇌격/],
 ['beam',/레이저|광선|빔|빛줄기/],
 ['wave',/충격파|파동|폭발|폭풍|진동|지진|음파/],
 ['shot',/화살|탄막|구슬|투사체|미사일|발사|연발|총알|얼음창|불덩|검기|사격/],
 ['dash',/돌진|돌격|급습|박치기|태클|추적/],
 ['blink',/순간이동|텔레포트|점멸|뒤에 나타/],
 ['heal',/회복|치유|재생|체력을 채/],
 ['shield',/방어막|보호막|실드|무적|배리어/],
 ['pull',/끌어당|흡입|중력|빨아들|블랙홀/],
 ['orbit',/소환|주변을 돌|회전|드론|분신/],
 ['zone',/장판|영역|오라|독안개|불바다|지속 피해/]
];
const extract=(text,regex,def)=>{const m=text.match(regex);return m?Number(m[1]):def;};
const cap=(n,min,max)=>Math.max(min,Math.min(max,n));
const status=t=>/빙결|얼음|서리|냉기|둔화|느리/.test(t)?'ice':/독|중독|맹독/.test(t)?'poison':/불|화염|화상|용암|폭염/.test(t)?'fire':'none';
function parse(text,name=''){
  const original=String(text||'').trim();
  if(original.length<5)throw Error('능력을 자세히 설명해 주세요.');
  const sentences=original.split(/(?:\n|[.!?。]|그리고|또한|추가로)+/).map(t=>t.trim()).filter(Boolean);
  const skills=[],unmapped=[];
  for(const sentence of sentences.slice(0,10)){
    const bits=sentence.split(/(?:한\s*후|한\s*뒤|하고\s*나서|이후|뒤이어|다음으로|→|->)+/).map(t=>t.trim()).filter(Boolean);
    const stages=[];
    for(const bit of bits){
      const types=patterns.filter(([,re])=>re.test(bit));
      if(!types.length){unmapped.push(bit.slice(0,40));continue;}
      for(const [type] of types.slice(0,3)){
        const count=cap(Math.round(extract(bit,/(?:총|동시에|연속|한번에)\s*(\d+)\s*(?:개|발|번|마리|줄기)?/,extract(bit,/(\d+)\s*(?:발|줄기|개)\s*(?:의|를|을)?/,1))),1,8);
        stages.push({
          type,damage:cap(extract(bit,/(?:피해량|데미지|공격력|피해|위력)\s*(?:가|는|을|:|=)?\s*(\d{1,3})/,/강력|거대한|필살|초강력/.test(bit)?48:18),0,120),
          radius:cap(extract(bit,/(?:범위|반경|사거리|거리)\s*(?:는|를|:|=)?\s*(\d{2,3})/,130),30,300),
          count,speed:cap(extract(bit,/(?:탄속|속도)\s*(?:는|를|:|=)?\s*(\d+(?:\.\d+)?)/,5),2,14),
          duration:cap(extract(bit,/(?:지속|유지|동안)\s*(?:은|:|=)?\s*(\d+(?:\.\d+)?)\s*초/,1.8),.2,8),
          status:status(bit),knockback:cap(extract(bit,/넉백\s*(\d+(?:\.\d+)?)/,2),0,9),
          delay:cap(extract(bit,/(\d+(?:\.\d+)?)\s*초\s*후/,0),0,2)
        });
      }
    }
    if(!stages.length)continue;
    const low=sentence.match(/(?:체력|HP)\s*(\d{1,2})\s*%\s*(?:이하|미만|남으면|떨어지면)/i);
    const trigger=low?'lowhp':/피격|공격을\s*받|맞을\s*때|맞으면/.test(sentence)?'damaged':/접촉|부딪|충돌/.test(sentence)?'contact':'auto';
    const cd=cap(extract(sentence,/(?:쿨타임|재사용\s*대기|매|마다|주기)\s*(\d+(?:\.\d+)?)\s*초/,/난사|빠르게|연속/.test(sentence)?1:3),.2,30);
    skills.push({name:sentence.slice(0,18),trigger,cooldown:cd,threshold:low?Number(low[1]):40,actions:stages.slice(0,3)});
    if(skills.length>=4)break;
  }
  if(!skills.length)throw Error('전투 동작을 찾지 못했습니다. 예: "3초마다 번개 3줄기를 내려쳐 피해 45"');
  const result=SkillForge.normalize({
    name:name||'나만의 캐릭터',blurb:original.slice(0,90),
    color:status(original)==='fire'?'#a94f26':status(original)==='ice'?'#3d7da7':'#756483',
    hp:extract(original,/(?:기본\s*체력|최대\s*체력|HP)\s*(?:은|:|=)?\s*(\d{2,4})/,250),
    speed:extract(original,/(?:기본\s*속도|이동\s*속도)\s*(?:는|:|=)?\s*(\d+(?:\.\d+)?)/,1.8),
    skills
  });
  return {profile:result,unmapped:[...new Set(unmapped)],mode:'grammar'};
}
async function analyze(text,name){
  const fallback=parse(text,name);
  const LM=global.LanguageModel;
  if(!LM||typeof LM.availability!=='function')return fallback;
  try{
    const settings={expectedInputs:[{type:'text',languages:['ko']}],expectedOutputs:[{type:'text',languages:['ko']}]};
    if(await LM.availability(settings)!=='available')return fallback;
    const model=await LM.create(settings);
    const prompt='Convert the following Korean fictional combat ability description into a JSON game recipe. Return only JSON object with fields name,hp,speed,color,skills. Each skill has name,trigger,cooldown,threshold,actions. Each action has type,damage,radius,count,speed,duration,status,knockback,delay. Valid type: wave,shot,beam,bolt,dash,blink,heal,shield,pull,orbit,zone. Valid trigger: auto,lowhp,damaged,contact. Valid status: none,ice,fire,poison. Max 4 skills and 3 actions per skill. Respect numeric rules and temporal order. Never produce executable code. Name: '+name+' Description: '+text;
    const raw=await model.prompt(prompt);model.destroy?.();
    const obj=JSON.parse(String(raw).trim());
    const cfg=SkillForge.normalize(obj);cfg.name=name||cfg.name;cfg.blurb=text.slice(0,90);
    return {profile:cfg,unmapped:[],mode:'on-device-ai'};
  }catch(e){return fallback;}
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
      status.textContent=(out.mode==='on-device-ai'?'기기 내 AI':'문장 규칙')+' 분석 완료 · 스킬 '+out.profile.skills.length+'개'
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
