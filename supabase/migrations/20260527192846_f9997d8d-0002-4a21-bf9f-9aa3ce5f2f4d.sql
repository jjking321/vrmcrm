
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_drafts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_notes;
ALTER TABLE public.email_drafts REPLICA IDENTITY FULL;
ALTER TABLE public.email_notes REPLICA IDENTITY FULL;
