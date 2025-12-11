-- Add booking_link field to properties table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS booking_link text;