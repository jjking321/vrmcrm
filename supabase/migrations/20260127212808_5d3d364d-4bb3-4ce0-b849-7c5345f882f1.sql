-- Backfill source for phones: add source, addedAt, status, callCount to each phone object
UPDATE owners o
SET phones = (
  SELECT jsonb_agg(
    phone_elem.phone || jsonb_build_object(
      'source', COALESCE(p.tags[1], 'unknown'),
      'addedAt', o.created_at,
      'status', COALESCE(phone_elem.phone->>'status', 'unknown'),
      'callCount', COALESCE((phone_elem.phone->>'callCount')::int, 0)
    )
  )
  FROM jsonb_array_elements(o.phones) AS phone_elem(phone)
  JOIN properties p ON p.id = o.property_id
)
WHERE jsonb_array_length(COALESCE(phones, '[]'::jsonb)) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(phones) AS pe(p)
    WHERE pe.p->>'source' IS NULL
  );

-- Backfill source for emails: add source, addedAt, status to each email object
UPDATE owners o
SET emails = (
  SELECT jsonb_agg(
    email_elem.email || jsonb_build_object(
      'source', COALESCE(p.tags[1], 'unknown'),
      'addedAt', o.created_at,
      'status', COALESCE(email_elem.email->>'status', 'unknown')
    )
  )
  FROM jsonb_array_elements(o.emails) AS email_elem(email)
  JOIN properties p ON p.id = o.property_id
)
WHERE jsonb_array_length(COALESCE(emails, '[]'::jsonb)) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(emails) AS ee(e)
    WHERE ee.e->>'source' IS NULL
  );