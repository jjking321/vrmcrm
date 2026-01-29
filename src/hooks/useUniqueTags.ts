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

      // Use RPC to efficiently get unique tags from the database
      const { data, error } = await supabase
        .rpc('get_unique_tags', { p_company_id: companyId });

      if (error) throw error;

      return (data as { tag: string }[])?.map(row => row.tag) || [];
    },
    enabled: !!companyId,
  });
};
