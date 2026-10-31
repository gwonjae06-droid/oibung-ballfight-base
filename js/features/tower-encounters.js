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
// 5F guardian and 10F overlord share exactly ONE signature move per realm.
// Other realms share no boss attack names. Each 10F move is a multi-stage
// locked telegraph, not a cosmetic reskin of one circle or straight line.
const ULTIMATES={
 time:['영겁의 초침 폭주','인과 역류','멈춘 12시','시공 모래시계','시계 바늘 교차'],
 space:['행성 궤도 전쟁','쌍극 특이점','혜성 군락','차원 붕괴','공전 고리'],
 fire:['화산 칼데라 붕괴','종말의 용암해','태양 분화 연쇄','재앙의 화염 벽','용암 십자'],
 storm:['뇌신의 7연격','초대형 번개 전선','폭풍의 눈 개방','천공 격자 붕괴','천둥 회랑'],
 ice:['빙하 대륙 분열','영구동토 격벽','극점 결정 포위','천년 빙창 폭풍','거울 빙정'],
 forest:['세계수 뿌리 폭주','식충림 만개','맹독 포자 군락','생명의 수확','뿌리 포위']
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
function create({realm,level,width=500,height=500,hero,boss,damage,environmentManaged=false}){
 let tick=0,serial=0,phase=1,nextBoss=100,nextTerrain=150,terrainTurn=0,bossTurn=0;
 // Only dodged, completed boss telegraphs grant a temporary damage window.
 const baseDefense=Number.isFinite(boss?.towerDefense)?boss.towerDefense:1;
 let exposure=0,nextExpose=0,avoided=0;
 const spectacle=g.ArenaTowerSpectacle?.create({realm,level,width,height,hero,boss,damage});
 const zones=[];const isBoss=level%5===0,cx=width/2,cy=height/2;
 const MAX_ZONES=30;
 const circle=(x,y,r)=>({shape:'circle',x,y,r});
 const line=(x,y,angle,thickness=48)=>({shape:'line',x,y,angle,width:thickness,length:Math.hypot(width,height)});
 const ring=(x,y,inner,r)=>({shape:'ring',x,y,inner,r});
 function add(shape,kind,label,delay=90,life=30){
  zones.push({...shape,id:++serial,kind,label,born:tick,fire:tick+delay,end:tick+delay+life,
    signature:kind==='boss'&&((level===10&&ULTIMATES[realm]?.includes(label))||(level===5&&NAMES[realm]?.includes(label))),hits:new Set()});
  if(zones.length>MAX_ZONES)zones.splice(0,zones.length-MAX_ZONES);
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
  const turn=bossTurn++%(level===10?5:4),strong=level===10,rapid=phase===2;
  const cadence={time:[82,94],space:[87,104],fire:[72,82],storm:[80,92],ice:[112,126],forest:[76,90]}[realm]||[78,96];
  const delay=rapid?cadence[0]:cadence[1];
  const x=clamp(hero.x,65,width-65),y=clamp(hero.y,65,height-65);
  const extra=strong||rapid;
  if(strong){
   ultimate(turn,delay,x,y,rapid);
   return;
  }
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
  // Even a 5F guardian is a terrifying multi-stage encounter rather than
  // a single colored circle. These echoes reuse that guardian's OWN pattern
  // names, so the 5F/10F and cross-realm overlap limit still holds.
  const name=NAMES[realm][turn];
  if(realm==='time')add(ring(cx,cy,100,161),'boss',name,delay+74,24);
  if(realm==='space')add(circle(width-x,height-y,64),'boss',name,delay+78,26);
  if(realm==='fire')add(circle(x,y,68),'boss',name,delay+74,28);
  if(realm==='storm')add(line(cx,cy,turn%2?Math.PI/2:Math.PI/4,43),'boss',name,delay+76,23);
  if(realm==='ice')add(circle(width-x,height-y,69),'boss',name,delay+81,29);
  if(realm==='forest')for(let k=0;k<2;k++){const a=k*Math.PI+bossTurn*.2;
    add(circle(cx+Math.cos(a)*115,cy+Math.sin(a)*115,58),'boss',name,delay+76+k*36,27);}
 }
 function ultimate(turn,delay,x,y,rapid){
  // A 10F boss attacks with *composed* layouts that build up across time.
  // Telegraphs are fixed in place and each constituent hit is limited to one.
  const id=ULTIMATES[realm]||ULTIMATES.time,base=delay+(rapid?-2:6);
  const c=(px,py,r,label,offset=0,life=27)=>add(circle(px,py,r),'boss',label,base+offset,life);
  const l=(px,py,a,w,label,offset=0,life=27)=>add(line(px,py,a,w),'boss',label,base+offset,life);
  const r=(px,py,inner,outer,label,offset=0,life=27)=>add(ring(px,py,inner,outer),'boss',label,base+offset,life);
  const common=turn===4;
  // One shared 5F/10F signature per realm is intentional.
  if(common){
   if(realm==='time')l(cx,cy,Math.PI/4,44,id[turn]);
   else if(realm==='space')r(cx,cy,95,163,id[turn]);
   else if(realm==='fire'){l(cx,y,0,46,id[turn]);l(x,cy,Math.PI/2,45,id[turn],48);}
   else if(realm==='storm'){l(cx,height*.25,0,46,id[turn]);l(cx,height*.75,0,46,id[turn],51);}
   else if(realm==='ice')c(x,y,74,id[turn]);
   else for(let k=0;k<3;k++){const a=k*Math.PI*2/3+bossTurn*.14;c(cx+Math.cos(a)*118,cy+Math.sin(a)*118,60,id[turn],k*42);}
   return;
  }
  switch(realm){
   case 'time':
    if(turn===0)for(let k=0;k<6;k++)l(cx,cy,Math.PI*k/6,27,id[turn],k*25);
    if(turn===1){c(x,y,69,id[turn]);c(width-x,height-y,69,id[turn],58);r(cx,cy,105,161,id[turn],116);}
    if(turn===2){l(cx,cy,0,36,id[turn]);l(cx,cy,Math.PI/2,36,id[turn],48);c(x,y,67,id[turn],104);}
    if(turn===3){l(width*.33,cy,Math.PI/2,45,id[turn]);l(width*.67,cy,Math.PI/2,45,id[turn],55);
     r(cx,cy,100,163,id[turn],113);}
    break;
   case 'space':
    if(turn===0){r(cx,cy,96,155,id[turn]);for(let k=0;k<3;k++){const a=k*Math.PI*2/3+bossTurn*.24;
     c(cx+Math.cos(a)*148,cy+Math.sin(a)*148,48,id[turn],46+k*35);}}
    if(turn===1){c(width*.28,height*.36,86,id[turn]);c(width*.72,height*.64,86,id[turn],56);
     r(cx,cy,137,201,id[turn],112);}
    if(turn===2)for(let k=0;k<5;k++)l(cx,cy,(-.35+k*.175)*Math.PI,33,id[turn],k*32);
    if(turn===3){r(cx,cy,55,130,id[turn]);r(cx,cy,152,213,id[turn],66);c(x,y,62,id[turn],130);}
    break;
   case 'fire':
    if(turn===0){r(cx,cy,145,217,id[turn]);c(cx,cy,80,id[turn],64);l(x,cy,Math.PI/2,51,id[turn],120);}
    if(turn===1)for(let k=0;k<5;k++)c(width*(.15+k*.175),height*(k%2?.65:.35),57,id[turn],k*39);
    if(turn===2){c(x,y,76,id[turn]);r(x,y,80,144,id[turn],59);r(x,y,150,211,id[turn],119);}
    if(turn===3)for(let k=0;k<4;k++)l(cx,height*(.18+k*.21),0,40,id[turn],k*47);
    break;
   case 'storm':
    if(turn===0)for(let k=0;k<7;k++)c(
      k%2?width-x:x,k%3?height*.31:height*.72,56,id[turn],k*29);
    if(turn===1)for(let k=0;k<5;k++)l(cx,height*(.14+k*.18),0,35,id[turn],k*32);
    if(turn===2){r(cx,cy,88,160,id[turn]);l(cx,cy,Math.PI/4,38,id[turn],55);
      l(cx,cy,-Math.PI/4,38,id[turn],111);}
    if(turn===3)for(let k=0;k<4;k++){l(width*(.19+k*.21),cy,Math.PI/2,34,id[turn],k*25);
      if(k<3)l(cx,height*(.21+k*.25),0,33,id[turn],k*25+110);}
    break;
   case 'ice':
    if(turn===0){l(cx,height*.33,0,55,id[turn]);l(cx,height*.67,0,55,id[turn],57);
     r(cx,cy,112,174,id[turn],111);}
    if(turn===1)for(let k=0;k<4;k++)l(width*(.17+k*.22),cy,Math.PI/2,48,id[turn],k*46);
    if(turn===2)for(let k=0;k<5;k++){const a=k*Math.PI*2/5+bossTurn*.12;
      c(cx+Math.cos(a)*141,cy+Math.sin(a)*141,68,id[turn],k*38);}
    if(turn===3)for(let k=0;k<5;k++)l(cx,cy,k*Math.PI/5,40,id[turn],k*36);
    break;
   case 'forest':
    if(turn===0){for(let k=0;k<5;k++){const a=k*Math.PI*2/5+bossTurn*.12;
      c(cx+Math.cos(a)*134,cy+Math.sin(a)*134,59,id[turn],k*40);}}
    if(turn===1){l(cx,height*.36,0,52,id[turn]);l(width*.34,cy,Math.PI/2,50,id[turn],62);
      l(width*.66,cy,Math.PI/2,50,id[turn],124);}
    if(turn===2)for(let k=0;k<4;k++)c(width*(.22+k*.18),height*(k%2?.37:.63),68,id[turn],k*49);
    if(turn===3){r(cx,cy,110,179,id[turn]);c(x,y,75,id[turn],65);c(width-x,height-y,75,id[turn],125);}
    break;
  }
 }
 function step(){
  if(hero.hp<=0||boss.hp<=0)return;
  tick++;
  if(exposure>0&&--exposure===0)boss.towerDefense=baseDefense;
  spectacle?.step();
  if(isBoss&&phase===1&&boss.hp<=boss.maxHp*.5){phase=2;nextBoss=Math.max(tick+90,nextBoss);}
  // No extra terrain on boss floors; every pattern has safe geometry.
  if(!isBoss&&!environmentManaged&&tick>=nextTerrain){terrain();nextTerrain=tick+Math.max(205,300-level*9);}
  if(isBoss&&!spectacle?.event&&tick>=nextBoss){pattern();nextBoss=tick+({time:phase===2?135:178,space:phase===2?230:272,fire:phase===2?150:185,storm:phase===2?118:155,ice:phase===2?245:295,forest:phase===2?158:204}[realm]||255);}
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
      const element={time:.86,space:1.02,fire:1.75,storm:1.05,ice:.82,forest:.9}[realm]||1;
      const amount=Math.round((z.kind==='boss'?24+level*3+(phase===2?6:0):(realm==='fire'?18:12)+level*2)*element);
      if(z.kind==='boss'&&realm==='ice'){p.slowTimer=Math.max(p.slowTimer||0,90);p.slowMultiplier=.5;}
      if(damage(p,amount,z)!==false){
        z.hits.add(p);
        // Signature mechanics are real status/force effects AFTER a confirmed
        // hit, not merely particle colours. No hidden damage outside telegraphs.
        if(z.kind==='boss'){
          if(realm==='time'){
            p.slowTimer=Math.max(p.slowTimer||0,75);
            p.slowMultiplier=Math.min(p.slowMultiplier||1,.64);
            if(p.forgeTicks)p.forgeTicks=p.forgeTicks.map(v=>Math.max(0,v-20));
          }
          if(realm==='space'){
            const dx=cx-p.x,dy=cy-p.y,d=Math.max(1,Math.hypot(dx,dy));
            p.vx=(p.vx||0)+dx/d*1.4;p.vy=(p.vy||0)+dy/d*1.4;
          }
          if(realm==='fire'){p.bfDot=Math.max(p.bfDot||0,90);p.bfDotDamage=Math.max(p.bfDotDamage||0,2+Math.floor(level/5));p._forgeDotKind='fire';}
          if(realm==='storm'){p.vx=(p.vx||0)+(p.x<cx?-2:2);p.vy=(p.vy||0)+(p.y<cy?-2:2);}
          if(realm==='ice'){p.slowTimer=Math.max(p.slowTimer||0,90);p.slowMultiplier=.5;}
          if(realm==='forest'){p.poisonTimer=Math.max(p.poisonTimer||0,120);p.slowTimer=Math.max(p.slowTimer||0,45);p.slowMultiplier=.7;}
        }
      }
    }
   }
  }
  for(let i=zones.length-1;i>=0;i--)if(tick>=zones[i].end){
   const z=zones[i];
   if(isBoss&&z.kind==='boss'){
    if(!z.hits.has(hero)&&hero?.forge?.signatureVersion===1){
     hero._forgeDodgeSerial=(hero._forgeDodgeSerial||0)+1;
     hero._forgeDodgeWindow=(hero._forgeActionClock||0)+120;
     g.SignatureLive?.record?.(hero,'dodge');
    }
    avoided=z.hits.has(hero)?0:avoided+1;
    if(avoided>=2&&tick>=nextExpose){
     avoided=0;exposure=180;nextExpose=tick+540;
     boss.towerDefense=baseDefense*1.5;
     g.addFloatingText?.('약점 노출!',boss.x,boss.y-65,'#ffe28e',22);
    }
   }
   zones.splice(i,1);
  }
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
   const raised=!live&&g.ArenaTowerPattern3D?.warning?.(ctx,z,realm,tick,width,height);
   if(!raised&&!live){const label=z.label+' '+(warning/60).toFixed(1)+'s';
     ctx.strokeText(label,x,y);ctx.fillText(label,x,y);}
  }
  if(isBoss){
   ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffffff';
   ctx.fillText('PHASE '+phase+' · '+(phase===2?'격화':'탐색'),width/2,24);
   if(exposure>0){ctx.fillStyle='#ffe28e';ctx.fillText('약점 노출 · 피해 +50% · '+(exposure/60).toFixed(1)+'초',width/2,43);}
  }
  ctx.restore();
 }
 return {step,draw: function(ctx,color){draw(ctx,color);spectacle?.draw(ctx);g.ArenaTowerSpectacle?.page(g.ArenaScreenRouter?.active&&g.ArenaScreenRouter.active!=='tower'?null:spectacle?.event,spectacle?.tick);},get spectacle(){return spectacle;},get zones(){return zones.concat(spectacle?.zones||[]);},get tick(){return tick;},get phase(){return phase;},get weakpointFrames(){return exposure;},isBoss,
    get attackIndex(){return bossTurn;}};
}
g.ArenaEncounter={create,contains,patternNames:(id,level=5)=>[...((level===10?ULTIMATES:NAMES)[id]||NAMES.time)],bossCatalog:{middle:NAMES,final:ULTIMATES}};
})(globalThis);
