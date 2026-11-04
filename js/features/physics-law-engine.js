/* Physics Law Engine v1 — bounded, generative FORCE FIELD algebra.
 * A Korean sentence composes existing mathematical operators into a NEW
 * field equation. Users author data; they cannot author or execute JS.
 * Registered custom action "phenomenon" resolves real forces and HP
 * through the authoritative SkillForge world/hit callback.
 */
(function(g){'use strict';
const registry=g.ActionRegistry;
const bound=(v,lo,hi,f=lo)=>Number.isFinite(Number(v))?
 Math.max(lo,Math.min(hi,Number(v))):f;
const OPS=Object.freeze({
 attract:{label:'중심으로 끌어당기는 힘',pattern:/끌어당|당겨|빨아들이|흡인|인력|중력\s*우물|중심.{0,12}(?:당기|모이|모으)/},
 repel:{label:'중심 밖으로 밀어내는 힘',pattern:/밀어내|밀쳐|튕겨내|반발|척력|역중력|바깥으로\s*날리|밖으로\s*날리/},
 spin:{label:'접선 방향의 회전력',pattern:/회전력|회전시|회오리|소용돌이|빙글|휘감아\s*돌|공전|빙빙|나선형/},
 spring:{label:'거리에 따른 탄성 복원력',pattern:/탄성|고무줄|용수철|스프링|늘어난\s*만큼|거리.{0,12}복원/},
 pulse:{label:'반복되는 방사형 압력',pattern:/진동|파동|맥동|펄스|주기적.{0,8}(?:밀|튕)|쿵쿵|진앙/},
 drag:{label:'운동 감쇠·마찰',pattern:/마찰|감속|느려지|느리게|점성|저항|끈적|속도를\s*줄/},
 propel:{label:'운동 증가·가속',pattern:/가속|속도를\s*높|더\s*빨라|추진력|속력을\s*키|속력이\s*커/},
 gravity:{label:'거리제곱 반비례 인력',pattern:/만유인력|거리.{0,8}제곱.{0,8}반비례|역제곱|중력법칙/},
 orbit:{label:'일정 반경으로 회귀하는 궤도력',pattern:/궤도|일정한\s*거리.{0,10}회전|행성처럼\s*돌|원궤도/},
 wave:{label:'시간에 따라 진동하는 힘',pattern:/시간.{0,12}(?:진동|요동|파동)|주기.{0,10}(?:강해|약해|흔들)|사인파|진자/},
 reflect:{label:'접근 운동량을 반사하는 탄성장',pattern:/탄성\s*반사|운동량\s*반사|들어오는\s*(?:공|대상|상대).{0,14}(?:튕겨내|반사)|다가오면\s*튕겨|반사하는\s*힘/},
 shear:{label:'반경에 따라 방향이 달라지는 전단력',pattern:/전단력|전단\s*흐름|안쪽과\s*바깥쪽.{0,18}(?:반대로|반대\s*방향).{0,12}(?:회전|돌)|서로\s*다른\s*속도로\s*회전/}
});
const decayOptions=['steady','fade','grow','beat'];
const falloffs=['constant','linear','quadratic','inverse','edge'];
const opNames=Object.keys(OPS),maxTerms=5,maxFields=7;
function normalize(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
 const anchor=value.anchor==='target'?'target':'caster';
 const decay=decayOptions.includes(value.decay)?value.decay:'steady';
 const radius=bound(value.radius,40,300,150);
 const duration=bound(value.duration,.2,8,2);
 const period=bound(value.period,.25,3,1);
 const damage=Math.round(bound(value.damage,0,120,12));
 const raw=Array.isArray(value.terms)?value.terms:[];
 const terms=raw.slice(0,maxTerms).filter(t=>t&&Object.hasOwn(OPS,t.op)).map(t=>({
  op:t.op,strength:bound(t.strength,.05,6,1.5),
  falloff:falloffs.includes(t.falloff)?t.falloff:'linear',
  sign:t.sign===-1?-1:1,
  rest:bound(t.rest,20,240,90)
 }));
 if(!terms.length)return undefined;
 return {version:1,anchor,decay,radius,duration,period,damage,terms};
}
const number=(text,re)=>{const x=text.match(re);return x?Number(x[1]):null;};
function interpret(input){
 const raw=String(input||'').normalize('NFC').trim();
 if(!raw||raw.length>300)return null;
 // A skill may contain named legacy actions. Select the new generative
 // language only when the sentence establishes a law/force relationship.
 const relational=/법칙|물리|역중력|힘이\s*(?:작용|생겨|발생)|힘으로|힘을|힘의|끌어당기면서|밀어내면서|회전시키면서|동시에\s*(?:당기|밀|회전)|중심.{0,14}(?:당기|밀|회전)|거리가.{0,14}(?:멀|가까)|거리.{0,14}(?:힘|세기|강해|약해)|마찰력|탄성력|탄성\s*반사|전단력|전단\s*흐름|자기장|힘의\s*장|중력장|역제곱|사인파|시간.{0,14}(?:힘|세기|강해|약해)/.test(raw);
 if(!relational)return null;
 let selected=Object.entries(OPS).filter(([,def])=>def.pattern.test(raw));
 // An inverse-square gravity law is ONE force, not an extra copy of
 // generic attraction merely because the word "인력" appears in its name.
 if(selected.some(([id])=>id==='gravity'))
  selected=selected.filter(([id])=>id!=='attract');
 // The noun 탄성 in '탄성 반사장' is a rebound, not an
 // additional long-distance spring-restoration field.
 if(selected.some(([id])=>id==='reflect')&&
   !/용수철|스프링|고무줄|늘어난\s*만큼|복원력/.test(raw))
  selected=selected.filter(([id])=>id!=='spring');
 // A single fictional noun without a force verb cannot be compiled.
 if(!selected.length)return null;
 const radius=number(raw,/(?:반경|범위|영향\s*거리|반지름)\s*(?:은|는|을|를|:|=)?\s*(\d+(?:\.\d+)?)/);
 const seconds=number(raw,/(?:지속시간|지속|유지|유지시간)\s*(?:은|는|:|=)?\s*(\d+(?:\.\d+)?)\s*초?/) ??
  number(raw,/(\d+(?:\.\d+)?)\s*초\s*(?:동안|간)/);
 const strength=number(raw,/(?:힘|세기|강도|위력)\s*(?:은|는|이|가|:|=)?\s*(\d+(?:\.\d+)?)/);
 const period=number(raw,/(\d+(?:\.\d+)?)\s*초\s*(?:마다|간격으로)/) ??
  (()=>{const hz=number(raw,/(?:초당|1초에)\s*(\d+(?:\.\d+)?)\s*(?:회|번)/);return hz?1/hz:null})();
 const damage=number(raw,/(?:데미지|대미지|피해량|피해|공격력)\s*(?:은|는|:|=)?\s*(\d+(?:\.\d+)?)/);
 const rest=number(raw,/(?:목표\s*거리|궤도\s*반경|기준\s*거리)\s*(?:은|는|:|=)?\s*(\d+(?:\.\d+)?)/);
 const falloff=/멀수록\s*강|멀어질수록\s*강|외곽.{0,10}강/.test(raw)?'edge':
  /거리.{0,9}제곱|역제곱|가까울수록\s*급격/.test(raw)?'inverse':
  /가까울수록\s*강|중심에\s*가까/.test(raw)?'quadratic':
  /거리와\s*무관|일정한\s*힘/.test(raw)?'constant':'linear';
 const decay=/점점\s*약|서서히\s*약|사라지|쇠퇴|감쇠하는\s*힘/.test(raw)?'fade':
  /점점\s*강|점차\s*강|시간이\s*지날수록\s*강/.test(raw)?'grow':
  /맥동|리듬|박동|맥박|강해졌다\s*약/.test(raw)?'beat':'steady';
 const anchor=/적을\s*중심|상대를\s*중심|적\s*주변|적의\s*주변|상대\s*주변/.test(raw)?'target':'caster';
 const terms=selected.slice(0,maxTerms).map(([op])=>({
  op,strength:strength??(op==='drag'?.9:op==='gravity'?2.5:1.7),
  rest:rest??90,falloff,
  sign:/시계\s*방향|오른쪽으로\s*회전/.test(raw)&&['spin','orbit'].includes(op)?-1:1
 }));
 const config=normalize({version:1,terms,anchor,decay,
  radius:radius??155,duration:seconds??2.5,period:period??1,damage:damage??12});
 if(!config)return null;
 const palette=g.SkillFXComposer?.infer?.(raw);
 const baseLayers=palette?.layers||[];
 const colors=palette?.color||'#999eea';
 const motif=terms.some(t=>t.op==='reflect')?'rebound':
  terms.some(t=>t.op==='shear')?'shear':
  terms.some(t=>['spin','orbit'].includes(t.op))?'vortex':
  terms.some(t=>t.op==='spring')?'coil':
  terms.some(t=>['pulse','wave'].includes(t.op))?'rings':'trail';
 const layers=g.SkillFXComposer?.normalize?.([
  {kind:motif,color:colors,power:1.25,spin:1},...baseLayers
 ])||[];
 const visual=g.MetaphorVisuals?.normalize?.({
  shape:'aura',color:colors,scale:1.75,charge:true,layers
 });
 const statuses=[['ice',/빙결|얼음|서리|냉기/],['fire',/화상|불꽃|불길|화염/],
  ['poison',/맹독|중독|독가스|독구름/]];
 const status=statuses.find(([,re])=>re.test(raw))?.[0]||'none';
 const action={type:'phenomenon',law:config,damage:config.damage,
  radius:config.radius,duration:config.duration,speed:5,
  count:1,knockback:0,status,visual};
 const recipe=g.SignatureRuleSkill?.normalize?.({window:Math.max(4,config.duration+2),
  rules:[{when:'pulse',interval:Math.max(.6,Math.min(4,config.duration)),
   action}]});
 if(!recipe?.rules?.length)return null;
 return {ok:true,name:'물리 법칙 · '+selected[0][1].label,recipe,
  law:config,recognized:['phenomenon'],method:'offline-physics-law-dsl',
  notes:['합성 법칙: '+selected.map(([,d])=>d.label).join(' + ')+'.',
   '거리 함수: '+falloff+' · 시간 함수: '+decay+' · 실행 시간 '+config.duration+'초.',
   '수식은 안전한 연산자로 합성되며, 임의 코드·새로운 자바스크립트를 생성하지 않습니다.'],
  concepts:{fused:true,labels:selected.map(([,d])=>d.label)}};
}
const fields=new WeakMap(),telemetry=new WeakMap();
function fieldFor(p,a,target){
 const spec=normalize({...a?.law,damage:a?.damage,radius:a?.radius,
  duration:a?.duration});if(!spec||!p)return false;
 const pool=fields.get(p)||[];
 pool.push({spec,source:a,target:spec.anchor==='target'?target:null,
  origin:spec.anchor==='target'&&target?{x:target.x,y:target.y}:null,
  ticks:0,ttl:Math.round(spec.duration*60)});
 if(pool.length>maxFields)pool.shift();
 fields.set(p,pool);
 return true;
}
function attenuation(type,d,r){
 const u=bound(d/Math.max(r,1),0,1,1);
 if(type==='constant')return 1;
 if(type==='edge')return Math.max(.1,u);
 if(type==='quadratic')return Math.max(.08,(1-u)*(1-u));
 if(type==='inverse')return Math.min(1,1/(1+20*u*u));
 return Math.max(.08,1-u);
}
function acceleration(term,e,center,time,spec,geometry){
 // One shared geometry calculation per target/field, rather than per term.
 const dx=geometry?.dx??e.x-center.x,dy=geometry?.dy??e.y-center.y;
 const r=geometry?.r??(Math.hypot(dx,dy)||1);
 const ux=geometry?.ux??dx/r,uy=geometry?.uy??dy/r,tx=-uy,ty=ux;
 const dist=attenuation(term.falloff,r,spec.radius);
 const k=term.strength*dist*term.sign;
 if(term.op==='attract'||term.op==='gravity'){
  const gravity=term.op==='gravity'?Math.min(2.5,(spec.radius*spec.radius)/(r*r+900))*.25:1;
  return [-ux*k*gravity,-uy*k*gravity];
 }
 if(term.op==='repel')return [ux*k,uy*k];
 if(term.op==='spin')return [tx*k,ty*k];
 if(term.op==='orbit'){
  const rest=bound(term.rest,20,240,90);
  const spring=bound((r-rest)/rest,-1.5,1.5,0)*.55*k;
  return [tx*k-ux*spring,ty*k-uy*spring];
 }
 if(term.op==='spring'){
  const error=bound((r-term.rest)/Math.max(20,term.rest),-2,2,0);
  return [-ux*k*error,-uy*k*error];
 }
 if(term.op==='drag')return [-(Number(e.vx)||0)*k*.12,-(Number(e.vy)||0)*k*.12];
 if(term.op==='propel')return [(Number(e.vx)||ux)*k*.09,(Number(e.vy)||uy)*k*.09];
 if(term.op==='reflect'){
  // Genuine inbound relative velocity: the field does NOTHING to balls
  // already leaving the center. Reversal passes through the per-frame
  // impulse cap in tick() and cannot manufacture HP damage.
  const relVx=(Number(e.vx)||0)-(Number(center.vx)||0);
  const relVy=(Number(e.vy)||0)-(Number(center.vy)||0);
  const inbound=Math.max(0,-(relVx*ux+relVy*uy));
  const rebound=Math.min(5,inbound*(.55+Math.abs(k)*.3))*dist;
  return [ux*rebound,uy*rebound];
 }
 if(term.op==='shear'){
  // Two counter-rotating bands create an actual differential torque.
  // The center and perimeter have opposite signed tangential acceleration.
  const band=bound((r/spec.radius-.5)*2,-1,1,0);
  return [tx*k*band,ty*k*band];
 }
 if(term.op==='pulse'){
  const osc=Math.sin(time*2*Math.PI/spec.period);
  return [ux*k*osc,uy*k*osc];
 }
 if(term.op==='wave'){
  const osc=Math.sin(time*2*Math.PI/spec.period-r*.05);
  return [ux*k*osc,uy*k*osc];
 }
 return [0,0];
}
function tick(p,targets,hit){
 const pool=fields.get(p);if(!pool?.length)return;
 const enemies=Array.isArray(targets)?targets:[];
 const perf={tested:0,inside:0,terms:0,hitChecks:0};
 for(let i=pool.length-1;i>=0;i--){
  const field=pool[i];field.ticks++;
  if(--field.ttl<=0){pool.splice(i,1);continue;}
  const s=field.spec;
  const center=s.anchor==='target'&&field.target?.hp>0?field.target:
    field.origin||p;
  const time=field.ticks/60,t=time/s.duration;
  const envelope=s.decay==='fade'?Math.max(.05,1-t):
    s.decay==='grow'?.15+.85*t:
    s.decay==='beat'?.5+.5*Math.sin(time*2*Math.PI/s.period):1;
  for(const e of enemies){
   if(!e||e===p||e.hp<=0||!Number.isFinite(e.x)||!Number.isFinite(e.y))continue;
   perf.tested++;
   const dx=e.x-center.x,dy=e.y-center.y;
   const reach=s.radius+(e.radius||0);
   // Squared-distance broad phase avoids sqrt/trig on faraway targets.
   if(dx*dx+dy*dy>reach*reach)continue;
   perf.inside++;
   const dist=Math.hypot(dx,dy)||1;
   const geometry={dx,dy,r:dist,ux:dx/dist,uy:dy/dist};
   let fx=0,fy=0;
   for(const term of s.terms){
    perf.terms++;
    const [x,y]=acceleration(term,e,center,time,s,geometry);
    fx+=x;fy+=y;
   }
   // Physical field equations may be arbitrary compositions of safe
   // operators but may never produce unbounded impulses or frame stalls.
   const magnitude=Math.hypot(fx,fy),scale=magnitude>1.65?1.65/magnitude:1;
   e.vx=bound((Number(e.vx)||0)+fx*scale*envelope,-18,18,0);
   e.vy=bound((Number(e.vy)||0)+fy*scale*envelope,-18,18,0);
   if(s.damage>0&&(field.ticks===1||field.ticks%30===0)&&typeof hit==='function'){
    perf.hitChecks++;
    hit(p,e,{...field.source,type:'phenomenon',law:undefined,
     damage:s.damage,knockback:0});
   }
  }
 }
 telemetry.set(p,perf);
}
function metrics(p){
 const t=telemetry.get(p);
 return t?{...t}:{tested:0,inside:0,terms:0,hitChecks:0};
}
function report(p){return (fields.get(p)||[]).map(x=>({
 remaining:x.ttl,ticks:x.ticks,terms:x.spec.terms.map(v=>v.op)
}));}
if(registry?.register&&!registry.get('phenomenon'))registry.register({
 id:'phenomenon',label:'합성 물리 법칙',category:'attacks',family:'wave',
 executor:'custom',physics:'contact',offense:true,
 parameters:['damage','radius','duration','status','target'],
 visual:{motif:'ripple',color:'#8575d8'},
 audio:{cast:'energy',impact:'hit'},preview:{duration:1700,pose:'wave',anchor:'caster'},
 execute:(p,a,target)=>fieldFor(p,a,target)
});
g.PhysicsLawEngine=Object.freeze({OPS,normalize,interpret,fieldFor,tick,report,metrics,acceleration,maxTerms,maxFields});
})(typeof window!=='undefined'?window:globalThis);
