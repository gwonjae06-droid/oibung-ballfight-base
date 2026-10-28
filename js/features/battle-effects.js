/* Loaded after main.js. Visual effects and the single fixed-step rendering loop. */
(function(){
  const speed=document.getElementById('bf-speed');
  if(!speed)return;
  const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const label=document.createElement('label');
  label.className='bf-preference';
  const gentle=document.createElement('input');gentle.type='checkbox';gentle.checked=!!reduced;
  label.append(gentle,document.createTextNode('화면 효과 줄이기'));
  document.querySelector('.bf-tools').appendChild(label);
  let frame=0,last=null,acc=0,roster=players;
  let sparks=[],pulses=[];
  const trails=new WeakMap();
  const color=p=>({ice:'#0369a1',fire:'#c2410c',poison:'#15803d'}[p.spec&&p.spec.element]||'#7e22ce');
  function pulse(x,y,c,r=70){c=arenaEffectColor(c);pulses.push({x,y,c,r,life:18});if(pulses.length>48)pulses.shift();}
  function burst(x,y,c,strong){c=arenaEffectColor(c);
    pulse(x,y,c,strong?90:52);
    for(let i=0;i<(gentle.checked?5:strong?18:10);i++){
      const a=Math.random()*Math.PI*2,v=(strong?3:2)+Math.random()*5;
      sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,c,life:18,max:18});
    }
    if(sparks.length>240)sparks.splice(0,sparks.length-240);
  }
  const oldUpdate=update,oldDraw=draw,oldCharacter=drawCharacter;
  update=function(){
    if(!isPlaying||isGameOver){oldUpdate();return;}
    if(roster!==players){roster=players;sparks=[];pulses=[];if(window.BattleFX)BattleFX.clear();window.SkillVisuals?.clear();}
    frame++;
    sparks.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.vx*=0.91;s.vy*=0.91;s.life--;});sparks=sparks.filter(s=>s.life>0);
    pulses.forEach(s=>s.life--);pulses=pulses.filter(s=>s.life>0);
    const before=players.map(p=>({p,hp:p.hp,x:p.x,y:p.y,inv:p.invincible,jump:p.jumpState,ticks:p.bfTicks&&p.bfTicks.slice(),marks:p.bfMarks&&p.bfMarks.slice()}));
    oldUpdate();
    if(window.BattleFX)BattleFX.tick();
    window.SkillVisuals?.tick();
    const custom=players.some(p=>p.spec||p.forge);
    before.forEach(b=>{
      const p=b.p,c=color(p),loss=b.hp-p.hp;
      if(custom&&loss>0){
        const strong=loss>=20;burst(p.x,p.y,p.spec?c:'#fbbf24',strong);
        if(!gentle.checked)screenShake=Math.max(screenShake,strong?4:2);
      }
      if(!p.spec)return;
      if(p.hp>b.hp)pulse(p.x,p.y,'#4ade80',58);
      if(Math.hypot(p.x-b.x,p.y-b.y)>65&&p.spec.skills.includes('blink')){pulse(b.x,b.y,c,70);pulse(p.x,p.y,c,85);}
      if(b.jump==='slamming'&&p.jumpState==='ground')burst(p.x,p.y,c,true);
      if(p.invincible>b.inv&&p.spec.skills.includes('shield'))pulse(p.x,p.y,'#38bdf8',60);
      if(b.ticks)p.bfTicks.forEach((t,i)=>{if(t===0&&b.ticks[i]>0){
        const kind=p.spec.skills[i];
        if(kind==='pull'){const e=getClosestAliveEnemy(p);if(e){pulse(e.x,e.y,c,48);pulse(p.x,p.y,c,60);}}
        else if(kind!=='aura'&&kind!=='slam')pulse(p.x,p.y,kind==='heal'?'#4ade80':c,kind==='wave'?100:55);
      }});
      if(b.marks)b.marks.filter(m=>!p.bfMarks.includes(m)).forEach(m=>{burst(m.x,m.y,'#fde047',true);pulses.push({x:m.x,y:m.y,c:'#fde047',r:50,life:10,bolt:true});});
      p.bfShots.forEach(b=>{let a=trails.get(b);if(!a){a=[];trails.set(b,a);}a.unshift({x:b.x,y:b.y});if(a.length>7)a.pop();});
    });
    if(gentle.checked)screenShake=0;
  };
  function ring(x,y,r,c,width=2){ctx.beginPath();ctx.arc(x,y,Math.max(1,r),0,Math.PI*2);ctx.strokeStyle=arenaEffectColor(c);ctx.lineWidth=width;ctx.stroke();}
  drawCharacter=function(p){
    if(p.spec&&p.hp>0){
      const c=color(p),skills=p.spec.skills;
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.shadowColor=c;ctx.shadowBlur=gentle.checked?0:5;
      p.bfShots.forEach(b=>{
        const a=trails.get(b)||[];
        a.forEach((v,i)=>{ctx.globalAlpha=(1-i/8)*0.4;ctx.fillStyle=c;ctx.beginPath();ctx.arc(v.x,v.y,Math.max(1,7-i),0,Math.PI*2);ctx.fill();});
        ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();ring(b.x,b.y,10,c);
      });
      p.bfRings.forEach(b=>{ctx.globalAlpha=Math.min(0.9,b.t/30);ring(b.x,b.y,b.r,c,5);ring(b.x,b.y,b.r*0.82,'#fff',1);ring(b.x,b.y,b.r*0.64,c,2);});
      ctx.globalAlpha=1;
      if(skills.includes('aura')){
        const r=105+Math.sin(frame/12)*5;ring(p.x,p.y,r,c,2);
        for(let i=0;i<6;i++){const a=frame/35+i*Math.PI/3;ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,3,0,Math.PI*2);ctx.fill();}
      }
      if(p.bfDash>0){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*10,p.y-p.vy*10);ctx.strokeStyle=c;ctx.lineWidth=9;ctx.globalAlpha=0.42;ctx.stroke();ctx.globalAlpha=1;}
      if(p.jumpState!=='ground'&&skills.includes('slam')){ring(p.x,p.y,70+Math.sin(frame/3)*6,c,3);ring(p.x,p.y,140,c,1);}
      if(p.invincible>20&&skills.includes('shield')){ring(p.x,p.y,p.radius+10,'#67e8f9',4);ring(p.x,p.y,p.radius+16,'#fff',1);}
      if(p.bfRage>0){ring(p.x,p.y,p.radius+8+Math.sin(frame)*2,'#fb7185',4);}
      ctx.restore();
    }
    if(globalThis.AdvancedCombat){
      const v=AdvancedCombat.visual(p);
      ctx.save();
      ctx.translate(v.x-p.x,v.y-p.y);
      oldCharacter(p);
      ctx.restore();
    }else oldCharacter(p);
  };
  draw=function(){
    oldDraw();if(isGameOver)return;
    if(window.BattleFX)BattleFX.draw(ctx,players);
    window.SkillVisuals?.draw(ctx);
    ctx.save();ctx.globalCompositeOperation='source-over';
    sparks.forEach(s=>{ctx.globalAlpha=s.life/s.max;ctx.strokeStyle=s.c;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x-s.vx*2,s.y-s.vy*2);ctx.stroke();});
    pulses.forEach(s=>{
      ctx.globalAlpha=Math.min(1,s.life/12);ctx.shadowColor=s.c;ctx.shadowBlur=gentle.checked?0:5;
      if(s.bolt){ctx.beginPath();ctx.moveTo(s.x-10,s.y-160);ctx.lineTo(s.x+8,s.y-90);ctx.lineTo(s.x-7,s.y-55);ctx.lineTo(s.x,s.y);ctx.strokeStyle=s.c;ctx.lineWidth=5;ctx.stroke();}
      else{const r=s.r*(1-s.life/20);ring(s.x,s.y,r,s.c,Math.max(1,s.life/4));ring(s.x,s.y,r*0.65,'#fff',1);}
    });ctx.restore();
  };
  // Fixed-step simulation: 2x doubles updates, not expensive canvas paints.
  gameLoop=function(time){
    if(!Number.isFinite(time)){requestAnimationFrame(gameLoop);return;}
    if(last===null)last=time;
    const delta=Math.min(100,Math.max(0,time-last));last=time;
    if(isPlaying&&!isGameOver){
      const step=1000/60;
      acc+=delta*(speed.value==='2'?2:1);
      let steps=0;
      while(acc+0.000001>=step&&steps<10){
        update();acc=Math.max(0,acc-step);steps++;
        if(isGameOver){acc=0;break;}
      }
      if(steps>=10)acc=0;
    }else acc=0;
    if(globalThis.AdvancedCombat){AdvancedCombat.setAlpha(isPlaying&&!isGameOver?Math.min(1,acc/(1000/60)):1);AdvancedCombat.setReduced(gentle.checked);}
    window.SkillVisuals?.setReduced(gentle.checked);
    draw();
    requestAnimationFrame(gameLoop);
  };
  speed.onchange=()=>{acc=0;last=null;};
  document.addEventListener('visibilitychange',()=>{acc=0;last=null;});
  requestAnimationFrame(gameLoop);
})();
