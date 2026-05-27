-- gmail_accounts: one row per user-connected Gmail
CREATE TABLE public.gmail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  email_address text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  last_history_id text,
  last_synced_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email_address)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_accounts TO authenticated;
GRANT ALL ON public.gmail_accounts TO service_role;

ALTER TABLE public.gmail_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company gmail accounts"
  ON public.gmail_accounts FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert their own gmail account"
  ON public.gmail_accounts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their own gmail account"
  ON public.gmail_accounts FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own gmail account"
  ON public.gmail_accounts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_gmail_accounts_updated_at
  BEFORE UPDATE ON public.gmail_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- email_threads
CREATE TABLE public.email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_account_id uuid NOT NULL,
  company_id uuid NOT NULL,
  gmail_thread_id text NOT NULL,
  subject text,
  snippet text,
  participants jsonb DEFAULT '[]'::jsonb,
  last_message_at timestamptz,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gmail_account_id, gmail_thread_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_threads TO authenticated;
GRANT ALL ON public.email_threads TO service_role;

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company email threads"
  ON public.email_threads FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update company email threads"
  ON public.email_threads FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert company email threads"
  ON public.email_threads FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete company email threads"
  ON public.email_threads FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE TRIGGER update_email_threads_updated_at
  BEFORE UPDATE ON public.email_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_email_threads_company ON public.email_threads(company_id, last_message_at DESC);
CREATE INDEX idx_email_threads_account ON public.email_threads(gmail_account_id);

-- email_messages
CREATE TABLE public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  gmail_account_id uuid NOT NULL,
  company_id uuid NOT NULL,
  gmail_message_id text NOT NULL,
  from_email text,
  from_name text,
  to_emails jsonb DEFAULT '[]'::jsonb,
  cc_emails jsonb DEFAULT '[]'::jsonb,
  subject text,
  body_text text,
  body_html text,
  snippet text,
  sent_at timestamptz,
  direction text NOT NULL DEFAULT 'inbound',
  is_read boolean NOT NULL DEFAULT false,
  owner_id uuid,
  realtor_id uuid,
  property_id uuid,
  match_status text DEFAULT 'matched',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gmail_account_id, gmail_message_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_messages TO authenticated;
GRANT ALL ON public.email_messages TO service_role;

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company email messages"
  ON public.email_messages FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert company email messages"
  ON public.email_messages FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update company email messages"
  ON public.email_messages FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete company email messages"
  ON public.email_messages FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX idx_email_messages_thread ON public.email_messages(thread_id, sent_at);
CREATE INDEX idx_email_messages_company ON public.email_messages(company_id, sent_at DESC);
CREATE INDEX idx_email_messages_owner ON public.email_messages(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_email_messages_realtor ON public.email_messages(realtor_id) WHERE realtor_id IS NOT NULL;
CREATE INDEX idx_email_messages_property ON public.email_messages(property_id) WHERE property_id IS NOT NULL;