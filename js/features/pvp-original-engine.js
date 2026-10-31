/* Compact, versioned profiles fit the existing matchmaking JSON limit. */
(function(g){
 const keys=['type','pattern','target','damage','radius','count','speed','duration','status','knockback','delay','link'];
 function pack(d){return {v:2,bp:2,id:d.id,name:d.name,...(d.forgeData?{f:[d.forgeData.hp,d.forgeData.speed,d.forgeData.color,d.forgeData.effectColor,d.forgeData.allAbilities?1:0,d.forgeData.skills.slice(0,4).map(s=>[s.name,s.trigger,s.cooldown,s.threshold,s.actions.slice(0,3).map(a=>keys.map(k=>a[k]??null))])]}:{})};}
 function unpack(p){if(p.v!==2)throw Error('온라인 버전이 다릅니다. 두 플레이어 모두 새로고침하세요.');
 if(!p.f)return {id:p.id,name:p.name};const [hp,speed,color,effectColor,all,skills]=p.f;
 return {name:p.name,hp,speed,color,effectColor,allAbilities:!!all,skills:skills.map(([name,trigger,cooldown,threshold,actions])=>({name,trigger,cooldown,threshold,actions:actions.map(a=>Object.fromEntries(keys.map((k,i)=>[k,a[i]??undefined])))}))};}
 let frame,promise;
 g.PvpOriginalEngine={pack,unpack,load(){
  if(promise)return promise;
  promise=new Promise((resolve,reject)=>{
   frame=document.createElement('iframe');frame.title='원래 오이붕 온라인 전투';frame.style.cssText='width:100%;aspect-ratio:1;border:0;pointer-events:none;display:none';
   frame.src='pvp-runtime.html?v=fight-countdown1';
   const timer=setTimeout(()=>reject(Error('전투 엔진 로딩 시간 초과')),15000);
   frame.onload=()=>{clearTimeout(timer);const r=frame.contentWindow.PvpRuntime;if(!r)return reject(Error('전투 엔진 로딩 실패'));resolve({...r,normalizeProfile:unpack});};
   document.getElementById('pvp-canvas').after(frame);
  }).catch(e=>{frame?.remove();promise=null;throw e;});return promise;
 },show(){if(frame)frame.style.display='block';document.getElementById('pvp-canvas').hidden=true;},paint(){frame?.contentWindow.PvpRuntime?.paint();}};
})(window);
