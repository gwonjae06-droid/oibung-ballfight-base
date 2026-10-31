const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('js/features/tower-page-reality.js','utf8');
function setup(){
 const props=new Map(),root={dataset:{},style:{setProperty(n,v){props.set(n,v);},removeProperty(n){props.delete(n);}}};
 const card={getBoundingClientRect(){return {left:40,top:50,right:300,bottom:190,width:260,height:140};}};
 const doc={documentElement:root,querySelectorAll(){return [card];},getElementById(){return {getBoundingClientRect(){return {left:400,top:220,width:500,height:500};}};}};
 const g={document:doc,innerWidth:1366,innerHeight:768};vm.createContext(g);vm.runInContext(code,g);
 const c=new Proxy({}, {get(o,key){if(key==='canvas')return {width:1366,height:768};return o[key]||(()=>{});},set(o,key,v){o[key]=v;return true;}});
 return {g,root,props,c};
}
for(const realm of ['time','space','fire','storm','ice','forest'])test(realm+' affects page UI and restores it without altering user controls',()=>{
 const {g,root,props,c}=setup();
 g.ArenaTowerPageReality.render(c,{realm,variant:2,progress:.45},410,1366,768,false);
 assert.equal(root.dataset.towerReality,realm);
 assert.equal(root.dataset.towerRealityVariant,'2');
 assert.ok(Number(props.get('--tr-power'))>0);
 assert.ok(props.has('--tr-glow'));
 assert.equal(g.document.getElementById('arena')?.disabled,undefined);
 g.ArenaTowerPageReality.clear();
 assert.equal(root.dataset.towerReality,undefined);
 assert.equal(root.dataset.towerRealityVariant,undefined);
 assert.equal(root.dataset.towerRealityMuted,undefined);
 assert.equal(props.size,0);
});
test('reduced effects keep only a quiet tint, never displace UI',()=>{
 const {g,root,props,c}=setup();
 g.ArenaTowerPageReality.render(c,{realm:'storm',variant:0,progress:.5},400,1366,768,true);
 assert.equal(root.dataset.towerRealityMuted,'true');assert.equal(props.get('--tr-x'),'0.00px');assert.equal(props.get('--tr-y'),'0.00px');
 g.ArenaTowerPageReality.render(c,{realm:'ice',variant:1,progress:.5},480,1366,768,false);
 assert.equal(root.dataset.towerReality,'ice');assert.equal(root.dataset.towerRealityMuted,undefined);
 g.ArenaTowerPageReality.clear();assert.equal(props.size,0);
});
test('the page effect is initialized before the boss module and cleaned on inactive fight',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('tower-page-reality.js')<html.indexOf('tower-spectacle.js'));
 assert.ok(html.includes('tower-page-reality.css'));
 const {g,root,props,c}=setup();vm.runInContext(fs.readFileSync('js/features/tower-spectacle.js','utf8'),g);
 g.ArenaTowerPageReality.render(c,{realm:'forest',variant:0,progress:.5},300,1366,768,false);
 g.ArenaTowerSpectacle.page(null);
 assert.equal(root.dataset.towerReality,undefined);assert.equal(props.size,0);
});
