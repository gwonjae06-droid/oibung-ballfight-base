'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function visuals(){
  const calls=[];
  const ctx=new Proxy({},{get(o,k){
    if(k in o)return o[k];
    return (...args)=>{calls.push([k,...args]);};
  },set(o,k,v){o[k]=v;return true;}});
  const world={window:null,Math,console};
  world.window=world;vm.createContext(world);
  vm.runInContext(read('js/features/skill-visuals.js'),world);
  return {world,fx:world.SkillVisuals,calls,ctx};
}
const fighter=()=>({x:100,y:100,radius:28,hp:250,forge:{effectColor:'#aabbdd'},borderColor:'#0088dd'});
test('stone rim rests between attacks and disappears after 180 simulated frames (3s)',()=>{
  const {fx,calls,ctx}=visuals(),a=fighter(),b={x:140,y:100};
  assert.equal(fx.ARM_IDLE_FRAMES,180);
  fx.contact(a,b);
  fx.drawAction(ctx,a,0);
  assert.ok(calls.some(v=>v[0]==='arc'),'rim response should be visible when used');
  for(let i=0;i<179;i++)fx.tick();
  calls.length=0;fx.drawAction(ctx,a,0);
  assert.ok(calls.some(v=>v[0]==='arc'),'resting rim response is still visible before 3s');
  fx.tick();calls.length=0;fx.drawAction(ctx,a,0);
  assert.ok(!calls.some(v=>v[0]==='arc'),'idle rim response hides after 3s');
});
test('each new real rim response action resets three-second idle timer',()=>{
  const {fx,ctx,calls}=visuals(),p=fighter();
  fx.cast(p,{type:'shot',radius:90},{x:150,y:100});
  for(let i=0;i<170;i++)fx.tick();
  fx.cast(p,{type:'uppercut',radius:60},{x:150,y:100});
  for(let i=0;i<90;i++)fx.tick();
  calls.length=0;fx.drawAction(ctx,p);
  assert.ok(calls.some(c=>c[0]==='arc'),'new action keeps rim response visible');
  for(let i=0;i<90;i++)fx.tick();
  calls.length=0;fx.drawAction(ctx,p);
  assert.ok(!calls.some(c=>c[0]==='arc'),'rim response expires relative to latest use');
  fx.cast(p,{type:'uppercut'},{x:150,y:100});fx.clear();
  calls.length=0;fx.drawAction(ctx,p);
  assert.equal(calls.filter(c=>c[0]==='arc').length,0,'round reset clears rim response state');
});
function rankWorld(){
  const world={window:null,console,Math,SkillForge:{
    normalize:v=>{
      if(!v||!Array.isArray(v.skills))throw Error('invalid profile');
      return v;
    }
  }};
  world.window=world;vm.createContext(world);
  vm.runInContext(read('js/features/community-forge.js'),world);
  vm.runInContext(read('js/features/community-power-rank.js'),world);
  return world;
}
const config=(name,hp=250,speed=1.8,damage=22,cooldown=3)=>({
  name,hp,speed,color:'#fff',skills:[{cooldown,actions:[
    {type:'shot',damage,radius:110,status:'none',count:1}]}]
});
const issue=(num,author,profile)=>({
  number:num,title:'[ARENA SHARE] '+profile.name,user:{login:author},
  body:'오이붕 아레나 캐릭터 공유\n\nOIBUNG-CHARACTER-V1\n'+
    JSON.stringify(profile)+'\nEND-OIBUNG-CHARACTER-V1'
});
test('estimated power is deterministic, stat-based, and not a fabricated win-rate',()=>{
  const w=rankWorld(),score=w.CommunityPowerRanking.power;
  const a=config('기본'),strong=config('강함',500,4.7,90,.4);
  assert.equal(score(a),score(JSON.parse(JSON.stringify(a))));
  assert.ok(score(strong)>score(a),'higher stats and faster attacks should be stronger');
  assert.ok(score(strong)<=1200,'score is bounded');
  assert.equal(score({skills:[]}),100,'valid empty attack set has baseline score');
  assert.ok(!read('js/features/community-power-rank.js').includes('winRate'));
});
test('power ranking shows only public shares, deduplicates one author/name, sorts by score',()=>{
  const w=rankWorld(),rank=w.CommunityPowerRanking.rank;
  const shares=[
    {number:4,author:'alice',profile:config('Alpha',170,1,5)},
    {number:8,author:'bob',profile:config('Beta',450,5,70)},
    {number:6,author:'alice',profile:config('Alpha',250,1.8,24)},
    {number:9,author:'carol',profile:config('Gamma',380,2,45)}
  ];
  const out=rank(shares);
  assert.equal(out.length,3);
  assert.equal(out[0].author,'bob');
  assert.equal(out.find(x=>x.name==='Alpha').number,6);
  assert.ok(out.every(x=>Number.isFinite(x.score)));
  assert.equal(rank(shares,2).length,2);
});
test('GitHub sharing API excludes pull requests and malformed entries; no invented fighters',async()=>{
  const w=rankWorld();
  let calls=0;
  const valid=issue(12,'maker',config('공유된 파이터',300,2.5,40));
  const malformed={number:13,title:'[ARENA SHARE] malformed',body:'invalid',user:{login:'oops'}};
  w.fetch=async url=>{
    calls++;
    assert.ok(url.includes('/issues?state=open'));
    return {ok:true,json:async()=>[
      valid,{...issue(14,'pr',config('PR')),pull_request:{url:'fake'}},
      malformed,{number:15,title:'just an issue',body:valid.body}
    ]};
  };
  const list=await w.CommunityForge.loadShared();
  assert.equal(list.length,1);
  assert.equal(list[0].author,'maker');
  assert.equal(list[0].number,12);
  assert.ok(list[0].html_url.endsWith('/issues/12'));
  assert.equal(w.CommunityPowerRanking.rank(list)[0].name,'공유된 파이터');
  assert.equal((await w.CommunityForge.loadShared()).length,1);
  assert.equal(calls,1,'cache avoids redundant public API calls');
});
test('ranking sidebar lives left on PC and after game on mobile, with import guarded mid-match',()=>{
  const css=read('css/style.css'),html=read('index.html'),
    rankSrc=read('js/features/community-power-rank.js');
  assert.ok(css.includes('body.has-power-ranking > .community-power-ranking'));
  assert.ok(css.includes('@media(min-width:1200px)'));
  assert.ok(css.includes('position:sticky'));
  assert.ok(css.includes('@media(max-width:1199px)'));
  assert.ok(css.includes('order:2'));
  assert.ok(html.includes('js/features/community-power-rank.js'));
  assert.ok(html.indexOf('js/features/community-forge.js')<
    html.indexOf('js/features/community-power-rank.js'));
  assert.ok(rankSrc.includes("typeof roundStarted!=='undefined'"));
  assert.ok(rankSrc.includes("global.SkillForge.register(share.profile)"));
  assert.ok(rankSrc.includes('아직 공개된 공유 캐릭터가 없습니다.'));
});
