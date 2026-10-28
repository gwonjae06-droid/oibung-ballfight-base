const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');
    res.setHeader('Accept-Ranges','bytes');
    const range=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');
    if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),data.length-1):data.length-1;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1});res.end(data.subarray(start,end+1));}
    else{res.setHeader('Content-Length',data.length);res.end(data);}});
});
(async()=>{
 await new Promise(r=>server.listen(8187,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log(e.stack);});
 await page.goto('http://127.0.0.1:8187');
 const audio=await page.evaluate(async()=>{
   const ac=new AudioContext({sampleRate:44100}),results=[];
   for(const t of BackgroundMusic.tracks){
     const buf=await ac.decodeAudioData(await (await fetch(t.src)).arrayBuffer());
     const pcm=new Float32Array(buf.length*buf.numberOfChannels);
     for(let c=0;c<buf.numberOfChannels;c++)pcm.set(buf.getChannelData(c),c*buf.length);
     const digest=await crypto.subtle.digest('SHA-256',pcm.buffer);
     results.push({...t,duration:buf.duration,sampleRate:buf.sampleRate,channels:buf.numberOfChannels,pcmSHA256:Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')});
   }
   await ac.close();return results;
 });
 fs.writeFileSync(path.join(root,'assets/music/verification.json'),JSON.stringify({method:'Microsoft Edge decodeAudioData; 44100 Hz float PCM, channel-major SHA-256. Distinct encoded and decoded content; alternate versions retained.',tracks:audio.map(t=>({...t,fileSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,t.src))).digest('hex')}))},null,2)+'\n');
 const assert=require('node:assert/strict');
 const snap=()=>page.evaluate(()=>({mode:BackgroundMusic.mode,paused:BackgroundMusic.paused,enabled:BackgroundMusic.enabled,current:BackgroundMusic.current?.track.src,menu:BackgroundMusic.menu?.track.src,time:BackgroundMusic.current?.audio.currentTime,menuTime:BackgroundMusic.menu?.audio.currentTime,playing:[...BackgroundMusic.voices].filter(v=>!v.audio.paused).length,volume:BackgroundMusic.volume,muted:BackgroundMusic.muted}));
 const settle=()=>page.waitForTimeout(850);
 assert.equal((await snap()).current,undefined);
 await page.locator('h1').click();await settle();const menu=await snap();assert.equal(menu.playing,1);
 await page.locator('#btn-start').click();await settle();const battle=await snap();assert.equal(battle.mode,'battle');assert.notEqual(battle.current,menu.current);assert.equal(battle.playing,1);
 await page.locator('#btn-start').click();await settle();const paused=await snap();assert.equal(paused.paused,true);assert.equal(paused.playing,0);
 await settle();assert.equal((await snap()).time,paused.time);
 await page.locator('#btn-start').click();await settle();assert.ok((await snap()).time>paused.time);
 await page.locator('#btn-stop').click();await settle();const returned=await snap();assert.equal(returned.current,menu.current);assert.ok(returned.time>=battle.menuTime);assert.equal(returned.playing,1);
 await page.locator('#bgm-toggle').click();await settle();assert.equal((await snap()).playing,0);
 await page.locator('#btn-start').click();await page.locator('#btn-start').click();await settle();assert.equal((await snap()).playing,0);
 await page.locator('#bgm-toggle').click();await settle();assert.equal((await snap()).playing,1);
 await page.locator('#bgm-mute').click();assert.equal((await snap()).muted,true);
 await page.locator('#bgm-volume').fill('22');assert.equal((await snap()).volume,.22);
 // Exercise a natural victory through the real engine update, then the actual media ended event.
 await page.evaluate(()=>{players.slice(1).forEach(p=>p.hp=0);});await settle();assert.equal((await snap()).mode,'menu');
 const beforeEnd=(await snap()).current;
 await page.evaluate(()=>{const a=BackgroundMusic.current.audio;a.currentTime=a.duration-.15;});await page.waitForTimeout(1600);
 assert.notEqual((await snap()).current,beforeEnd);
 await page.setViewportSize({width:390,height:844});await page.locator('#bgm-toggle').scrollIntoViewIfNeeded();
 if(process.env.MUSIC_SCREENSHOT)await page.screenshot({path:process.env.MUSIC_SCREENSHOT});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.reload();assert.equal((await snap()).muted,true);assert.equal((await snap()).volume,.22);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({audio,browserChecks:'PASS: menu/start/pause/resume/stop/next round/manual music stop/mute/volume/natural victory/real ended event/mobile overflow/persistence',errors},null,2));
 await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1);});
