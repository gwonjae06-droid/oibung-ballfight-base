'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('editable body/effect colors are separate, preserve saved data and reach all renderers',()=>{
 const forge=read('js/features/skill-forge.js');
 assert.match(forge,/effectColor:color\(value\.effectColor\|\|value\.color\)/);
 assert.match(forge,/effectColor:randomColor\(rng\)/);
 assert.match(forge,/effectColor:profile\.effectColor/);
 assert.match(forge,/id="forge-effect-color"/);
 assert.match(forge,/draft\.effectColor=\$\('forge-effect-color'\)\.value/);
 assert.match(read('js/features/advanced-combat.js'),/p\?\.forge\?\.effectColor/);
 assert.match(read('js/features/forge-expansion.js'),/p\.forge\.effectColor\|\|p\.forge\.color/);
 assert.match(read('js/features/ability-atlas.js'),/caster\.forge\.effectColor\|\|caster\.forge\.color/);
 assert.match(read('js/features/skill-visuals.js'),/p\.forge\?\.effectColor\|\|p\.effectColor/);
});
test('portrait editor exposes image import, drawing, undo, eraser, per-character local persistence',()=>{
 const s=read('js/features/studio-art.js');
 const patterns=[
  'character-art-upload','character-art-canvas','character-art-ink',
  'character-art-width','character-art-erase','character-art-undo',
  'character-art-clear',"canvas.addEventListener('pointerdown'",
  "canvas.addEventListener('pointermove'","canvas.addEventListener('pointercancel'",
  'snapshot()','ctx.putImageData(history.pop()',
  "localStorage.setItem(key(artKey),src)",
  "localStorage.getItem(key(artKey))",
  "localStorage.removeItem(key(artKey))",
  "global.CharacterStudioArt={reset,commit,restore,restoreAll,remove"
 ];
 for(const p of patterns)assert.ok(s.includes(p),'missing picture studio behavior: '+p);
 assert.ok(s.includes("file.size>5*1024*1024"));
 assert.ok(s.includes("canvas.toDataURL('image/jpeg',.8)"));
 assert.match(read('js/features/skill-forge.js'),/profile\.artKey='art'/);
 assert.match(read('js/features/skill-forge.js'),/CharacterStudioArt\?\.restore/);
 assert.match(read('js/features/skill-forge.js'),/CharacterStudioArt\?\.remove/);
});
test('original studio remains in a modal, not duplicated in the match panel',()=>{
 const s=read('js/features/ui-categories.js');
 const main=read('js/main.js');
 const html=read('index.html');
 assert.ok(s.includes('content.append(creator)'));
 assert.ok(s.includes("dialog.id='character-studio-dialog'"));
 assert.ok(s.includes("dialog.showModal()"));
 assert.ok(s.includes("dialog.close()"));
 assert.ok(main.includes('id=\\\"bf-picks\\\"'));
 assert.ok(main.includes('id=\\\"bf-apply\\\"'));
 assert.ok(!main.includes('id=\\\"bf-photo\\\"'));
 assert.ok(!html.includes('파이터 가이드'));
 assert.ok(!html.includes('data-category="photo"'));
 assert.ok(html.includes('src="js/features/studio-art.js"'));
});
