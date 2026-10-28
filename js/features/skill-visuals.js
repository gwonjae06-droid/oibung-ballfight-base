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

/* Screen-space action language. Presentation only: NEVER deals damage. */
const FAMILIES=Object.freeze({
  fist:new Set(['uppercut','aircombo']),
  projectile:new Set(['shot','homing','pierce','boomerang','arcshot','splitshot','bolt','dung','turret','summon']),
  wave:new Set(['wave','beam','chain','pull','zone','orbit']),
  movement:new Set(['dash','blink','leap','hover','glide','swap','retreat','portal','flight','burrowdash']),
  time:new Set(['timestop','rewind','timeburst']),
  explosion:new Set(['nova','meteor','mine','erupt','dive']),
  cosmos:new Set(['blackhole','starfall'])
});
const familyOf=type=>Object.keys(FAMILIES).find(k=>FAMILIES[k].has(type))||'generic';
let poses=new WeakMap(),ghosts=[];
const MOTION_LIMIT=50;
function actor(p,type,angle){
  if(!p)return;
  poses.set(p,{type,angle,age:0,life:type==='uppercut'?19:20,
    color:p.forge?.effectColor||p.effectColor||p.borderColor||'#98683c'});
}
function contact(p,target){
  if(!p||!target)return;
  const angle=Math.atan2(target.y-p.y,target.x-p.x);
  actor(p,'punch',angle); // Legacy contact events are only called after real HP loss.
}
function drawAction(c,p,z=0){
  const a=poses.get(p);if(!a||a.age>=a.life||!p||p.hp<=0)return;
  const fist=a.type==='punch'||a.type==='uppercut'||a.type==='aircombo';
  const ranged=FAMILIES.projectile.has(a.type);
  if(!fist&&!ranged)return;
  const t=a.age/a.life;
  const extension=a.type==='uppercut'?
    clamp((t-.25)*5,0,1)*(1-clamp((t-.72)*4,0,1)):
    clamp(t*7,0,1)*(1-clamp((t-.55)*3,0,1));
  const radius=p.radius||28,arm=radius*(.35+1.25*extension);
  const theta=a.type==='uppercut'?a.angle-(Math.PI*.52)*extension:a.angle;
  const cx=p.x,cy=p.y-z,ux=Math.cos(theta),uy=Math.sin(theta);
  const shoulderX=cx+ux*radius*.42,shoulderY=cy+uy*radius*.42;
  const handX=shoulderX+ux*arm,handY=shoulderY+uy*arm;
  c.save();c.globalCompositeOperation='source-over';
  c.lineCap='round';c.lineJoin='round';
  c.strokeStyle='#202b34';c.lineWidth=Math.max(7,radius*.37);
  c.beginPath();c.moveTo(shoulderX,shoulderY);
  c.quadraticCurveTo(shoulderX+ux*arm*.5-uy*3,shoulderY+uy*arm*.5+ux*3,handX,handY);c.stroke();
  c.strokeStyle=a.color;c.lineWidth=Math.max(4,radius*.25);c.stroke();
  c.fillStyle='#f3e2c5';c.strokeStyle='#23313b';c.lineWidth=2.3;
  c.beginPath();c.arc(handX,handY,Math.max(5,radius*.22),0,Math.PI*2);c.fill();c.stroke();
  if(fist&&extension>.35&&!low){
    // The sweeping white arc follows the hand; it is not a hit indicator.
    c.strokeStyle='rgba(245,177,85,.85)';c.lineWidth=2.3;
    c.beginPath();c.arc(handX-ux*8,handY-uy*8,radius*.27,theta-1.2,theta+.45);c.stroke();
  }
  if(ranged&&t<.34){
    const flash=(1-t/.34)*10;
    c.fillStyle='#fff9df';c.beginPath();c.arc(handX+ux*6,handY+uy*6,flash,0,Math.PI*2);c.fill();
  }
  c.restore();
}
function renderFamily(c,e){
  const t=clamp(e.age/e.life,0,1),f=e.family,r=clamp(e.radius||100,20,300);
  c.lineCap='round';c.lineJoin='round';
  if(f==='fist'){
    if(e.kind==='impact'){
      c.strokeStyle='#e09b43';c.lineWidth=3;
      for(let i=0;i<6;i++){const a=i*Math.PI/3;line(c,Math.cos(a)*7,Math.sin(a)*7,Math.cos(a)*(12+24*t),Math.sin(a)*(12+24*t));}
    }else{c.strokeStyle='#a16b36';c.lineWidth=3;arc(c,0,0,25,-1.2,-.15);}
    return true;
  }
  if(f==='projectile'){
    if(e.kind==='impact'){
      c.strokeStyle='#ac703e';c.lineWidth=2.8;
      for(let i=0;i<6;i++){const a=i*Math.PI/3;line(c,Math.cos(a)*4,Math.sin(a)*4,Math.cos(a)*(10+13*t),Math.sin(a)*(10+13*t));}
      c.strokeStyle='rgba(255,255,255,.85)';arc(c,0,0,7+13*t,0,Math.PI*2);
    }else{
      c.strokeStyle='#e2a36c';c.lineWidth=3.5;
      line(c,8,-9,27,0,8,9);c.strokeStyle='rgba(255,245,204,.9)';
      arc(c,27,0,4+7*(1-t),0,Math.PI*2);
    }
    return true;
  }
  if(f==='wave'){
    // Outer ring represents the actual committed range immediately; inner
    // ripples describe the propagation rather than inventing hit timing.
    c.strokeStyle=e.color;c.lineWidth=3.1*(1-t*.55);
    arc(c,0,0,r,0,Math.PI*2);
    c.strokeStyle='rgba(77,103,124,.48)';c.lineWidth=2;
    for(let i=0;i<2;i++)arc(c,0,0,r*(.2+(.8*t+i*.34)%1),0,Math.PI*2);
    return true;
  }
  if(f==='movement'){
    c.strokeStyle=e.color;c.lineWidth=2.5;
    for(let i=-1;i<=1;i++)line(c,-40-t*24,i*11,12-t*7,i*11);
    if(e.type==='blink'||e.type==='portal'){
      c.strokeStyle='rgba(121,105,169,.9)';arc(c,0,0,15+27*t,0,Math.PI*2);
    }
    return true;
  }
  if(f==='time'){
    c.save();c.rotate(-e.angle); // Pocket watch stays upright while caster turns.
    const sz=32;
    c.fillStyle='rgba(29,42,53,.2)';c.strokeStyle='#c4974c';c.lineWidth=4;
    c.beginPath();c.arc(0,0,sz,0,Math.PI*2);c.fill();c.stroke();
    c.strokeStyle='#deba72';c.lineWidth=3;
    line(c,0,-sz,0,-sz-9);arc(c,0,-sz-10,3,0,Math.PI*2);
    c.lineWidth=1.5;
    for(let i=0;i<12;i++){const a=i*Math.PI/6-Math.PI/2;line(c,Math.cos(a)*24,Math.sin(a)*24,Math.cos(a)*29,Math.sin(a)*29);}
    const direction=e.type==='rewind'?-1:1;
    const revolutions=e.type==='timeburst'?8:e.type==='rewind'?5:3;
    const phase=e.type==='timestop'?Math.min(t/.6,1):t;
    const minutes=direction*phase*Math.PI*2*revolutions;
    const hours=minutes/12;
    c.strokeStyle='#f9ead5';c.lineWidth=2.8;
    line(c,0,0,Math.sin(minutes)*23,-Math.cos(minutes)*23);
    c.strokeStyle='#b47e3c';c.lineWidth=4;
    line(c,0,0,Math.sin(hours)*15,-Math.cos(hours)*15);
    c.fillStyle='#efe7dd';c.beginPath();c.arc(0,0,3,0,Math.PI*2);c.fill();
    c.restore();return true;
  }
  if(f==='explosion'){
    if(e.kind==='cast'){
      // Target warning only; the flash waits for the actual damage event.
      c.strokeStyle='rgba(168,55,44,.7)';c.lineWidth=2;
      c.setLineDash([6,5]);arc(c,0,0,r,0,Math.PI*2);c.setLineDash([]);return true;
    }
    // Distinct ignition / main burst / ember phases, with zero extra hits.
    if(t<.26){
      const v=t/.26;c.fillStyle='#d44c31';c.beginPath();c.arc(0,0,5+15*v,0,Math.PI*2);c.fill();
      c.strokeStyle='#ffb062';c.lineWidth=4;arc(c,0,0,10+20*v,0,Math.PI*2);
    }else if(t<.66){
      const v=(t-.26)/.4,blast=18+Math.min(r,90)*v;
      c.fillStyle='rgba(204,46,31,.42)';c.beginPath();c.arc(0,0,blast,0,Math.PI*2);c.fill();
      c.strokeStyle='#c82821';c.lineWidth=6*(1-v*.6);arc(c,0,0,blast+5,0,Math.PI*2);
      c.strokeStyle='#ff923b';c.lineWidth=3;for(let i=0;i<10;i++){
        const a=i*Math.PI/5;line(c,Math.cos(a)*blast*.6,Math.sin(a)*blast*.6,Math.cos(a)*(blast+16),Math.sin(a)*(blast+16));
      }
    }else{
      const v=(t-.66)/.34;c.strokeStyle='rgba(116,36,34,.85)';c.lineWidth=3*(1-v)+.5;
      for(let i=0;i<9;i++){const a=i*Math.PI*2/9+e.angle,dist=18+v*34+(i%3)*5;
        arc(c,Math.cos(a)*dist,Math.sin(a)*dist,7*(1-v)+1,0,Math.PI*2);
      }
    }
    return true;
  }
  if(f==='cosmos'){
    c.save();c.rotate(-e.angle);
    const radius=Math.min(r,115),spin=t*Math.PI*2;
    c.fillStyle='rgba(19,13,36,.45)';c.beginPath();c.arc(0,0,radius*.63,0,Math.PI*2);c.fill();
    c.strokeStyle='#7c48bd';c.lineWidth=3;
    for(let i=0;i<3;i++){c.save();c.rotate(spin*.85+i*Math.PI/3);
      c.beginPath();c.ellipse(0,0,radius*.85,radius*.22,0,0,Math.PI*2);c.stroke();c.restore();}
    for(let i=0;i<(low?9:21);i++){
      const a=i*2.399963+spin*.7,d=radius*(.18+.76*((i*13%23)/23));
      const x=Math.cos(a)*d,y=Math.sin(a)*d;
      c.fillStyle=i%4===0?'#fff':'#c3a3ff';c.beginPath();
      c.arc(x,y,i%5===0?2.2:1.1,0,Math.PI*2);c.fill();
    }
    c.fillStyle='#180d2c';c.strokeStyle='#a47ce8';c.lineWidth=2.3;
    c.beginPath();c.arc(0,0,Math.max(7,radius*.15),0,Math.PI*2);c.fill();c.stroke();
    c.restore();return true;
  }
  return false;
}
function detonate(p,type,x,y,radius=90){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const success=add('impact',p,type,{radius},null,{x,y});
  if(success&&FAMILIES.explosion.has(type))global.BattleFX?.sound?.('blast',.62);
  else if(success&&FAMILIES.cosmos.has(type))global.BattleFX?.sound?.('cosmos',.36);
  return success;
}

