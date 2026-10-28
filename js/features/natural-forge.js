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
const EXTRA_LEX={
  flight:/공중|비행|날아올|날개|하늘로|강하/gi,burrow:/지하|땅속|잠복|굴을|땅굴/gi,
  blackhole:/블랙홀|우주\s*중력|중력장/gi,starfall:/별비|별의\s*비|별들이\s*떨어|별들이\s*쏟아|별이\s*내리|별\s*소나기|유성우|별똥별\s*비/gi,
  dung:/똥|대변|배설|응가/gi,lifebloom:/생명|생명의\s*꽃|치유의\s*꽃/gi,
  resurrect:/부활|되살아|다시\s*살아|불사조/gi,timestop:/시간\s*(?:을\s*)?(?:정지|멈)|시공간\s*정지/gi,
  rewind:/시간\s*(?:을\s*)?되감|과거로\s*돌아|시간\s*역행/gi,timeburst:/시간\s*가속|시계를\s*빠르게/gi,
  homing:/유도탄|유도\s*미사일|추적탄|추적하는|쫓아가는|따라가는/gi,
  pierce:/관통탄|관통|꿰뚫|뚫고/gi,boomerang:/부메랑|되돌아오는|돌아오는\s*(?:칼|검|탄)/gi,
  chain:/연쇄\s*(?:번개|낙뢰|전격)|체인\s*라이트닝|옮겨\s*붙는\s*번개/gi,
  nova:/주변\s*폭발|자신\s*주위.*폭발|몸에서\s*폭발/gi,
  meteor:/운석|유성|메테오|별똥별/gi,mine:/지뢰|덫|함정/gi,
  drain:/흡혈|생명력\s*흡수|체력\s*훔|피를\s*빨/gi,
  swap:/위치\s*교환|자리\s*바꾸|자리를\s*바꾸/gi,
  retreat:/후퇴|백스텝|뒤로\s*도약|거리를\s*벌/gi,
  cleanse:/정화|해독|상태이상\s*해제|디버프\s*제거/gi,
  haste:/가속|이속\s*증가|이동\s*속도\s*증가|신속|빠르게\s*달/gi,
  regen:/지속\s*재생|지속\s*회복|재생|초마다\s*체력\s*회복/gi,
  fortify:/피해\s*감소|방어력\s*증가|철갑|단단해|받는\s*피해.*줄/gi
};
for(const [type,lex] of Object.entries(EXTRA_LEX))if(SkillForge.TYPE?.[type])CAPABILITIES[type]={name:SkillForge.TYPE?.[type],lex};
const ADVANCED_LEX={
  leap:/도약|높이\s*뛰|점프|뛰어\s*오르|솟아\s*오르/gi,
  hover:/체공|공중에\s*(?:멈춰|떠있|떠\s*있|머물)/gi,
  glide:/활공|글라이딩|공중\s*미끄러|날아\s*다니/gi,
  dive:/급강하|내려찍|공중\s*강습|급히\s*내려|내리꽂/gi,
  uppercut:/어퍼컷|올려치|띄워\s*올리|공중으로\s*띄우/gi,
  slash:/검격|베기|베어|베다|베고|칼로\s*치|참격/gi,
  spinslash:/회전\s*베기|회전\s*검격|휠윈드|칼을\s*휘두르/gi,
  thrust:/찌르기|찌른|찌르고|찌르며|관통\s*찌르|검으로\s*꿰뚫/gi,
  aircombo:/공중\s*연속\s*공격|공중\s*콤보|공중에서\s*연타/gi,
  arcshot:/곡사탄|포물선\s*(?:탄|발사|공격)|곡사\s*공격|곡선\s*투사체/gi,
  splitshot:/분열탄|분열\s*탄환|갈라지는\s*탄|쪼개지는\s*탄/gi,
  wall:/벽(?:을|를)?\s*(?:설치|생성|세우|만들)|장벽(?:을|를)?\s*(?:설치|생성|세우|만들)|방벽/gi,
  portal:/포탈|포털|게이트|차원문|이동문/gi,
  summon:/추적\s*소환수|소환수|펫\s*소환|사역마|전투\s*분신/gi,
  turret:/포탑|터렛|자동\s*포대|방어\s*탑/gi,
  trap:/덫|함정|트랩/gi,
  grow:/거대화|몸(?:집|크기)을?\s*키우|커지|몸집\s*확대/gi,
  shrink:/소형화|작아지|몸(?:집|크기)을?\s*줄이|축소/gi,
  burrowdash:/땅굴\s*돌진|땅속\s*돌진|잠복\s*이동|지하\s*이동/gi,
  erupt:/솟구치|지면에서\s*튀어나오|땅에서\s*등장/gi
};
for(const [type,lex] of Object.entries(ADVANCED_LEX))
  if(SkillForge.TYPE?.[type])CAPABILITIES[type]={name:SkillForge.TYPE[type],lex};
