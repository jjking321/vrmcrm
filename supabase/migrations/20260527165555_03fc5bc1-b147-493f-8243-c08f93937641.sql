ALTER TABLE public.gmail_accounts
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS signature text;