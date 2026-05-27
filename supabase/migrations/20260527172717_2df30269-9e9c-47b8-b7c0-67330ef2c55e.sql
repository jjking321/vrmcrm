
-- Email attachments table
CREATE TABLE public.email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  company_id uuid NOT NULL,
  filename text NOT NULL,
  mime_type text,
  size_bytes integer,
  storage_path text NOT NULL,
  gmail_attachment_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_attachments_message ON public.email_attachments(message_id);
CREATE INDEX idx_email_attachments_company ON public.email_attachments(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_attachments TO authenticated;
GRANT ALL ON public.email_attachments TO service_role;

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company email attachments"
  ON public.email_attachments FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users insert company email attachments"
  ON public.email_attachments FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update company email attachments"
  ON public.email_attachments FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users delete company email attachments"
  ON public.email_attachments FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: first folder in path must be the user's company id
CREATE POLICY "Users view company email attachment files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'email-attachments'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
  );

CREATE POLICY "Users upload company email attachment files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'email-attachments'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
  );

CREATE POLICY "Users delete company email attachment files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'email-attachments'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
  );
