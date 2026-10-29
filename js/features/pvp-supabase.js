/* Free-tier Supabase PvP: ticket-isolated matching + host-run 60Hz combat,
 * low-bandwidth snapshots, realtime control and lifecycle cleanup.
 * Host simulation is not anti-cheat-authoritative; rankings are disabled. */
(function(global){
'use strict';
const ROOT='https://fljvwzkndydseevgnhjq.supabase.co';
const PUBLIC_KEY='sb_publishable_thXXoScpxbYcOGNHklfj_A_14d3UKix';
const SNAPSHOT_MS=100,FULL_MS=600,MAX_FRAME_BYTES=96*1024;
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
  this.peerReady=false;this.lastStep=0;this.lastPeer=Date.now();
  this.ticket=global.crypto?.randomUUID?.();
  if(!this.ticket){this.fail(Error('안전한 매칭 요청 ID를 생성할 수 없습니다.'));return;}
  this.start().catch(e=>this.fail(e));
 }
 emit(msg){if(!this.closed)this.onmessage?.({data:JSON.stringify(msg)});}
 leave(room=this.room){
  if(!this.sb||!this.ticket)return Promise.resolve();
  return this.sb.rpc('oibung_pvp_leave_v2',
   {p_ticket:this.ticket,p_room:room||null}).catch(()=>{});
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
  this.readyState=1;this.emit({type:'connected'});
 }
 async queue(message){
  if(this.mode||this.closed)return;
  this.mode=message.mode;this.profile=message.profile;
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
  this.channel.on('broadcast',{event:'state'},({payload})=>{
   if(this.closed||this.side!==1||!payload)return;
   if(payload.type==='state'){
    this.lastPeer=Date.now();
    if(!Number.isInteger(payload.seq)||payload.seq<=(this.receivedSeq||0))return;
    this.receivedSeq=payload.seq;rule.receive(payload);
    if(payload.finished){
     this.done=true;
     global.clearInterval(this.readyTicker);global.clearInterval(this.watchdog);
    }
    this.emit(payload);
   }else if(payload.type==='result'){
    this.done=true;global.clearInterval(this.readyTicker);
    global.clearInterval(this.watchdog);this.emit(payload);
   }
  });
  await new Promise((resolve,reject)=>{
   this.channel.subscribe(status=>{
    if(status==='SUBSCRIBED'){this.connected=true;resolve();}
    else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
     this.connected=false;reject(Error('온라인 대전 채널에 접속할 수 없습니다.'));
    }else this.connected=false;
   });
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
   this.sim=global.setInterval(()=>this.advance(rule),33);
  }
 }
 control(message,rule){
  if(this.closed||!this.current||!message||this.done)return;
  if(message.from===1&&this.side===0)this.lastPeer=Date.now();
  if(message.type==='ready'){
   if(this.side===0&&message.from===1&&!this.peerReady){
    this.peerReady=true;this.lastStep=Date.now();
    this.current.started=this.lastStep;
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
  if(this.sending&&!this.current.ended)return;
  this.lastBroadcast=now;
  const full=this.current.ended||now-this.lastFull>=FULL_MS;
  let snap=rule.snapshot(this.current,full);
  if(full){
   this.lastFull=now;
   // The Free plan rejects oversized broadcasts. Keep essential controls
   // flowing even when a particularly busy visual frame is too large.
   if(JSON.stringify(snap).length>MAX_FRAME_BYTES)delete snap.world;
  }
  snap.seq=(this.sequence=(this.sequence||0)+1);
  this.emit(snap);
  if(this.channel){
   this.sending=true;
   Promise.resolve(this.channel.send({type:'broadcast',event:'state',payload:snap}))
    .catch(()=>{}).finally(()=>{this.sending=false;});
  }
  if(snap.finished){
   this.done=true;
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
   if(msg.type==='input')this.rule.setInput(this.current,0,msg,Date.now());
   else if(msg.type==='cast')this.rule.cast(this.current,0,Number(msg.slot),Date.now());
   else if(msg.type==='forfeit'){
    this.current.ended=true;this.current.winner=1;
    this.advance(this.rule);
   }
  }else{
   if(msg.type==='input')this.rule.predict?.(1,msg);
   this.channel?.send({type:'broadcast',event:'control',payload:{...msg,from:1}});
  }
 }
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
  if(this.sim)global.clearInterval(this.sim);
  if(this.readyTicker)global.clearInterval(this.readyTicker);
  // Leave is ticket-scoped: delayed responses cannot cancel newer searches.
  const room=this.room;
  if(this.channel){
   if(!this.done&&room)
    this.channel.send({type:'broadcast',event:'control',
     payload:{type:'leave',from:this.side}}).catch(()=>{});
   this.sb?.removeChannel(this.channel);
  }
  if(this.sb)this.leave(room);
  this.onclose?.();
 }
}
global.SupabasePvpTransport=SupabasePvpTransport;
})(window);
