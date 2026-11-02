/* Compact, versioned profiles fit the existing matchmaking JSON limit. */
(function(g){
 const keys=['type','pattern','target','damage','radius','count','speed','duration','status','knockback','delay','link','visual'];
 const encode=a=>keys.map(k=>a?.[k]??null);
 const decode=a=>Object.fromEntries(keys.map((k,i)=>[k,a?.[i]??undefined]));
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
      r.steps?.length?r.steps.slice(0,36).map(compactGraph):null])];
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
