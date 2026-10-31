/* Status telegraphs belong to the fighter, not to the attack particle pool.
 * Draws from existing simulation-owned timers. No damage, timers or input handling. */
(function(g){'use strict';
const TAU=Math.PI*2;
const M={
 freeze:['빙결','✳','#9be4ff','ice'],stun:['기절','★','#ffdc74','star'],root:['속박','⌁','#a3da6c','vine'],silence:['침묵','×','#caa5ff','cross'],
 bleed:['출혈','♦','#ff7287','drop'],shock:['감전','ϟ','#ffe279','bolt'],vulnerable:['취약','!','#ff9270','crack'],weak:['약화','↓','#ad9ed8','down'],
 fear:['공포','!','#ad9cff','ghost'],charm:['매혹','♥','#ff91c3','heart'],blind:['실명','◉','#a1b0c3','blind'],curse:['저주','☾','#cf91ee','moon'],
 ice:['둔화','❄','#9be4ff','ice'],fire:['화상','♨','#ff974e','flame'],poison:['중독','☣','#a9e65d','bubble'],dot:['지속피해','•','#ffb26c','drop'],
 regen:['재생','+','#7ceaaa','plus'],haste:['가속','»','#5ad8fc','speed'],fortify:['강화','⬡','#8ab3ff','shield'],timeburst:['시간가속','◷','#e2bcff','clock'],
 shield:['방어','◆','#8bd1ff','shield'],resist:['저항','◇','#d0c6e8','shield']
};
const ORDER=['freeze','stun','root','silence','fire','poison','ice','shock','bleed','vulnerable','weak','blind','fear','charm','curse','regen','haste','fortify','timeburst'];
let reduced=false;
const valid=n=>Number.isFinite(n)&&n>0;
function collect(p){
 if(!p||!(p.hp>0))return [];
 const out=[];
 for(const key of ORDER){const time=p.forgeEffects?.[key]?.time;if(valid(time))out.push({key,time,label:M[key][0],color:M[key][2],glyph:M[key][1]});}
 if(valid(p.bfDot)){
  const kind=p._forgeDotKind==='fire'||p._forgeDotKind==='poison'?p._forgeDotKind:'dot';
  // A single shared DoT clock can represent only one active type.
  if(!out.some(v=>v.key===kind))out.push({key:kind,time:p.bfDot,label:M[kind][0],color:M[kind][2],glyph:M[kind][1]});
 }
 if(valid(p.slowTimer)&&!out.some(v=>v.key==='ice'))out.push({key:'ice',time:p.slowTimer,label:M.ice[0],color:M.ice[2],glyph:M.ice[1]});
 if(valid(p.invincible)&&!(p._forgeImpactGrace>0&&p.invincible<=p._forgeImpactGrace))out.push({key:'shield',time:p.invincible,label:M.shield[0],color:M.shield[2],glyph:M.shield[1]});
 const ccLeft=(p._forgeCCReady||0)-(p._forgeBalanceFrame||0);
 if(valid(ccLeft)&&!out.some(v=>['freeze','stun','root','silence'].includes(v.key)))out.push({key:'resist',time:ccLeft,label:M.resist[0],color:M.resist[2],glyph:M.resist[1]});
 return out;
}
function rounded(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}
function symbol(c,kind,x,y,r){
 c.save();c.translate(x,y);c.lineWidth=Math.max(1.5,r*.17);c.lineJoin='round';c.lineCap='round';
 c.beginPath();
 if(kind==='ice')for(let i=0;i<6;i++){const a=i*TAU/6;c.moveTo(0,0);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);c.moveTo(Math.cos(a)*r*.58+Math.cos(a+.85)*r*.23,Math.sin(a)*r*.58+Math.sin(a+.85)*r*.23);c.lineTo(Math.cos(a)*r*.58,Math.sin(a)*r*.58);c.lineTo(Math.cos(a)*r*.58+Math.cos(a-.85)*r*.23,Math.sin(a)*r*.58+Math.sin(a-.85)*r*.23);}
 else if(kind==='bolt'){c.moveTo(r*.12,-r);c.lineTo(-r*.4,-r*.03);c.lineTo(r*.1,-r*.03);c.lineTo(-r*.18,r);c.lineTo(r*.55,-r*.24);c.lineTo(r*.04,-r*.24);}
 else if(kind==='flame'){c.moveTo(0,r);c.bezierCurveTo(-r,-r*.02,-r*.15,-r*.65,0,-r);c.bezierCurveTo(r*.25,-r*.2,r*.95,-r*.2,r*.6,r*.65);c.quadraticCurveTo(r*.35,r,0,r);c.moveTo(0,r*.72);c.quadraticCurveTo(-r*.2,r*.25,r*.15,-r*.08);}
 else if(kind==='vine'){c.moveTo(-r,r);c.bezierCurveTo(-r*.7,-r*.15,r*.7,r*.5,r*.5,-r);c.moveTo(-r*.36,r*.2);c.lineTo(-r*.75,-r*.1);c.moveTo(r*.05,-r*.04);c.lineTo(r*.65,r*.1);}
 else if(kind==='cross'){c.arc(0,0,r*.85,0,TAU);c.moveTo(-r*.58,-r*.58);c.lineTo(r*.58,r*.58);}
 else if(kind==='star'){for(let i=0;i<10;i++){const a=i*TAU/10-Math.PI/2,k=i%2?r*.46:r;c.lineTo(Math.cos(a)*k,Math.sin(a)*k);}c.closePath();}
 else if(kind==='heart'){c.moveTo(0,r*.85);c.bezierCurveTo(-r*.85,r*.2,-r*1.1,-r*.6,-r*.3,-r*.65);c.quadraticCurveTo(0,-r*.55,0,-r*.25);c.quadraticCurveTo(r*.35,-r*.9,r*.8,-r*.5);c.quadraticCurveTo(r*1.15,r*.1,0,r*.85);}
 else if(kind==='shield'){c.moveTo(0,-r);c.lineTo(r*.8,-r*.6);c.lineTo(r*.6,r*.45);c.lineTo(0,r);c.lineTo(-r*.6,r*.45);c.lineTo(-r*.8,-r*.6);c.closePath();}
 else if(kind==='clock'){c.arc(0,0,r*.84,0,TAU);c.moveTo(0,-r*.62);c.lineTo(0,0);c.lineTo(r*.5,r*.2);}
 else if(kind==='moon'){c.arc(0,0,r*.87,-Math.PI/3,Math.PI/2,true);c.moveTo(r*.42,-r*.7);c.quadraticCurveTo(-r*.35,0,r*.42,r*.7);}
 else if(kind==='plus'){c.moveTo(0,-r);c.lineTo(0,r);c.moveTo(-r,0);c.lineTo(r,0);}
 else if(kind==='speed'){for(let i=0;i<3;i++){const y=(i-1)*r*.5;c.moveTo(-r,y);c.lineTo(r*.15,y);c.lineTo(-r*.1,y-r*.25);c.moveTo(r*.15,y);c.lineTo(-r*.1,y+r*.25);}}
 else if(kind==='blind'){c.ellipse(0,0,r,r*.54,0,0,TAU);c.moveTo(-r,-r);c.lineTo(r,r);}
 else if(kind==='down'){c.moveTo(0,-r);c.lineTo(0,r);c.moveTo(-r*.5,r*.42);c.lineTo(0,r);c.lineTo(r*.5,r*.42);}
 else if(kind==='crack'){c.moveTo(-r,-r*.7);c.lineTo(-r*.18,-r*.18);c.lineTo(-r*.38,r*.2);c.lineTo(r*.4,r*.05);c.lineTo(r*.1,r);}
 else if(kind==='drop'){c.moveTo(0,-r);c.bezierCurveTo(-r*.8,0,-r*.9,r,0,r);c.bezierCurveTo(r*.9,r,r*.8,0,0,-r);}
 else if(kind==='bubble'){c.arc(-r*.25,r*.22,r*.42,0,TAU);c.moveTo(r*.15,-r*.5);c.arc(r*.36,-r*.5,r*.25,0,TAU);}
 else if(kind==='ghost'){c.moveTo(-r*.7,r);c.quadraticCurveTo(-r*.95,-r*.95,0,-r);c.quadraticCurveTo(r*.95,-r*.95,r*.7,r);c.lineTo(r*.25,r*.65);c.lineTo(-r*.2,r);c.closePath();}
 else {c.arc(0,0,r*.7,0,TAU);}
 c.stroke();c.restore();
}
function aura(c,p,items,coords,frame,quiet){
 const {x,y,radius:r}=coords;
 const preview=items.filter(v=>v.key!=='resist').slice(0,quiet?1:3);
 if(!preview.length)return;
 c.save();c.translate(x,y);
 for(let k=0;k<preview.length;k++){
  const v=preview[k],m=M[v.key],radius=r+6+k*5,phase=quiet?0:frame*.035+k*.95;
  c.save();c.globalAlpha=(quiet?.44:.66)/(1+k*.27);c.strokeStyle=v.color;c.fillStyle=v.color;c.lineWidth=k===0?3.3:2;
  // A thin arc never obscures the character's name or face.
  c.beginPath();c.ellipse(0,r*.1,radius,radius*.83,0,phase,phase+Math.PI*1.2);c.stroke();
  // Stacked horizontal halos reveal the body's volume while following its altitude.
  c.save();c.globalAlpha*=.45;c.lineWidth=1.25;
  for(const height of [-r*.54,r*.46]){
    c.beginPath();c.ellipse(0,height,radius*.90,radius*.28,0,phase*.36,phase*.36+Math.PI*1.65);c.stroke();
  }c.restore();
  const shape=m[3];
  if(shape==='flame'||shape==='bubble'||shape==='ice'||shape==='star'||shape==='bolt'){
   for(let j=0;j<(quiet?2:4);j++){
    const a=j*TAU/4+(quiet?0:phase*(shape==='star'?.8:.22)),rr=radius+7+(quiet?0:Math.sin(frame*.09+j)*4);
    symbol(c,shape,Math.cos(a)*rr,Math.sin(a)*rr*.78-r*.10,4.3+(j%2));
   }
  } else if(shape==='vine'){
   for(const side of [-1,1]){c.beginPath();c.moveTo(side*radius*.72,r*.74);c.bezierCurveTo(side*radius*1.25,r*.2,side*radius*.5,-r*.5,side*radius*.65,-r*.8);c.stroke();}
  } else if(shape==='shield'||shape==='clock'||shape==='cross'||shape==='blind'){
   symbol(c,shape,0,-r-13-k*9,6);
  } else {
   for(let j=0;j<(quiet?1:3);j++){
    const a=j*TAU/3+phase*.2;symbol(c,shape,Math.cos(a)*(r+8),Math.sin(a)*(r+8)*.85,4.5);
   }
  }
  c.restore();
 }
 c.restore();
}
function badges(c,items,coords){
 const {x,y,radius:r,canvasWidth:w=800,canvasHeight:h=600}=coords;
 const shown=items.length<=6?items:items.slice(0,5).concat([{key:'overflow',label:'+'+(items.length-5),color:'#d0d9e5',glyph:'+',time:0}]);
 const perRow=w<490?2:3,bw=75,bh=19,gap=3,rows=Math.ceil(shown.length/perRow);
 const above=y-r-41-rows*(bh+gap),startY=above<5?Math.min(h-rows*(bh+gap)-4,y+r+12):above;
 c.save();c.font='700 10.5px "Noto Sans KR",system-ui,sans-serif';c.textAlign='left';c.textBaseline='middle';
 for(let i=0;i<shown.length;i++){
  const it=shown[i],row=Math.floor(i/perRow),n=Math.min(perRow,shown.length-row*perRow),idx=i-row*perRow;
  const groupW=n*bw+(n-1)*gap;
  const left=Math.min(Math.max(3,x-groupW/2),Math.max(3,w-groupW-3));
  const bx=left+idx*(bw+gap),by=startY+row*(bh+gap);
  c.globalAlpha=.94;c.fillStyle='#111b2a';c.strokeStyle=it.color;c.lineWidth=1.1;
  rounded(c,bx,by,bw,bh,5);c.fill();c.stroke();
  c.fillStyle=it.color;c.font='bold 13px system-ui,sans-serif';c.fillText(it.glyph,bx+5,by+bh/2+.5);
  c.font='700 10px "Noto Sans KR",system-ui,sans-serif';c.fillStyle='#f8fbff';
  const seconds=it.time>0?(it.time/60).toFixed(1):'';
  c.fillText(it.label.slice(0,2),bx+21,by+bh/2);
  if(seconds){c.textAlign='right';c.fillStyle='#c5d0e0';c.font='9px system-ui,sans-serif';c.fillText(seconds,bx+bw-4,by+bh/2);c.textAlign='left';}
 }
 c.restore();
}
function draw(c,p,coords){
 if(!c||!coords)return;
 const items=collect(p);if(!items.length)return;
 const frame=Number(p._forgeBalanceFrame)||0;
 const radius=Number(coords.radius)||Number(p.radius)||25;
 const safe={x:Number.isFinite(coords.x)?coords.x:p.x,y:Number.isFinite(coords.y)?coords.y:p.y,radius,canvasWidth:coords.canvasWidth,canvasHeight:coords.canvasHeight};
 const quiet=reduced||!!g.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 aura(c,p,items,safe,frame,quiet);
 badges(c,items,safe);
}
const api={collect,draw,setReduced(v){reduced=!!v;},get reduced(){return reduced;},META:M};
g.ArenaStatusVFX=api;
})(typeof window!=='undefined'?window:globalThis);
