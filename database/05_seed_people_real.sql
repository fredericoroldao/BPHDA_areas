insert into people (name)
select v.name
from (
  values
    ('Anaile'),
    ('Bárbara'),
    ('Frederico'),
    ('Gonçalo Silva'),
    ('IfT'),
    ('Jorge Magalhães Vieira'),
    ('Maria'),
    ('Maria Moura'),
    ('Ricardo'),
    ('Tiago Justo'),
    ('Voluntário Admin'),
    ('Voluntário Associados'),
    ('Voluntário Científico'),
    ('Voluntário Comunidade Whatsapp'),
    ('Voluntário Financeiro'),
    ('Voluntário Formação'),
    ('Voluntário Fundraising'),
    ('Voluntário Legal'),
    ('Voluntário Marketing'),
    ('Voluntário RH'),
    ('Voluntário RP')
) as v(name)
where not exists (
  select 1
  from people p
  where p.name = v.name
);
