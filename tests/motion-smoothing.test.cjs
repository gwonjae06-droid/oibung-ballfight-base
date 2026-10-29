const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../js/features/motion-smoothing.js'),'utf8');
function setup(){const window={};vm.runInNewContext(src,{window});return window.ArenaMotion;}
test('interpolates only the visible location without modifying hitboxes',()=>{
  const motion=setup(),p={x:0,y:0},fighters=[p];
  motion.reset(fighters);motion.capture(fighters);p.x=10;p.y=20;
  motion.setAlpha(.25);
  assert.equal(motion.position(p).x,2.5);
  assert.equal(motion.position(p).y,5);
  assert.deepEqual([p.x,p.y],[10,20]);
});
test('multiple fixed updates interpolate the latest step only',()=>{
  const motion=setup(),p={x:0,y:0},fighters=[p];
  motion.capture(fighters);p.x=10;motion.capture(fighters);p.x=20;
  motion.setAlpha(.5);assert.equal(motion.position(p).x,15);
});
test('teleports snap and roster changes reset interpolation',()=>{
  const motion=setup(),p={x:0,y:0};motion.capture([p]);p.x=180;
  motion.setAlpha(.1);assert.equal(motion.position(p).x,180);
  const q={x:20,y:30};motion.capture([q]);assert.equal(motion.position(q).x,20);
});
test('draw fighter translates canvas only, not entity position',()=>{
  const motion=setup(),p={x:5,y:0},fighters=[p],log=[];
  motion.capture(fighters);p.x=15;motion.setAlpha(.5);
  const ctx={save(){log.push('save')},translate(x,y){log.push([x,y])},restore(){log.push('restore')}};
  motion.drawFighter(ctx,p,()=>log.push('draw'));
  assert.deepEqual(log,['save',[-5,0],'draw','restore']);assert.equal(p.x,15);
});
