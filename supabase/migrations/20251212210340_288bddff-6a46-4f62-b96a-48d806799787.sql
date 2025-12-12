-- Add owner_name column to activity_logs table
-- This changes activities from property-centric to owner-centric
-- property_id now represents "which property was this contact about" rather than ownership

ALTER TABLE public.activity_logs 
ADD COLUMN owner_name text;

-- Add index for efficient owner-based queries
CREATE INDEX idx_activity_logs_owner_name ON public.activity_logs(owner_name);

-- Add comment for clarity
COMMENT ON COLUMN public.activity_logs.owner_name IS 'The owner this activity is associated with. property_id indicates which property the contact was regarding.';