-- Fix function search path for get_unique_tags
CREATE OR REPLACE FUNCTION get_unique_tags(p_company_id uuid)
RETURNS TABLE(tag text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT t.tag 
  FROM (
    SELECT unnest(p.tags) as tag
    FROM properties p
    WHERE p.company_id = p_company_id
    AND p.tags IS NOT NULL
  ) AS t
  WHERE t.tag NOT LIKE 'list-%'
  ORDER BY t.tag;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;