/* Bounded offline combat primitives shared by custom and classic fighters. */
(function(global){
'use strict';
const TYPES={homing:'유도탄',pierce:'관통탄',boomerang:'부메랑',chain:'연쇄 번개',nova:'주변 폭발',meteor:'운석',mine:'지뢰',drain:'흡혈',swap:'위치 교환',retreat:'후퇴',cleanse:'정화',haste:'가속',regen:'지속 재생',fortify:'피해 감소'};
const STATUSES={freeze:'빙결',stun:'기절',root:'속박',silence:'침묵',bleed:'출혈',shock:'감전',vulnerable:'취약',weak:'공격 약화',fear:'공포',charm:'매혹',blind:'실명',curse:'회복 저주'};
const DESCRIPTIONS={homing:'선택한 적을 따라가는 탄환',pierce:'적을 맞혀도 사라지지 않는 탄환 (적마다 1회)',boomerang:'발사 후 시전자에게 돌아오는 탄환 (적마다 1회)',chain:'범위 안의 다른 적에게 80% 위력으로 연쇄',nova:'자신 중심 범위 공격',meteor:'커다란 암석이 그림자·불꽃 꼬리와 함께 지면으로 낙하합니다. 착지 시점에만 표시된 반경 안에 피해를 줍니다',mine:'자신 위치에 설치, 0.33초 후 접근한 적에게 폭발',drain:'범위 안 적에게 준 피해의 50% 회복',swap:'선택한 적과 위치 교환',retreat:'적 반대 방향으로 범위만큼 후퇴',cleanse:'이 제작기의 상태이상·지속 피해·둔화 제거',haste:'지속 시간 동안 이동량 60% 증가',regen:'0.5초마다 위력의 25% 회복',fortify:'직접 공격으로 받는 피해 45% 감소'};
const STATUS_HELP={none:'추가 효과 없음',ice:'1.5초간 이동 50% 감소',fire:'지속 시간 동안 0.5초마다 지속 피해',poison:'지속 시간 동안 0.5초마다 지속 피해',freeze:'이동과 행동 정지',stun:'이동과 행동 정지',root:'이동 정지, 공격 가능',silence:'행동과 접촉 공격 정지, 이동 가능',bleed:'0.5초마다 체력 3 감소',shock:'이동 30% 감소, 0.5초마다 체력 2 감소',vulnerable:'직접 받는 피해 35% 증가',weak:'직접 주는 피해 40% 감소',fear:'시전자 반대 방향으로 이동',charm:'시전자 방향으로 이동',blind:'직접 주는 피해 35% 감소',curse:'회복량 60% 감소'};
Object.assign(TYPES,{flight:'공중 강하',burrow:'지하 습격',blackhole:'블랙홀',starfall:'우주 별비',dung:'똥 폭탄',lifebloom:'생명의 꽃',resurrect:'부활',timestop:'시간 정지',rewind:'시간 되감기',timeburst:'시간 가속'});
Object.assign(DESCRIPTIONS,{flight:'최대 3초간 공중에서 직접 공격 회피 후 주변에 착지 피해',burrow:'최대 3초간 지하에서 회피 후 적 위치로 솟아올라 공격',blackhole:'적 위치에 중력장을 만들어 끌어당기고 주기적 피해',starfall:'시전자 상공에서 별이 줄지어 낙하합니다. 각 별은 꼬리·지면 그림자를 표시하고, 실제 착지한 순간에만 주변 적에게 피해를 줍니다',dung:'갈색 똥 폭탄이 날아가 명중 시 중독과 둔화',lifebloom:'자신 위치에 꽃을 심어 머무르는 동안 회복',resurrect:'스킬에 포함하면 경기당 1회 자동 부활, 최대 체력의 35% 회복',timestop:'범위 안 적을 최대 2초간 이동·행동 정지 (지속 피해는 계속)',rewind:'자신의 체력과 위치를 최대 3초 전으로 복원, 사망 후에는 불가',timeburst:'지속 시간 동안 자신의 스킬 충전 속도 2배'});
function revive(p){
  if(p.hp>0||p.forgeRevived||!p.forge?.skills.some(s=>s.actions.some(a=>a.type==='resurrect')))return false;
  p.forgeRevived=true;p.hp=Math.max(1,Math.round(p.maxHp*.35));p.invincible=90;
  p.forgeEffects={};p.bfDot=0;p.slowTimer=0;p.slowMultiplier=1;p.forgePhase=null;p.forgeHistory=[];
  addFloatingText('부활',p.x,p.y-35,'#047857',18);return true;
}
const active=(p,key)=>(p.forgeEffects?.[key]?.time||0)>0;
const blocked=p=>active(p,'stun')||active(p,'freeze')||active(p,'silence');
function effect(p,key,time,source,power=0){
  p.forgeEffects ||= {};
  p.forgeEffects[key]={time:Math.max(p.forgeEffects[key]?.time||0,Math.min(480,Math.max(12,time))),source:source?.playerNum,power,age:0};
}
function applyStatus(p,e,a){
  if(STATUSES[a.status])effect(e,a.status,Math.round((a.duration||1.5)*60),p,a.damage);
}
function damageScale(p,e){return (active(p,'weak')?.6:1)*(active(p,'blind')?.65:1)*(active(e,'vulnerable')?1.35:1)*(active(e,'fortify')?.55:1);}
function legacy(p,fn){
  const before=players.map(e=>({e,hp:e.hp})),ownHp=p.hp;fn();
  if(p.hp>ownHp&&active(p,'curse'))p.hp=ownHp+(p.hp-ownHp)*.4;
  for(const {e,hp} of before)if(e!==p&&e.hp<hp)e.hp=Math.max(0,hp-(hp-e.hp)*damageScale(p,e));
}
function heal(p,amount){if(p.hp<=0)return;const n=active(p,'curse')?amount*.4:amount;p.hp=Math.min(p.maxHp,p.hp+n);}
function tick(p){
  revive(p);if(p.hp<=0)return;
  if(p.forge){p.forgeHistory ||= [];p.forgeHistory.push({x:p.x,y:p.y,hp:p.hp});if(p.forgeHistory.length>181)p.forgeHistory.shift();}
  if(p.forgePhase?.time>0){p.forgePhase.time--;p.invincible=Math.max(p.invincible||0,2);}
  for(const [key,v] of Object.entries(p.forgeEffects||{})){
    v.age++;v.time--;
    if(v.age%30===0){
      if(key==='bleed'||key==='shock'){
        const d=key==='bleed'?3:2;p.hp=Math.max(0,p.hp-d);addFloatingText('-'+d,p.x,p.y-30,'#b34869',13);
      }
      if(key==='regen')heal(p,Math.max(1,v.power/4));
    }
    if(v.time<=0)delete p.forgeEffects[key];
  }
  if(active(p,'fear')||active(p,'charm')){
    const key=active(p,'fear')?'fear':'charm',src=players.find(e=>e.playerNum===p.forgeEffects[key].source&&e.hp>0);
    if(src){const angle=Math.atan2(src.y-p.y,src.x-p.x)+(key==='fear'?Math.PI:0),speed=Math.max(1,Math.hypot(p.vx,p.vy));p.vx=Math.cos(angle)*speed;p.vy=Math.sin(angle)*speed;}
  }
}
function movement(p){return active(p,'freeze')||active(p,'stun')||active(p,'root')?0:(active(p,'haste')?1.6:1)*(active(p,'shock')?.7:1);}
const clampPosition=p=>{p.x=Math.max(p.radius,Math.min(canvas.width-p.radius,p.x));p.y=Math.max(p.radius,Math.min(canvas.height-p.radius,p.y));};
function execute(p,a,target,api){
  if(!TYPES[a.type])return false;
  const foes=api.enemies(p),near=global.AbilityAtlas?.choose(p,foes,a.target)||target;
  const show=(x,y,r)=>{if(global.BattleFX?.mark)global.BattleFX.mark('wave',x,y,(p.forge.effectColor||p.forge.color),r);};
  const around=(x,y,r)=>foes.filter(e=>Math.hypot(e.x-x,e.y-y)<=r+e.radius);
  p.forgeExtras ||= [];
  if(a.type==='resurrect')return true;
  if(a.type==='rewind'){
    const history=p.forgeHistory||[],old=history[Math.max(0,history.length-1-Math.min(180,Math.round(a.duration*60)))];
    if(old){p.x=old.x;p.y=old.y;p.hp=Math.max(1,Math.min(p.maxHp,old.hp));clampPosition(p);show(p.x,p.y,50);}return true;
  }
  if(['cleanse','haste','regen','fortify','timeburst'].includes(a.type)){
    if(a.type==='cleanse'){
      for(const key of Object.keys(STATUSES))if(p.forgeEffects)delete p.forgeEffects[key];
      p.slowTimer=0;p.slowMultiplier=1;p.bfDot=0;
    }else effect(p,a.type,a.duration*60,p,a.damage);
    show(p.x,p.y,p.radius+12);return true;
  }
  if(a.type==='nova'){show(p.x,p.y,a.radius);global.SkillVisuals?.detonate?.(p,'nova',p.x,p.y,a.radius);around(p.x,p.y,a.radius).forEach(e=>api.hit(p,e,a));return true;}
  if(!near)return true;
  const angle=Math.atan2(near.y-p.y,near.x-p.x);
  if(a.type==='flight'||a.type==='burrow'){
    if(global.AdvancedCombat){
      if(a.type==='flight'){
        AdvancedCombat.execute(p,{...a,type:'hover'},near,api);
        p.slam={a,owner:p.playerNum};
      }else AdvancedCombat.execute(p,{...a,type:'burrowdash'},near,api);
      return true;
    }
    if(!p.forgePhase)p.forgePhase={kind:a.type,time:Math.min(180,Math.round(a.duration*60)),a,target:near.playerNum};
    p.invincible=Math.max(p.invincible||0,2);return true;
  }
  if(a.type==='timestop'){around(p.x,p.y,a.radius).forEach(e=>{if(e.invincible<=0)effect(e,'freeze',Math.min(120,a.duration*60),p);});show(p.x,p.y,a.radius);return true;}
  if(a.type==='blackhole'||a.type==='lifebloom'){
    p.forgeExtras.push({kind:a.type,x:a.type==='lifebloom'?p.x:near.x,y:a.type==='lifebloom'?p.y:near.y,life:Math.round(a.duration*60),age:0,a});
  }else if(a.type==='starfall'){
    // Staggered descending bodies, not instant area markers.
    const amount=Math.max(1,Math.min(8,Math.round(a.count||5)));
    for(let i=0;i<amount;i++){
      const angle=i*2.399963,ring=i===0?0:(18+Math.sqrt(i/amount)*a.radius*.55);
      const x=Math.max(20,Math.min(canvas.width-20,near.x+Math.cos(angle)*ring));
      const y=Math.max(20,Math.min(canvas.height-20,near.y+Math.sin(angle)*ring));
      const delay=i*7,flight=Math.max(18,Math.min(65,Math.round(150/Math.max(2,a.speed||6))))+(i%3)*3;
      p.forgeExtras.push({kind:'starfall',x,y,age:0,life:delay+flight,
        delay,flight,total:delay+flight,hit:false,a});
    }
  }else if(a.type==='dung'){
    p.forgeExtras.push({kind:'dung',x:p.x,y:p.y,vx:Math.cos(angle)*a.speed,vy:Math.sin(angle)*a.speed,life:Math.ceil(a.radius/a.speed*3),age:0,hits:[],a:{...a,status:'poison'}});
  }

  if(['homing','pierce','boomerang'].includes(a.type)){
    for(let i=0;i<a.count;i++){const t=angle+(i-(a.count-1)/2)*.15;p.forgeExtras.push({kind:a.type,x:p.x,y:p.y,vx:Math.cos(t)*a.speed,vy:Math.sin(t)*a.speed,life:Math.ceil(a.radius/a.speed*3),age:0,target:near.playerNum,hits:[],a});}
  }else if(a.type==='chain'){
    let origin=p;const visited=new Set();
    for(let i=0;i<a.count;i++){
      const next=foes.filter(e=>!visited.has(e)&&Math.hypot(e.x-origin.x,e.y-origin.y)<=a.radius).sort((x,y)=>Math.hypot(x.x-origin.x,x.y-origin.y)-Math.hypot(y.x-origin.x,y.y-origin.y))[0];
      if(!next)break;
      global.BattleFX?.beam?.(origin.x,origin.y,next.x,next.y,(p.forge.effectColor||p.forge.color));api.hit(p,next,a,Math.pow(.8,i));visited.add(next);origin=next;
    }
  }else if(a.type==='meteor'||a.type==='mine'){
    const travel=Math.max(20,Math.min(75,Math.round(270/Math.max(2,a.speed||6))));
    p.forgeExtras.push({kind:a.type,
      x:a.type==='mine'?p.x:near.x,y:a.type==='mine'?p.y:near.y,
      life:a.type==='mine'?Math.round(a.duration*60):travel,
      age:0,flight:a.type==='meteor'?travel:0,a});
  }else if(a.type==='drain'){
    if(Math.hypot(near.x-p.x,near.y-p.y)<=a.radius){const hp=near.hp;if(api.hit(p,near,a))heal(p,(hp-near.hp)*.5);show(near.x,near.y,30);}
  }else if(a.type==='swap'){
    [p.x,near.x]=[near.x,p.x];[p.y,near.y]=[near.y,p.y];clampPosition(p);clampPosition(near);show(p.x,p.y,40);show(near.x,near.y,40);
  }else if(a.type==='retreat'){
    p.x-=Math.cos(angle)*a.radius;p.y-=Math.sin(angle)*a.radius;clampPosition(p);show(p.x,p.y,30);
  }
  if(p.forgeExtras.length>48)p.forgeExtras.splice(0,p.forgeExtras.length-48);
  return true;
}
function update(p,api){
  if(p.forgePhase&&p.forgePhase.time<=0){
    const phase=p.forgePhase;p.forgePhase=null;
    const target=players.find(e=>e.playerNum===phase.target&&e.hp>0);
    if(phase.kind==='burrow'&&target){p.x=target.x;p.y=target.y;clampPosition(p);}
    api.enemies(p).filter(e=>Math.hypot(e.x-p.x,e.y-p.y)<phase.a.radius+e.radius).forEach(e=>api.hit(p,e,phase.a));
    global.BattleFX?.mark?.('wave',p.x,p.y,(p.forge.effectColor||p.forge.color),phase.a.radius);
  }
  const extras=p.forgeExtras||[];
  for(let i=extras.length-1;i>=0;i--){
    const b=extras[i];b.age++;b.life--;
    if(b.kind==='blackhole'||b.kind==='lifebloom'){
      if(b.kind==='lifebloom'){if(b.age%30===0&&Math.hypot(p.x-b.x,p.y-b.y)<b.a.radius)heal(p,b.a.damage*.25);}
      else for(const e of api.enemies(p))if(Math.hypot(e.x-b.x,e.y-b.y)<b.a.radius+e.radius){
        const angle=Math.atan2(b.y-e.y,b.x-e.x);if(e.invincible<=0){e.vx+=Math.cos(angle)*.5;e.vy+=Math.sin(angle)*.5;}
        if(b.age%30===0)api.hit(p,e,{...b.a,knockback:0},.35);
      }
    }else if(b.kind==='starfall'){
      if(!b.hit&&b.age>=b.delay+b.flight){
        b.hit=true;
        const impact=Math.max(24,Math.min(58,b.a.radius*.31));
        global.SkillVisuals?.detonate?.(p,'starfall',b.x,b.y,impact);
        global.AdvancedCombat?.mark?.('burst',b.x,b.y,impact,(p.forge.effectColor||p.forge.color),20);
        global.AdvancedCombat?.mark?.('ring',b.x,b.y,impact,(p.forge.effectColor||p.forge.color),24);
        global.BattleFX?.sound?.('heavy',.4);
        for(const e of api.enemies(p)){
          if(Math.hypot(e.x-b.x,e.y-b.y)<=impact+e.radius
            &&(!global.AdvancedCombat||global.AdvancedCombat.canHit(p,e,0)))
            api.hit(p,e,b.a);
        }
        b.life=0;
      }
    }else if(b.kind==='meteor'||b.kind==='mine'){
      const foes=api.enemies(p).filter(e=>Math.hypot(e.x-b.x,e.y-b.y)<b.a.radius+e.radius);
      if((b.kind==='meteor'&&b.life<=0)||(b.kind==='mine'&&b.age>=20&&foes.length)){
        global.BattleFX?.mark?.('wave',b.x,b.y,(p.forge.effectColor||p.forge.color),b.a.radius);
        global.SkillVisuals?.detonate?.(p,b.kind,b.x,b.y,b.a.radius);
        foes.forEach(e=>api.hit(p,e,b.a));b.life=0;
      }
    }else{
      const target=b.kind==='boomerang'&&b.age>20?p:players.find(e=>e.playerNum===b.target&&e.hp>0);
      if(target&&(b.kind==='homing'||(b.kind==='boomerang'&&b.age>20))){
        const angle=Math.atan2(target.y-b.y,target.x-b.x);b.vx=Math.cos(angle)*b.a.speed;b.vy=Math.sin(angle)*b.a.speed;
      }
      const fromX=b.x,fromY=b.y;
      b.x+=b.vx;b.y+=b.vy;
      // Every ground-level moving projectile is intercepted by real walls.
      if(global.AdvancedCombat?.blockSegment?.(
        fromX,fromY,b.x,b.y,b.a?.damage||10,0)){
        extras.splice(i,1);continue;
      }
      for(const e of api.enemies(p))if(!b.hits.includes(e.playerNum)&&
        (global.ActionRegistry?.sweptCircle?.(fromX,fromY,b.x,b.y,e.x,e.y,e.radius+8)??
          Math.hypot(e.x-b.x,e.y-b.y)<=e.radius+8)&&
        api.hit(p,e,b.a,1,0)){
        b.hits.push(e.playerNum);
        global.AdvancedCombat?.mark?.('burst',e.x,e.y,20,(p.forge.effectColor||p.forge.color),13);
        if(b.kind==='dung'){e.slowTimer=Math.round(b.a.duration*60);e.slowMultiplier=.5;}
        if(b.kind==='homing'||b.kind==='dung'){b.life=0;break;}
      }
      if(b.kind==='boomerang'&&b.age>20&&Math.hypot(b.x-p.x,b.y-p.y)<p.radius)b.life=0;
    }
    if(b.life<=0)extras.splice(i,1);
  }
}
function draw(p){
  if(p.hp<=0)return;
  ctx.save();ctx.strokeStyle=global.arenaEffectColor?.(p.forge?.color||p.themeColor)||(p.forge?.color||p.themeColor||'#684f83');ctx.lineWidth=2.5;ctx.fillStyle=ctx.strokeStyle;
  for(const b of p.forgeExtras||[]){
    ctx.save();const area=['meteor','mine','blackhole','lifebloom'].includes(b.kind);
    if(b.kind==='meteor'){
      // The same speed-derived descent timeline drives both the animation and
      // the impact/damage in update(): no ground explosion until landing.
      const t=Math.max(0,Math.min(1,b.age/(b.flight||45)));
      const fall=1-(1-t)*(1-t);
      const height=190*(1-fall),rockX=b.x-42*(1-t),rockY=b.y-height;
      ctx.strokeStyle='#9b5d3a';ctx.lineWidth=2;
      ctx.fillStyle='rgba(45,49,56,.13)';
      ctx.beginPath();ctx.arc(b.x,b.y,b.a.radius,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='rgba(34,41,48,.24)';
      ctx.beginPath();ctx.ellipse(b.x,b.y,19+15*t,6+4*t,0,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.lineCap='round';
      const trail=1-t;
      ctx.strokeStyle='#d6803f';ctx.lineWidth=10*trail+2;
      ctx.beginPath();ctx.moveTo(rockX-65*trail,rockY-90*trail);
      ctx.lineTo(rockX,rockY);ctx.stroke();
      ctx.strokeStyle='#f5c170';ctx.lineWidth=3*trail+1;
      ctx.beginPath();ctx.moveTo(rockX-50*trail,rockY-65*trail);
      ctx.lineTo(rockX,rockY);ctx.stroke();
      ctx.translate(rockX,rockY);ctx.rotate(b.age*.07);
      ctx.fillStyle='#796250';ctx.strokeStyle='#3a3632';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(-23,-11);ctx.lineTo(-8,-26);ctx.lineTo(18,-16);
      ctx.lineTo(27,8);ctx.lineTo(6,23);ctx.lineTo(-23,16);ctx.closePath();
      ctx.fill();ctx.stroke();
      ctx.strokeStyle='#b69c7f';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-15,-6);ctx.lineTo(-3,-15);ctx.lineTo(9,-11);
      ctx.moveTo(6,4);ctx.lineTo(19,9);ctx.stroke();ctx.restore();
    }else if(b.kind==='starfall'){
      // Height, sky streak and shadow derive from one fall progress.
      if(b.age>=b.delay){
        const t=Math.max(0,Math.min(1,(b.age-b.delay)/b.flight));
        const height=(1-t)*118;
        const sx=b.x-36*(1-t),sy=b.y-height;
        const flicker=1+Math.sin((b.age+b.x)*.25)*.08;
        ctx.globalAlpha=.22;ctx.fillStyle='#424a55';
        ctx.beginPath();ctx.ellipse(b.x,b.y,8+t*10,3+t*4,0,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=1;ctx.strokeStyle='#456eaf';
        ctx.lineWidth=4.5;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(sx-29*(1-t),sy-34*(1-t));
        ctx.lineTo(sx,sy);ctx.stroke();
        ctx.strokeStyle='rgba(158,199,241,.8)';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(sx-17*(1-t),sy-22*(1-t));
        ctx.lineTo(sx,sy);ctx.stroke();
        ctx.fillStyle='#f3db82';ctx.strokeStyle='#3d6088';ctx.lineWidth=1.5;
        ctx.beginPath();
        for(let k=0;k<10;k++){
          const a=-Math.PI/2+k*Math.PI/5,r=(k%2?5:11)*flicker;
          const px=sx+Math.cos(a)*r,py=sy+Math.sin(a)*r;
          if(k===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
        }
        ctx.closePath();ctx.fill();ctx.stroke();
      }
    }else if(b.kind==='dung'){
      ctx.fillStyle='#713f12';ctx.beginPath();ctx.arc(b.x,b.y,10,0,Math.PI*2);ctx.fill();ctx.font='16px sans-serif';ctx.fillText('💩',b.x-8,b.y+5);
    }else if(['homing','pierce','boomerang'].includes(b.kind)){
      // Silhouettes follow velocity: guided dart, piercing spear, returning arc.
      const face=Math.atan2(b.vy||0,b.vx||1);
      ctx.save();ctx.translate(b.x,b.y);ctx.rotate(face);
      ctx.globalAlpha=.3;ctx.lineWidth=3.5;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(-25,0);ctx.lineTo(-6,0);ctx.stroke();
      ctx.globalAlpha=1;ctx.strokeStyle='#29364b';ctx.lineWidth=2;
      ctx.fillStyle=b.kind==='homing'?'#50a3bc':b.kind==='pierce'?'#aa7484':'#7a83c1';
      ctx.beginPath();
      if(b.kind==='homing'){
        ctx.moveTo(12,0);ctx.lineTo(-4,-7);ctx.lineTo(-1,0);ctx.lineTo(-4,7);
      }else if(b.kind==='pierce'){
        ctx.moveTo(19,0);ctx.lineTo(-5,-4);ctx.lineTo(-13,0);ctx.lineTo(-5,4);
      }else{
        ctx.moveTo(9,-11);ctx.lineTo(-11,-11);ctx.lineTo(-2,-3);
        ctx.lineTo(-2,3);ctx.lineTo(-11,11);ctx.lineTo(9,11);
        ctx.lineTo(2,3);ctx.lineTo(2,-3);
      }
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();
    }else if(b.kind==='blackhole'){
      const t=b.age*.065,r=b.a.radius;
      ctx.strokeStyle='#615693';ctx.lineWidth=2;
      for(let i=0;i<3;i++){
        ctx.beginPath();
        for(let k=0;k<=20;k++){
          const a=t+i*Math.PI*2/3+k*.18,d=r*(.9-k/26);
          const x=b.x+Math.cos(a)*d,y=b.y+Math.sin(a)*d;
          if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
      ctx.fillStyle='#302f54';ctx.beginPath();ctx.arc(b.x,b.y,13,0,Math.PI*2);ctx.fill();
    }else if(b.kind==='lifebloom'){
      const r=b.a.radius,t=b.age*.03;
      ctx.strokeStyle='#238063';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(b.x,b.y,r,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3+t;
        ctx.beginPath();ctx.ellipse(b.x+Math.cos(a)*12,b.y+Math.sin(a)*12,6,12,a,0,Math.PI*2);
        ctx.stroke();
      }
      ctx.fillStyle='#30956e';ctx.beginPath();ctx.arc(b.x,b.y,6,0,Math.PI*2);ctx.fill();
    }else if(b.kind==='mine'){
      ctx.strokeStyle='#9a603e';ctx.setLineDash([5,5]);
      // Danger ring is the actual proximity trigger and blast radius.
      ctx.beginPath();ctx.arc(b.x,b.y,b.a.radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#9a603e';ctx.beginPath();ctx.arc(b.x,b.y,10,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(b.x-4,b.y);ctx.lineTo(b.x+4,b.y);ctx.stroke();
    }else if(area){
      // Meteor's entire damage region must be shown during its warning.
      const r=b.a.radius;
      ctx.beginPath();ctx.arc(b.x,b.y,r,0,Math.PI*2);ctx.stroke();

    }else{
      ctx.beginPath();ctx.arc(b.x,b.y,7,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
    ctx.restore();
  }
  if(p.forgePhase){ctx.setLineDash([5,4]);ctx.beginPath();ctx.ellipse(p.x,p.y+8,p.radius+6,12,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}

  ctx.font='11px sans-serif';ctx.textAlign='center';
  const names=Object.keys(p.forgeEffects||{}).map(k=>STATUSES[k]||TYPES[k]).filter(Boolean);
  if(names.length)ctx.fillText(names.slice(0,3).join(' · '),p.x,p.y+p.radius+16);
  ctx.restore();
}
global.ForgeExpansion={revive,active,TYPES,STATUSES,DESCRIPTIONS,STATUS_HELP,applyStatus,damageScale,legacy,heal,tick,movement,blocked,execute,update,draw};
})(window);
