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
  effects.push({kind,x,y,life:opt.life||24,max:opt.life||24,r:opt.r||55,
    angle:opt.angle||0,col:opt.col||'#586779',stage:opt.stage||'telegraph'});
}
function mark(kind,x,y,r=65,col='#516170',life=22,angle=0){
  add(kind,x,y,{r,col,life,angle,stage:kind==='burst'||kind==='slash'?'impact':'telegraph'});
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
    if(!enemy||distance>radius)return true;
    mark('line',enemy.x,enemy.y,65,col,10);
    // Knock-up applies after a real hit; no lift through invulnerability.
    if(strike(p,enemy,a,api)&&launch(enemy,9))mark('ring',enemy.x,enemy.y,44,col,14);
  }else if(['slash','spinslash','thrust','aircombo'].includes(a.type)){
    if(!enemy)return true;
    const x=p.x,y=p.y;
    const shape=a.type==='thrust'?'line':a.type==='spinslash'?'ring':'sector';
    mark(shape,x,y,radius*.7,col,18,face);
    pushObject({kind:'melee',owner:p.playerNum,x,y,face,age:0,life:18,trigger:10,
      a,shape,z:groundHeight(p),done:false});
  }else if(a.type==='arcshot'||a.type==='splitshot'){
    if(!enemy)return true;
    for(let i=0;i<cap(Math.round(a.count||1),1,8);i++){
      const offset=(i-((a.count||1)-1)/2)*14;
      const destX=cap(enemy.x+Math.cos(face+Math.PI/2)*offset,18,canvas.width-18);
      const destY=cap(enemy.y+Math.sin(face+Math.PI/2)*offset,18,canvas.height-18);
      pushShot({kind:a.type,owner:p.playerNum,x:p.x,y:p.y,startX:p.x,startY:p.y,
        tx:destX,ty:destY,age:0,travel:a.type==='arcshot'?38:26,
        a,z:groundHeight(p),split:false,life:80});
      mark('target',destX,destY,Math.min(radius*.35,58),col,22);
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
    pushObject({kind:a.type,owner:p.playerNum,x,y,r:a.type==='trap'?19:16,
      hp:Math.max(25,a.damage*2),maxHp:Math.max(25,a.damage*2),life:duration,age:0,
      next:25,a:{...a},target:enemy?.playerNum||null});
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
function stepMelee(o,p,api){
  if(o.done||o.age<o.trigger)return;
  o.done=true;
  for(const e of enemies(p)){
    const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy);
    const angle=Math.atan2(dy,dx);
    let diff=Math.abs(Math.atan2(Math.sin(angle-o.face),Math.cos(angle-o.face)));
    const hit=o.shape==='ring'?d<=o.a.radius:
      o.shape==='line'?diff<.3&&d<o.a.radius:
      diff<1.03&&d<o.a.radius;
    if(hit&&strike(p,e,o.a,api,o.z)){
      if(o.a.type==='aircombo')launch(e,5);
      mark('slash',e.x,e.y,32,color(p),16);
    }
  }
}
function updateProjectiles(api){
  for(let i=projectiles.length-1;i>=0;i--){
    const b=projectiles[i],p=ownerOf(b);if(!p){projectiles.splice(i,1);continue;}
    b.prevX=b.x;b.prevY=b.y;b.prevHeight=b.height||0;
    b.age++;b.life--;
    const t=cap(b.age/b.travel,0,1);
    b.x=b.startX+(b.tx-b.startX)*t;b.y=b.startY+(b.ty-b.startY)*t;
    b.height=b.kind==='arcshot'?Math.sin(Math.PI*t)*88:0;
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
      mark('burst',b.x,b.y,34,color(p),18);
      b.life=0;
    }
    if(t>=1){
      if(b.kind==='arcshot')mark('burst',b.x,b.y,44,color(p),18);
      if(b.kind==='arcshot'||b.kind==='fragment'){
        for(const e of enemies(p))if(Math.hypot(e.x-b.x,e.y-b.y)<e.radius+Math.min(35,b.a.radius*.22))
          strike(p,e,b.a,api,0,b.kind==='fragment'?.5:1);
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
      const e=nearestTo(o,p);
      if(e){
        if(o.kind==='summon'){
          const d=Math.hypot(e.x-o.x,e.y-o.y)||1;o.x+=((e.x-o.x)/d)*1.95;o.y+=((e.y-o.y)/d)*1.95;
        }
        if(o.age>=o.next&&Math.hypot(e.x-o.x,e.y-o.y)<o.a.radius+e.radius){
          const anchor={...p,x:o.x,y:o.y};
          if(canHit(anchor,e,0))strike(p,e,o.a,api,0,o.kind==='turret'?.62:.5);
          mark('line',e.x,e.y,34,color(p),11);
          o.next=o.age+(o.kind==='turret'?35:29);
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
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle=col;ctx.lineWidth=active?Math.max(1.5,3.8*tOut):1.8;
  ctx.globalAlpha=Math.min(1,tOut)*(active?.9:.65);
  ctx.setLineDash(active?[]:[5,5]);
  if(e.kind==='sector'){
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
    const x=lerp(Number.isFinite(o.prevX)?o.prevX:o.x,o.x,alpha);
    const y=lerp(Number.isFinite(o.prevY)?o.prevY:o.y,o.y,alpha);
    const enter=easeOut(cap(age/14,0,1)),leave=cap(o.life/15,0,1);
    ctx.save();ctx.translate(x,y);ctx.scale(Math.max(.08,enter),Math.max(.08,enter));
    ctx.globalAlpha=Math.min(1,leave);
    ctx.strokeStyle=col;ctx.fillStyle='rgba(63,74,88,.1)';
    ctx.lineWidth=2.4;ctx.lineJoin='round';
    if(o.kind==='melee'){
      // The swing is drawn while its actual hit event is scheduled.
      const t=cap(age/(o.trigger+6),0,1);
      const span=o.a.radius*.75,ang=o.face;
      ctx.lineCap='round';ctx.lineWidth=activeLine(t);
      ctx.beginPath();
      if(o.shape==='ring'){
        ctx.arc(0,0,span*.84,ang+Math.PI*(t-.72),ang+Math.PI*(t*.92));
      }else if(o.shape==='line'){
        ctx.moveTo(Math.cos(ang)*12,Math.sin(ang)*12);
        ctx.lineTo(Math.cos(ang)*span*easeOut(t),Math.sin(ang)*span*easeOut(t));
      }else ctx.arc(0,0,span,ang-1.03,ang-1.03+2.06*easeOut(t));
      ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
    }else if(o.kind==='wall'){
      const r=o.r;
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
      ctx.beginPath();
      if(o.kind==='turret')ctx.rect(-13,-13,26,26);
      else{ctx.moveTo(0,-14);ctx.lineTo(14,11);ctx.lineTo(-14,11);ctx.closePath();}
      ctx.fill();ctx.stroke();
      const angle=o.kind==='summon'?visualFrame*.075:Math.atan2(p.y-y,p.x-x);
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(angle)*13,Math.sin(angle)*13);ctx.stroke();
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
      ctx.fillText(Math.ceil(o.life/60)+'s',0,o.r+18);
    }
    ctx.restore();
  }
  for(const b of projectiles){
    const p=ownerOf(b);if(!p)continue;
    const x=lerp(Number.isFinite(b.prevX)?b.prevX:b.x,b.x,alpha);
    const y=lerp(Number.isFinite(b.prevY)?b.prevY:b.y,b.y,alpha);
    const z=lerp(b.prevHeight||0,b.height||0,alpha);
    const dy=y-z,col=color(p);
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    if(z>2){
      ctx.fillStyle='rgba(55,62,69,.17)';ctx.beginPath();
      ctx.ellipse(x,y,8+z*.08,3.5+z*.023,0,0,Math.PI*2);ctx.fill();
    }
    // Curved flight path and thinning tail, with actual interpolated tip.
    if(b.trail?.length){
      const sequence=[{x,y:dy},...b.trail].slice(0,10);
      for(let i=1;i<sequence.length;i++){
        ctx.globalAlpha=.58*(1-i/sequence.length);
        ctx.strokeStyle=col;ctx.lineWidth=Math.max(.6,4-i*.35);
        ctx.beginPath();ctx.moveTo(sequence[i-1].x,sequence[i-1].y);
        ctx.lineTo(sequence[i].x,sequence[i].y);ctx.stroke();
      }
    }
    ctx.globalAlpha=1;ctx.strokeStyle=col;ctx.fillStyle=col;
    ctx.beginPath();
    if(b.kind==='fragment'){
      ctx.moveTo(x,dy-5);ctx.lineTo(x+5,dy+4);ctx.lineTo(x-5,dy+4);ctx.closePath();
    }else ctx.arc(x,dy,b.kind==='arcshot'?8:6,0,Math.PI*2);
    ctx.fill();ctx.lineWidth=1.6;ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.88)';
    ctx.beginPath();ctx.arc(x-2,dy-2,2,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  for(const e of effects)shape(ctx,e);
  ctx.restore();
}
function activeLine(t){return Math.max(1,8*Math.sin(Math.PI*cap(t,0,1)));}
global.AdvancedCombat={TYPES,TYPE_NAMES,objects,projectiles,effects,
  height:groundHeight,visibleHeight,visual,pose,setAlpha,setReduced,size,renderY,canHit,
  launch,execute,tick,draw,reset,mark,ensure};
})(window);
