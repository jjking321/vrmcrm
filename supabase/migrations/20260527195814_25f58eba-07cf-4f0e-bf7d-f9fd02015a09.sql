
-- Batches (paper trail header)
CREATE TABLE public.bad_data_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  data_type text NOT NULL CHECK (data_type IN ('mailing_address','phone','email')),
  source_label text NOT NULL,
  uploaded_file_name text,
  mailing_list_id uuid,
  total_rows integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  unmatched_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bad_data_batches TO authenticated;
GRANT ALL ON public.bad_data_batches TO service_role;

ALTER TABLE public.bad_data_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company bad data batches" ON public.bad_data_batches
  FOR SELECT TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert company bad data batches" ON public.bad_data_batches
  FOR INSERT TO authenticated WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update company bad data batches" ON public.bad_data_batches
  FOR UPDATE TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users delete company bad data batches" ON public.bad_data_batches
  FOR DELETE TO authenticated USING (company_id = get_user_company_id(auth.uid()));

-- Bad contact data flags
CREATE TABLE public.bad_contact_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  data_type text NOT NULL CHECK (data_type IN ('mailing_address','phone','email')),
  value text NOT NULL,
  normalized_value text NOT NULL,
  owner_id uuid,
  property_id uuid,
  source text,
  reason text NOT NULL DEFAULT 'other',
  notes text,
  batch_id uuid REFERENCES public.bad_data_batches(id) ON DELETE SET NULL,
  mailing_list_id uuid,
  flagged_by uuid,
  flagged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bad_contact_data_company_type ON public.bad_contact_data(company_id, data_type);
CREATE INDEX idx_bad_contact_data_normalized ON public.bad_contact_data(company_id, data_type, normalized_value);
CREATE INDEX idx_bad_contact_data_owner ON public.bad_contact_data(owner_id);
CREATE INDEX idx_bad_contact_data_property ON public.bad_contact_data(property_id);
CREATE INDEX idx_bad_contact_data_source ON public.bad_contact_data(company_id, source);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bad_contact_data TO authenticated;
GRANT ALL ON public.bad_contact_data TO service_role;

ALTER TABLE public.bad_contact_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company bad contact data" ON public.bad_contact_data
  FOR SELECT TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert company bad contact data" ON public.bad_contact_data
  FOR INSERT TO authenticated WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update company bad contact data" ON public.bad_contact_data
  FOR UPDATE TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users delete company bad contact data" ON public.bad_contact_data
  FOR DELETE TO authenticated USING (company_id = get_user_company_id(auth.uid()));

-- Realtime
ALTER TABLE public.bad_contact_data REPLICA IDENTITY FULL;
ALTER TABLE public.bad_data_batches REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bad_contact_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bad_data_batches;
