/* Simulation-owned boss spectacles. Visuals never advance combat. */
(function(g){
'use strict';
const TAU=Math.PI*2,C={time:'#ffd77f',space:'#b898ff',fire:'#ff793f',storm:'#9ceaff',ice:'#c3f7ff',forest:'#9bde71'};
const names={time:['천체 시계','역행하는 기억','멈춘 세계'],space:['사건의 지평선','태초의 빅뱅','은하 절단'],fire:['종말 운석','화산의 심장','화염 회오리'],storm:['허리케인의 눈','천공의 심판','천둥새 강하'],ice:['거울 아래의 나','절대영도','빙창 눈보라'],forest:['세계수의 뿌리','식충림 만개','자연의 부름']};
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
const METEOR_COUNTDOWN=12*60, METEOR_BLAST=48;
function create({realm,level,width:w,height:h,hero,boss,damage}){
 const temporal=realm==='time'?g.ArenaTowerTemporal?.create([hero,boss],{kinematicOnly:true}):null;
 let tick=0,turn=0,event=null,history=[];const entities=[];let entitySerial=100;const zones=[],cx=w/2,cy=h/2;
 const clock=realm==='time'&&level%5===0?g.ArenaClockHands?.create({
   width:w,height:h,hero,boss,damage,weakpoint(){
     // One exposed physical clock core is the pinball replacement for
     // automatic-dodge-derived boss vulnerability.
     if(!boss._towerClockWeakFrames)boss._towerClockDefenseBase=Number.isFinite(boss.towerDefense)?boss.towerDefense:1;
     boss.towerDefense=boss._towerClockDefenseBase*1.5;
     boss._towerClockWeakFrames=level===10?240:180;
     g.addFloatingText?.('⏳ 시계 코어 파괴 · 약점 노출!',boss.x,boss.y-64,'#ffe7a4',18);
   }
 }):null;
 const cosmos=realm==='space'&&level%5===0?g.ArenaSpaceGravity?.create({
   width:w,height:h,hero,boss,damage,weakpoint(){
     // Two real pinball contacts with spawned star bumpers expose a
     // temporary, reversible vulnerability; never reapply on every tick.
     if(!boss._towerSpaceWeakFrames)
       boss._towerSpaceDefenseBase=Number.isFinite(boss.towerDefense)?boss.towerDefense:1;
     boss.towerDefense=boss._towerSpaceDefenseBase*1.5;
     boss._towerSpaceWeakFrames=level===10?240:180;
     g.addFloatingText?.('✦ 별의 핵 붕괴 · 약점 노출!',boss.x,boss.y-60,'#e8d8ff',18);
   }
 }):null;
 const volcano=realm==='fire'&&level%5===0?g.ArenaFireVolcano?.create({
   width:w,height:h,hero,boss,damage,weakpoint(){
     if(!boss._towerFireWeakFrames)
       boss._towerFireDefenseBase=Number.isFinite(boss.towerDefense)?boss.towerDefense:1;
     boss.towerDefense=boss._towerFireDefenseBase*1.5;
     boss._towerFireWeakFrames=level===10?240:180;
     g.addFloatingText?.('🔥 마그마 심장 파열 · 약점 노출!',boss.x,boss.y-58,'#ffcc85',18);
   }
 }):null;
 const supercell=realm==='storm'&&level%5===0?g.ArenaStormSupercell?.create({
   width:w,height:h,hero,boss,damage,weakpoint(){
     if(!boss._towerStormWeakFrames)
       boss._towerStormDefenseBase=Number.isFinite(boss.towerDefense)?boss.towerDefense:1;
     boss.towerDefense=boss._towerStormDefenseBase*1.5;
     boss._towerStormWeakFrames=level===10?240:180;
     g.addFloatingText?.('⚡ 폭풍의 눈 붕괴 · 약점 노출!',boss.x,boss.y-60,'#c9f4ff',18);
   }
 }):null;
 const glacier=realm==='ice'&&level%5===0?g.ArenaIceGlacier?.create({
   width:w,height:h,hero,boss,damage,weakpoint(){
     if(!boss._towerIceWeakFrames)
       boss._towerIceDefenseBase=Number.isFinite(boss.towerDefense)?boss.towerDefense:1;
     boss.towerDefense=boss._towerIceDefenseBase*1.5;
     boss._towerIceWeakFrames=level===10?240:180;
     g.addFloatingText?.('❄ 빙정의 핵 파열 · 약점 노출!',boss.x,boss.y-62,'#d9faff',18);
   }
 }):null;
 const living=realm==='forest'&&level%5===0?g.ArenaForestLife?.create({
   width:w,height:h,hero,boss,damage,weakpoint(){
     if(!boss._towerForestWeakFrames)
       boss._towerForestDefenseBase=Number.isFinite(boss.towerDefense)?boss.towerDefense:1;
     boss.towerDefense=boss._towerForestDefenseBase*1.5;
     boss._towerForestWeakFrames=level===10?240:180;
     g.addFloatingText?.('🌿 세계수 씨앗핵 분쇄 · 약점 노출!',boss.x,boss.y-60,'#d1f8ac',18);
   }
 }):null;
 function zone(shape,delay,life=30){const z={...shape,kind:'boss',realm,label:names[realm][event.variant],born:tick,fire:tick+delay,end:tick+delay+life,hits:new Set(),spectacle:true};zones.push(z);return z;}
 function spawn(kind,x,y,hp=60){const p={id:'tower-construct',name:kind==='meteor'?'종말 운석':kind==='golem'?'빙정 골렘':kind==='mirror'?'얼음 거울상':'가시 수호수',kind,x,y,vx:0,vy:0,z:0,radius:kind==='meteor'?42:22,hp,maxHp:hp,invincible:0,playerNum:++entitySerial,jumpState:'ground',born:tick,expires:tick+600};entities.push(p);return p;}
 function clear(){
  event=null;zones.length=0;entities.length=0;clock?.clear();cosmos?.clear();volcano?.clear();supercell?.clear();glacier?.clear();living?.clear();
  if(boss._towerClockWeakFrames>0){
   boss.towerDefense=boss._towerClockDefenseBase||boss.towerDefense;
   boss._towerClockWeakFrames=0;
  }
  if(boss._towerSpaceWeakFrames>0){
   boss.towerDefense=boss._towerSpaceDefenseBase||boss.towerDefense;
   boss._towerSpaceWeakFrames=0;
  }
  if(boss._towerFireWeakFrames>0){
   boss.towerDefense=boss._towerFireDefenseBase||boss.towerDefense;
   boss._towerFireWeakFrames=0;
  }
  if(boss._towerStormWeakFrames>0){
   boss.towerDefense=boss._towerStormDefenseBase||boss.towerDefense;
   boss._towerStormWeakFrames=0;
  }
  if(boss._towerIceWeakFrames>0){
   boss.towerDefense=boss._towerIceDefenseBase||boss.towerDefense;
   boss._towerIceWeakFrames=0;
  }
  if(boss._towerForestWeakFrames>0){
   boss.towerDefense=boss._towerForestDefenseBase||boss.towerDefense;
   boss._towerForestWeakFrames=0;
  }
  if(realm==='storm')boss.z=0;
  page(null);
 }
 function targets(p){return p===hero?entities.filter(e=>e.hp>0&&tick>=e.born+60):[];}
 function begin(){
  const variant=turn++%(level===10?3:2);event={realm,variant,start:tick,end:tick+540,title:names[realm][variant],progress:0};
  if(realm==='fire')volcano?.begin(level===10?2:1,variant);
  if(realm==='forest'&&living){
    living.begin(level===10?2:1,variant);
    event.hint=variant===0?
      '세계수의 뿌리 · 실제 회전 뿌리의 충돌과 반발 · 중앙 나무심장 2회 충돌 시 약점':
      variant===1?
      '식충림 만개 · 예고된 독성 포자 구역과 파괴 가능한 씨앗 수호핵':
      '자연의 부름 · 성장하는 덩굴과 씨앗 수호핵 · 수호핵을 분쇄하면 세계수 재생 차단';
    return;
  }
  if(realm==='ice'&&glacier){
    glacier.begin(level===10?2:1,variant);
    event.hint=variant===0?
      '거울 빙정 · 회전하는 결정에 실제로 충돌하며 튕겨 나갑니다 · 중앙 핵 2회 충돌 시 약점':
      variant===1?
      '절대영도 · 몸과 탄환의 관성이 천천히 식고, 움직이는 서리 파동에 부딪힙니다':
      '영원의 빙하왕 · 쪼개지는 빙벽과 천년 빙창 · 중앙의 안전 통로를 지키세요';
    return;
  }
  if(realm==='storm'&&supercell){
    supercell.begin(level===10?2:1,variant);
    event.hint=variant===0?
      '허리케인의 눈 · 강풍이 실제 공·탄환을 회전시킵니다 · 회전벽을 피하고 눈을 2회 타격':
      variant===1?
      '천공의 심판 · 예고된 피뢰침 사이에 번개가 이어집니다 · 번개 통로에서 튕겨 나갑니다':
      '천둥새 강하 · 번개 구체 3개가 전장을 가로지릅니다 · 충돌 시 실제 반발';
    return;
  }
  if(realm==='space'&&cosmos){
    cosmos.begin(level===10?2:1,variant);
    event.hint=variant===0?'사건의 지평선 · 공과 탄환이 중력에 휘고 중심 핵은 반사':
      variant===1?'태초의 빅뱅 · 수축 뒤 밀어내는 충격파 · 별 범퍼 2회 충돌로 약점':
      '무중력 밀키웨이 · 회전 은하를 튕겨내며 행성 절단선 돌파';
    return;
  }
  if(variant===2){
   if(realm==='time'){
     event.hint='멈춘 세계 · 보스만 움직임 · 태엽 코어를 충돌로 타격';
     event.end=tick+420;
     clock?.begin(level===10?2:1,'stasis');
   }
   if(realm==='space'){event.hint='무중력 궤도 · 은하의 절단선 옆으로 피하기';for(let i=0;i<3;i++)zone({shape:'line',x:cx,y:cy,angle:i*Math.PI/3,length:Math.hypot(w,h),width:30,galaxy:true},180+i*80,45);}
   if(realm==='fire'){
    event.hint='종말의 화산왕 · 세 개의 회전하는 화염 회오리와 바깥 칼데라 용암해 · 안전한 중앙 지대';
    return;
   }
   if(realm==='storm'&&!supercell){event.hint='천둥새의 강하 · 고정된 번개 착지점을 피하기';for(let i=0;i<5;i++)zone({shape:'circle',x:w*(.15+i*.17),y:h*(i%2?.7:.3),r:54,dive:true},150+i*50,30);}
   if(realm==='ice'&&!glacier){event.hint='얼음 창 사이로 이동 · 서리를 피하면 한기가 사라집니다';for(let i=0;i<5;i++)zone({shape:'line',x:w*(.12+i*.19),y:cy,angle:Math.PI/2,length:h,width:24,frost:true},150+i*48,60);}
   if(realm==='forest'&&!living){event.hint='재생의 비 · 수호수를 파괴하면 보스 재생 중단';for(let i=0;i<4;i++)spawn('tree',w*(.2+(i%2)*.6),h*(.2+Math.floor(i/2)*.6),45);for(let i=0;i<4;i++)zone({shape:'line',x:cx,y:h*(.2+i*.2),angle:0,length:w*.7,width:20,root:true},180+i*55,70);}
   return;
  }
  if(realm==='time'){
   if(!variant){
     event.hint='황금 초침과 분침 · 실제 물리 반사 · 중앙 태엽 2회 타격 시 약점';
     event.end=tick+(level===10?435:420);
     clock?.begin(level===10?2:1,'hands');
   }else{
     event.hint='인과 역류 · 과거 궤적 역재생 후 현재로 복귀';
     event.memory=history.slice();event.origin={x:hero.x,y:hero.y};
     for(let i=0;i<5;i++){
       const p=history[Math.max(0,history.length-1-i*30)]||hero;
       zone({shape:'circle',x:p.x,y:p.y,r:42},180+i*50);
     }
   }
  }else if(realm==='space'){
   if(!variant)zone({shape:'circle',x:cx,y:cy,r:55,pull:true},120,330);
   else for(let i=0;i<5;i++)zone({shape:'ring',x:cx,y:cy,inner:30+i*40,r:48+i*40},150+i*48,28);
  }else if(realm==='fire'){
   if(!variant){
    // The extinction meteor is a WORLD-SCALE boss deadline, not an enemy.
    // Attacking it or applying status effects can never destroy the visual.
    event.deadline=tick+METEOR_COUNTDOWN;
    event.impactTick=event.deadline+METEOR_BLAST;
    event.end=event.impactTick+20;
    event.remaining=METEOR_COUNTDOWN/60;
    event.hint='종말 운석 강림 · 제한시간 안에 화염탑 보스를 쓰러뜨리세요!';
   }
   else event.hint='용암의 심장 · 예고된 분화구가 차례로 폭발합니다 · 중앙 마그마 핵 2회 충돌 시 약점';
  }else if(realm==='storm'&&!supercell){
   if(!variant)zone({shape:'ring',x:cx,y:cy,inner:90,r:Math.min(w,h)*.48,wind:true},150,270);
   else for(let i=0;i<6;i++)zone({shape:'line',x:w*(.12+i*.15),y:cy,angle:Math.PI/2,length:h,width:32},150+i*45,22);
  }else if(realm==='ice'&&!glacier){
   if(!variant){spawn('mirror',w-hero.x,h-hero.y,65);spawn('golem',w*.25,h*.25,80);spawn('golem',w*.75,h*.75,80);}
   if(!variant)for(let i=0;i<6;i++){const p=history[Math.max(0,history.length-1-i*20)]||hero;zone({shape:'circle',x:w-p.x,y:h-p.y,r:48,mirror:true},140+i*45,35);}
   else zone({shape:'ring',x:cx,y:cy,inner:82,r:Math.hypot(w,h),frost:true},180,240);
  }else if(realm==='forest'&&!living){
   for(let i=0;i<(variant?5:3);i++){const a=i*TAU/(variant?5:3);spawn(variant?'swarm':'tree',cx+Math.cos(a)*w*.3,cy+Math.sin(a)*h*.3,variant?24:65);}
   for(let i=0;i<7;i++){const a=i*TAU/7;zone({shape:'circle',x:cx+Math.cos(a)*w*.3,y:cy+Math.sin(a)*h*.3,r:45,root:true},130+i*35,85);}
  }
 }
 function step(){
  if(hero.hp<=0||(!event?.failed&&boss.hp<=0)){clear();return;}
  tick++;
  if(boss._towerClockWeakFrames>0){
    if(--boss._towerClockWeakFrames===0){
      // Restore the externally managed defense only if the clock applied it.
      boss.towerDefense=boss._towerClockDefenseBase||boss.towerDefense;
    }
  }
  clock?.step();cosmos?.step();volcano?.step();supercell?.step();glacier?.step();living?.step();
  if(boss._towerSpaceWeakFrames>0&&--boss._towerSpaceWeakFrames===0)
    boss.towerDefense=boss._towerSpaceDefenseBase||boss.towerDefense;
  if(boss._towerFireWeakFrames>0&&--boss._towerFireWeakFrames===0)
    boss.towerDefense=boss._towerFireDefenseBase||boss.towerDefense;
  if(boss._towerStormWeakFrames>0&&--boss._towerStormWeakFrames===0)
    boss.towerDefense=boss._towerStormDefenseBase||boss.towerDefense;
  if(boss._towerIceWeakFrames>0&&--boss._towerIceWeakFrames===0)
    boss.towerDefense=boss._towerIceDefenseBase||boss.towerDefense;
  if(boss._towerForestWeakFrames>0&&--boss._towerForestWeakFrames===0)
    boss.towerDefense=boss._towerForestDefenseBase||boss.towerDefense;
  for(const e of entities){if(e.hp<=0)continue;if(e.invincible>0)e.invincible--;g.ForgeExpansion?.tick(e);if(e.kind!=='meteor'&&tick>e.born+90){const dx=hero.x-e.x,dy=hero.y-e.y,d=Math.hypot(dx,dy)||1,speed=e.kind==='golem'?.6:e.kind==='swarm'?1.8:1;e.x=cap(e.x+dx/d*speed,e.radius,w-e.radius);e.y=cap(e.y+dy/d*speed,e.radius,h-e.radius);if(d<e.radius+hero.radius+12&&tick%65===0)damage(hero,e.kind==='golem'?14:8,{realm,kind:'boss',label:e.name});}}
  for(let i=entities.length-1;i>=0;i--)if(entities[i].hp<=0||tick>entities[i].expires)entities.splice(i,1);
  history.push({x:hero.x,y:hero.y});if(history.length>240)history.shift();
  if(level%5!==0)return;
  if(!event&&tick>240){
   const energy=g.BounceMomentum?.isBoss?.(boss);
   if(energy){
    if(g.BounceMomentum.bossCan(boss,'spectacle')){
     begin();g.BounceMomentum.bossSpend(boss,'spectacle');
    }
   }else if((tick-241)%900===0)begin();
  }
  if(!event)return;
  event.progress=cap((tick-event.start)/((event.deadline||event.end)-event.start),0,1);
  const age=tick-event.start;
  if(realm==='time'&&event.variant===1&&age===120)temporal?.begin();
  // Clock-hand collisions and stasis now come from the single physical
  // apparatus; no legacy unavoidable positional freeze.
  if(realm==='storm'&&event.variant===2)boss.z=35*Math.max(0,Math.sin(Math.PI*age/540));
  if(realm==='forest'&&!living&&event.variant===2&&age>120&&age%60===0&&entities.some(e=>e.hp>0))boss.hp=Math.min(boss.maxHp,boss.hp+boss.maxHp*.015);
  if(realm==='space'&&event.variant===2&&age>120&&age<440){hero.vx=(hero.vx||0)*1.008;hero.vy=(hero.vy||0)*1.008;}
  if(event.deadline){
   event.remaining=Math.max(0,Math.ceil((event.deadline-tick)/60));
   if(tick===event.deadline){
    event.exploded=true;event.failed=true;
    // At zero the challenge is lost. The boss cannot be defeated during
    // the short blast animation to retroactively cancel the deadline.
    boss.invincible=Math.max(boss.invincible||0,METEOR_BLAST+2);
   }
   if(event.failed&&boss.hp<=0)boss.hp=1;
   if(tick===event.impactTick&&event.failed&&boss.hp>0){
    // A FAILED boss-check is an explicit defeat. The normal hazard adapter
    // rejects shield, jump and post-hit protection, so it cannot implement
    // an unavoidable cinematic wipe; this is intentionally separate.
    hero.forgeRevived=true; // no resurrection may undo the extinction wipe
    hero.hp=0;
    g.addFloatingText?.('종말 운석 · 전멸',hero.x,hero.y-45,'#ffca8b',23);
   }
  }
  for(const z of zones){
   if(z.spin)z.angle+=z.spin;
   if(z.tornado!==undefined){const a=(tick-event.start)*.009+z.tornado*TAU/3;z.x=cx+Math.cos(a)*w*.25;z.y=cy+Math.sin(a)*h*.25;}
   if(tick<z.fire||tick>=z.end)continue;
   const inside=g.ArenaEncounter.contains(z,hero);
   if(z.timeLock&&inside)g.ForgeExpansion?.applyStatus(boss,hero,{status:'freeze',duration:.2,damage:0});
   if(z.frost){event.chill=cap((event.chill||0)+(inside?1:-2),0,90);if(inside){hero.slowTimer=Math.max(hero.slowTimer||0,8);hero.slowMultiplier=1-event.chill/130;}if(event.chill>=90){g.ForgeExpansion?.applyStatus(boss,hero,{status:'freeze',duration:.6,damage:0});event.chill=30;}}
   if(z.pull){const dx=cx-hero.x,dy=cy-hero.y,d=Math.max(1,Math.hypot(dx,dy));hero.x=cap(hero.x+dx/d*.65,hero.radius,w-hero.radius);hero.y=cap(hero.y+dy/d*.65,hero.radius,h-hero.radius);}
   if(inside&&z.wind){hero.vx+=Math.cos(tick*.04)*.3;hero.vy+=Math.sin(tick*.04)*.3;}
   if(inside&&!z.hits.has(hero)&&damage(hero,level===10?38:25,z)!==false){z.hits.add(hero);if(z.frost||z.root)g.ForgeExpansion?.applyStatus(boss,hero,{status:z.root?'root':'freeze',duration:.6,damage:0});}
  }
  for(let i=zones.length-1;i>=0;i--)if(tick>=zones[i].end)zones.splice(i,1);
  if(tick>=event.end){boss.z=0;event=null;zones.length=0;entities.length=0;clock?.clear();cosmos?.clear();volcano?.clear();supercell?.clear();glacier?.clear();living?.clear();}
 }
 function draw(ctx){
  if(!event)return;
  ctx.save();ctx.strokeStyle=C[realm];ctx.fillStyle=C[realm];
  for(const z of zones){const live=tick>=z.fire;
   const fx=g.ArenaFXDepth,col=C[realm];
   if(fx){fx.ground(ctx,z.x,z.y,Math.min(135,z.r||z.width||40),col,live?.34:.24,'warning');
    if(live)fx.column(ctx,z.x,z.y,Math.min(20,(z.r||z.width||55)*.28),realm==='storm'?85:realm==='fire'?75:62,col,.32,realm);}
   ctx.save();ctx.globalAlpha=live?.18:.15;ctx.translate(z.x,z.y);
   if(z.shape==='line'){ctx.rotate(z.angle);ctx.lineWidth=z.width;ctx.beginPath();ctx.moveTo(-z.length/2,0);ctx.lineTo(z.length/2,0);ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();}
   else if(z.shape==='ring'){ctx.lineWidth=z.r-z.inner;ctx.beginPath();ctx.arc(0,0,(z.r+z.inner)/2,0,TAU);ctx.stroke();}
   else {ctx.beginPath();ctx.arc(0,0,z.r,0,TAU);ctx.stroke();}
   ctx.restore();g.ArenaTowerSpectacleArt?.zone(ctx,z,realm,tick);
  }
  if(realm==='time')clock?.draw(ctx);
  if(realm==='space')cosmos?.draw(ctx);
  if(realm==='fire')volcano?.draw(ctx);
  if(realm==='storm')supercell?.draw(ctx);
  if(realm==='ice')glacier?.draw(ctx);
  if(realm==='forest')living?.draw(ctx);
  for(const e of entities){if(e.kind==='meteor')continue;ctx.save();ctx.translate(e.x,e.y);ctx.globalAlpha=tick<e.born+60?.35:1;if(e.kind==='mirror'){ctx.fillStyle=hero.themeColor||'#78d3ed';ctx.globalAlpha=.65;ctx.beginPath();ctx.arc(0,0,e.radius,0,TAU);ctx.fill();ctx.strokeStyle='#dbfcff';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.fillText((hero.name||'나')[0],0,6);}
   else if(e.kind==='swarm'){ctx.fillStyle='#d6e8b1';for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(side*12,-4,12,4+Math.abs(Math.sin(tick*.4))*7,side*.5,0,TAU);ctx.fill();}ctx.fillStyle='#c6a636';ctx.beginPath();ctx.ellipse(0,0,8,14,0,0,TAU);ctx.fill();ctx.strokeStyle='#3b3420';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(6,0);ctx.stroke();}
   else g.ArenaTowerCreatures?.draw(ctx,{towerEnemy:true,towerRealm:e.kind==='meteor'?'fire':realm,towerBossTier:0,towerEnemyType:e.kind==='golem'?1:2,forgeClock:tick},e.radius);ctx.fillStyle='#111827';ctx.fillRect(-e.radius,e.radius+10,e.radius*2,6);ctx.fillStyle='#9af0ac';ctx.fillRect(-e.radius,e.radius+10,e.radius*2*Math.max(0,e.hp/e.maxHp),6);ctx.restore();}
  ctx.fillStyle='#fff';ctx.strokeStyle='#111';ctx.lineWidth=4;ctx.font='bold 16px system-ui';ctx.textAlign='center';const label=event.hint?event.hint+(event.deadline?' · '+(event.failed?'폭발!':event.remaining+'초 남음'):''):event.title;ctx.font='bold 12px system-ui';let lines=[''];for(const word of label.split(' ')){const i=lines.length-1;if(ctx.measureText(lines[i]+' '+word).width>w-35)lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}lines.slice(0,3).forEach((line,i)=>{const y=h-16-(Math.min(3,lines.length)-1-i)*16;ctx.strokeText(line,cx,y);ctx.fillText(line,cx,y);});ctx.restore();
 }
 return {step,draw,targets,temporal,clock,cosmos,volcano,supercell,glacier,living,clear,get entities(){return entities;},get zones(){return zones;},get event(){return event;},get tick(){return temporal?.active?tick-temporal.age:tick;}};
}
function glyph(c,realm,t,r,live){
 c.save();c.lineWidth=2;c.strokeStyle=C[realm];c.fillStyle=C[realm];
 if(realm==='space'){c.fillStyle='#080515';c.beginPath();c.arc(0,0,r*.55,0,TAU);c.fill();for(let j=0;j<4;j++){c.beginPath();c.ellipse(0,0,r*(.6+j*.14),r*.22,t*.015+j*.7,0,TAU);c.stroke();}}
 if(realm==='fire'){for(let j=0;j<9;j++){const a=j*TAU/9;c.save();c.rotate(a);c.beginPath();c.moveTo(-r*.12,r*.25);c.quadraticCurveTo(r*.3,-r*.3,r*.1+Math.sin(t*.07+j)*r*.18,-r*(live?1.4:.75));c.quadraticCurveTo(-r*.3,-r*.4,-r*.12,r*.25);c.fill();c.restore();}}
 if(realm==='storm'){for(let j=0;j<6;j++){c.beginPath();c.ellipse(0,(j-3)*r*.17,r*(.3+j*.12),r*.2,t*.02,0,Math.PI*1.65);c.stroke();}c.beginPath();c.moveTo(-r*.2,-r);c.lineTo(r*.15,-r*.25);c.lineTo(-r*.12,0);c.lineTo(r*.2,r);c.stroke();}
 if(realm==='ice'){for(let j=0;j<6;j++){c.save();c.rotate(j*TAU/6);c.beginPath();c.moveTo(0,0);c.lineTo(-r*.14,-r*.55);c.lineTo(0,-r*(.8+.1*Math.sin(t*.025)));c.lineTo(r*.14,-r*.55);c.closePath();c.fill();c.restore();}}
 if(realm==='forest'){for(let j=0;j<6;j++){c.save();c.rotate(j*TAU/6);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(r*.8,-r*.2,-r*.5,-r*.7,Math.sin(t*.025+j)*r*.25,-r);c.stroke();c.beginPath();c.ellipse(r*.18,-r*.55,r*.2,r*.08,.7,0,TAU);c.fill();c.restore();}}
 if(realm==='time'){c.beginPath();c.arc(0,0,r*.8,0,TAU);c.stroke();for(let j=0;j<2;j++){c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(t*.01/(j+1))*r*.7,Math.sin(t*.01/(j+1))*r*.7);c.stroke();}}
 c.restore();
}
// One non-interactive viewport canvas. No transforms on clickable page content.
let overlay=null,shaken=null,previousTranslate='';
function unshake(){if(shaken){shaken.style&&(shaken.style.translate=previousTranslate);shaken=null;}}
function page(event,tick){
 if(!g.document)return;
 if(!event){if(overlay)overlay.hidden=true;unshake();g.ArenaTowerPageReality?.clear?.();return;}
 if(!overlay){overlay=document.createElement('canvas');overlay.setAttribute('aria-hidden','true');overlay.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:900;';document.body.appendChild(overlay);}
 overlay.hidden=false;const w=g.innerWidth,h=g.innerHeight;if(overlay.width!==w||overlay.height!==h){overlay.width=w;overlay.height=h;}
 const c=overlay.getContext('2d');c.clearRect(0,0,w,h);const reduced=g.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!!document.querySelector('.bf-preference input')?.checked;const t=reduced?0:tick;
 if((event.realm==='storm'||event.realm==='fire'&&event.deadline)&&!reduced){if(!shaken){shaken=event.realm==='fire'?document.body:document.querySelector('.battle-screen');previousTranslate=shaken?.style?.translate||'';}if(shaken?.style){const intensity=event.realm==='fire'?Math.max(0,Math.pow(event.progress||0,2)*8):3;
  shaken.style.translate=(Math.sin(t*.43)*intensity).toFixed(2)+'px '+(Math.sin(t*.31)*intensity*.7).toFixed(2)+'px';}}else unshake();
 c.globalAlpha=.3*Math.sin(Math.PI*Math.min(1,event.progress));
 g.ArenaTowerSpectacleArt?.viewport(c,event,t,w,h);
  g.ArenaTowerPageReality?.render?.(c,event,t,w,h,reduced);
  g.ArenaTimeBossFX?.page?.(c,event,t,w,h,reduced);
  g.ArenaSpaceBossFX?.page?.(c,event,t,w,h,reduced);
  g.ArenaFireBossFX?.page?.(c,event,t,w,h,reduced);
  g.ArenaStormBossFX?.page?.(c,event,t,w,h,reduced);
  g.ArenaIceBossFX?.page?.(c,event,t,w,h,reduced);
  g.ArenaForestBossFX?.page?.(c,event,t,w,h,reduced);
 // Viewport art leaves the old subtle vignette alpha behind; the meteor
 // must NOT inherit it or disappear at progress 0/1.
 c.globalAlpha=1;
 if(event.realm==='fire'&&event.deadline)g.ArenaTowerMeteorArt?.draw?.(c,event,t,w,h,reduced);

}
g.ArenaTowerSpectacle={create,glyph,page};
})(globalThis);
