-- Arcade platform v1. Additive, production deployment requires explicit review.
create schema if not exists arcade_private;
revoke all on schema arcade_private from public, anon, authenticated;

create table public.arcade_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
 display_name text not null default '' check(char_length(display_name)<=40),
 public_profile boolean not null default false,
 ranking_suspended boolean not null default false,
 leaderboard_opt_in boolean not null default false,
 created_at timestamptz not null default now()
);
create unique index arcade_username_unique on public.arcade_profiles(lower(username));
create table public.arcade_games (
 id text primary key, name text not null, category text not null check(category in ('arcade','casino')),
 enabled boolean not null default false, validator text,
 competitive_enabled boolean not null default false
);
insert into public.arcade_games values
 ('cruise','Cruise','arcade',true,null,false),
 ('cutup','Cutup','arcade',true,null,false),
 ('ripagolf','RipaGolf','arcade',true,'golf-v1',false);
create table public.arcade_saves (
 user_id uuid not null references public.arcade_profiles on delete cascade,
 game_id text not null references public.arcade_games, revision bigint not null default 1,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=131072),
 updated_at timestamptz not null default now(), primary key(user_id,game_id)
);
create table public.arcade_wallets (
 user_id uuid primary key references public.arcade_profiles on delete cascade,
 arcade_points bigint not null default 0 check(arcade_points between 0 and 9000000000000),
 casino_chips bigint not null default 0 check(casino_chips between 0 and 9000000000000),
 lifetime_earned bigint not null default 0 check(lifetime_earned>=0),
 lifetime_spent bigint not null default 0 check(lifetime_spent>=0)
);
create table public.arcade_operations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.arcade_profiles on delete cascade,
 request_key uuid not null, kind text not null check(kind in ('reward','exchange','stake','payout','refund')),
 payload jsonb not null, created_at timestamptz not null default now(), unique(user_id,request_key)
);
create table public.arcade_ledger (
 id bigint generated always as identity primary key, operation_id uuid not null references public.arcade_operations on delete cascade,
 user_id uuid not null references public.arcade_profiles on delete cascade,
 currency text not null check(currency in ('arcade_points','casino_chips')), delta bigint not null check(delta<>0),
 balance_after bigint not null check(balance_after>=0), created_at timestamptz not null default now(), unique(operation_id,currency)
);
create index arcade_ledger_owner_time on public.arcade_ledger(user_id,created_at desc);
create table public.arcade_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.arcade_profiles on delete cascade,
 game_id text not null references public.arcade_games, validator_version text not null, seed bigint not null,
 status text not null default 'active' check(status in ('active','completed','abandoned','invalid')),
 revision integer not null default 0, state jsonb not null default '{}'::jsonb,
 started_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours'
);
create unique index arcade_one_active_run on public.arcade_sessions(user_id,game_id) where status='active';
create index arcade_sessions_owner_time on public.arcade_sessions(user_id,started_at desc);
create table public.arcade_events (
 session_id uuid not null references public.arcade_sessions on delete cascade, sequence integer not null,
 request_key uuid not null, request jsonb not null, response jsonb not null,
 created_at timestamptz not null default now(), primary key(session_id,sequence), unique(session_id,request_key)
);
create table public.arcade_stat_definitions (
 game_id text not null, stat text not null, label text not null,
 aggregation text not null check(aggregation in ('sum','max','min')), ranked boolean not null default false,
 direction text not null default 'desc' check(direction in ('asc','desc')), primary key(game_id,stat)
);
insert into public.arcade_stat_definitions(game_id,stat,label,aggregation) values
 ('arcade','runs_started','Game sessions started','sum'),('arcade','points_earned','Lifetime Arcade Points earned','sum'),
 ('cruise','distance','Distance driven (metres)','sum'),('cruise','parts','Parts collected','sum'),('cruise','score','Best collection score','max'),('cruise','seconds','Driving time (seconds)','sum'),('cruise','runs','Drives','sum'),
 ('cutup','score','Highest score','max'),('cutup','distance','Distance driven (metres)','sum'),('cutup','seconds','Driving time (seconds)','sum'),('cutup','passes','Traffic passes','sum'),('cutup','combo','Best multiplier','max'),('cutup','runs','Runs','sum'),
 ('ripagolf','game_points','Game score earned (not Arcade Points)','sum'),('ripagolf','relative_over','Strokes above par','sum'),('ripagolf','relative_under','Strokes below par','sum'),('ripagolf','holes','Holes completed','sum'),('ripagolf','strokes','Strokes','sum'),('ripagolf','birdies','Birdies','sum'),('ripagolf','eagles','Eagles','sum'),('ripagolf','aces','Holes-in-one','sum'),('ripagolf','won','Predictions won','sum'),('ripagolf','lost','Predictions lost','sum'),('ripagolf','streak','Best streak','max'),('ripagolf','score','Highest run score','max');
