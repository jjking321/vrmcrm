-- Create call_lists table
CREATE TABLE public.call_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create call_list_items table
CREATE TABLE public.call_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_list_id UUID REFERENCES public.call_lists(id) ON DELETE CASCADE NOT NULL,
  property_id UUID NOT NULL,
  company_id UUID NOT NULL,
  owner_index INTEGER,
  phone_index INTEGER,
  status TEXT DEFAULT 'pending',
  call_outcome TEXT,
  notes TEXT,
  last_called_at TIMESTAMPTZ,
  call_count INTEGER DEFAULT 0,
  callback_date TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_list_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for call_lists
CREATE POLICY "Users can view their company call lists"
ON public.call_lists FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert call lists for their company"
ON public.call_lists FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company call lists"
ON public.call_lists FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company call lists"
ON public.call_lists FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

-- RLS policies for call_list_items
CREATE POLICY "Users can view their company call list items"
ON public.call_list_items FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert call list items for their company"
ON public.call_list_items FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company call list items"
ON public.call_list_items FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company call list items"
ON public.call_list_items FOR DELETE
USING (company_id = get_user_company_id(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_call_list_items_list_id ON public.call_list_items(call_list_id);
CREATE INDEX idx_call_list_items_property_id ON public.call_list_items(property_id);
CREATE INDEX idx_call_list_items_status ON public.call_list_items(status);
CREATE INDEX idx_call_lists_company_id ON public.call_lists(company_id);