import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { parseFullAddress, isFullAddressField } from '@/lib/addressParser';

export interface MalformedProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  parsed: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
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

      // Filter and parse those with full addresses in address field
      const malformed: MalformedProperty[] = [];
      
      for (const prop of data || []) {
        if (isFullAddressField(prop.address, prop.city || '', prop.state || '')) {
          const parsed = parseFullAddress(prop.address);
          if (parsed.isValid) {
            malformed.push({
              id: prop.id,
              address: prop.address,
              city: prop.city || '',
              state: prop.state || '',
              zip: prop.zip || '',
              parsed: {
                street: parsed.street,
                city: parsed.city,
                state: parsed.state,
                zip: parsed.zip || prop.zip || '',
              },
            });
          }
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

      const toastId = toast.loading(`Fixing ${properties.length} addresses...`);

      let fixed = 0;
      const CHUNK_SIZE = 50;

      // Process in chunks
      for (let i = 0; i < properties.length; i += CHUNK_SIZE) {
        const chunk = properties.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(
          chunk.map(async (prop) => {
            const { error } = await supabase
              .from('properties')
              .update({
                address: prop.parsed.street,
                city: prop.parsed.city,
                state: prop.parsed.state,
                zip: prop.parsed.zip,
              })
              .eq('id', prop.id);

            if (!error) {
              fixed++;
            }
          })
        );

        toast.loading(`Fixed ${Math.min(i + CHUNK_SIZE, properties.length)} / ${properties.length}...`, { id: toastId });
      }

      toast.success(`Fixed ${fixed} addresses`, { id: toastId });
      return { fixed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['malformed-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['property-count'] });
    },
  });
}
