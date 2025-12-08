
-- Create pipeline_stages table
CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create properties table
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  
  -- Address fields
  address text NOT NULL,
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  
  -- Property characteristics
  bedrooms integer NOT NULL DEFAULT 0,
  bathrooms numeric NOT NULL DEFAULT 0,
  guests integer,
  square_feet integer,
  year_built integer,
  lot_size numeric,
  property_type text,
  
  -- External URLs
  image text,
  airbnb_url text,
  zillow_url text,
  property_url text,
  
  -- Scraped Airbnb data
  listing_title text,
  room_type text,
  property_manager text,
  host text,
  
  -- Market data (stored as JSONB for flexibility)
  market_data jsonb DEFAULT '{}'::jsonb,
  
  -- Tags stored as array
  tags text[] DEFAULT '{}',
  
  -- Custom fields
  custom_fields jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create owners table (linked to properties)
CREATE TABLE public.owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Primary contact info
  name text NOT NULL DEFAULT '',
  email text,
  phone text,
  
  -- Multiple owners as JSONB array
  owners jsonb DEFAULT '[]'::jsonb,
  
  -- Multiple phones with DNC flags
  phones jsonb DEFAULT '[]'::jsonb,
  
  -- Mailing address
  mailing_address text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,
  
  -- Ownership metadata
  ownership_length_months integer,
  owner_type text,
  owner_occupied boolean,
  
  -- Compliance
  litigator boolean DEFAULT false,
  
  -- Contact info
  contact_name text,
  age integer,
  notes text,
  last_verified_date timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  type text NOT NULL CHECK (type IN ('call', 'email', 'mail', 'meeting', 'note')),
  content text NOT NULL DEFAULT '',
  outcome text,
  
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create saved_lists table
CREATE TABLE public.saved_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  name text NOT NULL,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_type text NOT NULL DEFAULT 'and' CHECK (match_type IN ('and', 'or')),
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_properties_company_id ON public.properties(company_id);
CREATE INDEX idx_properties_stage_id ON public.properties(stage_id);
CREATE INDEX idx_owners_property_id ON public.owners(property_id);
CREATE INDEX idx_owners_company_id ON public.owners(company_id);
CREATE INDEX idx_activity_logs_property_id ON public.activity_logs(property_id);
CREATE INDEX idx_activity_logs_company_id ON public.activity_logs(company_id);
CREATE INDEX idx_pipeline_stages_company_id ON public.pipeline_stages(company_id);
CREATE INDEX idx_saved_lists_company_id ON public.saved_lists(company_id);

-- Enable RLS on all tables
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_lists ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

-- RLS Policies for pipeline_stages
CREATE POLICY "Users can view their company stages"
  ON public.pipeline_stages FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert stages for their company"
  ON public.pipeline_stages FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company stages"
  ON public.pipeline_stages FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company stages"
  ON public.pipeline_stages FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS Policies for properties
CREATE POLICY "Users can view their company properties"
  ON public.properties FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert properties for their company"
  ON public.properties FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company properties"
  ON public.properties FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company properties"
  ON public.properties FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS Policies for owners
CREATE POLICY "Users can view their company owners"
  ON public.owners FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert owners for their company"
  ON public.owners FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company owners"
  ON public.owners FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company owners"
  ON public.owners FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS Policies for activity_logs
CREATE POLICY "Users can view their company activities"
  ON public.activity_logs FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert activities for their company"
  ON public.activity_logs FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company activities"
  ON public.activity_logs FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company activities"
  ON public.activity_logs FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS Policies for saved_lists
CREATE POLICY "Users can view their company saved lists"
  ON public.saved_lists FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert saved lists for their company"
  ON public.saved_lists FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company saved lists"
  ON public.saved_lists FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company saved lists"
  ON public.saved_lists FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Create trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_owners_updated_at
  BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_saved_lists_updated_at
  BEFORE UPDATE ON public.saved_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
