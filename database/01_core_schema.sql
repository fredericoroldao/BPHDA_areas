create extension if not exists pgcrypto;

create type person_status as enum ('active', 'inactive');
create type generic_status as enum ('active', 'inactive', 'archived');
create type work_item_type as enum ('project', 'task', 'subtask', 'milestone');
create type work_item_status as enum ('not_started', 'in_progress', 'blocked', 'done', 'cancelled');
create type work_item_phase as enum ('planning', 'execution', 'review', 'completed');
create type priority_level as enum ('low', 'medium', 'high', 'critical');
create type assignment_role as enum ('owner', 'co_owner', 'assignee', 'contributor', 'approver', 'reviewer', 'informed', 'watcher');
create type area_assignment_role as enum ('lead', 'co_lead', 'support', 'informed');
create type relationship_type_area as enum ('owned_by', 'supports', 'impacts');
create type dependency_type as enum ('finish_to_start', 'start_to_start', 'finish_to_finish', 'blocks', 'related_to');

create table people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  phone text,
  role_title text,
  status person_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  parent_area_id uuid references areas(id) on delete set null,
  status generic_status not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table functions (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references areas(id) on delete cascade,
  parent_function_id uuid references functions(id) on delete cascade,
  name text not null,
  description text,
  level integer not null default 1,
  sort_order integer not null default 0,
  status generic_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint functions_unique_name_per_parent unique (area_id, parent_function_id, name)
);

create table work_items (
  id uuid primary key default gen_random_uuid(),
  parent_work_item_id uuid references work_items(id) on delete cascade,
  type work_item_type not null,
  name text not null,
  description text,
  status work_item_status not null default 'not_started',
  phase work_item_phase not null default 'planning',
  priority priority_level not null default 'medium',
  start_date date,
  due_date date,
  end_date date,
  estimated_hours numeric(10,2),
  actual_hours numeric(10,2),
  planned_budget numeric(14,2),
  actual_budget numeric(14,2),
  currency_code char(3) default 'EUR',
  progress_percent numeric(5,2) default 0 check (progress_percent >= 0 and progress_percent <= 100),
  owner_person_id uuid references people(id) on delete set null,
  created_by_person_id uuid references people(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table area_people (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references areas(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  assignment_role area_assignment_role not null default 'lead',
  is_primary boolean not null default false,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint area_people_unique unique (area_id, person_id, assignment_role)
);

create table function_people (
  id uuid primary key default gen_random_uuid(),
  function_id uuid not null references functions(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  assignment_role assignment_role not null default 'owner',
  is_primary boolean not null default false,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint function_people_unique unique (function_id, person_id, assignment_role)
);

create table work_item_people (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references work_items(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  assignment_role assignment_role not null default 'assignee',
  allocation_percent numeric(5,2),
  is_primary boolean not null default false,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_item_people_unique unique (work_item_id, person_id, assignment_role)
);

create table work_item_areas (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references work_items(id) on delete cascade,
  area_id uuid not null references areas(id) on delete cascade,
  relationship_type relationship_type_area not null default 'owned_by',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_item_areas_unique unique (work_item_id, area_id, relationship_type)
);

create table work_item_dependencies (
  id uuid primary key default gen_random_uuid(),
  predecessor_work_item_id uuid not null references work_items(id) on delete cascade,
  successor_work_item_id uuid not null references work_items(id) on delete cascade,
  dependency_type dependency_type not null default 'finish_to_start',
  lag_days integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_item_dependencies_no_self check (predecessor_work_item_id <> successor_work_item_id),
  constraint work_item_dependencies_unique unique (predecessor_work_item_id, successor_work_item_id, dependency_type)
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_people_updated_at before update on people for each row execute function set_updated_at();
create trigger trg_areas_updated_at before update on areas for each row execute function set_updated_at();
create trigger trg_functions_updated_at before update on functions for each row execute function set_updated_at();
create trigger trg_work_items_updated_at before update on work_items for each row execute function set_updated_at();
create trigger trg_area_people_updated_at before update on area_people for each row execute function set_updated_at();
create trigger trg_function_people_updated_at before update on function_people for each row execute function set_updated_at();
create trigger trg_work_item_people_updated_at before update on work_item_people for each row execute function set_updated_at();
create trigger trg_work_item_areas_updated_at before update on work_item_areas for each row execute function set_updated_at();
create trigger trg_work_item_dependencies_updated_at before update on work_item_dependencies for each row execute function set_updated_at();

create index idx_functions_area on functions(area_id);
create index idx_functions_parent on functions(parent_function_id);
create index idx_work_items_parent on work_items(parent_work_item_id);
create index idx_work_items_type on work_items(type);
create index idx_work_items_status on work_items(status);
create index idx_work_items_owner on work_items(owner_person_id);
create index idx_work_items_due_date on work_items(due_date);
create index idx_area_people_area on area_people(area_id);
create index idx_area_people_person on area_people(person_id);
create index idx_function_people_function on function_people(function_id);
create index idx_function_people_person on function_people(person_id);
create index idx_work_item_people_work_item on work_item_people(work_item_id);
create index idx_work_item_people_person on work_item_people(person_id);
create index idx_work_item_areas_work_item on work_item_areas(work_item_id);
create index idx_work_item_areas_area on work_item_areas(area_id);
create index idx_work_item_dependencies_predecessor on work_item_dependencies(predecessor_work_item_id);
create index idx_work_item_dependencies_successor on work_item_dependencies(successor_work_item_id);
