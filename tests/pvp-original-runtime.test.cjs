'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
function world(){
 const ctx=new Proxy({},{get:(t,k)=>t[k]||(()=>({addColorStop(){}})),set:(t,k,v)=>(t[k]=v,true)});
 const canvas={width:500,height:500,getContext:()=>ctx};
 const w={console,Math,Date,Set,Map,Image:class{},localStorage:{getItem:()=>null},document:{getElementById:id=>id==='arena'?canvas:{style:{},dataset:{}},querySelector:()=>null},requestAnimationFrame(){}};w.window=w;vm.createContext(w);
 const html=fs.readFileSync('pvp-runtime.html','utf8');
 for(const m of html.matchAll(/src="([^"]+)"/g))vm.runInContext(fs.readFileSync(m[1],'utf8'),w,{filename:m[1]});return w;
}
const profile={name:'연계',hp:300,speed:2,color:'#4588aa',skills:[{name:'화염 연사',trigger:'auto',cooldown:.2,actions:[{type:'shot',damage:30,count:3,speed:10,radius:120,status:'fire',delay:0},{type:'bolt',damage:20,radius:300,delay:.1}]}]};
test('original online runtime runs authored combo damage and renders both peers',()=>{
 const a=world(),b=world(),ra=a.PvpRuntime,rb=b.PvpRuntime;
 const r=ra.createRoom(profile,profile,'auto',1000,['auto','auto']);rb.createRoom(profile,profile,'auto',1000,['auto','auto']);
 for(let i=0;i<600&&!r.ended;i++)ra.step(r,1/60,1000+i*1000/60);
 const s=JSON.parse(JSON.stringify(ra.snapshot(r)));assert.ok(s.players.some(p=>p.hp<300));
 rb.receive(s);assert.deepEqual(Array.from(rb.snapshot(r).players,p=>p.hp),s.players.map(p=>p.hp));
 ra.paint();rb.paint();
});
test('manual online fighter uses original cooldown and combo executor',()=>{
 const w=world(),r=w.PvpRuntime.createRoom(profile,profile,'manual',1000,['manual','auto']);
 assert.equal(w.PvpRuntime.cast(r,0,0),true);assert.equal(w.PvpRuntime.cast(r,0,0),false);
 for(let i=0;i<30;i++)w.PvpRuntime.step(r,1/60,1000+i*16.7);
 assert.equal(w.PvpRuntime.cast(r,0,0),true);
});
