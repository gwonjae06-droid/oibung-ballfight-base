/* Reusable procedural silhouettes for sentence-authored skill effects.
 * Visual-only Canvas 2D geometry. Never mutates physics or combat state.
 * Fixed work budget, deterministic progress, no images, timers or eval.
 */
(function(g){'use strict';
const SHAPES=Object.freeze({butterfly:'나비 날개',jellyfish:'해파리',
 roots:'뿌리·촉수',dragon:'용의 실루엣',liquid:'유체 형상',mechanical:'기계 관절'});
const cap=(v,min,max,f)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):f;
const hex=/^#[0-9a-f]{6}$/i;
function paint(ctx,opts={}){
 const shape=opts.shape;
 if(!ctx||!Object.hasOwn(SHAPES,shape))return false;
 const t=cap(opts.progress,0,1,0);
 const color=hex.test(opts.color)?opts.color:'#9faaff';
 const sc=cap(opts.scale,.35,2.8,1);
 const low=opts.low===true;
 ctx.save();
 ctx.scale(sc,sc);ctx.lineCap='round';ctx.lineJoin='round';
 ctx.strokeStyle=color;ctx.fillStyle=color;
 ctx.shadowColor=color;ctx.shadowBlur=low?0:7;
 ctx.lineWidth=2.3;
 if(shape==='butterfly'){
  const flap=.86+Math.cos(t*Math.PI*12)*.19;
  for(const dir of [-1,1]){
   ctx.save();ctx.scale(dir*flap,1);
   ctx.globalAlpha*=.68;
   ctx.beginPath();ctx.moveTo(0,-4);
   ctx.bezierCurveTo(13,-28,29,-23,29,-11);
   ctx.bezierCurveTo(27,-3,9,3,0,1);
   ctx.closePath();ctx.fill();ctx.stroke();
   ctx.beginPath();ctx.moveTo(0,1);
   ctx.bezierCurveTo(26,-2,24,19,13,21);
   ctx.bezierCurveTo(5,22,0,14,0,5);
   ctx.closePath();ctx.fill();ctx.stroke();
   ctx.globalAlpha*=.8;ctx.strokeStyle='#f3faff';ctx.lineWidth=1;
   ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(22,-15);
   ctx.moveTo(0,0);ctx.lineTo(16,14);ctx.stroke();ctx.restore();
  }
  ctx.strokeStyle='#18233d';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(0,13);ctx.stroke();
  ctx.strokeStyle=color;ctx.lineWidth=1.5;
  for(const d of [-1,1]){
   ctx.beginPath();ctx.moveTo(0,-10);
   ctx.quadraticCurveTo(d*7,-20,d*11,-19);ctx.stroke();
  }
 }else if(shape==='jellyfish'){
  const pulse=1+Math.sin(t*Math.PI*8)*.07;
  ctx.scale(pulse,1);
  ctx.globalAlpha*=.73;
  ctx.beginPath();ctx.moveTo(-24,0);
  ctx.bezierCurveTo(-25,-42,25,-42,24,0);
  ctx.quadraticCurveTo(13,8,0,0);
  ctx.quadraticCurveTo(-14,8,-24,0);
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#f3fcff';ctx.lineWidth=1.6;
  ctx.beginPath();ctx.moveTo(-16,-9);
  ctx.quadraticCurveTo(-12,-31,6,-30);ctx.stroke();
  ctx.strokeStyle=color;
  for(let i=-2;i<=2;i++){
   const x=i*10;
   ctx.lineWidth=2.6-Math.abs(i)*.35;
   ctx.beginPath();ctx.moveTo(x,2);
   ctx.bezierCurveTo(x+7*Math.sin(t*9+i),18,x-8*Math.cos(t*6+i),27,
      x+7*Math.sin(t*5+i),38);ctx.stroke();
  }
 }else if(shape==='roots'){
  const arms=low?4:7;
  for(let i=0;i<arms;i++){
   const a=i*Math.PI*2/arms+t*.4,px=Math.cos(a)*15,py=Math.sin(a)*15;
   ctx.lineWidth=3.7-i*.25;
   ctx.beginPath();ctx.moveTo(0,0);
   ctx.bezierCurveTo(px,-py,px*2+8*Math.sin(t*7+i),py*1.5,
      px*2.3,py*2.3);ctx.stroke();
   if(!low){ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(px*1.5,py);
    ctx.lineTo(px*1.7+7,py-9);ctx.stroke();}
  }
 }else if(shape==='dragon'){
  ctx.lineWidth=10;ctx.globalAlpha*=.73;
  ctx.beginPath();ctx.moveTo(-28,13);
  ctx.bezierCurveTo(-15,-4,-4,19,10,0);
  ctx.bezierCurveTo(24,-13,26,0,35,-5);ctx.stroke();
  ctx.lineWidth=2;
  for(const side of [-1,1]){
   ctx.beginPath();ctx.moveTo(3,2);
   ctx.quadraticCurveTo(18,side*42,-6,side*27);
   ctx.lineTo(-18,side*33);ctx.lineTo(-13,side*12);
   ctx.closePath();ctx.fill();ctx.stroke();
  }
  ctx.beginPath();ctx.moveTo(29,-5);ctx.lineTo(42,-11);
  ctx.lineTo(37,0);ctx.closePath();ctx.fill();
 }else if(shape==='liquid'){
  for(let i=0;i<(low?3:5);i++){
   const a=i*Math.PI*2/5+t*Math.PI*2;
   const x=Math.cos(a)*(11+4*Math.sin(t*9)),y=Math.sin(a)*9;
   ctx.globalAlpha*=.91;
   ctx.beginPath();ctx.ellipse(x,y,8+Math.sin(t*7+i)*2,11,.35*Math.sin(t*5+i),0,Math.PI*2);
   ctx.fill();
  }
  ctx.strokeStyle='#d7f9ff';ctx.lineWidth=1.6;
  ctx.beginPath();ctx.ellipse(-6,-8,10,6,-.4,0,Math.PI);ctx.stroke();
 }else if(shape==='mechanical'){
  for(let j=0;j<2;j++){
   const dx=j?12:-12,dy=j?-4:3,r=j?11:15;
   ctx.save();ctx.translate(dx,dy);ctx.rotate(t*(j?-6:5));
   ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*.63,0,Math.PI*2);ctx.stroke();
   for(let i=0;i<8;i++){
    const a=i*Math.PI/4,co=Math.cos(a),si=Math.sin(a);
    ctx.beginPath();ctx.moveTo(co*r*.66,si*r*.66);
    ctx.lineTo(co*r,si*r);ctx.stroke();
   }
   ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-12,3);ctx.lineTo(12,-4);ctx.stroke();
 }
 ctx.restore();return true;
}
g.ProceduralVisualGeometry=Object.freeze({SHAPES,paint});
})(typeof window!=='undefined'?window:globalThis);
