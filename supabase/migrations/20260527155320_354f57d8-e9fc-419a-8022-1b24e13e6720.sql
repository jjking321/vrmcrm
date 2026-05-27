ALTER TABLE public.email_messages REPLICA IDENTITY FULL;
ALTER TABLE public.email_threads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_threads;