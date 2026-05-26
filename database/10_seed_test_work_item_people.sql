delete from work_item_people
where work_item_id in (
  select wi.id
  from work_items wi
  left join work_items parent on parent.id = wi.parent_work_item_id
  where wi.name = 'Campanha de associados Q3'
     or parent.name = 'Campanha de associados Q3'
);

insert into work_item_people (
  work_item_id,
  person_id,
  assignment_role,
  is_primary
)
select
  project.id,
  person.id,
  v.assignment_role::assignment_role,
  v.is_primary
from (
  values
    ('Frederico', 'owner', true),
    ('IfT', 'contributor', false),
    ('Tiago Justo', 'contributor', false)
) as v(person_name, assignment_role, is_primary)
join work_items project
  on project.name = 'Campanha de associados Q3'
 and project.type = 'project'
join people person
  on person.name = v.person_name;

insert into work_item_people (
  work_item_id,
  person_id,
  assignment_role,
  is_primary
)
select
  task.id,
  person.id,
  v.assignment_role::assignment_role,
  v.is_primary
from (
  values
    ('Definir mensagem principal', 'IfT', 'owner', true),
    ('Criar landing page', 'Tiago Justo', 'assignee', true),
    ('Preparar newsletter', 'Voluntário Marketing', 'owner', true),
    ('Aprovar campanha', 'Frederico', 'approver', true),
    ('Publicar posts', 'Voluntário Marketing', 'assignee', true)
) as v(task_name, person_name, assignment_role, is_primary)
join work_items project
  on project.name = 'Campanha de associados Q3'
 and project.type = 'project'
join work_items task
  on task.parent_work_item_id = project.id
 and task.name = v.task_name
join people person
  on person.name = v.person_name;

insert into work_item_people (
  work_item_id,
  person_id,
  assignment_role,
  is_primary
)
select
  subtask.id,
  person.id,
  'reviewer'::assignment_role,
  true
from work_items project
join work_items parent_task
  on parent_task.parent_work_item_id = project.id
 and parent_task.name = 'Definir mensagem principal'
 and parent_task.type = 'task'
join work_items subtask
  on subtask.parent_work_item_id = parent_task.id
 and subtask.name = 'Rever copy'
 and subtask.type = 'subtask'
join people person
  on person.name = 'Bárbara'
where project.name = 'Campanha de associados Q3'
  and project.type = 'project';
