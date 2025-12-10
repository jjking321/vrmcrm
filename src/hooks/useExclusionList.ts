import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ExclusionEntry } from '@/types';
import { toast } from 'sonner';
import { normalizeAddressForMatch } from '@/lib/exclusionUtils';

// Transform database row to ExclusionEntry
const transformRow = (row: any): ExclusionEntry => ({
  id: row.id,
  companyId: row.company_id,
  ownerName: row.owner_name,
  email: row.email,
  phone: row.phone,
  address: row.address,
  city: row.city,
  state: row.state,
  normalizedAddress: row.normalized_address,
  source: row.source as 'manual' | 'import',
  notes: row.notes,
  createdAt: row.created_at,
});

export const useExclusionList = () => {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['exclusion_list', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];

      const { data, error } = await supabase
        .from('exclusion_list')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(transformRow);
    },
    enabled: !!company?.id,
  });
};

export const useExclusionCount = () => {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['exclusion_list_count', company?.id],
    queryFn: async () => {
      if (!company?.id) return 0;

      const { count, error } = await supabase
        .from('exclusion_list')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!company?.id,
  });
};

interface AddExclusionInput {
  ownerName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  source: 'manual' | 'import';
  notes?: string;
}

export const useAddExclusions = () => {
  const queryClient = useQueryClient();
  const { company, user } = useAuth();

  return useMutation({
    mutationFn: async (entries: AddExclusionInput[]) => {
      if (!company?.id) throw new Error('No company');

      const inserts = entries.map(entry => ({
        company_id: company.id,
        owner_name: entry.ownerName || null,
        email: entry.email || null,
        phone: entry.phone || null,
        address: entry.address || null,
        city: entry.city || null,
        state: entry.state || null,
        normalized_address: entry.address 
          ? normalizeAddressForMatch(entry.address, entry.city || '', entry.state || '')
          : null,
        source: entry.source,
        notes: entry.notes || null,
        created_by: user?.id,
      }));

      const { error } = await supabase.from('exclusion_list').insert(inserts);
      if (error) throw error;

      return entries.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['exclusion_list'] });
      queryClient.invalidateQueries({ queryKey: ['exclusion_list_count'] });
      toast.success(`Added ${count} entries to exclusion list`);
    },
    onError: (error) => {
      toast.error(`Failed to add exclusions: ${error.message}`);
    },
  });
};

export const useDeleteExclusion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('exclusion_list')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusion_list'] });
      queryClient.invalidateQueries({ queryKey: ['exclusion_list_count'] });
      toast.success('Entry removed from exclusion list');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });
};

export const useClearExclusionList = () => {
  const queryClient = useQueryClient();
  const { company } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error('No company');

      const { error } = await supabase
        .from('exclusion_list')
        .delete()
        .eq('company_id', company.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusion_list'] });
      queryClient.invalidateQueries({ queryKey: ['exclusion_list_count'] });
      toast.success('Exclusion list cleared');
    },
    onError: (error) => {
      toast.error(`Failed to clear list: ${error.message}`);
    },
  });
};
