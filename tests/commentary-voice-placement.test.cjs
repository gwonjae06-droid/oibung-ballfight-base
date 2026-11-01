'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function boot(voices=[]){
 const lines=[],said=[],stops=[];
 const makeNode=(id,props={})=>({
  id,dataset:{},classList:{add(){},remove(){}},addEventListener(kind,fn){this['on'+kind]=fn;},
  offsetWidth:1,checked:false,value:'1.38',
  set textContent(t){this._text=t;lines.push(t);},get textContent(){return this._text;},...props});
 const line=makeNode('arena-commentary-line'),toggle=makeNode('arena-commentary-voice',{checked:true}),
 rate=makeNode('arena-commentary-rate',{value:'1.38',
   options:[{value:'1.05'},{value:'1.22'},{value:'1.38'},{value:'1.55'}]});
 const panel=makeNode('arena-commentary',{querySelector(){return null;},prepend(){},classList:{}});
 const dom={'arena-commentary-line':line,'arena-commentary-voice':toggle,
   'arena-commentary-rate':rate,'arena-commentary':panel};
 const synth={speaking:false,pending:false,getVoices:()=>voices,initialCount:0,
  cancel(){stops.push(1);this.speaking=false;this.pending=false;},
  speak(u){said.push(u);this.speaking=true;}};
 class Utterance{constructor(text){this.text=text;}}
 const document={getElementById(id){return dom[id]||null;},
  addEventListener(){},createElement(){return {setAttribute(){},classList:{},alt:'',src:''};}};
 const w={window:null,document,Math,Date,console,Map,Set,WeakMap,
  speechSynthesis:synth,SpeechSynthesisUtterance:Utterance};
 w.window=w;w.globalThis=w;vm.createContext(w);
 vm.runInContext(read('js/features/commentary-voice.js'),w);
 vm.runInContext(read('js/features/battle-director.js'),w);
 return {w,voice:w.ArenaCommentaryVoice,director:w.ArenaBattleDirector,
   rate,toggle,line,said,stops,lines,synth};
}
const fighter=(playerNum,name)=>({playerNum,name,hp:400,maxHp:400,forgeEffects:{}});
test('commentary is immediately above the arena, and never drawn over hitboxes',()=>{
 const html=read('index.html'),css=read('css/arena-cinematic-ui.css');
 const heading=html.indexOf('<div class="arena-heading">'),bar=html.indexOf('id="arena-commentary"'),
  canvas=html.indexOf('<div class="canvas-wrapper">'),analysis=html.indexOf('id="arena-defeat-analysis"');
 assert.ok(heading>=0&&heading<bar&&bar<canvas&&canvas<analysis);
 assert.ok(html.indexOf('commentary-voice.js')<html.indexOf('battle-director.js'));
 assert.match(css,/#container \.battle-screen>\.arena-commentary/);
 assert.match(css,/width:min\(100%,700px\)/);
 assert.match(css,/-webkit-line-clamp:2/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(html,/arena-commentary-rate/);
});
test('Korean natural voices outrank other languages and legacy robotic options',()=>{
 const {voice}=boot([
  {lang:'en-US',name:'English Natural',localService:false},
  {lang:'ko-KR',name:'eSpeak Korean Compact',localService:true},
  {lang:'ko-KR',name:'Microsoft SunHi Online (Natural)',localService:false},
  {lang:'ko-KR',name:'Korean Standard',localService:true}
 ]);
 assert.match(voice.chooseVoice().name,/SunHi/);
});
test('short real Korean commentary uses configured fast TTS and skips speaking low-priority spam',()=>{
 const {voice,said,synth,rate}=boot([{lang:'ko-KR',name:'Google 한국어'}]);
 assert.equal(voice.say('길고 자세한 전투 해설입니다.',{kind:'impact',
  args:['아리아','번개','적',29],priority:6}),true);
 assert.match(said[0].text,/29 피해/);
 assert.ok(said[0].text.length<40);
 assert.equal(said[0].lang,'ko-KR');
 assert.equal(said[0].rate,1.38);
 assert.equal(said[0].pitch,1.04);
 assert.ok(said[0].voice);
 assert.equal(voice.say('별로 중요하지 않은 기술',{kind:'cast',args:['공','투사체'],priority:1}),false);
 assert.equal(said.length,1);
 rate.value='1.55';
 assert.equal(voice.say('중요한 상황',{kind:'low',args:['공'],priority:6}),true);
 assert.equal(said.at(-1).rate,1.55);
 assert.ok(synth.speaking);
});
test('turning voice off stops speech without hiding captions; browser unsupported gracefully falls back',()=>{
 const {voice,toggle,said,stops,director,lines}=boot();
 voice.say('첫 해설',{priority:10});assert.equal(said.length,1);
 toggle.checked=false;toggle.onchange();assert.equal(stops.length,1);
 const a=fighter(1,'푸른 공'),b=fighter(2,'검은 공');director.reset([a,b]);
 director.skillUsed(a,b,{type:'shot'},'광속탄');
 for(let i=0;i<125;i++)director.observe([a,b]);
 assert.ok(lines.some(t=>t.includes('광속탄')),'text commentary stays active when voice is muted');
 assert.equal(said.length,1,'voice disabled never calls speech again');
 const w={window:null,document:{getElementById(){return null;}},console};
 w.window=w;vm.createContext(w);
 assert.doesNotThrow(()=>vm.runInContext(read('js/features/commentary-voice.js'),w));
 assert.equal(w.ArenaCommentaryVoice.say('한국어'),false);
});
test('battle director prioritizes a real low-health warning and its voice does not quote full generated sentences',()=>{
 const {director,said,lines,voice}=boot(),a=fighter(1,'파란 공'),b=fighter(2,'빨간 공');
 director.reset([a,b]);b.hp=70;
 for(let i=0;i<92;i++)director.observe([a,b]);
 assert.ok(lines.some(t=>/빨간 공/.test(t)),'urgent low-health subtitle appears earlier than 115 ticks');
 assert.ok(said.some(u=>/빨간 공, 체력이 위험/.test(u.text)),'short urgent voice line is spoken');
 assert.ok(said.filter(u=>u.text.includes('빨간 공')).every(u=>u.text.length<45));
 voice.stop();
});
