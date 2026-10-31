'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function instance(){
 let call=0;const disposed=[];
 const w={window:null,console,Date,Promise,setTimeout:(fn,ms)=>{if(ms<2000)Promise.resolve().then(fn);return 1;},clearTimeout(){}};
 w.window=w;vm.createContext(w);vm.runInContext(fs.readFileSync('js/features/pvp-supabase.js','utf8'),w);
 const transport=Object.create(w.SupabasePvpTransport.prototype);
 Object.assign(transport,{closed:false,room:'arena:9',side:0,connected:false,current:{},pendingControls:new Map(),seenControls:new Set(),rule:{},lastPeer:0});
 transport.sb={channel(){const attempt=++call;return {on(){return this;},subscribe(callback){callback(attempt===1?'CHANNEL_ERROR':'SUBSCRIBED');},send(){return Promise.resolve();}};},async removeChannel(ch){disposed.push(ch);}};
 return {transport,calls:()=>call,disposed};
}
test('transient channel error on rematch is cleaned up and next subscription succeeds',async()=>{
 const h=instance();await h.transport.subscribeRoom({});assert.equal(h.calls(),2);
 assert.equal(h.disposed.length,1);assert.equal(h.transport.connected,true);
});
test('completed retry handles stale callback without reviving a replaced channel',async()=>{
 const h=instance();await h.transport.subscribeRoom({});assert.equal(h.transport.channel!==h.disposed[0],true);
});
