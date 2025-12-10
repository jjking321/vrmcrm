import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PipelineStat {
  id: string;
  name: string;
  color: string;
  count: number;
  revenue: number;
}

interface DashboardStats {
  totalProperties: number;
  totalRevenue: number;
  uniqueOwners: number;
  pipelineStats: PipelineStat[];
}

export const useDashboardStats = () => {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['dashboard_stats', company?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!company?.id) {
        return { totalProperties: 0, totalRevenue: 0, uniqueOwners: 0, pipelineStats: [] };
      }

      // Fetch all stats in parallel
      const [propertiesResult, ownersResult, pipelineResult] = await Promise.all([
        // Get total properties count and revenue
        supabase
          .from('properties')
          .select('id, market_data, stage_id')
          .eq('company_id', company.id),
        
        // Get unique owners count
        supabase
          .from('owners')
          .select('name')
          .eq('company_id', company.id),
        
        // Get pipeline stages
        supabase
          .from('pipeline_stages')
          .select('id, name, color, sort_order')
          .eq('company_id', company.id)
          .order('sort_order', { ascending: true }),
      ]);

      if (propertiesResult.error) throw propertiesResult.error;
      if (ownersResult.error) throw ownersResult.error;
      if (pipelineResult.error) throw pipelineResult.error;

      // Handle pagination for properties if needed (>1000)
      let allProperties = propertiesResult.data || [];
      if (allProperties.length === 1000) {
        // Fetch remaining properties
        let offset = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('properties')
            .select('id, market_data, stage_id')
            .eq('company_id', company.id)
            .range(offset, offset + 999);
          
          if (error) throw error;
          if (!data || data.length === 0) break;
          
          allProperties = [...allProperties, ...data];
          offset += 1000;
          if (data.length < 1000) break;
        }
      }

      // Handle pagination for owners if needed
      let allOwners = ownersResult.data || [];
      if (allOwners.length === 1000) {
        let offset = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('owners')
            .select('name')
            .eq('company_id', company.id)
            .range(offset, offset + 999);
          
          if (error) throw error;
          if (!data || data.length === 0) break;
          
          allOwners = [...allOwners, ...data];
          offset += 1000;
          if (data.length < 1000) break;
        }
      }

      const totalProperties = allProperties.length;
      
      // Calculate total revenue
      const totalRevenue = allProperties.reduce((sum, p) => {
        const marketData = p.market_data as { projectedRevenue?: number } | null;
        return sum + (marketData?.projectedRevenue || 0);
      }, 0);

      // Calculate unique owners
      const uniqueOwnerNames = new Set(allOwners.map(o => o.name?.toLowerCase().trim()).filter(Boolean));
      const uniqueOwners = uniqueOwnerNames.size;

      // Calculate pipeline stats
      const stages = pipelineResult.data || [];
      const pipelineStats: PipelineStat[] = stages.map(stage => {
        const stageProperties = allProperties.filter(p => p.stage_id === stage.id);
        const stageRevenue = stageProperties.reduce((sum, p) => {
          const marketData = p.market_data as { projectedRevenue?: number } | null;
          return sum + (marketData?.projectedRevenue || 0);
        }, 0);

        return {
          id: stage.id,
          name: stage.name,
          color: stage.color,
          count: stageProperties.length,
          revenue: stageRevenue,
        };
      });

      return {
        totalProperties,
        totalRevenue,
        uniqueOwners,
        pipelineStats,
      };
    },
    enabled: !!company?.id,
  });
};
