-- Executar no SQL Editor do Supabase.
-- Liga o utilizador autenticado ao registo app_users criado por convite.

create or replace function claim_app_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
begin
  user_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if auth.uid() is null or user_email = '' then
    return;
  end if;

  update app_users
  set user_id = auth.uid(),
      status = case when status = 'disabled' then status else 'active' end,
      updated_at = now()
  where lower(email) = user_email
    and status <> 'disabled'
    and (user_id is null or user_id = auth.uid());
end;
$$;

grant execute on function claim_app_user() to authenticated;
