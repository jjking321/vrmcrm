-- Create mailing_lists table
CREATE TABLE public.mailing_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  exported_at TIMESTAMP WITH TIME ZONE,
  export_count INTEGER DEFAULT 0
);

-- Create mailing_list_items table
CREATE TABLE public.mailing_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mailing_list_id UUID NOT NULL REFERENCES public.mailing_lists(id) ON DELETE CASCADE,
  property_id UUID NOT NULL,
  company_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sort_order INTEGER DEFAULT 0
);

-- Enable RLS on both tables
ALTER TABLE public.mailing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mailing_list_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for mailing_lists (following call_lists pattern)
CREATE POLICY "Users can view their company mailing lists"
  ON public.mailing_lists FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert mailing lists for their company"
  ON public.mailing_lists FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company mailing lists"
  ON public.mailing_lists FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company mailing lists"
  ON public.mailing_lists FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

-- RLS policies for mailing_list_items (following call_list_items pattern)
CREATE POLICY "Users can view their company mailing list items"
  ON public.mailing_list_items FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert mailing list items for their company"
  ON public.mailing_list_items FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company mailing list items"
  ON public.mailing_list_items FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company mailing list items"
  ON public.mailing_list_items FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));