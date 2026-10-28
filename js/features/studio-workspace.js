/* Studio workspace: concise Skills/Appearance tabs and a small live, read-only
 * motion sketch. It previews the validated ability draft; it never casts,
 * mutates battle players, starts matches, or stores a character. */
(function(global){
'use strict';
const dialog=document.getElementById('character-studio-dialog');
const studio=dialog?.querySelector('.forge-studio');
const shell=dialog?.querySelector('.character-studio-shell');
const content=dialog?.querySelector('.character-studio-content');
if(!dialog||!studio||!shell||!content||!global.SkillForge)return;
const pick=selector=>studio.querySelector(selector);
const random=pick('.forge-random-entry'),name=pick('.forge-name');
const blocks=pick('.block-forge'),tuning=pick('.forge-tuning'),library=pick('.forge-library');
const appearance=pick('.character-art-editor');
const basics=Array.from(studio.children).find(n=>n.tagName==='DETAILS'&&n.querySelector('summary')?.textContent.includes('외형'));
const create=pick('.forge-primary-actions'),saved=pick('.forge-saved');
const rest=Array.from(studio.children).filter(n=>![random,name,blocks,tuning,library,appearance,basics,create,saved].includes(n));
const tabs=document.createElement('div');
tabs.className='studio-category-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','캐릭터 제작 카테고리');
tabs.innerHTML='<button type="button" id="studio-tab-skills" role="tab" aria-selected="true" aria-controls="studio-panel-skills" tabindex="0">⚡ 스킬 코딩</button>'
  +'<button type="button" id="studio-tab-appearance" role="tab" aria-selected="false" aria-controls="studio-panel-appearance" tabindex="-1">🎨 외형 꾸미기</button>';
const skills=document.createElement('section'),looks=document.createElement('section');
skills.id='studio-panel-skills';looks.id='studio-panel-appearance';
skills.className='studio-category-panel';looks.className='studio-category-panel';
skills.setAttribute('role','tabpanel');looks.setAttribute('role','tabpanel');
skills.setAttribute('aria-labelledby','studio-tab-skills');
looks.setAttribute('aria-labelledby','studio-tab-appearance');
looks.hidden=true;
[random,blocks,tuning,library,...rest].filter(Boolean).forEach(node=>skills.append(node));
[basics,appearance].filter(Boolean).forEach(node=>looks.append(node));
studio.replaceChildren(...[name,tabs,skills,looks,create,saved].filter(Boolean));
function selectTab(tab,focus=false){
  const showLooks=tab==='appearance';
  looks.hidden=!showLooks;skills.hidden=showLooks;
  tabs.querySelectorAll('[role="tab"]').forEach((button,index)=>{
    const active=showLooks?index===1:index===0;
    button.setAttribute('aria-selected',String(active));
    button.tabIndex=active?0:-1;
    if(active&&focus)button.focus();
  });
}
tabs.addEventListener('click',event=>{
  const button=event.target.closest('[role="tab"]');if(!button)return;
  selectTab(button.id==='studio-tab-appearance'?'appearance':'skills');
});
tabs.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const current=looks.hidden?'skills':'appearance';
  const next=event.key==='Home'?'skills':event.key==='End'?'appearance':
    current==='skills'?'appearance':'skills';
  selectTab(next,true);
});

const preview=document.createElement('div');
preview.className='studio-motion-preview';
preview.setAttribute('aria-label','현재 스킬 동작의 반복 모션 미리보기');
preview.innerHTML='<div class="studio-motion-stage"><canvas id="studio-motion-canvas" width="360" height="100" aria-label="캐릭터가 설정한 기술을 반복 시연하는 화면"></canvas></div>'
  +'<div class="studio-motion-label"><strong>동작 미리보기</strong><span id="studio-motion-caption" aria-live="off">스킬을 조합하면 동작을 보여줍니다.</span></div>';
shell.insertBefore(preview,content);
const canvas=preview.querySelector('canvas'),ctx=canvas.getContext('2d');
const caption=preview.querySelector('#studio-motion-caption');
if(!ctx)return;

