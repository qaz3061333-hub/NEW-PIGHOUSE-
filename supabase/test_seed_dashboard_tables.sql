-- Appointment Requests
insert into public.appointment_requests (pet_name, service, owner_name, requested_at, status)
values
  ('Momo', '寵物美容', '王小姐', now() - interval '15 minutes', 'pending'),
  ('Lucky', '住宿 2 晚', '陳先生', now() - interval '45 minutes', 'proposed_new_time'),
  ('Coco', 'Spa + 修毛', '林小姐', now() - interval '2 hours', 'confirmed');

-- Abnormal Alerts
insert into public.abnormal_alerts (severity, title, triggered_at, summary, is_resolved)
values
  ('high', '預約暴增', now() - interval '10 minutes', '10 分鐘內新增 12 筆預約', false),
  ('medium', '重複問題升高', now() - interval '30 minutes', '同主題提問 30 分鐘內達 8 次', false),
  ('low', '客服延遲', now() - interval '1 hour', '平均回覆時間高於 5 分鐘', true);

-- Manual Reply Tasks
insert into public.manual_reply_tasks (customer, topic, waiting_minutes, priority, is_replied)
values
  ('李小姐', '老犬心臟病住宿可行性', 22, 'urgent', false),
  ('周先生', '美容師指定時段', 12, 'normal', false),
  ('張小姐', '取消政策例外申請', 35, 'urgent', true);
