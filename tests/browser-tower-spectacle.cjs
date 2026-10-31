const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'..','tower-qa');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(p)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(8193,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto('http://127.0.0.1:8193');await page.getByRole('button',{name:'확인 · 게임 시작'}).click();
 for(const realm of ['time','space','fire','storm','ice','forest']){
  const result=await page.evaluate(realm=>{
   if(ArenaTower.active)ArenaTower.forfeit();ArenaScreenRouter.go('tower');ArenaTower.selectRealm(realm);if(!ArenaTower.begin())throw Error('Cannot start '+realm);
   for(let i=1;i<10;i++){isPlaying=false;isGameOver=true;ArenaTower.onBattleEnd(players[0]);const offer=ArenaTower.state.offers[0];if(offer)ArenaTower.chooseBlessing(offer.id);if(!ArenaTower.begin())throw Error('Cannot advance '+i);}
   ArenaCountdown.cancel();
   // Exercise real engine/actors without deaths masking later patterns. These are QA-only HP values.
   players.forEach(p=>{p.hp=100000;p.maxHp=100000;});
   for(let i=0;i<460;i++)update();
   isPlaying=false;draw();
   const s=ArenaTower.encounter.spectacle;
   return {level:ArenaTower.state.level,title:s.event?.title,entities:s.entities.length,tick:s.tick};
  },realm);
  assert.equal(result.level,10);assert.ok(result.title,realm+' ultimate missing');
  await page.locator('#arena').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,realm+'.png')});
  if(realm==='fire'){
   const hit=await page.evaluate(()=>{const s=ArenaTower.encounter.spectacle,e=s.event.meteor;players[0].x=e.x-30;players[0].y=e.y;e.invincible=0;const before=e.hp;SkillForge.hit(players[0],e,{type:'wave',damage:30,knockback:0,status:'none'},1,AdvancedCombat.height(e));return {before,after:e.hp,target:getClosestAliveEnemy(players[0])===e};});assert.ok(hit.after<hit.before);assert.equal(hit.target,true);
  }
  if(realm==='time'){const played=await page.evaluate(()=>{isPlaying=true;let active=0;for(let i=0;i<1200;i++){update();if(ArenaTower.encounter.spectacle.temporal.active)active++;}isPlaying=false;return active;});assert.ok(played>=170,'temporal playback must run through real update loop');}
  const paused=await page.evaluate(()=>{const t=ArenaTower.encounter.spectacle.tick;update();return t===ArenaTower.encounter.spectacle.tick;});assert.ok(paused);
  await page.evaluate(()=>{ArenaTower.forfeit();draw();});
  assert.equal(await page.locator('canvas[aria-hidden="true"]').evaluateAll(nodes=>nodes.filter(n=>n.style.position==='fixed'&&!n.hidden).length),0);
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{ArenaTower.selectRealm('ice');ArenaTower.begin();draw();});await page.screenshot({path:path.join(out,'mobile.png')});
 assert.deepEqual(errors,[]);console.log('PASS: six real 10F encounters, meteor direct hit/targeting, pause, forfeit cleanup, mobile render');
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