create table public.arcade_periods (
 id text primary key, kind text not null check(kind in ('all','week','month','season')),
 starts_at timestamptz, ends_at timestamptz, frozen_at timestamptz,
 check(ends_at is null or ends_at>starts_at)
);
insert into public.arcade_periods values('all','all',null,null,null);
create table public.arcade_stats (
 user_id uuid not null references public.arcade_profiles on delete cascade, game_id text not null, stat text not null,
 period_id text not null references public.arcade_periods, verified boolean not null,
 value numeric not null check(value>=0 and value<1e15), attained_at timestamptz not null default now(),
 primary key(user_id,game_id,stat,period_id,verified), foreign key(game_id,stat) references public.arcade_stat_definitions
);
create index arcade_rank_values on public.arcade_stats(game_id,stat,period_id,value desc,attained_at,user_id) where verified;
create table public.arcade_achievement_definitions (
 id text primary key, game_id text not null references public.arcade_games, name text not null,
 description text not null, stat text not null, threshold numeric not null check(threshold>0)
);
insert into public.arcade_achievement_definitions values
 ('rg-streak-5','ripagolf','Hot Streak','Win five predictions in a row.','streak',5),
 ('rg-streak-10','ripagolf','High Roller','Win ten predictions in a row.','streak',10),
 ('rg-streak-20','ripagolf','Golden Run','Win twenty predictions in a row.','streak',20),
 ('rg-streak-50','ripagolf','Ripa Legend','Win fifty predictions in a row.','streak',50),
 ('rg-streak-100','ripagolf','Legendary Streak','Win one hundred predictions in a row.','streak',100);
create table public.arcade_achievements (
 user_id uuid not null references public.arcade_profiles on delete cascade, achievement_id text not null references public.arcade_achievement_definitions,
 unlocked_at timestamptz not null default now(), primary key(user_id,achievement_id)
);
create table arcade_private.economy_config (
 singleton boolean primary key default true check(singleton), exchange_enabled boolean not null default false,
 points_per_unit integer check(points_per_unit>0), chips_per_unit integer check(chips_per_unit>0),
 max_exchange_points bigint not null default 100000 check(max_exchange_points>0)
);
insert into arcade_private.economy_config(singleton) values(true);
create table arcade_private.reward_rules (
 game_id text primary key references public.arcade_games, enabled boolean not null default false,
 metric text not null, units numeric not null check(units>0), points bigint not null check(points>0),
 per_event_cap bigint not null check(per_event_cap>0), daily_cap bigint not null check(daily_cap>0)
);
create table arcade_private.rate_limits (
 user_id uuid not null references auth.users on delete cascade, scope text not null, bucket timestamptz not null,
 requests integer not null, primary key(user_id,scope,bucket)
);
create table public.arcade_casino_rounds (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.arcade_profiles on delete cascade,
 game_id text not null references public.arcade_games, request_key uuid not null,
 stake bigint not null check(stake>0), payout bigint check(payout>=0),
 state text not null check(state in ('open','settled','refunded')), outcome jsonb,
 opened_at timestamptz not null default now(), settled_at timestamptz, unique(user_id,request_key)
);
create index arcade_rounds_game on public.arcade_casino_rounds(game_id);
create index arcade_saves_game on public.arcade_saves(game_id);
create index arcade_sessions_game on public.arcade_sessions(game_id);
create index arcade_achievements_definition on public.arcade_achievements(achievement_id);
create index arcade_ledger_operation on public.arcade_ledger(operation_id);

