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
const MAX_OBJECTS=24,MAX_PROJECTILES=90,MAX_EFFECTS=70;
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
function mark(kind,x,y,r=65,col='#516170',life=22){
  add(kind,x,y,{r,col,life,stage:'telegraph'});
}
function reset(){objects.length=0;projectiles.length=0;effects.length=0;}
function pushObject(o){if(objects.length>=MAX_OBJECTS)objects.shift();objects.push(o);return o;}
function pushShot(o){if(projectiles.length>=MAX_PROJECTILES)projectiles.shift();projectiles.push(o);return o;}
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
  return true;
}
function phase(p,mode,a,target){
  ensure(p);
  if(mode==='burrowdash'){
    p.z=-31;p.vz=0;p.tunnel={time:Math.round(cap(a.duration,0.2,8)*60),target:target?.playerNum||null,a};
    mark('dust',p.x,p.y,40,color(p),22);
  } else if(mode==='hover'){
    p.z=Math.max(p.z,55);p.vz=0;p.hoverTime=Math.round(cap(a.duration,.2,8)*60);
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
  const local={...a};
  if(a.type==='leap'){launch(p,8.8);mark('ring',p.x,p.y,55,col,22);}
  else if(a.type==='hover'){phase(p,'hover',a,enemy);}
  else if(a.type==='glide'){
    launch(p,7.4);p.glideTime=duration;p.airControl=duration;mark('ring',p.x,p.y,45,col,18);
  }else if(a.type==='dive'){
    if(groundHeight(p)<8)launch(p,8);
    p.vz=-Math.max(6,a.speed||6);p.hoverTime=0;
    p.slam={a,owner:p.playerNum};mark('target',p.x,p.y,radius*.58,col,24);
  }else if(a.type==='uppercut'){
    if(!enemy||distance>radius)return true;
    mark('line',enemy.x,enemy.y,65,col,10);
    // Knock-up applies after a real hit; no lift through invulnerability.
    if(strike(p,enemy,a,api)&&launch(enemy,9))mark('ring',enemy.x,enemy.y,44,col,14);
  }else if(['slash','spinslash','thrust','aircombo'].includes(a.type)){
    if(!enemy)return true;
    const x=a.type==='spinslash'?p.x:enemy.x,y=a.type==='spinslash'?p.y:enemy.y;
    const shape=a.type==='thrust'?'line':a.type==='spinslash'?'ring':'sector';
    mark(shape,x,y,radius*.7,col,14);
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
    launch(p,9);p.slam={a,owner:p.playerNum};
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
  if(p.hoverTime>0){
    p.hoverTime--;
    p.z=Math.max(55,p.z);
    p.vz=0;
    return;
  }
  if(p.z>0||p.vz>0){
    const previous=p.z;
    p.z=Math.max(0,p.z+p.vz);
    p.vz=cap(p.vz-.55,-13,15);
    if(p.z===0&&previous>0){
      p.vz=0;
      mark('ring',p.x,p.y,75,color(p),23);
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
    b.age++;b.life--;
    const t=cap(b.age/b.travel,0,1);
    b.x=b.startX+(b.tx-b.startX)*t;b.y=b.startY+(b.ty-b.startY)*t;
    b.height=b.kind==='arcshot'?Math.sin(Math.PI*t)*88:0;
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
  for(const p of players){
    if(p.portalCooldown>0)p.portalCooldown--;
    if(p.hp>0)stepHeight(p,api);
  }
  stepObjects(api);updateProjectiles(api);
  for(let i=effects.length-1;i>=0;i--)if(--effects[i].life<=0)effects.splice(i,1);
}
function shape(ctx,e){
  const progress=1-e.life/e.max;
  ctx.save();ctx.strokeStyle=e.col;ctx.fillStyle=e.col;
  ctx.globalAlpha=Math.min(.85,e.life/12);
  ctx.lineWidth=2;ctx.setLineDash(e.stage==='telegraph'?[5,6]:[]);
  if(e.kind==='sector'){
    ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.arc(e.x,e.y,e.r,e.angle-.95,e.angle+.95);ctx.closePath();ctx.fillStyle='rgba(80,80,90,.08)';ctx.fill();ctx.stroke();
  }else if(e.kind==='line'){
    ctx.beginPath();ctx.moveTo(e.x-e.r,e.y-2);ctx.lineTo(e.x+e.r,e.y+2);ctx.stroke();
  }else if(e.kind==='crack'||e.kind==='dust'){
    for(let j=0;j<7;j++){const a=j*Math.PI*2/7+e.x*.02;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*e.r*.18,e.y+Math.sin(a)*e.r*.18);ctx.lineTo(e.x+Math.cos(a)*e.r*.8,e.y+Math.sin(a)*e.r*.8);ctx.stroke();}
  }else if(e.kind==='burst'||e.kind==='slash'){
    for(let j=0;j<5;j++){const a=j*Math.PI*2/5+progress;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*10,e.y+Math.sin(a)*10);ctx.lineTo(e.x+Math.cos(a)*e.r,e.y+Math.sin(a)*e.r);ctx.stroke();}
  }else{
    ctx.beginPath();ctx.arc(e.x,e.y,e.r*(e.kind==='ring'?.4+progress*.6:1),0,Math.PI*2);ctx.fillStyle='rgba(70,75,85,.06)';ctx.fill();ctx.stroke();
  }
  ctx.restore();
}
function draw(ctx){
  ctx.save();
  for(const o of objects){
    const p=ownerOf(o);if(!p)continue;const col=color(p);
    ctx.save();ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.fillStyle='rgba(72,78,88,.12)';
    if(o.kind==='wall'){
      ctx.beginPath();ctx.rect(o.x-o.r,o.y-o.r*.34,o.r*2,o.r*.68);ctx.fill();ctx.stroke();
      ctx.fillStyle=col;ctx.fillRect(o.x-o.r,o.y-o.r*.34-7,o.r*2*(o.hp/o.maxHp),3);
    }else if(o.kind==='portal'){
      ctx.setLineDash([5,4]);ctx.beginPath();ctx.ellipse(o.x,o.y,17,27,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.ellipse(o.x,o.y,10,20,0,0,Math.PI*2);ctx.stroke();
    }else if(o.kind==='summon'||o.kind==='turret'){
      ctx.beginPath();
      if(o.kind==='turret'){ctx.rect(o.x-13,o.y-13,26,26);}
      else{ctx.moveTo(o.x,o.y-14);ctx.lineTo(o.x+14,o.y+11);ctx.lineTo(o.x-14,o.y+11);ctx.closePath();}
      ctx.fill();ctx.stroke();ctx.fillStyle=col;ctx.fillRect(o.x-13,o.y-24,26*(o.hp/o.maxHp),3);
    }else if(o.kind==='trap'){
      ctx.beginPath();ctx.moveTo(o.x,o.y-15);ctx.lineTo(o.x+15,o.y+10);ctx.lineTo(o.x-15,o.y+10);ctx.closePath();ctx.fill();ctx.stroke();
    }
    if(['wall','portal','summon','turret','trap'].includes(o.kind)){
      ctx.fillStyle=col;ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText(Math.ceil(o.life/60)+'s',o.x,o.y+o.r+15);
    }
    ctx.restore();
  }
  for(const b of projectiles){
    const p=ownerOf(b);if(!p)continue;
    ctx.save();ctx.strokeStyle=color(p);ctx.fillStyle='rgba(100,110,120,.15)';
    const displayY=b.y-(b.height||0);
    if(b.height>0){ctx.beginPath();ctx.ellipse(b.x,b.y,9,4,0,0,Math.PI*2);ctx.fill();}
    ctx.beginPath();ctx.arc(b.x,displayY,b.kind==='arcshot'?8:6,0,Math.PI*2);ctx.fillStyle=color(p);ctx.fill();
    ctx.beginPath();ctx.moveTo(b.x-(b.tx-b.startX)/b.travel*3,displayY-((b.ty-b.startY)/b.travel)*3);
    ctx.lineTo(b.x,displayY);ctx.stroke();ctx.restore();
  }
  for(const e of effects)shape(ctx,e);
  ctx.restore();
}
global.AdvancedCombat={TYPES,TYPE_NAMES,objects,projectiles,effects,
  height:groundHeight,size,renderY,canHit,launch,execute,tick,draw,reset,mark,ensure};
})(window);
