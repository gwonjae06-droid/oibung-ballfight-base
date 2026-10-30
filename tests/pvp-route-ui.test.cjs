'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('PvP is auto battle only in lobby and matchmaking',()=>{
 const router=read('js/features/screen-router.js'),pvp=read('js/features/pvp-online.js');
 assert.match(router,/ROUTES=\['lobby','tower','pve','pvp'/);
 assert.match(router,/\['pvp','온라인 PvP'/);
 assert.match(router,/커스텀 파이터끼리 실시간 자동전투/);
 assert.match(pvp,/mode='auto'/);
 assert.match(pvp,/type:'queue',mode,profile:profile\(\)/);
 assert.match(pvp,/socket=new global\.SupabasePvpTransport\(\)/);
 assert.doesNotMatch(pvp,/name="pvp-mode"|pvp-blitz|pvp-pad|pvp-input|function pushDirection/);
});
test('PvP still reports real matchmaking and connection failures',()=>{
 const pvp=read('js/features/pvp-online.js');
 assert.match(pvp,/Supabase PvP 연결 모듈을 불러오지 못했습니다/);
 assert.match(pvp,/매칭 대기 중 · 자동전투 상대를 찾고 있습니다/);
 assert.match(pvp,/Supabase 무료 Realtime/);
 assert.match(pvp,/상대 연결 종료/);
});
test('online spectator canvas and effects work without retired controls',()=>{
 const html=read('index.html'),css=read('css/pvp-ui.css'),pvp=read('js/features/pvp-online.js');
 assert.match(html,/css\/pvp-ui\.css/);
 assert.match(html,/js\/features\/pvp-online\.js/);
 assert.match(html,/js\/features\/pvp-supabase\.js/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(pvp,/function spawnEffects\(/);
 assert.match(pvp,/function paintEffects\(/);
 assert.match(pvp,/ArenaTowerScenes\?\.paint/);
 assert.doesNotMatch(html,/tower-controls\.js|tower-blitz\.js|blitz-ui\.css/);
 assert.ok(!read('js/core/engine.js').includes('ArenaPvp'));
});
test('Supabase PvP has authentic anonymous sessions and secured realtime channels',()=>{
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
test('automatic PvP retains authored combos and the original visual simulation',()=>{
 const pvp=read('js/features/pvp-online.js'),rt=read('js/features/pvp-runtime.js');
 assert.match(read('js/features/pvp-original-engine.js'),/s\.actions\.slice\(0,3\)/);
 assert.match(pvp,/ArenaTowerScenes\?\.paint/);
 assert.match(pvp,/visualEffects\.push\(\{type:'cast'/);
 assert.match(rt,/baseUpdate\(p\)/);
 assert.match(read('pvp-runtime.html'),/arena-auto-ai\.js/);
});
