/* Charge is a preparatory block. It does not deal damage by itself.
 * One subsequent offensive action receives extra impact and knockback.
 * A newer charge overwrites, never stacks with an existing charge. */
(function(g){'use strict';
const cap=(n,l,h)=>Math.max(l,Math.min(h,n));
const duration=a=>cap(Number(a?.duration)||1.2,.2,8);
const framesOf=a=>Math.max(12,Math.round(duration(a)*60));
const power=a=>1.18+Math.min(3,duration(a))*.18;
const force=a=>1.3+Math.min(3,duration(a))*.39;
const ATTACK=new Set('wave shot beam bolt pull orbit zone homing pierce boomerang chain nova meteor mine drain blackhole starfall dung flight burrow dive uppercut slash spinslash thrust aircombo arcshot splitshot wall summon turret trap burrowdash erupt'.split(' '));
function start(p,a){
 if(!p||p.hp<=0)return false;
 p.forgeCharge={phase:'charging',ticks:framesOf(a),total:framesOf(a),
   damage:power(a),force:force(a),expires:0,flash:0};
 return true;
}
function tick(p){
 const s=p?.forgeCharge;if(!s)return;
 if(p.hp<=0){p.forgeCharge=null;return;}
 if(s.phase==='charging'){
  if(--s.ticks<=0){s.phase='ready';s.ticks=0;s.expires=300;s.flash=12;}
 }else if(s.phase==='ready'){
  if(--s.expires<=0)p.forgeCharge=null;
 }else if(s.phase==='release'){
  if(--s.flash<=0)p.forgeCharge=null;
 }
}
function consume(p,a){
 const s=p?.forgeCharge;
 if(!s||s.phase!=='ready'||!ATTACK.has(a?.type)||!(Number(a.damage)>0))return a;
 p.forgeCharge={phase:'release',ticks:0,total:s.total,
  flash:24,damage:s.damage,force:s.force,expires:0};
 const modified={...a,damage:Math.round(Number(a.damage)*s.damage),
  knockback:Math.min(18,(Number(a.knockback)||0)*s.force),charged:true};
 g.SkillVisuals?.cast?.(p,{type:'charge',radius:105,duration:.35},null);
 g.BattleFX?.sound?.('blast',.48);
 return modified;
}
function jitter(p){
 const s=p?.forgeCharge;
 if(s?.phase!=='charging')return {x:0,y:0};
 const progress=1-s.ticks/Math.max(1,s.total);
 return {x:Math.sin(s.ticks*2.27)*(.65+progress*2.4),
   y:Math.cos(s.ticks*2.93)*(.65+progress*2.4)};
}
function draw(p,ctx){
 const s=p?.forgeCharge;
 if(!s||p.hp<=0||!ctx)return;
 const r=p.radius||28;
 const frame=s.phase==='charging'?s.total-s.ticks:
   s.phase==='release'?24-s.flash:s.total+300-(s.expires||0);
 const progress=s.phase==='charging'?1-s.ticks/Math.max(1,s.total):1;
 const c=p.forge?.effectColor||p.themeColor||'#8bc7ef';
 const x=p.x,y=p.y-(g.AdvancedCombat?.height?.(p)||0);
 ctx.save();ctx.strokeStyle=c;ctx.fillStyle=c;
 ctx.lineWidth=s.phase==='release'?4.5:1.8+progress*2;
 ctx.globalAlpha=s.phase==='release'?Math.max(.05,s.flash/24):.45+progress*.4;
 ctx.shadowColor=c;ctx.shadowBlur=4+progress*14;
 const radius=r+10+progress*13+(s.phase==='release'?(1-s.flash/24)*34:0)+Math.sin(frame*.35)*2;
 ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();
 const sparks=s.phase==='release'?18:10;
 for(let i=0;i<sparks;i++){
  const t=i*Math.PI*2/sparks+frame*.065;
  const distance=r+19+(1-progress)*18+Math.sin(frame*.12+i*2.3)*7;
  ctx.beginPath();ctx.arc(x+Math.cos(t)*distance,y+Math.sin(t)*distance,
   1.2+progress*1.8,0,Math.PI*2);ctx.fill();
 }
 if(s.phase==='charging'){
  const w=r*1.85;
  ctx.globalAlpha=.85;ctx.fillStyle='rgba(12,22,30,.7)';
  ctx.fillRect(x-w/2,y-r-27,w,4);
  ctx.fillStyle=c;ctx.fillRect(x-w/2,y-r-27,w*progress,4);
 }
 ctx.restore();
}
g.ArenaCharge=Object.freeze({start,tick,consume,jitter,draw,framesOf,power,force,ATTACK});
g.ActionRegistry?.register({
 id:'charge',label:'차징 · 힘 모으기',category:'special',parameters:['duration'],
 executor:'custom',family:'cosmos',physics:'none',offense:false,
 visual:{motif:'orbital',color:'#b990f3'},
 preview:{duration:1350,pose:'cosmos',anchor:'caster'},
 audio:{cast:'cosmos',impact:'blast'},
 execute:(p,a)=>start(p,a)
});
})(typeof window!=='undefined'?window:globalThis);
