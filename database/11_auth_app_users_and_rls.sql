-- Executar no SQL Editor do Supabase depois de ativar Google Auth.
-- Modelo:
-- - apenas utilizadores convidados em app_users entram na app;
-- - vista publica: qualquer app_user active/invited autenticado pode ler;
-- - editor: apenas app_user com role admin pode escrever.

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null,
  name text,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  invited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_users_email_unique
  on app_users (lower(email));

drop trigger if exists trg_app_users_updated_at on app_users;
create trigger trg_app_users_updated_at
before update on app_users
for each row execute function set_updated_at();

create or replace function current_app_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select au.role
  from app_users au
  where au.status in ('invited', 'active')
    and (
      au.user_id = auth.uid()
      or lower(au.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  limit 1
$$;

create or replace function is_app_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_app_user_role() is not null
$$;

create or replace function is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_app_user_role() = 'admin'
$$;

alter table app_users enable row level security;
drop policy if exists app_users_select_own_or_admin on app_users;
drop policy if exists app_users_admin_insert on app_users;
drop policy if exists app_users_admin_update on app_users;
drop policy if exists app_users_admin_delete on app_users;

create policy app_users_select_own_or_admin
on app_users
for select
to authenticated
using (
  is_app_admin()
  or user_id = auth.uid()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy app_users_admin_insert
on app_users
for insert
to authenticated
with check (is_app_admin());

create policy app_users_admin_update
on app_users
for update
to authenticated
using (is_app_admin())
with check (is_app_admin());

create policy app_users_admin_delete
on app_users
for delete
to authenticated
using (is_app_admin());

-- Primeiro admin. Alterar se for necessário.
insert into app_users (email, name, role, status)
values ('fredericoroldao@gmail.com', 'Frederico Roldao', 'admin', 'active')
on conflict (lower(email)) do update
set role = 'admin',
    status = 'active',
    updated_at = now();

-- Remover políticas antigas permissivas.
drop policy if exists "public can read people" on people;
drop policy if exists "public can read areas" on areas;
drop policy if exists "public can read functions" on functions;
drop policy if exists "public can read work_items" on work_items;
drop policy if exists "public can read area_people" on area_people;
drop policy if exists "public can read function_people" on function_people;
drop policy if exists "public can read work_item_people" on work_item_people;
drop policy if exists "public can read work_item_areas" on work_item_areas;
drop policy if exists "public can read work_item_dependencies" on work_item_dependencies;

drop policy if exists people_all_access on people;
drop policy if exists areas_all_access on areas;
drop policy if exists functions_all_access on functions;
drop policy if exists work_items_all_access on work_items;
drop policy if exists work_item_dependencies_all_access on work_item_dependencies;
drop policy if exists area_people_all_access on area_people;
drop policy if exists function_people_all_access on function_people;
drop policy if exists work_item_people_all_access on work_item_people;

alter table people enable row level security;
alter table areas enable row level security;
alter table functions enable row level security;
alter table work_items enable row level security;
alter table area_people enable row level security;
alter table function_people enable row level security;
alter table work_item_people enable row level security;
alter table work_item_areas enable row level security;
alter table work_item_dependencies enable row level security;

create policy people_app_read on people for select to authenticated using (is_app_user());
create policy areas_app_read on areas for select to authenticated using (is_app_user());
create policy functions_app_read on functions for select to authenticated using (is_app_user());
create policy work_items_app_read on work_items for select to authenticated using (is_app_user());
create policy area_people_app_read on area_people for select to authenticated using (is_app_user());
create policy function_people_app_read on function_people for select to authenticated using (is_app_user());
create policy work_item_people_app_read on work_item_people for select to authenticated using (is_app_user());
create policy work_item_areas_app_read on work_item_areas for select to authenticated using (is_app_user());
create policy work_item_dependencies_app_read on work_item_dependencies for select to authenticated using (is_app_user());

create policy people_admin_write on people for all to authenticated using (is_app_admin()) with check (is_app_admin());
create policy areas_admin_write on areas for all to authenticated using (is_app_admin()) with check (is_app_admin());
create policy functions_admin_write on functions for all to authenticated using (is_app_admin()) with check (is_app_admin());
create policy work_items_admin_write on work_items for all to authenticated using (is_app_admin()) with check (is_app_admin());
create policy area_people_admin_write on area_people for all to authenticated using (is_app_admin()) with check (is_app_admin());
create policy function_people_admin_write on function_people for all to authenticated using (is_app_admin()) with check (is_app_admin());
create policy work_item_people_admin_write on work_item_people for all to authenticated using (is_app_admin()) with check (is_app_admin());
create policy work_item_areas_admin_write on work_item_areas for all to authenticated using (is_app_admin()) with check (is_app_admin());
create policy work_item_dependencies_admin_write on work_item_dependencies for all to authenticated using (is_app_admin()) with check (is_app_admin());
