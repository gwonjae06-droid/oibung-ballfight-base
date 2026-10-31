'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const source=read('css/lobby-atmosphere.css'),router=read('js/features/screen-router.js');
test('atmospheric lobby skin loads after the original design without changing navigation',()=>{
 const html=read('index.html');
 const original=html.indexOf('css/premium-ui.css');
 const skin=html.indexOf('css/lobby-atmosphere.css?v=arena-lobby1');
 assert.ok(original>=0&&skin>original);
 for(const id of ['tower','pve','pvp','character','ranking'])
   assert.ok(router.includes("'"+id+"'"),id+' existing route is still available');
 assert.ok(router.includes('lobby.append(hero)'));
 assert.ok(router.includes('lobby.append(cards)'));
 assert.ok(router.includes('lobby.append(summary)'));
});
test('every lobby section gets cohesive visual treatment without altering battle screen',()=>{
 for(const cls of ['.lobby-top','.lobby-wallet','.lobby-hero','.lobby-featured-button',
   '.lobby-hero-orbit','.lobby-hero-ball','.lobby-card','.lobby-card-icon','.lobby-summary'])
   assert.ok(source.includes('#screen-lobby '+cls),cls);
 assert.doesNotMatch(source,/\bdisplay\s*:\s*none\s*!important/);
 assert.doesNotMatch(source,/#screen-pve\b|#screen-pvp\b|#screen-character\b/);
 assert.doesNotMatch(source,/requestAnimationFrame|setInterval|new Image\(/);
});
test('lobby lighting and motion respect mobile, focus visibility and reduced motion',()=>{
 assert.match(source,/@media\(max-width:860px\)/);
 assert.match(source,/@media\(max-width:700px\)/);
 assert.match(source,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(source,/focus-visible/);
 assert.match(source,/oa-lobby-orbit/);
 assert.match(source,/oa-lobby-hover/);
 assert.match(source,/linear-gradient/);
 assert.match(source,/radial-gradient/);
 assert.ok(source.includes('#screen-lobby .lobby-hero-main{position:relative;z-index:2}'),
   'intro copy stays visually above decorative light layers');
});
