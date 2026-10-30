/* OIBUNG 2.5D world presentation.
 * Ground x,y and physics z remain unchanged. This module ONLY paints depth;
 * it never moves a fighter or alters damage/skill hitboxes.
 * Cached static floor keeps multi-fighter battles inexpensive on mobile.
 */
(function(global){
'use strict';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const cached=new Map(), MAX_CACHE=4;
// TRUE pinhole-like ground-plane mapping, not a flattened canvas.
// Ground coordinates remain in gameplay space; only pixels are projected.
// y=0 is far away, y=canvas.height is near the viewer.
const VIEW_Y=1;
const FAR_SCALE=.68,NEAR_SCALE=1.16;
const FAR_EDGE=.115,NEAR_EDGE=.855;
const POINT_STEPS=8;
const layers=new Map();
const projectT=t=>Math.pow(clamp(t,0,1),1.18);
const scaleAt=t=>FAR_SCALE+(NEAR_SCALE-FAR_SCALE)*projectT(t);
function screenPoint(x,y,canvas){
 const w=Math.max(1,Number(canvas?.width)||500),h=Math.max(1,Number(canvas?.height)||500);
 const t=clamp(Number(y)/h||0,0,1),p=projectT(t);
 return {x:w*.5+(Number(x)-w*.5)*scaleAt(t),
   y:h*(FAR_EDGE+(NEAR_EDGE-FAR_EDGE)*p)};
}
function spriteScale(p,canvas){
 const h=Math.max(1,Number(canvas?.height)||500);
 return scaleAt(clamp((Number(p?.y)||0)/h,0,1));
}
function elevatedPoint(p,z,canvas){
 const at=screenPoint(p.x,p.y,canvas);
 return {x:at.x,y:at.y-(Number(z)||0)*spriteScale(p,canvas)};
}
function applyView(ctx,canvas){
 // The whole canvas must NOT be crushed along y. Each ground row instead
 // receives its own x-width and screen y through projectWorld().
}
function layer(canvas,kind='world'){
 const w=Number(canvas?.width),h=Number(canvas?.height);
 if(!(w>0&&h>0)||!global.document?.createElement)return null;
 const key=kind+':'+w+':'+h;
 let cached=layers.get(key);
 if(!cached){
   try{
     const surface=global.document.createElement('canvas');
     surface.width=w;surface.height=h;
     const painter=surface.getContext?.('2d');
     if(!painter)return null;
     cached={canvas:surface,ctx:painter};
     if(layers.size>=5)layers.clear();
     layers.set(key,cached);
   }catch(_){return null;}
 }
 return cached;
}
function projectWorld(ctx,source,canvas){
 if(!ctx||!source||!canvas||typeof ctx.drawImage!=='function')return false;
 const w=Number(canvas.width),h=Number(canvas.height);
 if(!(w>0&&h>0))return false;
 ctx.save();
 // Horizontal strips approximate a projective surface with consistent
 // x vanishing point and nonlinear depth. No new game physics.
 for(let y=0;y<h;y+=POINT_STEPS){
   const next=Math.min(h,y+POINT_STEPS),a=screenPoint(0,y,canvas),
     b=screenPoint(w,y,canvas),c=screenPoint(0,next,canvas),
     d=screenPoint(w,next,canvas);
   const destY=a.y,destH=Math.max(.001,c.y-a.y);
   // Small overlaps remove antialias seams at high DPR while retaining
   // the actual projected footprint.
   const x=(a.x+c.x)*.5,width=(b.x+d.x-a.x-c.x)*.5;
   ctx.drawImage(source,0,y,w,next-y,x,destY,width,destH+.45);
 }
 ctx.restore();return true;
}
function paintBackdrop(ctx,canvas,tower=false){
 const w=Number(canvas?.width)||500,h=Number(canvas?.height)||500;
 const rear=h*FAR_EDGE,front=h*NEAR_EDGE;
 const backLeft=screenPoint(0,0,canvas).x,backRight=screenPoint(w,0,canvas).x;
 const frontLeft=screenPoint(0,h,canvas).x,frontRight=screenPoint(w,h,canvas).x;
 ctx.save();
 const wall=ctx.createLinearGradient(0,0,0,rear);
 if(tower){wall.addColorStop(0,'#111c2b');wall.addColorStop(1,'#3c4a5d');}
 else{wall.addColorStop(0,'#96a9b9');wall.addColorStop(1,'#dce7ec');}
 ctx.fillStyle=wall;ctx.fillRect(0,0,w,h);
 // Rear wall, trapezoid side surfaces and a solid front slab.
 const left=ctx.createLinearGradient(0,rear,0,front);
 left.addColorStop(0,tower?'#1c293a':'#9fb2be');
 left.addColorStop(1,tower?'#263547':'#b7c8d2');
 ctx.fillStyle=left;
 ctx.beginPath();ctx.moveTo(0,rear-12);ctx.lineTo(backLeft,rear);
 ctx.lineTo(frontLeft,front);ctx.lineTo(0,front+16);ctx.closePath();ctx.fill();
 ctx.beginPath();ctx.moveTo(w,rear-12);ctx.lineTo(backRight,rear);
 ctx.lineTo(frontRight,front);ctx.lineTo(w,front+16);ctx.closePath();ctx.fill();
 const slab=ctx.createLinearGradient(0,front,0,h);
 slab.addColorStop(0,tower?'#617088':'#9cb3c2');
 slab.addColorStop(.12,tower?'#29384d':'#778fa0');
 slab.addColorStop(1,tower?'#101c2c':'#4e687b');
 ctx.fillStyle=slab;ctx.fillRect(0,front,w,h-front);
 ctx.fillStyle=tower?'rgba(5,12,23,.27)':'rgba(30,53,68,.16)';
 ctx.fillRect(0,front+5,w,6);
 ctx.strokeStyle=tower?'rgba(218,228,246,.35)':'rgba(241,250,254,.66)';
 ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(backLeft,rear);ctx.lineTo(backRight,rear);
 ctx.moveTo(frontLeft,front);ctx.lineTo(frontRight,front);ctx.stroke();
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
global.ArenaDepth=Object.freeze({VIEW_Y,screenPoint,elevatedPoint,applyView,spriteScale,
  layer,projectWorld,paintBackdrop,paintFloor,shadow,underlay,lightSurface});
})(typeof window!=='undefined'?window:globalThis);
