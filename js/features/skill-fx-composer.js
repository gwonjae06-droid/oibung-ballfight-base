/* Semantic FX compositor v1.
 * Small, deterministic canvas primitives. One normalized data description
 * works for the live VFX runner, preview and network replays.
 * No images, API requests, arbitrary code, or unbounded particle allocation.
 */
(function(g){'use strict';
const KINDS=Object.freeze({
 lightning:'번개 가지',coil:'휘감는 궤적',burst:'폭발 파편',embers:'불꽃·불티',
 mist:'안개·연무',ice:'얼음 결정',vortex:'소용돌이',stars:'별빛',
 wind:'바람 칼날',water:'물결',runes:'마법진',petals:'꽃잎',
 shards:'파편',shadow:'어둠 그림자',rings:'충격파 고리',
 chains:'사슬',thorns:'가시',hearts:'심장 파동',rain:'낙하 빛줄기',
 orbit:'회전 위성',trail:'속도 잔상',web:'거미줄'});
const PALETTE=Object.freeze({dark:'#54306d',fire:'#ff7941',ice:'#a4e5ff',
 lightning:'#a19dff',nature:'#74d9a6',water:'#56b9ec',
 blood:'#d25172',gold:'#ffd779',default:'#b4a3ff'});
const HEX=/^#[\da-f]{6}$/i;
const NAMES=[
 ['lightning',/번개|낙뢰|벼락|전격|뇌전|전류|찌릿|빠직|전기/],
 ['coil',/뱀처럼|휘감|휘어지|구불|구렁이|똬리|나선|꼬이|구불구불|감겨|감싸/],
 ['burst',/폭발|터지|터뜨|폭파|팡|쾅|펑|대폭발/],
 ['embers',/화염|불꽃|불길|타오르|용암|불티|화산|잿불|불기둥/],
 ['mist',/안개|연기|연무|독구름|흐릿|희뿌연|몽환|증기/],
 ['ice',/얼음|빙결|서리|냉기|동결|눈꽃|고드름|빙하/],
 ['vortex',/소용돌이|회오리|토네이도|블랙홀|중력|나선형/],
 ['stars',/별빛|별똥별|우주|은하|성운|유성|별가루|반짝/],
 ['wind',/바람|돌풍|폭풍|칼바람|질풍|강풍/],
 ['water',/물결|파도|물방울|비눗방울|해일|수류|물살/],
 ['runes',/마법진|문양|룬|봉인진|결계|각인|주문/],
 ['petals',/꽃잎|벚꽃|꽃비|장미|연꽃|나비/],
 ['shards',/파편|깨지|부서지|산산조각|유리|조각|수정/],
 ['shadow',/어둠|검은|검붉|암흑|그림자|심연|검게|흑염|멘헤라|암전/],
 ['rings',/충격파|진동|파동|공명|메아리|울림|동심원/],
 ['chains',/사슬|쇄도|속박|쇠줄|구속|철창/],
 ['thorns',/가시|덩굴|뿌리|뾰족|가시덤불/],
 ['hearts',/심장|피의|핏빛|맥박|혈액|피비린내|박동/],
 ['rain',/쏟아지|폭우|비처럼|빗발치|낙하|내리꽂|비가/],
 ['orbit',/공전|궤도|위성|둥글게\s*회전|주위를\s*돌/],
 ['trail',/잔상|빠르게|질주|광속|번개같이|스쳐|흔적/],
 ['web',/거미줄|그물|그물망|얽히|연결망/]
];
const limit=(v,min,max,alt)=>Number.isFinite(Number(v))?
 Math.max(min,Math.min(max,Number(v))):alt;
const kinds=Object.keys(KINDS);
function normalize(layers){
 if(!Array.isArray(layers))return [];
 return layers.slice(0,5).filter(v=>v&&kinds.includes(v.kind)).map(v=>({
  kind:v.kind,color:HEX.test(v.color)?v.color:PALETTE.default,
  power:limit(v.power,.35,2.5,1),spin:limit(v.spin,-3,3,1)
 }));
}
function infer(raw){
 const phrase=String(raw||'').normalize('NFC').slice(0,300);
 const dark=/검은|어두|암흑|심연|흑|그림자|멘헤라|핏빛|검붉/.test(phrase);
 const palette=dark?PALETTE.dark:
  /핏빛|붉은\s*피|혈액|피의/.test(phrase)?PALETTE.blood:
  /화염|불|용암|폭발|폭파|화산/.test(phrase)?PALETTE.fire:
  /얼음|빙|서리|냉기/.test(phrase)?PALETTE.ice:
  /물|해일|바다|파도/.test(phrase)?PALETTE.water:
  /꽃|숲|덩굴|나무/.test(phrase)?PALETTE.nature:
  /황금|금빛|태양|빛나는/.test(phrase)?PALETTE.gold:
  /번개|전기|뇌/.test(phrase)?PALETTE.lightning:PALETTE.default;
 const large=/거대|굵|두껍|초대형|엄청|웅장|큰|커다란/.test(phrase);
 const intense=/엄청|미친|강력|격렬|폭주|휘몰아|과격/.test(phrase);
 const found=NAMES.filter(([,rx])=>rx.test(phrase)).map(([kind])=>kind);
 if(!found.length)return null;
 const layered=found.slice(0,5).map(kind=>({
  kind,color:palette,power:intense?1.55:1,spin:/역회전|거꾸로/.test(phrase)?-1:1
 }));
 return {color:palette,scale:large?2.2:1.4,
  charge:/모아|응축|집중|충전|차징|축적/.test(phrase),
  layers:normalize(layered),keywords:found};
}
// Conservative analogy to an existing authoritative combat verb. The
// resulting action still uses ordinary hit, defense and projectile physics.
function suggestAction(phrase,types){
 const cue=infer(phrase);
 if(!cue)return null;
 const includes=kind=>cue.keywords.includes(kind);
 let action;
 if(includes('lightning'))action='bolt';
 else if(includes('vortex'))action=types.blackhole?'blackhole':'pull';
 else if(includes('burst')||includes('rings'))action=types.nova?'nova':'wave';
 else if(includes('chains')||includes('web')||includes('thorns'))action=types.pull?'pull':'zone';
 else if(includes('rain')||includes('stars'))action=types.meteor?'meteor':'shot';
 else if(includes('ice')||includes('mist')||includes('petals')||includes('water'))
  action=types.zone?'zone':'wave';
 else if(includes('wind')||includes('trail'))action=types.dash?'dash':'wave';
 else if(includes('hearts'))action=types.heal?'heal':'wave';
 else if(includes('shards'))action=types.splitshot?'splitshot':'shot';
 if(!action||!Object.hasOwn(types,action))return null;
 return {type:action,source:'analogy',visual:{
  shape:'aura',color:cue.color,scale:cue.scale,
  charge:cue.charge,layers:cue.layers}};
}
const path=(ctx,points)=>{if(!points.length)return;ctx.beginPath();
 ctx.moveTo(points[0][0],points[0][1]);
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.stroke();};
function paint(ctx,options={}){
 const layers=normalize(options.visual?.layers);
 if(!ctx||!layers.length)return false;
 const t=limit(options.progress,0,1,0),R=limit(options.radius,25,300,95)*.42;
 const impact=options.phase==='impact',angle=t*Math.PI*2;
 const light=options.low===true?Math.min(3,layers.length):layers.length;
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 for(let k=0;k<light;k++){
  const e=layers[k],r=R*e.power,spin=e.spin,theta=angle*spin+k*.85;
  ctx.save();ctx.strokeStyle=e.color;ctx.fillStyle=e.color;
  ctx.globalAlpha*=Math.min(.8,Math.max(.04,(1-t)*1.8))*(impact?.9:.73);
  ctx.lineWidth=Math.min(6,1.8+e.power);
  ctx.rotate(theta*.28);
  const points=[];
  switch(e.kind){
   case 'lightning':{
    for(let j=0;j<4;j++){
     const a=j*Math.PI/2+theta*.3;
     const pts=[];
     for(let q=0;q<5;q++){
      const d=r*(.1+q*.24),zig=q%2?7:-7;
      pts.push([Math.cos(a)*d-Math.sin(a)*zig,Math.sin(a)*d+Math.cos(a)*zig]);
     }path(ctx,pts);
    }break;
   }
   case 'coil':
   case 'vortex':
   case 'water':
   case 'wind':{
    const arms=e.kind==='vortex'?3:2;
    for(let j=0;j<arms;j++){
     for(let q=0;q<17;q++){
      const a=theta+j*Math.PI*2/arms+q*.29*spin;
      const d=e.kind==='water'?r*.5+r*.2*Math.sin(q*.65):r*q/19;
      points.push([Math.cos(a)*d,Math.sin(a)*d]);
     }
     path(ctx,points);points.length=0;
    }break;
   }
   case 'burst':
   case 'shards':
   case 'stars':
   case 'ice':
   case 'petals':
   case 'embers':
   case 'thorns':{
    for(let j=0;j<9;j++){
     const a=j*Math.PI*2/9+theta*.3;
     const d=r*(impact?.45+t*.6:.24+t*.4);
     const x=Math.cos(a)*d,y=Math.sin(a)*d;
     const sz=Math.max(2,r*.07);
     ctx.beginPath();
     if(['ice','shards','thorns'].includes(e.kind)){
      ctx.moveTo(x,y-sz*1.6);ctx.lineTo(x+sz,y);
      ctx.lineTo(x,y+sz*1.6);ctx.lineTo(x-sz,y);ctx.closePath();
     }else if(e.kind==='petals'){
      ctx.ellipse(x,y,sz*.75,sz*1.55,a,0,Math.PI*2);
     }else{
      ctx.arc(x,y,sz*.7,0,Math.PI*2);
     }
     ctx.fill();
    }break;
   }
   case 'shadow':
   case 'mist':{
    ctx.lineWidth=5;
    for(let j=0;j<3;j++){
     const a=theta*.3+j*Math.PI*2/3;
     ctx.beginPath();
     ctx.arc(Math.cos(a)*r*.21,Math.sin(a)*r*.21,r*(.55+j*.11),
       a,a+Math.PI*1.3);ctx.stroke();
    }break;
   }
   case 'rings':
   case 'orbit':
   case 'runes':
   case 'hearts':{
    for(let j=0;j<3;j++){
     ctx.beginPath();
     const rad=r*(.35+j*.22);
     ctx.ellipse(0,0,rad,rad*(e.kind==='orbit'?.42:1),
       theta*.35+j*.7,0,Math.PI*2);ctx.stroke();
    }
    if(e.kind==='runes')for(let j=0;j<8;j++){
     const a=j*Math.PI/4+theta*.28,d=r*.88;
     ctx.beginPath();ctx.moveTo(Math.cos(a)*d,Math.sin(a)*d);
     ctx.lineTo(Math.cos(a)*(d+6),Math.sin(a)*(d+6));ctx.stroke();
    }
    break;
   }
   case 'chains':
   case 'web':{
    for(let j=0;j<6;j++){
     const a=j*Math.PI/3+theta*.1;
     const d=r*.7;
     path(ctx,[[0,0],[Math.cos(a)*d,Math.sin(a)*d]]);
     if(e.kind==='chains'){
      ctx.beginPath();ctx.ellipse(Math.cos(a)*d*.7,Math.sin(a)*d*.7,
       6,3,a,0,Math.PI*2);ctx.stroke();
     }
    }break;
   }
   case 'trail':
   case 'rain':{
    for(let j=0;j<9;j++){
     const off=(j-4)*r*.18;
     const dx=e.kind==='rain'?off:-r*(.2+j*.08),
      dy=e.kind==='rain'?-r*.5:off;
     path(ctx,[[dx,dy],[dx+(e.kind==='rain'?-r*.12:r*.3),
       dy+(e.kind==='rain'?r*.4:0)]]);
    }break;
   }
  }
  ctx.restore();
 }
 ctx.restore();return true;
}
g.SkillFXComposer=Object.freeze({KINDS,PALETTE,normalize,infer,suggestAction,paint});
})(typeof window!=='undefined'?window:globalThis);
