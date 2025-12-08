-- Create field_definitions table for custom field schemas
CREATE TABLE public.field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  options jsonb,
  is_system boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, field_key)
);

-- Enable RLS
ALTER TABLE public.field_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company field definitions"
ON public.field_definitions FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert field definitions for their company"
ON public.field_definitions FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company field definitions"
ON public.field_definitions FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company field definitions"
ON public.field_definitions FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_field_definitions_updated_at
BEFORE UPDATE ON public.field_definitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();