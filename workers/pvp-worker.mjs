/* Cloudflare Durable Object: one globally consistent FIFO queue per mode.
 * Genuine two-browser matches only: no bot masquerades as an opponent.
 * Online PvP v1 is an intentionally limited server-authoritative rule set. */
import {normalizeProfile,createRoom,setInput,cast,step,snapshot} from './pvp-rules.mjs';
const json=(data,status=200,origin='*')=>new Response(JSON.stringify(data),
  {status,headers:{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store','access-control-allow-origin':origin}});
export class MatchHub{
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.clients=new Map();
    this.waiting={auto:[],manual:[]};this.rooms=new Map();this.interval=null;
  }
  async fetch(request){
    if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')
      return json({error:'WebSocket 연결이 필요합니다.'},426);
    const pair=new WebSocketPair(),client=pair[0],socket=pair[1];
    this.ctx.acceptWebSocket(socket);
    this.clients.set(socket,{mode:null,room:null,slot:-1,lastPacket:0,packets:0});
    this.send(socket,{type:'connected'});
    return new Response(null,{status:101,webSocket:client});
  }
  send(socket,message){
    try{socket.send(JSON.stringify(message));return true;}catch(_){return false;}
  }
  removeFromQueue(socket){
    for(const list of Object.values(this.waiting)){
      const index=list.indexOf(socket);if(index>=0)list.splice(index,1);
    }
  }
  startRoom(a,b,mode){
    const ca=this.clients.get(a),cb=this.clients.get(b);
    if(!ca||!cb)return;
    const id=crypto.randomUUID();
    const room=createRoom(ca.profile,cb.profile,mode,Date.now());
    room.id=id;room.sockets=[a,b];room.lastTick=Date.now();
    ca.room=cb.room=id;ca.slot=0;cb.slot=1;
    this.rooms.set(id,room);
    this.send(a,{type:'matched',you:0,mode,room:id});
    this.send(b,{type:'matched',you:1,mode,room:id});
    this.sendState(room);
    if(!this.interval)this.interval=setInterval(()=>this.tick(),50);
  }
  sendState(room){
    const data=snapshot(room);
    for(const socket of room.sockets)this.send(socket,data);
    if(room.ended){
      for(const socket of room.sockets)this.send(socket,{type:'result',winner:room.winner});
      this.rooms.delete(room.id);
      for(const socket of room.sockets){
        const c=this.clients.get(socket);if(c){c.room=null;c.slot=-1;c.mode=null;}
      }
    }
  }
  tick(){
    const now=Date.now();
    for(const room of this.rooms.values()){
      const dt=Math.min(.1,(now-room.lastTick)/1000);room.lastTick=now;
      step(room,dt,now);
      if(!room.lastBroadcast||now-room.lastBroadcast>=100||room.ended){
        room.lastBroadcast=now;this.sendState(room);
      }
    }
    if(!this.rooms.size&&this.interval){clearInterval(this.interval);this.interval=null;}
  }
  webSocketMessage(socket,data){
    if(typeof data!=='string'||data.length>4096)return this.send(socket,{type:'error',message:'메시지가 너무 큽니다.'});
    const client=this.clients.get(socket);if(!client)return;
    let msg;try{msg=JSON.parse(data);}catch(_){return;}
    if(!msg||typeof msg!=='object')return;
    const now=Date.now();
    if(now-client.lastPacket>=1000){client.lastPacket=now;client.packets=0;}
    if(++client.packets>45)return; // Bound flood traffic independently of cooldowns.
    if(msg.type==='queue'){
      if(client.room||client.mode)return this.send(socket,{type:'error',message:'이미 매칭 중입니다.'});
      const mode=msg.mode;
      if(!['auto','manual'].includes(mode))return this.send(socket,{type:'error',message:'모드를 다시 선택하세요.'});
      client.profile=normalizeProfile(msg.profile);
      client.mode=mode;
      const queue=this.waiting[mode];
      let opponent=null;
      while(queue.length){
        const possible=queue.shift();
        if(possible!==socket&&this.clients.get(possible)?.mode===mode&&!this.clients.get(possible)?.room){
          opponent=possible;break;
        }
      }
      if(opponent)this.startRoom(opponent,socket,mode);
      else{queue.push(socket);this.send(socket,{type:'queued',mode});}
      return;
    }
    if(msg.type==='cancel'){
      if(client.room)return this.send(socket,{type:'error',message:'진행 중인 경기는 포기로 종료하세요.'});
      this.removeFromQueue(socket);client.mode=null;this.send(socket,{type:'cancelled'});return;
    }
    if(msg.type==='ping'){this.send(socket,{type:'pong',t:now});return;}
    if(!client.room)return;
    const room=this.rooms.get(client.room);
    if(!room)return;
    if(msg.type==='input')setInput(room,client.slot,msg,now);
    else if(msg.type==='cast'&&Number.isInteger(msg.slot))cast(room,client.slot,msg.slot,now);
    else if(msg.type==='forfeit')this.endForfeit(room,client.slot);
  }
  endForfeit(room,slot){
    if(room.ended)return;
    room.ended=true;room.winner=1-slot;this.sendState(room);
  }
  disconnect(socket){
    const client=this.clients.get(socket);if(!client)return;
    this.removeFromQueue(socket);
    if(client.room){
      const room=this.rooms.get(client.room);
      if(room&&!room.ended){
        const other=room.sockets[1-client.slot];
        this.send(other,{type:'disconnect',message:'상대가 연결을 종료했습니다.'});
        this.endForfeit(room,client.slot);
      }
    }
    this.clients.delete(socket);
  }
  webSocketClose(socket){this.disconnect(socket);}
  webSocketError(socket){this.disconnect(socket);}
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const origin=request.headers.get('origin');
    const allowed=new Set(['https://gwonjae06-droid.github.io','http://localhost:5173',
      'http://localhost:3000','http://127.0.0.1:3000']);
    if(env.PVP_ALLOWED_ORIGIN)allowed.add(env.PVP_ALLOWED_ORIGIN);
    if(origin&&!allowed.has(origin))return json({error:'허용되지 않은 출처입니다.'},403);
    if(url.pathname==='/health')
      return json({status:'online',version:1,modes:['auto','manual']});
    if(url.pathname!=='/match')return json({error:'경로를 찾을 수 없습니다.'},404);
    const key=env.MATCH_HUB.idFromName('oibung-pvp-global-v1');
    return env.MATCH_HUB.get(key).fetch(request);
  }
};
