/* Tower encounter engine. UI-free, deterministic geometry, damage adapter for PvE/raid reuse.
 * All attacks lock their coordinates at telegraph time. No unavoidable full-map damage. */
(function(g){
'use strict';
const NAMES={
 time:['시계 바늘 교차','역행의 고리','과거의 낙인','시간의 양분'],
 space:['공전 고리','중력 붕괴','유성 궤적','사건의 지평선'],
 fire:['용암 십자','불기둥 분화','쌍둥이 화구','지옥불 파동'],
 storm:['천둥 회랑','뇌광 교차','추적 낙뢰','뇌운 격자'],
 ice:['거울 빙정','절대영도 고리','빙창 회전','서리 봉인'],
 forest:['뿌리 포위','가시 장벽','세계수 고리','공생의 덩굴']
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
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
 let tick=0,serial=0,phase=1,nextBoss=100,nextTerrain=150,terrainTurn=0,bossTurn=0;
 const zones=[];const isBoss=level%5===0,cx=width/2,cy=height/2;
 const circle=(x,y,r)=>({shape:'circle',x,y,r});
 const line=(x,y,angle,thickness=48)=>({shape:'line',x,y,angle,width:thickness,length:Math.hypot(width,height)});
 const ring=(x,y,inner,r)=>({shape:'ring',x,y,inner,r});
 function add(shape,kind,label,delay=90,life=30){
  zones.push({...shape,id:++serial,kind,label,born:tick,fire:tick+delay,end:tick+delay+life,hits:new Set()});
 }
 function terrain(){
  const turn=terrainTurn++%3,x=clamp(hero.x,90,width-90),y=clamp(hero.y,90,height-90);
  const label=({time:['시간 균열','초침의 띠','되감기 지대'],space:['중력 우물','궤도 왜곡','유성 흔적'],fire:['용암 분출','화염 균열','잔불 지대'],storm:['돌풍 통로','뇌우 전선','측풍 통로'],ice:['서리 결정','냉기 회랑','빙판 균열'],forest:['가시 덩굴','뿌리 장벽','포자 둥지']})[realm]||['차원 균열','차원 틈','차원 폭발'];
  let shape;
  if(turn===0)shape=realm==='storm'?line(cx,y,0,60):circle(x,y,realm==='space'?85:65);
  else if(turn===1)shape=realm==='time'||realm==='space'?ring(cx,cy,85,145):
   realm==='storm'||realm==='forest'?line(cx,cy,Math.PI/2,58):
   realm==='fire'?line(x,cy,Math.PI/2,55):circle(width-x,height-y,78);
  else shape=realm==='space'?circle(width-x,height-y,94):
   realm==='time'?circle(width-x,height-y,78):
   realm==='storm'?line(cx,cy,Math.PI/4,53):
   realm==='ice'?line(cx,y,0,58):
   realm==='forest'?circle(width-x,height-y,76):ring(cx,cy,105,172);
  add(shape,'terrain',label[turn],turn===0?96:90,turn===0?120:96);
 }
 function pattern(){
  const turn=bossTurn++%4,strong=level===10,rapid=phase===2;
  const delay=rapid?78:96;
  const x=clamp(hero.x,65,width-65),y=clamp(hero.y,65,height-65);
  const extra=strong||rapid;
  switch(realm){
   case 'time':
    if(turn===0){const a=(bossTurn%8)*Math.PI/8;add(line(cx,cy,a,50),'boss','시계 바늘 교차',delay);
      if(extra)add(line(cx,cy,a+Math.PI/2,48),'boss','역행 바늘',delay+58);}
    if(turn===1){add(ring(cx,cy,103,175),'boss','역행의 고리',delay);}
    if(turn===2){add(circle(x,y,74),'boss','과거의 낙인',delay);
      if(extra)add(circle(width-x,height-y,68),'boss','미래의 낙인',delay+62);}
    if(turn===3){add(line(cx,height*.27,0,58),'boss','시간의 양분',delay);
      add(line(cx,height*.73,0,58),'boss','시간의 반향',delay+62);}
    break;
   case 'space':
    if(turn===0){add(ring(cx,cy,100,171),'boss','공전 고리',delay);
      if(extra)add(circle(cx,cy,85),'boss','중심 붕괴',delay+66);}
    if(turn===1){add(circle(x,y,83),'boss','중력 붕괴',delay);
      if(extra)add(circle(width-x,height-y,76),'boss','역중력 폭발',delay+62);}
    if(turn===2){add(line(cx,cy,Math.PI/4,50),'boss','유성 궤적',delay);
      if(extra)add(line(cx,cy,-Math.PI/4,50),'boss','교차 궤도',delay+64);}
    if(turn===3){add(ring(cx,cy,55,127),'boss','사건의 지평선',delay);
      if(extra)add(ring(cx,cy,162,214),'boss','외곽 궤도',delay+68);}
    break;
   case 'fire':
    if(turn===0){add(line(x,cy,Math.PI/2,53),'boss','화염 기둥',delay);
      add(line(cx,y,0,53),'boss','용암 십자',delay+55);}
    if(turn===1){add(circle(x,y,84),'boss','불기둥 분화',delay);
      if(extra)add(ring(cx,cy,113,181),'boss','확산 열기',delay+70);}
    if(turn===2){add(line(width*.27,cy,Math.PI/2,57),'boss','쌍둥이 화구',delay);
      add(line(width*.73,cy,Math.PI/2,57),'boss','쌍둥이 화구',delay+60);}
    if(turn===3){add(ring(cx,cy,85,160),'boss','지옥불 파동',delay);
      if(extra)add(circle(x,y,75),'boss','잔불 폭발',delay+72);}
    break;
   case 'storm':
    if(turn===0){add(line(cx,height*.25,0,50),'boss','천둥 회랑',delay);
      add(line(cx,height*.75,0,50),'boss','연쇄 천둥',delay+60);}
    if(turn===1){add(line(cx,cy,Math.PI/4,50),'boss','뇌광 교차',delay);
      if(extra)add(line(cx,cy,-Math.PI/4,50),'boss','반전 뇌광',delay+64);}
    if(turn===2){add(circle(x,y,75),'boss','추적 낙뢰',delay);
      if(extra)add(circle(width-x,height-y,75),'boss','분열 낙뢰',delay+62);}
    if(turn===3){for(let i=0;i<3;i++)add(line(width*(.2+i*.3),cy,Math.PI/2,46),'boss','뇌운 격자',delay+i*56);}
    break;
   case 'ice':
    if(turn===0){add(circle(x,y,80),'boss','거울 빙정',delay);
      if(extra)add(circle(width-x,height-y,78),'boss','반사 빙정',delay+64);}
    if(turn===1){add(ring(cx,cy,145,210),'boss','절대영도 고리',delay);}
    if(turn===2){add(line(cx,cy,-Math.PI/4,58),'boss','빙창 회전',delay);
      if(extra)add(line(cx,cy,Math.PI/4,58),'boss','쌍극 빙창',delay+64);}
    if(turn===3){add(circle(width*.27,cy,83),'boss','서리 봉인',delay);
      add(circle(width*.73,cy,83),'boss','빙하 구속',delay+64);}
    break;
   case 'forest':
    if(turn===0){for(let i=0;i<3;i++){const a=i*Math.PI*2/3+bossTurn*.15;
      add(circle(cx+Math.cos(a)*125,cy+Math.sin(a)*125,64),'boss','뿌리 포위',delay+i*50);}}
    if(turn===1){add(line(cx,y,0,55),'boss','가시 장벽',delay);
      if(extra)add(line(x,cy,Math.PI/2,55),'boss','교차 덩굴',delay+64);}
    if(turn===2){add(ring(cx,cy,109,183),'boss','세계수 고리',delay);
      if(extra)add(circle(x,y,69),'boss','근원 폭발',delay+68);}
    if(turn===3){add(circle(x,y,70),'boss','공생의 덩굴',delay);
      add(circle(width-x,height-y,70),'boss','가시의 분열',delay+66);}
    break;
  }
 }
 function step(){
  if(hero.hp<=0||boss.hp<=0)return;
  tick++;
  if(isBoss&&phase===1&&boss.hp<=boss.maxHp*.5){phase=2;nextBoss=Math.max(tick+90,nextBoss);}
  // No extra terrain on boss floors; every pattern has safe geometry.
  if(!isBoss&&tick>=nextTerrain){terrain();nextTerrain=tick+Math.max(205,300-level*9);}
  if(isBoss&&tick>=nextBoss){pattern();nextBoss=tick+(phase===2?255:315);}
  for(const z of zones){
   if(tick<z.fire||tick>=z.end)continue;
   for(const p of z.kind==='boss'?[hero]:[hero,boss]){
    if(p.hp<=0||!contains(z,p))continue;
    if(z.kind==='terrain'&&['ice','forest'].includes(realm)){
      p.slowTimer=Math.max(p.slowTimer||0,18);p.slowMultiplier=realm==='ice'?.65:.82;
    }
    if(z.kind==='terrain'&&realm==='time'&&tick%2===0&&p.forgeTicks)
      p.forgeTicks=p.forgeTicks.map(t=>Math.max(0,t-1));
    if(z.kind==='terrain'&&realm==='space'){
      const d=Math.max(1,Math.hypot(z.x-p.x,z.y-p.y));p.x=clamp(p.x+(z.x-p.x)/d*1.05,p.radius||0,width-(p.radius||0));p.y=clamp(p.y+(z.y-p.y)/d*1.05,p.radius||0,height-(p.radius||0));
    }
    if(z.kind==='terrain'&&realm==='storm')p.x=clamp(p.x+1.5,p.radius||0,width-(p.radius||0));
    if(!z.hits.has(p)){
      const amount=z.kind==='boss'?24+level*3+(phase===2?6:0):(realm==='fire'?18:12)+level*2;
      if(damage(p,amount,z)!==false)z.hits.add(p);
    }
   }
  }
  for(let i=zones.length-1;i>=0;i--)if(tick>=zones[i].end)zones.splice(i,1);
 }
 function draw(ctx,color='#f5ce78'){
  ctx.save();
  for(const z of zones){
   const live=tick>=z.fire,warning=Math.max(0,z.fire-tick);
   ctx.save();ctx.translate(z.x,z.y);if(z.shape==='line')ctx.rotate(z.angle);
   ctx.beginPath();
   if(z.shape==='line')ctx.rect(-z.length/2,-z.width/2,z.length,z.width);
   else{ctx.arc(0,0,z.r,0,Math.PI*2);if(z.shape==='ring')ctx.arc(0,0,z.inner,0,Math.PI*2,true);}
   ctx.fillStyle=live?(z.kind==='boss'?'#fa453c66':'#ff855477'):color+(warning<35?'55':'25');
   ctx.fill();
   ctx.strokeStyle=live?'#ffede6':color;ctx.lineWidth=live?4:warning<35?3:2;
   ctx.setLineDash(live?[]:[7,5]);ctx.stroke();ctx.setLineDash([]);
   ctx.restore();
   g.ArenaTowerPattern3D?.draw?.(ctx,z,realm,tick,width,height);
   const y=clamp(z.y,24,height-18),x=clamp(z.x,90,width-90);
   ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#101520';ctx.fillStyle='#ffffff';
   const label=live?'위험!':z.label+' '+(warning/60).toFixed(1)+'s';
   ctx.strokeText(label,x,y);ctx.fillText(label,x,y);
  }
  if(isBoss){ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.fillText('PHASE '+phase+' · '+(phase===2?'격화':'탐색'),width/2,24);}
  ctx.restore();
 }
 return {step,draw,get zones(){return zones;},get tick(){return tick;},get phase(){return phase;},isBoss,
    get attackIndex(){return bossTurn;}};
}
g.ArenaEncounter={create,contains,patternNames:id=>[...(NAMES[id]||NAMES.time)]};
})(globalThis);
