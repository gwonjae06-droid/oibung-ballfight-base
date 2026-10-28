/* Ability Atlas: 210 executable attack layouts, not cosmetic name aliases.
 * 5 damage families × 7 spatial formations × 6 enemy selectors.
 * Family controls gameplay delivery; formation controls strike coordinates;
 * selector controls which fighter acts as the anchor. */
(function(global){
'use strict';
const TYPES={shot:'투사체',beam:'광선',bolt:'낙뢰',wave:'충격파',zone:'장판'};
const PATTERNS={
  direct:'직선 집중',fan:'부채꼴',radial:'방사형',line:'일렬 배치',
  cross:'십자형',spiral:'나선형',scatter:'무작위 산개'
};
const TARGETS={
  nearest:'가장 가까운 적',farthest:'가장 먼 적',lowest:'체력 낮은 적',
  highest:'체력 높은 적',random:'무작위 적',cluster:'적이 모인 곳'
};
const patternList=Object.keys(PATTERNS);
const targetList=Object.keys(TARGETS);
const familyList=Object.keys(TYPES);
const catalog=Object.freeze(familyList.flatMap(type=>
  patternList.flatMap(pattern=>targetList.map(target=>Object.freeze({
    id:type+'-'+pattern+'-'+target,
    name:TYPES[type]+' · '+PATTERNS[pattern]+' · '+TARGETS[target],
    type,pattern,target
  })))
));
const n=(v)=>Number.isFinite(v)?v:0;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function choose(caster,list,selector){
  const eligible=list.filter(e=>e&&e!==caster&&e.hp>0);
  if(!eligible.length)return null;
  if(selector==='farthest')return eligible.reduce((best,e)=>distance(caster,e)>distance(caster,best)?e:best);
  if(selector==='lowest')return eligible.reduce((best,e)=>e.hp/e.maxHp<best.hp/best.maxHp?e:best);
  if(selector==='highest')return eligible.reduce((best,e)=>e.hp/e.maxHp>best.hp/best.maxHp?e:best);
  if(selector==='random')return eligible[Math.floor(Math.random()*eligible.length)];
  if(selector==='cluster')return eligible.reduce((best,e)=>{
    const score=item=>eligible.reduce((sum,p)=>sum+(Math.hypot(p.x-item.x,p.y-item.y)<135?1:0),0);
    return score(e)>score(best)?e:best;
  });
  return eligible.reduce((best,e)=>distance(caster,e)<distance(caster,best)?e:best);
}
// All seven formations produce geometrically distinct strike origins/rays.
function layout(caster,target,formation,amount,range,seed=0){
  const count=clamp(Math.round(amount||1),1,8);
  const dx=target.x-caster.x,dy=target.y-caster.y;
  const angle=Math.atan2(dy,dx);
  const span=clamp(range*.46,32,130);
  const points=[];
  for(let i=0;i<count;i++){
    const t=count===1?.5:i/(count-1);
    const centered=t-.5;
    let x=target.x,y=target.y,direction=angle;
    if(formation==='fan'){
      direction=angle+centered*1.15;
      x=caster.x+Math.cos(direction)*Math.min(range,115);
      y=caster.y+Math.sin(direction)*Math.min(range,115);
    } else if(formation==='radial'){
      direction=angle+i*2*Math.PI/count;
      x=target.x+Math.cos(direction)*span;
      y=target.y+Math.sin(direction)*span;
    } else if(formation==='line'){
      x=target.x+Math.cos(angle+Math.PI/2)*centered*2*span;
      y=target.y+Math.sin(angle+Math.PI/2)*centered*2*span;
    } else if(formation==='cross'){
      const arm=i%4, ring=Math.floor(i/4)+1;
      direction=arm*Math.PI/2;
      x=target.x+Math.cos(direction)*span*.48*ring;
      y=target.y+Math.sin(direction)*span*.48*ring;
    } else if(formation==='spiral'){
      direction=angle+seed*.13+i*2.399963;
      const r=span*Math.sqrt((i+1)/count);
      x=target.x+Math.cos(direction)*r;
      y=target.y+Math.sin(direction)*r;
    } else if(formation==='scatter'){
      // Per-cast random selection; unlike spiral, strikes are irregular.
      direction=Math.random()*Math.PI*2;
      const r=Math.sqrt(Math.random())*span;
      x=target.x+Math.cos(direction)*r;
      y=target.y+Math.sin(direction)*r;
    } else if(formation==='direct'&&count>1) {
      // Focused volley: tight grouping with small spacing.
      direction=angle+centered*.09;
      x=target.x+Math.cos(angle+Math.PI/2)*centered*12;
      y=target.y+Math.sin(angle+Math.PI/2)*centered*12;
    }
    points.push({
      x:clamp(n(x),20,Math.max(20,canvas.width-20)),
      y:clamp(n(y),20,Math.max(20,canvas.height-20)),
      angle:direction
    });
  }
  return points;
}
let seed=0;
function execute(caster,action,originalTarget,api){
  if(!TYPES[action.type])return false;
  const foes=api.enemies(caster),target=choose(caster,foes,action.target);
  if(!target)return true;
  const formation=PATTERNS[action.pattern]?action.pattern:'direct';
  const count=Math.max(1,action.count||1);
  const points=layout(caster,target,formation,count,action.radius,seed++);
  const colored=caster.forge.effectColor||caster.forge.color;
  const isEnemy=e=>e!==caster&&e.hp>0;
  const hitAt=(x,y,r,multiplier=1)=>{
    for(const e of foes)if(isEnemy(e)&&Math.hypot(e.x-x,e.y-y)<r+e.radius)api.hit(caster,e,action,multiplier);
  };
  const show=(x,y,kind,r)=>{
    if(global.BattleFX&&BattleFX.mark)BattleFX.mark(kind,x,y,colored,r);
    else if(global.BattleFX)BattleFX.cast(caster,kind,{color:colored,radius:r});
  };
  if(action.type==='shot'){
    if(global.BattleFX)BattleFX.cast(caster,'shot',{color:colored});
    for(const point of points){
      // Directions differ with formation; bullets still travel from caster.
      const dx=point.x-caster.x,dy=point.y-caster.y,len=Math.hypot(dx,dy)||1;
      const vx=dx/len*action.speed,vy=dy/len*action.speed;
      caster.forgeShots.push({x:caster.x,y:caster.y,vx,vy,
        life:Math.ceil(action.radius/action.speed*3),a:action,
        atlas:'shot',targetNum:target.playerNum});
    }
    if(caster.forgeShots.length>100)caster.forgeShots.splice(0,caster.forgeShots.length-100);
  }else if(action.type==='wave'){
    for(const point of points){
      show(point.x,point.y,'wave',Math.max(30,action.radius*.45));
      hitAt(point.x,point.y,Math.max(30,action.radius*.45),count>3?.66:1);
    }
  }else if(action.type==='bolt'){
    for(const point of points){
      show(point.x,point.y,'meteor',Math.max(30,action.radius*.33));
      caster.forgeZones.push({
        type:'bolt',x:point.x,y:point.y,
        timer:25+points.indexOf(point)*4,a:action,ticks:0
      });
    }
  }else if(action.type==='zone'){
    for(const point of points){
      const radius=Math.max(30,action.radius*.35);
      show(point.x,point.y,'meteor',radius);
      // Apply the opening poison/DoT hit instantly. Previously moving targets
      // could leave the zone before its first 30-frame tick.
      hitAt(point.x,point.y,radius,count>3?.66:1);
      caster.forgeZones.push({
        type:'zone',x:point.x,y:point.y,r:radius,timer:Math.round(action.duration*60),
        a:action,ticks:0
      });
    }
  }else if(action.type==='beam'){
    for(const point of points){
      const d=Math.hypot(point.x-caster.x,point.y-caster.y)||1;
      const x=caster.x+(point.x-caster.x)/d*action.radius*2;
      const y=caster.y+(point.y-caster.y)/d*action.radius*2;
      if(global.BattleFX&&BattleFX.beam)BattleFX.beam(caster.x,caster.y,x,y,colored);
      for(const e of foes){
        const vx=x-caster.x,vy=y-caster.y;
        const t=clamp(((e.x-caster.x)*vx+(e.y-caster.y)*vy)/(vx*vx+vy*vy||1),0,1);
        if(Math.hypot(e.x-caster.x-t*vx,e.y-caster.y-t*vy)<e.radius+10)api.hit(caster,e,action,count>3?.6:1);
      }
    }
  }
  return true;
}
const API={TYPES,PATTERNS,TARGETS,catalog,choose,layout,execute,
  get count(){return catalog.length;}};
global.AbilityAtlas=API;
})(window);
