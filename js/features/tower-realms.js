/* Immutable content and run-local blessings. No storage or DOM dependencies. */
(function(g){
'use strict';
const REALMS=[
 {id:'time',name:'시간의 탑',icon:'◷',color:'#f5ce78',scene:8,subtitle:'멈춘 시계의 성채',terrain:'가속·정체 시계판',hint:'황금 시계판에서는 스킬 충전이 빨라집니다. 정체 시계판은 이동과 스킬 충전을 늦춥니다.',bosses:['시간의 파수꾼','영겁의 시계신'],pattern:'시계 바늘',blessing:'시간의 잔향'},
 {id:'space',name:'우주의 탑',icon:'✧',color:'#c8aaff',scene:9,subtitle:'무중력의 별자리',terrain:'중력·반중력 궤도',hint:'예고된 중력장은 중심으로 끌어당기고 반중력장은 밀어냅니다.',bosses:['중력의 지배자','특이점의 군주'],pattern:'공전 고리',blessing:'별의 파편'},
 {id:'fire',name:'화염의 탑',icon:'♨',color:'#ffad72',scene:4,subtitle:'흑요석 아래의 심장',terrain:'용암 균열·분화 화구',hint:'오래 예고된 용암 균열을 벗어나세요. 분화는 피해와 화상을 일으킵니다.',bosses:['용암의 심장','종말의 화산왕'],pattern:'용암 십자',blessing:'잿불 각인'},
 {id:'storm',name:'폭풍의 탑',icon:'ϟ',color:'#8ce7f3',scene:3,subtitle:'구름 위 뇌명의 첨탑',terrain:'순환 돌풍·낙뢰 전선',hint:'돌풍은 이동 경로를 바꾸고 낙뢰 전선은 예고 후 공격합니다.',bosses:['천둥의 파수꾼','폭풍의 제왕'],pattern:'번개 격자',blessing:'폭풍의 박동'},
 {id:'ice',name:'빙결의 탑',icon:'❄',color:'#bcecff',scene:2,subtitle:'푸른 결정의 성소',terrain:'미끄럼판·동결 빙정',hint:'얼음판에서는 관성이 커집니다. 동결 빙정은 둔화와 짧은 속박을 일으킵니다.',bosses:['빙정의 수호자','영원의 빙하왕'],pattern:'서리 봉쇄',blessing:'빙정의 숨결'},
 {id:'forest',name:'숲의 탑',icon:'♧',color:'#b5e992',scene:6,subtitle:'고대 뿌리의 미궁',terrain:'맹독 포자·파수목·뿌리',hint:'포자숲은 중독을, 파수목은 주기 피해를, 뿌리는 속박을 일으킵니다.',bosses:['고목의 수호자','세계수의 심장'],pattern:'뿌리 포위',blessing:'세계수의 씨앗'}
].map(x=>Object.freeze({...x,bosses:Object.freeze(x.bosses)}));
const ENEMIES={
 time:['초침석','역행석','정지핵','초침석','역행석','정지핵','초침석','역행석'],
 space:['성운석','위성석','중력핵','성운석','위성석','중력핵','성운석','위성석'],
 fire:['잿불석','화산갑석','분화핵','잿불석','화산갑석','분화핵','잿불석','화산갑석'],
 storm:['뇌전석','운무석','선풍석','뇌전석','운무석','선풍석','뇌전석','운무석'],
 ice:['서리석','빙정석','동결핵','서리석','빙정석','동결핵','서리석','빙정석'],
 forest:['씨앗석','포자석','수액핵','씨앗석','포자석','수액핵','씨앗석','포자석'],
};
const get=id=>REALMS.find(r=>r.id===id)||REALMS[0];
function floor(base,id){
 const r=get(id),f={...base};
 f.name=f.boss?r.bosses[f.number===10?1:0]:(ENEMIES[r.id]||ENEMIES.time)[f.number<=4?f.number-1:f.number-2]+' · '+f.number+'층';
 f.description=f.boss?r.pattern+' · HP 50% 이하 2페이즈':r.terrain+' · '+r.hint;
 f.scene=r.id;f.realm=r.id;f.difficulty=f.boss?'특수 보스':'테마 도전';
 // Every realm changes actual combat statistics, not only colors.
 const balance={
  time:{hp:1,damage:.85,speed:1.1,cooldown:.62},
  space:{hp:1.12,damage:1.05,speed:.95,cooldown:.85},
  fire:{hp:.9,damage:1.75,speed:1.06,cooldown:.82},
  storm:{hp:.83,damage:1.02,speed:2.25,cooldown:.58},
  ice:{hp:1.9,damage:.84,speed:.75,cooldown:.88},
  forest:{hp:1.18,damage:.9,speed:.93,cooldown:.65}
 }[r.id];
 f.hp=Math.round((190+f.number*26+(f.boss?170:0))*balance.hp);
 f.damage=Math.round((15+f.number*3)*balance.damage);
 f.speed=Math.min(5,(1.35+f.number*.14)*balance.speed);
 f.cooldown=Math.max(.45,(2.6-f.number*.12)*balance.cooldown);
 f.description+=(r.id==='storm'?' · 초고속 전투':r.id==='ice'?' · 높은 방어와 빙결':r.id==='forest'?' · 독과 소환수':r.id==='fire'?' · 치명적 화염 공격':r.id==='time'?' · 시간 능력 연속 발동':' · 중력과 별의 폭격');

 return f;
}
const LOADOUTS={
 time:[['초침 폭주','timeburst'],['시간의 족쇄','timestop'],['회귀의 방','rewind'],['시간 도약','blink'],['역행 파동','wave'],['반복되는 순간','timeburst']],
 space:[['특이점 생성','blackhole'],['유성우 폭격','starfall'],['위성 공전','orbit'],['중력장 압축','blackhole'],['우주 운석','meteor'],['성운 추적','homing']],
 fire:[['지옥불 폭발','nova'],['용암 범람','zone'],['열화 유성','meteor'],['화염탄 폭격','shot'],['분화 폭발','erupt'],['태양 화염','starfall']],
 storm:[['섬광 질주','haste'],['뇌신의 돌진','dash'],['천둥 연쇄','chain'],['벼락 낙하','bolt'],['폭풍 광선','beam'],['뇌전 궤도','orbit']],
 ice:[['영구 동토','fortify'],['빙정 방벽','shield'],['서리 봉쇄','zone'],['얼어붙은 사슬','trap'],['빙창 관통','pierce'],['냉기 충격','wave']],
 forest:[['맹독 포자','dung'],['독성 수호수','summon'],['수호수 증식','summon'],['독가시 장판','zone'],['흡혈 덩굴','drain'],['포자 군단','summon']]
};
function enemyLoadout(id,level){
 const n=level%5===0?6:level<=2?2:3;
 const load=LOADOUTS[id]||LOADOUTS.time;
 // Alternate opening skills between floors, without losing realm identity.
 const shift=(level-1)%Math.min(3,load.length);
 return Array.from({length:n},(_,i)=>[...load[(i+shift)%load.length]]);
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
