/* Reusable encounter simulation: explicit actors, world size and damage adapter.
 * No tower UI, globals, timers or storage in create(). Tick at 60 Hz.
 * Hazard geometry is locked when announced; no tracking invisible hitboxes. */
(function(g){
'use strict';
function contains(z,p){
 const r=p.radius||0,dx=p.x-z.x,dy=p.y-z.y;
 if(z.shape==='ring'){const d=Math.hypot(dx,dy);return d+r>=z.inner&&d-r<=z.r;}
 if(z.shape==='line'){
  const c=Math.cos(z.angle),s=Math.sin(z.angle);
  return Math.abs(dx*c+dy*s)<=z.length/2+r&&Math.abs(-dx*s+dy*c)<=z.width/2+r;
 }
 return Math.hypot(dx,dy)<=z.r+r;
}
function create({realm,level,width=500,height=500,hero,boss,damage}){
 let tick=0,serial=0,phase=1,nextBoss=100,nextTerrain=150;
 const zones=[];const isBoss=level%5===0;
 const circle=(x,y,r)=>({shape:'circle',x,y,r});
 const line=(x,y,angle,thickness=48)=>({shape:'line',x,y,angle,width:thickness,length:Math.hypot(width,height)});
 const ring=(x,y,inner,r)=>({shape:'ring',x,y,inner,r});
 function add(shape,kind,label,delay=90,life=30){
  zones.push({...shape,id:++serial,kind,label,born:tick,fire:tick+delay,end:tick+delay+life,hits:new Set()});
 }
 function terrain(){
  const x=Math.max(90,Math.min(width-90,hero.x)),y=Math.max(90,Math.min(height-90,hero.y));
  const shape=realm==='storm'?line(width/2,y,0,60):circle(x,y,realm==='space'?85:65);
  add(shape,'terrain',({time:'시간 균열',space:'중력 우물',fire:'용암 분출',storm:'돌풍 →',ice:'서리 결정',forest:'가시 덩굴'})[realm],96,120);
 }
 function pattern(){
  const x=hero.x,y=hero.y,cx=width/2,cy=height/2;
  const strong=level===10,delay=phase===2?78:96;
  switch(realm){
   case 'time':{
    const a=(Math.floor(tick/200)%4)*Math.PI/4;
    add(line(cx,cy,a),'boss','시계 바늘',delay);
    if(strong||phase===2)add(line(cx,cy,a+Math.PI/2),'boss','역행 바늘',delay+48);
    break;
   }
   case 'space':
    add(ring(cx,cy,105,172),'boss','공전 고리 · 안/밖으로',delay);
    if(strong||phase===2)add(circle(cx,cy,90),'boss','중심 붕괴 · 바깥으로',delay+72);
    break;
   case 'fire':
    add(line(x,cy,Math.PI/2,54),'boss','화염 기둥',delay);
    add(line(cx,y,0,54),'boss','용암 십자',delay+36);
    if(strong||phase===2)add(circle(x,y,80),'boss','잔불 폭발',delay+90);
    break;
   case 'storm':
    for(let i=0;i<(strong||phase===2?3:2);i++)add(line(cx,90+i*150,0,45),'boss','낙뢰 통로',delay+i*30);
    break;
   case 'ice':
    add(circle(x,y,80),'boss','빙정 봉쇄',delay);
    if(strong||phase===2){add(circle(width-x,height-y,80),'boss','거울 결정',delay+36);add(ring(cx,cy,155,210),'boss','서리 장벽',delay+72);}
    break;
   case 'forest':
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3+serial*.2;add(circle(cx+Math.cos(a)*130,cy+Math.sin(a)*130,65),'boss','뿌리 포위',delay+i*24);}
    if(strong||phase===2)add(circle(x,y,60),'boss','가시 추적 · 위치 고정',delay+90);
    break;
  }
 }
 function step(){
  if(hero.hp<=0||boss.hp<=0)return;
  tick++;
  if(isBoss&&phase===1&&boss.hp<=boss.maxHp*.5){phase=2;nextBoss=Math.max(tick+90,nextBoss);}
  // Boss floors use patterns only; no additional terrain to hide safe lanes.
  if(!isBoss&&tick>=nextTerrain){terrain();nextTerrain=tick+300;}
  if(isBoss&&tick>=nextBoss){pattern();nextBoss=tick+(phase===2?270:330);}
  for(const z of zones){
   if(tick<z.fire||tick>=z.end)continue;
   for(const p of z.kind==='boss'?[hero]:[hero,boss]){
    if(p.hp<=0||!contains(z,p))continue;
    if(z.kind==='terrain'&&['ice','forest'].includes(realm)){p.slowTimer=Math.max(p.slowTimer||0,18);p.slowMultiplier=realm==='ice'?.65:.82;}
    if(z.kind==='terrain'&&realm==='time'&&tick%2===0&&p.forgeTicks)p.forgeTicks=p.forgeTicks.map(t=>Math.max(0,t-1));
    if(z.kind==='terrain'&&realm==='space'){
     const d=Math.max(1,Math.hypot(z.x-p.x,z.y-p.y));p.x+=(z.x-p.x)/d*.8;p.y+=(z.y-p.y)/d*.8;
    }
    if(z.kind==='terrain'&&realm==='storm')p.x=Math.min(width-p.radius,p.x+1.1);
    if(!z.hits.has(p)){
     // Dash immunity and ordinary shields use the shared hit adapter.
     const amount=z.kind==='boss'?20+level*2:(realm==='fire'?16:10)+level;
     if(damage(p,amount,z)!==false)z.hits.add(p);
    }
   }
  }
  for(let i=zones.length-1;i>=0;i--)if(tick>=zones[i].end)zones.splice(i,1);
 }
 function draw(ctx,color='#f5ce78'){
  ctx.save();
  for(const z of zones){
   const live=tick>=z.fire;
   ctx.save();ctx.translate(z.x,z.y);if(z.shape==='line')ctx.rotate(z.angle);
   ctx.beginPath();
   if(z.shape==='line')ctx.rect(-z.length/2,-z.width/2,z.length,z.width);
   else{ctx.arc(0,0,z.r,0,Math.PI*2);if(z.shape==='ring')ctx.arc(0,0,z.inner,0,Math.PI*2,true);}
   ctx.fillStyle=live?'#ff645477':color+'30';ctx.fill();
   ctx.strokeStyle=live?'#ffede6':color;ctx.lineWidth=live?4:2;
   ctx.setLineDash(live?[]:[7,5]);ctx.stroke();ctx.setLineDash([]);
   ctx.restore();
   const y=Math.max(24,Math.min(height-18,z.y));
   ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#101520';ctx.fillStyle='#ffffff';
   const label=live?'위험!':z.label+' '+((z.fire-tick)/60).toFixed(1)+'s';
   ctx.strokeText(label,Math.max(90,Math.min(width-90,z.x)),y);ctx.fillText(label,Math.max(90,Math.min(width-90,z.x)),y);
  }
  if(isBoss){ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.fillText('PHASE '+phase+' · '+(phase===2?'격화':'탐색'),width/2,24);}
  ctx.restore();
 }
 return {step,draw,get zones(){return zones;},get tick(){return tick;},get phase(){return phase;},isBoss};
}
g.ArenaEncounter={create,contains};
})(globalThis);
