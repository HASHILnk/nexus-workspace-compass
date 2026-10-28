-- Roles
create type public.app_role as enum ('admin', 'manager', 'member');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  role public.app_role not null default 'member'
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_manager(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','manager'))
$$;

create policy "Team can see roles" on public.user_roles for select to authenticated using (true);
create policy "Admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Members
create table public.members (
  id text primary key default ('u-' || substr(md5(random()::text), 1, 8)),
  user_id uuid unique,
  email text,
  name text not null,
  role text not null default 'Team Member',
  initials text not null default '?',
  color text not null default 'primary',
  availability text not null default 'available' check (availability in ('available','busy','away')),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.members to authenticated;
grant all on public.members to service_role;
alter table public.members enable row level security;

create or replace function public.current_member_id()
returns text language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid() limit 1
$$;

create policy "Team can see members" on public.members for select to authenticated using (true);
create policy "Self or admin update member" on public.members for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admins add members" on public.members for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins remove members" on public.members for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Projects
create table public.projects (
  id text primary key default ('p-' || substr(md5(random()::text), 1, 8)),
  name text not null,
  description text not null default '',
  owner_id text references public.members(id) on delete set null,
  member_ids text[] not null default '{}',
  status text not null default 'planning' check (status in ('planning','in_progress','completed','at_risk')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  start_date date not null default current_date,
  deadline date not null default (current_date + 30),
  color text not null default 'primary',
  milestones jsonb not null default '[]',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "Team can see projects" on public.projects for select to authenticated using (true);
create policy "Managers create projects" on public.projects for insert to authenticated with check (public.is_manager(auth.uid()));
create policy "Managers update projects" on public.projects for update to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));
create policy "Managers delete projects" on public.projects for delete to authenticated using (public.is_manager(auth.uid()));

-- Tasks
create table public.tasks (
  id text primary key default ('t-' || substr(md5(random()::text), 1, 8)),
  title text not null,
  description text not null default '',
  project_id text not null references public.projects(id) on delete cascade,
  assignee_id text references public.members(id) on delete set null,
  reporter_id text,
  status text not null default 'todo' check (status in ('backlog','todo','in_progress','in_review','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  start_date date not null default current_date,
  due_date date not null default current_date,
  labels text[] not null default '{}',
  subtasks jsonb not null default '[]',
  depends_on text[] not null default '{}',
  comments jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_assignee_idx on public.tasks(assignee_id);
create index tasks_project_idx on public.tasks(project_id);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;
create policy "Team can see tasks" on public.tasks for select to authenticated using (true);
create policy "Managers or self create tasks" on public.tasks for insert to authenticated
  with check (public.is_manager(auth.uid()) or assignee_id is null or assignee_id = public.current_member_id());
create policy "Managers or involved update tasks" on public.tasks for update to authenticated
  using (public.is_manager(auth.uid()) or assignee_id = public.current_member_id() or reporter_id = public.current_member_id())
  with check (public.is_manager(auth.uid()) or assignee_id = public.current_member_id() or reporter_id = public.current_member_id() or assignee_id is null);
create policy "Managers delete tasks" on public.tasks for delete to authenticated using (public.is_manager(auth.uid()));

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

-- Activity feed
create table public.activity (
  id text primary key default ('a-' || substr(md5(random()::text), 1, 10)),
  actor_id text not null,
  on_behalf_of text,
  text text not null,
  project_id text,
  created_at timestamptz not null default now()
);
grant select, insert on public.activity to authenticated;
grant all on public.activity to service_role;
alter table public.activity enable row level security;
create policy "Team can see activity" on public.activity for select to authenticated using (true);
create policy "Log own or AI-on-behalf activity" on public.activity for insert to authenticated
  with check (actor_id = public.current_member_id() or (actor_id = 'ai' and on_behalf_of = public.current_member_id()));

-- Notifications
create table public.notifications (
  id text primary key default ('n-' || substr(md5(random()::text), 1, 10)),
  kind text not null default 'project',
  text text not null,
  recipient_id text,
  project_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "See shared or own notifications" on public.notifications for select to authenticated
  using (recipient_id is null or recipient_id = public.current_member_id());
create policy "Mark shared or own notifications" on public.notifications for update to authenticated
  using (recipient_id is null or recipient_id = public.current_member_id())
  with check (recipient_id is null or recipient_id = public.current_member_id());
create policy "Managers notify others" on public.notifications for insert to authenticated
  with check (public.is_manager(auth.uid()) or recipient_id = public.current_member_id());

-- Docs
create table public.docs (
  id text primary key default ('doc-' || substr(md5(random()::text), 1, 8)),
  title text not null,
  project_id text references public.projects(id) on delete cascade,
  author_id text,
  updated_at timestamptz not null default now()
);
grant select on public.docs to authenticated;
grant all on public.docs to service_role;
alter table public.docs enable row level security;
create policy "Team can see docs" on public.docs for select to authenticated using (true);

-- AI chat threads (private per user)
create table public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ai_threads to authenticated;
grant all on public.ai_threads to service_role;
alter table public.ai_threads enable row level security;
create policy "Own threads" on public.ai_threads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  ui_id text not null,
  message jsonb not null,
  created_at timestamptz not null default now(),
  unique (thread_id, ui_id)
);
grant select, insert, update, delete on public.ai_messages to authenticated;
grant all on public.ai_messages to service_role;
alter table public.ai_messages enable row level security;
create policy "Own messages" on public.ai_messages for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Audit trail of AI actions and proposals
create table public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  member_id text,
  thread_id uuid,
  tool text not null,
  status text not null check (status in ('executed','failed','pending','applied','rejected')),
  summary text not null default '',
  input jsonb not null default '{}',
  result jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
grant select, insert, update on public.ai_actions to authenticated;
grant all on public.ai_actions to service_role;
alter table public.ai_actions enable row level security;
create policy "See own or admin sees all AI actions" on public.ai_actions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Record own AI actions" on public.ai_actions for insert to authenticated with check (user_id = auth.uid());
create policy "Resolve own AI actions" on public.ai_actions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Sign-ups get a team member row; the very first person becomes admin
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _name text := coalesce(nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), split_part(new.email, '@', 1));
begin
  insert into public.members (id, user_id, email, name, initials, role, color)
  values ('u-' || substr(replace(new.id::text, '-', ''), 1, 10), new.id, new.email, _name,
          upper(left(_name, 1) || coalesce(left(split_part(_name, ' ', 2), 1), '')), 'Team Member', 'primary')
  on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, case when exists (select 1 from public.user_roles where role = 'admin') then 'member'::public.app_role else 'admin'::public.app_role end)
  on conflict (user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter publication supabase_realtime add table public.members, public.projects, public.tasks, public.activity, public.notifications, public.user_roles;

-- Starter workspace data
insert into public.members (id,name,role,initials,color,availability) values
('u-alex','Alex Morgan','Product Lead','AM','primary','available'),
('u-sarah','Sarah Chen','Product Designer','SC','chart-2','busy'),
('u-michael','Michael Brooks','Backend Engineer','MB','chart-1','available'),
('u-priya','Priya Patel','Frontend Engineer','PP','chart-4','available'),
('u-diego','Diego Alvarez','Mobile Engineer','DA','chart-3','away'),
('u-emma','Emma Wilson','Marketing Manager','EW','chart-5','busy');

insert into public.projects (id,name,description,owner_id,member_ids,status,priority,start_date,deadline,color,milestones) values
('p-web','Website Redesign','Refresh the marketing site with the new brand system and faster pages.','u-sarah',array['u-sarah','u-priya','u-alex'],'in_progress','high',current_date-40,current_date+14,'primary',
  jsonb_build_array(jsonb_build_object('id','m1','title','Design sign-off','date',(current_date-10)::text,'done',true),jsonb_build_object('id','m2','title','Beta launch','date',(current_date+5)::text,'done',false),jsonb_build_object('id','m3','title','Public launch','date',(current_date+14)::text,'done',false))),
('p-ai','AI Platform','Internal platform for model serving, evaluation and prompt management.','u-michael',array['u-michael','u-priya','u-alex'],'at_risk','urgent',current_date-30,current_date+21,'chart-1',
  jsonb_build_array(jsonb_build_object('id','m4','title','Inference API alpha','date',(current_date-2)::text,'done',false),jsonb_build_object('id','m5','title','Eval dashboard','date',(current_date+12)::text,'done',false))),
('p-mobile','Mobile App','Native iOS and Android app for on-the-go task management.','u-diego',array['u-diego','u-sarah','u-michael'],'in_progress','high',current_date-20,current_date+35,'chart-3',
  jsonb_build_array(jsonb_build_object('id','m6','title','Clickable prototype','date',(current_date-4)::text,'done',true),jsonb_build_object('id','m7','title','TestFlight build','date',(current_date+18)::text,'done',false))),
('p-mkt','Marketing Campaign','Q4 launch campaign across email, social and paid channels.','u-emma',array['u-emma','u-sarah'],'in_progress','medium',current_date-25,current_date+6,'chart-5',
  jsonb_build_array(jsonb_build_object('id','m8','title','Creative approved','date',(current_date-6)::text,'done',true),jsonb_build_object('id','m9','title','Campaign live','date',(current_date+6)::text,'done',false))),
('p-api','Backend API','Versioned public API with rate limiting and webhooks.','u-michael',array['u-michael','u-alex'],'planning','medium',current_date+3,current_date+60,'chart-2',
  jsonb_build_array(jsonb_build_object('id','m10','title','API spec review','date',(current_date+10)::text,'done',false)));

insert into public.tasks (id,title,description,project_id,assignee_id,reporter_id,status,priority,start_date,due_date,labels,created_at)
select v.id, v.title, v.title || ' for the ' || p.name || ' project.', v.pid, v.aid, 'u-alex', v.st, v.pr, current_date + v.s, current_date + v.d, v.labels, now() - make_interval(hours => 200 - v.n)
from (values
 (1,'t-1','Finalize homepage design','p-web','u-sarah','in_review','high',-8,1,array['design']),
 (2,'t-2','Fix responsive navigation','p-web','u-priya','in_progress','urgent',-3,-1,array['bug']),
 (3,'t-3','Write new pricing page copy','p-web','u-alex','done','medium',-14,-5,array[]::text[]),
 (4,'t-4','Migrate blog to new CMS','p-web','u-priya','done','medium',-20,-9,array[]::text[]),
 (5,'t-5','Set up analytics events','p-web','u-priya','done','low',-12,-6,array[]::text[]),
 (6,'t-6','Accessibility audit','p-web','u-sarah','done','high',-10,-3,array[]::text[]),
 (7,'t-7','Performance budget & Lighthouse pass','p-web','u-priya','done','medium',-9,-2,array[]::text[]),
 (8,'t-8','Launch checklist','p-web','u-alex','todo','medium',0,12,array[]::text[]),
 (9,'t-9','Implement authentication API','p-ai','u-michael','in_progress','urgent',-10,-2,array['backend']),
 (10,'t-10','Model registry schema','p-ai','u-michael','done','high',-25,-15,array[]::text[]),
 (11,'t-11','Prompt versioning UI','p-ai','u-priya','todo','high',-2,4,array[]::text[]),
 (12,'t-12','GPU autoscaling policy','p-ai','u-michael','backlog','medium',2,15,array[]::text[]),
 (13,'t-13','Eval harness MVP','p-ai','u-alex','in_progress','high',-6,-1,array[]::text[]),
 (14,'t-14','Usage metering','p-ai','u-michael','done','medium',-20,-10,array[]::text[]),
 (15,'t-15','Review onboarding flow','p-mobile','u-alex','todo','high',-1,2,array['ux']),
 (16,'t-16','Push notifications service','p-mobile','u-michael','in_progress','medium',-5,6,array[]::text[]),
 (17,'t-17','Offline sync prototype','p-mobile','u-diego','backlog','high',3,20,array[]::text[]),
 (18,'t-18','Design system for mobile','p-mobile','u-sarah','done','medium',-18,-8,array[]::text[]),
 (19,'t-19','App store listing assets','p-mobile','u-sarah','todo','low',5,25,array[]::text[]),
 (20,'t-20','Crash reporting setup','p-mobile','u-diego','done','low',-12,-7,array[]::text[]),
 (21,'t-21','Email nurture sequence','p-mkt','u-emma','done','high',-20,-8,array[]::text[]),
 (22,'t-22','Social launch calendar','p-mkt','u-emma','done','medium',-15,-6,array[]::text[]),
 (23,'t-23','Paid ads creative','p-mkt','u-sarah','done','high',-12,-4,array[]::text[]),
 (24,'t-24','Landing page A/B test','p-mkt','u-emma','in_progress','medium',-3,3,array[]::text[]),
 (25,'t-25','Prepare sprint retrospective','p-mkt','u-alex','todo','low',0,1,array[]::text[]),
 (26,'t-26','Influencer outreach list','p-mkt','u-emma','done','low',-18,-10,array[]::text[]),
 (27,'t-27','Draft API style guide','p-api','u-michael','todo','medium',3,9,array[]::text[]),
 (28,'t-28','Rate limiting design doc','p-api','u-alex','backlog','high',5,14,array[]::text[])
) as v(n,id,title,pid,aid,st,pr,s,d,labels)
join public.projects p on p.id = v.pid;

update public.tasks set subtasks = '[{"id":"st-a","title":"Draft","done":true},{"id":"st-b","title":"Review","done":false}]'::jsonb where id in ('t-1','t-13','t-16','t-19','t-25');
update public.tasks set subtasks = '[{"id":"st-a","title":"Draft","done":true},{"id":"st-b","title":"Review","done":true}]'::jsonb where id in ('t-4','t-7','t-10','t-22');
update public.tasks set depends_on = array['t-1'] where id = 't-2';
update public.tasks set depends_on = array['t-10'] where id = 't-13';
update public.tasks set comments = jsonb_build_array(jsonb_build_object('id','c1','authorId','u-michael','body','Token refresh is blocked on the gateway config. @Alex can you unblock?','createdAt',(now() - interval '3 hours')::text)) where id = 't-9';

insert into public.activity (id,actor_id,text,project_id,created_at) values
('a1','u-sarah','completed “Accessibility audit”','p-web',now() - interval '30 minutes'),
('a2','u-michael','commented on “Implement authentication API”','p-ai',now() - interval '3 hours'),
('a3','u-alex','added “Launch checklist” to Website Redesign','p-web',now() - interval '5 hours'),
('a5','u-diego','moved “Offline sync prototype” to Backlog','p-mobile',now() - interval '26 hours');

insert into public.notifications (id,kind,text,created_at,read,project_id) values
('n2','deadline','“Fix responsive navigation” is overdue',now() - interval '6 hours',false,'p-web'),
('n4','project','AI Platform was marked At Risk',now() - interval '30 hours',true,'p-ai'),
('n5','comment','Sarah commented on “Finalize homepage design”',now() - interval '50 hours',true,'p-web');

insert into public.docs (id,title,project_id,updated_at,author_id) values
('doc1','Brand guidelines v2','p-web',now() - interval '10 hours','u-sarah'),
('doc2','Inference API RFC','p-ai',now() - interval '30 hours','u-michael'),
('doc3','Mobile launch brief','p-mobile',now() - interval '60 hours','u-diego'),
('doc4','Q4 campaign plan','p-mkt',now() - interval '80 hours','u-emma');