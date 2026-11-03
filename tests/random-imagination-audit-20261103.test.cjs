'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=n=>fs.readFileSync('js/features/'+n+'.js','utf8');
function boot(){
 const g={Math,Date,Number,Set,Map,WeakMap,console,players:[],
  CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},canvas:{width:480,height:320},
  createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 const files=['action-registry','semantic-physics','physics-law-engine','signature-program',
 'skill-fx-composer','metaphor-visuals','skill-color-policy','semantic-concept-atlas',
 'concept-fusion','imagination-concepts','signature-scratch','fantasy-skill-graph',
 'signature-rule-skill','skill-ir','signature-rule-live','korean-skill-grammar',
 'korean-skill-parameters','signature-prompt-compiler','skill-sentence-engine',
 'skill-visuals','studio-pinball-lab'];
 for(const f of files)vm.runInContext(read(f),g,{filename:f+'.js'});
 return g;
}
let seed=20261103;
function rand(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;}
const choose=a=>a[Math.floor(rand()*a.length)];
const known=['DNA 유전자','프랙탈 수열','오로라','양자역학','테슬라 코일',
 '초콜릿 폭포','해파리 촉수','레일건','프리즘','태양풍','심전도','지진파',
 '피보나치 수열','바이올린','코로나질량방출','벌떼','불사조','자동 포탑',
 '마법진','드래곤 브레스','나노머신','회오리바람','블랙홀','미세 로봇',
 '고속열차','증기 피스톤','마력 수정','유성우','무지개','뫼비우스띠',
 '포자구름','해류','피아노 건반'];
const novel=['인과율 역행','지워진 미래','은하계의 지문','언어를 먹는 그림자',
 '철학적 좀비','추억의 중력','라플라스의 악마','거짓말의 질량',
 '고양이의 역설','기억의 지평선','서사의 마찰','미지수의 심장',
 '무한한 사회적 신뢰','공허의 소수','확률의 미로','불가능한 삼각형',
 '역방향 엔트로피','빛보다 빠른 침묵','색깔 없는 무지개','감정 양자화',
 '주파수를 먹는 용','꿈의 실리콘','말을 따라오는 점토','음식의 인공지능'];
const verbs=[
 ['적을 향해 4발을 쏘고 추적한다','homing'],
 ['적에게 명중하면 강력히 폭발한다','burst'],
 ['상대를 끌어당기면서 빙빙 회전시킨다','attract_spin'],
 ['적을 밀어내며 피해를 준다','damage'],
 ['아군을 회복시키고 보호막을 건다','heal_shield'],
 ['갈라져 세 개의 탄환으로 분열한다','split'],
 ['반경 170의 영역에 지속해서 퍼진다','area'],
 ['적을 구속 사슬로 붙잡아 휘감는다','tether'],
 ['3초 동안 서서히 약해지는 물리 법칙을 만든다','physical_time'],
 ['시계방향으로 공전하며 적을 공격한다','orbit'],
 ['적에게 순간이동하여 공격한다','blink'],
 ['상대의 운동량을 흡수해 저장했다가 방출한다','relay']
];
const colors=['','붉은색 ','푸른 ','검은 ','금빛 ','은색 ','아주 거대하게 ','작은 구슬로 ','빛이 거의 없이 ','별처럼 '];
const spec=['','','','','',' 피해량 37',' 반경 180',' 2초 동안'];
const cases=[];
for(let i=0;i<48;i++){
 const kind=i<24?'registered':'unregistered';
 const noun=choose(kind==='registered'?known:novel);
 const other=choose(known),verb=choose(verbs),color=choose(colors);
 const sentence=choose([
  color+noun+'이 '+verb[0]+'.',
  color+noun+'을 '+other+'와 결합해 '+verb[0]+'.',
  color+noun+'을 빛처럼 비유하여 '+verb[0]+'.',
  color+noun+'을 '+other+'로 만들고 '+verb[0]+'.'
 ]);
 cases.push({id:i+1,kind,input:sentence+choose(spec),intent:verb[1]});
}
const outside=[
 ['영원히 무한대로 커지는 무적의 절대 방어막을 친다.','infinite'],
 ['이 스킬은 오직 수학적으로 존재하지 않는 네 번째 색으로만 빛난다.','unregistered_color'],
 ['적의 기억을 지우고 나와 똑같은 존재로 완전히 바꾼다.','memory_control'],
 ['브라우저 탭을 100개 열어 적의 컴퓨터를 물리적으로 멈춘다.','browser_control'],
 ['적이 나보다 빨라질 때마다 이전 스킬을 그대로 학습해 복제한다.','copy_skill'],
 ['무(無) 그 자체를 소환하고 그 그림자를 12차원으로 접는다.','abstract'],
 ['안개처럼 사라지다가 다음 판의 결과를 미리 계산해 뒤집는다.','time_future'],
 ['시작할 때 아무 효과도 쓰지 말고 가만히 있는다.','negation'],
 ['분홍색 번개로 적을 4번 타격하고 명중할 때마다 투사체가 분열한다.','chain_physics'],
 ['반경 3000, 피해량 999999인 영구 블랙홀을 소환한다.','bounds'],
 ['색상 #00ff88의 레일건으로 공격하고 다른 스킬은 원래 캐릭터 색을 따른다.','hex_color'],
 ['중력과 전자석이 반대 방향으로 작용하는 영역을 생성한다.','physics']];
