-- Oibung PvP beta. Atomic, per-mode FIFO matchmaking; authenticated
-- anonymous Supabase Auth identities, no exposed service_role key.
create table if not exists public.oibung_pvp_queue (
 user_id uuid primary key references auth.users(id) on delete cascade,
 mode text not null check (mode in ('auto','manual')),
 fighter jsonb not null,
 joined_at timestamptz not null default now(),
 heartbeat_at timestamptz not null default now()
);
create table if not exists public.oibung_pvp_rooms (
 id uuid primary key default gen_random_uuid(),
 mode text not null check(mode in ('auto','manual')),
 player_a uuid not null references auth.users(id),
 player_b uuid not null references auth.users(id),
 fighter_a jsonb not null,
 fighter_b jsonb not null,
 created_at timestamptz not null default now(),
 ended_at timestamptz,
 check(player_a<>player_b)
);
create index if not exists oibung_pvp_queue_order on public.oibung_pvp_queue(mode,joined_at);
create index if not exists oibung_pvp_rooms_a on public.oibung_pvp_rooms(player_a,created_at desc);
create index if not exists oibung_pvp_rooms_b on public.oibung_pvp_rooms(player_b,created_at desc);
alter table public.oibung_pvp_queue enable row level security;
alter table public.oibung_pvp_rooms enable row level security;
revoke all on public.oibung_pvp_queue,public.oibung_pvp_rooms from public,anon,authenticated;
grant select on public.oibung_pvp_rooms to authenticated;
create policy "pvp rooms visible only to participants" on public.oibung_pvp_rooms
 for select to authenticated using ((select auth.uid())=player_a or (select auth.uid())=player_b);

-- Auth identity is always checked by SQL, never supplied by the browser.
create or replace function public.oibung_pvp_join(p_mode text,p_fighter jsonb)
 returns jsonb language plpgsql security definer set search_path=''
 as $$
 declare uid uuid:=auth.uid(); rival public.oibung_pvp_queue%rowtype;
  myrow public.oibung_pvp_queue%rowtype; room public.oibung_pvp_rooms%rowtype;
 begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  if p_mode not in ('auto','manual') then raise exception '잘못된 모드입니다.'; end if;
  if jsonb_typeof(p_fighter)<>'object' or length(p_fighter::text)>2500
     then raise exception '캐릭터 정보가 올바르지 않습니다.'; end if;
  perform pg_advisory_xact_lock(719826,1);
  delete from public.oibung_pvp_queue where heartbeat_at<now()-interval '40 seconds';
  select * into room from public.oibung_pvp_rooms
    where ended_at is null and created_at>now()-interval '4 minutes'
      and (player_a=uid or player_b=uid)
    order by created_at desc limit 1;
  if found then return jsonb_build_object('status','matched','room',room.id,'mode',room.mode,
    'side',case when room.player_a=uid then 0 else 1 end,
    'fighter_a',room.fighter_a,'fighter_b',room.fighter_b);end if;
  select * into myrow from public.oibung_pvp_queue where user_id=uid;
  if found then
    if myrow.mode<>p_mode then
      delete from public.oibung_pvp_queue where user_id=uid;
    else
      update public.oibung_pvp_queue set heartbeat_at=now() where user_id=uid;
      return jsonb_build_object('status','queued','mode',p_mode);
    end if;
  end if;
  select * into rival from public.oibung_pvp_queue
    where mode=p_mode and user_id<>uid order by joined_at asc limit 1;
  if found then
    delete from public.oibung_pvp_queue where user_id=rival.user_id;
    insert into public.oibung_pvp_rooms(mode,player_a,player_b,fighter_a,fighter_b)
      values(p_mode,rival.user_id,uid,rival.fighter,p_fighter) returning * into room;
    return jsonb_build_object('status','matched','room',room.id,'mode',room.mode,
      'side',1,'fighter_a',room.fighter_a,'fighter_b',room.fighter_b);
  end if;
  insert into public.oibung_pvp_queue(user_id,mode,fighter,heartbeat_at)
    values(uid,p_mode,p_fighter,now())
    on conflict(user_id) do update set mode=excluded.mode,fighter=excluded.fighter,
      joined_at=now(),heartbeat_at=now();
  return jsonb_build_object('status','queued','mode',p_mode);
 end $$;
create or replace function public.oibung_pvp_status()
 returns jsonb language plpgsql security definer set search_path=''
 as $$
 declare uid uuid:=auth.uid(); room public.oibung_pvp_rooms%rowtype; q_mode text;
 begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  select * into room from public.oibung_pvp_rooms
   where ended_at is null and created_at>now()-interval '4 minutes'
     and (player_a=uid or player_b=uid)
   order by created_at desc limit 1;
  if found then return jsonb_build_object('status','matched','room',room.id,
    'mode',room.mode,'side',case when room.player_a=uid then 0 else 1 end,
    'fighter_a',room.fighter_a,'fighter_b',room.fighter_b);end if;
  update public.oibung_pvp_queue set heartbeat_at=now()
   where user_id=uid and heartbeat_at>=now()-interval '40 seconds'
   returning mode into q_mode;
  if q_mode is not null then return jsonb_build_object('status','queued','mode',q_mode);end if;
  return '{"status":"idle"}'::jsonb;
 end $$;
create or replace function public.oibung_pvp_leave(p_room uuid default null)
 returns boolean language plpgsql security definer set search_path=''
 as $$
 declare uid uuid:=auth.uid();
 begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  delete from public.oibung_pvp_queue where user_id=uid;
  if p_room is not null then
    update public.oibung_pvp_rooms set ended_at=now()
      where id=p_room and (player_a=uid or player_b=uid) and ended_at is null;
  end if;
  return true;
 end $$;
revoke all on function public.oibung_pvp_join(text,jsonb),
 public.oibung_pvp_status(),public.oibung_pvp_leave(uuid) from public,anon;
grant execute on function public.oibung_pvp_join(text,jsonb),
 public.oibung_pvp_status(),public.oibung_pvp_leave(uuid) to authenticated;
-- Only two signed-in participants can read/send private game broadcasts.
create policy "pvp game receive for members"
 on realtime.messages for select to authenticated
 using (split_part(realtime.topic(),':',1)='oibung-pvp'
  and exists(select 1 from public.oibung_pvp_rooms r
    where r.id::text=split_part(realtime.topic(),':',2)
      and (r.player_a=(select auth.uid()) or r.player_b=(select auth.uid()))
      and r.ended_at is null));
create policy "pvp game send for members"
 on realtime.messages for insert to authenticated
 with check (split_part(realtime.topic(),':',1)='oibung-pvp'
  and exists(select 1 from public.oibung_pvp_rooms r
    where r.id::text=split_part(realtime.topic(),':',2)
      and (r.player_a=(select auth.uid()) or r.player_b=(select auth.uid()))
      and r.ended_at is null));
