/* OIBUNG 2.5D world presentation.
 * Ground x,y and physics z remain unchanged. This module ONLY paints depth;
 * it never moves a fighter or alters damage/skill hitboxes.
 * Cached static floor keeps multi-fighter battles inexpensive on mobile.
 */
(function(global){
'use strict';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const cached=new Map(), MAX_CACHE=4;
// A clearly angled but still readable top-down view (~42° off overhead). Keep this a single
// constant: ground, shadows, fighters, projectiles and PvP effects share it.
const VIEW_Y=0.74;
function screenPoint(x,y,canvas){
 const h=Number(canvas?.height)||500;
 return {x,y:(1-VIEW_Y)*h*.5+VIEW_Y*y};
}
function applyView(ctx,canvas){
 const h=Number(canvas?.height)||500;
 ctx.translate(0,h*(1-VIEW_Y)*.5);
 ctx.scale(1,VIEW_Y);
}
function spriteScale(p,canvas){
 const h=Math.max(1,Number(canvas?.height)||500);
 // The nearer row appears only slightly larger; silhouettes stay legible.
 return clamp(1+(Number(p?.y||0)/h-.5)*.105,.948,1.052);
}
function paintBackdrop(ctx,canvas,tower=false){
 const w=Number(canvas?.width)||500,h=Number(canvas?.height)||500;
 const band=h*(1-VIEW_Y)*.5;
 ctx.save();
 // The far boundary and the visible front thickness explain the angle
 // without introducing a large horizon or obscuring active combat.
 const back=ctx.createLinearGradient(0,0,0,band+2);
 if(tower){back.addColorStop(0,'#0d1825');back.addColorStop(1,'#314052');}
 else{back.addColorStop(0,'#a7b7c3');back.addColorStop(1,'#d3e0e7');}
 ctx.fillStyle=back;ctx.fillRect(0,0,w,band+2);
 const apron=ctx.createLinearGradient(0,h-band-2,0,h);
 if(tower){apron.addColorStop(0,'#4d5967');apron.addColorStop(.18,'#273444');apron.addColorStop(1,'#17212d');}
 else{apron.addColorStop(0,'#c4d5df');apron.addColorStop(.18,'#8a9eac');apron.addColorStop(1,'#607888');}
 ctx.fillStyle=apron;ctx.fillRect(0,h-band-2,w,band+2);
 ctx.restore();
}
function line(c,x,y,xx,yy,color,width=1){
 c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function floorImage(ctx,w,h,scene){
 ctx.save();
 const unit=clamp(Math.min(w,h)/9,40,83);
 if(!scene){
   // Pearl stone tiles, seen from a slightly elevated top-down camera.
   const fill=ctx.createLinearGradient(0,0,w*.45,h);
   fill.addColorStop(0,'#e7eef2');fill.addColorStop(.55,'#d4e0e6');
   fill.addColorStop(1,'#bfccd5');ctx.fillStyle=fill;ctx.fillRect(0,0,w,h);
   for(let y=8,yi=0;y<h;y+=unit,yi++){
     for(let x=8,xi=0;x<w;x+=unit,xi++){
       const inset=2;
       ctx.fillStyle=(xi+yi)%3===0?'rgba(255,255,255,.19)':
         (xi+yi)%2===0?'rgba(51,70,84,.045)':'rgba(255,255,255,.10)';
       ctx.fillRect(x+inset,y+inset,unit-4,unit-4);
       line(ctx,x+3,y+3,x+unit-4,y+3,'rgba(255,255,255,.32)',1);
       line(ctx,x+unit-3,y+3,x+unit-3,y+unit-4,'rgba(56,79,94,.085)',1.2);
     }
   }
   // A small directional light pool is visual shading, not a hazard.
   const halo=ctx.createRadialGradient(w*.28,h*.20,18,w*.46,h*.44,Math.max(w,h)*.79);
   halo.addColorStop(0,'rgba(255,255,255,.31)');
   halo.addColorStop(1,'rgba(55,71,89,0)');
   ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
 }
 // Raised floor lip and corner occlusion; never covers the playable middle.
 const edge=clamp(Math.min(w,h)*.026,10,21),rim=ctx.createLinearGradient(0,0,0,edge);
 rim.addColorStop(0,scene?'rgba(255,255,255,.20)':'rgba(255,255,255,.88)');
 rim.addColorStop(1,scene?'rgba(0,0,0,.11)':'rgba(79,103,117,.21)');
 ctx.fillStyle=rim;ctx.fillRect(0,0,w,edge);
 ctx.fillStyle=scene?'rgba(6,11,22,.18)':'rgba(51,75,90,.22)';
 ctx.fillRect(0,h-edge,w,edge);
 ctx.fillRect(w-edge,0,edge,h);
 ctx.fillStyle=scene?'rgba(255,255,255,.08)':'rgba(255,255,255,.26)';
 ctx.fillRect(0,0,edge,h);
 line(ctx,edge,edge,w-edge,edge,scene?'rgba(255,255,255,.25)':'rgba(255,255,255,.75)',2);
 line(ctx,edge,edge,edge,h-edge,scene?'rgba(255,255,255,.13)':'rgba(255,255,255,.65)',1.5);
 line(ctx,edge,h-edge,w-edge,h-edge,scene?'rgba(0,0,0,.40)':'rgba(59,85,99,.32)',3);
 line(ctx,w-edge,edge,w-edge,h-edge,scene?'rgba(0,0,0,.32)':'rgba(59,85,99,.28)',3);
 // Restrained anchor details make the arena feel constructed, not flat.
 for(const x of [edge+13,w-edge-13])for(const y of [edge+13,h-edge-13]){
   ctx.beginPath();ctx.ellipse(x,y,3.2,2.5,0,0,Math.PI*2);
   ctx.fillStyle=scene?'rgba(235,239,250,.35)':'rgba(67,87,100,.27)';ctx.fill();
   line(ctx,x-1.4,y,x+1.4,y,scene?'rgba(23,28,40,.8)':'rgba(43,65,80,.55)',.8);
 }
 ctx.restore();
}
function paintFloor(ctx,canvas,scenePainted=false){
 if(!ctx||!canvas)return;
 const w=Number(canvas.width),h=Number(canvas.height);
 if(!(w>0&&h>0))return;
 const key=w+'x'+h+':'+(scenePainted?1:0);
 let image=cached.get(key);
 if(!image&&global.document?.createElement){
   try{
     const off=global.document.createElement('canvas');
     off.width=w;off.height=h;
     const c=off.getContext?.('2d');
     if(c){floorImage(c,w,h,!!scenePainted);image=off;
       if(cached.size>=MAX_CACHE)cached.clear();
       cached.set(key,image);
     }
   }catch(_){}
 }
 if(image&&typeof ctx.drawImage==='function')ctx.drawImage(image,0,0,w,h);
 else floorImage(ctx,w,h,!!scenePainted);
}
function shadow(ctx,p,z){
 if(!ctx||!p||p.hp<=0)return;
 const x=Number(p.x),y=Number(p.y),r=Number(p.radius)||27;
 if(!Number.isFinite(x)||!Number.isFinite(y))return;
 const height=Math.max(0,Number(z)||0),depth=Math.min(170,height);
 const spread=1+depth*.0035,alpha=clamp(.31-depth*.0011,.10,.31);
 ctx.save();
 // The shadow is rooted at the physics footprint, not under the drawn body.
 ctx.fillStyle='rgba(15,24,35,'+(alpha*.38).toFixed(3)+')';
 ctx.beginPath();ctx.ellipse(x+6+depth*.055,y+8+depth*.018,r*1.24*spread,r*.51*spread,-.12,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='rgba(17,27,36,'+alpha.toFixed(3)+')';
 ctx.beginPath();ctx.ellipse(x+3+depth*.04,y+5,r*.88*spread,r*.31*spread,-.12,0,Math.PI*2);ctx.fill();
 if(height>19){
   // A short, subtle altitude stem clarifies the x/y ground location.
   const sy=y-height+r*.52;
   if(sy<y-6){
     ctx.strokeStyle='rgba(45,62,78,.25)';ctx.lineWidth=1.4;
     ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(x,sy);ctx.lineTo(x+3+depth*.04,y+5);
     ctx.stroke();ctx.setLineDash([]);
   }
 }
 ctx.restore();
}
function underlay(ctx,p,r){
 if(!ctx||!p||p.hp<=0)return;
 ctx.save();ctx.beginPath();ctx.arc(0,4.4,r,0,Math.PI*2);
 ctx.fillStyle='rgba(12,24,36,.57)';ctx.fill();
 ctx.strokeStyle='rgba(244,250,255,.30)';ctx.lineWidth=1.3;
 ctx.beginPath();ctx.arc(0,0,r+1,-2.65,-.48);ctx.stroke();
 ctx.restore();
}
function lightSurface(ctx,r){
 // Semi-transparent directional relief works for both photos and builtins.
 ctx.save();
 const shade=ctx.createLinearGradient(-r,-r,r*.58,r);
 shade.addColorStop(0,'rgba(255,255,255,.23)');
 shade.addColorStop(.43,'rgba(255,255,255,.025)');
 shade.addColorStop(1,'rgba(14,25,37,.20)');
 ctx.fillStyle=shade;ctx.fillRect(-r,-r,r*2,r*2);
 ctx.restore();
}
global.ArenaDepth=Object.freeze({VIEW_Y,screenPoint,applyView,spriteScale,
  paintBackdrop,paintFloor,shadow,underlay,lightSurface});
})(typeof window!=='undefined'?window:globalThis);
