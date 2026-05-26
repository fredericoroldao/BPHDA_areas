delete from area_people
where area_id in (
  select id from areas
  where name in ('Direção', 'Operações', 'Comunicação')
);

delete from functions
where area_id in (
  select id from areas
  where name in ('Direção', 'Operações', 'Comunicação')
);

delete from areas
where name in ('Direção', 'Operações', 'Comunicação');

delete from people
where name in ('Pessoa Exemplo 1', 'Pessoa Exemplo 2', 'Frederico Roldão');

insert into areas (name, description, sort_order)
values
  ('DIREÇÃO', null, 1),
  ('COORDENAÇÃO', null, 2),
  ('ASSOCIADOS', null, 3),
  ('CIENTÍFICO', null, 4),
  ('COMUNICAÇÃO E MARKETING', null, 5),
  ('COMUNIDADE WHATSAPP', null, 6),
  ('FINANCEIRO', null, 7),
  ('FORMAÇÃO', null, 8),
  ('FUNDRAISING', null, 9),
  ('IT', null, 10),
  ('LEGAL', null, 11),
  ('PESSOAS E TALENTO', null, 12),
  ('RELAÇÕES INSTITUCIONAIS', null, 13),
  ('RP', null, 14)
on conflict (name) do update
set sort_order = excluded.sort_order;

delete from area_people
where area_id = (
  select id from areas where name = 'DIREÇÃO'
);

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'Jorge Magalhães Vieira'
where a.name = 'COORDENAÇÃO'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'Ricardo'
where a.name = 'ASSOCIADOS'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'Bárbara'
where a.name = 'CIENTÍFICO'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'IfT'
where a.name = 'COMUNICAÇÃO E MARKETING'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'Anaile'
where a.name = 'COMUNIDADE WHATSAPP'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'Anaile'
where a.name = 'FINANCEIRO'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'Bárbara'
where a.name = 'FORMAÇÃO'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'Frederico'
where a.name = 'FUNDRAISING'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'Frederico'
where a.name = 'IT'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'Maria'
where a.name = 'LEGAL'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'Anaile'
where a.name = 'PESSOAS E TALENTO'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'Frederico'
where a.name = 'RELAÇÕES INSTITUCIONAIS'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.name = 'Frederico'
where a.name = 'RP'
on conflict (area_id, person_id, assignment_role) do update
set is_primary = excluded.is_primary;
