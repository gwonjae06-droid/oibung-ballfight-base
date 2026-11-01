'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function sandbox(){
 const g={window:null,globalThis:null,console,Math,Date,Set,Map,WeakMap};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['js/features/action-registry.js','js/features/signature-program.js',
  'js/features/signature-scratch.js','js/features/arena-body-physics.js',
  'js/features/ball-impact-squash.js','js/features/studio-pinball-lab.js'])
   vm.runInContext(read(file),g,{filename:file});
 return g;
}
const demo=(action={type:'splitshot',count:3,damage:18,speed:6})=>({
 name:'실험 캐릭터',color:'#4d99ff',effectColor:'#b59afb',signatureVersion:1,
 skills:[{name:'내가 만든 탄환',cooldown:1,trigger:'auto',actions:[action],
  program:[{kind:'action',action}]}]
});
function mockContext(){
 const operations=[],holder={};
 const ctx=new Proxy(holder,{get(obj,key){
  if(key in obj)return obj[key];
  return (...args)=>operations.push({key,args});
 },set(obj,key,v){obj[key]=v;return true;}});
 return {ctx,operations};
}
test('mini arena launches two genuine independently moving balls and retains physical bounds',()=>{
 const g=sandbox(),lab=g.StudioPinballLab.make(demo());
 const [hero,foe]=lab.balls;
 assert.ok(hero.vx>0&&foe.vx<0);
 const before=[hero.x,hero.y,foe.x,foe.y];
 lab.advanceTo(5000);
 assert.notDeepEqual([hero.x,hero.y,foe.x,foe.y],before);
 for(const ball of lab.balls){
  assert.ok(ball.x>=19+ball.radius&&ball.x<=480-19-ball.radius);
  assert.ok(ball.y>=19+ball.radius&&ball.y<=300-19-ball.radius);
 }
 assert.ok(lab.casts>=1,'charged authored skill fires in practice');
});
test('custom signature uses its actual Scratch program rather than an obsolete baseline',()=>{
 const g=sandbox(),a=demo();
 a.skills[0].actions=[{type:'wave',damage:999}];
 a.skills[0].program=[{kind:'action',action:{type:'homing',speed:9,damage:17}}];
 const selected=g.StudioPinballLab.actionsFor(a,0);
 assert.equal(selected.length,1);
 assert.equal(selected[0].actions[0].type,'homing');
 assert.equal(selected[0].actions[0].speed,9);
 assert.notEqual(selected[0].actions[0].type,a.skills[0].actions[0].type);
});
test('previous basic-hit Scratch condition is migrated into skill-hit condition',()=>{
 const g=sandbox();
 const data=g.SignatureScratch.normalize([
  {kind:'if',condition:'basicHit',
   then:[{kind:'action',action:{type:'wave',damage:14}}],else:[]},
  {kind:'if',condition:'basicStatus',
   then:[{kind:'action',action:{type:'shot',damage:12}}],else:[]}
 ]);
 assert.equal(data[0].condition,'hit');
 assert.equal(data[1].condition,'status');
 assert.ok(!Object.hasOwn(g.SignatureProgram.CONDITIONS,'basicHit'));
 assert.ok(!Object.hasOwn(g.SignatureProgram.CONDITIONS,'basicStatus'));
});

test('force energy button changes only isolated practice energy and launches one skill',()=>{
 const g=sandbox(),a=demo({type:'wave',radius:90});
 const lab=g.StudioPinballLab.make(a);
 const original=JSON.stringify(a);
 lab.fire();
 assert.equal(lab.energy,100);
 lab.advanceTo(300);
 assert.ok(lab.casts>=1);
 assert.equal(JSON.stringify(a),original,'draft cannot be mutated by preview');
});
test('wall and bumper rebounds really deform the ball and preserve its velocity',()=>{
 const g=sandbox(),lab=g.StudioPinballLab.make(demo()),ball=lab.balls[0];
 ball.x=29;ball.y=160;ball.vx=-4;ball.vy=1;
 lab.advanceTo(35);
 assert.ok(ball.vx>0,'wall reflection reverses direction');
 const pose=g.ArenaBallSquash.pose(ball);
 assert.ok(pose.compression!==0||ball._ballSquash,'impact compression is active');
});
test('render paints one 480x300 lab, existing game VFX remain optional',()=>{
 const g=sandbox(),lab=g.StudioPinballLab.make(demo()),{ctx,operations}=mockContext();
 lab.fire();lab.advanceTo(400);
 assert.doesNotThrow(()=>lab.render(ctx));
 assert.ok(operations.some(x=>x.key==='strokeRect'));
 assert.ok(operations.some(x=>x.key==='fillRect'));
 assert.ok(operations.some(x=>x.key==='arc'));
 assert.equal(g.StudioPinballLab.WIDTH,480);
 assert.equal(g.StudioPinballLab.HEIGHT,300);
});
test('controls and canvas are integrated into the original studio and responsive layout',()=>{
 const script=read('js/features/studio-workspace.js'),html=read('index.html'),css=read('css/studio-pinball-lab.css');
 assert.match(script,/미니 핀볼 실험장/);
 assert.match(script,/studio-motion-fire/);
 assert.match(script,/StudioPinballLab\.make/);
 assert.match(script,/pinball\.advanceTo\(time\)/);
 assert.match(script,/pinball\.render\(ctx\)/);
 assert.match(script,/signatureVersion/);
 assert.ok(html.indexOf('studio-pinball-lab.js')<html.indexOf('studio-workspace.js'));
 assert.ok(html.includes('studio-pinball-lab.css'));
 assert.match(css,/aspect-ratio:8\/5/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.ok(!script.includes('SkillForge.cast('));
});
