-- Backfill source tracking on owners array contacts
-- Only affects owner entries that don't have source set

UPDATE owners o
SET owners = (
  SELECT jsonb_agg(
    CASE 
      WHEN owner_elem->>'source' IS NOT NULL THEN owner_elem
      ELSE owner_elem || jsonb_build_object(
        'source', COALESCE(p.tags[1], 'unknown'),
        'addedAt', o.created_at
      )
    END
  )
  FROM jsonb_array_elements(o.owners) AS owner_elem
)
FROM properties p
WHERE p.id = o.property_id
  AND jsonb_array_length(COALESCE(o.owners, '[]'::jsonb)) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(o.owners) AS elem
    WHERE elem->>'source' IS NULL
  );