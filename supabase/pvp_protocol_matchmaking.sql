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
  -- A refreshed client must not re-enter an incompatible stale room.
  update public.oibung_pvp_rooms set ended_at=now()
    where ended_at is null and (player_a=uid or player_b=uid)
      and (coalesce(fighter_a->>'v','1')<>coalesce(p_fighter->>'v','1')
        or coalesce(fighter_b->>'v','1')<>coalesce(p_fighter->>'v','1'));
  select * into room from public.oibung_pvp_rooms
    where ended_at is null and created_at>now()-interval '4 minutes'
      and (player_a=uid or player_b=uid)
    order by created_at desc limit 1;
  if found then return jsonb_build_object('status','matched','room',room.id,'mode',room.mode,
    'mode_a',room.control_a,'mode_b',room.control_b,
    'side',case when room.player_a=uid then 0 else 1 end,
    'fighter_a',room.fighter_a,'fighter_b',room.fighter_b);end if;
  select * into myrow from public.oibung_pvp_queue where user_id=uid;
  if found then
    if myrow.mode<>p_mode or coalesce(myrow.fighter->>'v','1')<>coalesce(p_fighter->>'v','1') then
      delete from public.oibung_pvp_queue where user_id=uid;
    else
      update public.oibung_pvp_queue set heartbeat_at=now(),fighter=p_fighter where user_id=uid;
      return jsonb_build_object('status','queued','mode',p_mode);
    end if;
  end if;
  -- A combined queue: the first waiting user wins, regardless of manual/auto.
  select * into rival from public.oibung_pvp_queue
    where user_id<>uid
      and coalesce(fighter->>'v','1')=coalesce(p_fighter->>'v','1')
    order by joined_at asc limit 1;
  if found then
    delete from public.oibung_pvp_queue where user_id=rival.user_id;
    insert into public.oibung_pvp_rooms(
       mode,control_a,control_b,player_a,player_b,fighter_a,fighter_b)
      values(case when rival.mode='auto' and p_mode='auto' then 'auto' else 'manual' end,
        rival.mode,p_mode,rival.user_id,uid,rival.fighter,p_fighter)
      returning * into room;
    return jsonb_build_object('status','matched','room',room.id,'mode',room.mode,
      'mode_a',room.control_a,'mode_b',room.control_b,
      'side',1,'fighter_a',room.fighter_a,'fighter_b',room.fighter_b);
  end if;
  insert into public.oibung_pvp_queue(user_id,mode,fighter,heartbeat_at)
    values(uid,p_mode,p_fighter,now())
    on conflict(user_id) do update set mode=excluded.mode,fighter=excluded.fighter,
      joined_at=now(),heartbeat_at=now();
  return jsonb_build_object('status','queued','mode',p_mode);
 end $$;
