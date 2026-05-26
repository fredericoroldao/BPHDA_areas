insert into people (name, email, role_title)
values
  ('Frederico Roldão', 'fredericoroldao@gmail.com', 'Direção'),
  ('Pessoa Exemplo 1', 'pessoa1@example.com', 'Coordenação'),
  ('Pessoa Exemplo 2', 'pessoa2@example.com', 'Operacional')
on conflict (email) do nothing;

insert into areas (name, description, sort_order)
values
  ('Direção', 'Direção e decisões estruturantes', 1),
  ('Operações', 'Execução e acompanhamento operacional', 2),
  ('Comunicação', 'Campanhas, conteúdos e divulgação', 3)
on conflict (name) do nothing;

insert into functions (area_id, parent_function_id, name, description, level, sort_order, status)
select a.id, null, x.name, x.description, 1, x.sort_order, 'active'::generic_status
from (
  values
    ('Direção', 'Definir prioridades estratégicas', 'Definir prioridades e orientação geral', 1),
    ('Direção', 'Tomar decisões estruturantes', 'Tomar decisões de direção', 2),
    ('Operações', 'Acompanhar execução', 'Acompanhar tarefas e projetos em curso', 1),
    ('Comunicação', 'Planear campanhas', 'Definir campanhas, canais e calendário', 1)
) as x(area_name, name, description, sort_order)
join areas a on a.name = x.area_name
on conflict (area_id, parent_function_id, name) do nothing;
