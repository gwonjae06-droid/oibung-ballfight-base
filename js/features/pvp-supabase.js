/* Supabase-only PvP transport for free-tier prototype.
 * PostgreSQL safely matches two authenticated humans by preselected mode.
 * Realtime carries battle messages. First player simulates combat locally;
 * therefore beta combat is NOT yet tamper-resistant/authoritative. */
(function(global){
'use strict';
const ROOT='https://fljvwzkndydseevgnhjq.supabase.co';
const PUBLIC_KEY='sb_publishable_thXXoScpxbYcOGNHklfj_A_14d3UKix';
let clientPromise;
async function client(){
  if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.75.0')
    .then(m=>m.createClient(ROOT,PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,
      detectSessionInUrl:false}})).catch(e=>{clientPromise=null;throw e;});
  return clientPromise;
}
function rules(){return global.PvpOriginalEngine.load();}

class SupabasePvpTransport{
  constructor(){
    this.readyState=0;this.onmessage=null;this.onerror=null;this.onclose=null;
    this.closed=false;this.room=null;this.channel=null;this.poll=null;this.sim=null;
    this.current=null;this.side=-1;this.mode=null;this.profile=null;
    this.readyTicker=null;this.lastBroadcast=0;this.peerReady=false;this.lastStep=0;
    this.start().catch(e=>this.fail(e));
  }
  emit(msg){if(!this.closed)this.onmessage?.({data:JSON.stringify(msg)});}
  async start(){
    this.sb=await client();
    let {data:{session}}=await this.sb.auth.getSession();
    if(!session){
      const result=await this.sb.auth.signInAnonymously();
      if(result.error)throw result.error;
      session=result.data.session;
    }
    if(!session)throw Error('Supabase 익명 로그인을 사용할 수 없습니다.');
    if(this.closed)return;
    await this.sb.realtime.setAuth(session.access_token);
    this.readyState=1;this.emit({type:'connected'});
  }
  async queue(message){
    if(this.mode)return;
    this.mode=message.mode;this.profile=message.profile;
    const {data,error}=await this.sb.rpc('oibung_pvp_join',
      {p_mode:this.mode,p_fighter:this.profile});
    if(error)throw error;
    if(data.status==='matched')return this.match(data);
    this.emit({type:'queued',mode:this.mode});
    this.poll=global.setInterval(()=>this.check().catch(e=>this.fail(e)),1500);
  }
  async check(){
    if(this.closed||this.room)return;
    const {data,error}=await this.sb.rpc('oibung_pvp_status');
    if(error)throw error;
    if(data.status==='matched')await this.match(data);
    else if(data.status==='idle'){this.emit({type:'error',message:'대기열이 만료됐습니다. 다시 시도하세요.'});this.close();}
  }
  async match(data){
    if(this.room||this.closed)return;
    if(this.poll){global.clearInterval(this.poll);this.poll=null;}
    this.room=data.room;this.side=data.side;
    const rule=await rules();
    this.current=rule.createRoom(rule.normalizeProfile(data.fighter_a),
      rule.normalizeProfile(data.fighter_b),data.mode,Date.now(),
      [data.mode_a||data.mode,data.mode_b||data.mode]);
    this.rule=rule;
    this.channel=this.sb.channel('oibung-pvp:'+this.room,
      {config:{private:true,broadcast:{self:false,ack:false}}});
    this.channel.on('broadcast',{event:'control'},({payload})=>this.control(payload,rule));
    this.channel.on('broadcast',{event:'state'},({payload})=>{
      if(this.side!==1)return;
      if(payload?.type==='state'){
        if(this.readyTicker){global.clearInterval(this.readyTicker);this.readyTicker=null;}
        if(payload.seq<= (this.receivedSeq||0))return;
        this.receivedSeq=payload.seq;rule.receive(payload);
        this.emit(payload);
      }
      if(payload?.type==='result')this.emit(payload);
    });
    await new Promise((resolve,reject)=>{
      this.channel.subscribe(status=>{
        if(status==='SUBSCRIBED')resolve();
        else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))reject(Error('실시간 게임 채널에 접속하지 못했습니다.'));
      });
    });
    if(this.closed)return;
    this.emit({type:'matched',you:this.side,mode:data.mode,room:this.room});
    if(this.side===1){
      // Reannounce readiness until the first snapshot, avoiding a race when
      // the second browser subscribes before the host subscribes.
      const announce=()=>this.channel?.send({type:'broadcast',event:'control',
        payload:{type:'ready',from:1}});
      announce();
      this.readyTicker=global.setInterval(announce,850);
    }else{
      this.sim=global.setInterval(()=>this.advance(rule),50);
    }
  }
  control(message,rule){
    if(this.closed||!this.current||!message)return;
    if(message.type==='ready'){
      if(this.side===0&&message.from===1&&!this.peerReady){
        this.peerReady=true;this.lastStep=Date.now();this.current.started=this.lastStep;
      }
      return;
    }
    if(message.type==='forfeit'){
      if(this.side===0){this.current.ended=true;this.current.winner=1-message.from;}
      else{this.emit({type:'result',winner:1-message.from});this.close();}
      return;
    }
    if(this.side!==0||message.from!==1||this.current.ended)return;
    if(message.type==='input')rule.setInput(this.current,1,message,Date.now());
    if(message.type==='cast')rule.cast(this.current,1,Number(message.slot),Date.now());
  }
  advance(rule){
    if(this.closed||!this.current||this.done||(!this.peerReady&&!this.current.ended))return;
    const now=Date.now();
    // Use elapsed time, substepped for collision stability. Never advance
    // cooldowns by wall time while movement advances only one delayed tick.
    let remaining=Math.min(250,Math.max(0,now-this.lastStep));
    while(remaining>0&&!this.current.ended){
      const ms=Math.min(25,remaining);remaining-=ms;
      rule.step(this.current,ms/1000,now-remaining);
    }
    this.lastStep=now;
    // 10 broadcasts per second: preserve ability events between packets.
    if(!this.current.ended&&now-this.lastBroadcast<125)return;
    this.lastBroadcast=now;
    const snap=rule.snapshot(this.current,now);snap.seq=(this.sequence=(this.sequence||0)+1);
    this.emit(snap);
    this.channel?.send({type:'broadcast',event:'state',payload:snap});
    if(snap.finished){
      this.done=true;
      const result={type:'result',winner:snap.winner};
      this.emit(result);
      this.channel?.send({type:'broadcast',event:'state',payload:result});
      if(this.sim){global.clearInterval(this.sim);this.sim=null;}
      // Let the final snapshot and result reach the opponent BEFORE the
      // room is marked ended (RLS otherwise revokes their Realtime channel).
      global.setTimeout(()=>this.sb?.rpc('oibung_pvp_leave',{p_room:this.room}),2500);
    }
  }
  send(data){
    if(this.closed||this.readyState!==1)return;
    let msg;try{msg=JSON.parse(data);}catch(_){return;}
    if(msg.type==='queue'){this.queue(msg).catch(e=>this.fail(e));return;}
    if(msg.type==='cancel'){this.close();return;}
    if(!this.room||!this.current)return;
    if(this.side===0){
      if(msg.type==='input')rules().then(r=>r.setInput(this.current,0,msg));
      else if(msg.type==='cast')rules().then(r=>r.cast(this.current,0,Number(msg.slot)));
      else if(msg.type==='forfeit'){
        this.current.ended=true;this.current.winner=1;
        this.advance(this.rule);
      }
    }else this.channel?.send({type:'broadcast',event:'control',
      payload:{...msg,from:this.side}});
  }
  fail(error){
    if(this.closed)return;
    this.emit({type:'error',message:'Supabase 연결 실패: '+(error?.message||'알 수 없는 오류')});
    this.close();
  }
  close(){
    if(this.closed)return;
    this.closed=true;this.readyState=3;
    if(this.poll)global.clearInterval(this.poll);
    if(this.sim)global.clearInterval(this.sim);
    if(this.readyTicker)global.clearInterval(this.readyTicker);
    if(this.channel)this.sb?.removeChannel(this.channel);
    if(this.sb)this.sb.rpc('oibung_pvp_leave',{p_room:this.room}).catch(()=>{});
    this.onclose?.();
  }
}
global.SupabasePvpTransport=SupabasePvpTransport;
})(window);
