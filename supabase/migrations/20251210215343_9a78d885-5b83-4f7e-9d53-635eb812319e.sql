-- Add emails JSONB column to owners table for multiple email support
ALTER TABLE public.owners ADD COLUMN emails jsonb DEFAULT '[]'::jsonb;