
CREATE TABLE public.realtors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.realtors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company realtors"
  ON public.realtors FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert realtors for their company"
  ON public.realtors FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can update their company realtors"
  ON public.realtors FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete their company realtors"
  ON public.realtors FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE TRIGGER update_realtors_updated_at
  BEFORE UPDATE ON public.realtors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.deals ADD COLUMN realtor_id uuid REFERENCES public.realtors(id) ON DELETE SET NULL;
