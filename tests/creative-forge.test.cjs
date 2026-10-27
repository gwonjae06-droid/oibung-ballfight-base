'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {generate,validate}=require('../server/creative-forge.cjs');
function recipe(){return {profile:{name:'별을 접는 사람',blurb:'슬픔의 별',color:'#8877aa',hp:250,speed:1.8,
  skills:[{name:'슬픔의 별',trigger:'auto',cooldown:3,threshold:40,actions:[{
    type:'shot',pattern:'spiral',target:'nearest',damage:18,radius:150,count:5,speed:5,duration:2,status:'ice',knockback:2,delay:0}]}]},
  interpretation:'나선형 별 투사체가 적을 둔화시킵니다.',adaptations:['슬픔은 둔화 효과로 각색했습니다.']};}
const mock=value=>async()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]})});
test('creative prose reaches model intact and becomes an executable skill',async()=>{
  let sent;
  const text='슬픔을 작은 별로 접어 적에게 뿌린다';
  const out=await generate(text,'별술사',{apiKey:'test-key',fetchImpl:async(url,opts)=>{
    sent=JSON.parse(opts.body);return mock(recipe())();
  }});
  assert.equal(JSON.parse(sent.messages[1].content).text,text);
  assert.equal(sent.response_format.json_schema.strict,true);
  assert.equal(out.profile.name,'별술사');
  assert.equal(out.profile.skills[0].actions[0].pattern,'spiral');
  assert.equal(out.adaptations.length,1);
  const ctx={window:null,CUSTOM_DEFS:[],BEHAVIORS:{},players:[],canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){}};
  ctx.window=ctx;vm.createContext(ctx);
  for(const f of ['ability-atlas.js','skill-forge.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/features',f),'utf8'),ctx);
  const id=ctx.SkillForge.register(out.profile),p=ctx.CUSTOM_DEFS[0].createInstance(1);
  const enemy={playerNum:2,x:200,y:200,hp:200,radius:34,invincible:0};
  ctx.players.push(p,enemy);p.forgeTicks[0]=180;
  ctx.BEHAVIORS[id].update(p,enemy);
  assert.equal(p.forgeShots.length,5);
  assert.equal(p.forgeShots[0].a.status,'ice');
});
test('reject unsupported actions and invalid numeric/model results',async()=>{
  for(const mutate of [r=>r.profile.skills[0].actions[0].type='time-travel',r=>r.profile.skills[0].actions[0].damage=Infinity,r=>r.profile.skills=[],r=>r.profile.skills[0].actions[0].code='alert(1)']){
    const value=recipe();mutate(value);assert.throws(()=>validate(value));
    await assert.rejects(generate('시간을 되감는다','',{apiKey:'test',fetchImpl:mock(value)}));
  }
});
test('missing credentials and overlong inputs fail before provider request',async()=>{
  await assert.rejects(generate('슬픔의 별을 접는다',''),{status:503});
  await assert.rejects(generate('별'.repeat(1401),'',{apiKey:'test',fetchImpl:()=>{throw Error('must not call');}}),{status:400});
});
test('creative browser mode never disguises server failure as successful grammar',async()=>{
  const ctx={window:null,location:{protocol:'https:'},AbortSignal,SkillForge:{normalize:x=>x},fetch:async()=>({status:404})};
  ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/features/natural-forge.js'),'utf8'),ctx);
  await assert.rejects(ctx.NaturalForge.analyze('슬픔을 별로 접는다','별','creative'),/AI 서버가 없습니다/);
  ctx.fetch=async()=>({ok:true,status:200,json:async()=>recipe()});
  const out=await ctx.NaturalForge.analyze('슬픔을 별로 접는다','별','creative');
  assert.equal(out.mode,'server-ai');assert.equal(out.profile.skills[0].actions[0].type,'shot');
});
