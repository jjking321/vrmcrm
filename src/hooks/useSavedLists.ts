import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SavedList, FilterRule } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DbSavedList {
  id: string;
  company_id: string;
  created_by: string | null;
  name: string;
  rules: FilterRule[];
  match_type: 'and' | 'or';
  created_at: string;
  updated_at: string;
}

const toSavedList = (db: DbSavedList): SavedList => ({
  id: db.id,
  name: db.name,
  rules: db.rules || [],
  matchType: db.match_type,
});

export const useSavedLists = () => {
  const { company } = useAuth();
  const companyId = company?.id;

  return useQuery({
    queryKey: ['saved_lists', companyId],
    queryFn: async (): Promise<SavedList[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('saved_lists')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(d => toSavedList(d as unknown as DbSavedList));
    },
    enabled: !!companyId,
  });
};

export const useAddSavedList = () => {
  const queryClient = useQueryClient();
  const { company, user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, rules, matchType }: { name: string; rules: FilterRule[]; matchType: 'and' | 'or' }) => {
      if (!company?.id) throw new Error('No company');

      const { data, error } = await supabase
        .from('saved_lists')
        .insert({
          company_id: company.id,
          created_by: user?.id,
          name,
          rules: rules as any,
          match_type: matchType,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['saved_lists'] });
      toast.success(`Saved list "${variables.name}"`);
    },
    onError: (error) => {
      toast.error(`Failed to save list: ${error.message}`);
    },
  });
};

export const useDeleteSavedList = () => {
  const queryClient = useQueryClient();
  const { company } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!company?.id) throw new Error('No company');

      const { error } = await supabase
        .from('saved_lists')
        .delete()
        .eq('id', id)
        .eq('company_id', company.id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved_lists'] });
    },
    onError: (error) => {
      toast.error(`Failed to delete list: ${error.message}`);
    },
  });
};
