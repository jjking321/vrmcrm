CREATE TABLE public.deal_stage_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  deal_id uuid NOT NULL,
  from_stage_id uuid,
  to_stage_id uuid,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.deal_stage_history TO authenticated;
GRANT ALL ON public.deal_stage_history TO service_role;

ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company deal history"
ON public.deal_stage_history FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users insert company deal history"
ON public.deal_stage_history FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX idx_deal_stage_history_company_changed ON public.deal_stage_history(company_id, changed_at DESC);
CREATE INDEX idx_deal_stage_history_deal ON public.deal_stage_history(deal_id);

CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.deal_stage_history (company_id, deal_id, from_stage_id, to_stage_id, changed_by, changed_at)
    VALUES (NEW.company_id, NEW.id, NULL, NEW.stage_id, NEW.created_by, NEW.created_at);
  ELSIF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.deal_stage_history (company_id, deal_id, from_stage_id, to_stage_id, changed_by, changed_at)
    VALUES (NEW.company_id, NEW.id, OLD.stage_id, NEW.stage_id, auth.uid(), now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deals_stage_history_insert
AFTER INSERT ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.log_deal_stage_change();

CREATE TRIGGER trg_deals_stage_history_update
AFTER UPDATE OF stage_id ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.log_deal_stage_change();

-- Backfill: one row per existing deal representing its creation
INSERT INTO public.deal_stage_history (company_id, deal_id, from_stage_id, to_stage_id, changed_by, changed_at)
SELECT d.company_id, d.id, NULL, d.stage_id, d.created_by, d.created_at
FROM public.deals d
WHERE NOT EXISTS (
  SELECT 1 FROM public.deal_stage_history h WHERE h.deal_id = d.id
);