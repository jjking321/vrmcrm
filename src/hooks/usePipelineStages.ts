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
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (!data?.length) {
        return [];
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

      const { data: existing } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('company_id', company.id)
        .limit(1);

      if (existing?.length) return existing;

      const stagesToInsert = DEFAULT_STAGES.map((stage, index) => ({
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

export const useAddPipelineStage = () => {
  const queryClient = useQueryClient();
  const { company } = useAuth();

  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!company?.id) throw new Error('No company');

      // Get current max sort_order
      const { data: existing } = await supabase
        .from('pipeline_stages')
        .select('sort_order')
        .eq('company_id', company.id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = existing?.length ? (existing[0].sort_order + 1) : 0;

      const { data, error } = await supabase
        .from('pipeline_stages')
        .insert({
          company_id: company.id,
          name,
          color,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages'] });
    },
  });
};

export const useUpdatePipelineStage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const updates: { name?: string; color?: string } = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;

      const { data, error } = await supabase
        .from('pipeline_stages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages'] });
    },
  });
};

export const useDeletePipelineStage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stageId: string) => {
      // First, unassign all properties from this stage
      await supabase
        .from('properties')
        .update({ stage_id: null })
        .eq('stage_id', stageId);

      // Then delete the stage
      const { error } = await supabase
        .from('pipeline_stages')
        .delete()
        .eq('id', stageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
};

export const useReorderPipelineStages = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stages: { id: string; sort_order: number }[]) => {
      // Update each stage's sort_order
      const updates = stages.map(stage =>
        supabase
          .from('pipeline_stages')
          .update({ sort_order: stage.sort_order })
          .eq('id', stage.id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages'] });
    },
  });
};

export const usePropertiesInStage = (stageId: string) => {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['properties_in_stage', stageId],
    queryFn: async () => {
      if (!company?.id || !stageId) return 0;

      const { count, error } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('stage_id', stageId);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!company?.id && !!stageId,
  });
};
