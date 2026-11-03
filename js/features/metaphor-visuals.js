/* Visual metaphor vocabulary: safe art direction, not arbitrary JavaScript.
 * Both actual combat and the mini pinball studio use paint().
 * An interpreted metaphor has an EXISTING executable action as its physics. */
(function(g){'use strict';
const SHAPES=Object.freeze({jaw:'거대한 턱',beam:'광선',claw:'발톱',crystal:'수정 결정',halo:'에너지 고리',aura:'조합 이펙트'});
const HEX=/^#[0-9a-f]{6}$/i;
const clamp=(v,lo,hi,fallback)=>Number.isFinite(Number(v))?
 Math.max(lo,Math.min(hi,Number(v))):fallback;
function normalize(value){
 if(!value||typeof value!=='object')return undefined;
 const layers=g.SkillFXComposer?.normalize?.(value.layers)||[];
 if(!Object.hasOwn(SHAPES,value.shape)&&!layers.length)return undefined;
 return {shape:Object.hasOwn(SHAPES,value.shape)?value.shape:'aura',
   color:HEX.test(value.color)?value.color:'#a88eff',
   scale:clamp(value.scale,.6,2.8,1.5),
   charge:value.charge===true,
   ...(layers.length?{layers}:{})};
}
function interpret(input){
 const raw=String(input||'');
 const namedJaw=/턱|아가리|거대한?\s*입|이빨|물어뜯|깨물/.test(raw);
 const laser=/빔|레이저|광선|열선|빛줄기|광채\s*발사/.test(raw);
 const claw=/발톱|할퀴|긁어|갈퀴|손톱/.test(raw);
 const crystal=/수정|결정체|크리스탈|얼음\s*조각/.test(raw);
 const halo=/후광|고리|원환|마법진|에너지\s*원/.test(raw);
 const isDark=/멘헤라|어두|검은|암흑|그림자|어둠|심연|흑염/.test(raw);
 const isFire=/불꽃|화염|불길|용암|작열/.test(raw);
 const isIce=/빙하|서리|냉기|얼음/.test(raw);
 const isGold=/태양|황금|빛나는|광휘/.test(raw);
 const color=isDark?'#432052':isFire?'#ff703c':isIce?'#84d7ff':isGold?'#ffd76e':'#b19cff';
 const scale=/초거대|엄청나게\s*(?:크|굵|두껍)/.test(raw)?2.65:
   /거대|커다란|거대한|두꺼운|굵은|강력|압도적/.test(raw)?2.2:1.45;
 const charge=/모아|모여|응축|차징|집중|축적|충전/.test(raw);
 const composed=g.SkillFXComposer?.infer?.(raw);
 let shape,type;
 if(namedJaw){shape='jaw';type=/회전|빙글|사방/.test(raw)?'spinslash':'slash';}
 else if(laser){shape='beam';type='beam';}
 else if(claw){shape='claw';type=/회전|사방/.test(raw)?'spinslash':'slash';}
 else if(crystal){shape='crystal';type=/분열/.test(raw)?'splitshot':'shot';}
 else if(halo){shape='halo';type='wave';}
 else return null;
 return {type,visual:normalize({shape,color,scale,charge,layers:composed?.layers}),meaning:
  SHAPES[shape]+' · '+(isDark?'어둠':isFire?'화염':isIce?'빙결':isGold?'광휘':'에너지')+' 연출'};
}
// Context coordinates are already translated to the caster, and rotated
// toward the target by SkillVisuals. Art must not mutate HP or physics.
function paint(ctx,options={}){
 const v=normalize(options.visual);
 if(!v||!ctx)return false;
 const t=clamp(options.progress,0,1,0),
   phase=options.phase==='impact'?'impact':'cast',
   size=clamp(options.radius,25,300,90),
   sc=v.scale,alpha=Math.min(1,t*7,(1-t)*5);
 const dark=v.color==='#432052',color=v.color;
 const length=clamp(options.length,48,500,180);
 ctx.save();ctx.globalAlpha*=alpha;
 ctx.lineCap='round';ctx.lineJoin='round';
 if(v.shape==='jaw'){
  // A socket grows from the rim of the circular ball: two interlocking
  // upper/lower mandibles with individual ivory teeth, then a sweep.
  const grow=phase==='impact'?1:Math.min(1,t*5),swing=phase==='impact'?.05:
    -.65+Math.sin(Math.min(1,t*1.7)*Math.PI)*.72;
  ctx.translate(13,0);ctx.rotate(swing);ctx.scale(sc*grow,sc*grow);
  ctx.shadowColor=color;ctx.shadowBlur=9;
  ctx.fillStyle='#342539';ctx.strokeStyle=color;ctx.lineWidth=2.3;
  ctx.beginPath();ctx.moveTo(-12,-6);ctx.quadraticCurveTo(15,-31,43,-18);
  ctx.lineTo(32,-4);ctx.lineTo(0,3);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-12,5);ctx.quadraticCurveTo(11,29,42,19);
  ctx.lineTo(33,5);ctx.lineTo(2,-3);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#f6eee0';
  for(let j=0;j<5;j++){const x=5+j*7;
   ctx.beginPath();ctx.moveTo(x,-13);ctx.lineTo(x+4,-1);ctx.lineTo(x+7,-15);ctx.fill();
   ctx.beginPath();ctx.moveTo(x,13);ctx.lineTo(x+4,1);ctx.lineTo(x+7,15);ctx.fill();
  }
  ctx.fillStyle='#e0a5c7';ctx.beginPath();ctx.arc(2,-6,2.3,0,Math.PI*2);ctx.fill();
 }else if(v.shape==='beam'){
  const chargeRatio=v.charge&&phase==='cast'?Math.min(1,t*3.3):1;
  const fire=phase==='impact'||!v.charge||t>.26;
  const w=clamp(7*sc,5,25);
  ctx.shadowColor=color;ctx.shadowBlur=dark?20:15;
  if(v.charge&&phase==='cast'){
   const radius=(1-chargeRatio)*42+10;
   ctx.strokeStyle=color;ctx.lineWidth=2;
   for(let j=0;j<6;j++){
    const a=j*Math.PI/3+t*13;
    ctx.beginPath();ctx.moveTo(Math.cos(a)*radius,Math.sin(a)*radius);
    ctx.lineTo(Math.cos(a)*11,Math.sin(a)*11);ctx.stroke();
   }
  }
  if(fire){
   const rise=Math.min(1,Math.max(.06,(t-(v.charge?.26:0))*6));
   const ray=length*rise;
   ctx.strokeStyle=color;ctx.lineWidth=w*2.55;ctx.globalAlpha*=.43;
   ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(ray,0);ctx.stroke();
   ctx.globalAlpha=Math.min(1,alpha);
   ctx.strokeStyle=dark?'#130a20':color;ctx.lineWidth=w*1.6;
   ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(ray,0);ctx.stroke();
   ctx.strokeStyle=dark?'#9255bb':'#f2e9ff';ctx.lineWidth=w*.55;
   ctx.beginPath();ctx.moveTo(0,-w*.35);ctx.lineTo(ray,0);ctx.stroke();
   ctx.fillStyle=dark?'#a66de2':'#ffffff';
   ctx.beginPath();ctx.arc(ray,0,Math.max(3,w*.7),0,Math.PI*2);ctx.fill();
  }
 }else if(v.shape==='claw'){
  ctx.scale(sc,sc);ctx.strokeStyle=color;ctx.lineWidth=5;
  for(let i=-1;i<=1;i++){
   ctx.beginPath();ctx.moveTo(-9,i*8);
   ctx.quadraticCurveTo(15,14+i*12,37+5*t,i*11-14);ctx.stroke();
  }
 }else if(v.shape==='crystal'){
  ctx.scale(sc,sc);ctx.fillStyle=color;ctx.strokeStyle='#f4f7ff';ctx.lineWidth=2;
  for(let i=0;i<5;i++){
   ctx.save();ctx.rotate(i*Math.PI*2/5+t*3);
   ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(9,-27);
   ctx.lineTo(0,-45);ctx.lineTo(-9,-27);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
 }else if(v.shape==='halo'){
  ctx.rotate(t*2.3);ctx.strokeStyle=color;ctx.lineWidth=4;
  for(let k=0;k<3;k++){ctx.beginPath();ctx.ellipse(0,0,size*.25*sc,
    size*.09*sc,k*Math.PI/3,0,Math.PI*2);ctx.stroke();}
 }
 g.SkillFXComposer?.paint?.(ctx,{visual:v,progress:t,phase,
  radius:size,length,low:options.low===true});
 ctx.restore();return true;
}
g.MetaphorVisuals=Object.freeze({SHAPES,normalize,interpret,paint});
})(typeof window!=='undefined'?window:globalThis);
