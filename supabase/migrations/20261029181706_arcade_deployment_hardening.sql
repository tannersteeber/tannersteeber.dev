create index arcade_achievement_game on public.arcade_achievement_definitions(game_id);
create index arcade_stats_period on public.arcade_stats(period_id);
-- Supabase's DDL event trigger remains installed; API callers do not need execute access.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
 end if;
end $$;
