begin;
create extension if not exists pg_cron with schema pg_catalog;
create index notifications_retention on public.notifications(created_at);
select cron.schedule('humor-notifications-retention','0 5 * * *','select public.humor_cleanup_notifications();');
commit;
