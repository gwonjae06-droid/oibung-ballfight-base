/* Offline Korean numeric parameter extraction for sentence-authored skills.
 * This produces bounded DATA, not executable user code or model/API output.
 * Values follow the same limits as SkillForge / SignatureRuleSkill.
 */
(function(g){'use strict';
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const first=(text,patterns)=>{
 for(const re of patterns){const m=re.exec(text);if(m)return Number(m[1]);}
 return null;
};
function analyze(input){
 // Native Korean counters: "다섯 발", "초당 두 번", "세 초" are
 // numeric declarations too. Replace counters only in numeric contexts.
 const numbers={한:1,두:2,세:3,네:4,다섯:5,여섯:6,일곱:7,여덟:8,아홉:9,열:10,스무:20};
 const text=String(input||'').normalize('NFC').replace(
   /(스무|다섯|여섯|일곱|여덟|아홉|한|두|세|네|열)\s*(?=(?:개|발|줄기|갈래|번|회|타|초)(?:\s|$|마다|간|동안|씩|로|을|를|에|의))/g,
   word=>String(numbers[word.trim()]||word));
 const values={},warnings=[],recognized=[];
 function set(key,patterns,lo,hi,integer=false){
  const raw=first(text,patterns);
  if(raw===null||!Number.isFinite(raw))return;
  const bounded=clamp(raw,lo,hi);
  values[key]=integer?Math.round(bounded):bounded;
  recognized.push(key);
  if(raw!==bounded)warnings.push(key+' 값 '+raw+'은(는) 안전 범위 '+lo+'~'+hi+'로 조정했습니다.');
 }
 set('damage',[
  /(?:피해량|피해|데미지|대미지|위력|공격력)\s*(?:은|는|이|가|을|를|:|=)?\s*(\d+(?:\.\d+)?)/,
  /(\d+(?:\.\d+)?)\s*(?:의)?\s*(?:데미지|대미지|피해)(?!\s*감소)/
 ],0,120,true);
 set('count',[
  /(?:투사체|탄환|탄알|총알|화살|파편|탄막|구슬|미사일|빔|불덩이)\s*(?:를|을|가|이|은|는)?\s*(\d+)\s*(?:개|발|줄기|갈래)/,
  /(\d+)\s*(?:개|발|줄기|갈래|개의|발의|발씩|개씩)(?:\s*(?:의)?\s*(?:투사체|탄환|탄알|총알|화살|파편|구슬|미사일|레이저|빔))?/
 ],1,8,true);
 set('radius',[
  /(?:반경|범위|사거리|공격범위|폭발범위)\s*(?:은|는|이|가|를|을|:|=)?\s*(\d+(?:\.\d+)?)/,
  /(\d+(?:\.\d+)?)\s*(?:거리|반경|범위)(?:까지|안에|내에)/
 ],30,300);
 set('speed',[
  /(?:투사체|탄환|탄알|총알|화살|발사체|탄속|비행체|이동체)\s*(?:의)?\s*(?:속도|속력|속도를|속력은)\s*(?:은|는|이|가|를|을|:|=)?\s*(\d+(?:\.\d+)?)/,
  /(?:투사체\s*)?(?:이동속도|날아가는\s*속도|탄속)\s*(?:는|가|:|=)?\s*(\d+(?:\.\d+)?)/,
  /(?:^|[,;\s])속도\s*(?:는|가|:|=)?\s*(\d+(?:\.\d+)?)/
 ],2,14);
 set('duration',[
  /(?:지속시간|유지시간|효과시간|시전시간)\s*(?:은|는|이|가|을|를|:|=)?\s*(\d+(?:\.\d+)?)\s*초?/,
  /(\d+(?:\.\d+)?)\s*초\s*(?:동안|간)\s*(?:지속|유지)/,
  /(?:지속|유지)\s*(\d+(?:\.\d+)?)\s*초/
 ],.2,8);
 set('knockback',[
  /(?:넉백|밀치는\s*힘|반동|튕기는\s*힘)\s*(?:은|는|이|가|:|=)?\s*(\d+(?:\.\d+)?)/
 ],0,9);
 set('delay',[
  /(?:발동\s*지연|시전\s*지연|발사\s*지연|딜레이)\s*(?:는|이|가|:|=)?\s*(\d+(?:\.\d+)?)\s*초?/
 ],0,2);
 set('ricochet',[
  /(?:벽에|벽에서)\s*(\d+)\s*번\s*(?:반사|튕)/,
  /(?:반사|튕기기)\s*(\d+)\s*(?:번|회)/
 ],0,3,true);
 const rate=first(text,[
  /(?:초당|1\s*초에)\s*(\d+(?:\.\d+)?)\s*(?:번|발|회|타)(?:씩)?/,
  /(?:공격\s*속도|공속|연사\s*속도|발사\s*주기|발사\s*속도)\s*(?:는|가|:|=)?\s*(\d+(?:\.\d+)?)\s*(?:회\/초|발\/초|번\/초|회|발|번)?/
 ]);
 const seconds=first(text,[
  /(\d+(?:\.\d+)?)\s*초\s*(?:마다|간격으로|간격|에\s*(?:한\s*번|1\s*번))/,
  /(?:공격\s*간격|발사\s*간격|쿨타임|재사용\s*대기\s*시간)\s*(?:은|는|이|가|:|=)?\s*(\d+(?:\.\d+)?)\s*초?/
 ]);
 let interval=null;
 if(seconds!==null)interval=seconds;
 else if(rate!==null&&rate>0)interval=1/rate;
 if(interval!==null){
  const safe=clamp(interval,.35,4);
  if(safe!==interval)warnings.push('공격 주기는 최소 0.35초, 최대 4초로 보정됩니다.');
  interval=safe;recognized.push('attackInterval');
 }
 const status=/빙결|얼리|얼음|냉기|서리/.test(text)?'ice':
   /(?:맹독|중독|독성|독액|독구름|독가스|독을|독이|독\s*피해)/.test(text)?'poison':
   /화상|불태|화염|불꽃/.test(text)?'fire':null;
 if(status){values.status=status;recognized.push('status');}
 const pattern=/방사형|사방|360도/.test(text)?'radial':
   /부채꼴|퍼지게\s*발사/.test(text)?'fan':
   /나선형|나선으로/.test(text)?'spiral':null;
 if(pattern){values.pattern=pattern;recognized.push('pattern');}
 const target=/가장\s*약한|체력\s*낮은/.test(text)?'lowest':
   /가장\s*먼|멀리\s*있는/.test(text)?'farthest':
   /무작위\s*대상|랜덤\s*대상/.test(text)?'random':null;
 if(target){values.target=target;recognized.push('target');}
 return {values,interval,warnings,recognized};
}
function apply(action,analysis){
 const next={...action},a=analysis?.values||{};
 for(const [k,v] of Object.entries(a)){
  if(k==='ricochet'&&next.type!=='shot')continue;
  next[k]=v;
 }
 return next;
}
g.KoreanSkillParameters=Object.freeze({analyze,apply});
})(typeof window!=='undefined'?window:globalThis);
