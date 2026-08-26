create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create unique index if not exists report_delivery_log_period_unique
  on public.report_delivery_log (schedule_id, period_start, period_end)
  where status = 'sent';
