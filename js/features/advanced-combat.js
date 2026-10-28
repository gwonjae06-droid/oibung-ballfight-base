/* Advanced Combat: shared height physics and independently simulated constructs.
 * White arena visuals. All timings are fixed simulation frames (60fps baseline).
 * x,y are the ground position; only rendering uses y-z. */
(function(global){
'use strict';
const TYPES={
  leap:'도약',hover:'체공',glide:'활공',dive:'급강하',uppercut:'어퍼컷',slash:'베기',
  spinslash:'회전베기',thrust:'찌르기',aircombo:'공중 연속 공격',arcshot:'곡사탄',
  splitshot:'분열탄',wall:'벽 설치',portal:'쌍방향 포탈',summon:'추적 소환수',
  turret:'자동 포탑',trap:'덫',grow:'거대화',shrink:'소형화',
  burrowdash:'땅굴 돌진',erupt:'솟구치기'
};
const TYPE_NAMES=Object.keys(TYPES);
const DESCRIPTIONS={
  slash:'캐릭터가 바라보는 방향으로 부채꼴 칼날을 휘두릅니다. 칼끝이 닿은 적만 피해를 입고 실제 명중 지점에 절단 흔적이 남습니다.',
  spinslash:'몸을 중심으로 칼날을 360도 회전시켜 범위 안의 적을 가격합니다.',
  thrust:'바라보는 방향으로 칼끝을 뻗습니다. 좁고 긴 찌르기 궤도에 있는 적만 명중합니다.',
  aircombo:'공중에서 칼날을 세 번 연속 휘두릅니다. 각 타격은 따로 판정하며 첫 명중 시 적과 시전자를 띄웁니다.',
  uppercut:'가까운 적을 즉시 위로 올려치는 공격입니다. 실제 명중 시에만 적이 공중에 뜹니다.',
  arcshot:'포탄이 바닥 그림자를 남기고 포물선을 그립니다. 착탄 지점에서만 범위 피해가 발생합니다.',
  splitshot:'결정탄이 이동하다 파열되어 여러 개의 뾰족한 파편으로 갈라집니다. 파편이 실제로 통과한 적에게 피해를 줍니다.',
  leap:'바닥에 준비 동작을 취한 뒤 점프하고 정점에서 체공한 다음 착지합니다.',
  hover:'상승한 뒤 일정 시간 공중에 머물다가 착지합니다.',
  glide:'점프 뒤 천천히 내려오며 활공합니다.',
  dive:'높이 올라간 다음 바닥으로 급강하합니다. 착지하는 순간에만 충격파가 타격합니다.',
  wall:'실제 충돌 판정이 있는 장벽을 설치해 이동 경로를 막습니다.',
  portal:'입구에 닿은 캐릭터를 짝이 되는 출구로 이동시킵니다.',
  summon:'소환수가 목표를 따라 이동하고 닿은 거리에서 공격합니다.',
  turret:'고정 포탑이 사거리 안에 들어온 적을 주기적으로 공격합니다.',
  trap:'바닥에 덫을 설치하여 적이 들어올 때 작동시킵니다.',
  grow:'몸집과 실제 충돌 반경을 동시에 키웁니다.',
  shrink:'몸집과 실제 충돌 반경을 동시에 줄입니다.',
  burrowdash:'땅속으로 내려가 이동하고 나오면서 주변에 피해를 줍니다.',
  erupt:'지하에서 솟구쳐 오른 뒤 착지 지점에 충격을 가합니다.'
};
const objects=[],projectiles=[],effects=[];
const MAX_OBJECTS=24,MAX_PROJECTILES=90,MAX_EFFECTS=90;
const snapshots=new WeakMap();
let alpha=1,visualFrame=0,reduced=false,lastSfx=-20;
function setReduced(value){reduced=!!value;}
function sfx(kind,volume=.6){
  if(visualFrame-lastSfx<5)return;
  lastSfx=visualFrame;
  global.BattleFX?.sound?.(kind,volume);
}
const easeOut=t=>1-Math.pow(1-cap(t,0,1),3);
const lerp=(a,b,t)=>a+(b-a)*t;
function setAlpha(value){alpha=cap(Number.isFinite(value)?value:1,0,1);}
function blend(previous,current){
  return lerp(Number.isFinite(previous)?previous:current,current,alpha);
}
function visual(p){
  const s=snapshots.get(p);
  if(!s)return {x:p.x,y:p.y,z:groundHeight(p)};
  return {x:lerp(s.prev.x,s.now.x,alpha),
    y:lerp(s.prev.y,s.now.y,alpha),
    z:lerp(s.prev.z,s.now.z,alpha)};
}
function visibleHeight(p){return visual(p).z;}
function pose(p){
  const state=p.id==='park'&&p.jumpState!=='ground'?p.jumpState:p.jumpMotion?.phase;
  const stageAge=p.jumpMotion?.age||0;
  if(state==='prepare'){
    const t=cap(stageAge/(p.jumpMotion?.charge||7),0,1);
    return {sx:1+.11*t,sy:1-.19*t,tilt:0};
  }
  if(state==='rising')return {sx:.93,sy:1.1,tilt:cap(p.vx||0,-7,7)*.011};
  if(state==='hovering')return {sx:1.03+Math.sin(visualFrame*.12)*.015,sy:.99,tilt:Math.sin(visualFrame*.09)*.025};
  if(state==='descending'||state==='slamming')
    return {sx:1.13,sy:.88,tilt:cap(p.vx||0,-7,7)*.02};
  if(state==='landing'){
    const t=cap(stageAge/12,0,1);
    const bounce=Math.exp(-t*4)*Math.cos(t*Math.PI*3);
    return {sx:1+.19*bounce,sy:1-.19*bounce,tilt:0};
  }
  return {sx:1,sy:1,tilt:0};
}
const cap=(v,l,h)=>Math.max(l,Math.min(h,v));
const color=p=>p?.forge?.color||p?.borderColor||'#394c62';
const groundHeight=p=>p?.id==='park'&&p.jumpState&&p.jumpState!=='ground'?
 Math.max(0,p.jumpHeight||0):(p?.z||0);
function ensure(p){
  if(!p)return;
  if(!Number.isFinite(p.z))p.z=0;
  if(!Number.isFinite(p.vz))p.vz=0;
  if(!Number.isFinite(p.bodyScale))p.bodyScale=1;
  if(!Number.isFinite(p.baseRadius))p.baseRadius=p.radius||34;
}
function canHit(source,target,attackZ){
  if(!target||target.hp<=0)return false;
  if(source===target)return false;
  const a=Number.isFinite(attackZ)?attackZ:groundHeight(source);
  const z=groundHeight(target);
  // Two fighters have to occupy compatible vertical layers.
  return Math.abs(a-z)<=Math.max(30,26*(target.bodyScale||1));
}
function size(p){const z=groundHeight(p);return z<0?Math.max(.38,1+z/80):1+z/140;} // radius already accounts for bodyScale
function renderY(p){return p.y-groundHeight(p);}
function add(kind,x,y,opt={}){
  if(effects.length>=MAX_EFFECTS)effects.shift();
  const e={kind,x,y,life:opt.life||24,max:opt.life||24,r:opt.r||55,
    angle:opt.angle||0,col:opt.col||'#586779',stage:opt.stage||'telegraph',
    follow:opt.follow||null,offsetZ:opt.offsetZ||0};
  effects.push(e);return e;
}
function mark(kind,x,y,r=65,col='#516170',life=22,angle=0){
  return add(kind,x,y,{r,col,life,angle,
    stage:['burst','slash','cut','stab','cleave'].includes(kind)?'impact':'telegraph'});
}
function reset(){objects.length=0;projectiles.length=0;effects.length=0;alpha=1;}
function pushObject(o){if(objects.length>=MAX_OBJECTS)objects.shift();objects.push(o);return o;}
function pushShot(o){if(projectiles.length>=MAX_PROJECTILES)projectiles.shift();o.trail=[];projectiles.push(o);return o;}
const enemies=p=>players.filter(q=>q!==p&&q.hp>0);
const nearest=p=>enemies(p).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]||null;
function strike(p,e,a,api,z=groundHeight(p),factor=1){
  if(!e||!canHit(p,e,z))return false;
  return api.hit(p,e,a,factor,z);
}
function launch(p,power=8){
  ensure(p);
  if(p.id==='park'&&p.jumpState!=='ground')return false;
  p.z=Math.max(0,p.z);p.vz=Math.max(p.vz,cap(power,4,13));
  p.airControl=Math.max(p.airControl||0,35);
  p.takeoffAge=0;
  if(!p.jumpMotion||p.jumpMotion.phase==='landing')
    p.jumpMotion={phase:'rising',age:0,hover:0,kind:'knockup'};
  return true;
}
function phase(p,mode,a,target){
  ensure(p);
  if(mode==='burrowdash'){
    p.z=-31;p.vz=0;p.tunnel={time:Math.round(cap(a.duration,0.2,8)*60),target:target?.playerNum||null,a};
    mark('dust',p.x,p.y,40,color(p),22);
  } else if(mode==='hover'){
    // Rise to a held peak instead of teleporting directly to z=55.
    p.jumpMotion={phase:'prepare',age:0,charge:5,power:8.2,
      hover:Math.round(cap(a.duration,.2,8)*60),kind:'hover'};
    mark('ring',p.x,p.y,55,color(p),20);
  }
}
function execute(p,a,target,api){
  if(!TYPES[a.type])return false;
  ensure(p);
  const enemy=target?.hp>0?target:nearest(p),col=color(p);
  const distance=enemy?Math.hypot(enemy.x-p.x,enemy.y-p.y):0;
  const face=enemy?Math.atan2(enemy.y-p.y,enemy.x-p.x):Math.atan2(p.vy||0,p.vx||1);
  const radius=cap(a.radius||120,30,300),duration=Math.round(cap(a.duration||1.5,.2,8)*60);
  const soundType=['leap','hover','glide','burrowdash','erupt'].includes(a.type)?'dash':
    ['dive','uppercut','spinslash','grow','shrink'].includes(a.type)?'heavy':
    ['wall','portal','summon','turret','trap'].includes(a.type)?'rune':
    ['arcshot','splitshot'].includes(a.type)?'energy':'cast';
  sfx(soundType,.55);
  if(a.type==='leap'){
    p.jumpMotion={phase:'prepare',age:0,charge:7,power:9.8,hover:25,kind:'leap'};
    mark('ring',p.x,p.y,55,col,22);
  }
  else if(a.type==='hover'){phase(p,'hover',a,enemy);}
  else if(a.type==='glide'){
    p.jumpMotion={phase:'prepare',age:0,charge:5,power:8.6,hover:0,kind:'glide'};
    p.glideTime=duration;p.airControl=duration;mark('ring',p.x,p.y,45,col,18);
  }else if(a.type==='dive'){
    // Ground-cast dive follows the same takeoff -> apex -> slam choreography.
    if(groundHeight(p)<8){
      p.jumpMotion={phase:'prepare',age:0,charge:6,power:9.5,hover:8,kind:'dive'};
    }else{
      p.vz=-Math.max(8,a.speed||6);p.hoverTime=0;
      p.jumpMotion={phase:'descending',age:0,kind:'dive'};
    }
    p.slam={a,owner:p.playerNum};mark('target',p.x,p.y,radius*.58,col,30);
  }else if(a.type==='uppercut'){
    if(!enemy||distance>radius+enemy.radius)return true;
    // The mark appears where contact actually happens, not before it.
    if(strike(p,enemy,a,api)){
      launch(enemy,9);
      mark('cleave',enemy.x,enemy.y-groundHeight(enemy),42,col,17,face);
    }
  }else if(['slash','spinslash','thrust','aircombo'].includes(a.type)){
    if(!enemy)return true;
    const x=p.x,y=p.y;
    const shape=a.type==='thrust'?'line':a.type==='spinslash'?'ring':'sector';
    // Shared reach and angle are used by both the drawing and hit geometry.
    const telegraph=mark(shape,x,y,radius,col,a.type==='aircombo'?20:17,face);
    telegraph.follow=p;
    pushObject({kind:'melee',owner:p.playerNum,x,y,face,age:0,
      life:a.type==='aircombo'?44:21,trigger:10,
      a,shape,z:groundHeight(p),hits:0,impactAges:a.type==='aircombo'?[9,22,35]:[10]});
  }else if(a.type==='arcshot'||a.type==='splitshot'){
    if(!enemy)return true;
    for(let i=0;i<cap(Math.round(a.count||1),1,8);i++){
      const offset=(i-((a.count||1)-1)/2)*14;
      const destX=cap(enemy.x+Math.cos(face+Math.PI/2)*offset,18,canvas.width-18);
      const destY=cap(enemy.y+Math.sin(face+Math.PI/2)*offset,18,canvas.height-18);
      pushShot({kind:a.type,owner:p.playerNum,x:p.x,y:p.y,startX:p.x,startY:p.y,
        tx:destX,ty:destY,age:0,travel:a.type==='arcshot'?38:26,
        a,z:groundHeight(p),split:false,life:80});
      mark('target',destX,destY,Math.min(radius*.35,58),col,a.type==='arcshot'?42:25);
    }
  }else if(a.type==='wall'){
    const x=enemy?cap((p.x+enemy.x)/2,35,canvas.width-35):cap(p.x+Math.cos(face)*70,35,canvas.width-35);
    const y=enemy?cap((p.y+enemy.y)/2,35,canvas.height-35):cap(p.y+Math.sin(face)*70,35,canvas.height-35);
    pushObject({kind:'wall',owner:p.playerNum,x,y,r:cap(radius*.32,24,65),hp:Math.max(35,a.damage*3),maxHp:Math.max(35,a.damage*3),
      life:duration,age:0});mark('wall',x,y,45,col,12);
  }else if(a.type==='portal'){
    if(!enemy)return true;
    const offset=cap(radius*.4,45,100);
    const one={x:cap(p.x+Math.cos(face)*offset,25,canvas.width-25),y:cap(p.y+Math.sin(face)*offset,25,canvas.height-25)};
    const two={x:cap(enemy.x-Math.cos(face)*offset,25,canvas.width-25),y:cap(enemy.y-Math.sin(face)*offset,25,canvas.height-25)};
    pushObject({kind:'portal',owner:p.playerNum,x:one.x,y:one.y,exitX:two.x,exitY:two.y,r:24,life:duration,age:0,
      key:'A'+p.playerNum});
    pushObject({kind:'portal',owner:p.playerNum,x:two.x,y:two.y,exitX:one.x,exitY:one.y,r:24,life:duration,age:0,
      key:'B'+p.playerNum});
    mark('ring',one.x,one.y,34,col);mark('ring',two.x,two.y,34,col);
  }else if(['summon','turret','trap'].includes(a.type)){
    const x=cap(p.x+Math.cos(face)*45,25,canvas.width-25),y=cap(p.y+Math.sin(face)*45,25,canvas.height-25);
    pushObject({kind:a.type,owner:p.playerNum,x,y,r:a.type==='trap'?19:18,
      hp:Math.max(25,a.damage*2),maxHp:Math.max(25,a.damage*2),life:duration,age:0,
      vx:0,vy:0,next:25,a:{...a},target:enemy?.playerNum||null});
    mark(a.type==='trap'?'target':'ring',x,y,35,col,16);
  }else if(a.type==='grow'||a.type==='shrink'){
    p.bodyScale=a.type==='grow'?cap(1.25+a.count*.08,1.2,2.2):cap(.6-a.count*.015,.37,.8);
    p.radius=Math.max(13,p.baseRadius*p.bodyScale);
    p.sizeTimer=duration;mark('ring',p.x,p.y,p.radius+20,col);
  }else if(a.type==='burrowdash'){phase(p,'burrowdash',a,enemy);}
  else if(a.type==='erupt'){
    if(p.z<0)p.z=0;
    p.jumpMotion={phase:'prepare',age:0,charge:4,power:9.6,hover:0,kind:'erupt'};
    p.slam={a,owner:p.playerNum};
    mark('dust',p.x,p.y,radius*.55,col,19);
  }
  return true;
}
function stepHeight(p,api){
  ensure(p);
  if(p.sizeTimer>0&&--p.sizeTimer===0){p.bodyScale=1;p.radius=p.baseRadius;}
  if(p.tunnel?.time>0){
    p.tunnel.time--;
    const e=players.find(q=>q.playerNum===p.tunnel.target&&q.hp>0);
    if(e){const theta=Math.atan2(e.y-p.y,e.x-p.x);
      p.vx=Math.cos(theta)*Math.max(3,Math.abs(p.vx));p.vy=Math.sin(theta)*Math.max(3,Math.abs(p.vy));}
    if(p.tunnel.time<=0){
      p.z=0;
      mark('crack',p.x,p.y,55,color(p),28);
      for(const e of enemies(p))if(Math.hypot(e.x-p.x,e.y-p.y)<p.tunnel.a.radius*.6+e.radius)
        strike(p,e,p.tunnel.a,api,0);
      p.tunnel=null;
    }
    return;
  }
  if(p.id==='park'&&p.jumpState&&p.jumpState!=='ground')return;
  if(p.jumpMotion?.phase==='landing'){
    if(++p.jumpMotion.age>=12)p.jumpMotion=null;
  }
  if(p.jumpMotion?.phase==='prepare'){
    const pose=p.jumpMotion;
    if(++pose.age>=pose.charge){
      launch(p,pose.power);
      pose.phase='rising';pose.age=0;
      mark('dust',p.x,p.y,50,color(p),17);
      mark('ring',p.x,p.y,32,color(p),14);
    }
    return;
  }
  if(p.hoverTime>0){
    p.hoverTime--;
    p.z=Math.max(55,p.z);
    p.vz=0;
    if(p.hoverTime===0 && p.jumpMotion?.phase==='hovering'){
      p.jumpMotion.phase='descending';p.jumpMotion.age=0;
      p.vz=p.jumpMotion.kind==='dive'?-9:-2.7;
      mark('target',p.x,p.y,Math.max(45,p.slam?.a.radius*.5||50),color(p),20);
    }
    return;
  }
  if(p.z>0||p.vz>0){
    const previous=p.z;
    p.z=Math.max(0,p.z+p.vz);
    p.vz=cap(p.vz-.55,-13,15);
    if(p.jumpMotion?.phase==='rising'&&p.vz<=0){
      const pose=p.jumpMotion;pose.age=0;
      if(pose.hover>0){
        pose.phase='hovering';p.hoverTime=pose.hover;p.vz=0;
        mark('ring',p.x,p.y,30,color(p),14);
      }else{pose.phase='descending';}
    }
    if(p.jumpMotion?.phase==='descending')p.jumpMotion.age++;
    if(p.z===0&&previous>0){
      p.vz=0;
      p.jumpMotion={phase:'landing',age:0,kind:p.jumpMotion?.kind||'knockup'};
      mark('ring',p.x,p.y,75,color(p),24);
      mark('dust',p.x,p.y,63,color(p),22);
      add('burst',p.x,p.y,{r:42,col:color(p),life:18,stage:'impact'});
      sfx('heavy',.7);
      if(p.slam){
        const action=p.slam.a;
        for(const e of enemies(p))if(Math.hypot(e.x-p.x,e.y-p.y)<action.radius*.65+e.radius)
          strike(p,e,action,api,0);
        p.slam=null;
      }
    }
  }
  if(p.glideTime>0){
    p.glideTime--;
    if(p.z>0){p.vz=Math.max(p.vz,-1.25);p.vx*=1.012;p.vy*=1.012;}
  }
}
function ownerOf(o){return players.find(p=>p.playerNum===o.owner&&p.hp>0);}
// This collision geometry is the same sector / segment / disc drawn below.
function meleeContact(o,p,e){
  const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy);
  const reach=cap(o.a.radius||120,30,300),body=e.radius||0;
  if(o.shape==='ring')return d<=reach+body;
  if(o.shape==='line'){
    const forward=dx*Math.cos(o.face)+dy*Math.sin(o.face);
    const sideways=Math.abs(dx*Math.sin(o.face)-dy*Math.cos(o.face));
    return forward>=-body&&forward<=reach+body&&sideways<=Math.max(10,p.radius*.32)+body;
  }
  const direction=Math.atan2(dy,dx);
  const diff=Math.abs(Math.atan2(Math.sin(direction-o.face),Math.cos(direction-o.face)));
  const bodyAngle=Math.asin(cap(body/Math.max(d,body||1),0,1));
  return d<=reach+body&&diff<=1.03+bodyAngle;
}
function stepMelee(o,p,api){
  // The hero can move while swinging. Advance the visible weapon origin with
  // the physical attacker, rather than leaving a disconnected slash behind.
  o.x=p.x;o.y=p.y;
  const strikeIndex=o.impactAges.indexOf(o.age);
  if(strikeIndex<0)return;
  for(const e of enemies(p)){
    if(!meleeContact(o,p,e))continue;
    const mult=o.a.type==='aircombo'?.42:1;
    if(strike(p,e,o.a,api,o.z,mult)){
      o.hits++;
      if(o.a.type==='aircombo'&&strikeIndex===0){
        launch(e,5.5);
        launch(p,5.5);
      }
      const kind=o.shape==='line'?'stab':o.shape==='ring'?'cleave':'cut';
      // A hit mark is created only after a real hit and uses the target's
      // rendered height, preserving the vertical layer of the collision.
      const impactY=e.y-groundHeight(e);
      add(kind,e.x,impactY,{
        r:Math.min(54,Math.max(30,(e.radius||26)*1.35)),
        angle:o.face+(kind==='cut'?Math.PI/2:0),col:color(p),
        life:kind==='stab'?16:22,stage:'impact'
      });
      // The tiny directional impulse reinforces which way the blade struck.
      e.vx=(e.vx||0)+Math.cos(o.face)*.45;
      e.vy=(e.vy||0)+Math.sin(o.face)*.45;
    }
  }
  if(o.a.type==='aircombo'&&strikeIndex<o.impactAges.length-1){
    add('sector',p.x,p.y,{r:cap(o.a.radius||120,30,300),
      angle:o.face,col:color(p),life:10,stage:'telegraph',follow:p});
  }
}
function segmentDistance(x1,y1,x2,y2,px,py){
  const dx=x2-x1,dy=y2-y1;
  const t=cap(((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(px-(x1+dx*t),py-(y1+dy*t));
}
function updateProjectiles(api){
  for(let i=projectiles.length-1;i>=0;i--){
    const b=projectiles[i],p=ownerOf(b);if(!p){projectiles.splice(i,1);continue;}
    b.prevX=b.x;b.prevY=b.y;b.prevHeight=b.height||0;
    b.age++;b.life--;
    const t=cap(b.age/b.travel,0,1);
    b.x=b.startX+(b.tx-b.startX)*t;b.y=b.startY+(b.ty-b.startY)*t;
    b.height=b.kind==='arcshot'?4*t*(1-t)*88:0;
    b.trail.unshift({x:b.x,y:b.y-b.height});
    if(b.trail.length>(reduced?4:11))b.trail.pop();
    if(b.kind==='splitshot'&&!b.split&&t>=.56){
      b.split=true;const n=cap(Math.round(b.a.count||3),2,8);
      for(let j=0;j<n;j++){
        const theta=(j/n)*Math.PI*2;
        pushShot({kind:'fragment',owner:b.owner,x:b.x,y:b.y,startX:b.x,startY:b.y,
          tx:cap(b.x+Math.cos(theta)*Math.min(95,b.a.radius),15,canvas.width-15),
          ty:cap(b.y+Math.sin(theta)*Math.min(95,b.a.radius),15,canvas.height-15),
          age:0,travel:18,a:b.a,life:28,height:0});
      }
      mark('cleave',b.x,b.y,34,color(p),18,b.age*.24);
      mark('burst',b.x,b.y,33,color(p),17);
      b.life=0;
    }
    // Shards now strike along the actual path swept between two frames:
    // a character crossing that trajectory no longer gets inexplicably missed.
    if(b.kind==='fragment'&&b.life>0){
      for(const e of enemies(p)){
        if(segmentDistance(b.prevX,b.prevY,b.x,b.y,e.x,e.y)>(e.radius||0)+8)continue;
        if(strike(p,e,b.a,api,0,.5)){
          b.life=0;
          mark('stab',e.x,e.y-groundHeight(e),Math.max(24,e.radius),color(p),15,
            Math.atan2(b.ty-b.startY,b.tx-b.startX));
          break;
        }
      }
    }
    if(t>=1&&b.life>0){
      if(b.kind==='arcshot'){
        // The ground shadow, explosion ring and damage all occur on landing.
        const impactR=Math.min(55,Math.max(19,b.a.radius*.22));
        mark('burst',b.x,b.y,impactR*1.3,color(p),21);
        mark('ring',b.x,b.y,impactR,color(p),17);
        for(const e of enemies(p)){
          if(Math.hypot(e.x-b.x,e.y-b.y)<(e.radius||0)+impactR)
            strike(p,e,b.a,api,0);
        }
      }
      b.life=0;
    }
    if(b.life<=0)projectiles.splice(i,1);
  }
}
function stepObjects(api){
  for(let i=objects.length-1;i>=0;i--){
    const o=objects[i],p=ownerOf(o);
    if(!p){objects.splice(i,1);continue;}
    o.prevX=o.x;o.prevY=o.y;
    o.age++;o.life--;
    if(o.kind==='melee')stepMelee(o,p,api);
    else if(o.kind==='wall'){
      for(const e of players){
        if(e.hp<=0||Math.abs(groundHeight(e))>27)continue;
        const dx=e.x-o.x,dy=e.y-o.y,rawDistance=Math.hypot(dx,dy),dist=rawDistance||1,minimum=e.radius+o.r;
        if(rawDistance<minimum){
          const normalX=rawDistance>1e-6?dx/dist:(e.playerNum%2?1:-1);
          const normalY=rawDistance>1e-6?dy/dist:0;
          e.x=cap(o.x+normalX*minimum,e.radius,canvas.width-e.radius);
          e.y=cap(o.y+normalY*minimum,e.radius,canvas.height-e.radius);
          e.vx=normalX*Math.max(1,Math.abs(e.vx));
          e.vy=normalY*Math.max(1,Math.abs(e.vy));
          if(e!==p&&o.age%22===0)o.hp-=Math.max(2,Math.abs(e.vx)+Math.abs(e.vy));
        }
      }
    }else if(o.kind==='portal'){
      if(o.age>=15)for(const e of players){
        if(e.hp<=0||Math.abs(groundHeight(e))>32||e.portalCooldown>0||Math.hypot(e.x-o.x,e.y-o.y)>e.radius+o.r*.5)continue;
        e.x=cap(o.exitX,e.radius,canvas.width-e.radius);e.y=cap(o.exitY,e.radius,canvas.height-e.radius);
        e.portalCooldown=65;mark('ring',e.x,e.y,45,color(p),18);
      }
    }else if(o.kind==='trap'){
      if(o.age>16)for(const e of enemies(p)){
        if(Math.hypot(e.x-o.x,e.y-o.y)<o.r+e.radius && canHit(p,e,0)){
          strike(p,e,o.a,api,0);o.life=0;mark('burst',o.x,o.y,48,color(p));break;
        }
      }
    }else if(o.kind==='summon'||o.kind==='turret'){
      // A summoned creature physically chases its target; a turret stays put
      // and attacks from a distance. They must not share the same hit radius.
      const locked=players.find(e=>e.playerNum===o.target&&e.hp>0);
      const e=locked||nearestTo(o,p);
      if(e){
        o.target=e.playerNum;
        const dx=e.x-o.x,dy=e.y-o.y,d=Math.hypot(dx,dy)||1;
        const dirX=dx/d,dirY=dy/d;
        if(o.kind==='summon'){
          const chaseSpeed=cap(o.a.speed||5,2,9)*.76;
          const desired=cap((d-e.radius-o.r)*.20,0,chaseSpeed);
          o.vx=lerp(o.vx||0,dirX*desired,.24);
          o.vy=lerp(o.vy||0,dirY*desired,.24);
          // The pet physically occupies the position shown on screen.
          o.x=cap(o.x+o.vx,o.r,canvas.width-o.r);
          o.y=cap(o.y+o.vy,o.r,canvas.height-o.r);
        }
        const touch=o.kind==='summon'&&Math.hypot(e.x-o.x,e.y-o.y)<=e.radius+o.r+3;
        const inRange=o.kind==='turret'&&d<=o.a.radius+e.radius;
        if(o.age>=o.next&&(touch||inRange)){
          // Use the pet/turret's origin, so knockback and visual direction
          // match the source of the real attack rather than its summoner.
          const anchor={...p,x:o.x,y:o.y,z:0,vz:0};
          if(canHit(anchor,e,0)){
            const hit=api.hit?.(anchor,e,o.a,o.kind==='turret'?.62:.68,0);
            if(hit){
              const face=Math.atan2(e.y-o.y,e.x-o.x);
              if(o.kind==='turret')add('tether',o.x,o.y,{
                r:Math.hypot(e.x-o.x,e.y-o.y),angle:face,col:color(p),life:13,stage:'impact'});
              else{
                mark('slash',e.x,e.y-groundHeight(e),26,color(p),14,face);
                o.vx-=Math.cos(face)*2.5;o.vy-=Math.sin(face)*2.5;
              }
              mark('stab',e.x,e.y-groundHeight(e),Math.min(28,e.radius||25),
                color(p),14,face);
            }
          }
          o.next=o.age+(o.kind==='turret'?35:25);
        }
      }
    }
    if(o.hp!==undefined&&o.hp<=0)o.life=0;
    if(o.life<=0)objects.splice(i,1);
  }
}
function nearestTo(o,p){
  return enemies(p).sort((a,b)=>Math.hypot(a.x-o.x,a.y-o.y)-Math.hypot(b.x-o.x,b.y-o.y))[0];
}
function tick(api={}){
  // Invoked once from the engine's fixed-step update, never from rendering.
  visualFrame++;
  for(const p of players){
    if(p.portalCooldown>0)p.portalCooldown--;
    if(p.hp>0)stepHeight(p,api);
  }
  stepObjects(api);updateProjectiles(api);
  for(const p of players){
    const now={x:p.x,y:p.y,z:groundHeight(p)};
    const last=snapshots.get(p);
    // Re-matches allocate fresh fighter objects; WeakMap never retains stale actors.
    snapshots.set(p,{prev:last?.now||now,now});
  }
  for(let i=effects.length-1;i>=0;i--)if(--effects[i].life<=0)effects.splice(i,1);
}
function shape(ctx,e){
  const t=cap(1-e.life/e.max,0,1);
  const tOut=cap((1-t)/.27,0,1);
  const active=t>.34;
  const r=e.r, col=e.col;
  ctx.save();
  if(e.follow){
    const pos=visual(e.follow);
    ctx.translate(pos.x-e.x,pos.y-pos.z-e.y);
  }
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle=col;ctx.lineWidth=active?Math.max(1.5,3.8*tOut):1.8;
  ctx.globalAlpha=Math.min(1,tOut)*(active?.9:.65);
  ctx.setLineDash(active?[]:[5,5]);
  if(['cut','stab','cleave'].includes(e.kind)){
    // Impact glyphs mimic material being cut, never a generic explosion.
    const ca=Math.cos(e.angle),sa=Math.sin(e.angle);
    ctx.setLineDash([]);
    ctx.lineCap='round';
    ctx.globalAlpha=Math.pow(Math.max(0,1-t),.75);
    if(e.kind==='stab'){
      const len=e.r*(.4+.7*easeOut(t));
      ctx.strokeStyle='#15202b';ctx.lineWidth=4.3;
      ctx.beginPath();ctx.moveTo(e.x-ca*len*.85,e.y-sa*len*.85);
      ctx.lineTo(e.x+ca*len*.65,e.y+sa*len*.65);ctx.stroke();
      ctx.strokeStyle=col;ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(e.x-ca*len*.7,e.y-sa*len*.7);
      ctx.lineTo(e.x+ca*len*.9,e.y+sa*len*.9);ctx.stroke();
      const tipX=e.x+ca*len*.9,tipY=e.y+sa*len*.9;
      ctx.beginPath();ctx.moveTo(tipX,tipY);
      ctx.lineTo(tipX-ca*10-sa*5,tipY-sa*10+ca*5);
      ctx.lineTo(tipX-ca*10+sa*5,tipY-sa*10-ca*5);
      ctx.closePath();ctx.fillStyle=col;ctx.fill();
    }else{
      const len=e.r*(.64+.36*easeOut(t));
      function seam(dx,dy,turn){
        const angle=e.angle+turn,ux=Math.cos(angle),uy=Math.sin(angle);
        const x=e.x+dx,y=e.y+dy;
        ctx.strokeStyle='#101b26';ctx.lineWidth=4.4;
        ctx.beginPath();ctx.moveTo(x-ux*len,y-uy*len);
        ctx.quadraticCurveTo(x+uy*3,y-ux*3,x+ux*len,y+uy*len);
        ctx.stroke();
        ctx.strokeStyle=col;ctx.lineWidth=1.8;
        ctx.beginPath();ctx.moveTo(x-ux*len-uy*2,y-uy*len+ux*2);
        ctx.lineTo(x+ux*len-uy*2,y+uy*len+ux*2);ctx.stroke();
      }
      seam(0,0,0);
      if(e.kind==='cleave')seam(0,0,Math.PI/2);
      ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(e.x-ca*len*.8+sa*4,e.y-sa*len*.8-ca*4);
      ctx.lineTo(e.x+ca*len*.8+sa*4,e.y+sa*len*.8-ca*4);ctx.stroke();
    }
  }else if(e.kind==='tether'){
    const dist=e.r*easeOut(t<.5?t*2:1);
    const xx=e.x+Math.cos(e.angle)*dist,yy=e.y+Math.sin(e.angle)*dist;
    ctx.setLineDash([]);ctx.globalAlpha=Math.max(0,1-t);
    ctx.strokeStyle='#23303d';ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(xx,yy);ctx.stroke();
    ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(xx,yy,3,0,Math.PI*2);ctx.fill();
  }else if(e.kind==='sector'){
    const spread=active?(.12+easeOut((t-.34)/.6)*1.02):1.03;
    const start=e.angle-1.03;
    ctx.beginPath();ctx.moveTo(e.x,e.y);
    ctx.arc(e.x,e.y,r,start,start+2*spread);
    ctx.closePath();
    ctx.fillStyle=active?'rgba(70,82,97,.13)':'rgba(70,82,97,.055)';
    ctx.fill();ctx.stroke();
    if(active){
      ctx.setLineDash([]);ctx.lineWidth=5*tOut;
      ctx.beginPath();ctx.arc(e.x,e.y,r,start,start+2*spread);ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.88)';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.arc(e.x,e.y,r-3,start,start+2*spread);ctx.stroke();
    }
  }else if(e.kind==='line'){
    const direction=e.angle||0;
    const x1=e.x+Math.cos(direction)*10,y1=e.y+Math.sin(direction)*10;
    const x2=e.x+Math.cos(direction)*(r+10)*easeOut(t),y2=e.y+Math.sin(direction)*(r+10)*easeOut(t);
    ctx.setLineDash(active?[]:[6,6]);ctx.lineWidth=active?5*tOut:1.7;
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    if(active){ctx.strokeStyle='#fff';ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  }else if(e.kind==='crack'||e.kind==='dust'){
    ctx.setLineDash([]);ctx.strokeStyle=e.kind==='dust'?'#907a60':col;
    const growth=.35+easeOut(t)*.65;
    for(let j=0;j<(e.kind==='dust'?(reduced?5:9):7);j++){
      const a=j*Math.PI*2/(e.kind==='dust'?9:7)+e.x*.011;
      const off=j%2===0?1:.76;
      ctx.beginPath();
      ctx.moveTo(e.x+Math.cos(a)*r*.1,e.y+Math.sin(a)*r*.1);
      ctx.lineTo(e.x+Math.cos(a)*r*growth*off,e.y+Math.sin(a)*r*growth*off);
      ctx.stroke();
      if(e.kind==='dust'){
        ctx.fillStyle='rgba(123,103,75,.24)';
        ctx.beginPath();ctx.arc(e.x+Math.cos(a)*r*growth,e.y+Math.sin(a)*r*growth,Math.max(1,4*(1-t)),0,Math.PI*2);ctx.fill();
      }
    }
  }else if(e.kind==='burst'||e.kind==='slash'){
    ctx.setLineDash([]);ctx.lineWidth=3*tOut;
    for(let j=0;j<7;j++){
      const a=j*Math.PI*2/7+e.angle;
      const inside=9+12*t,outside=e.r*(.42+easeOut(t)*.78);
      ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*inside,e.y+Math.sin(a)*inside);
      ctx.lineTo(e.x+Math.cos(a)*outside,e.y+Math.sin(a)*outside);ctx.stroke();
    }
  }else if(e.kind==='wall'){
    const w=e.r*easeOut(t);
    ctx.strokeRect(e.x-w,e.y-w*.28,w*2,w*.56);
  }else{
    const size=e.kind==='ring'?r*(.18+easeOut(t)*.82):r;
    ctx.beginPath();ctx.arc(e.x,e.y,Math.max(2,size),0,Math.PI*2);
    ctx.fillStyle='rgba(80,85,94,.07)';ctx.fill();ctx.stroke();
    if(e.kind==='target'){
      ctx.setLineDash([]);
      for(let j=0;j<4;j++){
        const a=Math.PI/2*j+Math.PI/4;
        ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*r*.72,e.y+Math.sin(a)*r*.72);
        ctx.lineTo(e.x+Math.cos(a)*r*.95,e.y+Math.sin(a)*r*.95);ctx.stroke();
      }
    }
  }
  ctx.restore();
}
function draw(ctx){
  ctx.save();
  // Independent projectiles and constructs interpolate between physics ticks.
  for(const o of objects){
    const p=ownerOf(o);if(!p)continue;
    const col=color(p),age=o.age||0;
    const attacker=o.kind==='melee'?visual(p):null;
    const x=attacker?attacker.x:lerp(Number.isFinite(o.prevX)?o.prevX:o.x,o.x,alpha);
    const y=attacker?attacker.y-attacker.z:lerp(Number.isFinite(o.prevY)?o.prevY:o.y,o.y,alpha);
    const enter=o.kind==='melee'?1:easeOut(cap(age/14,0,1)),
      leave=cap(o.life/15,0,1);
    ctx.save();ctx.translate(x,y);ctx.scale(Math.max(.08,enter),Math.max(.08,enter));
    ctx.globalAlpha=Math.min(1,leave);
    ctx.strokeStyle=col;ctx.fillStyle='rgba(63,74,88,.1)';
    ctx.lineWidth=2.4;ctx.lineJoin='round';
    if(o.kind==='melee'){
      // The visible tip reaches exactly the same attack.radius on its hit frame.
      const ages=o.impactAges||[o.trigger];
      const cycle=ages.findIndex(n=>age<=n);
      const phase=cycle<0?ages.length-1:cycle;
      const start=phase===0?0:ages[phase-1]+1;
      const hitAge=ages[phase],local=cap((age-start)/Math.max(1,hitAge-start),0,1);
      const fraction=easeOut(local),span=cap(o.a.radius||120,30,300),ang=o.face;
      ctx.globalAlpha*=age>ages[ages.length-1]?Math.max(0,1-(age-ages[ages.length-1])/8):1;
      ctx.lineCap='round';ctx.lineJoin='round';
      ctx.lineWidth=3;ctx.strokeStyle='rgba(36,44,54,.75)';
      ctx.beginPath();ctx.arc(0,0,10,ang-.9,ang+.9);ctx.stroke();
      // Distinct weapon silhouettes: stabbing spear, sweeping crescent, or ring blade.
      ctx.lineWidth=Math.max(2,8*Math.sin(Math.PI*cap(local*.83+.05,0,1)));
      ctx.strokeStyle=col;ctx.beginPath();
      if(o.shape==='line'){
        ctx.moveTo(Math.cos(ang)*11,Math.sin(ang)*11);
        ctx.lineTo(Math.cos(ang)*span*fraction,Math.sin(ang)*span*fraction);
      }else if(o.shape==='ring'){
        ctx.arc(0,0,span,ang,ang+2*Math.PI*fraction);
      }else{
        ctx.arc(0,0,span,ang-1.03,ang-1.03+2.06*fraction);
      }
      ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.92)';ctx.lineWidth=1.8;ctx.stroke();
      if(o.shape==='line'){
        const tipX=Math.cos(ang)*span*fraction,tipY=Math.sin(ang)*span*fraction;
        const n=Math.max(3,8*fraction);
        ctx.fillStyle=col;ctx.beginPath();
        ctx.moveTo(tipX+Math.cos(ang)*n,tipY+Math.sin(ang)*n);
        ctx.lineTo(tipX-Math.cos(ang)*n-Math.sin(ang)*5,tipY-Math.sin(ang)*n+Math.cos(ang)*5);
        ctx.lineTo(tipX-Math.cos(ang)*n+Math.sin(ang)*5,tipY-Math.sin(ang)*n-Math.cos(ang)*5);
        ctx.closePath();ctx.fill();
      }
    }else if(o.kind==='wall'){
      const r=o.r;
      // The collision is circular, so show the whole solid footprint.
      ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);
      ctx.fillStyle='rgba(57,70,86,.16)';ctx.fill();
      ctx.lineWidth=3;ctx.stroke();
      ctx.fillStyle='rgba(63,74,88,.17)';
      ctx.beginPath();ctx.rect(-r,-r*.34,r*2,r*.68);ctx.fill();ctx.stroke();
      // Physical edges and diagonal hatching, distinct from a hologram.
      ctx.beginPath();
      for(let j=-r+8;j<r;j+=13){ctx.moveTo(j,-r*.34+4);ctx.lineTo(Math.min(r,j+11),r*.34-4);}
      ctx.lineWidth=1;ctx.stroke();
      ctx.fillStyle='#ddd';ctx.fillRect(-r,-r*.34-9,r*2,4);
      ctx.fillStyle=col;ctx.fillRect(-r,-r*.34-9,r*2*cap(o.hp/o.maxHp,0,1),4);
    }else if(o.kind==='portal'){
      const beat=1+Math.sin((visualFrame+age)*.09)*.07;
      ctx.save();ctx.scale(beat,1);
      ctx.setLineDash([5,4]);ctx.beginPath();ctx.ellipse(0,0,17,27,0,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,11,21,0,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=.32;ctx.fillStyle=col;ctx.fill();
      ctx.globalAlpha=.85;
      for(let j=0;j<4;j++){
        const angle=(visualFrame*.055+j*Math.PI/2);
        ctx.beginPath();ctx.arc(0,0,16,angle,angle+.32);ctx.stroke();
      }
      ctx.restore();
    }else if(o.kind==='summon'||o.kind==='turret'){
      const bob=o.kind==='summon'?Math.sin((visualFrame+age)*.12)*3:0;
      ctx.translate(0,bob);
      if(o.kind==='summon'){
        // An independent pet with head, ears, eyes and a trailing tail.
        const heading=Math.atan2(o.vy||0,o.vx||1);
        ctx.rotate(heading+Math.PI/2);
        ctx.strokeStyle=col;ctx.lineWidth=2.8;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(0,13);ctx.quadraticCurveTo(12,23,13+Math.sin(visualFrame*.16)*3,11);ctx.stroke();
        ctx.fillStyle='rgba(85,110,145,.28)';
        ctx.beginPath();ctx.ellipse(0,0,15,17,0,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12,-9);ctx.lineTo(-9,-23);ctx.lineTo(-2,-15);
        ctx.moveTo(12,-9);ctx.lineTo(9,-23);ctx.lineTo(2,-15);ctx.stroke();
        ctx.fillStyle='#fff';
        for(const ex of [-5,5]){ctx.beginPath();ctx.arc(ex,-4,3.6,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle='#162638';
        for(const ex of [-5,5]){ctx.beginPath();ctx.arc(ex,-5,1.7,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(-3,5);ctx.lineTo(3,5);ctx.lineTo(0,9);ctx.closePath();ctx.fill();
      }else{
        ctx.beginPath();ctx.rect(-13,-13,26,26);ctx.fill();ctx.stroke();
        const angle=Math.atan2(p.y-y,p.x-x);
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(angle)*13,Math.sin(angle)*13);ctx.stroke();
      }
      ctx.fillStyle='#ddd';ctx.fillRect(-13,-23,26,3);
      ctx.fillStyle=col;ctx.fillRect(-13,-23,26*cap(o.hp/o.maxHp,0,1),3);
    }else if(o.kind==='trap'){
      ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(0,0,19,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(15,10);ctx.lineTo(-15,10);ctx.closePath();
      ctx.globalAlpha*=.62+.38*Math.abs(Math.sin(visualFrame*.1));ctx.fill();ctx.stroke();
    }
    if(['wall','portal','summon','turret','trap'].includes(o.kind)){
      ctx.globalAlpha=Math.min(1,leave);ctx.fillStyle=col;
      ctx.font='600 10px "Noto Sans KR",system-ui';ctx.textAlign='center';
      ctx.fillText(o.kind==='summon'?'추적수 · '+Math.ceil(o.life/60)+'s':Math.ceil(o.life/60)+'s',0,o.r+18);
    }
    ctx.restore();
  }
  for(const b of projectiles){
    const p=ownerOf(b);if(!p)continue;
    const x=lerp(Number.isFinite(b.prevX)?b.prevX:b.x,b.x,alpha);
    const y=lerp(Number.isFinite(b.prevY)?b.prevY:b.y,b.y,alpha);
    const height=lerp(b.prevHeight||0,b.height||0,alpha);
    const dy=y-height,col=color(p);
    const direction=Math.atan2(b.ty-b.startY,b.tx-b.startX);
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    if(height>2){
      // A cast shadow with the projectile's exact ground footprint.
      ctx.fillStyle='rgba(33,40,47,.2)';ctx.beginPath();
      ctx.ellipse(x,y,9+height*.075,4+height*.025,0,0,Math.PI*2);ctx.fill();
    }
    if(b.trail?.length){
      const path=[{x,y:dy},...b.trail].slice(0,reduced?4:9);
      for(let i=1;i<path.length;i++){
        ctx.globalAlpha=.50*(1-i/path.length);
        ctx.lineWidth=Math.max(.75, (b.kind==='arcshot'?5:3.5)-i*.32);
        ctx.strokeStyle=col;
        ctx.beginPath();ctx.moveTo(path[i-1].x,path[i-1].y);
        ctx.lineTo(path[i].x,path[i].y);ctx.stroke();
      }
    }
    ctx.globalAlpha=1;ctx.translate(x,dy);
    ctx.rotate(direction+(b.kind==='splitshot'?b.age*.13:0));
    ctx.strokeStyle='#273443';ctx.lineWidth=2;ctx.fillStyle=col;
    if(b.kind==='arcshot'){
      // Heavy round shell: seam + fuse. Never confused with a sharp shard.
      ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.87)';
      ctx.beginPath();ctx.arc(-3,-4,2.7,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=1.3;
      ctx.beginPath();ctx.arc(0,0,6,-.6,1.55);ctx.stroke();
      ctx.strokeStyle='#273443';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-8,-8);ctx.lineTo(-13,-13);ctx.stroke();
    }else if(b.kind==='splitshot'){
      // Faceted unstable crystal with a visible fracture.
      ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(11,0);ctx.lineTo(0,13);
      ctx.lineTo(-11,0);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='#fff';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-2,-9);ctx.lineTo(3,-2);ctx.lineTo(-2,5);
      ctx.lineTo(2,10);ctx.stroke();
      ctx.strokeStyle=col;ctx.lineWidth=1.4;
      ctx.beginPath();ctx.arc(0,0,16,-.8,.6);ctx.stroke();
    }else{
      // Needle shard points forward and physically damages along this vector.
      ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-5,-5);ctx.lineTo(-2,0);
      ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='#fff';ctx.lineWidth=1.25;ctx.beginPath();
      ctx.moveTo(-3,-2);ctx.lineTo(8,0);ctx.stroke();
    }
    ctx.restore();
    if(b.age<14&&b.kind!=='fragment'&&!reduced){
      // A tiny typographic ID is shown only at launch; no permanent HUD clutter.
      ctx.save();ctx.fillStyle='rgba(24,30,38,.83)';
      const label=b.kind==='arcshot'?'곡사탄':'분열탄';
      ctx.font='600 10px "Noto Sans KR",system-ui';ctx.textAlign='center';
      ctx.fillText(label,x,dy-19);ctx.restore();
    }
  }
  for(const e of effects)shape(ctx,e);
  ctx.restore();
}
function activeLine(t){return Math.max(1,8*Math.sin(Math.PI*cap(t,0,1)));}
global.AdvancedCombat={TYPES,TYPE_NAMES,DESCRIPTIONS,objects,projectiles,effects,
  height:groundHeight,visibleHeight,visual,pose,setAlpha,setReduced,blend,size,renderY,canHit,
  launch,execute,tick,draw,reset,mark,ensure};
})(window);
