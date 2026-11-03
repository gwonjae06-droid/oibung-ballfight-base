'use strict';
/* Audit-only, seeded random Korean prompts, no changes to game modules. */
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync('js/features/'+n+'.js','utf8');
function boot(){
 const g={Math,Date,Number,Set,Map,WeakMap,console,players:[],
  CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:480,height:320},createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const n of ['action-registry','semantic-physics','physics-law-engine',
 'signature-program','skill-fx-composer','metaphor-visuals',
 'skill-color-policy','semantic-concept-atlas','concept-fusion',
 'imagination-concepts','signature-scratch','fantasy-skill-graph',
 'signature-rule-skill','skill-ir','signature-rule-live',
 'korean-skill-grammar','korean-skill-parameters',
 'signature-prompt-compiler','skill-sentence-engine',
 'arena-body-physics','ball-impact-squash','skill-visuals',
 'studio-pinball-lab'])
  vm.runInContext(source(n),g,{filename:n+'.js'});
 return g;
}
function seeded(seed){
 let x=seed>>>0;
 return ()=>{x|=0;x=x+0x6D2B79F5|0;let t=Math.imul(x^x>>>15,1|x);
 t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
}
const rng=seeded(20261103),pick=a=>a[Math.floor(rng()*a.length)];
const groups=[
 {cat:'알려진 개념 무작위 결합',nouns:[
 'DNA 유전자','기어박스','바이올린','태양풍','우박폭풍','액체금속',
 '피보나치 수열','미생물 군집','무지개빛','초콜릿 폭포','광섬유','심전도'],
 verbs:['적에게 4발 발사한다','적 주변을 소용돌이친다','상대를 구속하는 사슬을 만든다',
 '거대한 충격파를 내뿜는다','몸을 보호하는 방어막을 만든다','적에게 독구름을 만든다']},
 {cat:'사전 밖 동물·생물',nouns:[
 '모래를 먹는 무지개 고래','투명한 여섯 발 달팽이','거꾸로 자라는 수박 두더지',
 '시계를 품은 심해 부엉이','잠든 달의 가재','겨울을 삼키는 미역거인',
 '우유빛 먼지 기린','바퀴 달린 해마'],
 verbs:['투명 탄환을 쏜다','큰 파동을 일으킨다','적을 붙잡아 끌어당긴다',
 '자신을 보호하는 껍질을 만든다','땅속으로 순간이동한다','허공에 분열해 퍼진다']},
 {cat:'사전 밖 신기계',nouns:[
 '양자 시계 토스터','추억 저장 냉장고','방향 감각 없는 자동차 자판기',
 '해바라기 증기 청소기','뒤집힌 QR코드 전동 우산',
 '이별을 감지하는 태양광 도어락','반물질 빨래건조대','눈물을 충전하는 포크레인'],
 verbs:['적에게 레이저를 발사한다','유도탄 3개를 날린다','얼리는 회전파를 만든다',
 '나를 2초 동안 보호한다','자기장으로 적을 잡아끈다','폭발하고 곧바로 복구된다']},
 {cat:'사회·철학 추상 능력',nouns:[
 '기회비용','공정성','사회적 낙인','상관관계','주관적 행복지수',
 '소속감','논리적 모순','집단기억','확률변수','정체성','만장일치','보이지 않는 관료제'],
 verbs:['상대의 생각을 조종한다','시간을 되돌려 적 공격을 없앤다',
 '다른 차원의 문으로 바꾼다','영원히 사라지지 않는 방어막을 만든다',
 '소용돌이로 끌어들인다','상대를 완전히 복제한다']},
 {cat:'기괴한 비유와 신조어',nouns:[
 '심술궂은 소수점','사과의 죄책감','달의 하품','절반만 존재하는 그림자',
 '말라붙은 소나기','주머니 속 미분방정식','지구를 질투하는 피아노',
 '너무 조용한 폭죽','시간을 싫어하는 얼룩','투명한 빨간 산소'],
 verbs:['점프한 뒤 12 피해를 준다','쏘았다가 거꾸로 돌린다',
 '본 적 없는 색으로 폭발시킨다','적에게 구슬 5개를 던진다',
 '적의 발밑에 포털을 만든다','벽에 닿을 때마다 2배로 증식한다']},
 {cat:'복잡한 조건·순서',sentences:[
 '상대가 내 쪽을 보고 있지 않을 때만 분홍색 별빛 탄환을 발사한다.',
 '벽에 세 번 튕긴 직후에만 검은 진동파를 쏘고 그 전에는 피해를 주지 않는다.',
 '적이 보호막을 켜면 흡수한 뒤 파란색 힘의 장으로 반격한다.',
 '바이올린이 한번 울린 뒤 0.7초 후 화염비가 내리고 다시 1.2초 후 멈춘다.',
 '상대가 회피할 때마다 탄환을 분열하되 내 체력이 절반 이하일 때만 발동한다.',
 '방어에 성공한 횟수만큼 레일건이 세지고 4번째에 모든 에너지를 폭발시킨다.',
 '투사체가 벽에 닿으면 다른 투사체로 변신한 뒤 시간정지 룬을 만든다.',
 '적이 3초 이상 가까이 있으면 마력결정이 분열하여 돌아온다.']},
 {cat:'스킬별 색상과 충돌',sentences:[
 '푸른 화염과 붉은 얼음을 한 스킬로 동시에 쏜다.',
 '보라색 DNA 유전자 나선이 폭발한다.',
 '색상 #38bdf8 의 홀로그램이 적에게 유도탄을 발사한다.',
 '노란 번개와 검은 플라스마가 서로 반대 방향으로 회전한다.',
 '초콜릿 폭포가 적에게 쏟아진다.',
 '분홍빛 오로라로 보호막을 만들어 나를 지킨다.',
 '하얀 태양풍으로 소용돌이를 일으켜 적을 끌어당긴다.',
 '회색 절삭기계가 시계방향으로 100번 회전하여 공격한다.']},
 {cat:'부정·모순',sentences:[
 '절대 피해를 주지 않는 999 데미지 레이저를 발사한다.',
 '빨간색이 아닌 새빨간 검은 번개를 만든다.',
 '절대 움직이지 않는 자석이 상대를 시속 1000으로 날려버린다.',
 '힐을 쓰지 않고 치유의 비가 내려 내 체력을 회복한다.',
 '상대 공격을 무조건 막으면서 피해는 0이고 피해량은 80이다.',
 '얼음이지만 결코 차갑지 않은 화염구를 벽에 반사한다.',
 '미사일을 발사하지 않고 5발의 유도 미사일을 발사한다.',
 '잠깐 정지하는데 1시간 동안 시간이 멈추지 않는다.']},
 {cat:'극단 수치·무한',sentences:[
 '분열탄 1000000개를 0.01초마다 영원히 무한 증식시킨다.',
 '반경 999999의 블랙홀로 상대를 힘 1000000으로 끌어당긴다.',
 '방어막을 900000초 동안 유지하고 최대 체력 10000000을 얻는다.',
 '지속시간 -50초의 역중력장에 0의 피해량을 주고 30만 갈래로 쪼갠다.',
 '초당 10000회의 전자기포를 발사하는 가우스포 999발.',
 '구슬이 매초 두 배로 분열하여 1000000000000000개가 될 때까지 반복한다.',
 '1000000가지 색을 각각 레이어로 깔아 1픽셀 소용돌이를 만든다.',
 '0.00000001초마다 적의 과거 체력을 완벽히 복원한다.']},
 {cat:'완전 신개념·게임 외부',sentences:[
 '적의 모든 스킬을 분석하고 영구적으로 학습해 자신의 능력 목록에 추가한다.',
 '상대 브라우저 탭을 닫고 내 게임 화면 밖에서 번개를 떨어뜨린다.',
 '3차원 촉수가 별개 충돌체로 적을 휘감는다.',
 '미래에 받을 피해를 현재 회복량으로 바꿔 인과율을 뒤집는다.',
 '내가 죽으면 게임을 정확히 17초 전으로 되돌리고 적의 기억만 지운다.',
 'QR 코드로 상대 컴퓨터 파일을 암호화하고 공격력을 훔친다.',
 '적의 체력과 관계없이 탄환 중량을 상대 감정에 따라 바꾼다.',
 '상대의 스킬 코드를 스스로 재작성해 새 법칙을 만든다.']},
 {cat:'여러 문장·여러 스킬',sentences:[
 '유리 결정 나선 탄환을 3개 발사한다. 그리고 1초 뒤에 포털을 만든다.',
 '분홍색 마력 수정으로 적을 공격한다. 파란색 기계 톱니 방어막으로 보호한다.',
 '전기모터로 철사를 감고 적을 끌어당긴다. 피해량 40, 범위 160.',
 '별가루를 압축해 레이저를 발사한다. 그다음 적 발밑에 독구름을 만들고 구속한다.',
 '검은색 시간 마법으로 2초간 멈춘다. 노란색 분열탄을 4개 발사한다.',
 '화학 촉매로 반응속도가 빨라진다. 피해를 받으면 얼음 결정을 소환한다.',
 '성벽을 만들고 적이 벽에 부딪히면 기어박스가 폭발한다. 그다음 회복한다.',
 'DNA 유전자를 치료에 사용한다. 잠깐 뒤에 진공 압력파로 적을 밀쳐낸다.']}
];
const samples=[];
for(const group of groups){
 let taken=0,tries=0;
 while(taken<6&&tries++<30){
  const raw=group.sentences?pick(group.sentences):pick(group.nouns)+' '+pick(group.verbs);
  if(samples.some(x=>x.text===raw))continue;
  samples.push({category:group.cat,text:raw});taken++;
 }
}
function probeCanvas(g,action){
 let operations=0;const ctx=new Proxy({globalAlpha:1},{get(obj,k){
  if(k in obj)return obj[k];return (...args)=>{operations++};
 },set(o,k,v){o[k]=v;return true}});
 try{const ok=g.SkillVisuals.previewFrame(ctx,{type:action.type,
  visual:action.visual,phase:'cast',progress:.45,color:'#57bd86',
  radius:110,x:100,y:100});return {ok:!!ok,operations};
 }catch(e){return {ok:false,error:String(e.message||e)};}
}
function probeLab(g,skills){
 const profile={name:'무작위 실험',color:'#57bd86',effectColor:'#57bd86',
 signatureVersion:1,skills:skills.map(s=>({name:s.name||'임의 기술',
  ruleSet:s.recipe,actions:g.SignatureRuleSkill.preview(s.recipe)}))};
 try{
  const lab=g.StudioPinballLab.make(profile,'all');
  const before=lab.balls[1].hp;
  lab.fire();lab.advanceTo(3500);
  return {casts:lab.casts,actions:lab.ruleActions,
   damage:+(before-lab.balls[1].hp).toFixed(2),
   moving:Math.hypot(lab.balls[1].vx,lab.balls[1].vy)>0};
 }catch(e){return {error:String(e.message||e)};}
}
test('60 seeded arbitrary skill sentences: parser, effect painter, pinball runtime',()=>{
 const g=boot();
 assert.equal(samples.length,66);
 console.log('AUDIT_META '+JSON.stringify({seed:20261103,
  count:samples.length,base:'993564e',mode:'production JS + Node VM + real mini pinball',
  warning:'The mini preview is not a full PvP/browser match'}));
 const total={parsed:0,rejected:0,exception:0,painted:0,cast:0,damage:0,
  registered:0,unusualAccepted:0};
 for(let i=0;i<samples.length;i++){
  const s=samples[i],row={n:i+1,category:s.category,sentence:s.text};
  try{
   const result=g.SkillSentenceEngine.parseBundle(s.text);
   row.ok=!!result.ok;row.error=result.error||null;
   row.method=result.method||null;
   const skills=result.skills||[];
   row.skills=skills.length;
   const actions=skills.flatMap(x=>x.recipe?.rules||[]).flatMap(r=>
    r.steps?.length?r.steps.filter(x=>x.kind==='cast').map(x=>x.action):[r.action]).filter(Boolean);
   row.actions=actions.map(x=>x.type);
   row.damage=actions.map(x=>x.damage);
   row.colors=actions.map(x=>x.visual?.colorMode||'none');
   row.explicit=skills.map(x=>x.explicitColor?.color||null);
   row.motifs=[...new Set(actions.flatMap(a=>a.visual?.layers||[]).map(l=>l.kind))];
   row.domains=[...new Set(skills.flatMap(x=>x.concepts?.domains||[]))].slice(0,7);
   row.limits=(result.limitations||[]).slice(0,2);
   row.registered=actions.length>0&&actions.every(a=>!!g.ActionRegistry.get(a.type));
   if(row.registered)total.registered++;
   if(result.ok){
    total.parsed++;
    const paint=probeCanvas(g,actions[0]||{});
    row.paint=paint.ok;row.paintCalls=paint.operations||0;
    if(paint.error)row.paintError=paint.error;
    if(row.paint)total.painted++;
    const lab=probeLab(g,skills);
    row.cast=lab.casts||0;row.ruleActions=lab.actions||0;
    row.previewDamage=lab.damage??null;
    if(lab.error)row.labError=lab.error;
    if(row.cast)total.cast++;
    if(row.previewDamage>0)total.damage++;
    if(['완전 신개념·게임 외부','사회·철학 추상 능력'].includes(s.category))total.unusualAccepted++;
   }else total.rejected++;
  }catch(error){row.exception=String(error.stack||error).slice(0,500);
   total.exception++;}
  console.log('AUDIT_ROW '+JSON.stringify(row));
 }
 console.log('AUDIT_TOTAL '+JSON.stringify(total));
 assert.equal(total.exception,0,'unhandled random input is a parser regression');
});