const MOVE=new Set(['dash','blink','swap','retreat','flight','burrow','leap','hover','glide','dive','burrowdash','portal']);
const HEAL=new Set(['heal','shield','cleanse','haste','regen','fortify','lifebloom','resurrect','rewind','grow','shrink','timeburst']);
const PROJECTILE=new Set(['shot','homing','pierce','boomerang','arcshot','splitshot','dung','meteor','starfall','bolt','chain','beam']);
const AREA=new Set(['wave','nova','zone','mine','trap','blackhole','pull','orbit','wall','timestop','erupt','summon','turret']);
const TAU=Math.PI*2,WIDTH=360,HEIGHT=100;
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
function circle(x,y,r,fill,stroke){
  ctx.beginPath();ctx.arc(x,y,r,0,TAU);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
}
function strokeLine(x1,y1,x2,y2,color,width=2){
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
  ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
}
function showEffect(action,t,heroX,heroY){
  const type=action.type,targetX=286,targetY=66;
  const color=action.status==='fire'?'#ffb578':action.status==='ice'?'#99e4ff':
    action.status==='poison'?'#b0e3a1':'#8bcffb';
  const ease=Math.sin(t*Math.PI);
  ctx.save();
  ctx.lineWidth=2.5;
  if(HEAL.has(type)){
    circle(heroX,heroY,19+17*ease,null,color);
    if(type==='shield'||type==='fortify')circle(heroX,heroY,25+3*ease,'rgba(130,203,250,.10)',color);
    for(let k=0;k<3;k++){
      const phi=k*TAU/3+t*TAU;
      circle(heroX+Math.cos(phi)*26,heroY+Math.sin(phi)*26,2.5,color);
    }
  }else if(MOVE.has(type)){
    strokeLine(72,72,heroX,heroY,'rgba(125,194,235,.45)',2);
    circle(heroX-8,heroY+3,8+6*ease,'rgba(111,205,245,.18)',color);
  }else if(PROJECTILE.has(type)){
    if(type==='beam'||type==='chain'){
      strokeLine(heroX+15,heroY,targetX-15,targetY,color,3+2*ease);
      circle(targetX-14,targetY,4+7*ease,null,color);
    }else if(type==='bolt'||type==='meteor'||type==='starfall'){
      const fall=clamp(t*1.4,0,1);
      strokeLine(targetX+8,-8,targetX+8,targetY*fall,color,3);
      circle(targetX+8,targetY*fall,5+3*ease,color);
    }else{
      const x=heroX+(targetX-heroX)*t,y=heroY+(targetY-heroY)*t-Math.sin(Math.PI*t)*(type==='arcshot'?30:5);
      circle(x,y,6+2*ease,color);
      strokeLine(x-18,y+1,x-7,y,'rgba(125,194,245,.5)',3);
    }
  }else if(AREA.has(type)){
    const x=['zone','mine','trap','wall','erupt'].includes(type)?targetX:heroX;
    const y=['zone','mine','trap','wall','erupt'].includes(type)?targetY:heroY;
    circle(x,y,12+t*56,null,color);
    circle(x,y,8+t*30,'rgba(112,183,220,.10)',null);
  }else{
    const x=heroX+38+ease*48,y=heroY-12*ease;
    ctx.beginPath();ctx.arc(x,y,22,Math.PI*(.85-t*.5),Math.PI*(1.7+t*.4));
    ctx.strokeStyle=color;ctx.lineWidth=5;ctx.stroke();
    circle(x+10,y,3,color);
  }
  ctx.restore();
}
let lastText='';
function draw(ms){
  const draft=global.SkillForge.getDraft(),skills=draft.allAbilities?
    global.SkillForge.allSkillset():draft.skills||[];
  const steps=skills.flatMap(s=>s.actions.map((action,index)=>({skill:s,action,index})));
  const total=steps.length||1,frame=Math.max(0,ms);
  const index=Math.floor(frame/1000)%total,t=(frame%1000)/1000;
  const entry=steps[index],action=entry?.action||{type:'wave'};
  const type=action.type;
  const title=entry?entry.skill.name+' · '+(global.SkillForge.TYPE[type]||'동작'):'스킬을 선택해 주세요';
  if(title!==lastText){caption.textContent=title;lastText=title;}
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  ctx.fillStyle='#15212b';ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.strokeStyle='rgba(155,190,216,.09)';ctx.lineWidth=1;
  for(let x=18;x<WIDTH;x+=36)strokeLine(x,0,x,HEIGHT,'rgba(155,190,216,.07)',1);
  strokeLine(0,83,WIDTH,83,'#354956',1);
  const floating=MOVE.has(type)?Math.sin(Math.PI*t)*((type==='leap'||type==='flight'||type==='hover'||type==='glide')?30:8):0;
  const slide=MOVE.has(type)?Math.sin(Math.PI*t)*(type==='retreat'?-32:74):Math.sin(t*TAU)*2;
  const hx=clamp(70+slide,36,214),hy=64-floating;
  circle(287,66,18,'#334452','#98aab9');
  ctx.fillStyle='#cfdae2';ctx.font='bold 10px sans-serif';ctx.textAlign='center';
  ctx.fillText('상대',287,69);
  // The motion sketch uses action identifiers rather than fake combat casts.
  if(entry?.index>0&&action.link==='with')
    showEffect(entry.skill.actions[entry.index-1],t,hx,hy);
  showEffect(action,t,hx,hy);
  ctx.save();ctx.beginPath();ctx.arc(hx,hy,19,0,TAU);ctx.clip();
  const art=global.CharacterStudioArt;
  if(art?.hasArtwork&&art.canvas){
    try{ctx.drawImage(art.canvas,hx-19,hy-19,38,38);}catch(_){ctx.fillStyle=draft.color||'#8ba4ed';ctx.fill();}
  }else{
    ctx.fillStyle=draft.color||'#8ba4ed';ctx.fillRect(hx-19,hy-19,38,38);
    ctx.fillStyle='#fff';ctx.font='700 13px sans-serif';ctx.textAlign='center';
    ctx.textBaseline='middle';ctx.fillText((draft.name||'나')[0],hx,hy);
  }
  ctx.restore();circle(hx,hy,19,null,'#f1f5f8');
}
let raf=0,startedAt=null;
const reduced=()=>!!global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
function stop(){
  if(raf){global.cancelAnimationFrame(raf);raf=0;}
  startedAt=null;
}
function frame(time){
  raf=0;
  if(!dialog.open||document.hidden){stop();return;}
  if(startedAt===null)startedAt=time;
  draw(reduced()?0:time-startedAt);
  if(!reduced())raf=global.requestAnimationFrame(frame);
}
function start(){
  stop();
  draw(0);
  if(!reduced()&&dialog.open&&!document.hidden)raf=global.requestAnimationFrame(frame);
}
dialog.addEventListener('close',stop);
if(typeof global.addEventListener==='function'){
  global.addEventListener('studio:open',start);
  global.addEventListener('studio:close',stop);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(dialog.open)start();});
if(dialog.open)start();else draw(0);
global.CharacterStudioWorkspace={selectTab,refresh:()=>draw(0),get activeTab(){return looks.hidden?'skills':'appearance';}};
})(window);