-- No browser writes to these tables. All writes use explicitly granted narrow RPCs.
do $$ declare t text; begin
 foreach t in array array['arcade_profiles','arcade_games','arcade_saves','arcade_wallets','arcade_operations','arcade_ledger','arcade_sessions','arcade_events','arcade_stat_definitions','arcade_periods','arcade_stats','arcade_achievement_definitions','arcade_achievements','arcade_casino_rounds'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
 foreach t in array array['economy_config','reward_rules','rate_limits'] loop
 execute format('alter table arcade_private.%I enable row level security',t); end loop;
 foreach t in array array['arcade_profiles','arcade_saves','arcade_wallets','arcade_operations','arcade_ledger','arcade_sessions','arcade_stats','arcade_achievements','arcade_casino_rounds'] loop
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy owner_read on public.%I for select to authenticated using (user_id=(select auth.uid()))',t);
 end loop;
 foreach t in array array['arcade_games','arcade_stat_definitions','arcade_periods','arcade_achievement_definitions'] loop
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy catalog_read on public.%I for select to authenticated using (true)',t); end loop;
end $$;

create function arcade_private.require_player() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); begin
 if uid is null or not exists(select 1 from auth.users u where u.id=uid and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now())) then raise exception 'Sign in with a verified account' using errcode='42501'; end if;
 if not exists(select 1 from auth.sessions s where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=uid) then raise exception 'Session expired' using errcode='42501'; end if;
 return uid;
end $$;
create function arcade_private.rate_limit(uid uuid, p_scope text, max_requests int) returns void language plpgsql set search_path='' as $$
declare n int; begin
 insert into arcade_private.rate_limits values(uid,p_scope,date_trunc('minute',now()),1)
 on conflict(user_id,scope,bucket) do update set requests=arcade_private.rate_limits.requests+1 returning requests into n;
 if n>max_requests then raise exception 'Too many requests. Try again shortly.' using errcode='P0001'; end if;
end $$;
create function public.arcade_profile_save(p_username text,p_public boolean default false,p_ranked boolean default false,p_display_name text default '') returns public.arcade_profiles language plpgsql security definer set search_path='' as $$
declare uid uuid:=arcade_private.require_player(); r public.arcade_profiles; begin
 perform arcade_private.rate_limit(uid,'profile',10);
 insert into public.arcade_profiles(user_id,username,public_profile,leaderboard_opt_in,display_name) values(uid,p_username,p_public,p_ranked,p_display_name)
 on conflict(user_id) do update set username=excluded.username,display_name=excluded.display_name,public_profile=excluded.public_profile,leaderboard_opt_in=excluded.leaderboard_opt_in returning * into r;
 insert into public.arcade_wallets(user_id) values(uid) on conflict do nothing; return r;
end $$;
create function public.arcade_save(p_game text,p_revision bigint,p_payload jsonb) returns public.arcade_saves language plpgsql security definer set search_path='' as $$
declare uid uuid:=arcade_private.require_player(); r public.arcade_saves; begin
 perform arcade_private.rate_limit(uid,'save',12);
 if not exists(select 1 from public.arcade_games where id=p_game and enabled) then raise exception 'Unknown game'; end if;
 if p_revision=0 then insert into public.arcade_saves(user_id,game_id,payload) values(uid,p_game,p_payload) on conflict do nothing returning * into r;
 else update public.arcade_saves set payload=p_payload,revision=revision+1,updated_at=now() where user_id=uid and game_id=p_game and revision=p_revision returning * into r; end if;
 if r.user_id is null then raise exception 'Save conflict: another device has a newer save' using errcode='40001'; end if; return r;
