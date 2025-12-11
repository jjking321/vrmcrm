import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isFullAddressField } from '@/lib/addressParser';

export interface MalformedProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export function useMalformedAddresses() {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['malformed-addresses', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];

      // Fetch all properties with empty city/state
      const { data, error } = await supabase
        .from('properties')
        .select('id, address, city, state, zip')
        .eq('company_id', company.id)
        .or('city.is.null,city.eq.,state.is.null,state.eq.');

      if (error) throw error;

      // Filter those with full addresses in address field
      const malformed: MalformedProperty[] = [];
      
      for (const prop of data || []) {
        if (isFullAddressField(prop.address, prop.city || '', prop.state || '')) {
          malformed.push({
            id: prop.id,
            address: prop.address,
            city: prop.city || '',
            state: prop.state || '',
            zip: prop.zip || '',
          });
        }
      }

      return malformed;
    },
    enabled: !!company?.id,
  });
}

export function useFixAddresses() {
  const { company } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (properties: MalformedProperty[]) => {
      if (!company?.id || properties.length === 0) return { fixed: 0 };

      const toastId = toast.loading(`Fixing ${properties.length} addresses via Geocodio...`);

      // Send all addresses to Geocodio for proper parsing
      const addressesToVerify = properties.map((prop, idx) => ({
        address: prop.address,
        city: '',
        state: '',
        zip: '',
        index: idx,
      }));

      const { data, error } = await supabase.functions.invoke('verify-address-batch', {
        body: { addresses: addressesToVerify },
      });

      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Failed to verify addresses', { id: toastId });
        return { fixed: 0 };
      }

      // Update properties with Geocodio-parsed results
      let fixed = 0;
      const CHUNK_SIZE = 50;
      const successfulResults = (data.results || []).filter((r: any) => r.success && r.standardized);

      for (let i = 0; i < successfulResults.length; i += CHUNK_SIZE) {
        const chunk = successfulResults.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(
          chunk.map(async (result: any) => {
            const prop = properties[result.index];
            const { error: updateError } = await supabase
              .from('properties')
              .update({
                address: result.standardized.street,
                city: result.standardized.city,
                state: result.standardized.state,
                zip: result.standardized.zip,
                latitude: result.latitude,
                longitude: result.longitude,
              })
              .eq('id', prop.id);

            if (!updateError) {
              fixed++;
            }
          })
        );

        toast.loading(`Fixed ${Math.min(i + CHUNK_SIZE, successfulResults.length)} / ${successfulResults.length}...`, { id: toastId });
      }

      toast.success(`Fixed ${fixed} addresses via Geocodio`, { id: toastId });
      return { fixed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['malformed-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['property-count'] });
    },
  });
}
