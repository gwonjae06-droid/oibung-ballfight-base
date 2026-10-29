-- Matchmaking v2: each browser search owns an unguessable ticket UUID.
-- Closing a previous match must NEVER delete a newer queue entry.
-- Old v1 RPCs remain for compatibility with already-open browser sessions.
alter table public.oibung_pvp_queue
  add column if not exists ticket uuid;
alter table public.oibung_pvp_rooms
  add column if not exists ticket_a uuid;
alter table public.oibung_pvp_rooms
  add column if not exists ticket_b uuid;

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
 if p_mode not in ('auto','manual') then raise exception '잘못된 모드입니다.'; end if;
 if jsonb_typeof(p_fighter)<>'object' or length(p_fighter::text)>2500
   then raise exception '캐릭터 정보가 올바르지 않습니다.'; end if;
 perform pg_advisory_xact_lock(719826,1);
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

create or replace function public.oibung_pvp_status_v2(p_ticket uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid();room public.oibung_pvp_rooms%rowtype;q_mode text;
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 if p_ticket is null then raise exception '매칭 요청 ID가 필요합니다.'; end if;
 select * into room from public.oibung_pvp_rooms
 where ended_at is null and created_at>now()-interval '4 minutes'
  and ((player_a=uid and ticket_a=p_ticket)
    or (player_b=uid and ticket_b=p_ticket))
 order by created_at desc limit 1;
 if found then return jsonb_build_object('status','matched','room',room.id,
  'mode',room.mode,'mode_a',room.control_a,'mode_b',room.control_b,
  'side',case when room.player_a=uid then 0 else 1 end,
  'fighter_a',room.fighter_a,'fighter_b',room.fighter_b);end if;
 update public.oibung_pvp_queue set heartbeat_at=now()
  where user_id=uid and ticket=p_ticket and heartbeat_at>=now()-interval '45 seconds'
  returning mode into q_mode;
 if q_mode is not null then return jsonb_build_object('status','queued','mode',q_mode);end if;
 return '{"status":"idle"}'::jsonb;
end $$;

create or replace function public.oibung_pvp_leave_v2(
 p_ticket uuid, p_room uuid default null
) returns boolean language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception '로그인이 필요합니다.'; end if;
 if p_ticket is null then raise exception '매칭 요청 ID가 필요합니다.'; end if;
 delete from public.oibung_pvp_queue where user_id=uid and ticket=p_ticket;
 if p_room is not null then
  update public.oibung_pvp_rooms set ended_at=now()
   where id=p_room and ended_at is null and
    ((player_a=uid and ticket_a=p_ticket)
      or (player_b=uid and ticket_b=p_ticket));
 end if;
 return true;
end $$;
revoke all on function public.oibung_pvp_join_v2(text,jsonb,uuid),
 public.oibung_pvp_status_v2(uuid),
 public.oibung_pvp_leave_v2(uuid,uuid) from public,anon;
grant execute on function public.oibung_pvp_join_v2(text,jsonb,uuid),
 public.oibung_pvp_status_v2(uuid),
 public.oibung_pvp_leave_v2(uuid,uuid) to authenticated;
