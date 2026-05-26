insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.email = 'fredericoroldao@gmail.com'
where a.name = 'Direção'
on conflict (area_id, person_id, assignment_role) do nothing;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.email = 'pessoa1@example.com'
where a.name = 'Operações'
on conflict (area_id, person_id, assignment_role) do nothing;

insert into area_people (area_id, person_id, assignment_role, is_primary)
select a.id, p.id, 'lead'::area_assignment_role, true
from areas a
join people p on p.email = 'pessoa2@example.com'
where a.name = 'Comunicação'
on conflict (area_id, person_id, assignment_role) do nothing;

insert into function_people (function_id, person_id, assignment_role, is_primary)
select f.id, p.id, 'owner'::assignment_role, true
from functions f
join people p on p.email = 'fredericoroldao@gmail.com'
where f.name = 'Definir prioridades estratégicas'
on conflict (function_id, person_id, assignment_role) do nothing;

insert into function_people (function_id, person_id, assignment_role, is_primary)
select f.id, p.id, 'owner'::assignment_role, true
from functions f
join people p on p.email = 'fredericoroldao@gmail.com'
where f.name = 'Tomar decisões estruturantes'
on conflict (function_id, person_id, assignment_role) do nothing;

insert into function_people (function_id, person_id, assignment_role, is_primary)
select f.id, p.id, 'owner'::assignment_role, true
from functions f
join people p on p.email = 'pessoa1@example.com'
where f.name = 'Acompanhar execução'
on conflict (function_id, person_id, assignment_role) do nothing;

insert into function_people (function_id, person_id, assignment_role, is_primary)
select f.id, p.id, 'owner'::assignment_role, true
from functions f
join people p on p.email = 'pessoa2@example.com'
where f.name = 'Planear campanhas'
on conflict (function_id, person_id, assignment_role) do nothing;