// Concrete physical vocabulary; abstract themes are offered as explicit choices below.
CAPABILITIES.shot.lex=/화살|탄막|탄환|화염탄|냉기탄|불꽃탄|구슬|투사체|미사일|발사|연발|총알|얼음창|불덩|검기|사격|쏘(?:다|아|고|는|면)?|발포|투척|수리검|표창|창을|칼날|꽃잎|별을|별들이|씨앗|깃털|카드|동전|물방울/gi;
const EXTRA_EFFECTS={freeze:/빙결|얼려|얼린|얼어붙|동결/,stun:/기절|스턴|정신을\s*잃|마비/,root:/속박|묶|발을\s*붙잡|뿌리로/,silence:/침묵|봉인|스킬을?\s*막|마법을?\s*금지/,bleed:/출혈|피를\s*흘|상처를\s*벌/,shock:/감전|전류/,vulnerable:/취약|방어력\s*감소|갑옷을?\s*깨/,weak:/약화|공격력\s*감소|힘을\s*빼/,fear:/공포|겁을|도망가게|두려움/,charm:/매혹|유혹|홀리|홀려/,blind:/실명|눈을\s*멀|눈부|시야를\s*가/,curse:/저주|회복\s*감소|치유\s*방해/};
const EFFECTS={
  ice:/빙결|얼음|서리|냉기|둔화|슬로우|slow/gi,
  fire:/화염|불꽃|화상|불길|용암|폭염|burn/gi,
  poison:/맹독|중독|독(?!특|점|립|서)|독딜|독\s*(?:딜|피해|데미지|대미지)|도트\s*(?:데미지|대미지|딜|피해|뎀)|dot(?:\s*(?:damage|dmg))?|지속\s*(?:피해|딜|데미지|대미지)|초당\s*(?:데미지|피해)|틱(?:뎀|딜)|poison|독(?:을|으로)\s*(?:걸|입히|묻히)/gi
};
// Status riders describe the effect of the preceding delivery, not a
// second independent zone/attack (e.g. "탄을 발사하고 적을 중독시킨다").
const statusRider=s=>/^(?:적(?:을|에게|이|들이)?\s*)?(?:중독|기절|빙결|얼리|얼려|화상|태우|감전|출혈|마비|둔화|실명|속박|저주|느리게|약화)/.test(String(s).trim());
const CONVENTIONS=[
  [/순간\s*이동|텔포|텔레포트|점멸|워프|(?:이동(?!\s*(?:속도|속력|속성|량|중)))/i,'이동 표현 → 텔레포트'],
  [/번개|벼락|천둥|전격|라이트닝/i,'번개 계열 → 낙뢰'],
  [/도트\s*(?:데미지|대미지|딜|피해)|독딜|독\s*피해|지속\s*피해|초당\s*피해|중독|독(?:을|이|으로|\s|$)/i,'지속 피해 표현 → 독 DoT']
];
const pickNum=(s,re,def)=>{const m=String(s).match(re);return m?Number(m[1]):def;};
const cap=(n,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(n)?n:lo));
const test=(re,s)=>{re.lastIndex=0;return re.test(s);};
const status=(s)=>{
  for(const [key,re] of Object.entries(EXTRA_EFFECTS))if(SkillForge.STATUS?.[key]&&test(re,s))return key;
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
      const tail=piece.slice(m.index+m[0].length,m.index+m[0].length+20);
      if(/^(?:을|를|은|는|이|가)?\s*(?:하지\s*않|하지\s*마|쓰지\s*않|사용하지\s*않|못\s*하|없|금지|제외)/.test(tail))continue;
      hits.push({type,start:m.index,word:m[0],end:m.index+m[0].length});
    }
  }
  hits.sort((a,b)=>a.start-b.start || (b.end-b.start)-(a.end-a.start) || Number(Object.hasOwn(EXTRA_LEX,b.type))-Number(Object.hasOwn(EXTRA_LEX,a.type)));
  // Nested synonyms such as 순간이동/이동 and 독딜/독 damage describe one action.
  const distinct=[];
  for(const hit of hits){
    if(distinct.some(h=>hit.start>=h.start&&hit.end<=h.end))continue;
    if(!distinct.some(h=>h.type===hit.type))distinct.push(hit);
  }
  // "낙뢰에 독딜을 묻힌다": one poisonous bolt, not a redundant poison puddle.
  // Specific delivery wins over its generic noun (유도 미사일, 연쇄 번개).
  const specific=distinct.some(h=>Object.hasOwn(EXTRA_LEX,h.type));
  if(specific){
    const remove=new Set();
    if(distinct.some(h=>['homing','pierce','boomerang'].includes(h.type)))remove.add('shot');
    if(distinct.some(h=>h.type==='chain'))remove.add('bolt');
    if(distinct.some(h=>h.type==='swap'))remove.add('blink');
    if(distinct.some(h=>h.type==='regen'))remove.add('heal');
    if(distinct.some(h=>h.type==='blackhole')){remove.add('pull');remove.add('starfall');}
    if(distinct.some(h=>h.type==='timeburst'))remove.add('haste');
    if(distinct.some(h=>h.type==='lifebloom'))remove.add('heal');
    if(distinct.some(h=>h.type==='dung'))remove.add('shot');
    if(distinct.some(h=>h.type==='spinslash'))remove.add('slash');
    if(distinct.some(h=>h.type==='arcshot'||h.type==='splitshot'))remove.add('shot');
    if(distinct.some(h=>h.type==='portal'))remove.add('blink');
    if(distinct.some(h=>h.type==='summon'||h.type==='turret'))remove.add('orbit');
    if(distinct.some(h=>h.type==='burrowdash')){remove.add('burrow');remove.add('dash');remove.add('blink');}
    if(distinct.some(h=>h.type==='dive'))remove.add('flight');
    if(distinct.some(h=>h.type==='trap'))remove.add('mine');
    if(distinct.some(h=>h.type==='starfall'))remove.add('meteor');
    for(let i=distinct.length-1;i>=0;i--)if(remove.has(distinct[i].type))distinct.splice(i,1);
  }
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
function suggestions(text){
  if(/시간|운명|꿈|잠|정지/.test(text))return ['zone','shield','blink'];
  if(/슬픔|기억|별|눈물|꽃/.test(text))return ['shot','homing','orbit'];
  if(/복수|분노|빚/.test(text))return ['nova','drain','chain'];
  if(/수호|지켜|보호|사랑/.test(text))return ['shield','fortify','regen'];
  return ['shot','wave','zone'];
}
function isAllIntent(text){
  const input=String(text||'').replace(/\s+/g,' ');
  return /(?:모든|전체|전부|모조리)(?:의)?\s*(?:종류의\s*)?(?:스킬|능력|기술|마법|동작)(?:을|를|이|가|은|는|들)?\s*(?:가진|보유|사용|쓸\s*수|구사|익힌|장착|습득|지닌|쓰는|사용할|다\s*쓴|써)/i.test(input) ||
    /(?:스킬|능력|기술|마법|동작)\s*(?:전부|전체|모두|다)\s*(?:가진|사용|쓸\s*수|보유|습득|익힌)/i.test(input) ||
    /(?:모든\s*능력|모든\s*스킬|전능|만능\s*캐릭터)/i.test(input);
}

