delete from work_items
where id in (
  select id
  from work_items
  where name = 'Campanha de associados Q3'
    and type = 'project'
);

insert into work_items (
  parent_work_item_id,
  type,
  name,
  description,
  status,
  phase,
  priority,
  sort_order
)
values (
  null,
  'project'::work_item_type,
  'Campanha de associados Q3',
  'Projeto de teste para dependências',
  'not_started'::work_item_status,
  'planning'::work_item_phase,
  'high'::priority_level,
  1
);

insert into work_items (
  parent_work_item_id,
  type,
  name,
  status,
  phase,
  priority,
  sort_order
)
select
  p.id,
  'task'::work_item_type,
  v.name,
  'not_started'::work_item_status,
  'planning'::work_item_phase,
  'medium'::priority_level,
  v.sort_order
from work_items p
join (
  values
    ('Definir mensagem principal', 1),
    ('Criar landing page', 2),
    ('Preparar newsletter', 3),
    ('Aprovar campanha', 4),
    ('Publicar posts', 5)
) as v(name, sort_order) on true
where p.name = 'Campanha de associados Q3'
  and p.type = 'project';

insert into work_items (
  parent_work_item_id,
  type,
  name,
  status,
  phase,
  priority,
  sort_order
)
select
  t.id,
  'subtask'::work_item_type,
  'Rever copy',
  'not_started'::work_item_status,
  'planning'::work_item_phase,
  'medium'::priority_level,
  1
from work_items t
join work_items p on p.id = t.parent_work_item_id
where p.name = 'Campanha de associados Q3'
  and p.type = 'project'
  and t.name = 'Definir mensagem principal'
  and t.type = 'task';

insert into work_item_dependencies (
  predecessor_work_item_id,
  successor_work_item_id,
  dependency_type,
  lag_days,
  notes
)
select
  origin.id,
  destination.id,
  v.dependency_type::dependency_type,
  v.lag_days,
  null
from (
  values
    ('Definir mensagem principal', 'Criar landing page', 'finish_to_start', 0),
    ('Definir mensagem principal', 'Preparar newsletter', 'finish_to_start', 0),
    ('Criar landing page', 'Publicar posts', 'finish_to_start', 1),
    ('Aprovar campanha', 'Publicar posts', 'blocks', 0),
    ('Preparar newsletter', 'Publicar posts', 'related_to', 0)
) as v(origin_name, destination_name, dependency_type, lag_days)
join work_items project
  on project.name = 'Campanha de associados Q3'
 and project.type = 'project'
join work_items origin
  on origin.parent_work_item_id = project.id
 and origin.name = v.origin_name
join work_items destination
  on destination.parent_work_item_id = project.id
 and destination.name = v.destination_name;

insert into work_item_dependencies (
  predecessor_work_item_id,
  successor_work_item_id,
  dependency_type,
  lag_days,
  notes
)
select
  subtask.id,
  destination.id,
  'finish_to_start'::dependency_type,
  0,
  null
from work_items project
join work_items parent_task
  on parent_task.parent_work_item_id = project.id
 and parent_task.name = 'Definir mensagem principal'
 and parent_task.type = 'task'
join work_items subtask
  on subtask.parent_work_item_id = parent_task.id
 and subtask.name = 'Rever copy'
 and subtask.type = 'subtask'
join work_items destination
  on destination.parent_work_item_id = project.id
 and destination.name = 'Aprovar campanha'
 and destination.type = 'task'
where project.name = 'Campanha de associados Q3'
  and project.type = 'project';
