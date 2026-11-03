/* Bounded, offline, declarative causal sequence after ONE real shard family.
 * Parses only a small, explicit Korean event vocabulary. A stage never fires
 * because a timer, text label or VFX occurred: actual child retirement is
 * authoritative. No arbitrary callbacks from untrusted serialized data.
 */
(function(g){'use strict';
const TYPES=Object.freeze({burst:'최종 충격파',heal:'시전자 회복',
 tether:'적 속박',shield:'시전자 보호막'});
const GATES=Object.freeze({always:'조건 없음',damage:'직전 충격파가 실제 피해를 줌',
 near:'시전자 가까이에 살아 있는 적 존재'});
const TYPES_ID=['burst','heal','tether','shield'];
const GATES_ID=['always','damage','near'];
const MAX_STEPS=3;
const terminalRE=/(?:(?:마지막|최후의|모든|전부|모두|남은)\s*(?:파편|조각|부스러기)(?:들)?|(?:파편|조각|부스러기)(?:들)?\s*(?:모두|전부|마지막|남은)).{0,32}?(?:사라지|소멸|없어지|소진|수명.{0,8}끝나)/;
const tokenPatterns=Object.freeze({
 burst:/폭발|폭파|충격파|폭렬/g,
 heal:/회복|치유/g,
 tether:/속박|구속|포박|결박/g,
 shield:/보호막|방어막|실드|배리어/g
});
const negated=s=>/(?:하지\s*않|지\s*않|안\s*하|못\s*하|않는다|말아|마라)/.test(s);
function normalize(value){
 if(!Array.isArray(value)||value.length<2||value.length>MAX_STEPS)return undefined;
 const seen=new Set(),out=[];
 for(let i=0;i<value.length;i++){
  const v=value[i];
  if(!v||typeof v!=='object'||Array.isArray(v)||
    !Object.hasOwn(TYPES,v.type)||!Object.hasOwn(GATES,v.gate)||seen.has(v.type))
   return undefined;
  if(i===0&&v.gate!=='always')return undefined;
  if(v.gate==='damage'&&(i===0||value[i-1]?.type!=='burst'))return undefined;
  if(v.gate==='near'&&v.type!=='tether')return undefined;
  seen.add(v.type);out.push({type:v.type,gate:v.gate});
 }
 return out;
}
function parse(input){
 const raw=String(input||'').normalize('NFC').slice(0,300);
 const terminal=terminalRE.exec(raw);
 if(!terminal)return null;
 const tail=raw.slice(terminal.index+terminal[0].length);
 const tokens=[];
 for(const [type,re] of Object.entries(tokenPatterns)){
  const pattern=new RegExp(re.source,'g');let m;
  while((m=pattern.exec(tail))!==null&&tokens.length<18){
   const prefix=tail.slice(Math.max(0,m.index-4),m.index);
   // '그 충격파가 피해를 주면' refers to the previous burst.
   if(type==='burst'&&/그\s*$|그\s*.*?\s*$/.test(prefix.trim())&&
    /^(?:가|이|는|은)\s*(?:적|상대|대상)/.test(tail.slice(pattern.lastIndex)))continue;
   const after=tail.slice(pattern.lastIndex,Math.min(tail.length,pattern.lastIndex+25));
   if(/^(?:을|를|은|는|이|가)?\s*(?:생성|만들|두르|치|얻|펼치|일으키|터뜨|폭발|회복|치유|속박|구속)?\s*(?:하지\s*않|지\s*않|안\s*하|않는)/.test(after)&&
      negated(after.slice(0,25)))return {error:'부정된 후속 행동은 순차 실행에 넣지 않습니다.'};
   tokens.push({type,index:m.index,end:pattern.lastIndex});
  }
 }
 tokens.sort((a,b)=>a.index-b.index||a.end-b.end);
 const nodes=[];
 for(const tok of tokens){
  if(tok.type==='burst'&&/그\s*$/.test(tail.slice(Math.max(0,tok.index-4),tok.index))&&
    /^(?:가|이|는|은)\s*(?:적|상대|대상)/.test(tail.slice(tok.end)))continue;
  const prev=nodes[nodes.length-1];
  const between=prev?tail.slice(prev.end,tok.index):'';
  let gate='always';
  if(prev&&/(?:피해|대미지|데미지|HP|체력).{0,15}?(?:입히|주면|들어가|발생하|깎|감소).{0,10}?(?:면|다면)|(?:피해|대미지|데미지).{0,8}(?:들어가면|줬다면)/.test(between))
   gate='damage';
  if(prev&&/(?:적|상대|대상).{0,14}?(?:가까|근처|곁에).{0,10}?(?:면|다면)/.test(between))
   gate='near';
  if(gate==='damage'&&prev.type!=='burst')return {error:'실제 피해 조건은 직전 충격파가 있어야 검사할 수 있습니다.'};
  if(gate==='near'&&tok.type!=='tether')return {error:'거리 조건은 후속 속박 동작에만 지원합니다.'};
  if(nodes.some(n=>n.type===tok.type))continue;
  nodes.push({...tok,gate});
  if(nodes.length>MAX_STEPS)return {error:'파편 종료 후 연쇄 동작은 최대 3단계만 지원합니다.'};
 }
 if(nodes.length<2)return null;
 const plan=normalize(nodes.map(n=>({type:n.type,gate:n.gate})));
 return plan?{steps:plan}:{
  error:'후속 동작의 순서 또는 조건을 안전하게 연결할 수 없습니다.'};
}
function pack(value){
 const chain=normalize(value);
 return chain?chain.map(s=>[TYPES_ID.indexOf(s.type),GATES_ID.indexOf(s.gate)]):null;
}
function unpack(value){
 if(!Array.isArray(value)||value.length<2||value.length>MAX_STEPS)return undefined;
 return normalize(value.map(v=>({type:TYPES_ID[v?.[0]],gate:GATES_ID[v?.[1]]})));
}
function evaluate(value,ctx){
 const steps=normalize(value),executed=[];
 let stopped=null;
 if(!steps||!ctx||typeof ctx.perform!=='function')
  return {executed,stopped:'invalid'};
 let lastDamage=false;
 for(let i=0;i<steps.length;i++){
  const step=steps[i];
  if(step.gate==='damage'&&!lastDamage){stopped='no-confirmed-damage';break;}
  if(step.gate==='near'&&ctx.near?.()!==true){stopped='no-nearby-enemy';break;}
  const r=ctx.perform(step.type,i);
  if(!r||r.performed!==true){stopped='action-unavailable';break;}
  executed.push(step.type);
  lastDamage=r.damaged===true;
 }
 return {executed,stopped};
}
g.TerminalEventChain=Object.freeze({TYPES,GATES,MAX_STEPS,normalize,parse,pack,unpack,evaluate});
})(typeof window!=='undefined'?window:globalThis);
