-- Executar no SQL Editor do Supabase.
-- Impede que o ultimo superadmin ativo seja apagado, desativado ou despromovido.

create or replace function prevent_losing_last_superadmin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_superadmins integer;
  is_losing_superadmin boolean;
begin
  if old.role <> 'superadmin' or old.status = 'disabled' then
    return coalesce(new, old);
  end if;

  is_losing_superadmin :=
    tg_op = 'DELETE'
    or new.role <> 'superadmin'
    or new.status = 'disabled';

  if not is_losing_superadmin then
    return new;
  end if;

  select count(*)
    into remaining_superadmins
  from app_users
  where id <> old.id
    and role = 'superadmin'
    and status <> 'disabled';

  if remaining_superadmins = 0 then
    raise exception 'Nao e permitido remover, desativar ou despromover o ultimo superadmin ativo.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_prevent_losing_last_superadmin on app_users;

create trigger trg_prevent_losing_last_superadmin
before update or delete on app_users
for each row
execute function prevent_losing_last_superadmin();
