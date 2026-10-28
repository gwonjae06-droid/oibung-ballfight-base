/* Procedural VFX + synthesized Web Audio. No external assets or API.
 * FX are tick-driven (simulation time) and draw-only at the end of each frame. */
(function (global) {
  const palette = {
    bae:'#b84316', oh:'#7e22ce', lee:'#0369a1', park:'#047857', choi:'#be123c',
    ice:'#0369a1', fire:'#c2410c', poison:'#15803d', heal:'#047857'
  };
  const fx=[], captions=new Map();
  let audio=null, master=null, noise=null, muted=false, intensity='full', lastSound=-500;
  let simulatedFrame=0, soundSequence=0;
  let lastMixTime=-1000;const recentVoices=[];
  const maxFx=150;
  const colorOf=(p,fallback)=>palette[p?.id]||fallback||'#e7f3ff';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function add(kind,x,y,color,opt={}) {
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    fx.push({kind,x,y,color:global.arenaEffectColor?.(color)||color||'#475569',age:0,life:opt.life||28,
      radius:opt.radius||68,angle:opt.angle||0,dx:opt.dx||0,dy:opt.dy||0,
      strength:opt.strength||1,label:opt.label||'',orbit:opt.orbit||0});
    if(fx.length>maxFx)fx.splice(0,fx.length-maxFx);
  }
  function particles(x,y,color,count=13,power=4) {
    const n=intensity==='low'?Math.ceil(count*.4):count;
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2,v=(1+Math.random())*power;
      add('spark',x,y,color,{life:18+Math.random()*12,dx:Math.cos(a)*v,dy:Math.sin(a)*v,radius:1+Math.random()*3});
    }
  }
  function unlock() {
    if(audio) { if(audio.state==='suspended')audio.resume().catch(()=>{}); return; }
    const C=global.AudioContext||global.webkitAudioContext;
    if(!C)return;
    try {
      audio=new C();
      const limiter=audio.createDynamicsCompressor();
      limiter.threshold.value=-20;limiter.knee.value=17;limiter.ratio.value=9;
      limiter.attack.value=.003;limiter.release.value=.19;
      master=audio.createGain();master.gain.value=muted?0:.18;
      master.connect(limiter);limiter.connect(audio.destination);
      const length=Math.floor(audio.sampleRate*.42), data=new Float32Array(length);
      for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
      noise=audio.createBuffer(1,length,audio.sampleRate);
      noise.copyToChannel(data,0);
    }catch(_){audio=null;}
  }
  function tone(from,to,duration,volume,wave='sine',delay=0) {
    if(!audio||muted)return;
    const t=audio.currentTime+delay, osc=audio.createOscillator(),gain=audio.createGain();
    osc.type=wave;osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(Math.max(25,to),t+duration);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.002,volume),t+.009);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain);gain.connect(master);osc.start(t);osc.stop(t+duration+.02);
  }
  function snap(duration=.11,volume=.12,filterHz=2100) {
    if(!audio||muted||!noise)return;
    const t=audio.currentTime, src=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain();
    src.buffer=noise;f.type='lowpass';f.frequency.value=filterHz;f.Q.value=.75;
    g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    src.connect(f);f.connect(g);g.connect(master);src.start(t);src.stop(t+duration+.01);
  }
  /* Tactile, dark-voiced percussion rather than high-pitched arcade beeps.
   * We cap transient density before DSP and soft-compress the complete SFX bus.
   * This is deliberately independent from MP3 background music volume. */
  function sound(kind,strength=1) {
    if(muted)return;
    const impact=kind==='hit'||kind==='heavy'||kind==='lightning';
    // At 2x speed or in 10-fighter matches, don't stack a wall of noise.
    const minFrames=impact?2:kind==='cast'?4:5;
    if(simulatedFrame-lastSound<minFrames)return;
    if(audio){
      const current=audio.currentTime;
      while(recentVoices.length&&current-recentVoices[0]>.25)recentVoices.shift();
      if(recentVoices.length>=7||current-lastMixTime<(impact?.018:.045))return;
      recentVoices.push(current);lastMixTime=current;
    }
    lastSound=simulatedFrame;
    soundSequence++;
    if(!audio)return;
    const v=clamp(Number(strength)||.6,.15,1.25);
    const variation=.96+Math.random()*.08;
    if(kind==='hit'){
      snap(.075,.068*v,750);
      tone(155*variation,76,.115,.16*v,'triangle');
      tone(74,48,.10,.065*v,'sine',.012);
    }else if(kind==='heavy'){
      snap(.13,.12*v,520);
      tone(165*variation,46,.22,.24*v,'triangle');
      tone(85,39,.18,.14*v,'sine',.012);
    }else if(kind==='cast'){
      snap(.085,.052*v,870);
      tone(165*variation,88,.15,.085*v,'triangle');
    }else if(kind==='energy'){
      snap(.16,.11*v,580);
      tone(168*variation,58,.24,.16*v,'triangle');
      tone(72,45,.18,.07*v,'sine',.025);
    }else if(kind==='lightning'){
      snap(.18,.14*v,950);
      tone(183*variation,45,.21,.18*v,'triangle');
      tone(95,42,.14,.10*v,'sine');
    }else if(kind==='heal'){
      snap(.09,.035*v,650);
      tone(108*variation,145,.24,.065*v,'sine');
      tone(92,119,.19,.03*v,'triangle',.05);
    }else if(kind==='transform'){
      snap(.19,.095*v,480);
      tone(148*variation,51,.29,.18*v,'triangle');
      tone(66,43,.25,.075*v,'sine',.035);
    }else if(kind==='dash'){
      snap(.12,.083*v,1050);
      tone(142*variation,72,.125,.09*v,'triangle');
    }else if(kind==='shield'){
      snap(.16,.07*v,610);
      tone(122*variation,65,.23,.11*v,'triangle');
    }else if(kind==='rune'){
      snap(.13,.055*v,720);
      tone(137*variation,83,.19,.105*v,'triangle');
    }else if(kind==='clock'){
      // Small mechanical tick plus an understated metallic knock.
      snap(.045,.045*v,810);
      tone(176*variation,95,.12,.07*v,'triangle');
    }else if(kind==='blast'){
      snap(.18,.125*v,450);
      tone(132*variation,40,.25,.19*v,'triangle');
      tone(69,38,.17,.095*v,'sine',.018);
    }else if(kind==='cosmos'){
      snap(.2,.06*v,430);
      tone(103*variation,43,.34,.10*v,'sine');
    }else {
      snap(.08,.05*v,770);
      tone(134*variation,80,.13,.08*v,'triangle');
    }
  }
  function caption(p,label,color){
    if(!p||!label)return;
    const current=captions.get(p.playerNum);
    if(current&&current.label===label&&simulatedFrame-current.frame<50)return;
    captions.set(p.playerNum,{label:String(label).slice(0,22),color:color||colorOf(p),frame:simulatedFrame,life:102});
  }
  function cast(p,kind,opt={}){
    if(!p)return;
    const c=opt.color||colorOf(p);
    const radius=opt.radius||115;
    const label=opt.label||null;
    if(label)caption(p,label,c);
    if(kind==='wave'||kind==='aura'){
      add('ring',p.x,p.y,c,{radius,life:42,strength:1.4});
      add('glyph',p.x,p.y,c,{radius:radius*.7,life:48});
      particles(p.x,p.y,c,13,3.2);
      sound(kind==='wave'?'heavy':'energy',.72);
    } else if(kind==='meteor'){
      add('target',opt.x??p.x,opt.y??p.y,c,{radius,life:42});
      add('ring',p.x,p.y,c,{radius:65,life:35});
      sound('energy');
    } else if(kind==='lightning'){
      add('bolt',opt.x??p.x,opt.y??p.y,c,{radius,life:26});
      particles(opt.x??p.x,opt.y??p.y,c,21,6);
      sound('lightning');
    } else if(kind==='blink'){
      add('ring',p.x,p.y,c,{radius:70,life:22});
      particles(p.x,p.y,c,13,5);sound('energy');
    } else if(kind==='heal'){
      add('heal',p.x,p.y,c,{radius:85,life:48});
      particles(p.x,p.y,c,11,2.2);sound('heal');
    } else if(kind==='shield'){
      add('shield',p.x,p.y,c,{radius:p.radius+25,life:55});sound('shield');
    } else if(kind==='dash'){
      add('sweep',p.x,p.y,c,{angle:Math.atan2(p.vy,p.vx),radius:95,life:27});sound('dash');
    } else if(kind==='rune'||kind==='transform'){
      add('glyph',p.x,p.y,c,{radius:95,life:55});
      add('ring',p.x,p.y,c,{radius:132,life:40});
      particles(p.x,p.y,c,22,3.9);
      sound(kind);
    } else {
      add('ring',p.x,p.y,c,{radius:75,life:24});sound('cast');
    }
  }
  function hit(x,y,color,opt={}){
    const c=color||'#f9dc9a';
    particles(x,y,c,opt.heavy?25:12,opt.heavy?6:4.5);
    add('flash',x,y,c,{radius:opt.heavy?75:45,life:opt.heavy?23:15});
    if(opt.heavy)add('ring',x,y,c,{radius:110,life:31});
    sound(opt.heavy?'heavy':'hit');
  }
  function tick(){
    simulatedFrame++;
    for(let i=fx.length-1;i>=0;i--){
      const f=fx[i];f.age++;
      if(f.kind==='spark'){f.x+=f.dx;f.y+=f.dy;f.dx*=.9;f.dy*=.9;}
      if(f.age>=f.life)fx.splice(i,1);
    }
    for(const [key,v] of captions) {
      v.life--;
      if(v.life<=0)captions.delete(key);
    }
  }
  function draw(ctx,characters=[]){
    ctx.save();
    ctx.globalCompositeOperation='source-over';
    for(const f of fx){
      const k=1-f.age/f.life;
      ctx.save();ctx.globalAlpha=clamp(k,0,1);
      ctx.strokeStyle=f.color;ctx.fillStyle=f.color;
      if(f.kind==='spark'){
        ctx.lineWidth=Math.max(1,f.radius*1.2);
        ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x-f.dx*2.3,f.y-f.dy*2.3);ctx.stroke();
      } else if(f.kind==='ring'||f.kind==='glyph'||f.kind==='heal'||f.kind==='shield') {
        const r=f.kind==='ring'?f.radius*(.08+(1-k)*.94):f.radius*(1+(1-k)*.14);
        // Physical shock-front: fast moving air ring + dusty fragmented fringe,
        // no futuristic spinning glyphs on the white playfield.
        const isImpact=f.kind==='ring'||f.kind==='glyph';
        ctx.strokeStyle=isImpact?'rgba(73,81,89,.85)':f.kind==='heal'?'#047857':f.color;
        ctx.lineWidth=isImpact?Math.max(1,8*k):2.5;
        ctx.shadowColor=isImpact?'rgba(70,75,80,.28)':f.color;
        ctx.shadowBlur=intensity==='low'?0:8*k;
        ctx.beginPath();
        for(let j=0;j<=48;j++){
          const angle=j/48*Math.PI*2;
          const jag=(Math.sin(j*7.1+f.x)*1.8+Math.sin(j*3.1+f.y)*2.5)*k;
          const rr=r+jag;
          if(j===0)ctx.moveTo(f.x+Math.cos(angle)*rr,f.y+Math.sin(angle)*rr);
          else ctx.lineTo(f.x+Math.cos(angle)*rr,f.y+Math.sin(angle)*rr);
        }
        ctx.stroke();
        if(isImpact && intensity!=='low'){
          ctx.globalAlpha=.22*k;ctx.lineWidth=3;
          for(let j=0;j<16;j++){
            const angle=j*Math.PI/8+f.x*.009,rr=r*(.8+.34*Math.sin(j*18+f.age));
            ctx.beginPath();ctx.arc(f.x+Math.cos(angle)*rr,f.y+Math.sin(angle)*rr,2.3,0,Math.PI*2);ctx.stroke();
          }
        }
      } else if(f.kind==='flash'){
        const r=f.radius*(1.5-k);
        const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,r);
        g.addColorStop(0,f.color);g.addColorStop(.2,f.color+'99');g.addColorStop(1,'transparent');
        ctx.fillStyle=g;ctx.globalAlpha=.7*k;
        ctx.beginPath();ctx.arc(f.x,f.y,r,0,Math.PI*2);ctx.fill();
      } else if(f.kind==='beam'){
        ctx.lineCap='round';ctx.shadowColor=f.color;ctx.shadowBlur=intensity==='low'?0:22*k;
        ctx.lineWidth=14*k+3;ctx.globalAlpha=.8*k;ctx.beginPath();
        ctx.moveTo(f.x-f.dx/2,f.y-f.dy/2);ctx.lineTo(f.x+f.dx/2,f.y+f.dy/2);ctx.stroke();
        ctx.lineWidth=4*k+1;ctx.globalAlpha=k;ctx.strokeStyle='#edfaff';ctx.stroke();
      } else if(f.kind==='sweep'){
        ctx.translate(f.x,f.y);ctx.rotate(f.angle);
        ctx.strokeStyle=f.color;ctx.lineWidth=12*k+3;
        ctx.shadowColor=f.color;ctx.shadowBlur=12;
        ctx.beginPath();ctx.arc(0,0,f.radius*(1-k*.35),-1.2,1.2);ctx.stroke();
      } else if(f.kind==='bolt'){
        // Forking stepped leaders inspired by natural lightning discharges.
        const fromY=Math.max(-35,f.y-250),segments=12;
        const points=[];
        for(let j=0;j<=segments;j++){
          const t=j/segments;
          const wobble=j===segments?0:Math.sin(j*13.28+f.x*.14+f.age*1.1)*20*(.25+t*.75);
          points.push([f.x-33*(1-t)+wobble,fromY+(f.y-fromY)*t]);
        }
        const trace=()=>{
          ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
          for(let j=1;j<points.length;j++)ctx.lineTo(points[j][0],points[j][1]);
          ctx.stroke();
        };
        ctx.shadowBlur=intensity==='low'?0:18;
        ctx.shadowColor='#aab7c8';ctx.strokeStyle='rgba(66,91,132,.35)';
        ctx.lineWidth=12*k+2;trace();
        ctx.shadowBlur=0;ctx.strokeStyle='#364c77';ctx.lineWidth=4*k+1.3;trace();
        ctx.strokeStyle='#f9fcff';ctx.lineWidth=2.1*k+.6;trace();
        if(intensity!=='low'){
          for(const j of [3,6,9]){
            const pt=points[j],out=Math.sin(j*3.2+f.age)*26;
            ctx.strokeStyle='rgba(97,128,181,.7)';ctx.lineWidth=1.4;
            ctx.beginPath();ctx.moveTo(pt[0],pt[1]);ctx.lineTo(pt[0]+out,pt[1]+27);ctx.lineTo(pt[0]+out+10,pt[1]+42);ctx.stroke();
          }
        }
      } else if(f.kind==='target'){
        ctx.lineWidth=3;ctx.setLineDash([10,7]);ctx.beginPath();
        ctx.arc(f.x,f.y,f.radius*(.8+.2*k),0,Math.PI*2);ctx.stroke();
        ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(f.x-14,f.y);
        ctx.lineTo(f.x+14,f.y);ctx.moveTo(f.x,f.y-14);ctx.lineTo(f.x,f.y+14);ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    // Small ability chips hug fighters; damage text stays numeric and transient.
    ctx.save();
    for(const p of characters){
      const v=captions.get(p.playerNum);
      if(!v||p.hp<=0)continue;
      const elapsed=102-v.life,fade=clamp(Math.min(elapsed/10,v.life/23),0,1);
      ctx.globalAlpha=fade;
      ctx.font='750 12.5px "Noto Sans KR",system-ui,sans-serif';
      ctx.textAlign='center';
      const x=clamp(p.x,70,Math.max(70,canvas.width-70)),y=clamp(p.y-p.radius-52,31,canvas.height-25);
      const width=clamp(ctx.measureText(v.label).width+24,50,180);
      ctx.fillStyle='rgba(20,20,20,.9)';ctx.strokeStyle='rgba(235,235,235,.66)';ctx.lineWidth=1;
      ctx.beginPath();if(typeof ctx.roundRect==='function')ctx.roundRect(x-width/2,y-14,width,23,7);else ctx.rect(x-width/2,y-14,width,23);ctx.fill();ctx.stroke();
      ctx.fillStyle='#f2f7f7';ctx.fillText(v.label,x,y+2);
    }
    ctx.restore();
  }
  function beam(x,y,endX,endY,c){
    if(![x,y,endX,endY].every(Number.isFinite))return;
    const distance=Math.hypot(endX-x,endY-y);
    const midX=(x+endX)/2,midY=(y+endY)/2;
    add('beam',midX,midY,c,{dx:endX-x,dy:endY-y,radius:distance,life:16});
    sound('energy');
  }
  // Draw damage telegraphs at the actual strike coordinate (not the caster).
  function mark(kind,x,y,color,radius=70){
    const c=color||'#848484';
    if(kind==='wave'){
      add('ring',x,y,c,{radius,life:33});
      sound('heavy',.45);
    }else if(kind==='meteor'){
      add('target',x,y,c,{radius,life:29});
      sound('cast',.45);
    }else if(kind==='lightning'){
      add('bolt',x,y,c,{radius,life:24});
      particles(x,y,c,12,4);
      sound('lightning',.8);
    }else{
      add('ring',x,y,c,{radius,life:24});
    }
  }
  function clear(){fx.length=0;captions.clear();}
  global.BattleFX={
    cast,hit,tick,draw,beam,mark,clear,caption,unlock,sound,
    get muted(){return muted;},
    setMuted(value){muted=!!value;if(master)master.gain.setTargetAtTime(muted?0:.18,audio.currentTime,.025);},
    setIntensity(v){intensity=v==='low'?'low':'full';},
    colorOf
  };
  if(typeof document!=='undefined'){
    document.addEventListener('pointerdown',unlock,{once:true});
    document.addEventListener('keydown',unlock,{once:true});
    const controls=()=> {
      const panel=document.querySelector('.bf-tools');
      if(!panel||panel.querySelector('.bf-audio'))return;
      const bar=document.createElement('div');
      bar.className='bf-audio';
      bar.innerHTML='<button type="button" id="bf-sound" aria-pressed="true">🔊 효과음 ON</button><span>전투 효과음 · 음악은 별도 조절</span>';
      panel.append(bar);
      bar.querySelector('button').addEventListener('click',()=>{
        unlock();BattleFX.setMuted(!BattleFX.muted);
        const b=bar.querySelector('button');
        b.textContent=BattleFX.muted?'🔇 효과음 OFF':'🔊 효과음 ON';
        b.setAttribute('aria-pressed',String(!BattleFX.muted));
      });
      const gentle=document.querySelector('.bf-preference input');
      if(gentle){BattleFX.setIntensity(gentle.checked?'low':'full');gentle.addEventListener('change',()=>BattleFX.setIntensity(gentle.checked?'low':'full'));}
    };
    // Called after main.js builds its panel, even on local file deployments.
    global.addEventListener('DOMContentLoaded',controls,{once:true});
  }
})(window);
