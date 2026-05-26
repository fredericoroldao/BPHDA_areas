-- Executar no SQL Editor do Supabase.
-- Adiciona role superadmin, esconde superadmins de admins normais,
-- e permite que apenas superadmins criem/alterem/apaguem superadmins.

alter table app_users
  drop constraint if exists app_users_role_check;

alter table app_users
  add constraint app_users_role_check
  check (role in ('superadmin', 'admin', 'viewer'));

create or replace function is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_app_user_role() in ('superadmin', 'admin')
$$;

create or replace function is_app_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_app_user_role() = 'superadmin'
$$;

drop policy if exists app_users_select_own_or_admin on app_users;
drop policy if exists app_users_admin_insert on app_users;
drop policy if exists app_users_admin_update on app_users;
drop policy if exists app_users_admin_delete on app_users;

create policy app_users_select_own_or_admin
on app_users
for select
to authenticated
using (
  is_app_superadmin()
  or user_id = auth.uid()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or (is_app_admin() and role <> 'superadmin')
);

create policy app_users_admin_insert
on app_users
for insert
to authenticated
with check (
  is_app_superadmin()
  or (is_app_admin() and role <> 'superadmin')
);

create policy app_users_admin_update
on app_users
for update
to authenticated
using (
  is_app_superadmin()
  or (is_app_admin() and role <> 'superadmin')
)
with check (
  is_app_superadmin()
  or (is_app_admin() and role <> 'superadmin')
);

create policy app_users_admin_delete
on app_users
for delete
to authenticated
using (
  is_app_superadmin()
  or (is_app_admin() and role <> 'superadmin')
);

-- Primeiro superadmin. Alterar se for necessário.
update app_users
set role = 'superadmin',
    status = 'active',
    updated_at = now()
where lower(email) = 'fredericoroldao@gmail.com';
