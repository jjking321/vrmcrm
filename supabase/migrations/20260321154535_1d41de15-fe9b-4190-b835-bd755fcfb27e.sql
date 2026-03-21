
ALTER TABLE public.activity_logs 
  ADD COLUMN realtor_id uuid REFERENCES public.realtors(id) ON DELETE SET NULL,
  ALTER COLUMN property_id DROP NOT NULL;
