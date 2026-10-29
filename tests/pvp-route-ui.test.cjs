'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('PvP route is discoverable from the lobby and mode is selected before matching',()=>{
  const router=read('js/features/screen-router.js'),pvp=read('js/features/pvp-online.js');
  assert.match(router,/ROUTES=\['lobby','tower','pvp'/);
  assert.match(router,/\['pvp','온라인 PvP'/);
  assert.match(router,/data-screen/);
  assert.match(pvp,/name="pvp-mode" value="auto" checked/);
  assert.match(pvp,/name="pvp-mode" value="manual"/);
  assert.match(pvp,/input\[name="pvp-mode"\]:checked/);
  assert.match(pvp,/type:'queue',mode,profile:profile\(\)/);
  assert.match(pvp,/socket=new global\.WebSocket\(url\+'\/match'\)/);
  assert.match(router,/global\.ArenaPvp\?\.onRoute\?\./);
});
test('PvP never pretends local AI or an unconfigured endpoint is an online match',()=>{
  const pvp=read('js/features/pvp-online.js'),server=read('workers/pvp-worker.mjs');
  assert.match(pvp,/온라인 PvP 서버가 연결되지 않았습니다/);
  assert.match(pvp,/같은 모드/);
  assert.match(pvp,/wss:\/\//);
  assert.match(server,/this\.waiting=\{auto:\[\],manual:\[\]\}/);
  assert.match(server,/if\(opponent\)this\.startRoom\(opponent,socket,mode\)/);
  assert.match(server,/else\{queue\.push\(socket\);this\.send\(socket,\{type:'queued',mode\}\);\}/);
});
test('PvP client supports mobile independent pointers and leaves Tower engine untouched',()=>{
  const html=read('index.html'),css=read('css/pvp-ui.css'),pvp=read('js/features/pvp-online.js');
  assert.match(html,/css\/pvp-ui\.css/);
  assert.match(html,/js\/features\/pvp-online\.js/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/\.pvp-pad\{[^}]*touch-action:none/s);
  assert.match(css,/\.pvp-skill\{[^}]*touch-action:none/s);
  assert.match(pvp,/pointer=\s*e\.pointerId/);
  assert.match(pvp,/touchAt=Date\.now\(\)/);
  assert.match(pvp,/send\(\{type:'cast',slot:i\}\)/);
  assert.match(pvp,/send\(direction\(\)\)/);
  assert.ok(!read('js/core/engine.js').includes('ArenaPvp'),'main combat remains offline');
});
