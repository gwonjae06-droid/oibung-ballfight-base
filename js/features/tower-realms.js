/* Immutable content and run-local blessings. No storage or DOM dependencies. */
(function(g){
'use strict';
const REALMS=[
 {id:'time',name:'시간의 탑',icon:'◷',color:'#f5ce78',scene:8,subtitle:'멈춘 시계의 성채',terrain:'시간 균열',hint:'노란 원의 카운트다운이 끝나기 전에 이탈하세요. 균열 안에서는 스킬 충전이 절반 속도로 진행됩니다.',bosses:['분침의 감시자','영겁의 시계공'],pattern:'시계 바늘',blessing:'시간의 잔향'},
 {id:'space',name:'우주의 탑',icon:'✧',color:'#c8aaff',scene:9,subtitle:'무중력의 별자리',terrain:'중력 우물',hint:'보라색 중력장이 켜지면 중심으로 끌립니다. 바깥으로 이동해 벗어나세요.',bosses:['궤도의 파수꾼','사건의 지평선'],pattern:'공전 고리',blessing:'별의 파편'},
 {id:'fire',name:'화염의 탑',icon:'♨',color:'#ffad72',scene:4,subtitle:'흑요석 아래의 심장',terrain:'용암 분출',hint:'주황색 균열은 예고 후 분출합니다. 원 밖으로 이동하면 피해를 피합니다.',bosses:['잿불의 기사','불멸의 화산왕'],pattern:'용암 십자',blessing:'잿불 각인'},
 {id:'storm',name:'폭풍의 탑',icon:'ϟ',color:'#8ce7f3',scene:3,subtitle:'구름 위 뇌명의 첨탑',terrain:'돌풍 통로',hint:'화살표 방향으로 돌풍이 밀어냅니다. 띠 밖으로 이동해 낙뢰를 피하세요.',bosses:['뇌운의 사냥꾼','천둥의 군주'],pattern:'번개 격자',blessing:'폭풍의 박동'},
 {id:'ice',name:'빙결의 탑',icon:'❄',color:'#bcecff',scene:2,subtitle:'푸른 결정의 성소',terrain:'서리 결정',hint:'푸른 원이 켜지면 서리가 이동을 늦춥니다. 얼기 전에 안전한 바닥으로 이동하세요.',bosses:['서리의 수호자','백야의 여왕'],pattern:'서리 봉쇄',blessing:'빙정의 숨결'},
 {id:'forest',name:'숲의 탑',icon:'♧',color:'#b5e992',scene:6,subtitle:'고대 뿌리의 미궁',terrain:'가시 덩굴',hint:'초록색 뿌리가 자라기 전에 이탈하세요. 가시 원에서는 피해와 약한 둔화가 적용됩니다.',bosses:['가시의 문지기','태고의 세계수'],pattern:'뿌리 포위',blessing:'세계수의 씨앗'}
].map(x=>Object.freeze({...x,bosses:Object.freeze(x.bosses)}));
const ENEMIES={
 time:['모래시계 수습생','초침의 추격자','시침의 검객','되감기 술사','찰나의 학자','반복의 기사','정지의 선구자','역행의 장인'],
 space:['성운의 견습병','유성 탐색자','중력의 인도자','궤도 수호자','별비의 사냥꾼','블랙홀 연구자','중력 항해사','성좌의 투사'],
 fire:['화산의 정찰병','잿불 전사','용암의 광전사','분화구 술사','화염 기병','암흑 화염술사','지옥불 사냥꾼','재앙의 불꽃'],
 storm:['바람의 전령','번개 창병','뇌운 무도가','낙뢰 마도사','돌풍 추격자','천둥의 수호병','폭풍의 검사','뇌전 대행자'],
 ice:['서리 견습병','빙창 사수','눈보라 주술사','서리 함정꾼','빙하의 기사','동토 마도사','수정 방패병','백야의 집행자'],
 forest:['덩굴 사냥꾼','독포자 정찰병','뿌리 장인','수호목 소환사','가시 투사','생명의 흡수자','녹음의 주술사','고대숲 파수병']
};
const get=id=>REALMS.find(r=>r.id===id)||REALMS[0];
function floor(base,id){
 const r=get(id),f={...base};
 f.name=f.boss?r.bosses[f.number===10?1:0]:(ENEMIES[r.id]||ENEMIES.time)[f.number<=4?f.number-1:f.number-2]+' · '+f.number+'층';
 f.description=f.boss?r.pattern+' · HP 50% 이하 2페이즈':r.terrain+' · '+r.hint;
 f.scene=r.id;f.realm=r.id;f.difficulty=f.boss?'특수 보스':'테마 도전';
 // Higher floors require sustained damage and awareness; patterns remain telegraphed.
  f.hp=190+f.number*26+(f.boss?170:0);f.damage=15+f.number*3;f.speed=1.35+f.number*.14;
  f.cooldown=Math.max(1.1,2.6-f.number*.12);
 return f;
}
const LOADOUTS={
 time:[['시침 투사','shot'],['초침 가속','haste'],['되감기 충격','wave'],['시간 도약','blink'],['과거의 잔영','rewind'],['정지의 장막','timestop']],
 space:[['항성 추적탄','homing'],['중력 보호막','shield'],['사건 지평선','blackhole'],['회전 위성','orbit'],['별의 낙하','starfall'],['성운 낙뢰','bolt']],
 fire:[['잿불 투사체','shot'],['용암 폭발','nova'],['분화구','zone'],['화염 유성','meteor'],['화염 돌진','dash'],['불꽃 회오리','spinslash']],
 storm:[['청뢰 낙하','bolt'],['폭풍 가속','haste'],['낙뢰 연쇄','chain'],['뇌광 돌진','dash'],['폭풍 광선','beam'],['뇌운 소용돌이','orbit']],
 ice:[['빙창 관통','pierce'],['서리 방벽','shield'],['눈보라 파동','wave'],['얼음 함정','trap'],['동토 결계','zone'],['빙결 궤도','orbit']],
 forest:[['독가시 탄환','dung'],['세계수 재생','regen'],['덩굴 함정','trap'],['숲의 수호수','summon'],['생명 흡수','drain'],['가시 지대','zone']]
};
function enemyLoadout(id,level){
 const n=level<=2?2:level<=4?4:level<=7?5:6;
 return (LOADOUTS[id]||LOADOUTS.time).slice(0,n).map(a=>[...a]);
}
function choices(id,owned=[],random=Math.random){
 const r=get(id),all=[
  {id:'echo',name:r.blessing,description:'공격 스킬 위력 +18%. 이 도전에서만 적용.'},
  {id:'haste',name:'찰나의 깨달음',description:'모든 스킬 쿨다운 15% 감소. 최대 2회 중첩.'},
  {id:'reach',name:'펼쳐진 경계',description:'공격 스킬 범위 +15%. 최대 2회 중첩.'},
  {id:'element',name:'속성 각성',description:({time:'공격에 빙결 둔화',space:'공격 범위 +25%',fire:'공격에 화상',storm:'투사체 속도 +35%',ice:'공격에 빙결 둔화',forest:'공격에 중독'})[r.id]+' 효과를 부여.'},
  {id:'vital',name:'생명의 샘',description:'매 층 최대 체력 +20%. 최대 2회 중첩.'}
 ].filter(x=>owned.filter(v=>v===x.id).length<(x.id==='element'?1:2));
 for(let i=all.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[all[i],all[j]]=[all[j],all[i]];}
 return all.slice(0,3);
}
function apply(p,id,blessings){
 // Forge instances can share their saved definition: detach before any edit.
 if(p.forge)p.forge=JSON.parse(JSON.stringify(p.forge));
 for(const b of blessings){
  if(b==='vital'){p.maxHp=Math.round(p.maxHp*1.2);p.hp=p.maxHp;}
  for(const s of p.forge?.skills||[]){
   if(b==='haste')s.cooldown=Math.max(.35,s.cooldown*.85);
   for(const a of s.actions||[]){
    if(!(a.damage>0))continue;
    if(b==='echo')a.damage=Math.round(a.damage*1.18);
    if(b==='reach')a.radius=Math.min(200,(a.radius||60)*1.15);
    if(b==='element'){
     if(['time','ice'].includes(id))a.status='ice';
     if(id==='fire')a.status='fire';if(id==='forest')a.status='poison';
     if(id==='space')a.radius=Math.min(200,(a.radius||60)*1.25);
     if(id==='storm')a.speed=Math.min(12,(a.speed||5)*1.35);
    }
   }
  }
 }
}
g.ArenaTowerRealms={REALMS:Object.freeze(REALMS),get,floor,enemyLoadout,choices,apply};
})(globalThis);
