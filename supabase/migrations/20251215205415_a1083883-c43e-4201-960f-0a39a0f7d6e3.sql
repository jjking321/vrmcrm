-- Add airbnb_listing_id column to properties table
ALTER TABLE public.properties ADD COLUMN airbnb_listing_id TEXT;

-- Populate existing records by extracting ID from airbnb_url
UPDATE public.properties 
SET airbnb_listing_id = SUBSTRING(airbnb_url FROM '/rooms/(\d+)')
WHERE airbnb_url IS NOT NULL 
  AND airbnb_url != '' 
  AND airbnb_listing_id IS NULL;