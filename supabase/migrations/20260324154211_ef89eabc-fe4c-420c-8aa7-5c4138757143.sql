-- Remove the broken cron job that was registered with a null service_role_key.
-- The job 'telegram-dispatch-every-60s' from migration 20260319130451 used
-- current_setting('supabase.service_role_key', true) which is not available
-- at migration time, causing all dispatches to fail with 401.
--
-- To re-register the cron job properly after deploy, use:
--   1. POST to the setup-telegram-cron edge function, OR
--   2. SELECT public.setup_telegram_cron('<base_url>', '<service_role_key>')
--      (defined in migration 20260318221712)

SELECT cron.unschedule('telegram-dispatch-every-60s');