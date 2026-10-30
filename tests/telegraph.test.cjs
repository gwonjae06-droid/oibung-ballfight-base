'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync('js/features/arena-telegraph.js','utf8');
function init(extra={}){
 const w={console,Math,Number,Set,Map,Date,
  CUSTOM_DEFS:[],CHARACTER_PHOTOS:{},BEHAVIORS:{},players:[],
  canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},
  getClosestAliveEnemy(p){return w.players.find(e=>e!==p&&e.hp>0)||null;},...extra};
 w.window=w;vm.createContext(w);vm.runInContext(src,w,{filename:'arena-telegraph.js'});
 return w;
}
const q=(type,remaining=6,castId=1)=>({a:{type,radius:140,target:'nearest'},windup:12,remaining,castId,targetNum:2});
function ctx(){
 const calls={arcs:0,lines:0,saves:0,restores:0};
 const c=new Proxy({}, {get:(o,k)=>typeof o[k]!=='undefined'?o[k]:
  k==='arc'?()=>calls.arcs++:k==='lineTo'?()=>calls.lines++:
  k==='save'?()=>calls.saves++:k==='restore'?()=>calls.restores++:
  ()=>{},set:(o,k,v)=>(o[k]=v,true)});
 return {c,calls};
}
test('six classes map to readable cues with short, consistent preparation',()=>{
 const a=init().ArenaTelegraph;
 assert.equal(a.category({type:'slash'}),'melee');
 assert.equal(a.category({type:'shot'}),'ranged');
 assert.equal(a.category({type:'bolt'}),'area');
 assert.equal(a.category({type:'dash'}),'movement');
 assert.equal(a.category({type:'shield'}),'support');
 assert.equal(a.category({type:'charge'}),'none');
 assert.equal(a.leadFrames({type:'slash'}),11);
 assert.equal(a.leadFrames({type:'zone'}),15);
 assert.equal(a.leadFrames({type:'charge'}),0);
});
test('cue visibility comes only from real pending SkillForge queue',()=>{
 const a=init().ArenaTelegraph,p={forgeQueue:[q('shot',14)]};
 assert.equal(a.preview(p).length,0,'long delays are not giant banners');
 p.forgeQueue[0].remaining=6;
 assert.equal(a.preview(p).length,1);
 p.forgeQueue=[];
 assert.equal(a.preview(p).length,0,'executed or canceled actions cannot leave ghosts');
 p.forgeQueue=[q('charge',0)];
 assert.equal(a.preview(p).length,0,'charge uses its dedicated ring instead');
});
test('minimal screen clutter: maximum five casters and one cue per caster',()=>{
 const w=init(),{c,calls}=ctx(),roster=[];
 for(let i=1;i<=10;i++)roster.push({playerNum:i,x:35*i,y:90,hp:200,radius:22,
   forgeQueue:[q('slash',6,1),q('shot',6,1)],forge:{effectColor:'#7AA9E3'}});
 // Assigned target 2 for every fighter, except fighter 2 falls back to another alive fighter.
 w.ArenaTelegraph.draw(c,roster);
 assert.equal(calls.saves,5);
 assert.equal(calls.saves,calls.restores,'canvas state never leaks');
 assert.ok(calls.arcs>=10,'minimal ring and one target indication');
 roster.forEach(p=>p.forgeQueue=[]);
 const fresh=ctx();w.ArenaTelegraph.draw(fresh.c,roster);
 assert.equal(fresh.calls.saves,0);
});
test('online clients consume host preview without requiring a duplicated damage engine',()=>{
 const w=init(),p={hp:200,x:100,y:100,radius:24,playerNum:1,
  forgeQueue:[],telegraphPreviews:[{...w.ArenaTelegraph.data(q('shot',6)),targetNum:2}],
  forge:{effectColor:'#5F95BC'}};
 const e={hp:180,x:210,y:115,radius:24,playerNum:2};
 assert.equal(w.ArenaTelegraph.preview(p).length,1);
 const {c,calls}=ctx();w.ArenaTelegraph.draw(c,[p,e]);
 assert.ok(calls.lines>=2,'actual target cue rendered');
 p.telegraphPreviews=[];
 const clean=ctx();w.ArenaTelegraph.draw(clean.c,[p,e]);
 assert.equal(clean.calls.saves,0);
});
test('skill effects never fire during visible windup; normal hit logic runs afterward',()=>{
 const w=init();
 vm.runInContext(fs.readFileSync('js/features/skill-forge.js','utf8'),w,{filename:'skill-forge.js'});
 const id=w.SkillForge.register({name:'윈드업 확인',hp:250,speed:2,color:'#6684aa',
  skills:[{name:'전방 충격파',trigger:'auto',cooldown:5,actions:[
    {type:'wave',damage:30,radius:180,count:1}]}]});
 const hero=w.CUSTOM_DEFS[0].createInstance(1);
 const target={playerNum:2,x:155,y:100,hp:240,maxHp:240,invincible:0,vx:0,vy:0,radius:24};
 hero.x=100;hero.y=100;hero.forgeTicks=[999];w.players=[hero,target];
 for(let i=0;i<6;i++)w.BEHAVIORS[id].update(hero,target);
 assert.equal(target.hp,240,'no invisible early hit');
 assert.ok(w.ArenaTelegraph.preview(hero).length>0,'visible preparation while queued');
 for(let i=0;i<20;i++)w.BEHAVIORS[id].update(hero,target);
 assert.ok(target.hp<240,'real authored damage still occurs after windup');
 assert.equal(w.ArenaTelegraph.preview(hero).length,0,'cue disappears after action execution');
});
test('all surfaces load one shared preparation module before SkillForge',()=>{
 for(const path of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(path,'utf8');
  assert.ok(html.indexOf('arena-telegraph.js')>=0);
  assert.ok(html.indexOf('arena-telegraph.js')<html.indexOf('skill-forge.js'));
 }
 const rt=fs.readFileSync('js/features/pvp-runtime.js','utf8');
 assert.match(rt,/telegraphPreviews/);
 assert.match(rt,/ArenaTelegraph\?\.draw/);
});
