/* A deterministic storyboard planner, separate from real timers and damage. */
(function(global){
'use strict';
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const RANGED=new Set(['shot','homing','pierce','boomerang','arcshot','splitshot','dung','meteor','starfall','bolt','chain','beam']);
const MOVE=new Set(['dash','blink','swap','retreat','flight','burrow','leap','hover','glide','dive','burrowdash','portal']);
const EXPLOSION=new Set(['nova','meteor','mine','erupt','dive']);
const duration=a=>global.ActionRegistry?.duration(a.type)||(RANGED.has(a.type)?1050:MOVE.has(a.type)?850:EXPLOSION.has(a.type)?1120:950);
function plan(profile={},scope=0){
  const list=profile.allAbilities?global.SkillForge?.allSkillset?.()||[]:profile.skills||[];
  const events=[];
  if(!list.length)return {events,duration:2600,skills:[],scope};
  const selected=scope==='all'?'all':clamp(Number(scope)||0,0,list.length-1);
  const selectedSkills=selected==='all'?list.slice(0,12):[list[selected]];
  selectedSkills.forEach((sk,i)=>{
    const si=selected==='all'?i:selected,period=clamp(Number(sk.cooldown)||3,.6,30)*1000;
    const first=selected==='all'?280+i*170:260;
    const cycles=selected==='all'?Math.ceil((9000-first)/period):1;
    for(let cycle=0;cycle<cycles;cycle++){
      const base=first+cycle*period;
      let before=null;
      (sk.actions||[]).slice(0,3).forEach((a,j)=>{
        if(events.length>=160)return;
        const link=j===0?'and':a.link||'and',len=duration(a);
        const delay=clamp(Number(a.delay)||0,0,5)*1000;
        const start=(j===0?base:link==='with'?before.start:
          link==='after'?before.end+120:before.start+before.length*.72)+delay;
        const event={action:a,skillIndex:si,actionIndex:j,skillName:sk.name||'스킬',
          link,start,length:len,end:start+len};
        if(start<11000)events.push(event);
        before=event;
      });
    }
  });
  const end=Math.max(0,...events.map(e=>e.end));
  return {events:events.sort((a,b)=>a.start-b.start),
    duration:selected==='all'?9600:clamp(end+450,2300,10500),skills:list,scope:selected};
}
global.StudioMotionModel={plan,duration};
})(window);