function add(kind,p,type,action,target,location){
  if(!catalog[type]||!p)return false;
  const targeted=kind==='cast'&&['meteor','mine','blackhole','starfall','zone'].includes(type);
  const x=location?.x??(targeted&&target?.x!=null?target.x:p.x),
    y=location?.y??(targeted&&target?.y!=null?target.y:p.y);
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const angle=target?Math.atan2(target.y-p.y,target.x-p.x):Math.atan2(p.vy||0,p.vx||1);
  const family=familyOf(type);
  const duration=kind==='impact'?(family==='explosion'?26:19):family==='time'?48:
    family==='cosmos'?50:kind==='cast'?27:30;
  const entry={type,family,kind,x,y,angle,age:0,life:duration,radius:clamp(action?.radius||80,20,300),
    color:global.arenaEffectColor?.(p.forge?.effectColor||p.effectColor||catalog[type][1])||p.forge?.effectColor||p.effectColor||catalog[type][1],
    source:kind==='cast'&&!targeted?p:null,scale:clamp((action?.radius||130)/130,.78,1.2),
    lastX:p.x,lastY:p.y};
  if(effects.length>=MAX)effects.shift();
  effects.push(entry);return true;
}
function cast(p,action,target){
  if(!action?.type||!catalog[action.type])return false;
  const result=add('cast',p,action.type,action,target);
  if(result){
    if(FAMILIES.fist.has(action.type)||FAMILIES.projectile.has(action.type)){
      actor(p,action.type,target?Math.atan2(target.y-p.y,target.x-p.x):Math.atan2(p.vy||0,p.vx||1));
    }
    if(FAMILIES.time.has(action.type))global.BattleFX?.sound?.('clock',.44);
    if(FAMILIES.cosmos.has(action.type))global.BattleFX?.sound?.('cosmos',.48);
    global.CosmeticArcade?.onCast?.(p,action,target);
  }
  return result;
}
function impact(p,e,action){
  if(!action?.type||!catalog[action.type]||!e)return false;
  const height=global.AdvancedCombat?.height?.(e)||0;
  return add('impact',p,action.type,action,e,{x:e.x,y:e.y-height});
}
function tick(){
  frame++;
  for(let i=effects.length-1;i>=0;i--){
    const e=effects[i];
    if(e.family==='movement'&&e.source&&e.age<e.life&&!low){
      const p=e.source,dx=p.x-e.lastX,dy=p.y-e.lastY;
      if(Math.hypot(dx,dy)>5&&e.age%2===0){
        ghosts.push({x:e.lastX,y:e.lastY,r:p.radius||28,col:e.color,life:11,age:0});
        if(ghosts.length>MOTION_LIMIT)ghosts.shift();
      }
      e.lastX=p.x;e.lastY=p.y;
    }
    if(++e.age>=e.life)effects.splice(i,1);
  }
  ghosts=ghosts.filter(g=>++g.age<g.life);
  // WeakMap keys are live fighter objects and require no round-roster scans.
}
function draw(ctx){
  if(!ctx)return;
  ctx.save();ctx.globalCompositeOperation='source-over';
  if(!low)for(const g of ghosts){
    ctx.save();ctx.globalAlpha=.32*(1-g.age/g.life);
    ctx.fillStyle=g.col;ctx.strokeStyle='rgba(25,34,44,.45)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(g.x,g.y,g.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  }
  for(const e of effects){
    const x=e.source?e.source.x:e.x;
    const y=e.source?e.source.y-(global.AdvancedCombat?.height?.(e.source)||0):e.y;
    const t=e.age/e.life,fade=clamp(Math.min(1,t*7,(1-t)*4),0,1);
    ctx.save();ctx.translate(x,y);ctx.rotate(e.angle);
    ctx.globalAlpha=fade*(e.family==='wave'?.65:e.family==='explosion'?.9:.82);
    ctx.strokeStyle=e.color;ctx.fillStyle=e.color;
    ctx.lineWidth=low?1.8:2.6;
    if(!renderFamily(ctx,e)){
      const zoom=e.kind==='impact'?.65+.9*t:.65+.48*t;
      ctx.scale(zoom*e.scale,zoom*e.scale);
      drawMotif(ctx,e.type,e.age,e.life);
      if(e.kind==='impact')arc(ctx,0,0,5+16*t,0,Math.PI*2);
    }else if(e.kind==='cast'){
      // Each of the 55 distinct action silhouettes remains identifiable
      // as a small badge next to the large family-specific animation.
      ctx.save();ctx.translate(0,-38);ctx.scale(.56,.56);
      ctx.globalAlpha*=.55;ctx.strokeStyle=e.color;ctx.lineWidth=2;
      drawMotif(ctx,e.type,e.age,e.life);ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}
function clear(){effects.length=0;ghosts=[];poses=new WeakMap();frame=0;}
function setReduced(v){low=!!v;}
global.SkillVisuals={catalog,TYPES,FAMILIES,cast,impact,contact,detonate,drawAction,tick,draw,clear,setReduced,
  get active(){return effects.length;}};
})(window);
