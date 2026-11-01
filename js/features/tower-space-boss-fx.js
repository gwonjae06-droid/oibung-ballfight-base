/* Cosmic-page cinematics: additive-looking vector nebula and lensing.
 * Deliberately transparent, pointer-safe, bounded particle counts.
 */
(function(g){'use strict';
const TAU=Math.PI*2;
const cap=(n,l,h)=>Math.max(l,Math.min(h,n));
function seeded(i){const k=Math.sin(i*127.1+78.233)*43758.5453;return k-Math.floor(k);}
function page(ctx,event,t,w,h,reduced=false){
 if(event?.realm!=='space')return;
 const p=cap(event.progress||0,0,1),opacity=cap(Math.min(p*8,(1-p)*8),0,1);
 const a=opacity*(reduced?.2:.53);
 const cx=w*.5,cy=h*.47,size=Math.min(w,h),phase=reduced?0:(t-(event.start||0))*.005;
 ctx.save();
 const glow=ctx.createRadialGradient(cx,cy,size*.1,cx,cy,Math.max(w,h)*.68);
 glow.addColorStop(0,'rgba(25,17,64,0)');
 glow.addColorStop(.55,'rgba(89,45,143,.045)');
 glow.addColorStop(1,'rgba(38,24,85,.34)');
 ctx.globalAlpha=a;ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 ctx.translate(cx,cy);
 // Interlocking luminous orbital arcs are continuous curves, not PNG overlays.
 for(let i=0;i<4;i++){
  const r=size*(.23+i*.115);
  ctx.save();ctx.rotate(phase*(i%2?-.34:.45)+i*.59);
  ctx.globalAlpha=a*(.3+i*.1);
  ctx.strokeStyle=i%2?'#e3ccff':'#b6e6ff';ctx.lineWidth=i===0?2.7:1.25;
  ctx.beginPath();ctx.ellipse(0,0,r,r*(.43+i*.06),.18*i,.13,Math.PI*1.85);ctx.stroke();
  ctx.restore();
 }
 const variant=event.variant??0;
 if(variant===0){
  // Edge lensing rather than an opaque full-screen obstruction.
  for(let i=0;i<3;i++){
   ctx.globalAlpha=a*(.18+i*.11);
   ctx.strokeStyle=i%2?'#b57de7':'#f3ddff';
   ctx.lineWidth=1.6+i*.5;
   ctx.beginPath();ctx.arc(0,0,size*(.15+i*.065),phase+i*.6,phase+Math.PI*1.5+i*.6);ctx.stroke();
  }
 }else if(variant===1){
  const core=cap(p*2.4,0,1);
  ctx.globalAlpha=a*.43;
  ctx.strokeStyle='#ffedcf';ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(0,0,(.11+core*.48)*size,0,TAU);ctx.stroke();
 }else{
  ctx.globalAlpha=a*.26;ctx.strokeStyle='#c5bbff';ctx.lineWidth=2;
  for(let arm=0;arm<3;arm++){
   ctx.beginPath();
   for(let i=0;i<=44;i++){
    const q=i/44,angle=q*Math.PI*2+arm*TAU/3+phase*.2;
    const r=q*size*.52;
    const x=Math.cos(angle)*r,y=Math.sin(angle)*r*.53;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   }
   ctx.stroke();
  }
 }
 // Sparse luminous dust avoids excessive DOM blur and shader stalls.
 if(!reduced)for(let i=0;i<(w<650?26:70);i++){
  const seed=seeded(i),phaseStar=seed*TAU+(t*.001)*(seed*.6+.1);
  const r=(size*.16+seeded(i+211)*size*.48)*(1-p*.12);
  const x=Math.cos(phaseStar)*r,y=Math.sin(phaseStar)*r;
  ctx.globalAlpha=a*(.2+.7*Math.abs(Math.sin(phase+i)));
  ctx.fillStyle=i%3?'#d5c9fc':'#fff2ce';
  ctx.fillRect(x,y,seed*1.7+1,seed*1.7+1);
 }
 ctx.restore();
}
g.ArenaSpaceBossFX=Object.freeze({page});
})(globalThis);
