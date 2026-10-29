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
  assert.match(pvp,/socket=new global\.SupabasePvpTransport\(\)/);
  assert.match(router,/global\.ArenaPvp\?\.onRoute\?\./);
});
test('PvP never pretends local AI or an unconfigured endpoint is an online match',()=>{
  const pvp=read('js/features/pvp-online.js'),server=read('workers/pvp-worker.mjs');
  assert.match(pvp,/Supabase PvP 연결 모듈을 불러오지 못했습니다/);
  assert.match(pvp,/같은 모드/);
  assert.match(pvp,/Supabase 무료 Realtime/);
  assert.match(server,/this\.waiting=\{auto:\[\],manual:\[\]\}/);
  assert.match(server,/if\(opponent\)this\.startRoom\(opponent,socket,mode\)/);
  assert.match(server,/else\{queue\.push\(socket\);this\.send\(socket,\{type:'queued',mode\}\);\}/);
});
test('PvP client supports mobile independent pointers and leaves Tower engine untouched',()=>{
  const html=read('index.html'),css=read('css/pvp-ui.css'),pvp=read('js/features/pvp-online.js');
  assert.match(html,/css\/pvp-ui\.css/);
  assert.match(html,/js\/features\/pvp-online\.js/);
  assert.match(html,/js\/features\/pvp-supabase\.js/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/\.pvp-pad\{[^}]*touch-action:none/s);
  assert.match(css,/\.pvp-skill\{[^}]*touch-action:none/s);
  assert.match(pvp,/pointer=\s*e\.pointerId/);
  assert.match(pvp,/touchAt=Date\.now\(\)/);
  assert.match(pvp,/send\(\{type:'cast',slot:i\}\)/);
  assert.match(pvp,/send\(direction\(\)\)/);
  assert.ok(!read('js/core/engine.js').includes('ArenaPvp'),'main combat remains offline');
});

test('Supabase-only PvP uses authentic anonymous sessions and mode-separated database RPC',()=>{
 const s=read('js/features/pvp-supabase.js'),sql=read('supabase/pvp_free.sql');
 assert.match(s,/signInAnonymously\(\)/);
 assert.match(s,/oibung_pvp_join/);
 assert.match(s,/oibung_pvp_status/);
 assert.match(s,/oibung_pvp_leave/);
 assert.match(s,/private:true/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/realtime\.messages for select to authenticated/);
 assert.match(sql,/realtime\.messages for insert to authenticated/);
 assert.doesNotMatch(s,/service_role|sb_secret_/);
});
