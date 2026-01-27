-- Migrate legacy email column to emails JSONB array with source tracking
-- Only affects owners with email set but empty emails array

UPDATE owners o
SET emails = jsonb_build_array(
  jsonb_build_object(
    'address', o.email,
    'source', COALESCE(p.tags[1], 'unknown'),
    'addedAt', o.created_at,
    'status', 'unknown',
    'type', 'unknown',
    'optedOut', false
  )
)
FROM properties p
WHERE p.id = o.property_id
  AND o.email IS NOT NULL
  AND o.email != ''
  AND (o.emails IS NULL OR o.emails = '[]'::jsonb OR jsonb_array_length(o.emails) = 0);