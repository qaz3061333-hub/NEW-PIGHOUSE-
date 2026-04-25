-- Manual Reply Workbench v1: schema-safe migration + test data seed
-- Safe to run in Supabase SQL Editor multiple times.

ALTER TABLE public.manual_reply_tasks
  ADD COLUMN IF NOT EXISTS source_channel text,
  ADD COLUMN IF NOT EXISTS customer_line_user_id text,
  ADD COLUMN IF NOT EXISTS last_message text,
  ADD COLUMN IF NOT EXISTS reply_note text;

ALTER TABLE public.manual_reply_tasks
  ALTER COLUMN source_channel SET DEFAULT 'LINE';

-- Backfill basic defaults for existing records with null channel
UPDATE public.manual_reply_tasks
SET source_channel = 'LINE'
WHERE source_channel IS NULL;

-- Add a few workbench-style sample rows without deleting existing data
-- Do not provide id; let default gen_random_uuid() generate it.
INSERT INTO public.manual_reply_tasks (
  customer,
  source_channel,
  customer_line_user_id,
  topic,
  last_message,
  reply_note,
  waiting_minutes,
  priority,
  is_replied,
  replied_at
)
SELECT
  'Customer A',
  'LINE',
  'U_TEST_001',
  'First puppy bath preparation',
  'The customer asks what to prepare before a 4-month-old puppy has its first bath.',
  'Confirm vaccine status first, then explain the puppy bath process and available appointment times.',
  18,
  'normal',
  false,
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manual_reply_tasks
  WHERE customer = 'Customer A'
    AND topic = 'First puppy bath preparation'
);

INSERT INTO public.manual_reply_tasks (
  customer,
  source_channel,
  customer_line_user_id,
  topic,
  last_message,
  reply_note,
  waiting_minutes,
  priority,
  is_replied,
  replied_at
)
SELECT
  'Customer B',
  'LINE',
  'U_TEST_002',
  'Boarding medication support',
  'The customer asks whether staff can help give heart medication during a two-night stay.',
  'Confirm medication name and schedule, explain that staff can help, and remind the customer to bring prescription details.',
  42,
  'urgent',
  false,
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manual_reply_tasks
  WHERE customer = 'Customer B'
    AND topic = 'Boarding medication support'
);

INSERT INTO public.manual_reply_tasks (
  customer,
  source_channel,
  customer_line_user_id,
  topic,
  last_message,
  reply_note,
  waiting_minutes,
  priority,
  is_replied,
  replied_at
)
SELECT
  'Customer C',
  'LINE',
  NULL,
  'Cancellation policy exception',
  NULL,
  NULL,
  7,
  'normal',
  false,
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manual_reply_tasks
  WHERE customer = 'Customer C'
    AND topic = 'Cancellation policy exception'
);
