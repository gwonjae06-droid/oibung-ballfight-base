'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('six clickable towers use a panoramic artwork instead of separate cards',()=>{
 const code=read('js/features/tower-challenge.js');
 const svg=read('assets/tower-gateway-scene.svg');
 assert.match(code,/tower-panorama-scroll/);
 assert.match(code,/tower-panorama-art/);
 assert.match(code,/data-realm/);
 assert.match(code,/selector\.addEventListener\('click'/);
 assert.match(code,/if\(id\)selectRealm\(id\)/);
 assert.match(code,/ancient-start/);
 assert.equal((svg.match(/<g>/g)||[]).length,6,'six illustrated tower groups');
 for(const id of ['time','space','fire','storm','ice','forest'])
   assert.match(svg,new RegExp('id="a-'+id+'"'));
});
test('the panoramic scene is responsive and has keyboard focus',()=>{
 const css=read('css/tower-gateway.css');
 const code=read('js/features/tower-challenge.js');
 assert.match(css,/grid-template-columns:repeat\(6/);
 assert.match(css,/overflow-x:auto/);
 assert.match(css,/:focus-visible/);
 assert.match(code,/tabindex="0" role="region"/);
 assert.match(code,/aria-label="'+r\.name+' 입장"/);
});
test('original brass fanfare plays on tower entry without bypassing mute',()=>{
 const audio=read('js/features/tower-gateway-audio.js');
 const router=read('js/features/screen-router.js');
 const html=read('index.html');
 assert.match(audio,/AudioContext/);
 assert.match(audio,/music\.muted\|\|!music\.enabled/);
 assert.match(audio,/audio\.createOscillator\(/);
 assert.match(router,/TowerGatewayAudio\?\.play/);
 assert.ok(html.indexOf('tower-gateway-audio.js')<html.indexOf('screen-router.js'));
 assert.match(html,/tower-gateway.css/);
});
