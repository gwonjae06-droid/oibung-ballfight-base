/* Skill Signatures: type-specific, event-driven visual language for 55 forge moves.
 * This module never decides damage, destination, or collision. Those belong to
 * SkillForge/AdvancedCombat/ForgeExpansion; signatures run only after actual
 * cast and successful contact. Fixed-step time; no DOM or external assets. */
(function(global){
'use strict';
const catalog=Object.freeze({
  wave:['ripples','#536d86'],shot:['arrow','#466b8b'],beam:['laser','#466f9d'],
  bolt:['lightning','#a47532'],dash:['speed','#3e7890'],blink:['fold','#6d5c9a'],
  heal:['cross','#36865f'],shield:['hex','#416e9d'],pull:['vortex','#396f78'],
  orbit:['satellites','#675e9d'],zone:['field','#627752'],
  homing:['lock','#417c99'],pierce:['needle','#9b5869'],
  boomerang:['return','#6373a2'],chain:['branch','#7f68b0'],
  nova:['rays','#93604b'],meteor:['rock','#ae6638'],mine:['hazard','#a2763f'],
  drain:['link','#8f5275'],swap:['swap','#6b66a5'],retreat:['back','#467d86'],
  cleanse:['purify','#409286'],haste:['wind','#479480'],regen:['sprout','#468e56'],
  fortify:['plates','#586b80'],flight:['wings','#4986a5'],burrow:['ground','#786447'],
  blackhole:['spiral','#666099'],starfall:['stars','#a68b3e'],
  dung:['splat','#846443'],lifebloom:['petals','#3a9259'],
  resurrect:['rise','#498d58'],timestop:['clock','#4b71a1'],
  rewind:['rewind','#6860a1'],timeburst:['fastclock','#5d87ac'],
  leap:['spring','#4a8f9a'],hover:['levitate','#6389ae'],
  glide:['glider','#547ea1'],dive:['down','#a96746'],
  uppercut:['punch','#a2624b'],slash:['cut','#5e6d88'],
  spinslash:['spin','#647a96'],thrust:['spear','#8f708c'],
  aircombo:['triple','#8d6a9b'],arcshot:['lob','#92724f'],
  splitshot:['crystal','#6581a4'],wall:['bricks','#6a7784'],
  portal:['gates','#68669e'],summon:['paw','#608b88'],
  turret:['scope','#66758a'],trap:['teeth','#956d50'],
  grow:['expand','#488b72'],shrink:['compress','#758c8f'],
  burrowdash:['tunnel','#947749'],erupt:['fissure','#a56e3c']
});
const TYPES=Object.freeze(Object.keys(catalog));
const MAX=68;
let effects=[],low=false,frame=0;
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
const arc=(c,x,y,r,a,b)=>{c.beginPath();c.arc(x,y,Math.max(.2,r),a,b);c.stroke();};
const line=(c,...pts)=>{c.beginPath();for(let i=0;i<pts.length;i+=2){
  if(i)c.lineTo(pts[i],pts[i+1]);else c.moveTo(pts[i],pts[i+1]);
}c.stroke();};
function polygon(c,n,r=15,offset=0){
  c.beginPath();
  for(let i=0;i<n;i++){
    const a=offset+i*Math.PI*2/n;
    const x=Math.cos(a)*r,y=Math.sin(a)*r;
    if(!i)c.moveTo(x,y);else c.lineTo(x,y);
  }
  c.closePath();c.stroke();
}
function star(c,r=18){
  c.beginPath();
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5-Math.PI/2,rad=i%2?r*.45:r;
    if(!i)c.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);
    else c.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);
  }
  c.closePath();c.stroke();
}
function arrow(c,angle,r=17){
  c.save();c.rotate(angle);
  line(c,-r,0,r,0,r-7,-6);
  line(c,r,0,r-7,6);c.restore();
}
function spir(c,turn=1,phase=0){
  c.beginPath();
  for(let i=0;i<=30;i++){
    const t=i/30,ang=phase+turn*t*Math.PI*3,r=2+17*t;
    const x=Math.cos(ang)*r,y=Math.sin(ang)*r;
    if(!i)c.moveTo(x,y);else c.lineTo(x,y);
  }c.stroke();
}
function drawMotif(c,type,age,life){
  const t=clamp(age/Math.max(1,life),0,1),turn=t*Math.PI*2;
  switch(type){
  case 'wave':for(const n of [6,12,19])arc(c,0,0,n+t*4,0,Math.PI*2);break;
  case 'shot':arrow(c,0);line(c,-23,-5,-14,-5);break;
  case 'beam':line(c,-22,-3,22,-3);line(c,-22,3,22,3);break;
  case 'bolt':line(c,-6,-23,2,-7,-4,0,8,7,-1,22);break;
  case 'dash':for(let i=-1;i<=1;i++)line(c,-18,9*i,19,9*i,-0+11,9*i-4);break;
  case 'blink':polygon(c,4,16,Math.PI/4);arc(c,0,0,7,0,Math.PI*2);break;
  case 'heal':line(c,-15,0,15,0);line(c,0,-15,0,15);break;
  case 'shield':polygon(c,6,19,Math.PI/6);polygon(c,6,12,Math.PI/6);break;
  case 'pull':for(let i=0;i<3;i++)arrow(c,i*Math.PI*2/3+Math.PI,18);break;
  case 'orbit':for(let i=0;i<3;i++){const a=turn+i*Math.PI*2/3;arc(c,Math.cos(a)*14,Math.sin(a)*14,3,0,Math.PI*2);}break;
  case 'zone':arc(c,0,0,19,0,Math.PI*2);for(let i=-1;i<=1;i++)line(c,-16,i*8,16,i*8);break;
  case 'homing':arc(c,0,0,18,0,Math.PI*1.5);arrow(c,-.5,12);break;
  case 'pierce':arrow(c,0,22);line(c,-19,-5,-19,5);break;
  case 'boomerang':arc(c,0,0,17,.25,Math.PI*1.65);arrow(c,3.1,11);break;
  case 'chain':line(c,-18,0,-5,0,3,-12,18,-12);line(c,-5,0,4,12,18,12);break;
  case 'nova':for(let i=0;i<8;i++){const a=i*Math.PI/4;line(c,Math.cos(a)*10,Math.sin(a)*10,Math.cos(a)*21,Math.sin(a)*21);}break;
  case 'meteor':polygon(c,7,12,turn*.4);line(c,-22,-22,-14,-12);line(c,-17,-22,-9,-11);break;
  case 'mine':polygon(c,3,18,-Math.PI/2);line(c,0,-10,0,3);arc(c,0,10,1,0,Math.PI*2);break;
  case 'drain':arc(c,-11,0,8,-1.4,1.4);arc(c,11,0,8,1.7,4.4);arrow(c,0,7);break;
  case 'swap':arrow(c,0,15);arrow(c,Math.PI,15);break;
  case 'retreat':arrow(c,Math.PI,22);line(c,10,-13,10,13);break;
  case 'cleanse':polygon(c,5,16,turn*.1);line(c,-7,2,-1,8,10,-8);break;
  case 'haste':for(let i=0;i<3;i++)line(c,-20,-12+i*12,11,-12+i*12,18,-17+i*12);break;
  case 'regen':line(c,0,19,0,-10);arc(c,-7,-5,9,Math.PI,Math.PI*2);arc(c,7,3,9,0,Math.PI);break;
  case 'fortify':for(let i=-1;i<=1;i++)line(c,-18,7*i,18,7*i);polygon(c,4,17,Math.PI/4);break;
  case 'flight':line(c,-19,8,-4,-9,0,4,4,-9,19,8);break;
  case 'burrow':arc(c,0,0,20,0,Math.PI);line(c,-18,3,18,3);line(c,-9,10,2,16,11,9);break;
  case 'blackhole':spir(c,-1,turn);arc(c,0,0,4,0,Math.PI*2);break;
  case 'starfall':star(c,14);line(c,-19,-20,-9,-9);line(c,-18,-12,-10,-6);break;
  case 'dung':for(let i=0;i<6;i++){const a=i*Math.PI/3;arc(c,Math.cos(a)*15,Math.sin(a)*15,2+i%2,0,Math.PI*2);}arc(c,0,0,8,0,Math.PI*2);break;
  case 'lifebloom':for(let i=0;i<5;i++){c.save();c.rotate(i*Math.PI*2/5);c.beginPath();c.ellipse(0,-11,6,10,0,0,Math.PI*2);c.stroke();c.restore();}break;
  case 'resurrect':arc(c,0,0,19,Math.PI,.01);arrow(c,-Math.PI/2,12);break;
  case 'timestop':arc(c,0,0,19,0,Math.PI*2);line(c,0,0,0,-13);line(c,0,0,9,0);break;
  case 'rewind':arc(c,0,0,19,Math.PI*.1,Math.PI*1.7);arrow(c,Math.PI,11);line(c,0,0,-9,-9);break;
  case 'timeburst':arc(c,0,0,17,0,Math.PI*2);arrow(c,-Math.PI/4,15);arrow(c,Math.PI/4,15);break;
  case 'leap':line(c,-16,12,0,-14,16,12);line(c,-11,17,11,17);break;
  case 'hover':for(const x of [-12,0,12])arc(c,x,0,3,0,Math.PI*2);line(c,-19,13,19,13);break;
  case 'glide':line(c,-21,7,-5,-8,0,0,5,-8,21,7);line(c,-13,13,13,13);break;
  case 'dive':arrow(c,Math.PI/2,21);line(c,-8,-18,-8,-4);break;
  case 'uppercut':arc(c,0,0,19,Math.PI*.85,Math.PI*1.65);arrow(c,-Math.PI/2,13);break;
  case 'slash':arc(c,0,0,20,-1.2,1.1);line(c,5,-19,15,11);break;
  case 'spinslash':arc(c,0,0,20,turn,turn+Math.PI*1.72);line(c,-7,-12,9,11);break;
  case 'thrust':line(c,-23,0,20,0);line(c,20,0,10,-7);line(c,20,0,10,7);break;
  case 'aircombo':for(let i=0;i<3;i++)arc(c,-5+i*8,-6+i*6,12,-1.8,.7);break;
  case 'arcshot':arc(c,-4,5,18,-Math.PI,.1);arc(c,17,-7,4,0,Math.PI*2);break;
  case 'splitshot':polygon(c,4,17,Math.PI/4);line(c,0,-14,5,-3,-4,5,0,14);break;
  case 'wall':for(let j=-1;j<=1;j++)line(c,-20,8*j,20,8*j);line(c,0,-15,0,0);line(c,-10,0,-10,14);break;
  case 'portal':c.save();c.scale(.6,1);arc(c,-11,0,20,0,Math.PI*2);arc(c,11,0,20,0,Math.PI*2);c.restore();break;
  case 'summon':for(const x of [-10,0,10])arc(c,x,-9,4,0,Math.PI*2);arc(c,0,7,11,Math.PI,Math.PI*2);break;
  case 'turret':arc(c,0,0,18,0,Math.PI*2);line(c,-22,0,22,0);line(c,0,-22,0,22);break;
  case 'trap':polygon(c,3,19,-Math.PI/2);for(let i=-1;i<=1;i++)line(c,i*8,12,i*8,-2);break;
  case 'grow':arrow(c,-Math.PI/2,19);arrow(c,Math.PI/2,19);break;
  case 'shrink':arrow(c,Math.PI/2,18);arrow(c,-Math.PI/2,18);arc(c,0,0,7,0,Math.PI*2);break;
  case 'burrowdash':line(c,-21,9,21,9);for(let i=-1;i<=1;i++)line(c,-13+i*12,8,-5+i*12,-8);break;
  case 'erupt':for(let i=0;i<6;i++){const a=i*Math.PI/3;line(c,0,0,Math.cos(a)*20,Math.sin(a)*20);}line(c,-12,19,0,8,12,19);break;
  }
}
function add(kind,p,type,action,target,location){
  if(!catalog[type]||!p)return false;
  const x=location?.x??p.x,y=location?.y??p.y;
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const angle=target?Math.atan2(target.y-p.y,target.x-p.x):Math.atan2(p.vy||0,p.vx||1);
  const duration=kind==='impact'?19:kind==='cast'?23:30;
  const entry={type,kind,x,y,angle,age:0,life:duration,
    color:global.arenaEffectColor?.(p.forge?.effectColor||p.effectColor||catalog[type][1])||p.forge?.effectColor||p.effectColor||catalog[type][1],
    source:kind==='cast'?p:null,scale:clamp((action?.radius||130)/130,.78,1.2)};
  if(effects.length>=MAX)effects.shift();
  effects.push(entry);return true;
}
function cast(p,action,target){
  if(!action?.type||!catalog[action.type])return false;
  return add('cast',p,action.type,action,target);
}
function impact(p,e,action){
  if(!action?.type||!catalog[action.type]||!e)return false;
  const height=global.AdvancedCombat?.height?.(e)||0;
  return add('impact',p,action.type,action,e,{x:e.x,y:e.y-height});
}
function tick(){
  frame++;
  for(let i=effects.length-1;i>=0;i--){
    if(++effects[i].age>=effects[i].life)effects.splice(i,1);
  }
}
function draw(ctx){
  if(!ctx)return;
  ctx.save();
  ctx.globalCompositeOperation='source-over';
  for(const e of effects){
    // Effects follow the caster only during windup; impacts freeze where the
    // real damage happened so moving fighters do not drag their hit marks.
    const x=e.source?e.source.x:e.x;
    const y=e.source?e.source.y-(global.AdvancedCombat?.height?.(e.source)||0):e.y;
    const t=e.age/e.life,fade=clamp(Math.min(1,t*5,(1-t)*3),0,1);
    ctx.save();ctx.translate(x,y);
    ctx.rotate(e.angle);
    const zoom=e.kind==='impact'?.65+(.9*t):.65+(.48*t);
    ctx.scale(zoom*e.scale,zoom*e.scale);
    ctx.globalAlpha=fade*(e.kind==='impact'?.8:.55);
    ctx.strokeStyle=e.color;ctx.fillStyle=e.color;
    ctx.lineWidth=low?1.8:2.5;ctx.lineCap='round';ctx.lineJoin='round';
    drawMotif(ctx,e.type,e.age,e.life);
    if(e.kind==='impact'){
      // Small contact spark is tied to successful hit, not the cast command.
      const r=5+16*t;
      arc(ctx,0,0,r,0,Math.PI*2);
    }
    ctx.restore();
  }
  ctx.restore();
}
function clear(){effects.length=0;frame=0;}
function setReduced(v){low=!!v;}
global.SkillVisuals={catalog,TYPES,cast,impact,tick,draw,clear,setReduced,
  get active(){return effects.length;}};
})(window);
