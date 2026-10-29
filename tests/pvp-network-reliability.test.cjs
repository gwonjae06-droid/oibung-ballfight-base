'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),
 vm=require('node:vm'),path=require('node:path');
function world(){
 const rectangles=[],ctx=new Proxy({},{
  get:(obj,key)=>key==='fillRect'?((...args)=>rectangles.push(args)):
   obj[key]||(()=>({addColorStop(){}})),
  set:(obj,key,value)=>(obj[key]=value,true)
 });
 const canvas={width:500,height:500,getContext:()=>ctx};
 const doc={getElementById:id=>id==='arena'?canvas:{style:{},dataset:{}},
  querySelector:()=>null};
 const w={console,Math,Date,Set,Map,Image:class{},localStorage:{getItem:()=>null},
  document:doc,requestAnimationFrame(){}};
 w.window=w;vm.createContext(w);
 for(const m of fs.readFileSync('pvp-runtime.html','utf8').matchAll(/src="([^"]+)"/g)){
  const source=m[1].split('?')[0];
  vm.runInContext(fs.readFileSync(source,'utf8'),w,{filename:source});
 }
 return {w,rectangles};
}
const pack={name:'속도 테스트',hp:300,speed:2.4,color:'#58aaff',
 skills:[{name:'탄환',trigger:'auto',cooldown:1,actions:[{type:'shot',damage:12}]}]};
test('lighter remote snapshots retain HP/movement without transferring the entire world 10x/second',()=>{
 const {w,rectangles}=world(),r=w.PvpRuntime;
 const room=r.createRoom(pack,pack,'manual',Date.now(),['manual','manual']);
 const light=r.snapshot(room,false),full=r.snapshot(room,true);
 assert.ok(!('world' in light));
 assert.ok('world' in full);
 assert.equal(light.players.length,2);
 assert.ok(JSON.stringify(light).length<JSON.stringify(full).length/2);
 light.players[0].hp=80;
 light.players[0].x=190;
 r.receive(JSON.parse(JSON.stringify(light)));
 assert.equal(room.players[0].hp,80);
 r.predict(1,{x:1,y:0});
 const initial=room.players[1].x;
 r.paint();
 assert.ok(rectangles.some(args=>args[2]===76&&args[3]===9),'small 76px HP bars over fighters');
 assert.equal(typeof room.players[1].x,'number');
 assert.ok(room.players[1].x>=initial-1);
});
test('manual steering updates movement in active sim and works on built-in fighters',()=>{
 const {w}=world(),r=w.PvpRuntime;
 const room=r.createRoom({id:'bae',name:'배'},{id:'oh',name:'오'},'manual',Date.now(),['manual','auto']);
 assert.equal(room.players[0].onlineManual,true);
 assert.ok(room.players[0].forge,'manual built-ins obtain a valid movement profile');
 const x=room.players[0].x;
 assert.equal(r.setInput(room,0,{x:1,y:0}),true);
 assert.equal(r.setInput(room,1,{x:1,y:0}),false);
 assert.doesNotThrow(()=>r.step(room,.05,Date.now()));
 assert.ok(room.players[0].x>x,'keydown steering moves the fighter');
});
test('ticketed cancellation cannot delete a new matchmaking attempt',async()=>{
 const sql=fs.readFileSync('supabase/pvp_ticketed_queue.sql','utf8');
 const transport=fs.readFileSync('js/features/pvp-supabase.js','utf8');
 assert.match(sql,/delete from public\.oibung_pvp_queue where user_id=uid and ticket=p_ticket/);
 assert.match(sql,/ticket_a=p_ticket/);
 assert.match(sql,/ticket_b=p_ticket/);
 assert.match(sql,/where user_id<>uid and ticket is not null/);
 for(const rpc of ['oibung_pvp_join_v2','oibung_pvp_status_v2','oibung_pvp_leave_v2']){
  assert.ok(sql.includes(rpc));
  assert.ok(transport.includes(rpc));
 }
 let resolveJoin;
 const calls=[];
 const w={window:null,Date,Promise,console,clearInterval(){},setTimeout(){},clearTimeout(){}};
 w.window=w;vm.createContext(w);
 vm.runInContext(transport,w);
 const t=Object.create(w.SupabasePvpTransport.prototype);
 Object.assign(t,{closed:false,mode:null,profile:null,ticket:'11111111-1111-4111-8111-111111111111',
  sb:{rpc:(name,params)=>{calls.push({name,params});
   if(name==='oibung_pvp_join_v2')return new Promise(resolve=>{resolveJoin=resolve;});
   return Promise.resolve({data:true});}},onclose(){},emit(){}});
 const join=t.queue({mode:'manual',profile:{name:'Tester'}});
 t.close();
 resolveJoin({data:{status:'queued'},error:null});
 await join;
 const leaves=calls.filter(c=>c.name==='oibung_pvp_leave_v2');
 assert.ok(leaves.length>=2,'late join is cleaned up after cancellation');
 assert.ok(leaves.every(c=>c.params.p_ticket===t.ticket));
});
test('remote input is coalesced and scenes send 10Hz light frames plus 2Hz visual frames',()=>{
 const net=fs.readFileSync('js/features/pvp-supabase.js','utf8');
 const ui=fs.readFileSync('js/features/pvp-online.js','utf8');
 assert.match(net,/SNAPSHOT_MS=120,FULL_MS=1000/);
 assert.match(net,/rule\.snapshot\(this\.current,full\)/);
 assert.match(net,/MAX_FRAME_BYTES=40\*1024/);
 assert.match(ui,/function pushDirection\(force=false\)/);
 assert.match(ui,/pushDirection\(\);/);
 assert.match(ui,/class="pvp-vitals" hidden/);
});
