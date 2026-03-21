import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Realtor } from '@/types';

const mapRow = (row: any): Realtor => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  phone: row.phone || undefined,
  email: row.email || undefined,
  notes: row.notes || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function useRealtors() {
  const { company } = useAuth();
  return useQuery({
    queryKey: ['realtors', company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('realtors' as any)
        .select('*')
        .order('name');
      if (error) throw error;
      return ((data as any[]) || []).map(mapRow);
    },
    enabled: !!company?.id,
  });
}

export function useAddRealtor() {
  const qc = useQueryClient();
  const { company } = useAuth();
  return useMutation({
    mutationFn: async (realtor: { name: string; phone?: string; email?: string; notes?: string }): Promise<Realtor> => {
      const { data, error } = await (supabase as any)
        .from('realtors')
        .insert({
          company_id: company!.id,
          name: realtor.name,
          phone: realtor.phone || null,
          email: realtor.email || null,
          notes: realtor.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['realtors'] }),
  });
}

export function useUpdateRealtor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<{ name: string; phone: string; email: string; notes: string }> }) => {
      const { error } = await (supabase as any)
        .from('realtors')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['realtors'] }),
  });
}

export function useDeleteRealtor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('realtors')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['realtors'] }),
  });
}
