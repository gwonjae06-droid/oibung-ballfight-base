/* Compact, versioned profiles fit the existing matchmaking JSON limit. */
(function(g){
 const keys=['type','pattern','target','damage','radius','count','speed','duration','status','knockback','delay','link','visual'];
 // User-authored layered FX must fit the deployed 2,500-char RPC. Retain
 // compatibility with older ordinary-object visual payloads.
 const shapes=['aura','jaw','beam','claw','crystal','halo',
  'butterfly','jellyfish','roots','dragon','liquid','mechanical'];
 const kindNames=['lightning','coil','burst','embers','mist','ice','vortex','stars',
  'wind','water','runes','petals','shards','shadow','rings','chains','thorns',
  'hearts','rain','orbit','trail','web',
  'gears','circuit','hologram','steam','feathers','plasma'];
 const round=v=>Number.isFinite(Number(v))?Math.round(Number(v)*100)/100:1;
 const packVisual=v=>{
  if(!v||typeof v!=='object')return null;
  const packed=[shapes.indexOf(v.shape),v.color,round(v.scale),v.charge?1:0,
   (v.layers||[]).slice(0,5).map(a=>[
    kindNames.indexOf(a.kind),a.color,round(a.power),round(a.spin)]),
   ];
  if(v.colorMode==='explicit')packed.push(1);
  else if(v.colorMode==='inherit')packed.push(2);
  return packed;
 };
 const unpackVisual=v=>{
  if(!Array.isArray(v))return v;
  return {shape:shapes[v[0]]||'aura',color:v[1],scale:v[2],charge:v[3]===1,
   layers:(v[4]||[]).slice(0,5).filter(a=>a[0]>=0&&a[0]<kindNames.length)
    .map(a=>({kind:kindNames[a[0]],color:a[1],power:a[2],spin:a[3]})),
   ...(v[5]===1?{colorMode:'explicit'}:v[5]===2?{colorMode:'inherit'}:{})};
 };
 // Optional compact fusion trailer: legacy v3 packets have no trailer.
 // Do not add a null array slot to every old action or exceed the 2.5KB RPC.
 const elements=['none','fire','ice','poison','lightning','gravity','shadow','nature','water','wind'];
 const forms=['none','projectile','chain','beam','wave','field','vortex'];
 const impacts=['none','burst','pull','repulse','vortex'];
 const packFusion=value=>{
  const f=g.ConceptFusion?.normalize?.(value);
  return f?[elements.indexOf(f.element),forms.indexOf(f.form),
   f.homing?1:0,f.split?1:0,f.fragments,impacts.indexOf(f.impact),f.radius,
   // Optional three-phase palette / child-only pursuit uses a full
   // 12-slot trailer. Old 7/8/9-slot payloads remain byte-identical.
   ...(f.childHoming||f.childColor||f.finalColor?
     [f.splitTrigger==='hit'?1:0,f.finalBurst?1:0,
      f.childColor||null,f.finalColor||null,f.childHoming?1:0]:
     f.finalBurst?[f.splitTrigger==='hit'?1:0,1]:
      f.splitTrigger==='hit'?[1]:[])]:null;
 };
 const unpackFusion=v=>{
  if(!Array.isArray(v)||![7,8,9,12].includes(v.length))return undefined;
  return g.ConceptFusion?.normalize?.({element:elements[v[0]],form:forms[v[1]],
   homing:v[2]===1,split:v[3]===1,fragments:v[4],
   impact:impacts[v[5]],radius:v[6],splitTrigger:v[7]===1?'hit':'age',
   finalBurst:v[8]===1,childColor:v[9],finalColor:v[10],childHoming:v[11]===1});
 };
 const opIds=['attract','repel','spin','spring','pulse','drag','propel','gravity','orbit','wave'];
 const falls=['constant','linear','quadratic','inverse','edge'];
 const decays=['steady','fade','grow','beat'];
 const packLaw=raw=>{
  const l=g.PhysicsLawEngine?.normalize?.(raw);
  return l?[l.anchor==='target'?1:0,decays.indexOf(l.decay),l.radius,l.duration,
   l.period,l.damage,l.terms.map(t=>[
     opIds.indexOf(t.op),round(t.strength),falls.indexOf(t.falloff),t.sign,t.rest])]:null;
 };
 const unpackLaw=raw=>{
  if(!Array.isArray(raw)||raw.length!==7||!Array.isArray(raw[6]))return undefined;
  return g.PhysicsLawEngine?.normalize?.({
   version:1,anchor:raw[0]===1?'target':'caster',decay:decays[raw[1]],
   radius:raw[2],duration:raw[3],period:raw[4],damage:raw[5],
   terms:raw[6].map(t=>({op:opIds[t?.[0]],strength:t?.[1],
    falloff:falls[t?.[2]],sign:t?.[3],rest:t?.[4]}))
  });
 };
 const packRelay=raw=>{
  const r=g.ImaginationConcepts?.normalizeRelay?.(raw);
  return r?[round(r.charge),round(r.release),round(r.absorb),round(r.radius)]:null;
 };
 const unpackRelay=raw=>Array.isArray(raw)&&raw.length===4?
  g.ImaginationConcepts?.normalizeRelay?.({charge:raw[0],
   release:raw[1],absorb:raw[2],radius:raw[3]}):undefined;
 const encode=a=>{
  const data=keys.map(k=>k==='visual'?packVisual(a?.visual):a?.[k]??null);
  const fusion=packFusion(a?.fusion);
  const law=packLaw(a?.law);
  const relay=packRelay(a?.relay);
  if(relay)data.push(fusion,law,relay); // new index 15, keep old indexes stable
  else if(law)data.push(fusion,law);
  else if(fusion)data.push(fusion);
  return data;
 };
 const decode=a=>{
  const result=Object.fromEntries(keys.map((k,i)=>[
   k,k==='visual'?unpackVisual(a?.[i]):a?.[i]??undefined]));
  const fusion=unpackFusion(a?.[keys.length]);
  if(fusion)result.fusion=fusion;
  const law=unpackLaw(a?.[keys.length+1]);
  if(law)result.law=law;
  const relay=unpackRelay(a?.[keys.length+2]);
  if(relay)result.relay=relay;
  return result;
 };
 // Compact Scratch AST rather than repeating long field names in the queue.
 const compactNode=n=>{
  if(n.kind==='action')return ['a',encode(n.action)];
  if(n.kind==='if')return ['i',n.condition,(n.then||[]).map(compactNode),(n.else||[]).map(compactNode)];
  if(n.kind==='repeat'||n.kind==='repeatUntil')return [n.kind==='repeat'?'r':'u',n.condition,n.times,(n.body||[]).map(compactNode)];
  if(n.kind==='wait')return ['w',n.seconds];
  if(n.kind==='waitUntil')return ['W',n.condition,n.timeout];
  return [n.kind==='set'?'s':'c',n.value];
 };
 // Compact v1 FantasySkillGraph steps for the existing 2,500-char RPC.
 const compactGraph=s=>{
  if(s.kind==='cast')return ['c',encode(s.action)];
  if(s.kind==='wait')return ['w',s.seconds];
  if(s.kind==='morph')return ['m',s.visual];
  if(s.kind==='tune')return ['t',s.field,s.operator,s.value];
  if(s.kind==='repeat')return ['r',s.times,(s.body||[]).map(compactGraph)];
  if(s.kind==='if')return ['i',s.condition,
    (s.then||[]).map(compactGraph),(s.else||[]).map(compactGraph)];
  return ['w',.1];
 };
 const expandGraph=s=>{
  if(!Array.isArray(s))return null;
  if(s[0]==='c')return {kind:'cast',action:decode(s[1])};
  if(s[0]==='w')return {kind:'wait',seconds:s[1]};
  if(s[0]==='m')return {kind:'morph',visual:s[1]};
  if(s[0]==='t')return {kind:'tune',field:s[1],operator:s[2],value:s[3]};
  if(s[0]==='r')return {kind:'repeat',times:s[1],
   body:(s[2]||[]).map(expandGraph).filter(Boolean)};
  if(s[0]==='i')return {kind:'if',condition:s[1],
   then:(s[2]||[]).map(expandGraph).filter(Boolean),
   else:(s[3]||[]).map(expandGraph).filter(Boolean)};
  return null;
 };
 const expandNode=a=>{
  if(!Array.isArray(a))return null;
  if(a[0]==='a')return {kind:'action',action:decode(a[1])};
  if(a[0]==='i')return {kind:'if',condition:a[1],then:(a[2]||[]).map(expandNode).filter(Boolean),
   else:(a[3]||[]).map(expandNode).filter(Boolean)};
  if(a[0]==='r'||a[0]==='u')return {kind:a[0]==='r'?'repeat':'repeatUntil',
   condition:a[1],times:a[2],body:(a[3]||[]).map(expandNode).filter(Boolean)};
  if(a[0]==='w')return {kind:'wait',seconds:a[1]};
  if(a[0]==='W')return {kind:'waitUntil',condition:a[1],timeout:a[2]};
  if(a[0]==='s'||a[0]==='c')return {kind:a[0]==='s'?'set':'change',value:a[1]};
  return null;
 };
 // v3 carries the same bounded authored program the offline battle executes.
 // Keep v2 decoding for already-queued peers during rolling deployment.
 function pack(d){
  const data=d.forgeData;
  if(!data)return {v:3,bp:3,id:d.id,name:d.name};
  const skills=data.skills.slice(0,4).map(s=>{
   const base=[s.name,s.trigger,s.cooldown,s.threshold,(s.actions||[]).slice(0,data.signatureVersion===1&&(s.ruleSet||s.program)?1:3).map(encode)];
   if(s.program)base[5]=s.program.slice(0,32).map(compactNode);
   if(s.ruleSet)base[6]=[s.ruleSet.window,(s.ruleSet.rules||[]).slice(0,8).map(r=>
     [r.when,r.interval,r.fracture,encode(r.action),
      r.steps?.length?r.steps.slice(0,36).map(compactGraph):null,
      ...(r.when==='wallStored'?[r.wallHits]:[])])];
   return base;
  });
  const packet={v:3,bp:3,id:d.id,name:d.name,
   f:[data.hp,data.speed,data.color,data.effectColor,data.allAbilities?1:0,
    skills,data.signatureVersion===1?1:0]};
  // Supabase's deployed RPC rejects JSON profiles >2500 characters.
  // Refuse explicitly instead of silently stripping a user's signature.
  if(JSON.stringify(packet).length>2380)
   throw Error('이 캐릭터의 스킬 데이터가 온라인 전송 한도를 초과했습니다. 규칙을 간소화해 주세요.');
  return packet;
 }
 function unpack(p){
  if(![2,3].includes(p?.v))throw Error('온라인 버전이 다릅니다. 두 플레이어 모두 새로고침하세요.');
  if(!p.f)return {id:p.id,name:p.name};
  const [hp,speed,color,effectColor,all,skills,signature]=p.f;
  return {name:p.name,hp,speed,color,effectColor,allAbilities:!!all,
   signatureVersion:signature===1?1:0,
   skills:(skills||[]).slice(0,4).map(([name,trigger,cooldown,threshold,actions,program,recipe])=>({
    name,trigger,cooldown,threshold,actions:(actions||[]).slice(0,12).map(decode),
    ...(signature===1&&Array.isArray(program)?{program:program.map(expandNode).filter(Boolean)}:{}),
    ...(signature===1&&Array.isArray(recipe)?{ruleSet:{
     version:1,window:recipe[0],rules:(recipe[1]||[]).slice(0,8).map(r=>({
      when:r[0],interval:r[1],fracture:r[2],action:decode(r[3]),
      ...(r[0]==='wallStored'?{wallHits:r[5]}:{}),
      ...(Array.isArray(r[4])?{steps:r[4].map(expandGraph).filter(Boolean)}:{})
     }))
    }}:{})
   }))};
 }
 let frame,promise;
 g.PvpOriginalEngine={pack,unpack,load(){
  if(promise)return promise;
  promise=new Promise((resolve,reject)=>{
   frame=document.createElement('iframe');frame.title='원래 오이붕 온라인 전투';frame.style.cssText='width:100%;aspect-ratio:1;border:0;pointer-events:none;display:none';
   frame.src='pvp-runtime.html?v=pvp-overtime1';
   const timer=setTimeout(()=>reject(Error('전투 엔진 로딩 시간 초과')),15000);
   frame.onload=()=>{clearTimeout(timer);const r=frame.contentWindow.PvpRuntime;if(!r)return reject(Error('전투 엔진 로딩 실패'));resolve({...r,normalizeProfile:unpack});};
   document.getElementById('pvp-canvas').after(frame);
  }).catch(e=>{frame?.remove();promise=null;throw e;});return promise;
 },show(){if(frame)frame.style.display='block';document.getElementById('pvp-canvas').hidden=true;},paint(){frame?.contentWindow.PvpRuntime?.paint();}};
})(window);
