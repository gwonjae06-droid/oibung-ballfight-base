/* Free-tier Supabase PvP: ticket-isolated matching + host-run 60Hz combat,
 * low-bandwidth snapshots, realtime control and lifecycle cleanup.
 * Host simulation is not anti-cheat-authoritative; rankings are disabled. */
(function(global){
'use strict';
const ROOT='https://fljvwzkndydseevgnhjq.supabase.co';
const PUBLIC_KEY='sb_publishable_thXXoScpxbYcOGNHklfj_A_14d3UKix';
// Keep effects fast while staying under Free-tier project-wide rate quotas.
const SNAPSHOT_MS=120,FULL_MS=1000,MAX_FRAME_BYTES=40*1024,FX_MIN_INTERVAL=55;
let clientPromise;
async function client(){
 if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.75.0')
  .then(m=>m.createClient(ROOT,PUBLIC_KEY,{auth:{persistSession:true,
     autoRefreshToken:true,detectSessionInUrl:false}}))
  .catch(e=>{clientPromise=null;throw e;});
 return clientPromise;
}
function rules(){return global.PvpOriginalEngine.load();}
class SupabasePvpTransport{
 constructor(){
  this.readyState=0;this.onmessage=null;this.onerror=null;this.onclose=null;
  this.closed=false;this.room=null;this.channel=null;this.poll=null;this.sim=null;
  this.readyTicker=null;this.watchdog=null;this.current=null;this.side=-1;
  this.mode=null;this.profile=null;this.lastBroadcast=0;this.lastFull=0;
  this.lastFx=0;this.fxTimer=null;this.fxSending=false;
  this.peerReady=false;this.lastStep=0;this.lastPeer=Date.now();
  this.checkFailures=0;this.checkBusy=false;this.connected=false;this.done=false;
  this.pendingControls=new Map();this.seenControls=new Set();this.controlSequence=0;
  this.peerReliable=false;
  this.authTimer=null;this.queueTimer=null;this.subscriptionTimer=null;this.reliableTicker=null;
  this.authTimer=global.setTimeout(()=>this.fail(Error('로그인 응답 시간이 초과됐습니다. 다시 시도해 주세요.')),20000);
  this.ticket=global.crypto?.randomUUID?.();
  if(!this.ticket){this.fail(Error('안전한 매칭 요청 ID를 생성할 수 없습니다.'));return;}
  this.start().catch(e=>this.fail(e));
 }
 emit(msg){if(!this.closed)this.onmessage?.({data:JSON.stringify(msg)});}
 leave(room=this.room){
  if(!this.sb||!this.ticket)return Promise.resolve();
  // RPC is a PromiseLike PostgREST builder; .catch() is not guaranteed.
  try{return Promise.resolve(this.sb.rpc('oibung_pvp_leave_v2',
    {p_ticket:this.ticket,p_room:room||null})).catch(()=>{});}
  catch(_){return Promise.resolve();}
 }
 async start(){
  this.sb=await client();
  const result=await this.sb.auth.getSession();
  if(result.error)throw result.error;
  let session=result.data?.session;
  if(!session){
   const response=await this.sb.auth.signInAnonymously();
   if(response.error)throw response.error;
   session=response.data?.session;
  }
  if(!session)throw Error('Supabase 익명 로그인을 사용할 수 없습니다.');
  if(this.closed)return;
  await this.sb.realtime.setAuth(session.access_token);
  if(this.closed)return;
  if(this.authTimer){global.clearTimeout(this.authTimer);this.authTimer=null;}
  this.readyState=1;this.emit({type:'connected'});
 }
 async queue(message){
  if(this.mode||this.closed)return;
  this.mode='auto';this.profile=message.profile;
  this.queueTimer=global.setTimeout(()=>this.fail(Error('매칭 대기가 2분을 넘었습니다. 다시 시도해 주세요.')),120000);
  const {data,error}=await this.sb.rpc('oibung_pvp_join_v2',
   {p_mode:this.mode,p_fighter:this.profile,p_ticket:this.ticket});
  // A cancellation may happen while the SQL join is still in-flight.
  // Its ticketed cleanup cannot delete the next search's queue.
  if(this.closed){await this.leave(data?.room);return;}
  if(error)throw error;
  if(data?.status==='matched')return this.match(data);
  if(data?.status!=='queued')throw Error('대기열 등록에 실패했습니다.');
  this.emit({type:'queued',mode:this.mode});
  this.poll=global.setInterval(()=>this.check().catch(e=>this.fail(e)),1700);
 }
 async check(){
  if(this.closed||this.room||this.checkBusy)return;
  this.checkBusy=true;
  try{
   const {data,error}=await this.sb.rpc('oibung_pvp_status_v2',
    {p_ticket:this.ticket});
   if(this.closed||this.room)return;
   if(error){
    if(++this.checkFailures>=4)throw error;
    return; // brief network outage must not destroy a real queue
   }
   this.checkFailures=0;
   if(data?.status==='matched')await this.match(data);
   else if(data?.status==='idle'){
    this.emit({type:'error',message:'매칭 대기열 연결이 만료됐습니다. 다시 시도해 주세요.'});
    this.close();
   }
  }finally{this.checkBusy=false;}
 }
 async match(data){
  if(this.closed||this.room)return;
  if(this.poll){global.clearInterval(this.poll);this.poll=null;}
  if(this.queueTimer){global.clearTimeout(this.queueTimer);this.queueTimer=null;}
  this.room=data.room;this.side=data.side;
  const rule=await rules();
  if(this.closed)return;
  this.current=rule.createRoom(rule.normalizeProfile(data.fighter_a),
    rule.normalizeProfile(data.fighter_b),data.mode,Date.now(),
    [data.mode_a||data.mode,data.mode_b||data.mode]);
  this.rule=rule;
  this.channel=this.sb.channel('oibung-pvp:'+this.room,
    {config:{private:true,broadcast:{self:false,ack:false}}});
  this.channel.on('broadcast',{event:'control'},({payload})=>this.control(payload,rule));
  // Original 55 VFX types arrive as tiny independent packets, rather than
  // waiting up to a second for a heavyweight world snapshot.
  this.channel.on('broadcast',{event:'fx'},({payload})=>{
   if(this.closed||this.side!==1||!this.current||!payload)return;
   this.lastPeer=Date.now();
   rule.receiveFx?.(payload.events);
  });
  this.channel.on('broadcast',{event:'state'},({payload})=>{
   if(this.closed||this.side!==1||!payload)return;
   if(payload.type==='state'){
    this.lastPeer=Date.now();
    this.peerReliable=payload.protocol===3;
    if(!Number.isInteger(payload.seq)||payload.seq<=(this.receivedSeq||0))return;
    this.receivedSeq=payload.seq;rule.receive(payload);
    if(payload.finished){
     this.done=true;
     global.clearInterval(this.readyTicker);global.clearInterval(this.watchdog);
     this.stopReliable();this.pendingControls.clear();
    }
    this.emit(payload);
   }else if(payload.type==='result'){
    this.done=true;global.clearInterval(this.readyTicker);
    global.clearInterval(this.watchdog);this.stopReliable();this.pendingControls.clear();
    this.emit(payload);
   }
  });
  await new Promise((resolve,reject)=>{
   let settled=false;
   const finish=(err)=>{
    if(settled)return;settled=true;
    if(this.subscriptionTimer){global.clearTimeout(this.subscriptionTimer);this.subscriptionTimer=null;}
    if(err)reject(err);else resolve();
   };
   this.subscriptionTimer=global.setTimeout(()=>
     finish(Error('실시간 채널 연결 시간이 초과됐습니다.')),14000);
   try{this.channel.subscribe(status=>{
    if(this.closed)return;
    if(status==='SUBSCRIBED'){this.connected=true;finish();}
    else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
     this.connected=false;
     if(!settled)finish(Error('실시간 대전 채널에 접속할 수 없습니다.'));
    }
   });}catch(err){finish(err);}
  });
  if(this.closed)return;
  this.lastPeer=Date.now();
  this.watchdog=global.setInterval(()=>{
   if(!this.done&&Date.now()-this.lastPeer>18000)
    this.fail(Error('상대와의 연결이 끊어졌습니다. 다시 매칭해 주세요.'));
  },1000);
  this.emit({type:'matched',you:this.side,mode:data.mode,room:this.room});
  if(this.side===1){
   // The host needs liveness after the first state too: keep tiny heartbeats.
   const ping=()=>{if(!this.closed&&this.channel)this.channel.send({
    type:'broadcast',event:'control',payload:{type:'ready',from:1}
   });};
   ping();this.readyTicker=global.setInterval(ping,900);
  }else{
   rule.setFxWake?.(()=>this.scheduleFx());
   this.sim=global.setInterval(()=>this.advance(rule),33);
  }
 }
 scheduleFx(){
  if(this.closed||this.done||this.side!==0||!this.connected||this.fxTimer)return;
  const wait=Math.max(0,FX_MIN_INTERVAL-(Date.now()-this.lastFx));
  this.fxTimer=global.setTimeout(()=>{
   this.fxTimer=null;
   this.flushFx();
  },wait);
 }
 flushFx(){
  if(this.closed||this.done||this.side!==0||!this.channel)return;
  const events=this.rule?.drainFx?.(24)||[];
  if(!events.length)return;
  this.lastFx=Date.now();
  // No full-state serialization here: these are the original VFX silhouettes
  // in only a few small fields. Avoid blocking physics on network promises.
  Promise.resolve(this.channel.send({
   type:'broadcast',event:'fx',payload:{type:'fx',events}
  })).catch(()=>{});
  if(events.length>=24)this.scheduleFx();
 }
 control(message,rule){
  if(this.closed||!this.current||!message||this.done)return;
  if(message.from===1&&this.side===0)this.lastPeer=Date.now();
  if(message.type==='ack'&&this.side===1&&message.from===0){
   this.pendingControls.delete(message.eventId);
   if(!this.pendingControls.size)this.stopReliable();
   return;
  }
  // Broadcast can drop packets. Ack every retry, but run a command only once.
  if(this.side===0&&message.from===1&&Number.isSafeInteger(message.eventId)){
   Promise.resolve(this.channel?.send({type:'broadcast',event:'control',
    payload:{type:'ack',from:0,eventId:message.eventId}})).catch(()=>{});
   if(this.seenControls.has(message.eventId))return;
   this.seenControls.add(message.eventId);
   if(this.seenControls.size>128)this.seenControls.delete(this.seenControls.values().next().value);
  }
  if(message.type==='plan'&&this.side===0&&message.from===1){
   rule.submitPlan?.(this.current,1,message,Date.now());return;
  }
  if(message.type==='ready'){
   if(this.side===0&&message.from===1&&!this.peerReady){
    this.peerReady=true;this.lastStep=Date.now();
    this.current.started=this.lastStep;
    // Both peers see the same ready countdown; no simulation until FIGHT.
    this.current.startAt=this.lastStep+3600;
    if(this.current.blitz)this.current.blitz.deadline=this.lastStep+10000;
   }
   return;
  }
  if(message.type==='forfeit'||message.type==='leave'){
   if(this.side===0&&message.from===1){
    this.current.ended=true;this.current.winner=0;
    this.advance(rule);
   }else if(this.side===1&&message.from===0){
    this.emit({type:'result',winner:1});this.done=true;this.close();
   }
   return;
  }
  if(this.side!==0||message.from!==1||this.current.ended)return;
  if(message.type==='input')rule.setInput(this.current,1,message,Date.now());
  if(message.type==='cast')rule.cast(this.current,1,Number(message.slot),Date.now());
 }
 advance(rule){
  if(this.closed||!this.current||this.done||(!this.peerReady&&!this.current.ended))return;
  const now=Date.now();
  if(!this.current.ended&&(!this.connected||now-this.lastPeer>3000)){
   this.lastStep=now;return;
  }
  let remaining=Math.min(200,Math.max(0,now-this.lastStep));
  while(remaining>0&&!this.current.ended){
   const ms=Math.min(25,remaining);remaining-=ms;
   rule.step(this.current,ms/1000,now-remaining);
  }
  this.lastStep=now;
  if(!this.current.ended&&now-this.lastBroadcast<SNAPSHOT_MS)return;
  if(this.sending&&!this.current.ended&&now-(this.lastSendAt||0)<1500)return;
  this.lastBroadcast=now;
  const full=this.current.ended||now-this.lastFull>=FULL_MS;
  let snap=rule.snapshot(this.current,full);
  if(full){
   this.lastFull=now;
   // The Free plan rejects oversized broadcasts. Keep essential controls
   // flowing even when a particularly busy visual frame is too large.
   if(JSON.stringify(snap).length>MAX_FRAME_BYTES)delete snap.world;
  }
  snap.protocol=3;
  snap.seq=(this.sequence=(this.sequence||0)+1);
  this.emit(snap);
  if(this.channel){
   this.sending=true;this.lastSendAt=now;
   const sendId=this.lastSendId=(this.lastSendId||0)+1;
   Promise.resolve(this.channel.send({type:'broadcast',event:'state',payload:snap}))
    .catch(()=>{}).finally(()=>{if(this.lastSendId===sendId)this.sending=false;});
  }
  if(snap.finished){
   // Always deliver the final slash/explosion before closing the room.
   if(this.fxTimer){global.clearTimeout(this.fxTimer);this.fxTimer=null;}
   this.flushFx();
   this.done=true;this.stopReliable();this.pendingControls?.clear?.();
   const result={type:'result',winner:snap.winner};
   this.emit(result);
   this.channel?.send({type:'broadcast',event:'state',payload:result});
   if(this.sim){global.clearInterval(this.sim);this.sim=null;}
   global.setTimeout(()=>this.leave(),2500);
  }
 }
 send(data){
  if(this.closed||this.readyState!==1)return;
  let msg;try{msg=JSON.parse(data);}catch(_){return;}
  if(msg.type==='queue'){this.queue(msg).catch(e=>this.fail(e));return;}
  if(msg.type==='cancel'){this.close();return;}
  if(!this.room||!this.current||this.done)return;
  if(this.side===0){
   if(msg.type==='plan')this.rule.submitPlan?.(this.current,0,msg,Date.now());
   else if(msg.type==='input')this.rule.setInput(this.current,0,msg,Date.now());
   else if(msg.type==='cast')this.rule.cast(this.current,0,Number(msg.slot),Date.now());
   else if(msg.type==='forfeit'){
    this.current.ended=true;this.current.winner=1;
    this.advance(this.rule);
   }
  }else{
   if(msg.type==='input')this.rule.predict?.(1,msg);
   // The guest sees the first skill animation on keypress/tap.
   // The host still decides whether it hits, damages, or goes on cooldown.
   if(msg.type==='cast')this.rule.previewCast?.(1,Number(msg.slot));
   // A cached legacy host cannot ACK, and duplicate casts must not be sent to it.
   if((msg.type==='cast'||msg.type==='forfeit'||msg.type==='plan')&&this.peerReliable)this.sendReliable(msg);
   else Promise.resolve(this.channel?.send({type:'broadcast',event:'control',payload:{...msg,from:1}})).catch(()=>{});
  }
 }
 sendReliable(message){
  if(this.closed||this.done||!this.channel)return;
  const eventId=++this.controlSequence;
  if(this.pendingControls.size>=16){
   this.fail(Error('스킬 입력이 지연되고 있습니다. 네트워크를 확인해 주세요.'));return;
  }
  const entry={eventId,message,tries:0,lastAt:0};
  this.pendingControls.set(eventId,entry);this.dispatchReliable(entry);
  if(!this.reliableTicker)this.reliableTicker=global.setInterval(()=>{
   if(this.closed||this.done){this.stopReliable();return;}
   const now=Date.now();
   for(const pending of this.pendingControls.values()){
    if(now-pending.lastAt<350)continue;
    if(pending.tries>=10){
     this.fail(Error('입력 전송 응답을 받지 못했습니다. 다시 연결해 주세요.'));return;
    }
    this.dispatchReliable(pending);
   }
   if(!this.pendingControls.size)this.stopReliable();
  },350);
 }
 dispatchReliable(entry){
  entry.tries++;entry.lastAt=Date.now();
  Promise.resolve(this.channel?.send({type:'broadcast',event:'control',
   payload:{...entry.message,from:1,eventId:entry.eventId}})).catch(()=>{});
 }
 stopReliable(){if(this.reliableTicker){global.clearInterval(this.reliableTicker);this.reliableTicker=null;}}
 fail(error){
  if(this.closed)return;
  this.lastError=error?.message||'연결 오류';
  this.emit({type:'error',message:'온라인 PvP 오류: '+this.lastError});
  this.close();
 }
 close(){
  if(this.closed)return;
  this.closed=true;this.readyState=3;
  if(this.watchdog)global.clearInterval(this.watchdog);
  if(this.poll)global.clearInterval(this.poll);
  if(this.authTimer)global.clearTimeout(this.authTimer);
  if(this.queueTimer)global.clearTimeout(this.queueTimer);
  if(this.subscriptionTimer)global.clearTimeout(this.subscriptionTimer);
  this.stopReliable?.();this.pendingControls?.clear?.();
  if(this.sim)global.clearInterval(this.sim);
  if(this.readyTicker)global.clearInterval(this.readyTicker);
  if(this.fxTimer)global.clearTimeout(this.fxTimer);
  if(this.side===0)this.rule?.setFxWake?.(null);
  // Leave is ticket-scoped: delayed responses cannot cancel newer searches.
  const room=this.room;
  if(this.channel){
   if(!this.done&&room)
    Promise.resolve(this.channel.send({type:'broadcast',event:'control',
     payload:{type:'leave',from:this.side}})).catch(()=>{});
   try{Promise.resolve(this.sb?.removeChannel(this.channel)).catch(()=>{});}catch(_){}
  }
  if(this.sb)this.leave(room);
  this.onclose?.();
 }
}
global.SupabasePvpTransport=SupabasePvpTransport;
})(window);
