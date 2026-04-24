create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  line_user_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel text not null default 'dashboard',
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  content text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  pet_name text not null,
  service text not null,
  owner_name text not null,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'proposed_new_time', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.abnormal_alerts (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('low', 'medium', 'high')),
  title text not null,
  triggered_at timestamptz not null default now(),
  summary text not null,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.manual_reply_tasks (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  topic text not null,
  waiting_minutes integer not null default 0,
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  is_replied boolean not null default false,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.messages enable row level security;
alter table public.knowledge_articles enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.abnormal_alerts enable row level security;
alter table public.manual_reply_tasks enable row level security;

create policy "Allow anon full access customers" on public.customers for all using (true) with check (true);
create policy "Allow anon full access messages" on public.messages for all using (true) with check (true);
create policy "Allow anon full access knowledge_articles" on public.knowledge_articles for all using (true) with check (true);
create policy "Allow anon full access appointment_requests" on public.appointment_requests for all using (true) with check (true);
create policy "Allow anon full access abnormal_alerts" on public.abnormal_alerts for all using (true) with check (true);
create policy "Allow anon full access manual_reply_tasks" on public.manual_reply_tasks for all using (true) with check (true);
