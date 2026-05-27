CREATE TABLE public.marketing_opt_outs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('mail','phone','email')),
  value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  owner_id UUID,
  property_id UUID,
  source TEXT,
  notes TEXT,
  flagged_by UUID,
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_opt_outs_company_channel ON public.marketing_opt_outs(company_id, channel);
CREATE INDEX idx_marketing_opt_outs_normalized ON public.marketing_opt_outs(company_id, channel, normalized_value);
CREATE INDEX idx_marketing_opt_outs_owner ON public.marketing_opt_outs(owner_id);
CREATE INDEX idx_marketing_opt_outs_property ON public.marketing_opt_outs(property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_opt_outs TO authenticated;
GRANT ALL ON public.marketing_opt_outs TO service_role;

ALTER TABLE public.marketing_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company opt-outs" ON public.marketing_opt_outs
  FOR SELECT TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert company opt-outs" ON public.marketing_opt_outs
  FOR INSERT TO authenticated WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update company opt-outs" ON public.marketing_opt_outs
  FOR UPDATE TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users delete company opt-outs" ON public.marketing_opt_outs
  FOR DELETE TO authenticated USING (company_id = get_user_company_id(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_opt_outs;