
-- Create table for per-company API keys
CREATE TABLE public.company_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  api_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, service_name)
);

-- Enable RLS
ALTER TABLE public.company_api_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can manage API keys
CREATE POLICY "Admins can view their company API keys"
ON public.company_api_keys
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert API keys for their company"
ON public.company_api_keys
FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update their company API keys"
ON public.company_api_keys
FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete their company API keys"
ON public.company_api_keys
FOR DELETE
USING (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_company_api_keys_updated_at
BEFORE UPDATE ON public.company_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
