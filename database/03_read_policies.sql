alter table people enable row level security;
alter table areas enable row level security;
alter table functions enable row level security;
alter table work_items enable row level security;
alter table area_people enable row level security;
alter table function_people enable row level security;
alter table work_item_people enable row level security;
alter table work_item_areas enable row level security;
alter table work_item_dependencies enable row level security;

create policy "public can read people"
on people
for select
to anon
using (true);

create policy "public can read areas"
on areas
for select
to anon
using (true);

create policy "public can read functions"
on functions
for select
to anon
using (true);

create policy "public can read work_items"
on work_items
for select
to anon
using (true);

create policy "public can read area_people"
on area_people
for select
to anon
using (true);

create policy "public can read function_people"
on function_people
for select
to anon
using (true);

create policy "public can read work_item_people"
on work_item_people
for select
to anon
using (true);

create policy "public can read work_item_areas"
on work_item_areas
for select
to anon
using (true);

create policy "public can read work_item_dependencies"
on work_item_dependencies
for select
to anon
using (true);
