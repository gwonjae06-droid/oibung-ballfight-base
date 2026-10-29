'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

function world(){
  const h={window:null,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
    canvas:{width:500,height:500},Math,createHitParticles(){},addFloatingText(){},
    document:{querySelector(){return null;}},
    getClosestAliveEnemy(){return null;}};
  h.window=h;vm.createContext(h);
  for(const name of ['ability-atlas','forge-expansion','advanced-combat','skill-forge'])
    vm.runInContext(read('js/features/'+name+'.js'),h,{filename:name+'.js'});
  return h;
}

test('random generator always makes exactly four normalized unsaved skills',()=>{
  const h=world(),seen=new Set();
  for(let i=0;i<60;i++){
    const roll=h.SkillForge.randomProfile('any',Math.random,4);
    assert.equal(roll.skills.length,4);
    assert.equal(roll.allAbilities,false);
    assert.ok(roll.skills.every(s=>s.actions.length>=1&&s.actions.length<=3));
    seen.add(JSON.stringify(roll.skills));
  }
  assert.ok(seen.size>50,'repeated rolls must produce genuinely different skills');
  assert.equal(h.CUSTOM_DEFS.length,0,'rolling must not add a fighter');
});

test('legacy random roll range remains compatible with other game modes',()=>{
  const h=world();
  assert.equal(h.SkillForge.randomProfile('any',()=>0).skills.length,1);
  assert.equal(h.SkillForge.randomProfile('any',()=>0.999).skills.length,4);
});

test('studio routes to separate screens and reuses the same motion preview',()=>{
  const modes=read('js/features/studio-modes.js');
  const workspace=read('js/features/studio-workspace.js');
  const html=read('index.html'),css=read('css/ui-clarity.css');
  assert.doesNotThrow(()=>new vm.Script(modes));
  for(const phrase of ['studio-mode-picker','studio-mode-random','studio-mode-compose',
    'studio-roll-four','studio-random-results','data-preview-skill',
    "forge.randomProfile('any',Math.random,4)",'forge.setDraft(next)',
    'workspace.setPreviewVisible','workspace.selectPreviewSkill','skills.replaceChildren'])
    assert.ok(modes.includes(phrase),phrase);
  assert.ok(!modes.includes('forge.persist('));
  assert.ok(!modes.includes('forge.register('));
  assert.ok(workspace.includes('shell.insertBefore(preview,content)'));
  assert.ok(workspace.includes('selectPreviewSkill:(si,index)=>selectSkill(si,index)'));
  assert.ok(css.includes('.character-studio-dialog .studio-mode-choices'));
  assert.ok(css.includes('.character-studio-dialog .studio-motion-preview[hidden]'));
  assert.ok(html.indexOf('js/features/studio-modes.js')>html.indexOf('js/features/screen-router.js'));
});
