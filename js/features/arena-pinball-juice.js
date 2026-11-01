/* Punchy pinball feedback, simulation-clock driven. All presentation except
 * optional SFX: no HP, cooldown, velocity, collision radii or energy writes.
 * Single collision -> a brief compression flash and radial speed marks.
 * While a ball travels quickly, a tiny streak follows its actual trajectory.
 */
(function(g){'use strict';
const TAU=Math.PI*2;
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
const past=new WeakMap(),audioAt=new WeakMap();
let frame=0,bursts=[],streaks=[];
function gentle(){
 return !!g.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ||
   !!g.document?.querySelector?.('.bf-preference input')?.checked;
}
function color(p){return p?.forge?.effectColor||p?.themeColor||p?.borderColor||'#a6d9f5';}
function feedback(p,x,y,nx,ny,force,kind){
 if(!p||!Number.isFinite(x)||!Number.isFinite(y)||!(force>1.5))return false;
 const last=audioAt.get(p)??-1000,heavy=force>=4.4;
 // Pair and edge contacts may overlap at the same frame: never pile sound
 // or several flashes on a single ball in the same few frames.
 if(frame-last<7)return false;
 audioAt.set(p,frame);
 const mass=cap(force/9,.28,1),colour=color(p);
 bursts.push({x,y,nx,ny,energy:mass,color:colour,kind,life:heavy?14:11,age:0});
 if(bursts.length>34)bursts.splice(0,bursts.length-34);
 if(!gentle()){
  // Use the existing low pitched, compressed collision bank; no new beeps.
  g.BattleFX?.sound?.(heavy?'heavy':'hit',cap(.38+mass*.47,.4,1));
 }
 return true;
}
function pair(a,b,nx,ny,approach,impulse){
 if(!Number.isFinite(approach)||approach> -1.5||!(impulse>0))return false;
 const x=(a.x+b.x)*.5,y=(a.y+b.y)*.5;
 const force=Math.min(10,-approach*.78+impulse*.17);
 const one=feedback(a,x,y,nx,ny,force,'pair');
 // Only one shared impact flash: both discs have same contact point.
 audioAt.set(b,frame);
 return one;
}
function wall(p,nx,ny,speed){
 if(!(speed>1.5))return false;
 const r=p.radius||22;
 return feedback(p,p.x-nx*r,p.y-ny*r,nx,ny,speed,'wall');
}
function tick(players){
 frame++;
 for(let i=bursts.length-1;i>=0;i--)if(++bursts[i].age>=bursts[i].life)bursts.splice(i,1);
 for(let i=streaks.length-1;i>=0;i--)if(++streaks[i].age>=streaks[i].life)streaks.splice(i,1);
 if(gentle())return;
 let generated=0;
 for(const p of players||[]){
  if(!p||p.hp<=0||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
  const former=past.get(p);past.set(p,{x:p.x,y:p.y});
  if(!former)continue;
  const dx=p.x-former.x,dy=p.y-former.y,length=Math.hypot(dx,dy);
  if(length<5||length>45||++generated>12)continue;
  // Strong shots read as actual travel instead of a static circle glow.
  streaks.push({x:p.x,y:p.y,dx,dy,width:cap((p.radius||22)*.19,3,9),
    colour:color(p),age:0,life:7});
  if(streaks.length>48)streaks.splice(0,streaks.length-48);
 }
}
function drawUnder(ctx){
 if(gentle()||!streaks.length)return;
 ctx.save();
 for(const s of streaks){
  const fade=1-s.age/s.life,m=Math.hypot(s.dx,s.dy),nx=-s.dy/m,ny=s.dx/m;
  ctx.save();ctx.globalAlpha=fade*.46;ctx.lineCap='round';
  for(let i=-1;i<=1;i++){
   const ox=nx*s.width*i,oy=ny*s.width*i;
   ctx.strokeStyle=i===0?'#ffffff':s.colour;
   ctx.lineWidth=i===0?Math.max(2,s.width*.65):Math.max(1,s.width*.38);
   ctx.beginPath();
   ctx.moveTo(s.x-s.dx*3+ox,s.y-s.dy*3+oy);
   ctx.lineTo(s.x-s.dx*.55+ox,s.y-s.dy*.55+oy);
   ctx.stroke();
  }
  ctx.restore();
 }
 ctx.restore();
}
function drawOver(ctx){
 if(!bursts.length)return;
 const muted=gentle();
 ctx.save();
 for(const b of bursts){
  const t=b.age/b.life,fade=1-t,reach=8+b.energy*(18+29*t);
  ctx.save();
  ctx.globalAlpha=(muted?.32:.83)*fade;
  ctx.lineWidth=cap(3.3*fade,1,3.3);
  ctx.strokeStyle=b.color;
  ctx.beginPath();ctx.ellipse(b.x,b.y,reach,reach*.62,
    Math.atan2(b.ny,b.nx),0,TAU);ctx.stroke();
  if(!muted){
   const tx=-b.ny,ty=b.nx;
   for(let i=-2;i<=2;i++){
    const side=i*(6+b.energy*8),forward=reach*(.7+i%2*.1);
    ctx.strokeStyle=i===0?'#ffffff':b.color;
    ctx.lineWidth=i===0?2.5:1.5;
    ctx.beginPath();
    ctx.moveTo(b.x+b.nx*(forward-7)+tx*side,
       b.y+b.ny*(forward-7)+ty*side);
    ctx.lineTo(b.x+b.nx*(forward+9)+tx*side,
       b.y+b.ny*(forward+9)+ty*side);ctx.stroke();
   }
  }
  ctx.restore();
 }
 ctx.restore();
}
function reset(){frame=0;bursts=[];streaks=[];}
g.ArenaPinballJuice=Object.freeze({pair,wall,tick,drawUnder,drawOver,reset,
 get burstCount(){return bursts.length;},get trailCount(){return streaks.length;}});
})(typeof window!=='undefined'?window:globalThis);
