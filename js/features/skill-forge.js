/* Skill Forge: authored ability sequences, not keyword parsing or arbitrary JS. */
(function(global){
'use strict';
const STORE='oibung-forge-v3', TYPE={wave:'충격파',shot:'투사체',beam:'레이저',bolt:'낙뢰',dash:'돌진',blink:'순간이동',heal:'회복',shield:'방어막',pull:'흡입',orbit:'회전 소환체',zone:'지속 장판'};
const TRIGGER={auto:'주기적으로',lowhp:'체력 이하',contact:'접촉 시',damaged:'피격 시'};
const STATUS={none:'없음',ice:'둔화',fire:'화상',poison:'중독'};
Object.assign(TYPE,global.ForgeExpansion?.TYPES||{});
Object.assign(TYPE,global.AdvancedCombat?.TYPES||{});
Object.assign(STATUS,global.ForgeExpansion?.STATUSES||{});

/* Per-type actionable controls. The stored schema stays backwards compatible;
 * the editor only shows inputs the actual execution path consumes. */
const ACTION_PARAMETERS=Object.freeze({
  wave:'pattern target damage radius count status knockback',
  shot:'pattern target damage radius count speed status knockback',
  beam:'pattern target damage radius count status knockback',
  bolt:'pattern target damage radius count status knockback',
  dash:'target damage speed duration status knockback',
  blink:'target damage radius status knockback',
  heal:'damage',shield:'duration',pull:'damage radius status knockback',
  orbit:'damage radius count duration status knockback',
  zone:'pattern target damage radius count duration status knockback',
  homing:'target damage radius count speed status knockback',
  pierce:'target damage radius count speed status knockback',
  boomerang:'target damage radius count speed status knockback',
  chain:'target damage radius count status knockback',
  nova:'damage radius status knockback',
  meteor:'target damage radius speed status knockback',
  mine:'damage radius duration status knockback',
  drain:'target damage radius status knockback',
  swap:'target',retreat:'target radius',
  cleanse:'',haste:'duration',regen:'damage duration',fortify:'duration',
  flight:'target damage radius duration status knockback',
  burrow:'target damage radius duration status knockback',
  blackhole:'target damage radius duration status',
  starfall:'target damage radius count speed status knockback',
  dung:'target damage radius speed duration status knockback',
  lifebloom:'damage radius duration',
  resurrect:'',timestop:'radius duration',rewind:'duration',timeburst:'duration',
  leap:'',hover:'duration',glide:'duration',
  dive:'damage radius speed status knockback',
  uppercut:'target damage radius status knockback',
  slash:'target damage radius status knockback',
  spinslash:'target damage radius status knockback',
  thrust:'target damage radius status knockback',
  aircombo:'target damage radius status knockback',
  arcshot:'target damage radius count speed status knockback',
  splitshot:'target damage radius count speed status knockback',
  wall:'target radius damage duration',
  portal:'target radius duration',
  summon:'target damage radius speed duration status knockback',
  turret:'target damage radius speed duration status knockback',
  trap:'damage radius duration status knockback',
  grow:'count duration',shrink:'count duration',
  burrowdash:'target damage radius duration status knockback',
  erupt:'damage radius status knockback'
});
const supportedParameter=(type,key)=>key==='delay'||(' '+(ACTION_PARAMETERS[type]||'')+' ').includes(' '+key+' ');
const number=(x,a,b,d=a)=>Number.isFinite(Number(x))?Math.max(a,Math.min(b,Number(x))):d;
const clean=(v,n)=>String(v==null?'':v).replace(/[<>]/g,'').slice(0,n).trim();
const color=(c)=>/^#[0-9a-f]{6}$/i.test(c)?c:'#a78bfa';
const stage=()=>({type:'shot',pattern:'fan',target:'nearest',damage:18,radius:120,count:5,speed:5,duration:1.5,status:'none',knockback:2,delay:0});
const skill=()=>({name:'새 스킬',trigger:'auto',cooldown:3,threshold:40,actions:[stage()]});
function normalize(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('올바른 설정을 입력하세요.');
  if(!Array.isArray(value.skills)||value.skills.length<1)throw Error('스킬을 한 개 이상 추가하세요.');
  return {
    name:clean(value.name,14)||'커스텀 파이터',blurb:clean(value.blurb,90),
    artKey:clean(value.artKey||'',52).replace(/[^a-zA-Z0-9_-]/g,''),
    color:color(value.color),effectColor:color(value.effectColor||value.color),hp:Math.round(number(value.hp,140,500,250)),
    speed:number(value.speed,.6,5,1.8),
    allAbilities:value.allAbilities===true,
    skills:value.skills.slice(0,4).map((s,i)=>{
      if(!Array.isArray(s.actions)||!s.actions.length)throw Error((i+1)+'번 스킬에 동작이 없습니다.');
      return {name:clean(s.name,18)||'스킬 '+(i+1),
        trigger:TRIGGER[s.trigger]?s.trigger:'auto',
        cooldown:number(s.cooldown,.2,30,3),threshold:number(s.threshold,5,95,40),
        actions:s.actions.slice(0,3).map(a=>({
          type:TYPE[a.type]?a.type:'wave',
          pattern:global.AbilityAtlas?.PATTERNS[a.pattern]?a.pattern:'direct',
          target:global.AbilityAtlas?.TARGETS[a.target]?a.target:'nearest',
          damage:Math.round(number(a.damage,0,120,18)),
          radius:number(a.radius,30,300,120),count:Math.round(number(a.count,1,8,1)),
          speed:number(a.speed,2,14,5),duration:number(a.duration,.2,8,1.5),
          status:STATUS[a.status]?a.status:'none',
          knockback:number(a.knockback,0,9,2),delay:number(a.delay,0,2,0),
          link:['and','after','with'].includes(a.link)?a.link:'and'
        }))};
    })
  };
}
const THEMES={
  sky:{name:'공중',color:'#0369a1',types:['flight','homing','retreat'],status:'shock'},
  earth:{name:'지하',color:'#92400e',types:['burrow','mine','fortify'],status:'root'},
  cosmos:{name:'우주',color:'#6d28d9',types:['blackhole','starfall','shield'],status:'vulnerable'},
  dung:{name:'똥',color:'#854d0e',types:['dung','zone','retreat'],status:'poison'},
  life:{name:'생명',color:'#047857',types:['lifebloom','drain','regen'],status:'weak'},
  phoenix:{name:'부활',color:'#be123c',types:['resurrect','nova','homing'],status:'fire'},
  time:{name:'시간',color:'#4338ca',types:['timestop','rewind','timeburst'],status:'ice'}
};
const allTypes=()=>Object.keys(TYPE);
const randInt=(rng,min,max)=>min+Math.floor(Math.max(0,Math.min(.999999999,rng()))*(max-min+1));
const pickRandom=(rng,values)=>values[randInt(rng,0,values.length-1)];
const randomColor=rng=>'#'+[0,1,2].map(()=>randInt(rng,48,218).toString(16).padStart(2,'0')).join('');
const offense=new Set(['wave','shot','beam','bolt','dash','blink','pull','zone','homing','pierce','boomerang','chain','nova','meteor','mine','drain','blackhole','starfall','dung','uppercut','slash','spinslash','thrust','aircombo','arcshot','splitshot','dive','erupt','burrowdash','trap','turret','summon']);
const settings=(type,i=0)=>({
  type,pattern:'direct',target:'nearest',
  damage:18+i%5*3,radius:115+(i%4)*22,
  count:type==='starfall'?6:type==='splitshot'?4:type==='orbit'?3:1,
  speed:5+(i%3),duration:type==='starfall'?2.5:1.8+(i%3)*.3,
  status:'none',knockback:2,delay:0
});
// Full-catalog mode is not limited to four UI skill slots. Every supported
// move has an actual independent cast/cooldown, not a random subset.
function allSkillset(){
  return Object.entries(TYPE).map(([type,name],i)=>({
    name,trigger:'auto',cooldown:4+(i%8)*.85,threshold:40,
    actions:[settings(type,i)]
  }));
}
function allProfile(name='만능 파이터',description='모든 능력을 사용한다'){
  return normalize({name,blurb:description.slice(0,90),color:'#6f77a1',
    hp:360,speed:2.1,allAbilities:true,
    skills:[{name:'전체 스킬 사용',trigger:'auto',cooldown:4,actions:[settings('wave')]}]});
}
// A multi-theme roll draws every action from the UNION of selected families.
// At least one action from each family is guaranteed, even for seven choices.
function randomProfile(theme='any',rng=Math.random){
  const selectedKeys=(Array.isArray(theme)?theme:theme==='any'?[]:[theme])
    .filter((key,index,items)=>!!THEMES[key]&&items.indexOf(key)===index);
  const selectedThemes=selectedKeys.map(key=>THEMES[key]);
  const selected=selectedThemes.length?selectedThemes[0]:pickRandom(rng,Object.values(THEMES));
  const pool=selectedThemes.length?
    [...new Set(selectedThemes.flatMap(t=>t.types).filter(type=>TYPE[type]))]:allTypes();
  const amount=Array.isArray(theme)?Math.max(2,Math.min(4,selectedKeys.length)):
    theme==='any'?randInt(rng,1,4):randInt(rng,3,4);
  const required=selectedKeys.slice();
  // Shuffle required families so their actions get mixed among skill slots.
  for(let i=required.length-1;i>0;i--){
    const j=randInt(rng,0,i);[required[i],required[j]]=[required[j],required[i]];
  }
  const used=new Set(),skills=[];
  const patterns=Object.keys(global.AbilityAtlas?.PATTERNS||{direct:1,fan:1,radial:1,line:1,cross:1,spiral:1,scatter:1});
  const targets=Object.keys(global.AbilityAtlas?.TARGETS||{nearest:1,farthest:1,lowest:1,highest:1,random:1,cluster:1});
  const statuses=Object.keys(STATUS),triggers=Object.keys(TRIGGER);
  for(let i=0;i<amount;i++){
    const actions=[];
    const needed=Math.ceil(required.length/Math.max(1,amount-i));
    const steps=selectedThemes.length?Math.min(3,Math.max(needed,randInt(rng,1,3))):randInt(rng,1,3);
    for(let j=0;j<steps;j++){
      const forced=required.shift();
      const candidates=forced?THEMES[forced].types.filter(type=>TYPE[type]):pool;
      let type=pickRandom(rng,candidates.length?candidates:pool);
      for(let tries=0;tries<12&&used.has(type);tries++)type=pickRandom(rng,candidates.length?candidates:pool);
      used.add(type);
      actions.push({type,pattern:pickRandom(rng,patterns),target:pickRandom(rng,targets),
        damage:randInt(rng,9,95),radius:randInt(rng,60,290),count:randInt(rng,1,8),
        speed:randInt(rng,2,14),duration:randInt(rng,3,70)/10,
        status:pickRandom(rng,statuses),knockback:randInt(rng,0,9),
        delay:j===0?0:randInt(rng,0,20)/10});
    }
    if(i===amount-1&&!skills.some(v=>v.actions.some(x=>offense.has(x.type)))&&!actions.some(x=>offense.has(x.type))){
      // Do not overwrite a mandatory theme's single representative action.
      const attack=pickRandom(rng,pool.filter(type=>offense.has(type)).length?
        pool.filter(type=>offense.has(type)):[...offense]);
      const add={...actions[0],type:attack,delay:.4};
      if(actions.length<3)actions.push(add);
      else{
        const extra=skills.find(skill=>skill.actions.length<3);
        if(extra)extra.actions.push(add);
        else actions[actions.length-1].type=attack;
      }
    }
    skills.push({name:TYPE[actions[0].type]+' '+pickRandom(rng,['연계','각성','변주','비기','파동']),
      trigger:pickRandom(rng,triggers),cooldown:randInt(rng,5,200)/10,
      threshold:randInt(rng,12,90),actions});
  }
  const subject=selectedThemes.length?selectedThemes.map(t=>t.name).join('·'):selected.name;
  const name=pickRandom(rng,['방랑하는','고요한','폭주하는','날렵한','사나운','빛나는','수상한','정교한'])+
    ' '+subject+' '+pickRandom(rng,['검사','마도사','소환사','모험가','수호자','괴짜','정령']);
  return normalize({name,blurb:selectedThemes.length?'선택한 '+subject+' 계열의 무작위 혼합':'전체 동작 풀 무작위 조합',
    color:randomColor(rng),effectColor:randomColor(rng),hp:randInt(rng,140,500),
    speed:randInt(rng,6,50)/10,skills});
}

let sequence=0;
const enemies=p=>players.filter(e=>e!==p&&e.hp>0);
function hit(p,e,action,multiplier=1,attackZ) {
  if(!e||e===p||e.hp<=0||e.invincible>0)return false;
  if(global.AdvancedCombat&&!AdvancedCombat.canHit(p,e,attackZ))return false;
  if(!global.AdvancedCombat&&e.jumpState&&e.jumpState!=='ground')return false;
  const d=Math.round((action.damage||0)*multiplier*(global.ForgeExpansion?.damageScale(p,e)||1));
  if(d){const tint=p.forge?.effectColor||p.forge?.color||p.themeColor||'#58687a';e.hp=Math.max(0,e.hp-d);e.invincible=12;createHitParticles(e.x,e.y,tint,12);addFloatingText('-'+d,e.x,e.y-30,tint,17);}
  if(action.status==='ice'){e.slowTimer=Math.max(e.slowTimer||0,90);e.slowMultiplier=.5;}
  if(action.status==='fire'||action.status==='poison'){
    const seconds=Number.isFinite(action.duration)?action.duration:(action.status==='fire'?2:3);
    // A DoT lasts as long as requested; its half-second damage ticks are
    // handled by the single existing simulation loop.
    e.bfDot=Math.max(e.bfDot||0,Math.max(30,Math.min(480,Math.round(seconds*60))));
    e.bfDotDamage=Math.max(e.bfDotDamage||2,Math.min(6,Math.max(1,Math.round(d*.12))));
  }
  global.ForgeExpansion?.applyStatus(p,e,action);
  if(action.knockback>0){const dx=e.x-p.x,dy=e.y-p.y,dist=Math.hypot(dx,dy)||1;e.vx+=dx/dist*action.knockback;e.vy+=dy/dist*action.knockback;}
  global.SkillVisuals?.impact(p,e,action); // Only after damage/status actually connects.
  return true;
}
/* Each skill owns its cooldown and its own cast sequence.
 * A combo has action-relative windups; different skills never wait for one
 * another. Explicit authored delays stay meaningful. */
const transitionLead={leap:14,hover:12,glide:12,erupt:12,uppercut:7,
  dash:7,blink:4,slash:8,spinslash:8,thrust:8,aircombo:7,
  arcshot:7,splitshot:7,dive:8,wall:5,portal:5,summon:5,turret:5};
const cooldownFrames=(p,s)=>Math.max(12,Math.round((p.forgeRush?Math.min(1,s.cooldown):s.cooldown)*60));
function cast(p,s,target,index){
  // The queue uses independent cast IDs; casts from two skills may overlap.
  const castId=++p.forgeSerial;
  let start=0;
  for(let step=0;step<s.actions.length;step++){
    const a=s.actions[step];
    const requested=Math.max(0,Math.round(a.delay*60));
    const lead=transitionLead[s.actions[Math.max(0,step-1)].type]||6;
    start=step===0?requested:a.link==='with'?start:
      a.link==='after'?Math.max(requested,start+Math.max(24,lead)):
      Math.max(requested,start+lead);
    p.forgeQueue.push({remaining:start,step,castId,skillIndex:index,
      a,targetNum:target?.playerNum??null,
      waitApex:step>0&&['leap','glide','hover','uppercut'].includes(s.actions[step-1].type)&&
        ['dive','aircombo','slash','spinslash','thrust'].includes(a.type)});
  }
  if(p.forgeQueue.length>48)p.forgeQueue.splice(0,p.forgeQueue.length-48);
  global.BattleFX?.caption?.(p,s.name,(p.forge.effectColor||p.forge.color));
}
function tickSkills(p,blocked=false){
  const speed=global.ForgeExpansion?.active(p,'timeburst')?2:1;
  p.forge.skills.forEach((s,i)=>{
    const max=cooldownFrames(p,s);
    p.forgeTicks[i]=Math.min(max,Math.max(0,(p.forgeTicks[i]||0)+speed));
  });
  // No shared global "skillCooldown": each gauge always progresses,
  // even during a silence/stun. Only casts and execution are suspended.
  return !blocked;
}
function tickQueue(p,target){
  const blocked=!!global.ForgeExpansion?.blocked(p);
  for(let i=0;i<p.forgeQueue.length;){
    const q=p.forgeQueue[i];
    if(q.remaining>0)q.remaining--;
    if(q.remaining>0){i++;continue;}
    if(blocked){i++;continue;} // keep the action pending instead of dropping it
    if(q.waitApex){
      const z=global.AdvancedCombat?.height(p)||0;
      const pose=p.jumpMotion?.phase||p.jumpState;
      if(pose==='prepare'||pose==='rising'||(z<24&&pose!=='ground'&&pose!=='landing')){
        i++;continue;
      }
    }
    // Tell the physical uppercut object whether a same-cast aircombo follows.
    // The caster launches on the actual uppercut CONTACT frame, not at cast.
    const aerialLink=q.a.type==='uppercut'&&p.forgeQueue.some(next=>
      next.castId===q.castId&&next.step>q.step&&next.a.type==='aircombo');
    if(aerialLink)p.uppercutFollow=true;
    execute(p,q.a,players.find(e=>e.playerNum===q.targetNum&&e.hp>0)||target);
    if(aerialLink)p.uppercutFollow=false;
    p.forgeQueue.splice(i,1);
  }
}
function execute(p,a,target) {
  // Keep target-selector semantics consistent across all three engines.
  const selected=global.AbilityAtlas?.choose?.(p,enemies(p),a.target)||target;
  target=selected;
  global.SkillVisuals?.cast(p,a,target); // Actual action execution, not cooldown booking.
  // In-world actions must dispatch through the same combat implementation
  // used by physics and visuals; they are not merely text menu entries.
  if(global.AdvancedCombat?.execute(p,a,target,{hit,enemies}))return;
  if(global.ForgeExpansion?.execute(p,a,target,{hit,enemies}))return;
  if(global.AbilityAtlas && AbilityAtlas.execute(p,a,target,{hit,enemies}))return;
  const c=(p.forge.effectColor||p.forge.color),near=target&&target.hp>0?target:getClosestAliveEnemy(p);
  const within=(x,y,r)=>enemies(p).filter(e=>Math.hypot(e.x-x,e.y-y)<r+e.radius);
  const visual=(kind,opts={})=>{if(global.BattleFX)BattleFX.cast(p,kind,Object.assign({color:c},opts));};
  if(a.type==='wave'){visual('wave',{radius:a.radius});within(p.x,p.y,a.radius).forEach(e=>hit(p,e,a));}
  else if(a.type==='shot'){
    if(!near)return;
    visual('shot');const angle=Math.atan2(near.y-p.y,near.x-p.x);
    for(let i=0;i<a.count;i++){const t=angle+(i-(a.count-1)/2)*.19;
      p.forgeShots.push({x:p.x,y:p.y,vx:Math.cos(t)*a.speed,vy:Math.sin(t)*a.speed,life:Math.ceil(a.radius/a.speed*3),a});
    }
    if(p.forgeShots.length>100)p.forgeShots.splice(0,p.forgeShots.length-100);
  } else if(a.type==='beam'){
    if(!near)return;
    const d=Math.hypot(near.x-p.x,near.y-p.y)||1,x=p.x+(near.x-p.x)/d*a.radius*2,y=p.y+(near.y-p.y)/d*a.radius*2;
    if(global.BattleFX)BattleFX.beam(p.x,p.y,x,y,c);
    visual('energy');
    enemies(p).forEach(e=>{const vx=x-p.x,vy=y-p.y,t=Math.max(0,Math.min(1,((e.x-p.x)*vx+(e.y-p.y)*vy)/(vx*vx+vy*vy||1)));if(Math.hypot(e.x-p.x-t*vx,e.y-p.y-t*vy)<e.radius+12)hit(p,e,a);});
  } else if(a.type==='bolt'){
    if(!near)return;
    visual('meteor',{x:near.x,y:near.y,radius:a.radius});
    for(let i=0;i<a.count;i++){const theta=i*2*Math.PI/a.count;p.forgeZones.push({type:'bolt',x:near.x+Math.cos(theta)*a.radius*.4,y:near.y+Math.sin(theta)*a.radius*.4,timer:30+i*5,a,ticks:0});}
  } else if(a.type==='dash'){
    if(!near)return;
    const dx=near.x-p.x,dy=near.y-p.y,d=Math.hypot(dx,dy)||1;
    p.vx=dx/d*a.speed;p.vy=dy/d*a.speed;p.forgeDash=Math.round(a.duration*60);p.forgeDashAction=a;visual('dash');
  } else if(a.type==='blink'){
    if(!near)return;
    visual('blink');const dx=near.x-p.x,dy=near.y-p.y,d=Math.hypot(dx,dy)||1;
    p.x=Math.max(p.radius,Math.min(canvas.width-p.radius,near.x-dx/d*68));
    p.y=Math.max(p.radius,Math.min(canvas.height-p.radius,near.y-dy/d*68));
    visual('blink');within(p.x,p.y,a.radius*.6).forEach(e=>hit(p,e,a));
  } else if(a.type==='heal'){
    if(global.ForgeExpansion)global.ForgeExpansion.heal(p,a.damage);else p.hp=Math.min(p.maxHp,p.hp+a.damage);visual('heal');addFloatingText('+'+a.damage,p.x,p.y-26,'#8bf2af',17);
  } else if(a.type==='shield'){
    p.invincible=Math.max(p.invincible,Math.round(a.duration*60));visual('shield');
  } else if(a.type==='pull'){
    visual('wave',{radius:a.radius});
    within(p.x,p.y,a.radius).forEach(e=>{
      const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
      e.vx+=dx/d*(a.knockback+2);e.vy+=dy/d*(a.knockback+2);
      hit(p,e,Object.assign({},a,{knockback:0}));
    });
  } else if(a.type==='orbit'){
    p.forgeOrbs.push({life:Math.round(a.duration*60),phase:0,ticks:0,a});
    if(p.forgeOrbs.length>3)p.forgeOrbs.shift();visual('shield');
  } else if(a.type==='zone'){
    if(!near)return;visual('meteor',{x:near.x,y:near.y,radius:a.radius});
    p.forgeZones.push({type:'zone',x:near.x,y:near.y,timer:Math.round(a.duration*60),a,ticks:0});
  }
}
function update(p,target){
  const loss=p.forgeLastHp-p.hp;p.forgeLastHp=p.hp;
  const cruise=p.forge.speed*(p.speedMultiplier||1),v=Math.hypot(p.vx,p.vy);
  if(p.forgeDash>0){
    p.forgeDash--;
    if(target){const t=Math.atan2(target.y-p.y,target.x-p.x);p.vx+=(Math.cos(t)*p.forgeDashAction.speed-p.vx)*.18;p.vy+=(Math.sin(t)*p.forgeDashAction.speed-p.vy)*.18;}
  }else if(v>.001&&Number.isFinite(v)){const next=v+(cruise-v)*(v>cruise?.075:.16);p.vx=p.vx/v*next;p.vy=p.vy/v*next;}
  else{p.vx=cruise;p.vy=0;}
  tickSkills(p);
  if(p.forge.allAbilities){
    // Each move has a separate clock; round-robin selection prevents 50+
    // casts on one tick from flooding the limited projectile/effect pools.
    p.forgeClock++;
    const skills=p.forge.skills,blocked=global.ForgeExpansion?.blocked(p);
    if(!blocked&&target&&p.forgeClock%6===0){
      for(let tries=0;tries<skills.length;tries++){
        const i=(p.forgeCursor+tries)%skills.length,s=skills[i];
        if(p.forgeTicks[i]<cooldownFrames(p,s))continue;
        p.forgeTicks[i]=0;cast(p,s,target,i);
        p.forgeCursor=(i+1)%skills.length;
        break;
      }
    }
  }else{
    p.forge.skills.forEach((s,i)=>{
      if(global.ForgeExpansion?.blocked(p))return;
      if(p.forgeTicks[i]<cooldownFrames(p,s))return;
      const active=(s.trigger==='auto'&&target)||(s.trigger==='lowhp'&&p.hp/p.maxHp*100<=s.threshold)
        ||(s.trigger==='damaged'&&loss>0);
      if(active){p.forgeTicks[i]=0;cast(p,s,target,i);}
    });
  }
  advanceWorld(p,target);
}
// Existing projectiles, summons, cooldown-independent sequences and zones
// must advance even when the owner is stunned, frozen or silenced.
function advanceWorld(p,target){
  global.ForgeExpansion?.update(p,{hit,enemies});
  tickQueue(p,target);
  for(let i=p.forgeShots.length-1;i>=0;i--){
    const b=p.forgeShots[i];b.prevX=b.x;b.prevY=b.y;b.x+=b.vx;b.y+=b.vy;b.life--;
    const blocked=global.AdvancedCombat?.blockSegment?.(
      b.prevX,b.prevY,b.x,b.y,b.a?.damage||10,0);
    if(blocked){p.forgeShots.splice(i,1);continue;}
    const e=enemies(p).find(e=>Math.hypot(e.x-b.x,e.y-b.y)<e.radius+8&&hit(p,e,b.a));
    if(e||b.life<=0||b.x<0||b.y<0||b.x>canvas.width||b.y>canvas.height)p.forgeShots.splice(i,1);
  }
  if(p.forgeZones.length>32)p.forgeZones.splice(0,p.forgeZones.length-32);
  for(let i=p.forgeZones.length-1;i>=0;i--){
    const z=p.forgeZones[i];z.timer--;z.ticks++;
    if(z.type==='bolt'&&z.timer<=0){
      if(global.BattleFX)BattleFX.cast(p,'lightning',{x:z.x,y:z.y,color:(p.forge.effectColor||p.forge.color)});
      enemies(p).filter(e=>Math.hypot(e.x-z.x,e.y-z.y)<z.a.radius*.4+e.radius).forEach(e=>hit(p,e,z.a));
    }
    if(z.type==='zone'&&z.timer>0&&z.ticks%30===0){
      const actualRadius=z.r??z.a.radius;
      enemies(p).filter(e=>Math.hypot(e.x-z.x,e.y-z.y)<actualRadius+e.radius).forEach(e=>hit(p,e,z.a,.4));
    }
    if(z.timer<=0)p.forgeZones.splice(i,1);
  }
  for(let i=p.forgeOrbs.length-1;i>=0;i--){
    const o=p.forgeOrbs[i];o.life--;o.phase+=.09;o.ticks++;
    if(o.ticks%28===0){
      // An orbit hit occurs only where one of the drawn eight-pixel orbs
      // actually touches an enemy; there is no invisible central AoE.
      const count=Math.max(1,Math.min(8,Math.round(o.a.count||1)));
      const orbitRadius=o.a.radius*.75;
      enemies(p).forEach(e=>{
        for(let j=0;j<count;j++){
          const theta=o.phase+j*2*Math.PI/count;
          const ox=p.x+Math.cos(theta)*orbitRadius,oy=p.y+Math.sin(theta)*orbitRadius;
          if(Math.hypot(e.x-ox,e.y-oy)<(e.radius||0)+8){hit(p,e,o.a,.4);break;}
        }
      });
    }
    if(o.life<=0)p.forgeOrbs.splice(i,1);
  }

}
function contact(p,e){
  if(global.ForgeExpansion?.blocked(p))return;
  if(p.forgeDash>0&&p.forgeDashAction)hit(p,e,p.forgeDashAction);
  p.forge.skills.forEach((s,i)=>{
    if(global.ForgeExpansion?.blocked(p))return;
    if(s.trigger==='contact'&&p.forgeTicks[i]>=cooldownFrames(p,s)){p.forgeTicks[i]=0;cast(p,s,e,i);}
  });
  if(e&&e.invincible===0)hit(p,e,{damage:7,status:'none',knockback:1});
}
function drawFighter(p){
  if(!p.forge||p.hp<=0)return;
  global.ForgeExpansion?.draw(p);
  const c=global.arenaEffectColor?.((p.forge.effectColor||p.forge.color))||(p.forge.effectColor||p.forge.color);ctx.save();ctx.globalCompositeOperation='source-over';
  ctx.shadowColor=c;ctx.shadowBlur=3;ctx.fillStyle=c;ctx.strokeStyle=c;
  p.forgeShots.forEach(b=>{
    const heading=Math.atan2(b.vy,b.vx),status=b.a?.status||'none';
    const x=global.AdvancedCombat?.blend(b.prevX,b.x)??b.x;
    const y=global.AdvancedCombat?.blend(b.prevY,b.y)??b.y;
    ctx.save();
    ctx.globalAlpha=.28;ctx.lineWidth=4;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x-b.vx*3,y-b.vy*3);ctx.lineTo(x,y);ctx.stroke();
    ctx.globalAlpha=1;ctx.translate(x,y);ctx.rotate(heading);
    ctx.strokeStyle='#253344';ctx.fillStyle=c;ctx.lineWidth=2;
    // All projectiles have a physical pointed direction; their status
    // adds a stable silhouette that reads against the white battleground.
    ctx.beginPath();
    if(status==='ice'){
      ctx.moveTo(12,0);ctx.lineTo(0,-8);ctx.lineTo(-11,0);ctx.lineTo(0,8);
    }else if(status==='fire'){
      ctx.moveTo(13,0);ctx.lineTo(-7,-7);ctx.lineTo(-3,0);ctx.lineTo(-8,7);
    }else if(status==='poison'){
      ctx.moveTo(12,0);ctx.quadraticCurveTo(-5,-12,-9,0);
      ctx.quadraticCurveTo(-5,12,12,0);
    }else{
      ctx.moveTo(13,0);ctx.lineTo(-7,-6);ctx.lineTo(-3,0);ctx.lineTo(-7,6);
    }
    ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle='#fff';ctx.lineWidth=1.4;ctx.beginPath();
    ctx.moveTo(-4,-2);ctx.lineTo(8,0);ctx.stroke();
    ctx.restore();
  });
  p.forgeZones.forEach(z=>{ctx.globalAlpha=z.type==='bolt'?.9:.65;ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(z.x,z.y,z.type==='bolt'?z.a.radius*.4:(z.r??z.a.radius),0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);});
  p.forgeOrbs.forEach(o=>{for(let i=0;i<o.a.count;i++){const t=o.phase+i*2*Math.PI/o.a.count,r=o.a.radius*.75;ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(p.x+Math.cos(t)*r,p.y+Math.sin(t)*r,8,0,2*Math.PI);ctx.fill();}});
  ctx.restore();
}
function register(value){
  if(CUSTOM_DEFS.length>=6)throw Error('캐릭터는 최대 6명까지 만들 수 있습니다.');
  const profile=normalize(value),id='forge_'+(++sequence);
  if(!profile.artKey)profile.artKey='art'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);
  const runtime=profile.allAbilities?{...profile,skills:allSkillset()}:profile;
  const def={id,name:profile.name,forgeData:profile,createInstance(n){
    return {id,name:profile.name,playerNum:n,x:0,y:0,vx:1.1,vy:.9,radius:34,
      hp:profile.hp,maxHp:profile.hp,invincible:0,slowTimer:0,slowMultiplier:1,
      borderColor:profile.color,themeColor:profile.color,tagColor:profile.color,effectColor:profile.effectColor,
      jumpState:'ground',forge:runtime,forgeLastHp:profile.hp,forgeDash:0,
      forgeDashAction:null,forgeTicks:runtime.skills.map((s,i)=>{
        const cd=Math.round(s.cooldown*60);
        return profile.allAbilities?Math.max(0,cd-((i*13+23)%Math.max(1,cd))):
          Math.min(cd,Math.round(s.cooldown*15)+i*14);
      }),forgeSerial:0,forgeClock:0,forgeCursor:0,
      forgeQueue:[],forgeShots:[],forgeZones:[],forgeOrbs:[],
      getImage:()=>CHARACTER_PHOTOS[id]||null,
      getDisplayName(){return this.name;},
      getTag(){return {text:profile.allAbilities?'전체 '+runtime.skills.length+'개 능력':profile.skills.map(s=>s.name).join(' · ').slice(0,70)};}
    };
  }};
  CUSTOM_DEFS.push(def);
  global.CharacterStudioArt?.restore?.(id,profile.artKey);
  BEHAVIORS[id]={order:7,update,onContact:contact};
  return id;
}
function remove(id){
  const index=CUSTOM_DEFS.findIndex(d=>d.id===id&&d.forgeData);
  if(index<0)return false;
  global.CharacterStudioArt?.remove?.(CUSTOM_DEFS[index].forgeData.artKey);
  global.CosmeticArcade?.forgetFighter?.(CUSTOM_DEFS[index].forgeData.artKey);
  CUSTOM_DEFS.splice(index,1);
  delete BEHAVIORS[id];if(typeof CHARACTER_PHOTOS!=='undefined')delete CHARACTER_PHOTOS[id];
  persist();refreshList();return true;
}
function list(){
  return CUSTOM_DEFS.filter(d=>d.forgeData).map(d=>({id:d.id,profile:normalize(d.forgeData)}));
}
function setDraft(value){
  draft=normalize(value);refreshForm();global.BlockForge?.refresh?.();global.NaturalForge?.refreshGenerated?.(draft);return draft;
}
function saved(){
  try{const v=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(v)?v.slice(0,6):[];}catch(_){return [];}
}
function persist(){
  try{localStorage.setItem(STORE,JSON.stringify(CUSTOM_DEFS.filter(d=>d.forgeData).map(d=>d.forgeData)));}catch(_){}
}
const escape=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(values,selected)=>Object.entries(values).map(([k,v])=>'<option value="'+k+'"'+(k===selected?' selected':'')+'>'+v+'</option>').join('');
let draft={name:'',blurb:'',color:'#a78bfa',effectColor:'#a78bfa',hp:250,speed:1.8,skills:[skill()]};
let refreshList=()=>{}, refreshForm=()=>{};
function field(key,value,attrs){
  return '<input data-field="'+key+'" '+attrs+' value="'+escape(value)+'">';
}
function choice(key,values,value,attrs){
  return '<select data-field="'+key+'" '+attrs+'>'+options(values,value)+'</select>';
}
function render(){
  const place=document.getElementById('forge-skills');if(!place)return;
  place.innerHTML=draft.allAbilities?
    '<section class="forge-skill"><div class="forge-top"><span>ALL ABILITIES</span></div>'+
    '<p class="forge-physics-note">총 '+allSkillset().length+
    '종류의 능력을 모두 보유합니다. 각 스킬은 별도 타이머로 충전되며 전투 중 순서대로 발동합니다.</p>'+
    '<p class="bf-helper">'+escape(allSkillset().map(s=>s.name).join(' · '))+'</p>'+
    '<button type="button" class="forge-delete" data-command="disable-all">일반 스킬 편집으로 돌아가기</button></section>'
    :draft.skills.map((s,i)=>{
    const si='data-skill="'+i+'"';
    const parts=s.actions.map((a,j)=>{
      const aj=si+' data-stage="'+j+'"';
      const box=(title,html,key)=>key&&!supportedParameter(a.type,key)?'':'<label>'+title+html+'</label>';
      return '<section class="forge-action">'
      +'<div class="forge-top"><span>ACTION '+(j+1)+'</span><button type="button" class="forge-delete" data-command="remove-action" '+aj+'>제거</button></div>'
      +'<div class="forge-grid">'
      +box('동작',choice('type',TYPE,a.type,aj))
      +box('공격 배치',choice('pattern',global.AbilityAtlas?.PATTERNS||{direct:'직선 집중'},a.pattern||'direct',aj),'pattern')
      +box('대상 우선순위',choice('target',global.AbilityAtlas?.TARGETS||{nearest:'가장 가까운 적'},a.target||'nearest',aj),'target')
      +box('위력',field('damage',a.damage,'type="number" min="0" max="120" step="1" '+aj),'damage')
      +box('범위',field('radius',a.radius,'type="number" min="30" max="300" step="5" '+aj),'radius')
      +box('개수',field('count',a.count,'type="number" min="1" max="8" step="1" '+aj),'count')
      +box('속도',field('speed',a.speed,'type="number" min="2" max="14" step=".5" '+aj),'speed')
      +box('지속 (초)',field('duration',a.duration,'type="number" min=".2" max="8" step=".2" '+aj),'duration')
      +box('상태이상',choice('status',STATUS,a.status,aj),'status')
      +box('넉백',field('knockback',a.knockback,'type="number" min="0" max="9" step=".5" '+aj),'knockback')
      +box('발동 지연',field('delay',a.delay,'type="number" min="0" max="2" step=".1" '+aj),'delay')
      +'</div>'
      +'<p class="forge-parameter-note">동작에 실제 적용되는 설정만 표시됩니다 · 발동 지연은 모든 동작에 적용</p>'
      +(global.AdvancedCombat?.DESCRIPTIONS?.[a.type]
        ?'<p class="forge-physics-note">'+escape(global.AdvancedCombat.DESCRIPTIONS[a.type])+'</p>':'')
      +'</section>';
    }).join('');
    return '<section class="forge-skill">'
      +'<div class="forge-top"><span>SKILL '+String(i+1).padStart(2,'0')+'</span><button type="button" class="forge-delete" data-command="remove-skill" '+si+'>스킬 삭제</button></div>'
      +'<label>스킬 이름'+field('name',s.name,si+' maxlength="18"')+'</label>'
      +'<div class="forge-grid">'
      +'<label>발동 조건'+choice('trigger',TRIGGER,s.trigger,si)+'</label>'
      +'<label>쿨타임 (초)'+field('cooldown',s.cooldown,'type="number" min=".2" max="30" step=".1" '+si)+'</label>'
      +(s.trigger==='lowhp'?'<label>HP 조건 (%)'+field('threshold',s.threshold,'type="number" min="5" max="95" step="5" '+si)+'</label>':'')
      +'</div><div class="forge-action-list">'+parts+'</div>'
      +'<button type="button" class="forge-add" data-command="add-action" '+si+' '+(s.actions.length>=3?'disabled':'')+'>+ 동작 연결</button>'
      +'</section>';
  }).join('');
  document.getElementById('forge-add-skill').disabled=draft.allAbilities||draft.skills.length>=4;
}
function initializeUI(){
  const panel=document.querySelector('.bf-tools');
  if(!panel)return;
  const detail=Array.from(panel.querySelectorAll('details')).find(d=>d.querySelector('summary')?.textContent.includes('커스텀'));
  if(!detail)return;
  const body=detail.querySelector('.bf-details-body');
  body.innerHTML=''
  +'<p class="bf-helper">캐릭터를 랜덤으로 생성하거나 원하는 계열을 선택하세요. 직접 조정하려면 외형과 스킬 설정을 열어 주세요.</p>'
  +'<div class="forge-grid">'
  +'<label>캐릭터 이름<input id="bf-name" maxlength="14" placeholder="나만의 파이터"></label>'
  +'<label>캐릭터 색상<input id="forge-color" type="color" value="#a78bfa"></label>'
  +'<label>이펙트 색상<input id="forge-effect-color" type="color" value="#a78bfa"></label>'
  +'<label>체력<input id="forge-hp" type="number" min="140" max="500" value="250"></label>'
  +'<label>기본 속도<input id="forge-speed" type="number" min=".6" max="5" step=".1" value="1.8"></label>'
  +'</div>'
  +'<label>캐릭터 설명 (게임 수치와 무관)<textarea id="bf-text" maxlength="90" rows="2" placeholder="캐릭터 설정"></textarea></label>'
  +'<div id="forge-skills" class="forge-skills"></div>'
  +'<button id="forge-add-skill" class="forge-add" type="button">+ 스킬 추가</button>'
  +'<div class="bf-btn-row"><button type="button" id="bf-analyze">능력 미리보기</button><button type="button" id="bf-create">캐릭터 생성</button></div>'
  +'<div id="bf-result" class="bf-result" role="status" aria-live="polite"></div>'
  +'<div id="bf-custom-list" class="bf-custom-list"></div>'
  +'<details class="forge-json"><summary>설정 JSON 가져오기 · 내보내기</summary>'
  +'<p class="bf-helper">다른 사람의 설정도 불러올 수 있습니다. 코드는 실행되지 않습니다.</p>'
  +'<textarea id="forge-json-text" rows="4" placeholder="JSON 붙여넣기"></textarea>'
  +'<div class="bf-btn-row"><button type="button" id="forge-export">JSON 내보내기</button><button type="button" id="forge-import">JSON 불러오기</button></div></details>';
  const $=id=>document.getElementById(id);
  function sync(){
    draft.name=$('bf-name').value;draft.blurb=$('bf-text').value;
    draft.color=$('forge-color').value;draft.effectColor=$('forge-effect-color').value;draft.hp=Number($('forge-hp').value);
    draft.speed=Number($('forge-speed').value);
  }
  function refreshBasics(){
    $('bf-name').value=draft.name;$('bf-text').value=draft.blurb;
    $('forge-color').value=draft.color;$('forge-effect-color').value=draft.effectColor||draft.color;$('forge-hp').value=draft.hp;
    $('forge-speed').value=draft.speed;
  }
  function report(t){$('bf-result').textContent=t;}
  function roster(){
    const target=$('bf-custom-list');if(!target)return;
    const owned=CUSTOM_DEFS.filter(d=>d.forgeData);
    const count=$('forge-custom-count');
    if(count)count.textContent=owned.length+' / 6';
    global.CosmeticArcade?.refreshStudio?.();
    target.replaceChildren();
    if(!owned.length){
      const empty=document.createElement('p');empty.className='forge-roster-empty';
      empty.textContent='저장한 캐릭터가 없습니다. 아래에서 캐릭터를 만들어 보세요.';
      target.appendChild(empty);
      return;
    }
    for(const def of owned){
      const row=document.createElement('div');row.className='forge-saved-row';
      const name=document.createElement('span');name.textContent=def.name;
      const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';
      remove.dataset.forgeId=def.id;remove.className='forge-delete';
      remove.setAttribute('aria-label',def.name+' 삭제');
      row.append(name,remove);target.appendChild(row);
    }
  }
  refreshList=roster;
  refreshForm=()=>{refreshBasics();render();};
  $('bf-custom-list').addEventListener('click',e=>{
    const id=e.target.dataset.forgeId;
    if(!id)return;
    if(roundStarted&&!isGameOver){report('경기 종료 후 삭제할 수 있습니다.');return;}
    const selected=CUSTOM_DEFS.find(d=>d.id===id&&d.forgeData);
    if(!selected)return;
    if(!confirm(selected.name+' 캐릭터를 삭제하시겠습니까?'))return;
    if(remove(id)){reRollMatch();roster();report(selected.name+' 캐릭터를 삭제했습니다.');}
  });
  $('forge-skills').addEventListener('input',e=>{
    const key=e.target.dataset.field;
    if(!key)return;
    const i=Number(e.target.dataset.skill),j=e.target.dataset.stage;
    const obj=j===undefined?draft.skills[i]:draft.skills[i]?.actions[Number(j)];
    if(obj)obj[key]=e.target.type==='number'?Number(e.target.value):e.target.value;
    global.NaturalForge?.refreshGenerated?.(draft);
  });
  $('forge-skills').addEventListener('change',e=>{
    if(['type','trigger'].includes(e.target.dataset.field))render();
  });
  $('forge-skills').addEventListener('click',e=>{
    const button=e.target.closest('button[data-command]');
    if(!button)return;
    sync();const i=Number(button.dataset.skill),j=Number(button.dataset.stage);
    const action=button.dataset.command;
    if(action==='disable-all'){draft.allAbilities=false;render();return;}
    if(action==='remove-skill'&&draft.skills.length>1)draft.skills.splice(i,1);
    if(action==='add-action'&&draft.skills[i].actions.length<3)draft.skills[i].actions.push(stage());
    if(action==='remove-action'&&draft.skills[i].actions.length>1)draft.skills[i].actions.splice(j,1);
    render();global.NaturalForge?.refreshGenerated?.(draft);
  });
  $('forge-add-skill').addEventListener('click',()=>{
    sync();if(!draft.allAbilities&&draft.skills.length<4){draft.skills.push(skill());render();global.NaturalForge?.refreshGenerated?.(draft);}
  });
  $('bf-analyze').addEventListener('click',()=>{
    try{
      sync();const d=normalize(draft);
      report(d.skills.map((s,i)=>(i+1)+'. '+s.name+' · '+TRIGGER[s.trigger]+' / '+s.cooldown+'초'
        +'\n   '+s.actions.map(a=>TYPE[a.type]+' / '+(global.AbilityAtlas?.PATTERNS[a.pattern]||'직선 집중')+' / '+(global.AbilityAtlas?.TARGETS[a.target]||'가장 가까운 적')+' ('+a.damage+'위력, '+a.radius+'범위, '+STATUS[a.status]+')').join(' → ')).join('\n'));
    }catch(e){report(e.message);}
  });
  $('bf-create').addEventListener('click',()=>{
    if(roundStarted&&!isGameOver){report('경기 종료 후 생성할 수 있습니다.');return;}
    try{
      sync();const config=normalize(draft),id=register(config);
      persist();
      global.CharacterStudioArt?.commit?.(id);
      reRollMatch();
      const first=$('bf-pick-0');
      if(first){first.value=id;globalThis.applyFighterPicks?.();}
      roster();report(config.name+' 생성 완료 · P1 적용');
      global.ArenaCategories?.hideStudio?.();
    }catch(e){report(e.message);}
  });
  $('forge-export').addEventListener('click',()=>{
    try{sync();$('forge-json-text').value=JSON.stringify(normalize(draft),null,2);report('설정 JSON을 복사해 보관하세요.');}catch(e){report(e.message);}
  });
  $('forge-import').addEventListener('click',()=>{
    try{draft=normalize(JSON.parse($('forge-json-text').value));refreshBasics();render();global.BlockForge?.refresh?.();report('설정 불러오기 완료');}
    catch(e){report('JSON 오류: '+e.message);}
  });
  refreshBasics();render();roster();
}
function initialize(){
  saved().forEach(profile=>{try{register(profile);}catch(_){}});
  initializeUI();
  if(CUSTOM_DEFS.length)reRollMatch();
  // Render custom projectiles and glyphs in the same pipeline as normal fighters.
  const oldDraw=drawCharacter;
  drawCharacter=function(p){if(p.forge)drawFighter(p);oldDraw(p);};
}
global.SkillForge={THEMES,randomProfile,normalize,register,remove,list,setDraft,refreshList:()=>refreshList(),persist,TYPE,TRIGGER,STATUS,ACTION_PARAMETERS,supportedParameter,cooldownFrames,advanceTimers:tickSkills,advanceWorld,hit,allProfile,allSkillset,getDraft:()=>normalize(draft)};
if(typeof document!=='undefined'&&document.querySelector('.bf-tools'))initialize();
})(window);