end $$;
create function public.arcade_start(p_game text,p_key uuid,p_replace boolean default false) returns public.arcade_sessions language plpgsql security definer set search_path='' as $$
declare uid uuid:=arcade_private.require_player(); r public.arcade_sessions; begin
 perform arcade_private.rate_limit(uid,'start',10);
 perform 1 from public.arcade_profiles where user_id=uid for update;
 select * into r from public.arcade_sessions where id=p_key and user_id=uid and game_id=p_game;
 if found then return r; end if;
 if not exists(select 1 from public.arcade_games where id=p_game and enabled and category='arcade') then raise exception 'Unknown or disabled game'; end if;
 update public.arcade_sessions set status='abandoned' where user_id=uid and game_id=p_game and status='active' and (expires_at<now() or p_replace);
 select * into r from public.arcade_sessions where user_id=uid and game_id=p_game and status='active';
 if found then raise exception 'A run is already active. Resume it or explicitly start a new run.' using errcode='40001'; end if;
 insert into public.arcade_sessions(id,user_id,game_id,validator_version,seed,state) values(p_key,uid,p_game,coalesce((select validator from public.arcade_games where id=p_game),'practice-v1'),('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint,'{"holeIndex":1,"streak":0,"score":0,"strokes":0,"prediction":null,"ball":null,"windTime":0}') returning * into r;
 perform arcade_private.add_stats(uid,'arcade','{"runs_started":1}',true);return r;
end $$;
-- Every accepted statistic is aggregated once, inside the same transaction as its event.
create function arcade_private.add_stats(uid uuid,game text,metrics jsonb,is_verified boolean) returns void language plpgsql set search_path='' set timezone='UTC' as $$
declare d record; p text; start_week timestamptz:=date_trunc('week',now() at time zone 'UTC') at time zone 'UTC'; start_month timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'; v numeric; begin
 insert into public.arcade_periods(id,kind,starts_at,ends_at) values
 ('week:'||to_char(start_week at time zone 'UTC','YYYY-MM-DD'),'week',start_week,start_week+interval '7 days'),
 ('month:'||to_char(start_month at time zone 'UTC','YYYY-MM-DD'),'month',start_month,start_month+interval '1 month') on conflict do nothing;
 for d in select * from public.arcade_stat_definitions where game_id=game and metrics ? stat loop
 v:=(metrics->>d.stat)::numeric;
 if v is null or v<0 or v>=1e12 then raise exception 'Invalid statistic'; end if;
 for p in select id from public.arcade_periods where id in ('all','week:'||to_char(start_week at time zone 'UTC','YYYY-MM-DD'),'month:'||to_char(start_month at time zone 'UTC','YYYY-MM-DD')) or (kind='season' and starts_at<=now() and ends_at>now() and frozen_at is null) loop
 if exists(select 1 from public.arcade_periods where id=p and frozen_at is not null) then raise exception 'Ranking period is frozen'; end if;
 insert into public.arcade_stats values(uid,game,d.stat,p,is_verified,v,now())
 on conflict(user_id,game_id,stat,period_id,verified) do update set
 value=case d.aggregation when 'sum' then arcade_stats.value+v when 'max' then greatest(arcade_stats.value,v) else least(arcade_stats.value,v) end,
 attained_at=case when (d.aggregation='sum' and v<>0) or (d.aggregation='max' and v>arcade_stats.value) or (d.aggregation='min' and v<arcade_stats.value) then now() else arcade_stats.attained_at end;
 end loop; end loop;
 if is_verified then
 insert into public.arcade_achievements select uid,a.id,now() from public.arcade_achievement_definitions a join public.arcade_stats s on s.game_id=a.game_id and s.stat=a.stat and s.period_id='all' and s.verified and s.user_id=uid where a.game_id=game and s.value>=a.threshold on conflict do nothing;
 end if;
end $$;
create function public.arcade_practice_finish(p_session uuid,p_metrics jsonb) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=arcade_private.require_player(); r public.arcade_sessions; k text; v numeric; begin
 perform arcade_private.rate_limit(uid,'practice',10);
 select * into r from public.arcade_sessions where id=p_session and user_id=uid for update;
 if not found or r.game_id not in ('cruise','cutup') then raise exception 'Invalid session'; end if;
 if r.status='completed' then if r.state<>p_metrics then raise exception 'Duplicate result differs'; end if; return; end if;
 if r.status<>'active' or r.expires_at<now() then raise exception 'Session expired'; end if;
 for k,v in select key,value::text::numeric from jsonb_each(p_metrics) loop
 if not exists(select 1 from public.arcade_stat_definitions where game_id=r.game_id and stat=k) or v<0 or v>1e9 then raise exception 'Invalid practice metric'; end if; end loop;
 perform arcade_private.add_stats(uid,r.game_id,p_metrics||'{"runs":1}',false);
 update public.arcade_sessions set status='completed',state=p_metrics where id=r.id;
end $$;

-- Wallet mutex: one row lock serializes all currencies, exchanges and rounds for a player.
create function arcade_private.move_wallet(uid uuid,k uuid,kind text,body jsonb,points_delta bigint,chips_delta bigint) returns uuid language plpgsql set search_path='' as $$
declare w public.arcade_wallets; op public.arcade_operations; begin
 select * into strict w from public.arcade_wallets where user_id=uid for update;
 select * into op from public.arcade_operations where user_id=uid and request_key=k;
 if found then if op.kind<>kind or op.payload<>body then raise exception 'Idempotency key reused with different request'; end if; return op.id; end if;
 if w.arcade_points+points_delta<0 or w.casino_chips+chips_delta<0 then raise exception 'Insufficient balance'; end if;
 insert into public.arcade_operations(user_id,request_key,kind,payload) values(uid,k,kind,body) returning * into op;
 update public.arcade_wallets set arcade_points=arcade_points+points_delta,casino_chips=casino_chips+chips_delta,
 lifetime_earned=lifetime_earned+case when kind='reward' then greatest(points_delta,0) else 0 end,
 lifetime_spent=lifetime_spent+greatest(-points_delta,0) where user_id=uid;
 if points_delta<>0 then insert into public.arcade_ledger(operation_id,user_id,currency,delta,balance_after) values(op.id,uid,'arcade_points',points_delta,w.arcade_points+points_delta); end if;
 if chips_delta<>0 then insert into public.arcade_ledger(operation_id,user_id,currency,delta,balance_after) values(op.id,uid,'casino_chips',chips_delta,w.casino_chips+chips_delta); end if;
 if kind='reward' and points_delta>0 then perform arcade_private.add_stats(uid,'arcade',jsonb_build_object('points_earned',points_delta),true); end if;
 return op.id;
end $$;
create function public.arcade_exchange_info() returns jsonb language plpgsql security definer set search_path='' as $$ begin
 perform arcade_private.require_player(); return (select to_jsonb(c)-'singleton' from arcade_private.economy_config c); end $$;
create function public.arcade_exchange(p_key uuid,p_points bigint) returns public.arcade_wallets language plpgsql security definer set search_path='' as $$
declare uid uuid:=arcade_private.require_player(); c arcade_private.economy_config; w public.arcade_wallets; old public.arcade_operations; begin
 perform arcade_private.rate_limit(uid,'exchange',6);
 select * into w from public.arcade_wallets where user_id=uid for update;
 select * into old from public.arcade_operations where user_id=uid and request_key=p_key;
 if found then if old.kind<>'exchange' or (old.payload->>'points') is distinct from p_points::text then raise exception 'Idempotency key reused with different request'; end if; return w; end if;
 select * into c from arcade_private.economy_config where singleton;
 if not c.exchange_enabled or c.points_per_unit is null or c.chips_per_unit is null then raise exception 'Exchange is awaiting an approved rate'; end if;
 if p_points is null or p_points<=0 or p_points>c.max_exchange_points or p_points%c.points_per_unit<>0 then raise exception 'Invalid exchange amount'; end if;
 perform arcade_private.move_wallet(uid,p_key,'exchange',jsonb_build_object('points',p_points,'points_per_unit',c.points_per_unit,'chips_per_unit',c.chips_per_unit),-p_points,(p_points/c.points_per_unit)*c.chips_per_unit);
 select * into w from public.arcade_wallets where user_id=uid; return w;
end $$;

-- Called only by the authenticated Edge handler after server physics, never by browsers.
create function public.arcade_verified_commit(p_user uuid,p_session uuid,p_revision int,p_key uuid,p_request jsonb,p_state jsonb,p_metrics jsonb,p_response jsonb,p_finished boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.arcade_sessions; e public.arcade_events; rule arcade_private.reward_rules; amount bigint; used bigint; begin
 perform 1 from auth.users where id=p_user and email_confirmed_at is not null and (banned_until is null or banned_until<now()); if not found then raise exception 'Account unavailable'; end if;
 select * into r from public.arcade_sessions where id=p_session and user_id=p_user for update;
 if not found then raise exception 'Session unavailable'; end if;
 select * into e from public.arcade_events where session_id=r.id and request_key=p_key;
 if found then if e.request<>p_request then raise exception 'Idempotency key reused with different request'; end if; return e.response; end if;
 if r.status<>'active' or r.expires_at<now() or r.revision<>p_revision then raise exception 'Session changed. Reload the saved run.' using errcode='40001'; end if;
 perform arcade_private.rate_limit(p_user,'verified',30);
 perform arcade_private.add_stats(p_user,r.game_id,p_metrics,true);
 select * into rule from arcade_private.reward_rules where game_id=r.game_id and enabled;
 if found and p_metrics ? rule.metric then
 -- Lock before calculating the daily allowance, so simultaneous sessions cannot exceed it.
 perform 1 from public.arcade_wallets where user_id=p_user for update;
 select coalesce(sum(l.delta),0) into used from public.arcade_ledger l join public.arcade_operations o on o.id=l.operation_id where l.user_id=p_user and l.currency='arcade_points' and o.kind='reward' and o.payload->>'game'=r.game_id and l.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 amount:=greatest(0,least(rule.per_event_cap,rule.daily_cap-used,floor((p_metrics->>rule.metric)::numeric/rule.units)*rule.points));
 if amount>0 then perform arcade_private.move_wallet(p_user,p_key,'reward',jsonb_build_object('game',r.game_id,'session',r.id,'revision',p_revision),amount,0); end if;
 end if;
 update public.arcade_sessions set revision=revision+1,state=p_state,status=case when p_finished then 'completed' else 'active' end where id=r.id;
 insert into public.arcade_events values(r.id,p_revision+1,p_key,p_request,p_response,now()); return p_response;
end $$;

-- Casino scaffolding: no casino registry entries exist. Only trusted game handlers may call this.
create function public.arcade_casino_open(p_user uuid,p_game text,p_key uuid,p_stake bigint) returns public.arcade_casino_rounds language plpgsql security definer set search_path='' as $$
declare r public.arcade_casino_rounds; begin
 perform 1 from public.arcade_wallets where user_id=p_user for update;
 select * into r from public.arcade_casino_rounds where user_id=p_user and request_key=p_key;
 if found then if r.game_id is distinct from p_game or r.stake is distinct from p_stake then raise exception 'Conflicting round request'; end if; return r; end if;
 if not exists(select 1 from public.arcade_games where id=p_game and category='casino' and enabled and validator is not null) then raise exception 'Casino game is not enabled'; end if;
 if p_stake is null or p_stake<1 or p_stake>1000000 then raise exception 'Invalid stake'; end if;
 perform arcade_private.move_wallet(p_user,p_key,'stake',jsonb_build_object('game',p_game,'stake',p_stake),0,-p_stake);
 insert into public.arcade_casino_rounds(user_id,game_id,request_key,stake,state) values(p_user,p_game,p_key,p_stake,'open') returning * into r; return r;
end $$;
create function public.arcade_casino_settle(p_user uuid,p_round uuid,p_refund boolean,p_payout bigint,p_outcome jsonb) returns public.arcade_casino_rounds language plpgsql security definer set search_path='' as $$
declare r public.arcade_casino_rounds; target text:=case when p_refund then 'refunded' else 'settled' end; amount bigint; begin
 -- Lock order is always wallet, then round (same order as open).
 perform 1 from public.arcade_wallets where user_id=p_user for update;
 select * into strict r from public.arcade_casino_rounds where id=p_round and user_id=p_user for update;
 if p_refund is null then raise exception 'Invalid refund flag'; end if;
 amount:=case when p_refund then r.stake else p_payout end;
 if amount is null or amount<0 or amount>1000000000 then raise exception 'Invalid payout'; end if;
 if r.state<>'open' then if r.state<>target or r.payout<>amount or r.outcome is distinct from p_outcome then raise exception 'Round already settled differently'; end if; return r; end if;
 perform arcade_private.move_wallet(p_user,r.id,case when p_refund then 'refund' else 'payout' end,jsonb_build_object('round',r.id,'amount',amount,'outcome',p_outcome),0,amount);
 update public.arcade_casino_rounds set state=target,payout=amount,outcome=p_outcome,settled_at=now() where id=r.id returning * into r;
 perform arcade_private.record_casino(r.user_id,r.game_id,r.stake,r.payout,p_refund);return r;
end $$;

create function public.arcade_leaderboard(p_game text,p_stat text,p_period text default 'all',p_page int default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=arcade_private.require_player(); result jsonb; dir text; begin
 perform arcade_private.rate_limit(uid,'ranking',30);
 if p_page<0 or p_page>10000 then raise exception 'Invalid page'; end if;
 select direction into dir from public.arcade_stat_definitions d where d.game_id=p_game and d.stat=p_stat and d.ranked and (p_game='arcade' or exists(select 1 from public.arcade_games g where g.id=p_game and g.competitive_enabled));
 if not found then return '{"enabled":false,"rows":[],"total":0,"own":null}'; end if;
 with ranked as (
 select s.user_id,p.username,s.value,s.attained_at,rank() over(order by case when dir='asc' then s.value else -s.value end) as rank
 from public.arcade_stats s join public.arcade_profiles p using(user_id)
 where s.game_id=p_game and s.stat=p_stat and s.period_id=p_period and s.verified and p.leaderboard_opt_in and not p.ranking_suspended
 ), page as (select user_id,username,value,rank from ranked order by rank,attained_at,user_id limit 25 offset p_page*25)
 select jsonb_build_object('enabled',true,'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'),'total',(select count(*) from ranked),'own',(select to_jsonb(r)-'attained_at' from ranked r where user_id=uid)) into result; return result;
end $$;
create function public.arcade_public_profile(p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 perform arcade_private.require_player();
 if not exists(select 1 from public.arcade_profiles where user_id=p_user and public_profile) then return null; end if;
 return jsonb_build_object('profile',(select to_jsonb(p)-'public_profile'-'leaderboard_opt_in'-'ranking_suspended' from public.arcade_profiles p where user_id=p_user),'stats',(select coalesce(jsonb_agg(to_jsonb(s)-'user_id'),'[]') from public.arcade_stats s where s.user_id=p_user and verified and period_id='all'),'achievements',(select coalesce(jsonb_agg(to_jsonb(a)-'user_id'),'[]') from public.arcade_achievements a where a.user_id=p_user)); end $$;
-- Users cannot invoke service operations or internal helpers, including via direct REST RPC.
revoke all on all functions in schema arcade_private from public,anon,authenticated;
revoke all on function public.arcade_profile_save(text,boolean,boolean,text),public.arcade_save(text,bigint,jsonb),public.arcade_start(text,uuid,boolean),public.arcade_practice_finish(uuid,jsonb),public.arcade_exchange_info(),public.arcade_exchange(uuid,bigint),public.arcade_leaderboard(text,text,text,int),public.arcade_public_profile(uuid),public.arcade_verified_commit(uuid,uuid,int,uuid,jsonb,jsonb,jsonb,jsonb,boolean),public.arcade_casino_open(uuid,text,uuid,bigint),public.arcade_casino_settle(uuid,uuid,boolean,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.arcade_profile_save(text,boolean,boolean,text),public.arcade_save(text,bigint,jsonb),public.arcade_start(text,uuid,boolean),public.arcade_practice_finish(uuid,jsonb),public.arcade_exchange_info(),public.arcade_exchange(uuid,bigint),public.arcade_leaderboard(text,text,text,int),public.arcade_public_profile(uuid) to authenticated;
grant execute on function public.arcade_verified_commit(uuid,uuid,int,uuid,jsonb,jsonb,jsonb,jsonb,boolean),public.arcade_casino_open(uuid,text,uuid,bigint),public.arcade_casino_settle(uuid,uuid,boolean,bigint,jsonb) to service_role;
grant select on public.arcade_sessions,public.arcade_events to service_role;

-- Bound physics work before simulation; successful reservations commit independently.
create function public.arcade_request_limit(p_user uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform arcade_private.rate_limit(p_user,'physics',20);
end $$;
revoke all on function public.arcade_request_limit(uuid) from public,anon,authenticated;
grant execute on function public.arcade_request_limit(uuid) to service_role;
-- Freeze past UTC periods and prune only expired operational data. Schedule after deployment review.
create function public.arcade_maintenance() returns void language plpgsql security definer set search_path='' as $$ begin
 update public.arcade_periods set frozen_at=now() where ends_at<now() and frozen_at is null;
 delete from arcade_private.rate_limits where bucket<now()-interval '2 days';
 delete from public.arcade_sessions where expires_at<now()-interval '30 days';
end $$;
revoke all on function public.arcade_maintenance() from public,anon,authenticated;
grant execute on function public.arcade_maintenance() to service_role;

-- Dormant casino rollups: conversions never count as winnings. No games or fake rounds are seeded.
create table public.arcade_casino_stats (
 user_id uuid not null references public.arcade_profiles on delete cascade,
 game_id text not null, period_id text not null references public.arcade_periods,
 rounds bigint not null default 0 check(rounds>=0), wins bigint not null default 0 check(wins>=0 and wins<=rounds),
 stakes bigint not null default 0 check(stakes>=0), payouts bigint not null default 0 check(payouts>=0),
 net_winnings bigint generated always as (payouts-stakes) stored,
 refunds bigint not null default 0 check(refunds>=0),largest_payout bigint not null default 0,
 current_streak bigint not null default 0,best_streak bigint not null default 0,
 primary key(user_id,game_id,period_id)
);
alter table public.arcade_casino_stats enable row level security;
revoke all on public.arcade_casino_stats from public,anon,authenticated;
grant select on public.arcade_casino_stats to authenticated;
create policy casino_stats_owner on public.arcade_casino_stats for select to authenticated using(user_id=(select auth.uid()));
create index arcade_casino_period on public.arcade_casino_stats(period_id,game_id,net_winnings desc);
create function arcade_private.record_casino(uid uuid,game text,stake bigint,payout bigint,refunded boolean) returns void language plpgsql set search_path='' as $$
declare period text; scope text; begin
 perform arcade_private.add_stats(uid,'casino','{}',true);
 for period in select id from public.arcade_periods where id='all' or (starts_at<=now() and ends_at>now() and frozen_at is null) loop
 foreach scope in array array['casino',game] loop
 insert into public.arcade_casino_stats(user_id,game_id,period_id,rounds,wins,stakes,payouts,refunds,largest_payout,current_streak,best_streak)
 values(uid,scope,period,case when refunded then 0 else 1 end,case when not refunded and payout>stake then 1 else 0 end,case when refunded then 0 else stake end,case when refunded then 0 else payout end,case when refunded then 1 else 0 end,case when refunded then 0 else payout end,case when not refunded and payout>stake then 1 else 0 end,case when not refunded and payout>stake then 1 else 0 end)
 on conflict(user_id,game_id,period_id) do update set
 rounds=arcade_casino_stats.rounds+excluded.rounds,wins=arcade_casino_stats.wins+excluded.wins,stakes=arcade_casino_stats.stakes+excluded.stakes,payouts=arcade_casino_stats.payouts+excluded.payouts,refunds=arcade_casino_stats.refunds+excluded.refunds,largest_payout=greatest(arcade_casino_stats.largest_payout,excluded.largest_payout),
 current_streak=case when refunded then arcade_casino_stats.current_streak when payout>stake then arcade_casino_stats.current_streak+1 else 0 end,
 best_streak=greatest(arcade_casino_stats.best_streak,case when refunded then arcade_casino_stats.current_streak when payout>stake then arcade_casino_stats.current_streak+1 else 0 end);
 end loop;end loop;
end $$;
revoke all on function arcade_private.record_casino(uuid,text,bigint,bigint,boolean) from public,anon,authenticated;
create function public.arcade_abandon(p_session uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=arcade_private.require_player();begin
 update public.arcade_sessions set status='abandoned' where id=p_session and user_id=uid and status='active';
end $$;
revoke all on function public.arcade_abandon(uuid) from public,anon,authenticated;
grant execute on function public.arcade_abandon(uuid) to authenticated;
