import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUniqueTags = () => {
  const { company } = useAuth();
  const companyId = company?.id;

  return useQuery({
    queryKey: ['unique-tags', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      // Fetch all properties to get all tags (override default 1000 row limit)
      const { data, error } = await supabase
        .from('properties')
        .select('tags')
        .eq('company_id', companyId)
        .range(0, 9999);

      if (error) throw error;

      // Flatten all tags, filter out list- prefixed tags, deduplicate, and sort
      const allTags = data
        .flatMap(p => p.tags || [])
        .filter(tag => !tag.startsWith('list-'));
      
      const uniqueTags = [...new Set(allTags)].sort();
      return uniqueTags;
    },
    enabled: !!companyId,
  });
};
