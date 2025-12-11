import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface MalformedProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface FixAddressesResult {
  fixed: number;
  failed: MalformedProperty[];
}

export function useMalformedAddresses() {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['malformed-addresses', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];

      // Fetch all properties with empty city, state, OR zip
      const { data, error } = await supabase
        .from('properties')
        .select('id, address, city, state, zip')
        .eq('company_id', company.id)
        .or('city.is.null,city.eq.,state.is.null,state.eq.,zip.is.null,zip.eq.');

      if (error) throw error;

      // Return all incomplete addresses for Geocodio processing
      return (data || []).map(prop => ({
        id: prop.id,
        address: prop.address,
        city: prop.city || '',
        state: prop.state || '',
        zip: prop.zip || '',
      }));
    },
    enabled: !!company?.id,
  });
}

export function useFixAddresses() {
  const { company } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (properties: MalformedProperty[]): Promise<FixAddressesResult> => {
      if (!company?.id || properties.length === 0) return { fixed: 0, failed: [] };

      const toastId = toast.loading(`Fixing ${properties.length} addresses via Geocodio...`);

      // Build full address strings for Geocodio
      const addressesToVerify = properties.map((prop, idx) => {
        // Combine available parts into a full address string for Geocodio
        const parts = [prop.address, prop.city, prop.state, prop.zip].filter(p => p.trim());
        return {
          address: parts.join(', '),
          city: '',
          state: '',
          zip: '',
          index: idx,
        };
      });

      const { data, error } = await supabase.functions.invoke('verify-address-batch', {
        body: { addresses: addressesToVerify },
      });

      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Failed to verify addresses', { id: toastId });
        return { fixed: 0, failed: properties };
      }

      // Track both successes and failures
      let fixed = 0;
      const failed: MalformedProperty[] = [];
      const CHUNK_SIZE = 50;
      
      // Process results
      const results = data.results || [];
      
      for (let i = 0; i < results.length; i += CHUNK_SIZE) {
        const chunk = results.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(
          chunk.map(async (result: any) => {
            const prop = properties[result.index];
            
            if (result.success && result.standardized && 
                result.standardized.city && result.standardized.state && result.standardized.zip) {
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
              } else {
                failed.push(prop);
              }
            } else {
              // Geocodio couldn't fully parse this address
              failed.push(prop);
            }
          })
        );

        toast.loading(`Processed ${Math.min(i + CHUNK_SIZE, results.length)} / ${results.length}...`, { id: toastId });
      }

      if (failed.length > 0) {
        toast.warning(`Fixed ${fixed} addresses, ${failed.length} could not be parsed`, { id: toastId });
      } else {
        toast.success(`Fixed ${fixed} addresses via Geocodio`, { id: toastId });
      }
      
      return { fixed, failed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['malformed-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['property-count'] });
    },
  });
}
