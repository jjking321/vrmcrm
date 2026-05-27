
ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS tracking_id uuid,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS email_messages_tracking_id_key
  ON public.email_messages (tracking_id) WHERE tracking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_messages_company_sent_at_idx
  ON public.email_messages (company_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  company_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('open', 'click')),
  url text,
  user_agent text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_events TO authenticated;
GRANT ALL ON public.email_events TO service_role;

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company email events"
  ON public.email_events FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX IF NOT EXISTS email_events_message_id_idx ON public.email_events (message_id);
CREATE INDEX IF NOT EXISTS email_events_company_created_idx ON public.email_events (company_id, created_at DESC);
