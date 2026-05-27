
CREATE TABLE public.email_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  gmail_account_id uuid,
  to_emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  cc_emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (thread_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_drafts TO authenticated;
GRANT ALL ON public.email_drafts TO service_role;

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company drafts" ON public.email_drafts FOR SELECT TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert company drafts" ON public.email_drafts FOR INSERT TO authenticated WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update company drafts" ON public.email_drafts FOR UPDATE TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users delete company drafts" ON public.email_drafts FOR DELETE TO authenticated USING (company_id = get_user_company_id(auth.uid()));

CREATE TRIGGER update_email_drafts_updated_at BEFORE UPDATE ON public.email_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.email_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  thread_id uuid,
  owner_id uuid,
  realtor_id uuid,
  property_id uuid,
  body text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_notes_thread ON public.email_notes(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_email_notes_owner ON public.email_notes(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_email_notes_realtor ON public.email_notes(realtor_id) WHERE realtor_id IS NOT NULL;
CREATE INDEX idx_email_notes_property ON public.email_notes(property_id) WHERE property_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_notes TO authenticated;
GRANT ALL ON public.email_notes TO service_role;

ALTER TABLE public.email_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company notes" ON public.email_notes FOR SELECT TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert company notes" ON public.email_notes FOR INSERT TO authenticated WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update own notes" ON public.email_notes FOR UPDATE TO authenticated USING (company_id = get_user_company_id(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Users delete own notes" ON public.email_notes FOR DELETE TO authenticated USING (company_id = get_user_company_id(auth.uid()) AND created_by = auth.uid());

CREATE TRIGGER update_email_notes_updated_at BEFORE UPDATE ON public.email_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
