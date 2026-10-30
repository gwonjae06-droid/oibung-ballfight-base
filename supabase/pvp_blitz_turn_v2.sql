-- Turn-based Blitz v2: reject simultaneous-mode clients and keep legacy auto/manual pairing.
create or replace function public.oibung_pvp_join_v2(
 p_mode text, p_fighter jsonb, p_ticket uuid
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid();
 rival public.oibung_pvp_queue%rowtype;
 room public.oibung_pvp_rooms%rowtype;
 existing public.oibung_pvp_queue%rowtype;
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 if p_ticket is null then raise exception '매칭 요청 ID가 필요합니다.'; end if;
 if p_mode not in ('auto','manual','blitz') then raise exception '잘못된 모드입니다.'; end if;
 if p_mode='blitz' and p_fighter->>'bp' is distinct from '2' then
   raise exception '구버전 블리츠입니다. 새로고침 후 다시 매칭해 주세요.';
 end if;
 if jsonb_typeof(p_fighter)<>'object' or length(p_fighter::text)>2500
   then raise exception '캐릭터 정보가 올바르지 않습니다.'; end if;
 perform pg_advisory_xact_lock(719826,1);
 update public.oibung_pvp_rooms
  set ended_at=now()
  where ended_at is null and created_at<now()-interval '6 minutes';
 delete from public.oibung_pvp_queue
  where heartbeat_at<now()-interval '45 seconds';
 select * into room from public.oibung_pvp_rooms
 where ended_at is null and created_at>now()-interval '4 minutes'
   and ((player_a=uid and ticket_a=p_ticket)
     or (player_b=uid and ticket_b=p_ticket))
 order by created_at desc limit 1;
 if found then
  return jsonb_build_object('status','matched','room',room.id,
    'mode',room.mode,'mode_a',room.control_a,'mode_b',room.control_b,
    'side',case when room.player_a=uid then 0 else 1 end,
    'fighter_a',room.fighter_a,'fighter_b',room.fighter_b);
 end if;
 -- A newer search from this account supersedes its previous session.
 update public.oibung_pvp_rooms set ended_at=now()
 where ended_at is null and (player_a=uid or player_b=uid)
   and ((player_a=uid and ticket_a is distinct from p_ticket)
     or (player_b=uid and ticket_b is distinct from p_ticket));
 delete from public.oibung_pvp_queue
  where user_id=uid and ticket is distinct from p_ticket;
 select * into existing from public.oibung_pvp_queue
  where user_id=uid and ticket=p_ticket;
 if found then
  update public.oibung_pvp_queue set heartbeat_at=now()
    where user_id=uid and ticket=p_ticket;
  return jsonb_build_object('status','queued','mode',existing.mode);
 end if;
 select * into rival from public.oibung_pvp_queue
  where user_id<>uid and ticket is not null
    and (
      (p_mode<>'blitz' and mode<>'blitz')
      or (p_mode='blitz' and mode='blitz' and fighter->>'bp'='2')
      or (p_mode='blitz' and mode='auto' and fighter->>'bp'='2')
      or (p_mode='auto' and mode='blitz' and p_fighter->>'bp'='2' and fighter->>'bp'='2')
    )
  order by joined_at asc limit 1;
 if found then
  delete from public.oibung_pvp_queue where user_id=rival.user_id and ticket=rival.ticket;
  insert into public.oibung_pvp_rooms(
    mode,control_a,control_b,player_a,player_b,fighter_a,fighter_b,ticket_a,ticket_b)
    values(case when rival.mode='auto' and p_mode='auto' then 'auto' else 'manual' end,
      rival.mode,p_mode,rival.user_id,uid,rival.fighter,p_fighter,rival.ticket,p_ticket)
    returning * into room;
  return jsonb_build_object('status','matched','room',room.id,
    'mode',room.mode,'mode_a',room.control_a,'mode_b',room.control_b,
    'side',1,'fighter_a',room.fighter_a,'fighter_b',room.fighter_b);
 end if;
 insert into public.oibung_pvp_queue(user_id,mode,fighter,ticket,heartbeat_at)
  values(uid,p_mode,p_fighter,p_ticket,now())
  on conflict(user_id) do update set mode=excluded.mode,fighter=excluded.fighter,
    ticket=excluded.ticket,joined_at=now(),heartbeat_at=now();
 return jsonb_build_object('status','queued','mode',p_mode);
end $$;