for(let j=0;j<outside.length;j++)cases.push({id:49+j,kind:'adversarial',input:outside[j][0],intent:outside[j][1]});
const probes={
 homing:aa=>aa.some(a=>a.fusion?.homing||a.type==='homing'),
 burst:aa=>aa.some(a=>a.fusion?.impact==='burst'||['wave','nova','erupt'].includes(a.type)),
 attract_spin:aa=>aa.some(a=>(a.law?.terms||[]).some(t=>['attract','gravity'].includes(t.op)))&&
 aa.some(a=>(a.law?.terms||[]).some(t=>['spin','orbit'].includes(t.op)))||aa.some(a=>a.type==='vortex'),
 damage:aa=>aa.some(a=>a.damage>0),heal_shield:aa=>aa.some(a=>['heal','regen','shield','lifebloom'].includes(a.type)),
 split:aa=>aa.some(a=>a.fusion?.split||a.type==='splitshot'),
 area:aa=>aa.some(a=>['zone','wave','phenomenon','vortex','blackhole'].includes(a.type)),
 tether:aa=>aa.some(a=>a.type==='tether'),
 physical_time:aa=>aa.some(a=>a.law?.decay&&a.law.decay!=='steady'),
 orbit:aa=>aa.some(a=>['orbit','vortex'].includes(a.type)||(a.law?.terms||[]).some(t=>['orbit','spin'].includes(t.op))),
 blink:aa=>aa.some(a=>['blink','portal','swap'].includes(a.type)),
 relay:aa=>aa.some(a=>a.type==='kinetic_relay')
};
function actions(r){
 const arr=[];
 const walk=steps=>{for(const s of steps||[]){
  if(s.action)arr.push(s.action);
  walk(s.body);walk(s.then);walk(s.else);
 }};
 for(const rule of r?.rules||[]){
  if(rule.steps?.length)walk(rule.steps);
  else if(rule.action)arr.push(rule.action);
 }
 return arr;
}
function canvas(){const noop=()=>{};return new Proxy({globalAlpha:1},{get(o,k){return k in o?o[k]:noop;},set(o,k,v){o[k]=v;return true;}});}
function render(g,a){
 try{return g.SkillVisuals.previewFrame(canvas(),{type:a.type,visual:a.visual,phase:'cast',progress:.4,radius:a.radius,color:'#cc44ff'})===true;}
 catch(e){return 'error:'+e.message.slice(0,90);}
}
function customRuntime(g,a){
 if(!['phenomenon','kinetic_relay','tether','repulse','vortex'].includes(a.type))return {tried:false};
 const p={x:100,y:100,vx:2,vy:1,playerNum:1,hp:300,forge:{effectColor:'#aabbcc'}};
 const e={x:145,y:105,vx:5,vy:3,playerNum:2,hp:300,radius:19};
 let hits=0;
 const hit=(_p,v,action)=>{if(action.damage>0){hits++;v.hp-=action.damage;}return true;};
 try{
  const run=g.ActionRegistry.run(p,a,e,{hit,enemies:()=>[e]});
  for(let i=0;i<95;i++){
   g.SemanticPhysics?.tick?.(p,[e],hit);
   g.PhysicsLawEngine?.tick?.(p,[e],hit);
   g.ImaginationConcepts?.relayTick?.(p,[e],hit);
  }
  return {tried:true,run,hits,damage:300-e.hp,
   velocityChange:Math.round((Math.hypot(e.vx,e.vy)-Math.hypot(5,3))*100)/100};
 }catch(err){return {tried:true,error:err.message.slice(0,90)};}
}
test('Audit 60 seeded Korean skill prompts; report unsupported behavior without altering production',()=>{
 assert.equal(cases.length,60);
 const g=boot(),stats={parse:0,vfx:0,semantic:0,offensePath:0,customRun:0,customDamage:0,
  exact:0,partial:0,rejected:0,falsePositive:0,exception:0};
 console.log('AUDIT_META|'+JSON.stringify({sha:'993564e157e00b07a5a639d03af6b34c0f099774',seed:20261103,count:cases.length}));
 for(const item of cases){
  let result;
  try{
   const parse=g.SkillSentenceEngine.parse(item.input),aa=actions(parse.recipe),ok=parse.ok===true&&aa.length>0;
   const visuals=ok?aa.map(a=>render(g,a)):[];
   const vfx=visuals.some(x=>x===true),semantic=probes[item.intent]?ok&&probes[item.intent](aa):null;
   const offensive=ok&&aa.some(a=>a.damage>0&&g.ActionRegistry.get(a.type)?.offense);
   const runtime=ok?customRuntime(g,aa[0]):{tried:false};
   const recognized=g.SemanticConceptAtlas.match(item.input).length;
   const named=g.SkillColorPolicy.explicit(item.input);
   const correctColor=!named||aa[0]?.visual?.colorMode==='explicit';
   const limits=/무한|영원히|절대\s*무적|해킹|기억을\s*지우|미리\s*계산/.test(item.input);
   let grade=!ok?'거부/미구현':
    semantic===true&&vfx&&correctColor&&!limits?'핵심의도실현':
    semantic===null&&recognized===0&&limits?'오인식위험':'부분/의미누락';
   if(ok)stats.parse++;
   if(vfx)stats.vfx++;
   if(semantic===true)stats.semantic++;
   if(offensive)stats.offensePath++;
   if(runtime.tried)stats.customRun++;
   if(runtime.hits>0)stats.customDamage++;
   if(grade==='핵심의도실현')stats.exact++;
   else if(grade==='거부/미구현')stats.rejected++;
   else if(grade==='오인식위험')stats.falsePositive++;
   else stats.partial++;
   result={id:item.id,kind:item.kind,text:item.input,intent:item.intent,grade,ok,
    parser:parse.method||null,matchedConcepts:recognized,types:aa.map(a=>a.type),
    effects:aa[0]?.visual?.layers?.map(l=>l.kind)||[],color:aa[0]?.visual?.colorMode,
    vfx,semantic,offensive,runtime,error:parse.error||null,
    limitations:(parse.limitations||[]).slice(0,1)};
  }catch(e){stats.exception++;result={id:item.id,kind:item.kind,text:item.input,
   intent:item.intent,grade:'실행예외',error:e.message.slice(0,120)};}
  console.log('AUDIT_ROW|'+JSON.stringify(result));
 }
 console.log('AUDIT_SUMMARY|'+JSON.stringify(stats));
});
