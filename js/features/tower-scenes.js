/* Distinct, cached 2D arena paintings for each Tower floor.
 * Visual-only: no damage, movement, collision, cooldown or AI changes.
 * Offscreen caching avoids rebuilding geometry at 60 FPS. */
(function(global){
'use strict';
const SCENES=Object.freeze([
  {id:'dojo',name:'황혼의 수련장',top:'#4f4542',bottom:'#9d856d',glow:'#f9d1a2',accent:'#382b2b'},
  {id:'tidal',name:'푸른 파도의 회랑',top:'#143750',bottom:'#50809a',glow:'#b8f1f4',accent:'#a2d4eb'},
  {id:'wind',name:'바람의 공중 도장',top:'#314b66',bottom:'#92a9bd',glow:'#f6f1c8',accent:'#cfe9f4'},
  {id:'ember',name:'타오르는 용암굴',top:'#251722',bottom:'#754135',glow:'#ff8048',accent:'#ffc27d'},
  {id:'iron',name:'철갑 요새 · 수호 구역',top:'#202a38',bottom:'#596374',glow:'#cfdfec',accent:'#b0b8c8'},
  {id:'venom',name:'맹독의 늪지',top:'#1e332e',bottom:'#506b47',glow:'#b5ec69',accent:'#bde391'},
  {id:'scope',name:'월광 저격 관측소',top:'#111a38',bottom:'#35436e',glow:'#d9ebff',accent:'#acc3f6'},
  {id:'clock',name:'황금의 시계탑',top:'#3f302f',bottom:'#8d6b4e',glow:'#ffe3ac',accent:'#f8d48a'},
  {id:'astral',name:'성운의 별길',top:'#101934',bottom:'#3a3165',glow:'#cac0ff',accent:'#d9d8fb'},
  {id:'void',name:'공허의 중심 · 심연',top:'#080b1c',bottom:'#392047',glow:'#a079fd',accent:'#e4b9ff'}
]);
const cache=new Map();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function rng(seed){
  let v=seed>>>0;
  return ()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};
}
function line(ctx,x,y,xx,yy,color,width=1){
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function circle(ctx,x,y,r,color,width=1){
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function paintRaw(ctx,w,h,stage){
  const n=Math.round(clamp(stage,1,10)),t=SCENES[n-1],rand=rng(913+n*1979);
  const bg=ctx.createLinearGradient(0,0,w,h);
  bg.addColorStop(0,t.top);bg.addColorStop(1,t.bottom);
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  // Floor grid keeps spatial gameplay readable without opaque decoration.
  for(let x=0;x<=w;x+=44)line(ctx,x,0,x,h,'#ffffff15',1);
  for(let y=0;y<=h;y+=44)line(ctx,0,y,w,y,'#ffffff13',1);
  const halo=ctx.createRadialGradient(w*.5,h*.5,8,w*.5,h*.5,Math.max(w,h)*.59);
  halo.addColorStop(0,t.glow+'29');halo.addColorStop(1,t.glow+'00');
  ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
  const cx=w/2,cy=h/2;
  switch(n){
    case 1:{ // Dojo timber floor, paper-lantern light, fencing strips
      for(let y=0;y<h;y+=36){
        ctx.fillStyle=(y/36)%2?'#fff3d00b':'#251d1b17';ctx.fillRect(0,y,w,34);
        line(ctx,0,y,w,y,'#30242272',2);
      }
      for(let x=0;x<w;x+=150)line(ctx,x,0,x,h,'#3a292377',3);
      circle(ctx,cx,cy,Math.min(w,h)*.31,'#ffe6a05c',4);
      break;
    }
    case 2:{ // Parallel wave fronts
      for(let j=0;j<12;j++){
        const y=(j+.35)*h/12;
        ctx.beginPath();
        for(let x=0;x<=w;x+=8){
          const yy=y+Math.sin((x/w)*Math.PI*4+j*.8)*8;
          if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);
        }
        ctx.strokeStyle=j%3===0?'#e0fdffc2':'#c0edff55';
        ctx.lineWidth=j%3===0?2:1;ctx.stroke();
      }
      break;
    }
    case 3:{ // Cloud layers and wind trails
      for(let j=0;j<16;j++){
        const y=rand()*h,from=rand()*w;
        line(ctx,from,y,Math.min(w,from+90+rand()*150),Math.max(0,y-25),
          j%4?'#ffffff52':'#f9f4cbba',j%4?2:3);
      }
      for(let j=0;j<6;j++)circle(ctx,rand()*w,rand()*h,20+rand()*55,'#dae9f455',3);
      break;
    }
    case 4:{ // Lava fractures on dark obsidian
      for(let j=0;j<16;j++){
        let x=rand()*w,y=rand()*h;
        for(let k=0;k<4;k++){
          const xx=clamp(x+(rand()-.5)*130,0,w),yy=clamp(y+(rand()-.5)*98,0,h);
          line(ctx,x,y,xx,yy,j%4===0?'#ffb060dc':'#ff4e3889',j%3===0?4:2);
          x=xx;y=yy;
        }
      }
      for(let j=0;j<24;j++){ctx.fillStyle='#fa825b99';ctx.fillRect(rand()*w,rand()*h,2+rand()*3,2+rand()*3);}
      break;
    }
    case 5:{ // Armor panels and bolt heads
      for(let y=0;y<h;y+=70){
        for(let x=0;x<w;x+=92){
          ctx.strokeStyle='#d5e0ee67';ctx.lineWidth=2;
          ctx.strokeRect(x+5,y+5,80,58);
          circle(ctx,x+13,y+13,3,'#e1e9f4aa',2);
          circle(ctx,x+76,y+58,3,'#d3dbe8aa',2);
        }
      }
      circle(ctx,cx,cy,Math.min(w,h)*.36,'#dae6f099',5);
      break;
    }
    case 6:{ // Toxic pools and luminous spore spots
      for(let j=0;j<19;j++){
        const x=rand()*w,y=rand()*h,r=13+rand()*60;
        const g=ctx.createRadialGradient(x,y,3,x,y,r);
        g.addColorStop(0,'#b5f86d6e');g.addColorStop(1,'#95ff6800');
        ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
        circle(ctx,x,y,r*.58,j%2?'#b0df7255':'#b5f5a988',2);
      }
      break;
    }
    case 7:{ // Optics, sight lines and moon discs
      for(let j=0;j<4;j++)circle(ctx,cx,cy,28+j*38,'#c9ddff64',j===3?3:1);
      line(ctx,cx,0,cx,h,'#c8d9ff87',2);
      line(ctx,0,cy,w,cy,'#c8d9ff87',2);
      for(let x=20;x<w;x+=65)for(let y=20;y<h;y+=65){
        ctx.fillStyle='#d2e5ff99';ctx.fillRect(x,y,2,2);
      }
      break;
    }
    case 8:{ // Clockwork and gear teeth
      const r=Math.min(w,h)*.41;
      for(let j=0;j<60;j++){
        const a=j*Math.PI/30;
        const inner=r-(j%5===0?24:11);
        line(ctx,cx+Math.cos(a)*inner,cy+Math.sin(a)*inner,
          cx+Math.cos(a)*r,cy+Math.sin(a)*r,
          j%5===0?'#ffe4b5a9':'#e0c8917a',j%5===0?3:1);
      }
      circle(ctx,cx,cy,r,'#ffe6b1a1',4);
      circle(ctx,cx,cy,r*.77,'#e8be8079',3);
      line(ctx,cx,cy,cx-r*.24,cy-r*.37,'#ffdda6bd',6);
      line(ctx,cx,cy,cx+r*.45,cy+r*.09,'#f8c878b0',3);
      break;
    }
    case 9:{ // Stellar field, elliptical galaxy and comet arcs
      for(let j=0;j<90;j++){
        const x=rand()*w,y=rand()*h;
        ctx.fillStyle=j%6===0?'#ffeff9':'#bbcaffba';
        const r=j%9===0?3:1.2;ctx.fillRect(x,y,r,r);
      }
      ctx.save();ctx.translate(cx,cy);ctx.rotate(-.4);ctx.scale(1,.47);
      for(let j=0;j<3;j++)circle(ctx,0,0,100+j*43,'#d3c8ff8b',2);
      ctx.restore();break;
    }
    case 10:{ // Black hole lens / event horizon
      for(let j=0;j<120;j++){
        const a=rand()*Math.PI*2,r=55+rand()*Math.max(w,h)*.55;
        const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.68;
        ctx.fillStyle=j%7?'#c0afff88':'#fff2fb';
        ctx.fillRect(x,y,j%11===0?3:1.3,j%11===0?3:1.3);
      }
      const gravity=ctx.createRadialGradient(cx,cy,16,cx,cy,Math.min(w,h)*.43);
      gravity.addColorStop(0,'#040313ef');
      gravity.addColorStop(.44,'#0f0625d9');
      gravity.addColorStop(.6,'#ad7affb8');
      gravity.addColorStop(.7,'#6f3ee75b');
      gravity.addColorStop(1,'#6f3ee700');
      ctx.fillStyle=gravity;ctx.fillRect(0,0,w,h);
      circle(ctx,cx,cy,Math.min(w,h)*.26,'#d7a7ff9c',4);
      break;
    }
  }
  // Darkened perimeter but keep central fighters/effects clear.
  const edge=ctx.createRadialGradient(cx,cy,Math.min(w,h)*.28,cx,cy,Math.max(w,h)*.8);
  edge.addColorStop(0,'#080c1700');edge.addColorStop(1,'#0307127d');
  ctx.fillStyle=edge;ctx.fillRect(0,0,w,h);
}
function paint(ctx,w,h,n){
  if(!ctx||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return false;
  const floor=Math.round(clamp(n,1,10)),key=floor+':'+w+':'+h;
  let image=cache.get(key);
  if(!image&&global.document?.createElement){
    try{
      image=global.document.createElement('canvas');
      image.width=w;image.height=h;
      const surface=image.getContext('2d');
      if(!surface){image=null;}else{
        paintRaw(surface,w,h,floor);
        if(cache.size>=3)cache.clear();
        cache.set(key,image);
      }
    }catch(_){image=null;}
  }
  if(image){ctx.drawImage(image,0,0,w,h);}
  else paintRaw(ctx,w,h,floor);
  return true;
}
global.ArenaTowerScenes={SCENES,paint,paintRaw};
})(window);
