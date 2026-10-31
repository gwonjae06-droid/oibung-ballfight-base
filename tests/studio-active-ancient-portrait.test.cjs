'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('Ancient One has a real bundled multi-eyed cosmic boss portrait, not a plain button',()=>{
 const portrait=read('assets/ancient-one-portrait.svg');
 const markup=read('js/features/tower-challenge.js');
 assert.match(portrait,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(portrait,/viewBox="0 0 1200 520"/);
 assert.ok((portrait.match(/id="eye"/g)||[]).length>=1);
 assert.ok((portrait.match(/fill="url\(#eye\)"/g)||[]).length>=16,'many glowing eyes');
 assert.ok((portrait.match(/stroke="url\(#tent\)"/g)||[]).length>=10,'long face and side tentacles');
 assert.match(portrait,/id="nebula"/);
 assert.match(markup,/ancient-one-portrait\.svg/);
 assert.match(markup,/ancient-portrait-art/);
 assert.match(markup,/고대의 존재에게 도전/);
});
test('all six Tower completions still gate the ancient boss, but locked players can see its silhouette',()=>{
 const src=read('js/features/tower-challenge.js');
 const css=read('css/ancient-one-portrait.css');
 assert.match(src,/allRealmsCleared\(\)/);
 assert.match(src,/el\('ancient-start'\)\.hidden=done!==6/);
 assert.match(src,/el\('ancient-lock-note'\)\.hidden=done===6/);
 assert.match(src,/const ancientCard=selector\.querySelector\('\.ancient-unlock'\)/);
 assert.match(src,/ancientCard\.dataset\.unlocked=done===6/);
 assert.match(css,/data-unlocked="false"/);
 assert.match(css,/data-unlocked="true"/);
 assert.doesNotMatch(css,/#screen-tower \.ancient-unlock\[data-unlocked="false"\]\s*\{[^}]*display\s*:\s*none/);
 const html=read('index.html');
 assert.ok(html.indexOf('css/ancient-one-portrait.css')>html.indexOf('css/tower-gateway.css'));
 assert.match(html,/js\/features\/tower-challenge\.js\?v=eldritch1/);
});
test('eldritch encounter CTA is mobile-friendly, keyboard accessible and respects motion preferences',()=>{
 const css=read('css/ancient-one-portrait.css');
 for(const selector of ['.ancient-portrait-copy','.ancient-portrait-art','#ancient-start',
  '.ancient-portrait-progress','.ancient-portrait-lock']){
   assert.ok(css.includes(selector),selector);
 }
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/object-fit:cover/);
});
