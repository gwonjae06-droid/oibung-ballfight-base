/* Non-boss tower mechanics: real-moving physical events, with a warning clock
 * shared by drawing and damage. Never used in PvP or boss floors. */
(function(g){'use strict';
const TAU=Math.PI*2,cap=(x,a,b)=>Math.min(b,Math.max(a,x));
const col={time:'#eecb84',space:'#bbaaff',fire:'#ffaa70',storm:'#a3eaff',ice:'#ccfaff',forest:'#bef18b'};
const titles={time:'회전 초침',space:'이동 중력핵',fire:'흐르는 용암',storm:'천공 측풍',ice:'미끄러지는 빙벽',forest:'솟아나는 뿌리'};
function create({realm,level,width:w=500,height:h=500,hero,boss,damage}){
 let tick=0,cycle=0,active=null,last=-200;
 const cx=w/2,cy=h/2,u=Math.min(w,h)/500;
 function begin(){if(active)return false;active={realm,title:titles[realm],born:tick,
  fire:tick+132,end:tick+360,seed:cycle++*.9,kind:'terrain'};return true;}
 function age(){return active?tick-active.born:0;}
 function pos(a=age()){
  if(realm==='space')return {x:cx+Math.cos(a*.014)*84*u,y:cy+Math.sin(a*.009)*67*u,r:42*u};
  if(realm==='fire')return {x:w*(.18+cap((a-132)/195,0,1)*.63),y:h*(.35+Math.sin(a*.018)*.1),r:33*u};
  return {x:cx+Math.cos(active?.seed||0)*103*u,y:cy+Math.sin(active?.seed||0)*103*u,r:29*u};
 }
 function beam(a=age()){
  const angle=realm==='time'?a*.012:realm==='ice'?Math.PI/2:Math.PI*.2;
  const x=realm==='ice'?w*(.29+cap((a-132)/235,0,1)*.39):cx;
  const y=realm==='ice'?cy:cy;
  return {x1:x+Math.cos(angle)*45*u,y1:y+Math.sin(angle)*45*u,
   x2:x+Math.cos(angle)*195*u,y2:y+Math.sin(angle)*195*u,width:(realm==='ice'?28:19)*u};
 }
 function distLine(x,y,l){const dx=l.x2-l.x1,dy=l.y2-l.y1,
  t=cap(((x-l.x1)*dx+(y-l.y1)*dy)/(dx*dx+dy*dy||1),0,1);
  const px=l.x1+t*dx,py=l.y1+t*dy,d=Math.hypot(x-px,y-py);
  return {d,nx:d>.001?(x-px)/d:1,ny:d>.001?(y-py)/d:0};
 }
 function bounce(nx,ny,force){hero.vx=cap((hero.vx||0)+nx*force,-11,11);
  hero.vy=cap((hero.vy||0)+ny*force,-11,11);
  g.ArenaBallSquash?.wall?.(hero,nx,ny,force);
  g.BounceMomentum?.wall?.(hero,force);
 }
 function hurt(){if(tick-last<90)return;const z={kind:'terrain',realm,label:titles[realm]};
  if(damage?.(hero,8+level*2,z)===false)return;last=tick;}
 function step(){
  tick++;if(hero.hp<=0||boss.hp<=0){active=null;return;}
  if(!active){if(tick>=225&&(tick-225)%400===0)begin();return;}
  if(tick>=active.end){active=null;return;}
  if(tick<active.fire)return;
  const a=age();
  if(realm==='time'||realm==='ice'){
   const l=beam(a),q=distLine(hero.x,hero.y,l),limit=l.width*.5+(hero.radius||22);
   if(q.d<limit){
    hero.x=cap(hero.x+q.nx*(limit-q.d+.1),35,w-35);
    hero.y=cap(hero.y+q.ny*(limit-q.d+.1),35,h-35);
    bounce(q.nx,q.ny,2.5);hurt();
   }
  }else if(realm==='space'){
   const p=pos(a),dx=p.x-hero.x,dy=p.y-hero.y,d=Math.max(3,Math.hypot(dx,dy));
   if(d<185*u){const f=cap((185*u-d)/(185*u),0,1);
    hero.vx=cap((hero.vx||0)+dx/d*.26*f,-11,11);hero.vy=cap((hero.vy||0)+dy/d*.26*f,-11,11);}
   if(d<p.r+(hero.radius||22))hurt();
  }else if(realm==='fire'){
   const p=pos(a);if(Math.hypot(hero.x-p.x,hero.y-p.y)<p.r+(hero.radius||22))hurt();
  }else if(realm==='storm'){
   const wind=.19+Math.sin(a*.035)*.12;
   hero.vx=cap((hero.vx||0)+wind,-11,11);
   hero.vy=cap((hero.vy||0)-wind*.22,-11,11);
  }else if(realm==='forest'){
   const p=pos(a),r=p.r*cap((a-132)/88,0,1),
    dx=hero.x-p.x,dy=hero.y-p.y,d=Math.max(1,Math.hypot(dx,dy));
   if(d<r+(hero.radius||22)){bounce(dx/d,dy/d,.85);hurt();}
  }
 }
 function draw(ctx){
  if(!active)return;const a=age(),live=tick>=active.fire;
  ctx.save();ctx.strokeStyle=col[realm];ctx.globalAlpha=live?.85:.57;
  ctx.lineWidth=4*u;ctx.setLineDash(live?[]:[9*u,7*u]);
  if(realm==='time'||realm==='ice'){
   const l=beam(a);ctx.lineWidth=l.width;ctx.lineCap='round';
   ctx.beginPath();ctx.moveTo(l.x1,l.y1);ctx.lineTo(l.x2,l.y2);ctx.stroke();
  }else if(realm==='space'||realm==='fire'||realm==='forest'){
   const p=pos(a),r=realm==='forest'?p.r*cap((a-132)/88,0,1):p.r;
   ctx.beginPath();ctx.arc(p.x,p.y,Math.max(3,r),0,TAU);
   if(live){ctx.fillStyle=realm==='fire'?'#e96a3933':realm==='space'?'#9675da33':'#8ec57333';ctx.fill();}
   ctx.stroke();
  }else{
   for(let i=0;i<9;i++){const x=(i+1)*w/10,y=cy+Math.sin(a*.015+i*.6)*35*u;
    ctx.beginPath();ctx.moveTo(x-40*u,y+15*u);ctx.lineTo(x+40*u,y-15*u);ctx.stroke();}
  }
  ctx.setLineDash([]);ctx.globalAlpha=1;
  ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.lineWidth=3;
  ctx.strokeStyle='#101722';ctx.fillStyle='#fff';
  const label=titles[realm]+(live?' · 발동':' · '+Math.max(0,(active.fire-tick)/60).toFixed(1)+'초');
  ctx.strokeText(label,cx,42);ctx.fillText(label,cx,42);ctx.restore();
 }
 return {step,draw,begin,clear(){active=null;},get event(){return active;},get tick(){return tick;},
  get zones(){if(!active)return [];
   const a=age(),f=active.fire-tick,e=active.end-tick;
   if(realm==='time'||realm==='ice'){
    const l=beam(a),cx=(l.x1+l.x2)/2,cy=(l.y1+l.y2)/2;
    return [{shape:'line',x:cx,y:cy,angle:Math.atan2(l.y2-l.y1,l.x2-l.x1),
      length:Math.hypot(l.x2-l.x1,l.y2-l.y1),width:l.width,fire:f,end:e}];
   }
   if(realm==='space'||realm==='fire'||realm==='forest')return [{...pos(a),shape:'circle',fire:f,end:e}];
   return [];}};
}
g.ArenaTowerWorldMechanics=Object.freeze({create});
})(globalThis);