function triggerMeaning(s){
  if(/(?:체력|HP)\s*\d{1,2}\s*%|체력이?\s*(?:낮|부족|떨어)|죽기\s*직전/.test(s))return 'lowhp';
  if(/피격|맞(?:을\s*때|으면)|공격을\s*받|공격받/.test(s))return 'damaged';
  if(/접촉|부딪|충돌|닿으면/.test(s))return 'contact';
  return 'auto';
}
// Korean connective grammar: joining actions is not always adding skills.
const defensiveTypes=new Set(['heal','shield','cleanse','regen','fortify','lifebloom','resurrect','grow','shrink']);
const connectiveVerb=/(발사하|발사|쏘|던지|베|찌르|휘두르|올려치|소환하|소환|펼치|설치하|설치|회복하|치유하|만들|생성하|돌진하|이동하|뛰어오르|막|쓰|날리|뿌리|걸|입히|시키|점프하|날아오르|떠오르|사용하|폭발시키|공격하)고\s*,?\s*(?=\S)/g;
function clauseUnits(sentence){
  const divided=sentence.replace(connectiveVerb,(_,verb)=>verb+'고 ↝ ')
    .replace(/(?:,\s*)?(그리고|또한|추가로)\s+/g,(_,connector)=>' ↝'+connector+' ');
  return divided.split(/\s*↝/).map((t,i)=>{
    t=t.trim();const m=i&&t.match(/^(그리고|또한|추가로)\s*/);
    return {text:m?t.slice(m[0].length).trim():t,link:m?m[1]:(i?'고':'start')};
  }).filter(x=>x.text);
}
function groupConnection(left,right,link){
  const a=matchActions(left),b=matchActions(right);
  if(statusRider(right))return 'modifier';
  if(!a.length||!b.length)return 'modifier'; // extra status, not an independent attack
  if(/(?:그\s*후|그\s*다음|이어서|연달아|연계해서|그대로|한\s*번에|곧바로|바로\s*이어)/.test(right))return 'combo';
  if(/(?:별도(?:의|로)?|독립(?:된|적으로)?|다른\s*(?:능력|스킬)|또\s*다른|새로운\s*스킬)/.test(right))return 'separate';
  const ltrigger=triggerMeaning(left),rtrigger=triggerMeaning(right);
  if(ltrigger!==rtrigger&&rtrigger!=='auto')return 'separate';
  const aDefense=a.some(x=>defensiveTypes.has(x.type));
  const bDefense=b.some(x=>defensiveTypes.has(x.type));
  if(aDefense!==bDefense)return 'separate';
  if(link==='고')return 'combo';
  return 'ambiguous'; // "그리고" can mean a combo or a second skill.
}
function semanticSentences(text,choices={},questions=[]){
  const result=[];
  for(const original of String(text).split(/\.(?!\d)|[\n!?。]+/).map(x=>x.trim()).filter(Boolean)){
    const units=clauseUnits(original);
    if(!units.length)continue;
    let phrase=units[0].text;
    for(const unit of units.slice(1)){
      const meaning=groupConnection(phrase,unit.text,unit.link);
      if(meaning==='modifier'){phrase+=' '+unit.text;continue;}
      const key='연결 방식: '+phrase+' / '+unit.text;
      let relation=meaning;
      if(meaning==='ambiguous'){
        if(choices[key]==='combo')relation='combo';
        else if(choices[key]==='separate')relation='separate';
        else{
          questions.push({kind:'grouping',text:key,options:['combo','separate']});
          relation='combo';
        }
      }
      if(relation==='separate'){result.push(phrase);phrase=unit.text;}
      else phrase+=' → '+unit.text;
    }
    result.push(phrase);
  }
  return result;
}
function parse(text,name='',choices={}){
  const original=String(text||'').trim();
  if(original.length<4)throw Error('능력을 구체적으로 적어 주세요.');
  if(original.length>1400)throw Error('능력 설명은 1,400자 이하로 작성하세요.');
  if(isAllIntent(original)){
    return {profile:SkillForge.allProfile(name||'만능 파이터',original),
      unmapped:[],questions:[],aliases:['전체 능력 모드: 등록된 모든 스킬을 독립적으로 사용'],
      mode:'grammar',interpretation:'전체 '+SkillForge.allSkillset().length+'종류의 스킬을 모두 보유합니다. 각 스킬은 개별 쿨타임을 갖습니다.'};
  }
  const skills=[],unmapped=[],aliases=new Set(),questions=[];
  const sentences=semanticSentences(original,choices,questions);
  for(const [re,msg] of CONVENTIONS)if(test(re,original))aliases.add(msg);
  for(const sentence of sentences.slice(0,14)){
    if(skills.length>=4){unmapped.push('스킬은 최대 4개입니다: '+sentence);break;}
    // Connectors define ordering. Plain co-occurrences follow first mention.
    // Keep "3초 후" together for precise timing, but split
    // "이동 후 독딜" and "텔레포트하고 독딜" into distinct actions.
    const segmented=sentence
      .replace(/(순간\s*이동|텔레포트|텔포|점멸|워프|이동|낙뢰|번개|벼락|충격파|돌진)\s*후\s*/g,'$1 → ')
      .replace(/(순간\s*이동|텔레포트|텔포|점멸|워프|이동|낙뢰|번개|벼락|충격파|돌진)하고\s*/g,'$1 → ')
      .replace(/\s+하고\s+/g,' → ')
      .replace(/(?:걸고|입히고|뿌리고|시키고|던지고|발사하고)\s*,?\s*(?=\S)/g,
        (match,offset,text)=>statusRider(text.slice(offset+match.length))?' ':' → ');
    const fragments=segmented.split(/(?:그\s*후|그다음|그\s*다음|뒤이어|이어서|이후|한\s*뒤|한\s*후|하고\s*나서|→|->)+/).map(s=>s.trim()).filter(Boolean);
    const actions=[];
    for(const fragment of fragments){
      let matches=matchActions(fragment);
      const chosen=choices[fragment];
      if(chosen==='skip')continue;
      if(!chosen&&matches.length===0&&/스킬.*복사|지형을.*만/.test(fragment)){questions.push({text:fragment,options:suggestions(fragment)});unmapped.push(fragment);continue;}
      if(chosen&&SkillForge.TYPE[chosen])matches=[{type:chosen}];
      if(!matches.length&&status(fragment)!=='none'&&!/않|없|제외|금지/.test(fragment)){
        questions.push({text:fragment,options:['wave','shot','zone']});
      }
      if(!matches.length){
        if(!/^(?:체력|HP|쿨타임|매\s*\d|주기|공격력|속도|이동\s*속도|기본\s*체력|최대\s*체력)/i.test(fragment)){unmapped.push(fragment);if(!questions.some(q=>q.text===fragment))questions.push({text:fragment,options:suggestions(fragment)});}
        continue;
      }
      for(const match of matches) {
        if(actions.length>=3){unmapped.push('한 스킬의 동작은 최대 3개입니다: '+fragment);break;}
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
  if(!skills.length)return {profile:null,unmapped,questions,aliases:[...aliases],mode:'grammar'};
  const cfg=SkillForge.normalize({
    name:name||'나만의 캐릭터',blurb:original.slice(0,90),
    color:status(original)==='fire'?'#a94f26':status(original)==='ice'?'#3d7da7':'#756483',
    hp:pickNum(original,/(?:기본\s*체력|최대\s*체력|HP)\s*(?:은|:|=)?\s*(\d{2,4})/,250),
    speed:pickNum(original,/(?:기본\s*속도|이동\s*속도)\s*(?:는|:|=)?\s*(\d+(?:\.\d+)?)/,1.8),
    skills
  });
  return {profile:cfg,unmapped:[...new Set(unmapped)],aliases:[...aliases],questions,mode:'grammar'};
}
async function analyze(text,name,mode='offline'){
  if(mode==='offline')return parse(text,name);
  text=String(text||'').trim();name=String(name||'');
  if(text.length<4||text.length>1400)throw Error('능력 설명은 4~1,400자로 작성하세요.');
  if(isAllIntent(text))return parse(text,name);
  if(mode==='creative'){
    if(!global.location || !/^https?:$/.test(global.location.protocol))throw Error('창작 AI는 서버로 실행한 게임에서 사용할 수 있습니다. README의 AI 실행 안내를 확인하세요.');
    const response=await global.fetch('/api/forge',{
      method:'POST',headers:{'Content-Type':'application/json'},
      signal:AbortSignal.timeout(50000),body:JSON.stringify({text,name})
    });
    if(response.status===404)throw Error('이 주소에는 AI 서버가 없습니다. 서버 실행이 필요합니다. 기본 분석은 계속 사용할 수 있습니다.');
    let out;try{out=await response.json();}catch(_){throw Error('AI 서버 응답을 확인할 수 없습니다.');}
    if(!response.ok)throw Error(out.error||'AI 생성 요청에 실패했습니다.');
    if(typeof out.interpretation!=='string'||!Array.isArray(out.adaptations)||!out.adaptations.every(x=>typeof x==='string'))throw Error('AI 응답 형식이 올바르지 않습니다.');
    return {...out,profile:SkillForge.normalize(out.profile),mode:'server-ai',unmapped:[],aliases:[]};
  }
  // An unfamiliar description must still reach the language model; do not
  // reject it merely because the offline fallback lacks a keyword.
  const LM=global.LanguageModel;
  if(LM&&typeof LM.availability==='function'){
    try{
      const settings={expectedInputs:[{type:'text',languages:['ko']}],expectedOutputs:[{type:'text',languages:['ko']}]};
      if(await LM.availability(settings)==='available'){
        const model=await LM.create(settings);
        try{
          const prompt='Interpret Korean combat abilities semantically, including colloquial synonyms. 이동/순간이동/텔포/점멸 = blink (unless 이동속도); 번개/벼락/낙뢰 = bolt; 독딜/도트데미지/지속피해 = poison DoT. Convert into JSON with name,hp,speed,color,skills and each skill name,trigger,cooldown,threshold,actions. Every action uses type,pattern,target,damage,radius,count,speed,duration,status,knockback,delay. Allowed type '+Object.keys(SkillForge.TYPE).join(',')+'; mechanics '+JSON.stringify(global.ForgeExpansion?.DESCRIPTIONS||{})+'; pattern direct,fan,radial,line,cross,spiral,scatter; target nearest,farthest,lowest,highest,random,cluster; status '+Object.keys(SkillForge.STATUS).join(',')+'. Up to 4 skills and 3 sequential actions per skill. Decide connector meaning semantically: Korean -고 or 그리고 can indicate either sequential actions in one skill, a modifier/status on the previous action, or a separately triggered skill. Do not create a new skill solely because a conjunction appears; distinct trigger conditions or unrelated defensive abilities may be independent. Only JSON, no code. Name: '+name+' Description: '+text;
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
    +'<textarea id="forge-natural-text" rows="6" maxlength="1400" placeholder="슬픔을 작은 별로 접어 적에게 뿌린다. 상처받으면 별들이 주변을 돌며 나를 지켜 준다."></textarea>'
    +'<label for="forge-natural-mode">해석 방식</label><select id="forge-natural-mode"><option value="offline">휴대폰 기본 · API 없이 분석</option><option value="auto">기기 내 AI (지원 기기)</option><option value="creative">창작 AI · 문장 전체 해석 (서버 필요)</option></select>'
    +'<p class="bf-helper">기본 분석은 API 없이 작동합니다. 모르는 표현은 효과를 직접 선택하세요. 선택형 창작 AI는 설명을 서버로 전송합니다.</p>'
    +'<button type="button" id="forge-natural-build">문장 분석 · 자동 생성</button>'
    +'<div id="forge-natural-status" role="status" aria-live="polite"></div>'
    +'<div id="forge-choices"></div>';
  body.insertBefore(box,holder);
  const mode=document.getElementById('forge-natural-mode'),modeLabel=mode.previousElementSibling;
  const modeDetails=document.createElement('details'),modeSummary=document.createElement('summary');modeSummary.textContent='분석 방식 변경';modeDetails.append(modeSummary,modeLabel,mode);box.append(modeDetails);
  const randomBox=document.createElement('div');randomBox.className='forge-random';
  randomBox.innerHTML='<fieldset class="forge-theme-picker"><legend>혼합할 능력 계열 선택 (복수 선택 가능)</legend><div class="forge-theme-grid">'+Object.entries(SkillForge.THEMES).map(([key,t])=>'<label class="forge-theme-choice"><input type="checkbox" name="forge-theme" value="'+key+'"><span>'+t.name+'</span></label>').join('')+'</div></fieldset><button type="button" id="forge-random">선택한 계열로 랜덤 초안 만들기</button><p class="bf-helper">선택한 계열마다 최소 한 동작을 넣고 나머지는 무작위로 섞습니다. 전체 55종을 이용하려면 아무 계열도 선택하지 마세요.</p>';
  const pickedThemes=()=>Array.from(randomBox.querySelectorAll('input[name="forge-theme"]:checked'),input=>input.value);
  // The random option is offered as a compact secondary workflow below the main actions.
  const guide=document.createElement('details'),guideTitle=document.createElement('summary');
  guideTitle.textContent='지원 동작 '+Object.keys(SkillForge.TYPE).length+'종 · 상태 효과 '+(Object.keys(SkillForge.STATUS).length-1)+'종';guide.append(guideTitle);
  const guideBody=document.createElement('div');guideBody.className='forge-effect-guide';
  for(const [key,label] of Object.entries(SkillForge.TYPE)){
    const row=document.createElement('p');row.textContent=label+' — '+(global.AdvancedCombat?.DESCRIPTIONS[key]||global.ForgeExpansion?.DESCRIPTIONS[key]||'사거리·범위·상태 조건은 세부 설정에 따라 판정됩니다.');guideBody.append(row);
  }
  for(const [key,label] of Object.entries(SkillForge.STATUS)){
    const row=document.createElement('p');row.textContent=label+' — '+(global.ForgeExpansion?.STATUS_HELP[key]||label);guideBody.append(row);
  }
  guide.append(guideBody);
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
  let approved='',choices={};
  const choiceBox=document.getElementById('forge-choices');
  function offer(out,text){
    choiceBox.replaceChildren();
    if(!out.questions?.length)return false;
    status.textContent='문맥상 연결 방식이 모호한 부분이 있습니다. 스킬 구분 또는 효과를 선택해 주세요.';
    for(const q of out.questions){
      const group=document.createElement('section'),label=document.createElement('p');label.textContent=q.text;group.append(label);
      const select=document.createElement('select');select.setAttribute('aria-label',q.text+' 효과 선택');
      const initial=document.createElement('option');initial.value='';initial.textContent='효과를 선택하세요';select.append(initial);
      const keys=q.kind==='grouping'?['combo','separate']:[...new Set([...q.options,...Object.keys(SkillForge.TYPE)])];
      for(const key of (q.kind==='grouping'?keys:[...keys,'skip'])){
        const option=document.createElement('option');option.value=key;
        option.textContent=q.kind==='grouping'
          ?(key==='combo'?'한 스킬의 연계 동작':'서로 다른 독립 스킬')
          :key==='skip'?'이 표현은 구현하지 않음':SkillForge.TYPE[key];
        select.append(option);
      }
      select.addEventListener('change',()=>{choices[q.text]=select.value;});group.append(select);choiceBox.append(group);
    }
    const retry=document.createElement('button');retry.type='button';retry.textContent='선택한 효과로 다시 만들기';
    retry.onclick=()=>{if(out.questions.some(q=>!choices[q.text])){status.textContent='각 표현의 효과를 선택해 주세요.';return;}button.click();};choiceBox.append(retry);return true;
  }

  button.addEventListener('click',async()=>{
    button.disabled=true;status.textContent='분석 중';
    try{
      const text=input.value.trim();
      const name=document.getElementById('bf-name').value.trim(),mode=document.getElementById('forge-natural-mode').value;
      const out=mode==='offline'?parse(text,name,choices):await analyze(text,name,mode);
      if(input.value.trim()!==text || document.getElementById('bf-name').value.trim()!==name || document.getElementById('forge-natural-mode').value!==mode){
        approved='';status.textContent='분석 중 입력이 변경되었습니다. 다시 생성해 주세요.';return;
      }
      approved='';if(offer(out,text))return;
      if(!out.profile){status.textContent='구현할 효과가 없습니다. 문장을 추가하거나 선택을 바꿔 주세요.';choices={};return;}
      // Natural-language interpretation changes SKILLS, not the portrait,
      // uploaded picture, handwritten drawing or user-customized appearance.
      const current=SkillForge.getDraft?.()||{};
      const $id=id=>document.getElementById(id);
      const appearance={
        name:$id('bf-name')?.value.trim()||out.profile.name,
        color:$id('forge-color')?.value||current.color,
        effectColor:$id('forge-effect-color')?.value||current.effectColor,
        artKey:current.artKey,
        hp:Number($id('forge-hp')?.value||current.hp||250),
        speed:Number($id('forge-speed')?.value||current.speed||1.8),
        blurb:$id('bf-text')?.value.trim()||out.profile.blurb
      };
      SkillForge.setDraft({...out.profile,...appearance});approved=text;
      status.textContent=(out.mode==='server-ai'?'창작 AI':out.mode==='on-device-ai'?'기기 내 AI':'의미 분석')+' 완료 · 스킬 '+(out.profile.allAbilities?SkillForge.allSkillset().length:out.profile.skills.length)+'개'
        +'\n'+out.profile.skills.map(s=>SkillForge.TRIGGER[s.trigger]+' / '+s.cooldown+'초: '+s.actions.map(a=>SkillForge.TYPE[a.type]+(a.status!=='none'?' + '+SkillForge.STATUS[a.status]:'')).join(' → ')).join('\n')
        +(out.interpretation?'\n구현: '+out.interpretation:'')
        +(out.adaptations?.length?'\n각색한 부분:\n'+out.adaptations.map(x=>'• '+x).join('\n'):'')
        +(out.aliases?.length?'\n유사 표현 인식: '+out.aliases.join(' / '):'')
        +(out.unmapped.length?'\n구현 확인이 필요한 표현: '+out.unmapped.slice(0,3).join(' / '):'')
        +'\n아래 캐릭터 생성 버튼으로 등록하거나 세부 설정을 수정할 수 있습니다.';
    }catch(e){approved='';status.textContent='분석 실패: '+e.message;}
    finally{button.disabled=false;}
  });
  document.getElementById('forge-random').addEventListener('click',()=>{
    if(button.disabled)return;
    const selected=pickedThemes();
    const profile=SkillForge.randomProfile(selected.length?selected:'any');
    input.value='';approved='';choices={};choiceBox.replaceChildren();global.CharacterStudioArt?.reset?.();SkillForge.setDraft(profile);
    status.textContent='혼합 계열: '+(selected.length?selected.map(key=>SkillForge.THEMES[key].name).join(' + '):'전체 55종')+
      ' · 랜덤 초안: '+profile.name+' · 스킬 '+profile.skills.length+'개. 저장 버튼을 눌러 출전할 수 있습니다.';
    const report=document.getElementById('bf-result');if(report)report.textContent='';
  });
  input.addEventListener('input',()=>{approved='';choices={};choiceBox.replaceChildren();});
  document.getElementById('forge-natural-mode').addEventListener('change',()=>{approved='';});
  const create=document.getElementById('bf-create');
  create?.addEventListener('click',e=>{
    if(button.disabled||(input.value.trim()!==approved&&input.value.trim())){
      e.preventDefault();e.stopImmediatePropagation();status.textContent='변경된 문장을 먼저 분석해 주세요.';
    }
  },true);
  // Keep the primary flow together, with optional tuning and saved data below it.
  const firstHelp=body.querySelector(':scope > p.bf-helper');if(firstHelp)firstHelp.remove();
  // Remove duplicated preview in the primary call-to-action area. A compact
  // optional configuration report stays available with fine-tuning.
  const inspect=document.getElementById('bf-analyze');
  inspect.textContent='구성 요약 확인';
  inspect.classList.add('forge-inspect');
  const nameLabel=document.getElementById('bf-name').parentElement,basicGrid=nameLabel.parentElement;
  const heading=document.createElement('div');heading.className='forge-heading';heading.innerHTML='<span class="eyebrow">CHARACTER STUDIO</span><h3>나만의 파이터</h3><p>문장으로 설계하거나, 랜덤으로 발견하세요.</p>';
  body.prepend(heading,nameLabel);
  const randomEntry=document.createElement('section');randomEntry.className='forge-random-entry';
  const randomHead=document.createElement('div');randomHead.className='forge-random-entry-copy';
  const randomTitle=document.createElement('strong');randomTitle.textContent='랜덤 캐릭터 바로 생성';
  const randomHelp=document.createElement('small');randomHelp.textContent='버튼 한 번으로 능력·수치·외형을 무작위 생성하고 출전합니다.';
  randomHead.append(randomTitle,randomHelp);
  nameLabel.classList.add('forge-name');body.insertBefore(box,nameLabel.nextSibling);
  const basics=document.createElement('details'),basicTitle=document.createElement('summary');basicTitle.textContent='외형 · 체력 · 이동 속도';basics.append(basicTitle,basicGrid,document.getElementById('bf-text').parentElement);
  body.insertBefore(basics,advanced);
  const actions=document.getElementById('bf-create').parentElement;
  actions.classList.add('forge-primary-actions');body.insertBefore(actions,box.nextSibling);
  const saveBtn=document.getElementById('bf-create');
  saveBtn.textContent='캐릭터 저장 · 출전';
  const randomNow=document.createElement('button');
  randomNow.type='button';randomNow.id='forge-random-create';
  randomNow.className='forge-random-create';
  randomNow.textContent='🎲 완전 랜덤 생성';
  randomNow.setAttribute('aria-label','모든 능력 종류와 수치를 무작위로 정한 캐릭터를 생성하고 출전');
  randomNow.addEventListener('click',()=>{
    if(button.disabled)return;
    if(roundStarted&&!isGameOver){
      status.textContent='진행 중인 경기가 끝난 뒤 랜덤 캐릭터를 생성할 수 있습니다.';
      return;
    }
    if(SkillForge.list().length>=6){
      status.textContent='캐릭터는 최대 6명입니다. 기존 캐릭터를 삭제한 뒤 생성하세요.';
      return;
    }
    const selected=pickedThemes();
    const profile=SkillForge.randomProfile(selected.length?selected:'any');
    input.value='';approved='';choices={};choiceBox.replaceChildren();
    global.CharacterStudioArt?.reset?.();SkillForge.setDraft(profile);
    saveBtn.click(); // Reuse the validated save, persistence and P1 selection flow.
    const result=document.getElementById('bf-result')?.textContent||'';
    status.textContent=result.includes('생성 완료')
      ?'랜덤 캐릭터 생성·출전 완료: '+profile.name+' · 스킬 '+profile.skills.length+'개\n'+
        profile.skills.map(s=>s.name+' ('+s.actions.map(a=>SkillForge.TYPE[a.type]).join(' → ')+')').join('\n')
      :result||'생성 결과를 확인해 주세요.';
  });
  actions.replaceChildren(saveBtn);
  // Do not reference the random button until it exists; otherwise the entire
  // studio installer aborts before its controls become usable.
  randomEntry.append(randomHead,randomBox,randomNow);
  body.insertBefore(randomEntry,nameLabel);
  // One shared theme picker serves both preview and immediate save: no duplicate UI.
  advanced.append(inspect,document.getElementById('bf-result'));
  advanced.classList.add('forge-tuning');
  const library=document.createElement('details'),libraryTitle=document.createElement('summary');
  library.className='forge-optional forge-library';
  libraryTitle.textContent='스킬 도감 · 동작 검색';library.append(libraryTitle,catalogDetail,guide);
  body.insertBefore(library,basics);
  body.insertBefore(advanced,basics);
  // In collapsed form only the creator name, natural-language description,
  // analyze action and one save button occupy the primary screen.
  const saved=document.createElement('details'),savedTitle=document.createElement('summary');
  saved.className='forge-optional forge-saved';
  savedTitle.textContent='내 캐릭터 · 공유 · JSON';
  saved.append(savedTitle,document.getElementById('bf-custom-list'),body.querySelector('.forge-json'));
  body.append(saved);
  body.classList.add('forge-studio');
}

global.NaturalForge={parse,analyze,suggestions,isAllIntent,semanticSentences,groupConnection};
if(typeof document!=='undefined'&&document.getElementById('forge-skills'))install();
})(window);
