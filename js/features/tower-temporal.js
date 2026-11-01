/* Bounded combat-state history. Saves/records and UI are deliberately outside time travel. */
(function(g){'use strict';
const arrays=['forgeTicks','forgeQueue','forgeShots','forgeZones','forgeOrbs','forgeEffects','forgePhase','forgeCharge','jumpState','suneungState','bfShots','waves'];

function create(actors,options={}){
 // Cinematic-only rewind is kinematic: never duplicate damage, healing,
 // momentum casts, projectiles or the battle result by restoring old state.
 const kinematicOnly=!!options.kinematicOnly;
 const motions=['x','y','vx','vy','z','jumpHeight'];
 function clone(v,seen=new Map()){
  if(v===null||typeof v!=='object'||actors.includes(v))return v;
  if(seen.has(v))return seen.get(v);
  const out=Array.isArray(v)?[]:v instanceof Set?new Set():v instanceof Map?new Map():{};seen.set(v,out);
  if(v instanceof Set){for(const x of v)out.add(clone(x,seen));}
  else if(v instanceof Map){for(const [k,x] of v)out.set(clone(k,seen),clone(x,seen));}
  else for(const [k,x] of Object.entries(v))out[k]=clone(x,seen);
  return out;
 }
 const frames=[];let serial=0,playback=null;
 function read(){
  if(kinematicOnly)return {actors:actors.map(p=>{
    const out={};for(const k of motions)if(Number.isFinite(p[k]))out[k]=p[k];
    return out;
  }),world:[]};
  return {actors:actors.map(p=>{const out={};for(const k of Object.keys(p))if(typeof p[k]==='number'||typeof p[k]==='boolean'||arrays.includes(k)){try{out[k]=clone(p[k]);}catch(_){}}return out;}),world:['objects','projectiles','effects'].map(k=>clone(g.AdvancedCombat?.[k]||[]))};
 }
 function restore(frame){
  if(kinematicOnly){
    actors.forEach((p,i)=>{
      for(const [k,v] of Object.entries(frame.actors[i]))if(motions.includes(k)&&Number.isFinite(v))p[k]=v;
    });
    return;
  }
  actors.forEach((p,i)=>{for(const k of Object.keys(p))if((typeof p[k]==='number'||typeof p[k]==='boolean'||arrays.includes(k))&&!(k in frame.actors[i]))delete p[k];Object.assign(p,clone(frame.actors[i]));});
  ['objects','projectiles','effects'].forEach((k,i)=>{const a=g.AdvancedCombat?.[k];if(a)a.splice(0,a.length,...clone(frame.world[i]));});
 }
 function capture(){if(playback)return;if(++serial%3===0){frames.push(read());if(frames.length>80)frames.shift();}}
 function begin(){if(playback||frames.length<2)return false;playback={frames:frames.slice(),present:read(),age:0};return true;}
 function step(){if(!playback)return false;const p=playback,n=p.frames.length-1;const progress=p.age/180;const index=Math.round(n*(progress<.5?1-progress*2:(progress-.5)*2));restore(p.frames[Math.max(0,Math.min(n,index))]);if(++p.age>=180){restore(p.present);playback=null;}return true;}
 return {capture,begin,step,get active(){return !!playback;},get count(){return frames.length;},get age(){return playback?.age||0;}};
}
g.ArenaTowerTemporal={create};
})(globalThis);
