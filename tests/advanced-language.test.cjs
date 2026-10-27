'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'../js/features');
const ctx={window:null,document:{querySelector:()=>null,getElementById:()=>null},
  localStorage:{getItem:()=>null,setItem:()=>{}},CUSTOM_DEFS:[],CHARACTER_DEFS:[],BEHAVIORS:{},
  CHARACTER_PHOTOS:{},players:[],canvas:{width:500,height:500}};
ctx.window=ctx;
const c=vm.createContext(ctx);
for(const file of ['advanced-combat.js','ability-atlas.js','skill-forge.js','natural-forge.js']){
  vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),c,{filename:file});
}
const types=(desc)=>{
  const p=ctx.NaturalForge.parse(desc,'자유 파이터').profile;
  return p.skills.flatMap(s=>s.actions.map(a=>a.type));
};
test('physical action verbs map to new executable primitives',()=>{
  const pairs=[
    ['어퍼컷으로 상대를 띄운다','uppercut'],
    ['검으로 베기 공격을 한다','slash'],
    ['회전베기로 적을 공격한다','spinslash'],
    ['곡사탄을 2발 발사한다','arcshot'],
    ['분열탄을 3발 발사한다','splitshot'],
    ['벽을 설치한다','wall'],
    ['포탈을 연다','portal'],
    ['추적 소환수를 소환한다','summon'],
    ['포탑을 설치한다','turret'],
    ['덫을 설치한다','trap'],
    ['거대화를 사용한다','grow'],
    ['소형화로 몸을 줄인다','shrink'],
    ['땅굴 돌진으로 공격한다','burrowdash'],
    ['급강하로 내려찍는다','dive']
  ];
  for(const [sentence,kind] of pairs){
    const result=types(sentence);
    assert.ok(result.includes(kind),sentence+' -> '+result);
  }
});
test('multi-action plans survive normalization without becoming arbitrary code',()=>{
  const p=ctx.NaturalForge.parse('3초마다 어퍼컷으로 띄우고 공중 연속 공격한다. 벽을 설치하고 포탈을 연다','검객').profile;
  const moves=p.skills.flatMap(s=>s.actions.map(a=>a.type));
  for(const kind of ['uppercut','aircombo','wall','portal'])assert.ok(moves.includes(kind),kind+' missing: '+moves);
});
test('classic saved character remains normalized after loading new action library',()=>{
  const p=ctx.SkillForge.normalize({
    name:'이전 캐릭터',hp:260,skills:[{name:'기존 번개',cooldown:3,actions:[{type:'bolt',damage:42,count:3}]}]
  });
  assert.equal(p.skills[0].actions[0].type,'bolt');
  assert.equal(p.skills[0].actions[0].damage,42);
  assert.equal(Object.keys(ctx.AdvancedCombat.TYPES).length,20);
});
