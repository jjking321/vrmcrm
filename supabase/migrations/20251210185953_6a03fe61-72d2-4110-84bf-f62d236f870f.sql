-- Create exclusion_list table for tracking properties/contacts to not target
CREATE TABLE public.exclusion_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_name TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  normalized_address TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.exclusion_list ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company exclusions"
ON public.exclusion_list FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert their company exclusions"
ON public.exclusion_list FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company exclusions"
ON public.exclusion_list FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company exclusions"
ON public.exclusion_list FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

-- Index for faster lookups
CREATE INDEX idx_exclusion_list_company_id ON public.exclusion_list(company_id);
CREATE INDEX idx_exclusion_list_normalized_address ON public.exclusion_list(normalized_address);
CREATE INDEX idx_exclusion_list_email ON public.exclusion_list(email);