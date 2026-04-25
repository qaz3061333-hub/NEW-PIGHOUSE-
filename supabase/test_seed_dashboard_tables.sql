-- Appointment Requests
insert into public.appointment_requests (pet_name, service, owner_name, requested_at, status)
values
  ('Momo', 'Pet grooming', 'Customer Wang', now() - interval '15 minutes', 'pending'),
  ('Lucky', 'Boarding 2 nights', 'Customer Chen', now() - interval '45 minutes', 'proposed_new_time'),
  ('Coco', 'Spa and trim', 'Customer Lin', now() - interval '2 hours', 'confirmed');

-- Abnormal Alerts
insert into public.abnormal_alerts (severity, title, triggered_at, summary, is_resolved)
values
  ('high', 'Booking spike', now() - interval '10 minutes', '12 new appointment requests in 10 minutes', false),
  ('medium', 'Repeated questions increasing', now() - interval '30 minutes', '8 similar questions within 30 minutes', false),
  ('low', 'Reply delay', now() - interval '1 hour', 'Average reply time is above 5 minutes', true);

-- Manual Reply Tasks
insert into public.manual_reply_tasks (customer, topic, waiting_minutes, priority, is_replied)
values
  ('Customer Lee', 'Senior dog boarding with heart disease', 22, 'urgent', false),
  ('Customer Chou', 'Preferred groomer time slot', 12, 'normal', false),
  ('Customer Chang', 'Cancellation policy exception request', 35, 'urgent', true);
