/* Skill-builder cinematics: linked blocks become a readable, flowing spell.
 * Visual-only. Gameplay timing, damage, hitboxes, saves and controls are untouched. */
(function(global){
'use strict';
const TAU=Math.PI*2,MAX=64,INK='#0a1021';
const effects=[];let reduced=false;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const statusTint={fire:'#ffb157',ice:'#b5f3ff',poison:'#c3f581',none:null};
const attack=new Set(['shot','homing','pierce','boomerang','arcshot','splitshot','bolt','beam','chain','thrust','slash','spinslash','aircombo','uppercut','dung']);
const swell=new Set(['wave','nova','meteor','starfall','erupt','blackhole','orbit','zone','pull','mine']);
const support=new Set(['heal','shield','regen','fortify','cleanse','haste','lifebloom','resurrect','rewind','timeburst','timestop']);
const movement=new Set(['dash','blink','leap','hover','glide','swap','retreat','portal','flight','burrowdash']);
function push(e){if(effects.length>=MAX)effects.shift();effects.push(e);}
function hex(c){return typeof c==='string'&&/^#[\da-f]{6}$/i.test(c)?c:'#bca6f4';}
function color(p){return hex(p?.forge?.effectColor||p?.effectColor||p?.forge?.color);}
function position(p){return global.ArenaMotion?.position?.(p)||p;}
function line(c,x,y,xx,yy){c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
function ring(c,x,y,r,a=0,b=TAU){c.beginPath();c.arc(x,y,Math.max(.1,r),a,b);c.stroke();}
function polygon(c,sides,r,turn){c.beginPath();for(let i=0;i<sides;i++){const a=turn+i*TAU/sides;if(i)c.lineTo(Math.cos(a)*r,Math.sin(a)*r);else c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.stroke();}
function mark(c,type,size,t){
 c.save();c.lineWidth=2;
 if(support.has(type)){polygon(c,6,size,t*.6);line(c,-size*.38,0,size*.38,0);line(c,0,-size*.38,0,size*.38);}
 else if(movement.has(type)){for(let j=-1;j<=1;j++){line(c,-size*.7,j*size*.3,size*.45,j*size*.3);line(c,size*.45,j*size*.3,size*.12,(j-.7)*size*.3);}}
 else if(swell.has(type)){polygon(c,8,size,t*.5);ring(c,0,0,size*.4);}
 else if(attack.has(type)){polygon(c,4,size,t*.36+Math.PI/4);line(c,-size*.8,0,size*.8,0);}
 else{polygon(c,5,size,t*.3);ring(c,0,0,size*.4);}
 c.restore();
}
function sparks(c,amount,r,phase,t,seed=0){for(let i=0;i<amount;i++){
 const a=i*2.399963+seed+phase*.7+(i%3)*.19;
 const d=r*(.3+.7*((i*7%17)/17));
 const x=Math.cos(a)*d,y=Math.sin(a)*d;
 c.beginPath();c.arc(x,y,.8+(i%4)*.55,0,TAU);c.fill();
 if(i%5===0){c.lineWidth=1;line(c,x-3,y,x+3,y);line(c,x,y-3,x,y+3);}
}}
function ribbon(c,x0,y0,x1,y1,t,mode){
 // Decorative flowing link only: does not represent a new projectile or hitbox.
 const dx=x1-x0,dy=y1-y0,d=Math.hypot(dx,dy)||1;
 if(d<18)return;
 const nx=-dy/d,ny=dx/d,curve=(mode==='with'?24:mode==='after'?-22:14)*Math.min(1,d/100);
 c.beginPath();c.moveTo(x0,y0);c.quadraticCurveTo((x0+x1)/2+nx*curve,(y0+y1)/2+ny*curve,x1,y1);c.stroke();
 for(let i=0;i<5;i++){
   const f=(i/5+t*.035)%1,inv=1-f;
   const x=inv*inv*x0+2*f*inv*((x0+x1)/2+nx*curve)+f*f*x1;
   const y=inv*inv*y0+2*f*inv*((y0+y1)/2+ny*curve)+f*f*y1;
   c.beginPath();c.arc(x,y,1.5+(i%2),0,TAU);c.fill();
 }
}
function cast(p,action,info={},target){
 if(!p?.forge||p.towerEnemy||!action?.type)return false;
 const steps=clamp(Number(info.steps)||1,1,3),step=clamp(Number(info.step)||0,0,steps-1);
 const link=step===0?'start':['with','after','and'].includes(info.link)?info.link:'and';
 const at=position(p),where=target&&Number.isFinite(target.x)&&Number.isFinite(target.y)?target:at;
 const x=Number(at?.x),y=Number(at?.y);if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 const e={kind:'cast',owner:p,type:action.type,steps,step,link,age:0,life:steps>1?43:31,
   color:color(p),status:statusTint[action.status]||null,radius:clamp(Number(action.radius)||80,30,180),
   x,y,targetX:where.x,targetY:where.y};
 push(e);return true;
}
function pulse(p,action,slot=0){
 // 0.1s ornamental cadence for rapid periodic skills. Never calls gameplay.
 if(!p?.forge||p.towerEnemy||p.hp<=0||!action?.type||reduced)return false;
 const at=position(p),x=Number(at?.x),y=Number(at?.y);
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 push({kind:'pulse',owner:p,x,y,type:action.type,color:color(p),
  status:statusTint[action.status]||null,age:0,life:14,slot:slot%4});
 return true;
}
function impact(p,target,action){
 if(!p?.forge||p.towerEnemy||!target||!action?.type)return false;
 const x=Number(target.x),y=Number(target.y);if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 push({kind:'impact',x,y,type:action.type,color:color(p),status:statusTint[action.status]||null,
   age:0,life:26,steps:1,step:0,link:'impact',radius:clamp(Number(action.radius)||65,30,100)});
 return true;
}
function tick(){for(let i=effects.length-1;i>=0;i--)if(++effects[i].age>=effects[i].life)effects.splice(i,1);}
function drawCast(c,e,t){
 const owner=position(e.owner),x=Number(owner?.x)||e.x,y=(Number(owner?.y)||e.y)-(global.AdvancedCombat?.visibleHeight?.(e.owner)||0);
 const strength=Math.sin(Math.PI*t),rad=26+e.steps*6+(1-t)*12,spin=(e.step%2?-1:1)*e.age*.045;
 c.translate(x,y);c.globalAlpha=clamp(Math.min(1,t*10,(1-t)*5),0,1)*(.72+e.steps*.07);
 const tint=e.status||e.color;
 c.strokeStyle=INK;c.lineWidth=7;ring(c,0,0,rad*.95);
 c.strokeStyle=e.color;c.lineWidth=2.5;c.shadowColor=tint;c.shadowBlur=reduced?0:14;
 ring(c,0,0,rad,spin,spin+TAU*(.55+.3*strength));
 c.strokeStyle=tint;c.lineWidth=2;ring(c,0,0,rad*.8,-spin*.75,-spin*.75+Math.PI*1.4);
 for(let i=0;i<Math.min(stepsOrOne(e),3);i++){
   const angle=spin+i*TAU/e.steps,px=Math.cos(angle)*rad,py=Math.sin(angle)*rad;
   c.fillStyle='#f8f8ff';c.beginPath();c.arc(px,py,2.7,0,TAU);c.fill();
 }
 if(e.steps>1){
   c.save();c.rotate(-spin*.7);c.strokeStyle=tint;c.lineWidth=1.6;
   polygon(c,6,rad*.58,Math.PI/6);mark(c,e.type,11+strength*4,spin);c.restore();
   // Link vocabulary: simultaneous twins / sequential streak / fluent chain.
   c.strokeStyle=tint;c.fillStyle='#fff2dd';c.lineWidth=e.link==='after'?3:2;
   if(e.link==='with'){
     for(const s of [-1,1]){ring(c,s*rad*.5,-rad*.55,rad*.52,spin,spin+Math.PI*1.5);}
   }else if(e.link==='after'){
     for(let i=0;i<3;i++){const yy=rad*.7+i*8+e.age*.36;line(c,-11,yy,11,yy);}
   }else if(e.link==='and'){ring(c,0,0,rad*1.12,spin,spin+Math.PI*.75);}
   if(e.step>0){c.save();c.globalAlpha*=.55;c.strokeStyle=tint;c.fillStyle='#fff4e9';c.lineWidth=1.7;
     ribbon(c,0,0,clamp(e.targetX-x,-210,210),clamp(e.targetY-y,-210,210),e.age,e.link);c.restore();}
 }
 c.fillStyle=e.status||'#f3eaff';if(!reduced)sparks(c,e.steps>1?14:6,rad*1.5,spin,t,e.step);
 if(e.status){c.strokeStyle=e.status;c.lineWidth=1.5;
  if(e.status===statusTint.fire){for(let j=0;j<6;j++){const a=j*TAU/6;line(c,Math.cos(a)*rad*.55,Math.sin(a)*rad*.55,Math.cos(a)*(rad+9*strength),Math.sin(a)*(rad+9*strength));}}
  if(e.status===statusTint.ice){for(let j=0;j<6;j++){const a=j*TAU/6;c.save();c.rotate(a);line(c,0,-rad*.72,0,-rad*1.3);line(c,0,-rad,5,-rad*1.12);line(c,0,-rad,-5,-rad*1.12);c.restore();}}
  if(e.status===statusTint.poison){for(let j=0;j<6;j++){const a=j*TAU/6;c.beginPath();c.ellipse(Math.cos(a)*rad*.85,Math.sin(a)*rad*.85,7,3,a,0,TAU);c.stroke();}}
 }
}
function stepsOrOne(e){return Math.max(1,e.steps||1);}
function drawImpact(c,e,t){
 const r=12+(e.radius*.53)*t;
 c.translate(e.x,e.y);c.globalAlpha=(1-t)*.88;
 c.strokeStyle=e.color;c.lineWidth=4*(1-t)+1;c.shadowColor=e.status||e.color;c.shadowBlur=reduced?0:12;
 ring(c,0,0,r);c.strokeStyle=e.status||'#fff5d5';c.lineWidth=2;ring(c,0,0,r*.6+t*9);
 const count=reduced?5:12;c.fillStyle=e.status||'#ffefce';
 for(let j=0;j<count;j++){const a=j*TAU/count+e.step*.16,d=6+t*(e.radius*.65+5*(j%3));
  c.save();c.rotate(a);line(c,d-7,0,d+7,0);c.beginPath();c.arc(d+8,0,1.2+(j%3),0,TAU);c.fill();c.restore();
 }
 if(e.status===statusTint.ice){c.strokeStyle='#e7ffff';for(let i=0;i<6;i++){c.save();c.rotate(i*TAU/6);polygon(c,4,4+t*9,0);c.restore();}}
}
function drawPulse(c,e,t){
 const owner=position(e.owner),x=Number(owner?.x)||e.x,
   y=(Number(owner?.y)||e.y)-(global.AdvancedCombat?.visibleHeight?.(e.owner)||0);
 const a=(1-t)*.55,r=17+t*16+e.slot*2,turn=e.age*.05+e.slot*TAU/4;
 c.translate(x,y);c.globalAlpha=a;c.strokeStyle=e.status||e.color;
 c.lineWidth=1.8;ring(c,0,0,r,turn,turn+TAU*.72);
 c.strokeStyle='#fff3d7';c.lineWidth=1.1;
 ring(c,0,0,r*.7,-turn*.6,-turn*.6+Math.PI*1.1);
 for(let i=0;i<3;i++){const angle=turn+i*TAU/3;c.beginPath();
  c.arc(Math.cos(angle)*r,Math.sin(angle)*r,1.5,0,TAU);c.fillStyle=e.color;c.fill();}
}
function draw(c){if(!c||!effects.length)return;
 c.save();c.globalCompositeOperation='source-over';
 for(const e of effects){if(e.owner?.hp<=0)continue;
  const t=clamp(e.age/e.life,0,1),fx=global.ArenaFXDepth;
  const owner=position(e.owner),x=Number(owner?.x)||e.x,y=Number(owner?.y)||e.y;
  if(fx){
   if(e.kind==='impact')fx.impact(c,e.x,e.y,Math.min(72,e.radius*.65),Math.min(70,e.radius*.55),e.status||e.color,t,'magic');
   else if(e.kind==='cast'){fx.ground(c,x,y,26+e.steps*5,e.color,.20);
    if(!reduced)fx.column(c,x,y,12,32+e.steps*7,e.color,.24,'magic');}
   else if(e.kind==='pulse'&&!reduced)fx.ground(c,x,y,19+e.slot*3,e.color,.16);
  }
  c.save();c.lineCap='round';c.lineJoin='round';
  if(e.kind==='cast')drawCast(c,e,t);else if(e.kind==='pulse')drawPulse(c,e,t);else drawImpact(c,e,t);c.restore();
 }c.restore();
}
function preview(c,{type='wave',status='none',link='and',progress=0,color:colorValue='#bca6f4'}={}){
 if(!c)return;const t=clamp(Number(progress)||0,0,1);const ringRadius=27+7*Math.sin(Math.PI*t);
 c.save();c.strokeStyle=colorValue;c.lineWidth=2;c.globalAlpha=.45+.45*Math.sin(Math.PI*t);
 c.shadowColor=statusTint[status]||colorValue;c.shadowBlur=reduced?0:7;
 ring(c,0,0,ringRadius,-t*TAU,-t*TAU+Math.PI*1.7);
 c.strokeStyle=statusTint[status]||'#f8e9ff';mark(c,type,12,t*TAU);
 if(link==='with'){ring(c,-14,-19,11);ring(c,14,-19,11);}
 else if(link==='after'){for(let i=0;i<3;i++)line(c,-13+i*9,24,-9+i*9,33);}
 else if(link==='and'){ring(c,0,0,ringRadius*1.18,t*2,t*2+1.4);}
 c.restore();
}
function clear(){effects.length=0;}
function setReduced(v){reduced=!!v;}
global.ForgeComboFX={cast,impact,pulse,tick,draw,preview,clear,setReduced,get active(){return effects.length;},get reduced(){return reduced;}};
})(window);
