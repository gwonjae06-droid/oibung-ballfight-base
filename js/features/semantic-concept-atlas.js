/* Broad semantic concept atlas (offline, deterministic).
 * This is NOT a hand-written skill per word. Every recognized concept only
 * contributes a semantic category, an already registered action preference,
 * and up to three reusable visual primitives. Different professions and
 * invented mixtures share the same geometry/physics where appropriate.
 *
 * Format: label ~ source lexemes (regex) ~ preferred existing action ~ FX
 */
(function(g){'use strict';
const GROUPS=Object.freeze([
 ['physics','물리·에너지',`
진동자~진동자|공진기|공진현상|공명기~wave~rings,coil
자기력~자기력|로런츠힘|자기력선~phenomenon~orbit,plasma
정전기~정전기|정전유도|정전기장~bolt~lightning,circuit
압력~초고압|압력파|압축파|기압차~wave~rings,steam
마찰열~마찰열|마찰로\\s*인한\\s*열~zone~embers,trail
양자~양자역학|양자장|양자중첩|양자화~blink~hologram,stars
핵융합~핵융합|항성핵|중수소~nova~plasma,stars
운동에너지~운동에너지|관성력|각운동량~repulse~orbit,trail
방사선~방사선|감마선|엑스선|엑스레이|X선~beam~plasma,rings
빛의 굴절~빛의\\s*굴절|프리즘|스펙트럼|분광~beam~shards,stars
초전도~초전도체|초전도|마이스너\\s*효과~phenomenon~plasma,circuit
정전용량~전기용량|커패시터|축전용량~shield~circuit,rings
`],
 ['chemistry','화학·소재',`
산과 염기~강산|염기성|산성용액|산성비|염산~zone~mist,water
부식~부식성|부식액|산화반응|녹슨\\s*금속~zone~mist,thorns
촉매~촉매작용|촉매제|반응속도~haste~runes,circuit
발광물질~형광물질|인광|발광시약|야광액~zone~stars,water
액체금속~액체금속|수은방울|갈륨|용융금속~shot~water,plasma
고분자~고분자|폴리머|합성수지|플라스틱\\s*실~tether~coil,web
결정격자~결정격자|정육면체\\s*결정|광물\\s*결정~shot~shards,ice
거품반응~기포반응|기포폭발|거품폭발|발포제~wave~water,mist
산소~산소농도|산소폭풍|산소기포~zone~wind,water
염소~염소가스|염소구름~zone~mist,wind
방향족~향기구름|향수구름|꽃향기~zone~mist,petals
잉크~먹물|잉크폭탄|잉크구름|먹구름\\s*잉크~zone~water,shadow
`],
 ['biology','생물·진화',`
세포~세포분열|줄기세포|세포막|세포\\s*덩어리~splitshot~shards,water
유전자~유전자|DNA|염색체|게놈~regen~coil,runes
바이러스~바이러스|병원균|감염원|병균~zone~mist,web
박테리아~세균|박테리아|미생물|플랑크톤~summon~mist,shards
균사체~균사체|버섯포자|포자구름|곰팡이~zone~mist,thorns
식물성장~광합성|발아|새싹|식물성장~grow~petals,thorns
뿌리망~나무뿌리|뿌리그물|뿌리망~tether~thorns,web
곤충군집~벌떼|나비떼|메뚜기떼|곤충군집~summon~petals,orbit
포식~포식자|육식동물|맹수|이빨자국~slash~shards,hearts
생체발광~반딧불|발광생물|심해어|생물발광~orbit~stars,water
자연재생~재생세포|상처재생|조직재생~regen~hearts,petals
미생물군~세균군집|미생물군집~summon~mist,web
`],
 ['medicine','의학·인체',`
심장박동~심박동|심전도|심장박동|심장\\s*리듬~wave~hearts,rings
신경~신경신호|뉴런|시냅스|신경망~chain~lightning,circuit
면역~면역세포|항체|백혈구|면역반응~shield~orbit,hearts
치료광~광선치료|레이저치료|치유광선~heal~plasma,hearts
마취~마취가스|수면제\\s*구름|진정가스~zone~mist,rings
혈관~혈관망|모세혈관|핏줄\\s*그물~tether~web,hearts
근육~근육섬유|근육수축|힘줄~uppercut~coil,hearts
골격~뼈조각|뼈다귀|골격파편|골편~shot~shards,thorns
호흡~호흡파동|폐포|숨결\\s*파동~wave~wind,rings
혈액순환~혈류|혈액순환|피의\\s*흐름~orbit~hearts,water
`],
 ['earth','지구·기상·재해',`
지진~지진파|단층지진|지각진동|지면\\s*균열~wave~rings,shards
쓰나미~쓰나미|거대해일|해일파도~wave~water,rings
토네이도~토네이도|깔때기구름|회오리바람~vortex~vortex,wind
안개~스모그|안개벽|짙은\\s*안개|안개구름~zone~mist,wind
우박~우박폭풍|우박덩이|얼음우박~starfall~ice,rain
낙석~낙석|산사태|바위폭풍~meteor~shards,rain
모래폭풍~모래폭풍|황사폭풍|사막폭풍~zone~wind,mist
화산재~화산재|재구름|분연주~zone~embers,mist
오로라~오로라|극광|북극광~zone~stars,water
번개구름~뇌운|적란운|번개구름~bolt~lightning,mist
조석~밀물과\\s*썰물|조석작용|조류\\s*소용돌이~wave~water,orbit
빙하~빙산|빙하붕괴|영구동토|동토층~wave~ice,shards
`],
 ['ocean','해양·유체',`
소금물~소금바다|염수|염분결정~zone~water,shards
심해~심해해류|심해소용돌이|심연의\\s*바다~blackhole~water,shadow
해파리~해파리떼|해파리촉수|발광해파리~summon~water,coil
거품~비눗방울|거품방울|기포\\s*덩어리~shot~water,rings
산호~산호초|산호가시|산호결정~wall~thorns,petals
해류~난류|한류|급류|소용돌이해류~vortex~water,wind
바다폭풍~폭풍해일|폭풍우|거센\\s*파도~wave~water,rain
수중압력~수압탄|심해압력|물의\\s*압력~wave~water,rings
`],
 ['astronomy','천문·우주',`
태양풍~태양풍|코로나질량방출|태양코로나~wave~plasma,wind
초신성~초신성|성간폭발|별폭발~nova~stars,burst
행성고리~토성고리|행성고리|소행성\\s*고리~orbit~orbit,shards
혜성~혜성|꼬리별|얼음\\s*혜성~meteor~stars,trail
성운~성운구름|별구름|우주먼지~zone~mist,stars
웜홀~웜홀|시공터널|차원터널~portal~vortex,stars
유성우~유성우|별똥별\\s*비|운석비~starfall~stars,rain
우주먼지~성간먼지|우주먼지|암흑물질\\s*구름~zone~shadow,stars
중성자별~중성자별|펄서|마그네타~phenomenon~stars,rings
퀘이사~퀘이사|블레이자|강착원반~beam~plasma,orbit
은하나선~나선은하|은하수|은하\\s*나선~vortex~stars,vortex
`],
 ['mathematics','수학·기하',`
프랙탈~프랙탈|시에르핀스키|만델브로|재귀도형~splitshot~shards,runes
무한급수~무한급수|수열|피보나치|황금비~orbit~rings,orbit
모비우스~뫼비우스|모비우스띠|클라인병~orbit~coil,orbit
벡터~벡터장|기울기장|방향장~phenomenon~trail,arrows
나선형~로그나선|아르키메데스\\s*나선|이중나선~vortex~coil,vortex
구면체~정다면체|다각형\\s*방벽|다면체~shield~shards,rings
격자~격자무늬|좌표격자|수학격자~zone~circuit,runes
대칭~거울대칭|회전대칭|대칭축|축대칭~swap~hologram,rings
위상~위상변환|위상수학|뒤집힌\\s*공간~portal~runes,vortex
카오스~카오스이론|혼돈계|나비효과~wave~vortex,shards
`],
 ['sound','음악·소리',`
음파~음파포|초음파|저주파|고주파~wave~rings,wave
베이스~베이스드럼|저음진동|베이스비트~wave~rings,hearts
피아노~피아노건반|피아노음|건반소리~shot~rain,runes
바이올린~바이올린|현악기|활현악기~beam~coil,trail
나팔~트럼펫|나팔소리|브라스섹션~wave~rings,stars
합창~합창단|성가대|화음폭풍~zone~rings,stars
리듬~박자|메트로놈|리듬게임|비트파동~wave~rings,orbit
불협화음~불협화음|음정붕괴|소음파~wave~rings,shadow
메아리~에코|잔향|메아리|반향음~chain~rings,trail
휘파람~휘파람|소리화살|공기휘파람~shot~wind,trail
`],
 ['technology','정보·통신',`
데이터비~데이터폭우|데이터스트림|데이터\\s*비~rain~circuit,rain
방화벽~방화벽|암호방벽|디지털\\s*방벽~shield~circuit,hologram
신호망~무선신호|와이파이|전파망|송수신기~zone~rings,circuit
코드~프로그래밍코드|소스코드|코딩문자|코드조각~shot~hologram,runes
비트~비트열|이진수|010101|데이터비트~splitshot~circuit,shards
암호~암호화|암호키|비밀문자|암호문~shield~runes,circuit
인공지능~인공지능|머신러닝|기계학습|딥러닝~turret~circuit,hologram
네트워크~서버망|통신네트워크|서버클러스터~chain~web,circuit
버그~버그폭탄|컴퓨터\\s*바이러스|글리치|데이터오류~zone~shards,hologram
레이더~레이더|탐지파|소나탐지~wave~rings,circuit
광섬유~광섬유|광케이블|유리섬유~beam~plasma,web
`],
 ['engineering','기계·산업',`
톱니기계~기어박스|감속기|변속기|톱니열~orbit~gears,rings
컨베이어~컨베이어벨트|이송벨트|조립라인~zone~gears,trail
용접~용접불꽃|아크용접|용접빔~beam~plasma,embers
절삭~절삭공구|선반기계|밀링머신~slash~gears,shards
드릴~전동드릴|초고속드릴|드릴비트~thrust~gears,coil
터빈~가스터빈|풍력터빈|발전터빈~vortex~gears,wind
압축기~공기압축기|에어컴프레서|공기펌프~repulse~steam,rings
유압~유압실린더|유압프레스|유압장치~repulse~steam,gears
전기모터~전동모터|모터코일|회전자~orbit~gears,circuit
로봇팔~로봇팔|기계팔|자동화팔~tether~gears,chains
3D프린팅~3D프린터|적층제조|출력노즐~summon~circuit,shards
`],
 ['transport','교통·항공·우주선',`
자기부상~자기부상열차|마그레브|자기부상~dash~plasma,trail
열차~고속열차|기관차|철도차량|철도포~dash~gears,trail
항공기~전투기|제트기|초음속기|비행기엔진~flight~wind,trail
헬리콥터~헬리콥터|프로펠러|회전날개~orbit~wind,gears
로켓~우주로켓|추진로켓|발사체로켓~meteor~embers,trail
잠수함~잠수함|수중어뢰정|잠항함~burrow~water,steam
레이싱~레이싱카|경주용차|드리프트|엔진부스터~dash~trail,gears
우주선~우주선|우주함선|스타쉽|광속함~flight~stars,hologram
풍선~열기구|비행선|거대풍선~hover~water,wind
`],
 ['architecture','건축·도시',`
성벽~성벽|철벽요새|성채|성문~wall~shards,runes
거울미궁~거울미궁|거울방|반사미로~wall~shards,hologram
기둥~기둥숲|돌기둥|대리석기둥~wall~shards,rings
유리건물~유리궁전|수정성|유리탑~wall~shards,stars
다리~공중다리|빛의다리|다리형\\s*결계~portal~runes,trail
도시불빛~네온도시|네온사인|불빛도시~zone~circuit,stars
발전소~발전소|발전시설|전력탑~turret~plasma,circuit
지하터널~지하터널|비밀통로|지하통로~portal~vortex,shadow
안전돔~보호돔|돔방어막|돔형\\s*쉴드~shield~hologram,rings
`],
 ['art','예술·공예',`
붓질~붓놀림|붓질|먹선|서예붓~slash~water,trail
물감~물감폭풍|물감탄|페인트탄~shot~water,shards
수채화~수채화|색번짐|수묵화~zone~water,mist
스테인드글라스~스테인드글라스|유리모자이크|빛의\\s*모자이크~wave~shards,stars
종이접기~종이접기|오리가미|종이학~summon~petals,shards
조각상~조각상|석상|대리석상~summon~shards,runes
사진~사진필름|카메라플래시|셔터빛~bolt~stars,hologram
영화~영화필름|영상프레임|시네마틱~timeburst~hologram,rain
연극~가면극|연극무대|인형극~summon~hologram,shadow
무지개~무지개빛|일곱색|프리즘빛~wave~water,stars
`],
 ['emotion','감정·정신·꿈',`
꿈~꿈속세계|꿈결|몽환의\\s*꿈|환몽~zone~mist,stars
악몽~악몽|공포환상|꿈속괴물~summon~shadow,mist
기억~기억조각|기억구슬|기억의\\s*파편~shot~shards,hologram
희망~희망의빛|희망의\\s*별|희망찬\\s*광휘~heal~stars,hearts
분노~격노|격분|분노의\\s*파동~nova~embers,hearts
슬픔~눈물폭풍|슬픔의\\s*비|눈물구슬~rain~water,mist
기쁨~환희|축제빛|기쁨의\\s*폭발~wave~petals,stars
집중~정신집중|명상에너지|초집중~shield~rings,runes
혼란~정신혼란|착란|혼돈의\\s*기류~vortex~vortex,hologram
환영~환영분신|환각분신|허상군단~summon~hologram,shadow
`],
 ['magic','신화·초자연',`
마나~마나결정|마력구슬|마나파동~shot~runes,stars
성물~성스러운\\s*유물|신성유물|성배~shield~runes,feathers
주술인형~저주인형|부두인형|마법인형~summon~web,runes
연금술~연금술|현자의돌|연성진~zone~runes,shards
차원균열~차원균열|차원찢기|공간찢기~portal~vortex,shards
마력폭주~마력폭주|마나폭주|마력붕괴~nova~burst,runes
혼령군단~혼령군단|망령군단|유령군단~summon~mist,shadow
천상의창~신성창|빛의창|천상의창~thrust~stars,trail
용비늘~용비늘|드래곤비늘|비늘갑옷~shield~shards,embers
거미마법~거미마법|실거미줄|마법거미줄~tether~web,runes
마법책~마도서|금서|마법책|주문서~summon~runes,hologram
부적~부적폭풍|부적사슬|도술부적~shot~runes,petals
`],
 ['history','역사·문화',`
검무~검무|검의\\s*춤|쌍검무~spinslash~trail,petals
창진~창진|창벽|창의\\s*비~thrust~rain,shards
활비~화살비|궁수군단|연속궁술~shot~rain,trail
북소리~전쟁북|전장북|큰북소리~wave~rings,hearts
화포~고대화포|대포발사|공성포~shot~burst,steam
방패진~방패진|원형방패|방패부대~shield~rings,shards
봉수~봉수대|봉화연기|횃불신호~zone~embers,mist
기마~기마돌격|말발굽돌진|기마군단~dash~trail,rings
비단~비단끈|비단폭풍|천으로\\s*휘감~tether~coil,petals
`],
 ['sports','스포츠·놀이',`
축구공~축구공|프리킥|회전슛~shot~orbit,trail
농구공~농구공|덩크슛|슛포물선~arcshot~orbit,rings
야구공~야구공|커브볼|강속구~shot~trail,wind
테니스공~테니스공|스매시볼|라켓스매시~shot~trail,rings
탁구공~탁구공|회전핑퐁|핑퐁볼~shot~rings,orbit
볼링공~볼링공|스트라이크볼링~dash~orbit,shards
체스~체스말|체스판|체스기사~summon~shards,runes
주사위~주사위폭탄|주사위마법|거대주사위~shot~shards,orbit
팽이~팽이돌리기|배틀팽이|회전팽이~vortex~gears,orbit
요요~요요무기|요요사슬|회전요요~tether~coil,orbit
`],
 ['food','음식·생활',`
설탕결정~설탕결정|각설탕|설탕가루~shot~shards,stars
초콜릿~초콜릿폭포|초콜릿구름|초콜릿탄~zone~water,shadow
캔디~사탕폭풍|별사탕|사탕탄환~shot~shards,stars
밀가루~밀가루폭풍|밀가루구름|가루폭탄~zone~mist,wind
커피~커피소용돌이|에스프레소탄|커피폭탄~shot~water,vortex
탄산~탄산거품|탄산폭발|탄산기포~wave~water,burst
소금~소금폭풍|소금결정|소금바람~shot~ice,shards
얼음컵~얼음컵|얼음잔|냉기잔~shot~ice,water
실타래~실타래|실뭉치|실의\\s*그물~tether~web,coil
종이폭풍~종이폭풍|종이날개|종이조각\\s*비~shot~petals,rain
`]
]);
const entries=[];
for(const [domain,domainName,data] of GROUPS){
 let row=0;
 for(const line of data.trim().split(/\n/)){
  const parts=line.trim().split('~');
  if(parts.length!==4)throw Error('Concept atlas source must have 4 fields');
  const [name,words,base,motifs]=parts;
  if(!name||!words||!base||!motifs)throw Error('Empty concept atom');
  entries.push(Object.freeze({
   id:'atlas_'+domain+'_'+(++row),name,genre:domain,domainName,
   re:new RegExp(words,'i'),base,
   visual:motifs.split(',').filter(v=>g.SkillFXComposer?.KINDS?.[v]).slice(0,3)
  }));
 }
}
const CATALOG=Object.freeze(entries);
function match(raw,limit=8){
 const s=String(raw||'').normalize('NFC').slice(0,300);
 const matches=[];
 for(const entry of CATALOG){
  const hit=entry.re.exec(s);
  if(hit)matches.push({entry,index:hit.index,size:hit[0].length});
 }
 // Prefer concrete multi-character concepts; preserve phrase order as tie-breaker.
 matches.sort((a,b)=>b.size-a.size||a.index-b.index);
 return matches.slice(0,Math.max(0,Math.min(12,Number(limit)||8)))
  .sort((a,b)=>a.index-b.index).map(x=>x.entry);
}
function explain(input){
 const matches=match(input);
 return {matches:matches.map(x=>({id:x.id,name:x.name,domain:x.domainName,
  action:x.base,effects:x.visual.slice()})),availableConcepts:CATALOG.length,
  availableDomains:GROUPS.length};
}
g.SemanticConceptAtlas=Object.freeze({CATALOG,match,explain,domains:GROUPS.map(x=>x[1])});
})(typeof window!=='undefined'?window:globalThis);
