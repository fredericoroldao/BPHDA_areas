-- Executar no SQL Editor do Supabase.
-- Isto faz duas coisas:
-- 1) acrescenta o campo note às dependências, para guardar a explicação editável;
-- 2) cria políticas permissivas de escrita para o editor atual.
--
-- IMPORTANTE:
-- estas políticas são adequadas para um projeto privado / interno.
-- Se esta app vier a ficar pública, o ideal é trocar isto por autenticação e políticas mais restritas.

alter table if exists work_item_dependencies
  add column if not exists note text;

alter table if exists people enable row level security;
alter table if exists areas enable row level security;
alter table if exists functions enable row level security;
alter table if exists work_items enable row level security;
alter table if exists work_item_dependencies enable row level security;
alter table if exists area_people enable row level security;
alter table if exists function_people enable row level security;
alter table if exists work_item_people enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'people' and policyname = 'people_all_access'
  ) then
    create policy people_all_access on people for all to anon, authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'areas' and policyname = 'areas_all_access'
  ) then
    create policy areas_all_access on areas for all to anon, authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'functions' and policyname = 'functions_all_access'
  ) then
    create policy functions_all_access on functions for all to anon, authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'work_items' and policyname = 'work_items_all_access'
  ) then
    create policy work_items_all_access on work_items for all to anon, authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'work_item_dependencies' and policyname = 'work_item_dependencies_all_access'
  ) then
    create policy work_item_dependencies_all_access on work_item_dependencies for all to anon, authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'area_people' and policyname = 'area_people_all_access'
  ) then
    create policy area_people_all_access on area_people for all to anon, authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'function_people' and policyname = 'function_people_all_access'
  ) then
    create policy function_people_all_access on function_people for all to anon, authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'work_item_people' and policyname = 'work_item_people_all_access'
  ) then
    create policy work_item_people_all_access on work_item_people for all to anon, authenticated using (true) with check (true);
  end if;
end $$;
