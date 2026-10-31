/* Simulation-owned boss spectacles. Visuals never advance combat. */
(function(g){
'use strict';
const TAU=Math.PI*2,C={time:'#ffd77f',space:'#b898ff',fire:'#ff793f',storm:'#9ceaff',ice:'#c3f7ff',forest:'#9bde71'};
const names={time:['천체 시계','역행하는 기억','멈춘 세계'],space:['사건의 지평선','태초의 빅뱅','은하 절단'],fire:['종말 운석','화산의 심장','화염 회오리'],storm:['허리케인의 눈','천공의 심판','천둥새 강하'],ice:['거울 아래의 나','절대영도','빙창 눈보라'],forest:['세계수의 뿌리','식충림 만개','자연의 부름']};
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
const METEOR_COUNTDOWN=12*60, METEOR_BLAST=48;
function create({realm,level,width:w,height:h,hero,boss,damage}){
 const temporal=realm==='time'?g.ArenaTowerTemporal?.create([hero,boss]):null;
 let tick=0,turn=0,event=null,history=[];const entities=[];let entitySerial=100;const zones=[],cx=w/2,cy=h/2;
 function zone(shape,delay,life=30){const z={...shape,kind:'boss',realm,label:names[realm][event.variant],born:tick,fire:tick+delay,end:tick+delay+life,hits:new Set(),spectacle:true};zones.push(z);return z;}
 function spawn(kind,x,y,hp=60){const p={id:'tower-construct',name:kind==='meteor'?'종말 운석':kind==='golem'?'빙정 골렘':kind==='mirror'?'얼음 거울상':'가시 수호수',kind,x,y,vx:0,vy:0,z:0,radius:kind==='meteor'?42:22,hp,maxHp:hp,invincible:0,playerNum:++entitySerial,jumpState:'ground',born:tick,expires:tick+600};entities.push(p);return p;}
 function clear(){event=null;zones.length=0;entities.length=0;page(null);}
 function targets(p){return p===hero?entities.filter(e=>e.hp>0&&tick>=e.born+60):[];}
 function begin(){
  const variant=turn++%(level===10?3:2);event={realm,variant,start:tick,end:tick+540,title:names[realm][variant],progress:0};
  if(variant===2){
   if(realm==='time'){event.hint='중앙 시계의 눈 안으로 이동 · 바깥 시간 정지';zone({shape:'ring',x:cx,y:cy,inner:85,r:Math.hypot(w,h),timeLock:true},180,180);for(let i=0;i<4;i++)zone({shape:'line',x:cx,y:cy,angle:i*Math.PI/4,length:w*.8,width:18},210+i*70,22);}
   if(realm==='space'){event.hint='무중력 궤도 · 은하의 절단선 옆으로 피하기';for(let i=0;i<3;i++)zone({shape:'line',x:cx,y:cy,angle:i*Math.PI/3,length:Math.hypot(w,h),width:30,galaxy:true},180+i*80,45);}
   if(realm==='fire'){event.hint='불꽃 토네이도 · 이동 경로를 피해 바깥으로';for(let i=0;i<3;i++)zone({shape:'circle',x:cx,y:cy,r:42,tornado:i},150+i*30,270);}
   if(realm==='storm'){event.hint='천둥새의 강하 · 고정된 번개 착지점을 피하기';for(let i=0;i<5;i++)zone({shape:'circle',x:w*(.15+i*.17),y:h*(i%2?.7:.3),r:54,dive:true},150+i*50,30);}
   if(realm==='ice'){event.hint='얼음 창 사이로 이동 · 서리를 피하면 한기가 사라집니다';for(let i=0;i<5;i++)zone({shape:'line',x:w*(.12+i*.19),y:cy,angle:Math.PI/2,length:h,width:24,frost:true},150+i*48,60);}
   if(realm==='forest'){event.hint='재생의 비 · 수호수를 파괴하면 보스 재생 중단';for(let i=0;i<4;i++)spawn('tree',w*(.2+(i%2)*.6),h*(.2+Math.floor(i/2)*.6),45);for(let i=0;i<4;i++)zone({shape:'line',x:cx,y:h*(.2+i*.2),angle:0,length:w*.7,width:20,root:true},180+i*55,70);}
   return;
  }
  if(realm==='time'){
   if(!variant)event.hint='회전 바늘 회피 · 마지막 시간정지는 중앙 원으로 피하기';
   if(!variant)for(let i=0;i<2;i++)zone({shape:'line',x:cx,y:cy,length:Math.min(w,h)*.84,width:16+i*8,angle:i*Math.PI/2,spin:(i?-.003:.005)},120,360);
   else {event.memory=history.slice();event.hint='시간 역행: 체력 · 위치 · 스킬 · 투사체가 과거로 되돌아갔다가 복귀';event.origin={x:hero.x,y:hero.y};for(let i=0;i<5;i++){const p=history[Math.max(0,history.length-1-i*30)]||hero;zone({shape:'circle',x:p.x,y:p.y,r:42},180+i*50);}}
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
   else for(let i=0;i<7;i++){const a=i*TAU/7;zone({shape:'circle',x:cx+Math.cos(a)*w*.28,y:cy+Math.sin(a)*h*.28,r:48},150+i*38,65);}
  }else if(realm==='storm'){
   if(!variant)zone({shape:'ring',x:cx,y:cy,inner:90,r:Math.min(w,h)*.48,wind:true},150,270);
   else for(let i=0;i<6;i++)zone({shape:'line',x:w*(.12+i*.15),y:cy,angle:Math.PI/2,length:h,width:32},150+i*45,22);
  }else if(realm==='ice'){
   if(!variant){spawn('mirror',w-hero.x,h-hero.y,65);spawn('golem',w*.25,h*.25,80);spawn('golem',w*.75,h*.75,80);}
   if(!variant)for(let i=0;i<6;i++){const p=history[Math.max(0,history.length-1-i*20)]||hero;zone({shape:'circle',x:w-p.x,y:h-p.y,r:48,mirror:true},140+i*45,35);}
   else zone({shape:'ring',x:cx,y:cy,inner:82,r:Math.hypot(w,h),frost:true},180,240);
  }else if(realm==='forest'){
   for(let i=0;i<(variant?5:3);i++){const a=i*TAU/(variant?5:3);spawn(variant?'swarm':'tree',cx+Math.cos(a)*w*.3,cy+Math.sin(a)*h*.3,variant?24:65);}
   for(let i=0;i<7;i++){const a=i*TAU/7;zone({shape:'circle',x:cx+Math.cos(a)*w*.3,y:cy+Math.sin(a)*h*.3,r:45,root:true},130+i*35,85);}
  }
 }
 function step(){
  if(hero.hp<=0||(!event?.failed&&boss.hp<=0)){clear();return;}
  tick++;
  for(const e of entities){if(e.hp<=0)continue;if(e.invincible>0)e.invincible--;g.ForgeExpansion?.tick(e);if(e.kind!=='meteor'&&tick>e.born+90){const dx=hero.x-e.x,dy=hero.y-e.y,d=Math.hypot(dx,dy)||1,speed=e.kind==='golem'?.6:e.kind==='swarm'?1.8:1;e.x=cap(e.x+dx/d*speed,e.radius,w-e.radius);e.y=cap(e.y+dy/d*speed,e.radius,h-e.radius);if(d<e.radius+hero.radius+12&&tick%65===0)damage(hero,e.kind==='golem'?14:8,{realm,kind:'boss',label:e.name});}}
  for(let i=entities.length-1;i>=0;i--)if(entities[i].hp<=0||tick>entities[i].expires)entities.splice(i,1);
  history.push({x:hero.x,y:hero.y});if(history.length>240)history.shift();
  if(level%5!==0)return;
  if(!event&&tick>240&&(tick-241)%900===0)begin();
  if(!event)return;
  event.progress=cap((tick-event.start)/((event.deadline||event.end)-event.start),0,1);
  const age=tick-event.start;
  if(realm==='time'&&event.variant===1&&age===120)temporal?.begin();
  if(realm==='time'&&event.variant===0&&age>=360&&age<420&&Math.hypot(hero.x-cx,hero.y-cy)>65)
   g.ForgeExpansion?.applyStatus(boss,hero,{status:'freeze',duration:.2,damage:0});
  if(realm==='storm'&&event.variant===2)boss.z=35*Math.max(0,Math.sin(Math.PI*age/540));
  if(realm==='forest'&&event.variant===2&&age>120&&age%60===0&&entities.some(e=>e.hp>0))boss.hp=Math.min(boss.maxHp,boss.hp+boss.maxHp*.015);
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
  if(tick>=event.end){boss.z=0;event=null;zones.length=0;entities.length=0;}
 }
 function draw(ctx){
  if(!event)return;
  ctx.save();ctx.strokeStyle=C[realm];ctx.fillStyle=C[realm];
  for(const z of zones){const live=tick>=z.fire;ctx.save();ctx.globalAlpha=live?.18:.15;ctx.translate(z.x,z.y);
   if(z.shape==='line'){ctx.rotate(z.angle);ctx.lineWidth=z.width;ctx.beginPath();ctx.moveTo(-z.length/2,0);ctx.lineTo(z.length/2,0);ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();}
   else if(z.shape==='ring'){ctx.lineWidth=z.r-z.inner;ctx.beginPath();ctx.arc(0,0,(z.r+z.inner)/2,0,TAU);ctx.stroke();}
   else {ctx.beginPath();ctx.arc(0,0,z.r,0,TAU);ctx.stroke();}
   ctx.restore();g.ArenaTowerSpectacleArt?.zone(ctx,z,realm,tick);
  }
  if(realm==='time'){ctx.save();ctx.translate(cx,cy);ctx.beginPath();ctx.arc(0,0,65,0,TAU);ctx.stroke();ctx.strokeStyle=C.time;for(let i=0;i<12;i++){const a=i*TAU/12;ctx.beginPath();ctx.moveTo(Math.cos(a)*w*.37,Math.sin(a)*h*.37);ctx.lineTo(Math.cos(a)*w*.4,Math.sin(a)*h*.4);ctx.stroke();}ctx.restore();}
  for(const e of entities){if(e.kind==='meteor')continue;ctx.save();ctx.translate(e.x,e.y);ctx.globalAlpha=tick<e.born+60?.35:1;if(e.kind==='mirror'){ctx.fillStyle=hero.themeColor||'#78d3ed';ctx.globalAlpha=.65;ctx.beginPath();ctx.arc(0,0,e.radius,0,TAU);ctx.fill();ctx.strokeStyle='#dbfcff';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.fillText((hero.name||'나')[0],0,6);}
   else if(e.kind==='swarm'){ctx.fillStyle='#d6e8b1';for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(side*12,-4,12,4+Math.abs(Math.sin(tick*.4))*7,side*.5,0,TAU);ctx.fill();}ctx.fillStyle='#c6a636';ctx.beginPath();ctx.ellipse(0,0,8,14,0,0,TAU);ctx.fill();ctx.strokeStyle='#3b3420';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(6,0);ctx.stroke();}
   else g.ArenaTowerCreatures?.draw(ctx,{towerEnemy:true,towerRealm:e.kind==='meteor'?'fire':realm,towerBossTier:0,towerEnemyType:e.kind==='golem'?1:2,forgeClock:tick},e.radius);ctx.fillStyle='#111827';ctx.fillRect(-e.radius,e.radius+10,e.radius*2,6);ctx.fillStyle='#9af0ac';ctx.fillRect(-e.radius,e.radius+10,e.radius*2*Math.max(0,e.hp/e.maxHp),6);ctx.restore();}
  ctx.fillStyle='#fff';ctx.strokeStyle='#111';ctx.lineWidth=4;ctx.font='bold 16px system-ui';ctx.textAlign='center';const label=event.hint?event.hint+(event.deadline?' · '+(event.failed?'폭발!':event.remaining+'초 남음'):''):event.title;ctx.font='bold 12px system-ui';let lines=[''];for(const word of label.split(' ')){const i=lines.length-1;if(ctx.measureText(lines[i]+' '+word).width>w-35)lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}lines.slice(0,3).forEach((line,i)=>{const y=h-16-(Math.min(3,lines.length)-1-i)*16;ctx.strokeText(line,cx,y);ctx.fillText(line,cx,y);});ctx.restore();
 }
 return {step,draw,targets,temporal,clear,get entities(){return entities;},get zones(){return zones;},get event(){return event;},get tick(){return temporal?.active?tick-temporal.age:tick;}};
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
function unshake(){if(shaken){shaken.style.translate=previousTranslate;shaken=null;}}
function page(event,tick){
 if(!g.document)return;
 if(!event){if(overlay)overlay.hidden=true;unshake();g.ArenaTowerPageReality?.clear?.();return;}
 if(!overlay){overlay=document.createElement('canvas');overlay.setAttribute('aria-hidden','true');overlay.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:900;';document.body.appendChild(overlay);}
 overlay.hidden=false;const w=g.innerWidth,h=g.innerHeight;if(overlay.width!==w||overlay.height!==h){overlay.width=w;overlay.height=h;}
 const c=overlay.getContext('2d');c.clearRect(0,0,w,h);const reduced=g.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!!document.querySelector('.bf-preference input')?.checked;const t=reduced?0:tick;
 if(event.realm==='storm'&&!reduced){if(!shaken){shaken=document.querySelector('.battle-screen');previousTranslate=shaken?.style.translate||'';}if(shaken)shaken.style.translate=(Math.sin(t*.21)*3)+'px '+(Math.sin(t*.13)*2)+'px';}else unshake();
 c.globalAlpha=.3*Math.sin(Math.PI*Math.min(1,event.progress));
 g.ArenaTowerSpectacleArt?.viewport(c,event,t,w,h);
  g.ArenaTowerPageReality?.render?.(c,event,t,w,h,reduced);
 // Viewport art leaves the old subtle vignette alpha behind; the meteor
 // must NOT inherit it or disappear at progress 0/1.
 c.globalAlpha=1;
 if(event.realm==='fire'&&event.deadline)g.ArenaTowerMeteorArt?.draw?.(c,event,t,w,h,reduced);

}
g.ArenaTowerSpectacle={create,glyph,page};
})(globalThis);
