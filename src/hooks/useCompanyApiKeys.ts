import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CompanyApiKey {
  id: string;
  company_id: string;
  service_name: string;
  api_key: string;
  created_at: string;
  updated_at: string;
}

const SERVICES = [
  { name: 'geocodio', label: 'Geocodio', description: 'Address verification and standardization' },
  { name: 'rapidapi', label: 'RapidAPI (Zillow)', description: 'Property valuations and market data' },
  { name: 'airroi', label: 'AirROI', description: 'Airbnb revenue estimates and analytics' },
] as const;

export type ServiceName = typeof SERVICES[number]['name'];

export { SERVICES };

export function useCompanyApiKeys() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  return useQuery({
    queryKey: ['company-api-keys', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_api_keys')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data as CompanyApiKey[];
    },
    enabled: !!companyId,
  });
}

export function useUpsertApiKey() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const companyId = profile?.company_id;

  return useMutation({
    mutationFn: async ({ serviceName, apiKey }: { serviceName: string; apiKey: string }) => {
      if (!companyId) throw new Error('No company');

      // Try update first, then insert (upsert via onConflict)
      const { data, error } = await supabase
        .from('company_api_keys')
        .upsert(
          { company_id: companyId, service_name: serviceName, api_key: apiKey },
          { onConflict: 'company_id,service_name' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-api-keys', companyId] });
      toast.success('API key saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save API key: ${error.message}`);
    },
  });
}

export function useDeleteApiKey() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const companyId = profile?.company_id;

  return useMutation({
    mutationFn: async (serviceName: string) => {
      if (!companyId) throw new Error('No company');
      const { error } = await supabase
        .from('company_api_keys')
        .delete()
        .eq('company_id', companyId)
        .eq('service_name', serviceName);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-api-keys', companyId] });
      toast.success('API key removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove API key: ${error.message}`);
    },
  });
}
