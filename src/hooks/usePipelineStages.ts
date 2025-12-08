import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PipelineStage } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_STAGES } from '@/data/mockData';

interface DbPipelineStage {
  id: string;
  company_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

const toStage = (db: DbPipelineStage): PipelineStage => ({
  id: db.id,
  name: db.name,
  color: db.color,
});

export const usePipelineStages = () => {
  const { company } = useAuth();
  const companyId = company?.id;

  return useQuery({
    queryKey: ['pipeline_stages', companyId],
    queryFn: async (): Promise<PipelineStage[]> => {
      if (!companyId) return DEFAULT_STAGES;

      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // If no stages exist, return defaults
      if (!data?.length) {
        return DEFAULT_STAGES;
      }

      return data.map(d => toStage(d as unknown as DbPipelineStage));
    },
    enabled: !!companyId,
  });
};

export const useInitializePipelineStages = () => {
  const queryClient = useQueryClient();
  const { company } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error('No company');

      // Check if stages already exist
      const { data: existing } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('company_id', company.id)
        .limit(1);

      if (existing?.length) return existing;

      // Insert default stages
      const stagesToInsert = DEFAULT_STAGES.map((stage, index) => ({
        id: stage.id,
        company_id: company.id,
        name: stage.name,
        color: stage.color,
        sort_order: index,
      }));

      const { data, error } = await supabase
        .from('pipeline_stages')
        .insert(stagesToInsert)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages'] });
    },
  });
};
