alter table public.appointment_requests
add column if not exists is_sandbox boolean not null default false;

create index if not exists idx_appointment_requests_is_sandbox_requested_at
on public.appointment_requests (is_sandbox, requested_at desc);
